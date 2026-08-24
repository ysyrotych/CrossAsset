"""
News Check Job — runs every 15 minutes.
Scans all watchlist tickers for material news.
"""
import logging
from agents.news_analyst import check_news
from config import WATCHLIST

log = logging.getLogger(__name__)


async def run_news_check(send_fn):
    """Scan news for all watchlist tickers."""
    log.debug("Running news scan")
    for ticker in WATCHLIST:
        try:
            msgs = check_news(ticker, send_fn)
            if msgs:
                log.info(f"News alerts sent for {ticker}: {len(msgs)}")
        except Exception as e:
            log.warning(f"News check({ticker}): {e}")
