"""
Institutional Ownership Engine — 13F ingestion + delta pipeline.

Parses 13F-HR filings via edgartools, normalizes value units, resolves
CUSIP -> ticker, computes quarter-over-quarter deltas + conviction scores,
and upserts everything into Supabase. Mounted by main.py.

See docs/INSTITUTIONAL_ENGINE_DESIGN.md.
"""
from __future__ import annotations

import os
import time
import logging
from datetime import date, datetime
from typing import Optional

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

log = logging.getLogger("institutional")
router = APIRouter(prefix="/institutional", tags=["institutional"])

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
FMP_API_KEY  = os.environ.get("FMP_API_KEY", "").strip()
OPENFIGI_KEY = os.environ.get("OPENFIGI_API_KEY", "").strip()

# Curated roster (CIK, slug, name, manager, type). Verified against EDGAR by name.
CURATED = [
    ("1067983", "berkshire-hathaway", "Berkshire Hathaway",     "Warren Buffett",        "conglomerate"),
    ("1649339", "scion",              "Scion Asset Management",  "Michael Burry",         "hedge_fund"),
    ("1336528", "pershing-square",    "Pershing Square Capital", "Bill Ackman",           "activist"),
    ("1061768", "baupost",            "Baupost Group",           "Seth Klarman",          "value"),
    ("1006438", "appaloosa",          "Appaloosa Management",    "David Tepper",          "hedge_fund"),
    ("1079114", "greenlight",         "Greenlight Capital",      "David Einhorn",         "hedge_fund"),
    ("1536411", "duquesne",           "Duquesne Family Office",  "Stanley Druckenmiller", "family_office"),
    ("1040273", "third-point",        "Third Point",             "Dan Loeb",              "hedge_fund"),
    ("1167483", "tiger-global",       "Tiger Global Management", "Chase Coleman",         "hedge_fund"),
    ("1135730", "coatue",             "Coatue Management",       "Philippe Laffont",      "hedge_fund"),
]

# ── Supabase REST helpers ─────────────────────────────────────────────────────

def _sb_headers(prefer: str = "resolution=merge-duplicates") -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }

def _configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)

def sb_upsert(table: str, rows: list[dict], on_conflict: Optional[str] = None) -> None:
    if not _configured() or not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    try:
        with httpx.Client(timeout=30) as c:
            r = c.post(url, headers=_sb_headers(), json=rows)
            if r.status_code >= 300:
                log.warning("sb_upsert %s -> %s %s", table, r.status_code, r.text[:200])
    except Exception as e:
        log.warning("sb_upsert %s failed: %s", table, e)

def sb_get(path: str) -> list[dict]:
    if not _configured():
        return []
    try:
        with httpx.Client(timeout=15) as c:
            r = c.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=_sb_headers("count=none"))
            return r.json() if r.status_code < 300 else []
    except Exception:
        return []

# ── CUSIP → ticker resolution (cached fallback chain) ─────────────────────────

_cusip_cache: dict[str, dict] = {}

def resolve_security(cusip: str, issuer: str) -> dict:
    if cusip in _cusip_cache:
        return _cusip_cache[cusip]
    ticker, via = None, None
    # 1. FMP cusip endpoint
    if FMP_API_KEY:
        try:
            with httpx.Client(timeout=10) as c:
                r = c.get(f"https://financialmodelingprep.com/api/v3/cusip/{cusip}",
                          params={"apikey": FMP_API_KEY})
                if r.status_code < 300:
                    j = r.json()
                    if isinstance(j, list) and j:
                        ticker, via = j[0].get("ticker") or j[0].get("symbol"), "fmp"
                    elif isinstance(j, dict):
                        ticker, via = j.get("ticker") or j.get("symbol"), "fmp"
        except Exception:
            pass
    # 2. OpenFIGI (keyless allowed at lower rate)
    if not ticker:
        try:
            headers = {"Content-Type": "application/json"}
            if OPENFIGI_KEY:
                headers["X-OPENFIGI-APIKEY"] = OPENFIGI_KEY
            with httpx.Client(timeout=10) as c:
                r = c.post("https://api.openfigi.com/v3/mapping", headers=headers,
                           json=[{"idType": "ID_CUSIP", "idValue": cusip}])
                if r.status_code < 300:
                    data = r.json()
                    if data and data[0].get("data"):
                        ticker, via = data[0]["data"][0].get("ticker"), "openfigi"
        except Exception:
            pass
    rec = {
        "cusip": cusip, "ticker": ticker, "issuer_name": issuer,
        "resolution": "RESOLVED" if ticker else "UNRESOLVED",
        "resolved_via": via,
    }
    _cusip_cache[cusip] = rec
    sb_upsert("securities", [rec], on_conflict="cusip")
    return rec

