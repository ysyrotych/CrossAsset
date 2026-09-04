"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea, CartesianGrid,
} from "recharts";
import type { RenderedChart } from "@/lib/macro/types";
import { RECESSIONS } from "@/lib/macro/manifest";

const NAVY = "#0c1b38";

function fmtVal(v: number, unit: string, p = 1): string {
  const n = Math.abs(v) >= 10000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(p);
  if (unit.includes("%")) return `${n}%`;
  if (unit.startsWith("$")) return `$${n}`;
  return n;
}

export default function MacroChart({ chart }: { chart: RenderedChart }) {
  const { merged, keys, minT, maxT } = useMemo(() => {
    const map = new Map<number, Record<string, number>>();
    const keys = chart.series.map((s) => s.name);
    for (const s of chart.series) {
      for (const p of s.data) {
        const t = new Date(p.date).getTime();
        const row = map.get(t) ?? { t };
        row[s.name] = p.value;
        map.set(t, row);
      }
    }
    const merged = [...map.values()].sort((a, b) => a.t - b.t);
    return { merged, keys, minT: merged[0]?.t ?? 0, maxT: merged[merged.length - 1]?.t ?? 0 };
  }, [chart]);

  const latest = chart.latest;
  const p = chart.precision ?? 1;
  const bands = RECESSIONS
    .map((r) => ({ x1: new Date(r.start).getTime(), x2: new Date(r.end).getTime() }))
    .filter((b) => b.x2 >= minT && b.x1 <= maxT);

  const yearFmt = (t: number) => `'${String(new Date(t).getUTCFullYear()).slice(2)}`;

  if (chart.error && !merged.length) {
    return (
      <ChartFrame chart={chart}>
        <div className="h-[200px] flex items-center justify-center text-[12px]" style={{ color: "var(--ca-text-3)" }}>
          {chart.error === "no data" ? "Data source unavailable" : chart.error}
        </div>
      </ChartFrame>
    );
  }

  return (
    <ChartFrame chart={chart}>
      <div style={{ width: "100%", height: 210 }}>
        <ResponsiveContainer>
          {chart.chartType === "bar" ? (
            <BarChart data={merged} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="#eef1f5" vertical={false} />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={yearFmt} tick={{ fontSize: 10, fill: "#9ca3af" }} minTickGap={28} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} width={40} />
              <Tooltip content={<TT unit={chart.unit} p={p} />} />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              <Bar dataKey={keys[0]} isAnimationActive>
                {merged.map((row, i) => (
                  <Cell key={i} fill={(row[keys[0]] ?? 0) >= 0 ? "#147a4f" : "#b42318"} />
                ))}
              </Bar>
            </BarChart>
          ) : chart.chartType === "area" ? (
            <AreaChart data={merged} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
              <defs>
                <linearGradient id={`g-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chart.series[0]?.color ?? NAVY} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={chart.series[0]?.color ?? NAVY} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#eef1f5" vertical={false} />
              {bands.map((b, i) => <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill="#c7d2e4" fillOpacity={0.35} />)}
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={yearFmt} tick={{ fontSize: 10, fill: "#9ca3af" }} minTickGap={28} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} width={40} />
              <Tooltip content={<TT unit={chart.unit} p={p} />} />
              {chart.avg != null && <ReferenceLine y={chart.avg} stroke="#2563eb" strokeDasharray="4 3" label={{ value: `Ave ${chart.avg.toFixed(p)}`, position: "insideTopRight", fontSize: 9, fill: "#2563eb" }} />}
              <Area type="monotone" dataKey={keys[0]} stroke={chart.series[0]?.color ?? NAVY} strokeWidth={1.6} fill={`url(#g-${chart.id})`} isAnimationActive dot={false} />
            </AreaChart>
          ) : (
            <LineChart data={merged} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="#eef1f5" vertical={false} />
              {bands.map((b, i) => <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill="#c7d2e4" fillOpacity={0.35} />)}
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={yearFmt} tick={{ fontSize: 10, fill: "#9ca3af" }} minTickGap={28} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} width={40} />
              <Tooltip content={<TT unit={chart.unit} p={p} />} />
              {chart.avg != null && <ReferenceLine y={chart.avg} stroke="#2563eb" strokeDasharray="4 3" label={{ value: `Ave ${chart.avg.toFixed(p)}`, position: "insideTopRight", fontSize: 9, fill: "#2563eb" }} />}
              {keys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={chart.series[i]?.color ?? NAVY} strokeWidth={1.6} dot={false} isAnimationActive />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {keys.length > 1 && (
        <div className="flex items-center gap-4 mt-1 px-1">
          {keys.map((k, i) => (
            <span key={k} className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ca-text-2)" }}>
              <span className="w-3 h-[2px] rounded" style={{ background: chart.series[i]?.color ?? NAVY }} />{k}
            </span>
          ))}
        </div>
      )}
      {chart.note && <p className="text-[9.5px] mt-1 px-1" style={{ color: "var(--ca-text-3)" }}>{chart.note}</p>}
    </ChartFrame>
  );
}

function ChartFrame({ chart, children }: { chart: RenderedChart; children: React.ReactNode }) {
  const latest = chart.latest;
  const p = chart.precision ?? 1;
  return (
    <div className="rounded-xl p-4 inst-card-hover" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold leading-tight" style={{ color: "var(--ca-text)" }}>{chart.title}</p>
          <p className="text-[9.5px] uppercase tracking-wide" style={{ color: "var(--ca-text-3)" }}>
            {chart.unit}{chart.stale && chart.asOf ? ` · as of ${chart.asOf}` : ""}
          </p>
        </div>
        {latest && (
          <div className="text-right shrink-0 pl-2">
            <p className="text-[15px] font-semibold tabular-nums leading-none" style={{ color: "var(--ca-text)" }}>{fmtVal(latest.value, chart.unit, p)}</p>
            {latest.changeYoY != null && (
              <p className="text-[10px] tabular-nums" style={{ color: latest.changeYoY >= 0 ? "#147a4f" : "#b42318" }}>
                {latest.changeYoY >= 0 ? "+" : ""}{latest.changeYoY.toFixed(1)}% y/y
              </p>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function TT({ active, payload, unit, p }: { active?: boolean; payload?: { name: string; value: number; color: string; payload: { t: number } }[]; unit: string; p: number }) {
  if (!active || !payload?.length) return null;
  const d = new Date(payload[0].payload.t);
  return (
    <div className="rounded-lg px-2.5 py-1.5 text-[10.5px]" style={{ background: "#0c1b38", color: "#fff" }}>
      <p className="opacity-70 mb-0.5">{d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}</p>
      {payload.map((s) => (
        <p key={s.name}><span style={{ color: s.color }}>●</span> {s.name}: {fmtVal(s.value, unit, p)}</p>
      ))}
    </div>
  );
}
