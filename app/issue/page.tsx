"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import MacroCard from "@/components/cards/MacroCard";
import { DEMO_ISSUE } from "@/lib/data/demoData";
import type { MacroIssue } from "@/lib/types";
import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";

function ImpactBadge({ level }: { level: "High" | "Medium" | "Low" }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
        level === "High"
          ? "bg-red-950 text-red-400"
          : level === "Medium"
          ? "bg-amber-950 text-amber-400"
          : "bg-zinc-800 text-zinc-500"
      }`}
    >
      {level}
    </span>
  );
}

function PriorityDot({ priority }: { priority: "High" | "Medium" | "Low" }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        priority === "High" ? "bg-red-400" : priority === "Medium" ? "bg-amber-400" : "bg-zinc-500"
      }`}
    />
  );
}

export default function IssuePage() {
  const [issue, setIssue] = useState<MacroIssue>(DEMO_ISSUE);
  const [isDemo, setIsDemo] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("crossasset_current_issue");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as MacroIssue;
        setIssue(parsed);
        setIsDemo(parsed.dataQualityNote?.toLowerCase().includes("demo") ?? true);
      } catch {
        // keep demo
      }
    }
  }, []);

  return (
    <AppShell isDemo={isDemo}>
      {/* Issue header */}
      <div className="mb-6 border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase tracking-wider">
            {issue.regimeLabel}
          </span>
          <span className="text-[10px] text-zinc-600">{issue.date}</span>
        </div>
        <h1 className="text-xl font-semibold text-white leading-snug max-w-3xl">{issue.title}</h1>
        <p className="text-sm text-zinc-400 mt-2 max-w-3xl leading-relaxed">{issue.executiveSummary}</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Front Page — full width */}
        <div className="col-span-3">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">Front Page — Top Stories</p>
          <div className="grid grid-cols-3 gap-4">
            {issue.frontPage.map((story, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-md p-4">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Story {i + 1}</p>
                <h3 className="text-sm font-semibold text-white mb-2 leading-snug">{story.headline}</h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">What Happened</p>
                    <p className="text-xs text-zinc-300 leading-relaxed mt-0.5">{story.whatHappened}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Why It Matters</p>
                    <p className="text-xs text-zinc-300 leading-relaxed mt-0.5">{story.whyItMatters}</p>
                  </div>
                  <div className="bg-zinc-900 rounded p-2">
                    <p className="text-[10px] text-[#E8C468] uppercase tracking-wider mb-0.5">Market Implication</p>
                    <p className="text-xs text-zinc-200 leading-relaxed">{story.marketImplication}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {story.affectedAssets.map((a) => (
                      <span key={a} className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cross-Asset Map */}
        <MacroCard title="Cross-Asset Map" accent className="col-span-2">
          <div className="space-y-3">
            {Object.entries(issue.crossAssetMap).map(([key, val]) => (
              <div key={key} className="border-b border-zinc-800 last:border-0 pb-3 last:pb-0">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{key}</p>
                <p className="text-xs text-zinc-200 leading-relaxed">{val}</p>
              </div>
            ))}
          </div>
        </MacroCard>

        {/* Talking Points */}
        <MacroCard title="Desk Talking Points" accent className="col-span-1">
          <div className="space-y-3">
            {issue.talkingPoints.map((point, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[10px] text-[#E8C468] font-semibold flex-shrink-0 mt-0.5">{i + 1}.</span>
                <p className="text-xs text-zinc-300 leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </MacroCard>

        {/* Sector Translation */}
        <div className="col-span-3">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">Sector Translation</p>
          <div className="grid grid-cols-3 gap-3">
            {issue.sectorTranslation.map((s) => (
              <div key={s.sector} className="bg-zinc-950 border border-zinc-800 rounded-md p-3">
                <p className="text-xs font-semibold text-white mb-1">{s.sector}</p>
                <p className="text-xs text-zinc-400 leading-relaxed mb-2">{s.implication}</p>
                {s.tickers && s.tickers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {s.tickers.map((t) => (
                      <span key={t} className="font-mono text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Watchlist Impact */}
        <div className="col-span-3">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">Watchlist Impact</p>
          <div className="bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Ticker</th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Company</th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Impact</th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[10px] uppercase tracking-wider w-1/3">Analysis</th>
                  <th className="text-left px-4 py-2.5 text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Suggested Action</th>
                </tr>
              </thead>
              <tbody>
                {issue.watchlistImpact.map((w) => (
                  <tr key={w.ticker} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-white">{w.ticker}</td>
                    <td className="px-4 py-3 text-zinc-300">{w.companyName}</td>
                    <td className="px-4 py-3">
                      <ImpactBadge level={w.impactLevel} />
                    </td>
                    <td className="px-4 py-3 text-zinc-400 leading-relaxed">{w.explanation}</td>
                    <td className="px-4 py-3 text-zinc-300 italic text-[11px]">{w.suggestedAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Items */}
        <MacroCard title="Generated Action Items" accent className="col-span-2">
          <div className="space-y-2">
            {issue.actionItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 bg-zinc-900 rounded p-2.5">
                <PriorityDot priority={item.priority} />
                <div className="flex-1">
                  <p className="text-xs text-zinc-200 font-medium">{item.title}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] text-zinc-600">{item.category.replace("_", " ")}</span>
                    {item.relatedTicker && (
                      <span className="text-[10px] font-mono text-zinc-500">{item.relatedTicker}</span>
                    )}
                    {item.dueDate && (
                      <span className="text-[10px] text-zinc-600">Due {item.dueDate}</span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    item.priority === "High"
                      ? "bg-red-950 text-red-400"
                      : item.priority === "Medium"
                      ? "bg-amber-950 text-amber-400"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {item.priority}
                </span>
              </div>
            ))}
          </div>
        </MacroCard>

        {/* Sources & Quality */}
        <div className="col-span-1 space-y-4">
          <MacroCard title="Sources Used">
            <div className="space-y-1.5">
              {issue.sourcesUsed.map((s, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <ExternalLink size={10} className="text-zinc-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-400">{s}</p>
                </div>
              ))}
            </div>
          </MacroCard>

          <MacroCard title="Data Quality Note">
            <div className="flex items-start gap-2">
              {issue.dataQualityNote.toLowerCase().includes("demo") ? (
                <AlertCircle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-xs text-zinc-400 leading-relaxed">{issue.dataQualityNote}</p>
            </div>
          </MacroCard>
        </div>
      </div>
    </AppShell>
  );
}
