"""
SEC Analysis Microservice — powered by edgartools
FastAPI service that exposes 10-K / 10-Q data to the CrossAsset Next.js app.
"""

import asyncio
import html as html_module
import re
import httpx
from datetime import datetime, date
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="CrossAsset SEC Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── edgartools imports ────────────────────────────────────────────────────────

try:
    from edgar import Company, set_identity
    set_identity("CrossAsset Research crossasset@research.com")
    EDGAR_AVAILABLE = True
except ImportError:
    EDGAR_AVAILABLE = False

# ── yfinance imports ──────────────────────────────────────────────────────────

try:
    import yfinance as yf
    import numpy as _np
    YF_AVAILABLE = True
except ImportError:
    YF_AVAILABLE = False

# ── FMP (Financial Modeling Prep) ─────────────────────────────────────────────

import os as _os
FMP_API_KEY = _os.environ.get("FMP_API_KEY", "").strip()
FMP_BASE    = "https://financialmodelingprep.com/api/v3"

def get_fmp_financials(ticker: str) -> dict:
    """
    Fetch full financial statements from Financial Modeling Prep.
    Returns {} if FMP_API_KEY not set or request fails.
    Field names follow FMP's camelCase convention — mapped below.
    """
    if not FMP_API_KEY:
        return {}
    try:
        def fetch(path: str) -> list:
            url = f"{FMP_BASE}/{path}?limit=6&apikey={FMP_API_KEY}"
            r = httpx.get(url, timeout=20, headers={"User-Agent": "CrossAsset/1.0"})
            if r.status_code != 200:
                print(f"FMP {path}: HTTP {r.status_code}")
                return []
            data = r.json()
            return data if isinstance(data, list) else []

        inc_a  = fetch(f"income-statement/{ticker}")
        bal_a  = fetch(f"balance-sheet-statement/{ticker}")
        cf_a   = fetch(f"cash-flow-statement/{ticker}")
        inc_q  = fetch(f"income-statement/{ticker}?period=quarter")
        bal_q  = fetch(f"balance-sheet-statement/{ticker}?period=quarter")
        cf_q   = fetch(f"cash-flow-statement/{ticker}?period=quarter")

        if not inc_a:
            print(f"FMP: no income statement for {ticker}")
            return {}

        print(f"FMP: {len(inc_a)} annual + {len(inc_q)} quarterly periods for {ticker}")
        return {
            "income_annual":   inc_a,
            "balance_annual":  bal_a,
            "cashflow_annual": cf_a,
            "income_quarterly":   inc_q,
            "balance_quarterly":  bal_q,
            "cashflow_quarterly": cf_q,
        }
    except Exception as e:
        print(f"FMP error for {ticker}: {e}")
        return {}

def _fmp_val(period: dict, *keys: str) -> Optional[float]:
    for k in keys:
        v = period.get(k)
        if v is not None and v != 0:
            return float(v)
    return None

def _fmp_series(periods: list, field: str, abs_val: bool = False) -> dict:
    """Build {date: value} dict from a list of FMP period objects, sorted ascending."""
    result: dict = {}
    for p in periods:
        dt = p.get("date", "")[:10]
        if not dt:
            continue
        v = p.get(field)
        if v is None:
            continue
        try:
            fv = float(v)
            result[dt] = abs(fv) if abs_val else fv
        except (ValueError, TypeError):
            continue
    return result  # already sorted asc by FMP (newest first), we reverse below

