"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import CrossAssetLogo from "@/components/layout/CrossAssetLogo";
import { Newspaper, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
  equities:  { sp500: LiveQuote; vix: LiveQuote; gold: LiveQuote; oil: LiveQuote; dxy: LiveQuote; nasdaq: LiveQuote; silver: LiveQuote; dow: LiveQuote };
  macro:     { cpi: LiveQuote; coreCpi: LiveQuote; pce: LiveQuote; unrate: LiveQuote; payems: LiveQuote; gdp: LiveQuote; hySpread: LiveQuote };
  extraData: { breakeven: LiveQuote; mortgage: LiveQuote; sentiment: LiveQuote; indpro: LiveQuote; retail: LiveQuote; t10y2y: LiveQuote; claims: LiveQuote };
  sectors:   { symbol: string; name: string; price: number; change: number; pct: number }[];
  forex:     { pair: string; label: string; price: number; change: number; pct: number }[];
  crypto:    { symbol: string; name: string; price: number; change: number; pct: number }[];
  global:    { symbol: string; name: string; region: string; price: number; change: number; pct: number }[];
  earnings:  { symbol: string; date: string; epsEstimate?: number; revenueEstimate?: number }[];
  econCalendar: { event: string; date: string; impact: string; estimate: string }[];
  fedwatch: { date: string; label: string; cutProb: number; holdProb: number; hikeProb: number; impliedRate: number }[];
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
  historyDow:    { date: string; value: number }[];
};

// Morning data — Yahoo-sourced symbol quotes powering the personal/actionable layer
// (regime badge, US futures, Portfolio Pulse, AI Morning Brief)
type Quote = {
  symbol: string; name: string; price: number; change: number;
  changePct: number; prev: number; high52w: number; low52w: number;
};
type MorningNews = {
  id: number; headline: string; source: string;
  summary: string; datetime: number; related: string; url: string;
};
type MorningEarnings = { symbol: string; date: string; epsEstimate: number | null; hour: string };
type MorningCalEvent = { date: string; label: string; category: string; impact: string; previous?: string };
type Morning = {
  ts: string;
  quotes: Record<string, Quote>;
  spChart: { t: number; v: number }[];
  news: MorningNews[];
  earnings: MorningEarnings[];
  upcomingEvents: MorningCalEvent[];
};

// ── Constants ──────────────────────────────────────────────────────────────

const NAVY     = "#0c1b38";
const NEGATIVE = "#b42318";
const POSITIVE = "#147a4f";
const WARNING  = "#b7791f";
const TF_LABELS = ["1M", "3M", "6M", "1Y", "FOMC"] as const;
type TF = typeof TF_LABELS[number];

// Personal portfolio + AI-brief context symbols
const PORTFOLIO  = ["META","UBER","DUOL","VOO","AMZN","PYPL","APLD","AAPL","CMG","ONT","HOOD","NVDA","VUG"];
const AI_NAMES   = new Set(["NVDA","APLD","META","AMZN","AAPL","DUOL"]);
const RATE_NAMES = new Set(["PYPL","HOOD","APLD"]);
const FUTURES = [
  { sym: "ES=F",  label: "S&P 500" },
  { sym: "NQ=F",  label: "Nasdaq 100" },
  { sym: "RTY=F", label: "Russell 2000" },
  { sym: "YM=F",  label: "Dow Jones" },
];
const AI_SECTORS = [
  { sym: "XLK",  label: "Technology" }, { sym: "XLC",  label: "Comms" },
  { sym: "XLY",  label: "Cons Disc" },  { sym: "XLF",  label: "Financials" },
  { sym: "XLV",  label: "Healthcare" }, { sym: "XLI",  label: "Industrials" },
  { sym: "XLE",  label: "Energy" },     { sym: "XLB",  label: "Materials" },
  { sym: "XLRE", label: "Real Estate" },{ sym: "XLU",  label: "Utilities" },
  { sym: "XLP",  label: "Staples" },
];

// Morning helpers
const gc = (p: number) => (p > 0 ? POSITIVE : p < 0 ? NEGATIVE : "#999");
const gb = (p: number) => (p > 0 ? "#f0faf4" : p < 0 ? "#fff5f5" : "#fafafa");
const pp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fp = (n: number) => n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toFixed(2);

function regime(q: Record<string, Quote>) {
  const sp  = q["ES=F"]?.changePct     ?? 0;
  const vix = q["^VIX"]?.changePct     ?? 0;
  const t10 = q["^TNX"]?.change        ?? 0;
  const gld = q["GC=F"]?.changePct     ?? 0;
  const dxy = q["DX-Y.NYB"]?.changePct ?? 0;
  const oil = q["CL=F"]?.changePct     ?? 0;
  if (sp < -1    && t10 > 0.03) return { label: "Rates-Led Selloff",  c: NEGATIVE,  bg: "#fff5f5" };
  if (sp > 1.2   && vix < -5)   return { label: "Risk-On Melt-Up",    c: POSITIVE,  bg: "#f0faf4" };
  if (sp < -0.5  && gld > 0.8)  return { label: "Defensive Flight",   c: "#92400e", bg: "#fef9f0" };
  if (oil > 2.5)                 return { label: "Commodity Shock",    c: "#92400e", bg: "#fef9f0" };
  if (dxy > 0.5  && sp < 0)     return { label: "Dollar Squeeze",     c: NEGATIVE,  bg: "#fff5f5" };
  if (sp > 0.5   && vix < -3)   return { label: "Risk-On Grind",      c: POSITIVE,  bg: "#f0faf4" };
  if (Math.abs(sp) < 0.25)      return { label: "Consolidation",      c: "#888",    bg: "#fafafa" };
  if (sp > 0)                    return { label: "Cautiously Bullish", c: POSITIVE,  bg: "#f0faf4" };
  return                                { label: "Cautiously Bearish", c: NEGATIVE,  bg: "#fff5f5" };
}

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

