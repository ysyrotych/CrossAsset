"""
Chief of Staff — materiality triage engine.
Scores events, deduplicates, and composes final Telegram alert messages.
Uses Claude Haiku for fast screening, Sonnet for full write-ups.
"""
import logging
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL_FAST, MODEL_DEEP, WATCHLIST, THRESHOLDS
from db.queries import already_alerted, record_alert, make_hash, is_muted

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)

SEVERITY_ICONS = {
    "URGENT":   "🔴",
    "WATCH":    "🟡",
    "POSITIVE": "🟢",
    "DATA":     "📊",
    "INFO":     "ℹ️",
}


def get_position_size(ticker: str) -> float:
    """Return portfolio weight for a ticker (0.0–1.0)."""
    info = WATCHLIST.get(ticker, {})
    return info.get("weight", 0.0)


def get_thesis(ticker: str) -> str:
    info = WATCHLIST.get(ticker, {})
    return info.get("thesis", "")


def score_news_materiality(ticker: str, articles: list[dict]) -> list[dict]:
    """
    Use Claude Haiku to score each news article 0-10 for materiality.
    Returns articles with materiality score >= 6.
    """
    if not articles:
        return []

    summaries = "\n".join([
        f"{i+1}. [{a.get('source','')}] {a.get('title','')} — {a.get('summary','')[:200]}"
        for i, a in enumerate(articles[:15])
    ])

    prompt = f"""You are a senior equity analyst screening news for {ticker}.
Score each article 0-10 for INVESTMENT MATERIALITY (impact on stock price or investment thesis).

10 = CEO departure, M&A bid, earnings miss, guidance cut, regulatory action
7-9 = Major analyst rating, large insider trade, product launch, contract win
4-6 = General positive/negative news, industry trend
1-3 = Noise, PR, general market commentary
0 = Not relevant

NEWS:
{summaries}

Reply with ONLY a JSON array: [{{"idx": 1, "score": 7, "reason": "..."}}]
Be strict — most news should score below 6."""

    try:
        resp = client.messages.create(
            model=MODEL_FAST,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        import json, re
        text = resp.content[0].text
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if not match:
            return []
        scores = json.loads(match.group())
        result = []
        for s in scores:
            idx = s.get("idx", 0) - 1
            score = s.get("score", 0)
            if 0 <= idx < len(articles) and score >= 6:
                articles[idx]["materiality"] = score
                articles[idx]["materiality_reason"] = s.get("reason", "")
                result.append(articles[idx])
        return result
    except Exception as e:
        log.warning(f"score_news_materiality: {e}")
        return []


def compose_price_alert(ticker: str, quote: dict, event_type: str) -> tuple[str, str]:
    """
    Compose a price alert message. Returns (message, severity).
    """
    price     = quote.get("price", 0)
    prev      = quote.get("prev_close", price)
    chg_pct   = quote.get("change_pct", 0) or 0
    volume    = quote.get("volume", 0)
    avg_vol   = quote.get("avg_volume_30d", 0)
    weight    = get_position_size(ticker)
    thesis    = get_thesis(ticker)

    abs_chg = abs(chg_pct)
    if abs_chg >= THRESHOLDS["price_move_urgent"]:
        severity = "URGENT"
    elif abs_chg >= THRESHOLDS["price_move_watch"]:
        severity = "WATCH"
    else:
        severity = "DATA"

    direction = "UP" if chg_pct > 0 else "DOWN"
    icon = SEVERITY_ICONS[severity]
    weight_str = f"Your position: {weight*100:.1f}%" if weight > 0 else ""

    vol_note = ""
    if avg_vol and volume and volume > avg_vol * THRESHOLDS["volume_spike_mult"]:
        vol_note = f"\n📊 Volume: {volume/1e6:.1f}M ({volume/avg_vol:.1f}× avg) — unusual activity"

    msg = f"""{icon} {severity} · {ticker}{f' · {weight_str}' if weight_str else ''}

WHAT: Stock {direction} {abs(chg_pct)*100:.2f}% | ${price:.2f} (from ${prev:.2f}){vol_note}

INVESTMENT CONTEXT: {thesis[:200] if thesis else 'No thesis on file.'}

WATCH: Monitor for follow-through. Check for news catalyst.
"""
    return msg.strip(), severity


def compose_alert_with_claude(ticker: str, event_type: str, raw_data: dict,
                               severity: str = "WATCH") -> str:
    """
    Use Claude Sonnet to compose a full institutional-grade alert message.
    """
    weight = get_position_size(ticker)
    thesis = get_thesis(ticker)
    icon   = SEVERITY_ICONS.get(severity, "📊")

    system = """You are the Chief of Staff at a hedge fund — a senior analyst who writes
concise, institutional-grade alerts to the portfolio manager.
Style: Bloomberg terminal meets Goldman research note. Direct, no fluff.
Format each alert with these exact sections:
WHAT: (1-2 lines — the event)
WHY IT MATTERS: (2-3 lines — investment significance, portfolio impact)
KEY NUMBERS: (bullet list of key metrics if applicable)
WATCH: (1-2 lines — what to monitor next)
ACTION: (1 line — suggested response, if any)"""

    user = f"""Write a {severity} alert for {ticker}.

Portfolio weight: {weight*100:.1f}%
Investment thesis: {thesis}

Event data:
{str(raw_data)[:2000]}

Start the message with exactly: {icon} {severity} · {ticker}"""

    try:
        resp = client.messages.create(
            model=MODEL_DEEP,
            max_tokens=600,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return resp.content[0].text.strip()
    except Exception as e:
        log.warning(f"compose_alert_with_claude({ticker}): {e}")
        return f"{icon} {severity} · {ticker}\n\n{event_type}: {str(raw_data)[:300]}"


def try_send_alert(ticker: str, event_type: str, content_hash: str,
                   severity: str, message: str, send_fn) -> bool:
    """
    Check dedup, send alert, record it. Returns True if sent.
    send_fn: async coroutine that sends the Telegram message.
    """
    if is_muted(ticker):
        log.info(f"Alert suppressed — {ticker} is muted")
        return False

    if already_alerted(ticker, event_type, content_hash):
        log.debug(f"Dedup: {ticker} {event_type} already alerted")
        return False

    try:
        import asyncio
        asyncio.get_event_loop().create_task(send_fn(message))
        record_alert(ticker, event_type, content_hash, severity, message)
        log.info(f"Alert sent: {ticker} {event_type} ({severity})")
        return True
    except Exception as e:
        log.warning(f"try_send_alert({ticker}): {e}")
        return False
