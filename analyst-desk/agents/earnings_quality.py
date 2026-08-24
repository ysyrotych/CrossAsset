"""
Earnings Quality Scoring — Loop 5
Scores reported earnings on 5 institutional dimensions.
Cuts through EPS beats to tell you if the earnings are real.
"""
import logging
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL_DEEP, WATCHLIST
from data.fmp import get_key_metrics, get_income_statement, get_cash_flow_statement

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)


def score_earnings_quality(ticker: str, quarter_metrics: dict = None) -> dict:
    """
    Score the most recent earnings on 5 quality dimensions.
    Returns a quality dict with scores and verdict.
    """
    metrics = quarter_metrics or get_key_metrics(ticker)
    income  = get_income_statement(ticker, limit=2)
    cfs     = get_cash_flow_statement(ticker, limit=2)

    if not income or not cfs:
        return {"score": None, "verdict": "DATA_UNAVAILABLE"}

    latest_income = income[0] if income else {}
    latest_cfs    = cfs[0] if cfs else {}
    prior_income  = income[1] if len(income) > 1 else {}

    scores = {}
    details = {}

    # 1. Cash Conversion (FCF / Net Income)
    net_income = latest_income.get("netIncome", 0) or 0
    fcf        = latest_cfs.get("freeCashFlow", 0) or 0
    if net_income and net_income != 0:
        cc_ratio = fcf / net_income
        score_cc = 10 if cc_ratio > 1.2 else 8 if cc_ratio > 0.8 else 5 if cc_ratio > 0.5 else 2
        scores["cash_conversion"] = score_cc
        details["cash_conversion"] = f"FCF/NI: {cc_ratio:.2f} ({'strong' if cc_ratio > 0.8 else 'weak'})"
    else:
        scores["cash_conversion"] = 5
        details["cash_conversion"] = "N/A"

    # 2. SBC Dilution (SBC / Revenue)
    revenue = latest_income.get("revenue", 0) or 0
    sbc     = latest_cfs.get("stockBasedCompensation", 0) or 0
    if revenue and revenue > 0:
        sbc_pct = sbc / revenue
        score_sbc = 10 if sbc_pct < 0.05 else 8 if sbc_pct < 0.10 else 6 if sbc_pct < 0.15 else 3 if sbc_pct < 0.25 else 1
        scores["sbc_dilution"] = score_sbc
        details["sbc_dilution"] = f"SBC: {sbc_pct*100:.1f}% of revenue"
    else:
        scores["sbc_dilution"] = 5
        details["sbc_dilution"] = "N/A"

    # 3. Revenue Quality (AR growth vs revenue growth)
    prior_rev = prior_income.get("revenue", revenue) or revenue
    prior_ar  = prior_income.get("netReceivables", 0) or 0
    current_ar = latest_income.get("netReceivables", 0) or 0
    if prior_rev and prior_rev > 0 and prior_ar and prior_ar > 0:
        rev_growth = (revenue - prior_rev) / abs(prior_rev)
        ar_growth  = (current_ar - prior_ar) / abs(prior_ar)
        ar_diff    = ar_growth - rev_growth
        score_ar = 10 if ar_diff < -0.02 else 8 if ar_diff < 0.05 else 5 if ar_diff < 0.15 else 2
        scores["revenue_quality"] = score_ar
        details["revenue_quality"] = f"AR growth {ar_growth*100:.1f}% vs Rev growth {rev_growth*100:.1f}%"
    else:
        scores["revenue_quality"] = 7
        details["revenue_quality"] = "N/A"

    # 4. Accruals Ratio (lower = better quality)
    total_assets = latest_income.get("totalAssets", 0) or 0
    if total_assets > 0:
        accruals = (net_income - fcf) / total_assets
        score_acc = 10 if accruals < -0.05 else 8 if accruals < 0 else 5 if accruals < 0.05 else 2
        scores["accruals"] = score_acc
        details["accruals"] = f"Accruals ratio: {accruals:.3f} ({'conservative' if accruals < 0 else 'aggressive'})"
    else:
        scores["accruals"] = 7
        details["accruals"] = "N/A"

    # 5. Operating Leverage (margin expansion)
    op_income      = latest_income.get("operatingIncome", 0) or 0
    prior_op       = prior_income.get("operatingIncome", 0) or 0
    op_margin      = op_income / revenue if revenue else None
    prior_margin   = prior_op / prior_rev if prior_rev else None
    if op_margin is not None and prior_margin is not None:
        margin_chg = op_margin - prior_margin
        score_lev = 10 if margin_chg > 0.03 else 8 if margin_chg > 0.01 else 6 if margin_chg > -0.01 else 3
        scores["op_leverage"] = score_lev
        details["op_leverage"] = f"Op margin: {op_margin*100:.1f}% ({'+' if margin_chg >= 0 else ''}{margin_chg*100:.1f}bp vs prior)"
    else:
        scores["op_leverage"] = 7
        details["op_leverage"] = "N/A"

    # Overall
    valid_scores = [v for v in scores.values() if v is not None]
    overall = sum(valid_scores) / len(valid_scores) if valid_scores else 5

    if overall >= 8.5:
        verdict = "EXCEPTIONAL"
    elif overall >= 7.0:
        verdict = "HIGH QUALITY"
    elif overall >= 5.5:
        verdict = "MIXED"
    elif overall >= 4.0:
        verdict = "LOW QUALITY"
    else:
        verdict = "RED FLAGS"

    return {
        "ticker": ticker,
        "score": round(overall, 1),
        "verdict": verdict,
        "scores": scores,
        "details": details,
    }