# ── value-unit normalization ──────────────────────────────────────────────────

def normalize_value(raw_value: float, filed: date) -> tuple[float, str]:
    """SEC reported value in $thousands pre-2023; whole dollars after the 2022
    amendment (filings due Jan 2023+). Detect by filing date + magnitude."""
    unit = "dollars" if filed >= date(2023, 1, 1) else "thousands"
    val = raw_value * 1000 if unit == "thousands" else raw_value
    return val, unit

def conviction(pct_of_book: float, rank: int, action: str, d_pct_book: float) -> float:
    size = min(pct_of_book / 10, 1)
    rankf = max(0, 11 - rank) / 10
    dirs = {"NEW": 1, "ADD": 0.6, "HOLD": 0.3, "TRIM": 0.1, "EXIT": 0}
    mag = min(abs(d_pct_book) / 3, 1)
    return round(max(0, min(100, 40 * size + 25 * rankf + 20 * dirs.get(action, 0.3) + 15 * mag)))

# ── ingestion ─────────────────────────────────────────────────────────────────

class IngestBody(BaseModel):
    cik: Optional[str] = None
    period: Optional[str] = None

def _parse_13f(cik: str, period: Optional[str]) -> Optional[dict]:
    """Fetch + parse latest (or period-matched) 13F-HR for a manager."""
    from edgar import Company
    entity = Company(cik)
    filings = entity.get_filings(form=["13F-HR", "13F-HR/A"])
    if filings is None or len(filings) == 0:
        return None
    target = None
    for f in filings:
        if period is None:
            target = f
            break
        if str(getattr(f, "period_of_report", "")).startswith(period):
            target = f
            break
    if target is None:
        target = filings[0]

    filed = _to_date(target.filing_date)
    tf = target.obj()
    infotable = getattr(tf, "infotable", None)
    if infotable is None:
        return None

    rows = infotable.to_dict("records") if hasattr(infotable, "to_dict") else list(infotable)
    holdings = []
    for h in rows:
        raw_val = float(h.get("value") or h.get("Value") or 0)
        value, unit = normalize_value(raw_val, filed)
        cusip = str(h.get("cusip") or h.get("Cusip") or "").strip()
        issuer = str(h.get("nameOfIssuer") or h.get("issuer") or h.get("Issuer") or "")
        put_call = str(h.get("putCall") or h.get("put_call") or "").upper() or "NONE"
        shares = float(h.get("sshPrnamt") or h.get("shares") or 0)
        sec = resolve_security(cusip, issuer) if cusip else {"ticker": None}
        holdings.append({
            "cusip": cusip, "ticker": sec.get("ticker"), "issuer_name": issuer,
            "shares": shares, "value": value,
            "put_call": "PUT" if put_call == "PUT" else "CALL" if put_call == "CALL" else "NONE",
        })

    total = sum(h["value"] for h in holdings) or 1
    holdings.sort(key=lambda x: x["value"], reverse=True)
    for i, h in enumerate(holdings):
        h["rank"] = i + 1
        h["pct_of_book"] = h["value"] / total * 100

    return {
        "accession": str(target.accession_no),
        "kind": "HR/A" if "A" in str(target.form) else "HR",
        "period": str(getattr(target, "period_of_report", ""))[:10],
        "filed_date": filed.isoformat(),
        "total_value": total,
        "holdings": holdings,
        "value_unit": holdings and unit or "dollars",
    }

def _to_date(v) -> date:
    if isinstance(v, date):
        return v
    try:
        return datetime.fromisoformat(str(v)[:10]).date()
    except Exception:
        return date.today()

