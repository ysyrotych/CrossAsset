-- CrossAsset Institutional Ownership Engine — schema
-- Run once in the Supabase SQL editor. See docs/INSTITUTIONAL_ENGINE_DESIGN.md.

-- ── enums ────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE holding_action   AS ENUM ('NEW','ADD','TRIM','EXIT','HOLD'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE filing_kind      AS ENUM ('HR','HR/A','NT');                 EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE resolution_status AS ENUM ('RESOLVED','UNRESOLVED','AMBIGUOUS'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE put_call_t       AS ENUM ('NONE','PUT','CALL');              EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── managers ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS managers (
  cik               TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  manager           TEXT,
  type              TEXT,
  signature_holding TEXT,
  is_superinvestor  BOOLEAN DEFAULT false,
  is_curated        BOOLEAN DEFAULT false,
  aum_13f           NUMERIC,
  last_filed_period DATE,
  first_seen        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ── securities (CUSIP resolution cache) ──────────────────────────────
CREATE TABLE IF NOT EXISTS securities (
  cusip             TEXT PRIMARY KEY,
  ticker            TEXT,
  issuer_name       TEXT,
  canonical_issuer  TEXT,
  sector            TEXT,
  figi              TEXT,
  resolution        resolution_status DEFAULT 'UNRESOLVED',
  resolved_via      TEXT,
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS securities_ticker_idx ON securities (ticker);

-- ── filings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS filings (
  accession         TEXT PRIMARY KEY,
  cik               TEXT NOT NULL REFERENCES managers(cik),
  kind              filing_kind NOT NULL,
  period            DATE NOT NULL,
  filed_date        DATE NOT NULL,
  total_value       NUMERIC,
  holdings_count    INT,
  value_unit_raw    TEXT,
  is_superseded     BOOLEAN DEFAULT false,
  ingested_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS filings_cik_period_idx ON filings (cik, period DESC);

-- ── holdings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holdings (
  id                BIGSERIAL PRIMARY KEY,
  accession         TEXT NOT NULL REFERENCES filings(accession) ON DELETE CASCADE,
  cik               TEXT NOT NULL,
  period            DATE NOT NULL,
  cusip             TEXT NOT NULL,
  ticker            TEXT,
  issuer_name       TEXT,
  shares            NUMERIC,
  value             NUMERIC,
  put_call          put_call_t DEFAULT 'NONE',
  pct_of_book       NUMERIC,
  rank              INT,
  discretion        TEXT,
  UNIQUE (accession, cusip, put_call)
);
CREATE INDEX IF NOT EXISTS holdings_cik_period_idx    ON holdings (cik, period DESC);
CREATE INDEX IF NOT EXISTS holdings_ticker_period_idx ON holdings (ticker, period DESC);

-- ── holdings_delta (precomputed QoQ change — the product) ────────────
CREATE TABLE IF NOT EXISTS holdings_delta (
  id                BIGSERIAL PRIMARY KEY,
  cik               TEXT NOT NULL,
  period            DATE NOT NULL,
  prev_period       DATE,
  cusip             TEXT NOT NULL,
  ticker            TEXT,
  issuer_name       TEXT,
  action            holding_action NOT NULL,
  shares_prev       NUMERIC,
  shares_now        NUMERIC,
  d_shares          NUMERIC,
  d_shares_pct      NUMERIC,
  value_now         NUMERIC,
  d_value           NUMERIC,
  pct_book_prev     NUMERIC,
  pct_book_now      NUMERIC,
  d_pct_book        NUMERIC,
  is_new_top10      BOOLEAN DEFAULT false,
  conviction_score  NUMERIC,
  UNIQUE (cik, period, cusip)
);
CREATE INDEX IF NOT EXISTS hd_cik_period_idx    ON holdings_delta (cik, period DESC);
CREATE INDEX IF NOT EXISTS hd_ticker_period_idx ON holdings_delta (ticker, period DESC);
CREATE INDEX IF NOT EXISTS hd_action_idx        ON holdings_delta (action);

-- ── insider_txns (Form 4) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insider_txns (
  id                BIGSERIAL PRIMARY KEY,
  ticker            TEXT NOT NULL,
  cik_issuer        TEXT,
  insider_name      TEXT,
  role              TEXT,
  txn_date          DATE,
  filed_date        DATE,
  code              TEXT,
  is_open_market    BOOLEAN,
  shares            NUMERIC,
  price             NUMERIC,
  value             NUMERIC,
  post_txn_shares   NUMERIC,
  accession         TEXT,
  UNIQUE (accession, insider_name, txn_date, code, shares)
);
CREATE INDEX IF NOT EXISTS insider_ticker_date_idx ON insider_txns (ticker, txn_date DESC);

-- ── ingest_runs (observability) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingest_runs (
  id                BIGSERIAL PRIMARY KEY,
  started_at        TIMESTAMPTZ DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  scope             TEXT,
  period            DATE,
  managers_ok       INT DEFAULT 0,
  managers_failed   INT DEFAULT 0,
  holdings_written  INT DEFAULT 0,
  cusips_unresolved INT DEFAULT 0,
  status            TEXT,
  error             TEXT
);

-- ── clusters (consensus) — refreshed after each sweep ────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS clusters AS
SELECT
  period, ticker,
  MAX(issuer_name)                                   AS issuer_name,
  COUNT(*) FILTER (WHERE action IN ('NEW','ADD'))    AS buyers,
  COUNT(*) FILTER (WHERE action IN ('TRIM','EXIT'))  AS sellers,
  COUNT(*) FILTER (WHERE action='NEW')               AS new_positions,
  COUNT(*) FILTER (WHERE action='EXIT')              AS full_exits,
  SUM(d_value)                                        AS net_value_flow,
  SUM(value_now) FILTER (WHERE action='NEW')          AS new_money,
  SUM(CASE WHEN action IN ('NEW','ADD')  THEN conviction_score
           WHEN action IN ('TRIM','EXIT') THEN -conviction_score
           ELSE 0 END)                                AS consensus_score
FROM holdings_delta
WHERE ticker IS NOT NULL
GROUP BY period, ticker;
CREATE INDEX IF NOT EXISTS clusters_period_score_idx ON clusters (period, consensus_score DESC);
