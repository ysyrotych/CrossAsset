// ── Strategy Lab — Regime-Rotation Backtest Engine ───────────────────────────
// Implements a real regime-rotation strategy using factor ETF proxies.
// No survivorship bias, no look-ahead bias on factor construction:
// Factor ETFs are real tradeable instruments with published price history.
//
// Strategy logic:
//   Each month, hold the ETF portfolio prescribed by the previous month's regime.
//   Regime source: FRED composite (production) or demo sequence (no key).
//
// Factor ETF universe:
//   MTUM  iShares MSCI USA Momentum Factor ETF
//   USMV  iShares MSCI USA Min Vol Factor ETF
//   VLUE  iShares MSCI USA Value Factor ETF
//   QUAL  iShares MSCI USA Quality Factor ETF
//   IJR   iShares Core S&P Small-Cap ETF (Size proxy)
//   SPY   S&P 500 benchmark

import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_GROWTH_INDICATORS, DEFAULT_RISK_INDICATORS,
  mean, stdDev, zscore, winsorize,
  computeComposite, classifyRegimeHard,
} from "@/lib/strategy-lab/regime";
import type { IndicatorReading, RegimeLabel } from "@/lib/strategy-lab/types";

export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

// ── Regime → factor ETF weights (based on FTSE Russell published baseline) ──
// Scale: overweight factor gets 60%, neutral gets 20%, underweight gets 0%.
const REGIME_WEIGHTS: Record<RegimeLabel, Record<string, number>> = {
  Recovery:    { MTUM: 0.00, USMV: 0.00, VLUE: 0.50, QUAL: 0.00, IJR: 0.50 },
  Expansion:   { MTUM: 0.60, USMV: 0.00, VLUE: 0.20, QUAL: 0.00, IJR: 0.20 },
  Slowdown:    { MTUM: 0.00, USMV: 0.50, VLUE: 0.00, QUAL: 0.50, IJR: 0.00 },
  Contraction: { MTUM: 0.33, USMV: 0.34, VLUE: 0.00, QUAL: 0.33, IJR: 0.00 },
};

const ETF_TICKERS = ["SPY", "MTUM", "USMV", "VLUE", "QUAL", "IJR"] as const;

// ── Date helper ───────────────────────────────────────────────────────────────
function subtractMonths(dateStr: string, n: number): string {
  const [y, m] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Fetch monthly OHLCV bars from Yahoo Finance v8 (no auth required) ────────
async function fetchMonthlyBars(
  ticker: string,
  months = 38,
): Promise<{ date: string; close: number }[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - months * 31 * 86400;
  for (const host of ["query1", "query2"]) {
    try {
      const url =
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
        `?interval=1mo&period1=${from}&period2=${now}&events=splits,dividends`;
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        next: { revalidate: 3600 },
      });
      if (!r.ok) continue;
      const result = (await r.json())?.chart?.result?.[0];
      if (!result) continue;
      const ts: number[] = result.timestamp ?? [];
      const adj: (number | null)[] =
        result.indicators?.adjclose?.[0]?.adjclose ??
        result.indicators?.quote?.[0]?.close ?? [];
      const bars = ts
        .map((t, i) => ({
          date: new Date(t * 1000).toISOString().slice(0, 7),
          close: adj[i] ?? 0,
        }))
        .filter(b => b.close > 0);
      if (bars.length > 0) return bars;
    } catch {
      continue;
    }
  }
  return [];
}

// ── Compute month-over-month returns from sorted price bars ──────────────────
function toMonthlyReturns(bars: { date: string; close: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 1; i < bars.length; i++) {
    m.set(bars[i].date, (bars[i].close - bars[i - 1].close) / bars[i - 1].close);
  }
  return m;
}

// ── FRED helpers ─────────────────────────────────────────────────────────────
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const KEY = process.env.FRED_API_KEY;

