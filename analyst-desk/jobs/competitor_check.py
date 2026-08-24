"""Competitor Intelligence Job — runs every 2 hours."""
import asyncio
import logging
from agents.competitor_agent import check_competitor_news
from config import WATCHLIST

log = logging.getLogger(__name__)
SKIP = {"VOO", "VUG"}


async def run_competitor_check(send_fn):
    log.debug("Running competitor intelligence check")
    loop = asyncio.get_running_loop()
    for ticker in WATCHLIST:
        if ticker in SKIP:
            continue
        try:
            await loop.run_in_executor(None, check_competitor_news, ticker, send_fn)
        except Exception as e:
            log.warning(f"competitor_check({ticker}): {e}")
