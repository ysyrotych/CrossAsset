"""
Cross-Asset Correlation Engine — Loop 18
Alerts when rates, DXY, VIX, or oil cross key thresholds with portfolio impact estimates.
"""
import logging
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL_FAST, WATCHLIST
from data.macro import get_macro_snapshot
from data.prices import get_market_snapshot
from db.queries import already_alerted, make_hash
from agents.chief_of_staff import try_send_alert

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)

# Historical sensitivities: portfolio % move per unit of cross-asset move
# Calibrated for a growth-heavy tech portfolio (META, GOOGL, NVDA, etc.)
SENSITIVITIES = {
    "t10y_bp":  -0.065,   # -6.5% portfolio per 100bp rise in 10Y
    "dxy_pct":  -0.004,   # -0.4% portfolio per 1% DXY rise
    "vix_point": -0.008,  # -0.8% portfolio per 1-point VIX spike
    "oil_pct":  -0.001,   # -0.1% portfolio per 1% oil rise (small effect on tech)
}

THRESHOLDS_CROSS = {
    "t10y_bp_daily":  12,    # Alert if 10Y moves >12bp in a day
    "dxy_pct_daily":  0.008, # Alert if DXY moves >0.8% in a day
    "vix_spike":      3.0,   # Alert if VIX rises >3 points
    "oil_pct_daily":  0.03,  # Alert if oil moves >3%
}


def check_cross_asset(send_fn) -> int:
    """Check cross-asset signals and send alerts. Returns count of alerts sent."""
    macro   = get_macro_snapshot()
    market  = get_market_snapshot()
    alerts  = 0

    total_value = sum(
        info.get("shares", 0) * (market.get(t, {}).get("price") or 0)
        for t, info in WATCHLIST.items()
    )
    if total_value < 1000:
        total_value = 50_000

    def _check(key: str, label: str, value: float | None, change: float | None,
                threshold: float, unit: str, sensitivity: float):
        nonlocal alerts
        if value is None or change is None or abs(change) < threshold:
            return

        portfolio_impact = total_value * sensitivity * change
        content_hash = make_hash("CROSS_ASSET", key, str(round(change, 3)))
        if already_alerted("CROSS_ASSET", key, content_hash):
            return

        direction = "UP" if change > 0 else "DOWN"
        impact_str = f"${abs(portfolio_impact):,.0f}"
        arrow = "▲" if change > 0 else "▼"
        port_arrow = "▲" if portfolio_impact > 0 else "▼"

        msg = f"""📊 CROSS-ASSET ALERT

{label}: {arrow}{abs(change):.2f}{unit} today
Current level: {value:.2f}

Portfolio impact estimate: {port_arrow}{impact_str}
(Based on historical correlation: {sensitivity*100:+.1f}% per {unit})

Most affected positions: {'NVDA, DUOL, NBIS' if key == 't10y' else 'META, GOOGL, AMZN' if key == 'dxy' else 'All growth positions'}
Defensive: {'CMG, VOO' if key != 'oil' else 'All positions — oil is indirect for this portfolio'}"""

        try_send_alert("CROSS_ASSET", key, content_hash, "WATCH", msg, send_fn)
        alerts += 1

    # 10Y Treasury
    t10y = macro.get("t10y", {})
    t10y_val = t10y.get("value")
    t10y_chg = t10y.get("change")
    if t10y_val and t10y_chg:
        bp_change = t10y_chg * 100
        _check("t10y", "10Y Treasury Yield", t10y_val, bp_change,
               THRESHOLDS_CROSS["t10y_bp_daily"], "bp", SENSITIVITIES["t10y_bp"] / 100)

    # DXY
    dxy = market.get("DXY", {})
    dxy_chg = dxy.get("change_pct")
    dxy_val = dxy.get("price")
    if dxy_val and dxy_chg:
        _check("dxy", "US Dollar Index (DXY)", dxy_val, dxy_chg,
               THRESHOLDS_CROSS["dxy_pct_daily"], "%", SENSITIVITIES["dxy_pct"])

    # VIX
    vix = macro.get("vix", {})
    vix_val = vix.get("value")
    vix_chg = vix.get("change")
    if vix_val and vix_chg and vix_chg >= THRESHOLDS_CROSS["vix_spike"]:
        content_hash = make_hash("CROSS_ASSET", "vix", str(round(vix_val, 1)))
        if not already_alerted("CROSS_ASSET", "vix", content_hash):
            portfolio_impact = total_value * SENSITIVITIES["vix_point"] * vix_chg
            msg = f"""⚠️ VIX SPIKE ALERT

VIX: {vix_val:.1f} (+{vix_chg:.1f} points today)
Fear gauge rising — expect elevated volatility

Portfolio impact estimate: ${abs(portfolio_impact):,.0f} (downside)
Action: Watch for forced deleveraging. Growth stocks most vulnerable.
VIX >25 = sustained volatility. VIX >35 = systemic stress."""
            try_send_alert("CROSS_ASSET", "vix", content_hash, "WATCH", msg, send_fn)
            alerts += 1

    # Oil
    oil = market.get("OIL", {})
    oil_chg = oil.get("change_pct")
    oil_val = oil.get("price")
    if oil_val and oil_chg:
        _check("oil", "WTI Crude Oil", oil_val, oil_chg,
               THRESHOLDS_CROSS["oil_pct_daily"], "%", SENSITIVITIES["oil_pct"])

    return alerts
