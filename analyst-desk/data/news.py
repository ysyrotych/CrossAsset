"""
News data — NewsAPI + Google News RSS.
Returns list of article dicts: {title, url, source, published, summary, ticker}
"""
import hashlib
import logging
import feedparser
import requests
from datetime import datetime, timedelta
from config import NEWS_API_KEY

log = logging.getLogger(__name__)

NEWSAPI_URL = "https://newsapi.org/v2/everything"
GNEWS_RSS   = "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"


def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:32]


def get_news_newsapi(ticker: str, company_name: str = "", days: int = 1) -> list[dict]:
    """Fetch recent news from NewsAPI for a ticker."""
    if not NEWS_API_KEY:
        return []
    try:
        query = f'"{ticker}" OR "{company_name}"' if company_name else f'"{ticker}"'
        from_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        r = requests.get(NEWSAPI_URL, params={
            "q": query, "from": from_date, "sortBy": "publishedAt",
            "language": "en", "pageSize": 20, "apiKey": NEWS_API_KEY,
        }, timeout=10)
        if not r.ok:
            return []
        articles = r.json().get("articles", [])
        return [
            {
                "title":     a.get("title", ""),
                "url":       a.get("url", ""),
                "url_hash":  _url_hash(a.get("url", "")),
                "source":    a.get("source", {}).get("name", ""),
                "published": a.get("publishedAt", ""),
                "summary":   a.get("description", ""),
                "ticker":    ticker,
            }
            for a in articles if a.get("title") and a.get("url")
        ]
    except Exception as e:
        log.warning(f"NewsAPI({ticker}): {e}")
        return []


def get_news_rss(ticker: str, company_name: str = "") -> list[dict]:
    """Fetch news from Google News RSS."""
    try:
        query = f"{ticker} {company_name} stock".strip()
        url = GNEWS_RSS.format(query=requests.utils.quote(query))
        feed = feedparser.parse(url)
        articles = []
        for entry in feed.entries[:15]:
            articles.append({
                "title":    entry.get("title", ""),
                "url":      entry.get("link", ""),
                "url_hash": _url_hash(entry.get("link", "")),
                "source":   entry.get("source", {}).get("title", "Google News"),
                "published": entry.get("published", ""),
                "summary":  entry.get("summary", ""),
                "ticker":   ticker,
            })
        return articles
    except Exception as e:
        log.warning(f"RSS({ticker}): {e}")
        return []


def get_all_news(ticker: str, company_name: str = "", days: int = 1) -> list[dict]:
    """Merge NewsAPI + RSS, deduplicated by URL hash."""
    seen_hashes: set[str] = set()
    articles = []
    for a in get_news_newsapi(ticker, company_name, days) + get_news_rss(ticker, company_name):
        h = a.get("url_hash", "")
        if h and h not in seen_hashes:
            seen_hashes.add(h)
            articles.append(a)
    return articles


def get_earnings_news(ticker: str) -> list[dict]:
    """Fetch news specifically around earnings for a ticker."""
    return get_all_news(ticker, days=3)
