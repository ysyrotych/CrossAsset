// Deterministic calculations — no LLM involved.
// Fetches FRED series, computes z-scores, 2-week deltas, rolling stats.

import type { SeriesMeta, SeriesDiagnostic } from "./types";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const KEY = () => process.env.FRED_API_KEY ?? "";

// ─── Core series catalog ──────────────────────────────────────────────────────

export const CORE_SERIES: { id: string; label: string; asset_class: string }[] = [
  { id: "DGS2",           label: "2Y Treasury Yield",        asset_class: "rates" },
  { id: "DGS5",           label: "5Y Treasury Yield",        asset_class: "rates" },
  { id: "DGS10",          label: "10Y Treasury Yield",       asset_class: "rates" },
  { id: "DGS30",          label: "30Y Treasury Yield",       asset_class: "rates" },
  { id: "T10Y2Y",         label: "2s10s Spread",             asset_class: "rates" },
  { id: "DFF",            label: "Fed Funds Rate (daily)",    asset_class: "rates" },
  { id: "DFII10",         label: "10Y Real Yield (TIPS)",    asset_class: "rates" },
  { id: "T10YIE",         label: "10Y Breakeven Inflation",  asset_class: "inflation" },
  { id: "CPIAUCSL",       label: "CPI All Items",            asset_class: "inflation" },
  { id: "CPILFESL",       label: "Core CPI",                 asset_class: "inflation" },
  { id: "PCEPI",          label: "PCE Price Index",          asset_class: "inflation" },
  { id: "PCEPILFE",       label: "Core PCE",                 asset_class: "inflation" },
  { id: "SP500",          label: "S&P 500",                  asset_class: "equities" },
  { id: "VIXCLS",         label: "VIX",                      asset_class: "equities" },
  { id: "NASDAQCOM",      label: "Nasdaq Composite",         asset_class: "equities" },
  { id: "GDPC1",          label: "Real GDP (quarterly)",      asset_class: "growth" },
  { id: "UNRATE",         label: "Unemployment Rate",        asset_class: "labor" },
  { id: "PAYEMS",         label: "Nonfarm Payrolls",         asset_class: "labor" },
  { id: "BAMLH0A0HYM2",   label: "HY OAS (bps)",            asset_class: "credit" },
  { id: "BAMLC0A0CM",     label: "IG OAS (bps)",             asset_class: "credit" },
  { id: "GOLDAMGBD228NLBM", label: "Gold (London AM Fix)",  asset_class: "commodities" },
  { id: "DCOILWTICO",     label: "WTI Crude Oil",            asset_class: "commodities" },
  { id: "DTWEXBGS",       label: "USD Trade-Weighted Index", asset_class: "fx" },
];

// ─── FRED fetch helpers ───────────────────────────────────────────────────────

type FredObs = { date: string; value: string };

