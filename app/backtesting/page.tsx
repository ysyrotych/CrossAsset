"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ComposedChart, Line, LineChart, ReferenceLine, ReferenceArea,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────
type AssetClass  = "Equities" | "Bonds" | "Commodities" | "FX" | "Crypto" | "Mixed";
type Confidence  = "high" | "medium" | "low";
type RegimeType  = "bull" | "bear" | "highVol" | "sideways";

export type Assumption = {
  id: string;
  category: "Universe" | "Entry" | "Exit" | "Position Sizing" | "Risk" | "Costs" | "Rebalance";
  label: string; value: string; editable: boolean; confidence: Confidence; note?: string;
};
export type BacktestConfig = {
  strategyName: string; originalDescription: string; assetClass: AssetClass;
  tickers: string[]; startDate: string; endDate: string; initialCapital: number;
  rebalance: string; assumptions: Assumption[];
};
export type BacktestStats = {
  cagr: number; totalReturn: number; sharpeRatio: number; sortinoRatio: number;
  maxDrawdown: number; maxDrawdownDuration: number; winRate: number;
  avgWin: number; avgLoss: number; profitFactor: number; totalTrades: number;
  benchmarkCagr: number; alpha: number; beta: number; calmarRatio: number;
  var95: number; cvar95: number; skewness: number; excessKurtosis: number;
  informationRatio: number; volatility: number;
};
export type EquityPoint     = { date: string; portfolio: number; benchmark: number };
export type DrawdownPoint   = { date: string; drawdown: number };
export type MonthlyReturn   = { year: number; month: number; return: number };
export type MCPoint         = { week: number; p5: number; p25: number; p50: number; p75: number; p95: number };
export type StressTest      = { name: string; period: string; context: string; benchmarkReturn: number; strategyReturn: number; maxDrawdown: number; recoveryMonths: number; verdict: "better" | "similar" | "worse" };
export type RollingPoint    = { date: string; rollingSharpe: number; rollingReturn: number; rollingVolatility: number; rollingBeta: number };
export type FactorExposure  = { factor: string; exposure: number; tStat: number; significant: boolean };
export type TradeRecord     = { ticker: string; entryDate: string; exitDate: string; entryPrice: number; exitPrice: number; returnPct: number; holdingDays: number; pnl: number };
export type WalkForwardPeriod = { label: string; inSampleSharpe: number; outSampleSharpe: number; inSampleReturn: number; outSampleReturn: number; overfit: boolean };
export type PnLAttribution  = { marketBeta: number; selection: number; timing: number; costs: number; stopLoss: number };
export type RegimeSegment   = { startIdx: number; endIdx: number; regime: RegimeType };
export type ParamSensCell   = { stopLoss: number; positionCount: number; sharpe: number; cagr: number; maxDrawdown: number };
export type EfficientFrontierPoint = { risk: number; return: number; sharpe: number; current?: boolean; maxSharpe?: boolean; minRisk?: boolean };
export type AssetCorrelation = { asset: string; fullPeriod: number; bullRegime: number; bearRegime: number; rolling: { date: string; corr: number }[] };

export type BacktestResult = {
  config: BacktestConfig; stats: BacktestStats;
  equityCurve: EquityPoint[]; drawdownSeries: DrawdownPoint[];
  trades: TradeRecord[]; monthlyReturns: MonthlyReturn[];
  monteCarloData: MCPoint[]; stressTests: StressTest[];
  rollingMetrics: RollingPoint[]; factorExposures: FactorExposure[];
  mdFeedback: string; summary: string;
  walkForward: WalkForwardPeriod[];
  pnlAttribution: PnLAttribution;
  regimeSegments: RegimeSegment[];
  paramSensitivity: ParamSensCell[];
  efficientFrontier: EfficientFrontierPoint[];
  correlations: AssetCorrelation[];
};

