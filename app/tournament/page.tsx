"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import signalData from "@/lib/data/tournamentSignals.json";
import backtestData from "@/lib/data/tournamentBacktest.json";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  Activity, TrendingUp, Shield, Target, AlertTriangle, CalendarDays, ChevronDown, ChevronUp,
  Plus, Trash2, RefreshCw, Wallet, LineChart as LineIcon, ListChecks, Info, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

type Signal = (typeof signalData.signals)[number];
const SIGNALS = signalData.signals as Signal[];
const SIGMAP: Record<string, Signal> = Object.fromEntries(SIGNALS.map((s) => [s.ticker, s]));
const CAP = signalData.competition.capital;
const CASH_PENALTY = 0.10; // -10% annual on idle cash

// ---------- helpers ----------
const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const num = (n: number) => n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
  : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const uid = () => Math.random().toString(36).slice(2, 9);

function useLocal<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  useEffect(() => { try { const s = localStorage.getItem(key); if (s) setV(JSON.parse(s)); } catch {} }, [key]);
  const set = useCallback((nv: T) => { setV(nv); try { localStorage.setItem(key, JSON.stringify(nv)); } catch {} }, [key]);
  return [v, set];
}

type Quote = { price: number; prev: number; change: number; pct: number };
function useQuotes(tickers: string[]) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [asOf, setAsOf] = useState<string>("");
  const key = tickers.slice().sort().join(",");
  const refresh = useCallback(async () => {
    if (!key) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/tournament/quotes?tickers=${encodeURIComponent(key)}`);
      const j = await r.json();
      setQuotes(j.quotes ?? {});
      setAsOf(j.asOf ?? "");
    } catch {} finally { setLoading(false); }
  }, [key]);
  useEffect(() => { refresh(); const id = setInterval(refresh, 60000); return () => clearInterval(id); }, [refresh]);
  return { quotes, loading, asOf, refresh };
}

// price fallback chain: live quote -> signal snapshot -> entry
const priceOf = (t: string, quotes: Record<string, Quote>, fallback?: number) =>
  quotes[t]?.price ?? SIGMAP[t]?.price ?? fallback ?? 0;

type Verdict = { action: string; tone: "green" | "red" | "amber" | "muted"; reason: string };
function verdict(entry: number, stop: number, target: number, price: number, sig?: Signal): Verdict {
  if (price > 0 && stop > 0 && price <= stop) return { action: "SELL", tone: "red", reason: "Stop hit — exit now to protect capital." };
  if (price > 0 && target > 0 && price >= target) return { action: "TAKE PROFIT", tone: "green", reason: "Target reached — scale out or trail the stop up." };
  if (sig && (sig.direction === "SHORT" || !sig.above200)) return { action: "SELL", tone: "amber", reason: "Trend broke (below 200-day) — the signal no longer supports the long." };
  if (sig && sig.score < 50) return { action: "TRIM", tone: "amber", reason: `Signal score fell to ${sig.score} — reduce exposure.` };
  const p = entry > 0 ? (price / entry - 1) * 100 : 0;
  return { action: "HOLD", tone: "muted", reason: p >= 0 ? `Up ${p.toFixed(1)}% — let it run; stop sits at ${num(stop)}.` : `Down ${Math.abs(p).toFixed(1)}% but above stop — thesis intact.` };
}
const TONE: Record<string, { bg: string; color: string }> = {
  green: { bg: "var(--ca-green-bg)", color: "var(--ca-green)" },
  red: { bg: "var(--ca-red-bg)", color: "var(--ca-red)" },
  amber: { bg: "var(--ca-amber-bg)", color: "var(--ca-amber)" },
  muted: { bg: "var(--ca-surface-2)", color: "var(--ca-text-3)" },
};
const DIR_STYLE: Record<string, { bg: string; color: string }> = {
  BUY: TONE.green, SHORT: TONE.red, COVER: TONE.amber, SELL: TONE.amber, HOLD: TONE.muted,
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl p-5 ${className}`} style={{ border: "1px solid var(--ca-border)", background: "var(--ca-surface)" }}>{children}</div>;
}
function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ca-text-3)" }}>{label}</p>
      <p className="text-[15px] font-medium mt-1" style={{ color: tone ?? "var(--ca-text)" }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--ca-text-3)" }}>{sub}</p>}
    </div>
  );
}
function Pill({ v }: { v: Verdict }) {
  const t = TONE[v.tone];
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap" style={{ background: t.bg, color: t.color }}>{v.action}</span>;
}

