"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { DEMO_ARCHIVE } from "@/lib/data/demoData";
import type { ArchiveEntry } from "@/lib/types";
import Link from "next/link";
import { ArrowRight, Archive } from "lucide-react";

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

  const REGIME_COLORS: Record<string, string> = {
    "Fed Repricing / Sticky Inflation": "bg-amber-950 text-amber-400",
    "Growth Scare / Rate Relief": "bg-blue-950 text-blue-400",
    "Stagflation Risk": "bg-red-950 text-red-400",
    "Risk-On": "bg-emerald-950 text-emerald-400",
    "Commodity Shock": "bg-orange-950 text-orange-400",
  };

  function regimeColor(label: string): string {
    return REGIME_COLORS[label] ?? "bg-zinc-800 text-zinc-400";
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Archive</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Past macro desk briefs. Click to reload any issue.</p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
          <Archive size={32} className="mb-3" />
          <p className="text-sm">No archived issues yet.</p>
          <p className="text-xs mt-1">Generate your first brief from the dashboard.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-zinc-950 border border-zinc-800 rounded-md p-5 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-zinc-600">{entry.date}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${regimeColor(entry.regimeLabel)}`}>
                      {entry.regimeLabel}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1 leading-snug">{entry.title}</h3>
                  <p className="text-xs text-zinc-500 mb-1">
                    <span className="text-zinc-600">Lead event:</span>{" "}
                    {entry.topMacroEvent}
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed">{entry.summary}</p>
                </div>
                <div>
                  {entry.issue ? (
                    <button
                      onClick={() => openIssue(entry)}
                      className="flex items-center gap-1.5 text-xs border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 px-3 py-1.5 rounded transition-colors"
                    >
                      Open Issue <ArrowRight size={11} />
                    </button>
                  ) : (
                    <span className="text-[10px] text-zinc-700 italic">Summary only</span>
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
