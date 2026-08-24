"""P&L Update Job — intraday every 30 min + close heatmap at 4:30 PM ET."""
import logging
from data.prices import is_market_hours
from agents.pnl_agent import run_pnl_update, run_close_heatmap

log = logging.getLogger(__name__)


async def run_intraday_pnl(send_fn):
    if not is_market_hours():
        return
    try:
        await run_pnl_update(send_fn, close=False)
    except Exception as e:
        log.warning(f"intraday_pnl: {e}")


async def run_close_pnl(send_fn, send_photo_fn=None):
    """Called at market close — sends heatmap + records day."""
    try:
        if send_photo_fn:
            await run_close_heatmap(send_fn, send_photo_fn)
        else:
            await run_pnl_update(send_fn, close=True)
    except Exception as e:
        log.warning(f"close_pnl: {e}")