async function fredMonthly(id: string, limit = 60): Promise<{ date: string; value: number }[]> {
  if (!KEY) return [];
  try {
    const url =
      `${FRED_BASE}?series_id=${id}&api_key=${KEY}&file_type=json` +
      `&sort_order=desc&limit=${limit}&frequency=m&aggregation_method=avg`;
    const r = await fetch(url, { next: { revalidate: 3600 } });
    if (!r.ok) return [];
    const obs: { date: string; value: string }[] =
      ((await r.json()).observations ?? []).filter(
        (o: { value: string }) => o.value !== "." && o.value !== ""
      );
    return obs
      .map(o => ({ date: o.date.slice(0, 7), value: parseFloat(o.value) }))
      .filter(o => !isNaN(o.value))
      .reverse();
  } catch {
    return [];
  }
}

// ALFRED vintage fetch — returns the INITIAL RELEASE value for each observation
// period, eliminating look-ahead bias from data revisions.
// ALFRED API: realtime_start=obs_date gives the first published value.
// Falls back to current-vintage fredMonthly on any error.
type VintageObs = { realtime_start: string; date: string; value: string };
async function fredMonthlyInitialRelease(
  id: string, limit = 80
): Promise<{ date: string; value: number }[]> {
  if (!KEY) return [];
  try {
    const startYear = new Date().getFullYear() - Math.ceil(limit / 12) - 1;
    const url =
      `${FRED_BASE}?series_id=${id}&api_key=${KEY}&file_type=json` +
      `&realtime_start=${startYear}-01-01&realtime_end=9999-01-01` +
      `&frequency=m&aggregation_method=avg&sort_order=asc`;
    const r = await fetch(url, { next: { revalidate: 86400 } });
    if (!r.ok) return fredMonthly(id, limit);
    const raw: VintageObs[] = ((await r.json()).observations ?? []).filter(
      (o: VintageObs) => o.value !== "." && o.value !== ""
    );
    // For each observation date, keep the EARLIEST realtime_start (initial release)
    const byDate = new Map<string, number>();
    for (const o of raw) {
      const month = o.date.slice(0, 7);
      if (!byDate.has(month)) {
        const v = parseFloat(o.value);
        if (!isNaN(v)) byDate.set(month, v);
      }
    }
    return Array.from(byDate.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-limit);
  } catch {
    return fredMonthly(id, limit);
  }
}

// Series known to be significantly revised — use ALFRED initial-release data
const REVISED_SERIES = new Set(["INDPRO", "PAYEMS", "PERMIT", "UNRATE"]);

async function fredMonthlyPIT(id: string, limit = 80): Promise<{ date: string; value: number }[]> {
  return REVISED_SERIES.has(id)
    ? fredMonthlyInitialRelease(id, limit)
    : fredMonthly(id, limit);
}

// ── Demo regime sequence (24 months ending today) ────────────────────────────
function demoRegimeSequence(): { date: string; regime: RegimeLabel }[] {
  const baseRegimes: RegimeLabel[] = [
    "Expansion","Expansion","Expansion","Slowdown","Slowdown","Slowdown",
    "Slowdown","Contraction","Contraction","Contraction","Contraction","Slowdown",
    "Slowdown","Slowdown","Slowdown","Slowdown","Contraction","Contraction",
    "Recovery","Recovery","Expansion","Expansion","Contraction","Contraction",
  ];
  const now = new Date();
  return baseRegimes.map((regime, i) => {
    const offset = 23 - i;
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      regime,
    };
  });
}

