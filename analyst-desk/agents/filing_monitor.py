"""
Filing Monitor Agent — watches SEC EDGAR for 8-K material events,
Form 4 insider trades, and activist 13D/G filings.
"""
import logging
from data.sec import get_8k_filings, get_form4_insider, filing_hash
from data.fmp import get_insider_trades, insider_hash
from agents.chief_of_staff import compose_alert_with_claude, try_send_alert
from db.queries import seen_filing, mark_filing_seen, make_hash
from config import WATCHLIST, THRESHOLDS

log = logging.getLogger(__name__)

# 8-K items that indicate material events (always URGENT)
MATERIAL_8K_ITEMS = [
    "1.01", "1.02", "1.03",   # Entry/termination of agreements, bankruptcy
    "2.01", "2.02",             # Acquisition/disposition, results of operations
    "3.01", "3.02",             # Rating changes, unregistered sales
    "4.01",                     # Auditor change
    "5.01", "5.02",             # Director/officer changes
    "7.01", "8.01",             # Regulation FD, other events
]


def check_8k_filings(ticker: str, send_fn) -> list[str]:
    """Check for new 8-K filings and alert on material events."""
    filings = get_8k_filings(ticker, days=2)
    messages_sent = []

    for filing in filings:
        fhash = filing_hash(filing)
        if seen_filing(fhash):
            continue
        mark_filing_seen(fhash, ticker, "8-K")

        severity = "URGENT"
        content_hash = make_hash(ticker, "8k", fhash)
        msg = compose_alert_with_claude(ticker, "8-K filing", {
            "form_type":   "8-K",
            "filed_at":    filing.get("filed_at", ""),
            "title":       filing.get("title", ""),
            "summary":     filing.get("summary", "")[:500],
            "url":         filing.get("url", ""),
            "note":        "8-K = material event required to be disclosed to SEC",
        }, severity)

        sent = try_send_alert(ticker, "8k_filing", content_hash, severity, msg, send_fn)
        if sent:
            messages_sent.append(msg)

    return messages_sent


def check_insider_trades(ticker: str, send_fn) -> list[str]:
    """Check for significant insider transactions via FMP."""
    trades = get_insider_trades(ticker, limit=10)
    messages_sent = []

    for trade in trades:
        thash = insider_hash(trade)
        if seen_filing(thash):
            continue
        mark_filing_seen(thash, ticker, "form4")

        # Determine transaction value
        shares    = abs(trade.get("securitiesTransacted", 0) or 0)
        price     = trade.get("price", 0) or 0
        value     = shares * price
        trans_type = trade.get("transactionType", "").upper()
        is_buy    = "BUY" in trans_type or "P" in trans_type   # P = Purchase on Form 4
        is_sell   = "SELL" in trans_type or "S" in trans_type

        if is_sell and value >= THRESHOLDS["insider_sell_urgent"]:
            severity = "URGENT"
        elif is_sell and value >= THRESHOLDS["insider_sell_watch"]:
            severity = "WATCH"
        elif is_buy and value >= THRESHOLDS["insider_buy_positive"]:
            severity = "POSITIVE"
        else:
            continue  # Not large enough to alert

        content_hash = make_hash(ticker, "insider", thash)
        msg = compose_alert_with_claude(ticker, "insider_trade", {
            "reporting_name":  trade.get("reportingName", ""),
            "title":           trade.get("typeOfOwner", ""),
            "transaction_type": "BUY" if is_buy else "SELL",
            "shares":          f"{shares:,.0f} shares",
            "price":           f"${price:.2f}",
            "value":           f"${value:,.0f}",
            "date":            trade.get("transactionDate", ""),
            "shares_remaining": trade.get("securitiesOwned", "N/A"),
        }, severity)

        sent = try_send_alert(ticker, "insider_trade", content_hash, severity, msg, send_fn)
        if sent:
            messages_sent.append(msg)

    return messages_sent
