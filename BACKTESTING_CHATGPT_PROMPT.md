# ChatGPT Implementation Plan — CrossAsset Backtesting Page

---

## Project context (paste this first into every ChatGPT session)

```
I'm building a backtesting feature inside CrossAsset — a Next.js 14 (App Router)
web app for macro intelligence. The app uses TypeScript, Tailwind CSS v4, and
Recharts for charts. The design is premium/minimalist: white background, deep navy
#0c1b38 as accent, Cormorant Garamond for headings.

The backtesting page lives at: app/backtesting/page.tsx
All types are defined at the top of that file.
Two API routes:
  POST /api/backtesting/parse-strategy  → returns BacktestConfig
  POST /api/backtesting/run-backtest    → returns BacktestResult

Both routes have working stubs (demo data) so the full flow already works.
Your job is to replace stubs with real logic AND build out the UI components.
```

---

## Prompt 1 — Assumption Review UI (StepAssumptions component)

```
Read the StepAssumptions function stub in app/backtesting/page.tsx.

Replace the stub with a full implementation. Requirements:

LAYOUT:
- Group assumptions by category (Universe, Entry, Exit, Position Sizing, Risk,
  Costs, Rebalance) — each group has a bold section header
- Each assumption row shows:
    [category pill] [label] [value — EDITABLE inline] [confidence badge] [note icon]
- Confidence badge: "high" = green, "medium" = amber, "low" = red/orange
- Clicking the note icon shows a small tooltip/popover with the AI's reasoning
- Clicking the value field makes it an <input> with the current value pre-filled
  (onChange updates the assumption in local state)

HEADER:
- Show strategy name, date range, asset class, tickers as non-editable summary pills
- "X assumptions extracted" count

FOOTER:
- "← Edit description" button (calls onBack)
- "Approve & Run Backtest →" navy button (calls onApprove with updated config)

STATE:
- useState to hold a mutable copy of config.assumptions
- When user edits a value, update that assumption in the array
- Pass the updated full config to onApprove

STYLE: match the existing CrossAsset design — borders #e8e8e8, navy #0c1b38,
text sizes 11-13px, font-semibold labels, no rounded corners (rounded-sm only).
```

---

## Prompt 2 — Results Stats Bar (StepResults — stats section)

```
Read the StepResults function stub in app/backtesting/page.tsx.

Implement the stats bar section at the top of the results view.

Show these 8 stats in a horizontal grid (4 columns × 2 rows):
  Row 1: CAGR | Sharpe Ratio | Max Drawdown | Win Rate
  Row 2: Total Return | Sortino | Alpha vs Benchmark | Total Trades

Each stat tile:
  - Large number (tabular-nums, font-bold, ~28px)
  - Small label below (10px, uppercase, tracking)
  - Color coding: CAGR/Sharpe/Alpha green if positive, red if negative.
    Max Drawdown always red. Win Rate neutral.
  - A subtle benchmark comparison line under CAGR:
    "vs {benchmarkCagr}% benchmark" in muted text

Below the stats, show the AI-generated result.summary paragraph in italic,
inside a subtle bg-[#f5f8ff] border-[#dce5ff] box.

Also show: strategy name as h2 (Cormorant Garamond, 28px, font-light),
"Run on {date}" and date range subtitle.
```

---

## Prompt 3 — Equity Curve Chart

```
In StepResults, implement the equity curve chart.

Use Recharts LineChart with ResponsiveContainer.
Data source: result.equityCurve (array of { date, portfolio, benchmark }).

Requirements:
- Two lines: portfolio (navy #0c1b38, strokeWidth 2.5) and benchmark (#9ca3af, strokeWidth 1.5, dashed)
- X axis: monthly tick marks, formatted as "Jan '20" style
- Y axis: format as $XXXk or $X.Xm
- Custom tooltip: shows date, portfolio value, benchmark value, daily difference
- Chart height: 300px
- Legend: "Strategy" (navy dot) | "Benchmark SPY" (gray dot) — top right
- No CartesianGrid on X axis, faint horizontal lines on Y (#f0f0f0)
- Small annotations: mark the max drawdown period with a subtle shaded region

Above the chart: section label "EQUITY CURVE" in the CrossAsset SectionLabel style.
```

