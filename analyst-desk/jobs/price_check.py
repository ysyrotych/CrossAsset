"""
Price Check Job — runs every 5 minutes during market hours.
All blocking yfinance/API calls run in a thread pool so the event loop stays free.
"""
import asyncio
import logging
from data.prices import is_market_hours
from agents.price_watcher import check_price_move, check_gap_open
from config import WATCHLIST

log = logging.getLogger(__name__)

_gap_checked_today: set[str] = set()


async def run_price_check(send_fn):
    """Main price check — called by scheduler every 5 min."""
    if not is_market_hours():
        return

    log.debug("Running price check")
    loop = asyncio.get_running_loop()

    for ticker in WATCHLIST:
        try:
            if ticker not in _gap_checked_today:
                await loop.run_in_executor(None, check_gap_open, ticker, send_fn)
                _gap_checked_today.add(ticker)

            await loop.run_in_executor(None, check_price_move, ticker, send_fn)
        except Exception as e:
            log.warning(f"price_check({ticker}): {e}")


def reset_gap_tracker():
    _gap_checked_today.clear()
