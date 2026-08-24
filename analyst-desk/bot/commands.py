"""
Telegram command + callback handlers with full button UI.
ReplyKeyboardMarkup provides persistent bottom menu.
InlineKeyboardMarkup provides contextual action buttons per ticker.
Natural language messages are handled via Claude routing.
"""
import logging
from datetime import datetime

import pytz
from telegram import (Update, InlineKeyboardButton, InlineKeyboardMarkup,
                       ReplyKeyboardMarkup, KeyboardButton)
from telegram.ext import ContextTypes
from anthropic import Anthropic

from config import (WATCHLIST, ANTHROPIC_API_KEY, MODEL_DEEP, MODEL_FAST,
                    THRESHOLDS, TIMEZONE)
from data.prices import get_quote, get_quotes_batch, get_market_snapshot
from data.news import get_all_news
from data.fmp import (get_analyst_ratings, get_insider_trades,
                      get_key_metrics, get_profile, get_income_statement,
                      get_analyst_consensus)
from data.macro import get_macro_snapshot
from db.queries import mute_ticker, unmute_ticker, is_muted
from bot.formatter import fmt_pct, fmt_price, fmt_large, split_message
from agents.earnings_agent import get_upcoming_earnings
from agents.calendar_agent import (parse_calendar_intent, create_event,
                                    get_upcoming_calendar_events, format_events_list,
                                    generate_auth_url, exchange_auth_code,
                                    is_calendar_request, get_calendar_service)
from jobs.morning_brief import run_morning_brief
from jobs.weekly_digest import run_weekly_digest
from agents.technical_signals import compute_signals
from agents.short_interest_agent import format_short_report
from agents.options_flow_agent import format_options_report
from agents.transcript_agent import get_transcript_analysis
from agents.fed_watch_agent import format_fed_report
from agents.trade_journal import format_thesis_report, record_trade_decision
from agents.custom_rules_agent import register_custom_rule

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)

TZ = pytz.timezone(TIMEZONE)


# ── Portfolio helpers ─────────────────────────────────────────────────────────

def compute_portfolio(quotes: dict) -> dict:
    """Compute portfolio values and weights from shares × live price."""
    holdings = []
    total_value = 0.0
    for ticker, info in WATCHLIST.items():
        shares = info.get("shares", 0)
        q = quotes.get(ticker, {})
        price = q.get("price") or 0.0
        value = shares * price
        total_value += value
        holdings.append({
            "ticker": ticker, "shares": shares, "price": price,
            "value": value, "change_pct": q.get("change_pct"),
            "sector": info.get("sector", ""),
        })
    for h in holdings:
        h["weight"] = h["value"] / total_value if total_value > 0 else 0.0
    return {"holdings": holdings, "total_value": total_value}


# ── Keyboards ─────────────────────────────────────────────────────────────────

def main_menu() -> ReplyKeyboardMarkup:
    """Persistent bottom keyboard — always visible."""
    rows = [
        [KeyboardButton("📊 Portfolio"), KeyboardButton("📈 Markets"), KeyboardButton("📰 News")],
        [KeyboardButton("🔬 Research"),  KeyboardButton("📅 Earnings"), KeyboardButton("🌍 Macro")],
        [KeyboardButton("📅 Calendar"),  KeyboardButton("⚡ Brief"),    KeyboardButton("⚙️ Status")],
    ]
    return ReplyKeyboardMarkup(rows, resize_keyboard=True)


