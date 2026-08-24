"""
Analyst Desk — Watchlist & Configuration
Watchlist stores actual share counts — weights computed live from current prices.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── API Keys ──────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY  = os.getenv("ANTHROPIC_API_KEY", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_USER_ID   = int(os.getenv("TELEGRAM_USER_ID", "0"))
FMP_API_KEY        = os.getenv("FMP_API_KEY", "")
FRED_API_KEY       = os.getenv("FRED_API_KEY", "")
NEWS_API_KEY       = os.getenv("NEWS_API_KEY", "")
FINNHUB_API_KEY    = os.getenv("FINNHUB_API_KEY", "")
TIMEZONE           = os.getenv("TIMEZONE", "America/New_York")
LOG_LEVEL          = os.getenv("LOG_LEVEL", "INFO")

# Google Calendar (stored as JSON strings in env after OAuth setup)
GOOGLE_CREDENTIALS_JSON = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
GOOGLE_TOKEN_JSON       = os.getenv("GOOGLE_TOKEN_JSON", "")

# ── Real Portfolio (Yulian — Robinhood) ───────────────────────────────────────
# shares = actual shares owned. Weight computed live from current price × shares.
WATCHLIST: dict[str, dict] = {
    "META":  {"shares": 1.82,      "sector": "Technology",  "thesis": "Ad efficiency + Llama open-source moat. Watch: Reality Labs burn, regulatory risk, ad market."},
    "GOOGL": {"shares": 1.68,      "sector": "Technology",  "thesis": "Search moat + Cloud inflection. Watch: AI search cannibalization, Cloud vs Azure/AWS gap."},
    "UBER":  {"shares": 6.24,      "sector": "Technology",  "thesis": "Mobility + delivery network moat. Watch: autonomous vehicle risk, driver economics, take rate."},
    "DUOL":  {"shares": 2.86,      "sector": "Technology",  "thesis": "Gamified language learning flywheel. Watch: DAU growth, subscription conversion, AI integration."},
    "NBIS":  {"shares": 1.19,      "sector": "Technology",  "thesis": "AI infrastructure play (Nebius). Watch: GPU utilization, revenue growth, hyperscaler competition."},
    "CMG":   {"shares": 4.57,      "sector": "Consumer",    "thesis": "Best-in-class fast casual compounder. Watch: same-store sales, menu pricing, digital mix."},
    "VOO":   {"shares": 0.170013,  "sector": "ETF",         "thesis": "Core S&P 500 exposure. Benchmark."},
    "AMZN":  {"shares": 0.440286,  "sector": "Technology",  "thesis": "AWS margin expansion + ad revenue inflection. Watch: AWS growth rate, retail profitability."},
    "AAPL":  {"shares": 0.278221,  "sector": "Technology",  "thesis": "Services flywheel + ecosystem lock-in. Watch: services margin, China revenue, AI integration."},
    "APLD":  {"shares": 2.22,      "sector": "Technology",  "thesis": "Applied Digital — AI data center infra. Watch: contract wins, power capacity, financing."},
    "HOOD":  {"shares": 0.173502,  "sector": "Financials",  "thesis": "Retail brokerage + crypto exposure. Watch: MAU, PFOF regulation, Gold subscribers."},
    "NVDA":  {"shares": 0.058889,  "sector": "Technology",  "thesis": "AI compute monopoly. Watch: data center guidance, China export controls, AMD competition."},
    "VUG":   {"shares": 0.130194,  "sector": "ETF",         "thesis": "Large-cap growth ETF. Tech-heavy benchmark."},
}

# ── Alert Thresholds ──────────────────────────────────────────────────────────
THRESHOLDS = {
    "price_move_urgent":     0.05,
    "price_move_watch":      0.03,
    "price_move_gap_urgent": 0.04,
    "volume_spike_mult":     2.5,
    "insider_sell_urgent":   1_000_000,
    "insider_sell_watch":    500_000,
    "insider_buy_positive":  200_000,
    "pt_cut_pct":            0.10,
    "dedup_window_hours":    24,
}

# ── Macro Series ──────────────────────────────────────────────────────────────
MACRO_SERIES = {
    "fed_funds":   "FEDFUNDS",
    "t10y":        "DGS10",
    "t2y":         "DGS2",
    "real10y":     "DFII10",
    "breakeven5y": "T5YIE",
    "hy_spread":   "BAMLH0A0HYM2",
    "ig_spread":   "BAMLC0A0CM",
    "vix":         "VIXCLS",
}

# ── Global Market News RSS Feeds ──────────────────────────────────────────────
MARKET_NEWS_FEEDS = [
    "https://feeds.reuters.com/reuters/businessNews",
    "https://feeds.reuters.com/reuters/technologyNews",
    "https://www.cnbc.com/id/10000664/device/rss/rss.html",
    "https://www.cnbc.com/id/20910258/device/rss/rss.html",
    "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "https://feeds.a.dj.com/rss/RSSWSJD.xml",
]

# ── Claude Models ─────────────────────────────────────────────────────────────
MODEL_FAST = "claude-haiku-4-5-20251001"
MODEL_DEEP = "claude-sonnet-4-6"

# ── Market Hours (ET) ─────────────────────────────────────────────────────────
MARKET_OPEN_ET  = (9, 30)
MARKET_CLOSE_ET = (16, 0)
DB_PATH = os.getenv("DB_PATH", "analyst_desk.db")
