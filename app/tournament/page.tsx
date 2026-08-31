"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import data from "@/lib/data/tournamentSignals.json";
import { Activity, TrendingUp, Shield, Target, AlertTriangle, CalendarDays } from "lucide-react";

type Signal = (typeof data.signals)[number];

const DIR_STYLE: Record<string, { bg: string; color: string }> = {
  BUY:   { bg: "var(--ca-green-bg)", color: "var(--ca-green)" },
  SHORT: { bg: "var(--ca-red-bg)",   color: "var(--ca-red)" },
  COVER: { bg: "var(--ca-amber-bg)", color: "var(--ca-amber)" },
  SELL:  { bg: "var(--ca-amber-bg)", color: "var(--ca-amber)" },
  HOLD:  { bg: "var(--ca-surface-2)", color: "var(--ca-text-3)" },
};

const BUCKETS = ["TRADE NOW", "WATCH", "SHORT CANDIDATE", "AVOID"] as const;

function fmt(n: number) {
  return n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
                   : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ca-text-3)" }}>{label}</p>
      <p className="text-[15px] font-medium mt-1" style={{ color: "var(--ca-text)" }}>{value}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--ca-text-3)" }}>{sub}</p>}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className}`} style={{ border: "1px solid var(--ca-border)", background: "var(--ca-surface)" }}>
      {children}
    </div>
  );
}

