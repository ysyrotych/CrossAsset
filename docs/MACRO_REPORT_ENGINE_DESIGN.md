# CrossAsset — Weekly Macro Report Engine
### Full architecture to replicate & surpass the URETF Weekly Economic Update — *design, pending approval*

**Source deck:** University of Richmond Robins School of Business, "URETF — U.S. Macroeconomic & Financial Market Weekly Update" (57 slides, Mar 20 2026).
**Goal:** one click generates the *entire* report — every chart auto-built from live data, every section narrated by AI — rendered more beautifully than the original, viewable as a web report and exportable as a slide-style PDF.
**Route:** `/macro-report` · **Nav:** "Macro Report"

---

## 1. What the source deck actually is (analysis)

A weekly institutional macro brief with a rigid, repeatable structure. Three slide archetypes:

1. **Narrative summary slides** (3–9): dense nested bullets — "Summary – Key Macroeconomic Indicators" (Fed, inflation, labor, consumer, housing, ISM, GDP) and "Summary – Key Financial Market Data" (equity: S&P/Nasdaq/S&P600 PE, EPS growth, earnings yield, VIX; fixed income: UST yields, curve, MOVE, HY/IG spreads).
2. **Analysis + exhibit slides** (e.g. Monetary Policy 10): left column of `• ▪ ➢` bullets, right column with a data table (Fed SEP) + an annotated chart.
3. **Chart-grid slides** (e.g. Labor 23, NFIB 33, ISM 34–41): 2–6 time-series panels per slide.

**Chart DNA (must reproduce, then refine):** light-blue panel, centered bold title, unit label top-right, black line over long history, **blue average reference line** with label ("Ave = 98"), **recession shading**, multi-series legends, **inset zoom** mini-charts (recent 12 mo), **yellow callout** annotations, gray tag labels. Tables: navy header + alternating blue rows. Brand: UR crimson + navy.

### The 18 sections (→ our report modules)
| # | Section | Slides | Key exhibits |
|---|---|---|---|
| 1 | Macro Summary | 3–7 | narrative (AI) |
| 2 | Financial Market Summary | 8–9 | S&P EPS growth chart; equity/FI stat blocks |
| 3 | Monetary Policy | 10–14 | Fed SEP table, bank reserves, ERP, yield curve, key rates, UST auctions/holdings |
| 4 | Commodities | 15–16 | Brent oil, Baltic Dry, gold |
| 5 | Inflation | 17–20 | PCE, CPI, new-rental vs PCE housing, PPI, import prices |
| 6 | Inflation Expectations | 21–22 | U-Mich 1y & 5–10y (by party), NY Fed 1y, 10y TIPS |
| 7 | Labor Market | 23–25 | claims, payrolls, U-rate, participation; 2025 payroll table; JOLTS (openings/hire/quit/layoff) |
| 8 | Consumer Income & Spending | 26–28 | real income, real PCE, retail sales, auto sales, delinquencies, credit/wealth |
| 9 | Housing | 29–31 | starts, supply, new/existing sales, NAHB, mortgage rate, affordability, Case-Shiller |
| 10 | Consumer Confidence | 32 | Conf Board, U-Mich sentiment/expectations |
| 11 | NFIB Small Business | 33 | optimism, uncertainty, worries, capex, hiring |
| 12 | ISM Services PMI | 34–37 | overall + 8 components |
| 13 | ISM Manufacturing PMI | 38–41 | overall + 8 components |
| 14 | Other Manufacturing | 42 | industrial production, core capital-goods orders |
| 15 | Trade | 43 | trade deficit, imports/exports, trade-weighted dollar |
| 16 | Treasury Budget | 44 | budget balance, customs (tariff) revenue, revenue mix |
| 17 | GDP | 45–56 | growth+FDS, components, consumption, investment (incl. IT), govt (defense/non-def/S&L), net trade, corporate profits |
| 18 | Financial Conditions | 57 | Chicago Fed NFCI (+ subindexes) |

---

## 2. Data-source mapping (the crux)

The app **already has FRED integration** (`lib/sources/fred.ts`, dashboard route). ~75% of the ~90 charts are direct FRED pulls. Strategy: a generic FRED time-series fetcher + a per-chart **manifest** mapping each exhibit to its series, transform, and styling.

