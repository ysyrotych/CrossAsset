# CrossAsset — Institutional Ownership Engine
### Full infrastructure design (v2, developed) — *design only, pending build approval*

**Route:** `/institutional` · **Nav:** "Institutional" (production section)
**Locked decisions:** Supabase-persisted · Curated-50 + on-demand any CIK · name "Institutional"

---

## 0. What we are building, in one sentence

A persistent, pre-computed institutional-ownership intelligence layer over free SEC data that treats **change** — not the static holdings snapshot — as the primary object, fuses **quarterly 13F flow** with **real-time Form 4 insider activity**, and surfaces **cross-manager consensus** — delivering in one screen what a Bloomberg terminal makes you assemble across `HDS`, `PORT`, `OWN`, and `INSI`.

---

## 1. Competitive thesis — why this can out-*use* a terminal

Bloomberg is authoritative but its 13F surface (`HDS`) is a **flat, static table**. It answers "who holds X?" It does not natively answer the questions an analyst actually asks:

- *What did this fund actually do this quarter, ranked by conviction?*
- *Which names are the smart-money crowd piling into simultaneously?*
- *Is quarterly institutional accumulation confirmed or contradicted by real-time insider buying?*
- *If I'd cloned this manager's new buys at filing date, would I have made money?*

Our moat is **not data** (it's all free from EDGAR) — it's the **compute + fusion + UX** layer:

1. **Delta-first data model.** Every holding is stored already classified `NEW / ADD / TRIM / EXIT / HOLD` with Δshares, Δvalue, Δ%-of-book precomputed. The UI never diffs at request time.
2. **Cross-manager consensus.** A materialized clustering layer answers "7 tracked funds initiated $2.1B of NVDA this quarter" instantly.
3. **13F × Form 4 fusion.** Slow (quarterly, 45-day-lagged) institutional signal overlaid with fast (T+2) insider signal on the same ticker.
4. **Zero data-licensing wall.** Everything is SEC-sourced, so this is fully ownable and reproducible.

---

## 2. The filings landscape & the hard truths (designed around, not ignored)

### 2.1 Forms in scope

| Form | What it is | Cadence / lag | Role in engine |
|---|---|---|---|
| **13F-HR** | Institutional manager holdings ($100M+ discretion, 13(f) securities) | Quarterly, **due 45 days** after quarter-end | Core dataset |
| **13F-HR/A** | Amendment / restatement | Ad hoc | Supersedes prior by period |
| **13F-NT** | Notice — holdings reported by *another* manager | Quarterly | Detect & skip (no infotable) |
| **Form 4** | Insider (§16 officer/director/10%+) transaction | **T+2 business days** | Loop 2 fusion overlay |
| **Form 3 / 5** | Initial / annual insider statements | Ad hoc / annual | Secondary insider context |
| **SC 13D / 13G** | >5% activist / passive stake | 13D: 5 business days; 13G: varies | Loop 3 activist signal (future) |

### 2.2 The 13F reality matrix — each is a first-class design concern

| Truth | Naive-build failure | Our handling |
|---|---|---|
| **45-day lag** | Presenting stale positions as "current" | Every response carries `period_of_report`, `filed_date`, `as_of_staleness_days`, and **`price_change_since_period_end`** per holding |
| **Longs only, US 13(f) securities only** | Calling the 13F book "the portfolio" | We label it **"13F long book (US equity + listed options only)"** everywhere; never net it against shorts/cash we don't have |
| **Value units changed** | Silent 1000× error | Pre-2023 filings report value in **$thousands**; post-2022 rule change reports **whole dollars**. Ingest **detects units per filing** and normalizes to dollars. Validation gate flags implausible magnitudes |
| **CUSIP, not ticker; multiple CUSIPs per issuer** | Fragmented / unjoinable holdings | Dedicated `securities` resolution table + a multi-source fallback resolver (§3.2). Share classes collapsed to a canonical issuer |
| **13F-HR/A amendments** | Double-counting or stale book | Supersession by `(cik, period)`; latest amendment wins; prior kept `is_superseded=true` |
| **Confidential treatment** | Silent holes, revealed months later | Detect coverage gaps; backfill when the confidential position is later released |
| **put/call rows** | Counting a put as long stock | `put_call` preserved; options **never** merged into share counts; surfaced as a separate exposure line |
| **NT filings & sub-advisers** | Phantom empty books / double count | 13F-NT detected and skipped; `otherManager` captured to attribute shared discretion |
| **SEC fair-access limit (10 req/s)** | IP throttling / bans | Ingestion throttled, identity-stamped, resumable, backoff on 429 |

---

## 3. Source strategy

### 3.1 Primary — SEC EDGAR via `edgartools` (already installed, v5.40.1)

Ingestion runs **inside the existing `sec-service`** (Python/FastAPI on Railway). No new Python deps.

```python
from edgar import Company, set_identity          # identity already set in main.py
mgr   = Company(cik)                              # a manager is an EDGAR entity
flist = mgr.get_filings(form="13F-HR")            # all 13F-HR for this filer
f     = flist.latest()                            # or filter by period
tf    = f.obj()                                   # -> ThirteenF object
tf.infotable        # pandas DataFrame: issuer, title, cusip, value,
                    #   shares (sshPrnamt), sshPrnamtType, put_call,
                    #   investment_discretion, other_manager, voting_authority
tf.total_value      # book value; tf.total_holdings; f.filing_date; f.period_of_report
```

Form 4 (Loop 2): `f.obj()` on a Form 4 filing yields the ownership object with non-derivative & derivative transaction tables (codes, shares, price, acquired/disposed).

### 3.2 The CUSIP → ticker resolution problem (the genuinely hard part)

13F gives CUSIP + issuer name, **never a ticker**. Resolution is a **cached fallback chain**, run once per CUSIP, result stored forever in `securities`:

```
resolve(cusip, issuer_name):
  1. securities cache hit?                    -> return (99% after warmup)
  2. FMP  GET /api/v3/cusip/{cusip}           -> symbol
  3. OpenFIGI POST /v3/mapping (ID_CUSIP)     -> ticker (free, 25k/day w/ key)
  4. SEC company_tickers.json fuzzy match on issuer_name (normalized)
  5. unresolved -> ticker=NULL, resolution_status='UNRESOLVED', retry next run
```

- OpenFIGI is Bloomberg's *open* symbology — the best free CUSIP resolver. Add `OPENFIGI_API_KEY` (optional; works keyless at lower rate).
- Resolution rate is a monitored data-quality metric (target >97% of book *value* resolved, since unresolved tends to be tiny/illiquid names).

### 3.3 Prices — reuse existing `yfinance`/FMP for `price_change_since_period_end` and clone-alpha.

---

## 4. Architecture (5 layers)

```
PAGE      /institutional  — 4 views: Manager · Security · Consensus · Superinvestors
  │ fetch (ISR-cached, tag-revalidated on ingest)
API       app/api/institutional/*  — thin readers over Supabase, zero heavy compute
  │ REST
STORAGE   Supabase Postgres — source of truth, everything pre-computed
  │ writes
COMPUTE   sec-service /institutional/*  — edgartools parse → normalize → delta → score
  │ quarterly cron + on-demand
SOURCES   EDGAR (13F-HR/A/NT, Form 4) · FMP + OpenFIGI (CUSIP) · yfinance (prices)
```

**Design law:** the request path *never* parses a filing or diffs a book. All heavy work happens at **ingest**; the API is pure indexed reads. This is what makes it feel faster than a terminal.

---

## 5. Data model — full DDL (`supabase/migrations/002_institutional.sql`)

```sql
-- ── enums ────────────────────────────────────────────────────────────
CREATE TYPE holding_action   AS ENUM ('NEW','ADD','TRIM','EXIT','HOLD');
CREATE TYPE filing_kind       AS ENUM ('HR','HR/A','NT');
CREATE TYPE resolution_status AS ENUM ('RESOLVED','UNRESOLVED','AMBIGUOUS');
CREATE TYPE put_call_t        AS ENUM ('NONE','PUT','CALL');

-- ── managers (curated + on-demand) ───────────────────────────────────
CREATE TABLE managers (
  cik               TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  type              TEXT,                    -- 'hedge_fund','value','quant','family_office','activist'
  is_superinvestor  BOOLEAN DEFAULT false,
  is_curated        BOOLEAN DEFAULT false,   -- part of the seeded ~50
  aum_13f           NUMERIC,                 -- latest book value (dollars)
  last_filed_period DATE,                    -- most recent period we hold
  first_seen        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ── securities (CUSIP resolution cache) ──────────────────────────────
CREATE TABLE securities (
  cusip             TEXT PRIMARY KEY,
  ticker            TEXT,
  issuer_name       TEXT,
  canonical_issuer  TEXT,                    -- share classes collapse here
  sector            TEXT,
  figi              TEXT,
  resolution        resolution_status DEFAULT 'UNRESOLVED',
  resolved_via      TEXT,                    -- 'fmp','openfigi','sec_fuzzy','manual'
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX securities_ticker_idx ON securities (ticker);

-- ── filings (one row per accepted 13F filing) ────────────────────────
CREATE TABLE filings (
  accession         TEXT PRIMARY KEY,
  cik               TEXT NOT NULL REFERENCES managers(cik),
  kind              filing_kind NOT NULL,
  period            DATE NOT NULL,           -- period_of_report (quarter-end)
  filed_date        DATE NOT NULL,
  total_value       NUMERIC,                 -- normalized to dollars
  holdings_count    INT,
  value_unit_raw    TEXT,                    -- 'thousands' | 'dollars' (audit trail)
  is_superseded     BOOLEAN DEFAULT false,   -- true when an /A replaces it
  ingested_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (cik, period, kind, accession)
);
CREATE INDEX filings_cik_period_idx ON filings (cik, period DESC);

-- ── holdings (one row per position per filing) ───────────────────────
CREATE TABLE holdings (
  id                BIGSERIAL PRIMARY KEY,
  accession         TEXT NOT NULL REFERENCES filings(accession) ON DELETE CASCADE,
  cik               TEXT NOT NULL,
  period            DATE NOT NULL,
  cusip             TEXT NOT NULL,
  ticker            TEXT,                    -- denormalized from securities at ingest
  issuer_name       TEXT,
  shares            NUMERIC,                 -- sshPrnamt (SH only; PRN tracked sep.)
  value             NUMERIC,                 -- dollars, normalized
  put_call          put_call_t DEFAULT 'NONE',
  pct_of_book       NUMERIC,                 -- value / filing.total_value * 100
  rank              INT,                     -- 1 = largest position
  discretion        TEXT,                    -- SOLE / DFND / OTR
  UNIQUE (accession, cusip, put_call)
);
CREATE INDEX holdings_cik_period_idx ON holdings (cik, period DESC);
CREATE INDEX holdings_ticker_period_idx ON holdings (ticker, period DESC);

-- ── holdings_delta (THE product — precomputed QoQ change) ────────────
CREATE TABLE holdings_delta (
  id                BIGSERIAL PRIMARY KEY,
  cik               TEXT NOT NULL,
  period            DATE NOT NULL,           -- the "now" quarter
  prev_period       DATE,
  cusip             TEXT NOT NULL,
  ticker            TEXT,
  issuer_name       TEXT,
  action            holding_action NOT NULL,
  shares_prev       NUMERIC,
  shares_now        NUMERIC,
  d_shares          NUMERIC,
  d_shares_pct      NUMERIC,                 -- (now-prev)/prev
  value_now         NUMERIC,
  d_value           NUMERIC,
  pct_book_prev     NUMERIC,
  pct_book_now      NUMERIC,
  d_pct_book        NUMERIC,                 -- conviction shift in pp
  is_new_top10      BOOLEAN DEFAULT false,
  conviction_score  NUMERIC,                 -- 0-100 (see §8.1)
  UNIQUE (cik, period, cusip)
);
CREATE INDEX hd_cik_period_idx ON holdings_delta (cik, period DESC);
CREATE INDEX hd_ticker_period_idx ON holdings_delta (ticker, period DESC);
CREATE INDEX hd_action_idx ON holdings_delta (action);

-- ── insider_txns (Loop 2 — Form 4) ───────────────────────────────────
CREATE TABLE insider_txns (
  id                BIGSERIAL PRIMARY KEY,
  ticker            TEXT NOT NULL,
  cik_issuer        TEXT,
  insider_name      TEXT,
  role              TEXT,                    -- CEO / CFO / Director / 10% owner
  txn_date          DATE,
  filed_date        DATE,
  code              TEXT,                    -- P,S,A,M,F,G,...
  is_open_market    BOOLEAN,                 -- true for P/S (the signal)
  shares            NUMERIC,
  price             NUMERIC,
  value             NUMERIC,
  post_txn_shares   NUMERIC,
  accession         TEXT,
  UNIQUE (accession, insider_name, txn_date, code, shares)
);
CREATE INDEX insider_ticker_date_idx ON insider_txns (ticker, txn_date DESC);

-- ── ingest_runs (observability) ──────────────────────────────────────
CREATE TABLE ingest_runs (
  id                BIGSERIAL PRIMARY KEY,
  started_at        TIMESTAMPTZ DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  scope             TEXT,                    -- 'curated_sweep' | 'on_demand:{cik}' | 'form4:{ticker}'
  period            DATE,
  managers_ok       INT DEFAULT 0,
  managers_failed   INT DEFAULT 0,
  holdings_written  INT DEFAULT 0,
  cusips_unresolved INT DEFAULT 0,
  status            TEXT,                    -- running | ok | partial | error
  error             TEXT
);

-- ── clusters (Loop 1 — consensus, materialized view) ─────────────────
CREATE MATERIALIZED VIEW clusters AS
SELECT
  period, ticker,
  MAX(issuer_name)                                   AS issuer_name,
  COUNT(*) FILTER (WHERE action IN ('NEW','ADD'))    AS buyers,
  COUNT(*) FILTER (WHERE action IN ('TRIM','EXIT'))  AS sellers,
  COUNT(*) FILTER (WHERE action='NEW')               AS new_positions,
  COUNT(*) FILTER (WHERE action='EXIT')              AS full_exits,
  SUM(d_value)                                        AS net_value_flow,
  SUM(value_now) FILTER (WHERE action='NEW')          AS new_money,
  -- conviction-weighted consensus (see §8.2)
  SUM(CASE WHEN action IN ('NEW','ADD')  THEN conviction_score
           WHEN action IN ('TRIM','EXIT') THEN -conviction_score
           ELSE 0 END)                                AS consensus_score
FROM holdings_delta
GROUP BY period, ticker;
CREATE INDEX clusters_period_score_idx ON clusters (period, consensus_score DESC);
```

**Scale sizing:** curated-50 × 4 quarters × ~150 holdings ≈ **30k holding rows** at launch; on-demand growth is linear and tiny. Even 500 managers × 8 quarters ≈ 600k rows — trivial for Postgres. (Full-universe ~8k filers = millions of rows/quarter — the reason we chose curated + on-demand instead.)

---

## 6. Ingestion pipeline (the heart)

### 6.1 `POST /institutional/ingest` (sec-service) — algorithm

```
ingest(cik, period=None, force=False):
  run = ingest_runs.start(scope, period)
  entity = Company(cik); upsert managers(cik, name, ...)
  filings = entity.get_filings(form=["13F-HR","13F-HR/A"])
  target  = pick(filings, period or latest)      # honor amendment > HR for same period
  if target.kind == 'NT': skip (record notice)
  if filings.already_ingested(target.accession) and not force: return no-op  # idempotent

  tf = target.obj()
  unit = detect_value_unit(tf, target.filed_date)   # thousands vs dollars
  rows = []
  for h in tf.infotable:
      cusip  = h.cusip
      sec    = resolve_security(cusip, h.issuer)     # §3.2 fallback chain, cached
      value  = normalize(h.value, unit)
      rows.append(holding(accession, cik, period, cusip, sec.ticker,
                          shares=h.shares if h.type=='SH' else None,
                          value, put_call=h.put_call, discretion, ...))
  compute rank + pct_of_book over rows
  upsert filings(...); bulk upsert holdings(rows)   # ON CONFLICT do update (idempotent)
  if amendment: mark prior HR for (cik,period) is_superseded=true
  compute_deltas(cik, period)                        # §7
  run.finish(ok)
```

**Properties:** idempotent (keyed on accession + unique constraints), resumable (per-manager runs, run log tracks progress), rate-limited (edgartools respects 10 req/s; batch sleeps + exponential backoff on 429), and **incremental** (skips already-ingested accessions unless `force`).

### 6.2 Curated sweep — `POST /institutional/sweep?period=`

Iterates the curated-50, calling `ingest` per CIK, tolerant of individual failures (records `managers_failed`), refreshes `clusters` materialized view at the end.

---

## 7. The Delta Engine — `compute_deltas(cik, period)`

```
prev = latest filing for cik with period < target.period      # skip amendment noise
now_map  = { cusip -> holding }  for target period
prev_map = { cusip -> holding }  for prev period
for cusip in (now ∪ prev):
    a, b = now_map.get(cusip), prev_map.get(cusip)
    if a and not b:        action = NEW
    elif b and not a:      action = EXIT
    elif a.shares  > b.shares: action = ADD
    elif a.shares  < b.shares: action = TRIM
    else:                  action = HOLD
    d_shares   = (a.shares or 0) - (b.shares or 0)
    d_value    = (a.value or 0)  - (b.value or 0)
    d_pct_book = (a.pct_book or 0) - (b.pct_book or 0)
    is_new_top10 = action==NEW and a.rank<=10
    conviction = score(a, action, d_pct_book)          # §8.1
    upsert holdings_delta(...)
```

Edge cases handled: first-ever filing (all NEW), missing prior (staleness flag), PRN vs SH positions (compared within type), put/call rows diffed independently from common stock.

---

## 8. Analytics layer — the math

### 8.1 Conviction score (per holding, 0–100)

```
conviction = clamp(0,100,
    40 * sizeFactor          # min(pct_of_book / 10, 1)      -> a 10%+ position maxes this
  + 25 * rankFactor          # (max(0, 11-rank)/10)          -> top-10 boost
  + 20 * directionFactor     # NEW=1, ADD=0.6, HOLD=0.3, TRIM=-0.4, EXIT=-1 (scaled to 0..1 for buys)
  + 15 * magnitudeFactor )   # min(|d_pct_book| / 3, 1)      -> big conviction shift
```

Interpretation: a **new top-10 position at 12% of book** scores ~90+ ("high-conviction initiation"); a 0.1% nibble scores single digits.

### 8.2 Consensus score (per ticker per quarter)

Conviction-weighted net of tracked managers — a fund making a name a *core* position counts far more than a token buy:

```
consensus(ticker, period) =
    Σ_over_buyers(conviction) − Σ_over_sellers(conviction)
```

Ranked descending → "most-conviction-bought"; ascending → "most-conviction-dumped." Also expose raw `buyers/sellers` counts and `new_money` (Σ dollar value of NEW positions) for the "N funds initiated $X" headline.

### 8.3 Crowding score (Loop 3)

`crowding = normalize( tracked_holders_count × aggregate_pct_of_float_held )` — high crowding + high short interest (via FMP) = unwind-risk flag.

### 8.4 Clone-alpha backtest (Loop 3)

For each manager's `NEW` buys: simulate entry at **filing_date price** (realistic — you can't act before the filing) *and* at **quarter-end price** (theoretical ceiling). Forward return to next quarter / to today, benchmarked to SPY. Aggregate **hit rate** and **avg excess return**. The filing-date vs quarter-end gap is itself an insight (how much alpha the 45-day lag costs).

