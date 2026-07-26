// ── Strategy Lab — Regime Data API ───────────────────────────────────────────
// Fetches monthly FRED data for the growth composite and risk-appetite composite.
// Returns current indicator readings, z-scores, regime classification, and
// a 24-month composite history for the signal chart.
//
// DATA QUALITY NOTICE: Z-scores and composite history use in-sample normalization
// over the fetched window (not a proper expanding window from a long history).
// Label all outputs as "Exploratory — not point-in-time valid."

import { NextResponse } from "next/server";
import {
  DEFAULT_GROWTH_INDICATORS, DEFAULT_RISK_INDICATORS,
  mean, stdDev, zscore, winsorize,
  computeComposite, classifyRegimeHard, computeRegimeProbabilities,
  computeConfidence, computeFactorTargets, buildExplanation,
} from "@/lib/strategy-lab/regime";
import type { RegimeData, IndicatorReading, CompositePoint, RegimeLabel } from "@/lib/strategy-lab/types";

export const dynamic = "force-dynamic";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const KEY = process.env.FRED_API_KEY;

// Fetch N monthly-frequency observations (FRED aggregates daily/weekly → monthly)
async function fredMonthly(
  id: string,
  limit = 36,
): Promise<{ date: string; value: number }[]> {
  if (!KEY) return [];
  try {
    // Use FRED frequency aggregation: monthly average for daily/weekly series
    const url =
      `${FRED_BASE}?series_id=${id}&api_key=${KEY}&file_type=json` +
      `&sort_order=desc&limit=${limit}` +
      `&frequency=m&aggregation_method=avg`;
    const r = await fetch(url, { next: { revalidate: 3600 } });
    if (!r.ok) return [];
    const obs: { date: string; value: string }[] =
      ((await r.json()).observations ?? []).filter(
        (o: { value: string }) => o.value !== "." && o.value !== ""
      );
    return obs
      .map(o => ({ date: o.date.slice(0, 7), value: parseFloat(o.value) }))
      .filter(o => !isNaN(o.value))
      .reverse(); // oldest first
  } catch {
    return [];
  }
}

// Build indicator reading from a series of monthly values
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

  // Apply transform: for mom3, take 3-month change; for yoy, 12-month; for level, raw
  let values: number[];
  if (indicator.transform === "mom3" && series.length >= 4) {
    values = series.slice(3).map((p, i) => p.value - series[i].value);
  } else if (indicator.transform === "yoy" && series.length >= 13) {
    values = series.slice(12).map((p, i) => p.value - series[i].value);
  } else {
    values = series.map(p => p.value);
  }

  const winsorized = winsorize(values, 0.02);
  const mu  = mean(winsorized);
  const sig = stdDev(winsorized, mu);

  const latest   = values[values.length - 1];
  const previous = values[values.length - 2];
  const z        = zscore(latest, mu, sig);
  const directedZ = z * indicator.direction;

  return {
    id:           indicator.id,
    name:         indicator.name,
    latestValue:  Math.round(series[series.length - 1].value * 100) / 100,
    latestDate:   series[series.length - 1].date,
    previousValue: series[series.length - 2].value,
    change:       Math.round((series[series.length - 1].value - series[series.length - 2].value) * 1000) / 1000,
    zscore:       Math.round(z * 100) / 100,
    contribution: Math.round(directedZ * indicator.weight * 100) / 100,
    direction:    indicator.direction,
    weight:       indicator.weight,
    enabled:      indicator.enabled,
    stdDev:       Math.round(sig * 1000) / 1000,
    mean:         Math.round(mu * 1000) / 1000,
  };
}

