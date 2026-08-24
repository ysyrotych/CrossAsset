"""
Chart Agent — Loop 11 & 13
Generates stock price charts and portfolio heat maps as images for Telegram.
"""
import io
import logging
from datetime import datetime, timedelta

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

log = logging.getLogger(__name__)


def generate_price_chart(ticker: str, quotes: list[dict], days: int = 90,
                         buy_price: float = None, earnings_dates: list[str] = None) -> io.BytesIO | None:
    """
    Generate a candlestick-style price chart for a ticker.
    Returns a BytesIO PNG ready to send via bot.send_photo().
    quotes: list of dicts with date, open, high, low, close, volume
    """
    try:
        if not quotes or len(quotes) < 5:
            return None

        dates  = [q["date"] for q in quotes[-days:]]
        closes = [q["close"] for q in quotes[-days:]]
        highs  = [q["high"] for q in quotes[-days:]]
        lows   = [q["low"] for q in quotes[-days:]]
        vols   = [q.get("volume", 0) for q in quotes[-days:]]

        x = list(range(len(dates)))

        # Moving averages
        def ma(data, n):
            return [sum(data[max(0,i-n+1):i+1]) / min(i+1,n) for i in range(len(data))]

        ma20  = ma(closes, 20)
        ma50  = ma(closes, 50)
        ma200 = ma(closes, 200)

        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 7),
                                        gridspec_kw={"height_ratios": [4, 1]},
                                        facecolor="#0d1117")
        for ax in (ax1, ax2):
            ax.set_facecolor("#0d1117")
            ax.tick_params(colors="#8b949e", labelsize=8)
            for spine in ax.spines.values():
                spine.set_edgecolor("#21262d")

        # Price line + fill
        ax1.plot(x, closes, color="#58a6ff", linewidth=1.5, zorder=3)
        ax1.fill_between(x, closes, min(closes), alpha=0.12, color="#58a6ff")

        # High/low range
        ax1.fill_between(x, lows, highs, alpha=0.07, color="#58a6ff")

        # MAs
        ax1.plot(x, ma20,  color="#f0883e", linewidth=0.8, linestyle="--", label="MA20", alpha=0.8)
        ax1.plot(x, ma50,  color="#3fb950", linewidth=0.8, linestyle="--", label="MA50", alpha=0.8)
        if len(closes) >= 200:
            ax1.plot(x, ma200, color="#ff7b72", linewidth=0.8, linestyle="--", label="MA200", alpha=0.8)

        # Buy price line
        if buy_price:
            ax1.axhline(buy_price, color="#ffd700", linewidth=0.8, linestyle=":", alpha=0.7)
            ax1.text(x[-1], buy_price, f" Bought ${buy_price:.0f}", color="#ffd700",
                     fontsize=7, va="center")

        # Earnings date markers
        if earnings_dates:
            for ed in earnings_dates:
                try:
                    ed_idx = next((i for i, d in enumerate(dates) if d >= ed), None)
                    if ed_idx is not None:
                        ax1.axvline(ed_idx, color="#bc8cff", linewidth=0.8, alpha=0.5)
                        ax1.text(ed_idx, min(lows), "E", color="#bc8cff", fontsize=6, ha="center")
                except Exception:
                    pass

        # Price annotation
        last = closes[-1]
        first = closes[0]
        chg = (last - first) / first * 100
        color = "#3fb950" if chg >= 0 else "#ff7b72"
        arrow = "▲" if chg >= 0 else "▼"
        ax1.set_title(f"{ticker}  ${last:.2f}  {arrow}{abs(chg):.1f}% ({days}d)",
                      color="#c9d1d9", fontsize=13, fontweight="bold", pad=12)

        ax1.legend(loc="upper left", fontsize=7, facecolor="#161b22",
                   labelcolor="#8b949e", edgecolor="#21262d")
        ax1.yaxis.label.set_color("#8b949e")
        ax1.tick_params(axis="x", which="both", bottom=False, labelbottom=False)

        # Tick labels — show only a few dates
        step = max(1, len(x) // 6)
        ax1.set_xticks(x[::step])

        # Volume bars
        vol_colors = ["#3fb950" if closes[i] >= closes[i-1] else "#ff7b72"
                      for i in range(len(closes))]
        vol_colors[0] = "#58a6ff"
        ax2.bar(x, vols, color=vol_colors, alpha=0.6, width=0.8)
        ax2.set_xlim(ax1.get_xlim())
        ax2.set_ylabel("Vol", color="#8b949e", fontsize=7)
        date_labels = [dates[i] for i in range(0, len(dates), step)]
        ax2.set_xticks(x[::step])
        ax2.set_xticklabels(date_labels, fontsize=6, rotation=30, ha="right", color="#8b949e")

        plt.tight_layout(pad=1.5)
        buf = io.BytesIO()
        plt.savefig(buf, format="png", dpi=150, facecolor="#0d1117", bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return buf
    except Exception as e:
        log.warning(f"generate_price_chart({ticker}): {e}")
        return None


def generate_portfolio_heatmap(holdings: list[dict]) -> io.BytesIO | None:
    """
    Generate a portfolio heat map — grid of tiles colored by today's P&L.
    holdings: [{"ticker": str, "value": float, "change_pct": float, "pnl_today": float}]
    """
    try:
        holdings = [h for h in holdings if h.get("price", 0) > 0]
        if not holdings:
            return None

        holdings_sorted = sorted(holdings, key=lambda h: -h["value"])
        n = len(holdings_sorted)
        cols = min(4, n)
        rows = (n + cols - 1) // cols

        fig, ax = plt.subplots(figsize=(cols * 3, rows * 2.2), facecolor="#0d1117")
        ax.set_facecolor("#0d1117")
        ax.set_xlim(0, cols)
        ax.set_ylim(0, rows)
        ax.axis("off")

        for i, h in enumerate(holdings_sorted):
            col = i % cols
            row = rows - 1 - (i // cols)
            chg = h.get("change_pct") or 0
            pnl = h.get("pnl_today", 0)

            intensity = min(abs(chg) / 0.05, 1.0)
            if chg >= 0:
                r, g, b = 0.1 + 0.1*intensity, 0.3 + 0.5*intensity, 0.1 + 0.1*intensity
            else:
                r, g, b = 0.3 + 0.5*intensity, 0.1, 0.1 + 0.1*intensity

            rect = mpatches.FancyBboxPatch(
                (col + 0.05, row + 0.05), 0.9, 0.9,
                boxstyle="round,pad=0.02",
                facecolor=(r, g, b), edgecolor="#21262d", linewidth=0.5
            )
            ax.add_patch(rect)

            arrow = "▲" if chg >= 0 else "▼"
            pnl_color = "#a0ffa0" if pnl >= 0 else "#ffa0a0"
            ax.text(col + 0.5, row + 0.65, h["ticker"],
                    ha="center", va="center", fontsize=12, fontweight="bold", color="white")
            ax.text(col + 0.5, row + 0.40, f"{arrow}{abs(chg)*100:.1f}%",
                    ha="center", va="center", fontsize=9, color=pnl_color)
            ax.text(col + 0.5, row + 0.20, f"${pnl:+.0f}" if pnl != 0 else "",
                    ha="center", va="center", fontsize=7, color="#8b949e")

        total_pnl   = sum(h.get("pnl_today", 0) for h in holdings)
        total_value = sum(h.get("value", 0) for h in holdings)
        total_chg   = total_pnl / (total_value - total_pnl) * 100 if total_value else 0
        title_color = "#3fb950" if total_pnl >= 0 else "#ff7b72"
        arrow = "▲" if total_pnl >= 0 else "▼"

        ax.set_title(
            f"Portfolio  ${total_value:,.0f}  {arrow}${abs(total_pnl):,.0f} ({abs(total_chg):.2f}%)",
            color=title_color, fontsize=13, fontweight="bold", pad=8
        )

        plt.tight_layout(pad=0.5)
        buf = io.BytesIO()
        plt.savefig(buf, format="png", dpi=150, facecolor="#0d1117", bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return buf
    except Exception as e:
        log.warning(f"generate_portfolio_heatmap: {e}")
        return None
