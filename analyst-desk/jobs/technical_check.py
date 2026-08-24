"""Technical Signal Job — runs every 2 hours. Checks RSI, MACD, MA crossovers."""
import asyncio
import logging
from agents.technical_signals import check_technical_signals
from config import WATCHLIST

log = logging.getLogger(__name__)
SKIP = {"VOO", "VUG"}


async def run_technical_check(send_fn):
    log.debug("Running technical signal check")
    loop = asyncio.get_running_loop()
    for ticker in WATCHLIST:
        if ticker in SKIP:
            continue
        try:
            await loop.run_in_executor(None, check_technical_signals, ticker, send_fn)
        except Exception as e:
            log.warning(f"technical_check({ticker}): {e}")
