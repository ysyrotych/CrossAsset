"""Crisis Detection Job — runs every 5 min during market hours."""
import asyncio
import logging
from data.prices import is_market_hours
from agents.crisis_agent import check_crisis

log = logging.getLogger(__name__)


async def run_crisis_check(send_fn):
    if not is_market_hours():
        return
    try:
        await check_crisis(send_fn)
    except Exception as e:
        log.warning(f"crisis_check: {e}")
