"""
Weekly Digest — Loop 26 (Goldman-Quality Report)
Runs Sunday 6 PM ET. Full institutional research newsletter.
"""
import logging
from datetime import datetime
from anthropic import Anthropic
from data.prices import get_quotes_batch, get_history
from data.fmp import get_key_metrics, get_analyst_consensus
from data.macro import get_macro_snapshot, format_macro_brief
from agents.earnings_agent import get_upcoming_earnings
from agents.earnings_quality import score_earnings_quality
from db.queries import get_pnl_history, get_pnl_streak
from config import WATCHLIST, ANTHROPIC_API_KEY, MODEL_DEEP, TIMEZONE
import pytz

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)
TZ = pytz.timezone(TIMEZONE)


async def run_weekly_digest(send_fn):
    """Compose and send the Sunday institutional weekly report."""
    log.info("Composing weekly digest")
    today = datetime.now(TZ).strftime("%A, %B %-d, %Y")

    # Portfolio data
    tickers = list(WATCHLIST.keys())
    quotes  = get_quotes_batch(tickers)

    total_value = 0.0
    holdings_data = []
    for ticker, info in WATCHLIST.items():
        shares = info.get("shares", 0)
        q      = quotes.get(ticker, {})
        price  = q.get("price") or 0
        prev   = q.get("prev_close") or price
        value  = shares * price
        total_value += value

        try:
            hist     = get_history(ticker, period="5d")
            week_chg = None
            if hist and len(hist) >= 2:
                week_chg = (hist[-1]["close"] - hist[0]["close"]) / hist[0]["close"]

            metrics  = get_key_metrics(ticker)
            holdings_data.append({
                "ticker":    ticker,
                "sector":    info.get("sector",""),
                "thesis":    info.get("thesis","")[:150],
                "shares":    shares,
                "price":     price,
                "value":     value,
                "chg_week":  week_chg,
                "pe":        metrics.get("peRatioTTM") if metrics else None,
                "fcf_yield": metrics.get("freeCashFlowYieldTTM") if metrics else None,
                "roic":      metrics.get("roicTTM") if metrics else None,
            })
        except Exception as e:
            log.warning(f"weekly_data({ticker}): {e}")
            holdings_data.append({"ticker": ticker, "value": value, "shares": shares,
                                   "price": price, "chg_week": None})

    # Sort by value
    holdings_data = sorted(holdings_data, key=lambda h: -(h.get("value") or 0))
    for h in holdings_data:
        h["weight"] = h["value"] / total_value if total_value else 0

    # P&L history
    pnl_history = get_pnl_history(days=7)
    week_pnl    = sum(r["pnl"] for r in pnl_history) if pnl_history else 0
    streak      = get_pnl_streak()

    # Macro
    macro     = get_macro_snapshot()
    macro_str = format_macro_brief(macro)

    # Upcoming earnings
    earnings   = get_upcoming_earnings(days=14)
    ticker_set = set(WATCHLIST.keys())
    upcoming   = [e for e in earnings if e.get("symbol","") in ticker_set]

    # Build data string
    perf_lines = []
    for h in holdings_data:
        wk = h.get("chg_week")
        wk_str = f"{wk*100:+.2f}%" if wk is not None else "—"
        pe_str = f"P/E {h['pe']:.1f}" if h.get("pe") else ""
        perf_lines.append(
            f"{h['ticker']:<6} {h['weight']*100:.1f}%  {wk_str:>8}  ${h['value']:>8,.0f}  {pe_str}"
        )

    thesis_lines = []
    for h in holdings_data[:6]:
        thesis_lines.append(f"{h['ticker']}: {h.get('thesis','')[:120]}")

    earnings_str = "\n".join([
        f"  {e['symbol']}: {e.get('date','')} {e.get('time','')} | EPS est ${e.get('epsEstimated',0):.2f}"
        for e in upcoming[:6]
    ]) or "  None in next 14 days"

    prompt = f"""Write a Goldman Sachs-quality Sunday portfolio research report.

DATE: {today}
PORTFOLIO VALUE: ${total_value:,.0f}
WEEK P&L: ${week_pnl:+,.0f}  {'Win streak: '+str(streak)+' days' if streak >= 2 else ''}

HOLDINGS PERFORMANCE:
{chr(10).join(perf_lines)}

INVESTMENT THESES:
{chr(10).join(thesis_lines)}

MACRO ENVIRONMENT:
{macro_str}

EARNINGS NEXT 14 DAYS:
{earnings_str}

Write a complete institutional weekly report with these sections:

📊 WEEKLY RESEARCH REPORT · [date]

1. EXECUTIVE SUMMARY
2-3 sentences on what drove the week and what it means for the portfolio.

2. PORTFOLIO PERFORMANCE
Clean recap of week's winners and losers with specific dollar and % attribution.
What drove the moves? Was it macro or fundamental?

3. THESIS INTEGRITY CHECK
For the top 5 holdings by value, assess: INTACT / WATCH / CHALLENGED
One specific reason per holding — not generic, be specific to the thesis.

4. RISK RADAR
Top 3 risks heading into next week, specific and actionable.

5. WEEK AHEAD — WHAT TO WATCH
5 specific things: earnings dates, macro events, specific price levels or news to monitor.

6. TYLER'S CONVICTION CALL
One specific view Tyler has highest conviction on right now. Bull or bear, pick a side.

Tone: Senior sell-side analyst writing to a sophisticated PM. No fluff, no hedging.
Max 600 words."""

    try:
        resp = client.messages.create(model=MODEL_DEEP, max_tokens=1400,
                                       messages=[{"role": "user", "content": prompt}])
        msg = resp.content[0].text.strip()
        await send_fn(msg)
        log.info("Weekly digest sent")
    except Exception as e:
        log.warning(f"weekly_digest: {e}")
        fallback = f"📊 WEEKLY DIGEST · {today}\n\n{chr(10).join(perf_lines)}\n\n{macro_str}"
        await send_fn(fallback)
