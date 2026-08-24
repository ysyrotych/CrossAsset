"""
News Check Job — runs every 15 minutes.
Runs blocking news fetches + Claude scoring in thread pool to keep event loop free.
"""
import asyncio
import logging
from agents.news_analyst import check_news
from config import WATCHLIST

log = logging.getLogger(__name__)


async def run_news_check(send_fn):
    """Scan news for all watchlist tickers."""
    log.info(f"Running news scan for {len(WATCHLIST)} tickers")
    loop = asyncio.get_running_loop()
    for ticker in WATCHLIST:
        try:
            await loop.run_in_executor(None, check_news, ticker, send_fn)
        except Exception as e:
            log.warning(f"news_check({ticker}): {e}")
