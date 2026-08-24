"""
Portfolio P&L Agent — Loop 14
Tracks intraday and daily P&L with streaks, sends visual updates.
"""
import logging
import pytz
from datetime import datetime
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL_FAST, WATCHLIST, TIMEZONE
from data.prices import get_quotes_batch
from db.queries import record_daily_pnl, get_pnl_streak, get_pnl_history
from bot.formatter import fmt_large, fmt_price, fmt_pct

log = logging.getLogger(__name__)
TZ = pytz.timezone(TIMEZONE)


def compute_portfolio_pnl(quotes: dict) -> dict:
    """Compute full P&L breakdown from quotes."""
    holdings = []
    total_value = 0.0
    total_open  = 0.0

    for ticker, info in WATCHLIST.items():
        shares   = info.get("shares", 0)
        q        = quotes.get(ticker, {})
        price    = q.get("price") or 0
        prev     = q.get("prev_close") or price
        value    = shares * price
        open_val = shares * prev
        pnl      = value - open_val
        chg_pct  = (price - prev) / prev if prev else 0

        total_value += value
        total_open  += open_val
        holdings.append({
            "ticker": ticker, "price": price, "prev": prev,
            "value": value, "pnl": pnl, "change_pct": chg_pct, "shares": shares,
        })

    total_pnl = total_value - total_open
    total_chg  = total_pnl / total_open if total_open else 0

    best  = max(holdings, key=lambda h: h["pnl"])
    worst = min(holdings, key=lambda h: h["pnl"])

    return {
        "holdings": sorted(holdings, key=lambda h: -h["value"]),
        "total_value": total_value,
        "total_pnl": total_pnl,
        "total_chg": total_chg,
        "best": best,
        "worst": worst,
    }


async def run_pnl_update(send_fn, close: bool = False):
    """
    Send a P&L update. Called every 30 min during market hours.
    close=True triggers the daily close recording + streak update.
    """
    tickers = list(WATCHLIST.keys())
    quotes  = get_quotes_batch(tickers)
    pnl     = compute_portfolio_pnl(quotes)

    total       = pnl["total_value"]
    day_pnl     = pnl["total_pnl"]
    day_chg     = pnl["total_chg"]
    best        = pnl["best"]
    worst       = pnl["worst"]

    arrow     = "▲" if day_pnl >= 0 else "▼"
    pnl_color = "+" if day_pnl >= 0 else ""

    now_et = datetime.now(TZ).strftime("%I:%M %p ET")

    lines = [
        f"💰 PORTFOLIO P&L · {now_et}\n",
        f"Total Value:  {fmt_large(total)}",
        f"Today:        {arrow}{fmt_large(abs(day_pnl))}  ({pnl_color}{day_chg*100:.2f}%)",
        f"",
        f"🏆 Best:    {best['ticker']} {'+' if best['pnl'] >= 0 else ''}{fmt_large(best['pnl'])}  ({best['change_pct']*100:+.2f}%)",
        f"📉 Worst:   {worst['ticker']} {'+' if worst['pnl'] >= 0 else ''}{fmt_large(worst['pnl'])}  ({worst['change_pct']*100:+.2f}%)",
    ]

    if close:
        today = datetime.now(TZ).strftime("%Y-%m-%d")
        record_daily_pnl(today, total, day_pnl, day_chg,
                          best["ticker"], worst["ticker"])
        streak = get_pnl_streak()
        if streak >= 2:
            lines.append(f"\n🔥 Win streak: {streak} days in a row")
        elif streak <= -2:
            lines.append(f"\n📉 Loss streak: {abs(streak)} days")

        # Week summary
        history = get_pnl_history(days=5)
        if len(history) >= 2:
            week_pnl = sum(r["pnl"] for r in history)
            lines.append(f"\nThis week: {'+' if week_pnl >= 0 else ''}{fmt_large(week_pnl)}")

        lines[0] = f"📊 MARKET CLOSE P&L\n"

    await send_fn("\n".join(lines))


async def run_close_heatmap(send_fn, send_photo_fn):
    """Send a visual portfolio heatmap at market close."""
    from agents.chart_agent import generate_portfolio_heatmap

    tickers = list(WATCHLIST.keys())
    quotes  = get_quotes_batch(tickers)
    pnl     = compute_portfolio_pnl(quotes)

    holdings_for_map = [
        {
            "ticker":    h["ticker"],
            "value":     h["value"],
            "change_pct": h["change_pct"],
            "pnl_today": h["pnl"],
            "price":     h["price"],
        }
        for h in pnl["holdings"]
    ]

    buf = generate_portfolio_heatmap(holdings_for_map)
    if buf:
        try:
            now_et  = datetime.now(TZ).strftime("%a %b %-d")
            day_pnl = pnl["total_pnl"]
            arrow   = "▲" if day_pnl >= 0 else "▼"
            caption = (f"📊 Portfolio Close · {now_et}  "
                       f"{arrow}${abs(day_pnl):,.0f} ({pnl['total_chg']*100:+.2f}%)")
            await send_photo_fn(buf, caption)
            return True
        except Exception as e:
            log.warning(f"run_close_heatmap send: {e}")

    # Fallback to text
    await run_pnl_update(send_fn, close=True)
    return False
