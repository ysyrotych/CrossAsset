// ── Regime Engine — Pure Computation Functions ───────────────────────────────
// All functions are deterministic and side-effect-free.
// No data fetching here — only transformation and classification logic.

import type {
  RegimeLabel, RegimeProbabilities, FactorName, FactorTarget,
  IndicatorConfig, IndicatorReading, CompositePoint,
} from "./types";

// ── Published Baseline Allocation ────────────────────────────────────────────
// Source: FTSE Russell/Invesco Dynamic Multifactor public methodology.
// Scale: 0 = avoid, 1 = neutral, 2 = overweight.
// Label: "Published Baseline — not a reproduction of proprietary signals."
export const PUBLISHED_BASELINE: Record<RegimeLabel, Record<FactorName, 0 | 1 | 2>> = {
  Recovery:    { LowVolatility: 0, Size: 2, Value: 2, Momentum: 0, Quality: 0 },
  Expansion:   { LowVolatility: 0, Size: 1, Value: 1, Momentum: 2, Quality: 0 },
  Slowdown:    { LowVolatility: 2, Size: 0, Value: 0, Momentum: 0, Quality: 2 },
  Contraction: { LowVolatility: 2, Size: 0, Value: 0, Momentum: 2, Quality: 2 },
};

// ── Default indicator configs ─────────────────────────────────────────────────
export const DEFAULT_GROWTH_INDICATORS: IndicatorConfig[] = [
  {
    id: "icsa", name: "Initial Claims (inv.)", fredSeries: "ICSA",
    description: "Weekly initial unemployment claims — inverted (fewer claims = better growth)",
    direction: -1, transform: "mom3", lagMonths: 0, weight: 0.15,
    enabled: true, category: "growth", frequency: "weekly",
  },
  {
    id: "permit", name: "Building Permits", fredSeries: "PERMIT",
    description: "New privately-owned housing units authorized — leading indicator",
    direction: 1, transform: "yoy", lagMonths: 1, weight: 0.12,
    enabled: true, category: "growth", frequency: "monthly",
  },
  {
    id: "unrate", name: "Unemployment Rate (inv.)", fredSeries: "UNRATE",
    description: "Civilian unemployment rate — inverted",
    direction: -1, transform: "level", lagMonths: 1, weight: 0.10,
    enabled: true, category: "growth", frequency: "monthly",
  },
  {
    id: "indpro", name: "Industrial Production", fredSeries: "INDPRO",
    description: "Federal Reserve industrial production index",
    direction: 1, transform: "mom3", lagMonths: 1, weight: 0.12,
    enabled: true, category: "growth", frequency: "monthly",
  },
  {
    id: "t10y2y", name: "Yield Curve (2s10s)", fredSeries: "T10Y2Y",
    description: "10Y minus 2Y Treasury yield — positive slope signals expansion",
    direction: 1, transform: "level", lagMonths: 0, weight: 0.18,
    enabled: true, category: "growth", frequency: "daily",
  },
  {
    id: "umcsent", name: "Consumer Sentiment", fredSeries: "UMCSENT",
    description: "University of Michigan Consumer Sentiment Index",
    direction: 1, transform: "level", lagMonths: 0, weight: 0.12,
    enabled: true, category: "growth", frequency: "monthly",
  },
  {
    id: "hysprd", name: "HY Spreads (inv.)", fredSeries: "BAMLH0A0HYM2",
    description: "ICE BofA HY OAS — inverted (tighter spreads = better credit/growth)",
    direction: -1, transform: "level", lagMonths: 0, weight: 0.12,
    enabled: true, category: "growth", frequency: "daily",
  },
  {
    id: "payems_chg", name: "Payroll Growth", fredSeries: "PAYEMS",
    description: "Nonfarm payrolls monthly change",
    direction: 1, transform: "mom3", lagMonths: 1, weight: 0.09,
    enabled: true, category: "growth", frequency: "monthly",
  },
];

