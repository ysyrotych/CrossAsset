"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

type Row = { label: string; yrs: number; current: number | null; prior: number | null };

export default function YieldCurveChart() {
  const [rows, setRows] = useState<Row[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/macro-report/yield-curve").then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setAsOf(d.asOf ?? null); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-64 rounded-xl inst-skeleton mb-4" />;
  if (!rows.length) return null;

  // shape read: 2Y vs 10Y
  const two = rows.find((r) => r.label === "2Y")?.current;
  const ten = rows.find((r) => r.label === "10Y")?.current;
  const inverted = two != null && ten != null && two > ten;

  return (
    <div className="rounded-xl p-4 mb-4 macro-section" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-[12.5px] font-semibold" style={{ color: "var(--ca-text)" }}>U.S. Treasury Yield Curve</p>
          <p className="text-[9.5px] uppercase tracking-wide" style={{ color: "var(--ca-text-3)" }}>% · current vs 1 year ago{asOf ? ` · ${asOf}` : ""}</p>
        </div>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded" style={{ background: inverted ? "#fef2f2" : "#f0fdf4", color: inverted ? "#b42318" : "#147a4f" }}>
          {inverted ? "Inverted" : "Upward-sloping"}
        </span>
      </div>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
            <CartesianGrid stroke="#eef1f5" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} width={40} domain={["auto", "auto"]} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--ca-border)" }} />
            <Line type="monotone" dataKey="prior" name="1 year ago" stroke="#9ca3af" strokeWidth={1.8} strokeDasharray="4 3" dot={{ r: 2 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="current" name="Current" stroke="#0c1b38" strokeWidth={2.4} dot={{ r: 2.5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-1 px-1">
        <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ca-text-2)" }}><span className="w-3 h-[2px] rounded" style={{ background: "#0c1b38" }} />Current</span>
        <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ca-text-2)" }}><span className="w-3 h-[2px] rounded" style={{ background: "#9ca3af" }} />1 year ago</span>
      </div>
    </div>
  );
}
