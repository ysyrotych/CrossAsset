"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";

interface TopbarProps {
  isDemo?: boolean;
  date?: string;
}

export default function Topbar({ isDemo = true, date }: TopbarProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const today = date ?? new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/generate-issue", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("crossasset_current_issue", JSON.stringify(data.issue));
        // Save to archive
        const existing = JSON.parse(localStorage.getItem("crossasset_archive") ?? "[]");
        const entry = {
          id: data.issue.id,
          date: data.issue.date,
          title: data.issue.title,
          regimeLabel: data.issue.regimeLabel,
          topMacroEvent: data.issue.frontPage?.[0]?.headline ?? "",
          summary: data.issue.executiveSummary?.slice(0, 200) ?? "",
          issue: data.issue,
        };
        localStorage.setItem("crossasset_archive", JSON.stringify([entry, ...existing].slice(0, 30)));
        router.push("/issue");
      } else {
        alert("Generation failed. Check that ANTHROPIC_API_KEY is set in .env.local");
      }
    } catch {
      alert("Network error. Is the dev server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <header className="fixed top-0 left-56 right-0 h-12 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-6 z-30">
      <div className="flex items-center gap-4">
        <span className="text-xs text-zinc-400">{today}</span>
        <span className="text-xs text-zinc-600">·</span>
        <span className="text-xs text-zinc-400 uppercase tracking-wider">Pre-Market Brief</span>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-medium ${
            isDemo
              ? "bg-amber-950 text-amber-400 border border-amber-900"
              : "bg-emerald-950 text-emerald-400 border border-emerald-900"
          }`}
        >
          {isDemo ? "Demo Data" : "Live Data"}
        </span>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs bg-[#E8C468] hover:bg-[#d4b05a] text-black font-semibold px-3 py-1.5 rounded transition-colors disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <RefreshCw size={11} />
          )}
          Generate Brief
        </button>
      </div>
    </header>
  );
}
