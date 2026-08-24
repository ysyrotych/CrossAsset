"""
Price Check Job — runs every 5 minutes during market hours.
Checks all watchlist tickers for significant price moves and gap opens.
"""
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

    log.debug("Running price check for all watchlist tickers")
    for ticker in WATCHLIST:
        if ticker in ("SPY", "QQQ", "GLD"):  # indexes don't need gap alerts
            check_price_move(ticker, send_fn)
            continue

        # Gap check — once per day, first check after open
        if ticker not in _gap_checked_today:
            check_gap_open(ticker, send_fn)
            _gap_checked_today.add(ticker)

        check_price_move(ticker, send_fn)


def reset_gap_tracker():
    """Called at midnight to reset daily gap tracking."""
    _gap_checked_today.clear()