// ── Compute annualised stats from a monthly return series ────────────────────
function computeStats(
  stratReturns: number[],
  benchReturns: number[],
  rfMonthly = 0.04 / 12,
) {
  const n = stratReturns.length;
  if (n < 3) return null;

  const annFactor = 12 / n;
  const totalStrat = stratReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;
  const totalBench = benchReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;
  const annStrat   = Math.pow(1 + totalStrat, annFactor) - 1;
  const annBench   = Math.pow(1 + totalBench, annFactor) - 1;

  const avgR  = stratReturns.reduce((a, r) => a + r, 0) / n;
  const varR  = stratReturns.reduce((a, r) => a + (r - avgR) ** 2, 0) / (n - 1);
  const vol   = Math.sqrt(varR * 12);
  const sharpe = vol > 0 ? (annStrat - 0.04) / vol : 0;

  // Sortino: downside deviation using only negative excess returns
  const downsideVars = stratReturns.map(r => Math.pow(Math.min(r - rfMonthly, 0), 2));
  const downsideDev  = Math.sqrt(downsideVars.reduce((s, v) => s + v, 0) / n * 12);
  const sortino      = downsideDev > 0 ? (annStrat - 0.04) / downsideDev : 0;

  // Max drawdown
  let peak = 1, maxDD = 0, nav = 1;
  for (const r of stratReturns) {
    nav *= (1 + r);
    if (nav > peak) peak = nav;
    const dd = (nav - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  // Calmar ratio
  const calmar = maxDD !== 0 ? annStrat / Math.abs(maxDD) : 0;

  // Information ratio
  const excess   = stratReturns.map((r, i) => r - (benchReturns[i] ?? 0));
  const avgEx    = excess.reduce((a, r) => a + r, 0) / n;
  const trackErr = Math.sqrt(excess.reduce((a, r) => a + (r - avgEx) ** 2, 0) / (n - 1) * 12);
  const ir       = trackErr > 0 ? (annStrat - annBench) / trackErr : 0;

  // T-stat for IR (IR × √(N/12)) — tests if alpha is significantly non-zero
  const irTStat = ir * Math.sqrt(n / 12);

  // Up/down capture ratios
  const upMonths   = benchReturns.map((b, i) => b > 0 ? [stratReturns[i], b] as [number, number] : null).filter(Boolean) as [number, number][];
  const downMonths = benchReturns.map((b, i) => b < 0 ? [stratReturns[i], b] as [number, number] : null).filter(Boolean) as [number, number][];
  const upCapture   = upMonths.length   ? (upMonths.reduce((s, [sr]) => s + sr, 0)   / upMonths.length)   / (upMonths.reduce((s, [, br]) => s + br, 0)   / upMonths.length)   : 1;
  const downCapture = downMonths.length ? (downMonths.reduce((s, [sr]) => s + sr, 0) / downMonths.length) / (downMonths.reduce((s, [, br]) => s + br, 0) / downMonths.length) : 1;

  // % of months strategy beat benchmark
  const pctPositive = stratReturns.filter(r => r > 0).length / n;

  return {
    annStrat:     Math.round(annStrat    * 1000) / 1000,
    annBench:     Math.round(annBench    * 1000) / 1000,
    vol:          Math.round(vol         * 1000) / 1000,
    sharpe:       Math.round(sharpe      * 100)  / 100,
    sortino:      Math.round(sortino     * 100)  / 100,
    calmar:       Math.round(calmar      * 100)  / 100,
    maxDD:        Math.round(maxDD       * 1000) / 1000,
    ir:           Math.round(ir          * 100)  / 100,
    irTStat:      Math.round(irTStat     * 100)  / 100,
    upCapture:    Math.round(upCapture   * 100)  / 100,
    downCapture:  Math.round(downCapture * 100)  / 100,
    pctPositive:  Math.round(pctPositive * 100)  / 100,
    nMonths:      n,
    regimeChanges: 0, // computed separately
  };
}

// Map factor names to their ETF proxy
const FACTOR_ETF: Record<string, string> = {
  Momentum: "MTUM", LowVolatility: "USMV", Value: "VLUE", Quality: "QUAL", Size: "IJR",
};

// Derive ETF weights from user's 0/1/2 allocation per regime
function allocationToWeights(
  allocation: Record<string, Record<string, number>>,
): Record<RegimeLabel, Record<string, number>> {
  const derived: Record<string, Record<string, number>> = {};
  for (const regime of ["Recovery", "Expansion", "Slowdown", "Contraction"] as RegimeLabel[]) {
    const row: Record<string, number> = {};
    const alloc = allocation[regime] ?? {};
    for (const [factor, etf] of Object.entries(FACTOR_ETF)) {
      const v = alloc[factor] ?? 1;
      row[etf] = v === 0 ? 0 : v === 1 ? 10 : 30;
    }
    const total = Object.values(row).reduce((s, v) => s + v, 0);
    for (const etf of Object.keys(row)) {
      row[etf] = total > 0 ? row[etf] / total : 0.2;
    }
    derived[regime] = row;
  }
  return derived as Record<RegimeLabel, Record<string, number>>;
}

// Walk-forward: compute stats for a slice of monthlyData
function periodStats(months: { stratReturn: number; benchReturn: number }[]) {
  if (months.length < 3) return null;
  const strat = months.map(m => m.stratReturn);
  const bench = months.map(m => m.benchReturn);
  const n = strat.length;
  const annFactor = 12 / n;
  const totalStrat = strat.reduce((a, r) => a * (1 + r), 1) - 1;
  const totalBench = bench.reduce((a, r) => a * (1 + r), 1) - 1;
  const annReturn = Math.pow(1 + totalStrat, annFactor) - 1;
  const annBench  = Math.pow(1 + totalBench, annFactor) - 1;
  const avgR = strat.reduce((a, r) => a + r, 0) / n;
  const varR = strat.reduce((a, r) => a + (r - avgR) ** 2, 0) / (n - 1);
  const vol = Math.sqrt(varR * 12);
  const sharpe = vol > 0 ? (annReturn - 0.04) / vol : 0;
  let peak = 1, maxDD = 0, nav = 1;
  for (const r of strat) {
    nav *= (1 + r);
    if (nav > peak) peak = nav;
    const dd = (nav - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  const excess = strat.map((r, i) => r - (bench[i] ?? 0));
  const avgEx = excess.reduce((a, r) => a + r, 0) / n;
  const trackErr = Math.sqrt(excess.reduce((a, r) => a + (r - avgEx) ** 2, 0) / (n - 1) * 12);
  const ir = trackErr > 0 ? (annReturn - annBench) / trackErr : 0;
  return {
    annReturn: Math.round(annReturn * 1000) / 1000,
    annBench:  Math.round(annBench  * 1000) / 1000,
    vol:       Math.round(vol       * 1000) / 1000,
    sharpe:    Math.round(sharpe    * 100)  / 100,
    maxDD:     Math.round(maxDD     * 1000) / 1000,
    ir:        Math.round(ir        * 100)  / 100,
    nMonths:   n,
  };
}

export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }

async function handler(req: NextRequest) {
  // Accept optional custom allocation from POST body
  let customAllocation: Record<string, Record<string, number>> | null = null;
  try {
    const body = await req.json().catch(() => null);
    customAllocation = body?.allocation ?? null;
  } catch { /* GET has no body */ }

  // 1 — Fetch monthly ETF prices (parallel)
  const barSets = await Promise.all(
    ETF_TICKERS.map(t => fetchMonthlyBars(t, 72).then(bars => [t, bars] as const))
  );
  const prices = Object.fromEntries(barSets) as Record<string, { date: string; close: number }[]>;

  // Convert to return maps
  const returns: Record<string, Map<string, number>> = {};
  for (const t of ETF_TICKERS) {
    returns[t] = toMonthlyReturns(prices[t]);
  }

  // 2 — Get regime history
  let regimeSequence: { date: string; regime: RegimeLabel }[];
  let isDemo = true;

  if (KEY) {
    isDemo = false;
    const allIds = [...new Set([
      ...DEFAULT_GROWTH_INDICATORS.map(i => i.fredSeries),
      ...DEFAULT_RISK_INDICATORS.map(i => i.fredSeries),
    ])];
    const fetched = await Promise.all(
      allIds.map(id => fredMonthlyPIT(id, 80).then(data => [id, data] as const))
    );
    const seriesMap = Object.fromEntries(fetched);

    const refSeries = seriesMap[DEFAULT_GROWTH_INDICATORS[0].fredSeries] ?? [];
    const allMonthLabels = refSeries.map(p => p.date);

    // Compute composite for each month with publication lags + expanding-window z-score.
    // This eliminates the two look-ahead biases: future normalization data and
    // data that was not yet published at the time of the signal.
    const compositeHistory: { date: string; composite: number }[] = [];
    for (let t = 0; t < allMonthLabels.length; t++) {
      const date = allMonthLabels[t];
      const readings: IndicatorReading[] = DEFAULT_GROWTH_INDICATORS.map(ind => {
        const series = seriesMap[ind.fredSeries] ?? [];
        // Publication lag: data for month D is available only at D + lagMonths
        const availThrough = subtractMonths(date, ind.lagMonths);
        // Expanding window: only use observations available at signal time
        const avail = series.filter(p => p.date <= availThrough);
        if (avail.length < 3) {
          return { id: ind.id, name: ind.name, latestValue: null, latestDate: date, previousValue: null, change: null, zscore: null, contribution: null, direction: ind.direction, weight: ind.weight, enabled: ind.enabled, stdDev: null, mean: null };
        }
        let transformed: number[];
        if (ind.transform === "mom3" && avail.length >= 4)
          transformed = avail.slice(3).map((p, i) => p.value - avail[i].value);
        else if (ind.transform === "yoy" && avail.length >= 13)
          transformed = avail.slice(12).map((p, i) => p.value - avail[i].value);
        else
          transformed = avail.map(p => p.value);
        if (!transformed.length) {
          return { id: ind.id, name: ind.name, latestValue: null, latestDate: date, previousValue: null, change: null, zscore: null, contribution: null, direction: ind.direction, weight: ind.weight, enabled: ind.enabled, stdDev: null, mean: null };
        }
        const w   = winsorize(transformed, 0.02);
        const mu  = mean(w);
        const sig = stdDev(w, mu);
        const z   = zscore(transformed[transformed.length - 1], mu, sig);
        return { id: ind.id, name: ind.name, latestValue: avail[avail.length - 1].value, latestDate: date, previousValue: null, change: null, zscore: z, contribution: null, direction: ind.direction, weight: ind.weight, enabled: ind.enabled, stdDev: sig, mean: mu };
      });
      const composite = computeComposite(readings);
      if (composite != null) compositeHistory.push({ date, composite });
    }

    // Build regime sequence with proper direction from 3-month momentum on composite.
    // Critical fix: direction was previously hardcoded "decelerating", which caused
    // Expansion and Recovery to never appear in the backtest.
    regimeSequence = compositeHistory.map(({ date, composite }, i, arr) => {
      const lvl = composite >= 0 ? "above" as const : "below" as const;
      let dir: "accelerating" | "decelerating" = "decelerating";
      if (i >= 3) dir = composite > arr[i - 3].composite ? "accelerating" : "decelerating";
      return { date, regime: classifyRegimeHard(lvl, dir) };
    });
  } else {
    regimeSequence = demoRegimeSequence();
  }

  // Determine which weights to use
  const activeWeights = customAllocation
    ? allocationToWeights(customAllocation)
    : REGIME_WEIGHTS;

  // 3 — Build monthly backtest data
  // Strategy uses regime from prior month (implementation lag = 1 month)
  const monthlyData: {
    date: string;
    regime: RegimeLabel;
    stratReturn: number;
    benchReturn: number;
    stratNav: number;
    benchNav: number;
    weights: Record<string, number>;
  }[] = [];

  let stratNav = 100;
  let benchNav = 100;
  let prevRegime: RegimeLabel | null = null;
  let regimeChanges = 0;

  for (let i = 0; i < regimeSequence.length; i++) {
    const { date, regime } = regimeSequence[i];
    // Use prior month's regime for implementation (lag 1 month)
    const activeRegime: RegimeLabel = i === 0 ? regime : regimeSequence[i - 1].regime;
    const weights = activeWeights[activeRegime];

    // Compute weighted strategy return
    let stratR = 0;
    let wSum = 0;
    for (const [etf, w] of Object.entries(weights)) {
      const r = returns[etf]?.get(date);
      if (r != null && w > 0) { stratR += r * w; wSum += w; }
    }
    if (wSum < 0.99) {
      // If some ETF data missing, fall back to SPY for missing portion
      const spyR = returns["SPY"]?.get(date) ?? 0;
      stratR += spyR * (1 - wSum);
    }

    const benchR = returns["SPY"]?.get(date) ?? 0;

    // Skip months with no data at all
    if (returns["SPY"]?.get(date) == null) continue;

    if (prevRegime && prevRegime !== activeRegime) {
      regimeChanges++;
      stratR -= 0.001; // 10bps transaction cost on full portfolio rotation
    }
    prevRegime = activeRegime;

    stratNav = stratNav * (1 + stratR);
    benchNav = benchNav * (1 + benchR);

    monthlyData.push({
      date, regime: activeRegime,
      stratReturn: Math.round(stratR * 10000) / 10000,
      benchReturn: Math.round(benchR * 10000) / 10000,
      stratNav:   Math.round(stratNav * 100) / 100,
      benchNav:   Math.round(benchNav * 100) / 100,
      weights,
    });
  }

  // 4 — Compute stats
  const stratReturns = monthlyData.map(m => m.stratReturn);
  const benchReturns = monthlyData.map(m => m.benchReturn);
  const stats = computeStats(stratReturns, benchReturns);

  // 5 — Regime breakdown
  const regimeCounts: Record<string, number> = {};
  for (const m of monthlyData) {
    regimeCounts[m.regime] = (regimeCounts[m.regime] ?? 0) + 1;
  }

  // 6 — Per-regime performance
  const regimePerf: Record<string, { stratAvg: number; benchAvg: number; count: number }> = {};
  for (const m of monthlyData) {
    if (!regimePerf[m.regime]) regimePerf[m.regime] = { stratAvg: 0, benchAvg: 0, count: 0 };
    regimePerf[m.regime].stratAvg += m.stratReturn;
    regimePerf[m.regime].benchAvg += m.benchReturn;
    regimePerf[m.regime].count++;
  }
  for (const r of Object.values(regimePerf)) {
    r.stratAvg = Math.round(r.stratAvg / r.count * 10000) / 10000;
    r.benchAvg = Math.round(r.benchAvg / r.count * 10000) / 10000;
  }

  // 7 — Drawdown time series
  let ddPeak = monthlyData[0]?.stratNav ?? 100;
  const drawdownSeries = monthlyData.map(m => {
    if (m.stratNav > ddPeak) ddPeak = m.stratNav;
    const dd = (m.stratNav - ddPeak) / ddPeak;
    return { date: m.date, drawdown: Math.round(dd * 10000) / 10000 };
  });

  // 8 — Rolling 12-month returns
  const rolling12M = monthlyData.slice(12).map((m, i) => {
    const prev = monthlyData[i]; // 12 months ago
    const stratRoll = m.stratNav / prev.stratNav - 1;
    const benchRoll = m.benchNav / prev.benchNav - 1;
    return {
      date: m.date,
      stratRoll: Math.round(stratRoll * 1000) / 1000,
      benchRoll: Math.round(benchRoll * 1000) / 1000,
    };
  });

  // 9 — Regime duration analysis
  const regimeDurations: { regime: RegimeLabel; start: string; end: string; months: number }[] = [];
  let runStart = 0;
  for (let i = 1; i <= monthlyData.length; i++) {
    if (i === monthlyData.length || monthlyData[i].regime !== monthlyData[runStart].regime) {
      regimeDurations.push({
        regime: monthlyData[runStart].regime,
        start:  monthlyData[runStart].date,
        end:    monthlyData[i - 1].date,
        months: i - runStart,
      });
      runStart = i;
    }
  }

  // 10 — Regime transition matrix
  const REGIMES: RegimeLabel[] = ["Recovery", "Expansion", "Slowdown", "Contraction"];
  const transitionMatrix: Record<string, Record<string, number>> = {};
  for (const r of REGIMES) {
    transitionMatrix[r] = {};
    for (const r2 of REGIMES) transitionMatrix[r][r2] = 0;
  }
  for (let i = 1; i < monthlyData.length; i++) {
    const from = monthlyData[i - 1].regime;
    const to   = monthlyData[i].regime;
    transitionMatrix[from][to] = (transitionMatrix[from][to] ?? 0) + 1;
  }
  // Normalize rows to probabilities
  for (const row of Object.values(transitionMatrix)) {
    const total = Object.values(row).reduce((s, v) => s + v, 0);
    if (total > 0) for (const k of Object.keys(row)) row[k] = Math.round(row[k] / total * 100) / 100;
  }

  // Average duration by regime
  const avgDurationByRegime: Record<string, number> = {};
  const regimeRuns: Record<string, number[]> = {};
  for (const dur of regimeDurations) {
    if (!regimeRuns[dur.regime]) regimeRuns[dur.regime] = [];
    regimeRuns[dur.regime].push(dur.months);
  }
  for (const [regime, runs] of Object.entries(regimeRuns)) {
    avgDurationByRegime[regime] = Math.round(runs.reduce((s, v) => s + v, 0) / runs.length * 10) / 10;
  }

  // 11 — Walk-forward validation (split at midpoint)
  const mid = Math.floor(monthlyData.length / 2);
  const walkForward = {
    inSample:  periodStats(monthlyData.slice(0, mid)),
    outSample: periodStats(monthlyData.slice(mid)),
    splitDate: monthlyData[mid]?.date ?? null,
    startDate: monthlyData[0]?.date ?? null,
    endDate:   monthlyData[monthlyData.length - 1]?.date ?? null,
  };

  // 12 — Factor attribution (avg ETF weight × ETF total return vs SPY)
  const spyBars  = prices["SPY"] ?? [];
  const spyFirst = spyBars[0]?.close;
  const spyLast  = spyBars[spyBars.length - 1]?.close;
  const spyTotalRet = spyFirst && spyLast ? (spyLast / spyFirst - 1) : 0;
  const factorAttribution = Object.entries(FACTOR_ETF).map(([factor, etf]) => {
    const bars  = prices[etf] ?? [];
    const first = bars[0]?.close;
    const last  = bars[bars.length - 1]?.close;
    const etfTotalRet = first && last ? (last / first - 1) : null;
    const avgWeight = monthlyData.reduce((s, m) => s + (m.weights[etf] ?? 0), 0) / (monthlyData.length || 1);
    const contribution = etfTotalRet != null ? avgWeight * (etfTotalRet - spyTotalRet) : null;
    return {
      factor,
      etf,
      avgWeight:    Math.round(avgWeight * 1000) / 1000,
      etfTotalRet:  etfTotalRet != null ? Math.round(etfTotalRet * 1000) / 1000 : null,
      contribution: contribution != null ? Math.round(contribution * 10000) / 10000 : null,
    };
  });

  return NextResponse.json({
    isDemo,
    customAllocation: !!customAllocation,
    monthlyData,
    stats: stats ? { ...stats, regimeChanges } : null,
    regimeCounts,
    regimePerf,
    regimeWeights: activeWeights,
    drawdownSeries,
    rolling12M,
    regimeDurations: regimeDurations.slice(-20),
    transitionMatrix,
    avgDurationByRegime,
    walkForward,
    factorAttribution,
    etfLabels: {
      MTUM: "iShares Momentum (MTUM)",
      USMV: "iShares Min Vol (USMV)",
      VLUE: "iShares Value (VLUE)",
      QUAL: "iShares Quality (QUAL)",
      IJR:  "iShares Small-Cap (IJR)",
      SPY:  "S&P 500 (SPY)",
    },
    dataNote: isDemo
      ? "Regime sequence is illustrative. ETF price history is real (Yahoo Finance)."
      : "Regime sequence from FRED/ALFRED data: publication lags enforced + initial-release values used for revised series (INDPRO, PAYEMS, PERMIT, UNRATE). ETF prices: Yahoo Finance.",
  });
}
