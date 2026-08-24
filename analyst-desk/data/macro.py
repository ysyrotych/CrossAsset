"""
FRED API + Finnhub macro data.
Provides rates, spreads, and economic release monitoring.
"""
import logging
import requests
from datetime import datetime, timedelta
from config import FRED_API_KEY, FINNHUB_API_KEY, MACRO_SERIES

log = logging.getLogger(__name__)
FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"


def _fred(series_id: str, limit: int = 2) -> list[dict]:
    if not FRED_API_KEY:
        return []
    try:
        r = requests.get(FRED_BASE, params={
            "series_id": series_id, "api_key": FRED_API_KEY,
            "file_type": "json", "sort_order": "desc", "limit": limit,
        }, timeout=10)
        if not r.ok:
            return []
        obs = r.json().get("observations", [])
        return [o for o in obs if o.get("value") != "."]
    except Exception as e:
        log.warning(f"FRED({series_id}): {e}")
        return []


def get_macro_snapshot() -> dict:
    """Fetch latest values for all configured FRED series."""
    result = {}
    for label, series_id in MACRO_SERIES.items():
        obs = _fred(series_id, limit=2)
        if obs:
            latest = obs[0]
            prev   = obs[1] if len(obs) > 1 else None
            val = float(latest["value"]) if latest.get("value") != "." else None
            pval = float(prev["value"]) if prev and prev.get("value") != "." else None
            result[label] = {
                "value":   val,
                "prev":    pval,
                "change":  round(val - pval, 4) if val is not None and pval is not None else None,
                "date":    latest.get("date", ""),
            }
        else:
            result[label] = {"value": None, "prev": None, "change": None, "date": ""}
    return result


def get_economic_calendar(days: int = 7) -> list[dict]:
    """Upcoming economic events via Finnhub."""
    if not FINNHUB_API_KEY:
        return []
    try:
        from_date = datetime.utcnow().strftime("%Y-%m-%d")
        to_date   = (datetime.utcnow() + timedelta(days=days)).strftime("%Y-%m-%d")
        r = requests.get(
            "https://finnhub.io/api/v1/calendar/economic",
            params={"token": FINNHUB_API_KEY},
            timeout=10,
        )
        if not r.ok:
            return []
        events = r.json().get("economicCalendar", [])
        # Filter to high-impact events
        high_impact = [e for e in events
                       if e.get("impact") in ("high", "3") and e.get("time", "") >= from_date]
        return sorted(high_impact, key=lambda e: e.get("time", ""))[:20]
    except Exception as e:
        log.warning(f"Finnhub calendar: {e}")
        return []


def format_macro_brief(snapshot: dict) -> str:
    """Format macro snapshot into a readable string for briefs."""
    lines = []
    if snapshot.get("fed_funds"):
        v = snapshot["fed_funds"]["value"]
        lines.append(f"Fed Funds: {v:.2f}%")
    if snapshot.get("t10y"):
        v = snapshot["t10y"]["value"]
        c = snapshot["t10y"]["change"]
        arrow = "▲" if c and c > 0 else "▼" if c and c < 0 else "→"
        lines.append(f"10Y: {v:.2f}% {arrow}{abs(c)*100:.1f}bp" if c else f"10Y: {v:.2f}%")
    if snapshot.get("t2y"):
        v = snapshot["t2y"]["value"]
        lines.append(f"2Y: {v:.2f}%")
    if snapshot.get("hy_spread"):
        v = snapshot["hy_spread"]["value"]
        lines.append(f"HY Spread: {v:.0f}bp")
    if snapshot.get("vix"):
        v = snapshot["vix"]["value"]
        lines.append(f"VIX: {v:.1f}")
    return " · ".join(lines) if lines else "Macro data unavailable"
