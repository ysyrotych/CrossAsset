"""
Telegram command handlers — all /command responses.
Each handler is an async function receiving (update, context).
"""
import logging
from datetime import datetime
from telegram import Update
from telegram.ext import ContextTypes
from anthropic import Anthropic

from config import WATCHLIST, ANTHROPIC_API_KEY, MODEL_DEEP, MODEL_FAST, THRESHOLDS
from data.prices import get_quote, get_quotes_batch, get_market_snapshot
from data.news import get_all_news
from data.fmp import (get_analyst_ratings, get_insider_trades, get_earnings_calendar,
                      get_key_metrics, get_profile, get_analyst_consensus, get_income_statement)
from data.macro import get_macro_snapshot, format_macro_brief
from db.queries import mute_ticker, unmute_ticker, is_muted
from bot.formatter import fmt_pct, fmt_price, fmt_large, split_message, portfolio_table
from agents.earnings_agent import get_upcoming_earnings
from jobs.morning_brief import run_morning_brief
from jobs.weekly_digest import run_weekly_digest

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)


async def send_text(update: Update, text: str):
    """Send long text, splitting if needed."""
    for chunk in split_message(text):
        await update.message.reply_text(chunk)


# ── /start ────────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = """🏦 ANALYST DESK — Online

Your 24/7 institutional-grade financial analyst team.

Commands:
/portfolio — holdings & today's P&L
/price TICKER — live quote
/news TICKER — material news
/deep TICKER — full research brief
/earnings — upcoming earnings calendar
/insider TICKER — recent insider trades
/ratings TICKER — analyst upgrades/downgrades
/brief — trigger morning brief now
/digest — trigger weekly digest now
/macro — macro snapshot
/add TICKER WEIGHT% — add to watchlist
/remove TICKER — remove from watchlist
/mute TICKER Nh — silence alerts for N hours
/status — system health

The desk monitors your portfolio 24/7 and will message you when something material happens."""
    await send_text(update, msg)


# ── /portfolio ────────────────────────────────────────────────────────────────

async def cmd_portfolio(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Fetching portfolio snapshot...")
    tickers = list(WATCHLIST.keys())
    quotes = get_quotes_batch(tickers)
    text = portfolio_table(WATCHLIST, quotes)

    # Total portfolio P&L today (weight-averaged)
    weighted_chg = 0.0
    total_w = 0.0
    for ticker, info in WATCHLIST.items():
        w = info.get("weight", 0)
        q = quotes.get(ticker, {})
        chg = q.get("change_pct")
        if chg is not None:
            weighted_chg += w * chg
            total_w += w

    if total_w > 0:
        portfolio_chg = weighted_chg / total_w
        arrow = "▲" if portfolio_chg > 0 else "▼"
        text += f"\n\nPortfolio today: {arrow} {fmt_pct(portfolio_chg)}"

    await send_text(update, text)


# ── /price TICKER ─────────────────────────────────────────────────────────────

async def cmd_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text("Usage: /price TICKER")
        return
    ticker = args[0].upper()
    q = get_quote(ticker)
    price = q.get("price")
    if not price:
        await update.message.reply_text(f"Could not fetch quote for {ticker}")
        return

    chg  = q.get("change_pct", 0) or 0
    high = q.get("year_high")
    low  = q.get("year_low")
    arrow = "▲" if chg >= 0 else "▼"
    weight = WATCHLIST.get(ticker, {}).get("weight", 0)
    muted = is_muted(ticker)

    lines = [
        f"📈 {ticker} — Live Quote",
        f"Price: {fmt_price(price)} {arrow} {fmt_pct(chg)}",
    ]
    if high and low:
        pct_from_high = (price - high) / high if high else 0
        lines.append(f"52W: {fmt_price(low)} — {fmt_price(high)} ({fmt_pct(pct_from_high)} from high)")
    if weight > 0:
        lines.append(f"Your weight: {weight*100:.1f}%")
    if muted:
        lines.append("⚠️ Alerts muted for this ticker")

    await send_text(update, "\n".join(lines))


# ── /news TICKER ──────────────────────────────────────────────────────────────

async def cmd_news(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text("Usage: /news TICKER")
        return
    ticker = args[0].upper()
    await update.message.reply_text(f"Scanning news for {ticker}...")

    prof = get_profile(ticker)
    company = prof.get("companyName", "") if prof else ""
    articles = get_all_news(ticker, company, days=2)

    if not articles:
        await update.message.reply_text(f"No recent news found for {ticker}")
        return

    lines = [f"📰 NEWS — {ticker} (last 48h)\n"]
    for i, a in enumerate(articles[:8], 1):
        title = a.get("title", "")[:100]
        source = a.get("source", "")
        published = a.get("published", "")[:10]
        lines.append(f"{i}. [{source}] {title}\n   {published}")

    await send_text(update, "\n".join(lines))


# ── /deep TICKER ──────────────────────────────────────────────────────────────

async def cmd_deep(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text("Usage: /deep TICKER")
        return
    ticker = args[0].upper()
    await update.message.reply_text(f"Researching {ticker}... (30-60 seconds)")

    # Gather data
    prof      = get_profile(ticker)
    metrics   = get_key_metrics(ticker)
    consensus = get_analyst_consensus(ticker)
    quote     = get_quote(ticker)
    ratings   = get_analyst_ratings(ticker, limit=3)
    articles  = get_all_news(ticker, days=3)[:5]
    statements= get_income_statement(ticker, limit=4)
    thesis    = WATCHLIST.get(ticker, {}).get("thesis", "No saved thesis.")
    weight    = WATCHLIST.get(ticker, {}).get("weight", 0)

    # Recent news titles
    news_str = "\n".join([f"- {a.get('title','')[:100]}" for a in articles])

    # Recent ratings
    ratings_str = "\n".join([
        f"- {r.get('gradingCompany','')} {r.get('action','')} → {r.get('newGrade','')} "
        f"PT: ${r.get('priceTarget','N/A')}"
        for r in ratings
    ])

    prompt = f"""Write a comprehensive institutional research brief for {ticker}.

