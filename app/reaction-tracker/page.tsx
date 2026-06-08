"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { DEMO_REACTIONS } from "@/lib/data/demoData";
import type { ReactionEntry } from "@/lib/types";
import { Plus, X } from "lucide-react";

function generateId() { return Math.random().toString(36).slice(2); }

const RESULT_STYLES = {
  Correct: "bg-green-50 text-green-700 border-green-100",
  Mixed: "bg-amber-50 text-amber-700 border-amber-100",
  Wrong: "bg-red-50 text-red-700 border-red-100",
};
const SURPRISE_STYLES = { Beat: "text-green-600", Miss: "text-red-500", "In-Line": "text-[#6b7280]" };

export default function ReactionTrackerPage() {
  const [entries, setEntries] = useState<ReactionEntry[]>(DEMO_REACTIONS);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ eventDate:"", eventName:"", surpriseDirection:"In-Line" as ReactionEntry["surpriseDirection"], expectedRatesReaction:"", actualRatesReaction:"", expectedEquityReaction:"", actualEquityReaction:"", result:"Mixed" as ReactionEntry["result"], lessonLearned:"" });

  useEffect(() => {
    const s = localStorage.getItem("crossasset_reactions");
    if (s) try { setEntries(JSON.parse(s)); } catch {}
  }, []);

  function save(u: ReactionEntry[]) { setEntries(u); localStorage.setItem("crossasset_reactions", JSON.stringify(u)); }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(p => ({...p,[k]:e.target.value}));
  function addEntry() {
    if (!form.eventName || !form.eventDate) return;
    save([{ id: generateId(), ...form }, ...entries]);
    setForm({ eventDate:"", eventName:"", surpriseDirection:"In-Line", expectedRatesReaction:"", actualRatesReaction:"", expectedEquityReaction:"", actualEquityReaction:"", result:"Mixed", lessonLearned:"" });
    setAdding(false);
  }

  const counts = { Correct: entries.filter(e=>e.result==="Correct").length, Mixed: entries.filter(e=>e.result==="Mixed").length, Wrong: entries.filter(e=>e.result==="Wrong").length };

  const inputCls = "w-full border border-[#d1d5db] rounded-md px-3 py-2 text-[12.5px] text-[#0a0a0a] placeholder-[#d1d5db] focus:outline-none focus:border-[#0f2044] transition-colors";
  const selectCls = "w-full border border-[#d1d5db] rounded-md px-3 py-2 text-[12.5px] text-[#0a0a0a] focus:outline-none focus:border-[#0f2044] bg-white transition-colors";

  return (
    <AppShell>
      <div className="mb-10 pb-8 border-b border-[#ebebeb] flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#0f2044] mb-3">Reaction Tracker</p>
          <h1 className="text-[34px] font-light text-[#0a0a0a] tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>Market Reactions</h1>
          <p className="text-[13px] text-[#9ca3af] mt-1">Prediction vs. actual for every macro event.</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 text-[12px] font-medium text-white bg-[#0f2044] hover:bg-[#1a3361] px-4 py-2 rounded-md transition-colors">
          <Plus size={13} /> Add Entry
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {(["Correct","Mixed","Wrong"] as const).map(r => (
          <div key={r} className="border border-[#ebebeb] rounded-md px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af] mb-2">{r}</p>
            <p className="text-3xl font-light text-[#0a0a0a] tabular-nums">{counts[r]}</p>
            <p className="text-[11px] text-[#d1d5db] mt-1">{entries.length > 0 ? Math.round(counts[r]/entries.length*100) : 0}% of {entries.length} tracked</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="mb-8 border border-[#e0e7ff] rounded-md p-6 bg-[#f8f9ff]">
          <div className="flex justify-between items-center mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#0f2044]">Add Entry</p>
            <button onClick={() => setAdding(false)}><X size={14} className="text-[#9ca3af]" /></button>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] block mb-1.5">Date</label><input type="date" value={form.eventDate} onChange={set("eventDate")} className={inputCls} /></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] block mb-1.5">Event</label><input value={form.eventName} onChange={set("eventName")} placeholder="e.g. CPI (May)" className={inputCls} /></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] block mb-1.5">Surprise</label><select value={form.surpriseDirection} onChange={set("surpriseDirection")} className={selectCls}>{["Beat","Miss","In-Line"].map(s=><option key={s}>{s}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] block mb-1.5">Expected Rates Reaction</label><input value={form.expectedRatesReaction} onChange={set("expectedRatesReaction")} placeholder="e.g. Bear flattening, 10Y +5-8bps" className={inputCls} /></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] block mb-1.5">Actual Rates Reaction</label><input value={form.actualRatesReaction} onChange={set("actualRatesReaction")} placeholder="e.g. 10Y +6bps to 4.72%" className={inputCls} /></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] block mb-1.5">Expected Equity Reaction</label><input value={form.expectedEquityReaction} onChange={set("expectedEquityReaction")} placeholder="e.g. S&P -0.5 to -1%" className={inputCls} /></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] block mb-1.5">Actual Equity Reaction</label><input value={form.actualEquityReaction} onChange={set("actualEquityReaction")} placeholder="e.g. S&P -0.9%; NDX -1.4%" className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] block mb-1.5">Result</label><select value={form.result} onChange={set("result")} className={selectCls}>{["Correct","Mixed","Wrong"].map(r=><option key={r}>{r}</option>)}</select></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] block mb-1.5">Lesson Learned</label><input value={form.lessonLearned} onChange={set("lessonLearned")} placeholder="Key takeaway..." className={inputCls} /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={addEntry} className="text-[12px] font-medium text-white bg-[#0f2044] hover:bg-[#1a3361] px-4 py-2 rounded-md transition-colors">Add Entry</button>
            <button onClick={() => setAdding(false)} className="text-[12px] text-[#9ca3af] hover:text-[#374151] px-4">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-[#ebebeb] rounded-md overflow-x-auto">
        <table className="w-full text-[12px] min-w-[900px]">
          <thead>
            <tr className="border-b border-[#ebebeb] bg-[#fafafa]">
              {["Date","Event","Surprise","Exp. Rates","Act. Rates","Exp. Equity","Act. Equity","Result","Lesson"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] transition-colors align-top">
                <td className="px-4 py-3.5 text-[#6b7280] whitespace-nowrap">{e.eventDate}</td>
                <td className="px-4 py-3.5 font-medium text-[#0a0a0a]">{e.eventName}</td>
                <td className={`px-4 py-3.5 font-medium ${SURPRISE_STYLES[e.surpriseDirection]}`}>{e.surpriseDirection}</td>
                <td className="px-4 py-3.5 text-[#6b7280]">{e.expectedRatesReaction}</td>
                <td className="px-4 py-3.5 text-[#374151]">{e.actualRatesReaction}</td>
                <td className="px-4 py-3.5 text-[#6b7280]">{e.expectedEquityReaction}</td>
                <td className="px-4 py-3.5 text-[#374151]">{e.actualEquityReaction}</td>
                <td className="px-4 py-3.5"><span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${RESULT_STYLES[e.result]}`}>{e.result}</span></td>
                <td className="px-4 py-3.5 text-[#6b7280] italic leading-snug">{e.lessonLearned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