def ticker_actions(ticker: str) -> InlineKeyboardMarkup:
    """Inline action buttons shown under any ticker response."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🔬 Deep Brief",  callback_data=f"deep:{ticker}"),
            InlineKeyboardButton("📰 News",        callback_data=f"news:{ticker}"),
        ],
        [
            InlineKeyboardButton("👤 Insider",     callback_data=f"insider:{ticker}"),
            InlineKeyboardButton("📊 Ratings",     callback_data=f"ratings:{ticker}"),
        ],
        [
            InlineKeyboardButton("📈 Chart",       callback_data=f"chart:{ticker}"),
            InlineKeyboardButton("⚙️ Options",     callback_data=f"options:{ticker}"),
        ],
        [
            InlineKeyboardButton("📉 Shorts",      callback_data=f"shorts:{ticker}"),
            InlineKeyboardButton("📓 Journal",     callback_data=f"journal:{ticker}"),
        ],
    ])


def portfolio_ticker_grid() -> InlineKeyboardMarkup:
    """Grid of portfolio tickers as tappable buttons."""
    tickers = list(WATCHLIST.keys())
    rows = []
    row: list = []
    for t in tickers:
        row.append(InlineKeyboardButton(t, callback_data=f"price:{t}"))
        if len(row) == 4:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton("🔬 Research Any", callback_data="prompt:deep")])
    return InlineKeyboardMarkup(rows)


# ── Unified send helper ───────────────────────────────────────────────────────

async def send(update: Update, text: str, markup=None):
    """Send with smart splitting and always re-attach main menu."""
    chunks = split_message(text)
    for i, chunk in enumerate(chunks):
        is_last = (i == len(chunks) - 1)
        kb = markup if (is_last and markup) else (main_menu() if is_last else None)
        if update.callback_query:
            await update.effective_message.reply_text(chunk, reply_markup=kb)
        else:
            await update.message.reply_text(chunk, reply_markup=kb)


# ── /start ────────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = (
        "🏦 TYLER — Your Personal Analyst\n\n"
        "I monitor your portfolio 24/7 and alert you when something matters.\n\n"
        "Use the buttons below, or just talk to me naturally:\n"
        "• \"What happened to META today?\"\n"
        "• \"Add a meeting with John tomorrow at 3pm\"\n"
        "• \"Is NVDA still a buy?\"\n"
        "• \"Biggest news today?\""
    )
    await send(update, msg)


# ── Portfolio ─────────────────────────────────────────────────────────────────

async def cmd_portfolio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text("Fetching portfolio...")
    tickers = list(WATCHLIST.keys())
    quotes = get_quotes_batch(tickers)
    pf = compute_portfolio(quotes)
    total = pf["total_value"]
    holdings = sorted(pf["holdings"], key=lambda h: -h["value"])

    weighted_chg = sum(
        h["weight"] * h["change_pct"]
        for h in holdings if h["change_pct"] is not None
    )

    lines = [f"📊 PORTFOLIO  ·  Total: {fmt_large(total)}\n"]
    for h in holdings:
        chg = h["change_pct"]
        arrow = "▲" if (chg or 0) >= 0 else "▼"
        chg_str = f"{arrow}{abs(chg)*100:.2f}%" if chg is not None else "—"
        lines.append(
            f"{h['ticker']:<6} {fmt_price(h['price']):>9}  {chg_str:>8}  "
            f"{fmt_large(h['value']):>8}  {h['weight']*100:.1f}%"
        )

    arrow = "▲" if weighted_chg >= 0 else "▼"
    pnl = total * weighted_chg
    lines.append(f"\nToday: {arrow}{abs(weighted_chg)*100:.2f}%  ·  P&L: {fmt_large(pnl)}")
    await send(update, "\n".join(lines), portfolio_ticker_grid())


# ── Markets ───────────────────────────────────────────────────────────────────

async def cmd_markets(update: Update, context: ContextTypes.DEFAULT_TYPE):
    market = get_market_snapshot()
    lines = ["📈 MARKETS — Live\n"]
    for key, label in [("SPX","S&P 500"), ("NDX","Nasdaq 100"), ("VIX","VIX"),
                        ("DXY","Dollar (DXY)"), ("OIL","WTI Oil"), ("GOLD","Gold"), ("BTC","Bitcoin")]:
        d = market.get(key, {})
        p = d.get("price")
        c = d.get("change_pct")
        if p:
            arrow = "▲" if (c or 0) >= 0 else "▼"
            chg = f" {arrow}{abs(c)*100:.2f}%" if c else ""
            lines.append(f"{label:<15} {p:>12,.2f}{chg}")

    macro_kb = InlineKeyboardMarkup([[
        InlineKeyboardButton("📊 Full Macro", callback_data="macro:full"),
        InlineKeyboardButton("📅 Econ Calendar", callback_data="macro:calendar"),
    ]])
    await send(update, "\n".join(lines), macro_kb)


# ── Price ─────────────────────────────────────────────────────────────────────

async def cmd_price(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str = None):
    if not ticker:
        args = context.args or []
        ticker = args[0].upper() if args else None
    if not ticker:
        await send(update, "Which ticker? Tap one below or type: /price NVDA",
                   portfolio_ticker_grid())
        return

    ticker = ticker.upper()
    q = get_quote(ticker)
    price = q.get("price")
    if not price:
        await send(update, f"Couldn't fetch quote for {ticker}")
        return

    chg = q.get("change_pct") or 0
    arrow = "▲" if chg >= 0 else "▼"
    high = q.get("year_high")
    low  = q.get("year_low")
    info = WATCHLIST.get(ticker, {})
    shares = info.get("shares", 0)

    lines = [f"📈 {ticker}\n",
             f"Price:   {fmt_price(price)}  {arrow}{abs(chg)*100:.2f}%"]
    if high and low:
        from_high = (price - high) / high
        lines.append(f"52W:     {fmt_price(low)} — {fmt_price(high)}  ({fmt_pct(from_high)} from high)")
    if shares > 0:
        lines.append(f"You own: {shares} sh  ·  {fmt_large(shares * price)}")
    if is_muted(ticker):
        lines.append("⚠️ Alerts muted")

    await send(update, "\n".join(lines), ticker_actions(ticker))


# ── News ──────────────────────────────────────────────────────────────────────

async def cmd_news(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str = None):
    if not ticker:
        args = context.args or []
        ticker = args[0].upper() if args else None
    if not ticker:
        await send(update, "Which ticker? e.g. /news META", portfolio_ticker_grid())
        return

    ticker = ticker.upper()
    await update.effective_message.reply_text(f"Scanning news for {ticker}...")
    prof = get_profile(ticker)
    company = prof.get("companyName", "") if prof else ""
    articles = get_all_news(ticker, company, days=2)

    if not articles:
        await send(update, f"No recent news for {ticker}")
        return

    lines = [f"📰 NEWS — {ticker}\n"]
    for i, a in enumerate(articles[:8], 1):
        src   = a.get("source", "")
        title = a.get("title", "")[:90]
        lines.append(f"{i}. [{src}] {title}")

    await send(update, "\n".join(lines), ticker_actions(ticker))


# ── Deep Research ─────────────────────────────────────────────────────────────

async def cmd_deep(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str = None):
    if not ticker:
        args = context.args or []
        ticker = args[0].upper() if args else None
    if not ticker:
        await send(update, "Which ticker? e.g. /deep AAPL", portfolio_ticker_grid())
        return

    ticker = ticker.upper()
    await update.effective_message.reply_text(f"🔬 Researching {ticker}... (~30 sec)")

    prof      = get_profile(ticker)
    metrics   = get_key_metrics(ticker)
    quote     = get_quote(ticker)
    ratings   = get_analyst_ratings(ticker, limit=3)
    articles  = get_all_news(ticker, days=2)[:5]
    info      = WATCHLIST.get(ticker, {})
    shares    = info.get("shares", 0)
    thesis    = info.get("thesis", "Not in portfolio.")

    news_str = "\n".join([f"- {a.get('title','')[:90]}" for a in articles])
    ratings_str = "\n".join([
        f"- {r.get('gradingCompany','')} → {r.get('newGrade','')} PT ${r.get('priceTarget','?')}"
        for r in ratings
    ])

    prompt = f"""Write an institutional research brief for {ticker}.

