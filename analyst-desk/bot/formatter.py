"""
Message formatting utilities for Telegram output.
Handles Markdown escaping, table formatting, and message chunking.
"""
import re

MAX_MSG_LEN = 4096  # Telegram limit


def escape_md(text: str) -> str:
    """Escape Telegram MarkdownV2 special characters."""
    special = r"\_*[]()~`>#+-=|{}.!"
    return re.sub(f"([{re.escape(special)}])", r"\\\1", text)


def fmt_pct(val: float | None, decimals: int = 2) -> str:
    if val is None:
        return "N/A"
    sign = "+" if val >= 0 else ""
    return f"{sign}{val*100:.{decimals}f}%"


def fmt_price(val: float | None, decimals: int = 2) -> str:
    if val is None:
        return "N/A"
    return f"${val:,.{decimals}f}"


def fmt_large(val: float | None) -> str:
    """Format large numbers: 1.2B, 450M, etc."""
    if val is None:
        return "N/A"
    if abs(val) >= 1e12:
        return f"${val/1e12:.1f}T"
    if abs(val) >= 1e9:
        return f"${val/1e9:.1f}B"
    if abs(val) >= 1e6:
        return f"${val/1e6:.1f}M"
    if abs(val) >= 1e3:
        return f"${val/1e3:.1f}K"
    return f"${val:.0f}"


def split_message(text: str, limit: int = MAX_MSG_LEN) -> list[str]:
    """Split a long message into chunks that fit within Telegram's limit."""
    if len(text) <= limit:
        return [text]
    chunks = []
    while text:
        if len(text) <= limit:
            chunks.append(text)
            break
        # Try to split at a newline
        split_at = text.rfind("\n", 0, limit)
        if split_at == -1:
            split_at = limit
        chunks.append(text[:split_at])
        text = text[split_at:].lstrip("\n")
    return chunks


def portfolio_table(watchlist: dict, quotes: dict) -> str:
    """Format a portfolio holdings table."""
    lines = ["📊 PORTFOLIO HOLDINGS\n"]
    lines.append(f"{'Ticker':<8} {'Weight':>7} {'Price':>10} {'WoW':>8}")
    lines.append("─" * 38)

    for ticker, info in sorted(watchlist.items(), key=lambda x: -x[1].get("weight", 0)):
        weight = info.get("weight", 0)
        q = quotes.get(ticker, {})
        price  = q.get("price")
        chg    = q.get("change_pct")
        p_str  = fmt_price(price) if price else "N/A"
        c_str  = fmt_pct(chg) if chg is not None else "N/A"
        lines.append(f"{ticker:<8} {weight*100:>6.1f}% {p_str:>10} {c_str:>8}")

    return "\n".join(lines)
