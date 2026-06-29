"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  RefreshCw, TrendingUp, TrendingDown, Minus, Newspaper,
  ChevronDown, ChevronUp, ExternalLink, Activity,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

type Quote = {
  symbol: string; name: string; price: number; change: number;
  changePct: number; prev: number; high52w: number; low52w: number;
};
type NewsItem = {
  id: number; headline: string; source: string;
  summary: string; datetime: number; related: string; url: string;
};
type Earnings  = { symbol: string; date: string; epsEstimate: number | null; hour: string };
type CalEvent  = { date: string; label: string; category: string; impact: string; previous?: string };
type Morning   = {
  ts: string;
  quotes: Record<string, Quote>;
  spChart: { t: number; v: number }[];
  news: NewsItem[];
  earnings: Earnings[];
  upcomingEvents: CalEvent[];
};

// ── Symbol lists ──────────────────────────────────────────────────────────────

const PORTFOLIO  = ["META","UBER","DUOL","VOO","AMZN","PYPL","APLD","AAPL","CMG","ONT","HOOD","NVDA","VUG"];
const AI_NAMES   = new Set(["NVDA","APLD","META","AMZN","AAPL","DUOL"]);
const RATE_NAMES = new Set(["PYPL","HOOD","APLD"]);

const FUTURES = [
  { sym: "ES=F",  label: "S&P 500" },
  { sym: "NQ=F",  label: "Nasdaq 100" },
  { sym: "RTY=F", label: "Russell 2000" },
  { sym: "YM=F",  label: "Dow Jones" },
];
const RATES = [
  { sym: "^TNX", label: "10Y Yield", unit: "%" },
  { sym: "^TYX", label: "30Y Yield", unit: "%" },
  { sym: "^FVX", label: "5Y Yield",  unit: "%" },
  { sym: "^IRX", label: "13W T-Bill",unit: "%" },
  { sym: "^VIX", label: "VIX",       unit: ""  },
];
const COMMODITIES = [
  { sym: "CL=F",     label: "WTI Crude", f: (v: number) => `$${v.toFixed(2)}` },
  { sym: "GC=F",     label: "Gold",      f: (v: number) => `$${Math.round(v).toLocaleString()}` },
  { sym: "SI=F",     label: "Silver",    f: (v: number) => `$${v.toFixed(2)}` },
  { sym: "HG=F",     label: "Copper",    f: (v: number) => `$${v.toFixed(3)}` },
  { sym: "NG=F",     label: "Nat Gas",   f: (v: number) => `$${v.toFixed(3)}` },
  { sym: "BTC-USD",  label: "Bitcoin",   f: (v: number) => `$${Math.round(v).toLocaleString()}` },
  { sym: "ETH-USD",  label: "Ethereum",  f: (v: number) => `$${Math.round(v).toLocaleString()}` },
  { sym: "DX-Y.NYB", label: "DXY",       f: (v: number) => v.toFixed(2) },
];
const EUROPE = [
  { sym: "^FTSE",     label: "FTSE 100",     flag: "🇬🇧" },
  { sym: "^GDAXI",    label: "DAX",          flag: "🇩🇪" },
  { sym: "^FCHI",     label: "CAC 40",       flag: "🇫🇷" },
  { sym: "^STOXX50E", label: "Euro Stoxx 50",flag: "🇪🇺" },
  { sym: "^IBEX",     label: "IBEX 35",      flag: "🇪🇸" },
];
const ASIA = [
  { sym: "^N225",     label: "Nikkei 225", flag: "🇯🇵" },
  { sym: "^HSI",      label: "Hang Seng",  flag: "🇭🇰" },
  { sym: "000001.SS", label: "Shanghai",   flag: "🇨🇳" },
  { sym: "^KS11",     label: "KOSPI",      flag: "🇰🇷" },
  { sym: "^AXJO",     label: "ASX 200",    flag: "🇦🇺" },
  { sym: "^TWII",     label: "Taiwan",     flag: "🇹🇼" },
  { sym: "^BSESN",    label: "Sensex",     flag: "🇮🇳" },
];
const FX = [
  { sym: "EURUSD=X", label: "EUR/USD" },
  { sym: "GBPUSD=X", label: "GBP/USD" },
  { sym: "JPY=X",    label: "USD/JPY" },
  { sym: "CNHUSD=X", label: "CNH/USD" },
];
const SECTORS = [
  { sym: "XLK",  label: "Technology" },
  { sym: "XLC",  label: "Comms" },
  { sym: "XLY",  label: "Cons Disc" },
  { sym: "XLF",  label: "Financials" },
  { sym: "XLV",  label: "Healthcare" },
  { sym: "XLI",  label: "Industrials" },
  { sym: "XLE",  label: "Energy" },
  { sym: "XLB",  label: "Materials" },
  { sym: "XLRE", label: "Real Estate" },
  { sym: "XLU",  label: "Utilities" },
  { sym: "XLP",  label: "Staples" },
];

