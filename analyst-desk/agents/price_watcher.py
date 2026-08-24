"""
Price Watcher Agent — detects significant price moves, gap opens, volume spikes.
"""
import logging
from db.queries import make_hash, upsert_price_snapshot, get_price_snapshot
from data.prices import get_quote, get_avg_volume
from agents.chief_of_staff import (
    compose_price_alert, compose_alert_with_claude,
    try_send_alert, SEVERITY_ICONS
)
from config import THRESHOLDS, WATCHLIST

log = logging.getLogger(__name__)


def check_price_move(ticker: str, send_fn) -> str | None:
    """
    Check for significant price move for a single ticker.
    Returns alert message if triggered, else None.
    """
    quote = get_quote(ticker)
    price     = quote.get("price")
    prev      = quote.get("prev_close")
    volume    = quote.get("volume")

    if not price or not prev:
        return None

    chg_pct = (price - prev) / prev
    quote["change_pct"] = chg_pct

    # Fetch avg volume if not cached
    snap = get_price_snapshot(ticker)
    avg_vol = snap.avg_volume_30d if snap and snap.avg_volume_30d else get_avg_volume(ticker)
    quote["avg_volume_30d"] = avg_vol

    # Update snapshot
    upsert_price_snapshot(ticker, price, prev, volume or 0, avg_vol or 0)

    abs_chg = abs(chg_pct)
    triggered = abs_chg >= THRESHOLDS["price_move_watch"]
    vol_spike = avg_vol and volume and volume > avg_vol * THRESHOLDS["volume_spike_mult"]

    if not triggered and not vol_spike:
        return None

    if triggered:
        event_type = "price_move_urgent" if abs_chg >= THRESHOLDS["price_move_urgent"] else "price_move_watch"
        severity   = "URGENT" if abs_chg >= THRESHOLDS["price_move_urgent"] else "WATCH"
    else:
        event_type = "volume_spike"
        severity   = "WATCH"

    content_hash = make_hash(ticker, event_type, f"{chg_pct:.4f}", str(quote.get("day_high","")))
    msg, sev = compose_price_alert(ticker, quote, event_type)

    try_send_alert(ticker, event_type, content_hash, sev, msg, send_fn)
    return msg


def check_gap_open(ticker: str, send_fn) -> str | None:
    """
    Detect gap opens — price significantly different from prior close at open.
    Should be called right after market open (9:35-9:45 AM ET).
    """
    quote = get_quote(ticker)
    price = quote.get("price")
    prev  = quote.get("prev_close")

    if not price or not prev:
        return None

    gap_pct = (price - prev) / prev
    if abs(gap_pct) < THRESHOLDS["price_move_gap_urgent"]:
        return None

    severity = "URGENT"
    direction = "GAP UP" if gap_pct > 0 else "GAP DOWN"
    content_hash = make_hash(ticker, "gap_open", f"{gap_pct:.4f}")
    icon = SEVERITY_ICONS[severity]
    weight = WATCHLIST.get(ticker, {}).get("weight", 0)

    msg = compose_alert_with_claude(ticker, "gap_open", {
        "event": f"{direction} {abs(gap_pct)*100:.2f}% at open",
        "price": price, "prev_close": prev, "gap_pct": gap_pct,
        "portfolio_weight": f"{weight*100:.1f}%",
    }, severity)

    try_send_alert(ticker, "gap_open", content_hash, severity, msg, send_fn)
    return msg
