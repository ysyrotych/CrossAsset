"""
Scheduled job: global market news brief — sent 3× daily.
Sessions: premarket (8:00 AM ET), midday (12:30 PM ET), close (4:30 PM ET).
"""
import logging
from agents.market_news_agent import run_market_news

log = logging.getLogger(__name__)


async def run_market_news_premarket(send_fn):
    await run_market_news(send_fn, session="premarket")


async def run_market_news_midday(send_fn):
    await run_market_news(send_fn, session="midday")


async def run_market_news_close(send_fn):
    await run_market_news(send_fn, session="close")
