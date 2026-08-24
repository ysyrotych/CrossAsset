"""
Competitor Intelligence Engine — Loop 6
Monitors competitors, suppliers, customers of portfolio holdings.
Alerts when something happens to them that impacts your position.
"""
import logging
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL_FAST, MODEL_DEEP, WATCHLIST
from data.news import get_all_news
from db.queries import already_alerted, make_hash
from agents.chief_of_staff import try_send_alert

log = logging.getLogger(__name__)
client = Anthropic(api_key=ANTHROPIC_API_KEY)

# Competitor / supply chain map for each portfolio holding
COMPETITOR_MAP: dict[str, dict] = {
    "META": {
        "competitors":  ["SNAP", "Pinterest", "TikTok", "Twitter"],
        "customers":    ["Procter & Gamble", "Unilever", "Coca-Cola"],
        "keywords":     ["social media advertising", "digital ad spend", "meta competitor"],
        "impact_thesis": "Ad revenue and user engagement competitive dynamics",
    },
    "GOOGL": {
        "competitors":  ["Microsoft Bing", "OpenAI", "Amazon Advertising", "Apple Search"],
        "customers":    ["enterprise cloud buyers"],
        "keywords":     ["search market share", "AI search", "google alternative", "bing chatgpt"],
        "impact_thesis": "Search dominance and cloud market share",
    },
    "NVDA": {
        "competitors":  ["AMD", "Intel", "Qualcomm", "Google TPU", "Amazon Trainium"],
        "suppliers":    ["TSMC", "SK Hynix", "Samsung"],
        "customers":    ["Microsoft", "Amazon", "Google", "Meta"],
        "keywords":     ["AI chip", "GPU shortage", "TSMC orders", "AMD MI300"],
        "impact_thesis": "AI compute monopoly and supply chain capacity",
    },
    "UBER": {
        "competitors":  ["Lyft", "DoorDash", "Grab", "Waymo"],
        "keywords":     ["ride sharing", "gig economy", "autonomous vehicle", "lyft earnings"],
        "impact_thesis": "Network moat and autonomous vehicle disruption risk",
    },
    "DUOL": {
        "competitors":  ["Babbel", "Rosetta Stone", "ChatGPT language learning"],
        "keywords":     ["language learning app", "duolingo competitor", "edtech"],
        "impact_thesis": "Gamified learning flywheel and AI integration",
    },
    "CMG": {
        "competitors":  ["Yum Brands", "McDonald's", "Shake Shack", "Sweetgreen"],
        "keywords":     ["fast casual restaurant", "chipotle competitor", "restaurant comps"],
        "impact_thesis": "Fast casual unit economics and same-store sales",
    },
    "AMZN": {
        "competitors":  ["Microsoft Azure", "Google Cloud", "Walmart", "Shopify"],
        "keywords":     ["AWS competitor", "cloud computing", "ecommerce", "azure growth"],
        "impact_thesis": "AWS margin expansion and retail profitability",
    },
    "AAPL": {
        "competitors":  ["Samsung", "Google Pixel", "Huawei"],
        "suppliers":    ["TSMC", "Foxconn", "Corning"],
        "keywords":     ["iPhone sales", "apple chip", "TSMC production", "smartphone market"],
        "impact_thesis": "Services flywheel and ecosystem lock-in",
    },
    "APLD": {
        "competitors":  ["CoreWeave", "Lambda Labs", "Digital Realty"],
        "keywords":     ["AI data center", "GPU cloud", "hyperscale data center"],
        "impact_thesis": "AI data center infrastructure buildout",
    },
    "NBIS": {
        "competitors":  ["CoreWeave", "Lambda Labs", "AWS"],
        "keywords":     ["Nebius AI infrastructure", "GPU cloud Europe"],
        "impact_thesis": "AI infrastructure play, European cloud",
    },
    "HOOD": {
        "competitors":  ["Coinbase", "Interactive Brokers", "Webull", "E*TRADE"],
        "keywords":     ["retail trading", "crypto brokerage", "payment for order flow"],
        "impact_thesis": "Retail brokerage growth and crypto exposure",
    },
}


def check_competitor_news(ticker: str, send_fn) -> bool:
    """
    Fetch news for competitors of a portfolio holding.
    Alert if material news about a competitor could impact the holding.
    """
    comp_data = COMPETITOR_MAP.get(ticker)
    if not comp_data:
        return False

    keywords = comp_data.get("keywords", [])
    all_articles = []

    # Search news for each keyword
    for kw in keywords[:4]:
        articles = get_all_news(kw, kw, days=1)
        all_articles.extend(articles[:3])

    if not all_articles:
        return False

    # Use Claude Haiku to score relevance to this holding
    summaries = "\n".join([
        f"{i+1}. [{a.get('source','')}] {a.get('title','')} — {a.get('summary','')[:150]}"
        for i, a in enumerate(all_articles[:10])
    ])

    prompt = f"""You are a portfolio manager monitoring news for portfolio impact.

HOLDING: {ticker}
Investment thesis: {comp_data.get('impact_thesis','')}

NEWS (about competitors/suppliers/customers):
{summaries}

For each news item, rate its IMPACT on {ticker} from 0-10:
10 = Major direct impact on thesis, stock will likely move
6-9 = Significant read-through to {ticker}'s business
3-5 = Minor relevance
0-2 = Not relevant

Return JSON only: [{{"idx": 1, "score": 7, "impact": "TSMC cut orders → NVDA supply constrained"}}, ...]
Only include items with score >= 6."""

    try:
        import json, re
        resp = client.messages.create(model=MODEL_FAST, max_tokens=400,
                                       messages=[{"role": "user", "content": prompt}])
        text = resp.content[0].text
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if not match:
            return False
        rated = json.loads(match.group())
        if not rated:
            return False

        top = max(rated, key=lambda x: x.get("score", 0))
        if top.get("score", 0) < 6:
            return False

        idx = top.get("idx", 1) - 1
        article = all_articles[min(idx, len(all_articles)-1)]
        impact  = top.get("impact", "")

        content_hash = make_hash(ticker, "competitor", article.get("title","")[:50])
        if already_alerted(ticker, "competitor", content_hash):
            return False

        msg = f"""🔗 COMPETITOR SIGNAL → {ticker}

{article.get('title','')[:120]}
[{article.get('source','')}]

Impact on {ticker}: {impact}
Thesis affected: {comp_data.get('impact_thesis','')}

Read-through score: {top['score']}/10"""

        try_send_alert(ticker, "competitor", content_hash, "WATCH", msg, send_fn)
        return True

    except Exception as e:
        log.warning(f"competitor_agent({ticker}): {e}")
        return False
