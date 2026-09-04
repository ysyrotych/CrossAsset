"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { ReportData, RenderedChart } from "@/lib/macro/types";

type Status = "safe" | "watch" | "warning";
type Signal = {
  id: string; label: string;
  classify: (v: number) => Status;
  fmt: (v: number) => string;
};

// Research-backed recession signals (whatisarecession.com / FRED), each with
// conventional thresholds. Lower/higher "good" varies by series.
const SIGNALS: Signal[] = [
  { id: "sahm-rule",      label: "Sahm Rule",             classify: (v) => (v >= 0.5 ? "warning" : v >= 0.3 ? "watch" : "safe"), fmt: (v) => v.toFixed(2) },
  { id: "recession-prob", label: "NY Fed Prob (12m)",     classify: (v) => (v > 40 ? "warning" : v > 20 ? "watch" : "safe"),     fmt: (v) => `${v.toFixed(0)}%` },
  { id: "yield-10y3m",    label: "10y-3m Curve",          classify: (v) => (v < 0 ? "warning" : v < 0.4 ? "watch" : "safe"),     fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}pp` },
  { id: "cfnai",          label: "Chicago Fed Activity",  classify: (v) => (v < -0.7 ? "warning" : v < -0.2 ? "watch" : "safe"), fmt: (v) => v.toFixed(2) },
  { id: "wei",            label: "Weekly Econ Index",     classify: (v) => (v < 0 ? "warning" : v < 1.5 ? "watch" : "safe"),     fmt: (v) => `${v.toFixed(1)}%` },
  { id: "fin-stress",     label: "Financial Stress",      classify: (v) => (v > 1 ? "warning" : v > 0 ? "watch" : "safe"),       fmt: (v) => v.toFixed(2) },
  { id: "claims",         label: "Jobless Claims",        classify: (v) => (v > 300 ? "warning" : v > 260 ? "watch" : "safe"),   fmt: (v) => `${v.toFixed(0)}k` },
  { id: "unrate",         label: "Unemployment",          classify: (v) => (v > 5 ? "warning" : v > 4.4 ? "watch" : "safe"),     fmt: (v) => `${v.toFixed(1)}%` },
];

const TONE: Record<Status, { fg: string; bg: string; dot: string }> = {
  safe:    { fg: "#147a4f", bg: "#f0fdf4", dot: "#22c55e" },
  watch:   { fg: "#b7791f", bg: "#fffbeb", dot: "#f59e0b" },
  warning: { fg: "#b42318", bg: "#fef2f2", dot: "#ef4444" },
};

export default function RecessionScoreboard({ report, onOpen }: { report: ReportData; onOpen: (c: RenderedChart) => void }) {
  const rows = SIGNALS
    .map((s) => { const c = report.charts[s.id]; const v = c?.latest?.value; return v != null ? { s, c: c!, v, status: s.classify(v) } : null; })
    .filter(Boolean) as { s: Signal; c: RenderedChart; v: number; status: Status }[];
  if (!rows.length) return null;

  const warnings = rows.filter((r) => r.status === "warning").length;
  const watches = rows.filter((r) => r.status === "watch").length;
  const composite: Status = warnings >= 3 ? "warning" : warnings >= 1 || watches >= 4 ? "watch" : "safe";
  const compLabel = composite === "warning" ? "Elevated" : composite === "watch" ? "Moderate" : "Low";
  const t = TONE[composite];

  return (
    <div className="rounded-xl p-4 mb-6 macro-no-print inst-fade-up" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {composite === "safe" ? <ShieldCheck size={14} style={{ color: t.fg }} /> : <AlertTriangle size={14} style={{ color: t.fg }} />}
          <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--ca-text-2)" }}>Recession Signal Scoreboard</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "var(--ca-text-3)" }}>{warnings} warning · {watches} watch · {rows.length - warnings - watches} clear</span>
          <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full" style={{ background: t.bg, color: t.fg }}>Risk: {compLabel}</span>
        </div>
      </div>
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {rows.map(({ s, c, v, status }) => {
          const tt = TONE[status];
          return (
            <button key={s.id} onClick={() => onOpen(c)} className="rounded-lg px-2.5 py-2 text-left inst-card-hover" style={{ background: tt.bg }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tt.dot }} />
                <span className="text-[9px] font-semibold uppercase tracking-wide truncate" style={{ color: tt.fg }}>{s.label}</span>
              </div>
              <p className="text-[14px] font-bold tabular-nums leading-none" style={{ color: "var(--ca-text)" }}>{s.fmt(v)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