// ── Strategy History ──────────────────────────────────────────────────────────
const HISTORY_KEY = "crossasset_backtest_history";
type HistoryItem = { id: string; strategyName: string; timestamp: number; stats: BacktestStats; config: BacktestConfig };

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}
function saveToHistory(result: BacktestResult) {
  const items = loadHistory();
  const item: HistoryItem = { id: `${Date.now()}`, strategyName: result.config.strategyName, timestamp: Date.now(), stats: result.stats, config: result.config };
  const updated = [item, ...items.filter(i => i.strategyName !== result.config.strategyName)].slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const NAVY  = "#0c1b38";
const RED   = "#b42318";
const GREEN = "#147a4f";
const AMBER = "#b7791f";
const MUTED = "#9ca3af";
const BORDER = "#e8e3da";

// ── Primitive components ──────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38]">{children}</p>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`border border-[#e8e3da] bg-white ${className}`}>{children}</section>;
}
function MiniLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999]">{children}</p>;
}
function ConfidenceBadge({ level }: { level: Confidence }) {
  const cls = level === "high" ? "text-[#147a4f] bg-[#f0fbf5] border-[#b8e6ce]"
    : level === "medium" ? "text-[#b7791f] bg-[#fffbf0] border-[#f0d89a]"
    : "text-[#b42318] bg-[#fff5f4] border-[#f5c6c0]";
  return <span className={`border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${cls}`}>{level}</span>;
}
function fmtUSD(v: number) {
  if (v >= 1_000_000) return `$${(v/1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v/1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

// ── Step 1: Input + History ────────────────────────────────────────────────────
const EXAMPLES = [
  "Buy S&P 500 top-20% momentum stocks monthly, equal-weight, stop-loss at 8%",
  "Long gold when real rates fall below 0%, hedge with short USD, quarterly rebalance",
  "60/40 equity/bond portfolio, rebalance quarterly, reduce equity to 30% when VIX > 30",
  "Mean-reversion: buy S&P 500 stocks down >15% from 52-week high, hold 30 days, stop at -5%",
];

function StepInput({ onSubmit, onRestoreHistory }: { onSubmit: (d: string) => void; onRestoreHistory: (c: BacktestConfig) => void }) {
  const [text, setText] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  useEffect(() => { setHistory(loadHistory()); }, []);

  return (
    <div className="max-w-2xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38] mb-4">Step 1 — Strategy Description</p>
      <h2 className="text-[34px] font-light leading-[1.05] tracking-tight text-[#0a0a0a] mb-3" style={{ fontFamily: "var(--font-serif)" }}>
        Tell me how you invest.
      </h2>
      <p className="text-[13px] font-medium text-[#888] mb-8 leading-relaxed">
        Describe your strategy in plain English — entry signals, exit rules, universe, risk limits. The system extracts structured assumptions and asks you to confirm before running.
      </p>
      <div className="flex flex-wrap gap-2 mb-5">
        {EXAMPLES.map(ex => (
          <button key={ex} onClick={() => setText(ex)}
            className="text-[11px] font-medium text-[#0c1b38] border border-[#dce5ff] bg-[#f5f8ff] px-3 py-1.5 hover:bg-[#e8eeff] transition-colors leading-snug text-left">
            {ex}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
        placeholder="e.g. Buy the top 20 S&P 500 stocks by 12-month momentum, equal-weight, rebalance monthly. Exit when they fall out of the top 30%. Stop-loss at 10% below entry. Benchmark against SPY."
        className="w-full border border-[#e8e8e8] px-4 py-3.5 text-[13.5px] font-medium text-[#0a0a0a] placeholder:text-[#bbb] resize-none focus:outline-none focus:border-[#0c1b38] transition-colors leading-relaxed" />
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] font-medium text-[#bbb]">{text.length} chars — more detail → better assumptions</p>
        <button disabled={text.trim().length < 15} onClick={() => onSubmit(text.trim())}
          className="px-6 py-2.5 bg-[#0c1b38] text-white text-[12px] font-semibold tracking-[0.08em] uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#1a2f5e] transition-colors">
          Parse Strategy →
        </button>
      </div>

      {history.length > 0 && (
        <div className="mt-10">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#888] mb-3">Recent Strategies</p>
          <div className="border border-[#e8e3da] divide-y divide-[#f1eee8]">
            {history.slice(0, 5).map(h => (
              <button key={h.id} onClick={() => onRestoreHistory(h.config)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#fdfcfa] transition-colors text-left">
                <div>
                  <p className="text-[12.5px] font-bold text-[#0a0a0a]">{h.strategyName}</p>
                  <p className="text-[10.5px] text-[#888] mt-0.5">{h.config.assetClass} · {h.config.startDate} → {h.config.endDate}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#bbb]">CAGR</p>
                    <p className={`text-[13px] font-bold tabular-nums ${h.stats.cagr > 0 ? "text-[#147a4f]" : "text-[#b42318]"}`}>{h.stats.cagr > 0 ? "+" : ""}{h.stats.cagr}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#bbb]">Sharpe</p>
                    <p className="text-[13px] font-bold tabular-nums text-[#0c1b38]">{h.stats.sharpeRatio}</p>
                  </div>
                  <span className="text-[11px] text-[#ccc]">→</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Parsing ───────────────────────────────────────────────────────────
const PARSE_STAGES = ["Reading strategy…","Extracting entry rules…","Extracting exit rules…","Identifying risk parameters…","Structuring assumptions…"];

function StepParsing() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStage(s => Math.min(s + 1, PARSE_STAGES.length - 1)), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-36 text-center">
      <div className="w-8 h-8 border-2 border-[#0c1b38] border-t-transparent rounded-full animate-spin mb-7" />
      <p className="text-[13px] font-semibold text-[#0c1b38] mb-2">{PARSE_STAGES[stage]}</p>
      <p className="text-[11px] text-[#bbb]">Analysing your strategy with AI…</p>
    </div>
  );
}

// ── Step 3: Assumptions ───────────────────────────────────────────────────────
const CATEGORY_ORDER = ["Universe","Entry","Exit","Position Sizing","Risk","Rebalance","Costs"];

function StepAssumptions({ config, onApprove, onBack }: { config: BacktestConfig; onApprove: (c: BacktestConfig) => void; onBack: () => void }) {
  const [assumptions, setAssumptions] = useState<Assumption[]>(config.assumptions);
  const [editing, setEditing]         = useState<string | null>(null);
  const [editVal, setEditVal]         = useState("");
  const [showNote, setShowNote]       = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, Assumption[]> = {};
    CATEGORY_ORDER.forEach(c => { map[c] = []; });
    assumptions.forEach(a => { (map[a.category] = map[a.category] || []).push(a); });
    return map;
  }, [assumptions]);

  const lowCount = assumptions.filter(a => a.confidence === "low").length;

  function startEdit(a: Assumption) { if (!a.editable) return; setEditing(a.id); setEditVal(a.value); }
  function saveEdit(id: string) {
    setAssumptions(prev => prev.map(a => a.id === id ? { ...a, value: editVal } : a));
    setEditing(null);
  }

  return (
    <div className="max-w-3xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38] mb-4">Step 2 — Review Assumptions</p>
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h2 className="text-[26px] font-light tracking-tight text-[#0a0a0a]" style={{ fontFamily: "var(--font-serif)" }}>{config.strategyName}</h2>
          <p className="text-[12px] text-[#888] mt-1.5">{assumptions.length} assumptions extracted · {config.startDate} → {config.endDate} · ${(config.initialCapital/1000).toFixed(0)}k initial capital</p>
        </div>
        <span className="border border-[#dce5ff] bg-[#f5f8ff] text-[#0c1b38] text-[10px] font-semibold px-2.5 py-1 uppercase tracking-[0.1em] shrink-0">{config.assetClass}</span>
      </div>
      {lowCount > 0 && (
        <div className="mb-5 flex items-start gap-3 border border-[#f0d89a] bg-[#fffbf0] px-4 py-3">
          <span className="text-[#b7791f] text-[12px] font-bold shrink-0">⚠</span>
          <p className="text-[12px] font-medium text-[#b7791f]">{lowCount} assumption{lowCount > 1 ? "s" : ""} marked <strong>low confidence</strong> — the AI inferred these from defaults. Review and edit before running.</p>
        </div>
      )}
      <div className="space-y-6 mb-8">
        {CATEGORY_ORDER.map(cat => {
          const items = grouped[cat] ?? [];
          if (!items.length) return null;
          return (
            <div key={cat}>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#888] mb-2">{cat}</p>
              <div className="border border-[#e8e3da] divide-y divide-[#f1eee8]">
                {items.map(a => (
                  <div key={a.id} className="flex items-start gap-4 px-4 py-3 hover:bg-[#fdfcfa] transition-colors">
                    <div className="w-36 shrink-0 pt-0.5"><p className="text-[12px] font-semibold text-[#0a0a0a]">{a.label}</p></div>
                    <div className="flex-1 min-w-0">
                      {editing === a.id ? (
                        <div className="flex items-center gap-2">
                          <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key==="Enter") saveEdit(a.id); if (e.key==="Escape") setEditing(null); }}
                            className="flex-1 border border-[#0c1b38] px-2 py-1 text-[12px] font-medium focus:outline-none" />
                          <button onClick={() => saveEdit(a.id)} className="text-[11px] font-semibold text-[#0c1b38] hover:underline">Save</button>
                          <button onClick={() => setEditing(null)} className="text-[11px] font-semibold text-[#999] hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <p className={`text-[12.5px] font-medium text-[#333] ${a.editable ? "cursor-pointer hover:text-[#0c1b38] hover:underline" : ""}`} onClick={() => startEdit(a)}>
                          {a.value}{a.editable && <span className="ml-2 text-[9.5px] text-[#ccc] font-normal">click to edit</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ConfidenceBadge level={a.confidence} />
                      {a.note && (
                        <div className="relative">
                          <button onClick={() => setShowNote(showNote === a.id ? null : a.id)} className="text-[#bbb] hover:text-[#0c1b38] transition-colors text-[13px]">ⓘ</button>
                          {showNote === a.id && (
                            <div className="absolute right-0 top-6 z-20 w-64 border border-[#e8e3da] bg-white shadow-lg p-3">
                              <p className="text-[11px] font-medium text-[#555] leading-relaxed">{a.note}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="px-5 py-2.5 border border-[#e8e8e8] text-[12px] font-semibold text-[#555] hover:border-[#0c1b38] transition-colors">← Edit description</button>
        <button onClick={() => onApprove({ ...config, assumptions })} className="px-7 py-2.5 bg-[#0c1b38] text-white text-[12px] font-semibold tracking-[0.08em] uppercase hover:bg-[#1a2f5e] transition-colors">
          Approve & Run Backtest →
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Running ───────────────────────────────────────────────────────────
const RUN_STAGES = [
  "Initialising simulation engine…","Generating 10 years of price history…",
  "Applying entry signals…","Enforcing stop-losses & exits…","Computing 20 performance statistics…",
  "Running 200 Monte Carlo paths…","Stress-testing against 6 crisis scenarios…",
  "Walk-forward out-of-sample analysis…","Parameter sensitivity grid search…",
  "Computing efficient frontier…","Calculating factor exposures…","Generating MD assessment…",
];

function StepRunning() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => Math.min(i + 1, RUN_STAGES.length - 1)), 700);
    return () => clearInterval(id);
  }, []);
  const pct = Math.round(((idx + 1) / RUN_STAGES.length) * 100);
  return (
    <div className="flex flex-col items-center justify-center py-36 text-center max-w-sm mx-auto">
      <div className="w-8 h-8 border-2 border-[#0c1b38] border-t-transparent rounded-full animate-spin mb-7" />
      <p className="text-[13px] font-semibold text-[#0c1b38] mb-5">{RUN_STAGES[idx]}</p>
      <div className="w-full bg-[#eee9df] h-[4px] mb-3">
        <div className="h-full bg-[#0c1b38] transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-[#bbb]">{pct}% complete</p>
    </div>
  );
}

// ── Stats Grid ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="border border-[#e8e3da] bg-white px-4 py-4">
      <MiniLabel>{label}</MiniLabel>
      <p className={`mt-1.5 text-[24px] font-bold tabular-nums leading-none ${color ?? "text-[#0a0a0a]"}`}>{value}</p>
      {sub && <p className="mt-1.5 text-[10.5px] font-medium text-[#999]">{sub}</p>}
    </div>
  );
}
function StatsGrid({ stats }: { stats: BacktestStats }) {
  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      <StatTile label="CAGR" value={`${stats.cagr > 0 ? "+" : ""}${stats.cagr}%`} sub={`vs. ${stats.benchmarkCagr}% benchmark`} color={stats.cagr > 0 ? "text-[#147a4f]" : "text-[#b42318]"} />
      <StatTile label="Sharpe Ratio" value={stats.sharpeRatio.toString()} sub={`Sortino: ${stats.sortinoRatio}`} color={stats.sharpeRatio >= 1 ? "text-[#147a4f]" : stats.sharpeRatio >= 0.5 ? "text-[#b7791f]" : "text-[#b42318]"} />
      <StatTile label="Max Drawdown" value={`${stats.maxDrawdown}%`} sub={`${stats.maxDrawdownDuration}d duration`} color="text-[#b42318]" />
      <StatTile label="Win Rate" value={`${stats.winRate}%`} sub={`${stats.totalTrades} periods`} />
      <StatTile label="Total Return" value={`${stats.totalReturn > 0 ? "+" : ""}${stats.totalReturn}%`} sub={`$100k → ${fmtUSD(100000 * (1 + stats.totalReturn/100))}`} color={stats.totalReturn > 0 ? "text-[#147a4f]" : "text-[#b42318]"} />
      <StatTile label="Alpha (ann.)" value={`${stats.alpha > 0 ? "+" : ""}${stats.alpha}%`} sub={`Beta: ${stats.beta}`} color={stats.alpha > 0 ? "text-[#147a4f]" : "text-[#b42318]"} />
      <StatTile label="Volatility" value={`${stats.volatility}%`} sub={`VaR 95%: ${stats.var95}%`} />
      <StatTile label="Calmar Ratio" value={stats.calmarRatio.toString()} sub={`Info Ratio: ${stats.informationRatio}`} color={stats.calmarRatio >= 0.5 ? "text-[#147a4f]" : "text-[#b7791f]"} />
    </div>
  );
}