---

## 9. API contract (Next.js `app/api/institutional/*`)

All reads; all served from Supabase; all ISR-cached, tag-revalidated on ingest.

```ts
// GET /api/institutional/managers?q=&curatedOnly=
type ManagerListItem = { cik; name; slug; type; aum_13f; last_filed_period; is_superinvestor };

// GET /api/institutional/manager/[slug]?period=
type ManagerView = {
  manager: ManagerListItem;
  period: string; filed_date: string; staleness_days: number;
  total_value: number; holdings_count: number; top10_weight: number; turnover_pct: number;
  holdings: Array<{ ticker; issuer; shares; value; pct_of_book; rank;
                    action; d_shares; d_value; d_pct_book; conviction_score;
                    put_call; price_change_since_period_end }>;
  new_high_conviction: Array<…>;      // NEW && conviction>=70
};

// GET /api/institutional/security/[ticker]?period=
type SecurityView = {
  ticker; issuer; period; staleness_days;
  aggregate_inst_value: number; holder_count: number;
  net_share_flow: number; net_manager_flow: number;   // buyers - sellers
  accumulators: Array<{ manager; slug; action; d_shares; d_value; conviction_score }>;
  distributors: Array<…>;
  insider_overlay: Array<InsiderTxn>;                  // Loop 2
};

// GET /api/institutional/consensus?period=&dir=buy|sell&limit=
type ConsensusRow = { ticker; issuer; buyers; sellers; new_positions; full_exits;
                      new_money; net_value_flow; consensus_score };

// GET /api/institutional/superinvestors?period=
type SuperinvestorDigest = { period; biggest_new_buys: ConsensusRow[];
                             biggest_exits: ConsensusRow[]; by_manager: ManagerListItem[] };

// GET /api/institutional/insiders/[ticker]        (Loop 2)
// POST /api/institutional/ingest  { cik | ticker }  — ADMIN (x-ingest-secret header)
```

