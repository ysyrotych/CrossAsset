"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Sparkles, Loader2 } from "lucide-react";
import type { SuperinvestorDigest } from "@/lib/institutional/types";
import { fmtMoney, initials } from "./shared";

export default function SuperinvestorsView({
  onPickManager, onPickTicker,
}: { onPickManager: (slug: string) => void; onPickTicker: (t: string) => void }) {
  const [digest, setDigest] = useState<SuperinvestorDigest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/institutional/superinvestors")
      .then((r) => r.json())
      .then((d) => setDigest(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !digest) return <div className="grid grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 rounded-xl inst-skeleton" />)}</div>;

  return (
    <div className="inst-fade-up">
      <SmartMoneyBrief />

      {/* clone-alpha leaderboard */}
      {digest.cloneLeaderboard?.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-6" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--ca-border)" }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--ca-text-2)" }}>Clone-Alpha Leaderboard</p>
            <span className="text-[10px]" style={{ color: "var(--ca-text-3)" }}>new-buy return vs S&P since quarter-end</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6">
            {digest.cloneLeaderboard.slice(0, 10).map((c, i) => (
              <button key={c.slug} onClick={() => onPickManager(c.slug)}
                className="flex items-center gap-3 px-4 py-2.5 inst-row-hover hover:bg-[var(--ca-surface-2)] text-left border-t"
                style={{ borderColor: "var(--ca-border)" }}>
                <span className="text-[11px] font-bold w-5 tabular-nums" style={{ color: "var(--ca-text-3)" }}>{i + 1}</span>
                <span className="text-[12.5px] font-medium flex-1 truncate" style={{ color: "var(--ca-text)" }}>{c.manager}</span>
                <span className="text-[10.5px] tabular-nums" style={{ color: "var(--ca-text-3)" }}>{c.hitRate.toFixed(0)}% hit</span>
                <span className="text-[13px] font-bold tabular-nums w-16 text-right"
                  style={{ color: c.alpha >= 0 ? "#147a4f" : "#b42318" }}>
                  {c.alpha >= 0 ? "+" : ""}{c.alpha.toFixed(1)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* quarter digest */}
      <div className="grid grid-cols-2 gap-5 mb-8">
        <DigestPanel title="Biggest new bets" tone="green" icon={<ArrowUpRight size={13} />}
          items={digest.biggestNewBuys.map((r) => ({ ticker: r.ticker, issuer: r.issuer, value: r.newMoney || r.netValueFlow, sub: `${r.buyers} funds` }))}
          onPick={onPickTicker} />
        <DigestPanel title="Biggest exits" tone="red" icon={<ArrowDownRight size={13} />}
          items={digest.biggestExits.map((r) => ({ ticker: r.ticker, issuer: r.issuer, value: r.netValueFlow, sub: `${r.sellers} funds` }))}
          onPick={onPickTicker} />
      </div>

      {/* manager grid */}
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: "var(--ca-text-3)" }}>Tracked superinvestors</p>
      <div className="grid grid-cols-4 gap-3">
        {digest.managers.map((m, i) => (
          <button key={m.slug} onClick={() => onPickManager(m.slug)}
            className="rounded-xl p-4 text-left inst-card-hover inst-fade-up"
            style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)", animationDelay: `${i * 30}ms` }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold"
                style={{ background: "var(--ca-accent)", color: "#fff" }}>{initials(m.manager ?? m.name)}</div>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold truncate" style={{ color: "var(--ca-text)" }}>{m.manager}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--ca-text-3)" }}>{m.name}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "var(--ca-text-3)" }}>13F Book</span>
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--ca-text)" }}>{fmtMoney(m.aum13f)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SmartMoneyBrief() {
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  function generate() {
    setOpen(true); setLoading(true);
    fetch("/api/institutional/brief").then((r) => r.json())
      .then((d) => setBrief(d.brief ?? "Unable to generate brief."))
      .finally(() => setLoading(false));
  }

  return (
    <div className="rounded-xl p-5 mb-6 inst-aurora inst-scale-in" style={{ color: "#fff" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={15} style={{ color: "#fff" }} />
          <p className="text-[13px] font-semibold">Smart-Money Brief</p>
          <span className="text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}>AI</span>
        </div>
        {!open && (
          <button onClick={generate} className="text-[12px] font-medium px-3.5 py-1.5 rounded-lg inst-card-hover"
            style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}>
            Generate this quarter&apos;s brief
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3">
          {loading ? (
            <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "rgba(255,255,255,0.8)" }}>
              <Loader2 size={14} className="animate-spin" /> Reading the tape…
            </div>
          ) : (
            <p className="text-[13.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.92)" }}>{brief}</p>
          )}
        </div>
      )}
    </div>
  );
}

function DigestPanel({ title, tone, icon, items, onPick }: {
  title: string; tone: "green" | "red"; icon: React.ReactNode;
  items: { ticker: string; issuer: string; value: number; sub: string }[]; onPick: (t: string) => void;
}) {
  const fg = tone === "green" ? "#147a4f" : "#b42318";
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--ca-border)" }}>
        <span style={{ color: fg }}>{icon}</span>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: fg }}>{title}</p>
      </div>
      {items.map((it) => (
        <button key={it.ticker} onClick={() => onPick(it.ticker)}
          className="w-full flex items-center justify-between px-4 py-2.5 border-t inst-row-hover hover:bg-[var(--ca-surface-2)] text-left"
          style={{ borderColor: "var(--ca-border)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[12.5px] font-bold" style={{ color: "var(--ca-text)" }}>{it.ticker}</span>
            <span className="text-[10.5px] truncate max-w-[180px]" style={{ color: "var(--ca-text-3)" }}>{it.issuer}</span>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[12px] font-semibold tabular-nums" style={{ color: fg }}>{it.value >= 0 ? "" : "−"}{fmtMoney(Math.abs(it.value))}</p>
            <p className="text-[9.5px]" style={{ color: "var(--ca-text-3)" }}>{it.sub}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