def build_from_fmp(fmp: dict) -> tuple[dict, dict, dict, dict, str, dict, str]:
    """
    Returns: (facts, history, qfacts, prior_q_facts, q_period, info, prior_q_period)
    """
    inc_a  = fmp.get("income_annual",   [])
    bal_a  = fmp.get("balance_annual",  [])
    cf_a   = fmp.get("cashflow_annual", [])
    inc_q  = fmp.get("income_quarterly",   [])
    bal_q  = fmp.get("balance_quarterly",  [])
    cf_q   = fmp.get("cashflow_quarterly", [])

    # Most recent annual period (index 0 = most recent in FMP)
    ia = inc_a[0] if inc_a else {}
    ba = bal_a[0] if bal_a else {}
    ca = cf_a[0]  if cf_a  else {}

    # ── Most-recent-annual facts ──────────────────────────────────────────────
    facts: dict = {}

    rev = _fmp_val(ia, "revenue")
    if rev: facts["revenue"] = rev
    cogs = _fmp_val(ia, "costOfRevenue")
    if cogs: facts["cost_of_revenue"] = cogs
    gp = _fmp_val(ia, "grossProfit")
    if gp: facts["gross_profit"] = gp
    rd = _fmp_val(ia, "researchAndDevelopmentExpenses")
    if rd: facts["rd_expense"] = rd
    sga = _fmp_val(ia, "sellingGeneralAndAdministrativeExpenses")
    if sga: facts["sga_expense"] = sga
    oi = _fmp_val(ia, "operatingIncome")
    if oi: facts["operating_income"] = oi
    ebitda = _fmp_val(ia, "ebitda")
    if ebitda: facts["ebitda"] = ebitda
    da = _fmp_val(ia, "depreciationAndAmortization")
    if da: facts["da_expense"] = da
    int_exp = _fmp_val(ia, "interestExpense")
    if int_exp: facts["interest_expense"] = abs(int_exp)
    pretax = _fmp_val(ia, "incomeBeforeTax")
    if pretax: facts["pretax_income"] = pretax
    tax = _fmp_val(ia, "incomeTaxExpense")
    if tax: facts["income_tax"] = abs(tax)
    ni = _fmp_val(ia, "netIncome")
    if ni: facts["net_income"] = ni
    eps_d = _fmp_val(ia, "epsDiluted")
    if eps_d: facts["eps_diluted"] = eps_d
    eps_b = _fmp_val(ia, "eps")
    if eps_b: facts["eps_basic"] = eps_b
    sh_d = _fmp_val(ia, "weightedAverageShsOutDil")
    if sh_d: facts["shares_diluted_wtd"] = sh_d
    sh_b = _fmp_val(ia, "weightedAverageShsOut")
    if sh_b: facts["shares_basic_wtd"] = sh_b

    # Balance sheet
    cash = _fmp_val(ba, "cashAndCashEquivalents")
    if cash: facts["cash"] = cash
    sti = _fmp_val(ba, "shortTermInvestments")
    if sti: facts["short_term_investments"] = sti
    ar = _fmp_val(ba, "netReceivables")
    if ar: facts["accounts_receivable"] = ar
    inv = _fmp_val(ba, "inventory")
    if inv and inv != 0: facts["inventory"] = inv
    curr_a = _fmp_val(ba, "totalCurrentAssets")
    if curr_a: facts["current_assets"] = curr_a
    ppe = _fmp_val(ba, "propertyPlantEquipmentNet")
    if ppe: facts["ppe_net"] = ppe
    goodwill = _fmp_val(ba, "goodwill")
    if goodwill: facts["goodwill"] = goodwill
    intang = _fmp_val(ba, "intangibleAssets")
    if intang: facts["intangibles"] = intang
    total_a = _fmp_val(ba, "totalAssets")
    if total_a: facts["total_assets"] = total_a
    ap = _fmp_val(ba, "accountPayables")
    if ap: facts["accounts_payable"] = ap
    curr_l = _fmp_val(ba, "totalCurrentLiabilities")
    if curr_l: facts["current_liabilities"] = curr_l
    ltd = _fmp_val(ba, "longTermDebt")
    if ltd: facts["long_term_debt"] = ltd
    total_l = _fmp_val(ba, "totalLiabilities")
    if total_l: facts["total_liabilities"] = total_l
    re_ = _fmp_val(ba, "retainedEarnings")
    if re_: facts["retained_earnings"] = re_
    eq = _fmp_val(ba, "totalStockholdersEquity")
    if eq: facts["equity"] = eq

    # Cash flow
    ocf = _fmp_val(ca, "operatingCashFlow")
    if ocf: facts["operating_cf"] = ocf
    capex = _fmp_val(ca, "capitalExpenditure")
    if capex: facts["capex"] = capex  # FMP already negative
    fcf = _fmp_val(ca, "freeCashFlow")
    if fcf: facts["free_cash_flow"] = fcf
    sbc = _fmp_val(ca, "stockBasedCompensation")
    if sbc: facts["sbc_expense"] = sbc
    buybacks = _fmp_val(ca, "commonStockRepurchased")
    if buybacks: facts["buybacks"] = abs(buybacks)
    divs = _fmp_val(ca, "dividendsPaid")
    if divs: facts["dividends_paid"] = divs
    inv_cf = _fmp_val(ca, "investingCashFlow")
    if inv_cf: facts["investing_cf"] = inv_cf
    fin_cf = _fmp_val(ca, "financingCashFlow")
    if fin_cf: facts["financing_cf"] = fin_cf

    # Derived margins
    rev2 = facts.get("revenue"); gp2 = facts.get("gross_profit")
    oi2  = facts.get("operating_income"); ni2 = facts.get("net_income")
    ocf2 = facts.get("operating_cf"); cap2 = facts.get("capex")
    tax2 = facts.get("income_tax"); pretax2 = facts.get("pretax_income")
    if rev2 and gp2:  facts["gross_margin_pct"]     = round(gp2 / rev2 * 100, 1)
    if rev2 and oi2:  facts["operating_margin_pct"] = round(oi2 / rev2 * 100, 1)
    if rev2 and ni2:  facts["net_margin_pct"]        = round(ni2 / rev2 * 100, 1)
    if ocf2 and cap2: facts["free_cash_flow"] = facts.get("free_cash_flow") or (ocf2 + cap2)
    if oi2 and da:    facts["ebitda"] = facts.get("ebitda") or (oi2 + da)
    if pretax2 and tax2 and pretax2 != 0:
        facts["effective_tax_rate"] = round(abs(tax2) / abs(pretax2) * 100, 1)

    # ── Multi-year history ────────────────────────────────────────────────────
    history: dict = {}

    def hs(field, periods, abs_val=False):
        s = _fmp_series(periods, field, abs_val)
        if s:
            history[field] = dict(sorted(s.items()))  # sort ascending by date

    # Income history
    hs("revenue",          inc_a, False)
    hs("cost_of_revenue",  inc_a, False)
    hs("gross_profit",     inc_a, False)
    hs("rd_expense",       [dict(**p, rd_expense=p.get("researchAndDevelopmentExpenses")) for p in inc_a], False)
    # Use raw field names directly for income
    for p in inc_a:
        p.setdefault("rd_expense", p.get("researchAndDevelopmentExpenses"))
        p.setdefault("sga_expense", p.get("sellingGeneralAndAdministrativeExpenses"))
        p.setdefault("operating_income", p.get("operatingIncome"))
        p.setdefault("ebitda", p.get("ebitda"))
        p.setdefault("da_expense", p.get("depreciationAndAmortization"))
        p.setdefault("interest_expense", abs(p.get("interestExpense") or 0) or None)
        p.setdefault("pretax_income", p.get("incomeBeforeTax"))
        p.setdefault("income_tax", abs(p.get("incomeTaxExpense") or 0) or None)
        p.setdefault("net_income", p.get("netIncome"))
        p.setdefault("eps_diluted", p.get("epsDiluted"))
        p.setdefault("eps_basic", p.get("eps"))
        p.setdefault("shares_diluted_wtd", p.get("weightedAverageShsOutDil"))
        p.setdefault("shares_basic_wtd", p.get("weightedAverageShsOut"))

    for key in ["revenue","cost_of_revenue","gross_profit","rd_expense","sga_expense",
                "operating_income","ebitda","da_expense","interest_expense","pretax_income",
                "income_tax","net_income","eps_diluted","eps_basic","shares_diluted_wtd","shares_basic_wtd"]:
        hs(key, inc_a, key in ("interest_expense", "income_tax"))

    # Cash flow history
    for p in cf_a:
        p.setdefault("operating_cf",   p.get("operatingCashFlow"))
        p.setdefault("capex",          p.get("capitalExpenditure"))
        p.setdefault("free_cash_flow", p.get("freeCashFlow"))
        p.setdefault("sbc_expense",    p.get("stockBasedCompensation"))
        p.setdefault("da_expense",     p.get("depreciationAndAmortization"))
        p.setdefault("buybacks",       p.get("commonStockRepurchased"))
        p.setdefault("dividends_paid", p.get("dividendsPaid"))
        p.setdefault("investing_cf",   p.get("investingCashFlow"))
        p.setdefault("financing_cf",   p.get("financingCashFlow"))

    for key in ["operating_cf","capex","free_cash_flow","sbc_expense","da_expense",
                "buybacks","investing_cf","financing_cf"]:
        hs(key, cf_a, key in ("buybacks",))

    # Balance sheet history (newest 5)
    for p in bal_a:
        p.setdefault("total_assets",        p.get("totalAssets"))
        p.setdefault("cash",                p.get("cashAndCashEquivalents"))
        p.setdefault("equity",              p.get("totalStockholdersEquity"))
        p.setdefault("total_liabilities",   p.get("totalLiabilities"))
        p.setdefault("long_term_debt",      p.get("longTermDebt"))
        p.setdefault("current_assets",      p.get("totalCurrentAssets"))
        p.setdefault("current_liabilities", p.get("totalCurrentLiabilities"))
        p.setdefault("accounts_receivable", p.get("netReceivables"))
        p.setdefault("accounts_payable",    p.get("accountPayables"))
        p.setdefault("inventory",           p.get("inventory"))
        p.setdefault("ppe_net",             p.get("propertyPlantEquipmentNet"))
        p.setdefault("goodwill",            p.get("goodwill"))
        p.setdefault("retained_earnings",   p.get("retainedEarnings"))

    for key in ["total_assets","cash","equity","total_liabilities","long_term_debt",
                "current_assets","current_liabilities","accounts_receivable","accounts_payable",
                "inventory","ppe_net","goodwill","retained_earnings"]:
        hs(key, bal_a)

    # ── Most recent quarter ───────────────────────────────────────────────────
    qfacts: dict = {}
    if inc_q:
        iq = inc_q[0]; bq = bal_q[0] if bal_q else {}; cq = cf_q[0] if cf_q else {}
        q_period = iq.get("date", "")[:10]
        for field, src, src_key in [
            ("revenue",          iq, "revenue"),
            ("cost_of_revenue",  iq, "costOfRevenue"),
            ("gross_profit",     iq, "grossProfit"),
            ("rd_expense",       iq, "researchAndDevelopmentExpenses"),
            ("sga_expense",      iq, "sellingGeneralAndAdministrativeExpenses"),
            ("operating_income", iq, "operatingIncome"),
            ("net_income",       iq, "netIncome"),
            ("eps_diluted",      iq, "epsDiluted"),
            ("operating_cf",     cq, "operatingCashFlow"),
            ("capex",            cq, "capitalExpenditure"),
            ("free_cash_flow",   cq, "freeCashFlow"),
            ("cash",             bq, "cashAndCashEquivalents"),
            ("total_assets",     bq, "totalAssets"),
            ("equity",           bq, "totalStockholdersEquity"),
            ("current_liabilities", bq, "totalCurrentLiabilities"),
        ]:
            v = src.get(src_key)
            if v is not None:
                qfacts[field] = float(v)
        q_rev = qfacts.get("revenue"); q_gp = qfacts.get("gross_profit")
        q_oi  = qfacts.get("operating_income"); q_ni = qfacts.get("net_income")
        q_ocf = qfacts.get("operating_cf"); q_cap = qfacts.get("capex")
        if q_rev and q_gp:  qfacts["gross_margin_pct"]     = round(q_gp / q_rev * 100, 1)
        if q_rev and q_oi:  qfacts["operating_margin_pct"] = round(q_oi / q_rev * 100, 1)
        if q_rev and q_ni:  qfacts["net_margin_pct"]        = round(q_ni / q_rev * 100, 1)
        if q_ocf and q_cap: qfacts["free_cash_flow"] = qfacts.get("free_cash_flow") or (q_ocf + q_cap)
    else:
        q_period = ""

    # Prior quarter
    pqfacts: dict = {}
    prior_q_period = ""
    if len(inc_q) >= 2:
        iq2 = inc_q[1]; cq2 = cf_q[1] if len(cf_q) >= 2 else {}
        prior_q_period = iq2.get("date", "")[:10]
        for field, src, src_key in [
            ("revenue",          iq2, "revenue"),
            ("gross_profit",     iq2, "grossProfit"),
            ("operating_income", iq2, "operatingIncome"),
            ("net_income",       iq2, "netIncome"),
            ("eps_diluted",      iq2, "epsDiluted"),
            ("operating_cf",     cq2, "operatingCashFlow"),
            ("free_cash_flow",   cq2, "freeCashFlow"),
        ]:
            v = src.get(src_key)
            if v is not None:
                pqfacts[field] = float(v)
        pq_rev = pqfacts.get("revenue"); pq_gp = pqfacts.get("gross_profit")
        pq_oi  = pqfacts.get("operating_income"); pq_ni = pqfacts.get("net_income")
        if pq_rev and pq_gp:  pqfacts["gross_margin_pct"]     = round(pq_gp / pq_rev * 100, 1)
        if pq_rev and pq_oi:  pqfacts["operating_margin_pct"] = round(pq_oi / pq_rev * 100, 1)
        if pq_rev and pq_ni:  pqfacts["net_margin_pct"]        = round(pq_ni / pq_rev * 100, 1)

    return facts, history, qfacts, pqfacts, q_period, {}, prior_q_period

