"""
Financial Modeling Prep API wrapper.
Covers: earnings calendar, analyst ratings, insider trades, key metrics, profiles.
"""
import hashlib
import logging
import requests
from datetime import datetime, timedelta
from config import FMP_API_KEY

log = logging.getLogger(__name__)
BASE = "https://financialmodelingprep.com/api/v3"


def _get(endpoint: str, params: dict | None = None, v4: bool = False) -> dict | list:
    if not FMP_API_KEY:
        return []
    base = BASE.replace("/v3", "/v4") if v4 else BASE
    try:
        p = params or {}
        p["apikey"] = FMP_API_KEY
        r = requests.get(f"{base}/{endpoint}", params=p, timeout=12)
        if not r.ok:
            log.warning(f"FMP {endpoint}: HTTP {r.status_code}")
            return [] if r.status_code != 200 else r.json()
        return r.json()
    except Exception as e:
        log.warning(f"FMP {endpoint}: {e}")
        return []


def get_earnings_calendar(tickers: list[str], days_ahead: int = 14) -> list[dict]:
    """Return upcoming earnings dates for all tickers."""
    from_date = datetime.utcnow().strftime("%Y-%m-%d")
    to_date   = (datetime.utcnow() + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    data = _get(f"earning_calendar", {"from": from_date, "to": to_date})
    if not isinstance(data, list):
        return []
    ticker_set = set(t.upper() for t in tickers)
    return [d for d in data if d.get("symbol", "").upper() in ticker_set]


def get_latest_earnings(ticker: str) -> dict | None:
    """Get most recent earnings result (EPS actual vs estimate)."""
    data = _get(f"earnings-surprises/{ticker}")
    if isinstance(data, list) and data:
        return data[0]
    return None


def get_analyst_ratings(ticker: str, limit: int = 10) -> list[dict]:
    """Recent analyst upgrades/downgrades."""
    data = _get(f"upgrades-downgrades", {"symbol": ticker, "page": 0})
    if not isinstance(data, list):
        return []
    return data[:limit]


def get_price_targets(ticker: str) -> list[dict]:
    """Price target history from analysts."""
    data = _get("price-target", {"symbol": ticker}, v4=True)
    return data[:10] if isinstance(data, list) else []


def get_insider_trades(ticker: str, limit: int = 20) -> list[dict]:
    """Recent Form 4 insider transactions."""
    data = _get(f"insider-trading", {"symbol": ticker, "limit": limit})
    return data if isinstance(data, list) else []


def get_key_metrics(ticker: str) -> dict | None:
    """TTM key metrics: P/E, EPS, FCF yield, ROIC, etc."""
    data = _get(f"key-metrics-ttm/{ticker}")
    if isinstance(data, list) and data:
        return data[0]
    return None


def get_profile(ticker: str) -> dict | None:
    """Company profile: name, sector, CEO, employees, description."""
    data = _get(f"profile/{ticker}")
    if isinstance(data, list) and data:
        return data[0]
    return None


def get_income_statement(ticker: str, limit: int = 4) -> list[dict]:
    """Quarterly income statements."""
    data = _get(f"income-statement/{ticker}", {"period": "quarter", "limit": limit})
    return data if isinstance(data, list) else []


def get_analyst_consensus(ticker: str) -> dict | None:
    """Consensus rating and price target."""
    data = _get("analyst-stock-recommendations", {"symbol": ticker}, v4=True)
    if isinstance(data, list) and data:
        return data[0]
    return None


def rating_hash(r: dict) -> str:
    key = f"{r.get('symbol')}|{r.get('publishedDate')}|{r.get('newGrade')}|{r.get('gradingCompany')}"
    return hashlib.sha256(key.encode()).hexdigest()[:32]


def insider_hash(t: dict) -> str:
    key = f"{t.get('symbol')}|{t.get('transactionDate')}|{t.get('securitiesTransacted')}|{t.get('reportingName')}"
    return hashlib.sha256(key.encode()).hexdigest()[:32]
