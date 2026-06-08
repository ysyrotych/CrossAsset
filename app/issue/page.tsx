"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { DEMO_ISSUE } from "@/lib/data/demoData";
import type { MacroIssue } from "@/lib/types";

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#0f2044] mb-4">{children}</p>;
}

function Divider() {
  return <div className="border-t border-[#ebebeb] my-10" />;
}

export default function IssuePage() {
  const [issue, setIssue] = useState<MacroIssue>(DEMO_ISSUE);

  useEffect(() => {
    const stored = localStorage.getItem("crossasset_current_issue");
    if (stored) { try { setIssue(JSON.parse(stored)); } catch {} }
  }, []);

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-10 pb-8 border-b border-[#ebebeb]">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#0f2044]">Daily Issue</p>
          <span className="text-[#d1d5db]">·</span>
          <span className="text-[10px] text-[#9ca3af]">{issue.date}</span>
          <span className="text-[10px] px-2 py-0.5 border border-[#e0e7ff] text-[#0f2044] rounded-full">
            {issue.regimeLabel}
          </span>
        </div>
        <h1 className="text-[30px] font-light text-[#0a0a0a] tracking-tight leading-snug max-w-3xl" style={{ fontFamily: "var(--font-serif)" }}>
          {issue.title}
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-3 leading-relaxed max-w-3xl">{issue.executiveSummary}</p>
      </div>

      {/* Front Page */}
      <Label>Front Page — Top Stories</Label>
      <div className="grid grid-cols-3 gap-6 mb-2">
        {issue.frontPage.map((story, i) => (
          <div key={i} className="border border-[#ebebeb] rounded-md p-5 space-y-4">
            <p className="text-[10px] text-[#9ca3af] uppercase tracking-widest">Story {i + 1}</p>
            <p className="text-[13px] font-semibold text-[#0a0a0a] leading-snug">{story.headline}</p>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af] mb-1">What Happened</p>
              <p className="text-[12px] text-[#4b5563] leading-relaxed">{story.whatHappened}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-[#9ca3af] mb-1">Why It Matters</p>
              <p className="text-[12px] text-[#4b5563] leading-relaxed">{story.whyItMatters}</p>
            </div>
            <div className="bg-[#f8f9ff] border border-[#e0e7ff] rounded p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#0f2044] mb-1">Market Implication</p>
              <p className="text-[12px] text-[#1e3a6e] leading-relaxed">{story.marketImplication}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {story.affectedAssets.map((a) => (
                <span key={a} className="text-[10px] px-2 py-0.5 border border-[#e5e7eb] text-[#6b7280] rounded-full">{a}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Divider />

      {/* Cross-Asset Map */}
      <Label>Cross-Asset Map</Label>
      <div className="border border-[#ebebeb] rounded-md divide-y divide-[#f5f5f5] mb-2">
        {Object.entries(issue.crossAssetMap).map(([key, val]) => (
          <div key={key} className="flex gap-8 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0f2044] w-28 shrink-0 mt-0.5">{key}</p>
            <p className="text-[12.5px] text-[#4b5563] leading-relaxed">{val}</p>
          </div>
        ))}
      </div>

      <Divider />

      {/* Sector Translation */}
      <Label>Sector Translation</Label>
      <div className="grid grid-cols-3 gap-4 mb-2">
        {issue.sectorTranslation.map((s) => (
          <div key={s.sector} className="border border-[#ebebeb] rounded-md p-4">
            <p className="text-[12px] font-semibold text-[#0a0a0a] mb-2">{s.sector}</p>
            <p className="text-[12px] text-[#6b7280] leading-relaxed mb-3">{s.implication}</p>
            {s.tickers && s.tickers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {s.tickers.map((t) => (
                  <span key={t} className="font-mono text-[10px] px-2 py-0.5 bg-[#f5f5f5] text-[#374151] rounded">{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Divider />

      {/* Watchlist Impact */}
      <Label>Watchlist Impact</Label>
      <div className="border border-[#ebebeb] rounded-md overflow-hidden mb-2">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#ebebeb] bg-[#fafafa]">
              {["Ticker", "Company", "Impact", "Analysis", "Suggested Action"].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {issue.watchlistImpact.map((w) => (
              <tr key={w.ticker} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors">
                <td className="px-5 py-3.5 font-mono font-semibold text-[#0a0a0a]">{w.ticker}</td>
                <td className="px-5 py-3.5 text-[#374151]">{w.companyName}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    w.impactLevel === "High" ? "bg-red-50 text-red-600 border border-red-100"
                    : w.impactLevel === "Medium" ? "bg-amber-50 text-amber-600 border border-amber-100"
                    : "bg-[#f5f5f5] text-[#9ca3af] border border-[#e5e5e5]"
                  }`}>{w.impactLevel}</span>
                </td>
                <td className="px-5 py-3.5 text-[#6b7280] leading-relaxed max-w-sm">{w.explanation}</td>
                <td className="px-5 py-3.5 text-[#6b7280] italic">{w.suggestedAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Divider />

      {/* Talking Points + Action Items */}
      <div className="grid grid-cols-2 gap-10">
        <div>
          <Label>Desk Talking Points</Label>
          <div className="space-y-4">
            {issue.talkingPoints.map((pt, i) => (
              <div key={i} className="flex gap-4">
                <span className="text-[11px] text-[#0f2044] font-semibold mt-0.5 w-4 shrink-0">{i + 1}.</span>
                <p className="text-[12.5px] text-[#4b5563] leading-relaxed">{pt}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label>Action Items</Label>
          <div className="space-y-2">
            {issue.actionItems.map((item, i) => (
              <div key={i} className="flex gap-3 p-3 border border-[#ebebeb] rounded-md">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                  item.priority === "High" ? "bg-red-400" : item.priority === "Medium" ? "bg-amber-400" : "bg-[#d1d5db]"
                }`} />
                <div>
                  <p className="text-[12px] text-[#0a0a0a] font-medium">{item.title}</p>
                  <p className="text-[11px] text-[#9ca3af] mt-0.5">{item.category.replace("_", " ")} {item.dueDate && `· Due ${item.dueDate}`}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Divider />

      {/* Data note */}
      <p className="text-[11px] text-[#9ca3af] leading-relaxed">{issue.dataQualityNote}</p>
    </AppShell>
  );
}
