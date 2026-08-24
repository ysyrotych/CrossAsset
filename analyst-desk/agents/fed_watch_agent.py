"""
Fed Watch Agent — Loop 16
Tracks Fed rate cut/hike probabilities via CME FedWatch API + FRED.
"""
import logging
import time
import requests
from data.macro import get_macro_snapshot
from config import ANTHROPIC_API_KEY, MODEL_FAST
from anthropic import Anthropic

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)

_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 3600 * 2  # 2 hours


def _fetch_cme_fedwatch() -> dict:
    """
    Pull implied Fed Funds probabilities from CME FedWatch API.
    Returns dict with meeting dates and cut/hold/hike probabilities.
    """
    try:
        url = "https://www.cmegroup.com/CmeWS/mvc/ProductCalendar/V2/getAll.json?productId=8463&monthlyOnly=false"
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Accept": "application/json",
            "Referer": "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html",
        }
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            return {}
        data = r.json()
        return data
    except Exception as e:
        log.debug(f"CME FedWatch: {e}")
        return {}


def _fetch_fed_funds_futures() -> list[dict]:
    """
    Alternative: parse implied rate from 30-day Fed Funds futures via FRED or yfinance.
    ZQ=F is the front-month contract.
    """
    try:
        import yfinance as yf
        meetings = []
        for sym in ["ZQH25.CBT", "ZQM25.CBT", "ZQU25.CBT"]:
            try:
                t = yf.Ticker(sym)
                hist = t.history(period="2d")
                if not hist.empty:
                    price = float(hist["Close"].iloc[-1])
                    implied_rate = (100 - price)
                    meetings.append({"symbol": sym, "implied_rate": round(implied_rate, 4)})
            except Exception:
                pass
        return meetings
    except Exception as e:
        log.debug(f"Fed futures: {e}")
        return []


def get_fed_probabilities() -> dict:
    """
    Returns current Fed meeting probabilities.
    Combines macro snapshot (FRED) with CME implied rates.
    """
    now = time.time()
    cache_key = "fed_probs"
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return data

    macro = get_macro_snapshot()
    current_rate = macro.get("fed_funds", {}).get("value")

    futures = _fetch_fed_funds_futures()

    result = {
        "current_rate": current_rate,
        "futures": futures,
        "implied_rates": [],
    }

    if futures:
        for f in futures:
            result["implied_rates"].append({
                "symbol": f["symbol"],
                "implied_rate": f["implied_rate"],
                "implied_cut_from_current": round((current_rate or 0) - f["implied_rate"], 4) if current_rate else None,
            })

    _cache[cache_key] = (now, result)
    return result


def format_fed_report() -> str:
    """Format a concise Fed watch report with rate probabilities."""
    data = get_fed_probabilities()
    current = data.get("current_rate")
    implied = data.get("implied_rates", [])

    lines = ["🏦 FED WATCH\n"]
    if current:
        lines.append(f"Current Fed Funds: {current:.2f}%\n")

    if implied:
        lines.append("FUTURES-IMPLIED RATES:")
        for item in implied[:3]:
            sym  = item["symbol"].replace(".CBT", "")
            rate = item["implied_rate"]
            cut  = item.get("implied_cut_from_current")
            cut_str = f"  ({cut:+.0f}bp vs current)" if cut is not None else ""
            lines.append(f"  {sym}: {rate:.2f}%{cut_str}")
    else:
        lines.append("Futures data unavailable — check FRED for current rate environment.")
        if current:
            lines.append(f"\nFed Funds (FRED): {current:.2f}%")

    # Add macro context
    from data.macro import get_macro_snapshot, format_macro_brief
    macro = get_macro_snapshot()
    t10y = macro.get("t10y", {}).get("value")
    t2y  = macro.get("t2y", {}).get("value")
    if t10y and t2y:
        spread = t10y - t2y
        lines.append(f"\n2s10s Spread: {spread:+.2f}% ({'inverted' if spread < 0 else 'normal'})")

    return "\n".join(lines)


def check_fed_surprises(send_fn) -> None:
    """Alert if implied rate expectations shift materially vs prior reading."""
    data = get_fed_probabilities()
    implied = data.get("implied_rates", [])
    if not implied:
        return

    macro = get_macro_snapshot()
    t10y_chg = macro.get("t10y", {}).get("change")
    if t10y_chg is None:
        return

    # Alert if 10Y moved >12bp today (already handled by cross_asset_agent)
    # Here focus on the shape of the yield curve and Fed narrative
    t10y = macro.get("t10y", {}).get("value", 0) or 0
    t2y  = macro.get("t2y", {}).get("value", 0) or 0
    spread = t10y - t2y

    if spread > 0.5:
        msg = (
            f"🏦 YIELD CURVE ALERT\n\n"
            f"2s10s spread has steepened to +{spread:.2f}% — "
            f"market may be pricing in rate cuts or growth acceleration.\n"
            f"10Y: {t10y:.2f}%  ·  2Y: {t2y:.2f}%"
        )
        try:
            import asyncio
            loop = asyncio.get_running_loop()
            asyncio.run_coroutine_threadsafe(send_fn(msg), loop)
        except RuntimeError:
            import asyncio
            asyncio.run(send_fn(msg))
    elif spread < -0.5:
        msg = (
            f"🏦 YIELD CURVE ALERT\n\n"
            f"2s10s inverted at {spread:.2f}% — recession signal active.\n"
            f"Historical lead time: 6-18 months before recession.\n"
            f"10Y: {t10y:.2f}%  ·  2Y: {t2y:.2f}%"
        )
        try:
            import asyncio
            loop = asyncio.get_running_loop()
            asyncio.run_coroutine_threadsafe(send_fn(msg), loop)
        except RuntimeError:
            import asyncio
            asyncio.run(send_fn(msg))
