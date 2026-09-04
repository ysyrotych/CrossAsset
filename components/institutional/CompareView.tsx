"use client";

import { useEffect, useState } from "react";
import type { ManagerListItem, FundCompare, CompareHolding } from "@/lib/institutional/types";
import { ActionBadge } from "./shared";

export default function CompareView({ managers, onPickTicker }: { managers: ManagerListItem[]; onPickTicker: (t: string) => void }) {
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const [cmp, setCmp] = useState<FundCompare | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (managers.length < 2) return;
    const has = (s: string) => managers.some((m) => m.slug === s);
    // default to two funds that meaningfully overlap for a strong first impression
    setA((x) => x || (has("coatue") ? "coatue" : managers[0].slug));
    setB((x) => x || (has("tiger-global") ? "tiger-global" : managers[1].slug));
  }, [managers]);

  useEffect(() => {
    if (!a || !b || a === b) { setCmp(null); return; }
    setLoading(true);
    fetch(`/api/institutional/compare?a=${a}&b=${b}`).then((r) => r.json())
      .then((d) => setCmp(d.error ? null : d)).finally(() => setLoading(false));
  }, [a, b]);

  const sel = (val: string, set: (s: string) => void, other: string) => (
    <select value={val} onChange={(e) => set(e.target.value)}
      className="px-3 py-2 rounded-lg text-[13px] font-medium focus:outline-none"
      style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)", color: "var(--ca-text)" }}>
      {managers.map((m) => <option key={m.slug} value={m.slug} disabled={m.slug === other}>{m.manager} · {m.name}</option>)}
    </select>
  );

  return (
    <div className="inst-fade-up">
      <div className="flex items-center gap-3 mb-5">
        {sel(a, setA, b)}
        <span className="text-[12px] font-bold" style={{ color: "var(--ca-text-3)" }}>vs</span>
        {sel(b, setB, a)}
        {cmp && (
          <span className="ml-auto text-[11.5px] px-3 py-1.5 rounded-full" style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-2)" }}>
            <b style={{ color: "var(--ca-text)" }}>{cmp.overlapPct.toFixed(0)}%</b> portfolio overlap · {cmp.shared.length} shared names
          </span>
        )}
      </div>

      {loading && !cmp ? <div className="h-72 rounded-xl inst-skeleton" /> :
       a === b ? <p className="text-[13px]" style={{ color: "var(--ca-text-3)" }}>Pick two different funds.</p> :
       cmp ? (
        <div className="grid grid-cols-3 gap-4">
          <UniqueCol title={`Only ${cmp.a.manager}`} rows={cmp.onlyA} side="a" onPick={onPickTicker} />
          <SharedCol cmp={cmp} onPick={onPickTicker} />
          <UniqueCol title={`Only ${cmp.b.manager}`} rows={cmp.onlyB} side="b" onPick={onPickTicker} />
        </div>
      ) : null}
    </div>
  );
}

function SharedCol({ cmp, onPick }: { cmp: FundCompare; onPick: (t: string) => void }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-accent)" }}>
      <div className="px-4 py-3 text-center" style={{ background: "var(--ca-accent)" }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white">Shared Conviction · {cmp.shared.length}</p>
      </div>
      {cmp.shared.length === 0 ? <p className="px-4 py-6 text-[12px] text-center" style={{ color: "var(--ca-text-3)" }}>No overlap</p> :
        cmp.shared.map((h) => {
          const diverge = h.aAction && h.bAction &&
            ((["NEW", "ADD"].includes(h.aAction) && ["TRIM", "EXIT"].includes(h.bAction)) ||
             (["TRIM", "EXIT"].includes(h.aAction) && ["NEW", "ADD"].includes(h.bAction)));
          return (
            <button key={h.ticker} onClick={() => onPick(h.ticker)} className="w-full px-4 py-2.5 border-t inst-row-hover hover:bg-[var(--ca-surface-2)]" style={{ borderColor: "var(--ca-border)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12.5px] font-bold" style={{ color: "var(--ca-text)" }}>{h.ticker}</span>
                {diverge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#fffbeb", color: "#b7791f" }}>DIVERGE</span>}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">{h.aAction && <ActionBadge action={h.aAction} />}<span className="text-[10px] tabular-nums" style={{ color: "var(--ca-text-3)" }}>{h.aPct.toFixed(1)}%</span></span>
                <span className="flex items-center gap-1"><span className="text-[10px] tabular-nums" style={{ color: "var(--ca-text-3)" }}>{h.bPct.toFixed(1)}%</span>{h.bAction && <ActionBadge action={h.bAction} />}</span>
              </div>
            </button>
          );
        })}
    </div>
  );
}

function UniqueCol({ title, rows, side, onPick }: { title: string; rows: CompareHolding[]; side: "a" | "b"; onPick: (t: string) => void }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--ca-border)" }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] truncate" style={{ color: "var(--ca-text-2)" }}>{title}</p>
        <p className="text-[10px]" style={{ color: "var(--ca-text-3)" }}>{rows.length} unique positions</p>
      </div>
      {rows.slice(0, 14).map((h) => (
        <button key={h.ticker} onClick={() => onPick(h.ticker)} className="w-full flex items-center justify-between px-4 py-2.5 border-t inst-row-hover hover:bg-[var(--ca-surface-2)]" style={{ borderColor: "var(--ca-border)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[12.5px] font-bold" style={{ color: "var(--ca-text)" }}>{h.ticker}</span>
            {(side === "a" ? h.aAction : h.bAction) && <ActionBadge action={(side === "a" ? h.aAction : h.bAction)!} />}
          </div>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--ca-text-2)" }}>{(side === "a" ? h.aPct : h.bPct).toFixed(1)}%</span>
        </button>
      ))}
    </div>
  );
}
