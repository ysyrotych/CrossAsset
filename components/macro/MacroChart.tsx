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

export default function MacroChart({ chart, onExpand, height = 210, bare = false }: { chart: RenderedChart; onExpand?: () => void; height?: number; bare?: boolean }) {
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
      <ChartFrame chart={chart} bare={bare} onExpand={onExpand}>
        <div style={{ height }} className="flex items-center justify-center text-[12px]" >
          <span style={{ color: "var(--ca-text-3)" }}>{chart.error === "no data" ? "Data source unavailable" : chart.error}</span>
        </div>
      </ChartFrame>
    );
  }

  return (
    <ChartFrame chart={chart} bare={bare} onExpand={onExpand}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          {chart.chartType === "bar" ? (
            <BarChart data={merged} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="#eef1f5" vertical={false} />
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={yearFmt} tick={{ fontSize: 10, fill: "#9ca3af" }} minTickGap={28} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} width={40} />
              <Tooltip content={<TT unit={chart.unit} p={p} />} />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              <Bar dataKey={keys[0]} isAnimationActive={false}>
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
              {chart.refLine != null && <ReferenceLine y={chart.refLine} stroke="#94a3b8" strokeDasharray="2 2" label={{ value: `${chart.refLine}`, position: "insideBottomRight", fontSize: 9, fill: "#94a3b8" }} />}
              <Area type="monotone" dataKey={keys[0]} stroke={chart.series[0]?.color ?? NAVY} strokeWidth={1.6} fill={`url(#g-${chart.id})`} isAnimationActive={false} dot={false} />
            </AreaChart>
          ) : (
            <LineChart data={merged} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="#eef1f5" vertical={false} />
              {bands.map((b, i) => <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill="#c7d2e4" fillOpacity={0.35} />)}
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={yearFmt} tick={{ fontSize: 10, fill: "#9ca3af" }} minTickGap={28} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} width={40} />
              <Tooltip content={<TT unit={chart.unit} p={p} />} />
              {chart.avg != null && <ReferenceLine y={chart.avg} stroke="#2563eb" strokeDasharray="4 3" label={{ value: `Ave ${chart.avg.toFixed(p)}`, position: "insideTopRight", fontSize: 9, fill: "#2563eb" }} />}
              {chart.refLine != null && <ReferenceLine y={chart.refLine} stroke="#94a3b8" strokeDasharray="2 2" label={{ value: `${chart.refLine}`, position: "insideBottomRight", fontSize: 9, fill: "#94a3b8" }} />}
              {keys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={chart.series[i]?.color ?? NAVY} strokeWidth={1.6} dot={false} isAnimationActive={false} />
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

function MiniSpark({ data }: { data: { value: number }[] }) {
  const pts = data.slice(-14).map((d) => d.value);
  if (pts.length < 2) return null;
  const max = Math.max(...pts), min = Math.min(...pts), range = max - min || 1;
  const w = 54, h = 16;
  const poly = pts.map((v, i) => `${((i / (pts.length - 1)) * (w - 2) + 1).toFixed(1)},${(h - 1 - ((v - min) / range) * (h - 2)).toFixed(1)}`).join(" ");
  const up = pts[pts.length - 1] >= pts[0];
  return <svg width={w} height={h}><polyline points={poly} fill="none" stroke={up ? "#147a4f" : "#b42318"} strokeWidth={1.3} strokeLinejoin="round" /></svg>;
}

export function ChangeText({ change, unit, precision = 1, cls = "text-[10px]" }: { change?: number; unit?: "% y/y" | "pp"; precision?: number; cls?: string }) {
  if (change == null || !unit) return null;
  const up = change >= 0;
  const val = unit === "pp" ? `${up ? "+" : ""}${change.toFixed(precision)} pp` : `${up ? "+" : ""}${change.toFixed(1)}% y/y`;
  return <p className={`${cls} tabular-nums`} style={{ color: up ? "#147a4f" : "#b42318" }}>{val}</p>;
}

function ChartFrame({ chart, children, onExpand, bare = false }: { chart: RenderedChart; children: React.ReactNode; onExpand?: () => void; bare?: boolean }) {
  const latest = chart.latest;
  const p = chart.precision ?? 1;
  const primary = chart.series[0]?.data ?? [];
  if (bare) return <div className="w-full">{children}</div>;
  return (
    <div className={`rounded-xl p-4 inst-card-hover ${onExpand ? "cursor-pointer" : ""}`} onClick={onExpand}
      style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold leading-tight" style={{ color: "var(--ca-text)" }}>{chart.title}</p>
          <p className="text-[9.5px] uppercase tracking-wide" style={{ color: "var(--ca-text-3)" }}>
            {chart.unit}{chart.stale && chart.asOf ? ` · as of ${chart.asOf}` : ""}
          </p>
        </div>
        {latest && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="opacity-70 macro-no-print"><MiniSpark data={primary} /></div>
            <div className="text-right">
              <p className="text-[15px] font-semibold tabular-nums leading-none" style={{ color: "var(--ca-text)" }}>{fmtVal(latest.value, chart.unit, p)}</p>
              <ChangeText change={latest.change} unit={latest.changeUnit} precision={p} />
            </div>
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
