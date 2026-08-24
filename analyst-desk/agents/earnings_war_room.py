"""
Earnings War Room — Loop 20
Activates 24h before portfolio company earnings.
Delivers pre-earnings brief, tracks live reaction, sends post-earnings analysis.
"""
import logging
import time
from datetime import datetime, timedelta
import pytz
from anthropic import Anthropic
from data.prices import get_quote, get_history
from data.fmp import (get_key_metrics, get_profile, get_analyst_consensus,
                       get_analyst_ratings, get_income_statement)
from data.news import get_all_news
from agents.earnings_agent import get_upcoming_earnings
from agents.technical_signals import compute_signals
from agents.earnings_quality import score_earnings_quality
from db.queries import memory_get, memory_set
from config import WATCHLIST, ANTHROPIC_API_KEY, MODEL_DEEP, MODEL_FAST, TIMEZONE

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)
TZ = pytz.timezone(TIMEZONE)

_DEDUP_KEY = "war_room_sent_{ticker}_{date}"


def _already_sent(ticker: str, date: str) -> bool:
    key = _DEDUP_KEY.format(ticker=ticker, date=date)
    return bool(memory_get(key))


def _mark_sent(ticker: str, date: str):
    key = _DEDUP_KEY.format(ticker=ticker, date=date)
    memory_set(key, "1", category="alert_pref")


def _pre_earnings_brief(ticker: str, earnings_info: dict) -> str:
    """Generate Goldman-quality pre-earnings brief."""
    prof     = get_profile(ticker)
    metrics  = get_key_metrics(ticker)
    ratings  = get_analyst_ratings(ticker, limit=5)
    income   = get_income_statement(ticker, limit=4)
    news     = get_all_news(ticker, days=14)[:5]
    quote    = get_quote(ticker)
    consensus= get_analyst_consensus(ticker)
    signals  = compute_signals(ticker)

    company = prof.get("companyName", ticker) if prof else ticker
    eps_est = earnings_info.get("epsEstimated") or "N/A"
    rev_est = earnings_info.get("revenueEstimated")
    date_str = earnings_info.get("date", "soon")
    time_str = earnings_info.get("time", "")

    # Historical beat rate from income statements
    beat_count = 0
    miss_count = 0
    for q in income[:4]:
        eps = q.get("eps", 0) or 0
        # Can't determine vs estimate without consensus history, just note trend
        if eps > 0:
            beat_count += 1

    metrics_str = ""
    if metrics:
        pe   = metrics.get("peRatioTTM")
        fcf  = metrics.get("freeCashFlowYieldTTM")
        roic = metrics.get("roicTTM")
        metrics_str = f"P/E: {pe:.1f}" if pe else ""
        if fcf:
            metrics_str += f" | FCF Yield: {fcf*100:.1f}%"
        if roic:
            metrics_str += f" | ROIC: {roic*100:.1f}%"

    consensus_str = ""
    if consensus:
        buy   = consensus.get("buy", 0) or 0
        hold  = consensus.get("hold", 0) or 0
        sell  = consensus.get("sell", 0) or 0
        pt    = consensus.get("priceTarget")
        consensus_str = f"{buy}B / {hold}H / {sell}S" + (f"  PT: ${pt:.0f}" if pt else "")

    recent_ratings = "\n".join([
        f"  {r.get('gradingCompany','')} → {r.get('newGrade','')} PT ${r.get('priceTarget','?')}"
        for r in ratings[:3]
    ])

    news_str = "\n".join([f"  - {a.get('title','')[:80]}" for a in news])

    signal_summary = ""
    if signals.get("convergence"):
        direction = signals["convergence"]["direction"].upper()
        signal_summary = f"Technical bias: {direction}\n"

    shares = WATCHLIST.get(ticker, {}).get("shares", 0)
    position_value = shares * (quote.get("price") or 0)

    prompt = f"""Write a pre-earnings war room brief for {ticker} reporting {date_str} {time_str}.

COMPANY: {company}
POSITION: {shares} shares  ·  ${position_value:,.0f} at risk
EPS CONSENSUS: ${eps_est}
REVENUE CONSENSUS: {f'${rev_est/1e9:.2f}B' if rev_est else 'N/A'}
METRICS: {metrics_str}
ANALYST CONSENSUS: {consensus_str}
{signal_summary}
RECENT RATINGS:
{recent_ratings}
RECENT NEWS:
{news_str}

Write a war room brief:

🎯 WAR ROOM · {ticker} · EARNINGS {date_str.upper()}

SETUP
What is the market expecting? What is priced in?

KEY METRICS TO WATCH
3 specific numbers that will move the stock.

BULL SCENARIO (what a beat looks like)
What needs to happen. Price reaction estimate.

BEAR SCENARIO (what a miss looks like)
What fails. Price reaction estimate.

HISTORICAL CONTEXT
How has {ticker} typically reacted to earnings?

POSITIONING RECOMMENDATION
Should you hold, trim, or add before earnings?
Be direct. One sentence.

Max 300 words. Institutional tone. No hedging."""

    try:
        resp = client.messages.create(
            model=MODEL_DEEP, max_tokens=700,
            messages=[{"role": "user", "content": prompt}]
        )
        return resp.content[0].text.strip()
    except Exception as e:
        log.warning(f"war_room brief ({ticker}): {e}")
        return (
            f"🎯 WAR ROOM · {ticker} · EARNINGS {date_str.upper()}\n\n"
            f"EPS Est: ${eps_est}  ·  Analyst: {consensus_str}\n\n"
            f"Watch reaction at open. Key question: does guidance hold?"
        )


