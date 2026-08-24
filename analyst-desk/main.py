"""
Analyst Desk — Main Entry Point
Starts APScheduler (all monitoring jobs) + Telegram bot (long-polling).
Both run in the same asyncio event loop.
"""
import asyncio
import logging
import sys
from datetime import datetime

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from config import TELEGRAM_BOT_TOKEN, TELEGRAM_USER_ID, TIMEZONE, LOG_LEVEL
from db.models import init_db
from bot.telegram_bot import build_app, send_alert
from jobs.price_check import run_price_check, reset_gap_tracker
from jobs.news_check import run_news_check
from jobs.filing_check import run_filing_check
from jobs.ratings_check import run_ratings_check
from jobs.morning_brief import run_morning_brief
from jobs.earnings_watch import run_earnings_watch
from jobs.weekly_digest import run_weekly_digest
from jobs.market_news_check import (run_market_news_premarket,
                                     run_market_news_midday,
                                     run_market_news_close)
from db.queries import cleanup_old_records

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("analyst_desk")

TZ = pytz.timezone(TIMEZONE)


# ── Validation ────────────────────────────────────────────────────────────────

def validate_config():
    errors = []
    if not TELEGRAM_BOT_TOKEN:
        errors.append("TELEGRAM_BOT_TOKEN not set")
    if not TELEGRAM_USER_ID:
        errors.append("TELEGRAM_USER_ID not set")
    if errors:
        log.error("Configuration errors:\n" + "\n".join(f"  - {e}" for e in errors))
        log.error("Copy .env.example to .env and fill in your credentials")
        sys.exit(1)


# ── Scheduler setup ───────────────────────────────────────────────────────────

def setup_scheduler(scheduler: AsyncIOScheduler):
    """Register all monitoring jobs with the scheduler."""

    # Price check — every 5 min during market hours (runs every 5 min, job itself checks hours)
    scheduler.add_job(
        lambda: asyncio.create_task(run_price_check(send_alert)),
        IntervalTrigger(minutes=5),
        id="price_check", name="Price Check",
        max_instances=1, coalesce=True,
    )

    # Gap tracker reset — midnight ET
    scheduler.add_job(
        reset_gap_tracker,
        CronTrigger(hour=0, minute=0, timezone=TZ),
        id="gap_reset", name="Gap Tracker Reset",
    )

    # News scan — every 15 min
    scheduler.add_job(
        lambda: asyncio.create_task(run_news_check(send_alert)),
        IntervalTrigger(minutes=15),
        id="news_check", name="News Scan",
        max_instances=1, coalesce=True,
    )

    # Filing check — every 30 min
    scheduler.add_job(
        lambda: asyncio.create_task(run_filing_check(send_alert)),
        IntervalTrigger(minutes=30),
        id="filing_check", name="SEC Filing Check",
        max_instances=1, coalesce=True,
    )

    # Analyst ratings — hourly
    scheduler.add_job(
        lambda: asyncio.create_task(run_ratings_check(send_alert)),
        IntervalTrigger(hours=1),
        id="ratings_check", name="Analyst Ratings",
        max_instances=1, coalesce=True,
    )

    # Earnings watch — every 15 min
    scheduler.add_job(
        lambda: asyncio.create_task(run_earnings_watch(send_alert)),
        IntervalTrigger(minutes=15),
        id="earnings_watch", name="Earnings Watch",
        max_instances=1, coalesce=True,
    )

    # Morning brief — 7:00 AM ET daily
    scheduler.add_job(
        lambda: asyncio.create_task(run_morning_brief(send_alert)),
        CronTrigger(hour=7, minute=0, timezone=TZ),
        id="morning_brief", name="Morning Brief",
    )

    # Weekly digest — Sunday 6 PM ET
    scheduler.add_job(
        lambda: asyncio.create_task(run_weekly_digest(send_alert)),
        CronTrigger(day_of_week="sun", hour=18, minute=0, timezone=TZ),
        id="weekly_digest", name="Weekly Digest",
    )

    # Market news — pre-market 8 AM ET
    scheduler.add_job(
        lambda: asyncio.create_task(run_market_news_premarket(send_alert)),
        CronTrigger(hour=8, minute=0, timezone=TZ),
        id="market_news_premarket", name="Market News Pre-Market",
    )

    # Market news — midday 12:30 PM ET
    scheduler.add_job(
        lambda: asyncio.create_task(run_market_news_midday(send_alert)),
        CronTrigger(hour=12, minute=30, timezone=TZ),
        id="market_news_midday", name="Market News Midday",
    )

    # Market news — close 4:30 PM ET
    scheduler.add_job(
        lambda: asyncio.create_task(run_market_news_close(send_alert)),
        CronTrigger(hour=16, minute=30, timezone=TZ),
        id="market_news_close", name="Market News Close",
    )

    # DB cleanup — daily at 3 AM ET
    scheduler.add_job(
        cleanup_old_records,
        CronTrigger(hour=3, minute=0, timezone=TZ),
        id="db_cleanup", name="DB Cleanup",
    )

    log.info(f"Scheduled {len(scheduler.get_jobs())} jobs")


# ── Main ──────────────────────────────────────────────────────────────────────

async def main():
    log.info("=" * 50)
    log.info("ANALYST DESK — Starting up")
    log.info("=" * 50)

    validate_config()

    # Init database
    init_db()
    log.info("Database initialized")

    # Build Telegram app
    app = build_app()

    # Setup scheduler
    scheduler = AsyncIOScheduler(timezone=TZ)
    setup_scheduler(scheduler)
    scheduler.start()
    log.info("Scheduler started")

    # Send startup notification
    startup_msg = (
        f"🏦 TYLER — Online\n"
        f"Started at {datetime.now(TZ).strftime('%Y-%m-%d %H:%M:%S %Z')}\n"
        f"Monitoring {len(__import__('config').WATCHLIST)} securities\n\n"
        f"Use the buttons below or just talk to me naturally."
    )

    # Start Telegram bot with polling
    async with app:
        await app.initialize()
        await app.start()

        from telegram import ReplyKeyboardMarkup, KeyboardButton
        kb = ReplyKeyboardMarkup([
            [KeyboardButton("📊 Portfolio"), KeyboardButton("📈 Markets"), KeyboardButton("📰 News")],
            [KeyboardButton("🔬 Research"),  KeyboardButton("📅 Earnings"), KeyboardButton("🌍 Macro")],
            [KeyboardButton("📅 Calendar"),  KeyboardButton("⚡ Brief"),    KeyboardButton("⚙️ Status")],
        ], resize_keyboard=True, persistent=True)
        await app.bot.send_message(chat_id=TELEGRAM_USER_ID, text=startup_msg, reply_markup=kb)
        log.info("Telegram bot started — polling for messages")

        # Run until interrupted
        await app.updater.start_polling(drop_pending_updates=True)
        try:
            await asyncio.Event().wait()   # block forever
        except (KeyboardInterrupt, SystemExit):
            log.info("Shutdown signal received")
        finally:
            scheduler.shutdown(wait=False)
            await app.updater.stop()
            await app.stop()
            log.info("Analyst Desk shut down cleanly")


if __name__ == "__main__":
    asyncio.run(main())