async function fredObs(id: string, limit = 260): Promise<FredObs[]> {
  const key = KEY();
  if (!key) return [];
  const url = `${FRED_BASE}?series_id=${id}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 500));
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 429) continue; // rate limited — retry
      if (!res.ok) return [];
      const json = await res.json();
      return (json.observations ?? []) as FredObs[];
    } catch {
      // network error — retry
    }
  }
  return [];
}

function validObs(obs: FredObs[]): { date: string; value: number }[] {
  return obs
    .filter((o) => o.value !== ".")
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }));
}

// ─── Z-score (using 252-day window for daily, 24-period for monthly) ──────────

function computeZScore(values: number[]): number | null {
  if (values.length < 10) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (values[0] - mean) / std;
}

// ─── Single series diagnostic ─────────────────────────────────────────────────

async function diagnoseSeries(
  id: string,
  label: string,
  asset_class: string
): Promise<{ meta: SeriesMeta; diagnostic: SeriesDiagnostic | null }> {
  const obs = await fredObs(id, 300);
  const valid = validObs(obs);

  const today = new Date().toISOString().split("T")[0];

  if (valid.length === 0) {
    return {
      meta: { series_id: id, label, last_date: "N/A", last_value: null, days_stale: 999, status: "missing" },
      diagnostic: null,
    };
  }

  const latest = valid[0];
  const lastDate = new Date(latest.date);
  const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
  // Classify staleness by release frequency:
  // Daily series: fresh ≤5d, stale ≤14d (weekends/holidays), missing >14d
  // Monthly: fresh ≤35d (just released), stale ≤65d, missing >65d
  // Quarterly: stale up to 120d
  const MONTHLY = ["CPIAUCSL","CPILFESL","PCEPI","PCEPILFE","UNRATE","PAYEMS"];
  const QUARTERLY = ["GDPC1"];
  // PCE reference dates are start-of-month so always appear 60–90d old at release
  // GDPC1 reference dates are start-of-quarter so always appear 90–180d old
  const freshLimit  = QUARTERLY.includes(id) ? 60  : MONTHLY.includes(id) ? 40  : 5;
  const staleLimit  = QUARTERLY.includes(id) ? 200 : MONTHLY.includes(id) ? 95  : 14;
  const status: SeriesMeta["status"] = daysSince <= freshLimit ? "fresh" : daysSince <= staleLimit ? "stale" : "missing";

  // Find value ~14 calendar days ago
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];
  const val2wAgo = valid.find((v) => v.date <= twoWeeksAgo) ?? null;

  const values = valid.slice(0, 252).map((v) => v.value);
  const zScore = computeZScore(values);
  const change2w = val2wAgo ? latest.value - val2wAgo.value : null;
  const pctChange2w = val2wAgo && val2wAgo.value !== 0 ? ((latest.value - val2wAgo.value) / Math.abs(val2wAgo.value)) * 100 : null;

  const meta: SeriesMeta = {
    series_id: id,
    label,
    last_date: latest.date,
    last_value: latest.value,
    days_stale: daysSince,
    status,
  };

  const diagnostic: SeriesDiagnostic = {
    series_id: id,
    label,
    asset_class,
    current_value: latest.value,
    value_2w_ago: val2wAgo?.value ?? null,
    change_2w: change2w,
    pct_change_2w: pctChange2w,
    z_score: zScore,
    direction: change2w === null ? "flat" : change2w > 0 ? "up" : change2w < 0 ? "down" : "flat",
    is_anomaly: zScore !== null && Math.abs(zScore) > 1.5,
  };

  return { meta, diagnostic };
}

// ─── Full audit (batched to avoid FRED rate limiting) ────────────────────────

async function batchedDiagnose(
  series: typeof CORE_SERIES,
  batchSize = 4
): Promise<{ meta: SeriesMeta; diagnostic: SeriesDiagnostic | null }[]> {
  const results: { meta: SeriesMeta; diagnostic: SeriesDiagnostic | null }[] = [];
  for (let i = 0; i < series.length; i += batchSize) {
    const batch = series.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((s) => diagnoseSeries(s.id, s.label, s.asset_class))
    );
    results.push(...batchResults);
    if (i + batchSize < series.length) {
      await new Promise((r) => setTimeout(r, 300)); // 300ms between batches
    }
  }
  return results;
}

export async function runDataAudit(): Promise<{
  metas: SeriesMeta[];
  diagnostics: SeriesDiagnostic[];
}> {
  const results = await batchedDiagnose(CORE_SERIES);

  return {
    metas: results.map((r) => r.meta),
    diagnostics: results.filter((r) => r.diagnostic !== null).map((r) => r.diagnostic!),
  };
}

// ─── Analysis job executor ────────────────────────────────────────────────────

export interface JobResult {
  job_id: string;
  series_used: string[];
  method: string;
  summary: string;
  key_stat: string;
  time_range: [string, string];
  sample_size: number;
  error?: string;
}

async function runRollingCorrelation(
  id1: string,
  id2: string,
  window: number
): Promise<{ correlation: number; sample_size: number; dates: [string, string] }> {
  const [obs1, obs2] = await Promise.all([fredObs(id1, window + 60), fredObs(id2, window + 60)]);
  const v1 = validObs(obs1);
  const v2 = validObs(obs2);

  // Align by date
  const map1 = new Map(v1.map((d) => [d.date, d.value]));
  const aligned: { v1: number; v2: number }[] = [];
  for (const d of v2) {
    const val1 = map1.get(d.date);
    if (val1 !== undefined) aligned.push({ v1: val1, v2: d.value });
    if (aligned.length >= window) break;
  }

  if (aligned.length < 10) return { correlation: 0, sample_size: aligned.length, dates: ["N/A", "N/A"] };

  const n = aligned.length;
  const mean1 = aligned.reduce((a, b) => a + b.v1, 0) / n;
  const mean2 = aligned.reduce((a, b) => a + b.v2, 0) / n;
  const cov = aligned.reduce((a, b) => a + (b.v1 - mean1) * (b.v2 - mean2), 0) / n;
  const std1 = Math.sqrt(aligned.reduce((a, b) => a + (b.v1 - mean1) ** 2, 0) / n);
  const std2 = Math.sqrt(aligned.reduce((a, b) => a + (b.v2 - mean2) ** 2, 0) / n);
  const corr = std1 === 0 || std2 === 0 ? 0 : cov / (std1 * std2);

  const dates = [v2[v2.length - 1]?.date ?? "N/A", v2[0]?.date ?? "N/A"] as [string, string];
  return { correlation: parseFloat(corr.toFixed(3)), sample_size: n, dates };
}

async function runYoYChange(id: string, periods: number): Promise<{ current_yoy: number | null; prev_yoy: number | null; sample_size: number }> {
  const obs = await fredObs(id, periods + 15);
  const valid = validObs(obs);
  if (valid.length < periods + 1) return { current_yoy: null, prev_yoy: null, sample_size: valid.length };

  // For monthly: period = 12, for quarterly: 4
  const current_yoy = valid[0] && valid[periods] ? ((valid[0].value - valid[periods].value) / Math.abs(valid[periods].value)) * 100 : null;
  const prev_yoy = valid[1] && valid[periods + 1] ? ((valid[1].value - valid[periods + 1].value) / Math.abs(valid[periods + 1].value)) * 100 : null;

  return { current_yoy, prev_yoy, sample_size: valid.length };
}

export async function executeAnalysisJob(
  jobId: string,
  series: string[],
  method: string,
  transformation: string,
  dateRange: [string, string]
): Promise<JobResult> {
  try {
    if (method === "rolling_correlation" && series.length >= 2) {
      const result = await runRollingCorrelation(series[0], series[1], 252);
      return {
        job_id: jobId,
        series_used: series,
        method,
        summary: `Correlation between ${series[0]} and ${series[1]}: ${result.correlation}`,
        key_stat: `r = ${result.correlation} (n=${result.sample_size})`,
        time_range: result.dates,
        sample_size: result.sample_size,
      };
    }

    if (method === "yoy_change" && series.length >= 1) {
      const periods = transformation.includes("quarterly") ? 4 : 12;
      const result = await runYoYChange(series[0], periods);
      return {
        job_id: jobId,
        series_used: series,
        method,
        summary: `YoY change for ${series[0]}: ${result.current_yoy?.toFixed(2) ?? "N/A"}%`,
        key_stat: `Current YoY: ${result.current_yoy?.toFixed(2) ?? "N/A"}%, Prior: ${result.prev_yoy?.toFixed(2) ?? "N/A"}%`,
        time_range: dateRange,
        sample_size: result.sample_size,
      };
    }

    // Default: z-score / level summary
    const obs = await fredObs(series[0], 300);
    const valid = validObs(obs);
    if (valid.length === 0) throw new Error("No data");

    const values = valid.map((v) => v.value);
    const current = values[0];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    const z = std === 0 ? 0 : (current - mean) / std;

    return {
      job_id: jobId,
      series_used: series,
      method,
      summary: `${series[0]}: current=${current.toFixed(2)}, mean=${mean.toFixed(2)}, z=${z.toFixed(2)}`,
      key_stat: `z-score: ${z.toFixed(2)} (${valid.length} observations)`,
      time_range: [valid[valid.length - 1].date, valid[0].date],
      sample_size: valid.length,
    };
  } catch (e) {
    return {
      job_id: jobId,
      series_used: series,
      method,
      summary: "Analysis failed",
      key_stat: "N/A",
      time_range: dateRange,
      sample_size: 0,
      error: String(e),
    };
  }
}
