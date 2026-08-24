"""
Insider Cluster Detection — Loop 4
Alerts when 2+ insiders buy the same stock within 30 days.
CEO + CFO simultaneously = rare conviction signal.
"""
import logging
from datetime import datetime, timedelta
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL_FAST, WATCHLIST
from data.fmp import get_insider_trades
from db.queries import (already_alerted, record_alert, make_hash,
                         record_insider_trade, get_recent_insider_buys)
from agents.chief_of_staff import try_send_alert

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)

# Roles that carry most conviction when they buy
HIGH_CONVICTION_ROLES = ["CEO", "CFO", "COO", "CTO", "President", "Chairman", "Director"]


def _is_buy(transaction_type: str) -> bool:
    t = (transaction_type or "").upper()
    return "P" in t or "BUY" in t or "PURCHASE" in t


def _extract_role(name: str, title: str = "") -> str:
    for role in HIGH_CONVICTION_ROLES:
        if role.upper() in (title or name or "").upper():
            return role
    return "Insider"


def check_insider_clusters(ticker: str, send_fn) -> bool:
    """
    Fetch recent insider trades, record buys, detect clusters of 2+.
    Returns True if a cluster alert was sent.
    """
    trades = get_insider_trades(ticker, limit=20)
    if not trades:
        return False

    # Record all recent purchases
    for t in trades:
        if not _is_buy(t.get("transactionType", "")):
            continue
        name   = t.get("reportingName", "")
        shares = abs(t.get("securitiesTransacted", 0) or 0)
        price  = t.get("price", 0) or 0
        value  = shares * price
        date   = t.get("transactionDate", "")
        if value < 10_000:
            continue
        try:
            record_insider_trade(ticker, name, t.get("transactionType", "P"),
                                  shares, price, value, date)
        except Exception:
            pass

    # Check for cluster (2+ unique buyers in last 30 days)
    recent = get_recent_insider_buys(ticker, days=30)
    unique_buyers = {r["name"] for r in recent}
    if len(unique_buyers) < 2:
        return False

    total_value = sum(r["value"] for r in recent)
    content_hash = make_hash(ticker, "insider_cluster",
                              ",".join(sorted(unique_buyers)))
    if already_alerted(ticker, "insider_cluster", content_hash):
        return False

    # Build alert
    buy_lines = "\n".join([
        f"  • {r['name']}: ${r['value']:,.0f}  ({r['date']})"
        for r in recent
    ])

    high_rank = sum(1 for r in recent
                    if any(role in r["name"].upper() for role in ["CEO","CFO","CTO","PRESIDENT"]))

    conviction = "EXTREME" if high_rank >= 2 else "HIGH" if high_rank == 1 else "NOTABLE"

    msg = f"""🟢 INSIDER CLUSTER BUY · {ticker}

{len(unique_buyers)} insiders bought in the last 30 days
Total conviction capital: ${total_value:,.0f}
Conviction level: {conviction}

BUYERS:
{buy_lines}

When multiple insiders buy simultaneously, they typically know something
the market hasn't priced yet. This is one of the strongest insider signals."""

    try_send_alert(ticker, "insider_cluster", content_hash, "WATCH", msg, send_fn)
    return True
