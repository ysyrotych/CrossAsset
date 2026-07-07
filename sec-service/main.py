"""
SEC Analysis Microservice — powered by edgartools
FastAPI service that exposes 10-K / 10-Q data to the CrossAsset Next.js app.
"""

import asyncio
import html as html_module
import re
import xml.etree.ElementTree as ET
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
import concurrent.futures as _cf
FMP_API_KEY  = _os.environ.get("FMP_API_KEY", "").strip()
FMP_BASE     = "https://financialmodelingprep.com/stable"
FMP_V3       = "https://financialmodelingprep.com/api/v3"

KNOWN_PEERS: dict[str, list[str]] = {
    "META":  ["GOOGL", "SNAP", "PINS", "AMZN", "NFLX"],
    "AAPL":  ["MSFT", "GOOGL", "AMZN", "NVDA", "DELL"],
    "MSFT":  ["AAPL", "GOOGL", "AMZN", "ORCL", "CRM"],
    "GOOGL": ["META", "MSFT", "AMZN", "AAPL", "SNAP"],
    "GOOG":  ["META", "MSFT", "AMZN", "AAPL", "SNAP"],
    "AMZN":  ["MSFT", "GOOGL", "AAPL", "WMT", "COST"],
    "NVDA":  ["AMD", "INTC", "AVGO", "QCOM", "ARM"],
    "TSLA":  ["F", "GM", "RIVN", "BMW.DE", "TM"],
    "JPM":   ["BAC", "WFC", "GS", "C", "MS"],
    "JNJ":   ["PFE", "ABBV", "MRK", "BMY", "LLY"],
    "V":     ["MA", "AXP", "DFS", "PYPL", "SQ"],
    "WMT":   ["TGT", "COST", "AMZN", "KR", "DG"],
    "XOM":   ["CVX", "COP", "BP", "SHEL", "TTE"],
    "UNH":   ["CVS", "CI", "HUM", "ELV", "MOH"],
    "BRK-B": ["JPM", "BAC", "WFC", "AIG", "MET"],
    "UBER":  ["LYFT", "ABNB", "DASH", "BKNG", "EXPE"],
    "NFLX":  ["DIS", "PARA", "WBD", "SPOT", "AMZN"],
    "PYPL":  ["V", "MA", "SQ", "AFRM", "SOFI"],
    "HOOD":  ["SCHW", "IBKR", "AMTD", "ETSY", "COIN"],
    "COIN":  ["MSTR", "RIOT", "MARA", "CLSK", "HUT"],
    "DUOL":  ["CHGG", "TAL", "EDU", "UDMY", "COURSERA"],
    "CMG":   ["MCD", "SBUX", "YUM", "QSR", "DPZ"],
}

def _normalize_date(raw: str) -> str:
    """Convert various date formats to YYYY-MM-DD for consistent sorting."""
    if not raw:
        return ""
    raw = raw.strip()
    # Already ISO
    if re.match(r"^\d{4}-\d{2}-\d{2}", raw):
        return raw[:10]
    from datetime import datetime
    # Finviz: Jun-15-25
    try:
        return datetime.strptime(raw[:9], "%b-%d-%y").strftime("%Y-%m-%d")
    except Exception:
        pass
    # RFC 2822: Mon, 01 Jan 2024 00:00:00 +0000
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z",
                "%d %b %Y %H:%M:%S %z", "%d %b %Y"):
        try:
            return datetime.strptime(raw[:31].strip(), fmt).strftime("%Y-%m-%d")
        except Exception:
            pass
    # ISO with T: 2024-01-15T10:30:00Z
    try:
        return raw[:10]
    except Exception:
        return ""


def _categorize_news(title: str) -> str:
    t = title.lower()
    if any(w in t for w in ["earnings", "eps", "q1", "q2", "q3", "q4", "quarterly", "results", "beat", "miss"]):
        return "EARNINGS"
    if any(w in t for w in ["guidance", "outlook", "forecast", "raises", "lowers", "reaffirms", "cuts guide"]):
        return "GUIDANCE"
    if any(w in t for w in ["upgrade", "downgrade", "overweight", "underweight", "outperform", "target price", "price target"]):
        return "ANALYST ACTION"
    if any(w in t for w in ["acqui", "merger", "buyout", "takeover", "divest", "spin-off", "spinoff"]):
        return "M&A"
    if any(w in t for w in ["fda", "sec ", "ftc", "doj", "regul", "antitrust", "fine", "probe", "investig", "lawsuit", "legal", "settlement"]):
        return "REGULATORY/LEGAL"
    if any(w in t for w in ["ceo", "cfo", "coo", "president", "appoint", "resign", "depart", "hire", "board", "director"]):
        return "MANAGEMENT"
    if any(w in t for w in ["buyback", "repurchase", "dividend", "capital return", "share repurchase"]):
        return "CAPITAL ALLOCATION"
    if any(w in t for w in ["insider", "sold shares", "purchased shares", "form 4"]):
        return "INSIDER ACTIVITY"
    if any(w in t for w in ["launch", "product", "partnership", "contract", "win", "customer", "agreement"]):
        return "PRODUCT/BUSINESS"
    return "GENERAL"


def get_news_combined(ticker: str) -> list:
    """Aggregate news from yfinance, Finviz, and Seeking Alpha RSS. Deduplicate by title prefix."""
    results: dict = {}

    # 1. yfinance — 10 items with real article summaries
    if YF_AVAILABLE:
        try:
            yft = yf.Ticker(ticker)
            for n in (yft.news or []):
                c = n.get("content", {})
                title = (c.get("title") or "").strip()
                if not title:
                    continue
                key = title[:60]
                results[key] = {
                    "date":         _normalize_date(c.get("pubDate") or ""),
                    "title":        title,
                    "summary":      c.get("summary", "") or "",
                    "source":       (c.get("provider") or {}).get("displayName", ""),
                    "url":          (c.get("canonicalUrl") or {}).get("url", ""),
                    "stock_change": None,
                    "category":     _categorize_news(title),
                }
        except Exception as e:
            print(f"yfinance news error for {ticker}: {e}")

    # 2. Finviz — up to 100 items with stock-move % labels
    try:
        r = httpx.get(
            f"https://finviz.com/quote.ashx?t={ticker}",
            timeout=12,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
            follow_redirects=True,
        )
        idx = r.text.find('id="news-table"')
        if idx >= 0:
            table_end = r.text.find("</table>", idx)
            segment = r.text[idx:table_end] if table_end > idx else r.text[idx:idx + 60000]
            rows = re.split(r"<tr\b", segment)[1:]
            cur_date = ""
            for row in rows:
                dm = re.search(r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d+-\d+)", row)
                if dm:
                    cur_date = dm.group(1)
                hm = re.search(r'tab-link-news"[^>]*>\s*([^<]+)\s*</a>', row)
                sm = re.search(r"<span>\(([^)]+)\)</span>", row)
                cm = re.search(r"(?:is-positive|is-negative)-\d+[^>]*>\s*([\+\-][0-9.]+%)", row)
                if hm:
                    title = hm.group(1).strip()
                    key = title[:60]
                    if key not in results:
                        results[key] = {
                            "date":         _normalize_date(cur_date),
                            "title":        title,
                            "summary":      "",
                            "source":       sm.group(1) if sm else "",
                            "url":          "",
                            "stock_change": cm.group(1) if cm else None,
                            "category":     _categorize_news(title),
                        }
                    elif cm and not results[key].get("stock_change"):
                        results[key]["stock_change"] = cm.group(1)
    except Exception as e:
        print(f"Finviz news error for {ticker}: {e}")

    # 3. Seeking Alpha RSS — analyst opinion quality
    try:
        r = httpx.get(
            f"https://seekingalpha.com/api/sa/combined/{ticker}.xml",
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"},
            follow_redirects=True,
        )
        if r.status_code == 200:
            root = ET.fromstring(r.content)
            channel = root.find("channel")
            items_xml = channel.findall("item") if channel is not None else root.findall(".//item")
            for item in items_xml:
                title = (item.findtext("title") or "").strip()
                if not title:
                    continue
                key = title[:60]
                if key not in results:
                    results[key] = {
                        "date":         _normalize_date(item.findtext("pubDate") or ""),
                        "title":        title,
                        "summary":      (item.findtext("description") or item.findtext("{http://purl.org/rss/1.0/modules/content/}encoded") or "")[:300].strip(),
                        "source":       "Seeking Alpha",
                        "url":          item.findtext("link") or "",
                        "stock_change": None,
                        "category":     _categorize_news(title),
                    }
    except Exception as e:
        print(f"Seeking Alpha RSS error for {ticker}: {e}")

    items = sorted(results.values(), key=lambda x: x.get("date", ""), reverse=True)
    print(f"news_combined for {ticker}: {len(items)} items (yf+finviz+sa)")
    return items[:40]