---

## Prompt 4 — Drawdown Chart

```
In StepResults, implement the drawdown chart below the equity curve.

Use Recharts AreaChart. Data: result.drawdownSeries ({ date, drawdown }).

Requirements:
- drawdown values are negative (0 to -0.30 range)
- Fill the area below zero with red (#b42318 at 15% opacity)
- Line stroke: #b42318, strokeWidth 1.5
- Y axis: format as percentage (e.g. "-15%"), domain auto
- X axis: same month tick marks as equity curve chart
- Chart height: 140px
- Tooltip: shows date and drawdown %
- Horizontal dashed line at y=0 (color #e0e0e0)

Also add: "Max Drawdown: {value}% over {days} days" as a small stat below the chart.
```

---

## Prompt 5 — Monthly Returns Heatmap

```
In StepResults, implement a monthly returns heatmap.

Layout: a grid where each row = 1 year, each column = 1 of 12 months.

Data: result.monthlyReturns ({ year, month, return }) — but if empty (stub),
generate placeholder data using the equityCurve to compute monthly returns.

Each cell:
- Background color: green scale for positive, red scale for negative.
  Use: return > 3% = dark green, 1-3% = light green, 0-1% = very light green,
       0 to -1% = very light red, -1 to -3% = light red, < -3% = dark red.
- Text: the return value (e.g. "+2.1%") in 10px, white if dark bg, navy if light
- On hover: tooltip with exact return and rank

Row header: year number (bold, navy)
Column headers: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec

Section label: "MONTHLY RETURNS" above the grid.
Yearly CAGR as a 13th column on the right.
```

---

## Prompt 6 — Trade Log Table

```
In StepResults, implement a trades table.

Data source: result.trades — but if empty (stub), generate 20 demo trade records
from the equityCurve data so the table is always populated.

Table columns:
  # | Ticker | Entry Date | Exit Date | Entry Price | Exit Price | Return % | P&L | Days Held

Requirements:
- Sortable columns (click header to sort asc/desc) — use local state
- Pagination: 15 rows per page with prev/next buttons
- Return % colored: green positive, red negative
- Summary row at top: "X trades | Win rate Y% | Avg hold Z days"
- "Export CSV" button (top right) that triggers a browser download
  of the trades array as a .csv file

Styling: match CrossAsset table style — #f5f5f5 header, border-[#e8e8e8],
11-12px text, tabular-nums for numbers.
```

---

## Prompt 7 — Parse Strategy API (Claude integration)

```
Implement POST /api/backtesting/parse-strategy/route.ts

Replace the demo stub with a real Anthropic Claude API call.

The route receives: { description: string }
It must return: BacktestConfig (type defined in app/backtesting/page.tsx)

Implementation:
1. Import Anthropic from "@anthropic-ai/sdk"
2. Build a system prompt that tells Claude:
   - You are a quantitative strategy analyst.
   - Extract all tradeable rules from the user's description.
   - Return ONLY valid JSON matching the BacktestConfig type.
   - For each rule, create one Assumption with id, category, label, value,
     editable: true, confidence ("high"/"medium"/"low"), and note.
   - If something is ambiguous, set confidence: "low" and explain in note.
   - Apply these defaults if not stated:
       universe: S&P 500 constituents
       date range: 2015-01-01 to 2024-12-31
       initial capital: 100000
       costs: 0.05% per trade
       stop-loss: none (unless mentioned)
   - strategyName: invent a short descriptive name (3-5 words)

3. Call claude-opus-4-8 with temperature 0 (deterministic parsing)
4. Strip markdown code fences from response if present
5. JSON.parse the result
6. Validate that assumptions array is non-empty, return 400 if parsing fails
7. Return the config

Error handling: if Claude fails or returns invalid JSON, return the demo config
from the existing stub as fallback with a flag { _fallback: true }.
```

---

