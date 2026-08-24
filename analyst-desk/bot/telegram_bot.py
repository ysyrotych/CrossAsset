"""
Telegram Bot — initializes the bot, registers commands, provides send_alert().
"""
import logging
from telegram import Bot
from telegram.ext import Application, CommandHandler, filters, MessageHandler
from telegram.error import TelegramError

from config import TELEGRAM_BOT_TOKEN, TELEGRAM_USER_ID
from bot.commands import (
    cmd_start, cmd_portfolio, cmd_price, cmd_news, cmd_deep,
    cmd_earnings, cmd_insider, cmd_ratings, cmd_macro,
    cmd_brief, cmd_digest, cmd_add, cmd_remove, cmd_mute,
    cmd_unmute, cmd_status, cmd_thresholds,
)
from bot.formatter import split_message

log = logging.getLogger(__name__)

_app: Application | None = None


def build_app() -> Application:
    """Build and configure the Telegram Application."""
    global _app
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Register all command handlers
    app.add_handler(CommandHandler("start",      cmd_start))
    app.add_handler(CommandHandler("portfolio",  cmd_portfolio))
    app.add_handler(CommandHandler("price",      cmd_price))
    app.add_handler(CommandHandler("news",       cmd_news))
    app.add_handler(CommandHandler("deep",       cmd_deep))
    app.add_handler(CommandHandler("earnings",   cmd_earnings))
    app.add_handler(CommandHandler("insider",    cmd_insider))
    app.add_handler(CommandHandler("ratings",    cmd_ratings))
    app.add_handler(CommandHandler("macro",      cmd_macro))
    app.add_handler(CommandHandler("brief",      cmd_brief))
    app.add_handler(CommandHandler("digest",     cmd_digest))
    app.add_handler(CommandHandler("add",        cmd_add))
    app.add_handler(CommandHandler("remove",     cmd_remove))
    app.add_handler(CommandHandler("mute",       cmd_mute))
    app.add_handler(CommandHandler("unmute",     cmd_unmute))
    app.add_handler(CommandHandler("status",     cmd_status))
    app.add_handler(CommandHandler("thresholds", cmd_thresholds))

    _app = app
    return app


async def send_alert(message: str):
    """
    Push an alert message to the configured Telegram user.
    Called by all monitoring jobs when something material is detected.
    """
    if not TELEGRAM_USER_ID or not TELEGRAM_BOT_TOKEN:
        log.warning("Telegram not configured — alert dropped")
        log.info(f"ALERT (dropped): {message[:200]}")
        return

    bot = _app.bot if _app else Bot(token=TELEGRAM_BOT_TOKEN)
    for chunk in split_message(message):
        try:
            await bot.send_message(chat_id=TELEGRAM_USER_ID, text=chunk)
        except TelegramError as e:
            log.warning(f"Telegram send_alert: {e}")
