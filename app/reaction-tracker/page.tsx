"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { DEMO_REACTIONS } from "@/lib/data/demoData";
import type { ReactionEntry } from "@/lib/types";
import { Plus, X } from "lucide-react";

function generateId() { return Math.random().toString(36).slice(2); }

const RESULT_STYLES = {
  Correct: "bg-emerald-950 text-emerald-400",
  Mixed: "bg-amber-950 text-amber-400",
  Wrong: "bg-red-950 text-red-400",
};

const SURPRISE_STYLES = {
  Beat: "text-emerald-400",
  Miss: "text-red-400",
  "In-Line": "text-zinc-400",
};

export default function ReactionTrackerPage() {
  const [entries, setEntries] = useState<ReactionEntry[]>(DEMO_REACTIONS);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    eventDate: "", eventName: "", surpriseDirection: "In-Line" as ReactionEntry["surpriseDirection"],
    expectedRatesReaction: "", actualRatesReaction: "",
    expectedEquityReaction: "", actualEquityReaction: "",
    result: "Mixed" as ReactionEntry["result"], lessonLearned: "",
  });

  useEffect(() => {
    const stored = localStorage.getItem("crossasset_reactions");
    if (stored) { try { setEntries(JSON.parse(stored)); } catch { /* demo */ } }
  }, []);

  function save(updated: ReactionEntry[]) {
    setEntries(updated);
    localStorage.setItem("crossasset_reactions", JSON.stringify(updated));
  }

  function addEntry() {
    if (!form.eventName.trim() || !form.eventDate) return;
    const entry: ReactionEntry = { id: generateId(), ...form };
    save([entry, ...entries]);
    setForm({
      eventDate: "", eventName: "", surpriseDirection: "In-Line",
      expectedRatesReaction: "", actualRatesReaction: "",
      expectedEquityReaction: "", actualEquityReaction: "",
      result: "Mixed", lessonLearned: "",
    });
    setAdding(false);
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Reaction Tracker</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Track prediction vs actual market reaction to macro events. Learn from every print.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs bg-[#E8C468] hover:bg-[#d4b05a] text-black font-semibold px-3 py-1.5 rounded transition-colors"
        >
          <Plus size={12} /> Add Entry
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {(["Correct", "Mixed", "Wrong"] as const).map((r) => {
          const count = entries.filter((e) => e.result === r).length;
          const pct = entries.length > 0 ? Math.round((count / entries.length) * 100) : 0;
          return (
            <div key={r} className={`bg-zinc-950 border border-zinc-800 rounded-md px-4 py-3`}>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{r}</p>
              <p className="text-2xl font-semibold text-white tabular-nums">{count}</p>
              <p className="text-[10px] text-zinc-600">{pct}% of {entries.length} events tracked</p>
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {adding && (
        <div className="mb-5 bg-zinc-950 border border-zinc-700 rounded-md p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-semibold text-white uppercase tracking-wider">Add Reaction Entry</p>
            <button onClick={() => setAdding(false)}><X size={14} className="text-zinc-500 hover:text-white" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Date</label>
              <input type="date" value={form.eventDate} onChange={set("eventDate")} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Event Name</label>
              <input value={form.eventName} onChange={set("eventName")} placeholder="e.g. CPI (March)" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Surprise</label>
              <select value={form.surpriseDirection} onChange={set("surpriseDirection")} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none">
                {["Beat", "Miss", "In-Line"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Expected Rates Reaction</label>
              <input value={form.expectedRatesReaction} onChange={set("expectedRatesReaction")} placeholder="e.g. Bear flattening, 10Y +5-8bps" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Actual Rates Reaction</label>
              <input value={form.actualRatesReaction} onChange={set("actualRatesReaction")} placeholder="e.g. 10Y +6bps to 4.72%" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Expected Equity Reaction</label>
              <input value={form.expectedEquityReaction} onChange={set("expectedEquityReaction")} placeholder="e.g. S&P -0.5 to -1%" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Actual Equity Reaction</label>
              <input value={form.actualEquityReaction} onChange={set("actualEquityReaction")} placeholder="e.g. S&P -0.9%; tech -1.4%" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Result</label>
              <select value={form.result} onChange={set("result")} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none">
                {["Correct", "Mixed", "Wrong"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Lesson Learned</label>
              <input value={form.lessonLearned} onChange={set("lessonLearned")} placeholder="Key takeaway..." className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addEntry} className="text-xs bg-[#E8C468] hover:bg-[#d4b05a] text-black font-semibold px-3 py-1.5 rounded">Add Entry</button>
            <button onClick={() => setAdding(false)} className="text-xs text-zinc-500 hover:text-white px-3">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-md overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="border-b border-zinc-800">
              {["Date", "Event", "Surprise", "Exp. Rates", "Actual Rates", "Exp. Equity", "Actual Equity", "Result", "Lesson"].map((h) => (
                <th key={h} className="text-left px-3 py-3 text-zinc-500 font-medium text-[10px] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-900 transition-colors align-top">
                <td className="px-3 py-3 text-zinc-400 whitespace-nowrap">{e.eventDate}</td>
                <td className="px-3 py-3 text-zinc-200 font-medium">{e.eventName}</td>
                <td className={`px-3 py-3 font-medium ${SURPRISE_STYLES[e.surpriseDirection]}`}>{e.surpriseDirection}</td>
                <td className="px-3 py-3 text-zinc-400">{e.expectedRatesReaction}</td>
                <td className="px-3 py-3 text-zinc-300">{e.actualRatesReaction}</td>
                <td className="px-3 py-3 text-zinc-400">{e.expectedEquityReaction}</td>
                <td className="px-3 py-3 text-zinc-300">{e.actualEquityReaction}</td>
                <td className="px-3 py-3">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${RESULT_STYLES[e.result]}`}>
                    {e.result}
                  </span>
                </td>
                <td className="px-3 py-3 text-zinc-500 text-[11px] italic leading-snug max-w-xs">{e.lessonLearned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