def get_fmp_financials(ticker: str) -> dict:
    """
    Fetch comprehensive data from FMP.
    Statements/profile/news use the stable API (symbol param).
    Key-metrics, financial-growth, earnings-surprises use v3 (path-based).
    """
    if not FMP_API_KEY:
        print(f"FMP_API_KEY not set — skipping FMP for {ticker}")
        return {}
    try:
        # ── Stable API helpers (symbol= query param) ──────────────────────────
        def _qs(extra: dict = None, limit: int = None) -> str:
            p = {"symbol": ticker, "apikey": FMP_API_KEY}
            if limit is not None:
                p["limit"] = limit
            if extra:
                p.update(extra)
            return "&".join(f"{k}={v}" for k, v in p.items())

        def fetch(endpoint: str, extra: dict = None, limit: int = 6) -> list:
            url = f"{FMP_BASE}/{endpoint}?{_qs(extra, limit)}"
            r = httpx.get(url, timeout=25, headers={"User-Agent": "CrossAsset/1.0"})
            if r.status_code != 200:
                print(f"FMP {endpoint}: HTTP {r.status_code} — {r.text[:200]}")
                return []
            data = r.json()
            return data if isinstance(data, list) else []

        def fetch_one(endpoint: str, extra: dict = None) -> dict:
            url = f"{FMP_BASE}/{endpoint}?{_qs(extra)}"
            r = httpx.get(url, timeout=15, headers={"User-Agent": "CrossAsset/1.0"})
            if r.status_code != 200:
                print(f"FMP {endpoint} (one): HTTP {r.status_code} — {r.text[:200]}")
                return {}
            data = r.json()
            if isinstance(data, list):
                return data[0] if data else {}
            return data if isinstance(data, dict) else {}

        # ── v3 API helpers (/{ticker}/ path-based) ────────────────────────────
        def fetch_v3(endpoint: str, limit: int = 6, extra: dict = None) -> list:
            params = f"apikey={FMP_API_KEY}&limit={limit}"
            if extra:
                params += "&" + "&".join(f"{k}={v}" for k, v in extra.items())
            url = f"{FMP_V3}/{endpoint}/{ticker}?{params}"
            r = httpx.get(url, timeout=25, headers={"User-Agent": "CrossAsset/1.0"})
            if r.status_code != 200:
                print(f"FMP v3 {endpoint}: HTTP {r.status_code} — {r.text[:200]}")
                return []
            data = r.json()
            return data if isinstance(data, list) else []

        def fetch_v3_one(endpoint: str) -> dict:
            url = f"{FMP_V3}/{endpoint}/{ticker}?apikey={FMP_API_KEY}"
            r = httpx.get(url, timeout=15, headers={"User-Agent": "CrossAsset/1.0"})
            if r.status_code != 200:
                return {}
            data = r.json()
            if isinstance(data, list):
                return data[0] if data else {}
            return data if isinstance(data, dict) else {}

        with _cf.ThreadPoolExecutor(max_workers=18) as ex:
            fs = {
                "inc_a":     ex.submit(fetch, "income-statement"),
                "bal_a":     ex.submit(fetch, "balance-sheet-statement"),
                "cf_a":      ex.submit(fetch, "cash-flow-statement"),
                "inc_q":     ex.submit(fetch, "income-statement",         {"period": "quarterly"}),
                "bal_q":     ex.submit(fetch, "balance-sheet-statement",  {"period": "quarterly"}),
                "cf_q":      ex.submit(fetch, "cash-flow-statement",      {"period": "quarterly"}),
                "profile":   ex.submit(fetch_one, "profile"),
                # Try stable key-metrics; v3 as fallback is skipped (rate limit conservation)
                "km":        ex.submit(fetch, "key-metrics", {"period": "annual"}, 8),
                "km_ttm":    ex.submit(fetch, "key-metrics-ttm", None, 1),
                "growth":    ex.submit(fetch, "financial-growth", {"period": "annual"}, 6),
                "ratios":    ex.submit(fetch, "ratios", {"period": "annual"}, 6),
                "estimates": ex.submit(fetch, "analyst-estimates", None, 4),
                "rating":    ex.submit(fetch_one, "ratings"),
                "pt":        ex.submit(fetch_one, "price-target-summary"),
                "earnings":  ex.submit(fetch, "earnings-surprises", None, 8),
                "segments":  ex.submit(fetch, "revenue-product-segmentation", None, 3),
                "geo_segs":  ex.submit(fetch, "revenue-geographic-segmentation", None, 3),
                "news":      ex.submit(fetch, "stock-news", None, 12),
                "peers":     ex.submit(fetch, "stock-peers", None, 15),
                "transcript": ex.submit(fetch_v3, "earning_call_transcript", 1),
                "insider":   ex.submit(fetch, "insider-trading", None, 20),
                "rec":       ex.submit(fetch_v3, "analyst-stock-recommendations", 1),
            }
            res = {k: v.result() for k, v in fs.items()}

        # ── Peer key-metrics via v3 ───────────────────────────────────────────
        peer_comparison: list = []
        peers_raw = res.get("peers", [])
        if isinstance(peers_raw, list):
            peer_symbols = [p["symbol"] for p in peers_raw if isinstance(p, dict) and p.get("symbol")][:6]
        elif isinstance(peers_raw, dict):
            peer_symbols = peers_raw.get("peersList", [])[:6]
        else:
            peer_symbols = []
        print(f"FMP peers for {ticker}: {peer_symbols}")

        # Prefer curated KNOWN_PEERS over FMP suggestions for tickers we explicitly define
        known = KNOWN_PEERS.get(ticker.upper())
        if known:
            peer_symbols = known[:6]
            print(f"Overriding FMP peers with KNOWN_PEERS for {ticker}: {peer_symbols}")

        if peer_symbols:
            def fetch_peer_data(sym: str) -> dict:
                try:
                    url_km    = f"{FMP_BASE}/key-metrics?symbol={sym}&period=annual&limit=1&apikey={FMP_API_KEY}"
                    url_km_v3 = f"{FMP_V3}/key-metrics/{sym}?period=annual&limit=1&apikey={FMP_API_KEY}"
                    url_rat   = f"{FMP_BASE}/ratios?symbol={sym}&period=annual&limit=1&apikey={FMP_API_KEY}"
                    url_pr    = f"{FMP_BASE}/profile?symbol={sym}&apikey={FMP_API_KEY}"
                    rk  = httpx.get(url_km,    timeout=12, headers={"User-Agent": "CrossAsset/1.0"})
                    rp  = httpx.get(url_pr,    timeout=12, headers={"User-Agent": "CrossAsset/1.0"})
                    rr  = httpx.get(url_rat,   timeout=12, headers={"User-Agent": "CrossAsset/1.0"})
                    km_item = {}
                    pr_item = {}
                    rat_item = {}
                    if rk.status_code == 200:
                        dk = rk.json()
                        km_item = dk[0] if isinstance(dk, list) and dk else {}
                    # If stable key-metrics came back empty, try v3
                    if not km_item:
                        try:
                            rk3 = httpx.get(url_km_v3, timeout=12, headers={"User-Agent": "CrossAsset/1.0"})
                            if rk3.status_code == 200:
                                dk3 = rk3.json()
                                km_item = dk3[0] if isinstance(dk3, list) and dk3 else {}
                        except Exception:
                            pass
                    if rr.status_code == 200:
                        dr = rr.json()
                        rat_item = dr[0] if isinstance(dr, list) and dr else {}
                    if rp.status_code == 200:
                        dp = rp.json()
                        pr_item = dp[0] if isinstance(dp, list) and dp else (dp if isinstance(dp, dict) else {})
                    # Merge ratios into km so _peer_val can find fields from either source
                    merged = {**rat_item, **km_item}
                    return {"km": merged, "pr": pr_item}
                except Exception as e:
                    print(f"Peer fetch error for {sym}: {e}")
                    return {"km": {}, "pr": {}}

            with _cf.ThreadPoolExecutor(max_workers=6) as ex2:
                peer_data_fs = {sym: ex2.submit(fetch_peer_data, sym) for sym in peer_symbols}
                peer_data_map = {sym: f.result() for sym, f in peer_data_fs.items()}

            def _peer_val(km, *keys):
                for k in keys:
                    v = safe_float(km.get(k))
                    if v is not None:
                        return v
                return None

            for sym in peer_symbols:
                pd = peer_data_map.get(sym, {})
                km = pd.get("km", {})
                pr = pd.get("pr", {})
                if km or pr:
                    pe    = _peer_val(km, "peRatioTTM", "peRatio", "priceEarningsRatioTTM", "priceEarningsRatio", "pe", "priceToEarningsRatio")
                    ev_e  = _peer_val(km, "enterpriseValueOverEBITDATTM", "enterpriseValueOverEBITDA", "evToEbitda", "evEbitda", "enterpriseValueMultiple", "enterpriseValueMultipleTTM")
                    p_fcf = _peer_val(km, "pfcfRatioTTM", "pfcfRatio", "priceToFreeCashFlowsRatio", "priceToFreeCashFlowsTTM", "priceToFreeCashFlow", "priceFreeCashFlowRatio")
                    roic  = _peer_val(km, "roicTTM", "roic", "returnOnInvestedCapital", "returnOnInvestedCapitalTTM")
                    npm   = _peer_val(km, "netProfitMarginTTM", "netProfitMargin", "netIncomePerEBT", "netProfitMarginPercentage", "profitMargin")
                    rev_g = _peer_val(km, "revenueGrowthTTM", "revenueGrowth", "revenuePerShareGrowth", "revenueGrowthAnnual")
                    gpm   = _peer_val(km, "grossProfitMarginTTM", "grossProfitMargin", "grossProfitRatio", "grossMargin")
                    rpe   = _peer_val(km, "revenuePerEmployee")
                    mc    = safe_float(pr.get("marketCap") or pr.get("mktCap"))
                    # Fallback: compute PE from marketCap / netIncome if km doesn't have it
                    if not pe and mc and km:
                        ni_km = safe_float(km.get("netIncome") or km.get("netIncomePerShare"))
                        shares = safe_float(km.get("sharesOutstanding") or km.get("weightedAverageSharesDiluted"))
                        pr_price = safe_float(pr.get("price"))
                        if ni_km and shares and shares > 0:
                            pe = round(mc / (ni_km * shares), 1) if ni_km < 1000 else round(mc / ni_km, 1)
                    peer_comparison.append({
                        "symbol":       sym,
                        "name":         pr.get("companyName", sym),
                        "pe":           round(pe, 1) if pe else None,
                        "ev_ebitda":    round(ev_e, 1) if ev_e else None,
                        "p_fcf":        round(p_fcf, 1) if p_fcf else None,
                        "roic":         round(roic * 100, 1) if roic is not None else None,
                        "net_margin":   round(npm * 100, 1) if npm is not None else None,
                        "gross_margin": round(gpm * 100, 1) if gpm is not None else None,
                        "rev_per_emp":  round(rpe / 1000, 0) if rpe is not None else None,  # in $K
                        "market_cap":   mc,
                        "revenue_growth":   round(rev_g * 100, 1) if rev_g is not None else None,
                    })

        # ── yfinance peer fallback when FMP returns no peers ─────────────────
        if not peer_comparison and YF_AVAILABLE:
            fallback_syms = KNOWN_PEERS.get(ticker.upper(), [])[:5]
            if fallback_syms:
                def _fetch_yf_peer(sym: str) -> dict:
                    try:
                        info = yf.Ticker(sym).info
                        if not info: return {}
                        mc   = safe_float(info.get("marketCap"))
                        pe   = safe_float(info.get("trailingPE"))
                        ev_e = safe_float(info.get("enterpriseToEbitda"))
                        # profitMargins is more reliably populated than netMargins
                        npm  = safe_float(info.get("profitMargins") or info.get("netMargins"))
                        rev_g= safe_float(info.get("revenueGrowth"))
                        roic = safe_float(info.get("returnOnInvestedCapital") or info.get("returnOnEquity"))
                        # Compute P/FCF from marketCap / freeCashflow when ratio not directly available
                        # Cap at 100x: yfinance sometimes returns quarterly FCF, inflating ratio
                        p_fcf= safe_float(info.get("priceToFreeCashflows") or info.get("priceToFreeCashFlow"))
                        if not p_fcf and mc:
                            fcf = safe_float(info.get("freeCashflow"))
                            if fcf and fcf > 0:
                                computed = mc / fcf
                                p_fcf = computed if computed <= 100 else None
                        gpm  = safe_float(info.get("grossMargins") or info.get("grossProfitMargin"))
                        rev  = safe_float(info.get("totalRevenue") or info.get("revenue"))
                        emp  = safe_float(info.get("fullTimeEmployees"))
                        rpe  = round(rev / emp / 1000, 0) if rev and emp and emp > 0 else None
                        name = info.get("longName") or info.get("shortName") or sym
                        return {
                            "symbol":       sym,
                            "name":         name,
                            "pe":           round(pe, 1) if pe and pe > 0 else None,
                            "ev_ebitda":    round(ev_e, 1) if ev_e and ev_e > 0 else None,
                            "p_fcf":        round(p_fcf, 1) if p_fcf and p_fcf > 0 else None,
                            "roic":         round(roic * 100, 1) if roic else None,
                            "net_margin":   round(npm * 100, 1) if npm else None,
                            "gross_margin": round(gpm * 100, 1) if gpm else None,
                            "rev_per_emp":  rpe,
                            "market_cap":   mc,
                            "revenue_growth":   round(rev_g * 100, 1) if rev_g is not None else None,
                        }
                    except Exception as e:
                        print(f"yfinance peer error for {sym}: {e}")
                        return {}
                with _cf.ThreadPoolExecutor(max_workers=5) as ex_yf:
                    yf_peer_futs = {s: ex_yf.submit(_fetch_yf_peer, s) for s in fallback_syms}
                    for s, fut in yf_peer_futs.items():
                        p = fut.result()
                        if p:
                            peer_comparison.append(p)
                print(f"yfinance peer fallback for {ticker}: {[p['symbol'] for p in peer_comparison]}")

        has_statements = bool(res["inc_a"])
        print(f"FMP {ticker}: stmts={'yes' if has_statements else 'NO'} | km={len(res['km'])} | ratios={len(res['ratios'])} | growth={len(res['growth'])} | earnings={len(res['earnings'])} | peers={len(peer_comparison)}")
        return {
            "income_annual":     res["inc_a"],
            "balance_annual":    res["bal_a"],
            "cashflow_annual":   res["cf_a"],
            "income_quarterly":  res["inc_q"],
            "balance_quarterly": res["bal_q"],
            "cashflow_quarterly":res["cf_q"],
            "profile":           res["profile"],
            "key_metrics":       res["km"],
            "km_ttm":            res["km_ttm"],
            "ratios":            res["ratios"],
            "financial_growth":  res["growth"],
            "analyst_estimates": res["estimates"],
            "rating":            res["rating"],
            "price_target":      res["pt"],
            "earnings":          res["earnings"],
            "segments":          res["segments"],
            "geo_segments":      res["geo_segs"],
            "news":              res["news"],
            "peer_comparison":   peer_comparison,
            "transcript_raw":    res.get("transcript", []),
            "insider_trading":   res.get("insider", []),
            "analyst_rec":       res.get("rec", []),
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

    # ── Quarterly trend (last 8 quarters for seasonality analysis) ───────────
    q_trend = []
    for qi, qp in enumerate(inc_q[:8]):
        dt = (qp.get("date","") or "")[:10]
        if not dt:
            continue
        cqp = cf_q[qi] if qi < len(cf_q) else {}
        rv = safe_float(qp.get("revenue"))
        gp = safe_float(qp.get("grossProfit"))
        oi = safe_float(qp.get("operatingIncome"))
        ni = safe_float(qp.get("netIncome"))
        ep = safe_float(qp.get("epsDiluted"))
        fc = safe_float(cqp.get("freeCashFlow"))
        sbc_q = safe_float(cqp.get("stockBasedCompensation"))
        entry: dict = {"date": dt}
        if rv is not None: entry["revenue"] = rv
        if gp is not None: entry["gross_profit"] = gp
        if oi is not None: entry["operating_income"] = oi
        if ni is not None: entry["net_income"] = ni
        if ep is not None: entry["eps_diluted"] = ep
        if fc is not None: entry["free_cash_flow"] = fc
        if sbc_q is not None and fc is not None: entry["sbc_adjusted_fcf"] = fc - sbc_q
        if rv and rv > 0:
            if gp: entry["gross_margin_pct"] = round(gp/rv*100, 1)
            if oi: entry["operating_margin_pct"] = round(oi/rv*100, 1)
            if ni: entry["net_margin_pct"] = round(ni/rv*100, 1)
        q_trend.append(entry)
    if q_trend:
        q_trend.reverse()  # oldest first
        q_trend_obj: dict = {"quarters": q_trend}
        # Add key export for frontend
        pass

    # ── Extended data (profile, valuation, analyst) ───────────────────────────
    fmp_ext: dict = {}

    profile = fmp.get("profile", {})
    if profile:
        print(f"FMP profile keys: {list(profile.keys())[:20]}")
        # Try both stable API and legacy v3 field names
        for k, candidates in [
            ("ceo",                ["ceo", "ceoName"]),
            ("sector",             ["sector"]),
            ("fmp_industry",       ["industry", "industryType"]),
            ("country",            ["country", "countryCode"]),
            ("exchange",           ["exchangeShortName", "exchange"]),
            ("website",            ["website"]),
            ("ipo_date",           ["ipoDate"]),
            ("company_description",["description", "longDescription"]),
        ]:
            for pk in candidates:
                v = profile.get(pk)
                if v:
                    fmp_ext[k] = v
                    break
        mc = safe_float(profile.get("marketCap") or profile.get("mktCap") or profile.get("marketCapitalization"))
        if mc: facts["market_cap"] = mc
        beta = safe_float(profile.get("beta"))
        if beta: facts["beta"] = beta
        price = safe_float(profile.get("price"))
        if price: facts["stock_price"] = price
        emp = profile.get("fullTimeEmployees") or profile.get("employees")
        if emp:
            try:
                facts["employees"] = float(str(emp).replace(",", ""))
            except Exception:
                pass

    km_list = fmp.get("key_metrics", [])
    ratios_list = fmp.get("ratios", [])
    km_ttm_list = fmp.get("km_ttm", [])

    # Merge TTM into km_list[0] if km_list is empty
    if not km_list and km_ttm_list:
        km_list = km_ttm_list

    if km_list:
        km = km_list[0]
        # Also merge ratios[0] into km for broader field coverage
        if ratios_list:
            for k2, v2 in ratios_list[0].items():
                if k2 not in km or km[k2] is None:
                    km[k2] = v2
        print(f"FMP km keys: {list(km.keys())[:25]}")
        def _km(candidates):
            for fk in candidates:
                v = safe_float(km.get(fk))
                if v is not None:
                    return v
            return None
        for k, candidates in [
            ("pe_ratio",        ["peRatio", "priceEarningsRatio", "pe", "priceToEarningsRatio", "priceEarnings"]),
            ("p_sales",         ["priceToSalesRatio", "priceSalesRatio", "ps", "priceToSales"]),
            ("p_fcf",           ["pfcfRatio", "priceToFreeCashFlowsRatio", "pfcf", "priceToFreeCashFlow", "priceFreeCashFlow"]),
            ("p_book",          ["pbRatio", "priceToBookRatio", "pb", "priceToBook"]),
            ("enterprise_value",["enterpriseValue", "ev", "enterpriseVal"]),
            ("ev_ebitda",       ["enterpriseValueOverEBITDA", "evEbitda", "evToEbitda", "evToEBITDA", "enterpriseValueMultiple"]),
            ("ev_revenue",      ["evToSales", "evToRevenue", "evSales", "enterpriseValueToRevenue"]),
            ("current_ratio",   ["currentRatio"]),
            ("debt_to_equity",  ["debtToEquity", "debtEquityRatio", "totalDebtToEquity"]),
            ("interest_coverage",["interestCoverage", "interestCoverageRatio"]),
            ("income_quality",  ["incomeQuality", "accruals"]),
        ]:
            v = _km(candidates)
            if v is not None: facts[k] = round(v, 2)
        for k, candidates in [
            ("roic",         ["roic", "returnOnInvestedCapital", "returnOnCapitalEmployed"]),
            ("roe_km",       ["roe", "returnOnEquity"]),
            ("dividend_yield",["dividendYield", "dividendYielPercentage", "dividendYieldPercentage"]),
            ("fcf_yield",    ["freeCashFlowYield", "fcfYield", "freeCashFlowToEquity"]),
        ]:
            v = _km(candidates)
            if v is not None: facts[k] = round(v * 100, 2)
        # Build historical multiples — merge km_list and ratios_list by date
        ratios_by_date = {p.get("date","")[:10]: p for p in (ratios_list or [])}
        km_hist = []
        for p in km_list[:8]:
            dt = p.get("date","")[:10]
            r = ratios_by_date.get(dt, {})
            def _kv(*keys):
                for k3 in keys:
                    v3 = safe_float(p.get(k3)) or safe_float(r.get(k3))
                    if v3 is not None:
                        return v3
                return None
            pe_v   = _kv("peRatio","priceEarningsRatio","pe","priceToEarningsRatio")
            ev_v   = _kv("enterpriseValueOverEBITDA","evEbitda","evToEbitda")
            roic_v = _kv("roic","returnOnInvestedCapital")
            pfcf_v = _kv("pfcfRatio","priceToFreeCashFlowsRatio","priceToFreeCashFlow")
            cr_v   = _kv("currentRatio")
            de_v   = _kv("debtToEquity","debtEquityRatio")
            km_hist.append({
                "date":          dt,
                "pe":            round(pe_v, 1) if pe_v else None,
                "ev_ebitda":     round(ev_v, 1) if ev_v else None,
                "roic":          round(roic_v * 100, 1) if roic_v else None,
                "p_fcf":         round(pfcf_v, 1) if pfcf_v else None,
                "current_ratio": round(cr_v, 2) if cr_v else None,
                "debt_equity":   round(de_v, 2) if de_v else None,
            })
        if km_hist:
            fmp_ext["km_history"] = km_hist

    growth_list = fmp.get("financial_growth", [])
    if growth_list:
        fg = growth_list[0]
        for k, fk in [("revenue_growth_yoy","revenueGrowth"),
                      ("eps_growth_yoy","epsgrowth"),
                      ("fcf_growth_yoy","freeCashFlowGrowth"),
                      ("ni_growth_yoy","netIncomeGrowth"),
                      ("ocf_growth_yoy","operatingCashFlowGrowth")]:
            v = safe_float(fg.get(fk))
            if v is not None: facts[k] = round(v * 100, 1)
        # growth history for trend
        gh = []
        for p in growth_list[:6]:
            gh.append({
                "date": p.get("date","")[:10],
                "revenue_growth": round((safe_float(p.get("revenueGrowth")) or 0) * 100, 1),
                "eps_growth": round((safe_float(p.get("epsgrowth")) or 0) * 100, 1),
                "fcf_growth": round((safe_float(p.get("freeCashFlowGrowth")) or 0) * 100, 1),
            })
        if gh:
            fmp_ext["growth_history"] = gh

    # Fallback: compute growth_history from income_annual when financial-growth is empty
    if not fmp_ext.get("growth_history") and len(inc_a) >= 2:
        gh_computed = []
        for i in range(len(inc_a) - 1):
            curr, prev = inc_a[i], inc_a[i + 1]
            dt = (curr.get("date", "") or "")[:10]
            if not dt:
                continue
            rev_c  = safe_float(curr.get("revenue"))
            rev_p  = safe_float(prev.get("revenue"))
            eps_c  = safe_float(curr.get("epsDiluted"))
            eps_p  = safe_float(prev.get("epsDiluted"))
            fcf_c  = safe_float(curr.get("freeCashFlow"))
            fcf_p  = safe_float(prev.get("freeCashFlow"))
            def _g(c, p):
                if c and p and p != 0:
                    return round((c - p) / abs(p) * 100, 1)
                return 0.0
            gh_computed.append({
                "date": dt,
                "revenue_growth": _g(rev_c, rev_p),
                "eps_growth": _g(eps_c, eps_p),
                "fcf_growth": _g(fcf_c, fcf_p),
            })
            # Also fill YoY growth facts from most recent
            if i == 0:
                if not facts.get("revenue_growth_yoy") and rev_c and rev_p and rev_p != 0:
                    facts["revenue_growth_yoy"] = _g(rev_c, rev_p)
                if not facts.get("eps_growth_yoy") and eps_c and eps_p and eps_p != 0:
                    facts["eps_growth_yoy"] = _g(eps_c, eps_p)
        if gh_computed:
            gh_computed.reverse()  # oldest first
            fmp_ext["growth_history"] = gh_computed

    estimates = fmp.get("analyst_estimates", [])
    if estimates:
        ne = estimates[0]
        for k, ek in [("rev_est_next","estimatedRevenueAvg"),
                      ("ebitda_est_next","estimatedEbitdaAvg"),
                      ("eps_est_next","estimatedEpsAverage"),
                      ("ni_est_next","estimatedNetIncomeAvg")]:
            v = safe_float(ne.get(ek))
            if v is not None: facts[k] = v
        na = safe_float(ne.get("numberAnalystEstimatedRevenue"))
        if na: facts["num_analysts"] = na
        # store full estimates array for primer
        fmp_ext["analyst_estimates"] = [
            {
                "date": p.get("date","")[:10],
                "rev_avg": safe_float(p.get("estimatedRevenueAvg")),
                "eps_avg": safe_float(p.get("estimatedEpsAverage")),
                "ebitda_avg": safe_float(p.get("estimatedEbitdaAvg")),
                "num_analysts": safe_float(p.get("numberAnalystEstimatedRevenue")),
            }
            for p in estimates[:4]
        ]

    rating = fmp.get("rating", {})
    if rating:
        fmp_ext["fmp_rating"] = rating.get("ratingRecommendation", "")
        v = safe_float(rating.get("ratingScore"))
        if v: facts["fmp_rating_score"] = v

    pt = fmp.get("price_target", {})
    if pt:
        for k, pk in [("pt_consensus","lastMonthAvgPriceTarget"),
                      ("pt_last_month","lastMonth"),
                      ("pt_last_quarter","lastQuarterAvgPriceTarget"),
                      ("pt_high","lastMonthHighPriceTarget"),
                      ("pt_low","lastMonthLowPriceTarget")]:
            v = safe_float(pt.get(pk))
            if v: facts[k] = v

    raw_earnings = fmp.get("earnings", [])
    if raw_earnings:
        surprises = []
        for p in raw_earnings[:8]:
            actual = safe_float(
                p.get("actualEarningResult") or p.get("actual") or p.get("actualEps") or
                p.get("reportedEPS") or p.get("eps")
            )
            est = safe_float(
                p.get("estimatedEarning") or p.get("estimate") or p.get("estimatedEps") or
                p.get("estimatedEPS") or p.get("consensusEPS")
            )
            dt = (p.get("date") or p.get("fiscalDateEnding") or p.get("reportedDate") or "")[:10]
            if not dt:
                continue
            surp = None
            if actual is not None and est is not None and est != 0:
                surp = round((actual - est) / abs(est) * 100, 1)
            surprises.append({"date": dt, "eps_actual": actual, "eps_est": est, "surprise_pct": surp})
        if surprises:
            fmp_ext["earnings_surprises"] = surprises

    # Revenue segments — FMP returns {date, segName: value} or {date, segName: {value: ...}}
    # Exclude metadata keys: date, fiscalYear, symbol, period, reportedCurrency
    _META_KEYS = {"date", "fiscalYear", "fiscal_year", "symbol", "period", "reportedCurrency", "cik", "acceptedDate", "link", "finalLink", "data", "total"}

    def _extract_seg_data(item: dict) -> dict:
        """Extract {segment_name: value} from one FMP segment period."""
        seg_data: dict = {}
        for k, v in item.items():
            if k in _META_KEYS:
                continue
            if isinstance(v, dict):
                inner = v.get("revenue") or v.get("value") or (list(v.values())[0] if v else None)
                if inner is not None:
                    fv = safe_float(inner)
                    if fv and fv > 1e6:
                        seg_data[k] = fv
            elif isinstance(v, (int, float)) and v > 1e6:
                seg_data[k] = v
        return seg_data

    def _parse_seg(raw_list: list) -> dict:
        if not raw_list:
            return {}
        latest = raw_list[0] if isinstance(raw_list[0], dict) else {}
        seg_data = _extract_seg_data(latest)
        if not seg_data:
            return {}
        return {"date": latest.get("date", ""), "data": seg_data}

    def _parse_seg_history(raw_list: list) -> list:
        """Return all available periods sorted by date ascending."""
        out = []
        for item in raw_list:
            if not isinstance(item, dict):
                continue
            seg_data = _extract_seg_data(item)
            if seg_data:
                out.append({"date": item.get("date", ""), "data": seg_data})
        return sorted(out, key=lambda x: x["date"])

    raw_segs = fmp.get("segments", [])
    parsed_segs = _parse_seg(raw_segs)
    if parsed_segs:
        fmp_ext["segments"] = parsed_segs
    seg_history = _parse_seg_history(raw_segs)
    if len(seg_history) > 1:
        fmp_ext["segment_history"] = seg_history

    raw_geo = fmp.get("geo_segments", [])
    parsed_geo = _parse_seg(raw_geo)
    if parsed_geo:
        fmp_ext["geo_segments"] = parsed_geo
    geo_history = _parse_seg_history(raw_geo)
    if len(geo_history) > 1:
        fmp_ext["geo_segment_history"] = geo_history

    # Recent news
    raw_news = fmp.get("news", [])
    if raw_news:
        fmp_ext["recent_news"] = [
            {
                "title":   p.get("title", ""),
                "date":    (p.get("publishedDate") or p.get("date") or p.get("publishDate") or "")[:10],
                "summary": (p.get("text") or p.get("summary") or p.get("description") or "")[:200],
                "source":  p.get("site") or p.get("source") or "",
            }
            for p in raw_news[:10] if p.get("title")
        ]

    # Peer comparison (pre-fetched in get_fmp_financials)
    peer_comp = fmp.get("peer_comparison", [])
    if peer_comp:
        fmp_ext["peer_comparison"] = peer_comp

    # Analyst recommendation breakdown (buy/hold/sell counts)
    raw_rec = fmp.get("analyst_rec", [])
    if raw_rec:
        rec = raw_rec[0] if isinstance(raw_rec, list) and raw_rec else {}
        if isinstance(rec, dict):
            strong_buy = int(safe_float(rec.get("strongBuy") or rec.get("strong_buy") or 0) or 0)
            buy        = int(safe_float(rec.get("buy") or 0) or 0)
            hold       = int(safe_float(rec.get("hold") or 0) or 0)
            sell       = int(safe_float(rec.get("sell") or 0) or 0)
            strong_sell= int(safe_float(rec.get("strongSell") or rec.get("strong_sell") or 0) or 0)
            total = strong_buy + buy + hold + sell + strong_sell
            if total > 0:
                fmp_ext["analyst_rec"] = {
                    "strong_buy": strong_buy, "buy": buy, "hold": hold,
                    "sell": sell, "strong_sell": strong_sell, "total": total,
                    "date": (rec.get("date") or "")[:10],
                }

    # Insider trading (last 20 Form 4 transactions)
    raw_insider = fmp.get("insider_trading", [])
    if raw_insider:
        fmp_ext["insider_trading"] = [
            {
                "name":        p.get("reportingName", "") or p.get("insiderName", ""),
                "title":       p.get("typeOfOwner", "") or p.get("title", ""),
                "transaction": p.get("transactionType", "") or p.get("type", ""),
                "shares":      safe_float(p.get("securitiesTransacted") or p.get("shares")),
                "price":       safe_float(p.get("price") or p.get("transactionPrice")),
                "value":       safe_float(p.get("value") or p.get("amount")),
                "date":        (p.get("transactionDate") or p.get("date") or "")[:10],
            }
            for p in raw_insider[:15] if p.get("reportingName") or p.get("insiderName")
        ]

    # Quarterly trends
    if q_trend:
        fmp_ext["quarterly_trends"] = q_trend

    # Derived valuation ratios from price (fallback when key-metrics doesn't populate them)
    price = facts.get("stock_price")
    eps_d = facts.get("eps_diluted")
    mc_val = facts.get("market_cap")
    ni_val = facts.get("net_income")
    ebitda_val = facts.get("ebitda")
    fcf_val = facts.get("free_cash_flow")
    net_debt_val = (facts.get("long_term_debt") or 0) - (facts.get("cash") or 0)
    if price and eps_d and eps_d > 0 and not facts.get("pe_ratio"):
        facts["pe_ratio"] = round(price / eps_d, 1)
    if mc_val and ni_val and ni_val > 0 and not facts.get("pe_ratio"):
        facts["pe_ratio"] = round(mc_val / ni_val, 1)
    if mc_val and ebitda_val and ebitda_val > 0 and not facts.get("ev_ebitda"):
        ev = mc_val + net_debt_val
        facts["enterprise_value"] = facts.get("enterprise_value") or ev
        facts["ev_ebitda"] = round(ev / ebitda_val, 1)
    if mc_val and fcf_val and fcf_val > 0 and not facts.get("p_fcf"):
        facts["p_fcf"] = round(mc_val / fcf_val, 1)
    if mc_val and facts.get("revenue") and not facts.get("p_sales"):
        facts["p_sales"] = round(mc_val / facts["revenue"], 1)

    return facts, history, qfacts, pqfacts, q_period, fmp_ext, prior_q_period

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
        # Companies sometimes change XBRL concept names (e.g. META stopped using
        # "Revenues" in 10-Qs after 2018).  _get_best_q_flow tries ALL concepts and
        # returns the value from whichever concept has the most recent end date —
        # preventing silent cross-period mixing when concept A is stale.
        def _get_best_q_flow(concepts: list) -> tuple:
            best_end, best_val = "", None
            for concept in concepts:
                entries = get_entries(concept)
                if not entries:
                    continue
                q = [e for e in entries
                     if e.get("form") == "10-Q" and e.get("val") is not None
                     and 75 <= _duration_days(e) <= 105]
                if not q:
                    q = [e for e in entries
                         if e.get("form") == "10-Q" and e.get("val") is not None
                         and _duration_days(e) < 200]
                if not q:
                    continue
                q.sort(key=lambda e: e.get("end", ""), reverse=True)
                if q[0].get("end", "") > best_end:
                    best_end = q[0].get("end", "")
                    best_val = safe_float(q[0]["val"])
            return best_val, best_end

        def _get_best_q_flow_prior(concepts: list, after: str) -> tuple:
            """Second-most-recent single-quarter value (strictly before `after` end date)."""
            best_end, best_val = "", None
            for concept in concepts:
                entries = get_entries(concept)
                if not entries:
                    continue
                q = [e for e in entries
                     if e.get("form") == "10-Q" and e.get("val") is not None
                     and 75 <= _duration_days(e) <= 105
                     and e.get("end", "") < after]
                if not q:
                    continue
                q.sort(key=lambda e: e.get("end", ""), reverse=True)
                if q[0].get("end", "") > best_end:
                    best_end = q[0].get("end", "")
                    best_val = safe_float(q[0]["val"])
            return best_val, best_end

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

        q_rev, _q_rev_end = _get_best_q_flow([
            "RevenueFromContractWithCustomerExcludingAssessedTax",
            "Revenues", "SalesRevenueNet",
            "RevenueFromContractWithCustomerIncludingAssessedTax"])
        if q_rev is not None: qr["revenue"] = q_rev

        q_cogs, _ = _get_best_q_flow(["CostOfRevenue", "CostOfGoodsAndServicesSold"])
        if q_cogs is not None: qr["cost_of_revenue"] = q_cogs

        q_gp, _ = _get_best_q_flow(["GrossProfit"])
        if q_gp is not None: qr["gross_profit"] = q_gp

        q_rd, _ = _get_best_q_flow(["ResearchAndDevelopmentExpense"])
        if q_rd is not None: qr["rd_expense"] = q_rd

        q_sga, _ = _get_best_q_flow(["SellingGeneralAndAdministrativeExpense"])
        if q_sga is not None: qr["sga_expense"] = q_sga

        q_oi, _q_oi_end = _get_best_q_flow(["OperatingIncomeLoss"])
        if q_oi is not None: qr["operating_income"] = q_oi

        q_ni, _q_ni_end = _get_best_q_flow(["NetIncomeLoss"])
        if q_ni is not None: qr["net_income"] = q_ni

        q_eps, _ = _get_best_q_flow(["EarningsPerShareDiluted"])
        if q_eps is not None: qr["eps_diluted"] = q_eps

        q_ocf, _q_ocf_end = _get_best_q_flow(["NetCashProvidedByUsedInOperatingActivities"])
        if q_ocf is not None: qr["operating_cf"] = q_ocf

        q_capex, _ = _get_best_q_flow(["PaymentsToAcquirePropertyPlantAndEquipment"])
        if q_capex is not None: qr["capex"] = q_capex

        q_cash = get_latest_q_bs("CashAndCashEquivalentsAtCarryingValue")
        if q_cash is not None: qr["cash"] = q_cash

        q_assets = get_latest_q_bs("Assets")
        if q_assets is not None: qr["total_assets"] = q_assets

        q_eq = get_latest_q_bs("StockholdersEquity") or get_latest_q_bs("StockholdersEquityAttributableToParent")
        if q_eq is not None: qr["equity"] = q_eq

        # Derive q_period from the concept that actually provided data (most recent wins)
        q_period = max(filter(None, [_q_rev_end, _q_oi_end, _q_ni_end, _q_ocf_end]), default="")

        # Derived quarterly ratios — only compute when all come from the same period
        if q_rev and q_gp:  qr["gross_margin_pct"]     = round(q_gp / q_rev * 100, 1)
        if q_rev and q_oi:  qr["operating_margin_pct"] = round(q_oi / q_rev * 100, 1)
        if q_rev and q_ni:  qr["net_margin_pct"]        = round(q_ni / q_rev * 100, 1)
        if q_ocf is not None and q_capex is not None:
            qr["free_cash_flow"] = q_ocf - abs(q_capex)

        # Prior quarter (QoQ) — strictly before q_period to guarantee alignment
        prior_q_period = ""
        pqr: dict = {}
        if q_period:
            pq_rev, _pq_rev_end = _get_best_q_flow_prior([
                "RevenueFromContractWithCustomerExcludingAssessedTax",
                "Revenues", "SalesRevenueNet"], q_period)
            if pq_rev is not None: pqr["revenue"] = pq_rev

            pq_gp, _ = _get_best_q_flow_prior(["GrossProfit"], q_period)
            if pq_gp is not None: pqr["gross_profit"] = pq_gp

            pq_oi, _pq_oi_end = _get_best_q_flow_prior(["OperatingIncomeLoss"], q_period)
            if pq_oi is not None: pqr["operating_income"] = pq_oi

            pq_ni, _ = _get_best_q_flow_prior(["NetIncomeLoss"], q_period)
            if pq_ni is not None: pqr["net_income"] = pq_ni

            pq_ocf, _ = _get_best_q_flow_prior(["NetCashProvidedByUsedInOperatingActivities"], q_period)
            if pq_ocf is not None: pqr["operating_cf"] = pq_ocf

            pq_eps, _ = _get_best_q_flow_prior(["EarningsPerShareDiluted"], q_period)
            if pq_eps is not None: pqr["eps_diluted"] = pq_eps

            prior_q_period = max(filter(None, [_pq_rev_end, _pq_oi_end]), default="")

            if pq_rev and pq_gp:  pqr["gross_margin_pct"]     = round(pq_gp / pq_rev * 100, 1)
            if pq_rev and pq_oi:  pqr["operating_margin_pct"] = round(pq_oi / pq_rev * 100, 1)
            if pq_rev and pq_ni:  pqr["net_margin_pct"]        = round(pq_ni / pq_rev * 100, 1)

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
            "priceToBook", "shortRatio", "shortPercentOfFloat",
            "priceToFreeCashflows", "freeCashflow", "profitMargins", "revenueGrowth",
            "earningsTimestamp", "earningsTimestampStart", "earningsTimestampEnd",
            "nextFiscalYearEnd", "mostRecentQuarter",
        ]}

        # Historical year-end prices for P/E and EV/EBITDA history charts
        price_history: dict = {}
        try:
            ph_df = t.history(period="6y", interval="1mo")
            if ph_df is not None and not ph_df.empty:
                cur_year = datetime.now().year
                for yr in range(cur_year - 5, cur_year + 1):
                    yr_prices = ph_df[ph_df.index.year == yr]
                    if yr_prices.empty:
                        continue
                    dec = yr_prices[yr_prices.index.month == 12]
                    row = dec.iloc[-1] if not dec.empty else yr_prices.iloc[-1]
                    price_history[f"{yr}-12-31"] = round(float(row["Close"]), 2)
        except Exception as _pe:
            print(f"yfinance price_history error for {ticker}: {_pe}")

        print(f"yfinance: {len(annual_income.get('columns', []))} annual + {len(q_income.get('columns', []))} quarterly periods for {ticker}")
        return {
            "income": annual_income,
            "balance_sheet": annual_balance,
            "cash_flow": annual_cashflow,
            "quarterly_income": q_income,
            "quarterly_balance": q_balance,
            "quarterly_cashflow": q_cashflow,
            "info": info,
            "price_history": price_history,
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
    """Build {date: value} series from yfinance statement, sorted oldest-first (ascending)."""
    cols = yf_stmt.get("columns", [])
    if not cols:
        return {}
    for key in keys:
        vals = yf_stmt.get("data", {}).get(key)
        if vals:
            result = {cols[i]: v for i, v in enumerate(vals) if v is not None and i < len(cols)}
            if result:
                # Sort by date string ascending so oldest comes first — critical for CAGR formulas
                return dict(sorted(result.items()))
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

    # Merge yfinance info (market data) — fills market_cap, price, beta when FMP is unavailable
    info = yf_data.get("info", {})
    if info:
        mc_yf = safe_float(info.get("marketCap"))
        if mc_yf and not facts.get("market_cap"):
            facts["market_cap"] = mc_yf
        price_yf = safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
        if price_yf and not facts.get("stock_price"):
            facts["stock_price"] = price_yf
        beta_yf = safe_float(info.get("beta"))
        if beta_yf and not facts.get("beta"):
            facts["beta"] = beta_yf
        ev_yf = safe_float(info.get("enterpriseValue"))
        if ev_yf and not facts.get("enterprise_value"):
            facts["enterprise_value"] = ev_yf
        pe_yf = safe_float(info.get("trailingPE"))
        if pe_yf and pe_yf > 0 and not facts.get("pe_ratio"):
            facts["pe_ratio"] = round(pe_yf, 1)
        ev_ebitda_yf = safe_float(info.get("enterpriseToEbitda"))
        if ev_ebitda_yf and ev_ebitda_yf > 0 and not facts.get("ev_ebitda"):
            facts["ev_ebitda"] = round(ev_ebitda_yf, 1)
        div_yf = safe_float(info.get("dividendYield") or info.get("trailingAnnualDividendYield"))
        if div_yf and div_yf > 0 and not facts.get("dividend_yield"):
            pct = round(div_yf * 100, 2)
            if 0 < pct < 20:  # reject implausibly high yields (yfinance scale inconsistency)
                facts["dividend_yield"] = pct
        # 52-week range
        high52 = safe_float(info.get("fiftyTwoWeekHigh"))
        low52  = safe_float(info.get("fiftyTwoWeekLow"))
        if high52: facts["week52_high"] = round(high52, 2)
        if low52:  facts["week52_low"]  = round(low52, 2)
        # Short interest
        short_ratio = safe_float(info.get("shortRatio"))
        short_float = safe_float(info.get("shortPercentOfFloat"))
        if short_ratio: facts["short_ratio"]       = round(short_ratio, 1)
        if short_float: facts["short_float_pct"]   = round(short_float * 100, 1)
        # Next earnings timestamp (UNIX epoch → store as float for easy date conversion)
        for ts_key in ["earningsTimestamp", "earningsTimestampStart", "earningsTimestampEnd"]:
            ts = info.get(ts_key)
            if ts and isinstance(ts, (int, float)) and ts > 0:
                facts["next_earnings_ts"] = float(ts)
                break

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

def _get_earnings_transcript(company) -> str:
    """Try to extract earnings call content from recent 8-K filings via edgartools."""
    try:
        filings_8k = company.get_filings(form="8-K")
        if not filings_8k:
            return ""
        transcript_signals = [
            "earnings call", "conference call", "operator:",
            "ladies and gentlemen", "q&a", "prepared remarks",
            "results of operations", "analyst questions", "question-and-answer",
        ]
        checked = 0
        for filing in filings_8k:
            if checked >= 8:
                break
            checked += 1
            try:
                doc = filing.obj()
                if doc is None:
                    continue
                text = ""
                for attr in ["text", "content"]:
                    val = getattr(doc, attr, None)
                    if isinstance(val, str) and len(val) > 500:
                        text = val
                        break
                if not text:
                    text = str(doc)
                if len(text) < 500:
                    continue
                text_lower = text.lower()
                signal_count = sum(1 for sig in transcript_signals if sig in text_lower)
                if signal_count >= 2:
                    print(f"Earnings content found in 8-K #{checked}: {len(text)} chars, signals={signal_count}")
                    return truncate(text, 12000)
            except Exception as e:
                print(f"8-K parse error #{checked}: {e}")
                continue
        print("No earnings transcript found in recent 8-Ks")
        return ""
    except Exception as e:
        print(f"Earnings transcript fetch error: {e}")
        return ""


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
    fmp_extended: dict = {}
    earnings_transcript: str = ""

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "edgar_available": EDGAR_AVAILABLE}