---

## 10. Caching & revalidation

- **Supabase = source of truth**, already fully computed.
- **Next.js route handlers**: `export const revalidate = 3600` + **tag-based revalidation** — the ingest endpoint calls `revalidateTag('institutional')` on success, so data goes live the instant a quarter is ingested, otherwise serves cached.
- 13F changes only quarterly → cache can be aggressive; staleness is measured in *quarters*, not seconds.

---

## 11. Refresh orchestration

**SEC 13F deadlines** (next business day if weekend): **Feb 14, May 15, Aug 14, Nov 14**.

- **Post-deadline sweep** (primary): cron fires the day after each deadline → `/institutional/sweep` over curated-50 for the new period. Most superinvestors (Berkshire, Baupost) file at the wire.
- **Early-filer daily poll** during the 45-day window: light daily check for any curated manager whose new-period filing already posted → ingest immediately (freshness edge over sites that only refresh post-deadline).
- **On-demand**: any user pulling a non-curated CIK triggers an ingest, then it's cached forever.
- Runner: **Vercel Cron** hitting an admin route, or Railway scheduled job hitting sec-service directly (decide at build — Vercel Cron is simplest given the stack).

---

## 12. The four views (analytical spec)

1. **Manager** — pick a fund → 13F long book ranked by `pct_of_book`, each row badged `NEW/ADD/TRIM/EXIT` with Δ; header shows top-10 weight, turnover, book value, staleness; a **"new high-conviction initiations"** strip (`NEW && conviction≥70`).
2. **Security** — pick a ticker → aggregate institutional value & holder count, **accumulators vs distributors** this quarter, net share/manager flow, and the **Form 4 insider overlay** beneath (Loop 2).
3. **Consensus** — the clustering screen: most-conviction-bought and most-dumped names across tracked funds; "N funds initiated $X" headlines; filter buy/sell.
4. **Superinvestors** — curated digest: the quarter's biggest smart-money new buys & exits, plus a per-manager index. Dataroma-but-with-deltas.