// ==================================================================================
export default function TournamentPage() {
  const [tab, setTab] = useState<"signals" | "backtest" | "positions" | "sim">("signals");
  const r = signalData.regime;
  const riskOn = r.state.startsWith("RISK-ON");
  const TABS = [
    { id: "signals", label: "Signals & Analysis", icon: ListChecks },
    { id: "backtest", label: "Backtest", icon: LineIcon },
    { id: "positions", label: "My Positions", icon: Wallet },
    { id: "sim", label: "Portfolio Simulator", icon: Activity },
  ] as const;

  return (
    <AppShell>
      <div className="mb-6 pb-6 flex items-end justify-between" style={{ borderBottom: "1px solid var(--ca-border)" }}>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "var(--ca-accent)" }}>StockTrak · FIN 366 Trading Game</p>
          <h1 className="text-[34px] font-light tracking-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>Tournament Strategy</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--ca-text-3)" }}>Grade-protected dynamic barbell · {signalData.competition.start} → {signalData.competition.end} · {money(CAP)}</p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-2 text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: riskOn ? "var(--ca-green-bg)" : "var(--ca-amber-bg)", color: riskOn ? "var(--ca-green)" : "var(--ca-amber)" }}>
            <Activity size={13} /> {r.state}
          </span>
          <p className="text-[10px] mt-2" style={{ color: "var(--ca-text-3)" }}>as of {signalData.asOf}</p>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 mb-6">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} className="flex items-center gap-2 text-[12px] font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ background: active ? "var(--ca-accent)" : "var(--ca-surface-2)", color: active ? "var(--ca-accent-text)" : "var(--ca-text-3)" }}>
              <Icon size={13} /> {label}
            </button>
          );
        })}
      </div>

      {tab === "signals" && <SignalsTab />}
      {tab === "backtest" && <BacktestTab />}
      {tab === "positions" && <PositionsTab />}
      {tab === "sim" && <SimulatorTab />}
    </AppShell>
  );
}