COMPANY: {prof.get('companyName','') if prof else ticker}
DESCRIPTION: {(prof.get('description','')[:300] if prof else '')}
PRICE: ${quote.get('price','N/A')} ({fmt_pct(quote.get('change_pct'))} today)
POSITION: {shares} shares owned
THESIS: {thesis}

METRICS: P/E {metrics.get('peRatioTTM','N/A') if metrics else 'N/A'} · \
FCF Yield {metrics.get('freeCashFlowYieldTTM','N/A') if metrics else 'N/A'} · \
ROIC {metrics.get('roicTTM','N/A') if metrics else 'N/A'}
ANALYST RATINGS: {ratings_str or 'None'}
RECENT NEWS: {news_str or 'None'}

Write:
🔬 DEEP BRIEF · {ticker}

INVESTMENT SUMMARY (3 sentences)
BUSINESS QUALITY (moat, margins, market position)
FINANCIALS (key metrics, trends)
BULL CASE (3 bullets)
BEAR CASE (3 bullets)
THESIS CHECK (intact / watch / challenged — why)
BOTTOM LINE (1 sentence)

Max 400 words. Institutional tone. No disclaimers."""

    try:
        resp = client.messages.create(model=MODEL_DEEP, max_tokens=900,
                                       messages=[{"role": "user", "content": prompt}])
        await send(update, resp.content[0].text.strip(), ticker_actions(ticker))
    except Exception as e:
        await send(update, f"Error: {e}")


# ── Insider trades ────────────────────────────────────────────────────────────

async def _insider_for(update: Update, ticker: str):
    trades = get_insider_trades(ticker, limit=10)
    if not trades:
        await send(update, f"No recent insider trades for {ticker}")
        return
    lines = [f"👤 INSIDER — {ticker}\n"]
    for t in trades[:8]:
        name   = t.get("reportingName", "")[:20]
        ttype  = t.get("transactionType", "")
        shares = abs(t.get("securitiesTransacted", 0) or 0)
        price  = t.get("price", 0) or 0
        value  = shares * price
        date   = t.get("transactionDate", "")
        icon   = "🟢" if "P" in ttype or "Buy" in ttype else "🔴"
        lines.append(f"{icon} {name}: {fmt_large(value)}  ·  {date}")
    await send(update, "\n".join(lines), ticker_actions(ticker))


async def cmd_insider(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args or []
    if not args:
        await send(update, "Usage: /insider TICKER")
        return
    await _insider_for(update, args[0].upper())


# ── Analyst ratings ───────────────────────────────────────────────────────────

async def _ratings_for(update: Update, ticker: str):
    ratings = get_analyst_ratings(ticker, limit=8)
    if not ratings:
        await send(update, f"No recent analyst ratings for {ticker}")
        return
    lines = [f"📊 RATINGS — {ticker}\n"]
    for r in ratings[:6]:
        firm   = r.get("gradingCompany", "")[:18]
        new_g  = r.get("newGrade", "")
        pt     = r.get("priceTarget", "")
        date   = r.get("publishedDate", "")[:10]
        action = r.get("action", "").lower()
        icon = "🟢" if "upgrade" in action or "initiat" in action else "🔴" if "downgrade" in action else "⚪️"
        lines.append(f"{icon} {firm}: {new_g}" + (f" PT ${pt}" if pt else "") + f"  ·  {date}")
    await send(update, "\n".join(lines), ticker_actions(ticker))


async def cmd_ratings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args or []
    if not args:
        await send(update, "Usage: /ratings TICKER")
        return
    await _ratings_for(update, args[0].upper())


# ── Earnings ──────────────────────────────────────────────────────────────────

async def cmd_earnings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    upcoming = get_upcoming_earnings(days=14)
    ticker_set = set(WATCHLIST.keys())
    mine = [e for e in upcoming if e.get("symbol", "") in ticker_set]
    if not mine:
        await send(update, "No earnings for your portfolio in the next 14 days.")
        return
    lines = ["📅 UPCOMING EARNINGS\n"]
    for e in sorted(mine, key=lambda x: x.get("date", "")):
        sym  = e.get("symbol", "")
        date = e.get("date", "")
        est  = e.get("epsEstimated")
        tod  = e.get("time", "")
        shares = WATCHLIST.get(sym, {}).get("shares", 0)
        lines.append(f"• {sym} — {date} {tod}" + (f"  ·  EPS est ${est:.2f}" if est else ""))
    await send(update, "\n".join(lines))


# ── Macro ─────────────────────────────────────────────────────────────────────

async def cmd_macro(update: Update, context: ContextTypes.DEFAULT_TYPE):
    snapshot = get_macro_snapshot()
    lines = ["🌍 MACRO SNAPSHOT\n"]
    for key, label in [("fed_funds","Fed Funds"), ("t10y","10Y Treasury"), ("t2y","2Y Treasury"),
                        ("real10y","Real Yield"), ("breakeven5y","5Y Breakeven")]:
        d = snapshot.get(key, {})
        v = d.get("value")
        c = d.get("change")
        if v is not None:
            chg = f" ({c:+.2f}%)" if c else ""
            lines.append(f"{label:<18} {v:.2f}%{chg}")
    lines.append("")
    for key, label in [("hy_spread","HY Spread"), ("ig_spread","IG Spread")]:
        d = snapshot.get(key, {})
        v = d.get("value")
        if v is not None:
            lines.append(f"{label:<18} {v:.0f}bp")
    lines.append("")
    vix = snapshot.get("vix", {}).get("value")
    if vix:
        lines.append(f"{'VIX':<18} {vix:.1f}")

    macro_kb = InlineKeyboardMarkup([[
        InlineKeyboardButton("📊 Markets", callback_data="markets"),
        InlineKeyboardButton("📅 Econ Calendar", callback_data="macro:calendar"),
    ]])
    await send(update, "\n".join(lines), macro_kb)


# ── Calendar ──────────────────────────────────────────────────────────────────

async def cmd_calendar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    service = get_calendar_service()
    if not service:
        msg = (
            "📅 Google Calendar not connected.\n\n"
            "Run /setup_calendar to connect, or just tell me what to add:\n"
            "\"Add a call with Sarah tomorrow at 2pm\""
        )
        await send(update, msg)
        return
    events = get_upcoming_calendar_events(days=7)
    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton("➕ Add Event", callback_data="cal:add"),
        InlineKeyboardButton("📅 Next 14 days", callback_data="cal:14"),
    ]])
    await send(update, format_events_list(events), kb)


async def cmd_setup_calendar(update: Update, context: ContextTypes.DEFAULT_TYPE):
    auth_url = generate_auth_url()
    if not auth_url:
        await send(update, (
            "⚙️ Set up Google Calendar:\n\n"
            "1. Go to console.cloud.google.com\n"
            "2. Create project → Enable Calendar API\n"
            "3. Create OAuth credentials (Desktop app)\n"
            "4. Download credentials.json → set GOOGLE_CREDENTIALS_JSON env var on Render\n"
            "5. Run /setup_calendar again"
        ))
        return
    msg = (
        f"📅 Connect Google Calendar\n\n"
        f"1. Open this link and sign in:\n{auth_url}\n\n"
        f"2. Copy the code shown\n"
        f"3. Send: /cal_code YOUR_CODE"
    )
    await send(update, msg)


async def cmd_cal_code(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await send(update, "Usage: /cal_code YOUR_CODE")
        return
    success = exchange_auth_code(args[0].strip())
    if success:
        await send(update, "✅ Google Calendar connected! Say \"Add lunch tomorrow at noon\" to test.")
    else:
        await send(update, "❌ Code didn't work. Try /setup_calendar again.")


# ── Chart ─────────────────────────────────────────────────────────────────────

async def cmd_chart(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str = None):
    if not ticker:
        args = context.args or []
        ticker = args[0].upper() if args else None
    if not ticker:
        await send(update, "Usage: /chart TICKER", portfolio_ticker_grid())
        return

    ticker = ticker.upper()
    await update.effective_message.reply_text(f"Generating chart for {ticker}...")

    try:
        import asyncio
        from agents.chart_agent import generate_price_chart
        from data.prices import get_history

        loop = asyncio.get_running_loop()
        history = await loop.run_in_executor(None, get_history, ticker, "3mo")

        if not history:
            await send(update, f"No price history available for {ticker}")
            return

        info      = WATCHLIST.get(ticker, {})
        buy_price = info.get("buy_price")  # optional cost basis field
        img_bytes = await loop.run_in_executor(
            None, generate_price_chart, ticker, history, 90, buy_price, None
        )
        if img_bytes:
            img_bytes.seek(0)
            await update.effective_message.reply_photo(
                photo=img_bytes,
                caption=f"📈 {ticker} — 3-Month Chart",
                reply_markup=ticker_actions(ticker),
            )
        else:
            await send(update, f"Chart unavailable for {ticker}")
    except Exception as e:
        log.warning(f"cmd_chart({ticker}): {e}", exc_info=True)
        await send(update, f"Chart error: {e}")


# ── Portfolio P&L ─────────────────────────────────────────────────────────────

async def cmd_pnl(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text("Computing P&L...")
    try:
        from agents.pnl_agent import run_pnl_update
        await run_pnl_update(
            lambda msg: update.effective_message.reply_text(msg, reply_markup=main_menu())
        )
    except Exception as e:
        await send(update, f"P&L error: {e}")


# ── Technical Signals ─────────────────────────────────────────────────────────

async def cmd_technical(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str = None):
    if not ticker:
        args = context.args or []
        ticker = args[0].upper() if args else None
    if not ticker:
        await send(update, "Usage: /technical TICKER", portfolio_ticker_grid())
        return

    ticker = ticker.upper()
    await update.effective_message.reply_text(f"Computing signals for {ticker}...")

    try:
        import asyncio
        loop = asyncio.get_running_loop()
        signals = await loop.run_in_executor(None, compute_signals, ticker)

        rsi    = signals.get("rsi")
        macd_h = signals.get("macd_hist")
        ma50   = signals.get("ma50")
        ma200  = signals.get("ma200")
        price  = signals.get("price")
        hi52   = signals.get("week52_high")
        lo52   = signals.get("week52_low")

        rsi_str = f"{rsi:.1f}" if rsi else "N/A"
        rsi_note = ""
        if rsi:
            if rsi < 30:
                rsi_note = " 🟢 OVERSOLD"
            elif rsi > 70:
                rsi_note = " 🔴 OVERBOUGHT"

        lines = [f"📡 TECHNICAL · {ticker}\n"]
        if price:
            lines.append(f"Price:  ${price:.2f}")
        lines.append(f"RSI:    {rsi_str}{rsi_note}")
        if macd_h is not None:
            lines.append(f"MACD:   {'▲ bullish' if macd_h > 0 else '▼ bearish'} ({macd_h:.3f})")
        if ma50 and ma200:
            lines.append(f"MA50:   ${ma50:.2f}")
            lines.append(f"MA200:  ${ma200:.2f}")
            if price:
                if ma50 > ma200:
                    lines.append("Golden Cross: ✅ Bullish structure")
                else:
                    lines.append("Death Cross: ⚠️ Bearish structure")
        if hi52 and lo52 and price:
            from_hi = (price - hi52) / hi52
            lines.append(f"52W:    ${lo52:.2f} — ${hi52:.2f}  ({from_hi*100:+.1f}% from high)")

        convergence = signals.get("convergence")
        if convergence:
            direction = convergence["direction"].upper()
            strength  = convergence["strength"]
            d_emoji   = "🟢" if direction == "BULLISH" else "🔴"
            lines.append(f"\nSignal Convergence: {d_emoji} {direction} ({strength} signals agree)")

        await send(update, "\n".join(lines), ticker_actions(ticker))
    except Exception as e:
        log.warning(f"cmd_technical({ticker}): {e}")
        await send(update, f"Technical analysis error: {e}")


# ── Short Interest ────────────────────────────────────────────────────────────

async def cmd_shorts(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str = None):
    if not ticker:
        args = context.args or []
        ticker = args[0].upper() if args else None
    if not ticker:
        await send(update, "Usage: /shorts TICKER", portfolio_ticker_grid())
        return

    ticker = ticker.upper()
    await update.effective_message.reply_text(f"Fetching short data for {ticker}...")
    try:
        import asyncio
        loop = asyncio.get_running_loop()
        report = await loop.run_in_executor(None, format_short_report, ticker)
        await send(update, report, ticker_actions(ticker))
    except Exception as e:
        await send(update, f"Short data error: {e}")


# ── Options Flow ──────────────────────────────────────────────────────────────

async def cmd_options(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str = None):
    if not ticker:
        args = context.args or []
        ticker = args[0].upper() if args else None
    if not ticker:
        await send(update, "Usage: /options TICKER", portfolio_ticker_grid())
        return

    ticker = ticker.upper()
    await update.effective_message.reply_text(f"Analyzing options flow for {ticker}...")
    try:
        import asyncio
        loop = asyncio.get_running_loop()
        report = await loop.run_in_executor(None, format_options_report, ticker)
        await send(update, report, ticker_actions(ticker))
    except Exception as e:
        await send(update, f"Options error: {e}")


# ── Earnings Transcript ───────────────────────────────────────────────────────

async def cmd_transcript(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str = None):
    if not ticker:
        args = context.args or []
        ticker = args[0].upper() if args else None
    if not ticker:
        await send(update, "Usage: /transcript TICKER", portfolio_ticker_grid())
        return

    ticker = ticker.upper()
    await update.effective_message.reply_text(f"Fetching transcript for {ticker}... (~20 sec)")
    try:
        import asyncio
        loop = asyncio.get_running_loop()
        analysis = await loop.run_in_executor(None, get_transcript_analysis, ticker)
        await send(update, analysis, ticker_actions(ticker))
    except Exception as e:
        await send(update, f"Transcript error: {e}")


# ── Fed Watch ─────────────────────────────────────────────────────────────────

async def cmd_fed(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text("Fetching Fed data...")
    try:
        import asyncio
        loop = asyncio.get_running_loop()
        report = await loop.run_in_executor(None, format_fed_report)
        await send(update, report)
    except Exception as e:
        await send(update, f"Fed data error: {e}")


# ── Trade Journal ─────────────────────────────────────────────────────────────

async def cmd_journal(update: Update, context: ContextTypes.DEFAULT_TYPE, ticker: str = None):
    if not ticker:
        args = context.args or []
        ticker = args[0].upper() if args else None
    if not ticker:
        await send(update, "Usage: /journal TICKER", portfolio_ticker_grid())
        return

    ticker = ticker.upper()
    await update.effective_message.reply_text(f"Loading journal for {ticker}...")
    try:
        import asyncio
        loop = asyncio.get_running_loop()
        report = await loop.run_in_executor(None, format_thesis_report, ticker)
        await send(update, report, ticker_actions(ticker))
    except Exception as e:
        await send(update, f"Journal error: {e}")


# ── Custom Alert Rules ────────────────────────────────────────────────────────

async def cmd_rule(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args or []
    if not args:
        await send(update, (
            "Create a custom alert rule in plain English:\n\n"
            "/rule Alert when NVDA drops 5%\n"
            "/rule Alert when META goes above $650\n"
            "/rule Alert when AAPL RSI drops below 30"
        ))
        return
    rule_text = " ".join(args)
    try:
        import asyncio
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, register_custom_rule, rule_text)
        await send(update, result)
    except Exception as e:
        await send(update, f"Rule error: {e}")


# ── Brief / Digest ────────────────────────────────────────────────────────────

async def cmd_brief(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text("Composing morning brief...")
    send_fn = lambda msg: update.effective_message.reply_text(msg)
    await run_morning_brief(send_fn)


async def cmd_digest(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.effective_message.reply_text("Composing weekly digest...")
    send_fn = lambda msg: update.effective_message.reply_text(msg)
    await run_weekly_digest(send_fn)


# ── Mute / Unmute ─────────────────────────────────────────────────────────────

async def cmd_mute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args or []
    if len(args) < 2:
        await send(update, "Usage: /mute TICKER 2h")
        return
    ticker = args[0].upper()
    hours  = float(args[1].lower().replace("h", ""))
    mute_ticker(ticker, hours)
    await send(update, f"🔇 {ticker} muted for {hours:.0f}h")


async def cmd_unmute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args or []
    if not args:
        await send(update, "Usage: /unmute TICKER")
        return
    unmute_ticker(args[0].upper())
    await send(update, f"🔔 {args[0].upper()} alerts re-enabled")


# ── Status ────────────────────────────────────────────────────────────────────

async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    from data.prices import is_market_hours
    cal_ok = get_calendar_service() is not None
    lines = [
        "⚙️ TYLER — OPERATIONAL\n",
        f"Market: {'🟢 OPEN' if is_market_hours() else '🔴 CLOSED'}",
        f"Watching: {len(WATCHLIST)} securities",
        f"Calendar: {'✅ Connected' if cal_ok else '❌ Not connected (/setup_calendar)'}",
        "",
        "MONITORS RUNNING:",
        "  ✅ Price alerts (5min, market hours)",
        "  ✅ Crisis detection (5min, market hours)",
        "  ✅ Custom rules (5min, market hours)",
        "  ✅ News — portfolio (15min)",
        "  ✅ Earnings war room (15min)",
        "  ✅ Cross-asset (30min, market hours)",
        "  ✅ Intraday P&L (30min)",
        "  ✅ SEC filings (30min)",
        "  ✅ Analyst ratings (1h)",
        "  ✅ Technical signals (2h)",
        "  ✅ Competitor intel (2h)",
        "  ✅ Market news — global (3× daily)",
        "  ✅ Morning brief (7 AM ET)",
        "  ✅ Close heatmap (4:30 PM ET)",
        "  ✅ Weekly digest (Sun 6 PM)",
        "",
        "COMMANDS:",
        "  /chart /pnl /technical /shorts",
        "  /options /transcript /fed /journal /rule",
    ]
    await send(update, "\n".join(lines))


# ── Natural Language Message Handler ─────────────────────────────────────────

# Menu button text → handler mapping
_MENU_MAP = {
    "📊 Portfolio":  cmd_portfolio,
    "📈 Markets":    cmd_markets,
    "📅 Earnings":   cmd_earnings,
    "🌍 Macro":      cmd_macro,
    "📅 Calendar":   cmd_calendar,
    "⚡ Brief":      cmd_brief,
    "⚙️ Status":     cmd_status,
}


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Route all plain-text messages: menu buttons, calendar, or AI assistant."""
    text = (update.message.text or "").strip()
    if not text:
        return

    # Menu button shortcuts
    if text in _MENU_MAP:
        await _MENU_MAP[text](update, context)
        return

    if text in ("📰 News", "🔬 Research"):
        await send(update, "Which stock? Just type the ticker symbol, e.g. META")
        return

    # Send immediate acknowledgment so user knows request is received
    await update.message.reply_text("Thinking...", reply_markup=main_menu())

    # Calendar intent (only on clearly calendar-shaped messages)
    if is_calendar_request(text):
        try:
            now_str = datetime.now(TZ).strftime("%Y-%m-%d %H:%M %Z")
            event_data = parse_calendar_intent(text, now_str)
            if event_data:
                service = get_calendar_service()
                if not service:
                    await update.message.reply_text(
                        "I'd add that to your calendar, but it's not connected yet.\n"
                        "Run /setup_calendar to link Google Calendar.",
                        reply_markup=main_menu()
                    )
                    return
                created = create_event(event_data)
                if created:
                    await update.message.reply_text(
                        f"✅ Added to calendar:\n\n"
                        f"📅 {event_data.get('title','Event')}\n"
                        f"{event_data.get('date','')} at {event_data.get('start_time','')}",
                        reply_markup=main_menu()
                    )
                    return
        except Exception as e:
            log.warning(f"Calendar handler error: {e}")
            # Fall through to Claude assistant

    # Check if a portfolio ticker is mentioned
    words = text.upper().split()
    portfolio_tickers = set(WATCHLIST.keys())
    mentioned = next(
        (w.strip("?.,!:'\"") for w in words if w.strip("?.,!:'\"") in portfolio_tickers),
        None
    )

    prompt = f"""You are Tyler, a personal financial analyst assistant for Yulian.
Portfolio: {list(WATCHLIST.keys())}

Answer concisely and precisely. If asking about a stock: give price context, thesis, key risks.
If market/macro: answer with data-driven analysis.
If asking what to do: give a direct institutional-quality answer.
Max 180 words. No disclaimers. No "I'm just an AI". Institutional tone.

Message: {text}"""

    try:
        resp = client.messages.create(
            model=MODEL_DEEP, max_tokens=400,
            messages=[{"role": "user", "content": prompt}]
        )
        reply = resp.content[0].text.strip()
        if mentioned:
            await update.message.reply_text(reply, reply_markup=ticker_actions(mentioned))
        else:
            await update.message.reply_text(reply, reply_markup=main_menu())
    except Exception as e:
        log.warning(f"NL handler error: {e}")
        await update.message.reply_text(
            f"Couldn't process that right now. Try again or use the menu buttons.",
            reply_markup=main_menu()
        )


