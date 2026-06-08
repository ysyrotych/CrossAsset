"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { DEMO_WATCHLIST } from "@/lib/data/demoData";
import type { WatchlistItem, MacroSensitivityTag } from "@/lib/types";
import { Plus, Trash2, X } from "lucide-react";

const ALL_TAGS: MacroSensitivityTag[] = [
  "Rates", "Inflation", "Consumer Demand", "FX", "Oil", "Credit", "Labor",
];

const TAG_COLORS: Record<MacroSensitivityTag, string> = {
  Rates: "bg-blue-950 text-blue-400",
  Inflation: "bg-red-950 text-red-400",
  "Consumer Demand": "bg-purple-950 text-purple-400",
  FX: "bg-cyan-950 text-cyan-400",
  Oil: "bg-orange-950 text-orange-400",
  Credit: "bg-pink-950 text-pink-400",
  Labor: "bg-yellow-950 text-yellow-400",
};

function generateId() {
  return Math.random().toString(36).slice(2);
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>(DEMO_WATCHLIST);
  const [adding, setAdding] = useState(false);
  const [newTicker, setNewTicker] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newSector, setNewSector] = useState("");
  const [newTags, setNewTags] = useState<MacroSensitivityTag[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("crossasset_watchlist");
    if (stored) {
      try { setItems(JSON.parse(stored)); } catch { /* keep demo */ }
    }
  }, []);

  function save(updated: WatchlistItem[]) {
    setItems(updated);
    localStorage.setItem("crossasset_watchlist", JSON.stringify(updated));
  }

  function removeItem(id: string) {
    save(items.filter((i) => i.id !== id));
  }

  function addItem() {
    if (!newTicker.trim()) return;
    const item: WatchlistItem = {
      id: generateId(),
      ticker: newTicker.trim().toUpperCase(),
      companyName: newCompany.trim() || newTicker.trim().toUpperCase(),
      sector: newSector.trim() || "Unclassified",
      macroTags: newTags,
    };
    save([...items, item]);
    setNewTicker(""); setNewCompany(""); setNewSector(""); setNewTags([]);
    setAdding(false);
  }

  function toggleTag(tag: MacroSensitivityTag) {
    setNewTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Watchlist</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Track companies and their macro sensitivity exposure.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs bg-[#E8C468] hover:bg-[#d4b05a] text-black font-semibold px-3 py-1.5 rounded transition-colors"
        >
          <Plus size={12} /> Add Ticker
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="mb-5 bg-zinc-950 border border-zinc-700 rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-white uppercase tracking-wider">Add Ticker</p>
            <button onClick={() => setAdding(false)}><X size={14} className="text-zinc-500 hover:text-white" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Ticker *</label>
              <input
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                placeholder="e.g. MSFT"
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Company Name</label>
              <input
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="e.g. Microsoft Corp"
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Sector</label>
              <input
                value={newSector}
                onChange={(e) => setNewSector(e.target.value)}
                placeholder="e.g. Technology"
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-2">Macro Sensitivity Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                    newTags.includes(tag) ? TAG_COLORS[tag] : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={addItem}
              className="text-xs bg-[#E8C468] hover:bg-[#d4b05a] text-black font-semibold px-3 py-1.5 rounded transition-colors"
            >
              Add to Watchlist
            </button>
            <button onClick={() => setAdding(false)} className="text-xs text-zinc-500 hover:text-white px-3 py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Watchlist table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Ticker</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Company</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Sector</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Macro Sensitivity</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Today's AI Impact</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium text-[10px] uppercase tracking-wider">Suggested Task</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold text-white">{item.ticker}</td>
                <td className="px-4 py-3 text-zinc-300">{item.companyName}</td>
                <td className="px-4 py-3 text-zinc-500">{item.sector}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {item.macroTags.map((tag) => (
                      <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded ${TAG_COLORS[tag]}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-400 text-[11px] leading-snug max-w-xs">
                  {item.todayImpact ?? <span className="text-zinc-700 italic">Generate a brief to populate</span>}
                </td>
                <td className="px-4 py-3 text-zinc-400 italic text-[11px] max-w-xs">
                  {item.suggestedTask ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-zinc-700 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="text-center py-12 text-zinc-600 text-sm">
            No tickers in your watchlist. Add one above.
          </div>
        )}
      </div>
    </AppShell>
  );
}
