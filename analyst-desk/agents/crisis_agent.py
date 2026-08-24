"""
Crisis Mode — Loop 27
Triggers when SPX drops >2% intraday or any holding drops >8%.
Delivers an immediate full portfolio stress test and actionable analysis.
"""
import logging
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL_DEEP, WATCHLIST
from data.prices import get_quote, get_quotes_batch, get_market_snapshot
from db.queries import already_alerted, record_alert, make_hash
from agents.chief_of_staff import try_send_alert

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)

CRISIS_SPX_THRESHOLD    = -0.020   # SPX down 2%
CRISIS_HOLDING_THRESHOLD = -0.080  # Any holding down 8%
RECOVERY_THRESHOLD       = -0.010  # SPX needs to be below -1% to stay in crisis


def _compute_portfolio(quotes: dict) -> dict:
    total = 0.0
    holdings = []
    for ticker, info in WATCHLIST.items():
        shares = info.get("shares", 0)
        q = quotes.get(ticker, {})
        price = q.get("price") or 0
        chg   = q.get("change_pct") or 0
        value = shares * price
        total += value
        holdings.append({"ticker": ticker, "shares": shares, "price": price,
                          "value": value, "change_pct": chg})
    for h in holdings:
        h["weight"] = h["value"] / total if total > 0 else 0
    return {"holdings": holdings, "total_value": total}


async def check_crisis(send_fn) -> bool:
    """
    Check for crisis conditions. Returns True if crisis alert was sent.
    Should be called every 5 minutes during market hours.
    """
    market = get_market_snapshot()
    spx_chg = market.get("SPX", {}).get("change_pct") or 0
    vix     = market.get("VIX", {}).get("price") or 0

    tickers = list(WATCHLIST.keys())
    quotes  = get_quotes_batch(tickers)
    pf      = _compute_portfolio(quotes)

    # Check trigger conditions
    spx_crisis = spx_chg <= CRISIS_SPX_THRESHOLD
    holding_crisis = any(
        (quotes.get(t, {}).get("change_pct") or 0) <= CRISIS_HOLDING_THRESHOLD
        for t in tickers
    )

    if not spx_crisis and not holding_crisis:
        return False

    # Dedup — don't spam crisis alerts
    crisis_key = "MARKET" if spx_crisis else "HOLDING"
    content_hash = make_hash("CRISIS", crisis_key,
                              str(round(spx_chg, 3)),
                              str(round(pf["total_value"], -2)))
    if already_alerted("CRISIS", crisis_key, content_hash):
        return False

    # Build portfolio impact
    holdings_sorted = sorted(pf["holdings"], key=lambda h: h.get("change_pct") or 0)
    total_pnl = sum(h["weight"] * (h.get("change_pct") or 0) for h in pf["holdings"]) * pf["total_value"]
    portfolio_chg = sum(h["weight"] * (h.get("change_pct") or 0) for h in pf["holdings"])

    worst3  = holdings_sorted[:3]
    best3   = holdings_sorted[-3:][::-1]

    holding_lines = "\n".join([
        f"  {h['ticker']}: {(h.get('change_pct') or 0)*100:+.2f}%  (${h['value']*abs(h.get('change_pct') or 0):,.0f} impact)"
        for h in worst3
    ])

    # Get historical context from Claude
    prompt = f"""A market crisis is happening right now. Write a calm, institutional crisis brief.

MARKET DATA:
SPX: {spx_chg*100:+.2f}% today
VIX: {vix:.1f}
Portfolio impact: ${total_pnl:+,.0f} ({portfolio_chg*100:+.2f}%)

Worst holdings: {', '.join([f"{h['ticker']} {(h.get('change_pct') or 0)*100:+.1f}%" for h in worst3])}
Best holdings: {', '.join([f"{h['ticker']} {(h.get('change_pct') or 0)*100:+.1f}%" for h in best3])}

Portfolio: META, GOOGL, UBER, DUOL, NBIS, CMG, VOO, AMZN, AAPL, APLD, HOOD, NVDA, VUG

Write:
🚨 CRISIS MODE · [brief 5-word summary of what's happening]

WHAT'S HAPPENING: (2 sentences — what's driving the selloff)
PORTFOLIO IMPACT: (1-2 sentences — dollars and context)
YOUR HOLDINGS:
  [3 most affected with % and dollar impact]
  [2 most defensive positions]
HISTORICAL CONTEXT: (Is this a dip or something serious? Compare to past episodes)
WHAT TO WATCH: (2 specific things that will tell you if this escalates or reverses)
WHAT NOT TO DO: (1 sentence — common mistake in this scenario)

Institutional tone. No panic. Max 200 words."""

    try:
        resp = client.messages.create(model=MODEL_DEEP, max_tokens=500,
                                       messages=[{"role": "user", "content": prompt}])
        msg = resp.content[0].text.strip()
    except Exception as e:
        log.warning(f"crisis_agent Claude: {e}")
        arrow = "▼" if portfolio_chg < 0 else "▲"
        msg = f"""🚨 CRISIS MODE

SPX: {spx_chg*100:+.2f}%  |  VIX: {vix:.1f}
Portfolio: {arrow}${abs(total_pnl):,.0f} ({portfolio_chg*100:+.2f}%)

MOST AFFECTED:
{holding_lines}"""

    try_send_alert("MARKET", "crisis", content_hash, "URGENT", msg, send_fn)
    return True
