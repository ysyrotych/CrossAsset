"""
Earnings Transcript Agent — Loop 7
Fetches and analyzes the most recent earnings call transcript from SEC EDGAR 8-K filings.
"""
import logging
import re
import time
import requests
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL_FAST

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)

EDGAR_HEADERS = {
    "User-Agent": "AnalystDesk/1.0 ysyrotych@gmail.com",
    "Accept": "application/json",
}

_cache: dict[str, tuple[float, str]] = {}
_CACHE_TTL = 86400  # 24 hours


def _get_cik(ticker: str) -> str | None:
    """Resolve ticker → CIK via EDGAR company search."""
    try:
        url = f"https://efts.sec.gov/LATEST/search-index?q=%22{ticker}%22&dateRange=custom&startdt=2020-01-01&forms=8-K"
        r = requests.get(
            f"https://data.sec.gov/submissions/CIK{ticker}.json",
            headers=EDGAR_HEADERS, timeout=10,
        )
        # Try the company tickers mapping first — much faster
        tickers_url = "https://www.sec.gov/files/company_tickers.json"
        r2 = requests.get(tickers_url, headers=EDGAR_HEADERS, timeout=10)
        if r2.status_code == 200:
            data = r2.json()
            for entry in data.values():
                if entry.get("ticker", "").upper() == ticker.upper():
                    return str(entry["cik_str"]).zfill(10)
    except Exception as e:
        log.debug(f"CIK lookup ({ticker}): {e}")
    return None


def _fetch_8k_exhibit(cik: str, limit: int = 5) -> str | None:
    """Pull the most recent 8-K with an earnings call exhibit (Item 8.01)."""
    try:
        sub_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        r = requests.get(sub_url, headers=EDGAR_HEADERS, timeout=15)
        if r.status_code != 200:
            return None
        data = r.json()
        filings = data.get("filings", {}).get("recent", {})
        forms    = filings.get("form", [])
        dates    = filings.get("filingDate", [])
        accNums  = filings.get("accessionNumber", [])

        # Find most recent 8-K
        for i, form in enumerate(forms[:50]):
            if form == "8-K":
                accNum = accNums[i].replace("-", "")
                date   = dates[i]
                text   = _get_filing_text(cik, accNum)
                if text and len(text) > 500:
                    log.debug(f"Found 8-K ({date}) for CIK {cik}, len={len(text)}")
                    return text[:12000]
        return None
    except Exception as e:
        log.warning(f"_fetch_8k_exhibit: {e}")
        return None


def _get_filing_text(cik: str, accNum: str) -> str | None:
    """Fetch the filing index and extract the largest text exhibit."""
    try:
        index_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accNum}/{accNum}-index.htm"
        r = requests.get(index_url, headers=EDGAR_HEADERS, timeout=10)
        # Try filing viewer API
        api_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        docs_url = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=8-K&dateb=&owner=include&count=5&search_text="

        # Direct: use EDGAR full-text search
        search_url = "https://efts.sec.gov/LATEST/search-index"
        params = {
            "q": '"earnings call" OR "conference call" OR "prepared remarks"',
            "dateRange": "custom",
            "startdt": "2024-01-01",
            "forms": "8-K",
            "entity": cik,
        }
        r2 = requests.get("https://efts.sec.gov/LATEST/search-index",
                          params=params, headers=EDGAR_HEADERS, timeout=10)
        if r2.status_code == 200:
            hits = r2.json().get("hits", {}).get("hits", [])
            if hits:
                file_path = hits[0].get("_source", {}).get("file_date", "")

        # Fallback: get filing documents from submissions API
        accNum_fmt = f"{accNum[:10]}-{accNum[10:12]}-{accNum[12:]}"
        docs_api = f"https://data.sec.gov/submissions/CIK{cik}.json"

        htm_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accNum}/{accNum}.txt"
        r3 = requests.get(htm_url, headers=EDGAR_HEADERS, timeout=15)
        if r3.status_code == 200:
            text = r3.text
            # Strip HTML tags
            text = re.sub(r'<[^>]+>', ' ', text)
            text = re.sub(r'\s+', ' ', text).strip()
            # Find the section with earnings call content
            lower = text.lower()
            for marker in ["prepared remarks", "conference call", "operator:", "question-and-answer"]:
                idx = lower.find(marker)
                if idx > 0:
                    return text[max(0, idx-200):idx+10000]
            return text[:8000]
        return None
    except Exception as e:
        log.debug(f"_get_filing_text: {e}")
        return None


