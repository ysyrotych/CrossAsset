"use client";

import { useEffect, useState } from "react";
import { Flame, Snowflake } from "lucide-react";
import type { ConsensusRow } from "@/lib/institutional/types";
import { fmtMoney } from "./shared";
import AskPanel from "./AskPanel";

type Filter = "all" | "buy" | "sell";

export default function ConsensusView({ onPickTicker }: { onPickTicker: (t: string) => void }) {
  const [rows, setRows] = useState<ConsensusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetch("/api/institutional/consensus?limit=60")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="grid grid-cols-2 gap-4"><div className="h-96 rounded-xl inst-skeleton" /><div className="h-96 rounded-xl inst-skeleton" /></div>;

  const buys = rows.filter((r) => r.consensusScore > 0).sort((a, b) => b.consensusScore - a.consensusScore).slice(0, 14);
  const sells = rows.filter((r) => r.consensusScore < 0).sort((a, b) => a.consensusScore - b.consensusScore).slice(0, 12);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.consensusScore)));
  const topBuy = buys[0];
  const totalNewMoney = rows.reduce((s, r) => s + (r.newMoney ?? 0), 0);
  const crowded = rows.filter((r) => r.buyers + r.sellers >= 4).length;

  const showBuys = filter !== "sell";
  const showSells = filter !== "buy";

  return (
    <div className="inst-fade-up">
      <AskPanel />

      {/* headline */}
      {topBuy && (
        <div className="rounded-xl px-6 py-5 mb-6 inst-aurora inst-scale-in" style={{ color: "#fff" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>Strongest smart-money consensus this quarter</p>
          <div className="flex items-baseline gap-3">
            <span className="text-[40px] font-light leading-none" style={{ fontFamily: "var(--font-serif)" }}>{topBuy.ticker}</span>
            <span className="text-[15px]" style={{ color: "rgba(255,255,255,0.75)" }}>{topBuy.issuer}</span>
          </div>
          <p className="text-[13px] mt-2" style={{ color: "rgba(255,255,255,0.85)" }}>
            <b>{topBuy.buyers} tracked funds</b> accumulating{topBuy.newMoney > 0 && <> · <b>{fmtMoney(topBuy.newMoney)}</b> in fresh initiations</>}
            {topBuy.topBuyers && topBuy.topBuyers.length > 0 && <> · led by {topBuy.topBuyers.slice(0, 3).join(", ")}</>}
          </p>
        </div>
      )}

      {/* filter + summary bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex rounded-lg p-0.5" style={{ background: "var(--ca-surface-2)" }}>
          {(["all", "buy", "sell"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3.5 py-1.5 rounded-md text-[11.5px] font-semibold capitalize transition-colors"
              style={{ background: filter === f ? "var(--ca-surface)" : "transparent",
                color: filter === f ? "var(--ca-text)" : "var(--ca-text-3)",
                boxShadow: filter === f ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
              {f === "all" ? "All" : f === "buy" ? "Buying" : "Selling"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-[11.5px]" style={{ color: "var(--ca-text-3)" }}>
          <span><b style={{ color: "var(--ca-text-2)" }}>{fmtMoney(totalNewMoney)}</b> fresh initiations</span>
          <span className="flex items-center gap-1"><Flame size={12} style={{ color: "#f59e0b" }} /> <b style={{ color: "var(--ca-text-2)" }}>{crowded}</b> crowded names</span>
        </div>
      </div>

      <div className={showBuys && showSells ? "grid grid-cols-2 gap-5" : ""}>
        {showBuys && <HeatColumn title="Most Bought" icon={<Flame size={14} />} tone="green" rows={buys} maxAbs={maxAbs} onPick={onPickTicker} />}
        {showSells && <HeatColumn title="Most Dumped" icon={<Snowflake size={14} />} tone="red" rows={sells} maxAbs={maxAbs} onPick={onPickTicker} />}
      </div>
    </div>
  );
}

function HeatColumn({ title, icon, tone, rows, maxAbs, onPick }: {
  title: string; icon: React.ReactNode; tone: "green" | "red"; rows: ConsensusRow[]; maxAbs: number; onPick: (t: string) => void;
}) {
  const fg = tone === "green" ? "#147a4f" : "#b42318";
  const barBg = tone === "green" ? "#22c55e" : "#ef4444";
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: fg }}>{icon}</span>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: fg }}>{title}</p>
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => {
          const w = (Math.abs(r.consensusScore) / maxAbs) * 100;
          return (
            <button key={r.ticker} onClick={() => onPick(r.ticker)}
              className="w-full relative rounded-lg overflow-hidden inst-row-hover inst-card-hover text-left"
              style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
              <div className="absolute inset-y-0 left-0 inst-meter-fill" style={{ width: `${w}%`, background: `${barBg}14`, animationDelay: `${i * 40}ms` }} />
              <div className="relative flex items-center gap-3 px-3.5 py-2.5">
                <span className="text-[13px] font-bold w-14 shrink-0" style={{ color: "var(--ca-text)" }}>{r.ticker}</span>
                {r.buyers + r.sellers >= 4 && (
                  <span title="Crowded — held by many tracked funds" className="shrink-0"><Flame size={11} style={{ color: "#f59e0b" }} /></span>
                )}
                <span className="text-[11px] truncate flex-1" style={{ color: "var(--ca-text-3)" }}>{r.issuer}</span>
                {r.newMoney > 0 && (
                  <span className="text-[10px] font-medium tabular-nums" style={{ color: "#0369a1" }} title="Fresh initiation dollars">+{fmtMoney(r.newMoney)}</span>
                )}
                <span className="text-[10.5px] tabular-nums" style={{ color: "var(--ca-text-2)" }}>
                  {r.buyers}▲ {r.sellers}▼
                </span>
                <span className="text-[12px] font-bold tabular-nums w-12 text-right" style={{ color: fg }}>
                  {r.consensusScore > 0 ? "+" : ""}{Math.round(r.consensusScore)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
