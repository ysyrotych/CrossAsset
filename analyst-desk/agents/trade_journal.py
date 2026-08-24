"""
Trade Journal — Loop 22
Tracks thesis integrity over time. Records decisions, monitors drift,
surfaces when a thesis is being challenged by new evidence.
"""
import logging
import json
from datetime import datetime
import pytz
from anthropic import Anthropic
from db.queries import memory_get, memory_set, memory_get_all
from data.prices import get_quote, get_history
from data.fmp import get_key_metrics, get_profile
from data.news import get_all_news
from config import WATCHLIST, ANTHROPIC_API_KEY, MODEL_FAST, TIMEZONE

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)
TZ = pytz.timezone(TIMEZONE)


def record_thesis_check(ticker: str, status: str, note: str = "") -> None:
    """
    Record a thesis check result.
    status: INTACT | WATCH | CHALLENGED
    """
    now = datetime.now(TZ).isoformat()
    history_key = f"thesis_history_{ticker}"
    raw = memory_get(history_key)

    history: list = []
    if raw:
        try:
            history = json.loads(raw)
        except Exception:
            history = []

    history.append({"date": now, "status": status, "note": note})
    # Keep last 30 entries
    history = history[-30:]
    memory_set(history_key, json.dumps(history), category="decision")


def get_thesis_history(ticker: str) -> list[dict]:
    """Return thesis check history for a ticker."""
    key = f"thesis_history_{ticker}"
    raw = memory_get(key)
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            return []
    return []


def record_trade_decision(ticker: str, action: str, reason: str, price: float = 0) -> None:
    """
    Log a trade decision (buy, sell, hold, add, trim).
    Stored in memory so Tyler can reference past decisions.
    """
    now = datetime.now(TZ).isoformat()
    key = f"trade_log_{ticker}"
    raw = memory_get(key)

    log_entries: list = []
    if raw:
        try:
            log_entries = json.loads(raw)
        except Exception:
            log_entries = []

    log_entries.append({
        "date": now,
        "action": action.upper(),
        "reason": reason,
        "price": price,
    })
    log_entries = log_entries[-20:]
    memory_set(key, json.dumps(log_entries), category="decision")
    log.info(f"Trade log: {ticker} {action} @ ${price:.2f}")


def get_trade_log(ticker: str) -> list[dict]:
    """Return trade decision log for a ticker."""
    key = f"trade_log_{ticker}"
    raw = memory_get(key)
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            return []
    return []


def assess_thesis_drift(ticker: str) -> dict:
    """
    Use Claude to assess if a thesis is drifting vs. original investment rationale.
    Returns: {status, explanation, drift_score (0-10)}
    """
    info     = WATCHLIST.get(ticker, {})
    thesis   = info.get("thesis", "")
    if not thesis:
        return {"status": "UNKNOWN", "explanation": "No thesis on record", "drift_score": 0}

    quote    = get_quote(ticker)
    metrics  = get_key_metrics(ticker)
    news     = get_all_news(ticker, days=7)[:5]
    history  = get_history(ticker, period="1mo")
    hist_checks = get_thesis_history(ticker)

    price = quote.get("price", 0) or 0
    chg_m = None
    if history and len(history) >= 2:
        chg_m = (history[-1]["close"] - history[0]["close"]) / history[0]["close"]

    news_str = "\n".join([f"- {a.get('title','')[:80]}" for a in news])
    metrics_str = ""
    if metrics:
        pe   = metrics.get("peRatioTTM")
        roic = metrics.get("roicTTM")
        if pe:
            metrics_str += f"P/E: {pe:.1f}  "
        if roic:
            metrics_str += f"ROIC: {roic*100:.1f}%"

    recent_status = hist_checks[-1]["status"] if hist_checks else "None"

    prompt = f"""Assess whether the investment thesis for {ticker} is intact.

ORIGINAL THESIS: {thesis}

CURRENT STATE:
Price: ${price:.2f}  ·  1-Month Change: {f'{chg_m*100:+.2f}%' if chg_m else 'N/A'}
Metrics: {metrics_str or 'N/A'}
Last Assessment: {recent_status}

RECENT NEWS:
{news_str or 'No recent news'}

Respond in JSON only:
{{
  "status": "INTACT" | "WATCH" | "CHALLENGED",
  "explanation": "one specific sentence on why",
  "drift_score": 0-10
}}

INTACT = thesis playing out as expected
WATCH = 1-2 signs of thesis drift, monitor closely
CHALLENGED = thesis is being invalidated by facts
drift_score: 0 = perfectly intact, 10 = completely broken"""

    try:
        resp = client.messages.create(
            model=MODEL_FAST, max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        text = resp.content[0].text.strip()
        # Strip markdown if any
        text = text.replace("```json", "").replace("```", "").strip()
        result = json.loads(text)
        record_thesis_check(
            ticker, result.get("status", "UNKNOWN"),
            result.get("explanation", "")
        )
        return result
    except Exception as e:
        log.warning(f"thesis_drift({ticker}): {e}")
        return {"status": "UNKNOWN", "explanation": str(e), "drift_score": 0}


def format_thesis_report(ticker: str) -> str:
    """Format thesis integrity check + trade log for Telegram."""
    info    = WATCHLIST.get(ticker, {})
    thesis  = info.get("thesis", "No thesis recorded.")
    drift   = assess_thesis_drift(ticker)
    history = get_thesis_history(ticker)
    trades  = get_trade_log(ticker)

    status  = drift.get("status", "UNKNOWN")
    status_emoji = {"INTACT": "✅", "WATCH": "🟡", "CHALLENGED": "🔴", "UNKNOWN": "⚪️"}.get(status, "")
    score   = drift.get("drift_score", 0)
    explain = drift.get("explanation", "")

    lines = [f"📓 TRADE JOURNAL · {ticker}\n"]
    lines.append(f"Thesis: {thesis[:120]}\n")
    lines.append(f"Status: {status_emoji} {status}  (Drift {score}/10)")
    lines.append(f"Assessment: {explain}\n")

    if history:
        lines.append("HISTORY:")
        for h in history[-5:]:
            date_short = h["date"][:10]
            st = h["status"]
            emoji = {"INTACT": "✅", "WATCH": "🟡", "CHALLENGED": "🔴"}.get(st, "⚪️")
            lines.append(f"  {date_short}  {emoji} {st}")
        lines.append("")

    if trades:
        lines.append("DECISIONS:")
        for t in trades[-4:]:
            date_short = t["date"][:10]
            action = t["action"]
            price  = t.get("price", 0)
            reason = t.get("reason", "")[:60]
            lines.append(f"  {date_short}  {action}" + (f" @ ${price:.2f}" if price else "") + f"  — {reason}")

    return "\n".join(lines)


async def run_thesis_drift_scan(send_fn) -> None:
    """Weekly scan — alert if any thesis has drifted to CHALLENGED."""
    SKIP = {"VOO", "VUG"}
    challenged = []

    for ticker in WATCHLIST:
        if ticker in SKIP:
            continue
        try:
            result = assess_thesis_drift(ticker)
            if result.get("status") == "CHALLENGED":
                challenged.append((ticker, result))
        except Exception as e:
            log.warning(f"thesis_scan({ticker}): {e}")

    if challenged:
        lines = ["📓 THESIS ALERT — CHALLENGED POSITIONS\n"]
        for ticker, result in challenged:
            lines.append(f"🔴 {ticker}: {result.get('explanation','')}")
        lines.append("\nReview these positions — thesis may no longer hold.")
        await send_fn("\n".join(lines))
