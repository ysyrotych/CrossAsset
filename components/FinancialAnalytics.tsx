"use client";

import { useState } from "react";
import { Sparkles, BarChart2, TrendingUp, Activity, Shield, Users, Zap } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type KmHistory = { date: string; pe: number|null; ev_ebitda: number|null; roic: number|null; p_fcf: number|null; current_ratio: number|null; debt_equity: number|null }[];
type GrowthHistory = { date: string; rev_growth: number; eps_growth: number; fcf_growth: number }[];
type EarningsSurprise = { date: string; eps_actual: number|null; eps_est: number|null; surprise_pct: number|null }[];
type PeerComp = { symbol: string; pe: number|null; ev_ebitda: number|null; p_fcf: number|null; roic: number; net_margin: number }[];

export type FinancialAnalyticsProps = {
  ticker: string;
  companyName: string;
  facts: Record<string, number>;
  history: Record<string, Record<string, number>>;
  quarterly: Record<string, number>;
  quarterlyPeriod: string;
  kmHistory?: KmHistory;
  growthHistory?: GrowthHistory;
  earningsSurprises?: EarningsSurprise;
  peers?: PeerComp;
  sector?: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const BLUE = "#3b82f6";
const TEAL = "#14b8a6";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const PURPLE = "#a78bfa";
const ORANGE = "#f97316";
const PINK = "#ec4899";
const DARK_BG = "#0c1b38";
const DARK_BORDER = "#1e3560";
const PALETTE = [BLUE, TEAL, GREEN, AMBER, PURPLE, ORANGE, PINK, RED];

// ── SVG Helpers ───────────────────────────────────────────────────────────────

function abbreviate(n: number, prefix = ""): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${prefix}${(abs/1e12).toFixed(1)}T`;
  if (abs >= 1e9)  return `${sign}${prefix}${(abs/1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `${sign}${prefix}${(abs/1e6).toFixed(1)}M`;
  if (abs >= 1e3)  return `${sign}${prefix}${(abs/1e3).toFixed(0)}K`;
  return `${sign}${prefix}${abs.toFixed(1)}`;
}

function niceMax(val: number): number {
  if (val <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  return Math.ceil(val / mag) * mag;
}

function yearsFrom(hist: Record<string, number>): string[] {
  return Object.keys(hist).sort().slice(-6);
}

// ── Chart: Vertical Bar (single series, with optional growth labels) ───────────

function BarSVG({
  data, color = BLUE, prefix = "$", showGrowth = false, height = 160, negativeRed = true
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  color?: string; prefix?: string; showGrowth?: boolean;
  height?: number; negativeRed?: boolean;
}) {
  if (!data.length) return <NoData />;
  const W = 320; const H = height;
  const PAD = { t: 24, r: 8, b: 28, l: 46 };
  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;

  const vals = data.map(d => d.value);
  const minV = Math.min(0, ...vals);
  const maxV = Math.max(...vals, 0.001);
  const range = maxV - minV || 1;

  const GRIDS = 4;
  const toY = (v: number) => PAD.t + ch - ((v - minV) / range) * ch;
  const zeroY = toY(0);
  const bw = Math.max(8, cw / data.length * 0.6);
  const step = cw / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* Grid */}
      {Array.from({length: GRIDS+1}, (_, i) => {
        const gv = minV + range * i / GRIDS;
        const gy = toY(gv);
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W-PAD.r} y1={gy} y2={gy} stroke={DARK_BORDER} strokeWidth="0.5" />
            <text x={PAD.l-3} y={gy+3} textAnchor="end" fontSize="7" fill="#ffffff40">
              {prefix === "%" ? `${gv.toFixed(0)}%` : abbreviate(gv, prefix)}
            </text>
          </g>
        );
      })}
      {/* Zero line */}
      <line x1={PAD.l} x2={W-PAD.r} y1={zeroY} y2={zeroY} stroke="#ffffff30" strokeWidth="0.8" />
      {/* Bars */}
      {data.map((d, i) => {
        const bx = PAD.l + i * step + (step - bw) / 2;
        const by = d.value >= 0 ? toY(d.value) : zeroY;
        const bh = Math.max(1, Math.abs(toY(d.value) - zeroY));
        const fillColor = negativeRed && d.value < 0 ? RED : color;
        const growth = i > 0 && data[i-1].value !== 0
          ? ((d.value - data[i-1].value) / Math.abs(data[i-1].value) * 100) : null;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bw} height={bh} fill={fillColor} rx="1.5" opacity="0.9" />
            {showGrowth && growth != null && (
              <text x={bx + bw/2} y={by - 3} textAnchor="middle" fontSize="6.5"
                fill={growth >= 0 ? GREEN : RED} fontWeight="600">
                {growth >= 0 ? "▲" : "▼"}{Math.abs(growth).toFixed(0)}%
              </text>
            )}
            <text x={bx + bw/2} y={H - PAD.b + 10} textAnchor="middle" fontSize="7" fill="#ffffff50">
              {d.label.length > 4 ? d.label.slice(2) : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Chart: Line (multi-series) ─────────────────────────────────────────────────

function LineSVG({
  series, labels, height = 160, pct = false, showDots = true
}: {
  series: { name: string; values: (number|null)[]; color: string }[];
  labels: string[];
  height?: number; pct?: boolean; showDots?: boolean;
}) {
  if (!series.length || !labels.length) return <NoData />;
  const W = 320; const H = height;
  const PAD = { t: 20, r: 8, b: 28, l: 46 };
  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;
  const GRIDS = 4;

  const allVals = series.flatMap(s => s.values.filter((v): v is number => v != null));
  if (!allVals.length) return <NoData />;
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const toY = (v: number) => PAD.t + ch - ((v - minV) / range) * ch;
  const toX = (i: number) => PAD.l + (i / Math.max(labels.length - 1, 1)) * cw;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* Grid */}
      {Array.from({length: GRIDS+1}, (_, i) => {
        const gv = minV + range * i / GRIDS;
        const gy = toY(gv);
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W-PAD.r} y1={gy} y2={gy} stroke={DARK_BORDER} strokeWidth="0.5" />
            <text x={PAD.l-3} y={gy+3} textAnchor="end" fontSize="7" fill="#ffffff40">
              {pct ? `${gv.toFixed(0)}%` : abbreviate(gv)}
            </text>
          </g>
        );
      })}
      {/* Lines */}
      {series.map(s => {
        const pts = labels.map((_, i) => s.values[i]).map((v, i) =>
          v != null ? `${toX(i)},${toY(v)}` : null
        );
        // segment non-null runs
        const segments: string[][] = [];
        let cur: string[] = [];
        pts.forEach(p => {
          if (p) cur.push(p);
          else if (cur.length) { segments.push(cur); cur = []; }
        });
        if (cur.length) segments.push(cur);
        return (
          <g key={s.name}>
            {segments.map((seg, si) => (
              <polyline key={si} points={seg.join(" ")} fill="none" stroke={s.color} strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {showDots && labels.map((_, i) => s.values[i] != null ? (
              <circle key={i} cx={toX(i)} cy={toY(s.values[i]!)} r="2.5" fill={s.color} />
            ) : null)}
          </g>
        );
      })}
      {/* X labels */}
      {labels.map((l, i) => (
        <text key={i} x={toX(i)} y={H - PAD.b + 10} textAnchor="middle" fontSize="7" fill="#ffffff50">
          {l.length > 4 ? l.slice(2) : l}
        </text>
      ))}
      {/* Legend */}
      {series.length > 1 && (
        <g>
          {series.map((s, i) => (
            <g key={s.name} transform={`translate(${PAD.l + i * 80},${H - 8})`}>
              <rect x="0" y="-4" width="8" height="3" fill={s.color} rx="1" />
              <text x="10" y="0" fontSize="6.5" fill="#ffffff60">{s.name}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

// ── Chart: Grouped Bar ─────────────────────────────────────────────────────────

function GroupedBarSVG({
  groups, series, height = 160, prefix = "$"
}: {
  groups: string[];
  series: { name: string; values: number[]; color: string }[];
  height?: number; prefix?: string;
}) {
  if (!groups.length || !series.length) return <NoData />;
  const W = 320; const H = height;
  const PAD = { t: 20, r: 8, b: 28, l: 46 };
  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;
  const GRIDS = 4;

  const allVals = series.flatMap(s => s.values);
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(...allVals, 0.001);
  const range = maxV - minV || 1;
  const toY = (v: number) => PAD.t + ch - ((v - minV) / range) * ch;
  const zeroY = toY(0);

  const groupW = cw / groups.length;
  const barW = Math.max(5, (groupW * 0.8) / series.length);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {Array.from({length: GRIDS+1}, (_, i) => {
        const gv = minV + range * i / GRIDS;
        const gy = toY(gv);
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W-PAD.r} y1={gy} y2={gy} stroke={DARK_BORDER} strokeWidth="0.5" />
            <text x={PAD.l-3} y={gy+3} textAnchor="end" fontSize="7" fill="#ffffff40">
              {prefix === "%" ? `${gv.toFixed(0)}%` : abbreviate(gv, prefix)}
            </text>
          </g>
        );
      })}
      <line x1={PAD.l} x2={W-PAD.r} y1={zeroY} y2={zeroY} stroke="#ffffff30" strokeWidth="0.8" />
      {groups.map((g, gi) => {
        const gx = PAD.l + gi * groupW + groupW * 0.1;
        return (
          <g key={gi}>
            {series.map((s, si) => {
              const v = s.values[gi] ?? 0;
              const bx = gx + si * barW;
              const by = v >= 0 ? toY(v) : zeroY;
              const bh = Math.max(1, Math.abs(toY(v) - zeroY));
              return <rect key={si} x={bx} y={by} width={barW - 1} height={bh} fill={s.color} rx="1" opacity="0.88" />;
            })}
            <text x={PAD.l + gi * groupW + groupW/2} y={H - PAD.b + 10} textAnchor="middle" fontSize="7" fill="#ffffff50">
              {g.length > 4 ? g.slice(2) : g}
            </text>
          </g>
        );
      })}
      {/* Legend */}
      {series.map((s, i) => (
        <g key={s.name} transform={`translate(${PAD.l + i * 80},${H - 8})`}>
          <rect x="0" y="-4" width="8" height="3" fill={s.color} rx="1" />
          <text x="10" y="0" fontSize="6.5" fill="#ffffff60">{s.name}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Chart: Stacked Bar ─────────────────────────────────────────────────────────

function StackedBarSVG({
  labels, series, height = 160, prefix = "$"
}: {
  labels: string[];
  series: { name: string; values: number[]; color: string }[];
  height?: number; prefix?: string;
}) {
  if (!labels.length || !series.length) return <NoData />;
  const W = 320; const H = height;
  const PAD = { t: 20, r: 8, b: 28, l: 46 };
  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;

  const totals = labels.map((_, i) => series.reduce((s, row) => s + (row.values[i] ?? 0), 0));
  const maxV = Math.max(...totals, 0.001);
  const toY = (v: number) => PAD.t + ch - (v / maxV) * ch;
  const bw = Math.max(10, (cw / labels.length) * 0.65);
  const step = cw / labels.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {[0,0.25,0.5,0.75,1].map((frac, i) => {
        const gv = maxV * frac;
        const gy = toY(gv);
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W-PAD.r} y1={gy} y2={gy} stroke={DARK_BORDER} strokeWidth="0.5" />
            <text x={PAD.l-3} y={gy+3} textAnchor="end" fontSize="7" fill="#ffffff40">
              {prefix === "%" ? `${(frac*100).toFixed(0)}%` : abbreviate(gv, prefix)}
            </text>
          </g>
        );
      })}
      {labels.map((lbl, li) => {
        const bx = PAD.l + li * step + (step - bw) / 2;
        let cumY = PAD.t + ch;
        return (
          <g key={li}>
            {series.map((s, si) => {
              const v = s.values[li] ?? 0;
              const bh = Math.max(0, (v / maxV) * ch);
              cumY -= bh;
              return <rect key={si} x={bx} y={cumY} width={bw} height={bh} fill={s.color} opacity="0.88" />;
            })}
            <text x={bx + bw/2} y={H - PAD.b + 10} textAnchor="middle" fontSize="7" fill="#ffffff50">
              {lbl.length > 4 ? lbl.slice(2) : lbl}
            </text>
          </g>
        );
      })}
      {series.map((s, i) => (
        <g key={s.name} transform={`translate(${PAD.l + i * 76},${H - 8})`}>
          <rect x="0" y="-4" width="8" height="3" fill={s.color} rx="1" />
          <text x="10" y="0" fontSize="6.5" fill="#ffffff60">{s.name}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Chart: Horizontal Bar (peer comparison) ───────────────────────────────────

function HBarSVG({
  data, color = BLUE, suffix = "x", maxVal
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  color?: string; suffix?: string; maxVal?: number;
}) {
  if (!data.length) return <NoData />;
  const W = 320; const H = Math.max(80, data.length * 24 + 20);
  const PAD = { t: 8, r: 60, b: 8, l: 48 };
  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;
  const barH = Math.min(14, ch / data.length - 4);
  const maxV = maxVal ?? Math.max(...data.map(d => d.value), 0.001);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {data.map((d, i) => {
        const y = PAD.t + i * (ch / data.length) + (ch / data.length - barH) / 2;
        const bw = Math.max(1, (d.value / maxV) * cw);
        const fc = d.highlight ? "#60a5fa" : color;
        return (
          <g key={i}>
            <text x={PAD.l - 3} y={y + barH/2 + 3} textAnchor="end" fontSize="7.5" fill={d.highlight ? "#93c5fd" : "#ffffff80"} fontWeight={d.highlight ? "700" : "400"}>
              {d.label}
            </text>
            <rect x={PAD.l} y={y} width={Math.max(1, bw)} height={barH} fill={fc} rx="2" opacity="0.88" />
            <text x={PAD.l + bw + 3} y={y + barH/2 + 3} fontSize="7.5" fill={fc} fontWeight="600">
              {d.value.toFixed(1)}{suffix}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Chart: Beat/Miss dot plot ─────────────────────────────────────────────────

function BeatMissSVG({ data }: { data: EarningsSurprise }) {
  if (!data.length) return <NoData />;
  const recent = data.slice(-8).reverse();
  const W = 320; const H = 140;
  const PAD = { t: 20, r: 8, b: 36, l: 46 };
  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;

  const surps = recent.map(d => d.surprise_pct ?? 0);
  const maxS = Math.max(Math.abs(Math.min(...surps)), Math.abs(Math.max(...surps)), 5);
  const toY = (v: number) => PAD.t + ch/2 - (v / maxS) * (ch/2);
  const step = cw / Math.max(recent.length - 1, 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* Zero line */}
      <line x1={PAD.l} x2={W-PAD.r} y1={PAD.t + ch/2} y2={PAD.t + ch/2} stroke="#ffffff30" strokeWidth="0.8" />
      <text x={PAD.l-3} y={PAD.t + ch/2 + 3} textAnchor="end" fontSize="7" fill="#ffffff40">0%</text>
      {/* Grid */}
      {[-maxS/2, maxS/2].map((gv, i) => {
        const gy = toY(gv);
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W-PAD.r} y1={gy} y2={gy} stroke={DARK_BORDER} strokeWidth="0.5" strokeDasharray="2,2" />
            <text x={PAD.l-3} y={gy+3} textAnchor="end" fontSize="7" fill="#ffffff40">{gv > 0 ? "+" : ""}{gv.toFixed(0)}%</text>
          </g>
        );
      })}
      {/* Bars from zero */}
      {recent.map((d, i) => {
        const x = PAD.l + i * step;
        const s = d.surprise_pct ?? 0;
        const y0 = PAD.t + ch/2;
        const y1 = toY(s);
        const color = s >= 0 ? GREEN : RED;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={Math.min(y0,y1)} y2={Math.max(y0,y1)} stroke={color} strokeWidth="3" strokeLinecap="round" />
            <circle cx={x} cy={y1} r="3.5" fill={color} />
            <text x={x} y={s >= 0 ? y1 - 5 : y1 + 11} textAnchor="middle" fontSize="6.5" fill={color} fontWeight="600">
              {s >= 0 ? "+" : ""}{s.toFixed(1)}%
            </text>
            <text x={x} y={H - PAD.b + 10} textAnchor="middle" fontSize="6.5" fill="#ffffff40">
              {d.date?.slice(0,7) ?? ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Chart: Waterfall ──────────────────────────────────────────────────────────

function WaterfallSVG({
  items, height = 160
}: {
  items: { label: string; value: number; total?: boolean }[];
  height?: number;
}) {
  if (!items.length) return <NoData />;
  const W = 320; const H = height;
  const PAD = { t: 24, r: 8, b: 28, l: 46 };
  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;

  // Calculate running totals
  let running = 0;
  const bars = items.map(item => {
    if (item.total) {
      const bar = { label: item.label, start: 0, end: running + item.value, total: true };
      running += item.value;
      return bar;
    }
    const start = running;
    running += item.value;
    return { label: item.label, start, end: running, total: false };
  });

  const allVals = bars.flatMap(b => [b.start, b.end]);
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(...allVals, 0.001);
  const range = maxV - minV || 1;
  const toY = (v: number) => PAD.t + ch - ((v - minV) / range) * ch;
  const bw = Math.max(10, (cw / bars.length) * 0.65);
  const step = cw / bars.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const gv = minV + range * f;
        const gy = toY(gv);
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W-PAD.r} y1={gy} y2={gy} stroke={DARK_BORDER} strokeWidth="0.5" />
            <text x={PAD.l-3} y={gy+3} textAnchor="end" fontSize="7" fill="#ffffff40">{abbreviate(gv, "$")}</text>
          </g>
        );
      })}
      {bars.map((b, i) => {
        const bx = PAD.l + i * step + (step - bw) / 2;
        const diff = b.end - b.start;
        const by = toY(Math.max(b.start, b.end));
        const bh = Math.max(1, Math.abs(toY(b.start) - toY(b.end)));
        const fc = b.total ? BLUE : diff >= 0 ? GREEN : RED;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bw} height={bh} fill={fc} rx="1.5" opacity="0.9" />
            <text x={bx + bw/2} y={by - 2} textAnchor="middle" fontSize="6.5" fill={fc} fontWeight="600">
              {diff >= 0 ? "+" : ""}{abbreviate(diff, "$")}
            </text>
            <text x={bx + bw/2} y={H - PAD.b + 10} textAnchor="middle" fontSize="6.5" fill="#ffffff50">
              {b.label}
            </text>
            {/* Connector to next bar */}
            {i < bars.length - 1 && !b.total && (
              <line x1={bx + bw} x2={PAD.l + (i+1) * step + (step-bw)/2} y1={toY(b.end)} y2={toY(b.end)} stroke="#ffffff20" strokeWidth="0.5" strokeDasharray="2,2" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Chart: Scatter / Bubble ────────────────────────────────────────────────────

function ScatterSVG({
  points, xLabel, yLabel, height = 160
}: {
  points: { label: string; x: number; y: number; highlight?: boolean }[];
  xLabel?: string; yLabel?: string; height?: number;
}) {
  if (!points.length) return <NoData />;
  const W = 320; const H = height;
  const PAD = { t: 12, r: 12, b: 32, l: 44 };
  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const toX = (v: number) => PAD.l + ((v - minX) / (maxX - minX || 1)) * cw;
  const toY = (v: number) => PAD.t + ch - ((v - minY) / (maxY - minY || 1)) * ch;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* Axes */}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t+ch} stroke={DARK_BORDER} strokeWidth="0.8" />
      <line x1={PAD.l} x2={W-PAD.r} y1={PAD.t+ch} y2={PAD.t+ch} stroke={DARK_BORDER} strokeWidth="0.8" />
      {/* Axis labels */}
      {xLabel && <text x={PAD.l + cw/2} y={H - 2} textAnchor="middle" fontSize="7" fill="#ffffff40">{xLabel}</text>}
      {yLabel && <text x={6} y={PAD.t + ch/2} textAnchor="middle" fontSize="7" fill="#ffffff40" transform={`rotate(-90,6,${PAD.t+ch/2})`}>{yLabel}</text>}
      {/* Grid */}
      {[0.25,0.5,0.75].map(f => (
        <g key={f}>
          <line x1={PAD.l} x2={W-PAD.r} y1={PAD.t + ch*f} y2={PAD.t + ch*f} stroke={DARK_BORDER} strokeWidth="0.3" strokeDasharray="2,2" />
          <line x1={PAD.l + cw*f} x2={PAD.l + cw*f} y1={PAD.t} y2={PAD.t+ch} stroke={DARK_BORDER} strokeWidth="0.3" strokeDasharray="2,2" />
        </g>
      ))}
      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={toX(p.x)} cy={toY(p.y)} r={p.highlight ? 5 : 3.5}
            fill={p.highlight ? "#60a5fa" : PALETTE[i % PALETTE.length]} opacity="0.9" />
          <text x={toX(p.x)} y={toY(p.y) - 6} textAnchor="middle" fontSize="6.5"
            fill={p.highlight ? "#93c5fd" : "#ffffff80"}>{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── No Data placeholder ───────────────────────────────────────────────────────

function NoData() {
  return (
    <svg viewBox="0 0 320 120" style={{ width: "100%", height: "auto" }}>
      <text x="160" y="60" textAnchor="middle" fontSize="10" fill="#ffffff20">Insufficient data</text>
    </svg>
  );
}

// ── Chart Card wrapper ────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden border" style={{ background: DARK_BG, borderColor: DARK_BORDER }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: DARK_BORDER }}>
        <p className="text-[8.5px] font-bold uppercase tracking-widest" style={{ color: "#ffffff50" }}>{title}</p>
        {subtitle && <p className="text-[7.5px] mt-0.5" style={{ color: "#ffffff25" }}>{subtitle}</p>}
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

// ── Category tabs ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "growth",    label: "Revenue & Growth",     icon: TrendingUp },
  { id: "margins",   label: "Profitability",         icon: BarChart2  },
  { id: "cashflow",  label: "Cash Flow",             icon: Activity   },
  { id: "balance",   label: "Balance Sheet",         icon: Shield     },
  { id: "multiples", label: "Valuation History",     icon: Zap        },
  { id: "quality",   label: "Quality & Peers",       icon: Users      },
] as const;
type CategoryId = typeof CATEGORIES[number]["id"];

// ── Main Component ────────────────────────────────────────────────────────────

export default function FinancialAnalytics({
  ticker, companyName, facts, history, quarterly, quarterlyPeriod,
  kmHistory = [], growthHistory = [], earningsSurprises = [], peers = [], sector = "",
}: FinancialAnalyticsProps) {
  const [tab, setTab] = useState<CategoryId>("growth");
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiRunning, setAiRunning] = useState(false);

  // ── Derived series from history ────────────────────────────────────────────

  const revYears = yearsFrom(history.revenue ?? {});
  const niYears  = yearsFrom(history.net_income ?? {});
  const cfYears  = yearsFrom(history.operating_cf ?? {});
  const asYears  = yearsFrom(history.total_assets ?? {});

  const H = (key: string, years: string[]) => years.map(y => ({ label: y, value: history[key]?.[y] ?? 0 }));
  const Hn = (key: string, years: string[]) => years.map(y => history[key]?.[y] ?? null);

  // Margin % computed from history
  const gMarg = revYears.map(y => {
    const rev = history.revenue?.[y]; const gp = history.gross_profit?.[y];
    return (rev && gp) ? gp/rev*100 : null;
  });
  const oMarg = revYears.map(y => {
    const rev = history.revenue?.[y]; const oi = history.operating_income?.[y];
    return (rev && oi) ? oi/rev*100 : null;
  });
  const nMarg = revYears.map(y => {
    const rev = history.revenue?.[y]; const ni = history.net_income?.[y];
    return (rev && ni) ? ni/rev*100 : null;
  });

  // FCF conversion
  const fcfConv = revYears.map(y => {
    const ni = history.net_income?.[y]; const fcf = history.free_cash_flow?.[y];
    return (ni && ni > 0 && fcf) ? fcf/ni*100 : null;
  });

  // Net debt = LTD - cash
  const netDebt = asYears.map(y => {
    const ltd = history.long_term_debt?.[y] ?? 0;
    const cash = history.cash?.[y] ?? 0;
    return { label: y, value: ltd - cash };
  });

  // OCF vs NI divergence
  const ocfVsNI = cfYears.map(y => {
    const ocf = history.operating_cf?.[y] ?? 0;
    const ni  = history.net_income?.[y] ?? 0;
    return ocf - ni;
  });

  // CapEx intensity
  const capexIntensity = revYears.map(y => {
    const capex = Math.abs(history.capex?.[y] ?? 0);
    const rev   = history.revenue?.[y];
    return (rev && rev > 0) ? capex/rev*100 : null;
  });

  // SBC % revenue
  const sbcPct = revYears.map(y => {
    const sbc = history.sbc_expense?.[y] ?? 0;
    const rev = history.revenue?.[y];
    return (rev && rev > 0) ? sbc/rev*100 : null;
  });

  // Accruals ratio
  const accrualsRatio = revYears.map(y => {
    const ni   = history.net_income?.[y];
    const ocf  = history.operating_cf?.[y];
    const ta   = history.total_assets?.[y];
    return (ni != null && ocf != null && ta && ta > 0) ? (ni - ocf)/ta*100 : null;
  });

  // D/E ratio
  const deRatio = asYears.map(y => {
    const tl  = history.total_liabilities?.[y];
    const eq  = history.equity?.[y];
    return (tl && eq && eq > 0) ? tl/eq : null;
  });

  // Rule of 40
  const r40Points = growthHistory.map(g => ({
    label: g.date?.slice(0,4) ?? "",
    x: g.rev_growth,
    y: g.fcf_growth,
  }));

  // Peer data
  const allPeers = [
    { symbol: ticker, pe: facts.pe_ratio ?? null, ev_ebitda: facts.ev_ebitda ?? null, p_fcf: facts.p_fcf ?? null, roic: facts.roic ?? 0, net_margin: facts.net_margin_pct ?? 0 },
    ...peers,
  ];

  // KM history series
  const kmDates = kmHistory.map(k => k.date?.slice(0,7) ?? "").slice(-8);
  const kmPE    = kmHistory.slice(-8).map(k => k.pe);
  const kmEV    = kmHistory.slice(-8).map(k => k.ev_ebitda);
  const kmROIC  = kmHistory.slice(-8).map(k => k.roic);
  const kmPFCF  = kmHistory.slice(-8).map(k => k.p_fcf);

  // EPS trend
  const epsYears = yearsFrom(history.eps_diluted ?? {});
  const epsVals = epsYears.map(y => ({ label: y, value: history.eps_diluted?.[y] ?? 0 }));

  // OpEx decomposition
  const opexYears = yearsFrom(history.rd_expense ?? history.sga_expense ?? {});
  const rdVals  = opexYears.map(y => history.rd_expense?.[y] ?? 0);
  const sgaVals = opexYears.map(y => history.sga_expense?.[y] ?? 0);
  const sbcVals = opexYears.map(y => history.sbc_expense?.[y] ?? 0);

  // Current ratio history
  const crYears = asYears;
  const crVals = crYears.map(y => {
    const ca = history.current_assets?.[y];
    const cl = history.current_liabilities?.[y];
    return (ca && cl && cl > 0) ? ca/cl : null;
  });

  // Cash position history
  const cashYears = asYears;

  // Buybacks + dividends (shareholder returns)
  const returnYears = yearsFrom(history.buybacks ?? history.dividends_paid ?? {});
  const buybackVals = returnYears.map(y => Math.abs(history.buybacks?.[y] ?? 0));
  const divVals     = returnYears.map(y => Math.abs(history.dividends_paid?.[y] ?? 0));

  // Quarterly vs annual comparison for recent quarter
  const qRevRunRate = (quarterly.revenue ?? 0) * 4;
  const annualRev   = facts.revenue ?? 0;

  // ── AI Analysis ────────────────────────────────────────────────────────────

  async function runAIAnalysis() {
    if (aiRunning) return;
    setAiRunning(true);
    setAiAnalysis("");

    const summary = `
Company: ${companyName} (${ticker}) | Sector: ${sector}
Revenue: ${abbreviate(facts.revenue ?? 0, "$")} | Net Income: ${abbreviate(facts.net_income ?? 0, "$")} | FCF: ${abbreviate(facts.free_cash_flow ?? 0, "$")}
Gross Margin: ${facts.gross_margin_pct?.toFixed(1) ?? "—"}% | Op Margin: ${facts.operating_margin_pct?.toFixed(1) ?? "—"}% | Net Margin: ${facts.net_margin_pct?.toFixed(1) ?? "—"}%
P/E: ${facts.pe_ratio?.toFixed(1) ?? "—"}x | EV/EBITDA: ${facts.ev_ebitda?.toFixed(1) ?? "—"}x | P/FCF: ${facts.p_fcf?.toFixed(1) ?? "—"}x
Market Cap: ${abbreviate(facts.market_cap ?? 0, "$")} | Net Debt: ${abbreviate((facts.long_term_debt ?? 0) - (facts.cash ?? 0), "$")}
ROIC: ${facts.roic?.toFixed(1) ?? "—"}% | ROE: ${(facts.net_income && facts.equity ? facts.net_income/facts.equity*100 : null)?.toFixed(1) ?? "—"}%
Revenue 5Y CAGR: ${(() => {
  const vals = Object.values(history.revenue ?? {});
  if (vals.length < 2) return "—";
  return ((Math.pow(vals[vals.length-1]/vals[0], 1/(vals.length-1)) - 1)*100).toFixed(1);
})()}%
FCF/NI Conversion: ${(facts.free_cash_flow && facts.net_income && facts.net_income > 0) ? (facts.free_cash_flow/facts.net_income*100).toFixed(0) : "—"}%
SBC % Rev: ${(facts.sbc_expense && facts.revenue ? facts.sbc_expense/facts.revenue*100 : null)?.toFixed(1) ?? "—"}%
EPS Trend: ${epsVals.map(e => `${e.label.slice(0,4)}: $${e.value.toFixed(2)}`).join(", ")}
Earnings surprises (last 4): ${earningsSurprises.slice(-4).map(e => `${e.date?.slice(0,7)}: ${e.surprise_pct?.toFixed(1) ?? "?"}%`).join(", ")}
Peers: ${peers.map(p => `${p.symbol}(P/E ${p.pe?.toFixed(1) ?? "—"}x, ROIC ${p.roic?.toFixed(1) ?? "—"}%)`).join(", ")}
`;

    try {
      const r = await fetch("/api/sec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          customPrompt: `You are a senior portfolio manager at a top-tier hedge fund conducting a deep quantitative and qualitative analysis of ${companyName} (${ticker}). Based on the following financial snapshot, produce an institutional-grade analytical commentary covering:

1. **PATTERN RECOGNITION** — Identify 3-5 non-obvious statistical patterns in the data (margin inflection points, FCF quality divergence, EPS quality, operating leverage signals).
2. **QUALITY FLAGS** — Rate earnings quality (accruals, FCF/NI conversion, SBC dilution), balance sheet durability, and capital allocation discipline. Flag any yellow or red signals.
3. **VALUATION CONTEXT** — At current multiples, what is the implied growth rate? Is the stock priced for perfection, value, or distress?
4. **COMPETITIVE MOAT SIGNALS** — Based on margin structure, ROIC, and peer comparison, assess the durability of competitive advantage.
5. **KEY RISK FACTORS** — Identify 3 specific quantitative risk factors that most impact the investment thesis.
6. **ALPHA TRIGGER** — What single catalyst or inflection point would most likely change the investment thesis (positive or negative)?

Be brutally honest. Use specific numbers. Format with bold headers. Target 600-800 words.

DATA:
${summary}`,
        }),
      });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value, { stream: true }).split("\n")) {
          const raw = line.startsWith("data: ") ? line.slice(6).trim() : null;
          if (!raw || raw === "[DONE]") continue;
          try { const j = JSON.parse(raw); if (j.text) setAiAnalysis(p => p + j.text); } catch {}
        }
      }
    } catch (e) {
      setAiAnalysis(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setAiRunning(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-4" style={{ background: "linear-gradient(135deg, #0c1b38 0%, #152a55 100%)" }}>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">Financial Analytics</p>
          <h3 className="text-[15px] font-bold text-white">{companyName} — 30-Chart Institutional Analysis</h3>
          <p className="text-[10.5px] text-white/40 mt-0.5">6 categories · AI pattern detection · Hedge fund grade</p>
        </div>
        <button onClick={runAIAnalysis} disabled={aiRunning}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-bold transition-all shrink-0"
          style={{ background: aiRunning ? "#1e3560" : "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd" }}>
          {aiRunning
            ? <><span className="w-3 h-3 border border-[#60a5fa] border-t-transparent rounded-full animate-spin" /> Analyzing…</>
            : <><Sparkles size={12} /> Deep AI Analysis</>}
        </button>
      </div>

      {/* AI Analysis output */}
      {aiAnalysis && (
        <div className="border-b border-[#1e3560] px-5 py-4" style={{ background: "#071428" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-[#3b82f6]" />
            <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#60a5fa]">AI Hedge Fund Analysis — {ticker}</p>
          </div>
          <div className="prose-custom">
            {aiAnalysis.split("\n").map((line, i) => {
              const t = line.trim();
              if (!t) return <div key={i} className="h-2" />;
              if (t.startsWith("**") && t.endsWith("**") && !t.slice(2,-2).includes("**"))
                return <p key={i} className="text-[9px] font-bold uppercase tracking-widest mt-4 mb-1.5 first:mt-0" style={{ color: "#60a5fa" }}>{t.slice(2,-2)}</p>;
              if (t.startsWith("• ") || t.startsWith("- "))
                return <p key={i} className="text-[11.5px] leading-[1.7] pl-3 border-l border-[#1e3560]" style={{ color: "#cbd5e1" }}>· {t.slice(2)}</p>;
              return <p key={i} className="text-[11.5px] leading-[1.75]" style={{ color: "#cbd5e1" }}>{t}</p>;
            })}
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex overflow-x-auto border-b" style={{ background: "#0a1628", borderColor: DARK_BORDER }}>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = tab === cat.id;
          return (
            <button key={cat.id} onClick={() => setTab(cat.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-all"
              style={{
                borderColor: isActive ? "#3b82f6" : "transparent",
                color: isActive ? "#60a5fa" : "#ffffff40",
                background: isActive ? "rgba(59,130,246,0.08)" : "transparent",
              }}>
              <Icon size={10} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Charts grid */}
      <div className="p-4" style={{ background: "#071428" }}>

        {/* ── Category 1: Revenue & Growth ──────────────────────────── */}
        {tab === "growth" && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">

            <ChartCard title="Revenue — 5-Year Trend" subtitle="Annual | YoY growth labels">
              <BarSVG data={H("revenue", revYears)} color={BLUE} prefix="$" showGrowth />
            </ChartCard>

            <ChartCard title="Gross Profit vs COGS" subtitle="Stacked | revenue decomposition">
              <StackedBarSVG
                labels={revYears}
                series={[
                  { name: "Gross Profit", values: revYears.map(y => history.gross_profit?.[y] ?? 0), color: TEAL },
                  { name: "COGS",         values: revYears.map(y => history.cost_of_revenue?.[y] ?? 0), color: "#1e3560" },
                ]}
                prefix="$"
              />
            </ChartCard>

            <ChartCard title="EPS — Diluted Trend" subtitle="Earnings per share | YoY growth">
              <BarSVG data={epsVals} color={AMBER} prefix="$" showGrowth />
            </ChartCard>

            <ChartCard title="Revenue vs Op Income Growth" subtitle="Comparative YoY % growth">
              <GroupedBarSVG
                groups={revYears.slice(1)}
                series={[
                  { name: "Rev Growth %",  values: revYears.slice(1).map((y,i) => {
                    const prev = revYears[i]; const cur = history.revenue?.[y]; const p = history.revenue?.[prev];
                    return (cur && p && p > 0) ? (cur-p)/p*100 : 0;
                  }), color: BLUE },
                  { name: "Op Inc Growth %", values: revYears.slice(1).map((y,i) => {
                    const prev = revYears[i]; const cur = history.operating_income?.[y]; const p = history.operating_income?.[prev];
                    return (cur && p && p > 0) ? (cur-p)/p*100 : 0;
                  }), color: GREEN },
                ]}
                prefix="%"
              />
            </ChartCard>

            <ChartCard title="OpEx Breakdown" subtitle="R&D + SG&A + SBC stacked">
              <StackedBarSVG
                labels={opexYears}
                series={[
                  { name: "R&D",   values: rdVals,  color: BLUE   },
                  { name: "SG&A",  values: sgaVals, color: TEAL   },
                  { name: "SBC",   values: sbcVals, color: PURPLE },
                ]}
                prefix="$"
              />
            </ChartCard>

            <ChartCard title="Quarterly Run-Rate vs Annual" subtitle="Implied annualized vs last 10-K">
              <BarSVG
                data={[
                  { label: "Annual", value: annualRev },
                  { label: "Q×4",    value: qRevRunRate, highlight: true },
                ]}
                color={BLUE} prefix="$"
              />
            </ChartCard>

          </div>
        )}

        {/* ── Category 2: Profitability ──────────────────────────────── */}
        {tab === "margins" && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">

            <ChartCard title="Margin Evolution" subtitle="Gross / Operating / Net (%)">
              <LineSVG
                labels={revYears}
                series={[
                  { name: "Gross %",  values: gMarg, color: TEAL  },
                  { name: "Op %",     values: oMarg, color: BLUE  },
                  { name: "Net %",    values: nMarg, color: GREEN },
                ]}
                pct
              />
            </ChartCard>

            <ChartCard title="EBITDA Margin" subtitle="EBITDA / Revenue (%)">
              <LineSVG
                labels={revYears}
                series={[{ name: "EBITDA %", values: revYears.map(y => {
                  const eb = history.ebitda?.[y]; const rev = history.revenue?.[y];
                  return (eb && rev && rev > 0) ? eb/rev*100 : null;
                }), color: AMBER }]}
                pct
              />
            </ChartCard>

            <ChartCard title="Net Income — Absolute" subtitle="Net income | 5Y trend with YoY">
              <BarSVG data={H("net_income", niYears)} color={GREEN} prefix="$" showGrowth />
            </ChartCard>

            <ChartCard title="Operating Leverage" subtitle="Op income growth vs revenue growth">
              <GroupedBarSVG
                groups={revYears.slice(1)}
                series={[
                  { name: "Revenue %",  values: revYears.slice(1).map((y,i) => {
                    const p = revYears[i]; const c = history.revenue?.[y]; const pr = history.revenue?.[p];
                    return (c && pr && pr > 0) ? (c-pr)/pr*100 : 0;
                  }), color: BLUE },
                  { name: "EBITDA %",   values: revYears.slice(1).map((y,i) => {
                    const p = revYears[i]; const c = history.ebitda?.[y]; const pr = history.ebitda?.[p];
                    return (c && pr && pr > 0) ? (c-pr)/pr*100 : 0;
                  }), color: AMBER },
                ]}
                prefix="%"
              />
            </ChartCard>

            <ChartCard title="Effective Tax Rate" subtitle="Income tax / pre-tax income (%)">
              <LineSVG
                labels={revYears}
                series={[{ name: "Tax Rate %", values: revYears.map(y => {
                  const tx = history.income_tax?.[y]; const pt = history.pretax_income?.[y];
                  return (tx && pt && pt > 0) ? tx/pt*100 : null;
                }), color: RED }]}
                pct
              />
            </ChartCard>

            <ChartCard title="Shareholder Returns" subtitle="Buybacks + dividends">
              <GroupedBarSVG
                groups={returnYears}
                series={[
                  { name: "Buybacks",  values: buybackVals, color: BLUE   },
                  { name: "Dividends", values: divVals,     color: PURPLE },
                ]}
                prefix="$"
              />
            </ChartCard>

          </div>
        )}

        {/* ── Category 3: Cash Flow ─────────────────────────────────── */}
        {tab === "cashflow" && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">

            <ChartCard title="OCF vs CapEx" subtitle="Operating cash flow vs capital expenditure">
              <GroupedBarSVG
                groups={cfYears}
                series={[
                  { name: "OCF",   values: cfYears.map(y => history.operating_cf?.[y] ?? 0), color: GREEN },
                  { name: "CapEx", values: cfYears.map(y => Math.abs(history.capex?.[y] ?? 0)), color: RED },
                ]}
                prefix="$"
              />
            </ChartCard>

            <ChartCard title="Free Cash Flow" subtitle="FCF | YoY growth">
              <BarSVG data={H("free_cash_flow", cfYears)} color={TEAL} prefix="$" showGrowth />
            </ChartCard>

            <ChartCard title="FCF Margin %" subtitle="Free cash flow / revenue">
              <LineSVG
                labels={revYears}
                series={[{ name: "FCF Margin", values: revYears.map(y => {
                  const fcf = history.free_cash_flow?.[y]; const rev = history.revenue?.[y];
                  return (fcf != null && rev && rev > 0) ? fcf/rev*100 : null;
                }), color: TEAL }]}
                pct
              />
            </ChartCard>

            <ChartCard title="FCF Conversion" subtitle="FCF / Net Income — earnings quality">
              <LineSVG
                labels={revYears}
                series={[{ name: "FCF/NI %", values: fcfConv, color: GREEN }]}
                pct
              />
            </ChartCard>

            <ChartCard title="OCF vs Net Income" subtitle="Cash earnings premium / discount">
              <BarSVG
                data={cfYears.map((y,i) => ({ label: y, value: ocfVsNI[i] ?? 0 }))}
                color={BLUE} prefix="$" negativeRed
              />
            </ChartCard>

            <ChartCard title="CapEx Intensity" subtitle="Capital expenditure / revenue (%)">
              <LineSVG
                labels={revYears}
                series={[{ name: "CapEx %", values: capexIntensity, color: ORANGE }]}
                pct
              />
            </ChartCard>

          </div>
        )}

        {/* ── Category 4: Balance Sheet ─────────────────────────────── */}
        {tab === "balance" && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">

            <ChartCard title="Net Debt Evolution" subtitle="Long-term debt minus cash">
              <BarSVG data={netDebt} color={RED} prefix="$" negativeRed={false} />
            </ChartCard>

            <ChartCard title="Cash vs Long-Term Debt" subtitle="Liquidity vs leverage">
              <GroupedBarSVG
                groups={cashYears}
                series={[
                  { name: "Cash",  values: cashYears.map(y => history.cash?.[y] ?? 0),           color: GREEN },
                  { name: "LT Debt", values: cashYears.map(y => history.long_term_debt?.[y] ?? 0), color: RED },
                ]}
                prefix="$"
              />
            </ChartCard>

            <ChartCard title="Total Assets Growth" subtitle="Asset base expansion">
              <BarSVG data={H("total_assets", asYears)} color={BLUE} prefix="$" showGrowth />
            </ChartCard>

            <ChartCard title="Debt / Equity Ratio" subtitle="Financial leverage trend">
              <LineSVG
                labels={asYears}
                series={[{ name: "D/E", values: deRatio, color: RED }]}
              />
            </ChartCard>

            <ChartCard title="Current Ratio" subtitle="Short-term liquidity coverage">
              <LineSVG
                labels={crYears}
                series={[{ name: "Current Ratio", values: crVals, color: TEAL }]}
              />
            </ChartCard>

            <ChartCard title="Equity & Retained Earnings" subtitle="Book value expansion">
              <GroupedBarSVG
                groups={asYears}
                series={[
                  { name: "Equity",    values: asYears.map(y => history.equity?.[y] ?? 0),            color: BLUE   },
                  { name: "Retained E", values: asYears.map(y => history.retained_earnings?.[y] ?? 0), color: PURPLE },
                ]}
                prefix="$"
              />
            </ChartCard>

          </div>
        )}

        {/* ── Category 5: Valuation Multiples ───────────────────────── */}
        {tab === "multiples" && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">

            <ChartCard title="P/E Multiple History" subtitle="Price / Earnings — trailing 8 periods">
              <LineSVG
                labels={kmDates}
                series={[{ name: "P/E", values: kmPE, color: BLUE }]}
              />
            </ChartCard>

            <ChartCard title="EV/EBITDA History" subtitle="Enterprise value multiple trend">
              <LineSVG
                labels={kmDates}
                series={[{ name: "EV/EBITDA", values: kmEV, color: AMBER }]}
              />
            </ChartCard>

            <ChartCard title="P/FCF History" subtitle="Price to free cash flow multiple">
              <LineSVG
                labels={kmDates}
                series={[{ name: "P/FCF", values: kmPFCF, color: TEAL }]}
              />
            </ChartCard>

            <ChartCard title="ROIC History" subtitle="Return on invested capital (%)">
              <LineSVG
                labels={kmDates}
                series={[{ name: "ROIC %", values: kmROIC, color: GREEN }]}
                pct
              />
            </ChartCard>

            <ChartCard title="EPS Surprise History" subtitle="Actual vs estimate — beat/miss">
              <BeatMissSVG data={earningsSurprises} />
            </ChartCard>

            <ChartCard title="Multiples vs Peers — P/E" subtitle="Subject vs peers current P/E">
              <HBarSVG
                data={allPeers.filter(p => p.pe != null).map(p => ({
                  label: p.symbol, value: p.pe!, highlight: p.symbol === ticker,
                })).sort((a,b) => b.value - a.value)}
                color={BLUE} suffix="x"
              />
            </ChartCard>

          </div>
        )}

        {/* ── Category 6: Quality & Peers ───────────────────────────── */}
        {tab === "quality" && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">

            <ChartCard title="Accruals Ratio" subtitle="(NI − OCF) / Assets — earnings quality">
              <LineSVG
                labels={revYears}
                series={[{ name: "Accruals %", values: accrualsRatio, color: AMBER }]}
                pct
              />
            </ChartCard>

            <ChartCard title="SBC % of Revenue" subtitle="Stock-based compensation dilution">
              <LineSVG
                labels={revYears}
                series={[{ name: "SBC %", values: sbcPct, color: PINK }]}
                pct
              />
            </ChartCard>

            <ChartCard title="D&A Trend" subtitle="Depreciation & amortization growth">
              <BarSVG data={H("da_expense", revYears)} color={PURPLE} prefix="$" showGrowth />
            </ChartCard>

            <ChartCard title="Peer ROIC Comparison" subtitle="Return on invested capital vs peers">
              <HBarSVG
                data={allPeers.map(p => ({
                  label: p.symbol, value: p.roic ?? 0, highlight: p.symbol === ticker,
                })).sort((a,b) => b.value - a.value)}
                color={GREEN} suffix="%"
              />
            </ChartCard>

            <ChartCard title="Peer Net Margin" subtitle="Profitability vs peer group">
              <HBarSVG
                data={allPeers.map(p => ({
                  label: p.symbol, value: p.net_margin ?? 0, highlight: p.symbol === ticker,
                })).sort((a,b) => b.value - a.value)}
                color={TEAL} suffix="%"
              />
            </ChartCard>

            <ChartCard title="Revenue vs FCF Growth" subtitle="Growth quality scatter — peer group">
              {growthHistory.length >= 2 ? (
                <ScatterSVG
                  points={growthHistory.slice(-6).map(g => ({
                    label: g.date?.slice(0,4) ?? "",
                    x: g.rev_growth,
                    y: g.fcf_growth,
                  }))}
                  xLabel="Rev Growth %" yLabel="FCF Growth %"
                />
              ) : (
                <div className="text-center py-6">
                  <p className="text-[10px]" style={{ color: "#ffffff30" }}>Growth history not available</p>
                </div>
              )}
            </ChartCard>

          </div>
        )}

      </div>
    </div>
  );
}
