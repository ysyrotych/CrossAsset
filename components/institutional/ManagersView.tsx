"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { Search, ArrowUpRight, Sparkles } from "lucide-react";
import type { ManagerListItem, ManagerView, HoldingRow, HoldingAction } from "@/lib/institutional/types";
import {
  fmtMoney, fmtShares, fmtPct, ACTION_META, ActionBadge, ConvictionMeter,
  StatCard, CountMoney, CountNum, StalenessChip, initials,
} from "./shared";

export default function ManagersView({
  managers, selected, onSelect, onPickTicker,
}: {
  managers: ManagerListItem[];
  selected: string | null;
  onSelect: (slug: string) => void;
  onPickTicker: (ticker: string) => void;
}) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<ManagerView | null>(null);
  const [loading, setLoading] = useState(false);

  const slug = selected ?? managers[0]?.slug ?? null;

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/institutional/manager/${slug}`)
      .then((r) => r.json())
      .then((d) => setView(d.error ? null : d))
      .finally(() => setLoading(false));
  }, [slug]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return managers.filter((m) => m.name.toLowerCase().includes(s) || (m.manager ?? "").toLowerCase().includes(s));
  }, [managers, q]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* ── manager list ── */}
      <div className="inst-fade-up">
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ca-text-3)" }} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search funds…"
            className="w-full pl-8 pr-3 py-2 rounded-lg text-[12.5px] focus:outline-none"
            style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)", color: "var(--ca-text)" }}
          />
        </div>
        <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {filtered.map((m) => {
            const active = m.slug === slug;
            return (
              <button key={m.slug} onClick={() => onSelect(m.slug)}
                className="w-full text-left px-3 py-2.5 rounded-lg inst-row-hover flex items-center gap-3"
                style={{ background: active ? "var(--ca-surface)" : "transparent", border: `1px solid ${active ? "var(--ca-accent)" : "transparent"}` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ background: active ? "var(--ca-accent)" : "var(--ca-surface-2)", color: active ? "#fff" : "var(--ca-text-2)" }}>
                  {initials(m.manager ?? m.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold truncate" style={{ color: "var(--ca-text)" }}>{m.manager ?? m.name}</p>
                  <p className="text-[10.5px] truncate" style={{ color: "var(--ca-text-3)" }}>{m.name} · {fmtMoney(m.aum13f)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── manager detail ── */}
      <div>
        {loading && !view ? <DetailSkeleton /> : view ? (
          <ManagerDetail view={view} onPickTicker={onPickTicker} />
        ) : (
          <p className="text-[13px]" style={{ color: "var(--ca-text-3)" }}>Select a fund.</p>
        )}
      </div>
    </div>
  );
}

type SortKey = "rank" | "value" | "pctOfBook" | "convictionScore" | "dShares" | "priceChangeSincePeriodEnd";

function ManagerDetail({ view, onPickTicker }: { view: ManagerView; onPickTicker: (t: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    const rows = [...view.holdings];
    rows.sort((a, b) => {
      const av = (a[sortKey] ?? 0) as number, bv = (b[sortKey] ?? 0) as number;
      return asc ? av - bv : bv - av;
    });
    return rows;
  }, [view.holdings, sortKey, asc]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setAsc((v) => !v);
    else { setSortKey(k); setAsc(k === "rank"); }
  }

  const treemapData = view.holdings
    .filter((h) => h.putCall === "NONE")
    .slice(0, 20)
    .map((h) => ({ name: h.ticker ?? h.issuer, size: h.value, action: h.action, pct: h.pctOfBook }));

  return (
    <div key={view.manager.slug} className="inst-fade-up">
      {/* header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h2 className="text-[26px] font-light tracking-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>
              {view.manager.manager}
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded"
              style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-2)" }}>{view.manager.type.replace("_", " ")}</span>
          </div>
          <p className="text-[12.5px]" style={{ color: "var(--ca-text-3)" }}>{view.manager.name} · CIK {view.manager.cik}</p>
        </div>
        <StalenessChip days={view.stalenessDays} period={view.period} />
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="13F Book Value"><CountMoney value={view.totalValue} /></StatCard>
        <StatCard label="Positions"><CountNum value={view.holdingsCount} /></StatCard>
        <StatCard label="Top-10 Weight"><CountNum value={view.top10Weight} dp={0} suffix="%" /></StatCard>
        <StatCard label="Turnover"><CountNum value={view.turnoverPct} dp={0} suffix="%" /></StatCard>
      </div>

      {/* quarter activity breakdown */}
      <ActivityBar holdings={view.holdings} top10Weight={view.top10Weight} />

      {/* new high-conviction strip */}
      {view.newHighConviction.length > 0 && (
        <div className="rounded-xl px-4 py-3 mb-5 inst-scale-in" style={{ background: "linear-gradient(90deg, #eff6ff, #f0fdf4)", border: "1px solid #dbeafe" }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={13} style={{ color: "#0369a1" }} />
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "#0369a1" }}>New high-conviction initiations</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {view.newHighConviction.map((h) => (
              <button key={h.ticker} onClick={() => h.ticker && onPickTicker(h.ticker)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg inst-card-hover"
                style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
                <span className="text-[12px] font-bold" style={{ color: "var(--ca-text)" }}>{h.ticker}</span>
                <span className="text-[11px]" style={{ color: "var(--ca-text-3)" }}>{fmtMoney(h.value)}</span>
                <span className="text-[10px] font-semibold" style={{ color: "#147a4f" }}>{h.convictionScore}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* treemap */}
      <div className="rounded-xl p-4 mb-5" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: "var(--ca-text-3)" }}>Position Sizing — click a tile to inspect</p>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <Treemap data={treemapData} dataKey="size" nameKey="name" stroke="#fff" isAnimationActive
              content={<TreeCell onPick={onPickTicker} />}>
              <Tooltip content={<TreeTip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      </div>

      {/* holdings table */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
        <table className="w-full">
          <thead>
            <tr className="text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--ca-text-3)" }}>
              <Th label="#" k="rank" cur={sortKey} asc={asc} onSort={toggleSort} align="left" pad="px-4" />
              <th className="text-left px-2 py-3">Holding</th>
              <Th label="Value" k="value" cur={sortKey} asc={asc} onSort={toggleSort} align="right" />
              <Th label="% Book" k="pctOfBook" cur={sortKey} asc={asc} onSort={toggleSort} align="right" />
              <th className="text-center px-2 py-3">Change</th>
              <Th label="Δ Shares" k="dShares" cur={sortKey} asc={asc} onSort={toggleSort} align="right" />
              <Th label="Conviction" k="convictionScore" cur={sortKey} asc={asc} onSort={toggleSort} align="left" />
              <Th label="Since Q-End" k="priceChangeSincePeriodEnd" cur={sortKey} asc={asc} onSort={toggleSort} align="right" pad="px-4" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((h, i) => <HoldingRowEl key={`${h.ticker}-${h.putCall}-${i}`} h={h} i={i} onPick={onPickTicker} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ label, k, cur, asc, onSort, align, pad = "px-2" }: {
  label: string; k: SortKey; cur: SortKey; asc: boolean; onSort: (k: SortKey) => void;
  align: "left" | "right"; pad?: string;
}) {
  const active = cur === k;
  return (
    <th className={`${pad} py-3 ${align === "right" ? "text-right" : "text-left"} cursor-pointer select-none`} onClick={() => onSort(k)}>
      <span className="inline-flex items-center gap-1 hover:opacity-100 transition-opacity" style={{ opacity: active ? 1 : 0.7, color: active ? "var(--ca-accent)" : undefined }}>
        {label}<span className="text-[8px]">{active ? (asc ? "▲" : "▼") : "↕"}</span>
      </span>
    </th>
  );
}

function HoldingRowEl({ h, i, onPick }: { h: HoldingRow; i: number; onPick: (t: string) => void }) {
  const move = h.priceChangeSincePeriodEnd;
  return (
    <tr className="inst-row-hover border-t hover:bg-[var(--ca-surface-2)] cursor-pointer group"
      style={{ borderColor: "var(--ca-border)" }}
      onClick={() => h.ticker && h.putCall === "NONE" && onPick(h.ticker)}>
      <td className="px-4 py-2.5 text-[11px] tabular-nums" style={{ color: "var(--ca-text-3)" }}>{h.rank}</td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-bold" style={{ color: "var(--ca-text)" }}>{h.ticker ?? "—"}</span>
          {h.putCall !== "NONE" && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#fef2f2", color: "#b42318" }}>{h.putCall}</span>
          )}
          <span className="text-[10.5px] truncate max-w-[160px]" style={{ color: "var(--ca-text-3)" }}>{h.issuer}</span>
          {h.putCall === "NONE" && <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--ca-text-3)" }} />}
        </div>
      </td>
      <td className="px-2 py-2.5 text-right text-[12px] tabular-nums" style={{ color: "var(--ca-text)" }}>{fmtMoney(h.value)}</td>
      <td className="px-2 py-2.5 text-right text-[12px] tabular-nums" style={{ color: "var(--ca-text-2)" }}>{h.pctOfBook.toFixed(1)}%</td>
      <td className="px-2 py-2.5 text-center"><ActionBadge action={h.action} /></td>
      <td className="px-2 py-2.5 text-right text-[11.5px] tabular-nums"
        style={{ color: h.dShares > 0 ? "#147a4f" : h.dShares < 0 ? "#b42318" : "var(--ca-text-3)" }}>
        {h.dShares === 0 ? "—" : `${h.dShares > 0 ? "+" : ""}${fmtShares(h.dShares)}`}
      </td>
      <td className="px-2 py-2.5"><ConvictionMeter score={h.convictionScore} delay={i * 25} /></td>
      <td className="px-4 py-2.5 text-right text-[11.5px] tabular-nums"
        style={{ color: move == null ? "var(--ca-text-3)" : move >= 0 ? "#147a4f" : "#b42318" }}>
        {move == null ? "—" : fmtPct(move)}
      </td>
    </tr>
  );
}

// ── quarter activity + concentration ────────────────────────────────────────
function ActivityBar({ holdings, top10Weight }: { holdings: HoldingRow[]; top10Weight: number }) {
  const counts = holdings.reduce((acc, h) => { acc[h.action] = (acc[h.action] ?? 0) + 1; return acc; },
    {} as Record<string, number>);
  const order: (keyof typeof ACTION_META)[] = ["NEW", "ADD", "HOLD", "TRIM", "EXIT"];
  return (
    <div className="flex items-center gap-5 mb-5 px-4 py-3 rounded-xl" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="flex items-center gap-3">
        {order.filter((a) => counts[a]).map((a) => {
          const m = ACTION_META[a];
          return (
            <div key={a} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: m.dot }} />
              <span className="text-[11.5px] font-semibold tabular-nums" style={{ color: "var(--ca-text)" }}>{counts[a]}</span>
              <span className="text-[10.5px]" style={{ color: "var(--ca-text-3)" }}>{m.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex-1 flex items-center gap-2.5 min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wide shrink-0" style={{ color: "var(--ca-text-3)" }}>Concentration</span>
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--ca-surface-2)" }}>
          <div className="h-full rounded-full inst-meter-fill" style={{ width: `${top10Weight}%`, background: "var(--ca-accent)" }} />
        </div>
        <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color: "var(--ca-text)" }}>{top10Weight.toFixed(0)}% in top 10</span>
      </div>
    </div>
  );
}

// ── treemap cell + tooltip ──────────────────────────────────────────────────
type TreeCellProps = {
  x?: number; y?: number; width?: number; height?: number;
  name?: string; action?: HoldingAction; onPick?: (t: string) => void;
};
function TreeCell({ x = 0, y = 0, width = 0, height = 0, name, action, onPick }: TreeCellProps) {
  if (width < 2 || height < 2) return null;
  const m = ACTION_META[action ?? "HOLD"] ?? ACTION_META.HOLD;
  const show = width > 44 && height > 24;
  return (
    <g onClick={() => name && onPick?.(name)} style={{ cursor: "pointer" }}>
      <rect x={x} y={y} width={width} height={height} rx={3}
        style={{ fill: m.bg, stroke: "#fff", strokeWidth: 2 }} />
      {show && name && (
        <text x={x + 6} y={y + 16} fontSize={11} fontWeight={700} fill={m.fg}>{name}</text>
      )}
    </g>
  );
}
type TreeTipProps = { active?: boolean; payload?: { payload: { name: string; size: number; pct: number } }[] };
function TreeTip({ active, payload }: TreeTipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: "#0c1b38", color: "#fff" }}>
      <p className="font-bold">{d.name}</p>
      <p>{fmtMoney(d.size)} · {d.pct.toFixed(1)}% of book</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-64 rounded inst-skeleton" />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl inst-skeleton" />)}
      </div>
      <div className="h-60 rounded-xl inst-skeleton" />
    </div>
  );
}
