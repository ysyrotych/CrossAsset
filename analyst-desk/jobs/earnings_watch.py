"""
Earnings Watch Job — runs every 15 minutes around earnings dates.
Sends pre-earnings briefs and catches live earnings releases.
"""
import logging
from datetime import datetime, timedelta
from agents.earnings_agent import (
    get_upcoming_earnings, send_preearnings_brief, check_earnings_release
)
from config import WATCHLIST

log = logging.getLogger(__name__)


async def run_earnings_watch(send_fn):
    """
    1. Check for earnings releasing today/yesterday (live results)
    2. Send pre-earnings briefs for tomorrow's earnings
    """
    log.debug("Running earnings watch")
    today    = datetime.utcnow().strftime("%Y-%m-%d")
    tomorrow = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")

    upcoming = get_upcoming_earnings(days=2)
    ticker_set = set(WATCHLIST.keys())

    for e in upcoming:
        sym  = e.get("symbol", "")
        date = e.get("date", "")
        if sym not in ticker_set:
            continue

        # Send pre-earnings brief for tomorrow
        if date == tomorrow:
            try:
                send_preearnings_brief(sym, date, send_fn)
            except Exception as ex:
                log.warning(f"Pre-earnings brief ({sym}): {ex}")

        # Check if earnings were just released (today)
        if date == today or date == (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d"):
            try:
                check_earnings_release(sym, send_fn)
            except Exception as ex:
                log.warning(f"Earnings release check ({sym}): {ex}")

    # Also check all watchlist tickers for recent surprise earnings
    for ticker in ticker_set:
        if ticker in ("SPY", "QQQ", "GLD"):
            continue
        try:
            check_earnings_release(ticker, send_fn)
        except Exception as ex:
            log.warning(f"Earnings release check ({ticker}): {ex}")
