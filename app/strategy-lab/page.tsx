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
        {/* TAB: PORTFOLIO BUILDER  (Phase 2 stub)                               */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === "Portfolio Builder" && (
          <div className="space-y-5">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <SectionLabel>Portfolio Construction</SectionLabel>
                <PhaseBadge phase={2} />
              </div>
              <div className="border border-amber-200 bg-amber-50 px-5 py-4 mb-5">
                <p className="text-[11.5px] text-amber-800 font-semibold mb-1">Phase 2 Requirement: Security-Level Data</p>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Portfolio construction requires a security universe with fundamental data (earnings yield, ROIC, price momentum, volatility)
                  for each stock. Planned sources: FactSet / Bloomberg API, or user CSV upload. The mathematical
                  framework is defined below — implementation begins when the data adapter is connected.
                </p>
              </div>

              {/* Architecture description */}
              <div className="grid grid-cols-2 gap-5 mb-5">
                <div>
                  <MiniLabel>Stock scoring methodology</MiniLabel>
                  <div className="mt-2 border border-[#eee9df] bg-[#fbfaf7] px-4 py-4 font-mono text-[11px] text-[#333] leading-loose">
                    <p><span className="text-[#0c1b38] font-bold">1.</span> Compute factor z-scores per security</p>
                    <p><span className="text-[#0c1b38] font-bold">2.</span> Sector-neutralise where specified</p>
                    <p><span className="text-[#0c1b38] font-bold">3.</span> Weight by factor target:</p>
                    <p className="pl-4 text-[#555]">score_i = Σ (factor_target_f × z_i,f)</p>
                    <p><span className="text-[#0c1b38] font-bold">4.</span> Tilt from benchmark weight:</p>
                    <p className="pl-4 text-[#555]">w_raw_i = w_bmark_i × exp(κ × score_i)</p>
                    <p><span className="text-[#0c1b38] font-bold">5.</span> Normalise Σ w_i = 1</p>
                    <p><span className="text-[#0c1b38] font-bold">6.</span> Apply constraints (optimizer)</p>
                  </div>
                </div>
                <div>
                  <MiniLabel>Portfolio constraints (configured)</MiniLabel>
                  <div className="mt-2 space-y-2">
                    {[
                      ["Universe", "S&P 500 constituents (Phase 2 data)"],
                      ["Benchmark", "S&P 500 (market-cap weights)"],
                      ["Long-only", "No short positions"],
                      ["Max stock weight", "5.0% (configurable)"],
                      ["Max active weight", "±3.0% per stock"],
                      ["Sector active limit", "±8.0% vs benchmark"],
                      ["Turnover limit", "≤20% per rebalance"],
                      ["Min stocks", "50"],
                      ["Tilt intensity (κ)", "0.5 (configurable)"],
                      ["Rebalance", "Monthly, or on regime change"],
                    ].map(([label, val]) => (
                      <div key={label as string} className="flex items-start justify-between border-b border-[#f1eee8] pb-1.5">
                        <span className="text-[10.5px] text-[#555]">{label}</span>
                        <span className="text-[10.5px] text-[#0a0a0a] font-semibold text-right ml-4">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Demo portfolio table */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <MiniLabel>Illustrative portfolio output format</MiniLabel>
                  <DemoBadge />
                </div>
                <div className="border border-[#eee9df] overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-[#fbfaf7] border-b border-[#eee9df]">
                        {["Ticker","Name","Sector","Benchmark W%","Active W%","Factor Score","Main Factor","Est. Trading Cost"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#999]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["LLY", "Eli Lilly", "Healthcare", "1.2%", "+1.8%", "+0.87", "Quality", "3.2bps"],
                        ["BRK.B", "Berkshire Hathaway", "Financials", "1.6%", "+1.4%", "+0.74", "Value", "1.8bps"],
                        ["MSFT", "Microsoft", "Technology", "6.8%", "+0.8%", "+0.61", "Quality", "0.9bps"],
                        ["JNJ", "Johnson & Johnson", "Healthcare", "0.9%", "+1.2%", "+0.58", "Low Vol.", "2.1bps"],
                        ["PG", "Procter & Gamble", "Staples", "0.8%", "+0.9%", "+0.52", "Low Vol.", "1.7bps"],
                      ].map(([ticker, name, sector, bW, aW, score, factor, cost]) => (
                        <tr key={ticker} className="border-b border-[#f1eee8] last:border-0 hover:bg-[#fbfaf7]">
                          <td className="px-3 py-2 text-[12px] font-bold text-[#0c1b38]">{ticker}</td>
                          <td className="px-3 py-2 text-[11.5px] text-[#0a0a0a]">{name}</td>
                          <td className="px-3 py-2 text-[11px] text-[#777]">{sector}</td>
                          <td className="px-3 py-2 text-[11px] tabular-nums text-[#555]">{bW}</td>
                          <td className="px-3 py-2 text-[11.5px] font-bold tabular-nums text-[#147a4f]">{aW}</td>
                          <td className="px-3 py-2 text-[11.5px] font-bold tabular-nums text-[#0c1b38]">{score}</td>
                          <td className="px-3 py-2 text-[10.5px] text-[#999]">{factor}</td>
                          <td className="px-3 py-2 text-[10.5px] tabular-nums text-[#bbb]">{cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[9.5px] text-[#bbb]">
                  Table is illustrative only — placeholder weights and scores. Phase 2 will populate from live security data.
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB: BACKTEST  (Phase 3 stub with demo chart)                         */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === "Backtest" && (
          <div className="space-y-5">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <SectionLabel>Backtest Engine</SectionLabel>
                <PhaseBadge phase={3} />
              </div>

              <div className="border border-[#b42318] bg-[#fff5f4] px-5 py-4 mb-5">
                <p className="text-[11.5px] text-[#b42318] font-bold mb-1">⚠ Research Integrity — Read Before Proceeding</p>
                <div className="text-[11px] text-[#b42318] space-y-1 leading-relaxed">
                  <p>• Z-scores are currently computed over a 36-month window with full-sample normalization. <strong>This is NOT point-in-time valid.</strong></p>
                  <p>• The universe currently contains only current S&P 500 constituents. <strong>Survivorship bias will inflate results by 1–3% per annum.</strong></p>
                  <p>• Fundamental data lags are not yet enforced (e.g., earnings reported 45 days after quarter end).</p>
                  <p>• No vintage macro data: z-scores use currently revised FRED values, not originally reported values.</p>
                  <p>All outputs labeled "Exploratory" must not be used for investment decisions until Phase 3 validation passes.</p>
                </div>
              </div>

              {/* Configuration */}
              <div className="grid grid-cols-4 gap-4 mb-5">
                {[
                  { label: "Universe", val: "S&P 500 (current constituents)" },
                  { label: "Benchmark", val: "S&P 500 (cap-weighted)" },
                  { label: "Start Date", val: "2010-01-01 (demo)" },
                  { label: "End Date", val: "2024-12-31 (demo)" },
                  { label: "Rebalance", val: "Monthly" },
                  { label: "Transaction Cost", val: "10bps round trip" },
                  { label: "Fundamental Lag", val: "45 days (Phase 3)" },
                  { label: "Macro Release Lag", val: "Per FRED vintage (Phase 3)" },
                ].map(({ label, val }) => (
                  <div key={label} className="border border-[#eee9df] bg-[#fbfaf7] px-3 py-3">
                    <MiniLabel>{label}</MiniLabel>
                    <p className="mt-1 text-[11.5px] text-[#0a0a0a] font-semibold">{val}</p>
                  </div>
                ))}
              </div>

              {/* Demo equity curve */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <MiniLabel>Exploratory cumulative performance (illustrative)</MiniLabel>
                  <DemoBadge />
                </div>
                {(() => {
                  const pts = Array.from({ length: 60 }, (_, i) => {
                    const date = `20${String(Math.floor(i / 12) + 20).slice(-2)}-${String((i % 12) + 1).padStart(2,"0")}`;
                    const trend = i / 60;
                    const cycle = Math.sin(i * 0.4) * 0.08;
                    return {
                      date,
                      strategy:  parseFloat((100 * Math.exp(trend * 1.1 + cycle + Math.random() * 0.01 - 0.005)).toFixed(2)),
                      benchmark: parseFloat((100 * Math.exp(trend * 0.9 + cycle * 0.8 + Math.random() * 0.008 - 0.004)).toFixed(2)),
                    };
                  });
                  return (
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={pts} margin={{ top: 8, right: 8, bottom: 0, left: -5 }}>
                          <CartesianGrid stroke="#eee9df" vertical={false} />
                          <XAxis dataKey="date" axisLine={false} tickLine={false}
                            tick={{ fontSize: 10, fill: "#999" }} interval="preserveStartEnd" />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#999" }}
                            tickFormatter={v => `${v.toFixed(0)}`} domain={["auto","auto"]} />
                          <Tooltip contentStyle={{ border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 11 }} />
                          <Line type="monotone" dataKey="strategy" name="Strategy (exploratory)" stroke={NAVY} strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="benchmark" name="S&P 500" stroke={POSITIVE} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
                <p className="mt-2 text-[10px] text-[#bbb]">
                  DEMONSTRATION DATA ONLY. This chart uses randomly generated returns, not any historical backtest.
                  Phase 3 will implement a proper point-in-time backtest engine.
                </p>
              </div>

              {/* Summary stats (demo) */}
              <div className="grid grid-cols-6 gap-3 border-t border-[#eee9df] pt-4">
                {[
                  { label: "Ann. Return (demo)", val: "—", sub: "Phase 3" },
                  { label: "Volatility",          val: "—", sub: "Phase 3" },
                  { label: "Sharpe Ratio",         val: "—", sub: "Phase 3" },
                  { label: "Max Drawdown",         val: "—", sub: "Phase 3" },
                  { label: "Info. Ratio",          val: "—", sub: "Phase 3" },
                  { label: "Turnover",             val: "—", sub: "Phase 3" },
                ].map(({ label, val }) => (
                  <div key={label} className="border border-[#eee9df] bg-[#fbfaf7] px-3 py-3 text-center">
                    <MiniLabel>{label}</MiniLabel>
                    <p className="mt-1 text-[20px] font-light text-[#ccc]">{val}</p>
                  </div>
                ))}
              </div>
            </Card>
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
                  { cat: "Macro Data",    item: "Point-in-time vintage macro data",           status: "blocked",  note: "Currently using FRED revised history. Phase 3: ALFRED or FRED vintage API." },
                  { cat: "Macro Data",    item: "Expanding-window z-score normalisation",     status: "blocked",  note: "Currently using 36-month in-sample window. Phase 3: anchored start from 1990." },
                  { cat: "Macro Data",    item: "Publication lag enforcement",                status: "partial",  note: "Lags documented per indicator. Not yet enforced in composite computation." },
                  { cat: "Universe",      item: "Survivorship bias — delisted securities",    status: "blocked",  note: "Current universe: S&P 500 live constituents only. Phase 3: CRSP/Compustat historical." },
                  { cat: "Universe",      item: "Benchmark constituent history",              status: "blocked",  note: "S&P 500 membership changes over time. Currently not tracked." },
                  { cat: "Fundamentals",  item: "As-reported vs revised fundamental data",    status: "blocked",  note: "Phase 3: Compustat point-in-time fundamental data." },
                  { cat: "Fundamentals",  item: "Earnings report lag (45-day rule)",          status: "partial",  note: "Rule defined; not yet enforced in scoring." },
                  { cat: "Construction",  item: "Corporate actions (splits, mergers, spin-offs)", status: "blocked", note: "Requires adjusted price history from Compustat/CRSP." },
                  { cat: "Backtest",      item: "Transaction cost modelling",                 status: "partial",  note: "10bps round-trip hardcoded. Phase 3: bid-ask spread + market impact." },
                  { cat: "Backtest",      item: "Walk-forward out-of-sample testing",         status: "blocked",  note: "Phase 3 deliverable." },
                  { cat: "Backtest",      item: "Multiple-testing risk adjustment",           status: "pending",  note: "Phase 3: Bonferroni / FDR correction across parameter sweep." },
                  { cat: "Backtest",      item: "Parameter sensitivity analysis",             status: "pending",  note: "Phase 3: grid search over tilt intensity, window lengths, thresholds." },
                  { cat: "Factor",        item: "Factor correlation monitoring",              status: "partial",  note: "Factor definitions reviewed for overlap; real-time correlation not computed." },
                  { cat: "Factor",        item: "Factor crowding / crash risk",               status: "pending",  note: "Phase 2: AQR-style crowding score from pairwise factor beta." },
                  { cat: "Regime",        item: "Regime circularity (risk appetite composite)",status: "complete", note: "Documented and warned in Regime Engine tab. Risk appetite used as modifier only." },
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
              <div className="mt-3 grid grid-cols-3 gap-4">
                {[
                  { name: "FRED API", status: !isDemo, detail: "8 macro series · Monthly aggregation · 36-month history", key: "FRED_API_KEY" },
                  { name: "Fundamental Data", status: false, detail: "Not configured — FactSet/Bloomberg required for Phase 2", key: "Not configured" },
                  { name: "Price History", status: false, detail: "Yahoo Finance (existing) — not CRSP/Compustat; not PIT valid for backtest", key: "Yahoo (no auth)" },
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
