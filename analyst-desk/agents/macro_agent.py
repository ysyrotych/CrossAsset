"""
Macro Agent — monitors FRED macro data and maps significant changes
to portfolio impact for specific holdings.
"""
import logging
from anthropic import Anthropic
from data.macro import get_macro_snapshot, get_economic_calendar, format_macro_brief
from agents.chief_of_staff import try_send_alert
from db.queries import make_hash, already_alerted
from config import WATCHLIST, ANTHROPIC_API_KEY, MODEL_FAST, MODEL_DEEP

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)

# Macro sensitivity map — which sectors/tickers care about which macro vars
MACRO_SENSITIVITY = {
    "rates":     ["JPM", "BRK-B", "GLD"],         # Rate-sensitive
    "dollar":    ["AAPL", "MSFT", "GOOGL", "META"],# USD strength hurts multinationals
    "credit":    ["JPM", "BRK-B"],                 # Credit spread watchers
    "vix":       list(WATCHLIST.keys()),           # VIX spike affects everyone
    "inflation": ["GLD", "JPM"],                   # Inflation hedge / NIM impact
}

MACRO_THRESHOLDS = {
    "t10y_move_bp":   15,    # 15bps move in 10Y → alert
    "vix_spike":      25,    # VIX > 25 → WATCH
    "vix_spike_urg":  35,    # VIX > 35 → URGENT
    "hy_spread_bp":   50,    # HY spread move > 50bp → WATCH
}


def check_macro_signals(send_fn) -> list[str]:
    """
    Check macro snapshot for significant moves and alert if material.
    """
    snapshot = get_macro_snapshot()
    messages_sent = []

    # Check VIX spike
    vix = snapshot.get("vix", {})
    vix_val = vix.get("value")
    if vix_val:
        if vix_val >= MACRO_THRESHOLDS["vix_spike_urg"]:
            severity = "URGENT"
            chash = make_hash("MACRO", "vix_spike_urgent", f"{vix_val:.0f}")
            if not already_alerted("MACRO", "vix_spike_urgent", chash):
                msg = _compose_macro_alert("VIX SPIKE", snapshot, severity,
                    f"VIX at {vix_val:.1f} — extreme fear level. Risk-off regime probable.")
                try_send_alert("MACRO", "vix_spike_urgent", chash, severity, msg, send_fn)
                messages_sent.append(msg)

        elif vix_val >= MACRO_THRESHOLDS["vix_spike"]:
            severity = "WATCH"
            chash = make_hash("MACRO", "vix_elevated", f"{vix_val:.0f}")
            if not already_alerted("MACRO", "vix_elevated", chash):
                msg = _compose_macro_alert("VIX ELEVATED", snapshot, severity,
                    f"VIX at {vix_val:.1f} — elevated uncertainty. Monitor positioning.")
                try_send_alert("MACRO", "vix_elevated", chash, severity, msg, send_fn)
                messages_sent.append(msg)

    # Check 10Y rate move
    t10y = snapshot.get("t10y", {})
    t10y_chg = t10y.get("change")
    if t10y_chg and abs(t10y_chg * 100) >= MACRO_THRESHOLDS["t10y_move_bp"]:
        direction = "RISING RATES" if t10y_chg > 0 else "FALLING RATES"
        severity = "WATCH"
        chash = make_hash("MACRO", "t10y_move", f"{t10y_chg:.4f}")
        if not already_alerted("MACRO", "t10y_move", chash):
            msg = _compose_macro_alert(direction, snapshot, severity,
                f"10Y Treasury moved {t10y_chg*100:+.1f}bp to {t10y.get('value',0):.2f}%")
            try_send_alert("MACRO", "t10y_move", chash, severity, msg, send_fn)
            messages_sent.append(msg)

    return messages_sent


def _compose_macro_alert(event: str, snapshot: dict, severity: str, note: str) -> str:
    """Compose a macro alert with portfolio impact mapping."""
    macro_str = format_macro_brief(snapshot)
    icon = {"URGENT": "🔴", "WATCH": "🟡", "POSITIVE": "🟢"}.get(severity, "📊")

    prompt = f"""You are a macro analyst at a hedge fund. Write a brief macro alert.

Event: {event}
Macro snapshot: {macro_str}
Note: {note}

Portfolio holdings: {list(WATCHLIST.keys())}
Portfolio macro sensitivities: {MACRO_SENSITIVITY}

Write a 150-word max alert covering:
1. WHAT: the macro event
2. PORTFOLIO IMPACT: which specific holdings are most affected and how
3. WATCH: what to monitor

Start with: {icon} {severity} · MACRO · {event}"""

    try:
        resp = client.messages.create(
            model=MODEL_FAST, max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        return resp.content[0].text.strip()
    except Exception as e:
        log.warning(f"Macro alert compose: {e}")
        return f"{icon} {severity} · MACRO · {event}\n\n{note}\n\n{macro_str}"