# ── Helpers ───────────────────────────────────────────────────────────────────

def strip_html(text: str) -> str:
    """Remove HTML tags, decode entities, normalize whitespace."""
    text = re.sub(r'<style[^>]*>.*?</style>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<script[^>]*>.*?</script>', ' ', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</(p|div|li|tr|h[1-6])[^>]*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = html_module.unescape(text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

def truncate(text: str, max_chars: int = 60000) -> str:
    if not text:
        return ""
    text = strip_html(text)
    text = re.sub(r'\n{3,}', '\n\n', text.strip())
    return text[:max_chars] + ("\n\n[... truncated for length ...]" if len(text) > max_chars else "")

def safe_float(val) -> Optional[float]:
    try:
        return float(val) if val is not None else None
    except (TypeError, ValueError):
        return None

def _duration_days(e: dict) -> int:
    """Return number of days between 'start' and 'end' for a fact entry."""
    try:
        start = e.get("start")
        end   = e.get("end")
        if not start or not end:
            return 0
        s = datetime.strptime(start, "%Y-%m-%d")
        en = datetime.strptime(end, "%Y-%m-%d")
        return (en - s).days
    except Exception:
        return 0

def fetch_xbrl_from_sec_api(cik: str) -> dict:
    """
    Fetch financial facts from SEC EDGAR company facts API.
    Filters flow variables (income stmt, CF) to annual periods only (>=335 days)
    to avoid picking quarterly entries and computing wrong margins.
    """
    try:
        cik_padded = str(int(cik)).zfill(10)
        url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik_padded}.json"
        resp = httpx.get(url, headers={"User-Agent": "CrossAsset Research crossasset@research.com"}, timeout=30)
        if resp.status_code != 200:
            print(f"SEC facts API returned {resp.status_code} for CIK {cik}")
            return {}
        data = resp.json()
        us_gaap: dict = data.get("facts", {}).get("us-gaap", {})
        if not us_gaap:
            return {}

        def get_entries(concept: str):
            fact = us_gaap.get(concept)
            if not fact:
                return []
            units = fact.get("units", {})
            return units.get("USD") or units.get("shares") or (list(units.values())[0] if units else [])

        # Determine canonical fiscal-year-end date from the primary revenue concept,
        # then anchor ALL other concepts to that same period to prevent cross-period mixing.
        def _find_fy_end() -> str:
            for concept in ("Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                            "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax"):
                entries = get_entries(concept)
                if not entries:
                    continue
                annual = [e for e in entries
                          if e.get("form") == "10-K"
                          and e.get("val") is not None
                          and _duration_days(e) >= 335]
                if not annual:
                    annual = [e for e in entries if e.get("form") == "10-K" and e.get("val") is not None]
                if annual:
                    annual.sort(key=lambda e: e.get("end", ""), reverse=True)
                    return annual[0].get("end", "")
            return ""

        fy_end = _find_fy_end()
        print(f"Canonical FY end date: {fy_end}")

        def get_latest_flow(concept: str) -> Optional[float]:
            """Annual income-stmt/CF item, anchored to the canonical FY end date."""
            entries = get_entries(concept)
            if not entries:
                return None
            annual = [e for e in entries
                      if e.get("form") == "10-K"
                      and e.get("val") is not None
                      and _duration_days(e) >= 335]
            if not annual:
                annual = [e for e in entries if e.get("form") == "10-K" and e.get("val") is not None]
            if not annual:
                annual = [e for e in entries if e.get("val") is not None]
            if not annual:
                return None
            # Prefer entries matching the canonical FY end
            if fy_end:
                matched = [e for e in annual if e.get("end", "") == fy_end]
                if matched:
                    return safe_float(matched[0]["val"])
            annual.sort(key=lambda e: e.get("end", ""), reverse=True)
            return safe_float(annual[0]["val"])

        def get_latest_bs(concept: str) -> Optional[float]:
            """Balance-sheet item anchored to the canonical FY end date."""
            entries = get_entries(concept)
            if not entries:
                return None
            annual = [e for e in entries if e.get("form") == "10-K" and e.get("val") is not None]
            if not annual:
                annual = [e for e in entries if e.get("val") is not None]
            if not annual:
                return None
            if fy_end:
                matched = [e for e in annual if e.get("end", "") == fy_end]
                if matched:
                    return safe_float(matched[0]["val"])
            annual.sort(key=lambda e: e.get("end", ""), reverse=True)
            return safe_float(annual[0]["val"])

        def get_history_flow(concept: str, years: int = 5) -> dict:
            """Return last N annual 10-K values keyed by fiscal year end date."""
            entries = get_entries(concept)
            if not entries:
                return {}
            annual = [e for e in entries
                      if e.get("form") == "10-K"
                      and e.get("val") is not None
                      and _duration_days(e) >= 335]
            if not annual:
                annual = [e for e in entries if e.get("form") == "10-K" and e.get("val") is not None]
            if not annual:
                return {}
            # Deduplicate by end date — keep highest value per end date
            by_end: dict = {}
            for e in annual:
                end = e.get("end", "")
                val = safe_float(e["val"])
                if val is not None and (end not in by_end or val > by_end[end]):
                    by_end[end] = val
            sorted_ends = sorted(by_end.keys(), reverse=True)[:years]
            return {k: by_end[k] for k in sorted(sorted_ends)}

        r: dict = {}

        # ── Income Statement (flow — use duration filter) ─────────────────────
        rev = (get_latest_flow("Revenues") or
               get_latest_flow("RevenueFromContractWithCustomerExcludingAssessedTax") or
               get_latest_flow("SalesRevenueNet") or
               get_latest_flow("RevenueFromContractWithCustomerIncludingAssessedTax"))
        if rev is not None: r["revenue"] = rev

        cogs = (get_latest_flow("CostOfRevenue") or
                get_latest_flow("CostOfGoodsAndServicesSold") or
                get_latest_flow("CostOfGoodsSold"))
        if cogs is not None: r["cost_of_revenue"] = cogs

        gp = get_latest_flow("GrossProfit")
        if gp is not None: r["gross_profit"] = gp

        rd = get_latest_flow("ResearchAndDevelopmentExpense")
        if rd is not None: r["rd_expense"] = rd

        sga = get_latest_flow("SellingGeneralAndAdministrativeExpense")
        if sga is not None: r["sga_expense"] = sga

        opex_total = get_latest_flow("OperatingExpenses")
        if opex_total is not None: r["operating_expenses"] = opex_total

        oi = get_latest_flow("OperatingIncomeLoss")
        if oi is not None: r["operating_income"] = oi

        int_exp = (get_latest_flow("InterestAndDebtExpense") or
                   get_latest_flow("InterestExpense") or
                   get_latest_flow("InterestExpenseDebt"))
        if int_exp is not None: r["interest_expense"] = int_exp

        pretax = get_latest_flow("IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest")
        if pretax is not None: r["pretax_income"] = pretax

        tax = get_latest_flow("IncomeTaxExpenseBenefit")
        if tax is not None: r["income_tax"] = tax

        ni = get_latest_flow("NetIncomeLoss") or get_latest_flow("NetIncomeLossAvailableToCommonStockholdersDiluted")
        if ni is not None: r["net_income"] = ni

        eps_b = get_latest_flow("EarningsPerShareBasic")
        if eps_b is not None: r["eps_basic"] = eps_b

        eps = get_latest_flow("EarningsPerShareDiluted")
        if eps is not None: r["eps_diluted"] = eps

        sh_dil = get_latest_flow("WeightedAverageNumberOfDilutedSharesOutstanding")
        if sh_dil is not None: r["shares_diluted_wtd"] = sh_dil

        sh_basic = get_latest_flow("WeightedAverageNumberOfSharesOutstandingBasic")
        if sh_basic is not None: r["shares_basic_wtd"] = sh_basic

        # ── Balance Sheet (point-in-time) ─────────────────────────────────────
        cash = get_latest_bs("CashAndCashEquivalentsAtCarryingValue") or get_latest_bs("CashCashEquivalentsAndShortTermInvestments")
        if cash is not None: r["cash"] = cash

        sti = (get_latest_bs("ShortTermInvestments") or
               get_latest_bs("AvailableForSaleSecuritiesDebtSecuritiesCurrent") or
               get_latest_bs("MarketableSecuritiesCurrent"))
        if sti is not None: r["short_term_investments"] = sti

        ar = get_latest_bs("AccountsReceivableNetCurrent")
        if ar is not None: r["accounts_receivable"] = ar

        inv = get_latest_bs("InventoryNet")
        if inv is not None: r["inventory"] = inv

        curr_assets = get_latest_bs("AssetsCurrent")
        if curr_assets is not None: r["current_assets"] = curr_assets

        ppe = get_latest_bs("PropertyPlantAndEquipmentNet")
        if ppe is not None: r["ppe_net"] = ppe

        goodwill = get_latest_bs("Goodwill")
        if goodwill is not None: r["goodwill"] = goodwill

        intangibles = get_latest_bs("IntangibleAssetsNetExcludingGoodwill")
        if intangibles is not None: r["intangibles"] = intangibles

        assets = get_latest_bs("Assets")
        if assets is not None: r["total_assets"] = assets

        ap = get_latest_bs("AccountsPayableCurrent")
        if ap is not None: r["accounts_payable"] = ap

        curr_liab = get_latest_bs("LiabilitiesCurrent")
        if curr_liab is not None: r["current_liabilities"] = curr_liab

        ltd = get_latest_bs("LongTermDebt") or get_latest_bs("LongTermDebtNoncurrent")
        if ltd is not None: r["long_term_debt"] = ltd

        liab = get_latest_bs("Liabilities")
        if liab is not None: r["total_liabilities"] = liab

        re_accum = get_latest_bs("RetainedEarningsAccumulatedDeficit")
        if re_accum is not None: r["retained_earnings"] = re_accum

        eq = get_latest_bs("StockholdersEquity") or get_latest_bs("StockholdersEquityAttributableToParent")
        if eq is not None: r["equity"] = eq

        shares = get_latest_bs("CommonStockSharesOutstanding")
        if shares is not None: r["shares_outstanding"] = shares

        # ── Cash Flow (flow — use duration filter) ────────────────────────────
        ocf = get_latest_flow("NetCashProvidedByUsedInOperatingActivities")
        if ocf is not None: r["operating_cf"] = ocf

        da = (get_latest_flow("DepreciationDepletionAndAmortization") or
              get_latest_flow("DepreciationAndAmortization") or
              get_latest_flow("Depreciation"))
        if da is not None: r["da_expense"] = da

        sbc = (get_latest_flow("AllocatedShareBasedCompensationExpense") or
               get_latest_flow("ShareBasedCompensation") or
               get_latest_flow("ShareBasedCompensationExpense"))
        if sbc is not None: r["sbc_expense"] = sbc

        capex = (get_latest_flow("PaymentsToAcquirePropertyPlantAndEquipment") or
                 get_latest_flow("PaymentsForCapitalImprovements") or
                 get_latest_flow("PaymentsToAcquireProductiveAssets"))
        if capex is not None: r["capex"] = capex

        acq = get_latest_flow("PaymentsToAcquireBusinessesNetOfCashAcquired")
        if acq is not None: r["acquisitions"] = acq

        inv_cf = get_latest_flow("NetCashProvidedByUsedInInvestingActivities")
        if inv_cf is not None: r["investing_cf"] = inv_cf

        buybacks = get_latest_flow("PaymentsForRepurchaseOfCommonStock")
        if buybacks is not None: r["buybacks"] = buybacks

        divs = (get_latest_flow("PaymentsOfDividends") or
                get_latest_flow("PaymentsOfDividendsCommonStock"))
        if divs is not None: r["dividends_paid"] = divs

        fin_cf = get_latest_flow("NetCashProvidedByUsedInFinancingActivities")
        if fin_cf is not None: r["financing_cf"] = fin_cf

        # ── Derived ratios ────────────────────────────────────────────────────
        if rev and gp:   r["gross_margin_pct"]     = round((gp  / rev) * 100, 1)
        if rev and oi:   r["operating_margin_pct"] = round((oi  / rev) * 100, 1)
        if rev and ni:   r["net_margin_pct"]        = round((ni  / rev) * 100, 1)
        if ocf is not None and capex is not None:
            r["free_cash_flow"] = ocf - abs(capex)
        if oi is not None and da is not None:
            r["ebitda"] = oi + da
        # Effective tax rate
        tax_val  = r.get("income_tax")
        pre_val  = r.get("pretax_income")
        if tax_val is not None and pre_val is not None and pre_val != 0:
            r["effective_tax_rate"] = round((tax_val / pre_val) * 100, 1)

        print(f"XBRL SEC API: extracted {len(r)} facts for CIK {cik}")

        # ── Helpers: BS history (point-in-time, dedupe by end date) ─────────
        def get_history_bs(concept: str, years: int = 2) -> dict:
            entries = get_entries(concept)
            if not entries:
                return {}
            annual = [e for e in entries if e.get("form") == "10-K" and e.get("val") is not None]
            if not annual:
                return {}
            by_end: dict = {}
            for e in annual:
                end = e.get("end", "")
                val = safe_float(e["val"])
                if val is not None and (end not in by_end or abs(val) > abs(by_end[end])):
                    by_end[end] = val
            sorted_ends = sorted(by_end.keys(), reverse=True)[:years]
            return {k: by_end[k] for k in sorted(sorted_ends)}

        # ── 5-year history ────────────────────────────────────────────────────
        history: dict = {}
        rev_hist = (get_history_flow("Revenues") or
                    get_history_flow("RevenueFromContractWithCustomerExcludingAssessedTax") or
                    get_history_flow("SalesRevenueNet") or
                    get_history_flow("RevenueFromContractWithCustomerIncludingAssessedTax"))
        if rev_hist: history["revenue"] = rev_hist

        gp_hist = get_history_flow("GrossProfit")
        if gp_hist: history["gross_profit"] = gp_hist

        ni_hist = get_history_flow("NetIncomeLoss") or get_history_flow("NetIncomeLossAvailableToCommonStockholdersDiluted")
        if ni_hist: history["net_income"] = ni_hist

        oi_hist = get_history_flow("OperatingIncomeLoss")
        if oi_hist: history["operating_income"] = oi_hist

        ocf_hist = get_history_flow("NetCashProvidedByUsedInOperatingActivities")
        if ocf_hist: history["operating_cf"] = ocf_hist

        # Additional income statement history for YoY badges on each row
        cogs_hist = (get_history_flow("CostOfRevenue") or get_history_flow("CostOfGoodsAndServicesSold"))
        if cogs_hist: history["cost_of_revenue"] = cogs_hist

        rd_hist = get_history_flow("ResearchAndDevelopmentExpense")
        if rd_hist: history["rd_expense"] = rd_hist

        sga_hist = get_history_flow("SellingGeneralAndAdministrativeExpense")
        if sga_hist: history["sga_expense"] = sga_hist

        oi2_hist = get_history_flow("OperatingIncomeLoss")  # already done above, skip dup

        # Balance sheet: 2-year history for YoY comparisons on BS tab
        assets_h = get_history_bs("Assets")
        if assets_h: history["total_assets"] = assets_h

        cash_h = (get_history_bs("CashAndCashEquivalentsAtCarryingValue") or
                  get_history_bs("CashCashEquivalentsAndShortTermInvestments"))
        if cash_h: history["cash"] = cash_h

        eq_h = (get_history_bs("StockholdersEquity") or
                get_history_bs("StockholdersEquityAttributableToParent"))
        if eq_h: history["equity"] = eq_h

        liab_h = get_history_bs("Liabilities")
        if liab_h: history["total_liabilities"] = liab_h

        ltd_h = (get_history_bs("LongTermDebt") or get_history_bs("LongTermDebtNoncurrent"))
        if ltd_h: history["long_term_debt"] = ltd_h

        curr_a_h = get_history_bs("AssetsCurrent")
        if curr_a_h: history["current_assets"] = curr_a_h

        # ── Most recent single quarter (10-Q, ~80–100 days) ─────────────────
        def get_latest_q_flow(concept: str) -> Optional[float]:
            entries = get_entries(concept)
            if not entries:
                return None
            q = [e for e in entries
                 if e.get("form") == "10-Q" and e.get("val") is not None
                 and 75 <= _duration_days(e) <= 105]
            if not q:
                q = [e for e in entries
                     if e.get("form") == "10-Q" and e.get("val") is not None
                     and _duration_days(e) < 200]
            if not q:
                return None
            q.sort(key=lambda e: e.get("end", ""), reverse=True)
            return safe_float(q[0]["val"])

        def get_latest_q_bs(concept: str) -> Optional[float]:
            entries = get_entries(concept)
            if not entries:
                return None
            q = [e for e in entries if e.get("form") == "10-Q" and e.get("val") is not None]
            if not q:
                return None
            q.sort(key=lambda e: e.get("end", ""), reverse=True)
            return safe_float(q[0]["val"])

        qr: dict = {}

        q_rev = (get_latest_q_flow("Revenues") or
                 get_latest_q_flow("RevenueFromContractWithCustomerExcludingAssessedTax") or
                 get_latest_q_flow("SalesRevenueNet"))
        if q_rev is not None: qr["revenue"] = q_rev

        q_cogs = (get_latest_q_flow("CostOfRevenue") or
                  get_latest_q_flow("CostOfGoodsAndServicesSold"))
        if q_cogs is not None: qr["cost_of_revenue"] = q_cogs

        q_gp = get_latest_q_flow("GrossProfit")
        if q_gp is not None: qr["gross_profit"] = q_gp

        q_rd = get_latest_q_flow("ResearchAndDevelopmentExpense")
        if q_rd is not None: qr["rd_expense"] = q_rd

        q_sga = get_latest_q_flow("SellingGeneralAndAdministrativeExpense")
        if q_sga is not None: qr["sga_expense"] = q_sga

        q_oi = get_latest_q_flow("OperatingIncomeLoss")
        if q_oi is not None: qr["operating_income"] = q_oi

        q_ni = get_latest_q_flow("NetIncomeLoss")
        if q_ni is not None: qr["net_income"] = q_ni

        q_eps = get_latest_q_flow("EarningsPerShareDiluted")
        if q_eps is not None: qr["eps_diluted"] = q_eps

        q_ocf = get_latest_q_flow("NetCashProvidedByUsedInOperatingActivities")
        if q_ocf is not None: qr["operating_cf"] = q_ocf

        q_capex = get_latest_q_flow("PaymentsToAcquirePropertyPlantAndEquipment")
        if q_capex is not None: qr["capex"] = q_capex

        q_cash = get_latest_q_bs("CashAndCashEquivalentsAtCarryingValue")
        if q_cash is not None: qr["cash"] = q_cash

        q_assets = get_latest_q_bs("Assets")
        if q_assets is not None: qr["total_assets"] = q_assets

        q_eq = get_latest_q_bs("StockholdersEquity") or get_latest_q_bs("StockholdersEquityAttributableToParent")
        if q_eq is not None: qr["equity"] = q_eq

        # Derived quarterly ratios
        if q_rev and q_gp:  qr["gross_margin_pct"]     = round(q_gp / q_rev * 100, 1)
        if q_rev and q_oi:  qr["operating_margin_pct"] = round(q_oi / q_rev * 100, 1)
        if q_rev and q_ni:  qr["net_margin_pct"]        = round(q_ni / q_rev * 100, 1)
        if q_ocf is not None and q_capex is not None:
            qr["free_cash_flow"] = q_ocf - abs(q_capex)

        # Prior quarter flow (QoQ comparison) — second-most-recent 10-Q single period
        def get_prior_q_flow(concept: str) -> Optional[float]:
            entries = get_entries(concept)
            if not entries:
                return None
            q = [e for e in entries
                 if e.get("form") == "10-Q" and e.get("val") is not None
                 and 75 <= _duration_days(e) <= 105]
            if len(q) < 2:
                return None
            q.sort(key=lambda e: e.get("end", ""), reverse=True)
            return safe_float(q[1]["val"])

        pqr: dict = {}
        pq_rev = (get_prior_q_flow("Revenues") or
                  get_prior_q_flow("RevenueFromContractWithCustomerExcludingAssessedTax"))
        if pq_rev is not None: pqr["revenue"] = pq_rev

        pq_gp = get_prior_q_flow("GrossProfit")
        if pq_gp is not None: pqr["gross_profit"] = pq_gp

        pq_oi = get_prior_q_flow("OperatingIncomeLoss")
        if pq_oi is not None: pqr["operating_income"] = pq_oi

        pq_ni = get_prior_q_flow("NetIncomeLoss")
        if pq_ni is not None: pqr["net_income"] = pq_ni

        pq_ocf = get_prior_q_flow("NetCashProvidedByUsedInOperatingActivities")
        if pq_ocf is not None: pqr["operating_cf"] = pq_ocf

        pq_eps = get_prior_q_flow("EarningsPerShareDiluted")
        if pq_eps is not None: pqr["eps_diluted"] = pq_eps

        if pq_rev and pq_gp:  pqr["gross_margin_pct"]     = round(pq_gp / pq_rev * 100, 1)
        if pq_rev and pq_oi:  pqr["operating_margin_pct"] = round(pq_oi / pq_rev * 100, 1)
        if pq_rev and pq_ni:  pqr["net_margin_pct"]        = round(pq_ni / pq_rev * 100, 1)

        # Period labels
        q_period = ""
        prior_q_period = ""
        rev_entries_all = get_entries("Revenues") or get_entries("RevenueFromContractWithCustomerExcludingAssessedTax")
        if rev_entries_all:
            qpe = [e for e in rev_entries_all
                   if e.get("form") == "10-Q" and e.get("val") is not None
                   and 75 <= _duration_days(e) <= 105]
            if qpe:
                qpe.sort(key=lambda e: e.get("end", ""), reverse=True)
                q_period = qpe[0].get("end", "")
                if len(qpe) >= 2:
                    prior_q_period = qpe[1].get("end", "")

        print(f"XBRL SEC API: {len(r)} annual + {len(qr)} quarterly facts for CIK {cik}")
        return {
            "facts": r,
            "history": history,
            "quarterly_facts": qr,
            "quarterly_period": q_period,
            "prior_quarter_facts": pqr,
            "prior_quarter_period": prior_q_period,
        }

    except Exception as e:
        print(f"XBRL SEC API error for CIK {cik}: {e}")
        return {"facts": {}, "history": {}, "quarterly_facts": {}, "quarterly_period": ""}

# ── yfinance financial statements ────────────────────────────────────────────

def _yf_safe(v) -> Optional[float]:
    """Convert a yfinance cell value to float, returning None for NaN/None."""
    if v is None:
        return None
    try:
        if hasattr(v, 'item'):
            v = v.item()
        if isinstance(v, float) and _np.isnan(v):
            return None
        return float(v)
    except Exception:
        return None

def get_yfinance_financials(ticker: str) -> dict:
    """Fetch standardized financial statements from Yahoo Finance via yfinance."""
    if not YF_AVAILABLE:
        return {}
    try:
        t = yf.Ticker(ticker)

        def df_to_obj(df):
            if df is None or df.empty:
                return {"columns": [], "data": {}}
            cols = [str(c)[:10] for c in df.columns]
            data = {}
            for idx in df.index:
                key = str(idx)
                vals = [_yf_safe(df.loc[idx, col]) for col in df.columns]
                data[key] = vals
            return {"columns": cols, "data": data}

        annual_income   = df_to_obj(t.income_stmt)
        annual_balance  = df_to_obj(t.balance_sheet)
        annual_cashflow = df_to_obj(t.cash_flow)
        q_income   = df_to_obj(t.quarterly_income_stmt)
        q_balance  = df_to_obj(t.quarterly_balance_sheet)
        q_cashflow = df_to_obj(t.quarterly_cash_flow)

        try:
            raw = t.info or {}
        except Exception:
            raw = {}

        info = {k: raw.get(k) for k in [
            "marketCap", "trailingPE", "forwardPE", "currentPrice",
            "fiftyTwoWeekHigh", "fiftyTwoWeekLow", "dividendYield",
            "beta", "sharesOutstanding", "floatShares", "bookValue",
            "enterpriseValue", "enterpriseToRevenue", "enterpriseToEbitda",
            "priceToBook",
        ]}

        print(f"yfinance: {len(annual_income.get('columns', []))} annual + {len(q_income.get('columns', []))} quarterly periods for {ticker}")
        return {
            "income": annual_income,
            "balance_sheet": annual_balance,
            "cash_flow": annual_cashflow,
            "quarterly_income": q_income,
            "quarterly_balance": q_balance,
            "quarterly_cashflow": q_cashflow,
            "info": info,
        }
    except Exception as e:
        print(f"yfinance error for {ticker}: {e}")
        return {}

def _yf_get(yf_stmt: dict, *keys: str, col_idx: int = 0) -> Optional[float]:
    """Get a value from a yfinance statement dict, trying keys in order."""
    for key in keys:
        vals = yf_stmt.get("data", {}).get(key)
        if vals and col_idx < len(vals) and vals[col_idx] is not None:
            return vals[col_idx]
    return None

def _yf_series(yf_stmt: dict, *keys: str) -> dict:
    """Build {date: value} series from yfinance statement, newest-first cols → sorted asc result."""
    cols = yf_stmt.get("columns", [])
    if not cols:
        return {}
    for key in keys:
        vals = yf_stmt.get("data", {}).get(key)
        if vals:
            result = {cols[i]: v for i, v in enumerate(vals) if v is not None and i < len(cols)}
            if result:
                return result
    return {}

def merge_yf_into_facts(facts: dict, yf_data: dict) -> dict:
    """Override xbrl_facts with yfinance most-recent-annual data (more reliable, standardized)."""
    if not yf_data:
        return facts

    inc = yf_data.get("income", {})
    bal = yf_data.get("balance_sheet", {})
    cf  = yf_data.get("cash_flow", {})

    def g(*args, col_idx=0): return _yf_get(inc, *args, col_idx=col_idx)
    def gb(*args, col_idx=0): return _yf_get(bal, *args, col_idx=col_idx)
    def gc(*args, col_idx=0): return _yf_get(cf,  *args, col_idx=col_idx)

    # Income statement
    rev = g("Total Revenue")
    if rev: facts["revenue"] = rev
    cogs = g("Cost Of Revenue", "Reconciled Cost Of Revenue")
    if cogs: facts["cost_of_revenue"] = cogs
    gp = g("Gross Profit")
    if gp: facts["gross_profit"] = gp
    rd = g("Research And Development")
    if rd: facts["rd_expense"] = rd
    sga = g("Selling General Administrative")
    if sga: facts["sga_expense"] = sga
    oi = g("Operating Income", "EBIT")
    if oi: facts["operating_income"] = oi
    ebitda = g("EBITDA", "Normalized EBITDA")
    if ebitda: facts["ebitda"] = ebitda
    ni = g("Net Income")
    if ni: facts["net_income"] = ni
    eps_d = g("Diluted EPS")
    if eps_d: facts["eps_diluted"] = eps_d
    eps_b = g("Basic EPS")
    if eps_b: facts["eps_basic"] = eps_b
    sh_d = g("Diluted Average Shares")
    if sh_d: facts["shares_diluted_wtd"] = sh_d
    sh_b = g("Basic Average Shares")
    if sh_b: facts["shares_basic_wtd"] = sh_b
    int_exp = g("Interest Expense", "Interest Expense Non Operating")
    if int_exp: facts["interest_expense"] = abs(int_exp)
    pretax = g("Pretax Income")
    if pretax: facts["pretax_income"] = pretax
    tax = g("Tax Provision")
    if tax: facts["income_tax"] = tax

    # Balance sheet
    cash_val = gb("Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments")
    if cash_val: facts["cash"] = cash_val
    sti = gb("Available For Sale Securities", "Investements And Advances")
    if sti: facts["short_term_investments"] = sti
    ar = gb("Accounts Receivable")
    if ar: facts["accounts_receivable"] = ar
    inv = gb("Inventory")
    if inv: facts["inventory"] = inv
    curr_a = gb("Current Assets")
    if curr_a: facts["current_assets"] = curr_a
    ppe = gb("Net PPE")
    if ppe: facts["ppe_net"] = ppe
    goodwill = gb("Goodwill")
    if goodwill: facts["goodwill"] = goodwill
    intang = gb("Other Intangible Assets", "Intangible Assets")
    if intang: facts["intangibles"] = intang
    total_a = gb("Total Assets")
    if total_a: facts["total_assets"] = total_a
    ap = gb("Accounts Payable")
    if ap: facts["accounts_payable"] = ap
    curr_l = gb("Current Liabilities")
    if curr_l: facts["current_liabilities"] = curr_l
    ltd = gb("Long Term Debt")
    if ltd: facts["long_term_debt"] = ltd
    total_l = gb("Total Liabilities Net Minority Interest")
    if total_l: facts["total_liabilities"] = total_l
    re_ = gb("Retained Earnings")
    if re_: facts["retained_earnings"] = re_
    eq = gb("Stockholders Equity", "Common Stock Equity")
    if eq: facts["equity"] = eq

    # Cash flow
    ocf = gc("Operating Cash Flow")
    if ocf: facts["operating_cf"] = ocf
    capex = gc("Capital Expenditure")
    if capex: facts["capex"] = capex
    fcf = gc("Free Cash Flow")
    if fcf: facts["free_cash_flow"] = fcf
    da = gc("Depreciation Amortization Depletion", "Reconciled Depreciation")
    if da: facts["da_expense"] = da
    sbc = gc("Stock Based Compensation")
    if sbc: facts["sbc_expense"] = sbc
    buybacks = gc("Common Stock Repurchased", "Repurchase Of Capital Stock")
    if buybacks: facts["buybacks"] = abs(buybacks)
    divs = gc("Cash Dividends Paid", "Common Stock Dividend Paid")
    if divs: facts["dividends_paid"] = divs
    fin_cf = gc("Financing Cash Flow")
    if fin_cf: facts["financing_cf"] = fin_cf
    inv_cf = gc("Investing Cash Flow")
    if inv_cf: facts["investing_cf"] = inv_cf

    # Recalculate derived ratios with updated data
    rev2  = facts.get("revenue")
    gp2   = facts.get("gross_profit")
    oi2   = facts.get("operating_income")
    ni2   = facts.get("net_income")
    ocf2  = facts.get("operating_cf")
    cap2  = facts.get("capex")
    da2   = facts.get("da_expense")
    pretax2 = facts.get("pretax_income")
    tax2  = facts.get("income_tax")

    if rev2 and gp2:  facts["gross_margin_pct"]     = round(gp2 / rev2 * 100, 1)
    if rev2 and oi2:  facts["operating_margin_pct"] = round(oi2 / rev2 * 100, 1)
    if rev2 and ni2:  facts["net_margin_pct"]        = round(ni2 / rev2 * 100, 1)
    if ocf2 and cap2: facts["free_cash_flow"] = ocf2 - abs(cap2)
    if oi2 and da2:   facts["ebitda"] = facts.get("ebitda") or (oi2 + da2)
    if pretax2 and tax2 and pretax2 != 0:
        facts["effective_tax_rate"] = round(tax2 / pretax2 * 100, 1)

    return facts

def build_history_from_yf(yf_data: dict) -> dict:
    """Build comprehensive history dict from yfinance annual statements."""
    if not yf_data:
        return {}

    inc = yf_data.get("income", {})
    bal = yf_data.get("balance_sheet", {})
    cf  = yf_data.get("cash_flow", {})

    history: dict = {}

    def add(key, stmt, *yf_keys):
        series = _yf_series(stmt, *yf_keys)
        if series:
            history[key] = series

    # Income statement
    add("revenue",          inc, "Total Revenue")
    add("gross_profit",     inc, "Gross Profit")
    add("net_income",       inc, "Net Income")
    add("operating_income", inc, "Operating Income", "EBIT")
    add("cost_of_revenue",  inc, "Cost Of Revenue", "Reconciled Cost Of Revenue")
    add("rd_expense",       inc, "Research And Development")
    add("sga_expense",      inc, "Selling General Administrative")
    add("ebitda",           inc, "EBITDA", "Normalized EBITDA")
    add("interest_expense", inc, "Interest Expense", "Interest Expense Non Operating")
    add("pretax_income",    inc, "Pretax Income")
    add("income_tax",       inc, "Tax Provision")
    add("eps_diluted",      inc, "Diluted EPS")
    add("eps_basic",        inc, "Basic EPS")
    add("shares_diluted_wtd", inc, "Diluted Average Shares")

    # Cash flow
    add("operating_cf",   cf, "Operating Cash Flow")
    add("capex",          cf, "Capital Expenditure")
    add("free_cash_flow", cf, "Free Cash Flow")
    add("sbc_expense",    cf, "Stock Based Compensation")
    add("da_expense",     cf, "Depreciation Amortization Depletion", "Reconciled Depreciation")
    add("buybacks",       cf, "Common Stock Repurchased", "Repurchase Of Capital Stock")
    add("dividends_paid", cf, "Cash Dividends Paid", "Common Stock Dividend Paid")
    add("investing_cf",   cf, "Investing Cash Flow")
    add("financing_cf",   cf, "Financing Cash Flow")

    # Balance sheet (multi-year)
    add("total_assets",       bal, "Total Assets")
    add("cash",               bal, "Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments")
    add("equity",             bal, "Stockholders Equity", "Common Stock Equity")
    add("total_liabilities",  bal, "Total Liabilities Net Minority Interest")
    add("long_term_debt",     bal, "Long Term Debt")
    add("current_assets",     bal, "Current Assets")
    add("current_liabilities",bal, "Current Liabilities")
    add("accounts_receivable",bal, "Accounts Receivable")
    add("accounts_payable",   bal, "Accounts Payable")
    add("inventory",          bal, "Inventory")
    add("ppe_net",            bal, "Net PPE")
    add("goodwill",           bal, "Goodwill")
    add("retained_earnings",  bal, "Retained Earnings")

    # Make interest_expense absolute values (yfinance may return negative)
    if "interest_expense" in history:
        history["interest_expense"] = {k: abs(v) for k, v in history["interest_expense"].items()}

    # Make buybacks absolute values
    if "buybacks" in history:
        history["buybacks"] = {k: abs(v) for k, v in history["buybacks"].items()}

    return history

# ── Response models ───────────────────────────────────────────────────────────

class CompanyInfo(BaseModel):
    ticker: str
    name: str
    cik: str
    sic: Optional[str] = None
    sic_description: Optional[str] = None

class FilingSection(BaseModel):
    item: str
    title: str
    text: str
    char_count: int

class FilingData(BaseModel):
    form_type: str
    accession: str
    filed_date: str
    period_of_report: str
    sections: list[FilingSection]
    raw_financials: dict

class AnalysisPayload(BaseModel):
    company: CompanyInfo
    annual: Optional[FilingData] = None
    quarterly: Optional[FilingData] = None
    xbrl_facts: dict = {}
    history: dict = {}
    quarterly_xbrl: dict = {}
    quarterly_period: str = ""
    prior_quarter_xbrl: dict = {}
    prior_quarter_period: str = ""

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "edgar_available": EDGAR_AVAILABLE}

@app.get("/company/{ticker}", response_model=AnalysisPayload)
async def get_company_analysis(ticker: str, sections: str = "business,risks,cybersecurity,properties,legal,mda,quantitative,controls,accountant_fees,q_quantitative,q_controls,q_legal"):
    if not EDGAR_AVAILABLE:
        raise HTTPException(503, "edgartools not installed — run: pip install edgartools")

    ticker = ticker.upper().strip()
    want = {s.strip() for s in sections.split(",")}

    try:
        company = await asyncio.to_thread(_get_company, ticker)
    except Exception as e:
        raise HTTPException(404, f"Company not found: {ticker} — {e}")

    info = CompanyInfo(
        ticker=ticker,
        name=getattr(company, 'name', ticker),
        cik=str(getattr(company, 'cik', '')),
        sic=str(getattr(company, 'sic', '') or ''),
        sic_description=str(getattr(company, 'sic_description', '') or ''),
    )

    annual_task    = asyncio.to_thread(_get_filing, company, "10-K", want)
    quarterly_task = asyncio.to_thread(_get_filing, company, "10-Q", want)
    xbrl_task      = asyncio.to_thread(fetch_xbrl_from_sec_api, str(getattr(company, 'cik', '')))
    fmp_task       = asyncio.to_thread(get_fmp_financials, ticker)
    yf_task        = asyncio.to_thread(get_yfinance_financials, ticker)

    annual, quarterly, xbrl_result, fmp_data, yf_data = await asyncio.gather(
        annual_task, quarterly_task, xbrl_task, fmp_task, yf_task
    )

    # ── Financial data priority: FMP > yfinance > XBRL ───────────────────────
    if fmp_data:
        print(f"Using FMP as primary financial data source for {ticker}")
        merged_facts, merged_history, qxbrl, pqxbrl, q_period, _, prior_q_period = build_from_fmp(fmp_data)
    else:
        print(f"FMP not available — falling back to yfinance+XBRL for {ticker}")
        merged_facts   = merge_yf_into_facts(dict(xbrl_result.get("facts", {})), yf_data)
        merged_history = build_history_from_yf(yf_data) or xbrl_result.get("history", {})
        qxbrl          = dict(xbrl_result.get("quarterly_facts", {}))
        pqxbrl         = dict(xbrl_result.get("prior_quarter_facts", {}))
        q_period       = xbrl_result.get("quarterly_period", "")
        prior_q_period = xbrl_result.get("prior_quarter_period", "")

    return AnalysisPayload(
        company=info,
        annual=annual,
        quarterly=quarterly,
        xbrl_facts=merged_facts,
        history=merged_history,
        quarterly_xbrl=qxbrl,
        quarterly_period=q_period,
        prior_quarter_xbrl=pqxbrl,
        prior_quarter_period=prior_q_period,
    )

def _get_company(ticker: str):
    return Company(ticker)

def _get_filing(company, form_type: str, want: set) -> Optional[FilingData]:
    try:
        filings = company.get_filings(form=form_type)
        if not filings:
            return None
        latest = filings.latest(1)
        if not latest:
            return None

        accession  = str(getattr(latest, 'accession_number', '') or '')
        filed_date = str(getattr(latest, 'filing_date', '')     or '')
        period     = str(getattr(latest, 'period_of_report', '') or '')

        sections: list[FilingSection] = []

        try:
            doc = latest.obj()
        except Exception:
            doc = None

        if doc is not None:
            # Log available attrs to Railway console for debugging
            doc_attrs = [a for a in dir(doc) if not a.startswith('_')]
            print(f"[{form_type}] doc attrs: {doc_attrs}")

        # Section map varies by form type — 10-Q uses Item 2 for MD&A, not Item 7
        if form_type == "10-Q":
            SECTION_MAP = {
                "mda": ("Item 2 — MD&A (Quarterly)", [
                    "mda", "management_discussion_and_analysis",
                    "item2", "item_2", "item2_management_discussion",
                    "management_discussion", "md_and_a",
                    "management_s_discussion_and_analysis",
                    "managements_discussion_and_analysis",
                    "item7", "item_7",
                ], ["2", "2.", "7", "7."]),
                "q_quantitative": ("Item 3 — Market Risk (Q)", [
                    "quantitative_disclosures", "item3", "item_3",
                    "quantitative_and_qualitative_disclosures_about_market_risk",
                ], ["3", "3."]),
                "q_controls": ("Item 4 — Controls & Procedures (Q)", [
                    "controls_and_procedures", "item4", "item_4", "controls",
                ], ["4", "4."]),
                "q_legal": ("Item 1 — Legal Proceedings (Q)", [
                    "legal_proceedings", "legal", "item1", "item_1",
                ], ["1", "1."]),
            }
        else:
            SECTION_MAP = {
                "business": ("Item 1 — Business", [
                    "business", "item1", "item_1", "item1_business",
                ], ["1", "1."]),
                "risks": ("Item 1A — Risk Factors", [
                    "risk_factors", "risks", "item1a", "item_1a", "risk_factors_text",
                ], ["1A", "1a", "1a."]),
                "cybersecurity": ("Item 1C — Cybersecurity", [
                    "cybersecurity", "item1c", "item_1c", "item_1_c",
                    "cybersecurity_risk_management", "cybersecurity_disclosure",
                ], ["1C", "1c"]),
                "properties": ("Item 2 — Properties", [
                    "properties", "item2", "item_2",
                ], ["2", "2."]),
                "legal": ("Item 3 — Legal Proceedings", [
                    "legal_proceedings", "legal", "item3", "item_3",
                ], ["3", "3."]),
                "mda": ("Item 7 — MD&A", [
                    "mda", "management_discussion_and_analysis", "item7", "item_7",
                    "md_and_a", "management_s_discussion_and_analysis",
                    "managements_discussion_and_analysis",
                ], ["7", "7."]),
                "quantitative": ("Item 7A — Market Risk", [
                    "quantitative_disclosures", "item7a", "item_7a",
                    "quantitative_and_qualitative_disclosures_about_market_risk",
                ], ["7A", "7a"]),
                "controls": ("Item 9A — Controls & Procedures", [
                    "controls_and_procedures", "item9a", "item_9a", "controls",
                    "disclosure_controls", "internal_controls",
                ], ["9A", "9a"]),
                "accountant_fees": ("Item 14 — Accountant Fees", [
                    "principal_accountant_fees", "accountant_fees", "item14", "item_14",
                    "audit_fees", "accountant_fees_and_services",
                ], ["14", "14."]),
            }

        for key, (title, attr_names, item_keys) in SECTION_MAP.items():
            if key not in want:
                continue
            if doc is None:
                continue
            raw = None
            # 1) Try named attributes
            for attr in attr_names:
                try:
                    val = getattr(doc, attr, None)
                    if val is not None:
                        raw = val
                        print(f"[{form_type}] section '{key}' found via attr '{attr}'")
                        break
                except Exception:
                    continue
            # 2) Try __getitem__ with item number keys
            if raw is None:
                for ik in item_keys:
                    try:
                        val = doc[ik]
                        if val is not None:
                            raw = val
                            print(f"[{form_type}] section '{key}' found via doc['{ik}']")
                            break
                    except (KeyError, TypeError, IndexError):
                        continue
            # 3) Dynamic discovery: scan all attrs for one whose name contains the key and has long text
            if raw is None:
                for attr in dir(doc):
                    if attr.startswith('_'):
                        continue
                    if key.replace("_", "") not in attr.replace("_", "").lower():
                        continue
                    try:
                        val = getattr(doc, attr, None)
                        if val is None:
                            continue
                        text_probe = str(val)
                        if len(text_probe) > 200:
                            raw = val
                            print(f"[{form_type}] section '{key}' found via dynamic scan: '{attr}'")
                            break
                    except Exception:
                        continue
            if raw is None:
                print(f"[{form_type}] section '{key}' not found — tried attrs, item keys, and dynamic scan")
                continue
            try:
                # edgartools Item objects may expose a .text property with clean content
                if hasattr(raw, 'text') and isinstance(raw.text, str) and len(raw.text) > 50:
                    text = raw.text
                elif hasattr(raw, 'content') and isinstance(raw.content, str) and len(raw.content) > 50:
                    text = raw.content
                else:
                    text = str(raw)
                if len(text) < 50:
                    continue
                sections.append(FilingSection(
                    item=key, title=title,
                    text=truncate(text, 200000),
                    char_count=len(text),
                ))
            except Exception:
                pass

        return FilingData(
            form_type=form_type,
            accession=accession,
            filed_date=filed_date,
            period_of_report=period,
            sections=sections,
            raw_financials={},
        )
    except Exception as e:
        print(f"_get_filing error for {form_type}: {e}")
        return None
