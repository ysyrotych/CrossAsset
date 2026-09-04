"use client";

import { useState } from "react";
import { FileText, ChevronDown, Copy, Check, Loader2 } from "lucide-react";

export default function WeeklyBrief() {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !brief && !loading) {
      setLoading(true);
      fetch("/api/macro-report/weekly-brief").then((r) => r.json())
        .then((d) => setBrief(d.brief ?? "Unable to generate brief."))
        .finally(() => setLoading(false));
    }
  }
  function copy() {
    if (!brief) return;
    navigator.clipboard?.writeText(brief).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  return (
    <div className="rounded-xl mb-6 macro-no-print" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <button onClick={toggle} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText size={14} style={{ color: "var(--ca-accent)" }} />
          <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--ca-text-2)" }}>This Week&apos;s Brief</p>
          <span className="text-[10px]" style={{ color: "var(--ca-text-3)" }}>AI weekly note — copy &amp; share</span>
        </div>
        <ChevronDown size={15} style={{ color: "var(--ca-text-3)", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && (
        <div className="px-4 pb-4 inst-fade-up">
          {loading ? (
            <div className="flex items-center gap-2 text-[12.5px] py-2" style={{ color: "var(--ca-text-3)" }}><Loader2 size={13} className="animate-spin" /> Writing this week&apos;s note…</div>
          ) : brief ? (
            <>
              <p className="text-[13.5px] leading-relaxed whitespace-pre-line" style={{ color: "var(--ca-text)" }}>{brief}</p>
              <button onClick={copy} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium inst-card-hover"
                style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-2)" }}>
                {copied ? <><Check size={13} style={{ color: "#147a4f" }} /> Copied</> : <><Copy size={13} /> Copy brief</>}
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
