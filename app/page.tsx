"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────

type LiveQuote = { price: number; change: number; pct: number } | null;

type DashData = {
  updatedAt: string;
  tf: string;
  fredConnected: boolean;
  yields:   { dgs2: LiveQuote; dgs5: LiveQuote; dgs10: LiveQuote; dgs30: LiveQuote; fedfunds: LiveQuote };
  equities: { sp500: LiveQuote; vix: LiveQuote; gold: LiveQuote; oil: LiveQuote; dxy: LiveQuote };
  macro:    { cpi: LiveQuote; coreCpi: LiveQuote; unrate: LiveQuote; payems: LiveQuote; gdp: LiveQuote; hySpread: LiveQuote };
  history:  { date: string; tenYear?: number; fiveYear?: number }[];
  upcomingEvents: { event: string; date: string; impact: string; estimate?: string; previous?: string }[];
  topNews:  { title: string; source: string; description: string }[];
  driverScores: { driver: string; score: number; direction: "hawkish" | "dovish" | "neutral"; trend: string; sensitivity: string; explanation: string }[];
  pressureIndex: { name: string; value: number }[];
  transmission: { label: string; state: string; pressure: "hawkish" | "dovish" | "neutral"; confidence: number; explanation: string }[];
  agreement: {
    confirming:   { signal: string; asset: string; explanation: string }[];
    contradicting:{ signal: string; asset: string; explanation: string }[];
  };
  scenarios: { name: string; probability: number; tone: "positive" | "negative" | "neutral"; trigger: string; market: string }[];
  edgeInsights: { tag: string; title: string; insight: string; why: string; confidence: number }[];
  regimeLabel: string; regimeScore: number;
  regimeHeadline: string; regimeBody1: string; regimeBody2: string;
  sources: { fred: boolean; finnhub: boolean; newsapi: boolean };
};

// ── Constants ──────────────────────────────────────────────────────────────

const NAVY     = "#0c1b38";
const NEGATIVE = "#b42318";
const POSITIVE = "#147a4f";
const WARNING  = "#b7791f";
const TF_LABELS = ["1M", "3M", "6M", "1Y", "FOMC"] as const;
type TF = typeof TF_LABELS[number];

// ── Primitive components ───────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38]">{children}</p>;
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999]">{children}</p>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`border border-[#e8e3da] bg-white shadow-[0_1px_0_rgba(12,27,56,0.02)] ${className}`}>
      {children}
    </section>
  );
}

function PressurePill({ pressure }: { pressure: "hawkish" | "dovish" | "neutral" }) {
  const cls =
    pressure === "hawkish" ? "text-[#b42318] bg-[#fff7f5] border-[#f2d2cc]" :
    pressure === "dovish"  ? "text-[#147a4f] bg-[#f4fbf7] border-[#cfe8da]" :
                             "text-[#555] bg-[#faf8f3] border-[#eee9df]";
  return (
    <span className={`border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] ${cls}`}>
      {pressure}
    </span>
  );
}

function ScoreBar({ value, tone = "neutral" }: { value: number; tone?: "positive" | "negative" | "neutral" | "mixed" }) {
  const color = tone === "positive" ? POSITIVE : tone === "negative" ? NEGATIVE : tone === "mixed" ? WARNING : NAVY;
  return (
    <div className="h-[6px] bg-[#eee9df]">
      <div className="h-full" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  );
}

