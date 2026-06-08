"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const YIELD_DATA = [
  { month: "Jan", tenY: 3.97, twoY: 4.32 },
  { month: "Feb", tenY: 4.18, twoY: 4.59 },
  { month: "Mar", tenY: 4.35, twoY: 4.71 },
  { month: "Apr", tenY: 4.52, twoY: 4.89 },
  { month: "May", tenY: 4.64, twoY: 4.95 },
  { month: "Jun", tenY: 4.68, twoY: 4.97 },
];

const CPI_DATA = [
  { month: "Jan", cpi: 3.9, coreCpi: 3.9 },
  { month: "Feb", cpi: 3.7, coreCpi: 3.8 },
  { month: "Mar", cpi: 3.6, coreCpi: 3.8 },
  { month: "Apr", cpi: 3.5, coreCpi: 3.6 },
  { month: "May", cpi: 3.4, coreCpi: 3.6 },
  { month: "Jun", cpi: 3.4, coreCpi: 3.6 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs">
      <p className="text-zinc-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}%</p>
      ))}
    </div>
  );
};

export function YieldChart() {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={YIELD_DATA}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} tickFormatter={(v) => `${v}%`} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="tenY" name="10Y" stroke="#E8C468" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="twoY" name="2Y" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CpiChart() {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={CPI_DATA}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} tickFormatter={(v) => `${v}%`} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="cpi" name="CPI" stroke="#f87171" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="coreCpi" name="Core" stroke="#fb923c" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
