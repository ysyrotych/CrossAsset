"use client";

/**
 * BACKTESTING PAGE — CrossAsset
 *
 * Flow:
 *   STEP 1 · INPUT      → User describes strategy in plain English
 *   STEP 2 · ASSUMPTIONS → AI converts to structured, editable assumptions
 *   STEP 3 · APPROVE    → User reviews + edits each assumption, then confirms
 *   STEP 4 · RESULTS    → Full backtest output: equity curve, drawdown, stats table
 *
 * State machine: "input" | "parsing" | "assumptions" | "running" | "results"
 *
 * All AI calls go through /api/backtesting/parse-strategy  (POST)
 *                     and /api/backtesting/run-backtest     (POST)
 * Both are stubbed — implement with ChatGPT.
 *
 * Data types are defined below. Keep them here so ChatGPT sees the full contract.
 */

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AssetClass =
  | "Equities"
  | "Bonds"
  | "Commodities"
  | "FX"
  | "Crypto"
  | "Mixed";

export type RebalanceFrequency =
  | "Daily"
  | "Weekly"
  | "Monthly"
  | "Quarterly"
  | "Annually"
  | "Signal-based";

export type Assumption = {
  id: string;
  category:
    | "Universe"
    | "Entry"
    | "Exit"
    | "Position Sizing"
    | "Risk"
    | "Costs"
    | "Rebalance";
  label: string;          // short name, e.g. "Stop-loss"
  value: string;          // human-readable value, e.g. "8% below entry"
  editable: boolean;      // can user change this?
  confidence: "high" | "medium" | "low"; // how confident AI is in the parse
  note?: string;          // AI explanation of why it inferred this
};

export type BacktestConfig = {
  strategyName: string;
  originalDescription: string;
  assetClass: AssetClass;
  tickers: string[];
  startDate: string;       // "YYYY-MM-DD"
  endDate: string;         // "YYYY-MM-DD"
  initialCapital: number;  // USD
  rebalance: RebalanceFrequency;
  assumptions: Assumption[];
};

export type EquityPoint = {
  date: string;     // "YYYY-MM-DD"
  portfolio: number; // portfolio value
  benchmark: number; // benchmark value (e.g. SPY)
};

export type TradeRecord = {
  ticker: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  returnPct: number;
  holdingDays: number;
  pnl: number;
};

export type BacktestStats = {
  cagr: number;           // %
  totalReturn: number;    // %
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;    // % (negative)
  maxDrawdownDuration: number; // days
  winRate: number;        // %
  avgWin: number;         // %
  avgLoss: number;        // %
  profitFactor: number;
  totalTrades: number;
  benchmarkCagr: number;  // %
  alpha: number;          // annualized %
  beta: number;
  calmarRatio: number;
};

export type BacktestResult = {
  config: BacktestConfig;
  stats: BacktestStats;
  equityCurve: EquityPoint[];
  drawdownSeries: { date: string; drawdown: number }[];
  trades: TradeRecord[];
  monthlyReturns: { year: number; month: number; return: number }[];
  summary: string;  // 2–3 sentence AI-generated plain-English summary
};

// ─── Step components (stubs — implement with ChatGPT) ─────────────────────────

