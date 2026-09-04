"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { RefreshCw, Sparkles, FileText } from "lucide-react";
import MacroChart from "@/components/macro/MacroChart";
import { SECTIONS } from "@/lib/macro/manifest";
import type { ReportData, RenderedChart, SectionId } from "@/lib/macro/types";

function fmtLatest(c: RenderedChart): string {
  const v = c.latest?.value;
  if (v == null) return "n/a";
  const p = c.precision ?? 1;
  const n = Math.abs(v) >= 10000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(p);
  if (c.unit.includes("%")) return `${n}%`;
  if (c.unit.startsWith("$")) return `$${n}`;
  return n;
}

const KEY_TILES: [string, string][] = [
  ["fed-funds", "Fed Funds"], ["pce", "Core PCE"], ["unrate", "Unemployment"],
  ["gdp-growth", "GDP q/q"], ["yield-10y", "10Y UST"], ["vix", "VIX"],
];

export default function MacroReportPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [narratives, setNarratives] = useState<Record<string, string[]>>({});
  const [narrating, setNarrating] = useState(false);
  const [summary, setSummary] = useState<{ headline: string; macro: string[]; markets: string[] } | null>(null);
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

  const summarize = useCallback(async (data: ReportData) => {
    const HEADLINE: [string, string][] = [
      ["fed-funds", "Fed Funds"], ["pce", "PCE inflation"], ["cpi", "CPI inflation"],
      ["unrate", "Unemployment"], ["payrolls", "Payrolls (m/m, k)"], ["gdp-growth", "GDP growth"],
      ["yield-10y", "10Y Treasury"], ["yield-curve-2s10s", "2s10s (bps)"], ["vix", "VIX"],
      ["hy-oas", "HY OAS (bps)"], ["oil-brent", "Brent oil"], ["gold", "Gold"],
    ];
    const facts = HEADLINE
      .map(([id, label]) => { const c = data.charts[id]; return c?.latest ? { label, value: fmtLatest(c) } : null; })
      .filter(Boolean);
    try {
      const res = await fetch("/api/macro-report/summary", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facts }),
      }).then((x) => x.json());
      setSummary({ headline: res.headline, macro: res.macro ?? [], markets: res.markets ?? [] });
    } catch { /* skip */ }
  }, []);

  const generate = useCallback(async () => {
    setSummary(null); setNarratives({});
    const data = await loadData();
    if (data) { summarize(data); narrate(data); }
  }, [loadData, narrate, summarize]);

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

      {/* executive summary hero */}
      {report && (
        <div className="rounded-2xl p-6 mb-6 inst-scale-in inst-aurora" style={{ color: "#fff" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>Executive Summary</p>
          {summary ? (
            <>
              <h2 className="text-[22px] font-light leading-snug mb-4 max-w-4xl" style={{ fontFamily: "var(--font-serif)" }}>{summary.headline}</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>Macro</p>
                  <ul className="space-y-1.5">{summary.macro.map((b, i) => <li key={i} className="flex gap-2 text-[12.5px]" style={{ color: "rgba(255,255,255,0.9)" }}><span className="mt-1.5 w-1 h-1 rounded-full shrink-0 bg-white/60" />{b}</li>)}</ul>
                </div>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>Markets</p>
                  <ul className="space-y-1.5">{summary.markets.map((b, i) => <li key={i} className="flex gap-2 text-[12.5px]" style={{ color: "rgba(255,255,255,0.9)" }}><span className="mt-1.5 w-1 h-1 rounded-full shrink-0 bg-white/60" />{b}</li>)}</ul>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-[13px] py-3" style={{ color: "rgba(255,255,255,0.8)" }}><RefreshCw size={14} className="animate-spin" /> Synthesizing the week…</div>
          )}
          {/* key tiles */}
          <div className="grid grid-cols-6 gap-3 mt-5 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
            {KEY_TILES.map(([id, label]) => {
              const c = report.charts[id];
              return (
                <div key={id}>
                  <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</p>
                  <p className="text-[19px] font-semibold tabular-nums leading-none">{c ? fmtLatest(c) : "—"}</p>
                  {c?.latest?.changeYoY != null && <p className="text-[10px] tabular-nums mt-0.5" style={{ color: c.latest.changeYoY >= 0 ? "#7ee2a8" : "#f7a8a8" }}>{c.latest.changeYoY >= 0 ? "+" : ""}{c.latest.changeYoY.toFixed(1)}% y/y</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
