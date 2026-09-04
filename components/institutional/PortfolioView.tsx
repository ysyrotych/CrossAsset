"use client";

import { useEffect, useState } from "react";
import { Briefcase, Plus, X } from "lucide-react";
import type { PortfolioView as PV, PortfolioRow } from "@/lib/institutional/types";
import { ActionBadge } from "./shared";

const DEFAULT = ["NVDA", "META", "AAPL", "AMZN", "GOOGL", "MSFT", "TSM", "CMG"];
const SIGNAL_COLOR: Record<PortfolioRow["signalAlignment"], string> = {
  ALIGNED_BULLISH: "#147a4f", ALIGNED_BEARISH: "#b42318", DIVERGENT: "#b7791f", NEUTRAL: "#9ca3af",
};
const SIGNAL_LABEL: Record<PortfolioRow["signalAlignment"], string> = {
  ALIGNED_BULLISH: "Aligned Bullish", ALIGNED_BEARISH: "Aligned Bearish", DIVERGENT: "Divergent", NEUTRAL: "Neutral",
};

export default function PortfolioView({ onPickTicker }: { onPickTicker: (t: string) => void }) {
  const [tickers, setTickers] = useState<string[]>(DEFAULT);
  const [view, setView] = useState<PV | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");

  // Load the user's watchlist from localStorage if present
  useEffect(() => {
    try {
      const raw = localStorage.getItem("crossasset_institutional_portfolio")
        ?? localStorage.getItem("crossasset_watchlist");
      if (raw) {
        const parsed = JSON.parse(raw);
        const syms = Array.isArray(parsed)
          ? parsed.map((x) => (typeof x === "string" ? x : x?.ticker || x?.symbol)).filter(Boolean)
          : [];
        if (syms.length) setTickers(syms.map((s: string) => s.toUpperCase()));
      }
    } catch { /* keep default */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    localStorage.setItem("crossasset_institutional_portfolio", JSON.stringify(tickers));
    fetch(`/api/institutional/portfolio?tickers=${tickers.join(",")}`)
      .then((r) => r.json()).then((d) => setView(d)).finally(() => setLoading(false));
  }, [tickers]);

  function add() {
    const t = input.trim().toUpperCase();
    if (t && !tickers.includes(t)) setTickers([...tickers, t]);
    setInput("");
  }
  function remove(t: string) { setTickers(tickers.filter((x) => x !== t)); }

  const held = view?.rows.filter((r) => r.held).length ?? 0;

  return (
    <div className="inst-fade-up">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <Briefcase size={16} style={{ color: "var(--ca-accent)" }} />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--ca-text)" }}>Your Portfolio × Smart Money</p>
            <p className="text-[11px]" style={{ color: "var(--ca-text-3)" }}>
              {held} of {tickers.length} of your names are held by tracked superinvestors
            </p>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex items-center gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add ticker"
            className="w-28 px-3 py-1.5 rounded-lg text-[12px] uppercase focus:outline-none"
            style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)", color: "var(--ca-text)" }} />
          <button type="submit" className="p-1.5 rounded-lg" style={{ background: "var(--ca-accent)", color: "#fff" }}><Plus size={14} /></button>
        </form>
      </div>

      {loading && !view ? <div className="h-72 rounded-xl inst-skeleton" /> : (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--ca-surface)", border: "1px solid var(--ca-border)" }}>
          <table className="w-full">
            <thead>
              <tr className="text-[9.5px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--ca-text-3)" }}>
                <th className="text-left px-4 py-3">Your Holding</th>
                <th className="text-center px-2 py-3">Funds</th>
                <th className="text-center px-2 py-3">Flow</th>
                <th className="text-left px-2 py-3">Top Holders</th>
                <th className="text-center px-2 py-3">Insiders</th>
                <th className="text-right px-4 py-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {view?.rows.map((r) => (
                <tr key={r.ticker} className="border-t inst-row-hover hover:bg-[var(--ca-surface-2)] cursor-pointer"
                  style={{ borderColor: "var(--ca-border)" }} onClick={() => r.held && onPickTicker(r.ticker)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold" style={{ color: "var(--ca-text)" }}>{r.ticker}</span>
                      <span className="text-[10.5px] truncate max-w-[150px]" style={{ color: "var(--ca-text-3)" }}>{r.issuer}</span>
                      <button onClick={(e) => { e.stopPropagation(); remove(r.ticker); }} className="opacity-40 hover:opacity-100"><X size={11} /></button>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center text-[12px] tabular-nums" style={{ color: r.held ? "var(--ca-text)" : "var(--ca-text-3)" }}>
                    {r.held ? r.holderCount : "—"}
                  </td>
                  <td className="px-2 py-3 text-center text-[11.5px] tabular-nums">
                    {r.held ? <span style={{ color: r.netManagerFlow > 0 ? "#147a4f" : r.netManagerFlow < 0 ? "#b42318" : "var(--ca-text-3)" }}>
                      {r.buyers}▲ {r.sellers}▼
                    </span> : <span style={{ color: "var(--ca-text-3)" }}>not held</span>}
                  </td>
                  <td className="px-2 py-3 text-[11px]" style={{ color: "var(--ca-text-2)" }}>{r.topHolders.slice(0, 2).join(", ") || "—"}</td>
                  <td className="px-2 py-3 text-center">
                    {r.insiderSignal === "NONE" ? <span className="text-[11px]" style={{ color: "var(--ca-text-3)" }}>—</span> :
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: r.insiderSignal === "BUY" ? "#f0fdf4" : r.insiderSignal === "SELL" ? "#fef2f2" : "#fffbeb",
                          color: r.insiderSignal === "BUY" ? "#147a4f" : r.insiderSignal === "SELL" ? "#b42318" : "#b7791f" }}>
                        {r.insiderSignal}
                      </span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.held ? <span className="text-[11px] font-semibold" style={{ color: SIGNAL_COLOR[r.signalAlignment] }}>{SIGNAL_LABEL[r.signalAlignment]}</span>
                      : <span className="text-[11px]" style={{ color: "var(--ca-text-3)" }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10.5px] mt-3" style={{ color: "var(--ca-text-3)" }}>
        Tip: your watchlist auto-loads here. Click any held name to see the full institutional + insider picture.
      </p>
    </div>
  );
}
