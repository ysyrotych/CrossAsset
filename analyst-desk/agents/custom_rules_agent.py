"""
Custom Rules Agent — Loop 25
Natural language custom alert rules — "Alert me when NVDA drops 3% in a day"
Stored in DB, evaluated against live quotes every cycle.
"""
import logging
import json
import re
from anthropic import Anthropic
from data.prices import get_quotes_batch
from db.queries import get_active_rules, add_custom_rule, mark_rule_fired
from config import WATCHLIST, ANTHROPIC_API_KEY, MODEL_FAST

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)


def parse_rule_from_text(text: str) -> dict | None:
    """
    Use Claude to parse a natural language rule into a structured rule dict.
    Example: "Alert me when NVDA drops 3% in a day"
    → {"ticker": "NVDA", "rule_type": "price_drop", "threshold": 0.03, "description": text}
    """
    prompt = f"""Parse this natural language alert rule into JSON.

RULE: "{text}"

Available rule_types:
- price_drop: ticker drops more than X% in a day (threshold = decimal, e.g. 0.03)
- price_rise: ticker rises more than X% in a day
- price_below: ticker price drops below $X absolute (threshold = price)
- price_above: ticker price rises above $X absolute
- rsi_oversold: RSI drops below X (threshold = RSI level, e.g. 30)
- rsi_overbought: RSI rises above X

Respond ONLY with JSON (no markdown):
{{
  "ticker": "AAPL",
  "rule_type": "price_drop",
  "threshold": 0.03,
  "description": "{text}"
}}

If the rule can't be parsed, return: {{"error": "cannot parse"}}"""

    try:
        resp = client.messages.create(
            model=MODEL_FAST, max_tokens=150,
            messages=[{"role": "user", "content": prompt}]
        )
        text_out = resp.content[0].text.strip().replace("```json", "").replace("```", "")
        data = json.loads(text_out)
        if "error" in data:
            return None
        return data
    except Exception as e:
        log.warning(f"parse_rule: {e}")
        return None


def register_custom_rule(text: str) -> str:
    """Parse and save a new custom alert rule. Returns confirmation message."""
    rule = parse_rule_from_text(text)
    if not rule:
        return (
            "I couldn't parse that rule. Try something like:\n"
            "• \"Alert when NVDA drops 5%\"\n"
            "• \"Alert when META goes above $600\"\n"
            "• \"Alert when AAPL RSI drops below 30\""
        )

    ticker    = rule.get("ticker", "").upper()
    rule_type = rule.get("rule_type", "")
    threshold = rule.get("threshold")
    desc      = rule.get("description", text)

    if not ticker or not rule_type:
        return "Couldn't identify the ticker or rule type. Please try again."

    params = json.dumps({"threshold": threshold})
    add_custom_rule(
        description=desc,
        ticker=ticker,
        rule_type=rule_type,
        parameters=params,
    )

    type_human = {
        "price_drop":     f"drops >{threshold*100:.1f}% in a day",
        "price_rise":     f"rises >{threshold*100:.1f}% in a day",
        "price_below":    f"goes below ${threshold}",
        "price_above":    f"goes above ${threshold}",
        "rsi_oversold":   f"RSI drops below {threshold}",
        "rsi_overbought": f"RSI rises above {threshold}",
    }.get(rule_type, str(threshold))

    return f"✅ Rule created: Alert when {ticker} {type_human}"


def _evaluate_rule(rule: dict, quotes: dict) -> bool:
    """Check if a rule is triggered by current quote data."""
    ticker    = rule.get("ticker", "").upper()
    rule_type = rule.get("rule_type", "")
    params_raw = rule.get("parameters", "{}")

    try:
        params = json.loads(params_raw) if isinstance(params_raw, str) else params_raw
    except Exception:
        params = {}

    threshold = params.get("threshold")
    if threshold is None:
        return False

    q = quotes.get(ticker, {})
    if not q:
        return False

    price = q.get("price", 0) or 0
    chg   = q.get("change_pct", 0) or 0

    if rule_type == "price_drop":
        return chg <= -abs(threshold)
    elif rule_type == "price_rise":
        return chg >= abs(threshold)
    elif rule_type == "price_below":
        return price <= threshold
    elif rule_type == "price_above":
        return price >= threshold
    elif rule_type == "rsi_oversold":
        from db.queries import get_technical_signal
        sig = get_technical_signal(ticker)
        if sig:
            rsi = sig.get("rsi", 50) or 50
            return rsi <= threshold
    elif rule_type == "rsi_overbought":
        from db.queries import get_technical_signal
        sig = get_technical_signal(ticker)
        if sig:
            rsi = sig.get("rsi", 50) or 50
            return rsi >= threshold

    return False


def _format_alert(rule: dict, quotes: dict) -> str:
    """Format the alert message for a triggered rule."""
    ticker = rule.get("ticker", "").upper()
    desc   = rule.get("description", f"Custom rule for {ticker}")
    q      = quotes.get(ticker, {})
    price  = q.get("price", 0) or 0
    chg    = q.get("change_pct", 0) or 0

    return (
        f"🔔 CUSTOM ALERT\n\n"
        f"{desc}\n\n"
        f"{ticker}: ${price:.2f}  ({chg*100:+.2f}%)"
    )


async def check_custom_rules(send_fn) -> None:
    """Evaluate all active custom rules against live prices."""
    rules = get_active_rules()
    if not rules:
        return

    # Get unique tickers
    tickers = list({r.get("ticker", "").upper() for r in rules if r.get("ticker")})
    if not tickers:
        return

    quotes = get_quotes_batch(tickers)

    for rule in rules:
        try:
            if _evaluate_rule(rule, quotes):
                msg = _format_alert(rule, quotes)
                await send_fn(msg)
                rule_id = rule.get("id")
                if rule_id:
                    mark_rule_fired(rule_id)
                log.info(f"Custom rule fired: {rule.get('description')}")
        except Exception as e:
            log.warning(f"custom_rules check: {e}")
