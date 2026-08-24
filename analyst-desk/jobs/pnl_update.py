"""P&L Update Job — intraday every 30 min + close heatmap at 4:30 PM ET."""
import asyncio
import logging
from agents.pnl_agent import run_pnl_update, run_close_heatmap

log = logging.getLogger(__name__)


async def run_intraday_pnl(send_fn):
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, lambda: asyncio.run(_async_pnl(send_fn)))


async def _async_pnl(send_fn):
    await run_pnl_update(send_fn, close=False)


async def run_close_pnl(send_fn, send_photo_fn=None):
    """Called at market close — sends heatmap + records day."""
    loop = asyncio.get_running_loop()

    async def _do():
        if send_photo_fn:
            await run_close_heatmap(send_fn, send_photo_fn)
        else:
            await run_pnl_update(send_fn, close=True)

    await _do()
