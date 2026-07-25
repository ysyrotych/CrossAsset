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

import { NextResponse } from "next/server";
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

// ── FRED helper (reused from regime-data route) ──────────────────────────────
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const KEY = process.env.FRED_API_KEY;

async function fredMonthly(id: string, limit = 38): Promise<{ date: string; value: number }[]> {
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

function buildReading(
  indicator: (typeof DEFAULT_GROWTH_INDICATORS)[0],
  series: { date: string; value: number }[],
): IndicatorReading {
  if (series.length < 2) {
    return {
      id: indicator.id, name: indicator.name,
      latestValue: null, latestDate: "—", previousValue: null, change: null,
      zscore: null, contribution: null,
      direction: indicator.direction, weight: indicator.weight, enabled: indicator.enabled,
      stdDev: null, mean: null,
    };
  }
  let values: number[];
  if (indicator.transform === "mom3" && series.length >= 4)
    values = series.slice(3).map((p, i) => p.value - series[i].value);
  else if (indicator.transform === "yoy" && series.length >= 13)
    values = series.slice(12).map((p, i) => p.value - series[i].value);
  else
    values = series.map(p => p.value);

  const w = winsorize(values, 0.02);
  const mu = mean(w);
  const sig = stdDev(w, mu);
  const latest = values[values.length - 1];
  const z = zscore(latest, mu, sig);
  return {
    id: indicator.id, name: indicator.name,
    latestValue: Math.round(series[series.length - 1].value * 100) / 100,
    latestDate: series[series.length - 1].date,
    previousValue: series[series.length - 2].value,
    change: Math.round((series[series.length - 1].value - series[series.length - 2].value) * 1000) / 1000,
    zscore: Math.round(z * 100) / 100,
    contribution: Math.round(z * indicator.direction * indicator.weight * 100) / 100,
    direction: indicator.direction, weight: indicator.weight, enabled: indicator.enabled,
    stdDev: Math.round(sig * 1000) / 1000, mean: Math.round(mu * 1000) / 1000,
  };
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

  // Max drawdown
  let peak = 1, maxDD = 0, nav = 1;
  for (const r of stratReturns) {
    nav *= (1 + r);
    if (nav > peak) peak = nav;
    const dd = (nav - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  // Information ratio
  const excess   = stratReturns.map((r, i) => r - (benchReturns[i] ?? 0));
  const avgEx    = excess.reduce((a, r) => a + r, 0) / n;
  const trackErr = Math.sqrt(excess.reduce((a, r) => a + (r - avgEx) ** 2, 0) / (n - 1) * 12);
  const ir       = trackErr > 0 ? (annStrat - annBench) / trackErr : 0;

  // Turnover (regime changes = full portfolio switch)
  const regimeChanges = 0; // computed separately

  return {
    annStrat:   Math.round(annStrat * 1000) / 1000,
    annBench:   Math.round(annBench * 1000) / 1000,
    vol:        Math.round(vol * 1000) / 1000,
    sharpe:     Math.round(sharpe * 100) / 100,
    maxDD:      Math.round(maxDD * 1000) / 1000,
    ir:         Math.round(ir * 100) / 100,
    nMonths:    n,
    regimeChanges,
  };
}

export async function GET() {
  // 1 — Fetch monthly ETF prices (parallel)
  const barSets = await Promise.all(
    ETF_TICKERS.map(t => fetchMonthlyBars(t, 38).then(bars => [t, bars] as const))
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
      allIds.map(id => fredMonthly(id, 38).then(data => [id, data] as const))
    );
    const seriesMap = Object.fromEntries(fetched);

    const monthLabels = seriesMap[DEFAULT_GROWTH_INDICATORS[0].fredSeries]?.map(p => p.date) ?? [];
    regimeSequence = monthLabels.slice(-24).map(date => {
      const readings: IndicatorReading[] = DEFAULT_GROWTH_INDICATORS.map(ind => {
        const series = seriesMap[ind.fredSeries] ?? [];
        const point  = series.find(p => p.date === date);
        const allVals = series.map(p => p.value);
        const mu  = mean(allVals);
        const sig = stdDev(allVals, mu);
        const val = point?.value ?? null;
        const z   = val != null ? zscore(val, mu, sig) : null;
        return { id: ind.id, name: ind.name, latestValue: val, latestDate: date, previousValue: null,
          change: null, zscore: z, contribution: null, direction: ind.direction,
          weight: ind.weight, enabled: ind.enabled, stdDev: sig, mean: mu };
      });
      const g   = computeComposite(readings) ?? 0;
      const lvl = g >= 0 ? "above" as const : "below" as const;
      // Simplified direction for history — use 0 as decelerating default
      return { date, regime: classifyRegimeHard(lvl, "decelerating") };
    });
  } else {
    regimeSequence = demoRegimeSequence();
  }

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
    const weights = REGIME_WEIGHTS[activeRegime];

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

    stratNav = stratNav * (1 + stratR);
    benchNav = benchNav * (1 + benchR);

    if (prevRegime && prevRegime !== activeRegime) regimeChanges++;
    prevRegime = activeRegime;

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

  return NextResponse.json({
    isDemo,
    monthlyData,
    stats: stats ? { ...stats, regimeChanges } : null,
    regimeCounts,
    regimePerf,
    regimeWeights: REGIME_WEIGHTS,
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
      : "Regime sequence from live FRED data. ETF price history from Yahoo Finance.",
  });
}
