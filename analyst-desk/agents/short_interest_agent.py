"""
Short Interest Agent — Loop 3
Tracks short interest, days-to-cover, and squeeze potential.
Uses FMP + Finviz for free-tier data.
"""
import logging
import time
import requests
from anthropic import Anthropic
from config import FMP_API_KEY, MODEL_FAST, ANTHROPIC_API_KEY

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)

_FMP_BASE = "https://financialmodelingprep.com/api/v4"
_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 3600 * 4  # 4 hours


def _fmp_short_data(ticker: str) -> dict:
    """Fetch short interest data from FMP."""
    try:
        url = f"{_FMP_BASE}/short-interest/{ticker}?apikey={FMP_API_KEY}&limit=3"
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data and isinstance(data, list):
                return data[0]
    except Exception as e:
        log.debug(f"FMP short_interest({ticker}): {e}")
    return {}


def _finviz_short_data(ticker: str) -> dict:
    """Scrape short float % from Finviz public screener."""
    try:
        import re
        url = f"https://finviz.com/quote.ashx?t={ticker}"
        headers = {"User-Agent": "Mozilla/5.0 (compatible; AnalystBot/1.0)"}
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            return {}
        text = r.text

        result = {}
        # Short Float %
        m = re.search(r'Short Float.*?([0-9.]+)%', text, re.DOTALL)
        if m:
            result["short_float_pct"] = float(m.group(1))

        # Short Ratio (days to cover)
        m2 = re.search(r'Short Ratio.*?([0-9.]+)', text, re.DOTALL)
        if m2:
            result["short_ratio"] = float(m2.group(1))

        # Short interest shares
        m3 = re.search(r'Short Interest.*?([0-9.,]+[MKB]?)', text, re.DOTALL)
        if m3:
            result["short_interest_raw"] = m3.group(1).strip()

        return result
    except Exception as e:
        log.debug(f"Finviz short ({ticker}): {e}")
        return {}


def get_short_data(ticker: str) -> dict:
    """Return short interest data — merged from FMP + Finviz."""
    now = time.time()
    if ticker in _cache:
        ts, data = _cache[ticker]
        if now - ts < _CACHE_TTL:
            return data

    fmp  = _fmp_short_data(ticker)
    finv = _finviz_short_data(ticker)

    merged = {
        "short_float_pct":      finv.get("short_float_pct") or fmp.get("shortPercentFloat"),
        "short_ratio":          finv.get("short_ratio") or fmp.get("shortRatio"),
        "short_interest_raw":   finv.get("short_interest_raw"),
        "short_shares":         fmp.get("shortInterest"),
        "settlement_date":      fmp.get("settlementDate", ""),
    }
    _cache[ticker] = (now, merged)
    return merged


def classify_squeeze_risk(data: dict) -> str:
    """Classify short squeeze risk from short interest metrics."""
    short_pct = data.get("short_float_pct") or 0
    days_cover = data.get("short_ratio") or 0

    if short_pct >= 20 and days_cover >= 5:
        return "EXTREME"
    elif short_pct >= 15 or days_cover >= 8:
        return "HIGH"
    elif short_pct >= 10 or days_cover >= 4:
        return "ELEVATED"
    elif short_pct >= 5:
        return "MODERATE"
    return "LOW"


def format_short_report(ticker: str) -> str:
    """Format a human-readable short interest report."""
    data = get_short_data(ticker)
    if not any(v for v in data.values()):
        return f"📉 No short interest data available for {ticker}"

    risk = classify_squeeze_risk(data)
    risk_emoji = {"EXTREME": "🔥", "HIGH": "⚠️", "ELEVATED": "🟡", "MODERATE": "🟢", "LOW": "✅"}.get(risk, "")

    lines = [f"📉 SHORT INTEREST · {ticker}\n"]

    sf = data.get("short_float_pct")
    if sf:
        lines.append(f"Short Float:    {sf:.1f}%")

    sr = data.get("short_ratio")
    if sr:
        lines.append(f"Days to Cover:  {sr:.1f}d")

    si = data.get("short_interest_raw") or data.get("short_shares")
    if si:
        lines.append(f"Short Interest: {si}")

    sd = data.get("settlement_date")
    if sd:
        lines.append(f"As of:          {sd[:10]}")

    lines.append(f"\nSqueeze Risk: {risk_emoji} {risk}")

    if risk in ("EXTREME", "HIGH"):
        lines.append("\n⚠️ Elevated squeeze potential — shorts are crowded.")
        if sf and sf > 20:
            lines.append(f"   {sf:.1f}% float is short — any catalyst could trigger violent covering.")
        if sr and sr > 7:
            lines.append(f"   {sr:.1f} days to cover means sustained buying pressure on any upside.")

    return "\n".join(lines)


def check_short_squeeze_alerts(ticker: str, send_fn) -> None:
    """Alert when short interest metrics cross squeeze thresholds."""
    data = get_short_data(ticker)
    risk = classify_squeeze_risk(data)

    if risk not in ("EXTREME", "HIGH"):
        return

    sf = data.get("short_float_pct", 0) or 0
    sr = data.get("short_ratio", 0) or 0

    msg = (
        f"🔥 SHORT SQUEEZE WATCH · {ticker}\n\n"
        f"Short Float: {sf:.1f}%  ·  Days to Cover: {sr:.1f}\n"
        f"Risk Level: {risk}\n\n"
        f"This level of short interest means catalysts hit harder — "
        f"shorts must cover into any upward momentum."
    )

    try:
        import asyncio
        loop = asyncio.get_running_loop()
        import asyncio as _asyncio
        _asyncio.run_coroutine_threadsafe(send_fn(msg), loop)
    except RuntimeError:
        import asyncio
        asyncio.run(send_fn(msg))