def compute_deltas(cik: str, period: str, now_holdings: list[dict]) -> list[dict]:
    """Diff this period's book against the prior stored period."""
    prev = sb_get(f"holdings?cik=eq.{cik}&period=lt.{period}&order=period.desc&limit=500")
    prev_period = prev[0]["period"] if prev else None
    prev_map = {h["cusip"]: h for h in prev if h.get("period") == prev_period} if prev else {}
    now_map = {h["cusip"]: h for h in now_holdings if h["put_call"] == "NONE"}

    deltas = []
    for cusip in set(now_map) | set(prev_map):
        a, b = now_map.get(cusip), prev_map.get(cusip)
        sa = float(a["shares"]) if a else 0
        sb_ = float(b["shares"]) if b else 0
        if a and not b:      action = "NEW"
        elif b and not a:    action = "EXIT"
        elif sa > sb_:       action = "ADD"
        elif sa < sb_:       action = "TRIM"
        else:                action = "HOLD"
        pct_now = float(a["pct_of_book"]) if a else 0
        pct_prev = float(b["pct_of_book"]) if b else 0
        d_pct = pct_now - pct_prev
        rank = int(a["rank"]) if a else 999
        deltas.append({
            "cik": cik, "period": period, "prev_period": prev_period,
            "cusip": cusip, "ticker": (a or b).get("ticker"),
            "issuer_name": (a or b).get("issuer_name"), "action": action,
            "shares_prev": sb_, "shares_now": sa, "d_shares": sa - sb_,
            "value_now": float(a["value"]) if a else 0,
            "d_value": (float(a["value"]) if a else 0) - (float(b["value"]) if b else 0),
            "pct_book_prev": pct_prev, "pct_book_now": pct_now, "d_pct_book": d_pct,
            "is_new_top10": action == "NEW" and rank <= 10,
            "conviction_score": conviction(pct_now, rank, action, d_pct),
        })
    return deltas

def ingest_one(cik: str, period: Optional[str] = None) -> dict:
    parsed = _parse_13f(cik, period)
    if not parsed:
        return {"cik": cik, "status": "no_filing"}
    p = parsed["period"]
    sb_upsert("filings", [{
        "accession": parsed["accession"], "cik": cik, "kind": parsed["kind"],
        "period": p, "filed_date": parsed["filed_date"],
        "total_value": parsed["total_value"], "holdings_count": len(parsed["holdings"]),
        "value_unit_raw": parsed["value_unit"],
    }], on_conflict="accession")
    holdings_rows = [{
        "accession": parsed["accession"], "cik": cik, "period": p, **h,
    } for h in parsed["holdings"]]
    sb_upsert("holdings", holdings_rows, on_conflict="accession,cusip,put_call")
    deltas = compute_deltas(cik, p, parsed["holdings"])
    sb_upsert("holdings_delta", deltas, on_conflict="cik,period,cusip")
    sb_upsert("managers", [{
        "cik": cik, "aum_13f": parsed["total_value"], "last_filed_period": p,
        "updated_at": datetime.utcnow().isoformat(),
    }], on_conflict="cik")
    return {"cik": cik, "status": "ok", "period": p, "holdings": len(holdings_rows)}

# ── endpoints ─────────────────────────────────────────────────────────────────

@router.post("/ingest")
def ingest(body: IngestBody):
    if not body.cik:
        return {"error": "cik required"}
    return ingest_one(body.cik, body.period)

@router.post("/sweep")
def sweep(body: IngestBody):
    # ensure curated managers exist first
    sb_upsert("managers", [{
        "cik": c, "slug": s, "name": n, "manager": m, "type": t,
        "is_superinvestor": True, "is_curated": True,
    } for (c, s, n, m, t) in CURATED], on_conflict="cik")
    ok, failed, results = 0, 0, []
    for (c, *_rest) in CURATED:
        try:
            results.append(ingest_one(c, body.period))
            ok += 1
            time.sleep(0.2)  # SEC fair-access throttle
        except Exception as e:
            failed += 1
            results.append({"cik": c, "status": "error", "error": str(e)})
    return {"managers_ok": ok, "managers_failed": failed, "results": results}

@router.get("/health")
def health():
    mgrs = sb_get("managers?select=cik&limit=1")
    return {
        "supabase_configured": _configured(),
        "has_data": bool(mgrs),
        "cusip_cache": len(_cusip_cache),
    }
