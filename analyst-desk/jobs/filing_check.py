"""
Filing Check Job — runs every 30 minutes.
Monitors SEC EDGAR for 8-K, Form 4, and 13D/G filings.
"""
import logging
from agents.filing_monitor import check_8k_filings, check_insider_trades
from config import WATCHLIST

log = logging.getLogger(__name__)

# Index ETFs don't file with SEC — skip them
SKIP_SEC = {"SPY", "QQQ", "GLD"}


async def run_filing_check(send_fn):
    """Check SEC filings for all applicable watchlist tickers."""
    log.debug("Running SEC filing check")
    for ticker in WATCHLIST:
        if ticker in SKIP_SEC:
            continue
        try:
            check_8k_filings(ticker, send_fn)
            check_insider_trades(ticker, send_fn)
        except Exception as e:
            log.warning(f"Filing check({ticker}): {e}")
