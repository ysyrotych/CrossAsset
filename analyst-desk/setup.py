"""
Analyst Desk — Interactive Setup Script
Run: python setup.py
Walks you through creating your .env file and verifying all API connections.
"""
import os
import sys
import subprocess

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BLUE   = "\033[94m"
BOLD   = "\033[1m"
RESET  = "\033[0m"


def print_header():
    print(f"\n{BOLD}{'=' * 55}{RESET}")
    print(f"{BOLD}  ANALYST DESK — Setup{RESET}")
    print(f"{BOLD}{'=' * 55}{RESET}\n")


def ask(prompt: str, default: str = "") -> str:
    val = input(f"{BLUE}{prompt}{RESET}" + (f" [{default}]" if default else "") + ": ").strip()
    return val or default


def check_import(pkg: str) -> bool:
    try:
        __import__(pkg)
        return True
    except ImportError:
        return False


def test_telegram(token: str, user_id: str) -> bool:
    try:
        import requests
        r = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=8)
        if not r.ok:
            print(f"  {RED}✗ Invalid Telegram bot token{RESET}")
            return False
        bot_name = r.json()["result"]["username"]
        print(f"  {GREEN}✓ Bot connected: @{bot_name}{RESET}")

        # Send test message
        r2 = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": int(user_id), "text": "🏦 Analyst Desk — setup test message. If you see this, Telegram is configured correctly!"},
            timeout=8,
        )
        if r2.ok:
            print(f"  {GREEN}✓ Test message sent to your Telegram{RESET}")
        else:
            print(f"  {YELLOW}⚠ Could not send message to chat ID {user_id} — check your user ID{RESET}")
        return True
    except Exception as e:
        print(f"  {RED}✗ Telegram error: {e}{RESET}")
        return False


def test_fmp(key: str) -> bool:
    try:
        import requests
        r = requests.get(f"https://financialmodelingprep.com/api/v3/profile/AAPL?apikey={key}", timeout=8)
        if r.ok and isinstance(r.json(), list):
            print(f"  {GREEN}✓ FMP API key valid{RESET}")
            return True
        print(f"  {RED}✗ FMP API key invalid (HTTP {r.status_code}){RESET}")
        return False
    except Exception as e:
        print(f"  {RED}✗ FMP error: {e}{RESET}")
        return False


def test_fred(key: str) -> bool:
    try:
        import requests
        r = requests.get(
            "https://api.stlouisfed.org/fred/series/observations",
            params={"series_id": "FEDFUNDS", "api_key": key, "file_type": "json", "limit": 1},
            timeout=8,
        )
        if r.ok:
            print(f"  {GREEN}✓ FRED API key valid{RESET}")
            return True
        print(f"  {RED}✗ FRED API key invalid{RESET}")
        return False
    except Exception as e:
        print(f"  {RED}✗ FRED error: {e}{RESET}")
        return False


def test_anthropic(key: str) -> bool:
    try:
        import anthropic
        c = anthropic.Anthropic(api_key=key)
        c.messages.create(model="claude-haiku-4-5-20251001", max_tokens=10,
                          messages=[{"role":"user","content":"ping"}])
        print(f"  {GREEN}✓ Anthropic API key valid{RESET}")
        return True
    except Exception as e:
        print(f"  {RED}✗ Anthropic error: {e}{RESET}")
        return False


def main():
    print_header()

    # Check dependencies
    print(f"{BOLD}Step 1: Checking dependencies{RESET}")
    missing = []
    for pkg in ["anthropic", "telegram", "apscheduler", "yfinance", "feedparser", "sqlalchemy"]:
        if check_import(pkg):
            print(f"  {GREEN}✓{RESET} {pkg}")
        else:
            print(f"  {RED}✗{RESET} {pkg} — run: pip install -r requirements.txt")
            missing.append(pkg)

    if missing:
        print(f"\n{RED}Install missing packages first:{RESET}")
        print(f"  pip install -r requirements.txt")
        sys.exit(1)

    print(f"\n{BOLD}Step 2: Configure credentials{RESET}")
    print("You'll need:")
    print("  1. Telegram bot token — create bot via @BotFather on Telegram")
    print("     Send /newbot to @BotFather, get the token")
    print("  2. Your Telegram user ID — send /start to @userinfobot")
    print()

    telegram_token = ask("Telegram bot token")
    telegram_uid   = ask("Your Telegram user ID (numeric)")
    anthropic_key  = ask("Anthropic API key")
    fmp_key        = ask("FMP API key (free at financialmodelingprep.com)")
    fred_key       = ask("FRED API key (free at fred.stlouisfed.org)")
    news_key       = ask("NewsAPI key (free at newsapi.org)", default="")
    finnhub_key    = ask("Finnhub API key (free at finnhub.io)", default="")
    timezone       = ask("Your timezone", default="America/New_York")

    print(f"\n{BOLD}Step 3: Testing connections{RESET}")
    test_telegram(telegram_token, telegram_uid)
    if fmp_key:     test_fmp(fmp_key)
    if fred_key:    test_fred(fred_key)
    if anthropic_key: test_anthropic(anthropic_key)

    print(f"\n{BOLD}Step 4: Writing .env file{RESET}")
    env_content = f"""TELEGRAM_BOT_TOKEN={telegram_token}
TELEGRAM_USER_ID={telegram_uid}
ANTHROPIC_API_KEY={anthropic_key}
FMP_API_KEY={fmp_key}
FRED_API_KEY={fred_key}
NEWS_API_KEY={news_key}
FINNHUB_API_KEY={finnhub_key}
TIMEZONE={timezone}
LOG_LEVEL=INFO
"""
    with open(".env", "w") as f:
        f.write(env_content)
    print(f"  {GREEN}✓ .env written{RESET}")

    print(f"\n{BOLD}Step 5: Initialize database{RESET}")
    try:
        sys.path.insert(0, ".")
        from db.models import init_db
        init_db()
        print(f"  {GREEN}✓ Database initialized{RESET}")
    except Exception as e:
        print(f"  {RED}✗ DB error: {e}{RESET}")

    print(f"\n{BOLD}{'=' * 55}{RESET}")
    print(f"{GREEN}{BOLD}Setup complete! Start the desk with:{RESET}")
    print(f"\n  python main.py\n")
    print(f"Or deploy to Railway:")
    print(f"  railway up\n")
    print(f"Customize your watchlist in {BOLD}config.py{RESET}")
    print(f"{BOLD}{'=' * 55}{RESET}\n")


if __name__ == "__main__":
    main()
