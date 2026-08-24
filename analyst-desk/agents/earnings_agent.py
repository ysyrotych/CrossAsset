"""
Earnings Agent — monitors earnings releases and sends pre-earnings briefs.
"""
import logging
from datetime import datetime, timedelta
from anthropic import Anthropic
from data.fmp import (get_earnings_calendar, get_latest_earnings,
                      get_key_metrics, get_income_statement, get_analyst_consensus)
from data.prices import get_quote, get_history
from agents.chief_of_staff import try_send_alert, SEVERITY_ICONS
from db.queries import make_hash, already_alerted
from config import WATCHLIST, ANTHROPIC_API_KEY, MODEL_DEEP

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)


def get_upcoming_earnings(days: int = 14) -> list[dict]:
    """Return earnings dates for all watchlist tickers."""
    tickers = list(WATCHLIST.keys())
    return get_earnings_calendar(tickers, days_ahead=days)


def send_preearnings_brief(ticker: str, earnings_date: str, send_fn) -> str | None:
    """
    Send a detailed pre-earnings brief the evening before earnings.
    Includes consensus estimates, what to watch, options implied move.
    """
    content_hash = make_hash(ticker, "preearnings_brief", earnings_date)
    if already_alerted(ticker, "preearnings_brief", content_hash):
        return None

    metrics    = get_key_metrics(ticker)
    consensus  = get_analyst_consensus(ticker)
    quote      = get_quote(ticker)
    statements = get_income_statement(ticker, limit=4)
    weight     = WATCHLIST.get(ticker, {}).get("weight", 0)
    thesis     = WATCHLIST.get(ticker, {}).get("thesis", "")

    # Recent EPS history
    eps_history = []
    for s in statements[:4]:
        eps_history.append({
            "period": s.get("calendarYear","") + " " + s.get("period",""),
            "eps":    s.get("eps"),
            "revenue": s.get("revenue"),
            "gross_margin": s.get("grossProfitRatio"),
        })

    prompt = f"""You are a senior equity analyst preparing a pre-earnings brief for {ticker}.
This is for a portfolio manager with {weight*100:.1f}% position.

Write a crisp, institutional pre-earnings brief covering:
1. CONSENSUS ESTIMATES — EPS estimate, revenue estimate, key segment expectations
2. WHAT TO WATCH — the 3-4 most important things on this call
3. BULL CASE — what a beat looks like and price reaction
4. BEAR CASE — what a miss looks like and price reaction
5. KEY RISK — single biggest unknown going into this print
6. OPTIONS — if data available, mention implied move range

Investment thesis: {thesis}
Current price: ${quote.get('price', 'N/A')}
Portfolio weight: {weight*100:.1f}%
Earnings date: {earnings_date}

Historical EPS:
{eps_history}

Key metrics: {metrics}
Analyst consensus: {consensus}

Start with: 📊 PRE-EARNINGS BRIEF · {ticker} · {earnings_date}
Keep it under 400 words. Institutional tone."""

    try:
        resp = client.messages.create(
            model=MODEL_DEEP, max_tokens=800,
            messages=[{"role": "user", "content": prompt}]
        )
        msg = resp.content[0].text.strip()

        import asyncio
        asyncio.get_event_loop().create_task(send_fn(msg))
        from db.queries import record_alert
        record_alert(ticker, "preearnings_brief", content_hash, "DATA", msg)
        log.info(f"Pre-earnings brief sent for {ticker}")
        return msg
    except Exception as e:
        log.warning(f"Pre-earnings brief({ticker}): {e}")
        return None


def check_earnings_release(ticker: str, send_fn) -> str | None:
    """
    Check if earnings were just released and send alert if so.
    FMP earnings-surprises returns the most recent actual.
    """
    result = get_latest_earnings(ticker)
    if not result:
        return None

    date_str = result.get("date", "")
    # Only alert if released today or yesterday
    try:
        release_date = datetime.strptime(date_str, "%Y-%m-%d")
        if (datetime.utcnow() - release_date).days > 1:
            return None
    except Exception:
        return None

    eps_actual = result.get("actualEarningResult")
    eps_est    = result.get("estimatedEarning")
    if eps_actual is None:
        return None

    content_hash = make_hash(ticker, "earnings_release", date_str, str(eps_actual))
    if already_alerted(ticker, "earnings_release", content_hash):
        return None

    beat = eps_actual >= (eps_est or eps_actual)
    surprise_pct = ((eps_actual - eps_est) / abs(eps_est) * 100) if eps_est and eps_est != 0 else 0
    severity = "URGENT"
    icon = "🟢" if beat else "🔴"
    weight = WATCHLIST.get(ticker, {}).get("weight", 0)
    thesis = WATCHLIST.get(ticker, {}).get("thesis", "")

    msg_prompt = f"""Write an earnings alert for {ticker}.
EPS actual: ${eps_actual:.2f} | Estimate: ${eps_est:.2f if eps_est else 'N/A'} | Surprise: {surprise_pct:+.1f}%
Result: {"BEAT" if beat else "MISS"}
Portfolio weight: {weight*100:.1f}%
Thesis: {thesis}

Start with: {icon} URGENT · {ticker} · EARNINGS {"BEAT" if beat else "MISS"}
Include: WHAT, WHY IT MATTERS, KEY NUMBERS, WATCH, ACTION
Max 300 words. Institutional tone."""

    try:
        from anthropic import Anthropic
        resp = Anthropic(api_key=ANTHROPIC_API_KEY).messages.create(
            model=MODEL_DEEP, max_tokens=600,
            messages=[{"role": "user", "content": msg_prompt}]
        )
        msg = resp.content[0].text.strip()

        import asyncio
        asyncio.get_event_loop().create_task(send_fn(msg))
        from db.queries import record_alert
        record_alert(ticker, "earnings_release", content_hash, severity, msg)
        log.info(f"Earnings alert sent for {ticker}")
        return msg
    except Exception as e:
        log.warning(f"Earnings release alert({ticker}): {e}")
        return None
