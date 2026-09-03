"use client";

import { useEffect, useState } from "react";
import { Search, TrendingUp, TrendingDown, Users } from "lucide-react";
import type { SecurityView as SV, HolderRow, InsiderTxn } from "@/lib/institutional/types";
import { fmtMoney, fmtShares, ActionBadge, StatCard, CountMoney, CountNum, StalenessChip } from "./shared";

const SIGNAL: Record<SV["signalAlignment"], { label: string; sub: string; fg: string; bg: string }> = {
  ALIGNED_BULLISH: { label: "Aligned Bullish", sub: "Institutions accumulating + insiders buying", fg: "#147a4f", bg: "#f0fdf4" },
  ALIGNED_BEARISH: { label: "Aligned Bearish", sub: "Institutions distributing + insiders selling", fg: "#b42318", bg: "#fef2f2" },
  DIVERGENT:       { label: "Divergent Signal", sub: "Smart money and insiders disagree", fg: "#b7791f", bg: "#fffbeb" },
  NEUTRAL:         { label: "Neutral", sub: "No decisive institutional or insider bias", fg: "#6b7280", bg: "#f3f4f6" },
};

export default function SecurityView({ ticker, onPickManager }: { ticker: string | null; onPickManager: (slug: string) => void }) {
  const [input, setInput] = useState(ticker ?? "");
  const [active, setActive] = useState(ticker ?? "AAPL");
  const [view, setView] = useState<SV | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (ticker) { setActive(ticker); setInput(ticker); } }, [ticker]);

  useEffect(() => {
    if (!active) return;
    setLoading(true); setErr(null);
    fetch(`/api/institutional/security/${active}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) { setErr(d.error); setView(null); } else setView(d); })
      .finally(() => setLoading(false));
  }, [active]);

  return (
    <div className="inst-fade-up">
      <form onSubmit={(e) => { e.preventDefault(); setActive(input.trim().toUpperCase()); }} className="relative mb-6 max-w-md">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ca-text-3)" }} />
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter ticker (AAPL, NVDA, META…)"
          className="w-full pl-10 pr-4 py-3 rounded-xl text-[14px] font-medium focus:outline-none uppercase"
          style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)", color: "var(--ca-text)" }} />
      </form>

      {loading && !view ? <div className="h-40 rounded-xl inst-skeleton" /> :
       err ? <p className="text-[13px]" style={{ color: "var(--ca-text-3)" }}>No institutional holders found for {active} among tracked funds.</p> :
       view ? (
        <div key={view.ticker}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-[30px] font-light tracking-tight" style={{ fontFamily: "var(--font-serif)", color: "var(--ca-text)" }}>{view.ticker}</h2>
                <span className="text-[13px]" style={{ color: "var(--ca-text-3)" }}>{view.issuer}</span>
              </div>
            </div>
            <StalenessChip days={view.stalenessDays} period={view.period} />
          </div>

          {/* signal alignment — the wow feature */}
          <SignalGauge view={view} />

          <div className="grid grid-cols-4 gap-3 my-5">
            <StatCard label="Tracked Holders"><CountNum value={view.holderCount} /></StatCard>
            <StatCard label="Aggregate 13F Value"><CountMoney value={view.aggregateInstValue} /></StatCard>
            <StatCard label="Net Manager Flow" accent={view.netManagerFlow !== 0}>
              <span style={{ color: view.netManagerFlow > 0 ? "#147a4f" : view.netManagerFlow < 0 ? "#b42318" : "var(--ca-text)" }}>
                {view.netManagerFlow > 0 ? "+" : ""}{view.netManagerFlow}
              </span>
            </StatCard>
            <StatCard label="Net Share Flow">
              <span style={{ color: view.netShareFlow > 0 ? "#147a4f" : view.netShareFlow < 0 ? "#b42318" : "var(--ca-text)" }}>
                {view.netShareFlow > 0 ? "+" : ""}{fmtShares(view.netShareFlow)}
              </span>
            </StatCard>
          </div>

          {/* accumulators vs distributors */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <HolderColumn title="Accumulators" icon={<TrendingUp size={13} />} rows={view.accumulators} tone="green" onPick={onPickManager} />
            <HolderColumn title="Distributors" icon={<TrendingDown size={13} />} rows={view.distributors} tone="red" onPick={onPickManager} />
          </div>

          {/* insider overlay */}
          <InsiderTimeline txns={view.insiderOverlay} />
        </div>
      ) : null}
    </div>
  );
}

function SignalGauge({ view }: { view: SV }) {
  const s = SIGNAL[view.signalAlignment];
  const buyers = view.accumulators.length;
  const sellers = view.distributors.length;
  const total = Math.max(1, buyers + sellers);
  const buyPct = (buyers / total) * 100;
  return (
    <div className="rounded-xl p-5 inst-scale-in" style={{ background: s.bg, border: `1px solid ${s.fg}22` }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: s.fg }}>13F × Insider Signal</p>
          <p className="text-[20px] font-semibold" style={{ color: s.fg }}>{s.label}</p>
          <p className="text-[11.5px] mt-0.5" style={{ color: "var(--ca-text-2)" }}>{s.sub}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px]" style={{ color: "var(--ca-text-3)" }}>Institutional lean</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[13px] font-bold tabular-nums" style={{ color: "#147a4f" }}>{buyers} buy</span>
            <span style={{ color: "var(--ca-text-3)" }}>/</span>
            <span className="text-[13px] font-bold tabular-nums" style={{ color: "#b42318" }}>{sellers} sell</span>
          </div>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex" style={{ background: "#fee2e2" }}>
        <div className="h-full inst-meter-fill" style={{ width: `${buyPct}%`, background: "#22c55e" }} />
      </div>
    </div>
  );
}

function HolderColumn({ title, icon, rows, tone, onPick }: { title: string; icon: React.ReactNode; rows: HolderRow[]; tone: "green" | "red"; onPick: (slug: string) => void }) {
  const fg = tone === "green" ? "#147a4f" : "#b42318";
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--ca-border)" }}>
        <span style={{ color: fg }}>{icon}</span>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: fg }}>{title}</p>
        <span className="ml-auto text-[11px]" style={{ color: "var(--ca-text-3)" }}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-center" style={{ color: "var(--ca-text-3)" }}>None this quarter</p>
      ) : rows.map((r) => (
        <button key={r.slug} onClick={() => onPick(r.slug)}
          className="w-full flex items-center justify-between px-4 py-2.5 inst-row-hover hover:bg-[var(--ca-surface-2)] border-t text-left"
          style={{ borderColor: "var(--ca-border)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <Users size={12} style={{ color: "var(--ca-text-3)" }} />
            <span className="text-[12.5px] font-medium truncate" style={{ color: "var(--ca-text)" }}>{r.manager}</span>
            <ActionBadge action={r.action} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded" style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-3)" }}
              title="Weight of this name in the fund's book">{r.pctOfBook.toFixed(1)}% book</span>
            <span className="text-[11.5px] tabular-nums" style={{ color: fg }}>
              {r.dValue >= 0 ? "+" : ""}{fmtMoney(r.dValue)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function InsiderTimeline({ txns }: { txns: InsiderTxn[] }) {
  const open = txns.filter((t) => t.isOpenMarket);
  const buyVal = open.filter((t) => t.code === "P").reduce((s, t) => s + t.value, 0);
  const sellVal = open.filter((t) => t.code === "S").reduce((s, t) => s + t.value, 0);
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--ca-border)" }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--ca-text-2)" }}>Insider Activity — Form 4 (real-time)</p>
        {open.length > 0 && (
          <span className="text-[10.5px] tabular-nums px-2 py-0.5 rounded-full ml-2"
            style={{ background: buyVal >= sellVal ? "#f0fdf4" : "#fef2f2", color: buyVal >= sellVal ? "#147a4f" : "#b42318" }}>
            net {buyVal - sellVal >= 0 ? "+" : "−"}{fmtMoney(Math.abs(buyVal - sellVal))}
          </span>
        )}
        <span className="ml-auto text-[10px]" style={{ color: "var(--ca-text-3)" }}>open-market P/S only</span>
      </div>
      {open.length === 0 ? (
        <p className="px-4 py-6 text-[12px] text-center" style={{ color: "var(--ca-text-3)" }}>No recent open-market insider transactions.</p>
      ) : open.map((t, i) => {
        const buy = t.code === "P";
        return (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-t" style={{ borderColor: "var(--ca-border)" }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: buy ? "#22c55e" : "#ef4444" }} />
            <span className="text-[12.5px] font-medium" style={{ color: "var(--ca-text)" }}>{t.insiderName}</span>
            <span className="text-[10.5px] px-1.5 py-0.5 rounded" style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-3)" }}>{t.role}</span>
            <span className="text-[11.5px] font-bold" style={{ color: buy ? "#147a4f" : "#b42318" }}>{buy ? "BUY" : "SELL"}</span>
            <span className="text-[11.5px] tabular-nums" style={{ color: "var(--ca-text-2)" }}>{fmtShares(t.shares)} @ ${t.price.toFixed(1)}</span>
            <span className="ml-auto text-[11px] tabular-nums" style={{ color: "var(--ca-text-3)" }}>{fmtMoney(t.value)} · {t.txnDate}</span>
          </div>
        );
      })}
    </div>
  );
}
