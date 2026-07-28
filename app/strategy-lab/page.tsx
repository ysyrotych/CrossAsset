"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import type {
  RegimeLabel, FactorName, StrategyMode, RegimeProbabilities,
  IndicatorConfig, RegimeData, FactorTarget, FactorDefinition,
  ReadinessGate,
} from "@/lib/strategy-lab/types";
import {
  PUBLISHED_BASELINE, DEFAULT_GROWTH_INDICATORS, DEFAULT_RISK_INDICATORS,
  computeRegimeProbabilities, computeFactorTargets, buildExplanation,
  computeConfidence, classifyRegimeHard,
} from "@/lib/strategy-lab/regime";
import {
  DEFAULT_PORTFOLIO,
} from "@/lib/strategy-lab/portfolio";
import type { PortfolioPosition, FactorScoreResult, PortfolioExposure } from "@/lib/strategy-lab/portfolio";

// ── Design tokens (match CrossAsset conventions exactly) ─────────────────────
const NAVY    = "#0c1b38";
const POSITIVE= "#147a4f";
const NEGATIVE= "#b42318";
const AMBER   = "#b7791f";
const BORDER  = "#e8e3da";
const LGRAY   = "#fbfaf7";
const DGRAY   = "#555";

const REGIME_COLORS: Record<RegimeLabel, { bg: string; border: string; text: string; dot: string }> = {
  Recovery:    { bg: "#f0f4ff", border: "#c8d0e8", text: "#1e3a8a", dot: "#3b82f6" },
  Expansion:   { bg: "#f0faf4", border: "#b8e6ce", text: "#147a4f", dot: "#16a34a" },
  Slowdown:    { bg: "#fffbf0", border: "#f0d89a", text: "#b7791f", dot: "#d97706" },
  Contraction: { bg: "#fff5f4", border: "#f5c6c0", text: "#b42318", dot: "#dc2626" },
};

// ── Static baseline data ──────────────────────────────────────────────────────
const FACTOR_LABELS: Record<FactorName, { short: string; color: string }> = {
  Value:         { short: "Val", color: "#2563eb" },
  Size:          { short: "Siz", color: "#7c3aed" },
  Momentum:      { short: "Mom", color: AMBER },
  Quality:       { short: "Qlty", color: POSITIVE },
  LowVolatility: { short: "LVol", color: NAVY },
};

const FACTOR_DEFINITIONS: FactorDefinition[] = [
  {
    factor: "Value",
    description: "Identifies stocks trading at a discount to their intrinsic worth.",
    rationale: "Mean-reversion in price-to-fundamentals ratios. Historically compensated risk premium for owning unloved securities.",
    components: [
      { id: "ey",  name: "Earnings Yield",        description: "E/P ratio, trailing 12M", weight: 0.30, enabled: true, dataDep: "EPS (trailing)" },
      { id: "fcfy",name: "FCF Yield",             description: "FCF / Market Cap",        weight: 0.30, enabled: true, dataDep: "FCF (trailing)" },
      { id: "ev_ebitda",name: "EV/EBITDA (inv.)", description: "Inverse of EV/EBITDA",   weight: 0.25, enabled: true, dataDep: "EBITDA, Debt, Cash" },
      { id: "bp",  name: "Book-to-Price",         description: "B/P ratio",               weight: 0.15, enabled: false, dataDep: "Book value" },
    ],
    sectorNeutral: true, winsorize: true, winsorizeClip: 0.02,
  },
  {
    factor: "Quality",
    description: "Selects companies with durable competitive advantages and reliable earnings.",
    rationale: "High-quality companies tend to sustain profitability through cycles, reducing drawdown risk and capturing upside in risk-off regimes.",
    components: [
      { id: "roic",  name: "Return on Invested Capital", description: "NOPAT / Invested Capital", weight: 0.30, enabled: true, dataDep: "NOPAT, Invested Capital" },
      { id: "gp",    name: "Gross Profitability",       description: "Gross Profit / Assets",    weight: 0.20, enabled: true, dataDep: "GP, Total Assets" },
      { id: "om_stab",name: "Op. Margin Stability",    description: "1 / Stdev(OM, 5Y)",        weight: 0.15, enabled: true, dataDep: "5Y operating margins" },
      { id: "accruals",name: "Accruals (inv.)",         description: "-(Net Income - CFO)/Assets",weight: 0.20, enabled: true, dataDep: "CFO, Net Income, Assets" },
      { id: "lev",   name: "Net Leverage (inv.)",       description: "-(Net Debt / EBITDA)",     weight: 0.15, enabled: true, dataDep: "Net Debt, EBITDA" },
    ],
    sectorNeutral: true, winsorize: true, winsorizeClip: 0.02,
  },
  {
    factor: "Momentum",
    description: "Captures stocks with strong recent relative price performance.",
    rationale: "Price trends persist over 6–12 month horizons due to investor under-reaction and institutional herding. The reversal in month 1 is excluded.",
    components: [
      { id: "mom12_1", name: "12−1M Price Return",     description: "Return, months −12 to −1", weight: 0.50, enabled: true, dataDep: "Adjusted price history" },
      { id: "mom6_1",  name: "6−1M Price Return",      description: "Return, months −6 to −1",  weight: 0.30, enabled: true, dataDep: "Adjusted price history" },
      { id: "er_rev",  name: "Earnings Revision Score", description: "Net analyst EPS revisions, 3M", weight: 0.20, enabled: false, dataDep: "Consensus estimates (Phase 2)" },
    ],
    sectorNeutral: false, winsorize: true, winsorizeClip: 0.01,
  },
  {
    factor: "LowVolatility",
    description: "Targets stocks with below-average realized price volatility and market beta.",
    rationale: "The low-volatility anomaly: lower-risk stocks have historically delivered superior risk-adjusted returns, contradicting the CAPM.",
    components: [
      { id: "vol252", name: "252D Realized Vol",        description: "Stdev of daily returns, 1Y", weight: 0.40, enabled: true, dataDep: "Daily adjusted prices" },
      { id: "beta",   name: "Market Beta",              description: "52-week regression beta",    weight: 0.35, enabled: true, dataDep: "Daily adjusted prices" },
      { id: "dvol",   name: "Downside Volatility",      description: "Stdev of negative returns",  weight: 0.25, enabled: true, dataDep: "Daily adjusted prices" },
    ],
    sectorNeutral: false, winsorize: true, winsorizeClip: 0.02,
  },
  {
    factor: "Size",
    description: "Tilts toward smaller market-cap companies within the investment universe.",
    rationale: "Small-cap premium: smaller companies have historically delivered higher long-run returns, partially as compensation for lower liquidity.",
    components: [
      { id: "log_mcap", name: "Inverse Log Market Cap", description: "−log(Market Cap)",         weight: 1.00, enabled: true, dataDep: "Market cap (daily)" },
    ],
    sectorNeutral: false, winsorize: true, winsorizeClip: 0.02,
  },
];

const READINESS_GATES: ReadinessGate[] = [
  { id: "data",       label: "FRED Data Pipeline",          status: "complete", note: "Live FRED connection — 8 macro indicators", required: true },
  { id: "regime",     label: "Regime Engine Specification", status: "complete", note: "Growth composite + probabilistic classifier configured", required: true },
  { id: "factors",    label: "Factor Definitions",          status: "partial",  note: "Definitions complete — security-level scoring requires fundamental data (Phase 2)", required: true },
  { id: "universe",   label: "Security Universe",           status: "pending",  note: "Requires FactSet / Bloomberg / user CSV upload (Phase 2)", required: true },
  { id: "constraints",label: "Portfolio Constraints",       status: "partial",  note: "Constraints defined — optimizer requires universe (Phase 2)", required: true },
  { id: "pit",        label: "Point-in-Time Validation",    status: "blocked",  note: "Requires vintage macro data and historical constituent data (Phase 3)", required: true },
  { id: "oos",        label: "Out-of-Sample Backtest",      status: "blocked",  note: "Requires PIT validation to pass first (Phase 3)", required: true },
  { id: "paper",      label: "Paper Trading Approval",      status: "pending",  note: "All required gates must pass before paper portfolio is activated", required: true },
];

const TABS = ["Overview", "Regime Engine", "Factor Model", "Portfolio Builder", "Backtest", "Diagnostics", "Methodology"] as const;
type Tab = typeof TABS[number];

// ── Primitive UI components (match CrossAsset conventions) ────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38] mb-0">{children}</p>;
}
function MiniLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999]">{children}</p>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`border border-[#e8e3da] bg-white ${className}`}>{children}</section>;
}
function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-700">
      Demo Data
    </span>
  );
}
function ResearchBadge() {
  return (
    <span className="inline-flex items-center gap-1 border border-[#c8d0e8] bg-[#eef1f8] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#0c1b38]">
      Research Prototype
    </span>
  );
}
function PhaseBadge({ phase }: { phase: 2 | 3 | 4 }) {
  return (
    <span className="border border-[#e8e3da] bg-[#fbfaf7] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]">
      Phase {phase}
    </span>
  );
}
function StatusDot({ status }: { status: ReadinessGate["status"] }) {
  const colors = { complete: "bg-[#147a4f]", partial: "bg-[#b7791f]", pending: "bg-[#bbb]", blocked: "bg-[#b42318]" };
  return <span className={`w-2 h-2 rounded-full shrink-0 mt-[3px] ${colors[status]}`} />;
}

// ── Regime four-quadrant diagram ──────────────────────────────────────────────
function RegimeQuadrant({
  regime, probs, levelScore, directionScore, mode,
}: {
  regime: RegimeLabel | null;
  probs: RegimeProbabilities | null;
  levelScore: number | null;
  directionScore: number | null;
  mode: StrategyMode;
}) {
  const W = 240; const H = 220;
  const CX = W / 2; const CY = H / 2;
  const PAD = 28;

  // Dot position: levelScore (-1 to +1) → X, directionScore → Y (inverted)
  const raw_x = levelScore ?? 0;
  const raw_y = directionScore ?? 0;
  const dotX = CX + raw_x * (CX - PAD - 10);
  const dotY = CY - raw_y * (CY - PAD - 10);

  // For enhanced mode: probability-weighted centroid
  const eX = probs
    ? CX + (((probs.Expansion + probs.Recovery) - (probs.Slowdown + probs.Contraction)) === 0 ? 0
        : ((probs.Expansion - probs.Slowdown) * 0.6 + (probs.Recovery - probs.Contraction) * 0.6) * (CX - PAD - 10) / 1.2)
    : dotX;

  const quadrants: { label: RegimeLabel; x: number; y: number }[] = [
    { label: "Recovery",    x: CX / 2, y: CY / 2 },
    { label: "Expansion",   x: CX + CX / 2, y: CY / 2 },
    { label: "Contraction", x: CX / 2, y: CY + CY / 2 },
    { label: "Slowdown",    x: CX + CX / 2, y: CY + CY / 2 },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[260px] mx-auto">
      {/* Quadrant fills */}
      <rect x={0}  y={0}  width={CX} height={CY} fill="#f0f4ff" opacity={0.7} />
      <rect x={CX} y={0}  width={CX} height={CY} fill="#f0faf4" opacity={0.7} />
      <rect x={0}  y={CY} width={CX} height={CY} fill="#fff5f4" opacity={0.7} />
      <rect x={CX} y={CY} width={CX} height={CY} fill="#fffbf0" opacity={0.7} />

      {/* Dividers */}
      <line x1={CX} y1={PAD} x2={CX} y2={H - PAD} stroke={BORDER} strokeWidth={1} />
      <line x1={PAD} y1={CY} x2={W - PAD} y2={CY} stroke={BORDER} strokeWidth={1} />

      {/* Quadrant labels */}
      {quadrants.map(q => {
        const c = REGIME_COLORS[q.label];
        const isActive = regime === q.label;
        const prob = probs ? probs[q.label] : null;
        return (
          <g key={q.label}>
            <text x={q.x} y={q.y - 4} textAnchor="middle" fontSize={8}
              fontWeight={isActive ? "700" : "500"}
              fill={isActive ? c.text : "#aaa"}
              letterSpacing="0.08em">
              {q.label.toUpperCase()}
            </text>
            {prob != null && (
              <text x={q.x} y={q.y + 10} textAnchor="middle" fontSize={9.5}
                fontWeight="600" fill={c.text} opacity={0.85}>
                {Math.round(prob * 100)}%
              </text>
            )}
          </g>
        );
      })}

      {/* Axis labels */}
      <text x={PAD} y={CY - 4} textAnchor="middle" fontSize={7} fill="#bbb" letterSpacing="0.06em">BELOW</text>
      <text x={W - PAD} y={CY - 4} textAnchor="middle" fontSize={7} fill="#bbb" letterSpacing="0.06em">ABOVE</text>
      <text x={CX} y={PAD - 6} textAnchor="middle" fontSize={7} fill="#bbb" letterSpacing="0.06em">ACCEL.</text>
      <text x={CX} y={H - PAD + 12} textAnchor="middle" fontSize={7} fill="#bbb" letterSpacing="0.06em">DECEL.</text>

      {/* Enhanced mode: probability halo for each quadrant */}
      {mode === "enhanced" && probs && quadrants.map(q => {
        const p = probs[q.label];
        const c = REGIME_COLORS[q.label];
        return p > 0.15 ? (
          <circle key={`h-${q.label}`} cx={q.x} cy={q.y + 3} r={p * 35}
            fill={c.dot} opacity={0.10} />
        ) : null;
      })}

      {/* Current position dot */}
      {regime && (
        <>
          <circle cx={dotX} cy={dotY} r={10}
            fill={REGIME_COLORS[regime].dot} opacity={0.15} />
          <circle cx={dotX} cy={dotY} r={5}
            fill={REGIME_COLORS[regime].dot} opacity={0.9} />
        </>
      )}

      {/* Zero reference crosshair ticks */}
      <line x1={CX - 4} y1={CY} x2={CX + 4} y2={CY} stroke="#bbb" strokeWidth={1} />
      <line x1={CX} y1={CY - 4} x2={CX} y2={CY + 4} stroke="#bbb" strokeWidth={1} />
    </svg>
  );
}

// ── Factor exposure bars ──────────────────────────────────────────────────────
function FactorBar({
  target, mode,
}: {
  target: FactorTarget;
  mode: StrategyMode;
}) {
  const active = mode === "enhanced" ? target.enhancedActive : target.baselineActive;
  const SCALE  = 1;  // -1 to +1 → 0 to 100% in each direction
  const pct    = Math.abs(active / SCALE) * 50;
  const isPos  = active >= 0;
  const color  = isPos ? POSITIVE : NEGATIVE;
  const label  = FACTOR_LABELS[target.factor];

  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#f1eee8] last:border-0">
      <span className="w-[88px] text-[11.5px] font-semibold text-[#333] shrink-0">
        {target.factor === "LowVolatility" ? "Low Volatility" : target.factor}
      </span>
      {/* Bar: centered at 50% */}
      <div className="flex-1 relative h-[6px] bg-[#eee9df]">
        <div
          className="absolute top-0 h-full"
          style={{
            width:  `${pct}%`,
            left:   isPos ? "50%" : `${50 - pct}%`,
            backgroundColor: color,
          }}
        />
        <div className="absolute top-0 left-1/2 w-px h-full bg-[#ccc]" />
      </div>
      <span className="w-10 text-right text-[11.5px] font-bold tabular-nums" style={{ color }}>
        {active >= 0 ? "+" : ""}{active.toFixed(2)}
      </span>
      {mode === "enhanced" && Math.abs(target.baselineActive - target.enhancedActive) > 0.05 && (
        <span className="text-[9.5px] text-[#999] w-14 text-right tabular-nums">
          base {target.baselineActive >= 0 ? "+" : ""}{target.baselineActive.toFixed(1)}
        </span>
      )}
    </div>
  );
}