// ---------------------------------------------------------------- SIGNALS + ANALYSIS
function SignalsTab() {
  const [filter, setFilter] = useState("TRADE NOW");
  const [open, setOpen] = useState<string | null>(null);
  const r = signalData.regime;
  const a = signalData.allocation;
  const riskOn = r.state.startsWith("RISK-ON");
  const BUCKETS = ["TRADE NOW", "WATCH", "SHORT CANDIDATE", "AVOID"];
  const shown = filter === "ALL" ? SIGNALS : SIGNALS.filter((s) => s.bucket === filter);
  const allocBars = [
    { label: "Core", pct: a.corePct }, { label: "Catalyst", pct: a.catalystPct }, { label: "Macro", pct: a.macroPct },
    { label: "Convex sleeve", pct: a.sleevePct }, { label: "Cash-sub (SGOV)", pct: a.cashSubPct },
  ];
  return (
    <>
      {/* newbie explainer */}
      <div className="rounded-xl p-4 mb-4 flex items-start gap-3" style={{ border: "1px solid var(--ca-brand-border)", background: "var(--ca-brand-bg)" }}>
        <Info size={15} style={{ color: "var(--ca-brand-label)", marginTop: 1 }} />
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--ca-brand-text)" }}>
          <b>How to read this:</b> each row is a candidate trade. The <b>Score (0–100)</b> blends momentum, trend, relative strength and regime — higher is stronger.
          <b> BUY/SHORT/HOLD</b> is the signal, with an <b>Entry</b>, a protective <b>Stop</b> (sell if it hits), a <b>Target</b>, and a suggested <b>Size</b>.
          Click any row to see <b>why</b> — the bull case, the risks, why now, and what would invalidate it. Start with <b>TRADE NOW</b>.
        </p>
      </div>

      {/* regime / alloc / objective */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card>
          <div className="flex items-center gap-2 mb-4"><TrendingUp size={14} style={{ color: "var(--ca-accent)" }} /><p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ca-text)" }}>Market Regime</p></div>
          <div className="grid grid-cols-3 gap-y-4">
            <Stat label="S&P 500" value={num(r.inputs.spy)} sub={`${r.inputs.spyVs200} 200d`} />
            <Stat label="VIX" value={String(r.inputs.vix)} />
            <Stat label="10Y" value={`${r.inputs.tenYear}%`} />
            <Stat label="50/200d" value={r.inputs.spy50Vs200} />
            <Stat label="Credit" value={r.inputs.creditHYG} />
            <Stat label="Trend" value={riskOn ? "Up" : "Mixed"} />
          </div>
          <p className="text-[10px] mt-4 leading-relaxed" style={{ color: "var(--ca-text-3)" }}>{r.explain}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-4"><Shield size={14} style={{ color: "var(--ca-accent)" }} /><p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ca-text)" }}>Allocation</p></div>
          <div className="space-y-2.5">
            {allocBars.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-[11px] mb-1"><span style={{ color: "var(--ca-text-2)" }}>{b.label}</span><span className="font-medium" style={{ color: "var(--ca-text)" }}>{b.pct}%</span></div>
                <div className="h-1.5 rounded-full" style={{ background: "var(--ca-surface-2)" }}><div className="h-1.5 rounded-full" style={{ width: `${b.pct}%`, background: "var(--ca-accent)" }} /></div>
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-4 leading-relaxed" style={{ color: "var(--ca-text-3)" }}>{a.note}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-4"><Target size={14} style={{ color: "var(--ca-accent)" }} /><p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ca-text)" }}>Objective</p></div>
          <div className="grid grid-cols-2 gap-y-4">
            <Stat label="Policy" value="Moderate DYNAMIC" sub="v3 core + options sleeve" />
            <Stat label="Realistic target" value="+15–25%" sub="very likely top-quintile" />
            <Stat label="P(top quintile)" value="~40–46%" sub="the winnable prize" />
            <Stat label="P(finish #1)" value="~0.1–0.7%" sub="structurally capped" />
          </div>
          <div className="flex items-start gap-2 mt-4 p-2.5 rounded-lg" style={{ background: "var(--ca-amber-bg)" }}>
            <AlertTriangle size={13} style={{ color: "var(--ca-amber)", marginTop: 1 }} />
            <p className="text-[10px] leading-relaxed" style={{ color: "var(--ca-text-2)" }}>#1 can’t be engineered up — protect a strong standing late rather than gamble it.</p>
          </div>
        </Card>
      </div>

      {/* signals list */}
      <div className="rounded-xl mb-4" style={{ border: "1px solid var(--ca-border)", background: "var(--ca-surface)" }}>
        <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-wrap gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ca-text)" }}>Opportunity Screen</p>
          <div className="flex gap-1 flex-wrap">
            {[...BUCKETS, "ALL"].map((b) => {
              const count = b === "ALL" ? SIGNALS.length : SIGNALS.filter((s) => s.bucket === b).length;
              const active = filter === b;
              return <button key={b} onClick={() => setFilter(b)} className="text-[10.5px] font-medium px-3 py-1.5 rounded-lg transition-colors" style={{ background: active ? "var(--ca-accent)" : "var(--ca-surface-2)", color: active ? "var(--ca-accent-text)" : "var(--ca-text-3)" }}>{b} <span style={{ opacity: 0.6 }}>{count}</span></button>;
            })}
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--ca-border)" }}>
          {shown.map((s) => {
            const ds = DIR_STYLE[s.direction] ?? DIR_STYLE.HOLD;
            const isOpen = open === s.ticker;
            return (
              <div key={s.ticker} style={{ borderBottom: "1px solid var(--ca-border)" }}>
                <button onClick={() => setOpen(isOpen ? null : s.ticker)} className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-black/[0.015] transition-colors">
                  <span className="text-[11px] w-5" style={{ color: "var(--ca-text-3)" }}>{s.rank}</span>
                  <span className="w-28"><span className="font-semibold text-[13px]" style={{ color: "var(--ca-text)" }}>{s.ticker}</span><span className="block text-[9.5px]" style={{ color: "var(--ca-text-3)" }}>{s.name}</span></span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: ds.bg, color: ds.color }}>{s.direction}</span>
                  <span className="flex items-center gap-2 flex-1 max-w-[130px]">
                    <span className="h-1.5 rounded-full flex-1" style={{ background: "var(--ca-surface-2)" }}><span className="h-1.5 rounded-full block" style={{ width: `${s.score}%`, background: s.score >= 65 ? "var(--ca-green)" : s.score >= 50 ? "var(--ca-accent)" : "var(--ca-text-3)" }} /></span>
                    <span className="text-[11px] tabular-nums w-7" style={{ color: "var(--ca-text-2)" }}>{s.score}</span>
                  </span>
                  <span className="text-[11px] tabular-nums hidden md:block" style={{ color: "var(--ca-text)" }}>{num(s.entry)}</span>
                  <span className="text-[11px] tabular-nums hidden md:block" style={{ color: "var(--ca-red)" }}>{num(s.stop)}</span>
                  <span className="text-[11px] tabular-nums hidden md:block" style={{ color: "var(--ca-green)" }}>{num(s.target)}</span>
                  <span className="text-[11px] tabular-nums w-10 text-right" style={{ color: "var(--ca-text-2)" }}>{s.sizePct}%</span>
                  {isOpen ? <ChevronUp size={14} style={{ color: "var(--ca-text-3)" }} /> : <ChevronDown size={14} style={{ color: "var(--ca-text-3)" }} />}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1" style={{ background: "var(--ca-surface-2)" }}>
                    <p className="text-[12px] leading-relaxed mb-4" style={{ color: "var(--ca-text-2)" }}>{s.reason}</p>
                    <div className="grid grid-cols-2 gap-5 mb-4">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--ca-green)" }}>Bull case</p>
                        <ul className="space-y-1">{s.bullCase.map((b, i) => <li key={i} className="text-[11px]" style={{ color: "var(--ca-text-2)" }}>+ {b}</li>)}</ul>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--ca-red)" }}>Risks</p>
                        <ul className="space-y-1">{s.bearCase.map((b, i) => <li key={i} className="text-[11px]" style={{ color: "var(--ca-text-2)" }}>− {b}</li>)}</ul>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5 mb-4">
                      <div><p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--ca-text-3)" }}>Why now</p><p className="text-[11px] leading-relaxed" style={{ color: "var(--ca-text-2)" }}>{s.whyNow}</p></div>
                      <div><p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--ca-text-3)" }}>What invalidates it</p><p className="text-[11px] leading-relaxed" style={{ color: "var(--ca-text-2)" }}>{s.invalidation}</p></div>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 pt-3" style={{ borderTop: "1px solid var(--ca-border)" }}>
                      {[["3m return", pct(s.ret3m)], ["6m return", pct(s.ret6m)], ["vs S&P (3m)", pct(s.relStrength)], ["vs 200-day", pct(s.dist200)], ["vs 50-day", pct(s.dist50)], ["Volatility", `${s.rvol}%`], ["Risk/Reward", `${s.riskReward} : 1`], ["Size", `${s.sizePct}% · ${money(s.sizeUsd)}`]].map(([k, v]) => (
                        <div key={k}><span className="text-[9px] uppercase tracking-wider block" style={{ color: "var(--ca-text-3)" }}>{k}</span><span className="text-[12px] font-medium" style={{ color: "var(--ca-text)" }}>{v}</span></div>
                      ))}
                    </div>
                    {/* component score breakdown */}
                    <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--ca-border)" }}>
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--ca-text-3)" }}>Score breakdown ({s.score}/100)</p>
                      <div className="flex gap-2">
                        {Object.entries(s.components).map(([k, v]) => (
                          <div key={k} className="flex-1">
                            <div className="h-1.5 rounded-full mb-1" style={{ background: "var(--ca-surface)" }}><div className="h-1.5 rounded-full" style={{ width: `${(Number(v) / 40) * 100}%`, background: "var(--ca-accent)" }} /></div>
                            <span className="text-[8.5px]" style={{ color: "var(--ca-text-3)" }}>{k} {String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* catalysts */}
      <Card>
        <div className="flex items-center gap-2 mb-4"><CalendarDays size={14} style={{ color: "var(--ca-accent)" }} /><p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ca-text)" }}>Upcoming Catalysts</p></div>
        <div className="grid grid-cols-3 gap-2">
          {signalData.calendar.map((c) => (
            <div key={c.date + c.event} className="flex items-center gap-3 py-1.5">
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded" style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-2)" }}>{c.date.slice(5)}</span>
              <span className="text-[12px]" style={{ color: "var(--ca-text-2)" }}>{c.event}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- BACKTEST
function BacktestTab() {
  const bt = backtestData;
  const finalStrat = bt.curve[bt.curve.length - 1]?.strat ?? 100;
  const finalSpy = bt.curve[bt.curve.length - 1]?.spy ?? 100;
  return (
    <>
      <div className="rounded-xl p-4 mb-4 flex items-start gap-3" style={{ border: "1px solid var(--ca-brand-border)", background: "var(--ca-brand-bg)" }}>
        <Info size={15} style={{ color: "var(--ca-brand-label)", marginTop: 1 }} />
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--ca-brand-text)" }}>
          <b>Did this strategy actually work?</b> This is the core momentum engine run on real data 2008–2026 (weekly rebalance, realistic costs, no look-ahead).
          It grew $100 to {money(finalStrat)} vs {money(finalSpy)} for the S&P — with far smaller drawdowns. Past results don’t guarantee the future, but the edge is real and validated out-of-sample.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-4">
        <Card><Stat label="CAGR" value={`${bt.stats.cagr}%`} sub="per year, 2008–26" /></Card>
        <Card><Stat label="Sharpe" value={String(bt.stats.sharpe)} sub="risk-adjusted" /></Card>
        <Card><Stat label="Max Drawdown" value={`${bt.stats.maxdd}%`} sub="worst peak-to-trough" tone="var(--ca-red)" /></Card>
        <Card><Stat label="Calmar" value={String(bt.stats.calmar)} sub="return / drawdown" /></Card>
        <Card><Stat label="Volatility" value={`${bt.stats.vol}%`} sub="annualized" /></Card>
      </div>

      <Card className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--ca-text)" }}>Growth of $100 — Strategy vs S&P 500 (log scale)</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={bt.curve} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="var(--ca-border)" strokeDasharray="2 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--ca-text-3)" }} tickFormatter={(d) => String(d).slice(0, 4)} minTickGap={60} />
            <YAxis scale="log" domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "var(--ca-text-3)" }} tickFormatter={(v) => `$${v}`} width={48} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--ca-border)" }} formatter={(v: any) => money(Number(v))} labelFormatter={(l) => String(l)} />
            <Line type="monotone" dataKey="strat" stroke="var(--ca-accent)" strokeWidth={2} dot={false} name="Strategy" />
            <Line type="monotone" dataKey="spy" stroke="var(--ca-text-3)" strokeWidth={1.3} dot={false} name="S&P 500" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-5 mt-2 text-[11px]">
          <span className="flex items-center gap-1.5" style={{ color: "var(--ca-text-2)" }}><span className="w-3 h-[2px]" style={{ background: "var(--ca-accent)" }} /> Strategy</span>
          <span className="flex items-center gap-1.5" style={{ color: "var(--ca-text-2)" }}><span className="w-3 h-[2px]" style={{ background: "var(--ca-text-3)" }} /> S&P 500</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--ca-text)" }}>Return by Year — Strategy vs S&P</p>
          <div className="space-y-2">
            {bt.years.map((y) => (
              <div key={y.year} className="flex items-center gap-3">
                <span className="text-[11px] w-10" style={{ color: "var(--ca-text-3)" }}>{y.year}</span>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[11px] tabular-nums w-14 text-right font-medium" style={{ color: y.strat >= 0 ? "var(--ca-green)" : "var(--ca-red)" }}>{pct(y.strat)}</span>
                  <div className="flex-1 h-3 rounded-sm relative" style={{ background: "var(--ca-surface-2)" }}>
                    <div className="h-3 rounded-sm absolute left-0" style={{ width: `${Math.min(Math.abs(y.strat), 60) / 60 * 100}%`, background: y.strat >= 0 ? "var(--ca-green)" : "var(--ca-red)", opacity: 0.85 }} />
                  </div>
                  <span className="text-[10px] tabular-nums w-12 text-right" style={{ color: "var(--ca-text-3)" }}>SPY {pct(y.spy)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ca-text)" }}>Sleeve Weight → Tournament Odds</p>
          <p className="text-[10px] mb-3" style={{ color: "var(--ca-text-3)" }}>Bigger convex sleeve lifts top-quintile odds but #1 stays capped. Recommended 20–30%.</p>
          <table className="w-full text-[11px]">
            <thead><tr style={{ color: "var(--ca-text-3)" }}>{["Sleeve", "P(top 20%)", "P(#1)", "P(loss>20%)"].map((h) => <th key={h} className="text-left font-semibold py-1.5 text-[9.5px] uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody>
              {bt.sleeve.map((s) => (
                <tr key={s.w} style={{ borderTop: "1px solid var(--ca-border)", background: s.w >= 20 && s.w <= 30 ? "var(--ca-green-bg)" : "transparent" }}>
                  <td className="py-1.5 font-medium" style={{ color: "var(--ca-text)" }}>{s.w}%</td>
                  <td className="py-1.5" style={{ color: "var(--ca-text-2)" }}>{s.top}%</td>
                  <td className="py-1.5" style={{ color: "var(--ca-text-2)" }}>{s.p1}%</td>
                  <td className="py-1.5" style={{ color: "var(--ca-text-2)" }}>{s.loss}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <p className="text-[10px] mt-4" style={{ color: "var(--ca-text-3)" }}>{bt.note}</p>
    </>
  );
}

// ---------------------------------------------------------------- POSITIONS (live tracker)
type Pos = { id: string; ticker: string; shares: number; entryPrice: number; entryDate: string; stop: number; target: number };
function PositionsTab() {
  const [positions, setPositions] = useLocal<Pos[]>("ca_tournament_positions", []);
  const tickers = positions.map((p) => p.ticker);
  const { quotes, loading, refresh } = useQuotes(tickers);
  const [form, setForm] = useState({ ticker: "", shares: "", entryPrice: "", stop: "", target: "" });

  function add() {
    const t = form.ticker.trim().toUpperCase();
    if (!t || !form.shares) return;
    const sig = SIGMAP[t];
    const entryPrice = parseFloat(form.entryPrice) || sig?.entry || priceOf(t, quotes) || 0;
    setPositions([...positions, {
      id: uid(), ticker: t, shares: parseFloat(form.shares) || 0, entryPrice,
      entryDate: new Date().toISOString().slice(0, 10),
      stop: parseFloat(form.stop) || sig?.stop || 0, target: parseFloat(form.target) || sig?.target || 0,
    }]);
    setForm({ ticker: "", shares: "", entryPrice: "", stop: "", target: "" });
  }
  const rows = positions.map((p) => {
    const price = priceOf(p.ticker, quotes, p.entryPrice);
    const mv = p.shares * price, cost = p.shares * p.entryPrice, pnl = mv - cost;
    const pnlPct = cost ? (pnl / cost) * 100 : 0;
    return { ...p, price, mv, pnl, pnlPct, v: verdict(p.entryPrice, p.stop, p.target, price, SIGMAP[p.ticker]) };
  });
  const totalMv = rows.reduce((a, b) => a + b.mv, 0);
  const totalPnl = rows.reduce((a, b) => a + b.pnl, 0);
  const totalCost = rows.reduce((a, b) => a + b.shares * b.entryPrice, 0);
  const sells = rows.filter((r) => r.v.action === "SELL" || r.v.action === "TAKE PROFIT");

  return (
    <>
      <div className="rounded-xl p-4 mb-4 flex items-start gap-3" style={{ border: "1px solid var(--ca-brand-border)", background: "var(--ca-brand-bg)" }}>
        <Info size={15} style={{ color: "var(--ca-brand-label)", marginTop: 1 }} />
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--ca-brand-text)" }}>
          <b>Add the positions you actually hold in StockTrak.</b> The system pulls live prices, marks your P&L, and tells you <b>when to sell</b> — stop hit, target reached, or the trend/signal breaking. Prices refresh every minute. Stored on this device only.
        </p>
      </div>

      {sells.length > 0 && (
        <div className="rounded-xl p-4 mb-4" style={{ border: "1px solid var(--ca-red)", background: "var(--ca-red-bg)" }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--ca-red)" }}>⚠ Action needed</p>
          {sells.map((r) => <p key={r.id} className="text-[12px]" style={{ color: "var(--ca-text-2)" }}><b>{r.ticker}:</b> {r.v.action} — {r.v.reason}</p>)}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Card><Stat label="Positions" value={String(positions.length)} /></Card>
        <Card><Stat label="Market Value" value={money(totalMv)} /></Card>
        <Card><Stat label="Open P&L" value={`${totalPnl >= 0 ? "+" : ""}${money(totalPnl)}`} tone={totalPnl >= 0 ? "var(--ca-green)" : "var(--ca-red)"} sub={totalCost ? pct((totalPnl / totalCost) * 100) : ""} /></Card>
        <Card><div className="flex items-center justify-between"><Stat label="Live prices" value={loading ? "…" : "on"} sub="refresh 60s" /><button onClick={refresh} className="p-2 rounded-lg" style={{ background: "var(--ca-surface-2)" }}><RefreshCw size={13} style={{ color: "var(--ca-text-3)" }} /></button></div></Card>
      </div>

      {/* add form */}
      <Card className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ca-text)" }}>Add Position</p>
        <div className="grid grid-cols-6 gap-3">
          {([["ticker", "Ticker", "MSFT"], ["shares", "Shares", "100"], ["entryPrice", "Entry $ (blank=live)", ""], ["stop", "Stop (blank=auto)", ""], ["target", "Target (blank=auto)", ""]] as const).map(([k, label, ph]) => (
            <div key={k} className={k === "ticker" ? "col-span-1" : "col-span-1"}>
              <label className="text-[9px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--ca-text-3)" }}>{label}</label>
              <input value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={ph}
                className="w-full rounded-md px-2.5 py-2 text-[12px] focus:outline-none" style={{ border: "1px solid var(--ca-border)", background: "var(--ca-surface-2)", color: "var(--ca-text)" }} />
            </div>
          ))}
          <button onClick={add} className="flex items-center justify-center gap-1.5 text-[12px] font-medium rounded-md self-end py-2" style={{ background: "var(--ca-accent)", color: "var(--ca-accent-text)" }}><Plus size={13} /> Add</button>
        </div>
      </Card>

      {/* positions table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ca-border)", background: "var(--ca-surface)" }}>
        <table className="w-full text-[12px]">
          <thead><tr style={{ borderBottom: "1px solid var(--ca-border)" }}>{["Ticker", "Shares", "Entry", "Live", "Stop", "Target", "Mkt Value", "P&L", "Verdict", ""].map((h) => <th key={h} className="text-left font-semibold px-4 py-2.5 text-[9.5px] uppercase tracking-wider" style={{ color: "var(--ca-text-3)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--ca-border)" }}>
                <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--ca-text)" }}>{r.ticker}<span className="block text-[9px] font-normal" style={{ color: "var(--ca-text-3)" }}>{SIGMAP[r.ticker]?.name ?? ""}</span></td>
                <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--ca-text-2)" }}>{r.shares}</td>
                <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--ca-text-2)" }}>{num(r.entryPrice)}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium" style={{ color: "var(--ca-text)" }}>{num(r.price)}</td>
                <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--ca-red)" }}>{num(r.stop)}</td>
                <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--ca-green)" }}>{num(r.target)}</td>
                <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--ca-text)" }}>{money(r.mv)}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium" style={{ color: r.pnl >= 0 ? "var(--ca-green)" : "var(--ca-red)" }}>{r.pnl >= 0 ? "+" : ""}{money(r.pnl)}<span className="block text-[9.5px]">{pct(r.pnlPct)}</span></td>
                <td className="px-4 py-2.5"><Pill v={r.v} /><span className="block text-[9px] mt-0.5 max-w-[150px]" style={{ color: "var(--ca-text-3)" }}>{r.v.reason}</span></td>
                <td className="px-4 py-2.5"><button onClick={() => setPositions(positions.filter((p) => p.id !== r.id))}><Trash2 size={13} style={{ color: "var(--ca-text-3)" }} /></button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-[12px]" style={{ color: "var(--ca-text-3)" }}>No positions yet. Add one above, or use the Simulator to paper-trade the signals.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- SIMULATOR
type SimPos = { id: string; ticker: string; shares: number; entryPrice: number; entryDate: string; stop: number; target: number };
type Sim = { cash: number; positions: SimPos[]; history: { date: string; equity: number }[]; startedAt: string; lastMark: string };
const FRESH_SIM = (): Sim => ({ cash: CAP, positions: [], history: [], startedAt: new Date().toISOString().slice(0, 10), lastMark: new Date().toISOString().slice(0, 10) });

function SimulatorTab() {
  const [sim, setSim] = useLocal<Sim>("ca_tournament_sim", FRESH_SIM());
  const tickers = sim.positions.map((p) => p.ticker);
  const { quotes, loading, refresh } = useQuotes(tickers);
  const [buy, setBuy] = useState({ ticker: "", amount: "" });

  // apply cash penalty for elapsed days + mark equity to today; re-marks whenever quotes update
  useEffect(() => {
    if (!sim.startedAt) { setSim(FRESH_SIM()); return; }
    const today = new Date().toISOString().slice(0, 10);
    const days = Math.max(0, Math.round((Date.parse(today) - Date.parse(sim.lastMark)) / 86400000));
    const decayedCash = days > 0 ? sim.cash * Math.pow(1 - CASH_PENALTY / 252, days * (5 / 7)) : sim.cash;
    const eq = Math.round(decayedCash + sim.positions.reduce((a, p) => a + p.shares * priceOf(p.ticker, quotes, p.entryPrice), 0));
    const prevToday = sim.history.find((h) => h.date === today);
    if (days === 0 && prevToday && prevToday.equity === eq) return; // nothing changed
    const hist = [...sim.history.filter((h) => h.date !== today), { date: today, equity: eq }];
    setSim({ ...sim, cash: decayedCash, lastMark: today, history: hist });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes]);

  const marks = sim.positions.map((p) => {
    const price = priceOf(p.ticker, quotes, p.entryPrice);
    const mv = p.shares * price, pnl = mv - p.shares * p.entryPrice;
    return { ...p, price, mv, pnl, v: verdict(p.entryPrice, p.stop, p.target, price, SIGMAP[p.ticker]) };
  });
  const posValue = marks.reduce((a, b) => a + b.mv, 0);
  const equity = sim.cash + posValue;
  const ret = (equity / CAP - 1) * 100;
  const cashPct = (sim.cash / equity) * 100;

  function doBuy(ticker: string, amount: number) {
    const t = ticker.toUpperCase(); const price = priceOf(t, quotes, SIGMAP[t]?.entry);
    if (!t || !price || amount <= 0 || amount > sim.cash) return;
    const shares = amount / price; const sig = SIGMAP[t];
    const existing = sim.positions.find((p) => p.ticker === t);
    let positions;
    if (existing) {
      const totShares = existing.shares + shares;
      const avg = (existing.shares * existing.entryPrice + shares * price) / totShares;
      positions = sim.positions.map((p) => p.ticker === t ? { ...p, shares: totShares, entryPrice: avg } : p);
    } else {
      positions = [...sim.positions, { id: uid(), ticker: t, shares, entryPrice: price, entryDate: new Date().toISOString().slice(0, 10), stop: sig?.stop || 0, target: sig?.target || 0 }];
    }
    setSim({ ...sim, cash: sim.cash - amount, positions });
  }
  function sell(id: string) {
    const p = sim.positions.find((x) => x.id === id); if (!p) return;
    const price = priceOf(p.ticker, quotes, p.entryPrice);
    setSim({ ...sim, cash: sim.cash + p.shares * price, positions: sim.positions.filter((x) => x.id !== id) });
  }
  function loadBasket() {
    // buy the TRADE NOW names using recommended core sizing until ~70% deployed
    let cash = sim.cash; const positions = [...sim.positions];
    for (const s of SIGNALS.filter((x) => x.bucket === "TRADE NOW").slice(0, 8)) {
      const amount = Math.min(CAP * (s.sizePct / 100), cash * 0.9);
      const price = s.entry; if (amount < 500 || positions.find((p) => p.ticker === s.ticker)) continue;
      positions.push({ id: uid(), ticker: s.ticker, shares: amount / price, entryPrice: price, entryDate: new Date().toISOString().slice(0, 10), stop: s.stop, target: s.target });
      cash -= amount;
    }
    setSim({ ...sim, cash, positions });
  }

  const chartData = sim.history.length ? sim.history : [{ date: sim.startedAt, equity: CAP }];
  return (
    <>
      <div className="rounded-xl p-4 mb-4 flex items-start gap-3" style={{ border: "1px solid var(--ca-brand-border)", background: "var(--ca-brand-bg)" }}>
        <Info size={15} style={{ color: "var(--ca-brand-label)", marginTop: 1 }} />
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--ca-brand-text)" }}>
          <b>A paper copy of your {money(CAP)} StockTrak account.</b> Buy signals at live prices, and it tracks cash, positions, and total value exactly like the real game — <b>including the −10% penalty on idle cash</b>. Use it to rehearse before you trade for real. “Load recommended basket” buys the TRADE NOW names at target sizing.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Card><Stat label="Total Equity" value={money(equity)} tone={ret >= 0 ? "var(--ca-green)" : "var(--ca-red)"} sub={`${pct(ret)} vs start`} /></Card>
        <Card><Stat label="Cash" value={money(sim.cash)} sub={`${cashPct.toFixed(0)}% · penalty −10%/yr`} tone={cashPct > 20 ? "var(--ca-amber)" : undefined} /></Card>
        <Card><Stat label="Invested" value={money(posValue)} sub={`${sim.positions.length} positions`} /></Card>
        <Card><Stat label="Open P&L" value={`${marks.reduce((a,b)=>a+b.pnl,0)>=0?"+":""}${money(marks.reduce((a,b)=>a+b.pnl,0))}`} tone={marks.reduce((a,b)=>a+b.pnl,0)>=0?"var(--ca-green)":"var(--ca-red)"} /></Card>
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ca-text)" }}>Portfolio Equity</p>
          <div className="flex gap-2">
            <button onClick={loadBasket} className="text-[11px] font-medium px-3 py-1.5 rounded-lg" style={{ background: "var(--ca-accent)", color: "var(--ca-accent-text)" }}>Load recommended basket</button>
            <button onClick={refresh} className="p-2 rounded-lg" style={{ background: "var(--ca-surface-2)" }}><RefreshCw size={13} style={{ color: "var(--ca-text-3)" }} /></button>
            <button onClick={() => { if (confirm("Reset the simulator to $250,000?")) setSim(FRESH_SIM()); }} className="text-[11px] font-medium px-3 py-1.5 rounded-lg" style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-3)" }}>Reset</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="var(--ca-border)" strokeDasharray="2 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--ca-text-3)" }} minTickGap={40} />
            <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "var(--ca-text-3)" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={44} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--ca-border)" }} formatter={(v: any) => money(Number(v))} />
            <ReferenceLine y={CAP} stroke="var(--ca-text-3)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="equity" stroke="var(--ca-accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* quick buy */}
      <Card className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ca-text)" }}>Buy at market</p>
        <div className="flex gap-3 items-end flex-wrap">
          <div><label className="text-[9px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--ca-text-3)" }}>Ticker</label>
            <input value={buy.ticker} onChange={(e) => setBuy({ ...buy, ticker: e.target.value })} placeholder="MSFT" className="rounded-md px-2.5 py-2 text-[12px] w-28 focus:outline-none" style={{ border: "1px solid var(--ca-border)", background: "var(--ca-surface-2)", color: "var(--ca-text)" }} /></div>
          <div><label className="text-[9px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "var(--ca-text-3)" }}>Amount $</label>
            <input value={buy.amount} onChange={(e) => setBuy({ ...buy, amount: e.target.value })} placeholder="25000" className="rounded-md px-2.5 py-2 text-[12px] w-32 focus:outline-none" style={{ border: "1px solid var(--ca-border)", background: "var(--ca-surface-2)", color: "var(--ca-text)" }} /></div>
          <button onClick={() => { doBuy(buy.ticker, parseFloat(buy.amount) || 0); setBuy({ ticker: "", amount: "" }); }} className="text-[12px] font-medium px-4 py-2 rounded-md" style={{ background: "var(--ca-green)", color: "#fff" }}>Buy</button>
          <span className="text-[10px]" style={{ color: "var(--ca-text-3)" }}>Tip: the strategy caps single positions ~12–20%.</span>
        </div>
      </Card>

      {/* holdings */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ca-border)", background: "var(--ca-surface)" }}>
        <table className="w-full text-[12px]">
          <thead><tr style={{ borderBottom: "1px solid var(--ca-border)" }}>{["Ticker", "Shares", "Entry", "Live", "Mkt Value", "P&L", "Verdict", ""].map((h) => <th key={h} className="text-left font-semibold px-4 py-2.5 text-[9.5px] uppercase tracking-wider" style={{ color: "var(--ca-text-3)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {marks.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--ca-border)" }}>
                <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--ca-text)" }}>{r.ticker}</td>
                <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--ca-text-2)" }}>{r.shares.toFixed(1)}</td>
                <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--ca-text-2)" }}>{num(r.entryPrice)}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium" style={{ color: "var(--ca-text)" }}>{num(r.price)}</td>
                <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--ca-text)" }}>{money(r.mv)}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium" style={{ color: r.pnl >= 0 ? "var(--ca-green)" : "var(--ca-red)" }}>{r.pnl >= 0 ? "+" : ""}{money(r.pnl)}</td>
                <td className="px-4 py-2.5"><Pill v={r.v} /></td>
                <td className="px-4 py-2.5"><button onClick={() => sell(r.id)} className="text-[11px] font-medium px-2.5 py-1 rounded" style={{ background: "var(--ca-red-bg)", color: "var(--ca-red)" }}>Sell</button></td>
              </tr>
            ))}
            {marks.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-[12px]" style={{ color: "var(--ca-text-3)" }}>Empty portfolio. Click “Load recommended basket” or buy a name above.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] mt-4" style={{ color: "var(--ca-text-3)" }}>Simulator state is saved on this device. {loading ? "Updating prices…" : "Prices refresh every 60s."} Research only, not investment advice.</p>
    </>
  );
}
