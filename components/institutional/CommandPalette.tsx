"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Building2, LineChart, CornerDownLeft } from "lucide-react";
import type { ManagerListItem } from "@/lib/institutional/types";
import { fmtMoney, initials } from "./shared";

type Item =
  | { kind: "manager"; slug: string; label: string; sub: string }
  | { kind: "ticker"; ticker: string; label: string; sub: string };

export default function CommandPalette({
  open, onClose, managers, onPickManager, onPickTicker,
}: {
  open: boolean; onClose: () => void; managers: ManagerListItem[];
  onPickManager: (slug: string) => void; onPickTicker: (t: string) => void;
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    const mgr: Item[] = managers
      .filter((m) => !s || m.name.toLowerCase().includes(s) || (m.manager ?? "").toLowerCase().includes(s))
      .slice(0, 6)
      .map((m) => ({ kind: "manager", slug: m.slug, label: m.manager ?? m.name, sub: `${m.name} · ${fmtMoney(m.aum13f)}` }));
    const tickerGuess = s.replace(/[^a-z]/g, "").toUpperCase();
    const tick: Item[] = tickerGuess && tickerGuess.length <= 5
      ? [{ kind: "ticker", ticker: tickerGuess, label: tickerGuess, sub: "Inspect institutional ownership" }]
      : [];
    return [...tick, ...mgr];
  }, [q, managers]);

  useEffect(() => { setIdx(0); }, [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); pick(items[idx]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, idx]);

  function pick(it: Item | undefined) {
    if (!it) return;
    if (it.kind === "manager") onPickManager(it.slug);
    else onPickTicker(it.ticker);
    onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[14vh]" style={{ background: "rgba(12,27,56,0.28)", backdropFilter: "blur(2px)" }} onClick={onClose}>
      <div className="w-[560px] max-w-[92vw] rounded-2xl overflow-hidden inst-scale-in" style={{ background: "var(--ca-surface)", boxShadow: "0 30px 80px -20px rgba(12,27,56,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid var(--ca-border)" }}>
          <Search size={16} style={{ color: "var(--ca-text-3)" }} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a fund or ticker…"
            className="flex-1 bg-transparent text-[14px] focus:outline-none" style={{ color: "var(--ca-text)" }} />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-3)" }}>ESC</kbd>
        </div>
        <div className="max-h-[340px] overflow-y-auto py-2">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-[12.5px] text-center" style={{ color: "var(--ca-text-3)" }}>No matches.</p>
          ) : items.map((it, i) => (
            <button key={i} onMouseEnter={() => setIdx(i)} onClick={() => pick(it)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
              style={{ background: i === idx ? "var(--ca-surface-2)" : "transparent" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: i === idx ? "var(--ca-accent)" : "var(--ca-surface-2)", color: i === idx ? "#fff" : "var(--ca-text-2)" }}>
                {it.kind === "manager" ? <span className="text-[9px] font-bold">{initials(it.label)}</span> : <LineChart size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate" style={{ color: "var(--ca-text)" }}>{it.label}</p>
                <p className="text-[10.5px] truncate" style={{ color: "var(--ca-text-3)" }}>{it.sub}</p>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded shrink-0"
                style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-3)" }}>
                {it.kind === "manager" ? "Fund" : "Ticker"}
              </span>
              {i === idx && <CornerDownLeft size={13} style={{ color: "var(--ca-text-3)" }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
