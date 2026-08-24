"""
Analyst Desk — Watchlist & Configuration
Edit WATCHLIST and THRESHOLDS to personalise. Everything else is env-driven.
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

# ── Watchlist ─────────────────────────────────────────────────────────────────
# ticker → { weight: portfolio %, thesis: your investment thesis }
# Weight is informational — used to escalate severity for larger positions.
WATCHLIST: dict[str, dict] = {
    "AAPL":  {"weight": 0.08, "sector": "Technology",   "thesis": "Services flywheel + ecosystem lock-in. Watch: services margin, China revenue, Vision Pro adoption."},
    "MSFT":  {"weight": 0.09, "sector": "Technology",   "thesis": "Azure + AI copilot upsell cycle. Watch: cloud segment growth rate, OpenAI partnership terms."},
    "NVDA":  {"weight": 0.10, "sector": "Technology",   "thesis": "AI compute monopoly in training + inference. Watch: data center guidance, China export controls, AMD competition."},
    "GOOGL": {"weight": 0.07, "sector": "Technology",   "thesis": "Search moat + Cloud inflection. Watch: AI search cannibalization risk, Cloud vs Azure/AWS gap."},
    "META":  {"weight": 0.06, "sector": "Technology",   "thesis": "Ad efficiency + Llama open-source moat. Watch: Reality Labs burn, regulatory risk, ad market cycle."},
    "JPM":   {"weight": 0.05, "sector": "Financials",   "thesis": "Best-in-class bank, rate cycle beneficiary. Watch: NII guidance, credit card delinquencies, CRE exposure."},
    "BRK-B": {"weight": 0.05, "sector": "Financials",   "thesis": "Value compounder, Buffett succession. Watch: book value growth, operating earnings, cash deployment."},
    "SPY":   {"weight": 0.10, "sector": "Index",        "thesis": "Core market exposure. Benchmark."},
    "QQQ":   {"weight": 0.08, "sector": "Index",        "thesis": "Tech-weighted beta. Monitor relative to SPY for rotation signals."},
    "GLD":   {"weight": 0.04, "sector": "Commodities",  "thesis": "Inflation hedge + tail risk. Watch: real rates, DXY correlation."},
}

# ── Alert Thresholds ──────────────────────────────────────────────────────────
THRESHOLDS = {
    "price_move_urgent":    0.05,    # 5%+ single session → URGENT
    "price_move_watch":     0.03,    # 3%+ single session → WATCH
    "price_move_gap_urgent": 0.04,   # 4%+ gap from prior close → URGENT
    "volume_spike_mult":    2.5,     # 2.5× 30-day avg volume → WATCH
    "insider_sell_urgent":  1_000_000,  # $1M+ insider sell → URGENT
    "insider_sell_watch":   500_000,    # $500K+ insider sell → WATCH
    "insider_buy_positive": 200_000,    # $200K+ insider buy → POSITIVE
    "pt_cut_pct":           0.10,    # 10%+ PT cut → WATCH
    "dedup_window_hours":   24,      # don't re-alert same ticker+type within 24h
}

# ── Macro Series to Monitor ───────────────────────────────────────────────────
# FRED series IDs to fetch for macro overlay
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

# ── Claude Models ─────────────────────────────────────────────────────────────
MODEL_FAST  = "claude-haiku-4-5-20251001"   # screening + materiality scoring
MODEL_DEEP  = "claude-sonnet-4-6"           # write-ups, briefs, deep research

# ── Market Hours (ET) ─────────────────────────────────────────────────────────
MARKET_OPEN_ET  = (9, 30)   # 9:30 AM
MARKET_CLOSE_ET = (16, 0)   # 4:00 PM

# ── DB ────────────────────────────────────────────────────────────────────────
DB_PATH = os.getenv("DB_PATH", "analyst_desk.db")