## Prompt 8 — Run Backtest API (simulated engine)

```
Implement POST /api/backtesting/run-backtest/route.ts

Replace the simple random-walk stub with a realistic simulation engine.

The route receives: { config: BacktestConfig }
It must return: BacktestResult

Build a simulation engine that:

1. PRICE SIMULATION:
   - Use Geometric Brownian Motion (GBM) seeded from the strategy name
     (so same strategy always produces same result — deterministic)
   - Parameters derived from assetClass:
       Equities: mu=0.10/yr, sigma=0.18/yr
       Bonds: mu=0.04/yr, sigma=0.06/yr
       Commodities: mu=0.05/yr, sigma=0.22/yr
       Mixed: interpolate
   - Generate daily prices for each ticker from startDate to endDate

2. STRATEGY APPLICATION:
   - Apply entry/exit/stop-loss rules from assumptions in plain text
   - Parse assumption values into numeric rules:
       "10% below entry" → stop at entryPrice * 0.90
       "top 20% by momentum" → rank by 252-day return, take top quintile
       "monthly rebalance" → rebalance on first trading day of each month
   - Track each trade: entry date, exit date, entry price, exit price, return

3. STATS CALCULATION:
   - Calculate all BacktestStats fields using the formulas in the route comment
   - Benchmark: always simulate SPY with mu=0.105/yr, sigma=0.175/yr

4. MONTHLY RETURNS GRID:
   - Compute portfolio return for each calendar month from the equity curve

5. CLAUDE SUMMARY:
   - Call Claude with the stats to generate a 2-3 sentence plain-English summary
   - Keep it crisp: performance vs benchmark, key risk stat, one observation

Seed the RNG from: hash of config.strategyName + config.startDate
This ensures the same strategy always shows the same backtest result.
```

---

## Prompt 9 — Polish pass

```
Do a full polish pass on the backtesting page. Specifically:

1. STEP INDICATOR: make it sticky (stays visible while scrolling through results)
   - Position: fixed below the topbar (top: 52px), full content-width
   - Background: white, border-bottom

2. EMPTY STATES: if equityCurve has < 10 points, show a friendly error card
   instead of a broken chart

3. RESPONSIVE: on screens < 1100px, collapse the 4-column stats grid to 2 columns

4. LOADING STATES: both StepParsing and StepRunning should show animated
   skeleton bars instead of just a spinner. Show what's being loaded:
   StepParsing: "Reading strategy... Extracting entry rules... Extracting exit rules..."
   (cycle through these with 800ms intervals)
   StepRunning: "Initializing simulation... Running 10 years of daily prices...
   Applying entry rules... Calculating statistics..."

5. PRINT/EXPORT: add a "Print report" button in StepResults that calls window.print()
   and has a @media print CSS that hides the sidebar and topbar

6. STRATEGY HISTORY: store the last 5 BacktestResults in localStorage under
   "crossasset_backtests". Add a small "Recent" section above the textarea in
   StepInput showing the last 3 strategy names as clickable chips that jump to results.
```

---

## Order of implementation

1. Prompt 1 (Assumption UI) — makes the flow usable end-to-end
2. Prompts 2 + 3 (Stats bar + Equity curve) — core results view
3. Prompt 4 (Drawdown chart) — one more chart, fast to add
4. Prompt 5 (Monthly heatmap) — visual highlight
5. Prompt 6 (Trade log) — data deep-dive
6. Prompt 7 (Claude API) — real AI parsing
7. Prompt 8 (Real backtest engine) — real simulation
8. Prompt 9 (Polish) — finish

After each prompt, paste the full updated file back into the next session.

---

## File map (what to paste into each ChatGPT session)

| Session | Files to paste |
|---------|---------------|
| 1–6 (UI) | `app/backtesting/page.tsx` (full) |
| 7 (Parse API) | `app/api/backtesting/parse-strategy/route.ts` + top of page.tsx for types |
| 8 (Backtest API) | `app/api/backtesting/run-backtest/route.ts` + types |
| 9 (Polish) | Full `app/backtesting/page.tsx` |