---

## 13. Curated universe & CIK resolution

We seed a config `managers.seed.ts` of ~50 legendary filers. **CIKs are resolved/verified at build time** against SEC's `company_tickers.json` / EDGAR company search (never hardcoded blindly — a wrong CIK = wrong fund). Confident anchor: **Berkshire Hathaway = CIK 0001067983**. Starter roster (names reliable; CIKs verified at ingest):

Berkshire Hathaway (Buffett) · Scion (Burry) · Pershing Square (Ackman) · Baupost (Klarman) · Appaloosa (Tepper) · Greenlight (Einhorn) · Oaktree (Marks) · Duquesne (Druckenmiller) · Bridgewater · Renaissance · Third Point (Loeb) · Icahn · Fairholme (Berkowitz) · Himalaya (Li Lu) · Pabrai Funds · Tiger Global · Coatue · Lone Pine · Viking · Hound · Akre · Gardner Russo · Polen · Ruane/Sequoia · Tweedy Browne · Southeastern/Longleaf · ValueAct · Trian (Peltz) · Elliott · Corvex · … (final list at approval).

---

## 14. Observability & data quality gates

- `ingest_runs` row per run: managers ok/failed, holdings written, CUSIPs unresolved, duration, error.
- **Validation gates** (fail-loud): total_value within sane band; holdings_count matches infotable length; value-unit sanity (median position not off by ~1000×); CUSIP **value-weighted** resolution ≥ 97%.
- **Staleness monitor**: managers with no filing for the current period after deadline flagged in the Superinvestor view ("hasn't filed yet").
- A `/institutional/health` endpoint summarizing last sweep, coverage, unresolved CUSIPs.

