"""
Filing Check Job — runs every 30 minutes.
Blocking SEC/requests calls run in thread pool to keep event loop free.
"""
import asyncio
import logging
from agents.filing_monitor import check_8k_filings, check_insider_trades
from config import WATCHLIST

log = logging.getLogger(__name__)

SKIP_SEC = {"SPY", "QQQ", "GLD", "VOO", "VUG"}


async def run_filing_check(send_fn):
    log.debug("Running SEC filing check")
    loop = asyncio.get_running_loop()
    for ticker in WATCHLIST:
        if ticker in SKIP_SEC:
            continue
        try:
            await loop.run_in_executor(None, check_8k_filings, ticker, send_fn)
            await loop.run_in_executor(None, check_insider_trades, ticker, send_fn)
        except Exception as e:
            log.warning(f"filing_check({ticker}): {e}")
