"use client";

import { useEffect, useState, useMemo } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import MacroChart from "./MacroChart";
import { SECTIONS } from "@/lib/macro/manifest";
import type { ReportData, RenderedChart } from "@/lib/macro/types";

type Slide =
  | { kind: "cover" }
  | { kind: "summary" }
  | { kind: "section"; sectionId: string; title: string; charts: RenderedChart[]; bullets: string[]; part: number; parts: number };

export default function PresentationMode({
  report, narratives, summary, date, onClose,
}: {
  report: ReportData;
  narratives: Record<string, string[]>;
  summary: { headline: string; macro: string[]; markets: string[] } | null;
  date: string;
  onClose: () => void;
}) {
  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [{ kind: "cover" }, { kind: "summary" }];
    for (const s of SECTIONS.filter((x) => x.chartIds.length)) {
      const charts = s.chartIds.map((id) => report.charts[id]).filter(Boolean) as RenderedChart[];
      const per = 6;
      const parts = Math.max(1, Math.ceil(charts.length / per));
      for (let i = 0; i < parts; i++) {
        out.push({ kind: "section", sectionId: s.id, title: s.title, charts: charts.slice(i * per, i * per + per), bullets: narratives[s.id] ?? [], part: i + 1, parts });
      }
    }
    return out;
  }, [report, narratives]);

  const [i, setI] = useState(0);
  const clamp = (n: number) => Math.max(0, Math.min(slides.length - 1, n));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); setI((v) => clamp(v + 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setI((v) => clamp(v - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  const slide = slides[i];

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: "#0a1428" }}>
      {/* top bar */}
      <div className="flex items-center justify-between px-6 py-3">
        <span className="text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>CrossAsset · U.S. Macro Report</span>
        <div className="flex items-center gap-4">
          <span className="text-[12px] tabular-nums" style={{ color: "rgba(255,255,255,0.5)" }}>{i + 1} / {slides.length}</span>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>
      </div>

      {/* slide */}
      <div className="flex-1 flex items-center justify-center px-10 pb-16">
        <div className="w-full max-w-[1400px] aspect-[16/9] rounded-2xl overflow-hidden relative flex flex-col" style={{ background: "#fff" }}>
          {slide.kind === "cover" ? (
            <div className="flex-1 flex flex-col justify-center px-16 inst-aurora" style={{ color: "#fff" }}>
              <p className="text-[13px] font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>Weekly Economic Update</p>
              <h1 className="text-[52px] font-light leading-tight" style={{ fontFamily: "var(--font-serif)" }}>U.S. Macroeconomic &amp;<br />Financial Market Update</h1>
              <p className="text-[18px] mt-6" style={{ color: "rgba(255,255,255,0.8)" }}>{date}</p>
              <p className="text-[13px] mt-10" style={{ color: "rgba(255,255,255,0.5)" }}>CrossAsset · use ← → to navigate · Esc to exit</p>
            </div>
          ) : slide.kind === "summary" ? (
            <div className="flex-1 flex flex-col p-12 overflow-hidden">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: "var(--ca-accent)" }}>Executive Summary</p>
              <h2 className="text-[28px] font-light leading-snug mb-6" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>{summary?.headline ?? ""}</h2>
              <div className="grid grid-cols-2 gap-10 flex-1">
                {(["macro", "markets"] as const).map((k) => (
                  <div key={k}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: "var(--ca-text-3)" }}>{k}</p>
                    <ul className="space-y-2.5">{(summary?.[k] ?? []).map((b, idx) => (
                      <li key={idx} className="flex gap-2 text-[15px] leading-relaxed" style={{ color: "var(--ca-text)" }}><span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--ca-accent)" }} />{b}</li>
                    ))}</ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-8 overflow-hidden">
              <div className="flex items-baseline justify-between mb-3 pb-2" style={{ borderBottom: "2px solid var(--ca-accent)" }}>
                <h2 className="text-[24px] font-semibold" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>{slide.title}</h2>
                {slide.parts > 1 && <span className="text-[11px]" style={{ color: "var(--ca-text-3)" }}>{slide.part} / {slide.parts}</span>}
              </div>
              {slide.part === 1 && slide.bullets.length > 0 && (
                <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3">
                  {slide.bullets.slice(0, 3).map((b, idx) => (
                    <span key={idx} className="text-[11.5px]" style={{ color: "var(--ca-text-2)" }}>• {b}</span>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 flex-1 overflow-hidden">
                {slide.charts.map((c) => <MacroChart key={c.id} chart={c} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* nav arrows */}
      <button onClick={() => setI((v) => clamp(v - 1))} disabled={i === 0}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full disabled:opacity-20" style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}><ChevronLeft size={22} /></button>
      <button onClick={() => setI((v) => clamp(v + 1))} disabled={i === slides.length - 1}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full disabled:opacity-20" style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}><ChevronRight size={22} /></button>
    </div>
  );
}
