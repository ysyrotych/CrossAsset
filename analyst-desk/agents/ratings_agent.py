"""
Ratings Agent — monitors analyst upgrades, downgrades, and price target changes.
"""
import logging
from data.fmp import get_analyst_ratings, get_price_targets, rating_hash
from agents.chief_of_staff import compose_alert_with_claude, try_send_alert
from db.queries import seen_rating, mark_rating_seen, make_hash
from config import WATCHLIST, THRESHOLDS

log = logging.getLogger(__name__)

UPGRADE_ACTIONS   = {"Upgraded to", "Initiated", "Resumed", "Reiterated"}
DOWNGRADE_ACTIONS = {"Downgraded to", "Cut to", "Reduced to"}
STRONG_BUYS = {"Strong Buy", "Outperform", "Buy", "Overweight"}
STRONG_SELLS = {"Strong Sell", "Underperform", "Sell", "Underweight"}


def _classify_rating_change(rating: dict) -> tuple[str, str]:
    """Returns (severity, direction) for a rating change."""
    action = rating.get("action", "") or ""
    new_grade = rating.get("newGrade", "") or ""
    prev_grade = rating.get("previousGrade", "") or ""

    is_upgrade   = any(a.lower() in action.lower() for a in ["upgrade", "initiated", "resumed"])
    is_downgrade = any(a.lower() in action.lower() for a in ["downgrade", "cut", "reduced"])

    if is_downgrade and new_grade in STRONG_SELLS:
        return "URGENT", "DOWNGRADE"
    elif is_downgrade:
        return "WATCH", "DOWNGRADE"
    elif is_upgrade and new_grade in STRONG_BUYS:
        return "POSITIVE", "UPGRADE"
    elif is_upgrade:
        return "POSITIVE", "UPGRADE"
    else:
        return "DATA", "REITERATION"


def check_analyst_ratings(ticker: str, send_fn) -> list[str]:
    """Check for new analyst rating changes and alert."""
    ratings = get_analyst_ratings(ticker, limit=5)
    messages_sent = []

    for r in ratings:
        rhash = rating_hash(r)
        if seen_rating(rhash):
            continue
        mark_rating_seen(rhash, ticker)

        severity, direction = _classify_rating_change(r)
        if severity == "DATA":
            continue  # Skip reiterations

        # Check PT cut magnitude
        new_pt  = r.get("newGradeTarget") or r.get("priceTarget")
        prev_pt = r.get("previousGradeTarget")
        pt_cut  = False
        if new_pt and prev_pt and prev_pt > 0:
            pt_chg = (new_pt - prev_pt) / prev_pt
            if pt_chg <= -THRESHOLDS["pt_cut_pct"]:
                pt_cut = True
                severity = max(severity, "WATCH")  # escalate if big PT cut

        content_hash = make_hash(ticker, "rating", rhash)
        weight = WATCHLIST.get(ticker, {}).get("weight", 0)

        msg = compose_alert_with_claude(ticker, "analyst_rating", {
            "firm":           r.get("gradingCompany", ""),
            "analyst":        r.get("analyst", ""),
            "action":         direction,
            "new_rating":     r.get("newGrade", ""),
            "prev_rating":    r.get("previousGrade", ""),
            "new_pt":         f"${new_pt:.0f}" if new_pt else "N/A",
            "prev_pt":        f"${prev_pt:.0f}" if prev_pt else "N/A",
            "pt_change":      f"{pt_chg*100:+.1f}%" if new_pt and prev_pt and prev_pt > 0 else "N/A",
            "published":      r.get("publishedDate", ""),
            "portfolio_weight": f"{weight*100:.1f}%",
            "note":           "PT cut >10%" if pt_cut else "",
        }, severity)

        sent = try_send_alert(ticker, "analyst_rating", content_hash, severity, msg, send_fn)
        if sent:
            messages_sent.append(msg)

    return messages_sent