// ── Signal history chart ──────────────────────────────────────────────────────
function SignalChart({ history }: { history: { date: string; growth: number; riskAppetite: number; regime: RegimeLabel | null }[] }) {
  const fmtDate = (s: string) => {
    if (!s || s.length < 7) return "";
    const [, m] = s.split("-");
    return `'${s.slice(2, 4)} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m) - 1]}`;
  };

  // Detect regime bands for background
  const bands: { x1: string; x2: string; regime: RegimeLabel }[] = [];
  let bandStart: string | null = null;
  let bandRegime: RegimeLabel | null = null;
  history.forEach((p, i) => {
    if (p.regime !== bandRegime) {
      if (bandRegime && bandStart) bands.push({ x1: bandStart, x2: p.date, regime: bandRegime });
      bandStart = p.date;
      bandRegime = p.regime;
    }
    if (i === history.length - 1 && bandRegime && bandStart) {
      bands.push({ x1: bandStart, x2: p.date, regime: bandRegime });
    }
  });

  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke="#eee9df" vertical={false} />
          {/* Regime background bands */}
          {bands.map((b, i) => (
            <ReferenceArea key={i} x1={b.x1} x2={b.x2}
              fill={REGIME_COLORS[b.regime].dot} fillOpacity={0.06} />
          ))}
          <ReferenceLine y={0} stroke="#bbb" strokeDasharray="3 3" strokeWidth={1} />
          <XAxis dataKey="date" axisLine={false} tickLine={false}
            tick={{ fontSize: 10, fill: "#999" }}
            interval="preserveStartEnd" tickFormatter={fmtDate} />
          <YAxis axisLine={false} tickLine={false}
            tick={{ fontSize: 10, fill: "#999" }}
            tickFormatter={v => Number(v).toFixed(1)}
            domain={[-2, 2]} />
          <Tooltip
            contentStyle={{ border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 11, background: "white" }}
            formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(2)}σ`, String(name)]}
            labelFormatter={(l: unknown) => String(l)}
          />
          <Line type="monotone" dataKey="growth" name="Growth Composite"
            stroke={NAVY} strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="riskAppetite" name="Risk Appetite"
            stroke={POSITIVE} strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Indicator table row (Regime Engine tab) ───────────────────────────────────
function IndicatorRow({
  ind, reading, onWeightChange, onToggle,
}: {
  ind: IndicatorConfig;
  reading: { zscore: number | null; latestValue: number | null; latestDate: string; contribution: number | null } | null;
  onWeightChange: (id: string, w: number) => void;
  onToggle: (id: string) => void;
}) {
  const z = reading?.zscore;
  const zColor = z == null ? "#bbb" : z > 0.5 ? POSITIVE : z < -0.5 ? NEGATIVE : AMBER;

  return (
    <tr className={`border-b border-[#f1eee8] last:border-0 ${!ind.enabled ? "opacity-40" : ""}`}>
      <td className="py-2 pr-3 text-[11px] font-semibold text-[#0a0a0a] w-44">{ind.name}</td>
      <td className="py-2 pr-3 text-[10px] text-[#777] w-20 tabular-nums font-mono">{ind.fredSeries}</td>
      <td className="py-2 pr-3 text-[10px] text-[#999] w-16">{ind.frequency}</td>
      <td className="py-2 pr-3 text-[10px] text-[#999] w-14">
        {ind.direction === 1 ? "→" : "← inv."}
      </td>
      <td className="py-2 pr-3 text-[11px] tabular-nums w-20">
        {reading?.latestValue != null ? reading.latestValue.toFixed(2) : "—"}
      </td>
      <td className="py-2 pr-3 w-14">
        {z != null ? (
          <span className="text-[11.5px] font-bold tabular-nums" style={{ color: zColor }}>
            {z >= 0 ? "+" : ""}{z.toFixed(2)}σ
          </span>
        ) : (
          <span className="text-[10px] text-[#bbb]">—</span>
        )}
      </td>
      <td className="py-2 pr-3 w-16">
        {reading?.contribution != null ? (
          <span className="text-[10.5px] tabular-nums" style={{ color: reading.contribution >= 0 ? POSITIVE : NEGATIVE }}>
            {reading.contribution >= 0 ? "+" : ""}{reading.contribution.toFixed(2)}
          </span>
        ) : "—"}
      </td>
      <td className="py-2 pr-2 w-24">
        <div className="flex items-center gap-1.5">
          <input
            type="range" min={0} max={0.3} step={0.01} value={ind.weight}
            onChange={e => onWeightChange(ind.id, parseFloat(e.target.value))}
            className="w-14 accent-[#0c1b38]"
            disabled={!ind.enabled}
          />
          <span className="text-[10px] tabular-nums text-[#999] w-6">{(ind.weight * 100).toFixed(0)}%</span>
        </div>
      </td>
      <td className="py-2 pl-1 w-8">
        <button
          onClick={() => onToggle(ind.id)}
          className={`w-4 h-4 border rounded-sm flex items-center justify-center text-[9px] font-bold transition-colors ${ind.enabled ? "bg-[#0c1b38] border-[#0c1b38] text-white" : "border-[#ccc] text-[#ccc]"}`}
        >
          {ind.enabled ? "✓" : ""}
        </button>
      </td>
    </tr>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
export default function StrategyLabPage() {
  const [activeTab,   setActiveTab]   = useState<Tab>("Overview");
  const [mode,        setMode]        = useState<StrategyMode>("original");
  const [regimeData,  setRegimeData]  = useState<RegimeData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // Editable indicator weights (user can adjust in Regime Engine tab)
  const [growthInds,  setGrowthInds]  = useState<IndicatorConfig[]>(DEFAULT_GROWTH_INDICATORS);
  const [riskInds,    setRiskInds]    = useState<IndicatorConfig[]>(DEFAULT_RISK_INDICATORS);

  // Factor model — editable component weights
  const [factorDefs, setFactorDefs]  = useState<FactorDefinition[]>(FACTOR_DEFINITIONS);

  // Baseline allocation editor (visible in Factor Model tab)
  const [allocation, setAllocation]  = useState<Record<RegimeLabel, Record<FactorName, 0 | 1 | 2>>>(
    JSON.parse(JSON.stringify(PUBLISHED_BASELINE)) // deep clone
  );

  // ── Portfolio state (localStorage-persisted) ──────────────────────────────
  const [holdings,       setHoldings]       = useState<PortfolioPosition[]>(DEFAULT_PORTFOLIO);
  const [factorScores,   setFactorScores]   = useState<FactorScoreResult[] | null>(null);
  const [portExposures,  setPortExposures]  = useState<PortfolioExposure[] | null>(null);
  const [computingScores,setComputingScores]= useState(false);
  const [scoreError,     setScoreError]     = useState<string | null>(null);
  const [scoreTimestamp, setScoreTimestamp] = useState<string | null>(null);
  // Inline edit state for portfolio table
  const [editingIdx,     setEditingIdx]     = useState<number | null>(null);
  const [newTicker,      setNewTicker]      = useState("");
  const [newWeight,      setNewWeight]      = useState("");

  // ── Backtest state ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [backtestData,      setBacktestData]      = useState<any | null>(null);
  const [backtestLoading,   setBacktestLoading]   = useState(false);
  const [backtestError,     setBacktestError]      = useState<string | null>(null);
  const [lastBacktestAlloc, setLastBacktestAlloc] = useState<string | null>(null);

  // ── Universe screener + optimizer state ────────────────────────────────────
  const [universeScores,       setUniverseScores]       = useState<FactorScoreResult[] | null>(null);
  const [universeLoading,      setUniverseLoading]      = useState(false);
  const [universeSectorFilter, setUniverseSectorFilter] = useState<string>("All");
  const [universeSortBy,       setUniverseSortBy]       = useState<string>("regime");
  const [suggestedWeights,     setSuggestedWeights]     = useState<Record<string, number> | null>(null);

  // Load portfolio from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sl_portfolio");
      if (saved) setHoldings(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Persist portfolio to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem("sl_portfolio", JSON.stringify(holdings)); } catch { /* ignore */ }
  }, [holdings]);

  const fetchRegimeData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/strategy-lab/regime-data");
      if (!r.ok) throw new Error(`API ${r.status}`);
      const d: RegimeData = await r.json();
      setRegimeData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load regime data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRegimeData(); }, [fetchRegimeData]);

  const fetchBacktest = useCallback(async (alloc?: typeof allocation) => {
    const currentAlloc = alloc ?? allocation;
    setBacktestLoading(true);
    setBacktestError(null);
    try {
      const r = await fetch("/api/strategy-lab/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocation: currentAlloc }),
      });
      if (!r.ok) throw new Error(`API ${r.status}`);
      setBacktestData(await r.json());
      setLastBacktestAlloc(JSON.stringify(currentAlloc));
    } catch (e) {
      setBacktestError(e instanceof Error ? e.message : "Failed to load backtest");
    } finally {
      setBacktestLoading(false);
    }
  }, [allocation]);

  useEffect(() => {
    if (activeTab === "Backtest" && !backtestData && !backtestLoading) {
      fetchBacktest(allocation);
    }
  }, [activeTab, backtestData, backtestLoading, fetchBacktest, allocation]);

  const fetchUniverseScores = useCallback(async () => {
    setUniverseLoading(true);
    try {
      const r = await fetch("/api/strategy-lab/universe-scores");
      if (!r.ok) return;
      const d = await r.json();
      setUniverseScores(d.scores ?? null);
    } catch { /* silently ignore */ }
    finally { setUniverseLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "Factor Model" && !universeScores && !universeLoading) {
      fetchUniverseScores();
    }
  }, [activeTab, universeScores, universeLoading, fetchUniverseScores]);

  // Derived values — recomputed when user edits indicator weights
  const factorTargets = useMemo<FactorTarget[]>(() => {
    const probs    = regimeData?.probabilities ?? null;
    const regime   = regimeData?.regime ?? null;
    return computeFactorTargets(probs, regime, mode);
  }, [regimeData, mode]);

  const currentRegime    = regimeData?.regime ?? null;
  const probs            = regimeData?.probabilities ?? null;
  const confidence       = regimeData?.confidence ?? null;
  const levelScore       = regimeData?.growthLevelScore ?? null;
  const directionScore   = regimeData?.growthDirectionScore ?? null;
  const history          = regimeData?.history ?? [];
  const indicators       = regimeData?.indicators ?? [];
  const isDemo           = regimeData?.isDemo ?? true;
  const asOf             = regimeData?.asOf ?? "—";

  // Handler: update indicator weight
  const updateGrowthWeight = useCallback((id: string, w: number) => {
    setGrowthInds(prev => prev.map(ind => ind.id === id ? { ...ind, weight: w } : ind));
  }, []);
  const toggleGrowthInd = useCallback((id: string) => {
    setGrowthInds(prev => prev.map(ind => ind.id === id ? { ...ind, enabled: !ind.enabled } : ind));
  }, []);

  // Handler: allocation table edit
  const updateAllocation = useCallback((
    regime: RegimeLabel, factor: FactorName, val: 0 | 1 | 2
  ) => {
    setAllocation(prev => ({
      ...prev,
      [regime]: { ...prev[regime], [factor]: val },
    }));
  }, []);

  // Reset allocation to published baseline
  const resetAllocation = useCallback(() => {
    setAllocation(JSON.parse(JSON.stringify(PUBLISHED_BASELINE)));
  }, []);

  // ── Portfolio analysis ────────────────────────────────────────────────────
  const analyzePortfolio = useCallback(async () => {
    setComputingScores(true);
    setScoreError(null);
    try {
      const r = await fetch("/api/strategy-lab/factor-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings }),
      });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      const data = await r.json();
      setFactorScores(data.scores);
      const targets = computeFactorTargets(
        regimeData?.probabilities ?? null,
        regimeData?.regime ?? null,
        mode,
      );
      const exposures: PortfolioExposure[] = (data.portfolioExposures as PortfolioExposure[]).map(e => {
        const t = targets.find(ft => ft.factor === e.factor);
        const regimeTarget = t ? (mode === "enhanced" ? t.enhancedActive : t.baselineActive) : 0;
        const gap = e.portfolioExposure != null ? regimeTarget - e.portfolioExposure : null;
        return { ...e, regimeTarget, gap };
      });
      setPortExposures(exposures);
      setScoreTimestamp(new Date().toLocaleTimeString());
      // Scroll to results after DOM commits
      setTimeout(() => {
        const el = document.querySelector("[data-factor-scores-anchor]");
        if (el) {
          window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "instant" });
        }
      }, 300);
    } catch (e) {
      setScoreError(e instanceof Error ? e.message : "Failed to compute scores");
    } finally {
      setComputingScores(false);
    }
  }, [holdings, regimeData, mode]);

  // Portfolio editing helpers
  const updateHoldingWeight = useCallback((idx: number, w: number) => {
    setHoldings(prev => prev.map((h, i) => i === idx ? { ...h, weight: w } : h));
  }, []);
  const removeHolding = useCallback((idx: number) => {
    setHoldings(prev => prev.filter((_, i) => i !== idx));
    setFactorScores(null); setPortExposures(null);
  }, []);
  const addHolding = useCallback(() => {
    const t = newTicker.trim().toUpperCase();
    const w = parseFloat(newWeight) / 100;
    if (!t || isNaN(w) || w <= 0) return;
    setHoldings(prev => [...prev, { ticker: t, weight: w, name: t }]);
    setNewTicker(""); setNewWeight("");
    setFactorScores(null); setPortExposures(null);
  }, [newTicker, newWeight]);
  const resetPortfolio = useCallback(() => {
    setHoldings(DEFAULT_PORTFOLIO);
    setFactorScores(null); setPortExposures(null);
  }, []);

  // ── Optimizer: regime-weighted softmax weights with 15% cap ──────────────
  const optimizeWeights = useCallback(() => {
    if (!factorScores || !currentRegime) return;
    const equityHoldings = holdings.filter(
      h => h.ticker !== "USD" && !h.ticker.includes("Crncy") && !h.name?.toLowerCase().includes("cash")
    );
    const equityBudget = equityHoldings.reduce((s, h) => s + h.weight, 0);
    type FKey = "Momentum" | "LowVolatility" | "Value" | "Quality" | "Size";
    const FACTOR_KEYS: FKey[] = ["Momentum", "LowVolatility", "Value", "Quality", "Size"];
    // Factor weights: allocation 0=avoid→-1, 1=neutral→0, 2=overweight→+1
    const factorWts = FACTOR_KEYS.reduce((acc, f) => {
      acc[f] = (allocation[currentRegime][f] - 1) as -1 | 0 | 1;
      return acc;
    }, {} as Record<FKey, number>);
    // Regime-weighted composite score per holding
    const scored = equityHoldings.map(h => {
      const fs = factorScores.find(s => s.ticker === h.ticker);
      if (!fs) return { ticker: h.ticker, score: 0 };
      const zMap: Record<FKey, number | null> = {
        Momentum: fs.zMomentum, LowVolatility: fs.zLowVol,
        Value: fs.zValue, Quality: fs.zQuality, Size: fs.zSize,
      };
      let sum = 0; let wsum = 0;
      FACTOR_KEYS.forEach(f => {
        const w = factorWts[f]; const z = zMap[f];
        if (z != null && w !== 0) { sum += w * z; wsum += Math.abs(w); }
      });
      return { ticker: h.ticker, score: wsum > 0 ? sum / wsum : 0 };
    });
    // Softmax temperature 0.5
    const T = 0.5;
    const maxS = Math.max(...scored.map(s => s.score));
    const exps = scored.map(s => ({ ticker: s.ticker, e: Math.exp((s.score - maxS) / T) }));
    const expSum = exps.reduce((a, x) => a + x.e, 0);
    let wts = exps.map(x => ({ ticker: x.ticker, w: (x.e / expSum) * equityBudget }));
    // Cap at 15%, redistribute excess iteratively
    const MAX_W = 0.15;
    for (let i = 0; i < 8; i++) {
      const totalExcess = wts.reduce((s, x) => x.w > MAX_W ? s + x.w - MAX_W : s, 0);
      if (totalExcess < 0.0005) break;
      const belowSum = wts.reduce((s, x) => x.w < MAX_W ? s + x.w : s, 0);
      wts = wts.map(x =>
        x.w >= MAX_W ? { ...x, w: MAX_W } : { ...x, w: x.w + (belowSum > 0 ? (x.w / belowSum) * totalExcess : 0) }
      );
    }
    const result: Record<string, number> = {};
    wts.forEach(x => { result[x.ticker] = Math.round(x.w * 1000) / 1000; });
    setSuggestedWeights(result);
  }, [factorScores, currentRegime, holdings, allocation]);

  const applyOptimizedWeights = useCallback(() => {
    if (!suggestedWeights) return;
    setHoldings(prev => prev.map(h =>
      suggestedWeights[h.ticker] != null ? { ...h, weight: suggestedWeights[h.ticker] } : h
    ));
    setSuggestedWeights(null);
    setFactorScores(null);
    setPortExposures(null);
  }, [suggestedWeights]);

  const exportCSV = useCallback(() => {
    const rows = [
      "Ticker,Name,Weight%",
      ...holdings.map(h => `${h.ticker},"${h.name ?? h.ticker}",${(h.weight * 100).toFixed(2)}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "portfolio.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }, [holdings]);

  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);

  // Regime-scored + filtered + sorted universe list for screener
  type ScoredUniverse = FactorScoreResult & { regimeScore: number };
  const filteredUniverseScores = useMemo<ScoredUniverse[]>(() => {
    if (!universeScores) return [];
    type FKey = "Momentum" | "LowVolatility" | "Value" | "Quality" | "Size";
    const FACTOR_KEYS: FKey[] = ["Momentum", "LowVolatility", "Value", "Quality", "Size"];
    const factorWts = FACTOR_KEYS.reduce((acc, f) => {
      acc[f] = currentRegime ? (allocation[currentRegime][f] - 1) : 0;
      return acc;
    }, {} as Record<FKey, number>);
    const withRegime = universeScores.map(s => {
      const zMap: Record<FKey, number | null> = {
        Momentum: s.zMomentum, LowVolatility: s.zLowVol,
        Value: s.zValue, Quality: s.zQuality, Size: s.zSize,
      };
      let sum = 0; let wsum = 0;
      FACTOR_KEYS.forEach(f => {
        const w = factorWts[f]; const z = zMap[f];
        if (z != null && w !== 0) { sum += w * z; wsum += Math.abs(w); }
      });
      const regimeScore = wsum > 0 ? sum / wsum : s.compositeScore;
      return { ...s, regimeScore };
    });
    const filtered = universeSectorFilter === "All"
      ? withRegime
      : withRegime.filter(s => s.sector === universeSectorFilter);
    return [...filtered].sort((a, b) => {
      switch (universeSortBy) {
        case "momentum": return (b.zMomentum ?? -99) - (a.zMomentum ?? -99);
        case "quality":  return (b.zQuality  ?? -99) - (a.zQuality  ?? -99);
        case "value":    return (b.zValue     ?? -99) - (a.zValue    ?? -99);
        case "lowvol":   return (b.zLowVol    ?? -99) - (a.zLowVol   ?? -99);
        case "size":     return (b.zSize      ?? -99) - (a.zSize     ?? -99);
        default:         return b.regimeScore - a.regimeScore;
      }
    });
  }, [universeScores, universeSectorFilter, universeSortBy, currentRegime, allocation]);

  const regimeColors = currentRegime ? REGIME_COLORS[currentRegime] : null;
  const prevRegime   = history.length >= 2 ? history[history.length - 2].regime : null;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <AppShell>
      <main className="pb-20">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="-mx-10 -mt-10 mb-0 bg-[#0c1b38] px-10 py-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">CrossAsset</p>
                <span className="text-white/20">·</span>
                <ResearchBadge />
                {isDemo && <DemoBadge />}
              </div>
              <h1 className="text-[26px] font-semibold tracking-tight text-white leading-none"
                style={{ fontFamily: "var(--font-serif)" }}>
                Dynamic Factor Lab
              </h1>
              <p className="mt-1.5 text-[11.5px] text-white/45 tracking-wide">
                Macro regime → factor targets → security weights
              </p>
            </div>
            <div className="flex items-center gap-4 mt-1">
              {/* Mode toggle */}
              <div className="flex border border-white/20 overflow-hidden">
                {(["original", "enhanced"] as StrategyMode[]).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                      mode === m ? "bg-white text-[#0c1b38]" : "bg-transparent text-white/55 hover:text-white/80"
                    }`}>
                    {m === "original" ? "Published Baseline" : "CrossAsset Enhanced"}
                  </button>
                ))}
              </div>
              <button
                onClick={fetchRegimeData}
                disabled={loading}
                className="flex items-center gap-2 border border-white/20 bg-white/[0.08] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/75 hover:bg-white/15 transition-all disabled:opacity-40"
              >
                <span className={loading ? "inline-block animate-spin" : ""}>↻</span>
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          {/* Data status row */}
          <div className="mt-4 flex items-center gap-5">
            <span className="text-[10px] text-white/35">{today}</span>
            <span className="text-white/15">·</span>
            <span className="text-[10px] text-white/35">Data as of {asOf}</span>
            <span className="text-white/15">·</span>
            <span className={`flex items-center gap-1.5 text-[10px] font-semibold ${isDemo ? "text-amber-400" : "text-emerald-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isDemo ? "bg-amber-400" : "bg-emerald-400"}`} />
              {isDemo ? "Demo mode — configure FRED_API_KEY for live data" : "FRED connected"}
            </span>
          </div>
        </div>

        {/* ── Sub-navigation tabs ───────────────────────────────────────── */}
        <div className="-mx-10 mb-8 border-b border-[#e8e3da] bg-[#fbfaf7] px-10">
          <div className="flex gap-0">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-3.5 text-[10.5px] font-bold uppercase tracking-[0.16em] border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? "border-[#0c1b38] text-[#0c1b38]"
                    : "border-transparent text-[#999] hover:text-[#555]"
                }`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 border border-[#f5c6c0] bg-[#fff5f4] px-4 py-3 text-[11.5px] text-[#b42318]">
            {error} — using demo data.
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB: OVERVIEW                                                        */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === "Overview" && (
          <div className="space-y-5">

            {/* Row 1: Regime panel | Signal chart | Factor targets */}
            <div className="grid grid-cols-[280px_1fr_280px] gap-5">

              {/* Regime panel */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel>Current Regime</SectionLabel>
                  {confidence != null && (
                    <span className="text-[10px] font-bold tabular-nums" style={{
                      color: confidence >= 70 ? POSITIVE : confidence >= 50 ? AMBER : NEGATIVE
                    }}>
                      {confidence}% confident
                    </span>
                  )}
                </div>

                {/* Regime label */}
                {currentRegime && regimeColors ? (
                  <div className="mb-4 border px-3 py-2.5 text-center"
                    style={{ borderColor: regimeColors.border, backgroundColor: regimeColors.bg }}>
                    <p className="text-[18px] font-bold tracking-wide" style={{ color: regimeColors.text }}>
                      {currentRegime.toUpperCase()}
                    </p>
                    <p className="text-[10px] font-semibold mt-0.5" style={{ color: regimeColors.text, opacity: 0.7 }}>
                      {regimeData?.growthLevel === "above" ? "Above" : "Below"} trend ·{" "}
                      {regimeData?.growthDirection === "accelerating" ? "Accelerating" : "Decelerating"}
                    </p>
                  </div>
                ) : (
                  <div className="mb-4 border border-[#eee9df] px-3 py-2.5 text-center bg-[#fbfaf7]">
                    <p className="text-[14px] text-[#bbb]">{loading ? "Loading…" : "—"}</p>
                  </div>
                )}

                {/* 4-quadrant diagram */}
                <div className="mb-4">
                  <RegimeQuadrant
                    regime={currentRegime}
                    probs={mode === "enhanced" ? probs : null}
                    levelScore={levelScore}
                    directionScore={directionScore}
                    mode={mode}
                  />
                </div>

                {/* Probabilities (enhanced mode) */}
                {mode === "enhanced" && probs && (
                  <div className="space-y-1.5 border-t border-[#eee9df] pt-3">
                    <MiniLabel>Regime Probabilities</MiniLabel>
                    {(["Expansion", "Slowdown", "Recovery", "Contraction"] as RegimeLabel[]).map(r => {
                      const p  = probs[r];
                      const c  = REGIME_COLORS[r];
                      return (
                        <div key={r} className="flex items-center gap-2">
                          <span className="text-[10.5px] text-[#555] w-20 shrink-0">{r}</span>
                          <div className="flex-1 h-[4px] bg-[#eee9df]">
                            <div className="h-full" style={{ width: `${p * 100}%`, backgroundColor: c.dot }} />
                          </div>
                          <span className="text-[10.5px] font-bold tabular-nums w-8 text-right" style={{ color: c.dot }}>
                            {Math.round(p * 100)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Previous regime */}
                {prevRegime && prevRegime !== currentRegime && (
                  <p className="mt-3 text-[10px] text-[#999] border-t border-[#eee9df] pt-3">
                    Previous: <span className="font-semibold">{prevRegime}</span>
                  </p>
                )}
              </Card>

              {/* Signal history chart */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel>Composite Signal History</SectionLabel>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-[9.5px] text-[#999]">
                      <span className="w-4 h-0.5 bg-[#0c1b38] inline-block" /> Growth
                    </span>
                    <span className="flex items-center gap-1.5 text-[9.5px] text-[#999]">
                      <span className="w-4 h-0.5 bg-[#147a4f] inline-block border-dashed border-t border-[#147a4f]" style={{ borderTopStyle: "dashed" }} /> Risk Appetite
                    </span>
                    {isDemo && <DemoBadge />}
                  </div>
                </div>
                <SignalChart history={history} />
                <div className="mt-3 border-t border-[#eee9df] pt-3">
                  <p className="text-[10px] text-[#bbb] leading-relaxed">
                    Growth composite: weighted z-score of {growthInds.filter(i => i.enabled).length} macro indicators.
                    Background shading = classified regime. Zero line = long-run trend.
                    {isDemo ? " Illustrative demo data shown." : " 24-month history from FRED."}
                  </p>
                </div>

                {/* Regime explanation */}
                {regimeData?.explanation && (
                  <div className="mt-3 border border-[#eee9df] bg-[#fbfaf7] px-4 py-3">
                    <MiniLabel>Why this regime?</MiniLabel>
                    <p className="mt-1.5 text-[11.5px] text-[#333] leading-relaxed">
                      {regimeData.explanation}
                    </p>
                  </div>
                )}

                {/* Calculation walkthrough */}
                {regimeData && (
                  <details className="mt-3 border border-[#eee9df]" open={isDemo}>
                    <summary className="px-4 py-3 cursor-pointer text-[10px] font-bold uppercase tracking-[0.14em] text-[#0c1b38] flex items-center justify-between select-none hover:bg-[#fbfaf7] [&::-webkit-details-marker]:hidden">
                      <span>Step-by-Step Calculation</span>
                      <span className="text-[#bbb] text-[11px]">▾</span>
                    </summary>
                    <div className="px-4 pb-4 pt-3 space-y-4 border-t border-[#eee9df] bg-white">

                      {/* Step 1 */}
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#0c1b38] mb-1.5">Step 1 — Z-score each indicator</p>
                        <p className="text-[10px] text-[#999] mb-2 font-mono bg-[#f5f5f5] px-2 py-1 inline-block">zᵢ = (xᵢ − μᵢ) / σᵢ&nbsp;&nbsp;&nbsp;contribution = zᵢ × dᵢ × wᵢ</p>
                        <div className="overflow-x-auto -mx-1">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-[#eee9df] bg-[#fbfaf7]">
                                {["Indicator","Value","μ","σ","z-score","Dir.","Weight","Contribution"].map(h => (
                                  <th key={h} className="px-2 py-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#bbb] whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {indicators.filter(r => r.enabled).map(r => {
                                const z = r.zscore;
                                const c = r.contribution;
                                const zColor = z == null ? "#bbb" : z > 0.5 ? POSITIVE : z < -0.5 ? NEGATIVE : AMBER;
                                return (
                                  <tr key={r.id} className="border-b border-[#f5f2ed] last:border-0">
                                    <td className="px-2 py-1.5 text-[10px] font-medium text-[#333] whitespace-nowrap">{r.name}</td>
                                    <td className="px-2 py-1.5 text-[10px] font-mono tabular-nums text-[#555]">{r.latestValue != null ? r.latestValue.toFixed(2) : "—"}</td>
                                    <td className="px-2 py-1.5 text-[10px] font-mono tabular-nums text-[#999]">{r.mean != null ? r.mean.toFixed(2) : "—"}</td>
                                    <td className="px-2 py-1.5 text-[10px] font-mono tabular-nums text-[#999]">{r.stdDev != null ? r.stdDev.toFixed(2) : "—"}</td>
                                    <td className="px-2 py-1.5 text-[10.5px] font-bold tabular-nums font-mono" style={{ color: zColor }}>
                                      {z != null ? `${z >= 0 ? "+" : ""}${z.toFixed(2)}σ` : "—"}
                                    </td>
                                    <td className="px-2 py-1.5 text-[10px] text-[#999]">{r.direction === 1 ? "+1" : "−1"}</td>
                                    <td className="px-2 py-1.5 text-[10px] tabular-nums text-[#555]">{(r.weight * 100).toFixed(0)}%</td>
                                    <td className="px-2 py-1.5 text-[10.5px] font-bold tabular-nums font-mono" style={{ color: c == null ? "#bbb" : c >= 0 ? POSITIVE : NEGATIVE }}>
                                      {c != null ? `${c >= 0 ? "+" : ""}${c.toFixed(3)}` : "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="mt-1.5 text-[9px] text-[#bbb] italic leading-relaxed">
                          * VALUE shows the raw series level. For transformed series (3M change / YoY change), μ and σ are computed on the transformed values — the z-score uses the transformed reading, not the raw level directly.
                        </p>
                      </div>

                      {/* Step 2 */}
                      <div className="border-t border-[#eee9df] pt-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#0c1b38] mb-1.5">Step 2 — Growth Composite</p>
                        <p className="text-[10px] text-[#999] mb-2 font-mono bg-[#f5f5f5] px-2 py-1 inline-block">G = Σ(zᵢ × dᵢ × wᵢ) / Σwᵢ</p>
                        <div className="flex items-start gap-4">
                          <div className="border border-[#eee9df] bg-[#fbfaf7] px-4 py-2.5 text-center shrink-0">
                            <p className="text-[8.5px] text-[#bbb] mb-0.5">Growth Composite G</p>
                            <p className="text-[18px] font-bold tabular-nums" style={{
                              color: regimeData.growthComposite == null ? "#bbb"
                                : (regimeData.growthComposite ?? 0) >= 0.2 ? POSITIVE
                                : (regimeData.growthComposite ?? 0) <= -0.2 ? NEGATIVE : AMBER
                            }}>
                              {regimeData.growthComposite != null ? `${regimeData.growthComposite >= 0 ? "+" : ""}${regimeData.growthComposite.toFixed(2)}σ` : "—"}
                            </p>
                          </div>
                          <div className="text-[10.5px] text-[#555] space-y-1">
                            <p><span className="font-semibold">Level:</span> {regimeData.growthLevel === "above" ? "Above trend (G ≥ 0)" : regimeData.growthLevel === "below" ? "Below trend (G < 0)" : "—"}</p>
                            <p><span className="font-semibold">Direction Δ:</span> G[now] − G[3 months ago] = <span className="font-mono font-bold">{directionScore != null ? `${directionScore >= 0 ? "+" : ""}${directionScore.toFixed(2)}` : "—"}</span></p>
                            <p><span className="font-semibold">Direction:</span> {regimeData.growthDirection === "accelerating" ? "Accelerating (Δ ≥ 0)" : regimeData.growthDirection === "decelerating" ? "Decelerating (Δ < 0)" : "—"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="border-t border-[#eee9df] pt-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#0c1b38] mb-1.5">Step 3 — Regime Classification</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {([
                            { label: "Recovery",    cond: "G < 0  and  Δ ≥ 0" },
                            { label: "Expansion",   cond: "G ≥ 0  and  Δ ≥ 0" },
                            { label: "Contraction", cond: "G < 0  and  Δ < 0"  },
                            { label: "Slowdown",    cond: "G ≥ 0  and  Δ < 0"  },
                          ] as const).map(({ label, cond }) => {
                            const active = currentRegime === label;
                            const c = REGIME_COLORS[label];
                            return (
                              <div key={label}
                                className="flex items-center gap-2.5 border px-3 py-2"
                                style={active ? { borderColor: c.border, backgroundColor: c.bg } : { borderColor: "#eee9df" }}>
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: active ? c.dot : "#ddd" }} />
                                <div className="flex-1">
                                  <p className="text-[10.5px] font-bold" style={{ color: active ? c.text : "#aaa" }}>{label}</p>
                                  <p className="text-[9px] font-mono" style={{ color: active ? c.text : "#ccc" }}>{cond}</p>
                                </div>
                                {active && <span className="text-[8px] font-bold uppercase" style={{ color: c.text }}>← Now</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Step 4: Enhanced probabilities */}
                      {mode === "enhanced" && probs && (
                        <div className="border-t border-[#eee9df] pt-3">
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#0c1b38] mb-1.5">Step 4 — Regime Probabilities (Enhanced Mode)</p>
                          <p className="text-[10px] text-[#999] mb-2 font-mono bg-[#f5f5f5] px-2 py-1 inline-block">P(r) = exp(−‖s − cᵣ‖² / τ) / Σ exp(...)&nbsp;&nbsp;τ = 0.8</p>
                          <div className="grid grid-cols-4 gap-1.5 mb-2">
                            {(["Expansion","Recovery","Slowdown","Contraction"] as RegimeLabel[]).map(r => {
                              const p = probs[r];
                              const c = REGIME_COLORS[r];
                              const centroid = r === "Recovery" ? "(−0.6,+0.6)" : r === "Expansion" ? "(+0.6,+0.6)" : r === "Slowdown" ? "(+0.6,−0.6)" : "(−0.6,−0.6)";
                              return (
                                <div key={r} className="border border-[#eee9df] bg-[#fbfaf7] px-2 py-2 text-center">
                                  <p className="text-[9px] font-bold mb-0.5" style={{ color: c.text }}>{r}</p>
                                  <p className="text-[16px] font-bold tabular-nums" style={{ color: c.dot }}>{Math.round(p * 100)}%</p>
                                  <p className="text-[8px] font-mono text-[#bbb] mt-0.5">{centroid}</p>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[9.5px] text-[#bbb]">
                            Current position s = (level={levelScore?.toFixed(2) ?? "—"}, dir={directionScore?.toFixed(2) ?? "—"}) clamped to ±1.
                            Factor targets = Σ P(r) × baseline[r] − 1
                          </p>
                        </div>
                      )}

                      {isDemo && (
                        <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700">
                          Demo data shown — all values are illustrative. Configure <span className="font-mono font-bold">FRED_API_KEY</span> on Vercel for live calculations.
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </Card>

              {/* Factor targets */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel>Factor Targets</SectionLabel>
                  <span className="text-[9.5px] text-[#999]">Active vs. benchmark</span>
                </div>

                {/* Active weight scale labels */}
                <div className="flex justify-between mb-1 px-[88px]">
                  <span className="text-[8.5px] text-[#bbb]">−1</span>
                  <span className="text-[8.5px] text-[#bbb]">0</span>
                  <span className="text-[8.5px] text-[#bbb]">+1</span>
                </div>

                <div>
                  {factorTargets.map(t => (
                    <FactorBar key={t.factor} target={t} mode={mode} />
                  ))}
                </div>

                {mode === "enhanced" && (
                  <div className="mt-3 border-t border-[#eee9df] pt-3 space-y-1">
                    <MiniLabel>Enhanced decomposition</MiniLabel>
                    {factorTargets.filter(t => Math.abs(t.enhancedActive) > 0.05).slice(0, 2).map(t => (
                      <div key={t.factor} className="text-[10px] text-[#999]">
                        <span className="font-semibold text-[#555]">{t.factor === "LowVolatility" ? "LowVol" : t.factor}</span>
                        : regime {t.regimeContribution >= 0 ? "+" : ""}{t.regimeContribution.toFixed(2)}
                        {t.valuationContribution !== 0 && <> + val {t.valuationContribution >= 0 ? "+" : ""}{t.valuationContribution.toFixed(2)}</>}
                        {t.crowdingPenalty !== 0 && <> − crowd {Math.abs(t.crowdingPenalty).toFixed(2)}</>}
                        <span className="text-[#bbb] ml-1">(val/momentum/crowding: Phase 2)</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Current regime allocation reference */}
                <div className="mt-3 border-t border-[#eee9df] pt-3">
                  <MiniLabel>Published baseline ({currentRegime ?? "—"})</MiniLabel>
                  <div className="mt-1.5 grid grid-cols-5 gap-1 text-center">
                    {(["LowVolatility","Size","Value","Momentum","Quality"] as FactorName[]).map(f => {
                      const val = currentRegime ? PUBLISHED_BASELINE[currentRegime][f] : 1;
                      const color = val === 2 ? POSITIVE : val === 0 ? NEGATIVE : "#999";
                      return (
                        <div key={f} className="border border-[#eee9df] bg-[#fbfaf7] px-1 py-1.5">
                          <p className="text-[8px] font-bold text-[#bbb] mb-0.5">{FACTOR_LABELS[f].short}</p>
                          <p className="text-[13px] font-bold tabular-nums" style={{ color }}>
                            {val === 2 ? "↑↑" : val === 1 ? "→" : "↓↓"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>

            {/* Row 2: Model readiness checklist */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionLabel>Model Readiness</SectionLabel>
                <span className="text-[10px] text-[#bbb]">
                  {READINESS_GATES.filter(g => g.status === "complete").length} / {READINESS_GATES.length} gates passed
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {READINESS_GATES.map(gate => (
                  <div key={gate.id} className="border border-[#eee9df] px-3 py-3">
                    <div className="flex items-start gap-2 mb-1.5">
                      <StatusDot status={gate.status} />
                      <p className="text-[11px] font-semibold text-[#0a0a0a] leading-snug">{gate.label}</p>
                    </div>
                    <p className="text-[10px] text-[#999] leading-relaxed">{gate.note}</p>
                    <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.1em]" style={{
                      color: gate.status === "complete" ? POSITIVE : gate.status === "blocked" ? NEGATIVE : AMBER
                    }}>
                      {gate.status === "complete" ? "✓ Complete" : gate.status === "partial" ? "◐ Partial" : gate.status === "blocked" ? "✕ Blocked" : "○ Pending"}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-[#bbb]">
                Strategy must not be labeled "live" until all 8 required gates pass.
                Current status: <span className="font-semibold text-amber-600">Research workbench — Phase 1 complete.</span>
              </p>
            </Card>

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB: REGIME ENGINE                                                   */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === "Regime Engine" && (
          <div className="space-y-5">

            {/* Classification settings */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionLabel>Classification Settings</SectionLabel>
              </div>
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <MiniLabel>Classification method</MiniLabel>
                  <select className="mt-2 w-full border border-[#e8e3da] bg-white px-3 py-2 text-[11.5px] text-[#0a0a0a] focus:outline-none focus:border-[#0c1b38]">
                    <option value="hard">Hard four-quadrant (published baseline)</option>
                    <option value="probabilistic">Distance-based probabilistic (enhanced)</option>
                    <option value="hmm">Hidden Markov Model (Phase 3)</option>
                  </select>
                </div>
                <div>
                  <MiniLabel>Growth level threshold (σ)</MiniLabel>
                  <input type="number" defaultValue={0} step={0.1} min={-1} max={1}
                    className="mt-2 w-full border border-[#e8e3da] bg-white px-3 py-2 text-[11.5px] focus:outline-none focus:border-[#0c1b38]"
                  />
                  <p className="mt-1 text-[9.5px] text-[#bbb]">Composite z-score above/below this = "above/below trend"</p>
                </div>
                <div>
                  <MiniLabel>Confirmation window (months)</MiniLabel>
                  <input type="number" defaultValue={1} step={1} min={1} max={3}
                    className="mt-2 w-full border border-[#e8e3da] bg-white px-3 py-2 text-[11.5px] focus:outline-none focus:border-[#0c1b38]"
                  />
                  <p className="mt-1 text-[9.5px] text-[#bbb]">Hysteresis: regime must persist N months before rotation</p>
                </div>
              </div>

              {/* Current readings summary */}
              <div className="mt-5 grid grid-cols-4 gap-3 border-t border-[#eee9df] pt-4">
                {[
                  { label: "Growth Composite", val: regimeData?.growthComposite, sfx: "σ" },
                  { label: "Risk Appetite",    val: regimeData?.riskAppetiteComposite, sfx: "σ" },
                  { label: "Growth Level",     val: regimeData?.growthLevelScore, sfx: "σ" },
                  { label: "Direction Score",  val: regimeData?.growthDirectionScore, sfx: "" },
                ].map(({ label, val, sfx }) => (
                  <div key={label} className="border border-[#eee9df] bg-[#fbfaf7] px-4 py-3">
                    <MiniLabel>{label}</MiniLabel>
                    <p className="mt-1 text-[20px] font-bold tabular-nums" style={{
                      color: val == null ? "#bbb" : val >= 0.2 ? POSITIVE : val <= -0.2 ? NEGATIVE : "#555"
                    }}>
                      {val != null ? `${val >= 0 ? "+" : ""}${val.toFixed(2)}${sfx}` : "—"}
                    </p>
                    {isDemo && <p className="text-[8.5px] text-amber-600 mt-0.5">Demo</p>}
                  </div>
                ))}
              </div>
            </Card>

            {/* Formula reference card */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionLabel>How the Composite is Built</SectionLabel>
                {regimeData?.growthComposite != null && (
                  <span className="text-[10.5px] font-bold tabular-nums" style={{
                    color: regimeData.growthComposite >= 0.2 ? POSITIVE : regimeData.growthComposite <= -0.2 ? NEGATIVE : AMBER
                  }}>
                    Current G = {regimeData.growthComposite >= 0 ? "+" : ""}{regimeData.growthComposite.toFixed(2)}σ
                    &nbsp;·&nbsp;Δ = {directionScore != null ? `${directionScore >= 0 ? "+" : ""}${directionScore.toFixed(2)}` : "—"}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-5">
                {/* Formula box */}
                <div className="col-span-2 space-y-3">
                  <div className="border border-[#eee9df] bg-[#fbfaf7] px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#0c1b38] mb-2">Z-score</p>
                    <p className="font-mono text-[13px] text-[#333]">zᵢ = (xᵢ − μᵢ) / σᵢ</p>
                    <p className="text-[9.5px] text-[#999] mt-1">where μᵢ, σᵢ = mean and std dev over the 36-month FRED window</p>
                  </div>
                  <div className="border border-[#eee9df] bg-[#fbfaf7] px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#0c1b38] mb-2">Growth Composite</p>
                    <p className="font-mono text-[13px] text-[#333]">G = Σ (zᵢ × dᵢ × wᵢ) / Σ wᵢ</p>
                    <p className="text-[9.5px] text-[#999] mt-1">dᵢ = direction (±1) · wᵢ = indicator weight · sums only over enabled indicators</p>
                  </div>
                  <div className="border border-[#eee9df] bg-[#fbfaf7] px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#0c1b38] mb-2">Direction Score</p>
                    <p className="font-mono text-[13px] text-[#333]">Δ = G[t] − G[t−3]</p>
                    <p className="text-[9.5px] text-[#999] mt-1">3-month change in composite · positive = accelerating growth</p>
                  </div>
                  {mode === "enhanced" && (
                    <div className="border border-[#c8d0e8] bg-[#eef1f8] px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#0c1b38] mb-2">Enhanced Probabilities</p>
                      <p className="font-mono text-[12px] text-[#333]">P(r) = exp(−‖s − cᵣ‖² / τ) / Σ exp(...)  · τ = 0.8</p>
                      <p className="text-[9.5px] text-[#555] mt-1">s = (G, Δ) clamped to ±1 · centroids cᵣ at (±0.6, ±0.6)</p>
                      <p className="font-mono text-[11px] text-[#333] mt-1">Target(f) = Σᵣ P(r) × baseline[r][f] − 1</p>
                    </div>
                  )}
                </div>
                {/* Regime rules */}
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#0c1b38] mb-2">Regime Rules</p>
                  <div className="space-y-1.5">
                    {([
                      { label: "Recovery",    g: "< 0", d: "≥ 0" },
                      { label: "Expansion",   g: "≥ 0", d: "≥ 0" },
                      { label: "Slowdown",    g: "≥ 0", d: "< 0" },
                      { label: "Contraction", g: "< 0", d: "< 0" },
                    ] as const).map(({ label, g, d }) => {
                      const active = currentRegime === label;
                      const c = REGIME_COLORS[label];
                      return (
                        <div key={label}
                          className="border px-3 py-2"
                          style={active ? { borderColor: c.border, backgroundColor: c.bg } : { borderColor: "#eee9df" }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-bold" style={{ color: active ? c.text : "#555" }}>{label}</span>
                            {active && <span className="text-[8px] font-bold uppercase" style={{ color: c.text }}>← Now</span>}
                          </div>
                          <p className="font-mono text-[9px] mt-0.5" style={{ color: active ? c.text : "#bbb" }}>G{g} and Δ{d}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-[9px] text-amber-700 leading-relaxed">
                      Z-scores use 36-month in-sample window — <strong>not PIT valid</strong>. Phase 3 will anchor from 1990.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Growth composite builder */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <SectionLabel>Growth Composite Indicators</SectionLabel>
                  <p className="mt-1 text-[10.5px] text-[#bbb]">
                    Each indicator z-scored from its history, signed by direction, weighted, and summed.
                    {isDemo && " FRED_API_KEY not configured — values are illustrative."}
                  </p>
                </div>
                <span className="text-[10px] text-[#bbb]">
                  {growthInds.filter(i => i.enabled).length} active indicators
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#e8e3da] bg-[#fbfaf7]">
                      {["Indicator", "FRED Series", "Freq.", "Dir.", "Latest", "Z-score", "Contribution", "Weight", "Active"].map(h => (
                        <th key={h} className="px-0 pr-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#999]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {growthInds.map(ind => {
                      const reading = indicators.find(r => r.id === ind.id);
                      return (
                        <IndicatorRow
                          key={ind.id} ind={ind}
                          reading={reading ? {
                            zscore: reading.zscore,
                            latestValue: reading.latestValue,
                            latestDate: reading.latestDate,
                            contribution: reading.contribution,
                          } : null}
                          onWeightChange={updateGrowthWeight}
                          onToggle={toggleGrowthInd}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 border-t border-[#eee9df] pt-3 grid grid-cols-2 gap-4">
                <div className="border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-amber-700 mb-1">Data Quality Notice</p>
                  <p className="text-[10.5px] text-amber-800 leading-relaxed">
                    Z-scores are computed from the 36-month FRED window, NOT from a long historical sample (1990+).
                    This is NOT point-in-time valid. Do not use these normalized composites for quantitative backtests.
                    Full PIT validation is Phase 3.
                  </p>
                </div>
                <div className="border border-[#eee9df] bg-[#fbfaf7] px-4 py-3">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#999] mb-1">Methodology Notes</p>
                  <p className="text-[10.5px] text-[#777] leading-relaxed">
                    ISM PMI not available via free FRED; yield curve and initial claims serve as leading-indicator proxies.
                    Users may import custom series via CSV upload (Phase 2). Weekly series aggregated to monthly average.
                  </p>
                </div>
              </div>
            </Card>

            {/* Risk appetite composite */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <SectionLabel>Risk Appetite Composite</SectionLabel>
                  <p className="mt-1 text-[10.5px] text-[#bbb]">
                    Market-derived — use with caution for predicting equity-factor returns (circularity risk).
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {DEFAULT_RISK_INDICATORS.map(ind => (
                  <div key={ind.id} className="border border-[#eee9df] bg-[#fbfaf7] px-3 py-3">
                    <MiniLabel>{ind.name}</MiniLabel>
                    <p className="mt-1 text-[11px] text-[#555]">{ind.description}</p>
                    <p className="mt-2 text-[10px] text-[#bbb]">Weight: {(ind.weight * 100).toFixed(0)}%</p>
                    <p className="mt-0.5 text-[10px] text-[#bbb]">Series: {ind.fredSeries}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 border border-amber-200 bg-amber-50 px-4 py-2.5">
                <p className="text-[10.5px] text-amber-800">
                  <span className="font-bold">⚠ Circularity warning:</span> Risk appetite is derived from equity and credit market prices.
                  Using it to predict equity-factor returns creates a feedback loop. The CrossAsset Enhanced model uses it
                  only as a regime-confidence modifier, not as a primary signal.
                </p>
              </div>
            </Card>

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB: FACTOR MODEL                                                    */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === "Factor Model" && (
          <div className="space-y-5">

            {/* Published baseline allocation table */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <SectionLabel>Published Baseline Allocation</SectionLabel>
                  <p className="mt-1 text-[10.5px] text-[#bbb]">
                    FTSE Russell / Invesco Dynamic Multifactor — public methodology only.
                    Not a reproduction of proprietary signals. Scale: 0 = avoid, 1 = neutral, 2 = overweight.
                  </p>
                </div>
                <button onClick={resetAllocation}
                  className="border border-[#e8e3da] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#777] hover:border-[#0c1b38] hover:text-[#0c1b38] transition-colors">
                  Reset to Published
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#e8e3da] bg-[#fbfaf7]">
                      <th className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#777] w-32">Regime</th>
                      {(["LowVolatility","Size","Value","Momentum","Quality"] as FactorName[]).map(f => (
                        <th key={f} className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#777]"
                          style={{ color: FACTOR_LABELS[f].color }}>
                          {f === "LowVolatility" ? "Low Vol." : f}
                        </th>
                      ))}
                      {mode === "enhanced" && currentRegime && (
                        <th className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#0c1b38]">
                          Enhanced Target
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(["Recovery","Expansion","Slowdown","Contraction"] as RegimeLabel[]).map(r => {
                      const c = REGIME_COLORS[r];
                      const isActive = currentRegime === r;
                      const prob = probs ? probs[r] : null;
                      return (
                        <tr key={r}
                          className={`border-b border-[#f1eee8] last:border-0 ${isActive ? "bg-[#f5f7ff]" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.dot }} />
                              <span className="text-[12px] font-bold" style={{ color: c.text }}>{r}</span>
                              {isActive && <span className="text-[8.5px] font-bold border border-[#c8d0e8] bg-[#eef1f8] text-[#0c1b38] px-1.5 py-0.5">Current</span>}
                              {prob != null && mode === "enhanced" && (
                                <span className="text-[9px] text-[#bbb]">{Math.round(prob * 100)}%</span>
                              )}
                            </div>
                          </td>
                          {(["LowVolatility","Size","Value","Momentum","Quality"] as FactorName[]).map(f => {
                            const val = allocation[r][f];
                            const pubVal = PUBLISHED_BASELINE[r][f];
                            const changed = val !== pubVal;
                            return (
                              <td key={f} className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex gap-0.5">
                                    {([0,1,2] as const).map(v => (
                                      <button key={v} onClick={() => updateAllocation(r, f, v)}
                                        className={`w-6 h-6 text-[10px] font-bold border transition-colors ${
                                          val === v
                                            ? v === 2 ? "bg-[#147a4f] border-[#147a4f] text-white"
                                            : v === 1 ? "bg-[#0c1b38] border-[#0c1b38] text-white"
                                            : "bg-[#b42318] border-[#b42318] text-white"
                                          : "border-[#e8e3da] text-[#bbb] hover:border-[#555]"
                                        }`}>
                                        {v}
                                      </button>
                                    ))}
                                  </div>
                                  {changed && <span className="text-[8px] text-amber-600">✎</span>}
                                </div>
                              </td>
                            );
                          })}
                          {mode === "enhanced" && probs && (
                            <td className="px-4 py-3">
                              {(["LowVolatility","Size","Value","Momentum","Quality"] as FactorName[]).map(f => {
                                const t = factorTargets.find(x => x.factor === f);
                                if (!t) return null;
                                const active = t.enhancedActive;
                                return (
                                  <span key={f} className="mr-2 text-[10px] tabular-nums font-medium"
                                    style={{ color: active >= 0.1 ? POSITIVE : active <= -0.1 ? NEGATIVE : "#999" }}>
                                    {f === "LowVolatility" ? "LV" : f.slice(0, 3)}: {active >= 0 ? "+" : ""}{active.toFixed(2)}
                                  </span>
                                );
                              })}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── Universe Screener ─────────────────────────────────────── */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4 gap-4">
                <div>
                  <SectionLabel>Universe Screener</SectionLabel>
                  <p className="mt-1 text-[10.5px] text-[#bbb]">
                    Factor scores for all {universeScores ? universeScores.length : "~60"} universe stocks · cross-sectional z-scores · sorted by {currentRegime ?? "equal-weight"} regime score · click + to add to portfolio
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select value={universeSectorFilter} onChange={e => setUniverseSectorFilter(e.target.value)}
                    className="border border-[#e8e3da] bg-white px-2.5 py-1.5 text-[10px] outline-none focus:border-[#0c1b38]">
                    {["All","Technology","Communication","Consumer Disc.","Consumer Staples","Healthcare","Financials","Industrials","Energy","Materials"].map(s => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <select value={universeSortBy} onChange={e => setUniverseSortBy(e.target.value)}
                    className="border border-[#e8e3da] bg-white px-2.5 py-1.5 text-[10px] outline-none focus:border-[#0c1b38]">
                    {[["regime","Regime Score"],["momentum","Momentum"],["quality","Quality"],["value","Value"],["lowvol","Low Vol"],["size","Size"]].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <button onClick={fetchUniverseScores} disabled={universeLoading}
                    className="flex items-center gap-1.5 border border-[#e8e3da] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#777] hover:border-[#0c1b38] hover:text-[#0c1b38] transition-colors disabled:opacity-40">
                    <span className={universeLoading ? "inline-block animate-spin" : ""}>↻</span>
                    {universeLoading ? "Loading…" : "Refresh"}
                  </button>
                </div>
              </div>

              {universeLoading && (
                <div className="text-center py-8">
                  <p className="text-[11px] text-[#999]">Scoring universe (~60 stocks from Yahoo Finance)…</p>
                  <p className="text-[10px] text-[#bbb] mt-1">This takes 10–20 seconds on first load.</p>
                </div>
              )}

              {!universeScores && !universeLoading && (
                <div className="text-center py-8 border border-dashed border-[#e8e3da]">
                  <p className="text-[12px] font-semibold text-[#0c1b38] mb-2">Universe not loaded</p>
                  <p className="text-[11px] text-[#999] mb-4">Click Refresh to score all universe stocks against current regime factor weights.</p>
                  <button onClick={fetchUniverseScores}
                    className="bg-[#0c1b38] text-white px-5 py-2 text-[10.5px] font-bold uppercase tracking-[0.14em] hover:bg-[#162d5c] transition-colors">
                    Screen Universe
                  </button>
                </div>
              )}

              {filteredUniverseScores.length > 0 && (
                <div className="border border-[#eee9df] overflow-x-auto">
                  <table className="w-full text-left min-w-[820px]">
                    <thead>
                      <tr className="bg-[#fbfaf7] border-b border-[#eee9df]">
                        <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999] w-16">Ticker</th>
                        <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]">Name</th>
                        <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999] w-24">Sector</th>
                        {(["Mom","LV","Val","Qlty","Sz"] as const).map(f => (
                          <th key={f} className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999] w-16 text-center">{f}</th>
                        ))}
                        <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0c1b38] w-20 text-center">Regime</th>
                        <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999] w-10 text-center">+</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUniverseScores.map((s, rank) => {
                        const inPortfolio = holdings.some(h => h.ticker === s.ticker);
                        const zCell = (z: number | null) => {
                          if (z == null) return <td className="px-2 py-1.5 text-center"><span className="text-[9.5px] text-[#ddd]">—</span></td>;
                          const abs = Math.min(Math.abs(z) / 2, 1);
                          const bg = z > 0 ? `rgba(20,122,79,${abs * 0.15})` : `rgba(180,35,24,${abs * 0.15})`;
                          const color = z > 0 ? "#147a4f" : "#b42318";
                          return (
                            <td className="px-2 py-1.5 text-center" style={{ background: bg }}>
                              <span className="text-[10.5px] font-semibold tabular-nums" style={{ color }}>
                                {z >= 0 ? "+" : ""}{z.toFixed(1)}
                              </span>
                            </td>
                          );
                        };
                        return (
                          <tr key={s.ticker} className={`border-b border-[#f1eee8] last:border-0 hover:bg-[#fbfaf7] ${inPortfolio ? "bg-[#f5f7ff]" : ""}`}>
                            <td className="px-3 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] tabular-nums text-[#ccc] w-4">#{rank+1}</span>
                                <span className="text-[11.5px] font-bold text-[#0c1b38]">{s.ticker}</span>
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-[10.5px] text-[#555]">
                              {s.name}
                              {inPortfolio && <span className="ml-1.5 text-[8.5px] border border-[#c8d0e8] bg-[#eef1f8] text-[#0c1b38] px-1 py-0.5">IN PORTFOLIO</span>}
                            </td>
                            <td className="px-3 py-1.5 text-[9.5px] text-[#999]">{s.sector}</td>
                            {zCell(s.zMomentum)}
                            {zCell(s.zLowVol)}
                            {zCell(s.zValue)}
                            {zCell(s.zQuality)}
                            {zCell(s.zSize)}
                            <td className="px-2 py-1.5 text-center">
                              <span className={`text-[11px] font-bold tabular-nums ${s.regimeScore >= 0 ? "text-[#0c1b38]" : "text-[#b42318]"}`}>
                                {s.regimeScore >= 0 ? "+" : ""}{s.regimeScore.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {!inPortfolio ? (
                                <button
                                  onClick={() => {
                                    setHoldings(prev => [...prev.filter(h => h.ticker !== "USD"), { ticker: s.ticker, weight: 0.03, name: s.name }, ...prev.filter(h => h.ticker === "USD")]);
                                    setFactorScores(null); setPortExposures(null);
                                  }}
                                  className="w-6 h-6 border border-[#0c1b38] text-[#0c1b38] text-[11px] font-bold hover:bg-[#0c1b38] hover:text-white transition-colors"
                                  title="Add to portfolio at 3% weight">
                                  +
                                </button>
                              ) : (
                                <span className="text-[9px] text-[#c8d0e8] font-bold">✓</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {universeScores && filteredUniverseScores.length === 0 && (
                <p className="text-center py-4 text-[11px] text-[#bbb]">No stocks in sector "{universeSectorFilter}"</p>
              )}
            </Card>

            {/* ── Factor Correlation Matrix ── */}
            {universeScores && universeScores.length >= 5 && (() => {
              type ZKey = "zMomentum" | "zLowVol" | "zValue" | "zQuality" | "zSize";
              const FCOLS: { key: ZKey; label: string; color: string }[] = [
                { key: "zMomentum", label: "Mom",  color: AMBER },
                { key: "zLowVol",   label: "LVol", color: NAVY },
                { key: "zValue",    label: "Val",  color: "#2563eb" },
                { key: "zQuality",  label: "Qlty", color: POSITIVE },
                { key: "zSize",     label: "Siz",  color: "#7c3aed" },
              ];

              function pearson(xs: (number | null)[], ys: (number | null)[]): number | null {
                const pairs = xs.reduce<[number, number][]>((acc, x, i) => {
                  const y = ys[i];
                  if (x != null && y != null) acc.push([x, y]);
                  return acc;
                }, []);
                if (pairs.length < 5) return null;
                const mx = pairs.reduce((s, [a]) => s + a, 0) / pairs.length;
                const my = pairs.reduce((s, [, b]) => s + b, 0) / pairs.length;
                const num = pairs.reduce((s, [a, b]) => s + (a - mx) * (b - my), 0);
                const dx  = Math.sqrt(pairs.reduce((s, [a]) => s + (a - mx) ** 2, 0));
                const dy  = Math.sqrt(pairs.reduce((s, [, b]) => s + (b - my) ** 2, 0));
                return dx * dy > 0 ? Math.round(num / (dx * dy) * 100) / 100 : null;
              }

              function corrBg(r: number | null): string {
                if (r == null) return "#f4f1ec";
                // positive: white → #16a34a (rgb 22,163,74)
                // negative: white → #dc2626 (rgb 220,38,38)
                if (r >= 0) return `rgb(${Math.round(255 - r * 233)},${Math.round(255 - r * 92)},${Math.round(255 - r * 181)})`;
                return `rgb(255,${Math.round(255 + r * 217)},${Math.round(255 + r * 217)})`;
              }

              const matrix = FCOLS.map(f1 => FCOLS.map(f2 => {
                if (f1.key === f2.key) return 1 as const;
                return pearson(
                  universeScores.map(s => s[f1.key] as number | null),
                  universeScores.map(s => s[f2.key] as number | null),
                );
              }));

              const coveredCount = universeScores.filter(s =>
                s.zMomentum != null || s.zLowVol != null || s.zValue != null || s.zQuality != null || s.zSize != null
              ).length;

              return (
                <Card className="p-5">
                  <SectionLabel>Factor Correlation Matrix</SectionLabel>
                  <p className="mt-1 mb-4 text-[10.5px] text-[#bbb]">
                    Pairwise Pearson correlations of cross-sectional z-scores across {coveredCount} scored stocks.
                    Low inter-factor correlation improves composite diversification.
                  </p>
                  <div className="flex justify-center">
                    <table className="text-[11px] border-collapse">
                      <thead>
                        <tr>
                          <th className="w-12 pb-1" />
                          {FCOLS.map(f => (
                            <th key={f.key} className="w-14 pb-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-center" style={{ color: f.color }}>
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {FCOLS.map((f1, i) => (
                          <tr key={f1.key}>
                            <td className="pr-3 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-right whitespace-nowrap" style={{ color: f1.color }}>
                              {f1.label}
                            </td>
                            {FCOLS.map((f2, j) => {
                              const r = matrix[i][j];
                              const isDiag = i === j;
                              const bg = isDiag ? NAVY : corrBg(r === 1 ? 1 : r);
                              const textColor = isDiag ? "white" : (r != null && Math.abs(r as number) > 0.35) ? "white" : "#333";
                              return (
                                <td key={f2.key}
                                  className="w-14 h-11 text-center tabular-nums text-[11.5px] font-bold border border-[#e8e3da]"
                                  style={{ backgroundColor: bg, color: textColor }}>
                                  {isDiag ? "1.00" : r != null ? (r as number).toFixed(2) : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[9.5px] text-[#bbb] text-center">
                    Green = positive · Red = negative · Navy = diagonal · — = &lt;5 stocks with both scores
                  </p>
                </Card>
              );
            })()}

            {/* Factor definitions */}
            {factorDefs.map(def => (
              <Card key={def.factor} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <SectionLabel>
                        <span style={{ color: FACTOR_LABELS[def.factor].color }}>{def.factor === "LowVolatility" ? "Low Volatility" : def.factor}</span>
                      </SectionLabel>
                      {def.components.some(c => !c.enabled) && (
                        <span className="text-[9px] text-[#bbb]">({def.components.filter(c => c.enabled).length}/{def.components.length} components active)</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11.5px] text-[#555]">{def.description}</p>
                    <p className="mt-1 text-[10.5px] text-[#bbb] italic">{def.rationale}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {def.sectorNeutral && (
                      <span className="border border-[#c8d0e8] bg-[#eef1f8] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#0c1b38]">Sector-Neutral</span>
                    )}
                    {def.winsorize && (
                      <span className="border border-[#e8e3da] bg-[#fbfaf7] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#777]">
                        Winsorise {(def.winsorizeClip * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2.5 mt-3">
                  {def.components.map(comp => (
                    <div key={comp.id}
                      className={`border px-3 py-3 transition-opacity ${comp.enabled ? "border-[#eee9df] bg-[#fbfaf7]" : "border-[#f1eee8] bg-[#fefefe] opacity-50"}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-semibold text-[#0a0a0a]">{comp.name}</p>
                        <button
                          onClick={() => setFactorDefs(prev => prev.map(d => d.factor === def.factor
                            ? { ...d, components: d.components.map(c => c.id === comp.id ? { ...c, enabled: !c.enabled } : c) }
                            : d
                          ))}
                          className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center text-[7px] font-bold ${comp.enabled ? "bg-[#0c1b38] border-[#0c1b38] text-white" : "border-[#ccc] text-[#ccc]"}`}>
                          {comp.enabled ? "✓" : ""}
                        </button>
                      </div>
                      <p className="text-[10px] text-[#777] mb-2 leading-snug">{comp.description}</p>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <input type="range" min={0} max={0.5} step={0.05} value={comp.weight}
                          onChange={e => setFactorDefs(prev => prev.map(d => d.factor === def.factor
                            ? { ...d, components: d.components.map(c => c.id === comp.id ? { ...c, weight: parseFloat(e.target.value) } : c) }
                            : d
                          ))}
                          className="w-full accent-[#0c1b38]" disabled={!comp.enabled} />
                        <span className="text-[10px] text-[#999] w-7 shrink-0">{(comp.weight * 100).toFixed(0)}%</span>
                      </div>
                      <p className="text-[9px] text-[#bbb]">Data: {comp.dataDep}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB: PORTFOLIO BUILDER ─────────────────────────────────────────── */}
        {activeTab === "Portfolio Builder" && (
          <div className="space-y-5">

            {/* ── Holdings editor ──────────────────────────────────────────── */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <SectionLabel>Holdings</SectionLabel>
                  <span className={`text-[10px] font-bold px-2 py-0.5 border ${Math.abs(totalWeight - 1) < 0.005 ? "border-[#b8e6ce] bg-[#f0faf4] text-[#147a4f]" : "border-[#f5c6c0] bg-[#fff5f4] text-[#b42318]"}`}>
                    {(totalWeight * 100).toFixed(1)}% allocated
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportCSV}
                    className="text-[10.5px] text-[#777] border border-[#ddd] px-3 py-1.5 hover:border-[#0c1b38] hover:text-[#0c1b38] transition-colors"
                    title="Export holdings as CSV"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={resetPortfolio}
                    className="text-[10.5px] text-[#777] border border-[#ddd] px-3 py-1.5 hover:border-[#0c1b38] hover:text-[#0c1b38] transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={analyzePortfolio}
                    disabled={computingScores || Math.abs(totalWeight - 1) > 0.02}
                    className="text-[11px] font-semibold bg-[#0c1b38] text-white px-5 py-1.5 hover:bg-[#162d5c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {computingScores ? "Computing…" : "Analyze Portfolio"}
                  </button>
                </div>
              </div>

              {/* Weight allocation bar */}
              {(() => {
                const pct = totalWeight * 100;
                const diff = pct - 100;
                const ok = Math.abs(diff) < 0.5;
                const warn = !ok && Math.abs(diff) < 2;
                const barColor = ok ? POSITIVE : warn ? AMBER : NEGATIVE;
                const barPct = Math.min(pct, 105);
                return (
                  <div className="mb-4">
                    <div className="relative h-2 bg-[#eee9df] overflow-hidden mb-1">
                      <div className="absolute top-0 left-0 h-full transition-all" style={{ width: `${barPct}%`, backgroundColor: barColor }} />
                      <div className="absolute top-0 h-full w-[1px] bg-[#aaa]" style={{ left: "95.24%"  }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px]" style={{ color: barColor }}>
                        {pct.toFixed(1)}% allocated
                        {ok ? " — ready to analyze" : diff > 0 ? ` — remove ${diff.toFixed(1)}% excess` : ` — add ${Math.abs(diff).toFixed(1)}% more`}
                      </p>
                      <p className="text-[9.5px] text-[#bbb]">target: 100%</p>
                    </div>
                  </div>
                );
              })()}

              {scoreError && (
                <div className="border border-[#f5c6c0] bg-[#fff5f4] px-4 py-3 mb-4 text-[11px] text-[#b42318]">
                  {scoreError}
                </div>
              )}

              <div className="border border-[#eee9df] overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#fbfaf7] border-b border-[#eee9df]">
                      {["Ticker", "Name", "Weight %", ""].map(h => (
                        <th key={h} className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h, idx) => {
                      const isCash = h.ticker === "USD" || h.ticker.includes("Crncy") || h.name?.toLowerCase().includes("cash");
                      return (
                      <tr key={`${h.ticker}-${idx}`} className={`border-b border-[#f1eee8] last:border-0 hover:bg-[#fbfaf7] ${isCash ? "bg-[#fafaf8]" : ""}`}>
                        <td className="px-3 py-2 text-[12px] font-bold w-20" style={{ color: isCash ? "#aaa" : "#0c1b38" }}>{h.ticker}</td>
                        <td className="px-3 py-2 text-[11px]" style={{ color: isCash ? "#aaa" : "#555" }}>
                          {h.name ?? h.ticker}{isCash && <span className="ml-1.5 text-[9px] border border-[#ddd] px-1 py-0.5 text-[#bbb]">CASH</span>}
                        </td>
                        <td className="px-3 py-2 w-32">
                          {editingIdx === idx ? (
                            <input
                              autoFocus
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="100"
                              defaultValue={(h.weight * 100).toFixed(1)}
                              className="w-20 border border-[#0c1b38] px-2 py-0.5 text-[11px] tabular-nums outline-none"
                              onBlur={e => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v > 0) updateHoldingWeight(idx, v / 100);
                                setEditingIdx(null);
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") setEditingIdx(null);
                              }}
                            />
                          ) : (
                            <button
                              onClick={() => setEditingIdx(idx)}
                              className="text-[11.5px] tabular-nums text-[#0a0a0a] font-semibold hover:underline decoration-dashed"
                            >
                              {(h.weight * 100).toFixed(1)}%
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2 w-10 text-right">
                          <button
                            onClick={() => removeHolding(idx)}
                            className="text-[10px] text-[#bbb] hover:text-[#b42318] transition-colors font-bold"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add holding form */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ticker"
                  value={newTicker}
                  onChange={e => setNewTicker(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && addHolding()}
                  className="border border-[#ddd] px-3 py-1.5 text-[11px] w-24 outline-none focus:border-[#0c1b38] uppercase placeholder:normal-case placeholder:text-[#ccc]"
                />
                <input
                  type="number"
                  placeholder="Weight %"
                  value={newWeight}
                  onChange={e => setNewWeight(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addHolding()}
                  min="0.1" max="100" step="0.1"
                  className="border border-[#ddd] px-3 py-1.5 text-[11px] w-24 outline-none focus:border-[#0c1b38] tabular-nums placeholder:text-[#ccc]"
                />
                <button
                  onClick={addHolding}
                  disabled={!newTicker.trim() || !newWeight}
                  className="text-[10.5px] font-semibold text-white bg-[#0c1b38] px-4 py-1.5 hover:bg-[#162d5c] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  + Add
                </button>
              </div>

              {scoreTimestamp && (
                <p className="mt-3 text-[9.5px] text-[#bbb]">Last analyzed at {scoreTimestamp} · {factorScores?.length ?? 0} stocks scored</p>
              )}
            </Card>

            {/* ── Factor score heatmap ─────────────────────────────────────── */}
            {factorScores && factorScores.length > 0 && (
              <div data-factor-scores-anchor>
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <SectionLabel>Factor Scores</SectionLabel>
                  <span className="text-[9.5px] text-[#bbb]">cross-sectional z-scores within portfolio universe · clamped ±3σ</span>
                </div>
                <div className="border border-[#eee9df] overflow-x-auto">
                  <table className="w-full text-left min-w-[820px]">
                    <thead>
                      <tr className="bg-[#fbfaf7] border-b border-[#eee9df]">
                        <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999] w-16">Ticker</th>
                        <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]">Name</th>
                        <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999] w-14 text-right">Weight</th>
                        {(["Momentum","Low Vol","Value","Quality","Size"] as const).map(f => (
                          <th key={f} className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999] w-[88px] text-center">{f}</th>
                        ))}
                        <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0c1b38] w-20 text-center">Score</th>
                        <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999] w-14 text-center">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...factorScores]
                        .sort((a, b) => b.compositeScore - a.compositeScore)
                        .map(s => {
                          const zScoreCell = (z: number | null) => {
                            if (z == null) return <td className="px-3 py-2 text-center"><span className="text-[10px] text-[#ccc]">—</span></td>;
                            const abs = Math.abs(z);
                            const alpha = Math.min(abs / 2, 1);
                            const bg = z > 0
                              ? `rgba(20,122,79,${alpha * 0.18})`
                              : `rgba(180,35,24,${alpha * 0.18})`;
                            const color = z > 0 ? "#147a4f" : "#b42318";
                            return (
                              <td className="px-3 py-2 text-center" style={{ background: bg }}>
                                <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
                                  {z >= 0 ? "+" : ""}{z.toFixed(2)}
                                </span>
                              </td>
                            );
                          };
                          return (
                            <tr key={s.ticker} className="border-b border-[#f1eee8] last:border-0 hover:bg-[#fbfaf7]">
                              <td className="px-3 py-2 text-[11.5px] font-bold text-[#0c1b38]">{s.ticker}</td>
                              <td className="px-3 py-2 text-[11px] text-[#555]">{s.name || s.ticker}</td>
                              <td className="px-3 py-2 text-[11px] tabular-nums text-[#777] text-right">{(s.weight * 100).toFixed(1)}%</td>
                              {zScoreCell(s.zMomentum)}
                              {zScoreCell(s.zLowVol)}
                              {zScoreCell(s.zValue)}
                              {zScoreCell(s.zQuality)}
                              {zScoreCell(s.zSize)}
                              <td className="px-3 py-2 text-center">
                                <span className={`text-[12px] font-bold tabular-nums ${s.compositeScore >= 0 ? "text-[#0c1b38]" : "text-[#b42318]"}`}>
                                  {s.compositeScore >= 0 ? "+" : ""}{s.compositeScore.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className="text-[8.5px] font-bold" style={{ color: s.priceDataOk && s.fundDataOk ? "#147a4f" : s.priceDataOk ? "#b7791f" : "#b42318" }}>
                                  {s.priceDataOk && s.fundDataOk ? "FULL" : s.priceDataOk ? "PRICE" : "NONE"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[9.5px] text-[#bbb]">
                  Momentum = 0.6×12-1M + 0.4×6-1M · Low Vol = 0.5×(−σ) + 0.5×(−β) · Value = 0.35×EY + 0.35×FCF + 0.30×(−EV/EBITDA) · Quality = 0.40×ROIC + 0.35×GM + 0.25×(−leverage)
                </p>
              </Card>
              </div>
            )}

            {/* ── Portfolio factor exposures vs regime target ───────────────── */}
            {portExposures && portExposures.length > 0 && (
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <SectionLabel>Portfolio Factor Exposures</SectionLabel>
                  <span className="text-[9.5px] text-[#bbb]">weight-averaged z-score vs {mode === "enhanced" ? "enhanced" : "baseline"} regime target</span>
                </div>
                <div className="space-y-4">
                  {portExposures.map(e => {
                    const pct = e.portfolioExposure;
                    const tgt = e.regimeTarget;
                    const gap = e.gap;
                    const hasData = pct != null;
                    const barMax = 1.5;
                    const pctWidth = hasData ? Math.min(Math.abs(pct) / barMax * 100, 100) : 0;
                    const aligned = gap != null && Math.abs(gap) < 0.3;
                    const factorLabels: Record<string, string> = {
                      Momentum: "Momentum", LowVolatility: "Low Vol", Value: "Value", Quality: "Quality", Size: "Size",
                    };
                    return (
                      <div key={e.factor}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-[#0a0a0a] w-20 shrink-0">{factorLabels[e.factor] ?? e.factor}</span>
                            {!hasData ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 border border-[#ddd] bg-[#f9f9f9] text-[#bbb]">no data</span>
                            ) : (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 border whitespace-nowrap ${aligned ? "border-[#b8e6ce] bg-[#f0faf4] text-[#147a4f]" : gap! < 0 ? "border-[#f5c6c0] bg-[#fff5f4] text-[#b42318]" : "border-[#f0d89a] bg-[#fffbf0] text-[#b7791f]"}`}>
                                {aligned ? "aligned" : gap! > 0 ? `+${gap!.toFixed(2)} under` : `${gap!.toFixed(2)} over`}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-[10px] tabular-nums">
                            <span className="text-[#555]">Portfolio: <span className="font-bold text-[#0c1b38]">{hasData ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}σ` : "—"}</span></span>
                            <span className="text-[#555]">Target: <span className="font-bold" style={{ color: tgt > 0.1 ? POSITIVE : tgt < -0.1 ? NEGATIVE : "#999" }}>{tgt >= 0 ? "+" : ""}{tgt.toFixed(2)}σ</span></span>
                          </div>
                        </div>
                        <div className="relative h-5 bg-[#f5f2ed] overflow-hidden">
                          {/* Zero line */}
                          <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-[#ccc] z-10" />
                          {/* Portfolio bar — only when data available */}
                          {hasData && (
                            <div
                              className="absolute top-1 bottom-1 transition-all"
                              style={{
                                background: "#0c1b38",
                                opacity: 0.7,
                                width: `${pctWidth / 2}%`,
                                left: pct! >= 0 ? "50%" : `${50 - pctWidth / 2}%`,
                              }}
                            />
                          )}
                          {!hasData && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[9px] text-[#ccc]">requires FMP data</span>
                            </div>
                          )}
                          {/* Target marker */}
                          <div
                            className="absolute top-0.5 bottom-0.5 w-[2px] z-20"
                            style={{
                              background: tgt > 0.1 ? POSITIVE : tgt < -0.1 ? NEGATIVE : "#bbb",
                              left: `${50 + (tgt / barMax) * 50}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-[8.5px] text-[#bbb] mt-0.5">
                          <span>−1.5σ</span><span>0</span><span>+1.5σ</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-[#f1eee8] flex items-center gap-5 text-[9.5px] text-[#999]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-[#0c1b38] opacity-70 inline-block" /> Portfolio exposure</span>
                  <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-[#147a4f] inline-block" /> Regime target (overweight)</span>
                  <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-[#b42318] inline-block" /> Regime target (underweight)</span>
                </div>
              </Card>
            )}

            {/* ── Portfolio Risk Decomposition ──────────────────────────────── */}
            {factorScores && factorScores.length > 0 && (() => {
              const MARKET_VOL = 0.16; // long-run SPY annualised vol

              // Only include holdings with both beta and vol available
              const valid = factorScores.filter(
                (s): s is typeof s & { beta: number; realizedVol: number } =>
                  s.beta != null && s.realizedVol != null && s.weight > 0
              );
              if (valid.length < 2) return null;

              // Portfolio-level quantities
              const portBeta    = valid.reduce((s, r) => s + r.weight * r.beta, 0);
              const getIdioVar  = (r: typeof valid[0]) =>
                Math.max(0, r.realizedVol ** 2 - r.beta ** 2 * MARKET_VOL ** 2);
              const sysPortVar  = portBeta ** 2 * MARKET_VOL ** 2;
              const idioPortVar = valid.reduce((s, r) => s + r.weight ** 2 * getIdioVar(r), 0);
              const portVar     = sysPortVar + idioPortVar;
              const portVol     = Math.sqrt(portVar);
              if (portVol <= 0) return null;

              // Euler decomposition: RC_i = w_i × MRC_i
              // MRC_i = (β_i × β_p × σ²_m + w_i × σ²_ε,i) / σ_p
              // %RC_i = RC_i / σ_p = w_i × (β_i × β_p × σ²_m + w_i × σ²_ε,i) / σ²_p
              type RiskRow = {
                ticker: string; name: string; sector: string;
                weight: number; beta: number; vol: number;
                sys: number; idio: number; total: number;
              };
              const riskRows: RiskRow[] = valid.map(r => {
                const sys  = r.weight * r.beta * portBeta * MARKET_VOL ** 2 / portVar * 100;
                const idio = r.weight ** 2 * getIdioVar(r) / portVar * 100;
                return {
                  ticker: r.ticker, name: r.name || r.ticker, sector: r.sector || "",
                  weight: r.weight, beta: r.beta, vol: r.realizedVol,
                  sys:   Math.round(sys  * 10) / 10,
                  idio:  Math.round(idio * 10) / 10,
                  total: Math.round((sys + idio) * 10) / 10,
                };
              }).sort((a, b) => b.total - a.total);

              const sysShare  = Math.round(sysPortVar  / portVar * 100);
              const idioShare = Math.round(idioPortVar / portVar * 100);
              const coveredWt = valid.reduce((s, r) => s + r.weight, 0);
              const excluded  = factorScores.length - valid.length;

              return (
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <SectionLabel>Portfolio Risk Decomposition</SectionLabel>
                    <span className="text-[9.5px] text-[#bbb]">
                      Euler (MRC) decomposition · beta model · σ_m = 16% ann.
                    </span>
                  </div>

                  {/* ── Summary stats ── */}
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {[
                      { label: "Portfolio Beta",     val: portBeta.toFixed(2),         sub: "weighted avg β vs SPY",   color: portBeta > 1.2 ? NEGATIVE : portBeta < 0.8 ? POSITIVE : NAVY },
                      { label: "Est. Portfolio Vol", val: `${(portVol * 100).toFixed(1)}%`, sub: "beta model, annualised",color: NAVY },
                      { label: "Systematic Risk",    val: `${sysShare}%`,               sub: "driven by market beta",   color: "#2563eb" },
                      { label: "Idiosyncratic Risk", val: `${idioShare}%`,              sub: "stock-specific exposure",  color: AMBER },
                    ].map(({ label, val, sub, color }) => (
                      <div key={label} className="border border-[#eee9df] bg-[#fbfaf7] px-3 py-3 text-center">
                        <MiniLabel>{label}</MiniLabel>
                        <p className="mt-1 text-[20px] font-bold tabular-nums leading-none" style={{ color }}>{val}</p>
                        <p className="text-[9px] text-[#bbb] mt-1">{sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Stacked bar chart: risk contribution per position ── */}
                  <MiniLabel>Risk Contribution per Position — % of total portfolio vol</MiniLabel>
                  <div className="mt-3" style={{ height: Math.max(180, riskRows.length * 30 + 44) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={riskRows}
                        margin={{ top: 4, right: 56, bottom: 8, left: 4 }}>
                        <CartesianGrid stroke="#eee9df" horizontal={false} />
                        <XAxis type="number" axisLine={false} tickLine={false}
                          tick={{ fontSize: 9, fill: "#bbb" }}
                          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                          domain={[0, "dataMax + 2"]} />
                        <YAxis type="category" dataKey="ticker" width={44} axisLine={false} tickLine={false}
                          tick={{ fontSize: 10, fill: "#0c1b38", fontWeight: 600 }} />
                        <Tooltip
                          contentStyle={{ border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 10 }}
                          formatter={(val: unknown, name: string) => [
                            `${typeof val === "number" ? val.toFixed(1) : val}%`,
                            name === "sys" ? "Systematic (β)" : "Idiosyncratic",
                          ]}
                          labelFormatter={(label: string) => {
                            const r = riskRows.find(r => r.ticker === label);
                            return r ? `${r.ticker} · β=${r.beta.toFixed(2)} · σ=${(r.vol * 100).toFixed(0)}%` : label;
                          }}
                        />
                        <Bar dataKey="sys"  stackId="r" fill={NAVY}  name="sys"  radius={0} />
                        <Bar dataKey="idio" stackId="r" fill={AMBER} name="idio" radius={[0, 2, 2, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-5 mt-1 text-[9.5px] text-[#999]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-2.5 inline-block" style={{ backgroundColor: NAVY }} />
                      Systematic (β × market)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-2.5 inline-block" style={{ backgroundColor: AMBER }} />
                      Idiosyncratic (stock-specific)
                    </span>
                  </div>

                  {/* ── Detailed table ── */}
                  <div className="mt-5 border border-[#eee9df] overflow-x-auto">
                    <table className="w-full text-left min-w-[580px]">
                      <thead>
                        <tr className="bg-[#fbfaf7] border-b border-[#eee9df]">
                          <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]">Ticker</th>
                          <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999] text-right">Wt.</th>
                          <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999] text-right">Beta</th>
                          <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999] text-right">Ann. Vol</th>
                          <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-right" style={{ color: NAVY }}>Sys. RC%</th>
                          <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-right" style={{ color: AMBER }}>Idio. RC%</th>
                          <th className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0c1b38] text-right">Total RC%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riskRows.map(r => (
                          <tr key={r.ticker} className="border-b border-[#f1eee8] last:border-0 hover:bg-[#fbfaf7]">
                            <td className="px-3 py-2">
                              <span className="text-[11.5px] font-bold text-[#0c1b38]">{r.ticker}</span>
                              <span className="ml-1.5 text-[9px] text-[#ccc]">{r.sector}</span>
                            </td>
                            <td className="px-3 py-2 text-[11px] tabular-nums text-[#777] text-right">{(r.weight * 100).toFixed(1)}%</td>
                            <td className="px-3 py-2 text-[11px] tabular-nums text-right font-semibold"
                              style={{ color: r.beta > 1.3 ? NEGATIVE : r.beta < 0.7 ? POSITIVE : "#555" }}>
                              {r.beta.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-[11px] tabular-nums text-[#555] text-right">
                              {(r.vol * 100).toFixed(1)}%
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="text-[11px] font-semibold tabular-nums" style={{ color: NAVY }}>
                                {r.sys.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="text-[11px] font-semibold tabular-nums" style={{ color: AMBER }}>
                                {r.idio.toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className="text-[12px] font-bold tabular-nums text-[#0c1b38]">
                                {r.total.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-[#ddd]">
                          <td className="px-3 py-2 text-[9.5px] font-semibold text-[#999] uppercase tracking-[0.1em]">Portfolio</td>
                          <td className="px-3 py-2 text-right text-[11px] tabular-nums text-[#777]">{(coveredWt * 100).toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right text-[11.5px] font-bold text-[#0c1b38]">{portBeta.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-[11.5px] font-bold text-[#0c1b38]">{(portVol * 100).toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-[11.5px] font-bold tabular-nums" style={{ color: NAVY }}>{sysShare}%</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-[11.5px] font-bold tabular-nums" style={{ color: AMBER }}>{idioShare}%</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-[12px] font-bold tabular-nums text-[#0c1b38]">100%</span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <p className="mt-2 text-[9.5px] text-[#bbb]">
                    RC_i = w_i × (β_i·β_p·σ²_m + w_i·σ²_ε,i) / σ²_p · sums to 100% by Euler&apos;s theorem
                    {excluded > 0 && ` · ${excluded} holding${excluded > 1 ? "s" : ""} excluded (price data unavailable)`}
                  </p>
                </Card>
              );
            })()}

            {/* ── Portfolio Optimizer ───────────────────────────────────────── */}
            {factorScores && factorScores.length > 0 && currentRegime && (
              <Card className="p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <SectionLabel>Portfolio Optimizer</SectionLabel>
                    <p className="mt-1 text-[10.5px] text-[#bbb] truncate">
                      {currentRegime} regime · regime-weighted factor scores → softmax (T=0.5) → 15% max weight
                    </p>
                    {(() => {
                      const sample = factorScores[0];
                      const active   = ["Momentum","Low Vol"].filter((_, i) => [sample?.zMomentum, sample?.zLowVol][i] != null);
                      const missing  = ["Value","Quality","Size"].filter((_, i) => [sample?.zValue, sample?.zQuality, sample?.zSize][i] == null);
                      if (missing.length === 0) return null;
                      return (
                        <p className="mt-1 text-[10px]">
                          <span className="text-[#147a4f] font-semibold">Using: {active.join(", ") || "—"}</span>
                          <span className="text-[#bbb]"> · </span>
                          <span className="text-amber-600">Missing: {missing.join(", ")} — add FMP_API_KEY to Vercel to unlock</span>
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {suggestedWeights && (
                      <button onClick={applyOptimizedWeights}
                        className="bg-[#147a4f] text-white px-5 py-2 text-[10.5px] font-bold uppercase tracking-[0.14em] hover:bg-[#0f5e3a] transition-colors">
                        Apply Suggestions
                      </button>
                    )}
                    <button onClick={optimizeWeights}
                      className="border border-[#0c1b38] text-[#0c1b38] px-5 py-2 text-[10.5px] font-bold uppercase tracking-[0.14em] hover:bg-[#0c1b38] hover:text-white transition-colors">
                      {suggestedWeights ? "Re-optimize" : "Optimize Weights"}
                    </button>
                    <button onClick={() => setSuggestedWeights(null)}
                      className={`border border-[#e8e3da] text-[#bbb] px-3 py-2 text-[10px] hover:border-[#b42318] hover:text-[#b42318] transition-colors ${suggestedWeights ? "" : "hidden"}`}>
                      ✕
                    </button>
                  </div>
                </div>

                {!suggestedWeights && (
                  <div className="border border-dashed border-[#e8e3da] px-5 py-6 text-center">
                    <p className="text-[11px] text-[#999]">
                      Click "Optimize Weights" to compute regime-optimal position sizes using current {currentRegime} factor allocations and your portfolio factor scores.
                    </p>
                  </div>
                )}

                {suggestedWeights && (() => {
                  const equityHoldings = holdings.filter(
                    h => h.ticker !== "USD" && !h.ticker.includes("Crncy") && !h.name?.toLowerCase().includes("cash")
                  );
                  return (
                    <>
                      <div className="border border-[#eee9df] overflow-hidden mb-4">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-[#fbfaf7] border-b border-[#eee9df]">
                              {["Ticker","Name","Current","Change","Suggested"].map(h => (
                                <th key={h} className={`px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999] ${h === "Change" || h === "Suggested" || h === "Current" ? "text-right" : ""}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...equityHoldings]
                              .sort((a, b) => (suggestedWeights[b.ticker] ?? b.weight) - (suggestedWeights[a.ticker] ?? a.weight))
                              .map(h => {
                                const current   = h.weight;
                                const suggested = suggestedWeights[h.ticker] ?? current;
                                const diff      = suggested - current;
                                const isUp      = diff > 0.003;
                                const isDn      = diff < -0.003;
                                return (
                                  <tr key={h.ticker} className="border-b border-[#f1eee8] last:border-0 hover:bg-[#fbfaf7]">
                                    <td className="px-3 py-2 text-[11.5px] font-bold text-[#0c1b38] w-16">{h.ticker}</td>
                                    <td className="px-3 py-2 text-[11px] text-[#555]">{h.name ?? h.ticker}</td>
                                    <td className="px-3 py-2 text-[11px] tabular-nums text-[#999] text-right">{(current * 100).toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-[11.5px] font-semibold tabular-nums text-right"
                                      style={{ color: isUp ? "#147a4f" : isDn ? "#b42318" : "#bbb" }}>
                                      {diff >= 0 ? "+" : ""}{(diff * 100).toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-2 text-[11.5px] font-bold tabular-nums text-right text-[#0c1b38]">
                                      {(suggested * 100).toFixed(1)}%
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[9.5px] text-[#bbb]">
                        Weights are computed using {currentRegime} factor allocations. Cash position preserved. After applying, re-run "Analyze Portfolio" to update factor exposures.
                      </p>
                    </>
                  );
                })()}
              </Card>
            )}

            {/* ── Empty state when no scores yet ───────────────────────────── */}
            {!factorScores && !computingScores && (
              <div className="border border-[#eee9df] bg-[#fbfaf7] px-6 py-8 text-center">
                <p className="text-[12px] font-semibold text-[#0c1b38] mb-1">Ready to analyze</p>
                <p className="text-[11px] text-[#999]">
                  Edit your holdings above, then click "Analyze Portfolio" to compute live factor scores from Yahoo Finance + FMP data.
                </p>
              </div>
            )}
            {computingScores && (
              <div className="border border-[#eee9df] bg-[#fbfaf7] px-6 py-8 text-center">
                <p className="text-[12px] font-semibold text-[#0c1b38] mb-1">Computing factor scores…</p>
                <p className="text-[11px] text-[#999]">Fetching 2Y adjusted price history + fundamentals for {holdings.length} stocks. This takes ~15–30 seconds.</p>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB: BACKTEST — Real regime-rotation backtest using factor ETFs        */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === "Backtest" && (
          <div className="space-y-5">
            {/* Loading / error states */}
            {backtestLoading && (
              <Card className="p-8 text-center">
                <div className="text-[11px] text-[#999] mb-2">Fetching ETF price history from Yahoo Finance…</div>
                <div className="text-[10px] text-[#bbb]">MTUM · USMV · VLUE · QUAL · IJR · SPY</div>
              </Card>
            )}
            {backtestError && (
              <Card className="p-5">
                <p className="text-[11px] text-[#b42318]">Failed to load backtest: {backtestError}</p>
                <button onClick={() => fetchBacktest()} className="mt-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#0c1b38] border border-[#0c1b38] px-4 py-2 hover:bg-[#0c1b38] hover:text-white transition-colors">
                  Retry
                </button>
              </Card>
            )}

            {/* Allocation-changed banner */}
            {backtestData && !backtestLoading && lastBacktestAlloc && lastBacktestAlloc !== JSON.stringify(allocation) && (
              <div className="flex items-center justify-between border border-[#f0a429] bg-[#fffbf0] px-4 py-3">
                <p className="text-[10.5px] text-[#a06800]">Factor allocations changed — backtest results are outdated.</p>
                <button
                  onClick={() => fetchBacktest(allocation)}
                  className="ml-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#a06800] border border-[#f0a429] px-3 py-1.5 hover:bg-[#f0a429] hover:text-white transition-colors"
                >
                  Recalculate
                </button>
              </div>
            )}

            {backtestData && (() => {
              const bt = backtestData;
              const s  = bt.stats;
              const months = bt.monthlyData ?? [];
              const REGIME_COLORS_MAP: Record<string, string> = {
                Expansion: "#147a4f", Recovery: "#b7791f", Slowdown: "#d97706", Contraction: "#b42318",
              };

              return (
                <>
                  {/* ── Strategy overview ── */}
                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <SectionLabel>Regime-Rotation Backtest</SectionLabel>
                        <p className="mt-1 text-[10.5px] text-[#777]">
                          Holds iShares factor ETFs weighted by macro regime · monthly rebalance · {months.length} months of real data
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {bt.isDemo && <DemoBadge />}
                        <button onClick={() => fetchBacktest()} disabled={backtestLoading}
                          className="flex items-center gap-1.5 border border-[#e8e3da] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#777] hover:border-[#0c1b38] hover:text-[#0c1b38] transition-colors disabled:opacity-40">
                          <span className={backtestLoading ? "inline-block animate-spin" : ""}>↻</span>
                          Refresh
                        </button>
                      </div>
                    </div>

                    {/* Strategy vs benchmark summary stats */}
                    {s && (
                      <>
                        <div className="grid grid-cols-4 gap-3 mb-3">
                          {[
                            { label: "Ann. Return",  val: `${s.annStrat >= 0 ? "+" : ""}${(s.annStrat * 100).toFixed(1)}%`, sub: `SPX ${s.annBench >= 0 ? "+" : ""}${(s.annBench * 100).toFixed(1)}%`, color: s.annStrat > s.annBench ? POSITIVE : NEGATIVE },
                            { label: "Volatility",   val: `${(s.vol * 100).toFixed(1)}%`, sub: "annualised", color: NAVY },
                            { label: "Sharpe Ratio", val: s.sharpe.toFixed(2), sub: "rf = 4%", color: s.sharpe >= 0.5 ? POSITIVE : s.sharpe >= 0 ? NAVY : NEGATIVE },
                            { label: "Sortino Ratio", val: s.sortino != null ? s.sortino.toFixed(2) : "—", sub: "downside dev", color: (s.sortino ?? 0) >= 0.7 ? POSITIVE : (s.sortino ?? 0) >= 0 ? NAVY : NEGATIVE },
                          ].map(({ label, val, sub, color }) => (
                            <div key={label} className="border border-[#eee9df] bg-[#fbfaf7] px-3 py-3 text-center">
                              <MiniLabel>{label}</MiniLabel>
                              <p className="mt-1 text-[20px] font-bold tabular-nums leading-none" style={{ color }}>{val}</p>
                              <p className="text-[9px] text-[#bbb] mt-1">{sub}</p>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-4 gap-3 mb-5">
                          {[
                            { label: "Max Drawdown", val: `${(s.maxDD * 100).toFixed(1)}%`, sub: "peak-to-trough", color: NEGATIVE },
                            { label: "Calmar Ratio",  val: s.calmar != null ? s.calmar.toFixed(2) : "—", sub: "ret / |maxDD|", color: (s.calmar ?? 0) >= 0.5 ? POSITIVE : (s.calmar ?? 0) >= 0 ? NAVY : NEGATIVE },
                            { label: "Info. Ratio",   val: s.ir.toFixed(2), sub: `t=${s.irTStat != null ? s.irTStat.toFixed(1) : "—"} vs SPX`, color: s.ir > 0 ? POSITIVE : NEGATIVE },
                            { label: "Up/Down Cap.",  val: s.upCapture != null ? `${(s.upCapture * 100).toFixed(0)}/${(s.downCapture * 100).toFixed(0)}` : "—", sub: "up% / down%", color: (s.upCapture ?? 1) > 1 || (s.downCapture ?? 1) < 1 ? POSITIVE : NAVY },
                          ].map(({ label, val, sub, color }) => (
                            <div key={label} className="border border-[#eee9df] bg-[#fbfaf7] px-3 py-3 text-center">
                              <MiniLabel>{label}</MiniLabel>
                              <p className="mt-1 text-[20px] font-bold tabular-nums leading-none" style={{ color }}>{val}</p>
                              <p className="text-[9px] text-[#bbb] mt-1">{sub}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Equity curve */}
                    <div className="mb-1">
                      <div className="flex items-center justify-between mb-2">
                        <MiniLabel>Cumulative performance — NAV starting at 100</MiniLabel>
                        <div className="flex items-center gap-4 text-[9.5px] text-[#999]">
                          <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 bg-[#0c1b38] inline-block" /> Regime Strategy</span>
                          <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 bg-[#147a4f] inline-block" style={{ borderTop: "2px dashed #147a4f" }} /> S&P 500 (SPY)</span>
                        </div>
                      </div>
                      <div className="h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={months} margin={{ top: 4, right: 8, bottom: 0, left: -5 }}>
                            <CartesianGrid stroke="#eee9df" vertical={false} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false}
                              tick={{ fontSize: 9, fill: "#bbb" }} interval="preserveStartEnd" />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#bbb" }}
                              tickFormatter={v => v.toFixed(0)} domain={["auto", "auto"]} />
                            <Tooltip
                              contentStyle={{ border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 10 }}
                              formatter={(v: unknown) => [`${typeof v === "number" ? v.toFixed(1) : v}`]}
                            />
                            {/* Regime background shading */}
                            {(() => {
                              const RFILL: Record<string, string> = { Recovery: "#dbeafe", Expansion: "#d1fae5", Slowdown: "#fef3c7", Contraction: "#fee2e2" };
                              const periods: { x1: string; x2: string; regime: string }[] = [];
                              let cur = months[0]?.regime; let st = months[0]?.date;
                              for (let i = 1; i <= months.length; i++) {
                                if (i === months.length || months[i].regime !== cur) {
                                  if (cur && st) periods.push({ x1: st, x2: months[i - 1]?.date ?? st, regime: cur });
                                  if (i < months.length) { cur = months[i].regime; st = months[i].date; }
                                }
                              }
                              return periods.map((p, i) => (
                                <ReferenceArea key={i} x1={p.x1} x2={p.x2} fill={RFILL[p.regime] ?? "#f0f0f0"} fillOpacity={0.35} strokeOpacity={0} />
                              ));
                            })()}
                            <Line type="monotone" dataKey="stratNav" name="Strategy" stroke={NAVY} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="benchNav" name="S&P 500" stroke={POSITIVE} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {(["Expansion","Recovery","Slowdown","Contraction"] as const).map(r => (
                          <span key={r} className="flex items-center gap-1 text-[9px] text-[#999]">
                            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: { Expansion:"#d1fae5", Recovery:"#dbeafe", Slowdown:"#fef3c7", Contraction:"#fee2e2" }[r] }} />
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[9.5px] text-[#bbb] mt-1">
                      {bt.dataNote} · Factor ETF prices: Yahoo Finance (split/dividend-adjusted). 10bps transaction cost deducted on regime switches.
                    </p>
                  </Card>

                  {/* ── Drawdown chart ── */}
                  {bt.drawdownSeries && bt.drawdownSeries.length > 0 && (
                    <Card className="p-5">
                      <SectionLabel>Drawdown Profile</SectionLabel>
                      <p className="mt-1 mb-3 text-[10.5px] text-[#bbb]">Peak-to-trough underwater curve — strategy NAV vs rolling maximum</p>
                      <div className="h-[140px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={bt.drawdownSeries} margin={{ top: 4, right: 8, bottom: 0, left: -5 }}>
                            <CartesianGrid stroke="#eee9df" vertical={false} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#bbb" }} interval="preserveStartEnd" />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#bbb" }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} domain={["auto", 0]} />
                            <Tooltip contentStyle={{ border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 10 }} formatter={(v: unknown) => [`${typeof v === "number" ? (v * 100).toFixed(2) : v}%`, "Drawdown"]} />
                            {(() => {
                              const RFILL: Record<string, string> = { Recovery: "#dbeafe", Expansion: "#d1fae5", Slowdown: "#fef3c7", Contraction: "#fee2e2" };
                              const periods: { x1: string; x2: string; regime: string }[] = [];
                              let cur = months[0]?.regime; let st = months[0]?.date;
                              for (let i = 1; i <= months.length; i++) {
                                if (i === months.length || months[i].regime !== cur) {
                                  if (cur && st) periods.push({ x1: st, x2: months[i - 1]?.date ?? st, regime: cur });
                                  if (i < months.length) { cur = months[i].regime; st = months[i].date; }
                                }
                              }
                              return periods.map((p, i) => (
                                <ReferenceArea key={i} x1={p.x1} x2={p.x2} fill={RFILL[p.regime] ?? "#f0f0f0"} fillOpacity={0.35} strokeOpacity={0} />
                              ));
                            })()}
                            <Area type="monotone" dataKey="drawdown" name="Drawdown" stroke={NEGATIVE} fill={NEGATIVE} fillOpacity={0.15} strokeWidth={1.5} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  )}

                  {/* ── Rolling 12M returns ── */}
                  {bt.rolling12M && bt.rolling12M.length > 0 && (
                    <Card className="p-5">
                      <SectionLabel>Rolling 12-Month Returns</SectionLabel>
                      <p className="mt-1 mb-3 text-[10.5px] text-[#bbb]">Trailing 1-year return each month — strategy vs S&P 500</p>
                      <div className="h-[140px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={bt.rolling12M} margin={{ top: 4, right: 8, bottom: 0, left: -5 }}>
                            <CartesianGrid stroke="#eee9df" vertical={false} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#bbb" }} interval="preserveStartEnd" />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#bbb" }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                            <Tooltip contentStyle={{ border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 10 }} formatter={(v: unknown) => [`${typeof v === "number" ? (v * 100).toFixed(1) : v}%`]} />
                            <ReferenceLine y={0} stroke="#ccc" strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="stratRoll" name="Strategy" stroke={NAVY} strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="benchRoll" name="S&P 500" stroke={POSITIVE} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  )}

                  {/* ── Year-by-Year returns table ── */}
                  {months.length > 0 && (() => {
                    const byYear: Record<string, { strat: number; bench: number }> = {};
                    for (const m of months) {
                      const yr = m.date.slice(0, 4);
                      if (!byYear[yr]) byYear[yr] = { strat: 1, bench: 1 };
                      byYear[yr].strat *= (1 + (m.stratReturn ?? 0));
                      byYear[yr].bench *= (1 + (m.benchReturn ?? 0));
                    }
                    const rows = Object.entries(byYear)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([year, v]) => ({ year, strat: v.strat - 1, bench: v.bench - 1, alpha: (v.strat - 1) - (v.bench - 1) }));
                    return (
                      <Card className="p-5">
                        <SectionLabel>Calendar Year Returns</SectionLabel>
                        <p className="mt-1 mb-4 text-[10.5px] text-[#bbb]">Full-year performance — strategy vs S&P 500 (SPY) · partial year shown for current year</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px] border-collapse">
                            <thead>
                              <tr className="border-b border-[#eee9df]">
                                <th className="text-left py-2 pr-4 text-[9.5px] font-semibold text-[#999] uppercase tracking-[0.1em]">Year</th>
                                <th className="text-right py-2 px-4 text-[9.5px] font-semibold text-[#999] uppercase tracking-[0.1em]">Strategy</th>
                                <th className="text-right py-2 px-4 text-[9.5px] font-semibold text-[#999] uppercase tracking-[0.1em]">S&P 500</th>
                                <th className="text-right py-2 pl-4 text-[9.5px] font-semibold text-[#999] uppercase tracking-[0.1em]">Alpha</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(r => (
                                <tr key={r.year} className="border-b border-[#f4f1ec] hover:bg-[#fbfaf7] transition-colors">
                                  <td className="py-2 pr-4 font-semibold text-[#444]">{r.year}</td>
                                  <td className="py-2 px-4 text-right tabular-nums font-bold" style={{ color: r.strat >= 0 ? POSITIVE : NEGATIVE }}>
                                    {r.strat >= 0 ? "+" : ""}{(r.strat * 100).toFixed(1)}%
                                  </td>
                                  <td className="py-2 px-4 text-right tabular-nums text-[#555]">
                                    {r.bench >= 0 ? "+" : ""}{(r.bench * 100).toFixed(1)}%
                                  </td>
                                  <td className="py-2 pl-4 text-right tabular-nums font-semibold" style={{ color: r.alpha >= 0 ? POSITIVE : NEGATIVE }}>
                                    {r.alpha >= 0 ? "+" : ""}{(r.alpha * 100).toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-[#ddd]">
                                <td className="py-2 pr-4 text-[9.5px] font-semibold text-[#999] uppercase tracking-[0.1em]">Full Period</td>
                                <td className="py-2 px-4 text-right tabular-nums font-bold" style={{ color: bt.stats && bt.stats.annStrat >= 0 ? POSITIVE : NEGATIVE }}>
                                  {bt.stats ? `${bt.stats.annStrat >= 0 ? "+" : ""}${(bt.stats.annStrat * 100).toFixed(1)}% ann.` : "—"}
                                </td>
                                <td className="py-2 px-4 text-right tabular-nums text-[#555]">
                                  {bt.stats ? `${bt.stats.annBench >= 0 ? "+" : ""}${(bt.stats.annBench * 100).toFixed(1)}% ann.` : "—"}
                                </td>
                                <td className="py-2 pl-4 text-right tabular-nums font-semibold" style={{ color: bt.stats && bt.stats.ir > 0 ? POSITIVE : NEGATIVE }}>
                                  {bt.stats ? `IR ${bt.stats.ir.toFixed(2)}` : "—"}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </Card>
                    );
                  })()}

                  {/* ── Regime performance attribution ── */}
                  <Card className="p-5">
                    <SectionLabel>Regime Performance Attribution</SectionLabel>
                    <p className="mt-1 mb-4 text-[10.5px] text-[#bbb]">Average monthly return by regime — strategy vs S&P 500</p>
                    <div className="grid grid-cols-4 gap-3 mb-5">
                      {(["Expansion","Recovery","Slowdown","Contraction"] as const).map(regime => {
                        const perf = bt.regimePerf?.[regime];
                        const count = bt.regimeCounts?.[regime] ?? 0;
                        const color = REGIME_COLORS_MAP[regime];
                        const weights = bt.regimeWeights?.[regime] ?? {};
                        const activeETFs = Object.entries(weights as Record<string,number>)
                          .filter(([,w]) => w > 0)
                          .sort(([,a],[,b]) => b - a)
                          .map(([etf, w]) => `${etf} ${Math.round(w*100)}%`)
                          .join(" · ");
                        return (
                          <div key={regime} className="border border-[#eee9df] p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <p className="text-[11px] font-bold" style={{ color }}>{regime}</p>
                              <span className="ml-auto text-[9px] text-[#bbb]">{count}mo</span>
                            </div>
                            {perf ? (
                              <>
                                <div className="space-y-1.5 mb-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[9.5px] text-[#777]">Strategy avg/mo</span>
                                    <span className="text-[12px] font-bold tabular-nums" style={{ color: perf.stratAvg >= 0 ? POSITIVE : NEGATIVE }}>
                                      {perf.stratAvg >= 0 ? "+" : ""}{(perf.stratAvg * 100).toFixed(2)}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[9.5px] text-[#777]">SPY avg/mo</span>
                                    <span className="text-[12px] font-bold tabular-nums text-[#555]">
                                      {perf.benchAvg >= 0 ? "+" : ""}{(perf.benchAvg * 100).toFixed(2)}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center border-t border-[#eee9df] pt-1.5">
                                    <span className="text-[9.5px] text-[#777]">Edge vs SPY</span>
                                    <span className="text-[11px] font-bold tabular-nums" style={{ color: perf.stratAvg > perf.benchAvg ? POSITIVE : NEGATIVE }}>
                                      {(perf.stratAvg - perf.benchAvg) >= 0 ? "+" : ""}{((perf.stratAvg - perf.benchAvg) * 100).toFixed(2)}%
                                    </span>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <p className="text-[10px] text-[#bbb]">No months in sample</p>
                            )}
                            <div className="border-t border-[#eee9df] pt-2">
                              <p className="text-[8.5px] text-[#bbb] leading-relaxed">{activeETFs || "—"}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  {/* ── Regime transition matrix ── */}
                  {bt.transitionMatrix && (
                    <Card className="p-5">
                      <SectionLabel>Regime Transition Matrix</SectionLabel>
                      <p className="mt-1 mb-4 text-[10.5px] text-[#bbb]">
                        Empirical probability of transitioning from one regime to another the following month
                      </p>
                      <div className="overflow-x-auto">
                        <table className="text-center text-[10px]">
                          <thead>
                            <tr className="border-b border-[#eee9df]">
                              <th className="px-3 py-2 text-left text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#bbb] w-28">From ↓ / To →</th>
                              {(["Recovery","Expansion","Slowdown","Contraction"] as const).map(r => (
                                <th key={r} className="px-3 py-2 text-[8.5px] font-bold uppercase tracking-[0.1em]" style={{ color: { Recovery:"#b7791f", Expansion:"#147a4f", Slowdown:"#d97706", Contraction:"#b42318" }[r] }}>{r}</th>
                              ))}
                              <th className="px-3 py-2 text-[8.5px] text-[#bbb]">Avg dur.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(["Recovery","Expansion","Slowdown","Contraction"] as const).map(fromR => {
                              const row = (bt.transitionMatrix as Record<string, Record<string, number>>)?.[fromR] ?? {};
                              const COLOR: Record<string, string> = { Recovery:"#b7791f", Expansion:"#147a4f", Slowdown:"#d97706", Contraction:"#b42318" };
                              const allVals = (["Recovery","Expansion","Slowdown","Contraction"] as const).map(r2 => row[r2] ?? 0);
                              const maxVal = Math.max(...allVals);
                              return (
                                <tr key={fromR} className="border-b border-[#f5f2ed] last:border-0">
                                  <td className="px-3 py-2 text-left font-bold text-[9.5px]" style={{ color: COLOR[fromR] }}>{fromR}</td>
                                  {(["Recovery","Expansion","Slowdown","Contraction"] as const).map(toR => {
                                    const p = row[toR] ?? 0;
                                    const isHighest = p === maxVal && p > 0;
                                    return (
                                      <td key={toR} className="px-3 py-2 tabular-nums font-mono" style={{ fontWeight: isHighest ? 700 : 400, color: fromR === toR ? "#555" : "#999" }}>
                                        {p > 0 ? `${Math.round(p * 100)}%` : "—"}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-[9px] text-[#bbb]">
                                    {(bt.avgDurationByRegime as Record<string, number>)?.[fromR] != null ? `${(bt.avgDurationByRegime as Record<string, number>)[fromR]}mo` : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-2 text-[9.5px] text-[#bbb]">Bold = most likely next state · Diagonal = regime persistence probability</p>
                    </Card>
                  )}

                  {/* ── Monthly returns table ── */}
                  <Card className="p-5">
                    <SectionLabel>Monthly Returns</SectionLabel>
                    <p className="mt-1 mb-4 text-[10.5px] text-[#bbb]">Regime assigned from prior month · {months.length} months total</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[560px]">
                        <thead>
                          <tr className="border-b border-[#eee9df] bg-[#fbfaf7]">
                            {["Month","Regime","Strategy","S&P 500","Edge","NAV"].map(h => (
                              <th key={h} className="px-3 py-2 text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#bbb] whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...months].reverse().slice(0, 24).map((m: {
                            date: string; regime: RegimeLabel;
                            stratReturn: number; benchReturn: number;
                            stratNav: number;
                          }) => {
                            const edge = m.stratReturn - m.benchReturn;
                            const rColor = REGIME_COLORS_MAP[m.regime] ?? "#999";
                            return (
                              <tr key={m.date} className="border-b border-[#f5f2ed] last:border-0 hover:bg-[#fbfaf7]">
                                <td className="px-3 py-2 text-[10px] font-mono text-[#555]">{m.date}</td>
                                <td className="px-3 py-2">
                                  <span className="text-[9px] font-bold" style={{ color: rColor }}>{m.regime}</span>
                                </td>
                                <td className="px-3 py-2 text-[10.5px] font-bold tabular-nums font-mono" style={{ color: m.stratReturn >= 0 ? POSITIVE : NEGATIVE }}>
                                  {m.stratReturn >= 0 ? "+" : ""}{(m.stratReturn * 100).toFixed(2)}%
                                </td>
                                <td className="px-3 py-2 text-[10.5px] tabular-nums font-mono text-[#555]">
                                  {m.benchReturn >= 0 ? "+" : ""}{(m.benchReturn * 100).toFixed(2)}%
                                </td>
                                <td className="px-3 py-2 text-[10.5px] font-bold tabular-nums font-mono" style={{ color: edge >= 0 ? POSITIVE : NEGATIVE }}>
                                  {edge >= 0 ? "+" : ""}{(edge * 100).toFixed(2)}%
                                </td>
                                <td className="px-3 py-2 text-[10px] tabular-nums text-[#555]">{m.stratNav.toFixed(1)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {months.length > 24 && (
                        <p className="mt-2 text-[9.5px] text-[#bbb]">Showing most recent 24 of {months.length} months.</p>
                      )}
                    </div>
                  </Card>

                  {/* ── Walk-Forward Validation (Phase 3) ── */}
                  {bt.walkForward && (() => {
                    const wf = bt.walkForward;
                    const ins = wf.inSample;
                    const oos = wf.outSample;
                    const fmtPct = (v: number | null | undefined) =>
                      v != null ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%` : "—";
                    const fmtNum = (v: number | null | undefined, d = 2) =>
                      v != null ? v.toFixed(d) : "—";

                    const rows = [
                      { label: "Ann. Return",  is: fmtPct(ins?.annReturn),  oos: fmtPct(oos?.annReturn) },
                      { label: "Volatility",   is: fmtPct(ins?.vol),        oos: fmtPct(oos?.vol) },
                      { label: "Sharpe",       is: fmtNum(ins?.sharpe),     oos: fmtNum(oos?.sharpe) },
                      { label: "Max Drawdown", is: fmtPct(ins?.maxDD),      oos: fmtPct(oos?.maxDD) },
                      { label: "Info. Ratio",  is: fmtNum(ins?.ir),         oos: fmtNum(oos?.ir) },
                    ];

                    return (
                      <Card className="p-5">
                        <SectionLabel>Walk-Forward Validation</SectionLabel>
                        <p className="mt-1 mb-4 text-[10.5px] text-[#bbb]">
                          Dataset split at {wf.splitDate ?? "midpoint"} — in-sample used to frame the strategy, out-of-sample is blind performance
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-[#eee9df] bg-[#fbfaf7]">
                                {["Metric", "In-Sample", "Out-of-Sample"].map(h => (
                                  <th key={h} className="px-3 py-2 text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#bbb]">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(row => (
                                <tr key={row.label} className="border-b border-[#f5f2ed] last:border-0 hover:bg-[#fbfaf7]">
                                  <td className="px-3 py-2 text-[10px] font-bold text-[#555]">{row.label}</td>
                                  <td className="px-3 py-2 text-[10.5px] tabular-nums font-mono text-[#0c1b38]">{row.is}</td>
                                  <td className="px-3 py-2 text-[10.5px] tabular-nums font-mono font-bold" style={{
                                    color: row.oos === "—" ? "#bbb" : NAVY
                                  }}>{row.oos}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="mt-2 text-[9.5px] text-[#bbb]">
                          {wf.startDate} → {wf.splitDate} in-sample &nbsp;·&nbsp; {wf.splitDate} → {wf.endDate} out-of-sample
                        </p>
                      </Card>
                    );
                  })()}

                  {/* ── Factor Attribution (Phase 3) ── */}
                  {bt.factorAttribution && bt.factorAttribution.length > 0 && (() => {
                    const fa: Array<{ factor: string; etf: string; avgWeight: number; etfTotalRet: number | null; contribution: number | null }> = bt.factorAttribution;
                    const maxContrib = Math.max(...fa.map(f => Math.abs(f.contribution ?? 0)), 0.001);

                    return (
                      <Card className="p-5">
                        <SectionLabel>Factor Attribution</SectionLabel>
                        <p className="mt-1 mb-4 text-[10.5px] text-[#bbb]">
                          Each factor ETF's contribution to strategy outperformance vs SPY — avgWeight × (ETF return − SPY return)
                        </p>
                        <div className="space-y-3">
                          {[...fa].sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0)).map(f => {
                            const contrib = f.contribution ?? 0;
                            const barWidth = Math.abs(contrib) / maxContrib * 100;
                            const isPos = contrib >= 0;
                            return (
                              <div key={f.factor}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10.5px] font-bold text-[#333] w-28">{f.factor}</span>
                                    <span className="text-[9px] text-[#bbb] font-mono">{f.etf}</span>
                                    <span className="text-[9px] text-[#bbb]">avg {(f.avgWeight * 100).toFixed(0)}% weight</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-right">
                                    <span className="text-[9.5px] text-[#777]">
                                      ETF ret: {f.etfTotalRet != null ? `${f.etfTotalRet >= 0 ? "+" : ""}${(f.etfTotalRet * 100).toFixed(1)}%` : "—"}
                                    </span>
                                    <span className="text-[11px] font-bold tabular-nums w-16 text-right font-mono" style={{ color: isPos ? POSITIVE : NEGATIVE }}>
                                      {contrib >= 0 ? "+" : ""}{(contrib * 100).toFixed(2)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 h-4">
                                  {isPos ? (
                                    <>
                                      <div className="w-1/2 flex justify-end">
                                        <div className="h-3 bg-[#f5f2ed]" style={{ width: "100%" }} />
                                      </div>
                                      <div className="w-1/2">
                                        <div className="h-3 rounded-sm" style={{ width: `${barWidth}%`, backgroundColor: POSITIVE }} />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="w-1/2 flex justify-end">
                                        <div className="h-3 rounded-sm" style={{ width: `${barWidth}%`, backgroundColor: NEGATIVE }} />
                                      </div>
                                      <div className="w-1/2">
                                        <div className="h-3 bg-[#f5f2ed]" style={{ width: "100%" }} />
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-3 text-[9.5px] text-[#bbb]">
                          Positive bar = factor ETF outperformed SPY at that average weight · full backtest period
                        </p>
                      </Card>
                    );
                  })()}

                  {/* ── Strategy logic ── */}
                  <Card className="p-5">
                    <SectionLabel>How the Strategy Works</SectionLabel>
                    <div className="mt-3 grid grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <p className="text-[10.5px] text-[#555] leading-relaxed">
                          Each month, the strategy holds the iShares factor ETF portfolio prescribed by the macro regime from the <strong>prior month</strong> (1-month implementation lag). The regime is determined by the FRED growth composite.
                        </p>
                        <p className="text-[10.5px] text-[#555] leading-relaxed">
                          Using ETF proxies eliminates survivorship bias and look-ahead bias in factor construction — MTUM, USMV, VLUE, QUAL, and IJR have published daily prices from inception.
                        </p>
                      </div>
                      <div className="border border-[#eee9df] bg-[#fbfaf7] p-4">
                        <MiniLabel>ETF portfolio by regime</MiniLabel>
                        <div className="mt-2 space-y-2">
                          {(["Expansion","Recovery","Slowdown","Contraction"] as const).map(regime => {
                            const weights = bt.regimeWeights?.[regime] ?? {};
                            const color = REGIME_COLORS_MAP[regime];
                            const parts = Object.entries(weights as Record<string,number>)
                              .filter(([,w]) => w > 0)
                              .sort(([,a],[,b]) => b - a)
                              .map(([etf, w]) => `${Math.round(w*100)}% ${etf}`)
                              .join(" + ");
                            return (
                              <div key={regime} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                                <div>
                                  <span className="text-[9.5px] font-bold" style={{ color }}>{regime}:</span>
                                  <span className="text-[9.5px] text-[#555] ml-1.5 font-mono">{parts}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                </>
              );
            })()}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB: DIAGNOSTICS                                                      */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === "Diagnostics" && (
          <div className="space-y-5">
            <Card className="p-5">
              <SectionLabel>Research Integrity Checklist</SectionLabel>
              <p className="mt-1 mb-5 text-[10.5px] text-[#bbb]">
                Every item must be addressed before this model can be used for investment decisions.
                Items marked in red represent active look-ahead bias risks.
              </p>
              <div className="space-y-2">
                {[
                  { cat: "Macro Data",    item: "Point-in-time vintage macro data",           status: "partial",  note: "Publication lags now enforced per indicator (0–1 month). FRED revised series still used — ALFRED vintage API would eliminate revision look-ahead. Meaningful but incomplete fix." },
                  { cat: "Macro Data",    item: "Expanding-window z-score normalisation",     status: "complete", note: "Implemented: z-scores anchored from first available observation per indicator, expanded forward with each new month. No future normalization data leakage." },
                  { cat: "Macro Data",    item: "Publication lag enforcement",                status: "complete", note: "Implemented: each FRED indicator is shifted back by lagMonths before use in historical regime classification. INDPRO (1mo lag) uses T-1 data when classifying month T." },
                  { cat: "Universe",      item: "Survivorship bias — delisted securities",    status: "blocked",  note: "Current universe: S&P 500 live constituents only. Requires CRSP/Compustat historical membership data. Institutional data dependency." },
                  { cat: "Universe",      item: "Benchmark constituent history",              status: "blocked",  note: "S&P 500 membership changes over time not tracked. Requires historical index composition data from S&P or CRSP." },
                  { cat: "Fundamentals",  item: "As-reported vs revised fundamental data",    status: "blocked",  note: "FMP TTM data reflects latest reported figures. Point-in-time as-reported data requires Compustat. Institutional data dependency." },
                  { cat: "Fundamentals",  item: "Earnings report lag (45-day rule)",          status: "partial",  note: "Rule defined in methodology. Factor scoring uses TTM FMP data which inherently reflects filings, but exact 45-day delay not enforced per ticker." },
                  { cat: "Construction",  item: "Corporate actions (splits, mergers, spin-offs)", status: "partial", note: "Price history uses Yahoo Finance adjusted closes (split/dividend-adjusted). Merger survivorship not handled — positions in acquired companies persist post-deal." },
                  { cat: "Backtest",      item: "Transaction cost modelling",                 status: "complete", note: "10bps round-trip deducted on every full portfolio rotation (regime switch). Net-of-cost returns shown in all performance charts and statistics." },
                  { cat: "Backtest",      item: "Walk-forward out-of-sample testing",         status: "complete", note: "Dataset split at midpoint. Separate in-sample and out-of-sample stats shown in Walk-Forward Validation card. OOS IR and Sharpe quantify true predictive validity." },
                  { cat: "Backtest",      item: "Multiple-testing risk adjustment",           status: "partial",  note: "IR t-statistic shown (IR × √(N/12)). Indicates statistical significance of alpha. Full Bonferroni/FDR across parameter sweep: Phase 4." },
                  { cat: "Backtest",      item: "Parameter sensitivity analysis",             status: "pending",  note: "Phase 4: grid search over tilt intensity (0/1/2 mapping), window lengths, and composite thresholds to characterise overfitting risk." },
                  { cat: "Factor",        item: "Factor correlation monitoring",              status: "partial",  note: "Factor z-scores computed independently from separate datasets (price vs FMP fundamentals). Cross-sectional pairwise correlation matrix: Phase 4." },
                  { cat: "Factor",        item: "Factor crowding / crash risk",               status: "pending",  note: "Phase 4: AQR-style crowding score from pairwise factor beta across universe stock positions." },
                  { cat: "Regime",        item: "Regime circularity (risk appetite composite)",status: "complete", note: "Documented and warned in Regime Engine tab. Risk appetite composite uses VIX, HY spreads, and equity momentum — all inputs to regime classifier, not outputs." },
                ].map(({ cat, item, status, note }) => (
                  <div key={item} className={`flex items-start gap-3 border border-[#eee9df] px-4 py-3 ${status === "blocked" ? "bg-[#fff9f9]" : status === "complete" ? "bg-[#f9fdf9]" : "bg-[#fbfaf7]"}`}>
                    <StatusDot status={status as ReadinessGate["status"]} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[8.5px] font-bold uppercase tracking-[0.1em] border px-1.5 py-0.5"
                          style={{ color: "#999", borderColor: "#e8e3da" }}>{cat}</span>
                        <p className="text-[11.5px] font-semibold text-[#0a0a0a]">{item}</p>
                      </div>
                      <p className="text-[10.5px] text-[#777] leading-snug">{note}</p>
                    </div>
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.1em]" style={{
                      color: status === "complete" ? POSITIVE : status === "blocked" ? NEGATIVE : status === "partial" ? AMBER : "#bbb"
                    }}>
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <SectionLabel>Data Source Health</SectionLabel>
              <div className="mt-3 grid grid-cols-2 gap-4">
                {[
                  { name: "FRED API", status: !isDemo, detail: "8 macro series · Monthly aggregation · 36-month history · Powers the regime engine", key: "FRED_API_KEY" },
                  { name: "Yahoo Finance (Price)", status: true, detail: "v8/finance/chart · 2Y adjusted price history · No authentication required · Powers Momentum + Low Vol factor scores", key: "Yahoo Finance (no auth needed)" },
                  { name: "FMP Fundamentals", status: false, detail: "Financial Modeling Prep — Required for Value, Quality, Size factors. Configure FMP_API_KEY to unlock fundamental scoring.", key: "FMP_API_KEY (not set)" },
                  { name: "Historical Universe", status: false, detail: "CRSP / Compustat required for survivorship-free backtest. Current universe: S&P 500 live constituents only (Phase 3).", key: "Not configured (Phase 3)" },
                ].map(({ name, status, detail, key }) => (
                  <div key={name} className="border border-[#eee9df] px-4 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${status ? "bg-[#147a4f]" : "bg-[#b42318]"}`} />
                      <p className="text-[12px] font-bold text-[#0a0a0a]">{name}</p>
                    </div>
                    <p className="text-[10.5px] text-[#777] leading-relaxed mb-2">{detail}</p>
                    <p className="text-[9.5px] font-mono text-[#bbb]">{key}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB: METHODOLOGY                                                      */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === "Methodology" && (
          <div className="space-y-5">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-5">
                <SectionLabel>Strategy Methodology Documentation</SectionLabel>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const doc = {
                        strategy: "CrossAsset Dynamic Factor Lab",
                        version: "Phase 1 — Research Workbench",
                        generatedAt: new Date().toISOString(),
                        mode: mode,
                        publishedBaseline: PUBLISHED_BASELINE,
                        growthIndicators: growthInds,
                        riskIndicators: riskInds,
                        factorDefinitions: factorDefs,
                      };
                      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = "crossasset_strategy_methodology.json"; a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="border border-[#e8e3da] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#777] hover:border-[#0c1b38] hover:text-[#0c1b38] transition-colors">
                    Export JSON
                  </button>
                </div>
              </div>

              <div className="space-y-6 text-[12px] text-[#333] leading-[1.8]">

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0c1b38] mb-2">Strategy Overview</p>
                  <p>
                    The CrossAsset Dynamic Factor Lab implements a macro-regime-informed, long-only U.S. equity strategy
                    with a target holding period of 2–12 months. The strategy tilts factor exposures — Value, Size,
                    Momentum, Quality, and Low Volatility — based on the current position in the economic cycle,
                    as identified by a composite of public macroeconomic indicators.
                  </p>
                  <p className="mt-2">
                    The framework is structured in two modes: (1) <strong>Published Baseline</strong>, which replicates the
                    publicly described FTSE Russell / Invesco Dynamic Multifactor methodology using a hard four-quadrant
                    regime classification and fixed factor tilts, and (2) <strong>CrossAsset Enhanced</strong>, which introduces
                    probabilistic regime classification, continuous factor targets, and additional adjustments for factor
                    relative valuation, momentum, and crowding risk.
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0c1b38] mb-2">Regime Classification</p>
                  <p>
                    The economy is characterized along two dimensions: growth level (above or below long-run trend) and
                    growth direction (accelerating or decelerating). This creates four distinct regimes: Recovery (below trend,
                    accelerating), Expansion (above trend, accelerating), Slowdown (above trend, decelerating), and Contraction
                    (below trend, decelerating).
                  </p>
                  <p className="mt-2">
                    Growth level and direction are estimated from a weighted composite of FRED public macro indicators,
                    each z-scored relative to their historical distribution. A composite above zero indicates above-trend
                    growth; the 3-month change in the composite indicates acceleration or deceleration.
                  </p>
                  <p className="mt-2">
                    In Enhanced mode, the model computes soft regime probabilities using a distance-based softmax function
                    with temperature parameter τ = 0.8. Factor targets are the probability-weighted average of the four
                    regime allocations, producing continuous exposures rather than binary rotations.
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0c1b38] mb-2">Factor Construction</p>
                  <p>
                    Five factors are supported: Value, Quality, Momentum, Low Volatility, and Size. Each factor is
                    constructed from multiple sub-signals, each converted to a cross-sectional z-score, winsorised at the
                    2nd and 98th percentiles, and combined with user-editable weights. Sector-neutral z-scoring is applied
                    to Value and Quality by default to control for industry-level differences in accounting metrics.
                  </p>
                  <p className="mt-2">
                    Factor scores are combined with the regime-derived factor targets to produce a composite stock score.
                    Portfolio construction uses an exponential tilting approach anchored at benchmark weights, subject to
                    a full constraint set including long-only, maximum stock weight, sector active-weight limits, and
                    turnover constraints.
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0c1b38] mb-2">Data and Bias Controls</p>
                  <p>
                    All macro data is sourced from the St. Louis Fed FRED API, which provides monthly aggregated series
                    for the key indicators. Z-score normalisation currently uses the fetched 36-month window — this is
                    acknowledged as NOT point-in-time valid and is labeled "Exploratory" throughout the interface.
                    Phase 3 will replace this with proper expanding-window normalisation starting from 1990.
                  </p>
                  <p className="mt-2">
                    The security universe currently uses current S&P 500 constituents, which introduces survivorship bias.
                    A proper implementation requires historical constituent data and delisted securities. Fundamental data
                    lags (earnings reports are typically available 45 days after quarter end) must be enforced before any
                    backtest results can be considered valid.
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0c1b38] mb-2">Development Roadmap</p>
                  <div className="grid grid-cols-4 gap-3 mt-2">
                    {[
                      { phase: "Phase 1 — Current", items: ["Regime engine (FRED data)", "Published baseline mode", "Enhanced probabilistic mode", "Factor definitions UI", "Methodology documentation", "Diagnostics checklist"] },
                      { phase: "Phase 2 — Factor Engine", items: ["Security universe integration", "Fundamental data adapter", "Cross-sectional factor scoring", "Portfolio optimizer", "Constraint enforcement", "Exportable portfolio"] },
                      { phase: "Phase 3 — Valid Backtest", items: ["PIT vintage macro data", "Survivorship-free universe", "Earnings lag enforcement", "Attribution engine", "Walk-forward testing", "Robustness/sensitivity"] },
                      { phase: "Phase 4 — Paper Portfolio", items: ["Saved model versions", "Monthly rebalance alerts", "Trade preview & cost estimate", "Decision journal", "Performance monitoring", "Transition to live process"] },
                    ].map(({ phase, items }) => (
                      <div key={phase} className="border border-[#eee9df] px-3 py-4">
                        <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#0c1b38] mb-3">{phase}</p>
                        <ul className="space-y-1">
                          {items.map(item => (
                            <li key={item} className="text-[10.5px] text-[#555] flex items-start gap-1.5">
                              <span className="text-[#bbb] mt-0.5 shrink-0">·</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-[#eee9df] bg-[#fbfaf7] px-5 py-4 text-[10.5px] text-[#777]">
                  <p className="font-bold text-[#0a0a0a] mb-1">Legal and Disclosure</p>
                  <p>
                    This tool is a research prototype for educational and exploratory purposes only.
                    It is not investment advice, not a financial product, and must not be used as the sole basis
                    for investment decisions. All backtest results are exploratory and subject to significant
                    look-ahead bias until Phase 3 validation passes. Past exploratory model performance does not
                    predict future results. The "Published Baseline" replicates publicly available methodology
                    descriptions and does not reproduce proprietary FTSE Russell or Invesco signals.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

      </main>
    </AppShell>
  );
}