/** STEP 1: plain-English strategy input */
function StepInput({
  onSubmit,
}: {
  onSubmit: (description: string) => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="max-w-2xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38] mb-4">
        Step 1 — Describe your strategy
      </p>
      <h2
        className="text-[32px] font-light leading-[1.1] tracking-tight text-[#0a0a0a] mb-3"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Tell me how you invest.
      </h2>
      <p className="text-[13px] font-medium text-[#888] mb-8 leading-relaxed">
        Write your strategy in plain English — entry rules, exit rules, what
        assets, any risk limits. Be as specific or as vague as you like. The
        system will extract structured assumptions and ask you to confirm them
        before running.
      </p>

      {/* Example chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          "Buy S&P 500 stocks above 200-day MA, sell when they drop below",
          "Long gold when real rates fall, short when they rise",
          "Momentum strategy: buy top 10% performers, rebalance monthly",
          "60/40 portfolio, rebalance quarterly, stop-loss at 15%",
        ].map((ex) => (
          <button
            key={ex}
            onClick={() => setText(ex)}
            className="text-[11px] font-medium text-[#0c1b38] border border-[#dce5ff] bg-[#f5f8ff] px-3 py-1.5 rounded-full hover:bg-[#e8eeff] transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Buy the top 20 S&P 500 stocks by 12-month momentum, equal-weight, rebalance monthly. Exit if any position drops 10% from entry. Benchmark against SPY."
        rows={6}
        className="w-full border border-[#e8e8e8] rounded-sm px-4 py-3.5 text-[13.5px] font-medium text-[#0a0a0a] placeholder:text-[#bbb] resize-none focus:outline-none focus:border-[#0c1b38] transition-colors leading-relaxed"
      />

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] font-medium text-[#bbb]">
          {text.length} characters — more detail = better assumptions
        </p>
        <button
          disabled={text.trim().length < 20}
          onClick={() => onSubmit(text.trim())}
          className="px-6 py-2.5 bg-[#0c1b38] text-white text-[12px] font-semibold tracking-[0.08em] uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#162d5c] transition-colors"
        >
          Parse Strategy →
        </button>
      </div>
    </div>
  );
}

/** STEP 2: loading / parsing state */
function StepParsing() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-8 h-8 border-2 border-[#0c1b38] border-t-transparent rounded-full animate-spin mb-6" />
      <p className="text-[13px] font-medium text-[#888]">
        Extracting assumptions from your strategy…
      </p>
    </div>
  );
}

/** STEP 3: assumption review + editing */
function StepAssumptions({
  config,
  onApprove,
  onBack,
}: {
  config: BacktestConfig;
  onApprove: (config: BacktestConfig) => void;
  onBack: () => void;
}) {
  // TODO (ChatGPT): render each assumption as an editable row grouped by category.
  // Allow inline editing of `value`. Show confidence badge. Show AI note on hover.
  // "Approve & Run" calls onApprove with the (possibly edited) config.
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38] mb-4">
        Step 2 — Review assumptions
      </p>
      <p className="text-[13px] text-[#888] mb-6">
        {config.assumptions.length} assumptions extracted. Review, edit if
        needed, then approve.
      </p>
      <pre className="text-[11px] text-[#555] bg-[#fafaf8] border border-[#eee] p-4 overflow-auto max-h-96 rounded-sm">
        {JSON.stringify(config, null, 2)}
      </pre>
      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="px-5 py-2.5 border border-[#e8e8e8] text-[12px] font-semibold text-[#555] hover:border-[#0c1b38] transition-colors">
          ← Back
        </button>
        <button onClick={() => onApprove(config)} className="px-6 py-2.5 bg-[#0c1b38] text-white text-[12px] font-semibold tracking-[0.08em] uppercase hover:bg-[#162d5c] transition-colors">
          Approve & Run Backtest →
        </button>
      </div>
    </div>
  );
}

/** STEP 4: running backtest */
function StepRunning() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-8 h-8 border-2 border-[#0c1b38] border-t-transparent rounded-full animate-spin mb-6" />
      <p className="text-[13px] font-medium text-[#888]">Running backtest…</p>
    </div>
  );
}

