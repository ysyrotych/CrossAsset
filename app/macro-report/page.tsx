"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { RefreshCw, Sparkles, FileText, Play, Download, ArrowUp, Link2 } from "lucide-react";
import MacroChart from "@/components/macro/MacroChart";
import PresentationMode from "@/components/macro/PresentationMode";
import ChartDetailModal from "@/components/macro/ChartDetailModal";
import FedSEPTable from "@/components/macro/FedSEPTable";
import YieldCurveChart from "@/components/macro/YieldCurveChart";
import MarketsPanel from "@/components/macro/MarketsPanel";
import MacroAsk from "@/components/macro/MacroAsk";
import RecessionScoreboard from "@/components/macro/RecessionScoreboard";
import MacroHeatmap from "@/components/macro/MacroHeatmap";
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
  ["fed-funds", "Fed Funds"], ["pce", "PCE Infl"], ["unrate", "Unemployment"],
  ["gdp-growth", "GDP q/q"], ["yield-10y", "10Y UST"], ["yield-curve-2s10s", "2s10s"],
  ["hy-oas", "HY OAS"], ["vix", "VIX"],
];

function computeRegime(charts: Record<string, RenderedChart>): { label: string; tone: string } {
  const infl = charts["pce"]?.latest?.value ?? 3;
  const gdp = charts["gdp-growth"]?.latest?.value ?? 2;
  const ur = charts["unrate"]?.latest?.value ?? 4;
  if (gdp < 0) return { label: "Contraction", tone: "#b42318" };
  if (infl > 3 && gdp < 1.5) return { label: "Stagflation Risk", tone: "#b7791f" };
  if (infl < 2.5 && gdp > 2) return { label: "Goldilocks", tone: "#147a4f" };
  if (infl > 3) return { label: "Sticky Inflation", tone: "#b7791f" };
  if (ur > 5) return { label: "Labor Weakening", tone: "#b42318" };
  return { label: "Late-Cycle Expansion", tone: "#0369a1" };
}