function MetricTile({
  label, quote, note, dec = 2, prefix = "", suffix = "", pctSuffix = "%", invertColor = false,
}: {
  label: string; quote: LiveQuote; note: string;
  dec?: number; prefix?: string; suffix?: string; pctSuffix?: string; invertColor?: boolean;
}) {
  const up = (quote?.change ?? 0) > 0;
  const color = quote == null ? "#bbb" : (invertColor ? !up : up) ? NEGATIVE : POSITIVE;
  return (
    <div className="border border-[#eee9df] bg-[#fbfaf7] px-3 py-3">
      <MiniLabel>{label}</MiniLabel>
      <p className="mt-1 text-[18px] font-bold tabular-nums text-[#0a0a0a]">
        {quote != null ? `${prefix}${quote.price.toFixed(dec)}${suffix}` : "—"}
      </p>
      <p className="mt-1 text-[10px] font-semibold" style={{ color: quote ? color : "#bbb" }}>
        {quote != null ? `${quote.pct >= 0 ? "+" : ""}${quote.pct.toFixed(2)}${pctSuffix} · ` : ""}{note}
      </p>
    </div>
  );
}

function SourceDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-[#147a4f]" : "bg-[#bbb]"}`} />
      <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${ok ? "text-[#147a4f]" : "text-[#bbb]"}`}>
        {label}
      </span>
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [tf,      setTf]      = useState<TF>("6M");
  const [data,    setData]    = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchData = useCallback(async (t: TF) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/dashboard-data?tf=${t}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(tf); }, [tf, fetchData]);

  const updatedTime = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    : null;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <AppShell>
      <main className="max-w-[1480px] pb-16">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-7 border-b border-[#e8e3da] pb-6">
          <div className="flex items-start justify-between gap-10">
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38]">CrossAsset Command Center</p>
              <h1 className="mt-3 text-[38px] font-light leading-[1.05] tracking-tight text-[#0a0a0a]" style={{ fontFamily: "var(--font-serif)" }}>
                {loading ? "Loading live market data…" : data?.regimeHeadline ?? "Connecting to data sources…"}
              </h1>
              <p className="mt-4 max-w-3xl text-[13.5px] font-medium leading-[1.75] text-[#555]">
                {loading ? "Fetching FRED, Finnhub, and NewsAPI in real time." : data?.regimeBody1 ?? ""}
              </p>
            </div>

            <div className="min-w-[260px] flex flex-col items-end gap-3">
              <div className="text-right">
                <p className="text-[11px] font-bold text-[#0c1b38]">{today}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-[#999]">
                  {loading ? "Fetching…" : updatedTime ? `Live · Updated ${updatedTime}` : "No connection"}
                </p>
              </div>

              {/* Source indicators */}
              {data && (
                <div className="flex gap-3">
                  <SourceDot ok={data.sources.fred}    label="FRED" />
                  <SourceDot ok={data.sources.finnhub} label="Finnhub" />
                  <SourceDot ok={data.sources.newsapi} label="NewsAPI" />
                </div>
              )}

              {/* Refresh button */}
              <button
                onClick={() => fetchData(tf)}
                disabled={loading}
                className="flex items-center gap-2 border border-[#0c1b38] bg-[#0c1b38] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                <span className={loading ? "animate-spin" : ""}>↻</span>
                {loading ? "Updating…" : "Refresh Data"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Error state ─────────────────────────────────────────────── */}
        {error && (
          <div className="mb-5 border border-[#f2d2cc] bg-[#fff7f5] p-4">
            <p className="text-[12px] font-bold text-[#b42318]">Connection error: {error}</p>
            <p className="mt-1 text-[11px] text-[#777]">Check that FRED_API_KEY is set in Vercel environment variables.</p>
          </div>
        )}

        {/* ── No FRED key warning ──────────────────────────────────────── */}
        {data && !data.fredConnected && (
          <div className="mb-5 border border-[#f0e3c3] bg-[#fffbf0] p-4">
            <p className="text-[12px] font-bold text-[#b7791f]">FRED API not connected — add FRED_API_KEY to Vercel environment variables.</p>
            <p className="mt-1 text-[11px] text-[#777]">Register free at fred.stlouisfed.org · Market data sections will show live values once connected.</p>
          </div>
        )}

        {/* ── Layer 1: Chief View · Rates · Upcoming Events ───────────── */}
        <div className="mb-5 grid grid-cols-[1.1fr_1.45fr_1fr] gap-5">

          {/* Chief View */}
          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <SectionLabel>Chief View</SectionLabel>
              {data && (
                <span className="border border-[#e8e3da] px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#0c1b38]">
                  Regime {data.regimeScore}%
                </span>
              )}
            </div>

            <h2 className="text-[22px] font-light leading-[1.2] tracking-tight text-[#0a0a0a]" style={{ fontFamily: "var(--font-serif)" }}>
              {loading ? "—" : data?.regimeHeadline ?? "—"}
            </h2>

            <div className="mt-5 space-y-4 text-[13px] font-medium leading-[1.75] text-[#4b4b4b]">
              <p>{loading ? "Loading…" : data?.regimeBody1 ?? ""}</p>
              <p>{loading ? "" : data?.regimeBody2 ?? ""}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#eee9df] pt-5">
              <div>
                <MiniLabel>Regime</MiniLabel>
                <p className="mt-1 text-[12px] font-bold text-[#0c1b38]">{data?.regimeLabel ?? "—"}</p>
              </div>
              <div>
                <MiniLabel>10Y Yield</MiniLabel>
                <p className={`mt-1 text-[12px] font-bold ${(data?.yields.dgs10?.change ?? 0) > 0 ? "text-[#b42318]" : "text-[#147a4f]"}`}>
                  {data?.yields.dgs10 ? `${data.yields.dgs10.price.toFixed(2)}% (${data.yields.dgs10.change >= 0 ? "+" : ""}${data.yields.dgs10.change.toFixed(2)}%)` : "—"}
                </p>
              </div>
              <div>
                <MiniLabel>HY Spread</MiniLabel>
                <p className="mt-1 text-[12px] font-semibold text-[#555]">
                  {data?.macro.hySpread ? `${data.macro.hySpread.price.toFixed(0)}bps` : "—"}
                </p>
              </div>
              <div>
                <MiniLabel>Market state</MiniLabel>
                <p className="mt-1 text-[12px] font-semibold text-[#555]">
                  {data?.regimeLabel ?? "—"}
                </p>
              </div>
            </div>
          </Card>

          {/* Rates Command Center */}
          <Card className="p-6">
            <div className="mb-5 flex items-start justify-between gap-6">
              <div>
                <SectionLabel>Rates Command Center</SectionLabel>
                <h3 className="mt-3 text-[21px] font-light leading-[1.2] tracking-tight text-[#0a0a0a]" style={{ fontFamily: "var(--font-serif)" }}>
                  {data?.yields.dgs10 ? `10Y at ${data.yields.dgs10.price.toFixed(2)}% — live from FRED` : "Connecting to FRED…"}
                </h3>
              </div>
              <div className="flex gap-1 shrink-0">
                {TF_LABELS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setTf(r)}
                    className={`border px-2.5 py-1.5 text-[9.5px] font-bold uppercase transition-colors ${
                      tf === r ? "border-[#0c1b38] bg-[#0c1b38] text-white" : "border-[#e8e3da] text-[#777] hover:border-[#0c1b38] hover:text-[#0c1b38]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 8 metric tiles */}
            <div className="mb-5 grid grid-cols-4 gap-3">
              <MetricTile label="5Y Yield"  quote={data?.yields.dgs5  ?? null} note="Mid-curve"           dec={2} suffix="%" pctSuffix="%" invertColor />
              <MetricTile label="10Y Yield" quote={data?.yields.dgs10 ?? null} note="Equity pressure"     dec={2} suffix="%" pctSuffix="%" invertColor />
              <MetricTile label="30Y Yield" quote={data?.yields.dgs30 ?? null} note="Long-end inflation"  dec={2} suffix="%" pctSuffix="%" invertColor />
              <MetricTile label="S&P 500"   quote={data?.equities.sp500 ?? null} note="US equities"       dec={0} />
              <MetricTile label="Gold"      quote={data?.equities.gold  ?? null} note="Safe haven"        dec={0} prefix="$" />
              <MetricTile label="WTI Oil"   quote={data?.equities.oil   ?? null} note="Energy / inflation" dec={2} prefix="$" />
              <MetricTile label="VIX"       quote={data?.equities.vix   ?? null} note="Risk gauge"        dec={1} invertColor />
              <MetricTile label="USD Index" quote={data?.equities.dxy   ?? null} note="FX / global liquidity" dec={2} invertColor />
            </div>

            {/* Yield curve chart */}
            <div className="h-[200px]">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <span className="text-[11px] text-[#bbb] tracking-widest uppercase">Loading live data…</span>
                </div>
              ) : !data?.history.length ? (
                <div className="h-full flex items-center justify-center">
                  <span className="text-[11px] text-[#bbb]">Chart data unavailable — check FRED_API_KEY</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.history} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="#eee9df" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#777" }} interval="preserveStartEnd" />
                    <YAxis domain={["auto", "auto"]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#777" }} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} />
                    <Tooltip contentStyle={{ border: "1px solid #e8e3da", borderRadius: 0, fontSize: 12 }} formatter={(v: unknown) => [`${Number(v).toFixed(2)}%`]} />
                    <Line type="monotone" dataKey="fiveYear"  name="5Y Treasury"  stroke="#6b7280" strokeWidth={2}   dot={false} connectNulls />
                    <Line type="monotone" dataKey="tenYear"   name="10Y Treasury" stroke={NEGATIVE} strokeWidth={2.2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 border-t border-[#eee9df] pt-4">
              <div>
                <MiniLabel>5Y–10Y spread</MiniLabel>
                <p className="mt-1 text-[12px] font-bold text-[#0c1b38]">
                  {data?.yields.dgs5 && data?.yields.dgs10
                    ? `${((data.yields.dgs10.price - data.yields.dgs5.price) * 100).toFixed(0)}bps`
                    : "—"}
                </p>
              </div>
              <div>
                <MiniLabel>2Y–10Y spread</MiniLabel>
                <p className="mt-1 text-[12px] font-bold text-[#0c1b38]">
                  {data?.yields.dgs2 && data?.yields.dgs10
                    ? `${((data.yields.dgs10.price - data.yields.dgs2.price) * 100).toFixed(0)}bps`
                    : "—"}
                </p>
              </div>
              <div>
                <MiniLabel>Fed Funds</MiniLabel>
                <p className="mt-1 text-[12px] font-bold text-[#0c1b38]">
                  {data?.yields.fedfunds ? `${data.yields.fedfunds.price.toFixed(2)}%` : "—"}
                </p>
              </div>
            </div>
          </Card>

          {/* Upcoming Key Events (live from Finnhub) */}
          <Card className="p-6">
            <SectionLabel>Upcoming Key Events</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#999]">
              {data?.sources.finnhub ? "Live · Finnhub economic calendar" : "Finnhub not connected"}
            </p>

            {loading ? (
              <p className="mt-6 text-[12px] text-[#bbb]">Loading events…</p>
            ) : !data?.upcomingEvents.length ? (
              <div className="mt-6">
                <p className="text-[12px] text-[#bbb] mb-4">No upcoming events — add FINNHUB_API_KEY to Vercel</p>
                {/* Fallback: show macro metrics instead */}
                <div className="space-y-3 border-t border-[#eee9df] pt-4">
                  <MiniLabel>Key macro levels</MiniLabel>
                  {[
                    { label: "CPI",          val: data?.macro.cpi?.price,      suffix: "%" },
                    { label: "Core CPI",     val: data?.macro.coreCpi?.price,  suffix: "%" },
                    { label: "Unemployment", val: data?.macro.unrate?.price,   suffix: "%" },
                    { label: "HY OAS",       val: data?.macro.hySpread?.price, suffix: "bps" },
                    { label: "GDP",          val: data?.macro.gdp?.price,      suffix: "%" },
                  ].map(({ label, val, suffix }) => (
                    <div key={label} className="flex items-center justify-between border-b border-[#f1eee8] pb-2 last:border-0">
                      <p className="text-[12px] font-bold text-[#0a0a0a]">{label}</p>
                      <p className="text-[12px] font-bold text-[#0c1b38]">{val != null ? `${val.toFixed(val > 100 ? 0 : 1)}${suffix}` : "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-0">
                {data.upcomingEvents.map((e, i) => (
                  <div key={i} className="border-b border-[#f1eee8] py-3 last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12.5px] font-bold text-[#0a0a0a]">{e.event}</p>
                      <p className="text-[11px] font-bold text-[#0c1b38] shrink-0">{new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <span className={`text-[9.5px] font-bold uppercase tracking-[0.12em] ${e.impact === "high" ? "text-[#b42318]" : e.impact === "medium" ? "text-[#b7791f]" : "text-[#777]"}`}>
                        {e.impact} impact
                      </span>
                      {e.estimate && <span className="text-[9.5px] text-[#999]">est: {e.estimate}</span>}
                      {e.previous && <span className="text-[9.5px] text-[#999]">prev: {e.previous}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Layer 2: Drivers · Transmission · Agreement ─────────────── */}
        <div className="mb-5 grid grid-cols-[0.9fr_1.2fr_0.9fr] gap-5">

          {/* Repricing Drivers — computed from FRED */}
          <Card className="p-6">
            <SectionLabel>Repricing Drivers</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#999]">{data?.sources.fred ? "Computed from live FRED data" : "Awaiting FRED connection"}</p>
            <div className="mt-5 space-y-4">
              {(data?.driverScores ?? []).map((d) => (
                <div key={d.driver}>
                  <div className="mb-1.5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12.5px] font-bold text-[#0a0a0a]">{d.driver}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <PressurePill pressure={d.direction} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#999]">{d.sensitivity}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-bold tabular-nums text-[#0c1b38]">{d.score}</p>
                      <p className={`text-[10px] font-bold tabular-nums ${d.direction === "hawkish" ? "text-[#b42318]" : "text-[#147a4f]"}`}>{d.trend}</p>
                    </div>
                  </div>
                  <ScoreBar value={d.score} tone={d.direction === "hawkish" ? "negative" : "neutral"} />
                  <p className="mt-2 text-[11.5px] font-medium leading-relaxed text-[#666]">{d.explanation}</p>
                </div>
              ))}
              {loading && <p className="text-[12px] text-[#bbb]">Computing from FRED…</p>}
            </div>
          </Card>

          {/* Macro Transmission Chain — computed */}
          <Card className="p-6">
            <SectionLabel>Macro Transmission Chain</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#999]">{data?.sources.fred ? "Derived from live FRED series" : "Awaiting FRED connection"}</p>
            <div className="mt-5 space-y-0">
              {(data?.transmission ?? []).map((node, index) => (
                <div key={node.label} className="relative">
                  <div className="flex items-start gap-4 py-4 border-b border-[#f1eee8] last:border-0">
                    <div className="flex flex-col items-center shrink-0 w-8 pt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#bbb]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {index < (data?.transmission.length ?? 0) - 1 && (
                        <div className="mt-1.5 w-px flex-1 bg-[#e8e3da]" style={{ minHeight: 20 }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-bold text-[#0a0a0a]">{node.label}</p>
                          <span className="text-[11px] font-bold text-[#0c1b38]">→</span>
                          <p className="text-[12px] font-bold text-[#0c1b38]">{node.state}</p>
                        </div>
                        <PressurePill pressure={node.pressure} />
                      </div>
                      <p className="text-[12px] font-medium leading-relaxed text-[#666]">{node.explanation}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-[4px] bg-[#eee9df]">
                          <div className="h-full bg-[#0c1b38]" style={{ width: `${node.confidence}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-[#999] tabular-nums shrink-0">{node.confidence}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {loading && <p className="mt-4 text-[12px] text-[#bbb]">Deriving chain from FRED…</p>}
            </div>
          </Card>

          {/* Cross-Asset Agreement — computed */}
          <Card className="p-6">
            <SectionLabel>Cross-Asset Agreement</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#999]">{data?.sources.fred ? "Derived from live quote directions" : "Awaiting FRED connection"}</p>
            <div className="mt-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#147a4f]">Confirms</p>
              <div className="space-y-2 mb-5">
                {(data?.agreement.confirming ?? []).map((s) => (
                  <div key={s.signal} className="flex items-start gap-3 py-2 border-b border-[#f1eee8] last:border-0">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#147a4f] shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-bold text-[#0a0a0a]">{s.signal}</p>
                        <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#147a4f]">{s.asset}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-[#666]">{s.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b42318]">Diverges</p>
              <div className="space-y-2">
                {(data?.agreement.contradicting ?? []).map((s) => (
                  <div key={s.signal} className="flex items-start gap-3 py-2 border-b border-[#f1eee8] last:border-0">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#b42318] shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-bold text-[#0a0a0a]">{s.signal}</p>
                        <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#b42318]">{s.asset}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-[#666]">{s.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {loading && <p className="mt-4 text-[12px] text-[#bbb]">Analyzing agreement…</p>}
          </Card>
        </div>

        {/* ── Layer 3: Edge · Scenarios · Macro metrics ────────────────── */}
        <div className="mb-5 grid grid-cols-[1.15fr_0.95fr_0.9fr] gap-5">

          {/* CrossAsset Edge — computed */}
          <Card className="p-6">
            <SectionLabel>CrossAsset Edge</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#999]">{data?.sources.fred ? "Derived algorithmically from live data" : "Awaiting FRED connection"}</p>
            <div className="mt-5 grid grid-cols-3 gap-5">
              {(data?.edgeInsights ?? []).map((edge) => (
                <div key={edge.tag} className="border-l border-[#e8e3da] pl-4 first:border-l-0 first:pl-0">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="border border-[#eee9df] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#0c1b38]">{edge.tag}</span>
                    <span className="text-[11px] font-bold tabular-nums text-[#0c1b38]">{edge.confidence}%</span>
                  </div>
                  <p className="text-[13px] font-bold leading-snug text-[#0a0a0a]">{edge.title}</p>
                  <p className="mt-2 text-[11.5px] font-medium leading-relaxed text-[#666]">{edge.insight}</p>
                  <p className="mt-3 text-[11.5px] font-semibold leading-relaxed text-[#0c1b38]">{edge.why}</p>
                </div>
              ))}
              {loading && <p className="text-[12px] text-[#bbb]">Computing edge insights…</p>}
            </div>
          </Card>

          {/* Scenario Grid — data-driven probabilities */}
          <Card className="p-6">
            <SectionLabel>Scenario Grid</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#999]">{data?.sources.fred ? "Probabilities from live macro levels" : "Awaiting FRED connection"}</p>
            <div className="mt-5 space-y-4">
              {(data?.scenarios ?? []).map((s) => {
                const color = s.tone === "positive" ? POSITIVE : s.tone === "negative" ? NEGATIVE : NAVY;
                return (
                  <div key={s.name} className="border-b border-[#f1eee8] pb-4 last:border-0 last:pb-0">
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <p className="text-[13px] font-bold text-[#0a0a0a]">{s.name}</p>
                      <span className="text-[13px] font-bold tabular-nums" style={{ color }}>{s.probability}%</span>
                    </div>
                    <div className="h-[6px] bg-[#eee9df]">
                      <div className="h-full" style={{ width: `${s.probability}%`, backgroundColor: color }} />
                    </div>
                    <p className="mt-2 text-[11.5px] font-medium leading-relaxed text-[#666]">
                      <span className="font-bold text-[#0a0a0a]">Trigger: </span>{s.trigger}
                    </p>
                    <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-[#666]">
                      <span className="font-bold text-[#0a0a0a]">Market: </span>{s.market}
                    </p>
                  </div>
                );
              })}
              {loading && <p className="text-[12px] text-[#bbb]">Computing scenarios…</p>}
            </div>
          </Card>

          {/* Key Macro Metrics — live from FRED */}
          <Card className="p-6">
            <SectionLabel>Macro Snapshot</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#999]">{data?.sources.fred ? "Live · FRED" : "Add FRED_API_KEY to Vercel"}</p>
            <div className="mt-5 space-y-3">
              {[
                { label: "CPI (all items)",   val: data?.macro.cpi?.price,      chg: data?.macro.cpi?.pct,      suffix: "%" },
                { label: "Core CPI",          val: data?.macro.coreCpi?.price,  chg: data?.macro.coreCpi?.pct,  suffix: "%" },
                { label: "Unemployment",      val: data?.macro.unrate?.price,   chg: data?.macro.unrate?.pct,   suffix: "%" },
                { label: "GDP growth",        val: data?.macro.gdp?.price,      chg: data?.macro.gdp?.pct,      suffix: "%" },
                { label: "HY OAS",            val: data?.macro.hySpread?.price, chg: data?.macro.hySpread?.pct, suffix: "bps", dec: 0 },
                { label: "Fed Funds",         val: data?.yields.fedfunds?.price, chg: 0,                        suffix: "%" },
                { label: "2Y Treasury",       val: data?.yields.dgs2?.price,    chg: data?.yields.dgs2?.pct,    suffix: "%" },
                { label: "30Y Treasury",      val: data?.yields.dgs30?.price,   chg: data?.yields.dgs30?.pct,   suffix: "%" },
              ].map(({ label, val, chg, suffix, dec = 2 }) => (
                <div key={label} className="flex items-center justify-between border-b border-[#f1eee8] pb-2.5 last:border-0">
                  <p className="text-[11.5px] font-bold text-[#0a0a0a]">{label}</p>
                  <div className="text-right">
                    <p className="text-[12px] font-bold text-[#0c1b38] tabular-nums">
                      {val != null ? `${val.toFixed(dec)}${suffix}` : "—"}
                    </p>
                    {chg != null && chg !== 0 && (
                      <p className={`text-[10px] font-semibold tabular-nums ${chg > 0 ? "text-[#b42318]" : "text-[#147a4f]"}`}>
                        {chg > 0 ? "+" : ""}{chg.toFixed(2)}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Layer 4: Pressure chart ───────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-[1.15fr_0.85fr] gap-5">

          {/* Asset-Class Reaction Matrix — static framework, always useful */}
          <Card className="p-6">
            <SectionLabel>Asset-Class Reaction Matrix</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#999]">Framework — which driver is currently active shapes how to read the matrix</p>
            <div className="mt-5 overflow-hidden border border-[#eee9df]">
              <table className="w-full text-left">
                <thead className="bg-[#fbfaf7]">
                  <tr className="border-b border-[#eee9df]">
                    {["Driver", "Equities", "Rates", "FX", "Commodities", "Credit"].map((h) => (
                      <th key={h} className="px-3 py-3 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#777]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { driver: "Hot CPI",     eq: "Negative",  rt: "Yields up",  fx: "USD up",   cm: "Mixed",    cr: "Wider",   active: (data?.macro.cpi?.price ?? 0) > 3 },
                    { driver: "Strong jobs", eq: "Mixed",     rt: "Yields up",  fx: "USD up",   cm: "Positive", cr: "Neutral", active: (data?.macro.unrate?.price ?? 5) < 4 },
                    { driver: "Weak growth", eq: "Negative",  rt: "Yields down",fx: "Mixed",    cm: "Negative", cr: "Wider",   active: (data?.macro.gdp?.price ?? 2) < 1.5 },
                    { driver: "Dovish Fed",  eq: "Positive",  rt: "Yields down",fx: "USD down", cm: "Positive", cr: "Tighter", active: (data?.yields.fedfunds?.price ?? 5) < 4 },
                  ].map((row) => {
                    const cellColor = (v: string) => {
                      const l = v.toLowerCase();
                      return l.includes("negative") || l.includes("wider") || l.includes("up")
                        ? "text-[#b42318]" : l.includes("positive") || l.includes("tighter") || l.includes("down")
                        ? "text-[#147a4f]" : "text-[#555]";
                    };
                    return (
                      <tr key={row.driver} className={`border-b border-[#f1eee8] last:border-0 ${row.active ? "bg-[#fbfaf7]" : ""}`}>
                        <td className="px-3 py-3 text-[11.5px] font-bold text-[#0a0a0a]">
                          {row.driver}
                          {row.active && <span className="ml-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0c1b38]">Active</span>}
                        </td>
                        {[row.eq, row.rt, row.fx, row.cm, row.cr].map((v, i) => (
                          <td key={i} className={`px-3 py-3 text-[11px] font-bold ${cellColor(v)}`}>{v}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Market Pressure Index — computed from live data */}
          <Card className="p-6">
            <SectionLabel>Market Pressure Index</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#999]">{data?.sources.fred ? "Computed from live VIX, HY OAS, yields, DXY, oil" : "Awaiting FRED connection"}</p>
            <div className="mt-5 h-[210px]">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <span className="text-[11px] text-[#bbb]">Loading…</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.pressureIndex ?? []} margin={{ top: 6, right: 0, bottom: 0, left: -24 }}>
                    <CartesianGrid stroke="#eee9df" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#777" }} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#777" }} />
                    <Tooltip
                      contentStyle={{ border: "1px solid #e8e3da", borderRadius: 0, fontSize: 12 }}
                      formatter={(v: unknown) => [`${Number(v)}/100`, "Pressure"]}
                    />
                    <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                      {(data?.pressureIndex ?? []).map((d, i) => (
                        <Cell key={i} fill={d.value > 70 ? NEGATIVE : d.value > 50 ? WARNING : NAVY} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <p className="mt-4 border-t border-[#eee9df] pt-4 text-[12px] font-medium leading-relaxed text-[#666]">
              {data?.sources.fred
                ? "Scores computed from VIX level, HY OAS, 10Y yield change, DXY momentum, and oil volatility."
                : "Connect FRED API to see computed pressure index."}
            </p>
          </Card>
        </div>

        {/* ── Today's Top Stories — live from NewsAPI ───────────────────── */}
        {(data?.topNews?.length ?? 0) > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <SectionLabel>Today's Top Stories</SectionLabel>
              <p className="text-[10px] text-[#9ca3af]">Live · NewsAPI · {updatedTime}</p>
            </div>
            <div className="grid grid-cols-4 gap-5">
              {data!.topNews.slice(0, 4).map((story, i) => (
                <div key={i} className="border-l border-[#e8e3da] pl-4 first:border-l-0 first:pl-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999] mb-1">{story.source}</p>
                  <p className="text-[13px] font-bold leading-snug text-[#0a0a0a] mb-3">{story.title}</p>
                  <p className="text-[11.5px] font-medium leading-relaxed text-[#666]">{story.description}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* No news — show placeholder only if NewsAPI is configured but returned nothing */}
        {data && !data.sources.newsapi && (
          <Card className="p-6">
            <SectionLabel>Today's Top Stories</SectionLabel>
            <p className="mt-3 text-[12px] text-[#bbb]">Add NEWS_API_KEY to Vercel to see live financial headlines here.</p>
          </Card>
        )}

      </main>
    </AppShell>
  );
}
