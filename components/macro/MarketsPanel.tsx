"use client";

import { useEffect, useState } from "react";

type Row = { symbol: string; name: string; group: string; kind: "price" | "index"; last: number; wkChg: number; moChg: number };

function fmtLevel(v: number, kind: string): string {
  if (kind === "price") return v >= 1000 ? `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${v.toFixed(2)}`;
  return v.toLocaleString(undefined, { maximumFractionDigits: v < 100 ? 2 : 0 });
}

export default function MarketsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/macro-report/markets").then((r) => r.json())
      .then((d) => setRows(d.rows ?? [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-28 rounded-xl inst-skeleton mb-4" />;
  if (!rows.length) return null;

  return (
    <div className="rounded-xl overflow-hidden mb-4 macro-section" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--ca-border)" }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--ca-text-2)" }}>Markets This Week — Cross-Asset</p>
        <span className="text-[9.5px]" style={{ color: "var(--ca-text-3)" }}>live · week & month change</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        {rows.map((r, i) => (
          <div key={r.symbol} className="px-3 py-3" style={{ borderRight: i % 8 !== 7 ? "1px solid var(--ca-border)" : undefined, borderTop: i >= 8 ? "1px solid var(--ca-border)" : undefined }}>
            <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--ca-text-3)" }}>{r.name}</p>
            <p className="text-[15px] font-semibold tabular-nums leading-none" style={{ color: "var(--ca-text)" }}>{fmtLevel(r.last, r.kind)}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10.5px] font-semibold tabular-nums" style={{ color: r.wkChg >= 0 ? "#147a4f" : "#b42318" }}>
                {r.wkChg >= 0 ? "▲" : "▼"}{Math.abs(r.wkChg).toFixed(1)}% <span className="font-normal" style={{ color: "var(--ca-text-3)" }}>wk</span>
              </span>
            </div>
            <span className="text-[9.5px] tabular-nums" style={{ color: r.moChg >= 0 ? "#147a4f" : "#b42318" }}>
              {r.moChg >= 0 ? "+" : ""}{r.moChg.toFixed(1)}% <span style={{ color: "var(--ca-text-3)" }}>mo</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
