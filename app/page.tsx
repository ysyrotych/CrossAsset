"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Bar, BarChart, Brush, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────

type LiveQuote = { price: number; change: number; pct: number } | null;

// Quotes, analytics, news — fetched once on mount (tf-independent)
type DashData = {
  updatedAt: string;
  fredConnected: boolean;
  yields:    { dgs2: LiveQuote; dgs5: LiveQuote; dgs10: LiveQuote; dgs30: LiveQuote; fedfunds: LiveQuote };
  equities:  { sp500: LiveQuote; vix: LiveQuote; gold: LiveQuote; oil: LiveQuote; dxy: LiveQuote; nasdaq: LiveQuote; silver: LiveQuote };
  macro:     { cpi: LiveQuote; coreCpi: LiveQuote; pce: LiveQuote; unrate: LiveQuote; payems: LiveQuote; gdp: LiveQuote; hySpread: LiveQuote };
  extraData: { breakeven: LiveQuote; mortgage: LiveQuote; sentiment: LiveQuote; indpro: LiveQuote; retail: LiveQuote; t10y2y: LiveQuote; claims: LiveQuote };
  sectors:   { symbol: string; name: string; price: number; change: number; pct: number }[];
  forex:     { pair: string; label: string; price: number; change: number; pct: number }[];
  crypto:    { symbol: string; name: string; price: number; change: number; pct: number }[];
  global:    { symbol: string; name: string; region: string; price: number; change: number; pct: number }[];
  earnings:  { symbol: string; date: string; epsEstimate?: number; revenueEstimate?: number }[];
  econCalendar: { event: string; date: string; impact: string; estimate: string }[];
  finnhubNews: { headline: string; source: string; url?: string }[];
  topNews:   { title: string; source: string; description: string; url?: string }[];
  driverScores: { driver: string; score: number; direction: "hawkish" | "dovish" | "neutral"; trend: string; sensitivity: string }[];
  pressureIndex: { name: string; value: number }[];
  transmission: { label: string; state: string; pressure: "hawkish" | "dovish" | "neutral"; confidence: number }[];
  agreement: {
    confirming:    { signal: string; asset: string }[];
    contradicting: { signal: string; asset: string }[];
  };
  scenarios: { name: string; probability: number; tone: "positive" | "negative" | "neutral" }[];
  regimeLabel: string; regimeScore: number;
  sources: { fred: boolean; finnhub: boolean; newsapi: boolean };
};

