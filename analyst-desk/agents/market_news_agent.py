"""
Market News Agent — monitors major global finance RSS feeds.
Sends the top 3-5 most important stories 3× daily regardless of portfolio.
"""
import hashlib
import logging
import feedparser
import requests
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL_FAST, MODEL_DEEP, MARKET_NEWS_FEEDS
from db.queries import seen_news, mark_news_seen, already_alerted, make_hash
from db.queries import record_alert

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)


def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:32]


def fetch_global_news(max_per_feed: int = 8) -> list[dict]:
    """Pull latest headlines from all major finance RSS feeds."""
    articles = []
    seen_hashes: set[str] = set()

    for feed_url in MARKET_NEWS_FEEDS:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:max_per_feed]:
                url = entry.get("link", "")
                h = _url_hash(url)
                if h in seen_hashes or seen_news(h):
                    continue
                seen_hashes.add(h)
                articles.append({
                    "title":    entry.get("title", ""),
                    "url":      url,
                    "url_hash": h,
                    "source":   feed.feed.get("title", ""),
                    "summary":  entry.get("summary", "")[:300],
                    "published": entry.get("published", ""),
                })
        except Exception as e:
            log.warning(f"RSS fetch ({feed_url[:40]}): {e}")

    return articles


def rank_and_select_top_stories(articles: list[dict], top_n: int = 5) -> list[dict]:
    """Use Claude Haiku to rank articles by market importance, return top N."""
    if not articles:
        return []

    summaries = "\n".join([
        f"{i+1}. [{a['source']}] {a['title']} — {a['summary'][:150]}"
        for i, a in enumerate(articles[:30])
    ])

    prompt = f"""You are a chief market strategist. Rank these news stories by MARKET IMPORTANCE.

Score 0-10:
10 = Central bank decision, major economic data miss, systemic risk event, major geopolitical shock
8-9 = Significant earnings surprise, major M&A, regulatory action on big company, recession signal
6-7 = Important earnings, rate commentary, major company news, sector-wide impact
4-5 = Notable company news, earnings in line, general market commentary
1-3 = Noise, opinion, minor news

NEWS:
{summaries}

Return ONLY JSON: [{{"idx": 1, "score": 8, "category": "Central Bank", "one_line": "Fed signals pause..."}}]
Select only stories scoring 6+. Be strict."""

    try:
        resp = client.messages.create(
            model=MODEL_FAST, max_tokens=600,
            messages=[{"role": "user", "content": prompt}]
        )
        import json, re
        text = resp.content[0].text
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if not match:
            return []
        ranked = json.loads(match.group())
        result = []
        for r in sorted(ranked, key=lambda x: -x.get("score", 0))[:top_n]:
            idx = r.get("idx", 0) - 1
            if 0 <= idx < len(articles):
                articles[idx]["score"] = r.get("score", 0)
                articles[idx]["category"] = r.get("category", "")
                articles[idx]["one_line"] = r.get("one_line", "")
                result.append(articles[idx])
        return result
    except Exception as e:
        log.warning(f"rank_stories: {e}")
        return articles[:top_n]


def compose_market_brief(stories: list[dict], session: str = "midday") -> str:
    """Use Claude Sonnet to write a tight market news brief."""
    session_labels = {
        "premarket": "PRE-MARKET NEWS BRIEF",
        "midday":    "MIDDAY MARKET UPDATE",
        "close":     "MARKET CLOSE BRIEF",
    }
    label = session_labels.get(session, "MARKET NEWS BRIEF")

    stories_str = "\n\n".join([
        f"[{s.get('source','')}] {s.get('title','')}\n{s.get('summary','')[:200]}"
        for s in stories
    ])

    prompt = f"""Write a tight {label} covering these top stories.

STORIES:
{stories_str}

Format:
📰 {label}

[2-sentence market context]

TOP STORIES:
• [Category] Story headline — 1-sentence why it matters for markets
• [Category] Story headline — 1-sentence why it matters
[up to 5 bullets]

PORTFOLIO IMPACT: [1-2 sentences on what this means for tech/growth stocks generally]

Max 200 words. Bloomberg terminal tone. No fluff."""

    try:
        resp = client.messages.create(
            model=MODEL_DEEP, max_tokens=400,
            messages=[{"role": "user", "content": prompt}]
        )
        return resp.content[0].text.strip()
    except Exception as e:
        log.warning(f"compose_market_brief: {e}")
        bullets = "\n".join([f"• {s.get('title','')}" for s in stories])
        return f"📰 {label}\n\n{bullets}"


async def run_market_news(send_fn, session: str = "midday"):
    """
    Main entry point: fetch → rank → compose → send.
    Called 3× daily: premarket (8:00 AM), midday (12:30 PM), close (4:30 PM).
    """
    log.info(f"Running market news brief ({session})")
    articles = fetch_global_news()
    if not articles:
        log.info("No new market news articles")
        return

    top = rank_and_select_top_stories(articles, top_n=5)
    if not top:
        log.info("No high-importance stories found")
        return

    # Dedup: don't send same brief twice
    content_hash = make_hash("MARKET_NEWS", session, top[0].get("url_hash", ""))
    if already_alerted("MARKET_NEWS", session, content_hash):
        return

    # Mark articles as seen
    for a in top:
        mark_news_seen(a["url_hash"], "MARKET")

    msg = compose_market_brief(top, session)
    await send_fn(msg)
    record_alert("MARKET_NEWS", session, content_hash, "DATA", msg)
    log.info(f"Market news brief sent ({session}): {len(top)} stories")