// Demo data returned when FRED key is not configured
function demoRegimeData(): RegimeData {
  const demoHistory: CompositePoint[] = [];
  const baseRegimes: RegimeLabel[] = [
    "Expansion","Expansion","Expansion","Slowdown","Slowdown","Slowdown",
    "Slowdown","Contraction","Contraction","Contraction","Contraction","Slowdown",
    "Slowdown","Slowdown","Slowdown","Slowdown","Contraction","Contraction",
    "Recovery","Recovery","Expansion","Expansion","Slowdown","Slowdown",
  ];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const regime = baseRegimes[23 - i];
    const growth = regime === "Expansion" ? 0.55 + Math.random() * 0.3
      : regime === "Recovery"    ? 0.10 + Math.random() * 0.4
      : regime === "Slowdown"    ? -0.15 + Math.random() * 0.3
      : -0.60 - Math.random() * 0.2;
    const riskAppetite = growth * 0.75 + Math.random() * 0.15 - 0.08;
    demoHistory.push({ date, growth: Math.round(growth * 100) / 100, riskAppetite: Math.round(riskAppetite * 100) / 100, regime });
  }

  const asOf = new Date().toISOString().slice(0, 7);
  // Illustrative Contraction scenario: G = Σ(z × d × w) ≈ -0.34σ
  // For transformed series (mom3/yoy): VALUE shows raw level; μ and σ are of the transformed change.
  // The z-score formula uses the transformed value, not the raw level directly.
  const demoIndicators: IndicatorReading[] = [
    {
      id: "icsa",       name: "Initial Claims (inv.)",
      latestValue: 233000,  previousValue: 227400, change: 5600, latestDate: asOf,
      mean: -2500,    stdDev: 18000,
      zscore: 0.45,   contribution: -0.07,   // z×d×w = 0.45×(−1)×0.15
      direction: -1,  weight: 0.15,  enabled: true,
    },
    {
      id: "permit",     name: "Building Permits",
      latestValue: 1374,    previousValue: 1448,   change: -74,   latestDate: asOf,
      mean: 28,       stdDev: 185,
      zscore: -0.55,  contribution: -0.07,   // (−0.55)×(+1)×0.12
      direction: 1,   weight: 0.12,  enabled: true,
    },
    {
      id: "unrate",     name: "Unemployment Rate (inv.)",
      latestValue: 4.10,    previousValue: 4.00,   change: 0.10,  latestDate: asOf,
      mean: 5.82,     stdDev: 2.15,
      zscore: -0.80,  contribution: 0.08,    // (−0.80)×(−1)×0.10
      direction: -1,  weight: 0.10,  enabled: true,
    },
    {
      id: "indpro",     name: "Industrial Production",
      latestValue: 102.8,   previousValue: 102.8,  change: 0.00,  latestDate: asOf,
      mean: 0.42,     stdDev: 1.40,
      zscore: -0.30,  contribution: -0.04,   // (−0.30)×(+1)×0.12
      direction: 1,   weight: 0.12,  enabled: true,
    },
    {
      id: "t10y2y",     name: "Yield Curve (2s10s)",
      latestValue: -0.25,   previousValue: -0.18,  change: -0.07, latestDate: asOf,
      mean: 0.82,     stdDev: 1.07,
      zscore: -1.00,  contribution: -0.18,   // (−1.00)×(+1)×0.18
      direction: 1,   weight: 0.18,  enabled: true,
    },
    {
      id: "umcsent",    name: "Consumer Sentiment",
      latestValue: 67.2,    previousValue: 71.8,   change: -4.6,  latestDate: asOf,
      mean: 84.8,     stdDev: 29.3,
      zscore: -0.60,  contribution: -0.07,   // (−0.60)×(+1)×0.12
      direction: 1,   weight: 0.12,  enabled: true,
    },
    {
      id: "hysprd",     name: "HY Spreads (inv.)",
      latestValue: 5.42,    previousValue: 5.15,   change: 0.27,  latestDate: asOf,
      mean: 4.38,     stdDev: 2.97,
      zscore: 0.35,   contribution: -0.04,   // 0.35×(−1)×0.12
      direction: -1,  weight: 0.12,  enabled: true,
    },
    {
      id: "payems_chg", name: "Payroll Growth",
      latestValue: 157234,  previousValue: 156744, change: 490,   latestDate: asOf,
      mean: 245,      stdDev: 490,
      zscore: 0.50,   contribution: 0.05,    // 0.50×(+1)×0.09
      direction: 1,   weight: 0.09,  enabled: true,
    },
  ];

  return {
    growthComposite:       -0.38,
    riskAppetiteComposite: -0.21,
    growthLevel:           "below",
    growthDirection:       "decelerating",
    growthLevelScore:      -0.38,
    growthDirectionScore:  -0.22,
    regime:                "Contraction",
    probabilities:         { Recovery: 0.09, Expansion: 0.12, Slowdown: 0.32, Contraction: 0.47 },
    confidence:            64,
    explanation:           "DEMONSTRATION DATA — Growth composite is 0.38σ below trend and decelerating, placing the model in the Contraction quadrant. The enhanced model assigns 47% to Contraction and 32% to Slowdown. Configure FRED_API_KEY to use live data.",
    indicators:            demoIndicators,
    history:               demoHistory,
    isDemo:                true,
    asOf,
    dataVintageWarning:    "DEMO MODE: No FRED API key configured. All values are illustrative only.",
  };
}

