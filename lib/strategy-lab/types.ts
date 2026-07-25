// ── Strategy Lab — Core Type Definitions ────────────────────────────────────
// All types used across the regime engine, factor model, portfolio builder,
// backtest engine, and UI components.

export type RegimeLabel = "Recovery" | "Expansion" | "Slowdown" | "Contraction";
export type FactorName  = "Value" | "Size" | "Momentum" | "Quality" | "LowVolatility";
export type StrategyMode = "original" | "enhanced";
export type ClassificationMethod = "hard" | "probabilistic" | "statistical";

export type RegimeProbabilities = {
  Recovery:    number;
  Expansion:   number;
  Slowdown:    number;
  Contraction: number;
};

// ── Published Baseline Allocation (FTSE Russell/Invesco-style) ───────────────
// Scale: 0 = avoid/underweight, 1 = neutral, 2 = overweight
export type BaselineAllocation = Record<RegimeLabel, Record<FactorName, 0 | 1 | 2>>;

// ── Indicator configuration (editable by the user) ───────────────────────────
export type IndicatorTransform = "level" | "mom3" | "mom6" | "yoy" | "zscore";

export type IndicatorConfig = {
  id:           string;
  name:         string;
  fredSeries:   string;
  description:  string;
  direction:    1 | -1;    // 1 = higher is better for growth, -1 = inverted
  transform:    IndicatorTransform;
  lagMonths:    number;    // typical publication lag
  weight:       number;    // 0–1, normalised to sum to 1 by engine
  enabled:      boolean;
  category:     "growth" | "risk_appetite";
  frequency:    "daily" | "weekly" | "monthly" | "quarterly";
};

// ── Live reading for one indicator ───────────────────────────────────────────
export type IndicatorReading = {
  id:           string;
  name:         string;
  latestValue:  number | null;
  latestDate:   string;
  previousValue: number | null;
  change:       number | null;
  zscore:       number | null;
  contribution: number | null;  // weighted contribution to composite
  direction:    1 | -1;
  weight:       number;
  enabled:      boolean;
  stdDev:       number | null;
  mean:         number | null;
};

// ── Historical composite point ────────────────────────────────────────────────
export type CompositePoint = {
  date:         string;   // YYYY-MM
  growth:       number;   // z-score composite
  riskAppetite: number;   // z-score composite
  regime:       RegimeLabel | null;
};

// ── Full regime reading returned by the API ───────────────────────────────────
export type RegimeData = {
  growthComposite:       number | null;
  riskAppetiteComposite: number | null;
  growthLevel:           "above" | "below" | null;
  growthDirection:       "accelerating" | "decelerating" | null;
  growthLevelScore:      number | null;  // -1 to +1 for diagram positioning
  growthDirectionScore:  number | null;  // -1 to +1
  regime:                RegimeLabel | null;
  probabilities:         RegimeProbabilities | null;
  confidence:            number | null;  // 0–100
  explanation:           string;
  indicators:            IndicatorReading[];
  history:               CompositePoint[];
  isDemo:                boolean;
  asOf:                  string;
  dataVintageWarning:    string;
};

// ── Factor target computed from regime ───────────────────────────────────────
// Active scale: -1 = underweight, 0 = neutral, +1 = overweight
export type FactorTarget = {
  factor:                FactorName;
  baselineRaw:           number;    // 0-2 from published table, hard regime
  baselineActive:        number;    // (raw - 1) → -1 to +1
  enhancedRaw:           number;    // probability-weighted 0-2
  enhancedActive:        number;    // (raw - 1) → -1 to +1
  regimeContribution:    number;
  valuationContribution: number;
  momentumContribution:  number;
  crowdingPenalty:       number;
};

// ── Model readiness gate ──────────────────────────────────────────────────────
export type ReadinessGate = {
  id:          string;
  label:       string;
  status:      "complete" | "partial" | "pending" | "blocked";
  note:        string;
  required:    boolean;  // must be complete before paper-trading
};

// ── Factor component definition ───────────────────────────────────────────────
export type FactorComponent = {
  id:          string;
  name:        string;
  description: string;
  weight:      number;  // 0–1
  enabled:     boolean;
  dataDep:     string;  // data dependency description
};

export type FactorDefinition = {
  factor:      FactorName;
  description: string;
  rationale:   string;
  components:  FactorComponent[];
  sectorNeutral: boolean;
  winsorize:   boolean;
  winsorizeClip: number;  // percentile, e.g. 0.02 = 2%
};