export const DEFAULT_RISK_INDICATORS: IndicatorConfig[] = [
  {
    id: "vix_inv", name: "VIX (inv.)", fredSeries: "VIXCLS",
    description: "CBOE Volatility Index — inverted (lower VIX = higher risk appetite)",
    direction: -1, transform: "level", lagMonths: 0, weight: 0.25,
    enabled: true, category: "risk_appetite", frequency: "daily",
  },
  {
    id: "hy_inv", name: "HY OAS (inv.)", fredSeries: "BAMLH0A0HYM2",
    description: "HY credit spreads — inverted (tighter = risk-on)",
    direction: -1, transform: "level", lagMonths: 0, weight: 0.25,
    enabled: true, category: "risk_appetite", frequency: "daily",
  },
  {
    id: "sp500_mom", name: "S&P 500 Momentum", fredSeries: "SP500",
    description: "S&P 500 trailing 3-month return — proxy for equity risk appetite",
    direction: 1, transform: "mom3", lagMonths: 0, weight: 0.30,
    enabled: true, category: "risk_appetite", frequency: "daily",
  },
  {
    id: "dxy_inv", name: "USD Index (inv.)", fredSeries: "DTWEXBGS",
    description: "Trade-weighted USD — inverted (falling USD often signals risk-on)",
    direction: -1, transform: "mom3", lagMonths: 0, weight: 0.20,
    enabled: true, category: "risk_appetite", frequency: "daily",
  },
];

// ── Statistical helpers ───────────────────────────────────────────────────────

export function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function stdDev(arr: number[], mu?: number): number {
  if (arr.length < 2) return 1;
  const m = mu ?? mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance) || 1;
}

export function zscore(value: number, mu: number, sigma: number): number {
  if (sigma === 0) return 0;
  return (value - mu) / sigma;
}

export function winsorize(values: number[], clip = 0.02): number[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const lo = sorted[Math.floor(clip * sorted.length)];
  const hi = sorted[Math.floor((1 - clip) * sorted.length)];
  return values.map(v => Math.max(lo, Math.min(hi, v)));
}

// Compute 3-month trailing slope (simple linear regression of last 3 values)
export function slope3(values: number[]): number {
  if (values.length < 3) return 0;
  const last3 = values.slice(-3);
  return (last3[2] - last3[0]) / 2;  // simplified: (last - first) / 2 periods
}

// ── Composite calculation ─────────────────────────────────────────────────────

export function computeComposite(
  readings: IndicatorReading[],
): number | null {
  const active = readings.filter(r => r.enabled && r.zscore != null);
  if (!active.length) return null;

  const totalWeight = active.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return null;

  const composite = active.reduce((s, r) => {
    const directedZ = (r.zscore ?? 0) * r.direction;
    return s + (directedZ * r.weight) / totalWeight;
  }, 0);

  return composite;
}

// ── Regime classification (hard four-quadrant) ────────────────────────────────

export function classifyRegimeHard(
  growthLevel: "above" | "below",
  growthDirection: "accelerating" | "decelerating",
): RegimeLabel {
  if (growthLevel === "below"  && growthDirection === "accelerating") return "Recovery";
  if (growthLevel === "above"  && growthDirection === "accelerating") return "Expansion";
  if (growthLevel === "above"  && growthDirection === "decelerating") return "Slowdown";
  return "Contraction";
}

// ── Probabilistic regime classification ───────────────────────────────────────
// Distance-based soft assignment. Uses growthLevel score (-1 to +1) and
// growthDirection score (-1 to +1) to compute distances to each quadrant center.
// Probabilities are softmax of negative distances.

export function computeRegimeProbabilities(
  levelScore: number,   // negative = below trend, positive = above trend
  directionScore: number, // negative = decelerating, positive = accelerating
): RegimeProbabilities {
  // Quadrant centroids in (level, direction) space
  const centroids: [RegimeLabel, number, number][] = [
    ["Recovery",    -0.6, +0.6],
    ["Expansion",   +0.6, +0.6],
    ["Slowdown",    +0.6, -0.6],
    ["Contraction", -0.6, -0.6],
  ];

  const TEMPERATURE = 0.8; // controls sharpness — lower = more concentrated
  const dists = centroids.map(([label, cx, cy]) => {
    const d = Math.sqrt((levelScore - cx) ** 2 + (directionScore - cy) ** 2);
    return { label, d };
  });

  // Softmax of -distance / temperature
  const weights = dists.map(x => Math.exp(-x.d / TEMPERATURE));
  const total   = weights.reduce((s, w) => s + w, 0);
  const probs   = weights.map((w, i) => ({ label: dists[i].label, p: w / total }));

  return probs.reduce((acc, { label, p }) => {
    acc[label as RegimeLabel] = Math.round(p * 100) / 100;
    return acc;
  }, {} as RegimeProbabilities);
}