export default function TournamentPage() {
  const [filter, setFilter] = useState<string>("TRADE NOW");
  const signals = data.signals as Signal[];
  const shown = filter === "ALL" ? signals : signals.filter((s) => s.bucket === filter);
  const r = data.regime;
  const a = data.allocation;
  const riskOn = r.state.startsWith("RISK-ON");

  const allocBars: { label: string; pct: number }[] = [
    { label: "Core", pct: a.corePct },
    { label: "Catalyst", pct: a.catalystPct },
    { label: "Macro", pct: a.macroPct },
    { label: "Convex sleeve", pct: a.sleevePct },
    { label: "Cash-sub (SGOV)", pct: a.cashSubPct },
  ];

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-8 pb-6 flex items-end justify-between" style={{ borderBottom: "1px solid var(--ca-border)" }}>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "var(--ca-accent)" }}>
            StockTrak · FIN 366 Trading Game
          </p>
          <h1 className="text-[34px] font-light tracking-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>
            Tournament Strategy
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--ca-text-3)" }}>
            Grade-protected dynamic barbell · {data.competition.start} → {data.competition.end} · ${fmt(data.competition.capital)}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-2 text-[12px] font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: riskOn ? "var(--ca-green-bg)" : "var(--ca-amber-bg)", color: riskOn ? "var(--ca-green)" : "var(--ca-amber)" }}>
            <Activity size={13} /> {r.state}
          </span>
          <p className="text-[10px] mt-2" style={{ color: "var(--ca-text-3)" }}>as of {data.asOf}</p>
        </div>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} style={{ color: "var(--ca-accent)" }} />
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ca-text)" }}>Market Regime</p>
          </div>
          <div className="grid grid-cols-3 gap-y-4">
            <Stat label="S&P 500" value={fmt(r.inputs.spy)} sub={`${r.inputs.spyVs200} 200d`} />
            <Stat label="VIX" value={String(r.inputs.vix)} />
            <Stat label="10Y" value={`${r.inputs.tenYear}%`} />
            <Stat label="50d vs 200d" value={r.inputs.spy50Vs200} />
            <Stat label="Credit (HYG)" value={r.inputs.creditHYG} />
            <Stat label="Trend" value={riskOn ? "Up" : "Mixed"} />
          </div>
          <p className="text-[10px] mt-4 leading-relaxed" style={{ color: "var(--ca-text-3)" }}>
            Pre-FOMC hike risk warrants treating this as <span style={{ color: "var(--ca-amber)" }}>fragile</span> — keep the sleeve light into Sept 16.
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={14} style={{ color: "var(--ca-accent)" }} />
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ca-text)" }}>Allocation</p>
          </div>
          <div className="space-y-2.5">
            {allocBars.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: "var(--ca-text-2)" }}>{b.label}</span>
                  <span className="font-medium" style={{ color: "var(--ca-text)" }}>{b.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "var(--ca-surface-2)" }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${b.pct}%`, background: "var(--ca-accent)" }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-4 leading-relaxed" style={{ color: "var(--ca-text-3)" }}>{a.note}</p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Target size={14} style={{ color: "var(--ca-accent)" }} />
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ca-text)" }}>Objective</p>
          </div>
          <div className="grid grid-cols-2 gap-y-4">
            <Stat label="Policy" value="Moderate DYNAMIC" sub="v3 core + options sleeve" />
            <Stat label="Realistic target" value="+15–25%" sub="very likely top-quintile" />
            <Stat label="P(top quintile)" value="~40–46%" sub="the winnable prize" />
            <Stat label="P(finish #1)" value="~0.1–0.7%" sub="structurally capped" />
          </div>
          <div className="flex items-start gap-2 mt-4 p-2.5 rounded-lg" style={{ background: "var(--ca-amber-bg)" }}>
            <AlertTriangle size={13} style={{ color: "var(--ca-amber)", marginTop: 1 }} />
            <p className="text-[10px] leading-relaxed" style={{ color: "var(--ca-text-2)" }}>
              #1 can’t be engineered up — protect a strong standing late rather than gamble it.
            </p>
          </div>
        </Card>
      </div>

      {/* Signals */}
      <div className="rounded-xl mb-4" style={{ border: "1px solid var(--ca-border)", background: "var(--ca-surface)" }}>
        <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-wrap gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ca-text)" }}>
            Opportunity Screen
          </p>
          <div className="flex gap-1">
            {[...BUCKETS, "ALL"].map((b) => {
              const count = b === "ALL" ? signals.length : signals.filter((s) => s.bucket === b).length;
              const active = filter === b;
              return (
                <button key={b} onClick={() => setFilter(b)}
                  className="text-[10.5px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: active ? "var(--ca-accent)" : "var(--ca-surface-2)", color: active ? "var(--ca-accent-text)" : "var(--ca-text-3)" }}>
                  {b} <span style={{ opacity: 0.6 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderTop: "1px solid var(--ca-border)", borderBottom: "1px solid var(--ca-border)" }}>
                {["#", "Instrument", "Signal", "Score", "Entry", "Stop", "Target", "Size", "Next catalyst"].map((h) => (
                  <th key={h} className="text-left font-semibold px-4 py-2.5 text-[9.5px] uppercase tracking-[0.12em]"
                    style={{ color: "var(--ca-text-3)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                const ds = DIR_STYLE[s.direction] ?? DIR_STYLE.HOLD;
                return (
                  <tr key={s.ticker} style={{ borderBottom: "1px solid var(--ca-border)" }}>
                    <td className="px-4 py-2.5" style={{ color: "var(--ca-text-3)" }}>{s.rank}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold" style={{ color: "var(--ca-text)" }}>{s.ticker}</div>
                      <div className="text-[9.5px]" style={{ color: "var(--ca-text-3)" }}>{s.cls}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: ds.bg, color: ds.color }}>{s.direction}</span>
                    </td>
                    <td className="px-4 py-2.5" style={{ minWidth: 90 }}>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full flex-1" style={{ background: "var(--ca-surface-2)", minWidth: 40 }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${s.score}%`, background: s.score >= 65 ? "var(--ca-green)" : s.score >= 50 ? "var(--ca-accent)" : "var(--ca-text-3)" }} />
                        </div>
                        <span className="text-[11px] tabular-nums" style={{ color: "var(--ca-text-2)" }}>{s.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--ca-text)" }}>{fmt(s.entry)}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--ca-red)" }}>{fmt(s.stop)}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--ca-green)" }}>{fmt(s.target)}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--ca-text-2)" }}>{s.sizePct}%</td>
                    <td className="px-4 py-2.5 text-[10.5px]" style={{ color: "var(--ca-text-3)" }}>{s.nextCatalyst}</td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-[12px]" style={{ color: "var(--ca-text-3)" }}>No instruments in this bucket.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calendar + rules */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={14} style={{ color: "var(--ca-accent)" }} />
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--ca-text)" }}>Upcoming Catalysts</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.calendar.map((c) => (
              <div key={c.date + c.event} className="flex items-center gap-3 py-1.5">
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded" style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-2)" }}>{c.date.slice(5)}</span>
                <span className="text-[12px]" style={{ color: "var(--ca-text-2)" }}>{c.event}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ca-text)" }}>Risk Rules</p>
          <ul className="space-y-2 text-[11px]" style={{ color: "var(--ca-text-2)" }}>
            <li>• Stops pre-entered at 2.5×ATR</li>
            <li>• Max 20% single equity · 3% option premium</li>
            <li>• Drawdown −12% → sleeve to 10%</li>
            <li>• Drawdown −18% → core only</li>
            <li>• Trade ≥ once / 2 weeks (avoid −3)</li>
            <li>• Park idle cash in SGOV/BIL (−10% penalty)</li>
          </ul>
        </Card>
      </div>

      <p className="text-[10px] mt-6" style={{ color: "var(--ca-text-3)" }}>
        Model output from the v3 momentum engine · generated {data.generatedUtc} · research only, not investment advice.
        Re-run <span className="font-mono">generate_signals.py</span> to refresh.
      </p>
    </AppShell>
  );
}