---

## 15. Security & access control

- **Read** endpoints: public.
- **Write** endpoints (`/ingest`, `/sweep`): require `x-ingest-secret: $INGEST_SECRET` (new env). Prevents arbitrary users spamming SEC through us / writing to our DB.
- SEC identity already set; OpenFIGI/FMP keys server-side only.

---

## 16. Failure-mode matrix

| Failure | Detection | Behavior |
|---|---|---|
| EDGAR 429 / throttle | HTTP status | exponential backoff, resume; run marked `partial` |
| Manager filed 13F-NT only | `kind=NT` | skip, record notice, no phantom empty book |
| CUSIP unresolved | resolver returns null | store ticker=NULL, still count value; retry next sweep |
| Amendment lands after HR | period collision | `/A` supersedes, prior `is_superseded=true`, deltas recomputed |
| Value-unit mis-detect | validation gate | reject filing, log, alert; no 1000× corruption |
| Supabase unreachable | write error | run `error`; API falls back to last-good cache (never 500s the page) |
| Confidential-treatment gap | coverage check | flag gap; backfill on later release |

---

## 17. File-by-file change manifest

**sec-service (Python):**
- `institutional.py` (new) — `ingest`, `sweep`, `compute_deltas`, `resolve_security`, `detect_value_unit`, Form 4 parse (Loop 2)
- `main.py` — mount routes: `POST /institutional/ingest`, `POST /institutional/sweep`, `GET /institutional/health`
- `managers_seed.py` (new) — curated roster