/** STEP 5: results */
function StepResults({
  result,
  onReset,
}: {
  result: BacktestResult;
  onReset: () => void;
}) {
  // TODO (ChatGPT): implement full results UI:
  //   - Stats bar: CAGR, Sharpe, Max DD, Win Rate, Alpha, Total Trades
  //   - Equity curve chart (portfolio vs benchmark) — use Recharts LineChart
  //   - Drawdown chart — AreaChart with negative Y axis
  //   - Monthly returns heatmap — 12-col grid per year, color coded
  //   - Trades table — sortable, with pagination
  //   - AI summary paragraph
  //   - "Export CSV" button for trades
  //   - "New strategy" button → onReset()
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38] mb-1">
            Backtest Results
          </p>
          <h2
            className="text-[28px] font-light tracking-tight text-[#0a0a0a]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {result.config.strategyName}
          </h2>
        </div>
        <button
          onClick={onReset}
          className="text-[11px] font-semibold text-[#888] hover:text-[#0c1b38] transition-colors"
        >
          ← New strategy
        </button>
      </div>
      <pre className="text-[11px] text-[#555] bg-[#fafaf8] border border-[#eee] p-4 overflow-auto max-h-96 rounded-sm">
        {JSON.stringify(result.stats, null, 2)}
      </pre>
    </div>
  );
}

// ─── Page orchestrator ────────────────────────────────────────────────────────

type PageState =
  | { step: "input" }
  | { step: "parsing" }
  | { step: "assumptions"; config: BacktestConfig }
  | { step: "running"; config: BacktestConfig }
  | { step: "results"; result: BacktestResult };

export default function BacktestingPage() {
  const [state, setState] = useState<PageState>({ step: "input" });

  async function handleStrategySubmit(description: string) {
    setState({ step: "parsing" });
    try {
      const res = await fetch("/api/backtesting/parse-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const config: BacktestConfig = await res.json();
      setState({ step: "assumptions", config });
    } catch {
      // TODO: error state
      setState({ step: "input" });
    }
  }

  async function handleApprove(config: BacktestConfig) {
    setState({ step: "running", config });
    try {
      const res = await fetch("/api/backtesting/run-backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const result: BacktestResult = await res.json();
      setState({ step: "results", result });
    } catch {
      // TODO: error state
      setState({ step: "assumptions", config });
    }
  }

  return (
    <AppShell>
      {/* Page header */}
      <div className="mb-10 pb-7 border-b border-[#ebebeb]">
        <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-[#0c1b38] mb-3">
          Backtesting
        </p>
        <h1
          className="text-[34px] font-light tracking-tight text-[#0a0a0a]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Strategy Backtester
        </h1>
        <p className="text-[13px] text-[#9ca3af] mt-1.5">
          Describe any strategy in plain English. Get structured assumptions,
          approve them, then see a full backtest.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-6 mb-10">
        {(["input", "assumptions", "results"] as const).map((s, i) => {
          const labels = ["Describe", "Review", "Results"];
          const currentStep = state.step;
          const stepOrder = { input: 0, parsing: 0, assumptions: 1, running: 1, results: 2 };
          const active = stepOrder[currentStep] === i;
          const done = stepOrder[currentStep] > i;
          return (
            <div key={s} className="flex items-center gap-2">
              <span
                className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-full border ${
                  active
                    ? "bg-[#0c1b38] text-white border-[#0c1b38]"
                    : done
                    ? "bg-[#0c1b38]/10 text-[#0c1b38] border-[#0c1b38]/30"
                    : "text-[#bbb] border-[#e0e0e0]"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`text-[11px] font-semibold tracking-[0.1em] uppercase ${
                  active ? "text-[#0c1b38]" : done ? "text-[#0c1b38]/50" : "text-[#ccc]"
                }`}
              >
                {labels[i]}
              </span>
              {i < 2 && <span className="text-[#e0e0e0] ml-2">—</span>}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div>
        {state.step === "input" && (
          <StepInput onSubmit={handleStrategySubmit} />
        )}
        {state.step === "parsing" && <StepParsing />}
        {state.step === "assumptions" && (
          <StepAssumptions
            config={state.config}
            onApprove={handleApprove}
            onBack={() => setState({ step: "input" })}
          />
        )}
        {state.step === "running" && <StepRunning />}
        {state.step === "results" && (
          <StepResults
            result={state.result}
            onReset={() => setState({ step: "input" })}
          />
        )}
      </div>
    </AppShell>
  );
}