export async function GET() {
  if (!KEY) {
    return NextResponse.json(demoRegimeData());
  }

  // Fetch all series in parallel (36 monthly observations each)
  const seriesIds = [
    ...DEFAULT_GROWTH_INDICATORS.map(i => i.fredSeries),
    ...DEFAULT_RISK_INDICATORS.map(i => i.fredSeries),
  ];
  const uniqueIds = [...new Set(seriesIds)];

  const fetched = await Promise.all(
    uniqueIds.map(id => fredMonthly(id, 60).then(data => [id, data] as const))
  );
  const seriesMap = Object.fromEntries(fetched);

  // Build readings for growth indicators
  const growthReadings: IndicatorReading[] = DEFAULT_GROWTH_INDICATORS.map(ind =>
    buildReading(ind, seriesMap[ind.fredSeries] ?? [])
  );

  // Build readings for risk appetite indicators
  const riskReadings: IndicatorReading[] = DEFAULT_RISK_INDICATORS.map(ind =>
    buildReading(ind, seriesMap[ind.fredSeries] ?? [])
  );

  const growthComposite       = computeComposite(growthReadings);
  const riskAppetiteComposite = computeComposite(riskReadings);

  // Growth direction: compare latest composite to 3 months ago
  // Use 3-month slope from z-score time series (simplified)
  let growthLevelScore    = growthComposite;
  let growthDirectionScore = 0;
  let growthLevel: "above" | "below"               = (growthComposite ?? 0) >= 0 ? "above" : "below";
  let growthDirection: "accelerating" | "decelerating" = "decelerating";

  // Build monthly composite history for direction estimation
  const monthLabels = seriesMap[DEFAULT_GROWTH_INDICATORS[0].fredSeries]?.map(p => p.date) ?? [];
  if (monthLabels.length >= 4) {
    const historyPoints: number[] = monthLabels.slice(-6).map(date => {
      const tempReadings: IndicatorReading[] = DEFAULT_GROWTH_INDICATORS.map(ind => {
        const series = seriesMap[ind.fredSeries] ?? [];
        const point  = series.find(p => p.date === date);
        const allVals = series.map(p => p.value);
        const mu  = mean(allVals);
        const sig = stdDev(allVals, mu);
        const val = point?.value ?? null;
        const z   = val != null ? zscore(val, mu, sig) : null;
        return {
          id: ind.id, name: ind.name, latestValue: val, latestDate: date, previousValue: null,
          change: null, zscore: z, contribution: null,
          direction: ind.direction, weight: ind.weight, enabled: ind.enabled, stdDev: sig, mean: mu,
        };
      });
      return computeComposite(tempReadings) ?? 0;
    });

    if (historyPoints.length >= 4) {
      const last  = historyPoints[historyPoints.length - 1];
      const prev3 = historyPoints[historyPoints.length - 4];
      growthDirectionScore = last - prev3;
      growthDirection = growthDirectionScore >= 0 ? "accelerating" : "decelerating";
    }
  }

  const regime = classifyRegimeHard(growthLevel, growthDirection);
  const clampedLevel     = Math.max(-1.5, Math.min(1.5, growthLevelScore ?? 0)) / 1.5;
  const clampedDirection = Math.max(-1.5, Math.min(1.5, growthDirectionScore ?? 0)) / 1.5;

  const probs      = computeRegimeProbabilities(clampedLevel, clampedDirection);
  const confidence = computeConfidence(
    probs,
    growthReadings.filter(r => r.zscore != null).length,
    growthReadings.length,
  );

  // Build 24-month composite history
  const history: CompositePoint[] = monthLabels.slice(-24).map(date => {
    const tempG: IndicatorReading[] = DEFAULT_GROWTH_INDICATORS.map(ind => {
      const series = seriesMap[ind.fredSeries] ?? [];
      const point  = series.find(p => p.date === date);
      const allVals = series.map(p => p.value);
      const mu  = mean(allVals);
      const sig = stdDev(allVals, mu);
      const val = point?.value ?? null;
      const z   = val != null ? zscore(val, mu, sig) : null;
      return { id: ind.id, name: ind.name, latestValue: val, latestDate: date, previousValue: null, change: null, zscore: z, contribution: null, direction: ind.direction, weight: ind.weight, enabled: ind.enabled, stdDev: sig, mean: mu };
    });
    const g   = computeComposite(tempG) ?? 0;

    const tempR: IndicatorReading[] = DEFAULT_RISK_INDICATORS.map(ind => {
      const series = seriesMap[ind.fredSeries] ?? [];
      const point  = series.find(p => p.date === date);
      const allVals = series.map(p => p.value);
      const mu  = mean(allVals);
      const sig = stdDev(allVals, mu);
      const val = point?.value ?? null;
      const z   = val != null ? zscore(val, mu, sig) : null;
      return { id: ind.id, name: ind.name, latestValue: val, latestDate: date, previousValue: null, change: null, zscore: z, contribution: null, direction: ind.direction, weight: ind.weight, enabled: ind.enabled, stdDev: sig, mean: mu };
    });
    const ra  = computeComposite(tempR) ?? 0;

    const lvl = g >= 0 ? "above" : "below";
    let   dir: "accelerating" | "decelerating" = "decelerating";
    const idx = monthLabels.indexOf(date);
    if (idx >= 3) {
      const prevDate = monthLabels[idx - 3];
      const prevG: IndicatorReading[] = DEFAULT_GROWTH_INDICATORS.map(ind => {
        const series = seriesMap[ind.fredSeries] ?? [];
        const point  = series.find(p => p.date === prevDate);
        const allVals = series.map(p => p.value);
        const mu  = mean(allVals);
        const sig = stdDev(allVals, mu);
        const val = point?.value ?? null;
        const z   = val != null ? zscore(val, mu, sig) : null;
        return { id: ind.id, name: ind.name, latestValue: val, latestDate: prevDate, previousValue: null, change: null, zscore: z, contribution: null, direction: ind.direction, weight: ind.weight, enabled: ind.enabled, stdDev: sig, mean: mu };
      });
      const prevC = computeComposite(prevG) ?? 0;
      dir = g > prevC ? "accelerating" : "decelerating";
    }

    return {
      date,
      growth: Math.round(g * 100) / 100,
      riskAppetite: Math.round(ra * 100) / 100,
      regime: classifyRegimeHard(lvl, dir),
    };
  });

  const explanation = buildExplanation(regime, clampedLevel, clampedDirection, probs, "enhanced");

  return NextResponse.json({
    growthComposite:       growthComposite != null ? Math.round(growthComposite * 100) / 100 : null,
    riskAppetiteComposite: riskAppetiteComposite != null ? Math.round(riskAppetiteComposite * 100) / 100 : null,
    growthLevel,
    growthDirection,
    growthLevelScore:    Math.round(clampedLevel * 100) / 100,
    growthDirectionScore: Math.round(clampedDirection * 100) / 100,
    regime,
    probabilities: probs,
    confidence,
    explanation,
    indicators:  growthReadings,
    history,
    isDemo:      false,
    asOf:        new Date().toISOString().slice(0, 7),
    dataVintageWarning: "EXPLORATORY: Z-scores normalised over the fetched 36-month window only. Full-sample normalisation is NOT point-in-time valid and will overstate backtest performance. A proper implementation requires expanding-window z-scores from 1990+ history.",
  } satisfies RegimeData);
}