**Next.js:**
- `supabase/migrations/002_institutional.sql` (new) — schema above
- `lib/institutional/db.ts` (new) — Supabase REST readers (mirrors `lib/pipeline/supabase.ts` pattern)
- `lib/institutional/types.ts` (new) — shared types
- `app/api/institutional/managers/route.ts`, `manager/[slug]/route.ts`, `security/[ticker]/route.ts`, `consensus/route.ts`, `superinvestors/route.ts`, `insiders/[ticker]/route.ts`, `ingest/route.ts` (proxy → sec-service, admin-guarded)
- `app/institutional/page.tsx` (+ view components under `components/institutional/`)
- `components/layout/Sidebar.tsx` — add `{ label: "Institutional", href: "/institutional" }` in the production block
- `vercel.json` — cron entries for sweep + early-filer poll

**Env additions:** `INGEST_SECRET`, `OPENFIGI_API_KEY` (optional), (reuse `FMP_API_KEY`, `SEC_SERVICE_URL`, Supabase vars).

---

## 18. Testing strategy

- **Golden-filing fixtures**: snapshot Berkshire's known Q (deterministic infotable) → assert parse + delta + conviction outputs.
- **Value-unit test**: a pre-2023 (thousands) and post-2022 (dollars) filing normalize to the same magnitude.
- **Idempotency test**: re-ingesting same accession = zero net change.
- **Amendment test**: HR then HR/A → book reflects amendment, prior superseded, deltas recomputed.
- **Resolver test**: known CUSIPs (AAPL 037833100) resolve correctly; garbage → UNRESOLVED not crash.
- **API contract tests** on each route's response shape.