def _fetch_transcript_finviz(ticker: str) -> str | None:
    """Try to get transcript via Finnhub (free tier supports transcripts)."""
    try:
        import os
        api_key = os.getenv("FINNHUB_API_KEY", "")
        if not api_key:
            return None
        url = f"https://finnhub.io/api/v1/stock/transcripts/list?symbol={ticker}&token={api_key}"
        r = requests.get(url, timeout=10)
        if r.status_code != 200:
            return None
        data = r.json()
        transcripts = data.get("transcripts", [])
        if not transcripts:
            return None
        # Get most recent
        latest_id = transcripts[0].get("id")
        t_url = f"https://finnhub.io/api/v1/stock/transcripts?id={latest_id}&token={api_key}"
        r2 = requests.get(t_url, timeout=15)
        if r2.status_code != 200:
            return None
        t_data = r2.json()
        # Extract participant speeches
        parts = t_data.get("transcript", [])
        lines = []
        char_count = 0
        for p in parts:
            speaker = p.get("name", "")
            speeches = p.get("speech", [])
            for s in speeches:
                line = f"{speaker}: {s}"
                lines.append(line)
                char_count += len(line)
                if char_count > 8000:
                    break
            if char_count > 8000:
                break
        return "\n".join(lines) if lines else None
    except Exception as e:
        log.debug(f"Finnhub transcript ({ticker}): {e}")
        return None


def get_transcript_analysis(ticker: str) -> str:
    """
    Returns a formatted analysis of the most recent earnings call transcript.
    Tries Finnhub first (structured), then EDGAR 8-K.
    """
    now = time.time()
    if ticker in _cache:
        ts, result = _cache[ticker]
        if now - ts < _CACHE_TTL:
            return result

    transcript_text = _fetch_transcript_finviz(ticker)
    source = "Finnhub"
    if not transcript_text:
        cik = _get_cik(ticker)
        if cik:
            transcript_text = _fetch_8k_exhibit(cik)
            source = "SEC EDGAR 8-K"

    if not transcript_text or len(transcript_text) < 200:
        result = f"📜 No earnings transcript available for {ticker}"
        _cache[ticker] = (now, result)
        return result

    prompt = f"""Analyze this earnings call transcript for {ticker}.

TRANSCRIPT ({source}):
{transcript_text[:7000]}

Write a concise earnings call analysis:

📜 EARNINGS CALL ANALYSIS · {ticker}

TONE & CONFIDENCE
How did management sound vs last quarter? Any hedging language?

KEY GUIDANCE
Specific numbers mentioned: revenue, margin, EPS guidance for next quarter.

WHAT MANAGEMENT IS EXCITED ABOUT
2-3 things they emphasized most.

WHAT ANALYSTS WERE PROBING
What were the toughest analyst questions? What reveals investor concerns?

RED FLAGS (if any)
Any defensive language, missed questions, or suspicious vagueness.

BOTTOM LINE
1 sentence: what does this call tell you about the stock?

Max 250 words. Institutional tone."""

    try:
        resp = client.messages.create(
            model=MODEL_FAST, max_tokens=600,
            messages=[{"role": "user", "content": prompt}]
        )
        result = resp.content[0].text.strip()
    except Exception as e:
        log.warning(f"transcript_analysis({ticker}): {e}")
        result = f"📜 EARNINGS CALL · {ticker}\n\nTranscript retrieved but analysis failed: {e}"

    _cache[ticker] = (now, result)
    return result