// ── Design tokens ─────────────────────────────────────────────────────────────

const GREEN = "#147a4f";
const RED   = "#b42318";
const NAVY  = "#0c1b38";

const CAT: Record<string, string> = {
  fomc:  "bg-[#eef1f8] text-[#0c1b38] border-[#c8d0e8]",
  cpi:   "bg-amber-50 text-amber-700 border-amber-200",
  jobs:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  gdp:   "bg-purple-50 text-purple-700 border-purple-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};
const DOT: Record<string, string> = { high: "bg-red-400", medium: "bg-amber-400", low: "bg-gray-300" };

// ── Helpers ───────────────────────────────────────────────────────────────────

const gc   = (p: number) => (p > 0 ? GREEN : p < 0 ? RED : "#999");
const gb   = (p: number) => (p > 0 ? "#f0faf4" : p < 0 ? "#fff5f5" : "#fafafa");
const pp   = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fp   = (n: number) => n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toFixed(2);
const fd   = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const ft   = (ts: number) => new Date(ts * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

function regime(q: Record<string, Quote>) {
  const sp  = q["ES=F"]?.changePct     ?? 0;
  const vix = q["^VIX"]?.changePct     ?? 0;
  const t10 = q["^TNX"]?.change        ?? 0;
  const gld = q["GC=F"]?.changePct     ?? 0;
  const dxy = q["DX-Y.NYB"]?.changePct ?? 0;
  const oil = q["CL=F"]?.changePct     ?? 0;

  if (sp < -1    && t10 > 0.03) return { label: "Rates-Led Selloff",  c: RED,    bg: "#fff5f5" };
  if (sp > 1.2   && vix < -5)   return { label: "Risk-On Melt-Up",    c: GREEN,  bg: "#f0faf4" };
  if (sp < -0.5  && gld > 0.8)  return { label: "Defensive Flight",   c: "#92400e", bg: "#fef9f0" };
  if (oil > 2.5)                 return { label: "Commodity Shock",    c: "#92400e", bg: "#fef9f0" };
  if (dxy > 0.5  && sp < 0)     return { label: "Dollar Squeeze",     c: RED,    bg: "#fff5f5" };
  if (sp > 0.5   && vix < -3)   return { label: "Risk-On Grind",      c: GREEN,  bg: "#f0faf4" };
  if (Math.abs(sp) < 0.25)      return { label: "Consolidation",      c: "#888", bg: "#fafafa" };
  if (sp > 0)                    return { label: "Cautiously Bullish", c: GREEN,  bg: "#f0faf4" };
  return                                { label: "Cautiously Bearish", c: RED,    bg: "#fff5f5" };
}

// ── Micro components ──────────────────────────────────────────────────────────

function SL({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#0c1b38] mb-3">{children}</p>;
}

function Tile({ q, label, pStr }: { q: Quote | undefined; label: string; pStr?: string }) {
  if (!q) return (
    <div className="border border-[#ebebeb] rounded-lg px-3 py-3 flex flex-col gap-1 bg-[#fafafa]">
      <p className="text-[9.5px] font-semibold text-[#ccc] uppercase tracking-wider truncate">{label}</p>
      <p className="text-[18px] font-light text-[#ddd]">—</p>
    </div>
  );
  const col = gc(q.changePct);
  return (
    <div className="border border-[#ebebeb] rounded-lg px-3 py-3 flex flex-col gap-1 transition-colors"
         style={{ backgroundColor: gb(q.changePct) }}>
      <p className="text-[9.5px] font-semibold text-[#999] uppercase tracking-wider truncate">{label}</p>
      <p className="text-[18px] font-semibold text-[#0a0a0a] tabular-nums leading-tight">
        {pStr ?? fp(q.price)}
      </p>
      <div className="flex items-center gap-1.5">
        {q.changePct > 0
          ? <TrendingUp size={10} color={col} />
          : q.changePct < 0
          ? <TrendingDown size={10} color={col} />
          : <Minus size={10} color="#bbb" />}
        <span className="text-[11px] font-bold tabular-nums" style={{ color: col }}>{pp(q.changePct)}</span>
        <span className="text-[10px] text-[#c0c0c0] tabular-nums">
          ({q.change >= 0 ? "+" : ""}{Math.abs(q.change) < 10 ? q.change.toFixed(3) : q.change.toFixed(2)})
        </span>
      </div>
    </div>
  );
}

function IntlRow({ label, flag, q }: { label: string; flag: string; q: Quote | undefined }) {
  if (!q) return (
    <div className="flex items-center justify-between py-2 border-b border-[#f5f5f5] last:border-0">
      <span className="text-[12px] text-[#ddd]">{flag} {label}</span>
      <span className="text-[12px] text-[#ddd]">—</span>
    </div>
  );
  const col  = gc(q.changePct);
  const barW = Math.min(Math.abs(q.changePct) * 14, 48);
  return (
    <div className="flex items-center gap-3 py-[7px] border-b border-[#f5f5f5] last:border-0">
      <span className="text-[12px] text-[#444] w-36 shrink-0">{flag} {label}</span>
      <div className="flex-1 h-[3px] bg-[#f0f0f0] rounded-full relative overflow-hidden">
        <div className="absolute top-0 h-full rounded-full"
             style={{
               width: `${barW}%`,
               left:  q.changePct >= 0 ? "50%" : `${50 - barW}%`,
               backgroundColor: col,
             }} />
        <div className="absolute top-0 left-1/2 w-px h-full bg-[#e0e0e0]" />
      </div>
      <span className="text-[11.5px] font-semibold tabular-nums w-16 text-right" style={{ color: col }}>{pp(q.changePct)}</span>
      <span className="text-[11px] text-[#aaa] tabular-nums w-20 text-right">{fp(q.price)}</span>
    </div>
  );
}

function NewsRow({
  n, expanded, toggle, showTicker = false,
}: {
  n: NewsItem;
  expanded: boolean;
  toggle: () => void;
  showTicker?: boolean;
}) {
  return (
    <div className="py-3 border-b border-[#f5f5f5] last:border-0">
      <button className="w-full text-left flex items-start gap-2" onClick={toggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {showTicker && n.related && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#eef1f8] text-[#0c1b38] border border-[#d0d7e8]">{n.related}</span>
            )}
            <span className="text-[10px] font-medium text-[#bbb]">{n.source}</span>
            <span className="text-[10px] text-[#ddd]">· {ft(n.datetime)}</span>
          </div>
          <p className="text-[12.5px] font-medium text-[#0a0a0a] leading-snug pr-2">{n.headline}</p>
        </div>
        <span className="shrink-0 mt-1 text-[#ccc]">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>
      {expanded && (
        <div className="mt-2 pl-0 pr-4">
          <p className="text-[11.5px] text-[#555] leading-relaxed">{n.summary || "No summary available."}</p>
          {n.url && (
            <a href={n.url} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-[10.5px] text-[#0c1b38] font-medium mt-2 hover:underline">
              Read more <ExternalLink size={9} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Custom Recharts tooltip ───────────────────────────────────────────────────

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#ebebeb] rounded-md shadow-sm px-3 py-2">
      <p className="text-[10px] text-[#999] mb-0.5">{label}</p>
      <p className="text-[12px] font-semibold text-[#0a0a0a] tabular-nums">
        {payload[0].value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

function YieldTip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#ebebeb] rounded-md shadow-sm px-3 py-2">
      <p className="text-[12px] font-semibold text-[#0a0a0a] tabular-nums">{payload[0].value.toFixed(3)}%</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MorningPage() {
  const [data, setData]         = useState<Morning | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [newsTab, setNewsTab]   = useState<"market" | "portfolio" | "street">("market");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [mounted, setMounted]   = useState(false);
  const [brief, setBrief]       = useState("");
  const [briefType, setBriefType] = useState<"exec" | "full" | "email" | null>(null);
  const [generating, setGenerating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recharts needs DOM to know dimensions — only render after mount
  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const r = await fetch("/api/morning-data", { cache: "no-store" });
      if (!r.ok) throw new Error(`API error ${r.status}`);
      const d = await r.json() as Morning;
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  // ── AI brief ─────────────────────────────────────────────────────────────

  async function generateBrief(type: "exec" | "full" | "email") {
    if (!data || generating) return;
    setGenerating(true);
    setBriefType(type);
    setBrief("");

    const q  = data.quotes;
    const rg = regime(q);
    const ctx = [
      `Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`,
      `Market Regime: ${rg.label}`,
      `US Futures: S&P ${pp(q["ES=F"]?.changePct ?? 0)} | Nasdaq ${pp(q["NQ=F"]?.changePct ?? 0)} | Russell ${pp(q["RTY=F"]?.changePct ?? 0)} | Dow ${pp(q["YM=F"]?.changePct ?? 0)}`,
      `Rates: 10Y ${(q["^TNX"]?.price ?? 0).toFixed(2)}% (${pp(q["^TNX"]?.changePct ?? 0)}) | 5Y ${(q["^FVX"]?.price ?? 0).toFixed(2)}% | 30Y ${(q["^TYX"]?.price ?? 0).toFixed(2)}%`,
      `VIX: ${(q["^VIX"]?.price ?? 0).toFixed(2)} (${pp(q["^VIX"]?.changePct ?? 0)})`,
      `DXY: ${pp(q["DX-Y.NYB"]?.changePct ?? 0)} | Gold: ${pp(q["GC=F"]?.changePct ?? 0)} | WTI Crude: ${pp(q["CL=F"]?.changePct ?? 0)} | BTC: ${pp(q["BTC-USD"]?.changePct ?? 0)}`,
      `EUR/USD: ${pp(q["EURUSD=X"]?.changePct ?? 0)} | GBP/USD: ${pp(q["GBPUSD=X"]?.changePct ?? 0)} | USD/JPY: ${pp(q["JPY=X"]?.changePct ?? 0)}`,
      `Portfolio: ${PORTFOLIO.filter(s => q[s]).map(s => `${s} ${pp(q[s].changePct)}`).join(" | ")}`,
    ].join("\n");

    const prompts: Record<string, string> = {
      exec:
        `You are a senior macro strategist at a top hedge fund. Write exactly 2 sharp, punchy sentences summarizing today's most important market dynamic. Be concrete and specific — mention actual levels/moves. No fluff.\n\nMarket data:\n${ctx}`,
      full:
        `You are a senior macro strategist writing a morning brief for institutional equity traders. Write exactly 4 tight paragraphs:\n\n1. REGIME & TONE — Overall market character and what's driving it today\n2. RATES & FX — Key rate/yield/dollar dynamics and what they signal\n3. PORTFOLIO IMPLICATIONS — Specifically discuss META, AMZN, NVDA, AAPL, PYPL, HOOD, APLD given today's tape\n4. WATCH LIST — 3 specific things to watch today with concrete levels\n\nBe direct, institutional, specific. No hedging language. Max 350 words.\n\nData:\n${ctx}`,
      email:
        `You are a senior macro strategist. Write a concise morning market email to send to your trading desk. Format:\n\nSubject: [Morning Brief — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}]\n\n[Greeting]\n\n**Key Numbers:**\n[bullet points of the 6 most important moves]\n\n**The Story:**\n[2-3 sentences on the key theme]\n\n**Portfolio Watch:**\n[2-3 sentences on holdings given today's tape, be specific]\n\n**What to Watch:**\n[2-3 bullet points]\n\nHave a great trading day.\n[Sign-off]\n\nData:\n${ctx}`,
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
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const q     = data?.quotes ?? {};
  const rg    = regime(q);
  const now   = new Date();
  const tsStr = data ? new Date(data.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";

  const todayStr     = now.toISOString().split("T")[0];
  const todayEvents  = (data?.upcomingEvents ?? []).filter(e => e.date === todayStr);
  const futureEvents = (data?.upcomingEvents ?? []).filter(e => e.date > todayStr).slice(0, 8);

  const allNews       = data?.news ?? [];
  const portfolioNews = allNews.filter(n => PORTFOLIO.includes((n.related ?? "").toUpperCase())).slice(0, 15);
  const marketNews    = allNews.filter(n => !(n.related ?? "")).slice(0, 15);

  const aiSyms = PORTFOLIO.filter(s => AI_NAMES.has(s) && q[s]);
  const aiAvg  = aiSyms.length ? aiSyms.reduce((a, s) => a + q[s].changePct, 0) / aiSyms.length : 0;

  const ratesUp = (q["^TNX"]?.change ?? 0) > 0.04;

  const yldCurve = [
    { tenor: "13W", y: q["^IRX"]?.price ?? 0 },
    { tenor: "5Y",  y: q["^FVX"]?.price ?? 0 },
    { tenor: "10Y", y: q["^TNX"]?.price ?? 0 },
    { tenor: "30Y", y: q["^TYX"]?.price ?? 0 },
  ].filter(p => p.y > 0);

  // Label x-axis ticks for S&P chart — show only session transitions
  const spChart = (data?.spChart ?? []).map(p => {
    const d = new Date(p.t * 1000);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    // Show label only at start of each trading day (9:30 ET = 13:30 UTC)
    const label = (h === 13 && m === 30) || (h === 14 && m === 0)
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
    return { t: p.t, v: p.v, label };
  });

  const sectors = SECTORS
    .filter(s => q[s.sym])
    .map(s => ({ ...s, pct: q[s.sym].changePct }))
    .sort((a, b) => b.pct - a.pct);

  const hasData = Object.keys(q).length > 0;
  const spread  = q["^TNX"] && q["^IRX"] ? q["^TNX"].price - q["^IRX"].price : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 pb-6 border-b border-[#ebebeb]">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
              <span className="text-[9.5px] font-bold tracking-[0.24em] uppercase text-[#bbb]">Daily Morning Overview</span>
              <span className="w-1 h-1 rounded-full bg-[#e0e0e0]" />
              {hasData ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                      style={{ color: rg.c, borderColor: rg.c + "66", backgroundColor: rg.bg }}>
                  {rg.label}
                </span>
              ) : null}
              {loading && (
                <span className="flex items-center gap-1.5 text-[10px] text-[#bbb]">
                  <Activity size={10} className="animate-pulse" /> Loading…
                </span>
              )}
            </div>
            <h1 className="text-[34px] font-light text-[#0a0a0a] tracking-tight leading-none"
                style={{ fontFamily: "var(--font-serif)" }}>
              {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </h1>
            {data && (
              <p className="text-[11.5px] text-[#bbb] mt-2">
                Data as of {tsStr} · Auto-refreshes every 5 min
                {!hasData && " · Yahoo Finance may be rate-limiting — try again shortly"}
              </p>
            )}
          </div>
          <button onClick={() => { setLoading(true); load(); }}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0c1b38] border border-[#d0d7e8] hover:bg-[#eef1f8] active:bg-[#dde4f0] px-3 py-2 rounded-md transition-colors shrink-0 mt-1">
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        {error && (
          <div className="mt-3 text-[11.5px] text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2.5">
            {error}
          </div>
        )}
      </div>

      {/* ── US Futures ──────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <SL>US Futures</SL>
        <div className="grid grid-cols-4 gap-3">
          {FUTURES.map(f => <Tile key={f.sym} q={q[f.sym]} label={f.label} />)}
        </div>
      </section>

      {/* ── Rates & Vol ─────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <SL>Rates & Volatility</SL>
        <div className="grid grid-cols-5 gap-3">
          {RATES.map(r => (
            <Tile key={r.sym} q={q[r.sym]} label={r.label}
              pStr={q[r.sym] ? `${q[r.sym].price.toFixed(2)}${r.unit}` : undefined} />
          ))}
        </div>
      </section>

      {/* ── Commodities / Crypto / FX ────────────────────────────────────────── */}
      <section className="mb-8">
        <SL>Commodities · Crypto · FX</SL>
        <div className="grid grid-cols-8 gap-2 mb-2">
          {COMMODITIES.map(c => (
            <Tile key={c.sym} q={q[c.sym]} label={c.label}
              pStr={q[c.sym] ? c.f(q[c.sym].price) : undefined} />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {FX.map(f => (
            <Tile key={f.sym} q={q[f.sym]} label={f.label}
              pStr={q[f.sym] ? q[f.sym].price.toFixed(4) : undefined} />
          ))}
        </div>
      </section>

      {/* ── International Markets ────────────────────────────────────────────── */}
      <section className="mb-8 grid grid-cols-2 gap-5">
        <div className="border border-[#ebebeb] rounded-lg p-5">
          <SL>Europe</SL>
          {EUROPE.map(e => <IntlRow key={e.sym} {...e} q={q[e.sym]} />)}
        </div>
        <div className="border border-[#ebebeb] rounded-lg p-5">
          <SL>Asia-Pacific</SL>
          {ASIA.map(a => <IntlRow key={a.sym} {...a} q={q[a.sym]} />)}
        </div>
      </section>

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      <section className="mb-8 grid grid-cols-2 gap-5">

        {/* S&P 500 Futures 5-day */}
        <div className="border border-[#ebebeb] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <SL>S&P 500 Futures — 5 Day</SL>
            {q["ES=F"] && (
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: gc(q["ES=F"].changePct) }}>
                {q["ES=F"].price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
          <div className="h-44 w-full">
            {mounted && spChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spChart} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={GREEN} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={GREEN} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#bbb" }}
                    interval="preserveStartEnd" axisLine={false} tickLine={false}
                    tickFormatter={(v: string) => v || ""} />
                  <YAxis domain={["auto","auto"]} tick={{ fontSize: 9, fill: "#bbb" }}
                    axisLine={false} tickLine={false} width={50}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="v" stroke={GREEN} strokeWidth={1.8}
                    fill="url(#spg)" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            ) : mounted ? (
              <div className="h-full flex items-center justify-center text-[11px] text-[#ccc]">
                {loading ? "Loading chart…" : "No chart data"}
              </div>
            ) : null}
          </div>
        </div>

        {/* Yield Curve */}
        <div className="border border-[#ebebeb] rounded-lg p-5">
          <div className="flex items-center justify-between mb-1">
            <SL>Yield Curve</SL>
          </div>
          {spread !== null && (
            <p className="text-[11px] text-[#999] mb-3">
              3M–10Y spread: <span className="font-semibold" style={{ color: spread < 0 ? RED : "#0a0a0a" }}>
                {spread >= 0 ? "+" : ""}{spread.toFixed(2)}%
              </span>
              {spread < 0 && <span className="text-[10px] text-red-500 ml-1.5">Inverted</span>}
              {spread >= 0 && <span className="text-[10px] text-[#bbb] ml-1.5">Normal</span>}
            </p>
          )}
          <div className="h-40 w-full">
            {mounted && yldCurve.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yldCurve} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <XAxis dataKey="tenor" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, "auto"]} tick={{ fontSize: 9, fill: "#bbb" }}
                    axisLine={false} tickLine={false} width={38}
                    tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Tooltip content={<YieldTip />} />
                  <Bar dataKey="y" radius={[3, 3, 0, 0]}>
                    {yldCurve.map((entry, i) => {
                      const inv = i > 0 && entry.y < yldCurve[0].y;
                      return <Cell key={i} fill={inv ? RED : NAVY} fillOpacity={0.7} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : mounted ? (
              <div className="h-full flex items-center justify-center text-[11px] text-[#ccc]">
                {loading ? "Loading…" : "No yield data"}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── Portfolio Pulse ──────────────────────────────────────────────────── */}
      <section className="mb-8 border border-[#ebebeb] rounded-lg p-5">
        <div className="flex items-center justify-between mb-5">
          <SL>Portfolio Pulse</SL>
          <div className="flex items-center gap-5 text-[10.5px] text-[#999]">
            <span>
              AI/Tech avg:{" "}
              <span className="font-semibold" style={{ color: gc(aiAvg) }}>{pp(aiAvg)}</span>
            </span>
            {ratesUp && (
              <span className="font-semibold text-amber-600">
                ⚠ Rates rising — {[...RATE_NAMES].join(" · ")} under pressure
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2.5">
          {PORTFOLIO.map(sym => {
            const qp  = q[sym];
            const pn  = portfolioNews.find(n => (n.related ?? "").toUpperCase() === sym);
            const inRange = qp && qp.high52w > qp.low52w;
            const rangePct = inRange ? Math.max(0, Math.min(100, ((qp.price - qp.low52w) / (qp.high52w - qp.low52w)) * 100)) : 0;
            return (
              <div key={sym}
                   className="border border-[#ebebeb] rounded-lg p-3 flex flex-col gap-1 transition-colors"
                   style={{ backgroundColor: qp ? gb(qp.changePct) : "#fafafa" }}>
                <div className="flex items-start justify-between gap-1">
                  <span className={`text-[11px] font-bold ${AI_NAMES.has(sym) ? "text-[#0c1b38]" : "text-[#333]"}`}>{sym}</span>
                  <div className="flex items-center gap-1">
                    {AI_NAMES.has(sym) && <span className="text-[8px] text-[#0c1b38] bg-[#eef1f8] px-1 rounded font-semibold">AI</span>}
                    {pn && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="News" />}
                  </div>
                </div>
                <p className="text-[14px] font-semibold text-[#0a0a0a] tabular-nums leading-none">
                  {qp ? `$${fp(qp.price)}` : <span className="text-[#ddd]">—</span>}
                </p>
                {qp && (
                  <p className="text-[10.5px] font-bold tabular-nums" style={{ color: gc(qp.changePct) }}>
                    {pp(qp.changePct)}
                  </p>
                )}
                {inRange && (
                  <div className="mt-1 h-[2px] bg-[#eaeaea] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#0c1b38]" style={{ width: `${rangePct}%` }} />
                  </div>
                )}
                {pn && (
                  <p className="text-[9px] text-[#999] mt-0.5 leading-tight line-clamp-2">{pn.headline}</p>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[9.5px] text-[#ccc] mt-2.5">
          Bar = position in 52-week range · Yellow dot = news in last 48h · AI badge = AI/compute exposure
        </p>
      </section>

      {/* ── Sector Rotation ──────────────────────────────────────────────────── */}
      <section className="mb-8 border border-[#ebebeb] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <SL>Sector Rotation</SL>
          {sectors.length > 0 && (
            <span className="text-[10.5px] text-[#999]">
              Best: <span className="font-semibold text-[#0a0a0a]">{sectors[0]?.label}</span>
              <span className="mx-1.5 text-[#e0e0e0]">·</span>
              Worst: <span className="font-semibold text-[#0a0a0a]">{sectors[sectors.length - 1]?.label}</span>
            </span>
          )}
        </div>
        {sectors.length === 0 ? (
          <p className="text-[11.5px] text-[#ccc]">Loading sector data…</p>
        ) : (
          <div className="space-y-2">
            {sectors.map(s => {
              const col = gc(s.pct);
              const w   = Math.min(Math.abs(s.pct) * 12, 46);
              return (
                <div key={s.sym} className="flex items-center gap-3">
                  <span className="text-[11px] text-[#555] w-24 shrink-0">{s.label}</span>
                  <div className="flex-1 relative h-5 flex items-center">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-[#eee]" />
                    <div className="absolute h-4 rounded"
                         style={{
                           width: `${w}%`,
                           left:  s.pct >= 0 ? "50%" : `${50 - w}%`,
                           backgroundColor: col,
                           opacity: 0.75,
                         }} />
                  </div>
                  <span className="text-[11.5px] font-semibold tabular-nums w-14 text-right" style={{ color: col }}>
                    {pp(s.pct)}
                  </span>
                  <span className="text-[10px] text-[#ccc] font-mono w-8">{s.sym}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Calendar + Earnings ──────────────────────────────────────────────── */}
      <section className="mb-8 grid grid-cols-2 gap-5">

        {/* Macro Calendar */}
        <div className="border border-[#ebebeb] rounded-lg p-5">
          <SL>Macro Calendar</SL>
          {todayEvents.length === 0 && futureEvents.length === 0 ? (
            <p className="text-[11.5px] text-[#ccc]">No major events in the next two weeks.</p>
          ) : (
            <>
              {todayEvents.length > 0 && (
                <div className="mb-4">
                  <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#bbb] mb-2">Today</p>
                  {todayEvents.map((e, i) => (
                    <div key={i} className="flex items-start gap-2.5 py-2.5 border-b border-[#f5f5f5] last:border-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${CAT[e.category] ?? CAT.other}`}>
                        {e.category.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-[#0a0a0a]">{e.label}</p>
                        {e.previous && <p className="text-[10.5px] text-[#999] mt-0.5">Previous: {e.previous}</p>}
                      </div>
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${DOT[e.impact] ?? DOT.low}`} />
                    </div>
                  ))}
                </div>
              )}
              {futureEvents.length > 0 && (
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#bbb] mb-2">Upcoming</p>
                  {futureEvents.map((e, i) => (
                    <div key={i} className="flex items-center gap-2.5 py-2 border-b border-[#f5f5f5] last:border-0">
                      <span className="text-[10px] text-[#bbb] w-14 shrink-0 tabular-nums">{fd(e.date)}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${CAT[e.category] ?? CAT.other}`}>
                        {e.category.toUpperCase()}
                      </span>
                      <p className="text-[11.5px] text-[#555] flex-1 truncate">{e.label}</p>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[e.impact] ?? DOT.low}`} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Earnings Radar */}
        <div className="border border-[#ebebeb] rounded-lg p-5">
          <SL>Earnings Radar — Next 7 Days</SL>
          {!data ? (
            <p className="text-[11.5px] text-[#ccc]">Loading…</p>
          ) : data.earnings.length === 0 ? (
            <div>
              <p className="text-[11.5px] text-[#bbb]">No earnings data.</p>
              <p className="text-[10.5px] text-[#ccc] mt-1">Add FINNHUB_API_KEY to .env.local for live earnings calendar.</p>
            </div>
          ) : (
            <div>
              {data.earnings.slice(0, 14).map((e, i) => {
                const inPort = PORTFOLIO.includes(e.symbol.toUpperCase());
                return (
                  <div key={i}
                       className={`flex items-center gap-3 py-2 border-b border-[#f5f5f5] last:border-0 rounded ${inPort ? "-mx-2 px-2 bg-[#f8f9ff]" : ""}`}>
                    <span className={`text-[11.5px] font-bold w-14 shrink-0 ${inPort ? "text-[#0c1b38]" : "text-[#444]"}`}>
                      {e.symbol}
                    </span>
                    <span className="text-[10px] text-[#bbb] w-14 shrink-0 tabular-nums">{fd(e.date)}</span>
                    <span className="text-[9.5px] font-medium text-[#ccc] w-8 shrink-0">
                      {e.hour === "amc" ? "AMC" : e.hour === "bmo" ? "BMO" : ""}
                    </span>
                    {e.epsEstimate != null && (
                      <span className="text-[10.5px] text-[#888]">
                        EPS est: <span className="font-semibold text-[#333]">${e.epsEstimate.toFixed(2)}</span>
                      </span>
                    )}
                    {inPort && (
                      <span className="ml-auto text-[9px] font-bold text-[#0c1b38] bg-[#eef1f8] border border-[#c8d0e8] px-1.5 py-0.5 rounded">
                        Portfolio
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── News Feed ────────────────────────────────────────────────────────── */}
      <section className="mb-8 border border-[#ebebeb] rounded-lg overflow-hidden">
        <div className="flex border-b border-[#ebebeb] bg-[#fafafa]">
          {(["market", "portfolio", "street"] as const).map(t => (
            <button key={t} onClick={() => setNewsTab(t)}
              className={`px-5 py-3.5 text-[10.5px] font-bold uppercase tracking-widest transition-colors relative ${
                newsTab === t ? "text-[#0c1b38]" : "text-[#bbb] hover:text-[#777]"
              }`}>
              {t === "market" ? "Market News" : t === "portfolio" ? "My Portfolio" : "Street Action"}
              {newsTab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0c1b38]" />}
            </button>
          ))}
        </div>
        <div className="p-5">
          {newsTab === "market" && (
            marketNews.length === 0 ? (
              <div>
                <p className="text-[11.5px] text-[#bbb]">No market news available.</p>
                <p className="text-[10.5px] text-[#ccc] mt-1">Add FINNHUB_API_KEY to .env.local for live news headlines.</p>
              </div>
            ) : (
              marketNews.map(n => (
                <NewsRow key={n.id} n={n}
                  expanded={expanded.has(n.id)}
                  toggle={() => setExpanded(p => { const s = new Set(p); s.has(n.id) ? s.delete(n.id) : s.add(n.id); return s; })} />
              ))
            )
          )}
          {newsTab === "portfolio" && (
            portfolioNews.length === 0 ? (
              <div>
                <p className="text-[11.5px] text-[#bbb]">No portfolio-specific news in the last 48h.</p>
                <p className="text-[10.5px] text-[#ccc] mt-1">Add FINNHUB_API_KEY to .env.local.</p>
              </div>
            ) : (
              portfolioNews.map(n => (
                <NewsRow key={n.id} n={n} showTicker
                  expanded={expanded.has(n.id)}
                  toggle={() => setExpanded(p => { const s = new Set(p); s.has(n.id) ? s.delete(n.id) : s.add(n.id); return s; })} />
              ))
            )
          )}
          {newsTab === "street" && (
            <div>
              <p className="text-[11.5px] text-[#bbb]">Analyst upgrades/downgrades coming soon.</p>
              <p className="text-[10.5px] text-[#ccc] mt-1">Requires Finnhub premium — this tab will auto-populate when connected.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── AI Morning Brief ────────────────────────────────────────────────── */}
      <section className="border border-[#ebebeb] rounded-lg overflow-hidden">
        <div className="bg-[#0c1b38] px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/50 mb-1">AI Morning Brief</p>
            <p className="text-[13px] font-medium text-white">Powered by Claude · uses all live data above</p>
          </div>
          <Newspaper size={18} className="text-white/30" />
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <button onClick={() => generateBrief("exec")} disabled={generating || !hasData}
              className="text-[11px] font-semibold px-4 py-2.5 rounded-md border border-[#c8d0e8] bg-[#eef1f8] text-[#0c1b38] hover:bg-[#dde4f0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {generating && briefType === "exec" ? "Generating…" : "2-Sentence Summary"}
            </button>
            <button onClick={() => generateBrief("full")} disabled={generating || !hasData}
              className="text-[11px] font-semibold px-4 py-2.5 rounded-md bg-[#0c1b38] text-white hover:bg-[#1a3361] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {generating && briefType === "full" ? "Generating…" : "Full Morning Brief"}
            </button>
            <button onClick={() => generateBrief("email")} disabled={generating || !hasData}
              className="text-[11px] font-semibold px-4 py-2.5 rounded-md border border-[#c8d0e8] bg-[#eef1f8] text-[#0c1b38] hover:bg-[#dde4f0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {generating && briefType === "email" ? "Generating…" : "Draft Trader Email"}
            </button>
            {generating && (
              <span className="flex items-center gap-1.5 text-[10.5px] text-[#999]">
                <span className="w-2 h-2 rounded-full bg-[#0c1b38] animate-pulse" /> Streaming…
              </span>
            )}
          </div>

          {!hasData && (
            <p className="text-[11px] text-[#ccc]">Buttons will activate once market data loads.</p>
          )}

          {brief ? (
            <div className="bg-[#fbfaf7] border border-[#ebebeb] rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#bbb]">
                  {briefType === "exec" ? "Executive Summary" : briefType === "full" ? "Morning Brief" : "Trader Email Draft"}
                </p>
                <button onClick={() => { navigator.clipboard.writeText(brief); }}
                  className="text-[10px] text-[#999] hover:text-[#0c1b38] transition-colors">
                  Copy
                </button>
              </div>
              <pre className="text-[12.5px] text-[#1a1a1a] leading-[1.8] whitespace-pre-wrap font-sans">{brief}</pre>
            </div>
          ) : !generating && (
            <p className="text-[11px] text-[#ccc]">
              Click a button to generate. Requires{" "}
              <code className="bg-[#f5f5f5] px-1 rounded text-[10.5px]">ANTHROPIC_API_KEY</code>{" "}
              in .env.local.
            </p>
          )}
        </div>
      </section>

    </AppShell>
  );
}