# ── Callback Query Handler ────────────────────────────────────────────────────

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Dispatch all inline button presses."""
    query = update.callback_query
    await query.answer()
    data = query.data

    if data.startswith("price:"):
        await cmd_price(update, context, data.split(":", 1)[1])

    elif data.startswith("deep:"):
        await cmd_deep(update, context, data.split(":", 1)[1])

    elif data.startswith("news:"):
        await cmd_news(update, context, data.split(":", 1)[1])

    elif data.startswith("insider:"):
        await _insider_for(update, data.split(":", 1)[1])

    elif data.startswith("ratings:"):
        await _ratings_for(update, data.split(":", 1)[1])

    elif data == "markets":
        await cmd_markets(update, context)

    elif data == "macro:full":
        await cmd_macro(update, context)

    elif data == "macro:calendar":
        # Simple placeholder — FMP free tier doesn't have econ calendar
        await send(update, "📅 Economic calendar coming soon.\nFor now, check investing.com/economic-calendar")

    elif data == "cal:add":
        await send(update, "Just tell me what to add!\nExample: \"Lunch with Alex on Friday at 1pm\"")

    elif data == "cal:14":
        events = get_upcoming_calendar_events(days=14)
        await send(update, format_events_list(events))

    elif data == "prompt:deep":
        await send(update, "Which ticker to research? Just type the symbol, e.g.: NVDA")

    elif data.startswith("chart:"):
        await cmd_chart(update, context, data.split(":", 1)[1])

    elif data.startswith("options:"):
        await cmd_options(update, context, data.split(":", 1)[1])

    elif data.startswith("shorts:"):
        await cmd_shorts(update, context, data.split(":", 1)[1])

    elif data.startswith("journal:"):
        await cmd_journal(update, context, data.split(":", 1)[1])

    elif data.startswith("technical:"):
        await cmd_technical(update, context, data.split(":", 1)[1])

    elif data.startswith("transcript:"):
        await cmd_transcript(update, context, data.split(":", 1)[1])