// Compact quote tile — US futures + portfolio
function Tile({ q, label, pStr }: { q: Quote | undefined; label: string; pStr?: string }) {
  if (!q) return (
    <div className="border border-[#eee9df] rounded-lg px-3 py-3 flex flex-col gap-1 bg-[#fbfaf7]">
      <p className="text-[9.5px] font-semibold text-[#ccc] uppercase tracking-wider truncate">{label}</p>
      <p className="text-[18px] font-light text-[#ddd]">—</p>
    </div>
  );
  const col = gc(q.changePct);
  return (
    <div className="border border-[#eee9df] rounded-lg px-3 py-3 flex flex-col gap-1 transition-colors"
         style={{ backgroundColor: gb(q.changePct) }}>
      <p className="text-[9.5px] font-semibold text-[#999] uppercase tracking-wider truncate">{label}</p>
      <p className="text-[18px] font-semibold text-[#0a0a0a] tabular-nums leading-tight">{pStr ?? fp(q.price)}</p>
      <div className="flex items-center gap-1.5">
        {q.changePct > 0 ? <TrendingUp size={10} color={col} />
          : q.changePct < 0 ? <TrendingDown size={10} color={col} />
          : <Minus size={10} color="#bbb" />}
        <span className="text-[11px] font-bold tabular-nums" style={{ color: col }}>{pp(q.changePct)}</span>
        <span className="text-[10px] text-[#c0c0c0] tabular-nums">
          ({q.change >= 0 ? "+" : ""}{Math.abs(q.change) < 10 ? q.change.toFixed(3) : q.change.toFixed(2)})
        </span>
      </div>
    </div>
  );
}

// AI brief body — lightweight markdown renderer
function BriefBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  const renderInline = (s: string, key: number): React.ReactNode => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={key}>
        {parts.map((p, i) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={i} className="font-semibold text-[#0a0a0a]">{p.slice(2, -2)}</strong>
            : p
        )}
      </span>
    );
  };
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      nodes.push(<div key={i} className="h-3" />);
    } else if (trimmed.startsWith("**") && trimmed.endsWith("**") && !trimmed.slice(2, -2).includes("**")) {
      nodes.push(<p key={i} className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#0c1b38] mt-5 mb-2 first:mt-0">{trimmed.slice(2, -2)}</p>);
    } else if (trimmed.startsWith("Subject:")) {
      nodes.push(<p key={i} className="text-[12px] font-semibold text-[#0c1b38] mb-3 bg-[#eef1f8] border border-[#c8d0e8] px-3 py-2 rounded-md">{trimmed}</p>);
    } else if (trimmed.startsWith("• ") || trimmed.startsWith("- ")) {
      nodes.push(
        <div key={i} className="flex items-start gap-2 py-0.5">
          <span className="w-1 h-1 rounded-full bg-[#0c1b38] mt-[7px] shrink-0" />
          <p className="text-[12.5px] text-[#333] leading-[1.7]">{renderInline(trimmed.slice(2), i)}</p>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\./)?.[1] ?? "";
      nodes.push(
        <div key={i} className="flex items-start gap-2.5 py-0.5">
          <span className="text-[10px] font-bold text-[#0c1b38] mt-[3px] w-4 shrink-0">{num}.</span>
          <p className="text-[12.5px] text-[#333] leading-[1.7]">{renderInline(trimmed.replace(/^\d+\.\s*/, ""), i)}</p>
        </div>
      );
    } else if (trimmed.startsWith("---")) {
      nodes.push(<hr key={i} className="border-[#ebebeb] my-3" />);
    } else {
      nodes.push(<p key={i} className="text-[12.5px] text-[#1a1a1a] leading-[1.8]">{renderInline(trimmed, i)}</p>);
    }
  });
  return <div className="space-y-[2px]">{nodes}</div>;
}

// ── Main page ──────────────────────────────────────────────────────────────

