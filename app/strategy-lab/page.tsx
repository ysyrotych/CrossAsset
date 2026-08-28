"use client";

import AppShell from "@/components/layout/AppShell";

const FEATURES = [
  {
    title: "Macro Regime Detection",
    desc: "AI-powered classification of the current market cycle — Recovery, Expansion, Slowdown, or Contraction — derived from live FRED indicators.",
  },
  {
    title: "Factor Scoring Engine",
    desc: "Cross-sectional scoring of Value, Momentum, Quality, Size, and Low Volatility factors with regime-conditional weightings.",
  },
  {
    title: "Portfolio Regime Stress Test",
    desc: "Maps your current holdings to historical regime episodes and estimates expected drawdown and recovery path.",
  },
  {
    title: "AI Strategy Builder",
    desc: "Describe an investment thesis in plain English — Claude translates it into a quantitative strategy with factor tilts and risk guardrails.",
  },
  {
    title: "Backtesting Engine",
    desc: "Run regime-aware backtests against 20 years of FRED and market data with turnover constraints and transaction cost modeling.",
  },
  {
    title: "Regime Playbook",
    desc: "Asset class signal grid per regime (OW/N/UW) covering equities, duration, credit, FX, and commodities — institutional analyst grade.",
  },
];

export default function StrategyLabPage() {
  return (
    <AppShell>
      <main className="pb-20 max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full"
              style={{ background: "#fef9c3", color: "#854d0e", border: "1px solid #fde68a" }}>
              In Development
            </span>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight mb-2" style={{ color: "var(--ca-text)", fontFamily: "var(--font-serif)" }}>
            Strategy Lab
          </h1>
          <p className="text-[14px] leading-relaxed max-w-2xl" style={{ color: "var(--ca-text-2)" }}>
            A quantitative research environment for regime-aware portfolio construction. Built on top of live FRED macro data, multi-factor scoring, and Claude-powered strategy synthesis.
          </p>
        </div>

        {/* Divider */}
        <div className="border-t mb-10" style={{ borderColor: "var(--ca-border)" }} />

        {/* Feature grid */}
        <div className="mb-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-6" style={{ color: "var(--ca-text-3)" }}>
            What&apos;s being built
          </p>
          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl p-5"
                style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}
              >
                <div className="flex items-start gap-3 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: "var(--ca-accent)" }} />
                  <p className="text-[13px] font-semibold" style={{ color: "var(--ca-text)" }}>{f.title}</p>
                </div>
                <p className="text-[12px] leading-relaxed pl-[18px]" style={{ color: "var(--ca-text-2)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Status bar */}
        <div className="rounded-xl p-6" style={{ background: "var(--ca-surface-2)", border: "1px solid var(--ca-border)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--ca-text-3)" }}>
            Development status
          </p>
          <div className="space-y-3">
            {[
              { label: "Regime detection model",      done: true  },
              { label: "Factor scoring pipeline",      done: true  },
              { label: "Regime playbook & signals",    done: true  },
              { label: "Portfolio stress-test layer",  done: false },
              { label: "AI strategy builder (Claude)", done: false },
              { label: "Full backtesting engine",      done: false },
            ].map(({ label, done }) => (
              <div key={label} className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-emerald-500" : "bg-gray-200"}`} />
                <span className="text-[12px]" style={{ color: done ? "var(--ca-text)" : "var(--ca-text-3)" }}>{label}</span>
                {done && <span className="text-[10px] font-semibold text-emerald-600">Complete</span>}
              </div>
            ))}
          </div>
        </div>

      </main>
    </AppShell>
  );
}