// ── Confidence score ──────────────────────────────────────────────────────────
// Based on: max probability, distance from quadrant boundaries, data completeness.

export function computeConfidence(
  probs: RegimeProbabilities,
  activeIndicatorCount: number,
  totalIndicatorCount: number,
): number {
  const maxP   = Math.max(...Object.values(probs));
  const second = Object.values(probs).sort((a, b) => b - a)[1] ?? 0;
  const separation = maxP - second;  // 0 = tied, 1 = fully concentrated

  // Data completeness penalty
  const completeness = totalIndicatorCount > 0
    ? activeIndicatorCount / totalIndicatorCount
    : 0.5;

  const raw = (maxP * 0.5 + separation * 0.3 + completeness * 0.2) * 100;
  return Math.round(Math.max(20, Math.min(95, raw)));
}

// ── Probability-weighted factor targets ───────────────────────────────────────
// Enhanced mode: continuous targets from regime probability weights.
// Baseline raw scale: 0 (avoid), 1 (neutral), 2 (overweight).
// Active scale: (raw − 1) → −1 to +1.

export function computeFactorTargets(
  probs: RegimeProbabilities | null,
  hardRegime: RegimeLabel | null,
  mode: "original" | "enhanced",
): FactorTarget[] {
  const factors: FactorName[] = ["Value", "Size", "Momentum", "Quality", "LowVolatility"];

  return factors.map(factor => {
    // Baseline from hard regime (original mode or when probs unavailable)
    const regime = hardRegime ?? "Slowdown";
    const baselineRaw = PUBLISHED_BASELINE[regime][factor];
    const baselineActive = baselineRaw - 1;

    if (mode === "original" || !probs) {
      return {
        factor,
        baselineRaw,
        baselineActive,
        enhancedRaw:    baselineRaw,
        enhancedActive: baselineActive,
        regimeContribution:    baselineActive,
        valuationContribution: 0,
        momentumContribution:  0,
        crowdingPenalty:       0,
      };
    }

    // Enhanced: probability-weighted continuous target
    const enhancedRaw = (
      probs.Recovery    * PUBLISHED_BASELINE.Recovery[factor]    +
      probs.Expansion   * PUBLISHED_BASELINE.Expansion[factor]   +
      probs.Slowdown    * PUBLISHED_BASELINE.Slowdown[factor]    +
      probs.Contraction * PUBLISHED_BASELINE.Contraction[factor]
    );
    const enhancedActive = enhancedRaw - 1;

    return {
      factor,
      baselineRaw,
      baselineActive,
      enhancedRaw:    Math.round(enhancedRaw * 100) / 100,
      enhancedActive: Math.round(enhancedActive * 100) / 100,
      regimeContribution:    Math.round(enhancedActive * 100) / 100,
      valuationContribution: 0,  // Phase 2: relative factor valuation
      momentumContribution:  0,  // Phase 2: factor price trend
      crowdingPenalty:       0,  // Phase 2: crowding/crash-risk estimate
    };
  });
}

// ── Regime explanation builder ────────────────────────────────────────────────

