"use client";

import { useState } from "react";
import { Sparkles, Loader2, ArrowUp } from "lucide-react";

const SUGGESTIONS = [
  "Is the economy heading into recession?",
  "What's the read on inflation right now?",
  "Where are Treasury yields signaling?",
];

export default function MacroAsk() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function ask(question: string) {
    if (!question.trim()) return;
    setLoading(true); setAnswer(null); setQ(question);
    fetch("/api/macro-report/chat", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }),
    }).then((r) => r.json()).then((d) => setAnswer(d.answer ?? "No answer.")).finally(() => setLoading(false));
  }

  return (
    <div className="rounded-xl p-4 mb-6 macro-no-print" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} style={{ color: "var(--ca-accent)" }} />
        <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--ca-text-2)" }}>Ask the economy</p>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-3)" }}>grounded in live data</span>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="relative">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything about the current U.S. macro picture…"
          className="w-full pl-4 pr-11 py-2.5 rounded-lg text-[13px] focus:outline-none"
          style={{ background: "var(--ca-surface-2)", border: "1px solid var(--ca-border)", color: "var(--ca-text)" }} />
        <button type="submit" disabled={loading} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md" style={{ background: "var(--ca-accent)", color: "#fff" }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} />}
        </button>
      </form>
      {!answer && !loading && (
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => ask(s)} className="text-[11px] px-2.5 py-1 rounded-full inst-card-hover" style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-2)" }}>{s}</button>
          ))}
        </div>
      )}
      {loading && <div className="flex items-center gap-2 mt-3 text-[12.5px]" style={{ color: "var(--ca-text-3)" }}><Loader2 size={13} className="animate-spin" /> Reading the data…</div>}
      {answer && <p className="mt-3 text-[13.5px] leading-relaxed inst-fade-up" style={{ color: "var(--ca-text)" }}>{answer}</p>}
    </div>
  );
}
