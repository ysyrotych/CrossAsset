-- CrossAsset newspaper pipeline: issues table
-- Run this in your Supabase SQL editor once

CREATE TABLE IF NOT EXISTS issues (
  id                    TEXT PRIMARY KEY,
  created_at            TIMESTAMPTZ DEFAULT now(),
  stage                 TEXT NOT NULL DEFAULT 'DATA_AUDIT',
  status                TEXT NOT NULL DEFAULT 'in_progress',
  cutoff_date           DATE,

  -- Stage artifacts
  data_audit            JSONB,
  thesis_candidates     JSONB,
  approved_thesis       JSONB,
  research_plan         JSONB,
  quant_results         JSONB,
  quant_analysis        JSONB,
  claim_ledger          JSONB,
  drafts                JSONB,
  chart_specs           JSONB,
  approved_illustration JSONB,
  issue_manifest        JSONB,
  approval_log          JSONB DEFAULT '[]'::jsonb
);

-- Index for listing issues by date
CREATE INDEX IF NOT EXISTS issues_created_at_idx ON issues (created_at DESC);