### Fully auto from FRED (examples — ~70 charts)
Fed funds `DFF/FEDFUNDS` · PCE `PCEPI`/`PCEPILFE` (y/y) · CPI `CPIAUCSL`/`CPILFESL` · PPI `PPIFIS` · Import prices `IR` · UNRATE · Payrolls `PAYEMS` (Δ) · Claims `ICSA` (4wk) · Participation `CIVPART` · JOLTS `JTSJOL/JTSHIR/JTSQUR/JTSLDR` (as rates) · Real income `DSPIC96` · Real PCE `PCEC96` · Retail `RSAFS` · Autos `TOTALSA` · Starts `HOUST/HOUST1F` · Existing sales `EXHOSLUSM495S` · New sales `HSN1F` · Mortgage `MORTGAGE30US` · Case-Shiller `CSUSHPINSA` · U-Mich sentiment `UMCSENT` · Industrial production `INDPRO` · Core capex orders `NEWORDER` · Trade balance `BOPGSTB` · Dollar `DTWEXBGS` · Budget `MTSDS133FMS` · Customs `B235RC1Q027SBEA`-adj / Treasury MTS · GDP `A191RL1Q225SBEA` + component contribution series · Corporate profits `CP`/`CPATAX` · NFCI `NFCI` (+ `NFCIRISK/CREDIT/LEVERAGE`) · Treasury yields `DGS1MO…DGS30` · 2s10s `T10Y2Y` · Brent `DCOILBRENTEU` · Bank reserves `WRESBAL` · Delinquencies `DRSFRMACBS`,`DRCLACBS` · Foreign UST holdings (TIC).

