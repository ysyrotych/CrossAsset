"""
Ratings Check Job — runs hourly.
Blocking FMP API calls run in thread pool to keep event loop free.
"""
import asyncio
import logging
from agents.ratings_agent import check_analyst_ratings
from config import WATCHLIST

log = logging.getLogger(__name__)

SKIP_RATINGS = {"SPY", "QQQ", "GLD", "VOO", "VUG", "BTC-USD"}


async def run_ratings_check(send_fn):
    log.debug("Running analyst ratings check")
    loop = asyncio.get_running_loop()
    for ticker in WATCHLIST:
        if ticker in SKIP_RATINGS:
            continue
        try:
            await loop.run_in_executor(None, check_analyst_ratings, ticker, send_fn)
        except Exception as e:
            log.warning(f"ratings_check({ticker}): {e}")