// Chart history only — re-fetched on TF change, does NOT affect metric tiles
type ChartData = {
  tf: string;
  history:      { date: string; tenYear?: number; fiveYear?: number }[];
  historySP500:  { date: string; value: number }[];
  historyVIX:    { date: string; value: number }[];
  historyGold:   { date: string; value: number }[];
  historyOil:    { date: string; value: number }[];
  historyNasdaq: { date: string; value: number }[];
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

type ExpandedSeries = "sp500" | "nasdaq" | "vix" | "gold" | "oil" | null;

function fmtDate(iso: unknown): string {
  if (!iso || typeof iso !== "string") return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const [data,         setData]         = useState<DashData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [expanded,     setExpanded]     = useState<ExpandedSeries>(null);
  const [newsTab,      setNewsTab]      = useState<"headlines" | "earnings" | "calendar">("headlines");
  // Per-chart independent TF state — changing one does NOT affect the other
  const [ratesTf,      setRatesTf]      = useState<TF>("6M");
  const [equityTf,     setEquityTf]     = useState<TF>("6M");
  const [ratesChart,   setRatesChart]   = useState<ChartData | null>(null);
  const [equityChart,  setEquityChart]  = useState<ChartData | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [equityLoading,setEquityLoading]= useState(true);

  // Fetch quotes + analytics + news — runs once on mount only
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/dashboard-data");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: DashData = await r.json();
      setData(d);
      if (d.fredConnected) localStorage.setItem("crossasset_fred_live", "true");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Independent history fetchers — each chart manages its own TF
  const fetchRatesHistory = useCallback(async (t: TF) => {
    setRatesLoading(true);
    try {
      const r = await fetch(`/api/chart-history?tf=${t}`);
      if (!r.ok) return;
      setRatesChart(await r.json());
    } catch { /* silent */ } finally { setRatesLoading(false); }
  }, []);

  const fetchEquityHistory = useCallback(async (t: TF) => {
    setEquityLoading(true);
    try {
      const r = await fetch(`/api/chart-history?tf=${t}`);
      if (!r.ok) return;
      setEquityChart(await r.json());
    } catch { /* silent */ } finally { setEquityLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchRatesHistory(ratesTf); }, [ratesTf, fetchRatesHistory]);
  useEffect(() => { fetchEquityHistory(equityTf); }, [equityTf, fetchEquityHistory]);

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
                {loading ? "Connecting to FRED…" : data?.regimeLabel ?? "CrossAsset Dashboard"}
              </h1>
              <div className="mt-4 flex flex-wrap gap-6">
                {[
                  { label: "10Y", val: data?.yields.dgs10?.price,     sfx: "%",   dec: 2, inv: true,  chg: data?.yields.dgs10?.change },
                  { label: "S&P", val: data?.equities.sp500?.price,   sfx: "",    dec: 0, inv: false, chg: data?.equities.sp500?.pct },
                  { label: "VIX", val: data?.equities.vix?.price,     sfx: "",    dec: 1, inv: true,  chg: data?.equities.vix?.pct },
                  { label: "CPI", val: data?.macro.cpi?.price,        sfx: "%",   dec: 2, inv: true,  chg: data?.macro.cpi?.change },
                  { label: "HY OAS", val: data?.macro.hySpread?.price,sfx: "bps", dec: 0, inv: true,  chg: data?.macro.hySpread?.change },
                ].map(({ label, val, sfx, dec, inv, chg }) => {
                  const up = (chg ?? 0) > 0;
                  const color = val == null ? "#bbb" : (inv ? up : !up) ? NEGATIVE : POSITIVE;
                  return (
                    <div key={label}>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999]">{label}</p>
                      <p className="mt-0.5 text-[16px] font-bold tabular-nums text-[#0a0a0a]">
                        {val != null ? `${val.toFixed(dec)}${sfx}` : "—"}
                        {chg != null && chg !== 0 && (
                          <span className="ml-1 text-[11px] font-semibold" style={{ color }}>
                            {chg > 0 ? "+" : ""}{chg.toFixed(dec)}{sfx}
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
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
                onClick={() => { fetchData(); fetchRatesHistory(ratesTf); fetchEquityHistory(equityTf); }}
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

            <h2 className="text-[20px] font-bold leading-[1.2] tracking-tight text-[#0a0a0a]">
              {loading ? "—" : data?.regimeLabel ?? "—"}
            </h2>

            <div className="mt-5 space-y-0">
              {[
                { label: "10Y Yield",    val: data?.yields.dgs10?.price,        chg: data?.yields.dgs10?.change,      sfx: "%",   dec: 2, inv: true },
                { label: "2Y Yield",     val: data?.yields.dgs2?.price,         chg: data?.yields.dgs2?.change,       sfx: "%",   dec: 2, inv: true },
                { label: "Fed Funds",    val: data?.yields.fedfunds?.price,     chg: data?.yields.fedfunds?.change,   sfx: "%",   dec: 2, inv: false },
                { label: "CPI YoY",      val: data?.macro.cpi?.price,           chg: data?.macro.cpi?.change,         sfx: "%",   dec: 2, inv: true },
                { label: "Core CPI",     val: data?.macro.coreCpi?.price,       chg: data?.macro.coreCpi?.change,     sfx: "%",   dec: 2, inv: true },
                { label: "Unemployment", val: data?.macro.unrate?.price,        chg: data?.macro.unrate?.change,      sfx: "%",   dec: 1, inv: true },
                { label: "GDP growth",   val: data?.macro.gdp?.price,           chg: data?.macro.gdp?.change,         sfx: "%",   dec: 1, inv: false },
                { label: "HY OAS",       val: data?.macro.hySpread?.price,      chg: data?.macro.hySpread?.change,    sfx: "bps", dec: 0, inv: true },
              ].map(({ label, val, chg, sfx, dec, inv }) => {
                const up = (chg ?? 0) > 0;
                const color = val == null ? "#bbb" : chg == null || chg === 0 ? "#999" : (inv ? up : !up) ? NEGATIVE : POSITIVE;
                return (
                  <div key={label} className="flex items-center justify-between border-b border-[#f1eee8] py-2.5 last:border-0">
                    <p className="text-[12px] font-semibold text-[#555]">{label}</p>
                    <div className="flex items-center gap-3">
                      {chg != null && chg !== 0 && (
                        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
                          {chg > 0 ? "+" : ""}{chg.toFixed(dec)}{sfx}
                        </span>
                      )}
                      <p className="text-[14px] font-bold tabular-nums text-[#0a0a0a]">
                        {val != null ? `${val.toFixed(dec)}${sfx}` : "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
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
                    onClick={() => setRatesTf(r)}
                    className={`border px-2.5 py-1.5 text-[9.5px] font-bold uppercase transition-colors ${
                      ratesTf === r ? "border-[#0c1b38] bg-[#0c1b38] text-white" : "border-[#e8e3da] text-[#777] hover:border-[#0c1b38] hover:text-[#0c1b38]"
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
              {ratesLoading ? (
                <div className="h-full flex items-center justify-center">
                  <span className="text-[11px] text-[#bbb] tracking-widest uppercase">Loading chart…</span>
                </div>
              ) : !ratesChart?.history.length ? (
                <div className="h-full flex items-center justify-center">
                  <span className="text-[11px] text-[#bbb]">Chart data unavailable — check FRED_API_KEY</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ratesChart.history} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="#eee9df" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#777" }} interval="preserveStartEnd" tickFormatter={fmtDate} />
                    <YAxis domain={["auto", "auto"]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#777" }} tickFormatter={(v) => `${Number(v).toFixed(1)}%`} />
                    <Tooltip contentStyle={{ border: "1px solid #e8e3da", borderRadius: 0, fontSize: 12 }} formatter={(v: unknown) => [`${Number(v).toFixed(2)}%`]} labelFormatter={fmtDate} />
                    <Line type="monotone" dataKey="fiveYear"  name="5Y Treasury"  stroke="#6b7280" strokeWidth={2}   dot={false} connectNulls />
                    <Line type="monotone" dataKey="tenYear"   name="10Y Treasury" stroke={NEGATIVE} strokeWidth={2.2} dot={false} connectNulls />
                    <Brush dataKey="date" height={18} travellerWidth={6} stroke="#e8e3da" fill="#fbfaf7" tickFormatter={fmtDate} />
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

          {/* Market Headlines — tabbed: Headlines | Earnings | Calendar */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>Market Intelligence</SectionLabel>
              <p className="text-[9.5px] text-[#999]">{data?.sources.finnhub ? "Live · Finnhub" : "Add FINNHUB_API_KEY"}</p>
            </div>
            {/* Tab bar */}
            <div className="flex gap-0 border-b border-[#eee9df] mb-4">
              {(["headlines", "earnings", "calendar"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setNewsTab(tab)}
                  className={`px-3 py-2 text-[9.5px] font-bold uppercase tracking-[0.16em] border-b-2 -mb-px transition-colors ${
                    newsTab === tab
                      ? "border-[#0c1b38] text-[#0c1b38]"
                      : "border-transparent text-[#999] hover:text-[#555]"
                  }`}
                >
                  {tab === "headlines" ? "Headlines" : tab === "earnings" ? "Earnings" : "Calendar"}
                </button>
              ))}
            </div>
            {/* Headlines tab */}
            {newsTab === "headlines" && (
              <div className="space-y-0 overflow-y-auto max-h-[360px]">
                {loading ? (
                  <p className="text-[12px] text-[#bbb]">Loading…</p>
                ) : (data?.finnhubNews ?? []).length > 0 ? (
                  data!.finnhubNews.map((item, i) => (
                    <div key={i} className="border-b border-[#f1eee8] py-2.5 last:border-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#999]">{item.source}</p>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer" className="mt-0.5 block text-[12px] font-semibold leading-snug text-[#0a0a0a] hover:text-[#0c1b38] hover:underline cursor-pointer">{item.headline}</a>
                      ) : (
                        <p className="mt-0.5 text-[12px] font-semibold leading-snug text-[#0a0a0a]">{item.headline}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-[#bbb]">No headlines available</p>
                )}
              </div>
            )}
            {/* Earnings tab */}
            {newsTab === "earnings" && (
              <div className="overflow-y-auto max-h-[360px]">
                {loading ? (
                  <p className="text-[12px] text-[#bbb]">Loading…</p>
                ) : (data?.earnings ?? []).length > 0 ? (
                  <table className="w-full text-left">
                    <thead><tr className="border-b border-[#eee9df]">
                      {["Symbol", "Date", "EPS Est.", "Rev. Est."].map((h) => (
                        <th key={h} className="pb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#999]">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {data!.earnings.map((e, i) => (
                        <tr key={i} className="border-b border-[#f1eee8] last:border-0">
                          <td className="py-2 text-[12px] font-bold text-[#0c1b38]">{e.symbol}</td>
                          <td className="py-2 text-[11px] text-[#555]">{e.date}</td>
                          <td className="py-2 text-[11px] tabular-nums text-[#0a0a0a]">
                            {e.epsEstimate != null ? `$${e.epsEstimate.toFixed(2)}` : "—"}
                          </td>
                          <td className="py-2 text-[11px] tabular-nums text-[#0a0a0a]">
                            {e.revenueEstimate != null ? `$${(e.revenueEstimate / 1e9).toFixed(1)}B` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-[12px] text-[#bbb]">No earnings in next 7 days</p>
                )}
              </div>
            )}
            {/* Economic Calendar tab */}
            {newsTab === "calendar" && (
              <div className="overflow-y-auto max-h-[360px]">
                {loading ? (
                  <p className="text-[12px] text-[#bbb]">Loading…</p>
                ) : (data?.econCalendar ?? []).length > 0 ? (
                  <div className="space-y-0">
                    {data!.econCalendar.map((ev, i) => {
                      const impact = ev.impact?.toLowerCase();
                      const dotColor = impact === "high" ? NEGATIVE : impact === "medium" ? WARNING : "#bbb";
                      return (
                        <div key={i} className="flex items-start gap-3 border-b border-[#f1eee8] py-2.5 last:border-0">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-[#0a0a0a] leading-snug">{ev.event}</p>
                            <p className="text-[9.5px] text-[#999] mt-0.5">{ev.date}{ev.estimate ? ` · Est: ${ev.estimate}` : ""}</p>
                          </div>
                          <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: dotColor }}>{ev.impact}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#bbb]">No upcoming events</p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ── Equities Command Center ──────────────────────────────────── */}
        <div className="mb-5">
          <Card className="p-6">
            <div className="mb-5 flex items-start justify-between gap-6">
              <div>
                <SectionLabel>Equities Command Center</SectionLabel>
                <h3 className="mt-3 text-[21px] font-light leading-[1.2] tracking-tight text-[#0a0a0a]" style={{ fontFamily: "var(--font-serif)" }}>
                  {data?.equities.sp500
                    ? `S&P 500 at ${data.equities.sp500.price.toFixed(0)} — live from FRED`
                    : "Connecting to FRED…"}
                </h3>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {TF_LABELS.map((r) => (
                  <button key={r} onClick={() => setEquityTf(r)}
                    className={`border px-2.5 py-1.5 text-[9.5px] font-bold uppercase transition-colors ${
                      equityTf === r ? "border-[#0c1b38] bg-[#0c1b38] text-white" : "border-[#e8e3da] text-[#777] hover:border-[#0c1b38] hover:text-[#0c1b38]"
                    }`}>{r}</button>
                ))}
              </div>
            </div>

            {/* 5 clickable equity metric tiles */}
            <div className="mb-5 grid grid-cols-5 gap-3">
              {([
                { key: "sp500",  label: "S&P 500",  q: data?.equities.sp500,  note: "Click to expand", dec: 0 },
                { key: "nasdaq", label: "NASDAQ",   q: data?.equities.nasdaq, note: "Click to expand", dec: 0 },
                { key: "vix",    label: "VIX",      q: data?.equities.vix,    note: "Click to expand", dec: 1, inv: true },
                { key: "gold",   label: "Gold",     q: data?.equities.gold,   note: "Click to expand", dec: 0, pfx: "$" },
                { key: "oil",    label: "WTI Oil",  q: data?.equities.oil,    note: "Click to expand", dec: 2, pfx: "$" },
              ] as { key: ExpandedSeries; label: string; q: LiveQuote; note: string; dec: number; inv?: boolean; pfx?: string }[]).map(({ key, label, q, note, dec, inv, pfx }) => {
                const isActive = expanded === key;
                const up = (q?.change ?? 0) > 0;
                const color = q == null ? "#bbb" : (inv ? up : !up) ? NEGATIVE : POSITIVE;
                return (
                  <button key={key} onClick={() => setExpanded(isActive ? null : key)}
                    className={`border text-left px-3 py-3 transition-all cursor-pointer ${isActive ? "border-[#0c1b38] bg-[#0c1b38]" : "border-[#eee9df] bg-[#fbfaf7] hover:border-[#0c1b38]"}`}>
                    <MiniLabel><span className={isActive ? "text-[#aab]" : ""}>{label}</span></MiniLabel>
                    <p className={`mt-1 text-[18px] font-bold tabular-nums ${isActive ? "text-white" : "text-[#0a0a0a]"}`}>
                      {q != null ? `${pfx ?? ""}${q.price.toFixed(dec)}` : "—"}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold" style={{ color: isActive ? "#aab" : (q ? color : "#bbb") }}>
                      {q != null ? `${q.pct >= 0 ? "+" : ""}${q.pct.toFixed(2)}% · ` : ""}{note}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Expanded per-metric chart */}
            {expanded && (() => {
              const seriesMap: Record<NonNullable<ExpandedSeries>, { data: { date: string; value: number }[]; label: string; color: string; fmt: (v: number) => string }> = {
                sp500:  { data: equityChart?.historySP500  ?? [], label: "S&P 500",          color: NEGATIVE,  fmt: (v) => v.toFixed(0) },
                nasdaq: { data: equityChart?.historyNasdaq ?? [], label: "NASDAQ Composite",  color: "#7c3aed", fmt: (v) => v.toFixed(0) },
                vix:    { data: equityChart?.historyVIX    ?? [], label: "VIX",              color: WARNING,   fmt: (v) => v.toFixed(1) },
                gold:   { data: equityChart?.historyGold   ?? [], label: "Gold ($/troy oz)",  color: "#b7791f", fmt: (v) => `$${v.toFixed(0)}` },
                oil:    { data: equityChart?.historyOil    ?? [], label: "WTI Crude ($/bbl)", color: "#374151", fmt: (v) => `$${v.toFixed(2)}` },
              };
              const s = seriesMap[expanded];
              const vals = s.data.map((p) => p.value);
              const hi = vals.length ? Math.max(...vals) : 0;
              const lo = vals.length ? Math.min(...vals) : 0;
              const cur = s.data.length ? s.data[s.data.length - 1].value : 0;
              const chgPct = s.data[0]?.value > 0 ? ((cur - s.data[0].value) / s.data[0].value * 100) : 0;
              return (
                <div className="border-t border-[#eee9df] pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <p className="text-[13px] font-bold text-[#0a0a0a]">{s.label}</p>
                      <span className="text-[16px] font-bold tabular-nums text-[#0a0a0a]">{s.fmt(cur)}</span>
                      <span className={`text-[11px] font-bold tabular-nums ${chgPct >= 0 ? "text-[#147a4f]" : "text-[#b42318]"}`}>
                        {chgPct >= 0 ? "+" : ""}{chgPct.toFixed(2)}% ({equityTf})
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div><p className="text-[9px] font-bold uppercase tracking-widest text-[#999]">Period High</p><p className="text-[12px] font-bold text-[#147a4f]">{s.fmt(hi)}</p></div>
                      <div><p className="text-[9px] font-bold uppercase tracking-widest text-[#999]">Period Low</p><p className="text-[12px] font-bold text-[#b42318]">{s.fmt(lo)}</p></div>
                      <button onClick={() => setExpanded(null)} className="text-[11px] font-bold text-[#999] hover:text-[#0a0a0a] ml-4">✕ Close</button>
                    </div>
                  </div>
                  <div className="h-[280px]">
                    {!s.data.length ? (
                      <div className="h-full flex items-center justify-center"><span className="text-[12px] text-[#bbb]">No data available</span></div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={s.data} margin={{ top: 6, right: 8, bottom: 20, left: 8 }}>
                          <CartesianGrid stroke="#eee9df" vertical={false} />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#777" }} interval="preserveStartEnd" tickFormatter={fmtDate} />
                          <YAxis domain={["auto", "auto"]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#777" }} tickFormatter={(v) => s.fmt(Number(v))} width={56} />
                          <Tooltip contentStyle={{ border: "1px solid #e8e3da", borderRadius: 0, fontSize: 12 }} formatter={(v: unknown) => [s.fmt(Number(v)), s.label]} labelFormatter={fmtDate} />
                          <Line type="monotone" dataKey="value" name={s.label} stroke={s.color} strokeWidth={2.2} dot={false} connectNulls />
                          <Brush dataKey="date" height={22} travellerWidth={8} stroke="#e8e3da" fill="#fbfaf7" tickFormatter={fmtDate} startIndex={0} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-[#bbb]">Drag the handles at the bottom to zoom into a time range · Click a tile above to switch series</p>
                </div>
              );
            })()}

            {/* S&P 500 overview chart when nothing is expanded */}
            {!expanded && (
              <div className="h-[200px]">
                {equityLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-[11px] text-[#bbb] tracking-widest uppercase">Loading chart…</span>
                  </div>
                ) : !equityChart?.historySP500?.length ? (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-[11px] text-[#bbb]">SP500 history unavailable</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equityChart.historySP500} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid stroke="#eee9df" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#777" }} interval="preserveStartEnd" tickFormatter={fmtDate} />
                      <YAxis domain={["auto", "auto"]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#777" }} tickFormatter={(v) => Number(v) >= 1000 ? `${(Number(v)/1000).toFixed(1)}K` : String(v)} width={48} />
                      <Tooltip contentStyle={{ border: "1px solid #e8e3da", borderRadius: 0, fontSize: 12 }} formatter={(v: unknown) => [Number(v).toFixed(0), "S&P 500"]} labelFormatter={fmtDate} />
                      <Line type="monotone" dataKey="value" name="S&P 500" stroke={NEGATIVE} strokeWidth={2.2} dot={false} connectNulls />
                      <Brush dataKey="date" height={18} travellerWidth={6} stroke="#e8e3da" fill="#fbfaf7" tickFormatter={fmtDate} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ── Sector Performance ───────────────────────────────────────── */}
        {(data?.sectors?.length ?? 0) > 0 && (
          <div className="mb-5">
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <SectionLabel>Sector Performance</SectionLabel>
                <p className="text-[9.5px] text-[#999]">Live · Finnhub · S&P 500 sector ETFs</p>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {(data?.sectors ?? []).map((s) => {
                  const up = s.pct >= 0;
                  const absPct = Math.abs(s.pct);
                  const intensity = Math.min(absPct / 3, 1); // 0→0%, 3%→100% intensity
                  const bg = up
                    ? `rgba(20,122,79,${0.06 + intensity * 0.18})`
                    : `rgba(180,35,24,${0.06 + intensity * 0.18})`;
                  const border = up ? "rgba(20,122,79,0.25)" : "rgba(180,35,24,0.25)";
                  const color = up ? POSITIVE : NEGATIVE;
                  return (
                    <div key={s.symbol} className="px-3 py-3 text-center" style={{ background: bg, border: `1px solid ${border}` }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0c1b38]">{s.symbol}</p>
                      <p className="mt-0.5 text-[9px] font-semibold text-[#777]">{s.name}</p>
                      <p className="mt-2 text-[13px] font-bold tabular-nums text-[#0a0a0a]">${s.price.toFixed(2)}</p>
                      <p className="mt-0.5 text-[12px] font-bold tabular-nums" style={{ color }}>
                        {up ? "+" : ""}{s.pct.toFixed(2)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ── Fed Rate Change Probability Matrix ───────────────────────── */}
        <div className="mb-5">
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <SectionLabel>Fed Rate Change Probability Matrix</SectionLabel>
                <p className="mt-1 text-[9.5px] text-[#999]">
                  Derived from live CPI, unemployment, yield curve, and fed funds data · Model-based estimate
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#999]">Current Rate</p>
                <p className="text-[18px] font-bold tabular-nums text-[#0c1b38]">
                  {data?.yields.fedfunds ? `${data.yields.fedfunds.price.toFixed(2)}%` : "—"}
                </p>
              </div>
            </div>
            {(() => {
              const cpi     = data?.macro.cpi?.price ?? 3;
              const unrate  = data?.macro.unrate?.price ?? 4.2;
              const ff      = data?.yields.fedfunds?.price ?? 4.33;
              const t10y2y  = data?.extraData.t10y2y?.price ?? 0;
              const hyOas   = data?.macro.hySpread?.price ?? 350;

              // Model inputs → cut/hike bias
              const inflationPressure = Math.max(0, (cpi - 2) / 3);       // 0 at target, 1 at 5%
              const laborSlack        = Math.max(0, (unrate - 4) / 2);    // 0 at 4%, 1 at 6%
              const curveInversion    = t10y2y < -0.1 ? 0.25 : 0;
              const creditStress      = hyOas > 500 ? 0.15 : 0;
              // Positive cutBias = more likely to cut
              const cutBias = laborSlack * 0.5 + curveInversion + creditStress - inflationPressure * 0.4;

              const meetings = [
                { label: "Jul 29 FOMC", lag: 0 },
                { label: "Sep 17 FOMC", lag: 1 },
                { label: "Nov 5 FOMC",  lag: 2 },
                { label: "Dec 10 FOMC", lag: 3 },
              ];

              const rows = meetings.map((m) => {
                const bias = cutBias + m.lag * 0.08;
                const pHike = cpi > 3.8 && ff < 5.5 ? Math.max(0, Math.min(30, (cpi - 3.5) * 25)) : 0;
                const pCut  = Math.max(0, Math.min(85, 20 + bias * 50));
                const pHold = Math.max(5, 100 - Math.round(pCut) - Math.round(pHike));
                return {
                  meeting: m.label,
                  pHike:   Math.round(pHike),
                  pHold:   Math.round(pHold),
                  pCut:    Math.round(pCut),
                };
              });

              return (
                <div>
                  <div className="overflow-hidden border border-[#eee9df]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-[#fbfaf7] border-b border-[#eee9df]">
                          <th className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#777]">Meeting</th>
                          <th className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#147a4f]">Cut (−25bps)</th>
                          <th className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#555]">Hold</th>
                          <th className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#b42318]">Hike (+25bps)</th>
                          <th className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#777]">Signal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(loading ? [] : rows).map((row, i) => {
                          const dominant = row.pCut > row.pHold && row.pCut > row.pHike ? "cut"
                            : row.pHike > row.pHold ? "hike" : "hold";
                          return (
                            <tr key={i} className="border-b border-[#f1eee8] last:border-0">
                              <td className="px-4 py-3 text-[12px] font-bold text-[#0a0a0a]">{row.meeting}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-[5px] bg-[#eee9df]">
                                    <div className="h-full bg-[#147a4f]" style={{ width: `${row.pCut}%` }} />
                                  </div>
                                  <span className="text-[12px] font-bold tabular-nums text-[#147a4f]">{row.pCut}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-[5px] bg-[#eee9df]">
                                    <div className="h-full bg-[#555]" style={{ width: `${row.pHold}%` }} />
                                  </div>
                                  <span className="text-[12px] font-bold tabular-nums text-[#555]">{row.pHold}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-[5px] bg-[#eee9df]">
                                    <div className="h-full bg-[#b42318]" style={{ width: `${row.pHike}%` }} />
                                  </div>
                                  <span className="text-[12px] font-bold tabular-nums text-[#b42318]">{row.pHike}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[9.5px] font-bold uppercase tracking-[0.1em] px-2 py-1 border ${
                                  dominant === "cut"  ? "text-[#147a4f] bg-[#f4fbf7] border-[#cfe8da]" :
                                  dominant === "hike" ? "text-[#b42318] bg-[#fff7f5] border-[#f2d2cc]" :
                                                        "text-[#555] bg-[#faf8f3] border-[#eee9df]"
                                }`}>{dominant}</span>
                              </td>
                            </tr>
                          );
                        })}
                        {loading && (
                          <tr><td colSpan={5} className="px-4 py-4 text-[12px] text-[#bbb]">Computing from FRED data…</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 grid grid-cols-5 gap-4 border-t border-[#eee9df] pt-4">
                    {[
                      { label: "CPI YoY",     val: cpi.toFixed(1) + "%",    note: cpi > 3 ? "Above target" : "Near target" },
                      { label: "Unemployment", val: unrate.toFixed(1) + "%", note: unrate > 4.5 ? "Labor loosening" : "Labor tight" },
                      { label: "2s10s Slope",  val: (t10y2y >= 0 ? "+" : "") + t10y2y.toFixed(2) + "%", note: t10y2y < 0 ? "Inverted" : "Normal" },
                      { label: "HY OAS",       val: (data?.macro.hySpread?.price ?? 0).toFixed(0) + "bps", note: hyOas > 450 ? "Credit stress" : "Benign" },
                      { label: "Fed Funds",    val: ff.toFixed(2) + "%",     note: ff > 4.5 ? "Restrictive" : "Neutral" },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#999]">{item.label}</p>
                        <p className="mt-1 text-[14px] font-bold tabular-nums text-[#0c1b38]">{loading ? "—" : item.val}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-[#777]">{loading ? "" : item.note}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-[#bbb] leading-relaxed">
                    Methodology: Probabilities derived from a rule-based model using live CPI relative to 2% target, labor market slack (unemployment above/below 4%), yield curve slope, credit spreads, and Fed Funds vs neutral rate. Not a market-implied probability — for directional context only.
                  </p>
                </div>
              );
            })()}
          </Card>
        </div>

        {/* ── Layer 3: Edge · Scenarios · Macro metrics ────────────────── */}
        <div className="mb-5 grid grid-cols-[1.15fr_0.95fr_0.9fr] gap-5">

          {/* Global Data Snapshot — extra FRED series */}
          <Card className="p-6">
            <SectionLabel>Global Data Snapshot</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#999]">{data?.sources.fred ? "Live · FRED" : "Add FRED_API_KEY to Vercel"}</p>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-0">
              {[
                { label: "10Y Breakeven",     val: data?.extraData?.breakeven?.price,  chg: data?.extraData?.breakeven?.change,  sfx: "%",   dec: 2 },
                { label: "PCE YoY",           val: data?.macro?.pce?.price,            chg: data?.macro?.pce?.change,            sfx: "%",   dec: 2 },
                { label: "30Y Mortgage",      val: data?.extraData?.mortgage?.price,   chg: data?.extraData?.mortgage?.change,   sfx: "%",   dec: 2 },
                { label: "2s10s (FRED)",      val: data?.extraData?.t10y2y?.price,     chg: data?.extraData?.t10y2y?.change,     sfx: "%",   dec: 2 },
                { label: "Retail Sales MoM",  val: data?.extraData?.retail?.pct,       chg: null,                                sfx: "%",   dec: 2 },
                { label: "Initial Claims",    val: data?.extraData?.claims?.price,     chg: data?.extraData?.claims?.change,     sfx: "K",   dec: 0 },
                { label: "Indus. Production", val: data?.extraData?.indpro?.pct,       chg: null,                                sfx: "%",   dec: 2 },
                { label: "Consumer Sentiment",val: data?.extraData?.sentiment?.price,  chg: data?.extraData?.sentiment?.change,  sfx: "",    dec: 1 },
              ].map(({ label, val, chg, sfx, dec }) => {
                const up = (chg ?? 0) > 0;
                const chgColor = chg == null || chg === 0 ? "#bbb" : up ? NEGATIVE : POSITIVE;
                return (
                  <div key={label} className="flex items-center justify-between border-b border-[#f1eee8] py-2.5">
                    <p className="text-[11px] font-semibold text-[#555]">{label}</p>
                    <div className="text-right">
                      <span className="text-[13px] font-bold tabular-nums text-[#0a0a0a]">
                        {val != null ? `${val.toFixed(dec)}${sfx}` : "—"}
                      </span>
                      {chg != null && chg !== 0 && (
                        <span className="ml-2 text-[10px] font-bold tabular-nums" style={{ color: chgColor }}>
                          {chg > 0 ? "+" : ""}{chg.toFixed(dec)}{sfx}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
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
                { label: "HY OAS",            val: data?.macro.hySpread?.price, chg: data?.macro.hySpread?.change, suffix: "bps", dec: 0 },
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

          {/* Fear & Greed Gauge */}
          <Card className="p-6">
            <SectionLabel>Fear & Greed Index</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#999]">Computed · VIX · HY OAS · Yield Curve</p>
            {(() => {
              const vix    = data?.equities.vix?.price ?? 20;
              const hyOas  = data?.macro.hySpread?.price ?? 350;
              const t10y2y = data?.extraData.t10y2y?.price ?? 0;
              const vixScore   = Math.max(0, Math.min(100, ((35 - vix)    / 23) * 100));
              const hyScore    = Math.max(0, Math.min(100, ((600 - hyOas) / 400) * 100));
              const curveScore = Math.max(0, Math.min(100, ((t10y2y + 0.5) / 1.5) * 100));
              const score = loading ? 50 : Math.round((vixScore + hyScore + curveScore) / 3);
              const label = score >= 75 ? "Extreme Greed" : score >= 55 ? "Greed" : score >= 45 ? "Neutral" : score >= 25 ? "Fear" : "Extreme Fear";
              const gaugeColor = score >= 55 ? POSITIVE : score >= 45 ? "#b7791f" : NEGATIVE;
              // SVG arc gauge: half-circle 0=left(fear) to 180=right(greed)
              const r = 72; const cx = 100; const cy = 90;
              const angleDeg = (score / 100) * 180 - 90; // -90=left, +90=right
              const rad = (angleDeg * Math.PI) / 180;
              const nx = cx + r * Math.cos(rad); const ny = cy + r * Math.sin(rad);
              const zones = [
                { color: "#b42318", pct: 0.25 },
                { color: "#e57a3b", pct: 0.25 },
                { color: "#b7791f", pct: 0.2 },
                { color: "#5f9e6e", pct: 0.15 },
                { color: "#147a4f", pct: 0.15 },
              ];
              // Arc path helper
              const arc = (startAngle: number, endAngle: number) => {
                const s = ((startAngle - 90) * Math.PI) / 180;
                const e = ((endAngle - 90) * Math.PI) / 180;
                const x1 = cx + r * Math.cos(s); const y1 = cy + r * Math.sin(s);
                const x2 = cx + r * Math.cos(e); const y2 = cy + r * Math.sin(e);
                return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
              };
              let accPct = 0;
              return (
                <div className="flex flex-col items-center mt-4">
                  <svg viewBox="0 0 200 100" className="w-full max-w-[220px]">
                    {zones.map((z, i) => {
                      const startDeg = accPct * 180;
                      accPct += z.pct;
                      const endDeg = accPct * 180;
                      return <path key={i} d={arc(startDeg, endDeg)} fill="none" stroke={z.color} strokeWidth={12} strokeLinecap="butt" opacity={0.22} />;
                    })}
                    {/* Active arc */}
                    <path d={arc(0, score * 1.8)} fill="none" stroke={gaugeColor} strokeWidth={12} strokeLinecap="butt" opacity={0.9} />
                    {/* Needle */}
                    <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#0c1b38" strokeWidth={2} strokeLinecap="round" />
                    <circle cx={cx} cy={cy} r={4} fill="#0c1b38" />
                    {/* Score text */}
                    <text x={cx} y={cy - 14} textAnchor="middle" fontSize={22} fontWeight="bold" fill="#0a0a0a">{loading ? "—" : score}</text>
                  </svg>
                  <p className="mt-2 text-[15px] font-bold tracking-wide" style={{ color: gaugeColor }}>{loading ? "…" : label}</p>
                  <div className="mt-4 w-full space-y-1.5 border-t border-[#eee9df] pt-4">
                    {[
                      { label: "VIX Sentiment", value: Math.round(vixScore), note: `VIX ${vix.toFixed(1)}` },
                      { label: "Credit Stress",  value: Math.round(hyScore),  note: `HY OAS ${hyOas.toFixed(0)}bps` },
                      { label: "Yield Curve",    value: Math.round(curveScore), note: `2Y–10Y ${t10y2y >= 0 ? "+" : ""}${t10y2y.toFixed(2)}%` },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-2">
                        <p className="w-28 text-[10px] font-semibold text-[#777] shrink-0">{row.label}</p>
                        <div className="flex-1 h-[5px] bg-[#eee9df]">
                          <div className="h-full" style={{ width: `${loading ? 50 : row.value}%`, backgroundColor: row.value >= 55 ? POSITIVE : row.value >= 45 ? WARNING : NEGATIVE }} />
                        </div>
                        <p className="w-20 text-right text-[10px] tabular-nums text-[#999] shrink-0">{loading ? "…" : row.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>

        {/* ── Layer 5: Currency Matrix + Commodities ───────────────────── */}
        <div className="mb-5 grid grid-cols-2 gap-5">

          {/* Currency Matrix */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <SectionLabel>Currency Matrix</SectionLabel>
              <p className="text-[9.5px] text-[#999]">Live · Finnhub · OANDA</p>
            </div>
            {(data?.forex ?? []).length > 0 ? (
              <div className="space-y-0">
                {(data!.forex).map((f) => {
                  const up = f.pct >= 0;
                  const color = up ? POSITIVE : NEGATIVE;
                  return (
                    <div key={f.pair} className="flex items-center justify-between border-b border-[#f1eee8] py-2.5 last:border-0">
                      <div>
                        <p className="text-[12px] font-bold text-[#0a0a0a]">{f.label}</p>
                        <p className="text-[9.5px] text-[#999] mt-0.5">{f.pair}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-bold tabular-nums text-[#0a0a0a]">{f.price.toFixed(4)}</p>
                        <p className="text-[11px] font-bold tabular-nums mt-0.5" style={{ color }}>
                          {up ? "+" : ""}{f.pct.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-[#bbb]">{loading ? "Loading…" : "No forex data — check FINNHUB_API_KEY"}</p>
            )}
          </Card>

          {/* Commodities Panel */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <SectionLabel>Commodities</SectionLabel>
              <p className="text-[9.5px] text-[#999]">Live · Finnhub OANDA + FRED</p>
            </div>
            <div className="space-y-0">
              {[
                { label: "Gold",   sub: "XAU/USD · spot",      q: data?.equities.gold,   prefix: "$",  dec: 2 },
                { label: "Silver", sub: "XAG/USD · spot",      q: data?.equities.silver, prefix: "$",  dec: 3 },
                { label: "WTI Oil",sub: "Crude Oil · USD/bbl", q: data?.equities.oil,    prefix: "$",  dec: 2 },
              ].map((row) => {
                const up = (row.q?.pct ?? 0) >= 0;
                const color = row.q ? (up ? POSITIVE : NEGATIVE) : "#bbb";
                return (
                  <div key={row.label} className="flex items-center justify-between border-b border-[#f1eee8] py-3 last:border-0">
                    <div>
                      <p className="text-[12px] font-bold text-[#0a0a0a]">{row.label}</p>
                      <p className="text-[9.5px] text-[#999] mt-0.5">{row.sub}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-bold tabular-nums text-[#0a0a0a]">
                        {row.q != null ? `${row.prefix}${row.q.price.toFixed(row.dec)}` : "—"}
                      </p>
                      {row.q && (
                        <p className="text-[11px] font-bold tabular-nums mt-0.5" style={{ color }}>
                          {up ? "+" : ""}{row.q.pct.toFixed(2)}%
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ── Layer 6: Crypto + Global Indices ─────────────────────────── */}
        <div className="mb-5 grid grid-cols-2 gap-5">

          {/* Crypto Panel */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <SectionLabel>Crypto Markets</SectionLabel>
              <p className="text-[9.5px] text-[#999]">Live · Finnhub · Binance</p>
            </div>
            {(data?.crypto ?? []).length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {(data!.crypto).map((c) => {
                  const up = c.pct >= 0;
                  const color = up ? POSITIVE : NEGATIVE;
                  const bg = up ? "rgba(20,122,79,0.06)" : "rgba(180,35,24,0.06)";
                  const border = up ? "rgba(20,122,79,0.2)" : "rgba(180,35,24,0.2)";
                  return (
                    <div key={c.symbol} className="px-4 py-3" style={{ background: bg, border: `1px solid ${border}` }}>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0c1b38]">{c.symbol}</p>
                      <p className="text-[9px] text-[#999] mt-0.5">{c.name}</p>
                      <p className="mt-2 text-[16px] font-bold tabular-nums text-[#0a0a0a]">
                        {c.price >= 1000 ? `$${(c.price / 1000).toFixed(2)}K` : `$${c.price.toFixed(2)}`}
                      </p>
                      <p className="text-[12px] font-bold tabular-nums mt-0.5" style={{ color }}>
                        {up ? "+" : ""}{c.pct.toFixed(2)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-[#bbb]">{loading ? "Loading…" : "No crypto data — check FINNHUB_API_KEY"}</p>
            )}
          </Card>

          {/* Global Indices */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <SectionLabel>Global Indices</SectionLabel>
              <p className="text-[9.5px] text-[#999]">Live · Finnhub · ETF proxies</p>
            </div>
            {(data?.global ?? []).length > 0 ? (
              <div className="space-y-0">
                {(data!.global).map((g) => {
                  const up = g.pct >= 0;
                  const color = up ? POSITIVE : NEGATIVE;
                  return (
                    <div key={g.symbol} className="flex items-center justify-between border-b border-[#f1eee8] py-2.5 last:border-0">
                      <div>
                        <p className="text-[12px] font-bold text-[#0a0a0a]">{g.name}</p>
                        <p className="text-[9.5px] text-[#999] mt-0.5">{g.region}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-bold tabular-nums text-[#0a0a0a]">${g.price.toFixed(2)}</p>
                        <p className="text-[11px] font-bold tabular-nums mt-0.5" style={{ color }}>
                          {up ? "+" : ""}{g.pct.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-[#bbb]">{loading ? "Loading…" : "No global data — check FINNHUB_API_KEY"}</p>
            )}
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
              {data!.topNews.slice(0, 8).map((story, i) => (
                <div key={i} className={`${i % 4 !== 0 ? "border-l border-[#e8e3da] pl-4" : ""} ${i >= 4 ? "mt-5 pt-5 border-t border-[#e8e3da]" : ""}`}>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999] mb-1">{story.source}</p>
                  {story.url ? (
                    <a href={story.url} target="_blank" rel="noreferrer" className="block text-[13px] font-bold leading-snug text-[#0a0a0a] mb-3 hover:text-[#0c1b38] hover:underline cursor-pointer">{story.title}</a>
                  ) : (
                    <p className="text-[13px] font-bold leading-snug text-[#0a0a0a] mb-3">{story.title}</p>
                  )}
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
