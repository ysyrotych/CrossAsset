"""
SEC EDGAR filing monitor.
Uses EDGAR full-text search + company filing API (no API key required).
"""
import hashlib
import logging
import requests
from datetime import datetime, timedelta

log = logging.getLogger(__name__)

EDGAR_HEADERS = {"User-Agent": "AnalystDesk research@edgewood.com"}
EDGAR_COMPANY  = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
EDGAR_SEARCH   = "https://efts.sec.gov/LATEST/search-index?q=%22{ticker}%22&dateRange=custom&startdt={start}&enddt={end}&forms={forms}"
EDGAR_FILING   = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type={form}&dateb=&owner=include&count=10&search_text=&output=atom"

# CIK lookup cache
_cik_cache: dict[str, str] = {}


def get_cik(ticker: str) -> str | None:
    """Look up EDGAR CIK for a ticker."""
    if ticker in _cik_cache:
        return _cik_cache[ticker]
    try:
        r = requests.get(
            "https://www.sec.gov/cgi-bin/browse-edgar",
            params={"company": "", "CIK": ticker, "type": "", "dateb": "",
                    "owner": "include", "count": 1, "search_text": "", "action": "getcompany", "output": "atom"},
            headers=EDGAR_HEADERS, timeout=10,
        )
        # Parse CIK from response
        import re
        match = re.search(r"CIK=(\d+)", r.text)
        if match:
            cik = match.group(1).lstrip("0")
            _cik_cache[ticker] = cik
            return cik
    except Exception as e:
        log.warning(f"CIK lookup({ticker}): {e}")
    return None


def get_recent_filings(ticker: str, form_types: list[str] = None, days: int = 3) -> list[dict]:
    """
    Return recent filings for a ticker via EDGAR search API.
    form_types: e.g. ["8-K", "4"] — defaults to material event forms.
    """
    if form_types is None:
        form_types = ["8-K", "4", "SC 13D", "SC 13G"]

    start = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    end   = datetime.utcnow().strftime("%Y-%m-%d")
    forms_str = ",".join(form_types)

    try:
        url = f"https://efts.sec.gov/LATEST/search-index?q=%22{ticker}%22&dateRange=custom&startdt={start}&enddt={end}&forms={forms_str}"
        r = requests.get(url, headers=EDGAR_HEADERS, timeout=12)
        if not r.ok:
            return []
        hits = r.json().get("hits", {}).get("hits", [])
        filings = []
        for h in hits:
            src = h.get("_source", {})
            filings.append({
                "ticker":      ticker,
                "accession_no": src.get("file_num", h.get("_id", "")),
                "form_type":   src.get("form_type", ""),
                "filed_at":    src.get("period_of_report", src.get("file_date", "")),
                "entity_name": src.get("entity_name", ""),
                "description": src.get("period_of_report", ""),
                "url":         f"https://www.sec.gov/Archives/edgar/data/{src.get('entity_id','')}/{src.get('file_date','').replace('-','')}/",
            })
        return filings
    except Exception as e:
        log.warning(f"EDGAR search({ticker}): {e}")
        return []


def get_form4_insider(ticker: str, days: int = 7) -> list[dict]:
    """Parse recent Form 4 insider transactions from EDGAR RSS."""
    try:
        import feedparser
        url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}&type=4&dateb=&owner=include&count=10&search_text=&output=atom"
        feed = feedparser.parse(url)
        filings = []
        cutoff = datetime.utcnow() - timedelta(days=days)
        for entry in feed.entries:
            updated = entry.get("updated", "")
            try:
                dt = datetime.strptime(updated[:10], "%Y-%m-%d")
                if dt < cutoff:
                    continue
            except Exception:
                pass
            filings.append({
                "ticker":      ticker,
                "accession_no": entry.get("id", "").split("/")[-1],
                "form_type":   "4",
                "filed_at":    updated[:10] if updated else "",
                "title":       entry.get("title", ""),
                "url":         entry.get("link", ""),
            })
        return filings
    except Exception as e:
        log.warning(f"Form4 RSS({ticker}): {e}")
        return []


def get_8k_filings(ticker: str, days: int = 3) -> list[dict]:
    """Recent 8-K material event filings via EDGAR RSS."""
    try:
        import feedparser
        url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={ticker}&type=8-K&dateb=&owner=include&count=10&search_text=&output=atom"
        feed = feedparser.parse(url)
        filings = []
        cutoff = datetime.utcnow() - timedelta(days=days)
        for entry in feed.entries:
            updated = entry.get("updated", "")
            try:
                dt = datetime.strptime(updated[:10], "%Y-%m-%d")
                if dt < cutoff:
                    continue
            except Exception:
                pass
            filings.append({
                "ticker":      ticker,
                "accession_no": entry.get("id", "").split("/")[-1],
                "form_type":   "8-K",
                "filed_at":    updated[:10] if updated else "",
                "title":       entry.get("title", ""),
                "url":         entry.get("link", ""),
                "summary":     entry.get("summary", ""),
            })
        return filings
    except Exception as e:
        log.warning(f"8-K RSS({ticker}): {e}")
        return []


def filing_hash(f: dict) -> str:
    key = f"{f.get('ticker')}|{f.get('form_type')}|{f.get('accession_no')}|{f.get('filed_at')}"
    return hashlib.sha256(key.encode()).hexdigest()[:32]
