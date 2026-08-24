"""Custom Alert Rules Job — runs every 5 min during market hours."""
import asyncio
import logging
from data.prices import is_market_hours
from agents.custom_rules_agent import check_custom_rules

log = logging.getLogger(__name__)


async def run_custom_rules_check(send_fn):
    if not is_market_hours():
        return
    try:
        await check_custom_rules(send_fn)
    except Exception as e:
        log.warning(f"custom_rules_check: {e}")
