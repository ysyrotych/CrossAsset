"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { RefreshCw, Sparkles, FileText } from "lucide-react";
import MacroChart from "@/components/macro/MacroChart";
import { SECTIONS } from "@/lib/macro/manifest";
import type { ReportData, RenderedChart, SectionId } from "@/lib/macro/types";

export default function MacroReportPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [narratives, setNarratives] = useState<Record<string, string[]>>({});
  const [narrating, setNarrating] = useState(false);
  const scrollRefs = useRef<Record<string, HTMLElement | null>>({});
  const [active, setActive] = useState<SectionId>("monetary-policy");

  const loadData = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/macro-report/data").then((x) => x.json()).catch(() => null);
    setReport(r);
    setLoading(false);
    return r as ReportData | null;
  }, []);

  const narrate = useCallback(async (data: ReportData) => {
    setNarrating(true);
    await Promise.all(
      SECTIONS.filter((s) => s.chartIds.length).map(async (s) => {
        const facts = s.chartIds
          .map((id) => data.charts[id])
          .filter(Boolean)
          .map((c: RenderedChart) => ({
            title: c.title, unit: c.unit, latest: c.latest?.value,
            changeYoY: c.latest?.changeYoY, changeMoM: c.latest?.changeMoM,
            avg: c.avg, asOf: c.asOf,
          }));
        if (!facts.length) return;
        try {
          const res = await fetch("/api/macro-report/narrate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ section: s.id, title: s.title, facts }),
          }).then((x) => x.json());
          setNarratives((prev) => ({ ...prev, [s.id]: res.bullets ?? [] }));
        } catch { /* skip */ }
      }),
    );
    setNarrating(false);
  }, []);

  const generate = useCallback(async () => {
    const data = await loadData();
    if (data) narrate(data);
  }, [loadData, narrate]);

  useEffect(() => { generate(); /* one-click on load */ }, [generate]);

  function scrollTo(id: SectionId) {
    setActive(id);
    scrollRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const asDate = report ? new Date(report.generatedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";

  return (
    <AppShell>
      {/* header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-2" style={{ color: "var(--ca-text-2)" }}>Weekly Economic Update</p>
          <h1 className="text-[34px] font-light tracking-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>U.S. Macro Report</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--ca-text-3)" }}>
            {report ? `Generated ${asDate} · ${Object.keys(report.charts).length} live exhibits across ${SECTIONS.length} sections` : "Generating full macro report…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generate} disabled={loading || narrating}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-medium text-white inst-card-hover"
            style={{ background: "var(--ca-accent)" }}>
            <RefreshCw size={13} className={loading || narrating ? "animate-spin" : ""} /> Regenerate
          </button>
        </div>
      </div>

      {/* sticky section nav */}
      <div className="sticky top-0 z-20 -mx-10 px-10 py-2.5 mb-6 flex gap-1.5 overflow-x-auto"
        style={{ background: "var(--ca-bg)", borderBottom: "1px solid var(--ca-border)" }}>
        {SECTIONS.filter((s) => s.chartIds.length).map((s) => (
          <button key={s.id} onClick={() => scrollTo(s.id)}
            className="whitespace-nowrap px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-colors shrink-0"
            style={{ background: active === s.id ? "var(--ca-accent)" : "var(--ca-surface)",
              color: active === s.id ? "#fff" : "var(--ca-text-2)",
              border: `1px solid ${active === s.id ? "var(--ca-accent)" : "var(--ca-border)"}` }}>
            {s.title}
          </button>
        ))}
      </div>

      {loading && !report ? (
        <div className="grid grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 rounded-xl inst-skeleton" />)}</div>
      ) : report ? (
        <div className="space-y-12 pb-20">
          {SECTIONS.filter((s) => s.chartIds.length).map((s) => {
            const charts = s.chartIds.map((id) => report.charts[id]).filter(Boolean);
            const bullets = narratives[s.id];
            return (
              <section key={s.id} ref={(el) => { scrollRefs.current[s.id] = el; }} className="scroll-mt-16 inst-fade-up">
                <div className="flex items-baseline gap-3 mb-4 pb-2" style={{ borderBottom: "2px solid var(--ca-accent)" }}>
                  <h2 className="text-[20px] font-semibold tracking-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>{s.title}</h2>
                </div>

                {/* narrative */}
                <div className="rounded-xl p-4 mb-4" style={{ background: "var(--ca-surface-2)", border: "1px solid var(--ca-border)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={12} style={{ color: "var(--ca-accent)" }} />
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ca-text-3)" }}>Analysis</p>
                  </div>
                  {bullets ? (
                    <ul className="space-y-1.5">
                      {bullets.map((b, i) => (
                        <li key={i} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: "var(--ca-text)" }}>
                          <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "var(--ca-accent)" }} />{b}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12.5px] flex items-center gap-2" style={{ color: "var(--ca-text-3)" }}>
                      <RefreshCw size={12} className="animate-spin" /> Writing analysis…
                    </p>
                  )}
                </div>

                {/* chart grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {charts.map((c) => <MacroChart key={c.id} chart={c} />)}
                </div>
              </section>
            );
          })}

          <p className="text-[10.5px] pt-6" style={{ color: "var(--ca-text-3)", borderTop: "1px solid var(--ca-border)" }}>
            <FileText size={11} className="inline mr-1" />
            Live series from FRED & market data; proprietary series (ISM, NFIB, Conference Board, NAHB, MOVE, Baltic Dry) refreshed monthly from published releases. Research only, not investment advice.
          </p>
        </div>
      ) : (
        <p className="text-[13px]" style={{ color: "var(--ca-text-3)" }}>Could not generate the report. Check FRED_API_KEY.</p>
      )}
    </AppShell>
  );
}
