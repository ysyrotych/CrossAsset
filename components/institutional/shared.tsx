"use client";

import { useEffect, useRef, useState } from "react";
import type { HoldingAction } from "@/lib/institutional/types";

// ── formatters ────────────────────────────────────────────────────────────────
export function fmtMoney(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3)  return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
export function fmtShares(v: number | null): string {
  if (v == null) return "—";
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${v.toFixed(0)}`;
}
export function fmtPct(v: number, dp = 1): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(dp)}%`;
}

// ── animated count-up ─────────────────────────────────────────────────────────
export function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return val;
}

export function CountMoney({ value, className }: { value: number; className?: string }) {
  const v = useCountUp(value);
  return <span className={className}>{fmtMoney(v)}</span>;
}
export function CountNum({ value, suffix = "", dp = 0, className }: { value: number; suffix?: string; dp?: number; className?: string }) {
  const v = useCountUp(value);
  return <span className={className}>{v.toFixed(dp)}{suffix}</span>;
}

// ── action colors ─────────────────────────────────────────────────────────────
export const ACTION_META: Record<HoldingAction, { label: string; fg: string; bg: string; dot: string }> = {
  NEW:  { label: "New",  fg: "#0369a1", bg: "#e0f2fe", dot: "#0ea5e9" },
  ADD:  { label: "Add",  fg: "#147a4f", bg: "#f0fdf4", dot: "#22c55e" },
  TRIM: { label: "Trim", fg: "#b7791f", bg: "#fffbeb", dot: "#f59e0b" },
  EXIT: { label: "Exit", fg: "#b42318", bg: "#fef2f2", dot: "#ef4444" },
  HOLD: { label: "Hold", fg: "#6b7280", bg: "#f3f4f6", dot: "#9ca3af" },
};

export function ActionBadge({ action }: { action: HoldingAction }) {
  const m = ACTION_META[action];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full"
      style={{ color: m.fg, background: m.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

// ── conviction meter ──────────────────────────────────────────────────────────
export function ConvictionMeter({ score, delay = 0 }: { score: number; delay?: number }) {
  const color = score >= 70 ? "#147a4f" : score >= 45 ? "#0c1b38" : score >= 25 ? "#b7791f" : "#9ca3af";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ background: "var(--ca-surface-2)" }}>
        <div className="h-full rounded-full inst-meter-fill" style={{ width: `${score}%`, background: color, animationDelay: `${delay}ms` }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

// ── stat card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, children, sub, accent }: { label: string; children: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl px-5 py-4 inst-card-hover relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, var(--ca-surface), var(--ca-surface-2))",
        border: `1px solid ${accent ? "var(--ca-accent)" : "var(--ca-border)"}`,
        boxShadow: "0 1px 2px rgba(12,27,56,0.04)",
      }}>
      {accent && <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "var(--ca-accent)" }} />}
      <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--ca-text-3)" }}>{label}</p>
      <div className="text-[27px] font-semibold tabular-nums leading-none tracking-tight" style={{ color: "var(--ca-text)" }}>{children}</div>
      {sub && <p className="text-[10.5px] mt-1.5" style={{ color: "var(--ca-text-3)" }}>{sub}</p>}
    </div>
  );
}

// ── staleness chip ────────────────────────────────────────────────────────────
export function StalenessChip({ days, period }: { days: number; period: string }) {
  const q = quarterOf(period);
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full"
      style={{ background: "var(--ca-surface-2)", color: "var(--ca-text-2)" }}
      title="13F data is reported with up to a 45-day lag">
      <span className="w-1.5 h-1.5 rounded-full inst-pulse" style={{ background: "#0ea5e9" }} />
      {q} · filed {days}d ago
    </span>
  );
}

export function quarterOf(iso: string): string {
  const d = new Date(iso);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q} ${d.getUTCFullYear()}`;
}

export function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
