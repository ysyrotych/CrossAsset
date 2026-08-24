"""
Ratings Check Job — runs hourly.
Monitors analyst upgrades, downgrades, and price target changes.
"""
import logging
from agents.ratings_agent import check_analyst_ratings
from config import WATCHLIST

log = logging.getLogger(__name__)

SKIP_RATINGS = {"SPY", "QQQ", "GLD", "BTC-USD"}


async def run_ratings_check(send_fn):
    """Check analyst ratings for all watchlist tickers."""
    log.debug("Running analyst ratings check")
    for ticker in WATCHLIST:
        if ticker in SKIP_RATINGS:
            continue
        try:
            msgs = check_analyst_ratings(ticker, send_fn)
            if msgs:
                log.info(f"Ratings alerts sent for {ticker}: {len(msgs)}")
        except Exception as e:
            log.warning(f"Ratings check({ticker}): {e}")