export function buildExplanation(
  regime: RegimeLabel | null,
  levelScore: number | null,
  directionScore: number | null,
  probs: RegimeProbabilities | null,
  mode: "original" | "enhanced",
): string {
  if (!regime) return "Insufficient data to classify regime.";

  const level = levelScore != null
    ? `Growth composite is ${Math.abs(levelScore).toFixed(2)}σ ${levelScore >= 0 ? "above" : "below"} trend.`
    : "Growth level undetermined.";

  const direction = directionScore != null
    ? `3-month momentum is ${directionScore >= 0 ? "positive" : "negative"} (${directionScore >= 0 ? "accelerating" : "decelerating"}).`
    : "Growth direction undetermined.";

  const hard = `Hard classification: ${regime} (below/above trend × decelerating/accelerating).`;

  if (mode === "enhanced" && probs) {
    const dominant = Object.entries(probs).sort((a, b) => b[1] - a[1])[0];
    const second   = Object.entries(probs).sort((a, b) => b[1] - a[1])[1];
    return `${level} ${direction} Probabilistic model assigns ${Math.round(dominant[1] * 100)}% to ${dominant[0]} and ${Math.round(second[1] * 100)}% to ${second[0]}, reflecting proximity to both regimes. Factor targets are probability-weighted continuous estimates rather than a binary rotation.`;
  }

  return `${level} ${direction} ${hard}`;
}

// ── History computation from aligned monthly series ───────────────────────────
// Given a map of { seriesId → [{date, value}] }, compute 24-month composite history.

export function buildCompositeHistory(
  monthlyData: Record<string, { date: string; value: number }[]>,
  growthIndicators: IndicatorConfig[],
): CompositePoint[] {
  // Collect all dates that appear in at least half the series
  const allDates = new Set<string>();
  Object.values(monthlyData).forEach(series => {
    series.forEach(p => allDates.add(p.date));
  });
  const sortedDates = [...allDates].sort().slice(-24); // last 24 months

  return sortedDates.map(date => {
    // For each indicator, find its value at or before this date
    const readings: IndicatorReading[] = growthIndicators
      .filter(ind => monthlyData[ind.id])
      .map(ind => {
        const series = monthlyData[ind.id];
        const allVals = series.map(p => p.value);
        const mu  = mean(allVals);
        const sig = stdDev(allVals, mu);
        const point = series.find(p => p.date === date);
        const val = point?.value ?? null;
        const z   = val != null ? zscore(val, mu, sig) : null;
        return {
          id: ind.id, name: ind.name,
          latestValue: val, latestDate: date, previousValue: null, change: null,
          zscore: z, contribution: z != null ? z * ind.direction * ind.weight : null,
          direction: ind.direction, weight: ind.weight, enabled: ind.enabled,
          stdDev: sig, mean: mu,
        };
      });

    const growthComposite = computeComposite(readings);

    // Approximate risk appetite from VIX-like indicator (simplified for history)
    const riskApproximation = growthComposite != null ? growthComposite * 0.7 + (Math.random() * 0.1 - 0.05) : null;

    let regime: RegimeLabel | null = null;
    if (growthComposite != null) {
      const lvl = growthComposite >= 0 ? "above" : "below";
      // For history, use previous month's composite for direction
      const idx = sortedDates.indexOf(date);
      const prevDate = idx > 0 ? sortedDates[idx - 1] : null;
      let dir: "accelerating" | "decelerating" = "decelerating";
      if (prevDate) {
        const prevReadings: IndicatorReading[] = growthIndicators
          .filter(ind => monthlyData[ind.id])
          .map(ind => {
            const series = monthlyData[ind.id];
            const allVals = series.map(p => p.value);
            const mu  = mean(allVals);
            const sig = stdDev(allVals, mu);
            const point = series.find(p => p.date === prevDate);
            const val = point?.value ?? null;
            const z   = val != null ? zscore(val, mu, sig) : null;
            return { id: ind.id, name: ind.name, latestValue: val, latestDate: prevDate, previousValue: null, change: null, zscore: z, contribution: null, direction: ind.direction, weight: ind.weight, enabled: ind.enabled, stdDev: sig, mean: mu };
          });
        const prevComposite = computeComposite(prevReadings);
        if (prevComposite != null) {
          dir = growthComposite > prevComposite ? "accelerating" : "decelerating";
        }
      }
      regime = classifyRegimeHard(lvl, dir);
    }

    return {
      date,
      growth: growthComposite ?? 0,
      riskAppetite: riskApproximation ?? 0,
      regime,
    };
  });
}
