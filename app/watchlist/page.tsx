"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { DEMO_WATCHLIST } from "@/lib/data/demoData";
import type { WatchlistItem, MacroSensitivityTag } from "@/lib/types";
import { Plus, Trash2, X } from "lucide-react";

const ALL_TAGS: MacroSensitivityTag[] = ["Rates","Inflation","Consumer Demand","FX","Oil","Credit","Labor"];

const TAG_COLORS: Record<MacroSensitivityTag, string> = {
  Rates: "border-blue-200 text-blue-700 bg-blue-50",
  Inflation: "border-red-200 text-red-700 bg-red-50",
  "Consumer Demand": "border-purple-200 text-purple-700 bg-purple-50",
  FX: "border-cyan-200 text-cyan-700 bg-cyan-50",
  Oil: "border-orange-200 text-orange-700 bg-orange-50",
  Credit: "border-pink-200 text-pink-700 bg-pink-50",
  Labor: "border-yellow-200 text-yellow-700 bg-yellow-50",
};

function generateId() { return Math.random().toString(36).slice(2); }

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>(DEMO_WATCHLIST);
  const [adding, setAdding] = useState(false);
  const [ticker, setTicker] = useState("");
  const [company, setCompany] = useState("");
  const [sector, setSector] = useState("");
  const [tags, setTags] = useState<MacroSensitivityTag[]>([]);

  useEffect(() => {
    const s = localStorage.getItem("crossasset_watchlist");
    if (s) try { setItems(JSON.parse(s)); } catch {}
  }, []);

  function save(u: WatchlistItem[]) { setItems(u); localStorage.setItem("crossasset_watchlist", JSON.stringify(u)); }
  function remove(id: string) { save(items.filter(i => i.id !== id)); }
  function toggleTag(t: MacroSensitivityTag) { setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]); }
  function add() {
    if (!ticker.trim()) return;
    save([...items, { id: generateId(), ticker: ticker.trim().toUpperCase(), companyName: company.trim() || ticker.toUpperCase(), sector: sector.trim() || "—", macroTags: tags }]);
    setTicker(""); setCompany(""); setSector(""); setTags([]); setAdding(false);
  }

  return (
    <AppShell>
      <div className="mb-10 pb-8 border-b border-[#ebebeb] flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#0f2044] mb-3">Watchlist</p>
          <h1 className="text-[34px] font-light text-[#0a0a0a] tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>Coverage</h1>
          <p className="text-[13px] text-[#9ca3af] mt-1">Tracked equities and macro sensitivity.</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 text-[12px] font-medium text-white bg-[#0f2044] hover:bg-[#1a3361] px-4 py-2 rounded-md transition-colors">
          <Plus size={13} /> Add Ticker
        </button>
      </div>

      {adding && (
        <div className="mb-8 border border-[#e0e7ff] rounded-md p-6 bg-[#f8f9ff]">
          <div className="flex justify-between items-center mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#0f2044]">Add Ticker</p>
            <button onClick={() => setAdding(false)}><X size={14} className="text-[#9ca3af] hover:text-[#374151]" /></button>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[["Ticker *", ticker, setTicker, "e.g. MSFT"], ["Company Name", company, setCompany, "e.g. Microsoft Corp"], ["Sector", sector, setSector, "e.g. Technology"]].map(([label, val, setter, ph]: any) => (
              <div key={label}>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] block mb-1.5">{label}</label>
                <input value={val} onChange={e => setter(e.target.value)} placeholder={ph}
                  className="w-full border border-[#d1d5db] rounded-md px-3 py-2 text-[12.5px] text-[#0a0a0a] placeholder-[#d1d5db] focus:outline-none focus:border-[#0f2044] transition-colors" />
              </div>
            ))}
          </div>
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] mb-2">Macro Sensitivity</p>
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map(t => (
                <button key={t} onClick={() => toggleTag(t)} className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${tags.includes(t) ? TAG_COLORS[t] : "border-[#e5e7eb] text-[#9ca3af] hover:border-[#d1d5db]"}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={add} className="text-[12px] font-medium text-white bg-[#0f2044] hover:bg-[#1a3361] px-4 py-2 rounded-md transition-colors">Add to Watchlist</button>
            <button onClick={() => setAdding(false)} className="text-[12px] text-[#9ca3af] hover:text-[#374151] px-4 py-2">Cancel</button>
          </div>
        </div>
      )}

      <div className="border border-[#ebebeb] rounded-md overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#ebebeb] bg-[#fafafa]">
              {["Ticker","Company","Sector","Macro Sensitivity","Today's Impact","Suggested Task",""].map(h => (
                <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors align-top">
                <td className="px-5 py-4 font-mono font-semibold text-[#0a0a0a]">{item.ticker}</td>
                <td className="px-5 py-4 text-[#374151]">{item.companyName}</td>
                <td className="px-5 py-4 text-[#6b7280]">{item.sector}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-1">
                    {item.macroTags.map(t => <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full border ${TAG_COLORS[t]}`}>{t}</span>)}
                  </div>
                </td>
                <td className="px-5 py-4 text-[#6b7280] leading-snug max-w-[200px]">
                  {item.todayImpact ?? <span className="text-[#d1d5db] italic">Generate brief to populate</span>}
                </td>
                <td className="px-5 py-4 text-[#6b7280] italic leading-snug max-w-[180px]">{item.suggestedTask ?? "—"}</td>
                <td className="px-5 py-4">
                  <button onClick={() => remove(item.id)} className="text-[#d1d5db] hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
