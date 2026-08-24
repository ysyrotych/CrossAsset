"""
Weekly Digest Job — runs Sunday at 6 PM ET.
Full portfolio health review with thesis integrity checks.
"""
import logging
from datetime import datetime
from anthropic import Anthropic
from data.prices import get_quote, get_history
from data.fmp import get_key_metrics, get_analyst_consensus, get_latest_earnings
from data.macro import get_macro_snapshot, format_macro_brief
from agents.earnings_agent import get_upcoming_earnings
from config import WATCHLIST, ANTHROPIC_API_KEY, MODEL_DEEP

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)


async def run_weekly_digest(send_fn):
    """Compose and send the Sunday weekly portfolio digest."""
    log.info("Composing weekly digest")
    today = datetime.now().strftime("%A, %B %-d, %Y")

    holdings_data = []
    for ticker, info in WATCHLIST.items():
        if ticker in ("SPY", "QQQ", "GLD"):
            quote = get_quote(ticker)
            holdings_data.append({
                "ticker": ticker,
                "weight": info.get("weight", 0),
                "price":  quote.get("price"),
                "chg_week": quote.get("change_pct"),
                "type": "index/etf",
            })
            continue

        try:
            quote   = get_quote(ticker)
            metrics = get_key_metrics(ticker)
            hist    = get_history(ticker, period="5d")
            week_chg = None
            if hist and len(hist) >= 2:
                week_chg = (hist[-1]["close"] - hist[0]["close"]) / hist[0]["close"]

            holdings_data.append({
                "ticker":    ticker,
                "weight":    info.get("weight", 0),
                "sector":    info.get("sector", ""),
                "thesis":    info.get("thesis", "")[:200],
                "price":     quote.get("price"),
                "chg_week":  week_chg,
                "pe":        metrics.get("peRatioTTM") if metrics else None,
                "fcf_yield": metrics.get("freeCashFlowYieldTTM") if metrics else None,
                "roic":      metrics.get("roicTTM") if metrics else None,
            })
        except Exception as e:
            log.warning(f"Weekly digest data({ticker}): {e}")

    macro     = get_macro_snapshot()
    macro_str = format_macro_brief(macro)
    earnings  = get_upcoming_earnings(days=14)
    ticker_set = set(WATCHLIST.keys())
    upcoming_eps = [e for e in earnings if e.get("symbol","") in ticker_set]

    holdings_str = "\n".join([
        f"  {h['ticker']} ({h['weight']*100:.1f}%): ${h.get('price','N/A')} "
        f"WoW {h.get('chg_week',0)*100:+.2f}% "
        f"{'P/E: '+str(round(h.get('pe',0),1)) if h.get('pe') else ''}"
        for h in sorted(holdings_data, key=lambda x: -x.get("weight", 0))
    ])

    upcoming_str = "\n".join([
        f"  {e['symbol']}: {e.get('date','')} | EPS est ${e.get('epsEstimated',0):.2f}"
        for e in upcoming_eps[:8]
    ])

    prompt = f"""Write a comprehensive Sunday weekly portfolio digest for a professional investor.

Date: {today}
Macro: {macro_str}

PORTFOLIO THIS WEEK:
{holdings_str}

UPCOMING EARNINGS (next 14 days):
{upcoming_str or "  None scheduled"}

Write the digest with these sections:
1. 🗓 WEEKLY PORTFOLIO DIGEST · [date]
2. WEEK IN REVIEW — 2-3 sentences on what drove the week, macro context
3. PORTFOLIO PERFORMANCE — table of holdings with WoW change, key movers
4. THESIS CHECKS — for top 5 holdings by weight, is thesis intact? Any cracks?
5. RISK WATCH — top 3 risks heading into next week
6. ON THE CALENDAR — upcoming earnings and macro events
7. NEXT WEEK FOCUS — 3 specific things to monitor

Tone: senior analyst to PM. Institutional, direct. Under 500 words."""

    try:
        resp = client.messages.create(
            model=MODEL_DEEP, max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        msg = resp.content[0].text.strip()
        await send_fn(msg)
        log.info("Weekly digest sent")
    except Exception as e:
        log.warning(f"Weekly digest: {e}")
        fallback = f"🗓 WEEKLY DIGEST · {today}\n\nPortfolio:\n{holdings_str}\n\nMacro: {macro_str}"
        await send_fn(fallback)