// ── Equity Curve with Regime overlay ─────────────────────────────────────────
const REGIME_COLORS: Record<RegimeType, string> = {
  bull:     "rgba(20,122,79,0.06)",
  bear:     "rgba(180,35,24,0.07)",
  highVol:  "rgba(183,121,31,0.08)",
  sideways: "rgba(156,163,175,0.05)",
};
const REGIME_LABELS: Record<RegimeType, string> = {
  bull: "Bull", bear: "Bear", highVol: "High Vol", sideways: "Sideways",
};

function EquityCurveChart({ data, regimes }: { data: EquityPoint[]; regimes: RegimeSegment[] }) {
  const thinned = data.filter((_, i) => i % 4 === 0);
  return (
    <Card className="p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Equity Curve</SectionLabel>
        <div className="flex items-center gap-5 flex-wrap">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0c1b38]"><span className="w-5 h-0.5 bg-[#0c1b38] inline-block" />Strategy</span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#9ca3af]"><span className="w-5 border-t border-dashed border-[#9ca3af] inline-block" />Benchmark</span>
          {(["bull","bear","highVol","sideways"] as RegimeType[]).map(r => (
            <span key={r} className="flex items-center gap-1.5 text-[10px] font-semibold text-[#888]">
              <span className="w-2.5 h-2.5 inline-block border border-[#ddd]" style={{ backgroundColor: REGIME_COLORS[r] }} />{REGIME_LABELS[r]}
            </span>
          ))}
        </div>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={thinned} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="#f0ece4" vertical={false} />
            {regimes.map((seg, i) => {
              const startDate = data[seg.startIdx]?.date;
              const endDate   = data[Math.min(seg.endIdx, data.length-1)]?.date;
              if (!startDate || !endDate) return null;
              return <ReferenceArea key={i} x1={startDate} x2={endDate} fill={REGIME_COLORS[seg.regime]} />;
            })}
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#999" }}
              tickFormatter={v => { const d = new Date(v); return `${d.toLocaleString("en",{month:"short"})} '${String(d.getFullYear()).slice(2)}`; }}
              interval={Math.floor(thinned.length / 8)} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#999" }} tickFormatter={fmtUSD} width={60} />
            <Tooltip contentStyle={{ border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 11 }}
              formatter={(v: unknown, n: unknown) => [fmtUSD(Number(v)), String(n)]} labelFormatter={l => `Week of ${l}`} />
            <Line type="monotone" dataKey="portfolio" name="Strategy" stroke={NAVY} strokeWidth={2.2} dot={false} />
            <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke={MUTED} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ── Drawdown chart ─────────────────────────────────────────────────────────────
function DrawdownChart({ data }: { data: DrawdownPoint[] }) {
  const thinned = data.filter((_, i) => i % 4 === 0);
  const maxDD = Math.min(...thinned.map(d => d.drawdown));
  return (
    <Card className="p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>Drawdown</SectionLabel>
        <span className="text-[11px] font-bold text-[#b42318]">Peak-to-trough: {(maxDD*100).toFixed(1)}%</span>
      </div>
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={thinned} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={RED} stopOpacity={0.3} />
                <stop offset="95%" stopColor={RED} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f0ece4" vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#999" }}
              tickFormatter={v => { const d = new Date(v); return `${d.toLocaleString("en",{month:"short"})} '${String(d.getFullYear()).slice(2)}`; }}
              interval={Math.floor(thinned.length / 6)} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#999" }} tickFormatter={v => `${(Number(v)*100).toFixed(0)}%`} />
            <Tooltip contentStyle={{ border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 11 }}
              formatter={(v: unknown) => [`${(Number(v)*100).toFixed(2)}%`, "Drawdown"]} />
            <ReferenceLine y={0} stroke="#e0dcd4" />
            <Area type="monotone" dataKey="drawdown" stroke={RED} strokeWidth={1.5} fill="url(#ddGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ── P&L Attribution Waterfall ─────────────────────────────────────────────────
function WaterfallChart({ attribution, totalCagr }: { attribution: PnLAttribution; totalCagr: number }) {
  const items = [
    { name: "Market Beta",  value: attribution.marketBeta, color: MUTED },
    { name: "Selection α",  value: attribution.selection,  color: attribution.selection  >= 0 ? GREEN : RED },
    { name: "Timing",       value: attribution.timing,     color: attribution.timing     >= 0 ? GREEN : RED },
    { name: "Cost Drag",    value: attribution.costs,      color: RED },
    { name: "Stop-Loss",    value: attribution.stopLoss,   color: attribution.stopLoss   >= 0 ? GREEN : AMBER },
  ];
  // Running bar positions for waterfall
  let running = 0;
  const bars = items.map(item => {
    const start = running;
    running += item.value;
    return { ...item, start, end: running };
  });

  const allVals = [0, ...bars.map(b => b.end), totalCagr];
  const minVal  = Math.min(...allVals) - 1;
  const maxVal  = Math.max(...allVals) + 1;

  return (
    <Card className="p-5 mb-4">
      <div className="mb-4">
        <SectionLabel>P&L Attribution — Return Decomposition</SectionLabel>
        <p className="text-[11px] text-[#888] mt-1">Waterfall breakdown of total CAGR by source · Bloomberg PORT methodology</p>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[...bars, { name: "Total CAGR", value: totalCagr, start: 0, end: totalCagr, color: NAVY }]}
            margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="#f0ece4" vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#555" }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#999" }}
              tickFormatter={v => `${Number(v).toFixed(1)}%`} domain={[minVal, maxVal]} />
            <Tooltip contentStyle={{ border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 11 }}
              formatter={(v: unknown, n: unknown, p: { payload?: { value?: number } }) => {
                const val = p?.payload?.value ?? Number(v);
                return [`${val > 0 ? "+" : ""}${Number(val).toFixed(2)}%`, String(n)];
              }} />
            <ReferenceLine y={0} stroke="#e0dcd4" />
            {/* Invisible baseline bar for waterfall offset */}
            <Bar dataKey="start" stackId="w" fill="transparent" />
            <Bar dataKey="value" stackId="w" name="Contribution">
              {[...bars, { name: "Total CAGR", value: totalCagr, color: NAVY }].map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {items.map(item => (
          <div key={item.name} className="flex items-center gap-2">
            <span className="w-3 h-3 flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-[10.5px] font-semibold text-[#555]">{item.name}</span>
            <span className={`text-[10.5px] font-bold tabular-nums ${item.value >= 0 ? "text-[#147a4f]" : "text-[#b42318]"}`}>{item.value >= 0 ? "+" : ""}{item.value.toFixed(2)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Monthly Heatmap ────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function monthColor(r: number) {
  if (r >  5) return "#0d6641"; if (r >  3) return "#147a4f";
  if (r >  1) return "#5aad85"; if (r >  0) return "#c6e8d6";
  if (r > -1) return "#f9d5d0"; if (r > -3) return "#e07060";
  if (r > -5) return "#c03a2b"; return "#8b1a10";
}
function monthTC(r: number) { return Math.abs(r) > 1 ? "white" : NAVY; }

function MonthlyHeatmap({ data }: { data: MonthlyReturn[] }) {
  const years = [...new Set(data.map(d => d.year))].sort();
  const byYear: Record<number, Record<number, number>> = {};
  years.forEach(y => { byYear[y] = {}; });
  data.forEach(d => { if (byYear[d.year]) byYear[d.year][d.month] = d.return; });
  return (
    <Card className="p-5 mb-4">
      <SectionLabel>Monthly Returns</SectionLabel>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-center border-collapse" style={{ minWidth: 680 }}>
          <thead>
            <tr>
              <th className="text-[9.5px] font-bold text-[#888] pr-3 text-left w-12">Year</th>
              {MONTHS.map(m => <th key={m} className="text-[9.5px] font-bold text-[#888] w-10 pb-1">{m}</th>)}
              <th className="text-[9.5px] font-bold text-[#888] pl-2">Ann.</th>
            </tr>
          </thead>
          <tbody>
            {years.map(y => {
              const mData = byYear[y];
              const annRet = Object.values(mData).reduce((acc, r) => acc * (1 + r/100), 1) - 1;
              return (
                <tr key={y}>
                  <td className="text-[11px] font-bold text-[#0a0a0a] pr-3 text-left py-0.5">{y}</td>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(mo => {
                    const r = mData[mo];
                    return (
                      <td key={mo} className="py-0.5 px-0.5">
                        {r !== undefined
                          ? <div className="h-8 flex items-center justify-center text-[9.5px] font-bold tabular-nums" style={{ backgroundColor: monthColor(r), color: monthTC(r) }}>{r > 0 ? "+" : ""}{r.toFixed(1)}</div>
                          : <div className="h-8 bg-[#f5f5f5]" />}
                      </td>
                    );
                  })}
                  <td className="pl-2">
                    <div className="h-8 flex items-center justify-center text-[9.5px] font-bold tabular-nums border border-[#e8e3da]" style={{ color: annRet > 0 ? GREEN : RED }}>
                      {annRet > 0 ? "+" : ""}{(annRet*100).toFixed(1)}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Trade Log ──────────────────────────────────────────────────────────────────
type SortKey = keyof TradeRecord;
function TradeLog({ trades }: { trades: TradeRecord[] }) {
  const [page, setPage] = useState(0);
  const [sk, setSk] = useState<SortKey>("entryDate");
  const [dir, setDir] = useState<1|-1>(-1);
  const PER = 15;
  const sorted = useMemo(() =>
    [...trades].sort((a, b) => {
      const av = a[sk], bv = b[sk];
      return typeof av === "string" ? dir * av.localeCompare(String(bv)) : dir * (Number(av) - Number(bv));
    }), [trades, sk, dir]);
  const pageData = sorted.slice(page * PER, (page+1)*PER);
  const pages = Math.ceil(trades.length / PER);
  function toggleSort(k: SortKey) { if (k===sk) setDir(d => d===1 ? -1 : 1); else { setSk(k); setDir(-1); } }
  function exportCSV() {
    const blob = new Blob([["Ticker,Entry,Exit,Entry$,Exit$,Return%,Days,P&L", ...trades.map(t=>[t.ticker,t.entryDate,t.exitDate,t.entryPrice,t.exitPrice,t.returnPct,t.holdingDays,t.pnl].join(","))].join("\n")], { type:"text/csv" });
    Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:"trades.csv"}).click();
  }
  const Th = ({ k, l }: { k: SortKey; l: string }) => (
    <th className="px-3 py-2.5 text-left cursor-pointer hover:text-[#0c1b38] text-[9px] font-bold uppercase tracking-[0.16em] text-[#888]" onClick={() => toggleSort(k)}>
      {l}{sk===k ? (dir===-1 ? " ↓":" ↑") : ""}
    </th>
  );
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <SectionLabel>Trade Log</SectionLabel>
          <p className="text-[11px] text-[#888] mt-1">{trades.length} trades · Win rate {((trades.filter(t=>t.returnPct>0).length/trades.length)*100).toFixed(1)}% · Avg hold {Math.round(trades.reduce((a,t)=>a+t.holdingDays,0)/trades.length)}d</p>
        </div>
        <button onClick={exportCSV} className="text-[11px] font-semibold text-[#888] hover:text-[#0c1b38] border border-[#e8e8e8] px-3 py-1.5">Export CSV ↓</button>
      </div>
      <div className="overflow-x-auto border border-[#e8e3da]">
        <table className="w-full text-left">
          <thead className="bg-[#fbfaf7] border-b border-[#e8e3da]">
            <tr><Th k="ticker" l="Ticker" /><Th k="entryDate" l="Entry" /><Th k="exitDate" l="Exit" /><Th k="entryPrice" l="Entry$" /><Th k="exitPrice" l="Exit$" /><Th k="returnPct" l="Return" /><Th k="holdingDays" l="Days" /><Th k="pnl" l="P&L" /></tr>
          </thead>
          <tbody>
            {pageData.map((t, i) => (
              <tr key={i} className="border-b border-[#f1eee8] last:border-0 hover:bg-[#fdfcfa]">
                <td className="px-3 py-2.5 text-[12px] font-bold text-[#0a0a0a]">{t.ticker}</td>
                <td className="px-3 py-2.5 text-[11.5px] text-[#666]">{t.entryDate}</td>
                <td className="px-3 py-2.5 text-[11.5px] text-[#666]">{t.exitDate}</td>
                <td className="px-3 py-2.5 text-[11.5px] tabular-nums text-[#555]">${t.entryPrice.toFixed(2)}</td>
                <td className="px-3 py-2.5 text-[11.5px] tabular-nums text-[#555]">${t.exitPrice.toFixed(2)}</td>
                <td className={`px-3 py-2.5 text-[12px] font-bold tabular-nums ${t.returnPct>0?"text-[#147a4f]":"text-[#b42318]"}`}>{t.returnPct>0?"+":""}{t.returnPct.toFixed(2)}%</td>
                <td className="px-3 py-2.5 text-[11.5px] tabular-nums text-[#555]">{t.holdingDays}d</td>
                <td className={`px-3 py-2.5 text-[12px] font-bold tabular-nums ${t.pnl>0?"text-[#147a4f]":"text-[#b42318]"}`}>{t.pnl>0?"+":""}${t.pnl.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-[11px] text-[#888]">Page {page+1} of {pages}</p>
          <div className="flex gap-2">
            <button disabled={page===0} onClick={() => setPage(p=>p-1)} className="text-[11px] font-semibold text-[#555] disabled:opacity-30 px-2 py-1 border border-[#e8e8e8]">← Prev</button>
            <button disabled={page>=pages-1} onClick={() => setPage(p=>p+1)} className="text-[11px] font-semibold text-[#555] disabled:opacity-30 px-2 py-1 border border-[#e8e8e8]">Next →</button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Monte Carlo ────────────────────────────────────────────────────────────────
function MonteCarloChart({ data, initialCapital }: { data: MCPoint[]; initialCapital: number }) {
  const final = data.at(-1);
  return (
    <Card className="p-5 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <SectionLabel>Monte Carlo Simulation</SectionLabel>
          <p className="text-[11px] text-[#888] mt-1">200 bootstrap paths · Percentile bands shown</p>
        </div>
        {final && (
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#888]">Median outcome</p>
            <p className="text-[16px] font-bold text-[#0c1b38]">{fmtUSD(final.p50)}</p>
            <p className="text-[10px] text-[#999]">P5: {fmtUSD(final.p5)} · P95: {fmtUSD(final.p95)}</p>
          </div>
        )}
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="#f0ece4" vertical={false} />
            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#999" }} tickFormatter={w => `Wk ${w}`} interval={Math.floor(data.length/6)} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#999" }} tickFormatter={fmtUSD} width={60} />
            <Tooltip contentStyle={{ border: `1px solid ${BORDER}`, borderRadius: 0, fontSize: 11 }} formatter={(v: unknown, n: unknown) => [fmtUSD(Number(v)), String(n)]} />
            <Area type="monotone" dataKey="p95" stroke="none" fill={`${NAVY}0f`} name="P95" />
            <Area type="monotone" dataKey="p5" stroke="none" fill="white" name="P5" />
            <Area type="monotone" dataKey="p75" stroke="none" fill={`${NAVY}22`} name="P75" />
            <Area type="monotone" dataKey="p25" stroke="none" fill="white" name="P25" />
            <Line type="monotone" dataKey="p50" stroke={NAVY} strokeWidth={2} dot={false} name="Median (P50)" />
            <ReferenceLine y={initialCapital} stroke="#e0dcd4" strokeDasharray="4 2" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ── Stress Tests ───────────────────────────────────────────────────────────────
function StressTestPanel({ tests }: { tests: StressTest[] }) {
  const vs = { better: { text:"↑ Outperformed", cls:"text-[#147a4f] bg-[#f0fbf5] border-[#b8e6ce]" }, similar: { text:"≈ In-line", cls:"text-[#b7791f] bg-[#fffbf0] border-[#f0d89a]" }, worse: { text:"↓ Underperformed", cls:"text-[#b42318] bg-[#fff5f4] border-[#f5c6c0]" } };
  return (
    <Card className="p-5 mb-4">
      <SectionLabel>Historical Stress Tests</SectionLabel>
      <p className="text-[11px] text-[#888] mt-1 mb-5">Simulated strategy performance during crisis regimes</p>
      <div className="border border-[#e8e3da] divide-y divide-[#f1eee8]">
        {tests.map(t => {
          const v = vs[t.verdict];
          return (
            <div key={t.name} className="px-4 py-4 hover:bg-[#fdfcfa]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-[13px] font-bold text-[#0a0a0a]">{t.name}</p>
                    <span className={`border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${v.cls}`}>{v.text}</span>
                  </div>
                  <p className="text-[11px] text-[#888] mb-2">{t.period} · {t.context}</p>
                  <div className="flex items-center gap-6">
                    {[["Benchmark",String(t.benchmarkReturn)+"%","text-[#b42318]"],["Strategy",String(t.strategyReturn)+"%",t.strategyReturn<t.benchmarkReturn?"text-[#147a4f]":"text-[#b42318]"],["Max DD",String(t.maxDrawdown)+"%","text-[#b42318]"],["Recovery",`${t.recoveryMonths}mo`,"text-[#0c1b38]"]].map(([l,v,c]) => (
                      <div key={l}><p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#999] mb-0.5">{l}</p><p className={`text-[13px] font-bold tabular-nums ${c}`}>{v}</p></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Rolling Metrics ────────────────────────────────────────────────────────────
function RollingMetricsChart({ data }: { data: RollingPoint[] }) {
  return (
    <Card className="p-5 mb-4">
      <SectionLabel>Rolling 12-Month Metrics</SectionLabel>
      <div className="grid grid-cols-2 gap-4 mt-5">
        <div>
          <p className="text-[10px] font-semibold text-[#888] mb-2">Rolling Sharpe Ratio</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
                <CartesianGrid stroke="#f0ece4" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#999" }} />
                <Tooltip contentStyle={{ border:`1px solid ${BORDER}`, borderRadius:0, fontSize:10 }} formatter={(v:unknown)=>[Number(v).toFixed(2),"Sharpe"]} />
                <ReferenceLine y={1} stroke={GREEN} strokeDasharray="3 2" />
                <ReferenceLine y={0} stroke="#e0dcd4" />
                <Line type="monotone" dataKey="rollingSharpe" stroke={NAVY} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-[#888] mb-2">Rolling 12-Month Return</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
                <CartesianGrid stroke="#f0ece4" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#999" }} tickFormatter={v => `${Number(v).toFixed(0)}%`} />
                <Tooltip contentStyle={{ border:`1px solid ${BORDER}`, borderRadius:0, fontSize:10 }} formatter={(v:unknown)=>[`${Number(v).toFixed(1)}%`,"Return"]} />
                <ReferenceLine y={0} stroke="#e0dcd4" />
                <Bar dataKey="rollingReturn" radius={[1,1,0,0]}>
                  {data.map((d, i) => <Cell key={i} fill={d.rollingReturn >= 0 ? GREEN : RED} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Factor Exposures ───────────────────────────────────────────────────────────
function FactorExposureChart({ factors }: { factors: FactorExposure[] }) {
  const sorted = [...factors].sort((a,b) => Math.abs(b.exposure)-Math.abs(a.exposure));
  return (
    <Card className="p-5 mb-4">
      <SectionLabel>Factor Exposures</SectionLabel>
      <p className="text-[11px] text-[#888] mt-1 mb-5">Multi-factor OLS decomposition</p>
      <div className="space-y-3">
        {sorted.map(f => (
          <div key={f.factor}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-semibold text-[#0a0a0a]">{f.factor}</p>
                {f.significant && <span className="text-[8.5px] font-bold border border-[#dce5ff] text-[#0c1b38] px-1.5 py-0.5">SIG</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[12px] font-bold tabular-nums ${f.exposure>0?"text-[#147a4f]":"text-[#b42318]"}`}>{f.exposure>0?"+":""}{f.exposure.toFixed(2)}</span>
                <span className="text-[10px] text-[#999]">t={f.tStat.toFixed(1)}</span>
              </div>
            </div>
            <div className="relative h-[6px] bg-[#eee9df]">
              <div className="absolute top-0 h-full" style={{ left: f.exposure>=0 ? "50%" : `${50-Math.min(50,Math.abs(f.exposure)*40)}%`, width: `${Math.min(50,Math.abs(f.exposure)*40)}%`, backgroundColor: f.exposure>=0 ? NAVY : RED }} />
              <div className="absolute top-0 h-full w-px bg-[#ccc]" style={{ left: "50%" }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── VaR Panel ──────────────────────────────────────────────────────────────────
function VaRPanel({ stats }: { stats: BacktestStats }) {
  return (
    <Card className="p-5 mb-4">
      <SectionLabel>Risk Metrics</SectionLabel>
      <div className="mt-5 space-y-5">
        <div><div className="flex items-center justify-between mb-1"><p className="text-[12px] font-semibold">Value at Risk (95%)</p><p className="text-[14px] font-bold text-[#b42318] tabular-nums">{stats.var95.toFixed(2)}%</p></div><p className="text-[11px] text-[#888]">On 5% of weeks, loss exceeds this threshold</p></div>
        <div><div className="flex items-center justify-between mb-1"><p className="text-[12px] font-semibold">CVaR / Expected Shortfall (95%)</p><p className="text-[14px] font-bold text-[#b42318] tabular-nums">{stats.cvar95.toFixed(2)}%</p></div><p className="text-[11px] text-[#888]">Average loss in the worst 5% of weeks</p></div>
        <div className="border-t border-[#f1eee8] pt-4 grid grid-cols-2 gap-4">
          {[
            { l:"Skewness", v:stats.skewness.toFixed(2), n:stats.skewness>0?"Positive — right tail":"Negative — left tail risk", c:stats.skewness<-0.5?"text-[#b42318]":stats.skewness>0.3?"text-[#147a4f]":"text-[#555]" },
            { l:"Excess Kurtosis", v:stats.excessKurtosis.toFixed(2), n:Math.abs(stats.excessKurtosis)>1?"Fat tails present":"Near-normal distribution", c:Math.abs(stats.excessKurtosis)>1.5?"text-[#b7791f]":"text-[#555]" },
            { l:"Profit Factor", v:stats.profitFactor.toFixed(2), n:"Gross profit / gross loss", c:stats.profitFactor>1.5?"text-[#147a4f]":"text-[#b7791f]" },
            { l:"Avg Win / Loss", v:`${stats.avgWin.toFixed(1)}% / ${stats.avgLoss.toFixed(1)}%`, n:"Per-period win vs loss", c:"text-[#555]" },
          ].map(m => (
            <div key={m.l}><MiniLabel>{m.l}</MiniLabel><p className={`mt-1 text-[14px] font-bold tabular-nums ${m.c}`}>{m.v}</p><p className="mt-0.5 text-[10px] text-[#999]">{m.n}</p></div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── NEW: Walk-Forward Chart ────────────────────────────────────────────────────
function WalkForwardChart({ data }: { data: WalkForwardPeriod[] }) {
  if (!data.length) return <Card className="p-5 mb-4"><SectionLabel>Walk-Forward Analysis</SectionLabel><p className="text-[11px] text-[#888] mt-3">Insufficient history for walk-forward analysis (requires ≥ 4 years of data).</p></Card>;
  const overfitCount = data.filter(d => d.overfit).length;
  return (
    <Card className="p-5 mb-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <SectionLabel>Walk-Forward Analysis</SectionLabel>
          <p className="text-[11px] text-[#888] mt-1">2-year in-sample → 1-year out-of-sample · Detects overfitting · QuantConnect methodology</p>
        </div>
        {overfitCount > 0
          ? <span className="border border-[#f5c6c0] bg-[#fff5f4] text-[#b42318] text-[9px] font-bold px-2.5 py-1 uppercase tracking-[0.1em] shrink-0">{overfitCount} overfit period{overfitCount>1?"s":""}</span>
          : <span className="border border-[#b8e6ce] bg-[#f0fbf5] text-[#147a4f] text-[9px] font-bold px-2.5 py-1 uppercase tracking-[0.1em] shrink-0">No overfit detected</span>
        }
      </div>
      <div className="h-[220px] mt-5">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: -15 }} barGap={2}>
            <CartesianGrid stroke="#f0ece4" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#555" }} angle={-30} textAnchor="end" interval={0} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#999" }} tickFormatter={v => `${Number(v).toFixed(1)}`} />
            <Tooltip contentStyle={{ border:`1px solid ${BORDER}`, borderRadius:0, fontSize:11 }}
              formatter={(v: unknown, n: unknown) => [`${Number(v).toFixed(2)}`, String(n)]}
              labelFormatter={l => `Period: ${l}`} />
            <ReferenceLine y={1} stroke={GREEN} strokeDasharray="3 2" strokeWidth={1} />
            <ReferenceLine y={0} stroke="#e0dcd4" />
            <Bar dataKey="inSampleSharpe" name="In-Sample Sharpe" fill={NAVY} fillOpacity={0.85} />
            <Bar dataKey="outSampleSharpe" name="Out-of-Sample Sharpe">
              {data.map((d, i) => <Cell key={i} fill={d.overfit ? RED : GREEN} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex items-start gap-6 flex-wrap">
        <div className="flex items-center gap-2"><span className="w-4 h-3 bg-[#0c1b38]" /><span className="text-[10.5px] font-semibold text-[#555]">In-Sample Sharpe (2yr IS)</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-3 bg-[#147a4f]" /><span className="text-[10.5px] font-semibold text-[#555]">Out-of-Sample Sharpe — Holds</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-3 bg-[#b42318]" /><span className="text-[10.5px] font-semibold text-[#555]">Out-of-Sample — Overfit collapse</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-px border-t border-dashed border-[#147a4f]" /><span className="text-[10.5px] font-semibold text-[#555]">Sharpe = 1.0 threshold</span></div>
      </div>
      {overfitCount > 0 && (
        <div className="mt-4 flex items-start gap-2 border border-[#f0d89a] bg-[#fffbf0] px-3 py-2.5">
          <span className="text-[#b7791f] font-bold shrink-0 text-[12px]">⚑</span>
          <p className="text-[11px] font-medium text-[#b7791f]">Overfitting signal detected in {overfitCount} period{overfitCount>1?"s":""}. The strategy's in-sample Sharpe materially exceeds out-of-sample performance, suggesting parameter optimisation is fitting to noise rather than signal. Consider simplifying the strategy rules or widening stop-loss bands.</p>
        </div>
      )}
    </Card>
  );
}

// ── NEW: Parameter Sensitivity Heatmap ────────────────────────────────────────
function ParamSensHeatmap({ data }: { data: ParamSensCell[] }) {
  const stopLossVals = [...new Set(data.map(d => d.stopLoss))].sort((a,b)=>a-b);
  const posCountVals = [...new Set(data.map(d => d.positionCount))].sort((a,b)=>a-b);
  const allSharpes   = data.map(d => d.sharpe);
  const minS = Math.min(...allSharpes), maxS = Math.max(...allSharpes);

  function cellColor(s: number) {
    const t = (s - minS) / (maxS - minS + 0.001);
    if (t > 0.75) return { bg: "#0d6641", text: "white" };
    if (t > 0.55) return { bg: "#147a4f", text: "white" };
    if (t > 0.40) return { bg: "#5aad85", text: "white" };
    if (t > 0.25) return { bg: "#c6e8d6", text: NAVY };
    if (t > 0.12) return { bg: "#f9d5d0", text: NAVY };
    if (t > 0.04) return { bg: "#e07060", text: "white" };
    return { bg: "#b42318", text: "white" };
  }

  function getCell(sl: number, pc: number) {
    return data.find(d => d.stopLoss === sl && d.positionCount === pc);
  }

  const maxSharpeCell = data.reduce((best, d) => d.sharpe > best.sharpe ? d : best, data[0]);

  return (
    <Card className="p-5 mb-4">
      <div className="mb-4">
        <SectionLabel>Parameter Sensitivity — Sharpe Heatmap</SectionLabel>
        <p className="text-[11px] text-[#888] mt-1">25-run grid: stop-loss % × position count · Green = high Sharpe · MSCI BarraOne methodology</p>
      </div>
      <div className="flex items-start gap-6">
        <div className="flex-1 overflow-x-auto">
          <table className="border-collapse text-center">
            <thead>
              <tr>
                <th className="text-[9px] font-bold text-[#888] pr-3 pb-2 text-left">Stop-Loss → <br />Positions ↓</th>
                {posCountVals.map(pc => <th key={pc} className="text-[9px] font-bold text-[#888] px-1 pb-2 w-16">{pc} pos</th>)}
              </tr>
            </thead>
            <tbody>
              {stopLossVals.map(sl => (
                <tr key={sl}>
                  <td className="text-[10px] font-bold text-[#555] pr-3 py-0.5 text-left">{sl}% SL</td>
                  {posCountVals.map(pc => {
                    const cell = getCell(sl, pc);
                    if (!cell) return <td key={pc} />;
                    const { bg, text } = cellColor(cell.sharpe);
                    const isMax = cell.stopLoss === maxSharpeCell.stopLoss && cell.positionCount === maxSharpeCell.positionCount;
                    return (
                      <td key={pc} className="px-0.5 py-0.5">
                        <div className="h-10 w-14 flex flex-col items-center justify-center text-[9.5px] font-bold tabular-nums relative"
                          style={{ backgroundColor: bg, color: text, border: isMax ? `2px solid ${NAVY}` : "none" }}>
                          {cell.sharpe.toFixed(2)}
                          {isMax && <span className="text-[7px] mt-0.5">★ best</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="shrink-0 w-44 border border-[#e8e3da] p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#888] mb-3">Optimal Parameters</p>
          <div className="space-y-2">
            <div><MiniLabel>Stop-Loss</MiniLabel><p className="text-[14px] font-bold text-[#0c1b38]">{maxSharpeCell.stopLoss}%</p></div>
            <div><MiniLabel>Positions</MiniLabel><p className="text-[14px] font-bold text-[#0c1b38]">{maxSharpeCell.positionCount}</p></div>
            <div><MiniLabel>Best Sharpe</MiniLabel><p className="text-[14px] font-bold text-[#147a4f]">{maxSharpeCell.sharpe.toFixed(2)}</p></div>
            <div><MiniLabel>Best CAGR</MiniLabel><p className="text-[14px] font-bold text-[#147a4f]">{maxSharpeCell.cagr.toFixed(1)}%</p></div>
          </div>
          <p className="text-[9.5px] text-[#888] mt-3 leading-relaxed">Sharpe range: {minS.toFixed(2)} – {maxS.toFixed(2)}. Range width = {(maxS-minS).toFixed(2)}. {(maxS-minS) > 0.5 ? "High sensitivity to parameters." : "Robust across parameter space."}</p>
        </div>
      </div>
    </Card>
  );
}

// ── NEW: Efficient Frontier ────────────────────────────────────────────────────
function EfficientFrontierChart({ data }: { data: EfficientFrontierPoint[] }) {
  const current  = data.find(d => d.current);
  const maxSharp = data.find(d => d.maxSharpe);
  const minRisk  = data.find(d => d.minRisk);
  const normal   = data.filter(d => !d.current && !d.maxSharpe && !d.minRisk);

  const CustomDot = (props: { cx?: number; cy?: number; payload?: EfficientFrontierPoint }) => {
    const { cx = 0, cy = 0, payload } = props;
    if (!payload) return null;
    if (payload.current)  return <circle cx={cx} cy={cy} r={7} fill={NAVY} stroke="white" strokeWidth={2} />;
    if (payload.maxSharpe) return <polygon points={`${cx},${cy-8} ${cx+7},${cy+5} ${cx-7},${cy+5}`} fill={GREEN} stroke="white" strokeWidth={1.5} />;
    if (payload.minRisk)  return <rect x={cx-5} y={cy-5} width={10} height={10} fill={AMBER} stroke="white" strokeWidth={1.5} />;
    const t = (payload.sharpe + 0.5) / 2.5;
    const alpha = Math.max(0.06, Math.min(0.45, t * 0.45));
    return <circle cx={cx} cy={cy} r={3} fill={NAVY} fillOpacity={alpha} />;
  };

  return (
    <Card className="p-5 mb-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <SectionLabel>Efficient Frontier</SectionLabel>
          <p className="text-[11px] text-[#888] mt-1">700 simulated portfolios across 6 asset classes · Markowitz MVO · Bloomberg PORT methodology</p>
        </div>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: -5 }}>
            <CartesianGrid stroke="#f0ece4" />
            <XAxis type="number" dataKey="risk" name="Volatility" axisLine={false} tickLine={false}
              tick={{ fontSize: 10, fill: "#999" }} tickFormatter={v => `${Number(v).toFixed(0)}%`}
              label={{ value: "Annualised Volatility (%)", position: "insideBottom", offset: -10, fontSize: 10, fill: "#999" }} />
            <YAxis type="number" dataKey="return" name="Return" axisLine={false} tickLine={false}
              tick={{ fontSize: 10, fill: "#999" }} tickFormatter={v => `${Number(v).toFixed(0)}%`}
              label={{ value: "Expected Return (%)", angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fill: "#999" }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ border:`1px solid ${BORDER}`, borderRadius:0, fontSize:11 }}
              formatter={(v: unknown, n: unknown) => [`${Number(v).toFixed(2)}%`, String(n)]} />
            <Scatter data={normal} shape={<CustomDot />} name="Portfolios" />
            {current  && <Scatter data={[current]}  shape={<CustomDot />} name="Your Strategy" />}
            {maxSharp && <Scatter data={[maxSharp]} shape={<CustomDot />} name="Max Sharpe" />}
            {minRisk  && <Scatter data={[minRisk]}  shape={<CustomDot />} name="Min Risk" />}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-5">
        <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-[#0c1b38] border-2 border-white shadow" /><span className="text-[10.5px] font-semibold text-[#555]">Your Strategy (current params)</span></div>
        <div className="flex items-center gap-2"><span className="text-[#147a4f] text-[14px] font-bold">▲</span><span className="text-[10.5px] font-semibold text-[#555]">Max Sharpe Portfolio{maxSharp ? ` — ${maxSharp.return.toFixed(1)}% / ${maxSharp.risk.toFixed(1)}% vol` : ""}</span></div>
        <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 bg-[#b7791f]" /><span className="text-[10.5px] font-semibold text-[#555]">Min Variance Portfolio{minRisk ? ` — ${minRisk.risk.toFixed(1)}% vol` : ""}</span></div>
        {current && maxSharp && (
          <p className="w-full text-[11px] font-medium text-[#555] border-t border-[#f1eee8] pt-3 mt-1">
            {current.sharpe < maxSharp.sharpe
              ? `★ The Max Sharpe portfolio offers ${(maxSharp.sharpe - current.sharpe).toFixed(2)} higher Sharpe than your current strategy. Consider reallocating ${((maxSharp.return - current.return)).toFixed(1)}% expected return gain at ${Math.abs(maxSharp.risk - current.risk).toFixed(1)}% ${maxSharp.risk < current.risk ? "lower" : "higher"} volatility.`
              : `Your strategy sits on or near the efficient frontier — risk/return is well-calibrated.`}
          </p>
        )}
      </div>
    </Card>
  );
}

// ── NEW: Correlation Matrix ────────────────────────────────────────────────────
function CorrelationMatrix({ data }: { data: AssetCorrelation[] }) {
  function corrColor(r: number) {
    if (r > 0.7)  return { bg: "#0d6641", text: "white" };
    if (r > 0.4)  return { bg: "#5aad85", text: "white" };
    if (r > 0.1)  return { bg: "#c6e8d6", text: NAVY };
    if (r > -0.1) return { bg: "#f5f5f5", text: "#888" };
    if (r > -0.4) return { bg: "#f9d5d0", text: NAVY };
    return { bg: "#b42318", text: "white" };
  }
  const regimeSets: { key: "fullPeriod" | "bullRegime" | "bearRegime"; label: string }[] = [
    { key: "fullPeriod", label: "Full Period" },
    { key: "bullRegime", label: "Bull Market" },
    { key: "bearRegime", label: "Bear Market" },
  ];
  return (
    <Card className="p-5 mb-4">
      <div className="mb-4">
        <SectionLabel>Asset Correlations — Time-Varying</SectionLabel>
        <p className="text-[11px] text-[#888] mt-1">Strategy return correlations vs major asset classes · Regime-conditional · MSCI BarraOne methodology</p>
      </div>
      <div className="overflow-x-auto mb-5">
        <table className="border-collapse text-center" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              <th className="text-[9px] font-bold text-[#888] text-left pr-4 pb-2">Asset Class</th>
              {regimeSets.map(r => <th key={r.key} className="text-[9px] font-bold text-[#888] px-3 pb-2 w-28">{r.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map(asset => (
              <tr key={asset.asset}>
                <td className="text-[12px] font-semibold text-[#0a0a0a] text-left pr-4 py-0.5">{asset.asset}</td>
                {regimeSets.map(r => {
                  const val = asset[r.key];
                  const { bg, text } = corrColor(val);
                  return (
                    <td key={r.key} className="px-1 py-0.5">
                      <div className="h-8 w-full flex items-center justify-center text-[11px] font-bold tabular-nums" style={{ backgroundColor: bg, color: text }}>
                        {val > 0 ? "+" : ""}{val.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Rolling correlation sparklines for top 3 assets */}
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#888] mb-3">Rolling 26-Week Correlation</p>
      <div className="grid grid-cols-3 gap-3">
        {data.slice(0, 3).map(asset => (
          <div key={asset.asset}>
            <p className="text-[10px] font-semibold text-[#555] mb-1">{asset.asset}</p>
            <div className="h-[80px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={asset.rolling} margin={{ top: 2, right: 2, bottom: 2, left: -20 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis domain={[-1,1]} axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: "#bbb" }} ticks={[-1,-0.5,0,0.5,1]} />
                  <ReferenceLine y={0} stroke="#e0dcd4" />
                  <Line type="monotone" dataKey="corr" stroke={NAVY} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Report Tab ─────────────────────────────────────────────────────────────────
function MDReport({ result, onReset }: { result: BacktestResult; onReset: () => void }) {
  const { stats, config, mdFeedback } = result;
  const paragraphs = mdFeedback.split("\n\n").filter(Boolean);
  function exportJSON() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type:"application/json" });
    Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:`${config.strategyName.replace(/\s+/g,"_")}_backtest.json`}).click();
  }
  function exportTrades() {
    const blob = new Blob([["Ticker,Entry,Exit,Entry$,Exit$,Return%,Days,P&L",...result.trades.map(t=>[t.ticker,t.entryDate,t.exitDate,t.entryPrice,t.exitPrice,t.returnPct,t.holdingDays,t.pnl].join(","))].join("\n")],{type:"text/csv"});
    Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:"trades.csv"}).click();
  }
  return (
    <div>
      <Card className="p-6 mb-5">
        <SectionLabel>Strategy Summary</SectionLabel>
        <div className="mt-4 grid grid-cols-3 gap-5">
          {[["Strategy Name",config.strategyName,"text-[15px]"],["Period",`${config.startDate} → ${config.endDate}`,"text-[13px]"],["Asset Class",config.assetClass,"text-[13px]"],["CAGR vs Benchmark",`${stats.cagr>0?"+":""}${stats.cagr}% vs ${stats.benchmarkCagr}%`,stats.cagr>stats.benchmarkCagr?"text-[#147a4f]":"text-[#b42318]"],["Sharpe / Sortino",`${stats.sharpeRatio} / ${stats.sortinoRatio}`,"text-[15px]"],["Alpha / Beta",`${stats.alpha>0?"+":""}${stats.alpha}% / ${stats.beta}β`,stats.alpha>0?"text-[#147a4f]":"text-[#b42318]"]].map(([l,v,c]) => (
            <div key={l}><MiniLabel>{l}</MiniLabel><p className={`mt-1 font-bold ${c}`}>{v}</p></div>
          ))}
        </div>
      </Card>
      <Card className="p-6 mb-5">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 bg-[#0c1b38] flex items-center justify-center shrink-0"><span className="text-white text-[13px] font-bold">MD</span></div>
          <div><p className="text-[13px] font-bold text-[#0a0a0a]">Trading Desk Assessment</p><p className="text-[11px] text-[#888] mt-0.5">Managing Director, Global Macro — {new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"})}</p></div>
        </div>
        <div className="border-l-2 border-[#0c1b38] pl-5 space-y-4">
          {paragraphs.map((para, i) => <p key={i} className="text-[13px] font-medium leading-[1.85] text-[#333]">{para}</p>)}
        </div>
      </Card>
      <Card className="p-6 mb-5">
        <SectionLabel>Approved Assumptions</SectionLabel>
        <div className="mt-4 space-y-2">
          {config.assumptions.map(a => (
            <div key={a.id} className="flex items-center gap-4 py-2 border-b border-[#f5f5f5] last:border-0">
              <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#888] w-28 shrink-0">{a.category}</span>
              <span className="text-[12px] font-semibold text-[#555] w-32 shrink-0">{a.label}</span>
              <span className="text-[12px] font-medium text-[#0a0a0a] flex-1">{a.value}</span>
              <ConfidenceBadge level={a.confidence} />
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-6">
        <SectionLabel>Export</SectionLabel>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={exportJSON} className="px-5 py-2.5 border border-[#0c1b38] text-[12px] font-semibold text-[#0c1b38] hover:bg-[#0c1b38] hover:text-white transition-colors">Full Report (JSON) ↓</button>
          <button onClick={exportTrades} className="px-5 py-2.5 border border-[#e8e8e8] text-[12px] font-semibold text-[#555] hover:border-[#0c1b38] transition-colors">Trade Log (CSV) ↓</button>
          <button onClick={() => window.print()} className="px-5 py-2.5 border border-[#e8e8e8] text-[12px] font-semibold text-[#555] hover:border-[#0c1b38] transition-colors">Print Report ⎙</button>
          <button onClick={onReset} className="ml-auto text-[12px] font-semibold text-[#888] hover:text-[#0c1b38] transition-colors">← New strategy</button>
        </div>
      </Card>
    </div>
  );
}

// ── Step Results ───────────────────────────────────────────────────────────────
type ResultTab = "performance" | "risk" | "optimization" | "report";

function StepResults({ result, onReset }: { result: BacktestResult; onReset: () => void }) {
  const [tab, setTab] = useState<ResultTab>("performance");
  const { stats, equityCurve, drawdownSeries, monthlyReturns, trades, monteCarloData, stressTests,
          rollingMetrics, factorExposures, walkForward, pnlAttribution, regimeSegments,
          paramSensitivity, efficientFrontier, correlations } = result;

  const TABS: { key: ResultTab; label: string }[] = [
    { key: "performance",  label: "Performance" },
    { key: "risk",         label: "Risk & Scenarios" },
    { key: "optimization", label: "Optimization" },
    { key: "report",       label: "Report & Export" },
  ];

  return (
    <div>
      <div className="flex items-start justify-between gap-6 mb-6 pb-6 border-b border-[#ebebeb]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38] mb-2">Backtest Results</p>
          <h2 className="text-[28px] font-light tracking-tight text-[#0a0a0a]" style={{ fontFamily: "var(--font-serif)" }}>{result.config.strategyName}</h2>
          <p className="text-[12px] text-[#888] mt-1.5">{result.config.startDate} → {result.config.endDate} · {result.config.assetClass}</p>
        </div>
        <button onClick={onReset} className="text-[11px] font-semibold text-[#888] hover:text-[#0c1b38] transition-colors shrink-0">← New strategy</button>
      </div>
      <div className="mb-6 flex items-center gap-6 py-3 px-5 border border-[#e8e3da] bg-[#fbfaf7]">
        <p className="text-[11px] font-medium text-[#555] leading-relaxed flex-1">{result.summary}</p>
      </div>
      <div className="flex gap-0 border-b border-[#e8e8e8] mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-[11.5px] font-semibold tracking-[0.06em] transition-colors border-b-2 -mb-px ${tab===t.key ? "border-[#0c1b38] text-[#0c1b38]" : "border-transparent text-[#888] hover:text-[#555]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "performance" && (
        <div>
          <StatsGrid stats={stats} />
          <EquityCurveChart data={equityCurve} regimes={regimeSegments ?? []} />
          <DrawdownChart data={drawdownSeries} />
          <WaterfallChart attribution={pnlAttribution} totalCagr={stats.cagr} />
          {monthlyReturns.length > 0 && <MonthlyHeatmap data={monthlyReturns} />}
          {trades.length > 0 && <TradeLog trades={trades} />}
        </div>
      )}

      {tab === "risk" && (
        <div>
          {monteCarloData.length > 2 && <MonteCarloChart data={monteCarloData} initialCapital={result.config.initialCapital} />}
          <StressTestPanel tests={stressTests} />
          {correlations?.length > 0 && <CorrelationMatrix data={correlations} />}
          {rollingMetrics.length > 4 && <RollingMetricsChart data={rollingMetrics} />}
          <div className="grid grid-cols-2 gap-4">
            <FactorExposureChart factors={factorExposures} />
            <VaRPanel stats={stats} />
          </div>
        </div>
      )}

      {tab === "optimization" && (
        <div>
          <WalkForwardChart data={walkForward ?? []} />
          {paramSensitivity?.length > 0 && <ParamSensHeatmap data={paramSensitivity} />}
          {efficientFrontier?.length > 0 && <EfficientFrontierChart data={efficientFrontier} />}
        </div>
      )}

      {tab === "report" && <MDReport result={result} onReset={onReset} />}
    </div>
  );
}

// ── Page state machine ─────────────────────────────────────────────────────────
type PageState =
  | { step: "input" }
  | { step: "parsing" }
  | { step: "assumptions"; config: BacktestConfig }
  | { step: "running"; config: BacktestConfig }
  | { step: "results"; result: BacktestResult };

const STEP_IDX: Record<PageState["step"], number> = { input:0, parsing:0, assumptions:1, running:1, results:2 };
const STEP_LABELS = ["Describe","Review & Approve","Results"];

export default function BacktestingPage() {
  const [state, setState] = useState<PageState>({ step: "input" });

  const handleSubmit = useCallback(async (description: string) => {
    setState({ step: "parsing" });
    try {
      const res = await fetch("/api/backtesting/parse-strategy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error("parse failed");
      setState({ step: "assumptions", config: await res.json() });
    } catch { setState({ step: "input" }); }
  }, []);

  const handleApprove = useCallback(async (config: BacktestConfig) => {
    setState({ step: "running", config });
    try {
      const res = await fetch("/api/backtesting/run-backtest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error("backtest failed");
      const result = await res.json() as BacktestResult;
      saveToHistory(result);
      setState({ step: "results", result });
    } catch { setState({ step: "assumptions", config }); }
  }, []);

  const handleRestoreHistory = useCallback((config: BacktestConfig) => {
    setState({ step: "assumptions", config });
  }, []);

  const handleReset = useCallback(() => setState({ step: "input" }), []);
  const stepIdx = STEP_IDX[state.step];

  return (
    <AppShell>
      <div className="mb-8 pb-7 border-b border-[#ebebeb]">
        <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-[#0c1b38] mb-3">Backtesting</p>
        <h1 className="text-[34px] font-light tracking-tight text-[#0a0a0a]" style={{ fontFamily: "var(--font-serif)" }}>Strategy Backtester</h1>
        <p className="text-[13px] text-[#9ca3af] mt-1.5">Describe any strategy in plain English → structured assumptions → full quantitative analysis with walk-forward validation.</p>
      </div>

      <div className="flex items-center gap-0 mb-10">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold border ${stepIdx===i ? "bg-[#0c1b38] text-white border-[#0c1b38]" : stepIdx>i ? "bg-[#0c1b38]/10 text-[#0c1b38] border-[#0c1b38]/30" : "text-[#ccc] border-[#ddd]"}`}>
                {stepIdx > i ? "✓" : i+1}
              </span>
              <span className={`text-[11px] font-semibold tracking-[0.08em] uppercase ${stepIdx===i ? "text-[#0c1b38]" : stepIdx>i ? "text-[#0c1b38]/50" : "text-[#ccc]"}`}>{label}</span>
            </div>
            {i < 2 && <span className="mx-4 text-[#e0e0e0] text-[10px]">────</span>}
          </div>
        ))}
      </div>

      {state.step === "input"       && <StepInput onSubmit={handleSubmit} onRestoreHistory={handleRestoreHistory} />}
      {state.step === "parsing"     && <StepParsing />}
      {state.step === "assumptions" && <StepAssumptions config={state.config} onApprove={handleApprove} onBack={() => setState({ step: "input" })} />}
      {state.step === "running"     && <StepRunning />}
      {state.step === "results"     && <StepResults result={state.result} onReset={handleReset} />}
    </AppShell>
  );
}
