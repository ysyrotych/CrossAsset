"""
Price data via yfinance.
All functions return plain dicts/lists — no pandas in callers.
"""
import logging
from datetime import datetime
import yfinance as yf
import pytz

log = logging.getLogger(__name__)

ET = pytz.timezone("America/New_York")


def get_quote(ticker: str) -> dict:
    """Return current quote dict for a single ticker."""
    try:
        t = yf.Ticker(ticker)
        info = t.fast_info
        prev_close = getattr(info, "previous_close", None) or getattr(info, "regularMarketPreviousClose", None)
        price = getattr(info, "last_price", None) or getattr(info, "regularMarketPrice", None)
        volume = getattr(info, "last_volume", None) or getattr(info, "regularMarketVolume", None)
        day_high = getattr(info, "day_high", None)
        day_low  = getattr(info, "day_low", None)
        year_high = getattr(info, "year_high", None)
        year_low  = getattr(info, "year_low", None)

        change_pct = ((price - prev_close) / prev_close) if price and prev_close else None
        return {
            "ticker": ticker,
            "price": price,
            "prev_close": prev_close,
            "change_pct": change_pct,
            "volume": volume,
            "day_high": day_high,
            "day_low": day_low,
            "year_high": year_high,
            "year_low": year_low,
        }
    except Exception as e:
        log.warning(f"get_quote({ticker}): {e}")
        return {"ticker": ticker, "price": None, "prev_close": None, "change_pct": None, "volume": None}


def get_quotes_batch(tickers: list[str]) -> dict[str, dict]:
    """Fetch quotes for multiple tickers in one yfinance call."""
    out = {}
    try:
        data = yf.download(
            tickers, period="2d", interval="1d",
            group_by="ticker", auto_adjust=True,
            progress=False, threads=True,
        )
        for ticker in tickers:
            try:
                if len(tickers) == 1:
                    closes = data["Close"].dropna()
                else:
                    closes = data[ticker]["Close"].dropna()
                if len(closes) >= 2:
                    price = float(closes.iloc[-1])
                    prev  = float(closes.iloc[-2])
                    out[ticker] = {"ticker": ticker, "price": price, "prev_close": prev,
                                   "change_pct": (price - prev) / prev}
                else:
                    out[ticker] = get_quote(ticker)
            except Exception:
                out[ticker] = get_quote(ticker)
    except Exception as e:
        log.warning(f"get_quotes_batch: {e}")
        for t in tickers:
            out[t] = get_quote(t)
    return out


def get_avg_volume(ticker: str, days: int = 30) -> float | None:
    """Compute 30-day average daily volume."""
    try:
        df = yf.download(ticker, period=f"{days + 5}d", interval="1d",
                         auto_adjust=True, progress=False)
        if df.empty:
            return None
        return float(df["Volume"].tail(days).mean())
    except Exception as e:
        log.warning(f"get_avg_volume({ticker}): {e}")
        return None


def get_history(ticker: str, period: str = "1y") -> list[dict]:
    """Return OHLCV history as list of dicts."""
    try:
        df = yf.download(ticker, period=period, interval="1d",
                         auto_adjust=True, progress=False)
        if df.empty:
            return []
        records = []
        for idx, row in df.iterrows():
            records.append({
                "date": idx.strftime("%Y-%m-%d"),
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low":  float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row["Volume"]),
            })
        return records
    except Exception as e:
        log.warning(f"get_history({ticker}): {e}")
        return []


def get_market_snapshot() -> dict:
    """SPX, NDX, VIX, DXY, Oil, Gold — for morning brief."""
    indices = {
        "SPX": "^GSPC", "NDX": "^NDX", "VIX": "^VIX",
        "DXY": "DX-Y.NYB", "OIL": "CL=F", "GOLD": "GC=F",
        "BTC": "BTC-USD",
    }
    result = {}
    for label, sym in indices.items():
        q = get_quote(sym)
        result[label] = {"price": q.get("price"), "change_pct": q.get("change_pct")}
    return result


def is_market_hours() -> bool:
    """Return True if US equity market is currently open."""
    now_et = datetime.now(ET)
    if now_et.weekday() >= 5:  # Saturday / Sunday
        return False
    open_h, open_m = 9, 30
    close_h, close_m = 16, 0
    t = now_et.hour * 60 + now_et.minute
    return (open_h * 60 + open_m) <= t < (close_h * 60 + close_m)


def get_premarket_quote(ticker: str) -> dict:
    """Fetch pre-market / after-hours price via yfinance."""
    try:
        t = yf.Ticker(ticker)
        info = t.info
        pre = info.get("preMarketPrice") or info.get("postMarketPrice")
        pre_chg = info.get("preMarketChangePercent") or info.get("postMarketChangePercent")
        return {"ticker": ticker, "extended_price": pre, "extended_change_pct": pre_chg}
    except Exception as e:
        log.warning(f"get_premarket_quote({ticker}): {e}")
        return {"ticker": ticker, "extended_price": None, "extended_change_pct": None}
