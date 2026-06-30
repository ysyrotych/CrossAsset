"""
SEC Analysis Microservice — powered by edgartools
FastAPI service that exposes 10-K / 10-Q data to the CrossAsset Next.js app.

Deploy on Railway / Fly.io / Render. Set SEC_SERVICE_URL in Vercel env vars.
"""

import asyncio
import re
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
    # SEC requires a User-Agent identifying you — set once at startup
    set_identity("CrossAsset Research crossasset@research.com")
    EDGAR_AVAILABLE = True
except ImportError:
    EDGAR_AVAILABLE = False

# ── Helpers ───────────────────────────────────────────────────────────────────

def truncate(text: str, max_chars: int = 8000) -> str:
    """Trim text for LLM context — keep first max_chars characters."""
    if not text:
        return ""
    text = re.sub(r'\n{3,}', '\n\n', text.strip())
    return text[:max_chars] + ("\n\n[... truncated for length ...]" if len(text) > max_chars else "")

def safe_float(val) -> Optional[float]:
    try:
        return float(val) if val is not None else None
    except (TypeError, ValueError):
        return None

def extract_xbrl_facts(company) -> dict:
    """Pull key financial facts from XBRL company facts."""
    try:
        facts = company.get_facts()
        if not facts:
            return {}
        # Navigate XBRL fact structure
        us_gaap = getattr(facts, 'us_gaap', None) or {}
        result = {}
        WANTED = {
            "Revenues": "revenue",
            "RevenueFromContractWithCustomerExcludingAssessedTax": "revenue",
            "NetIncomeLoss": "net_income",
            "EarningsPerShareDiluted": "eps_diluted",
            "GrossProfit": "gross_profit",
            "OperatingIncomeLoss": "operating_income",
            "LongTermDebt": "long_term_debt",
            "CashAndCashEquivalentsAtCarryingValue": "cash",
            "CommonStockSharesOutstanding": "shares_outstanding",
            "ResearchAndDevelopmentExpense": "rd_expense",
        }
        for xbrl_key, our_key in WANTED.items():
            if our_key in result:
                continue
            fact = us_gaap.get(xbrl_key)
            if fact is None:
                continue
            try:
                # Get most recent annual value
                units = getattr(fact, 'units', None)
                if units:
                    entries = list(units.values())[0] if isinstance(units, dict) else []
                    annual = [e for e in entries if getattr(e, 'form', '') in ('10-K', '10-Q') and getattr(e, 'val', None) is not None]
                    if annual:
                        annual.sort(key=lambda e: getattr(e, 'end', ''), reverse=True)
                        result[our_key] = safe_float(getattr(annual[0], 'val', None))
            except Exception:
                pass
        return result
    except Exception:
        return {}

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
    form_type: str        # "10-K" or "10-Q"
    accession: str
    filed_date: str
    period_of_report: str
    sections: list[FilingSection]
    raw_financials: dict  # XBRL numbers

class AnalysisPayload(BaseModel):
    company: CompanyInfo
    annual: Optional[FilingData] = None
    quarterly: Optional[FilingData] = None
    xbrl_facts: dict = {}

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "edgar_available": EDGAR_AVAILABLE}

@app.get("/company/{ticker}", response_model=AnalysisPayload)
async def get_company_analysis(ticker: str, sections: str = "mda,risks,business"):
    """
    Main endpoint. Returns company info + latest 10-K + latest 10-Q sections.
    sections: comma-separated list of: mda, risks, business
    """
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

    annual, quarterly, xbrl_facts = await asyncio.gather(
        asyncio.to_thread(_get_filing, company, "10-K", want),
        asyncio.to_thread(_get_filing, company, "10-Q", want),
        asyncio.to_thread(extract_xbrl_facts, company),
    )

    return AnalysisPayload(
        company=info,
        annual=annual,
        quarterly=quarterly,
        xbrl_facts=xbrl_facts,
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

        accession    = str(getattr(latest, 'accession_number', '') or '')
        filed_date   = str(getattr(latest, 'filing_date', '')     or '')
        period       = str(getattr(latest, 'period_of_report', '') or '')

        sections: list[FilingSection] = []

        # Try to get the parsed document object (TenK / TenQ)
        try:
            doc = latest.obj()
        except Exception:
            doc = None

        SECTION_MAP = {
            "business":  ("Item 1 — Business",              lambda d: getattr(d, 'business',      None)),
            "risks":     ("Item 1A — Risk Factors",         lambda d: getattr(d, 'risk_factors',   None)),
            "mda":       ("Item 7 — MD&A",                  lambda d: getattr(d, 'mda',            None)),
            "quantitative": ("Item 7A — Market Risk",       lambda d: getattr(d, 'quantitative_disclosures', None)),
        }

        for key, (title, getter) in SECTION_MAP.items():
            if key not in want:
                continue
            if doc is None:
                continue
            try:
                raw = getter(doc)
                if raw is None:
                    continue
                text = str(raw)
                if len(text) < 50:
                    continue
                sections.append(FilingSection(
                    item=key, title=title,
                    text=truncate(text, 10000),
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
    except Exception:
        return None