type ExpandedSeries = "sp500" | "nasdaq" | "dow" | "vix" | "gold" | "oil" | null;

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
  // Morning data (Yahoo) — powers regime badge, futures, portfolio, AI brief
  const [morning,      setMorning]      = useState<Morning | null>(null);
  const [brief,        setBrief]        = useState("");
  const [briefType,    setBriefType]    = useState<"exec" | "full" | "email" | null>(null);
  const [generating,   setGenerating]   = useState(false);

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

  // Morning data (Yahoo symbol quotes) — independent of dashboard-data
  const fetchMorning = useCallback(async () => {
    try {
      const r = await fetch("/api/morning-data", { cache: "no-store" });
      if (!r.ok) return;
      setMorning(await r.json() as Morning);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchMorning(); }, [fetchMorning]);
  useEffect(() => { fetchRatesHistory(ratesTf); }, [ratesTf, fetchRatesHistory]);
  useEffect(() => { fetchEquityHistory(equityTf); }, [equityTf, fetchEquityHistory]);

  // Auto-refresh all data every 60 minutes
  useEffect(() => {
    const id = setInterval(() => {
      fetchData();
      fetchMorning();
      fetchRatesHistory(ratesTf);
      fetchEquityHistory(equityTf);
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData, fetchMorning, fetchRatesHistory, fetchEquityHistory, ratesTf, equityTf]);

  // ── AI Morning Brief ───────────────────────────────────────────────────────
  const generateBrief = useCallback(async (type: "exec" | "full" | "email") => {
    if (!morning || generating) return;
    setGenerating(true);
    setBriefType(type);
    setBrief("");

    const q   = morning.quotes;
    const rg  = regime(q);
    const now = new Date();

    const qline = (sym: string, label: string, unit = "") => {
      const d = q[sym];
      if (!d) return `${label}: N/A`;
      const chgSign = d.changePct >= 0 ? "+" : "";
      const absChg  = Math.abs(d.change) < 10 ? d.change.toFixed(3) : d.change.toFixed(2);
      return `${label}: ${d.price.toFixed(2)}${unit}  [daily change: ${chgSign}${absChg}${unit}, ${chgSign}${d.changePct.toFixed(2)} percent]`;
    };
    const spread = q["^TNX"] && q["^IRX"] ? (q["^TNX"].price - q["^IRX"].price).toFixed(2) : "N/A";
    const sectorCtx = AI_SECTORS.filter(s => q[s.sym]).map(s => `${s.label}: ${q[s.sym].changePct >= 0 ? "+" : ""}${q[s.sym].changePct.toFixed(2)} percent`).join(", ");
    const portfolioCtx = PORTFOLIO.filter(s => q[s]).map(s => {
      const d = q[s]; const sign = d.changePct >= 0 ? "+" : "";
      return `${s} $${d.price.toFixed(2)} (${sign}${d.changePct.toFixed(2)} percent today, prev close $${d.prev.toFixed(2)})`;
    }).join("\n  ");
    const newsCtx = morning.news.length > 0
      ? morning.news.slice(0, 12).map((n, i) => `${i + 1}. [${n.source}]${n.related ? ` [${n.related}]` : ""} ${n.headline}`).join("\n  ")
      : "No live news (Finnhub key not configured)";
    const earningsCtx = morning.earnings.length > 0
      ? morning.earnings.slice(0, 8).map(e => `${e.symbol} (${e.date}, ${e.hour === "amc" ? "after close" : e.hour === "bmo" ? "before open" : "TBD"}${e.epsEstimate != null ? `, EPS est $${e.epsEstimate.toFixed(2)}` : ""})`).join(", ")
      : "None in next 7 days";
    const calCtx = morning.upcomingEvents.slice(0, 5).map(e => `${e.date} — ${e.label} [${e.impact} impact]`).join("\n  ");

    const ctx = `
=== MARKET DATA SNAPSHOT ===
Date/Time: ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}
Detected Regime: ${rg.label}

IMPORTANT NOTE: All "percent" values are percentage points (e.g. "+1.27 percent" means +1.27%). Do NOT convert to basis points.

--- US EQUITY FUTURES ---
${qline("ES=F",  "S&P 500 Futures")}
${qline("NQ=F",  "Nasdaq 100 Futures")}
${qline("RTY=F", "Russell 2000 Futures")}
${qline("YM=F",  "Dow Jones Futures")}

--- RATES & CREDIT ---
${qline("^TNX",  "10Y Treasury Yield", "%")}
${qline("^TYX",  "30Y Treasury Yield", "%")}
${qline("^FVX",  "5Y Treasury Yield",  "%")}
${qline("^IRX",  "3M T-Bill Yield",    "%")}
3M–10Y Spread: ${spread}% ${parseFloat(spread) < 0 ? "(INVERTED)" : "(normal)"}
${qline("^VIX",  "VIX (Fear Index)")}

--- FX ---
${qline("DX-Y.NYB", "DXY (Dollar Index)")}
${qline("EURUSD=X", "EUR/USD")}
${qline("GBPUSD=X", "GBP/USD")}
${qline("JPY=X",    "USD/JPY")}
${qline("CNHUSD=X", "CNH/USD")}

--- COMMODITIES & CRYPTO ---
${qline("CL=F",    "WTI Crude Oil $/bbl")}
${qline("GC=F",    "Gold $/oz")}
${qline("SI=F",    "Silver $/oz")}
${qline("HG=F",    "Copper $/lb")}
${qline("NG=F",    "Natural Gas")}
${qline("BTC-USD", "Bitcoin USD")}
${qline("ETH-USD", "Ethereum USD")}

--- GLOBAL EQUITIES ---
Europe: FTSE ${q["^FTSE"] ? (q["^FTSE"].changePct >= 0 ? "+" : "") + q["^FTSE"].changePct.toFixed(2) + "%" : "N/A"} | DAX ${q["^GDAXI"] ? (q["^GDAXI"].changePct >= 0 ? "+" : "") + q["^GDAXI"].changePct.toFixed(2) + "%" : "N/A"} | CAC ${q["^FCHI"] ? (q["^FCHI"].changePct >= 0 ? "+" : "") + q["^FCHI"].changePct.toFixed(2) + "%" : "N/A"}
Asia: Nikkei ${q["^N225"] ? (q["^N225"].changePct >= 0 ? "+" : "") + q["^N225"].changePct.toFixed(2) + "%" : "N/A"} | HSI ${q["^HSI"] ? (q["^HSI"].changePct >= 0 ? "+" : "") + q["^HSI"].changePct.toFixed(2) + "%" : "N/A"} | Shanghai ${q["000001.SS"] ? (q["000001.SS"].changePct >= 0 ? "+" : "") + q["000001.SS"].changePct.toFixed(2) + "%" : "N/A"}

--- US SECTOR ROTATION ---
${sectorCtx}

--- PORTFOLIO HOLDINGS (personal portfolio) ---
  ${portfolioCtx}

--- MACRO CALENDAR ---
  ${calCtx || "No major events this week"}

--- EARNINGS THIS WEEK ---
${earningsCtx}

--- LIVE NEWS HEADLINES (last 48h) ---
  ${newsCtx}
`.trim();

    const todayDate = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const todayShort = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const systemRole = `You are a senior macro strategist at a top-tier asset manager with 20 years of experience. You write institutional-grade morning briefs read by portfolio managers and senior traders. Your analysis is precise, data-driven, and actionable. You cite exact prices and percentage moves from the data provided. You identify cross-asset relationships, regime dynamics, and specific risk/opportunity setups. You never make up numbers — you only use the exact figures from the data snapshot.`;

    const prompts: Record<string, string> = {
      exec: `${systemRole}\n\n${ctx}\n\nWrite exactly 3 sentences (no more, no less) for the morning executive summary. Requirements:\n- Sentence 1: The single most important market dynamic right now, with exact numbers\n- Sentence 2: The cross-asset signal that confirms or complicates the picture\n- Sentence 3: The key risk or watch level for today\nBe specific. Use exact prices and exact percentage moves from the data. No vague language.`,
      full: `${systemRole}\n\n${ctx}\n\nWrite a comprehensive institutional morning brief for ${todayDate}. Structure exactly as follows:\n\n**MARKET REGIME & OPENING TONE**\n[2-3 paragraphs] Characterize today's market environment precisely. What is the dominant theme? Is this risk-on/risk-off, rotation, squeeze, macro-driven or micro-driven? Cite exact futures levels and moves. Discuss what the VIX level and its move imply about investor positioning. Comment on breadth. What does the overnight tape in Asia/Europe tell us about global sentiment?\n\n**RATES, FX & MACRO**\n[2 paragraphs] Analyze the rates complex in depth. Where is the 10Y vs 30Y vs 3M, what does the curve shape signal? What does DXY strength/weakness mean for risk assets and EM? Any commodity signals (oil, gold, copper) worth flagging?\n\n**CROSS-ASSET SIGNALS**\n[1 paragraph] Identify 2-3 key cross-asset relationships playing out today. What is the market pricing for the next 30-60 days based on current positioning?\n\n**PORTFOLIO IMPLICATIONS**\n[2 paragraphs] Go through each portfolio holding with a notable move or setup. Specifically analyze: META, AMZN, NVDA, AAPL, PYPL, HOOD, APLD, UBER, DUOL. Use EXACT prices and moves from the data.\n\n**SECTOR ROTATION MAP**\n[1 paragraph] Which sectors are leading/lagging and what does the rotation tell us? What are the 2-3 sectors to be positioned in today and why?\n\n**KEY RISKS & CATALYST WATCH**\n[bulleted list] 5 specific things to monitor today, each with an exact level.\n\n**NEWS HIGHLIGHTS**\n[bulleted list] Pull out the 4-5 most market-moving news items and explain their implication in 1 sentence each.\n\nWrite with institutional authority. Use exact numbers. No hedging. Total length: 600-800 words.`,
      email: `${systemRole}\n\n${ctx}\n\nWrite a professional morning market email from a senior strategist to the trading desk. ${todayDate}.\n\nSubject: Morning Brief — ${todayShort} | ${rg.label}\n\nGood morning,\n\n[Write a 2-sentence opening capturing the most important thing happening right now, with exact numbers]\n\n**OVERNIGHT SNAPSHOT**\n[6-8 bullet points, each with exact prices/moves — futures, rates, key FX, commodities, crypto. Format: • Asset: Level (Daily Change)]\n\n**THE DOMINANT THEME**\n[3-4 sentences explaining the main story driving markets today. Cross-asset perspective.]\n\n**RATES & MACRO SIGNAL**\n[2-3 sentences on the rates/FX complex and macro implications]\n\n**PORTFOLIO WATCH**\n[Go through portfolio names with notable moves. Format: • TICKER $price (+X.XX%) — one sentence on driver and implication]\n\n**SECTOR ROTATION**\n[2 sentences on which sectors are leading/lagging]\n\n**NEWS DRIVING FLOW**\n[3-4 bullet points on most important headlines and their implications]\n\n**CALENDAR RISK**\n[Any important data/events coming up this week]\n\n**WATCH LIST — TODAY**\n• [Specific level 1]\n• [Specific level 2]\n• [Specific level 3]\n\nHave a great trading day.\n\n[Your name]\nCrossAsset | Macro Intelligence\n\n---\nAll data as of ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. For informational purposes only.`,
    };

    try {
      const r = await fetch("/api/ai-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompts[type] }),
      });
      if (!r.ok || !r.body) { setBrief("Failed — check ANTHROPIC_API_KEY in .env.local"); setGenerating(false); return; }
      const reader = r.body.getReader();
      const dec    = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          const raw = line.startsWith("data: ") ? line.slice(6).trim() : null;
          if (!raw || raw === "[DONE]") continue;
          try {
            const j = JSON.parse(raw);
            if (j.error) { setBrief(`Error: ${j.error}`); break; }
            if (j.text)  setBrief(prev => prev + j.text);
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setBrief(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setGenerating(false);
    }
  }, [morning, generating]);

  // Derived morning values
  const mq = morning?.quotes ?? {};
  const mRegime = regime(mq);
  const hasMorning = Object.keys(mq).length > 0;
  const aiSyms = PORTFOLIO.filter(s => AI_NAMES.has(s) && mq[s]);
  const aiAvg  = aiSyms.length ? aiSyms.reduce((a, s) => a + mq[s].changePct, 0) / aiSyms.length : 0;
  const ratesRising = (mq["^TNX"]?.change ?? 0) > 0.04;

  const updatedTime = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    : null;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <AppShell>
      <main className="pb-16">

        {/* ── Top Banner ──────────────────────────────────────────────────── */}
        <div className="-mx-10 -mt-10 mb-0 bg-[#0c1b38] px-10 py-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <CrossAssetLogo variant="compact" color="light" className="shrink-0 scale-[0.55] origin-left" />
                <div className="-ml-4">
                  <p className="text-[15px] font-bold leading-none tracking-[0.22em] text-white" style={{ fontFamily: "var(--font-serif)" }}>CROSSASSET</p>
                  <p className="mt-1.5 text-[9px] tracking-[0.3em] text-white/40 uppercase">Macro Intelligence</p>
                </div>
              </div>
              <div className="h-6 w-px bg-white/15" />
              <p className="text-[11px] font-medium text-white/50">{today}</p>
              {hasMorning && (
                <span
                  className="border px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: "#fff", borderColor: mRegime.c, backgroundColor: mRegime.c + "44" }}
                >
                  {mRegime.label}
                </span>
              )}
              {updatedTime && !loading && (
                <span className="text-[10px] font-semibold tracking-[0.08em] text-white/35">· Updated {updatedTime}</span>
              )}
            </div>

            <div className="flex items-center gap-5">
              {data && (
                <div className="flex gap-4">
                  {[
                    { ok: data.sources.fred,    label: "FRED" },
                    { ok: data.sources.finnhub, label: "Finnhub" },
                    { ok: data.sources.newsapi, label: "News" },
                  ].map(({ ok, label }) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-white/20"}`} />
                      <span className={`text-[10px] font-semibold tracking-[0.1em] uppercase ${ok ? "text-white/65" : "text-white/25"}`}>{label}</span>
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => { fetchData(); fetchMorning(); fetchRatesHistory(ratesTf); fetchEquityHistory(equityTf); }}
                disabled={loading}
                className="flex items-center gap-2 border border-white/20 bg-white/[0.08] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/75 transition-all hover:bg-white/15 disabled:opacity-40"
              >
                <span className={loading ? "inline-block animate-spin" : ""}>↻</span>
                {loading ? "Updating…" : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Live Ticker (auto-scroll marquee) ──────────────────────────── */}
        <style>{`
          @keyframes ticker-scroll {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .ticker-track { animation: ticker-scroll 60s linear infinite; }
          .ticker-track:hover { animation-play-state: paused; }
        `}</style>
        <div className="-mx-10 mb-8 overflow-hidden border-b border-[#e8e3da] bg-[#faf9f7]">
          {(() => {
            const eurusd = data?.forex?.find(f => f.pair === "EURUSD");
            const btc    = data?.crypto?.find(c => c.symbol === "BTC");
            const tickers = [
              { label: "S&P 500",   val: data?.equities.sp500?.price,   pct: data?.equities.sp500?.pct,   dec: 0, pfx: "",  sfx: "" },
              { label: "NASDAQ",    val: data?.equities.nasdaq?.price,  pct: data?.equities.nasdaq?.pct,  dec: 0, pfx: "",  sfx: "" },
              { label: "Dow Jones", val: data?.equities.dow?.price,     pct: data?.equities.dow?.pct,     dec: 0, pfx: "",  sfx: "" },
              { label: "10Y UST",   val: data?.yields.dgs10?.price,     pct: data?.yields.dgs10?.pct,     dec: 2, pfx: "",  sfx: "%" },
              { label: "2Y UST",    val: data?.yields.dgs2?.price,      pct: data?.yields.dgs2?.pct,      dec: 2, pfx: "",  sfx: "%" },
              { label: "Fed Funds", val: data?.yields.fedfunds?.price,  pct: null,                        dec: 2, pfx: "",  sfx: "%" },
              { label: "VIX",       val: data?.equities.vix?.price,     pct: data?.equities.vix?.pct,     dec: 1, pfx: "",  sfx: "" },
              { label: "Gold",      val: data?.equities.gold?.price,    pct: data?.equities.gold?.pct,    dec: 0, pfx: "$", sfx: "" },
              { label: "WTI Crude", val: data?.equities.oil?.price,     pct: data?.equities.oil?.pct,     dec: 2, pfx: "$", sfx: "" },
              { label: "DXY",       val: data?.equities.dxy?.price,     pct: data?.equities.dxy?.pct,     dec: 2, pfx: "",  sfx: "" },
              { label: "EUR/USD",   val: eurusd?.price,                 pct: eurusd?.pct,                 dec: 4, pfx: "",  sfx: "" },
              { label: "Bitcoin",   val: btc?.price,                    pct: btc?.pct,                    dec: 0, pfx: "$", sfx: "" },
              { label: "HY OAS",    val: data?.macro.hySpread?.price,   pct: null,                        dec: 0, pfx: "",  sfx: "bps" },
            ];
            const renderTicker = (key: string) => tickers.map(({ label, val, pct, dec, pfx, sfx }, i) => {
              const up = (pct ?? 0) > 0;
              const pctColor = pct == null ? "transparent" : up ? POSITIVE : NEGATIVE;
              return (
                <div key={`${key}-${i}`} className="flex flex-shrink-0 flex-col justify-center border-r border-[#e8e3da] px-7 py-3.5">
                  <p className="mb-1 text-[8.5px] font-bold uppercase tracking-[0.2em] text-[#999]">{label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[14px] font-bold tabular-nums text-[#0a0a0a]">
                      {val != null ? `${pfx}${val.toFixed(dec)}${sfx}` : "—"}
                    </span>
                    {pct != null && pct !== 0 && (
                      <span className="text-[10.5px] font-semibold tabular-nums" style={{ color: pctColor }}>
                        {up ? "+" : ""}{pct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            });
            return (
              <div className="ticker-track flex w-max items-stretch">
                {renderTicker("a")}
                {renderTicker("b")}
              </div>
            );
          })()}
        </div>

        {/* ── AI Morning Brief ──────────────────────────────────────────── */}
        <div className="mb-5">
          <Card className="overflow-hidden">
            <div className="bg-[#0c1b38] px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/50 mb-1">AI Morning Brief</p>
                <p className="text-[13px] font-medium text-white">Powered by Claude · synthesizes all live market data below</p>
              </div>
              <Newspaper size={18} className="text-white/30" />
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <button onClick={() => generateBrief("exec")} disabled={generating || !hasMorning}
                  className="text-[11px] font-semibold px-4 py-2.5 rounded-md border border-[#c8d0e8] bg-[#eef1f8] text-[#0c1b38] hover:bg-[#dde4f0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {generating && briefType === "exec" ? "Generating…" : "2-Sentence Summary"}
                </button>
                <button onClick={() => generateBrief("full")} disabled={generating || !hasMorning}
                  className="text-[11px] font-semibold px-4 py-2.5 rounded-md bg-[#0c1b38] text-white hover:bg-[#1a3361] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {generating && briefType === "full" ? "Generating…" : "Full Morning Brief"}
                </button>
                <button onClick={() => generateBrief("email")} disabled={generating || !hasMorning}
                  className="text-[11px] font-semibold px-4 py-2.5 rounded-md border border-[#c8d0e8] bg-[#eef1f8] text-[#0c1b38] hover:bg-[#dde4f0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {generating && briefType === "email" ? "Generating…" : "Draft Trader Email"}
                </button>
                {generating && (
                  <span className="flex items-center gap-1.5 text-[10.5px] text-[#999]">
                    <span className="w-2 h-2 rounded-full bg-[#0c1b38] animate-pulse" /> Streaming…
                  </span>
                )}
              </div>
              {!hasMorning && <p className="text-[11px] text-[#ccc]">Buttons will activate once market data loads.</p>}
              {brief ? (
                <div className="bg-[#fbfaf7] border border-[#eee9df] rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#bbb]">
                      {briefType === "exec" ? "Executive Summary" : briefType === "full" ? "Morning Brief" : "Trader Email Draft"}
                    </p>
                    <button onClick={() => { navigator.clipboard.writeText(brief); }}
                      className="text-[10.5px] font-semibold text-[#999] hover:text-[#0c1b38] border border-[#e8e8e8] hover:border-[#0c1b38] px-2.5 py-1 rounded-md transition-colors">
                      Copy
                    </button>
                  </div>
                  <BriefBody text={brief} />
                </div>
              ) : !generating && (
                <p className="text-[11px] text-[#ccc]">
                  Click a button to generate a strategist-grade brief from the live data below. Requires{" "}
                  <code className="bg-[#f5f5f5] px-1 rounded text-[10.5px]">ANTHROPIC_API_KEY</code>.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* ── Layer 1: Macro Snapshot · Rates · Market Intelligence ──────── */}
        <div className="mb-5 grid grid-cols-[1.1fr_1.45fr_1fr] gap-5">

          {/* Macro Snapshot */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <SectionLabel>Macro Snapshot</SectionLabel>
              <p className="text-[9.5px] text-[#bbb]">{data?.sources.fred ? "FRED · Live" : "—"}</p>
            </div>

            <div className="space-y-0">
              {[
                { label: "Fed Funds",    val: data?.yields.fedfunds?.price,    chg: data?.yields.fedfunds?.change,  sfx: "%",   dec: 2, inv: false },
                { label: "10Y Treasury", val: data?.yields.dgs10?.price,       chg: data?.yields.dgs10?.change,     sfx: "%",   dec: 2, inv: true },
                { label: "2Y Treasury",  val: data?.yields.dgs2?.price,        chg: data?.yields.dgs2?.change,      sfx: "%",   dec: 2, inv: true },
                { label: "30Y Treasury", val: data?.yields.dgs30?.price,       chg: data?.yields.dgs30?.change,     sfx: "%",   dec: 2, inv: true },
                { label: "CPI YoY",      val: data?.macro.cpi?.price,          chg: data?.macro.cpi?.change,        sfx: "%",   dec: 2, inv: true },
                { label: "Core CPI",     val: data?.macro.coreCpi?.price,      chg: data?.macro.coreCpi?.change,    sfx: "%",   dec: 2, inv: true },
                { label: "PCE YoY",      val: data?.macro.pce?.price,          chg: data?.macro.pce?.change,        sfx: "%",   dec: 2, inv: true },
                { label: "Unemployment", val: data?.macro.unrate?.price,       chg: data?.macro.unrate?.change,     sfx: "%",   dec: 1, inv: true },
                { label: "GDP growth",   val: data?.macro.gdp?.price,          chg: data?.macro.gdp?.change,        sfx: "%",   dec: 1, inv: false },
                { label: "HY OAS",       val: data?.macro.hySpread?.price,     chg: data?.macro.hySpread?.change,   sfx: "bps", dec: 0, inv: true },
                { label: "10Y Breakeven",val: data?.extraData.breakeven?.price, chg: data?.extraData.breakeven?.change, sfx: "%", dec: 2, inv: true },
                { label: "2s10s Spread", val: data?.extraData.t10y2y?.price,   chg: data?.extraData.t10y2y?.change, sfx: "%",   dec: 2, inv: false },
              ].map(({ label, val, chg, sfx, dec, inv }) => {
                const up = (chg ?? 0) > 0;
                const color = val == null ? "#bbb" : chg == null || chg === 0 ? "#999" : (inv ? up : !up) ? NEGATIVE : POSITIVE;
                return (
                  <div key={label} className="flex items-center justify-between border-b border-[#f1eee8] py-2 last:border-0">
                    <p className="text-[11.5px] font-semibold text-[#555]">{label}</p>
                    <div className="flex items-center gap-3">
                      {chg != null && chg !== 0 && (
                        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
                          {chg > 0 ? "+" : ""}{chg.toFixed(dec)}{sfx}
                        </span>
                      )}
                      <p className="text-[13.5px] font-bold tabular-nums text-[#0a0a0a]">
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
                <SectionLabel>Treasury Yields</SectionLabel>
                <h3 className="mt-1 text-[11px] text-[#bbb]">
                  {data?.yields.dgs10 ? `10Y  ${data.yields.dgs10.price.toFixed(2)}%  ·  5Y  ${data?.yields.dgs5?.price.toFixed(2) ?? "—"}%  ·  2Y  ${data?.yields.dgs2?.price.toFixed(2) ?? "—"}%` : "Loading…"}
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
              <MetricTile label="5Y Yield"  quote={data?.yields.dgs5  ?? null} note="Treasury"  dec={2} suffix="%" pctSuffix="%" invertColor />
              <MetricTile label="10Y Yield" quote={data?.yields.dgs10 ?? null} note="Treasury"  dec={2} suffix="%" pctSuffix="%" invertColor />
              <MetricTile label="30Y Yield" quote={data?.yields.dgs30 ?? null} note="Treasury"  dec={2} suffix="%" pctSuffix="%" invertColor />
              <MetricTile label="S&P 500"   quote={data?.equities.sp500 ?? null} note="FRED"    dec={0} />
              <MetricTile label="Gold"      quote={data?.equities.gold  ?? null} note="XAU/USD" dec={0} prefix="$" />
              <MetricTile label="WTI Crude" quote={data?.equities.oil   ?? null} note="CL=F"   dec={2} prefix="$" />
              <MetricTile label="VIX"       quote={data?.equities.vix   ?? null} note="CBOE"   dec={1} invertColor />
              <MetricTile label="USD Index" quote={data?.equities.dxy   ?? null} note="DXY"    dec={2} invertColor />
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
                <SectionLabel>Equities & Commodities</SectionLabel>
                <p className="mt-1 text-[11px] text-[#bbb]">
                  {data?.equities.sp500 ? `S&P ${data.equities.sp500.price.toFixed(0)}  ·  NASDAQ ${data?.equities.nasdaq?.price.toFixed(0) ?? "—"}  ·  VIX ${data?.equities.vix?.price.toFixed(1) ?? "—"}` : ""}
                </p>
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

            {/* 6 clickable equity metric tiles */}
            <div className="mb-5 grid grid-cols-6 gap-3">
              {([
                { key: "sp500",  label: "S&P 500",  q: data?.equities.sp500,  note: "Expand chart", dec: 0 },
                { key: "nasdaq", label: "NASDAQ",   q: data?.equities.nasdaq, note: "Expand chart", dec: 0 },
                { key: "dow",    label: "Dow Jones",q: data?.equities.dow,    note: "Expand chart", dec: 0 },
                { key: "vix",    label: "VIX",      q: data?.equities.vix,    note: "Expand chart", dec: 1, inv: true },
                { key: "gold",   label: "Gold",     q: data?.equities.gold,   note: "Expand chart", dec: 0, pfx: "$" },
                { key: "oil",    label: "WTI Crude",q: data?.equities.oil,    note: "Expand chart", dec: 2, pfx: "$" },
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
                dow:    { data: equityChart?.historyDow ?? [], label: "Dow Jones (^DJI)", color: "#0369a1", fmt: (v) => v.toFixed(0) },
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

        {/* ── US Futures + Portfolio Pulse ─────────────────────────────── */}
        {hasMorning && (
          <div className="mb-5 grid grid-cols-[0.8fr_2.2fr] gap-5">

            {/* US Futures */}
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <SectionLabel>US Futures</SectionLabel>
                <p className="text-[9.5px] text-[#999]">Live · Yahoo</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {FUTURES.map(f => <Tile key={f.sym} q={mq[f.sym]} label={f.label} />)}
              </div>
            </Card>

            {/* Portfolio Pulse */}
            <Card className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <SectionLabel>Portfolio Pulse</SectionLabel>
                <div className="flex items-center gap-5 text-[10.5px] text-[#999]">
                  <span>AI/Tech avg: <span className="font-semibold" style={{ color: gc(aiAvg) }}>{pp(aiAvg)}</span></span>
                  {ratesRising && (
                    <span className="font-semibold text-amber-600">⚠ Rates rising — {[...RATE_NAMES].join(" · ")} under pressure</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2.5">
                {PORTFOLIO.map(sym => {
                  const qp = mq[sym];
                  const inRange = qp && qp.high52w > qp.low52w;
                  const rangePct = inRange ? Math.max(0, Math.min(100, ((qp.price - qp.low52w) / (qp.high52w - qp.low52w)) * 100)) : 0;
                  return (
                    <div key={sym} className="border border-[#eee9df] rounded-lg p-3 flex flex-col gap-1 transition-colors"
                         style={{ backgroundColor: qp ? gb(qp.changePct) : "#fbfaf7" }}>
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-[11px] font-bold ${AI_NAMES.has(sym) ? "text-[#0c1b38]" : "text-[#333]"}`}>{sym}</span>
                        {AI_NAMES.has(sym) && <span className="text-[8px] text-[#0c1b38] bg-[#eef1f8] px-1 rounded font-semibold">AI</span>}
                      </div>
                      <p className="text-[14px] font-semibold text-[#0a0a0a] tabular-nums leading-none">
                        {qp ? `$${fp(qp.price)}` : <span className="text-[#ddd]">—</span>}
                      </p>
                      {qp && <p className="text-[10.5px] font-bold tabular-nums" style={{ color: gc(qp.changePct) }}>{pp(qp.changePct)}</p>}
                      {inRange && (
                        <div className="mt-1 h-[2px] bg-[#eaeaea] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-[#0c1b38]" style={{ width: `${rangePct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[9.5px] text-[#ccc] mt-2.5">Bar = position in 52-week range · AI badge = AI/compute exposure</p>
            </Card>
          </div>
        )}

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
                  Market-implied · CME ZQ Fed Funds Futures (ZQM26–ZQK27) · Refreshes every 5 min
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#999]">Current Rate</p>
                <p className="text-[18px] font-bold tabular-nums text-[#0c1b38]">
                  {data?.yields.fedfunds ? `${data.yields.fedfunds.price.toFixed(2)}%` : "—"}
                </p>
              </div>
            </div>
            {loading ? (
              <div className="py-6 text-[12px] text-[#bbb]">Loading ZQ futures…</div>
            ) : (() => {
              const fw = data?.fedwatch ?? [];
              if (!fw.length) return (
                <p className="py-4 text-[12px] text-[#bbb]">Fetching ZQ Fed Funds Futures…</p>
              );
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
                          <th className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#777]">Implied Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fw.map((row, i) => {
                          const dominant = row.cutProb > row.holdProb && row.cutProb > row.hikeProb ? "cut"
                            : row.hikeProb > row.holdProb ? "hike" : "hold";
                          return (
                            <tr key={i} className="border-b border-[#f1eee8] last:border-0">
                              <td className="px-4 py-3 text-[12px] font-bold text-[#0a0a0a]">{row.label}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-[5px] bg-[#eee9df]">
                                    <div className="h-full bg-[#147a4f]" style={{ width: `${row.cutProb}%` }} />
                                  </div>
                                  <span className="text-[12px] font-bold tabular-nums text-[#147a4f]">{row.cutProb.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-[5px] bg-[#eee9df]">
                                    <div className="h-full bg-[#555]" style={{ width: `${row.holdProb}%` }} />
                                  </div>
                                  <span className="text-[12px] font-bold tabular-nums text-[#555]">{row.holdProb.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-[5px] bg-[#eee9df]">
                                    <div className="h-full bg-[#b42318]" style={{ width: `${row.hikeProb}%` }} />
                                  </div>
                                  <span className="text-[12px] font-bold tabular-nums text-[#b42318]">{row.hikeProb.toFixed(1)}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[11px] font-bold tabular-nums mr-2 ${dominant === "cut" ? "text-[#147a4f]" : dominant === "hike" ? "text-[#b42318]" : "text-[#555]"}`}>
                                  {row.impliedRate.toFixed(3)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[10px] text-[#bbb] leading-relaxed">
                    Market-implied probabilities derived from CME ZQ Fed Funds Futures (ZQM26–ZQK27). Methodology: implied monthly avg EFFR = 100 − ZQ price. For end-of-month meetings the next contract gives the clean post-meeting rate; for mid-month meetings a day-weighted interpolation is used. Probabilities are rounded to nearest 25bps band.
                  </p>
                </div>
              );
            })()}
          </Card>
        </div>

        {/* ── Layer 3: Global Data · Fear & Greed ──────────────────────── */}
        <div className="mb-5 grid grid-cols-[1.2fr_0.8fr] gap-5">

          {/* Global Data — secondary FRED series */}
          <Card className="p-6">
            <SectionLabel>Economic Indicators</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#999]">{data?.sources.fred ? "Live · FRED" : "Add FRED_API_KEY to Vercel"}</p>
            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-0">
              {[
                { label: "30Y Mortgage",       val: data?.extraData?.mortgage?.price,  chg: data?.extraData?.mortgage?.change,  sfx: "%",   dec: 2 },
                { label: "Retail Sales MoM",   val: data?.extraData?.retail?.pct,      chg: null,                               sfx: "%",   dec: 2 },
                { label: "Initial Claims",     val: data?.extraData?.claims?.price,    chg: data?.extraData?.claims?.change,    sfx: "K",   dec: 0 },
                { label: "Indus. Production",  val: data?.extraData?.indpro?.pct,      chg: null,                               sfx: "%",   dec: 2 },
                { label: "Consumer Sentiment", val: data?.extraData?.sentiment?.price, chg: data?.extraData?.sentiment?.change, sfx: "",    dec: 1 },
                { label: "Nonfarm Payrolls",   val: data?.macro?.payems?.change,       chg: null,                               sfx: "K",   dec: 0 },
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

          {/* Fear & Greed — 6-component methodology */}
          <Card className="p-6">
            <SectionLabel>Fear & Greed Index</SectionLabel>
            <p className="mt-1 text-[9.5px] text-[#bbb]">Composite · 6 market signals · Refreshes with data</p>
            {(() => {
              const vix    = data?.equities.vix?.price   ?? 20;
              const hyOas  = data?.macro.hySpread?.price ?? 350;
              const t10y2y = data?.extraData.t10y2y?.price ?? 0.2;
              const dxyPct = data?.equities.dxy?.pct     ?? 0;
              const goldPct= data?.equities.gold?.pct    ?? 0;
              const spPct  = data?.equities.sp500?.pct   ?? 0;

              // Each component 0–100 (100 = extreme greed, 0 = extreme fear)
              const vixScore   = Math.max(0, Math.min(100, ((40 - vix)     / 30) * 100));  // 100 at VIX=10, 0 at VIX=40
              const hyScore    = Math.max(0, Math.min(100, ((650 - hyOas)  / 400) * 100)); // 100 at 250bps, 0 at 650bps
              const curveScore = Math.max(0, Math.min(100, ((t10y2y + 0.8) / 2.8) * 100)); // 100 at +2%, 0 at -0.8%
              const dxyScore   = Math.max(0, Math.min(100, 50 - dxyPct * 8));              // falling USD = greed (reduced sensitivity vs daily noise)
              const goldScore  = Math.max(0, Math.min(100, 50 - goldPct * 6));             // rising gold = fear (reduced sensitivity)
              const spScore    = Math.max(0, Math.min(100, 50 + spPct * 8));               // rising stocks = greed (reduced sensitivity)

              const score = loading ? 50 : Math.round(
                vixScore * 0.28 + hyScore * 0.22 + curveScore * 0.18 +
                dxyScore * 0.12 + goldScore * 0.10 + spScore * 0.10
              );
              const label = score >= 75 ? "Extreme Greed" : score >= 58 ? "Greed" : score >= 42 ? "Neutral" : score >= 25 ? "Fear" : "Extreme Fear";
              const gaugeColor = score >= 58 ? POSITIVE : score >= 42 ? WARNING : NEGATIVE;

              // Half-circle gauge: score 0 = LEFT (180°), 50 = TOP (270°), 100 = RIGHT (360°)
              // angle = (180 + score × 1.8)°; clockwise sweep (SVG sweep=1) traces the upper semicircle
              const cx = 100; const cy = 90; const r = 72;
              const scoreToRad = (s: number) => (180 + s * 1.8) * Math.PI / 180;
              const scorePt    = (s: number) => ({ x: cx + r * Math.cos(scoreToRad(s)), y: cy + r * Math.sin(scoreToRad(s)) });
              const arc = (s1: number, s2: number) => {
                const p1 = scorePt(s1), p2 = scorePt(s2);
                return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
              };
              const { x: nx, y: ny } = scorePt(score);
              const zones = [
                { color: NEGATIVE,   s: 0,  e: 25  },
                { color: "#e57a3b",  s: 25, e: 45  },
                { color: WARNING,    s: 45, e: 55  },
                { color: "#5f9e6e", s: 55, e: 75  },
                { color: POSITIVE,   s: 75, e: 100 },
              ];
              return (
                <div className="flex flex-col items-center mt-3">
                  <svg viewBox="0 0 200 100" className="w-full max-w-[220px]">
                    {zones.map((z, i) => (
                      <path key={i} d={arc(z.s, z.e)} fill="none" stroke={z.color} strokeWidth={12} opacity={0.22} />
                    ))}
                    <path d={arc(0, score)} fill="none" stroke={gaugeColor} strokeWidth={12} opacity={0.9} />
                    <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#0c1b38" strokeWidth={2} strokeLinecap="round" />
                    <circle cx={cx} cy={cy} r={4} fill="#0c1b38" />
                    <text x={cx} y={cy - 14} textAnchor="middle" fontSize={22} fontWeight="bold" fill="#0a0a0a">{loading ? "—" : score}</text>
                  </svg>
                  <p className="mt-1 text-[15px] font-bold tracking-wide" style={{ color: gaugeColor }}>{loading ? "…" : label}</p>
                  <div className="mt-4 w-full space-y-1.5 border-t border-[#eee9df] pt-4">
                    {[
                      { label: "Volatility (VIX)",   v: Math.round(vixScore),  note: `VIX ${vix.toFixed(1)}` },
                      { label: "Credit (HY OAS)",    v: Math.round(hyScore),   note: `${hyOas.toFixed(0)}bps` },
                      { label: "Yield Curve",        v: Math.round(curveScore),note: `2s10s ${t10y2y >= 0 ? "+" : ""}${t10y2y.toFixed(2)}%` },
                      { label: "USD Momentum",       v: Math.round(dxyScore),  note: `${dxyPct >= 0 ? "+" : ""}${dxyPct.toFixed(2)}%` },
                      { label: "Gold",               v: Math.round(goldScore), note: `${goldPct >= 0 ? "+" : ""}${goldPct.toFixed(2)}%` },
                      { label: "Equity Momentum",    v: Math.round(spScore),   note: `S&P ${spPct >= 0 ? "+" : ""}${spPct.toFixed(2)}%` },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-2">
                        <p className="w-32 text-[9.5px] font-semibold text-[#777] shrink-0">{row.label}</p>
                        <div className="flex-1 h-[4px] bg-[#eee9df]">
                          <div className="h-full" style={{ width: `${loading ? 50 : row.v}%`, backgroundColor: row.v >= 58 ? POSITIVE : row.v >= 42 ? WARNING : NEGATIVE }} />
                        </div>
                        <p className="w-16 text-right text-[9.5px] tabular-nums text-[#999] shrink-0">{loading ? "…" : row.note}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[9px] text-[#ccc]">VIX 28% · HY OAS 22% · Yield curve 18% · DXY 12% · Gold 10% · S&P 10%</p>
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
              <p className="text-[12px] text-[#bbb]">{loading ? "Loading…" : "Data unavailable"}</p>
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
              <p className="text-[12px] text-[#bbb]">{loading ? "Loading…" : "Data unavailable"}</p>
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
              <p className="text-[12px] text-[#bbb]">{loading ? "Loading…" : "Data unavailable"}</p>
            )}
          </Card>
        </div>

        {/* ── Market News ────────────────────────────────────────────────── */}
        {(data?.topNews?.length ?? 0) > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <SectionLabel>Market News</SectionLabel>
              <p className="text-[9.5px] text-[#bbb]">{updatedTime ? `Updated ${updatedTime}` : ""}</p>
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

      </main>
    </AppShell>
  );
}
