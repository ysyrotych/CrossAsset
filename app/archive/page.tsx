"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { DEMO_ARCHIVE } from "@/lib/data/demoData";
import type { ArchiveEntry } from "@/lib/types";
import { ArrowRight, Archive } from "lucide-react";

const REGIME_COLORS: Record<string, string> = {
  "Fed Repricing / Sticky Inflation": "bg-amber-50 text-amber-700 border border-amber-200",
  "Growth Scare / Rate Relief":       "bg-blue-50 text-blue-700 border border-blue-200",
  "Stagflation Risk":                 "bg-red-50 text-red-700 border border-red-200",
  "Risk-On":                          "bg-[#f0faf4] text-[#147a4f] border border-[#c3e6cd]",
  "Commodity Shock":                  "bg-orange-50 text-orange-700 border border-orange-200",
};

function regimeColor(label: string): string {
  return REGIME_COLORS[label] ?? "bg-[#f5f5f5] text-[#555] border border-[#e8e8e8]";
}

export default function ArchivePage() {
  const [entries, setEntries] = useState<ArchiveEntry[]>(DEMO_ARCHIVE);

  useEffect(() => {
    const stored = localStorage.getItem("crossasset_archive");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ArchiveEntry[];
        if (parsed.length > 0) setEntries(parsed);
      } catch { /* keep demo */ }
    }
  }, []);

  function openIssue(entry: ArchiveEntry) {
    if (entry.issue) {
      localStorage.setItem("crossasset_current_issue", JSON.stringify(entry.issue));
      window.location.href = "/issue";
    }
  }

  return (
    <AppShell>
      <div className="mb-10 pb-8 border-b border-[#ebebeb] flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#0c1b38] mb-3">Archive</p>
          <h1 className="text-[34px] font-light text-[#0a0a0a] tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>Past Issues</h1>
          <p className="text-[13px] text-[#9ca3af] mt-1">Every generated macro brief, saved automatically.</p>
        </div>
        <p className="text-[11px] text-[#bbb]">{entries.length} issue{entries.length !== 1 ? "s" : ""}</p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#ccc]">
          <Archive size={28} className="mb-3" />
          <p className="text-[13px]">No archived issues yet.</p>
          <p className="text-[11px] mt-1 text-[#ddd]">Generate your first brief from the dashboard.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="border border-[#ebebeb] rounded-md p-5 hover:border-[#d0d0d0] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-[#bbb] tabular-nums">{entry.date}</span>
                    <span className={`text-[9.5px] px-2 py-0.5 rounded font-semibold tracking-wide ${regimeColor(entry.regimeLabel)}`}>
                      {entry.regimeLabel}
                    </span>
                  </div>
                  <h3 className="text-[14px] font-semibold text-[#0a0a0a] mb-1 leading-snug">{entry.title}</h3>
                  <p className="text-[12px] text-[#777] mb-1.5">
                    <span className="text-[#bbb]">Lead event:</span>{" "}
                    {entry.topMacroEvent}
                  </p>
                  <p className="text-[12px] text-[#555] leading-relaxed">{entry.summary}</p>
                </div>
                <div className="shrink-0">
                  {entry.issue ? (
                    <button
                      onClick={() => openIssue(entry)}
                      className="flex items-center gap-1.5 text-[11.5px] font-medium border border-[#e0e0e0] text-[#333] hover:text-[#0c1b38] hover:border-[#0c1b38] px-3 py-1.5 rounded-md transition-colors"
                    >
                      Open <ArrowRight size={11} />
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#ccc] italic">Summary only</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
