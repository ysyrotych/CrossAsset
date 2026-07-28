// ── Strategy Lab — Portfolio Types & Default Holdings ─────────────────────────

export type PortfolioPosition = {
  ticker:  string;
  weight:  number;   // 0–1 decimal (e.g. 0.095 = 9.5%)
  name?:   string;
};

export type FactorScoreResult = {
  ticker:       string;
  weight:       number;
  name:         string;
  sector:       string;
  price:        number;
  marketCap:    number;
  // ── Raw factor inputs ──────────────────────────────────────────────────────
  momentum12_1:  number | null;   // 12-1M price return (skip last month)
  momentum6_1:   number | null;   // 6-1M price return
  realizedVol:   number | null;   // annualised 252D realized volatility
  beta:          number | null;   // 52-week beta vs SPY
  earningsYield: number | null;   // E/P ratio (inverse of P/E)
  fcfYield:      number | null;   // FCF / Market Cap
  evEbitda:      number | null;   // EV/EBITDA (lower = cheaper)
  roic:          number | null;   // Return on invested capital
  grossMargin:   number | null;   // Gross profit margin (quality proxy)
  netLeverage:   number | null;   // Net debt / EBITDA (lower = better quality)
  // ── Cross-sectional z-scores (within portfolio universe) ──────────────────
  zMomentum:    number | null;
  zLowVol:      number | null;
  zValue:       number | null;
  zQuality:     number | null;
  zSize:        number | null;
  // ── Regime-weighted composite ──────────────────────────────────────────────
  compositeScore: number;
  // ── Data quality & point-in-time metadata ────────────────────────────────
  priceDataOk:      boolean;
  fundDataOk:       boolean;
  reportingLagDays: number;   // days after quarter-end until filing available
};

export type PortfolioExposure = {
  factor:            "Momentum" | "LowVolatility" | "Value" | "Quality" | "Size";
  portfolioExposure: number | null;  // null when no stocks have data for this factor
  regimeTarget:      number;
  gap:               number | null;
};

// ── Default portfolio ─────────────────────────────────────────────────────────
// Manually curated — corresponds to the user's current holdings.
// USD Crncy (1.6% cash) excluded from equity factor scoring.

export const DEFAULT_PORTFOLIO: PortfolioPosition[] = [
  { ticker: "FICO",  weight: 0.045, name: "Fair Isaac" },
  { ticker: "ISRG",  weight: 0.039, name: "Intuitive Surgical" },
  { ticker: "SNPS",  weight: 0.043, name: "Synopsys" },
  { ticker: "NFLX",  weight: 0.043, name: "Netflix" },
  { ticker: "RDDT",  weight: 0.031, name: "Reddit" },
  { ticker: "AMZN",  weight: 0.020, name: "Amazon" },
  { ticker: "TSLA",  weight: 0.016, name: "Tesla" },
  { ticker: "NVDA",  weight: 0.095, name: "NVIDIA" },
  { ticker: "TDG",   weight: 0.036, name: "TransDigm" },
  { ticker: "SPGI",  weight: 0.002, name: "S&P Global" },
  { ticker: "SPOT",  weight: 0.037, name: "Spotify" },
  { ticker: "BX",    weight: 0.024, name: "Blackstone" },
  { ticker: "V",     weight: 0.065, name: "Visa" },
  { ticker: "VRTX",  weight: 0.027, name: "Vertex Pharma" },
  { ticker: "AXON",  weight: 0.062, name: "Axon Enterprise" },
  { ticker: "SHOP",  weight: 0.053, name: "Shopify" },
  { ticker: "MSCI",  weight: 0.040, name: "MSCI Inc." },
  { ticker: "AVGO",  weight: 0.084, name: "Broadcom" },
  { ticker: "APH",   weight: 0.056, name: "Amphenol" },
  { ticker: "LIN",   weight: 0.020, name: "Linde" },
  { ticker: "LLY",   weight: 0.051, name: "Eli Lilly" },
  { ticker: "ASML",  weight: 0.096, name: "ASML Holding" },
  { ticker: "USD",   weight: 0.015, name: "Cash (USD)" },
];

// ── Statistical helpers ───────────────────────────────────────────────────────

export function crossSectionalZ(values: (number | null)[]): (number | null)[] {
  const valid = values.filter((v): v is number => v != null && isFinite(v));
  if (valid.length < 2) return values.map(() => null);
  const mu  = valid.reduce((s, v) => s + v, 0) / valid.length;
  const sig = Math.sqrt(valid.reduce((s, v) => s + (v - mu) ** 2, 0) / (valid.length - 1)) || 1;
  return values.map(v => v != null && isFinite(v) ? Math.max(-3, Math.min(3, (v - mu) / sig)) : null);
}

export function weightedAverage(
  scores:  (number | null)[],
  weights: number[],
): number {
  let sum = 0; let wsum = 0;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] != null) { sum += (scores[i] as number) * weights[i]; wsum += weights[i]; }
  }
  return wsum > 0 ? sum / wsum : 0;
}
