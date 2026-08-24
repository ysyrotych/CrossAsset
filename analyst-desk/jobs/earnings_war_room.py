"""Earnings War Room Job — runs every 15 min."""
import asyncio
import logging
from agents.earnings_war_room import run_earnings_war_room

log = logging.getLogger(__name__)


async def run_war_room_check(send_fn):
    try:
        await run_earnings_war_room(send_fn)
    except Exception as e:
        log.warning(f"earnings_war_room: {e}")
