"use client";

import { useState } from "react";
import { LayoutGrid, ChevronDown } from "lucide-react";
import type { ReportData, RenderedChart } from "@/lib/macro/types";

const GROUPS: { title: string; ids: string[] }[] = [
  { title: "Growth", ids: ["gdp-growth", "cfnai", "wei", "ind-production", "cap-util", "inventory-sales"] },
  { title: "Inflation & Wages", ids: ["pce", "cpi", "ppi", "cpi-shelter", "avg-hourly-earnings", "unit-labor-costs"] },
  { title: "Labor", ids: ["unrate", "claims", "continuing-claims", "jolts-openings", "sahm-rule", "temp-help"] },
  { title: "Consumer", ids: ["real-income", "retail-sales", "pce-services", "saving-rate", "cc-delinquency", "consumer-credit"] },
  { title: "Rates, Credit & Fiscal", ids: ["yield-10y", "yield-curve-2s10s", "hy-oas", "vix", "loan-standards", "fed-interest"] },
  { title: "Housing", ids: ["starts", "case-shiller", "mortgage-rate", "affordability", "new-sales", "existing-sales"] },
];

// blue (low in range) -> gray (mid) -> crimson (high in range)
function heat(pct: number): { bg: string; fg: string } {
  if (pct >= 80) return { bg: "#fdecec", fg: "#b42318" };
  if (pct >= 60) return { bg: "#fff6ed", fg: "#b7791f" };
  if (pct >= 40) return { bg: "#f3f4f6", fg: "#4b5563" };
  if (pct >= 20) return { bg: "#eef4fb", fg: "#2563eb" };
  return { bg: "#e8f0fb", fg: "#1d4ed8" };
}

function fmt(c: RenderedChart): string {
  const v = c.latest?.value; if (v == null) return "—";
  const p = c.precision ?? 1;
  const n = Math.abs(v) >= 10000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(p);
  return c.unit.includes("%") ? `${n}%` : c.unit.startsWith("$") ? `$${n}` : n;
}

export default function MacroHeatmap({ report, onOpen }: { report: ReportData; onOpen: (c: RenderedChart) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl mb-6 macro-no-print" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <LayoutGrid size={14} style={{ color: "var(--ca-accent)" }} />
          <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--ca-text-2)" }}>Macro at a Glance</p>
          <span className="text-[10px]" style={{ color: "var(--ca-text-3)" }}>every indicator by its historical percentile</span>
        </div>
        <ChevronDown size={15} style={{ color: "var(--ca-text-3)", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && (
        <div className="px-4 pb-4 inst-fade-up">
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: "var(--ca-text-3)" }}>{g.title}</p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {g.ids.map((id) => {
                  const c = report.charts[id];
                  if (!c?.latest || !c.stats) return null;
                  const t = heat(c.stats.percentile);
                  return (
                    <button key={id} onClick={() => onOpen(c)} className="rounded-lg px-2.5 py-2 text-left inst-card-hover" style={{ background: t.bg }}>
                      <p className="text-[9px] font-semibold uppercase tracking-wide truncate mb-1" style={{ color: t.fg }}>{c.title.replace(/^(CPI: |Real )/, "")}</p>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--ca-text)" }}>{fmt(c)}</span>
                        <span className="text-[9px] tabular-nums" style={{ color: t.fg }}>{Math.round(c.stats.percentile)}%ile</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 mt-2 text-[9px]" style={{ color: "var(--ca-text-3)" }}>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: "#e8f0fb" }} />low in range</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: "#f3f4f6" }} />mid</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: "#fdecec" }} />high in range</span>
          </div>
        </div>
      )}
    </div>
  );
}
