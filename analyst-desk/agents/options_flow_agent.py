"""
Options Flow Agent — Loop 1
Detects unusual options activity via FMP (IV, put/call ratio) + Finviz scrape.
Big options bets often precede major moves — this is what quant desks watch.
"""
import logging
import time
import re
import requests
from config import FMP_API_KEY, ANTHROPIC_API_KEY, MODEL_FAST, WATCHLIST
from anthropic import Anthropic

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)

_FMP_BASE = "https://financialmodelingprep.com/api/v3"
_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 1800  # 30 min


def _fmp_options_chain(ticker: str) -> list[dict]:
    """Fetch options chain from FMP — free tier supports basic options data."""
    try:
        url = f"{_FMP_BASE}/historical/options/chain/{ticker}?apikey={FMP_API_KEY}"
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list):
                return data[:50]
    except Exception as e:
        log.debug(f"FMP options ({ticker}): {e}")
    return []


def _finviz_options_data(ticker: str) -> dict:
    """Scrape IV, Put/Call ratio from Finviz."""
    try:
        url = f"https://finviz.com/quote.ashx?t={ticker}"
        headers = {"User-Agent": "Mozilla/5.0 (compatible; AnalystBot/1.0)"}
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            return {}
        text = r.text

        result = {}
        # Option/Short metrics on Finviz
        m = re.search(r'Option/Short.*?([0-9.]+)', text, re.DOTALL)
        if m:
            result["option_short"] = m.group(1)

        # Volatility metrics
        m2 = re.search(r'Volatility.*?([0-9.]+)%\s+([0-9.]+)%', text, re.DOTALL)
        if m2:
            result["vol_week"] = float(m2.group(1))
            result["vol_month"] = float(m2.group(2))

        return result
    except Exception as e:
        log.debug(f"Finviz options ({ticker}): {e}")
        return {}


def analyze_options_flow(ticker: str) -> dict:
    """
    Analyze options chain for unusual activity.
    Returns: {put_call_ratio, iv_skew, unusual_strikes, signal}
    """
    now = time.time()
    if ticker in _cache:
        ts, data = _cache[ticker]
        if now - ts < _CACHE_TTL:
            return data

    chain   = _fmp_options_chain(ticker)
    finv    = _finviz_options_data(ticker)

    result  = {
        "ticker": ticker,
        "put_call_ratio": None,
        "iv_30d": None,
        "vol_week": finv.get("vol_week"),
        "vol_month": finv.get("vol_month"),
        "unusual_calls": [],
        "unusual_puts": [],
        "signal": "NEUTRAL",
    }

    if chain:
        calls = [o for o in chain if o.get("callPut", "").upper() == "C"]
        puts  = [o for o in chain if o.get("callPut", "").upper() == "P"]

        if calls and puts:
            call_vol = sum(o.get("volume", 0) or 0 for o in calls)
            put_vol  = sum(o.get("volume", 0) or 0 for o in puts)
            if call_vol > 0:
                result["put_call_ratio"] = round(put_vol / call_vol, 3)

        # Find unusual volume: volume > 5× open interest
        for o in chain:
            vol = o.get("volume", 0) or 0
            oi  = o.get("openInterest", 0) or 0
            if oi > 0 and vol > oi * 3 and vol > 500:
                strike   = o.get("strike")
                exp      = o.get("expirationDate", "")[:10]
                cp       = o.get("callPut", "")
                entry    = {"strike": strike, "exp": exp, "volume": vol, "oi": oi}
                if cp.upper() == "C":
                    result["unusual_calls"].append(entry)
                else:
                    result["unusual_puts"].append(entry)

        # Signal determination
        pcr = result["put_call_ratio"] or 1.0
        uc  = len(result["unusual_calls"])
        up  = len(result["unusual_puts"])

        if uc > up and uc >= 2 and pcr < 0.5:
            result["signal"] = "BULLISH"
        elif up > uc and up >= 2 and pcr > 1.5:
            result["signal"] = "BEARISH"
        elif uc >= 3 or up >= 3:
            result["signal"] = "UNUSUAL"

    _cache[ticker] = (now, result)
    return result


def format_options_report(ticker: str) -> str:
    """Format options flow summary for Telegram."""
    data = analyze_options_flow(ticker)

    if not data.get("put_call_ratio") and not data.get("vol_week"):
        return f"⚙️ No options data available for {ticker}"

    signal    = data.get("signal", "NEUTRAL")
    sig_emoji = {"BULLISH": "🟢", "BEARISH": "🔴", "UNUSUAL": "⚠️", "NEUTRAL": "⚪️"}.get(signal, "")

    lines = [f"⚙️ OPTIONS FLOW · {ticker}\n"]

    pcr = data.get("put_call_ratio")
    if pcr:
        lines.append(f"Put/Call Ratio:  {pcr:.2f}  {'(bearish lean)' if pcr > 1 else '(bullish lean)'}")

    vw = data.get("vol_week")
    vm = data.get("vol_month")
    if vw:
        lines.append(f"Weekly Vol:      {vw:.1f}%")
    if vm:
        lines.append(f"Monthly Vol:     {vm:.1f}%")

    calls = data.get("unusual_calls", [])
    if calls:
        lines.append(f"\nUnusual CALLS ({len(calls)}):")
        for c in calls[:3]:
            lines.append(f"  ${c['strike']} exp {c['exp']}  vol {c['volume']:,} vs OI {c['oi']:,}")

    puts = data.get("unusual_puts", [])
    if puts:
        lines.append(f"\nUnusual PUTS ({len(puts)}):")
        for p in puts[:3]:
            lines.append(f"  ${p['strike']} exp {p['exp']}  vol {p['volume']:,} vs OI {p['oi']:,}")

    lines.append(f"\nSignal: {sig_emoji} {signal}")

    if signal in ("BULLISH", "BEARISH", "UNUSUAL"):
        lines.append(
            f"\n{'Smart money is positioning ' + ('long' if signal == 'BULLISH' else 'short' if signal == 'BEARISH' else '') + ' ahead of a catalyst.' if signal != 'UNUSUAL' else 'Unusual flow detected — watch for a catalyst in the next 1-2 weeks.'}"
        )

    return "\n".join(lines)


def check_unusual_options(send_fn) -> None:
    """Scan all portfolio holdings for unusual options activity."""
    SKIP = {"VOO", "VUG"}
    for ticker in WATCHLIST:
        if ticker in SKIP:
            continue
        try:
            data = analyze_options_flow(ticker)
            if data.get("signal") not in ("BULLISH", "BEARISH", "UNUSUAL"):
                continue

            signal = data["signal"]
            sig_emoji = {"BULLISH": "🟢", "BEARISH": "🔴", "UNUSUAL": "⚠️"}.get(signal, "")
            pcr = data.get("put_call_ratio")

            msg = (
                f"{sig_emoji} UNUSUAL OPTIONS · {ticker}\n\n"
                f"Signal: {signal}\n"
            )
            if pcr:
                msg += f"Put/Call: {pcr:.2f}\n"

            calls = data.get("unusual_calls", [])
            puts  = data.get("unusual_puts", [])
            if calls:
                msg += f"Unusual calls: {len(calls)}\n"
            if puts:
                msg += f"Unusual puts: {len(puts)}\n"

            msg += "\nSomething may be brewing. Check /options for details."

            try:
                import asyncio
                loop = asyncio.get_running_loop()
                asyncio.run_coroutine_threadsafe(send_fn(msg), loop)
            except RuntimeError:
                import asyncio
                asyncio.run(send_fn(msg))

        except Exception as e:
            log.warning(f"check_unusual_options({ticker}): {e}")
