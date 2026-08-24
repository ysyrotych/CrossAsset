"""Cross-Asset Check Job — runs every 30 min during market hours."""
import asyncio
import logging
from data.prices import is_market_hours
from agents.cross_asset_agent import check_cross_asset

log = logging.getLogger(__name__)


async def run_cross_asset_check(send_fn):
    if not is_market_hours():
        return
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, check_cross_asset, send_fn)
    except Exception as e:
        log.warning(f"cross_asset_check: {e}")