COMPANY: {prof.get('companyName','') if prof else ticker}
SECTOR: {prof.get('sector','') if prof else ''}
DESCRIPTION: {prof.get('description','')[:400] if prof else ''}

FINANCIALS:
P/E: {metrics.get('peRatioTTM','N/A') if metrics else 'N/A'}
FCF Yield: {metrics.get('freeCashFlowYieldTTM','N/A') if metrics else 'N/A'}
ROIC: {metrics.get('roicTTM','N/A') if metrics else 'N/A'}
EV/EBITDA: {metrics.get('enterpriseValueOverEBITDATTM','N/A') if metrics else 'N/A'}
Revenue growth: {metrics.get('revenueGrowthTTM','N/A') if metrics else 'N/A'}

CURRENT PRICE: ${quote.get('price','N/A')} ({fmt_pct(quote.get('change_pct'))} today)
PORTFOLIO WEIGHT: {weight*100:.1f}%

RECENT ANALYST ACTIVITY:
{ratings_str or 'No recent ratings'}

RECENT NEWS:
{news_str or 'No recent news'}

MY INVESTMENT THESIS: {thesis}

Write a professional research brief with these sections:
1. INVESTMENT SUMMARY (3-4 sentences, overall view)
2. BUSINESS QUALITY (competitive moat, market position, margin quality)
3. FINANCIAL SNAPSHOT (key metrics, trends, quality of earnings)
4. BULL CASE (3 bullets)
5. BEAR CASE (3 bullets)
6. THESIS CHECK (is my thesis intact? Any cracks?)
7. VALUATION (cheap/fair/expensive vs history and peers)
8. CONCLUSION (1-2 sentence bottom line)