@app.get("/debug")
def debug():
    return {
        "fmp_key_set": bool(FMP_API_KEY),
        "fmp_key_length": len(FMP_API_KEY),
        "fmp_key_prefix": FMP_API_KEY[:4] if FMP_API_KEY else "",
        "edgar_available": EDGAR_AVAILABLE,
        "yf_available": YF_AVAILABLE,
    }

@app.get("/test-fmp")
def test_fmp():
    """Test FMP connectivity — makes a live call to income-statement/AAPL and reports result."""
    if not FMP_API_KEY:
        return {"error": "FMP_API_KEY not set"}
    try:
        url = f"{FMP_BASE}/income-statement?symbol=AAPL&limit=1&apikey={FMP_API_KEY}"
        r = httpx.get(url, timeout=15, headers={"User-Agent": "CrossAsset/1.0"})
        body = r.text[:500]
        data = r.json() if r.status_code == 200 else None
        return {
            "http_status": r.status_code,
            "response_type": type(data).__name__ if data else None,
            "records_returned": len(data) if isinstance(data, list) else None,
            "first_date": data[0].get("date") if isinstance(data, list) and data else None,
            "first_revenue": data[0].get("revenue") if isinstance(data, list) and data else None,
            "error_body": body if r.status_code != 200 else None,
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/test-fmp-profile")
def test_fmp_profile(symbol: str = "META"):
    """Test FMP profile endpoint — returns raw keys for debugging field name issues."""
    if not FMP_API_KEY:
        return {"error": "FMP_API_KEY not set"}
    try:
        url = f"{FMP_BASE}/profile?symbol={symbol}&apikey={FMP_API_KEY}"
        r = httpx.get(url, timeout=15, headers={"User-Agent": "CrossAsset/1.0"})
        if r.status_code != 200:
            return {"error": f"HTTP {r.status_code}", "body": r.text[:300]}
        data = r.json()
        item = data[0] if isinstance(data, list) and data else (data if isinstance(data, dict) else {})
        return {
            "keys": list(item.keys()),
            "mktCap": item.get("mktCap"),
            "marketCap": item.get("marketCap"),
            "beta": item.get("beta"),
            "sector": item.get("sector"),
            "peRatio": item.get("peRatio"),
            "sample": {k: item[k] for k in list(item.keys())[:15]},
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/test-fmp-peers")
def test_fmp_peers(symbol: str = "META"):
    """Test FMP stock-peers endpoint — returns raw response for debugging."""
    if not FMP_API_KEY:
        return {"error": "FMP_API_KEY not set"}
    try:
        url = f"{FMP_BASE}/stock-peers?symbol={symbol}&apikey={FMP_API_KEY}"
        r = httpx.get(url, timeout=15, headers={"User-Agent": "CrossAsset/1.0"})
        if r.status_code != 200:
            return {"error": f"HTTP {r.status_code}", "body": r.text[:300]}
        return {"status": r.status_code, "data": r.json()}
    except Exception as e:
        return {"error": str(e)}

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

    annual_task     = asyncio.to_thread(_get_filing, company, "10-K", want)
    quarterly_task  = asyncio.to_thread(_get_filing, company, "10-Q", want)
    xbrl_task       = asyncio.to_thread(fetch_xbrl_from_sec_api, str(getattr(company, 'cik', '')))
    fmp_task        = asyncio.to_thread(get_fmp_financials, ticker)
    yf_task         = asyncio.to_thread(get_yfinance_financials, ticker)
    transcript_task = asyncio.to_thread(_get_earnings_transcript, company)

    annual, quarterly, xbrl_result, fmp_data, yf_data, earnings_transcript_edgar = await asyncio.gather(
        annual_task, quarterly_task, xbrl_task, fmp_task, yf_task, transcript_task
    )

    # Prefer FMP earnings call transcript (structured) over EDGAR 8-K text extraction
    fmp_transcript_raw = (fmp_data or {}).get("transcript_raw", [])
    if fmp_transcript_raw and isinstance(fmp_transcript_raw, list) and fmp_transcript_raw:
        t0 = fmp_transcript_raw[0]
        fmp_content = t0.get("content", "") if isinstance(t0, dict) else ""
        if fmp_content and len(fmp_content) > 500:
            earnings_transcript = fmp_content[:15000]
            print(f"FMP transcript: {len(earnings_transcript)} chars for {ticker} (Q{t0.get('quarter', '?')} {t0.get('year', '?')})")
        else:
            earnings_transcript = earnings_transcript_edgar
    else:
        earnings_transcript = earnings_transcript_edgar

    # ── Financial data priority: FMP statements > yfinance > XBRL ───────────
    # FMP supplemental (profile, valuation, analyst, segments) always used when available.
    FMP_SUPPLEMENTAL = {
        "market_cap","beta","stock_price","pe_ratio","ev_ebitda","p_fcf","p_sales","p_book",
        "enterprise_value","ev_revenue","roic","roe_km","current_ratio","debt_to_equity",
        "interest_coverage","dividend_yield","fcf_yield","income_quality",
        "revenue_growth_yoy","eps_growth_yoy","fcf_growth_yoy","ni_growth_yoy","ocf_growth_yoy",
        "rev_est_next","ebitda_est_next","eps_est_next","ni_est_next","num_analysts",
        "fmp_rating_score","pt_consensus","pt_last_month","pt_last_quarter","pt_high","pt_low","employees",
        "week52_high","week52_low","short_ratio","short_float_pct","next_earnings_ts",
    }

    fmp_ext = {}
    if fmp_data and fmp_data.get("income_annual"):
        print(f"FMP full: using as primary source for {ticker}")
        merged_facts, merged_history, qxbrl, pqxbrl, q_period, fmp_ext, prior_q_period = build_from_fmp(fmp_data)
    else:
        # Core financials from XBRL + yfinance
        print(f"FMP supplemental only for {ticker} — XBRL/yfinance for statements")
        merged_facts   = merge_yf_into_facts(dict(xbrl_result.get("facts", {})), yf_data)
        merged_history = build_history_from_yf(yf_data) or xbrl_result.get("history", {})
        qxbrl          = dict(xbrl_result.get("quarterly_facts", {}))
        pqxbrl         = dict(xbrl_result.get("prior_quarter_facts", {}))
        q_period       = xbrl_result.get("quarterly_period", "")
        prior_q_period = xbrl_result.get("prior_quarter_period", "")
        # Overlay FMP supplemental facts (market_cap, PE, segments, analyst data)
        if fmp_data:
            supp_facts, _, _, _, _, fmp_ext, _ = build_from_fmp(fmp_data)
            for k, v in supp_facts.items():
                if k in FMP_SUPPLEMENTAL:
                    merged_facts[k] = v

    # ── Compute YoY growth rates from history when FMP didn't provide them ───────
    def _yoy(series: dict) -> Optional[float]:
        """Return (latest/prior - 1)*100 from a chronologically-sorted history dict."""
        vals = list(series.values()) if series else []
        if len(vals) >= 2 and vals[-2] and vals[-2] != 0:
            return round((vals[-1] - vals[-2]) / abs(vals[-2]) * 100, 1)
        return None

    if not merged_facts.get("revenue_growth_yoy") and merged_history.get("revenue"):
        v = _yoy(merged_history["revenue"])
        if v is not None: merged_facts["revenue_growth_yoy"] = v
    if not merged_facts.get("eps_growth_yoy") and merged_history.get("eps_diluted"):
        v = _yoy(merged_history["eps_diluted"])
        if v is not None: merged_facts["eps_growth_yoy"] = v
    if not merged_facts.get("fcf_growth_yoy") and merged_history.get("free_cash_flow"):
        v = _yoy(merged_history["free_cash_flow"])
        if v is not None: merged_facts["fcf_growth_yoy"] = v
    if not merged_facts.get("ni_growth_yoy") and merged_history.get("net_income"):
        v = _yoy(merged_history["net_income"])
        if v is not None: merged_facts["ni_growth_yoy"] = v
    if not merged_facts.get("ocf_growth_yoy") and merged_history.get("operating_cf"):
        v = _yoy(merged_history["operating_cf"])
        if v is not None: merged_facts["ocf_growth_yoy"] = v

    # ── Post-merge: compute missing valuation multiples from available data ──────
    _mc  = merged_facts.get("market_cap")
    _ni  = merged_facts.get("net_income")
    _rev = merged_facts.get("revenue")
    _fcf = merged_facts.get("free_cash_flow")
    _ebi = merged_facts.get("ebitda")
    _csh = merged_facts.get("cash", 0) or 0
    _ltd = merged_facts.get("long_term_debt", 0) or 0
    _ev  = merged_facts.get("enterprise_value") or (_mc + _ltd - _csh if _mc else None)
    if _ev and not merged_facts.get("enterprise_value"):
        merged_facts["enterprise_value"] = _ev
    if _mc and _ni and _ni > 0 and not merged_facts.get("pe_ratio"):
        merged_facts["pe_ratio"] = round(_mc / _ni, 1)
    if _ev and _ebi and _ebi > 0 and not merged_facts.get("ev_ebitda"):
        merged_facts["ev_ebitda"] = round(_ev / _ebi, 1)
    if _mc and _fcf and _fcf > 0 and not merged_facts.get("p_fcf"):
        merged_facts["p_fcf"] = round(_mc / _fcf, 1)
    if _mc and _rev and _rev > 0 and not merged_facts.get("p_sales"):
        merged_facts["p_sales"] = round(_mc / _rev, 1)
    # ROIC from operating income / invested capital if not set
    if not merged_facts.get("roic"):
        _oi  = merged_facts.get("operating_income")
        _eq  = merged_facts.get("equity")
        _tax_rate = (merged_facts.get("effective_tax_rate") or 21.0) / 100
        if _oi and _eq and _eq > 0:
            _nopat = _oi * (1 - _tax_rate)
            _ic = max(1, _eq + _ltd - _csh)
            merged_facts["roic"] = round(_nopat / _ic * 100, 2)
    if not merged_facts.get("interest_coverage"):
        _oi2  = merged_facts.get("operating_income")
        _iexp = merged_facts.get("interest_expense")
        if _oi2 and _iexp and _iexp > 0:
            merged_facts["interest_coverage"] = round(_oi2 / _iexp, 1)

    # ── Historical P/E and EV/EBITDA from yfinance price history ─────────────
    _price_hist = yf_data.get("price_history", {}) if yf_data else {}
    if _price_hist:
        _eps_hist   = merged_history.get("eps_diluted", {})
        _ebitda_hist = merged_history.get("ebitda", {})
        _ltd_hist   = merged_history.get("long_term_debt", {})
        _cash_hist  = merged_history.get("cash", {})
        _shares_cur = merged_facts.get("shares_diluted_wtd") or safe_float(
            yf_data.get("info", {}).get("sharesOutstanding"))
        pe_hist: dict = {}
        ev_ebitda_hist: dict = {}
        for yr_key, px in _price_hist.items():
            if not px: continue
            eps = _eps_hist.get(yr_key)
            if eps and abs(eps) > 0.01:
                pe = round(px / eps, 1)
                if 0 < pe < 1000:
                    pe_hist[yr_key] = pe
            ebi = _ebitda_hist.get(yr_key)
            ltd = _ltd_hist.get(yr_key, 0) or 0
            csh = _cash_hist.get(yr_key, 0) or 0
            if ebi and ebi > 0 and _shares_cur:
                ev = px * _shares_cur + ltd - csh
                ev_ebitda = round(ev / ebi, 1)
                if 0 < ev_ebitda < 200:
                    ev_ebitda_hist[yr_key] = ev_ebitda
        if pe_hist:
            merged_history["pe_history"] = dict(sorted(pe_hist.items()))
        if ev_ebitda_hist:
            merged_history["ev_ebitda_history"] = dict(sorted(ev_ebitda_hist.items()))

    # ── Combined news from 3 free sources ────────────────────────────────────
    try:
        fmp_ext["news_combined"] = get_news_combined(ticker)
    except Exception as e:
        print(f"news_combined error for {ticker}: {e}")
        fmp_ext["news_combined"] = []

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
        fmp_extended=fmp_ext,
        earnings_transcript=earnings_transcript,
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