---

## 19. The three improvement loops (with acceptance criteria)

### Foundation (v1) — "a faster-than-terminal 13F browser"
Migration · sec-service ingest + delta engine + CUSIP resolver · curated-50 seed + on-demand · `managers`/`manager/[slug]`/`security/[ticker]` APIs · Manager & Security views · sidebar entry.
**Done when:** you can open any curated fund and see its book ranked by conviction with NEW/ADD/TRIM/EXIT deltas, and open any ticker to see its institutional holders — all sub-second from cache.

### Loop 1 — "consensus & conviction intelligence"
`clusters` materialized view · Consensus view · conviction scoring surfaced everywhere · `price_change_since_period_end` staleness stamping · early-filer poll + post-deadline sweep cron · health endpoint.
**Done when:** the Consensus screen ranks "most-conviction-bought / most-dumped" across the curated set and every holding shows how stale + how much price has moved since quarter-end.

### Loop 2 — "13F × Form 4 fusion + Superinvestors"
Form 4 ingest (`insider_txns`) · insider overlay in Security view (open-market P/S isolated from comp noise) · Superinvestor digest view.
**Done when:** a ticker's page shows quarterly institutional accumulation *and* real-time insider buying side-by-side, and the Superinvestor view narrates the quarter's biggest smart-money moves.

### Loop 3 — "alpha, crowding & narrative"
Clone-alpha backtest (filing-date vs quarter-end) · crowding score (+ short-interest join) · optional Claude "smart-money brief" reusing the existing streaming-brief infra · optional 13D/G activist feed.
**Done when:** you can see whether cloning a fund's new buys generated alpha, which names are dangerously crowded, and get an AI-written digest of the quarter.

---

## 20. Open items to confirm at approval
1. Final curated roster (I'll propose the verified-CIK list of ~50).
2. Cron runner: **Vercel Cron** (recommended, matches stack) vs Railway scheduled job.
3. OpenFIGI key: add now (higher CUSIP throughput) or start keyless.
4. How many historical quarters to backfill at launch (recommend **4** — one year, enough for deltas + a first alpha read).
