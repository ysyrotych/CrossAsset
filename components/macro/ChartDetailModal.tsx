"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Download } from "lucide-react";
import MacroChart, { ChangeText } from "./MacroChart";
import { SECTION_TITLE } from "@/lib/macro/manifest";
import type { RenderedChart } from "@/lib/macro/types";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function fmt(v: number | undefined, unit: string, p = 1): string {
  if (v == null) return "—";
  const n = Math.abs(v) >= 10000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(p);
  if (unit.includes("%")) return `${n}%`;
  if (unit.startsWith("$")) return `$${n}`;
  return n;
}

const RANGES: { label: string; years: number | null }[] = [
  { label: "1Y", years: 1 }, { label: "3Y", years: 3 }, { label: "5Y", years: 5 }, { label: "Max", years: null },
];

export default function ChartDetailModal({ chart, onClose }: { chart: RenderedChart; onClose: () => void }) {
  const [range, setRange] = useState<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // filter series by selected range
  const viewChart = useMemo<RenderedChart>(() => {
    if (range == null) return chart;
    // filter relative to the series' own latest observation (pure — no wall clock)
    const maxT = Math.max(...chart.series.flatMap((s) => s.data.map((d) => new Date(d.date).getTime())), 0);
    const cutoff = maxT - range * 365.25 * 864e5;
    return { ...chart, series: chart.series.map((s) => ({ ...s, data: s.data.filter((d) => new Date(d.date).getTime() >= cutoff) })) };
  }, [chart, range]);

  function downloadCSV() {
    const dates = Array.from(new Set(chart.series.flatMap((s) => s.data.map((d) => d.date)))).sort();
    const header = ["date", ...chart.series.map((s) => s.name)].join(",");
    const rows = dates.map((dt) => {
      const cells = chart.series.map((s) => s.data.find((d) => d.date === dt)?.value ?? "");
      return [dt, ...cells].join(",");
    });
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${chart.id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const p = chart.precision ?? 1;
  const s = chart.stats;
  const stats: { label: string; node: React.ReactNode }[] = [
    { label: "Latest", node: fmt(chart.latest?.value, chart.unit, p) },
    { label: "Change", node: <ChangeText change={chart.latest?.change} unit={chart.latest?.changeUnit} precision={p} cls="text-[15px] font-semibold" /> },
    { label: "Average", node: chart.avg != null ? fmt(chart.avg, chart.unit, p) : "—" },
    { label: "Min", node: fmt(s?.min, chart.unit, p) },
    { label: "Max", node: fmt(s?.max, chart.unit, p) },
    { label: "Percentile", node: s ? ordinal(Math.round(s.percentile)) : "—" },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6" style={{ background: "rgba(12,27,56,0.45)", backdropFilter: "blur(3px)" }} onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden inst-scale-in" style={{ background: "var(--ca-surface)", boxShadow: "0 30px 90px -20px rgba(12,27,56,0.6)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-5 pb-3" style={{ borderBottom: "1px solid var(--ca-border)" }}>
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: "var(--ca-accent)" }}>{SECTION_TITLE[chart.section]}</p>
            <h2 className="text-[22px] font-light" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>{chart.title}</h2>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--ca-text-3)" }}>
              {chart.unit}{chart.stale && chart.asOf ? ` · seeded, as of ${chart.asOf}` : chart.latest ? ` · latest ${new Date(chart.latest.date).toLocaleDateString(undefined, { month: "short", year: "numeric" })} · live` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={downloadCSV} title="Download CSV" className="p-1.5 rounded-lg inst-card-hover" style={{ color: "var(--ca-text-3)", border: "1px solid var(--ca-border)" }}><Download size={15} /></button>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--ca-text-3)" }}><X size={18} /></button>
          </div>
        </div>

        <div className="px-6 py-4">
          {/* stat row */}
          <div className="grid grid-cols-6 gap-3 mb-3">
            {stats.map((st) => (
              <div key={st.label} className="rounded-lg px-3 py-2" style={{ background: "var(--ca-surface-2)" }}>
                <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--ca-text-3)" }}>{st.label}</p>
                <div className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--ca-text)" }}>{st.node}</div>
              </div>
            ))}
          </div>

          {/* range toggle */}
          <div className="flex items-center justify-end gap-1 mb-2">
            {RANGES.map((r) => (
              <button key={r.label} onClick={() => setRange(r.years)}
                className="px-2.5 py-1 rounded-md text-[10.5px] font-semibold transition-colors"
                style={{ background: range === r.years ? "var(--ca-accent)" : "var(--ca-surface-2)", color: range === r.years ? "#fff" : "var(--ca-text-3)" }}>
                {r.label}
              </button>
            ))}
          </div>

          {/* big chart */}
          <div className="rounded-xl overflow-hidden">
            <MacroChart chart={viewChart} height={360} bare />
          </div>
          <div className="flex items-center justify-between mt-3">
            {chart.note ? <p className="text-[11px]" style={{ color: "var(--ca-text-3)" }}>{chart.note}</p> : <span />}
            {chart.sourceId && <p className="text-[10px] tabular-nums" style={{ color: "var(--ca-text-3)" }}>Source: {chart.sourceId}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
