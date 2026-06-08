# CrossAsset — AI Macro Desk Brief

> **"CrossAsset turns macro events into market implications and actions across equities, rates, FX, commodities, and your personal watchlist."**

An AI-powered daily macro briefing and automation platform for equity research interns, S&T analysts, and finance students. Generates a daily "desk brief" that translates economic data, macro events, and market moves into cross-asset implications, watchlist impact, and analyst tasks.

---

## Running Locally

```bash
# 1. Clone and install
cd crossasset
npm install

# 2. Configure environment (optional — app runs in demo mode without keys)
cp .env.local.example .env.local
# Edit .env.local and add your API keys

# 3. Start dev server
npm run dev
# → Open http://localhost:3000
```

**The app runs fully in demo mode with zero API keys configured.** All pages load with realistic demo data.

---

## API Keys

| Key | Required? | Purpose | Free? |
|-----|-----------|---------|-------|
| `ANTHROPIC_API_KEY` | For AI generation | Claude generates the structured brief | Yes (credits) |
| `FRED_API_KEY` | For live macro data | 10Y yield, CPI, unemployment, GDP, etc. | Yes |
| `BLS_API_KEY` | Optional | BLS labor/inflation data | Yes |
| `BEA_API_KEY` | Optional | BEA GDP/PCE (FRED covers this) | Yes |
| `ALPHA_VANTAGE_API_KEY` | Optional | Equity price quotes | Yes (limited) |
| Supabase env vars | Optional | Persistent cross-session storage | Yes |

- **No keys:** Full demo mode — all pages render with realistic fixture data.
- **`FRED_API_KEY` only:** Dashboard shows live macro data (10Y yield, CPI, unemployment, etc.).
- **Both `ANTHROPIC_API_KEY` + `FRED_API_KEY`:** "Generate Brief" button calls Claude with live data for a real AI-generated institutional brief.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — macro metrics, charts, regime label, watchlist snapshot |
| `/issue` | Daily Issue — full AI-generated desk brief |
| `/watchlist` | 10 default tickers with macro sensitivity tags, localStorage CRUD |
| `/tasks` | AI-generated + manual tasks with status/priority tracking |
| `/calendar` | Upcoming CPI, FOMC, payrolls with `.ics` download |
| `/reaction-tracker` | Prediction vs actual for macro events — a learning log |
| `/archive` | Past generated issues |
| `/settings` | API key status, profile, tone preferences |

---

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS** + **shadcn/ui**
- **Recharts** for macro charts
- **Claude API** (`claude-opus-4-8`) for structured JSON brief generation
- **FRED API** for live macro data
- **localStorage** for persistence (Supabase-ready schema included)

---

## FRED Series Used

| Series | Description |
|--------|-------------|
| DGS10 | 10-Year Treasury Yield |
| DGS2 | 2-Year Treasury Yield |
| T10Y2Y | 2s10s Yield Curve Spread |
| FEDFUNDS | Effective Federal Funds Rate |
| CPIAUCSL | CPI (All Urban Consumers) |
| CPILFESL | Core CPI (ex Food & Energy) |
| UNRATE | Unemployment Rate |
| PAYEMS | Nonfarm Payrolls |
| GDP | Real GDP |
| PCEPI | PCE Price Index |

---

## Disclaimer

CrossAsset is for educational and research workflow purposes only. It does not provide investment advice or trading recommendations.
