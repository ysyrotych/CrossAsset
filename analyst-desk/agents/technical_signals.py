"""
Technical Signal Engine — Loop 2
RSI, MACD, moving average crossovers, support/resistance.
Alerts only when multiple signals converge.
"""
import logging
import numpy as np
import yfinance as yf
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL_FAST, WATCHLIST
from db.queries import already_alerted, record_alert, make_hash, upsert_technical_signal
from agents.chief_of_staff import try_send_alert, SEVERITY_ICONS

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)


def _fetch_history(ticker: str, period: str = "1y") -> tuple[list, list, list, list, list]:
    """Returns (dates, opens, highs, lows, closes, volumes)."""
    try:
        df = yf.download(ticker, period=period, interval="1d", auto_adjust=True, progress=False)
        if df.empty or len(df) < 20:
            return [], [], [], [], []
        closes = df["Close"].dropna().tolist()
        highs  = df["High"].dropna().tolist()
        lows   = df["Low"].dropna().tolist()
        vols   = df["Volume"].dropna().tolist()
        return closes, highs, lows, vols
    except Exception as e:
        log.warning(f"_fetch_history({ticker}): {e}")
        return [], [], [], []


def _rsi(closes: list, period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    deltas = [closes[i] - closes[i-1] for i in range(1, len(closes))]
    gains  = [d if d > 0 else 0 for d in deltas[-period:]]
    losses = [-d if d < 0 else 0 for d in deltas[-period:]]
    avg_g  = sum(gains) / period
    avg_l  = sum(losses) / period
    if avg_l == 0:
        return 100.0
    rs = avg_g / avg_l
    return round(100 - (100 / (1 + rs)), 2)


def _macd(closes: list) -> tuple[float, float, float] | tuple[None, None, None]:
    """Returns (macd_line, signal_line, histogram)."""
    if len(closes) < 26:
        return None, None, None

    def ema(data, n):
        k = 2 / (n + 1)
        result = [data[0]]
        for p in data[1:]:
            result.append(p * k + result[-1] * (1 - k))
        return result

    ema12 = ema(closes, 12)
    ema26 = ema(closes, 26)
    macd_line = [e12 - e26 for e12, e26 in zip(ema12[-len(ema26):], ema26)]
    signal = ema(macd_line, 9)
    hist = macd_line[-1] - signal[-1]
    return round(macd_line[-1], 4), round(signal[-1], 4), round(hist, 4)


def _moving_averages(closes: list) -> dict:
    def ma(n):
        if len(closes) < n:
            return None
        return round(sum(closes[-n:]) / n, 2)
    return {"ma20": ma(20), "ma50": ma(50), "ma200": ma(200)}


def compute_signals(ticker: str) -> dict | None:
    """Compute all technical indicators for a ticker. Returns signal dict."""
    closes, highs, lows, vols = _fetch_history(ticker)
    if not closes:
        return None

    price = closes[-1]
    rsi   = _rsi(closes)
    macd, macd_signal, macd_hist = _macd(closes)
    mas   = _moving_averages(closes)

    # 52W levels
    year_high = max(highs[-252:]) if len(highs) >= 252 else max(highs)
    year_low  = min(lows[-252:])  if len(lows)  >= 252 else min(lows)

    # Support / resistance — recent local extremes
    recent_highs = highs[-20:]
    recent_lows  = lows[-20:]
    resistance = max(recent_highs)
    support    = min(recent_lows)

    # Score convergence
    signals = []
    if rsi and rsi < 30:
        signals.append(("RSI OVERSOLD", f"RSI {rsi:.1f}", "BULLISH"))
    elif rsi and rsi > 70:
        signals.append(("RSI OVERBOUGHT", f"RSI {rsi:.1f}", "BEARISH"))

    if macd and macd_signal:
        prev_macd, prev_sig, _ = _macd(closes[:-1])
        if prev_macd and prev_sig:
            if prev_macd < prev_sig and macd > macd_signal:
                signals.append(("MACD BULLISH CROSSOVER", f"MACD {macd:.3f} crossed above signal", "BULLISH"))
            elif prev_macd > prev_sig and macd < macd_signal:
                signals.append(("MACD BEARISH CROSSOVER", f"MACD {macd:.3f} crossed below signal", "BEARISH"))

    if mas["ma50"] and mas["ma200"]:
        prev_mas = _moving_averages(closes[:-1])
        if prev_mas["ma50"] and prev_mas["ma200"]:
            if prev_mas["ma50"] < prev_mas["ma200"] and mas["ma50"] > mas["ma200"]:
                signals.append(("GOLDEN CROSS", "50d MA crossed above 200d MA", "BULLISH"))
            elif prev_mas["ma50"] > prev_mas["ma200"] and mas["ma50"] < mas["ma200"]:
                signals.append(("DEATH CROSS", "50d MA crossed below 200d MA", "BEARISH"))

    near_52w_high = price >= year_high * 0.99
    near_52w_low  = price <= year_low * 1.01
    if near_52w_high:
        signals.append(("52W HIGH BREAK", f"${price:.2f} at 52-week high (${year_high:.2f})", "BULLISH"))
    if near_52w_low:
        signals.append(("52W LOW", f"${price:.2f} near 52-week low (${year_low:.2f})", "BEARISH"))

    upsert_technical_signal(ticker, rsi or 0, macd or 0, macd_signal or 0,
                             mas["ma50"] or 0, mas["ma200"] or 0, price)

    return {
        "ticker": ticker, "price": price, "rsi": rsi,
        "macd": macd, "macd_signal": macd_signal, "macd_hist": macd_hist,
        "ma20": mas["ma20"], "ma50": mas["ma50"], "ma200": mas["ma200"],
        "year_high": year_high, "year_low": year_low,
        "support": support, "resistance": resistance,
        "signals": signals,
    }


def check_technical_signals(ticker: str, send_fn) -> bool:
    """Check and alert on technical signals. Alert only when ≥2 signals converge."""
    data = compute_signals(ticker)
    if not data or len(data["signals"]) < 2:
        return False

    signals = data["signals"]
    # All must agree on direction for a strong signal
    directions = [s[2] for s in signals]
    if len(set(directions)) > 1:
        return False

    direction = directions[0]
    content_hash = make_hash(ticker, "technical", direction,
                              str(round(data["price"], 1)))
    if already_alerted(ticker, "technical", content_hash):
        return False

    icon = "🟢" if direction == "BULLISH" else "🔴"
    signal_lines = "\n".join([f"  • {s[0]}: {s[1]}" for s in signals])

    msg = f"""{icon} TECHNICAL SIGNAL · {ticker}

DIRECTION: {direction} ({len(signals)} signals converging)
PRICE: ${data['price']:.2f}

SIGNALS:
{signal_lines}

RSI: {data['rsi']:.1f if data['rsi'] else 'N/A'} · MACD: {data['macd']:.3f if data['macd'] else 'N/A'}
MA50: ${data['ma50']:.2f if data['ma50'] else '—'} · MA200: ${data['ma200']:.2f if data['ma200'] else '—'}
52W: ${data['year_low']:.2f} — ${data['year_high']:.2f}"""

    severity = "WATCH"
    try_send_alert(ticker, "technical", content_hash, severity, msg, send_fn)
    return True