Start with: 🔬 DEEP BRIEF · {ticker}
Institutional tone. Max 450 words."""

    try:
        resp = client.messages.create(
            model=MODEL_DEEP, max_tokens=900,
            messages=[{"role": "user", "content": prompt}]
        )
        await send_text(update, resp.content[0].text.strip())
    except Exception as e:
        log.warning(f"/deep {ticker}: {e}")
        await update.message.reply_text(f"Error generating brief for {ticker}: {e}")


# ── /earnings ─────────────────────────────────────────────────────────────────

async def cmd_earnings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    upcoming = get_upcoming_earnings(days=14)
    ticker_set = set(WATCHLIST.keys())
    mine = [e for e in upcoming if e.get("symbol","") in ticker_set]

    if not mine:
        await update.message.reply_text("No earnings scheduled for your watchlist in the next 14 days.")
        return

    lines = ["📅 UPCOMING EARNINGS (next 14 days)\n"]
    for e in sorted(mine, key=lambda x: x.get("date","")):
        sym  = e.get("symbol","")
        date = e.get("date","")
        est  = e.get("epsEstimated")
        time = e.get("time","")
        weight = WATCHLIST.get(sym, {}).get("weight", 0)
        lines.append(
            f"{sym} ({weight*100:.0f}%) — {date} {time}"
            + (f" | EPS est ${est:.2f}" if est else "")
        )

    await send_text(update, "\n".join(lines))


# ── /insider TICKER ───────────────────────────────────────────────────────────

async def cmd_insider(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text("Usage: /insider TICKER")
        return
    ticker = args[0].upper()
    trades = get_insider_trades(ticker, limit=15)

    if not trades:
        await update.message.reply_text(f"No recent insider trades found for {ticker}")
        return

    lines = [f"👤 INSIDER TRADES — {ticker} (last 30d)\n"]
    for t in trades[:10]:
        name  = t.get("reportingName","")[:25]
        ttype = t.get("transactionType","")
        shares = t.get("securitiesTransacted", 0) or 0
        price  = t.get("price", 0) or 0
        value  = abs(shares * price)
        date   = t.get("transactionDate","")
        icon   = "🟢" if "P" in ttype or "Buy" in ttype else "🔴"
        lines.append(f"{icon} {name}: {fmt_large(value)} @ {fmt_price(price)} ({date})")

    await send_text(update, "\n".join(lines))


# ── /ratings TICKER ───────────────────────────────────────────────────────────

async def cmd_ratings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text("Usage: /ratings TICKER")
        return
    ticker = args[0].upper()
    ratings = get_analyst_ratings(ticker, limit=10)

    if not ratings:
        await update.message.reply_text(f"No recent analyst ratings for {ticker}")
        return

    lines = [f"📊 ANALYST RATINGS — {ticker}\n"]
    for r in ratings[:8]:
        firm   = r.get("gradingCompany","")[:20]
        action = r.get("action","")
        new_g  = r.get("newGrade","")
        prev_g = r.get("previousGrade","")
        pt     = r.get("priceTarget","")
        date   = r.get("publishedDate","")[:10]
        icon   = "🟢" if "upgrade" in action.lower() or "initiat" in action.lower() else "🔴" if "downgrade" in action.lower() else "⚪️"
        lines.append(f"{icon} {firm}: {new_g}" + (f" (from {prev_g})" if prev_g else "") + (f" PT ${pt}" if pt else "") + f" — {date}")

    await send_text(update, "\n".join(lines))


# ── /macro ────────────────────────────────────────────────────────────────────

async def cmd_macro(update: Update, context: ContextTypes.DEFAULT_TYPE):
    snapshot = get_macro_snapshot()
    market   = get_market_snapshot()

    lines = ["📊 MACRO SNAPSHOT\n"]

    # Rates
    for key, label in [("fed_funds","Fed Funds"), ("t10y","10Y"), ("t2y","2Y"),
                        ("real10y","Real 10Y"), ("breakeven5y","5Y Breakeven")]:
        d = snapshot.get(key, {})
        v = d.get("value")
        c = d.get("change")
        if v is not None:
            chg_str = f" ({c:+.2f})" if c else ""
            lines.append(f"  {label}: {v:.2f}%{chg_str}")

    lines.append("")

    # Spreads
    for key, label in [("hy_spread","HY Spread"), ("ig_spread","IG Spread")]:
        d = snapshot.get(key, {})
        v = d.get("value")
        c = d.get("change")
        if v is not None:
            chg_str = f" ({c:+.0f}bp)" if c else ""
            lines.append(f"  {label}: {v:.0f}bp{chg_str}")

    # VIX, DXY
    for key, label in [("vix","VIX")]:
        d = snapshot.get(key, {})
        v = d.get("value")
        if v is not None:
            lines.append(f"  {label}: {v:.1f}")

    # Market
    lines.append("")
    for key, label in [("SPX","SPX"), ("NDX","NDX"), ("DXY","DXY"), ("OIL","WTI Oil"), ("GOLD","Gold")]:
        d = market.get(key, {})
        p = d.get("price")
        c = d.get("change_pct")
        if p:
            lines.append(f"  {label}: {p:,.1f}" + (f" ({fmt_pct(c)})" if c else ""))

    await send_text(update, "\n".join(lines))


# ── /brief ────────────────────────────────────────────────────────────────────

async def cmd_brief(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Composing morning brief...")
    send_fn = lambda msg: update.message.reply_text(msg)
    await run_morning_brief(send_fn)


# ── /digest ───────────────────────────────────────────────────────────────────

async def cmd_digest(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Composing weekly digest...")
    send_fn = lambda msg: update.message.reply_text(msg)
    await run_weekly_digest(send_fn)


# ── /add TICKER WEIGHT ────────────────────────────────────────────────────────

async def cmd_add(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if len(args) < 2:
        await update.message.reply_text("Usage: /add TICKER WEIGHT%  (e.g. /add PLTR 3%)")
        return
    ticker = args[0].upper()
    weight_str = args[1].replace("%", "")
    try:
        weight = float(weight_str) / 100
    except ValueError:
        await update.message.reply_text("Invalid weight — use e.g. /add PLTR 3%")
        return

    WATCHLIST[ticker] = {"weight": weight, "sector": "Unknown", "thesis": "No thesis set."}
    await update.message.reply_text(
        f"✅ {ticker} added to watchlist at {weight*100:.1f}% weight.\n"
        f"Note: This is session-only. Edit config.py to make it permanent."
    )


# ── /remove TICKER ────────────────────────────────────────────────────────────

async def cmd_remove(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text("Usage: /remove TICKER")
        return
    ticker = args[0].upper()
    if ticker in WATCHLIST:
        del WATCHLIST[ticker]
        await update.message.reply_text(f"✅ {ticker} removed from watchlist.")
    else:
        await update.message.reply_text(f"{ticker} not in watchlist.")


# ── /mute TICKER Nh ──────────────────────────────────────────────────────────

async def cmd_mute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if len(args) < 2:
        await update.message.reply_text("Usage: /mute TICKER 2h  (mutes for 2 hours)")
        return
    ticker = args[0].upper()
    dur_str = args[1].lower().replace("h","")
    try:
        hours = float(dur_str)
    except ValueError:
        await update.message.reply_text("Invalid duration — use e.g. /mute TSLA 2h")
        return
    mute_ticker(ticker, hours)
    await update.message.reply_text(f"🔇 {ticker} alerts muted for {hours:.0f}h")


# ── /unmute TICKER ────────────────────────────────────────────────────────────

async def cmd_unmute(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args
    if not args:
        await update.message.reply_text("Usage: /unmute TICKER")
        return
    ticker = args[0].upper()
    unmute_ticker(ticker)
    await update.message.reply_text(f"🔔 {ticker} alerts re-enabled")


# ── /status ───────────────────────────────────────────────────────────────────

async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    from data.prices import is_market_hours
    market_open = is_market_hours()
    tickers_monitored = len(WATCHLIST)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines = [
        "🟢 ANALYST DESK — OPERATIONAL",
        f"Time: {now}",
        f"Market: {'OPEN' if market_open else 'CLOSED'}",
        f"Watching: {tickers_monitored} securities",
        "",
        "ACTIVE MONITORS:",
        "  ✅ Price watch (5min, market hours)",
        "  ✅ News scan (15min)",
        "  ✅ SEC filings (30min)",
        "  ✅ Analyst ratings (hourly)",
        "  ✅ Earnings watch (15min)",
        "  ✅ Morning brief (7:00 AM ET)",
        "  ✅ Weekly digest (Sunday 6 PM ET)",
    ]
    await send_text(update, "\n".join(lines))


# ── /thresholds ───────────────────────────────────────────────────────────────

async def cmd_thresholds(update: Update, context: ContextTypes.DEFAULT_TYPE):
    lines = ["⚙️ ALERT THRESHOLDS\n"]
    for k, v in THRESHOLDS.items():
        if isinstance(v, float) and v < 1:
            lines.append(f"  {k}: {v*100:.1f}%")
        elif isinstance(v, float):
            lines.append(f"  {k}: ${v:,.0f}")
        else:
            lines.append(f"  {k}: {v}")
    await send_text(update, "\n".join(lines))