def _post_earnings_analysis(ticker: str, earnings_info: dict) -> str:
    """Rapid post-earnings reaction analysis."""
    quote = get_quote(ticker)
    price = quote.get("price", 0) or 0
    chg   = quote.get("change_pct", 0) or 0
    chg_str = f"{chg*100:+.2f}%"

    thesis = WATCHLIST.get(ticker, {}).get("thesis", "")
    shares = WATCHLIST.get(ticker, {}).get("shares", 0)
    pnl    = shares * price * chg

    quality = score_earnings_quality(ticker)
    verdict = quality.get("verdict", "")

    prompt = f"""Analyze {ticker}'s post-earnings reaction.

STOCK MOVE: {chg_str} (${price:.2f})
POSITION P&L: ${pnl:+,.0f}
EARNINGS QUALITY VERDICT: {verdict}
INVESTMENT THESIS: {thesis}

Write rapid post-earnings analysis:

📊 POST-EARNINGS · {ticker} · {chg_str}

REACTION
Why did the stock move this way? What did investors focus on?

THESIS STATUS
INTACT / WATCH / CHALLENGED — specific reason based on results.

KEY TAKEAWAYS
2-3 specific data points from results (use general knowledge for {ticker}).

ACTION
What should you do now — hold, add on dip, or reduce?
One direct sentence.

Max 200 words. Decisive institutional tone."""

    try:
        resp = client.messages.create(
            model=MODEL_FAST, max_tokens=450,
            messages=[{"role": "user", "content": prompt}]
        )
        return resp.content[0].text.strip()
    except Exception as e:
        log.warning(f"post_earnings ({ticker}): {e}")
        return (
            f"📊 POST-EARNINGS · {ticker}\n\n"
            f"Move: {chg_str}  ·  Position P&L: ${pnl:+,.0f}\n"
            f"Earnings Quality: {verdict}\n\n"
            f"Full analysis temporarily unavailable."
        )


async def run_earnings_war_room(send_fn) -> None:
    """
    Main job function:
    - Sends pre-earnings brief 24h before
    - Sends post-earnings analysis when stock moves on earnings day
    """
    now = datetime.now(TZ)
    upcoming = get_upcoming_earnings(days=2)
    ticker_set = set(WATCHLIST.keys())
    portfolio_earnings = [e for e in upcoming if e.get("symbol") in ticker_set]

    for event in portfolio_earnings:
        ticker   = event.get("symbol")
        date_str = event.get("date", "")

        if not ticker or not date_str:
            continue

        try:
            event_date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=TZ)
        except ValueError:
            continue

        days_out = (event_date.date() - now.date()).days

        # Pre-earnings brief: 1 day before (or today if before-market)
        if days_out == 1 or (days_out == 0 and event.get("time") in ("bmo", "before market open")):
            send_key = f"pre_{ticker}_{date_str}"
            if not _already_sent(ticker, send_key):
                try:
                    brief = _pre_earnings_brief(ticker, event)
                    await send_fn(brief)
                    _mark_sent(ticker, send_key)
                    log.info(f"War room pre-earnings brief sent for {ticker}")
                except Exception as e:
                    log.warning(f"war_room pre-brief ({ticker}): {e}")

        # Post-earnings: same day, if stock moved significantly
        if days_out == 0:
            post_key = f"post_{ticker}_{date_str}"
            if not _already_sent(ticker, post_key):
                quote = get_quote(ticker)
                chg = abs(quote.get("change_pct", 0) or 0)
                if chg > 0.04:  # >4% move = earnings reaction
                    try:
                        analysis = _post_earnings_analysis(ticker, event)
                        await send_fn(analysis)
                        _mark_sent(ticker, post_key)
                        log.info(f"War room post-earnings sent for {ticker}")
                    except Exception as e:
                        log.warning(f"war_room post ({ticker}): {e}")
