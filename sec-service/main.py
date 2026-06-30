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

def truncate(text: str, max_chars: int = 8000) -> str:
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

        def get_latest_flow(concept: str) -> Optional[float]:
            """For income-statement and CF items: require annual period (>=335 days)."""
            entries = get_entries(concept)
            if not entries:
                return None
            annual = [e for e in entries
                      if e.get("form") == "10-K"
                      and e.get("val") is not None
                      and _duration_days(e) >= 335]
            if not annual:
                # Fall back to any 10-K entry if none have start/end dates
                annual = [e for e in entries if e.get("form") == "10-K" and e.get("val") is not None]
            if not annual:
                annual = [e for e in entries if e.get("val") is not None]
            if not annual:
                return None
            annual.sort(key=lambda e: e.get("end", ""), reverse=True)
            return safe_float(annual[0]["val"])

        def get_latest_bs(concept: str) -> Optional[float]:
            """For balance-sheet items: point-in-time, just pick most recent 10-K."""
            entries = get_entries(concept)
            if not entries:
                return None
            annual = [e for e in entries if e.get("form") == "10-K" and e.get("val") is not None]
            if not annual:
                annual = [e for e in entries if e.get("val") is not None]
            if not annual:
                return None
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

        capex = get_latest_flow("PaymentsToAcquirePropertyPlantAndEquipment")
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

        print(f"XBRL SEC API: extracted {len(r)} facts for CIK {cik}")

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

        # Period label for most recent quarter
        q_period = ""
        rev_entries_all = get_entries("Revenues") or get_entries("RevenueFromContractWithCustomerExcludingAssessedTax")
        if rev_entries_all:
            qpe = [e for e in rev_entries_all
                   if e.get("form") == "10-Q" and e.get("val") is not None
                   and 75 <= _duration_days(e) <= 105]
            if qpe:
                qpe.sort(key=lambda e: e.get("end", ""), reverse=True)
                q_period = qpe[0].get("end", "")

        print(f"XBRL SEC API: {len(r)} annual + {len(qr)} quarterly facts for CIK {cik}")
        return {"facts": r, "history": history, "quarterly_facts": qr, "quarterly_period": q_period}

    except Exception as e:
        print(f"XBRL SEC API error for CIK {cik}: {e}")
        return {"facts": {}, "history": {}, "quarterly_facts": {}, "quarterly_period": ""}

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

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "edgar_available": EDGAR_AVAILABLE}

@app.get("/company/{ticker}", response_model=AnalysisPayload)
async def get_company_analysis(ticker: str, sections: str = "mda,risks,business"):
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

    annual_task   = asyncio.to_thread(_get_filing, company, "10-K", want)
    quarterly_task = asyncio.to_thread(_get_filing, company, "10-Q", want)
    xbrl_task     = asyncio.to_thread(fetch_xbrl_from_sec_api, str(getattr(company, 'cik', '')))

    annual, quarterly, xbrl_result = await asyncio.gather(annual_task, quarterly_task, xbrl_task)

    return AnalysisPayload(
        company=info,
        annual=annual,
        quarterly=quarterly,
        xbrl_facts=xbrl_result.get("facts", {}),
        history=xbrl_result.get("history", {}),
        quarterly_xbrl=xbrl_result.get("quarterly_facts", {}),
        quarterly_period=xbrl_result.get("quarterly_period", ""),
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
            }
        else:
            SECTION_MAP = {
                "business": ("Item 1 — Business", [
                    "business", "item1", "item_1", "item1_business",
                ], ["1", "1."]),
                "risks": ("Item 1A — Risk Factors", [
                    "risk_factors", "risks", "item1a", "item_1a", "risk_factors_text",
                ], ["1A", "1a", "1a."]),
                "mda": ("Item 7 — MD&A", [
                    "mda", "management_discussion_and_analysis", "item7", "item_7",
                    "md_and_a", "management_s_discussion_and_analysis",
                    "managements_discussion_and_analysis",
                ], ["7", "7."]),
                "quantitative": ("Item 7A — Market Risk", [
                    "quantitative_disclosures", "item7a", "item_7a",
                    "quantitative_and_qualitative_disclosures_about_market_risk",
                ], ["7A", "7a"]),
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
                    text=truncate(text, 12000),
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
