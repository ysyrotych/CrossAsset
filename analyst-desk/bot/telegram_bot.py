"""
Telegram Bot — initializes the bot, registers handlers, provides send_alert().
"""
import logging
from telegram import Bot
from telegram.ext import (Application, CommandHandler, CallbackQueryHandler,
                           MessageHandler, filters)
from telegram.error import TelegramError

from config import TELEGRAM_BOT_TOKEN, TELEGRAM_USER_ID
from bot.commands import (
    cmd_start, cmd_portfolio, cmd_price, cmd_news, cmd_deep,
    cmd_earnings, cmd_insider, cmd_ratings, cmd_macro,
    cmd_brief, cmd_digest, cmd_mute, cmd_unmute, cmd_status,
    cmd_calendar, cmd_setup_calendar, cmd_cal_code,
    cmd_chart, cmd_pnl, cmd_technical, cmd_shorts, cmd_options,
    cmd_transcript, cmd_fed, cmd_journal, cmd_rule,
    handle_message, handle_callback,
)
from bot.formatter import split_message

log = logging.getLogger(__name__)

_app: Application | None = None


def build_app() -> Application:
    """Build and configure the Telegram Application."""
    global _app
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Slash commands
    app.add_handler(CommandHandler("start",          cmd_start))
    app.add_handler(CommandHandler("portfolio",      cmd_portfolio))
    app.add_handler(CommandHandler("price",          cmd_price))
    app.add_handler(CommandHandler("news",           cmd_news))
    app.add_handler(CommandHandler("deep",           cmd_deep))
    app.add_handler(CommandHandler("earnings",       cmd_earnings))
    app.add_handler(CommandHandler("insider",        cmd_insider))
    app.add_handler(CommandHandler("ratings",        cmd_ratings))
    app.add_handler(CommandHandler("macro",          cmd_macro))
    app.add_handler(CommandHandler("brief",          cmd_brief))
    app.add_handler(CommandHandler("digest",         cmd_digest))
    app.add_handler(CommandHandler("mute",           cmd_mute))
    app.add_handler(CommandHandler("unmute",         cmd_unmute))
    app.add_handler(CommandHandler("status",         cmd_status))
    app.add_handler(CommandHandler("calendar",       cmd_calendar))
    app.add_handler(CommandHandler("setup_calendar", cmd_setup_calendar))
    app.add_handler(CommandHandler("cal_code",       cmd_cal_code))
    app.add_handler(CommandHandler("chart",          cmd_chart))
    app.add_handler(CommandHandler("pnl",            cmd_pnl))
    app.add_handler(CommandHandler("technical",      cmd_technical))
    app.add_handler(CommandHandler("shorts",         cmd_shorts))
    app.add_handler(CommandHandler("options",        cmd_options))
    app.add_handler(CommandHandler("transcript",     cmd_transcript))
    app.add_handler(CommandHandler("fed",            cmd_fed))
    app.add_handler(CommandHandler("journal",        cmd_journal))
    app.add_handler(CommandHandler("rule",           cmd_rule))

    # Inline keyboard button presses
    app.add_handler(CallbackQueryHandler(handle_callback))

    # Free-form text (menu buttons + natural language)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    _app = app
    return app


async def send_alert(message: str):
    """Push an alert to the configured Telegram user."""
    if not TELEGRAM_USER_ID or not TELEGRAM_BOT_TOKEN:
        log.warning("Telegram not configured — alert dropped")
        return

    bot = _app.bot if _app else Bot(token=TELEGRAM_BOT_TOKEN)
    for chunk in split_message(message):
        try:
            await bot.send_message(chat_id=TELEGRAM_USER_ID, text=chunk)
        except TelegramError as e:
            log.warning(f"Telegram send_alert: {e}")


async def send_photo_alert(photo_bytes, caption: str = ""):
    """Push a photo/chart to the configured Telegram user."""
    if not TELEGRAM_USER_ID or not TELEGRAM_BOT_TOKEN:
        log.warning("Telegram not configured — photo dropped")
        return
    bot = _app.bot if _app else Bot(token=TELEGRAM_BOT_TOKEN)
    try:
        photo_bytes.seek(0)
        await bot.send_photo(
            chat_id=TELEGRAM_USER_ID,
            photo=photo_bytes,
            caption=caption[:1024],
        )
    except TelegramError as e:
        log.warning(f"Telegram send_photo_alert: {e}")