### Needs an alternate source (~15 charts) — decision required
| Exhibit | Reality | Proposed handling |
|---|---|---|
| **Fed SEP table** (10) | Quarterly PDF, not an API | Curated JSON we update each SEP (4×/yr) — low effort |
| **ISM Services & Mfg PMIs** (34–41) | Proprietary (FRED's NAPM discontinued) | v1: manual/curated weekly input OR AI-extracted from ISM release; render from a `pmi.json` |
| **NFIB** (33) | Proprietary | Curated monthly JSON |
| **Conference Board confidence** (32) | Proprietary | Curated monthly JSON (U-Mich stays FRED) |
| **NAHB** (31) | Proprietary | Curated monthly JSON |
| **Gold / Baltic Dry** (15–16) | Not reliable on FRED | Gold via existing Yahoo/metals feed; Baltic Dry curated |
| **Equity PE/EPS/VIX/MOVE/HY-IG** (8–9) | Mix | Yahoo/Finnhub (have) + FRED `BAMLH0A0HYM2`,`VIXCLS`; MOVE curated |
| **U-Mich by party** (21) | Detail table | Overall from FRED; party splits curated |

**Design principle:** every exhibit declares `source: "fred" | "yahoo" | "curated"`. FRED/Yahoo render fully automatically; `curated` reads a small JSON the user updates (or AI fills). Nothing blocks the one-click generation — curated series just show their last known value with an "as of" stamp.

---

## 3. Architecture (pipeline)

```
[Generate Report] click
      │
      ▼
1. FETCH  /api/macro-report/data
     • batch-pull all FRED series in the manifest (Promise.all, cached 12h)
     • pull Yahoo/Finnhub market data (equity, gold, VIX, spreads)
     • load curated JSON (Fed SEP, ISM, NFIB, ConfBoard, NAHB, MOVE, party splits)
      │
      ▼
2. TRANSFORM  lib/macro/transforms.ts
     • y/y, m/m, 4-wk avg, spreads, contribution shares, rates from levels
     • compute "this week vs last" deltas + recession-band ranges
      │
      ▼
3. NARRATE  /api/macro-report/narrate (Claude)
     • per section: feed the numbers → generate the bullet analysis in URETF voice
     • model routing: Haiku for section bullets, Sonnet for the two Summary slides
     • one call per section, streamed; deterministic template fallback if no key
      │
      ▼
4. RENDER  app/macro-report/page.tsx
     • web report (scroll) + Presentation Mode (full-screen slides) + PDF export
```

**Caching:** FRED data 12h ISR; a generated report is saved to Supabase (`macro_reports` table, JSONB) so past weeks are archived and diffable ("what changed since last week", exactly like the deck's blue-highlight convention).

---

## 4. The chart system (`components/macro/`)

One configurable `<MacroChart>` reproducing the deck DNA, then refined:
- **Recession shading** (NBER bands via `ReferenceArea`)
- **Average reference line** with auto label ("Ave = X")
- **Multi-series + legend**, area/line/bar variants
- **Inset zoom** (recent 12 mo) as a small overlaid panel
- **Callout annotations** (the yellow boxes → refined as clean floating tags)
- Unit label, tabular axes, brand palette
Plus `<MacroTable>` (Fed SEP), `<StatBlock>` (equity/FI summary tiles), `<ContributionBar>` (GDP components), `<DonutShare>` (revenue mix / UST holders).

Driven by a **chart manifest** (`lib/macro/manifest.ts`): ~90 entries, each `{ id, section, title, unit, source, series, transform, chartType, avg?, recession?, inset?, callouts? }`. Adding/adjusting a chart = editing one manifest entry.

---

## 5. Design — "more beautiful"

Keep the institutional credibility, lose the clutter. Editorial magazine layout over PowerPoint:
- CrossAsset serif headers, generous whitespace, a refined crimson/navy accent (nods to UR without cloning), light theme (matches the app).
- Each section = a clean band: AI narrative on the left, a responsive chart grid on the right (or full-width grid for chart-heavy sections).
- Smooth scroll + sticky section nav; animated chart draw-in; hover tooltips; "updated this week" pulse badges.
- **Presentation Mode**: press `P` → full-screen 16:9 slides that page through with arrow keys (for actually presenting it).
- **One-click PDF** via `@react-pdf/renderer` (already a dependency) in a polished deck layout.

---

## 6. Build phases

- **Phase 1 — Engine core:** manifest + FRED batch fetcher + `<MacroChart>` + transforms. Ship 3 flagship sections fully auto (Monetary Policy, Inflation, Labor) end-to-end.
- **Phase 2 — Full coverage:** all 18 sections; curated-JSON fallback for non-FRED series; the two Summary modules.
- **Phase 3 — AI narrative:** per-section Claude commentary in URETF voice + the one-click "Generate" flow + week-over-week diffing.
- **Phase 4 — Presentation Mode + PDF export + Supabase archive.**

---

## 6b. Post-launch expansion (46 improvement loops, all deployed & inspected)

The engine shipped at ~90 exhibits replicating the deck, then went through two
rounds of improvement loops (23 rapid + 23 rigorous deploy→inspect→research→
plan→improve cycles). Final state:

- **~123 live exhibits** across 18 sections (from ~90). Added live-FRED depth:
  full CPI component breakdown, GDP components, wages (AHE, ECI), productivity &
  unit labor costs, leading labor (temp help, weekly hours, continuing claims),
  consumer spending composition, credit cycle (SLOOS, C&I loans, consumer
  credit), fiscal (interest, receipts/outlays, debt/GDP), money (M2, Fed balance
  sheet), rates depth (5y/30y, breakevens, 5y5y), commodities (WTI, nat gas),
  regional-Fed manufacturing (Empire, Philly), inventories-to-sales.
- **Signature features:** Recession Signal Scoreboard (8 live signals + composite
  risk), "Macro at a Glance" percentile heatmap (36 signals / 6 groups), Treasury
  yield-curve shape chart, Fed SEP table, cross-asset "Markets This Week" panel,
  AI "Ask the economy" Q&A, copyable AI "Weekly Brief", recession indicators
  (Sahm, NY Fed prob, 10y-3m, Chicago Fed activity, WEI, financial stress).
- **6 real bugs fixed via post-deploy inspection:** unit scaling (WRESBAL/ICSA),
  pp/bps change-labels ("+1000% y/y"), cross-deploy stale report cache,
  nav-scroll conflict, deep-link hash-clobber, and far-section scroll precision
  (self-correcting alignment).
- Cadence: every loop was a separate Vercel deploy, inspected live via the Chrome
  extension before the next loop's research & change.

## 7. Decisions — LOCKED
1. **Output format** — ✅ Both: beautiful web report + one-click PDF (deck style) + presentation mode.
2. **Non-FRED series** — ✅ Option 1: seed history once, refresh latest value monthly via curated JSON (Claude fills from the free monthly release). Affected cluster: ISM (Mfg+Services+components), NFIB, Conference Board, NAHB, Baltic Dry, MOVE, forward EPS consensus, Fed SEP table. All other ~75 charts pull live from FRED/Yahoo.
   - **Corrected from v1 draft (these ARE free, wired live):** Gold (Yahoo `GC=F`), VIX (`VIXCLS`), HY/IG spreads (`BAMLH0A0HYM2`), U-Mich overall (`UMCSENT`), foreign UST holdings (Treasury TIC).
3. **Scope of v1** — (pending)
4. **AI voice** — (pending)