def format_quality_report(ticker: str, eps_actual: float = None, eps_estimate: float = None) -> str:
    """Generate a formatted earnings quality report."""
    q = score_earnings_quality(ticker)

    if q["score"] is None:
        return f"📊 EARNINGS QUALITY · {ticker}\nInsufficient data for quality scoring."

    icon_map = {10:"✅", 9:"✅", 8:"✅", 7:"🟡", 6:"🟡", 5:"🟡", 4:"⚠️", 3:"⚠️", 2:"❌", 1:"❌"}

    beat_str = ""
    if eps_actual is not None and eps_estimate is not None:
        diff = eps_actual - eps_estimate
        beat_str = f"\nEPS: ${eps_actual:.2f} vs ${eps_estimate:.2f} est ({'+' if diff >= 0 else ''}{diff/eps_estimate*100:.1f}%) {'✅ BEAT' if diff > 0 else '❌ MISS'}"

    lines = [f"📊 EARNINGS QUALITY · {ticker}",
             f"Quality Score: {q['score']}/10 — {q['verdict']}{beat_str}\n"]

    score_labels = {
        "cash_conversion": "Cash Conversion",
        "sbc_dilution":    "SBC Dilution",
        "revenue_quality": "Revenue Quality",
        "accruals":        "Accruals",
        "op_leverage":     "Operating Leverage",
    }
    for key, label in score_labels.items():
        s = q["scores"].get(key)
        d = q["details"].get(key, "N/A")
        if s:
            icon = icon_map.get(s, "🟡")
            lines.append(f"{icon} {label}: {d}")

    verdict_commentary = {
        "EXCEPTIONAL":  "Real earnings, not accounting tricks. High confidence in quality.",
        "HIGH QUALITY": "Solid underlying earnings. The beat is sustainable.",
        "MIXED":        "Some quality concerns. Monitor cash flow vs reported earnings.",
        "LOW QUALITY":  "Earnings quality is weak. FCF may not support the EPS number.",
        "RED FLAGS":    "Serious concerns about earnings quality. Investigate before acting.",
    }
    lines.append(f"\nVerdict: {verdict_commentary.get(q['verdict'], '')}")
    return "\n".join(lines)
