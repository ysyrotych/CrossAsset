"""
Morning Brief Job — runs at 7:00 AM ET daily.
Comprehensive market and portfolio rundown to start the day.
"""
import logging
from datetime import datetime
from anthropic import Anthropic
from data.prices import get_market_snapshot, get_premarket_quote
from data.macro import get_macro_snapshot, format_macro_brief, get_economic_calendar
from agents.earnings_agent import get_upcoming_earnings
from config import WATCHLIST, ANTHROPIC_API_KEY, MODEL_DEEP

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)


async def run_morning_brief(send_fn):
    """Compose and send the daily morning brief."""
    log.info("Composing morning brief")
    today = datetime.now().strftime("%A, %B %-d, %Y")

    # Gather all data
    market    = get_market_snapshot()
    macro     = get_macro_snapshot()
    macro_str = format_macro_brief(macro)
    earnings  = get_upcoming_earnings(days=7)
    econ_cal  = get_economic_calendar(days=2)

    # Pre-market quotes for portfolio holdings
    premarket_lines = []
    for ticker in list(WATCHLIST.keys())[:8]:
        if ticker in ("SPY", "QQQ", "GLD"):
            continue
        pm = get_premarket_quote(ticker)
        ext_price = pm.get("extended_price")
        ext_chg   = pm.get("extended_change_pct")
        if ext_price and ext_chg:
            arrow = "▲" if ext_chg > 0 else "▼"
            premarket_lines.append(
                f"  {ticker}: ${ext_price:.2f} {arrow}{abs(ext_chg)*100:.2f}% pre-mkt"
            )

    # Market snapshot lines
    def mkt_line(label: str, key: str) -> str:
        d = market.get(key, {})
        p = d.get("price")
        c = d.get("change_pct")
        if p is None:
            return f"  {label}: N/A"
        arrow = "▲" if c and c > 0 else "▼" if c and c < 0 else "→"
        return f"  {label}: {p:,.1f} {arrow}{abs(c)*100:.2f}%" if c else f"  {label}: {p:,.1f}"

    mkt_lines = [
        mkt_line("SPX", "SPX"),
        mkt_line("NDX", "NDX"),
        mkt_line("VIX", "VIX"),
        mkt_line("DXY", "DXY"),
        mkt_line("Oil", "OIL"),
        mkt_line("Gold","GOLD"),
    ]

    # Upcoming earnings for portfolio
    earnings_lines = []
    ticker_set = set(WATCHLIST.keys())
    for e in earnings:
        sym = e.get("symbol","")
        if sym in ticker_set:
            date = e.get("date","")
            est  = e.get("epsEstimated")
            earnings_lines.append(
                f"  {sym}: {date}" + (f" | EPS est ${est:.2f}" if est else "")
            )

    # Economic calendar
    econ_lines = []
    for ev in econ_cal[:4]:
        econ_lines.append(f"  {ev.get('time','')} — {ev.get('event','')} [{ev.get('impact','').upper()}]")

    # Compose with Claude
    prompt = f"""You are the Chief of Staff for a portfolio manager. Write today's morning brief.

Date: {today}

MARKET (futures/premarket):
{chr(10).join(mkt_lines)}

PORTFOLIO PRE-MARKET:
{chr(10).join(premarket_lines) if premarket_lines else "  Data unavailable"}

MACRO:
{macro_str}

UPCOMING EARNINGS (this week):
{chr(10).join(earnings_lines) if earnings_lines else "  None for your portfolio"}

ECONOMIC CALENDAR (next 48h):
{chr(10).join(econ_lines) if econ_lines else "  No high-impact events"}

Write a crisp morning brief. Format:
📊 MORNING BRIEF · {today}

[2-line market setup — what's the overall tone]

PORTFOLIO PRE-MARKET:
[pre-market moves with brief note on anything notable]

MACRO:
[key macro readings in 1-2 lines]

ON THE RADAR TODAY:
[3-5 bullets — most important things to watch today]

CALENDAR:
[earnings and econ events formatted cleanly]

Keep it under 350 words. Institutional, direct tone. No fluff."""

    try:
        resp = client.messages.create(
            model=MODEL_DEEP, max_tokens=700,
            messages=[{"role": "user", "content": prompt}]
        )
        msg = resp.content[0].text.strip()
        await send_fn(msg)
        log.info("Morning brief sent")
    except Exception as e:
        log.warning(f"Morning brief: {e}")
        # Fallback minimal brief
        fallback = f"📊 MORNING BRIEF · {today}\n\n" + "\n".join(mkt_lines) + f"\n\nMACRO: {macro_str}"
        await send_fn(fallback)
