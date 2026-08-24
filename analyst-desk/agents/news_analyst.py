"""
News Analyst Agent — fetches, scores, and alerts on material news.
"""
import logging
from data.news import get_all_news
from data.fmp import get_profile
from agents.chief_of_staff import score_news_materiality, compose_alert_with_claude, try_send_alert
from db.queries import seen_news, mark_news_seen, make_hash
from config import WATCHLIST

log = logging.getLogger(__name__)


def check_news(ticker: str, send_fn) -> list[str]:
    """
    Scan news for ticker, score materiality, alert if material.
    Returns list of messages sent.
    """
    company_name = WATCHLIST.get(ticker, {}).get("name", "")
    if not company_name:
        prof = get_profile(ticker)
        company_name = prof.get("companyName", "") if prof else ""

    articles = get_all_news(ticker, company_name, days=1)
    if not articles:
        return []

    # Filter unseen articles
    new_articles = [a for a in articles if not seen_news(a.get("url_hash", ""))]
    if not new_articles:
        return []

    # Mark all as seen immediately to prevent re-processing
    for a in new_articles:
        mark_news_seen(a["url_hash"], ticker)

    # Score materiality with Claude
    material = score_news_materiality(ticker, new_articles)
    if not material:
        return []

    messages_sent = []
    for article in material:
        score = article.get("materiality", 0)
        severity = "URGENT" if score >= 9 else "WATCH" if score >= 7 else "DATA"

        content_hash = make_hash(ticker, "news", article.get("url_hash", article.get("title", "")))
        msg = compose_alert_with_claude(ticker, "news", {
            "headline":    article.get("title", ""),
            "source":      article.get("source", ""),
            "published":   article.get("published", ""),
            "summary":     article.get("summary", "")[:500],
            "url":         article.get("url", ""),
            "materiality": f"{score}/10 — {article.get('materiality_reason', '')}",
        }, severity)

        sent = try_send_alert(ticker, "news", content_hash, severity, msg, send_fn)
        if sent:
            messages_sent.append(msg)

    return messages_sent
