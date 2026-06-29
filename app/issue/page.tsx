"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  RefreshCw, TrendingUp, TrendingDown, Minus, Newspaper, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

type Quote = {
  symbol: string; name: string; price: number; change: number;
  changePct: number; prev: number; high52w: number; low52w: number;
};
type NewsItem  = { id: number; headline: string; source: string; summary: string; datetime: number; related: string; url: string };
type Earnings  = { symbol: string; date: string; epsEstimate: number | null; hour: string };
type CalEvent  = { date: string; label: string; category: string; impact: string; previous?: string; estimate?: string };
type MorningData = {
  ts: string;
  quotes: Record<string, Quote>;
  spChart: { t: number; v: number }[];
  news: NewsItem[];
  earnings: Earnings[];
  upcomingEvents: CalEvent[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PORTFOLIO  = ["META","UBER","DUOL","VOO","AMZN","PYPL","APLD","AAPL","CMG","ONT","HOOD","NVDA","VUG"];
const AI_NAMES   = new Set(["NVDA","APLD","META","AMZN","AAPL","DUOL"]);

const FUTURES = [
  { sym: "ES=F",  label: "S&P 500 Fut" },
  { sym: "NQ=F",  label: "Nasdaq 100 Fut" },
  { sym: "RTY=F", label: "Russell 2000" },
  { sym: "YM=F",  label: "Dow Jones Fut" },
];
const RATES = [
  { sym: "^TNX", label: "10Y Treasury", unit: "%" },
  { sym: "^TYX", label: "30Y Treasury", unit: "%" },
  { sym: "^FVX", label: "5Y Treasury",  unit: "%" },
  { sym: "^IRX", label: "13W T-Bill",   unit: "%" },
  { sym: "^VIX", label: "VIX",          unit: ""  },
];
const COMMODITIES = [
  { sym: "CL=F",     label: "WTI Crude", fmt: (v: number) => `$${v.toFixed(2)}` },
  { sym: "GC=F",     label: "Gold",      fmt: (v: number) => `$${v.toFixed(0)}` },
  { sym: "SI=F",     label: "Silver",    fmt: (v: number) => `$${v.toFixed(2)}` },
  { sym: "HG=F",     label: "Copper",    fmt: (v: number) => `$${v.toFixed(3)}` },
  { sym: "NG=F",     label: "Nat Gas",   fmt: (v: number) => `$${v.toFixed(3)}` },
  { sym: "BTC-USD",  label: "Bitcoin",   fmt: (v: number) => `$${v.toLocaleString("en", { maximumFractionDigits: 0 })}` },
  { sym: "ETH-USD",  label: "Ethereum",  fmt: (v: number) => `$${v.toFixed(0)}` },
  { sym: "DX-Y.NYB", label: "DXY",       fmt: (v: number) => v.toFixed(2) },
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

const CAT_COLORS: Record<string, string> = {
  fomc:  "bg-[#eef1f8] text-[#0c1b38] border-[#c8d0e8]",
  cpi:   "bg-amber-50 text-amber-700 border-amber-200",
  jobs:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  gdp:   "bg-purple-50 text-purple-700 border-purple-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};
const IMPACT_DOT: Record<string, string> = { high: "bg-red-500", medium: "bg-amber-400", low: "bg-gray-300" };

const GREEN = "#147a4f";
const RED   = "#b42318";
const NAVY  = "#0c1b38";

// ── Helpers ──────────────────────────────────────────────────────────────────

const pctColor = (p: number) => (p > 0 ? GREEN : p < 0 ? RED : "#888");
const pctBg    = (p: number) => (p > 0 ? "#f0faf4" : p < 0 ? "#fff5f5" : "#fafafa");
const fmt      = (n: number, d = 2) => n.toFixed(d);
const fmtPct   = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fmtPrice = (n: number) =>
  n >= 1000 ? n.toLocaleString("en", { maximumFractionDigits: 2 }) : n.toFixed(2);
const fmtTime  = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
const fmtDate  = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function computeRegime(q: Record<string, Quote>): { label: string; color: string; bg: string } {
  const sp   = q["ES=F"]?.changePct     ?? 0;
  const vix  = q["^VIX"]?.changePct     ?? 0;
  const t10  = q["^TNX"]?.change        ?? 0;
  const gold = q["GC=F"]?.changePct     ?? 0;
  const dxy  = q["DX-Y.NYB"]?.changePct ?? 0;
  const oil  = q["CL=F"]?.changePct     ?? 0;

  if (sp < -1 && t10 > 0.03)    return { label: "Rates-Led Selloff",  color: RED,    bg: "#fff5f5" };
  if (sp > 1.2 && vix < -5)     return { label: "Risk-On Melt-Up",    color: GREEN,  bg: "#f0faf4" };
  if (sp < -0.5 && gold > 0.8)  return { label: "Defensive Flight",   color: "#92400e", bg: "#fef9f0" };
  if (oil > 2.5)                 return { label: "Commodity Shock",    color: "#92400e", bg: "#fef9f0" };
  if (dxy > 0.5 && sp < 0)      return { label: "Dollar Squeeze",     color: RED,    bg: "#fff5f5" };
  if (sp > 0.5 && vix < -3)     return { label: "Risk-On Grind",      color: GREEN,  bg: "#f0faf4" };
  if (Math.abs(sp) < 0.25)      return { label: "Consolidation",      color: "#666", bg: "#fafafa" };
  if (sp > 0)                    return { label: "Cautiously Bullish", color: GREEN,  bg: "#f0faf4" };
  return                                { label: "Cautiously Bearish", color: RED,    bg: "#fff5f5" };
}

// ── Spark SVG ────────────────────────────────────────────────────────────────

function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const W = 56, H = 20;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SL({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#0c1b38] mb-3">{children}</p>;
}

// ── Indicator tile ────────────────────────────────────────────────────────────

function Tile({
  q, label, priceStr, spark,
}: { q: Quote | undefined; label: string; priceStr?: string; spark?: number[] }) {
  if (!q) return (
    <div className="border border-[#ebebeb] rounded-md px-3 py-2.5 flex flex-col gap-0.5">
      <p className="text-[10px] text-[#bbb] uppercase tracking-wide truncate">{label}</p>
      <p className="text-[16px] font-semibold text-[#ddd]">—</p>
    </div>
  );
  const color = pctColor(q.changePct);
  return (
    <div className="border border-[#ebebeb] rounded-md px-3 py-2.5 flex flex-col gap-0.5"
         style={{ backgroundColor: pctBg(q.changePct) }}>
      <p className="text-[10px] text-[#888] uppercase tracking-wide truncate">{label}</p>
      <div className="flex items-end justify-between gap-1">
        <p className="text-[17px] font-semibold text-[#0a0a0a] tabular-nums leading-tight">
          {priceStr ?? fmtPrice(q.price)}
        </p>
        {spark && <Spark data={spark} color={color} />}
      </div>
      <div className="flex items-center gap-1">
        {q.changePct > 0 ? <TrendingUp size={9} color={color} />
          : q.changePct < 0 ? <TrendingDown size={9} color={color} />
          : <Minus size={9} color="#aaa" />}
        <span className="text-[10.5px] font-semibold tabular-nums" style={{ color }}>{fmtPct(q.changePct)}</span>
        <span className="text-[9.5px] text-[#bbb] tabular-nums">
          ({q.change >= 0 ? "+" : ""}{fmt(q.change, q.price > 100 ? 2 : 3)})
        </span>
      </div>
    </div>
  );
}

// ── Intl row ──────────────────────────────────────────────────────────────────

function IntlRow({ label, flag, q }: { label: string; flag: string; q: Quote | undefined }) {
  if (!q) return (
    <div className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
      <span className="text-[12px] text-[#bbb]">{flag} {label}</span>
      <span className="text-[12px] text-[#ddd]">—</span>
    </div>
  );
  const color = pctColor(q.changePct);
  const pctW  = Math.min(Math.abs(q.changePct) * 15, 50);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#f0f0f0] last:border-0">
      <span className="text-[12px] text-[#555] w-36 shrink-0">{flag} {label}</span>
      <div className="flex-1 h-[3px] bg-[#f0f0f0] rounded-full overflow-hidden">
        <div className="h-full rounded-full"
             style={{ width: `${pctW}%`, marginLeft: q.changePct < 0 ? `${50 - pctW}%` : "50%", backgroundColor: color }} />
      </div>
      <span className="text-[11.5px] font-semibold tabular-nums w-16 text-right" style={{ color }}>{fmtPct(q.changePct)}</span>
      <span className="text-[11px] text-[#999] tabular-nums w-20 text-right">{fmtPrice(q.price)}</span>
    </div>
  );
}

// ── News row ──────────────────────────────────────────────────────────────────

function NewsRow({
  n, expanded, setExpanded, showTicker = false,
}: {
  n: NewsItem;
  expanded: Set<number>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<number>>>;
  showTicker?: boolean;
}) {
  const isOpen = expanded.has(n.id);
  return (
    <div className="py-3 border-b border-[#f5f5f5] last:border-0">
      <div className="flex items-start gap-2 cursor-pointer"
           onClick={() => setExpanded(prev => { const s = new Set(prev); s.has(n.id) ? s.delete(n.id) : s.add(n.id); return s; })}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {showTicker && n.related && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#eef1f8] text-[#0c1b38]">{n.related}</span>
            )}
            <span className="text-[10px] text-[#bbb]">{n.source}</span>
            <span className="text-[10px] text-[#ddd]">· {fmtTime(n.datetime)}</span>
          </div>
          <p className="text-[12.5px] font-medium text-[#0a0a0a] leading-snug">{n.headline}</p>
        </div>
        <span className="shrink-0 mt-0.5 text-[#bbb]">{isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
      </div>
      {isOpen && (
        <div className="mt-2">
          <p className="text-[11.5px] text-[#555] leading-relaxed">{n.summary}</p>
          {n.url && (
            <a href={n.url} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-[10.5px] text-[#0c1b38] mt-1.5 hover:underline">
              Read more <ExternalLink size={9} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MorningPage() {
  const [data, setData]         = useState<MorningData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [newsTab, setNewsTab]   = useState<"market" | "portfolio" | "street">("market");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [brief, setBrief]       = useState("");
  const [genState, setGenState] = useState<"idle" | "exec" | "full" | "email">("idle");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/morning-data", { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  // ── AI generation ────────────────────────────────────────────────────────

  async function generateBrief(type: "exec" | "full" | "email") {
    if (!data) return;
    setGenState(type);
    setBrief("");
    const q = data.quotes;
    const context = [
      `Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`,
      `Regime: ${computeRegime(q).label}`,
      `S&P Futures: ${fmtPct(q["ES=F"]?.changePct ?? 0)} | Nasdaq: ${fmtPct(q["NQ=F"]?.changePct ?? 0)} | Russell: ${fmtPct(q["RTY=F"]?.changePct ?? 0)}`,
      `10Y Yield: ${fmt(q["^TNX"]?.price ?? 0)}% (${(q["^TNX"]?.change ?? 0) >= 0 ? "+" : ""}${fmt(q["^TNX"]?.change ?? 0, 3)}) | 2s10s: ${((q["^TNX"]?.price ?? 0) - (q["^IRX"]?.price ?? 0)).toFixed(2)}%`,
      `VIX: ${fmt(q["^VIX"]?.price ?? 0)} (${fmtPct(q["^VIX"]?.changePct ?? 0)})`,
      `DXY: ${fmtPct(q["DX-Y.NYB"]?.changePct ?? 0)} | Gold: ${fmtPct(q["GC=F"]?.changePct ?? 0)} | Crude: ${fmtPct(q["CL=F"]?.changePct ?? 0)} | BTC: ${fmtPct(q["BTC-USD"]?.changePct ?? 0)}`,
      `Portfolio: ${PORTFOLIO.filter(s => q[s]).map(s => `${s} ${fmtPct(q[s]?.changePct ?? 0)}`).join(", ")}`,
    ].join("\n");

    const prompts: Record<string, string> = {
      exec: `You are a senior macro strategist. Write exactly 2 sharp sentences summarizing the most important market theme right now. Be specific. Data:\n${context}`,
      full: `You are a senior macro strategist writing a morning brief for institutional traders. Write 4 concise paragraphs: 1) Overall market tone and regime, 2) Key macro/rates/FX dynamics, 3) Portfolio implications for these holdings: META, UBER, DUOL, AMZN, PYPL, APLD, AAPL, CMG, HOOD, NVDA, 4) Key risks and what to watch. Institutional tone. Data:\n${context}`,
      email: `You are a senior macro strategist. Write a morning market email for traders. Format: greeting, bullet-point key indicators, 3-4 paragraph analysis, sign-off "Have a great day." Professional and direct. Data:\n${context}`,
    };

    try {
      const r = await fetch("/api/generate-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompts[type], stream: true }),
      });
      if (!r.ok || !r.body) { setBrief("Failed — check ANTHROPIC_API_KEY."); setGenState("idle"); return; }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value).split("\n").filter(l => l.startsWith("data: "))) {
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const j = JSON.parse(raw);
            const t = j.delta?.text ?? j.choices?.[0]?.delta?.content ?? "";
            if (t) setBrief(prev => prev + t);
          } catch { /* ignore parse errors */ }
        }
      }
    } catch { setBrief("Error generating brief."); }
    finally { setGenState("idle"); }
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const q      = data?.quotes ?? {};
  const regime = computeRegime(q);
  const now    = new Date();
  const tsStr  = data ? new Date(data.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—";

  const todayStr     = now.toISOString().split("T")[0];
  const todayEvents  = (data?.upcomingEvents ?? []).filter(e => e.date === todayStr);
  const futureEvents = (data?.upcomingEvents ?? []).filter(e => e.date > todayStr).slice(0, 6);

  const portfolioNews = (data?.news ?? []).filter(n => PORTFOLIO.includes(n.related?.toUpperCase())).slice(0, 12);
  const marketNews    = (data?.news ?? []).filter(n => !n.related || n.related === "").slice(0, 12);

  const aiCount   = PORTFOLIO.filter(s => AI_NAMES.has(s) && q[s]).length;
  const aiAvgMove = aiCount > 0
    ? PORTFOLIO.filter(s => AI_NAMES.has(s) && q[s]).reduce((acc, s) => acc + (q[s]?.changePct ?? 0), 0) / aiCount
    : 0;

  const yieldCurve = [
    { tenor: "13W", y: q["^IRX"]?.price ?? 0 },
    { tenor: "5Y",  y: q["^FVX"]?.price ?? 0 },
    { tenor: "10Y", y: q["^TNX"]?.price ?? 0 },
    { tenor: "30Y", y: q["^TYX"]?.price ?? 0 },
  ].filter(p => p.y > 0);

  const spChart = (data?.spChart ?? []).map(p => ({
    t: p.t, v: p.v,
    label: new Date(p.t * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", hour12: true }),
  }));

  const sectorData = SECTORS
    .filter(s => q[s.sym])
    .map(s => ({ ...s, pct: q[s.sym].changePct }))
    .sort((a, b) => b.pct - a.pct);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 pb-6 border-b border-[#ebebeb] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#0c1b38]">Daily Morning Overview</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold"
                  style={{ color: regime.color, borderColor: regime.color, backgroundColor: regime.bg }}>
              {regime.label}
            </span>
          </div>
          <h1 className="text-[32px] font-light text-[#0a0a0a] tracking-tight leading-none"
              style={{ fontFamily: "var(--font-serif)" }}>
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h1>
          <p className="text-[12px] text-[#bbb] mt-1.5">Updated {tsStr} · Auto-refreshes every 5 min</p>
        </div>
        <button onClick={() => { setLoading(true); load(); }}
          className="flex items-center gap-2 text-[11px] font-medium text-[#0c1b38] border border-[#d0d7e8] hover:bg-[#eef1f8] px-3 py-2 rounded-md transition-colors">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* ── US Futures ──────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <SL>US Futures</SL>
        <div className="grid grid-cols-4 gap-3">
          {FUTURES.map(f => <Tile key={f.sym} q={q[f.sym]} label={f.label} />)}
        </div>
      </div>

      {/* ── Rates & Volatility ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <SL>Rates & Volatility</SL>
        <div className="grid grid-cols-5 gap-3">
          {RATES.map(r => (
            <Tile key={r.sym} q={q[r.sym]} label={r.label}
              priceStr={q[r.sym] ? `${fmt(q[r.sym].price)}${r.unit}` : undefined} />
          ))}
        </div>
      </div>

      {/* ── Commodities + FX ────────────────────────────────────────────────── */}
      <div className="mb-8">
        <SL>Commodities · Crypto · FX</SL>
        <div className="grid grid-cols-8 gap-2">
          {COMMODITIES.map(c => (
            <Tile key={c.sym} q={q[c.sym]} label={c.label}
              priceStr={q[c.sym] ? c.fmt(q[c.sym].price) : undefined} />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {FX.map(f => (
            <Tile key={f.sym} q={q[f.sym]} label={f.label}
              priceStr={q[f.sym] ? fmt(q[f.sym].price, 4) : undefined} />
          ))}
        </div>
      </div>

      {/* ── International ────────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-5">
        <div className="border border-[#ebebeb] rounded-md p-5">
          <SL>Europe</SL>
          {EUROPE.map(e => <IntlRow key={e.sym} {...e} q={q[e.sym]} />)}
        </div>
        <div className="border border-[#ebebeb] rounded-md p-5">
          <SL>Asia-Pacific</SL>
          {ASIA.map(a => <IntlRow key={a.sym} {...a} q={q[a.sym]} />)}
        </div>
      </div>

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-5">
        {/* S&P Futures */}
        <div className="border border-[#ebebeb] rounded-md p-5">
          <SL>S&P 500 Futures — 5 Day</SL>
          {spChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={spChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={GREEN} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={GREEN} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#aaa" }} interval="preserveStartEnd"
                  axisLine={false} tickLine={false} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 9, fill: "#aaa" }} axisLine={false}
                  tickLine={false} width={52}
                  tickFormatter={(v: number) => v.toLocaleString("en", { maximumFractionDigits: 0 })} />
                <Tooltip contentStyle={{ fontSize: 10, border: "1px solid #ebebeb", borderRadius: 4, boxShadow: "none" }}
                  formatter={(v: unknown) => [(v as number).toLocaleString("en", { maximumFractionDigits: 2 }), "ES=F"]}
                  labelFormatter={(l: unknown) => String(l)} />
                <Area type="monotone" dataKey="v" stroke={GREEN} strokeWidth={1.8} fill="url(#spGrad)"
                  dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-[11px] text-[#ccc]">Loading chart…</div>
          )}
        </div>

        {/* Yield Curve */}
        <div className="border border-[#ebebeb] rounded-md p-5">
          <SL>Yield Curve</SL>
          <p className="text-[10.5px] text-[#999] mb-3">
            2s10s spread:{" "}
            <span className="font-semibold text-[#0a0a0a]">
              {q["^TNX"]?.price && q["^IRX"]?.price
                ? `${((q["^TNX"].price - q["^IRX"].price) >= 0 ? "+" : "")}${((q["^TNX"].price ?? 0) - (q["^IRX"].price ?? 0)).toFixed(2)}%`
                : "—"}
            </span>
          </p>
          {yieldCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={yieldCurve} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="tenor" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, "auto"]} tick={{ fontSize: 9, fill: "#aaa" }} axisLine={false}
                  tickLine={false} width={32} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                <Tooltip contentStyle={{ fontSize: 10, border: "1px solid #ebebeb", borderRadius: 4, boxShadow: "none" }}
                  formatter={(v: unknown) => [`${(v as number).toFixed(3)}%`, "Yield"]} />
                <Bar dataKey="y" radius={[3, 3, 0, 0]}>
                  {yieldCurve.map((entry, i) => {
                    const inv = i > 0 && entry.y < yieldCurve[0].y;
                    return <Cell key={i} fill={inv ? RED : NAVY} fillOpacity={0.75} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-36 flex items-center justify-center text-[11px] text-[#ccc]">Loading…</div>
          )}
        </div>
      </div>

      {/* ── Portfolio Pulse ──────────────────────────────────────────────────── */}
      <div className="mb-8 border border-[#ebebeb] rounded-md p-5">
        <div className="flex items-center justify-between mb-4">
          <SL>Portfolio Pulse</SL>
          <div className="flex items-center gap-4 text-[10.5px] text-[#888]">
            <span>AI/Tech avg: <span className="font-semibold text-[#0a0a0a]" style={{ color: pctColor(aiAvgMove) }}>{fmtPct(aiAvgMove)}</span></span>
            {(q["^TNX"]?.change ?? 0) > 0.03 && (
              <span className="text-amber-600 font-semibold text-[10px]">⚠ Rates up — PYPL · HOOD · APLD sensitive</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {PORTFOLIO.map(sym => {
            const pq = q[sym];
            const pn = portfolioNews.find(n => n.related?.toUpperCase() === sym);
            return (
              <div key={sym} className="border border-[#ebebeb] rounded-md p-2.5"
                   style={{ backgroundColor: pq ? pctBg(pq.changePct) : "#fafafa" }}>
                <div className="flex items-start justify-between">
                  <span className="text-[11px] font-bold text-[#0c1b38]">{sym}</span>
                  {pn && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5" title="News today" />}
                </div>
                <p className="text-[13px] font-semibold text-[#0a0a0a] tabular-nums mt-0.5">
                  {pq ? `$${fmtPrice(pq.price)}` : "—"}
                </p>
                {pq && (
                  <p className="text-[10px] font-semibold tabular-nums mt-0.5" style={{ color: pctColor(pq.changePct) }}>
                    {fmtPct(pq.changePct)}
                  </p>
                )}
                {pq && pq.high52w > 0 && pq.low52w > 0 && (
                  <div className="mt-1.5 h-[2px] bg-[#e8e8e8] rounded-full overflow-hidden">
                    <div className="h-full bg-[#0c1b38] rounded-full"
                         style={{ width: `${Math.max(0, Math.min(100, ((pq.price - pq.low52w) / (pq.high52w - pq.low52w)) * 100))}%` }} />
                  </div>
                )}
                {pn && <p className="text-[9px] text-[#999] mt-1 leading-tight line-clamp-2">{pn.headline}</p>}
              </div>
            );
          })}
        </div>
        <p className="text-[9.5px] text-[#ccc] mt-2">Bar = position in 52-week range · Yellow dot = news today</p>
      </div>

      {/* ── Sector Rotation ──────────────────────────────────────────────────── */}
      <div className="mb-8 border border-[#ebebeb] rounded-md p-5">
        <div className="flex items-center justify-between mb-4">
          <SL>Sector Rotation</SL>
          {sectorData.length > 0 && (
            <span className="text-[10.5px] text-[#888]">
              Leading: <span className="font-semibold text-[#0a0a0a]">{sectorData[0]?.label}</span>
              {" "}· Lagging: <span className="font-semibold text-[#0a0a0a]">{sectorData[sectorData.length - 1]?.label}</span>
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {sectorData.map(s => {
            const color = pctColor(s.pct);
            const w = Math.min(Math.abs(s.pct) * 10, 40);
            return (
              <div key={s.sym} className="flex items-center gap-3">
                <span className="text-[11px] text-[#555] w-24 shrink-0">{s.label}</span>
                <div className="flex-1 flex items-center h-4 relative">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-[#e8e8e8]" />
                  <div className="h-3 rounded-sm absolute"
                       style={{ width: `${w}%`, left: s.pct >= 0 ? "50%" : `${50 - w}%`, backgroundColor: color, opacity: 0.8 }} />
                </div>
                <span className="text-[11px] font-semibold tabular-nums w-14 text-right" style={{ color }}>{fmtPct(s.pct)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Calendar + Earnings ──────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-5">
        <div className="border border-[#ebebeb] rounded-md p-5">
          <SL>Macro Calendar</SL>
          {todayEvents.length === 0 && futureEvents.length === 0 ? (
            <p className="text-[11.5px] text-[#ccc]">No major events this week.</p>
          ) : (
            <>
              {todayEvents.length > 0 && (
                <div className="mb-3">
                  <p className="text-[9.5px] font-semibold uppercase tracking-wider text-[#999] mb-2">Today</p>
                  {todayEvents.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 py-2 border-b border-[#f0f0f0] last:border-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${CAT_COLORS[e.category] ?? CAT_COLORS.other}`}>
                        {e.category.toUpperCase()}
                      </span>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-[#0a0a0a]">{e.label}</p>
                        {e.previous && <p className="text-[10px] text-[#999]">Prev: {e.previous}</p>}
                      </div>
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${IMPACT_DOT[e.impact] ?? IMPACT_DOT.low}`} />
                    </div>
                  ))}
                </div>
              )}
              {futureEvents.length > 0 && (
                <div>
                  <p className="text-[9.5px] font-semibold uppercase tracking-wider text-[#999] mb-2">Upcoming</p>
                  {futureEvents.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#f5f5f5] last:border-0">
                      <span className="text-[10px] text-[#bbb] w-14 shrink-0">{fmtDate(e.date)}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${CAT_COLORS[e.category] ?? CAT_COLORS.other}`}>
                        {e.category.toUpperCase()}
                      </span>
                      <p className="text-[11px] text-[#555] truncate">{e.label}</p>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_DOT[e.impact] ?? IMPACT_DOT.low}`} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border border-[#ebebeb] rounded-md p-5">
          <SL>Earnings Radar — Next 7 Days</SL>
          {(data?.earnings ?? []).length === 0 ? (
            <p className="text-[11.5px] text-[#ccc]">{loading ? "Loading…" : "Add FINNHUB_API_KEY for live earnings."}</p>
          ) : (
            <div>
              {data!.earnings.slice(0, 12).map((e, i) => {
                const inPort = PORTFOLIO.includes(e.symbol.toUpperCase());
                return (
                  <div key={i}
                       className={`flex items-center gap-3 py-2 border-b border-[#f5f5f5] last:border-0 ${inPort ? "bg-[#f8f9ff] -mx-2 px-2 rounded" : ""}`}>
                    <span className={`text-[11px] font-bold w-14 ${inPort ? "text-[#0c1b38]" : "text-[#555]"}`}>{e.symbol}</span>
                    <span className="text-[10px] text-[#bbb] w-16">{fmtDate(e.date)}</span>
                    <span className="text-[9.5px] text-[#bbb] w-10">{e.hour === "amc" ? "AMC" : e.hour === "bmo" ? "BMO" : ""}</span>
                    {e.epsEstimate != null && (
                      <span className="text-[10.5px] text-[#777]">EPS est: <span className="font-semibold text-[#0a0a0a]">${e.epsEstimate.toFixed(2)}</span></span>
                    )}
                    {inPort && <span className="ml-auto text-[9px] font-bold text-[#0c1b38] bg-[#eef1f8] px-1.5 py-0.5 rounded">Portfolio</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── News Feed ────────────────────────────────────────────────────────── */}
      <div className="mb-8 border border-[#ebebeb] rounded-md">
        <div className="flex border-b border-[#ebebeb]">
          {(["market", "portfolio", "street"] as const).map(t => (
            <button key={t} onClick={() => setNewsTab(t)}
              className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                newsTab === t
                  ? "text-[#0c1b38] border-b-2 border-[#0c1b38] -mb-px"
                  : "text-[#bbb] hover:text-[#555]"
              }`}>
              {t === "market" ? "Market News" : t === "portfolio" ? "My Portfolio" : "Street Action"}
            </button>
          ))}
        </div>
        <div className="p-5">
          {newsTab === "market" && (
            marketNews.length === 0
              ? <p className="text-[11.5px] text-[#ccc]">{loading ? "Loading…" : "Add FINNHUB_API_KEY for live news."}</p>
              : marketNews.map(n => <NewsRow key={n.id} n={n} expanded={expanded} setExpanded={setExpanded} />)
          )}
          {newsTab === "portfolio" && (
            portfolioNews.length === 0
              ? <p className="text-[11.5px] text-[#ccc]">{loading ? "Loading…" : "No portfolio news in last 48h."}</p>
              : portfolioNews.map(n => <NewsRow key={n.id} n={n} expanded={expanded} setExpanded={setExpanded} showTicker />)
          )}
          {newsTab === "street" && (
            <p className="text-[11.5px] text-[#bbb]">Upgrades/downgrades coming via Finnhub premium endpoint.</p>
          )}
        </div>
      </div>

      {/* ── AI Morning Brief ────────────────────────────────────────────────── */}
      <div className="border border-[#ebebeb] rounded-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <SL>AI Morning Brief</SL>
            <p className="text-[11.5px] text-[#999] -mt-1">Claude · Uses all live data above as context</p>
          </div>
          <Newspaper size={16} className="text-[#bbb]" />
        </div>
        <div className="flex items-center gap-3 mb-5">
          {(["exec", "full", "email"] as const).map(t => (
            <button key={t} onClick={() => generateBrief(t)} disabled={genState !== "idle"}
              className={`text-[11px] font-semibold px-4 py-2 rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                t === "full"
                  ? "bg-[#0c1b38] text-white border-[#0c1b38] hover:bg-[#1a3361]"
                  : "text-[#0c1b38] border-[#c8d0e8] bg-[#eef1f8] hover:bg-[#dde4f0]"
              }`}>
              {genState === t ? "Generating…"
                : t === "exec" ? "2-Sentence Summary"
                : t === "full" ? "Full Morning Brief"
                : "Draft Trader Email"}
            </button>
          ))}
        </div>
        {brief ? (
          <div className="bg-[#fbfaf7] border border-[#ebebeb] rounded-md p-5">
            <pre className="text-[12.5px] text-[#1a1a1a] leading-[1.7] whitespace-pre-wrap font-sans">{brief}</pre>
          </div>
        ) : (
          <p className="text-[11px] text-[#ccc]">Click a button above to generate. Requires ANTHROPIC_API_KEY.</p>
        )}
      </div>

    </AppShell>
  );
}
