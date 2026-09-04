"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
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

export default function ChartDetailModal({ chart, onClose }: { chart: RenderedChart; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
              {chart.unit}{chart.stale && chart.asOf ? ` · as of ${chart.asOf}` : chart.latest ? ` · latest ${new Date(chart.latest.date).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: "var(--ca-text-3)" }}><X size={18} /></button>
        </div>

        <div className="px-6 py-4">
          {/* stat row */}
          <div className="grid grid-cols-6 gap-3 mb-4">
            {stats.map((st) => (
              <div key={st.label} className="rounded-lg px-3 py-2" style={{ background: "var(--ca-surface-2)" }}>
                <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--ca-text-3)" }}>{st.label}</p>
                <div className="text-[15px] font-semibold tabular-nums" style={{ color: "var(--ca-text)" }}>{st.node}</div>
              </div>
            ))}
          </div>
          {/* big chart — reuse MacroChart at large height, its own header hidden by wrapping */}
          <div className="rounded-xl overflow-hidden">
            <MacroChart chart={chart} height={380} bare />
          </div>
          {chart.note && <p className="text-[11px] mt-3" style={{ color: "var(--ca-text-3)" }}>{chart.note}</p>}
        </div>
      </div>
    </div>
  );
}