export default function MacroReportPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [narratives, setNarratives] = useState<Record<string, string[]>>({});
  const [narrating, setNarrating] = useState(false);
  const [summary, setSummary] = useState<{ headline: string; macro: string[]; markets: string[] } | null>(null);
  const scrollRefs = useRef<Record<string, HTMLElement | null>>({});
  const navRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const suppressSpy = useRef(false);
  const spyTimer = useRef<number | undefined>(undefined);
  const [active, setActive] = useState<SectionId>("monetary-policy");
  const [presenting, setPresenting] = useState(false);
  const [expanded, setExpanded] = useState<RenderedChart | null>(null);
  const [showTop, setShowTop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [movers, setMovers] = useState<{ id: string; title: string; unit: string; pct: number; to: number }[]>([]);

  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    const r = await fetch(`/api/macro-report/data${force ? "?force=1" : ""}`).then((x) => x.json()).catch(() => null);
    setReport(r);
    setLoading(false);
    return r as ReportData | null;
  }, []);

  const narrate = useCallback(async (data: ReportData) => {
    setNarrating(true);
    const sections = SECTIONS.filter((s) => s.chartIds.length);
    const runOne = async (s: (typeof sections)[number]) => {
      const facts = s.chartIds
        .map((id) => data.charts[id])
        .filter(Boolean)
        .map((c: RenderedChart) => ({
          title: c.title, unit: c.unit, latest: c.latest?.value,
          change: c.latest?.change, changeUnit: c.latest?.changeUnit,
          avg: c.avg, asOf: c.asOf, percentile: c.stats?.percentile,
        }));
      if (!facts.length) return;
      try {
        const res = await fetch("/api/macro-report/narrate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section: s.id, title: s.title, facts }),
        }).then((x) => x.json());
        setNarratives((prev) => {
          const next = { ...prev, [s.id]: res.bullets?.length ? res.bullets : ["Analysis unavailable for this section."] };
          try { sessionStorage.setItem(`macro_narr_${data.generatedAt.slice(0, 10)}`, JSON.stringify(next)); } catch {}
          return next;
        });
      } catch {
        setNarratives((prev) => ({ ...prev, [s.id]: ["Analysis temporarily unavailable — data shown below."] }));
      }
    };
    // concurrency pool of 4 to avoid rate limits on ~18 sections
    const queue = [...sections];
    const workers = Array.from({ length: 4 }, async () => {
      while (queue.length) { const s = queue.shift(); if (s) await runOne(s); }
    });
    await Promise.all(workers);
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
      const sum = { headline: res.headline, macro: res.macro ?? [], markets: res.markets ?? [] };
      setSummary(sum);
      try { sessionStorage.setItem(`macro_summ_${data.generatedAt.slice(0, 10)}`, JSON.stringify(sum)); } catch {}
    } catch { /* skip */ }
  }, []);

  const diffSnapshot = useCallback((data: ReportData) => {
    try {
      const snap: Record<string, number> = {};
      for (const [id, c] of Object.entries(data.charts)) if (c.latest) snap[id] = c.latest.value;
      const prevRaw = localStorage.getItem("crossasset_macro_snapshot");
      if (prevRaw) {
        const prev = JSON.parse(prevRaw) as Record<string, number>;
        const m = Object.entries(snap)
          .filter(([id]) => prev[id] != null && prev[id] !== 0 && Number.isFinite(prev[id]))
          .filter(([id]) => !data.charts[id]?.stale) // exclude seeded series (synthetic jumps)
          .map(([id, to]) => ({ id, title: data.charts[id].title, unit: data.charts[id].unit, to, pct: ((to - prev[id]) / Math.abs(prev[id])) * 100 }))
          // 0.1% noise floor; drop >40% moves (macro series don't; those are unit/scale artifacts)
          .filter((x) => Math.abs(x.pct) >= 0.1 && Math.abs(x.pct) <= 40)
          .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
          .slice(0, 10);
        setMovers(m);
      }
      localStorage.setItem("crossasset_macro_snapshot", JSON.stringify(snap));
    } catch { /* ignore */ }
  }, []);

  const generate = useCallback(async (force = false) => {
    setSummary(null); setNarratives({}); setMovers([]);
    const data = await loadData(force);
    if (!data) return;
    diffSnapshot(data);
    const key = data.generatedAt.slice(0, 10);
    const cachedS = !force ? sessionStorage.getItem(`macro_summ_${key}`) : null;
    const cachedN = !force ? sessionStorage.getItem(`macro_narr_${key}`) : null;
    if (cachedS) { try { setSummary(JSON.parse(cachedS)); } catch { summarize(data); } } else summarize(data);
    if (cachedN) { try { setNarratives(JSON.parse(cachedN)); } catch { narrate(data); } } else narrate(data);
  }, [loadData, narrate, summarize, diffSnapshot]);

  useEffect(() => { generate(); /* one-click on load */ }, [generate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "p" && report && !presenting && (e.target as HTMLElement)?.tagName !== "INPUT") setPresenting(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [report, presenting]);

  // scroll-spy: highlight the section in view + track scroll progress
  useEffect(() => {
    if (!report) return;
    const onScroll = () => {
      const doc = document.documentElement;
      setProgress((doc.scrollTop / (doc.scrollHeight - doc.clientHeight)) * 100);
      setShowTop(doc.scrollTop > 700);
      if (suppressSpy.current) return; // don't fight a programmatic scroll
      let current: SectionId | null = null;
      for (const s of SECTIONS) {
        const el = scrollRefs.current[s.id];
        if (el && el.getBoundingClientRect().top < 140) current = s.id;
      }
      if (current) setActive(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [report]);

  // keep the active nav pill visible + reflect section in the URL hash
  useEffect(() => {
    navRefs.current[active]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    if (window.location.hash !== `#${active}`) history.replaceState(null, "", `#${active}`);
  }, [active]);

  // document title + deep-link scroll on first load
  useEffect(() => { document.title = "U.S. Macro Report · CrossAsset"; }, []);
  useEffect(() => {
    if (!report) return;
    const h = window.location.hash.replace(/^#/, "") as SectionId;
    if (!h || !scrollRefs.current[h]) return;
    // charts render/expand after mount and shift layout — re-scroll as it settles
    const timers = [350, 1000, 1900].map((ms) => setTimeout(() => scrollTo(h), ms));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  // '/' focuses the Ask box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && (e.target as HTMLElement)?.tagName !== "INPUT") {
        const el = document.getElementById("macro-ask-input");
        if (el) { e.preventDefault(); el.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
  }

  function scrollTo(id: SectionId) {
    const el = scrollRefs.current[id];
    if (!el) return;
    suppressSpy.current = true;           // stop the spy from re-firing setActive mid-scroll
    setActive(id);
    const y = el.getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top: y, behavior: "smooth" });
    window.clearTimeout(spyTimer.current);
    spyTimer.current = window.setTimeout(() => { suppressSpy.current = false; }, 900);
  }

  const asDate = report ? new Date(report.generatedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";

  return (
    <AppShell>
      {/* scroll progress bar */}
      <div className="fixed top-0 left-56 right-0 h-[3px] z-50 macro-no-print" style={{ background: "transparent" }}>
        <div className="h-full transition-[width] duration-150" style={{ width: `${progress}%`, background: "var(--ca-accent)" }} />
      </div>

      {/* back to top */}
      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full shadow-lg inst-card-hover macro-no-print"
          style={{ background: "var(--ca-accent)", color: "#fff" }} aria-label="Back to top">
          <ArrowUp size={18} />
        </button>
      )}

      {/* print-only cover page */}
      <div className="macro-print-cover">
        <p className="text-[12px] font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "var(--ca-accent)" }}>Weekly Economic Update</p>
        <h1 className="text-[46px] font-light leading-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>U.S. Macroeconomic &amp;<br />Financial Market Report</h1>
        <p className="text-[16px] mt-5" style={{ color: "var(--ca-text-2)" }}>{asDate}</p>
        <p className="text-[12px] mt-10" style={{ color: "var(--ca-text-3)" }}>CrossAsset · Macro Intelligence — research only, not investment advice</p>
      </div>

      {/* header */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-2" style={{ color: "var(--ca-text-2)" }}>Weekly Economic Update</p>
          <h1 className="text-[34px] font-light tracking-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>U.S. Macro Report</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--ca-text-3)" }}>
            {report
              ? `Generated ${asDate} · ${Object.keys(report.charts).length} exhibits across ${SECTIONS.length} sections${narrating ? ` · writing analysis (${Object.keys(narratives).length}/${SECTIONS.filter((s) => s.chartIds.length).length})…` : ""}`
              : "Generating full macro report…"}
          </p>
        </div>
        <div className="flex items-center gap-2 macro-no-print">
          <button onClick={copyLink} disabled={!report}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-medium inst-card-hover"
            style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)", color: "var(--ca-text-2)" }}>
            <Link2 size={13} /> Share
          </button>
          <button onClick={() => window.print()} disabled={!report}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-medium inst-card-hover"
            style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)", color: "var(--ca-text-2)" }}>
            <Download size={13} /> PDF
          </button>
          <button onClick={() => setPresenting(true)} disabled={!report}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-medium inst-card-hover"
            style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)", color: "var(--ca-text-2)" }}>
            <Play size={13} /> Present <kbd className="text-[10px] px-1 py-0.5 rounded ml-0.5" style={{ background: "var(--ca-surface-2)" }}>P</kbd>
          </button>
          <button onClick={() => generate(true)} disabled={loading || narrating}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-medium text-white inst-card-hover"
            style={{ background: "var(--ca-accent)" }}>
            <RefreshCw size={13} className={loading || narrating ? "animate-spin" : ""} /> Regenerate
          </button>
        </div>
      </div>

      {/* FRED connectivity warning */}
      {report && !report.fredConnected && (
        <div className="rounded-xl px-4 py-3 mb-6 macro-no-print" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
          <p className="text-[12px]" style={{ color: "#854d0e" }}>
            ⚠ Live FRED data is unavailable (missing <code>FRED_API_KEY</code>). Seeded survey charts and market data still render; FRED-sourced charts will populate once the key is configured.
          </p>
        </div>
      )}

      {/* executive summary hero */}
      {report && (
        <div className="rounded-2xl p-6 mb-6 inst-scale-in inst-aurora macro-hero" style={{ color: "#fff" }}>
          <div className="flex items-center gap-3 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.6)" }}>Executive Summary</p>
            {(() => { const r = computeRegime(report.charts); return (
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full" style={{ background: r.tone, color: "#fff" }}>{r.label}</span>
            ); })()}
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }}>Recession odds 12m: ~25%</span>
            <span className="ml-auto text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>FRED live · surveys as of Aug ’26</span>
          </div>
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
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3 mt-5 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
            {KEY_TILES.map(([id, label]) => {
              const c = report.charts[id];
              return (
                <div key={id}>
                  <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</p>
                  <p className="text-[19px] font-semibold tabular-nums leading-none">{c ? fmtLatest(c) : "—"}</p>
                  {c?.latest?.change != null && <p className="text-[10px] tabular-nums mt-0.5" style={{ color: c.latest.change >= 0 ? "#7ee2a8" : "#f7a8a8" }}>{c.latest.change >= 0 ? "+" : ""}{c.latest.changeUnit === "pp" ? `${c.latest.change.toFixed(2)} pp` : `${c.latest.change.toFixed(1)}% y/y`}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* recession signal scoreboard */}
      {report && <RecessionScoreboard report={report} onOpen={setExpanded} />}

      {/* macro at a glance heatmap */}
      {report && <MacroHeatmap report={report} onOpen={setExpanded} />}

      {/* ask the economy */}
      {report && <MacroAsk />}

      {/* movers since last visit */}
      {movers.length > 0 && (
        <div className="rounded-xl px-4 py-3 mb-6 macro-no-print inst-fade-up" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
          <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "var(--ca-text-3)" }}>Movers since your last visit</p>
          <div className="flex flex-wrap gap-2">
            {movers.map((m) => (
              <button key={m.id} onClick={() => { const c = report?.charts[m.id]; if (c) setExpanded(c); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] inst-card-hover" style={{ background: "var(--ca-surface-2)" }}>
                <span className="font-medium" style={{ color: "var(--ca-text)" }}>{m.title}</span>
                <span className="tabular-nums font-semibold" style={{ color: m.pct >= 0 ? "#147a4f" : "#b42318" }}>{m.pct >= 0 ? "▲" : "▼"} {Math.abs(m.pct).toFixed(1)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* sticky section nav */}
      <div className="sticky top-0 z-20 -mx-10 px-10 py-2.5 mb-6 flex gap-1.5 overflow-x-auto macro-no-print"
        style={{ background: "var(--ca-bg)", borderBottom: "1px solid var(--ca-border)" }}>
        {SECTIONS.filter((s) => s.chartIds.length).map((s) => (
          <button key={s.id} ref={(el) => { navRefs.current[s.id] = el; }} onClick={() => scrollTo(s.id)}
            className="whitespace-nowrap px-3 py-1.5 rounded-full text-[11.5px] font-medium transition-colors shrink-0"
            style={{ background: active === s.id ? "var(--ca-accent)" : "var(--ca-surface)",
              color: active === s.id ? "#fff" : "var(--ca-text-2)",
              border: `1px solid ${active === s.id ? "var(--ca-accent)" : "var(--ca-border)"}` }}>
            {s.title}
          </button>
        ))}
      </div>

      {loading && !report ? (
        <div>
          <div className="h-56 rounded-2xl inst-skeleton mb-6" />
          <div className="flex items-center gap-2 mb-4 text-[12.5px]" style={{ color: "var(--ca-text-3)" }}>
            <RefreshCw size={13} className="animate-spin" /> Pulling live FRED &amp; market data, computing transforms, writing AI analysis…
          </div>
          <div className="grid grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 rounded-xl inst-skeleton" />)}</div>
        </div>
      ) : report ? (
        <div className="space-y-12 pb-20">
          {SECTIONS.filter((s) => s.chartIds.length).map((s, idx) => {
            const charts = s.chartIds.map((id) => report.charts[id]).filter(Boolean);
            const bullets = narratives[s.id];
            return (
              <section key={s.id} ref={(el) => { scrollRefs.current[s.id] = el; }} className="scroll-mt-16 inst-fade-up macro-section">
                <div className="flex items-center gap-3 mb-4 pb-2" style={{ borderBottom: "2px solid var(--ca-accent)" }}>
                  <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded" style={{ background: "var(--ca-accent)", color: "#fff" }}>{String(idx + 1).padStart(2, "0")}</span>
                  <h2 className="text-[20px] font-semibold tracking-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>{s.title}</h2>
                  <span className="ml-auto text-[10px]" style={{ color: "var(--ca-text-3)" }}>{charts.length} exhibits</span>
                </div>

                {/* narrative */}
                <div className="rounded-xl p-4 pl-5 mb-4" style={{ background: "var(--ca-surface-2)", borderLeft: "3px solid var(--ca-accent)", border: "1px solid var(--ca-border)", borderLeftWidth: "3px" }}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Sparkles size={12} style={{ color: "var(--ca-accent)" }} />
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ca-text-3)" }}>Analysis</p>
                    <span className="text-[8.5px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--ca-surface)", color: "var(--ca-text-3)" }}>AI</span>
                  </div>
                  {bullets ? (
                    <ul className="space-y-2">
                      {bullets.map((b, i) => (
                        <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed" style={{ color: "var(--ca-text)" }}>
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--ca-accent)" }} />{b}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => <div key={i} className="h-3.5 rounded inst-skeleton" style={{ width: `${90 - i * 12}%` }} />)}
                    </div>
                  )}
                </div>

                {/* section-specific exhibits */}
                {s.id === "summary-markets" && <MarketsPanel />}
                {s.id === "monetary-policy" && <FedSEPTable />}
                {s.id === "monetary-policy" && <YieldCurveChart />}

                {/* chart grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 macro-print-grid">
                  {charts.map((c) => <MacroChart key={c.id} chart={c} onExpand={() => setExpanded(c)} />)}
                </div>
              </section>
            );
          })}

          <div className="pt-6 mt-4" style={{ borderTop: "1px solid var(--ca-border)" }}>
            <div className="flex items-center gap-4 mb-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ca-text-3)" }}><span className="px-1 rounded font-semibold" style={{ background: "#f0fdf4", color: "#147a4f" }}>live</span> FRED &amp; market data, fetched on generation</span>
              <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ca-text-3)" }}><span className="px-1 rounded font-semibold" style={{ background: "#fffbeb", color: "#b7791f" }}>seeded</span> ISM, NFIB, Conf. Board, NAHB, MOVE, Baltic Dry — no free API; refreshed monthly from releases</span>
            </div>
            <p className="text-[10.5px]" style={{ color: "var(--ca-text-3)" }}>
              <FileText size={11} className="inline mr-1" />
              {report ? `Generated ${asDate}. ` : ""}Real regional-Fed surveys (Empire State, Philadelphia) provide live manufacturing proxies. Shortcuts: <kbd>/</kbd> ask · <kbd>P</kbd> present. Data via St. Louis Fed (FRED). Research only, not investment advice.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-[13px]" style={{ color: "var(--ca-text-3)" }}>Could not generate the report. Check FRED_API_KEY.</p>
      )}

      {presenting && report && (
        <PresentationMode report={report} narratives={narratives} summary={summary} date={asDate} onClose={() => setPresenting(false)} />
      )}
      {expanded && <ChartDetailModal chart={expanded} onClose={() => setExpanded(null)} />}
    </AppShell>
  );
}
