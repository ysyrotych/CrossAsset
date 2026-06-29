import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Yahoo Finance v8/chart works on query2 without crumb auth.
// The v7/quote endpoint requires crumb, which fails in Node (HeadersOverflowError).
const YF2 = "https://query2.finance.yahoo.com";
const YF_HDRS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

// ── All symbols we want ───────────────────────────────────────────────────────

const ALL_SYMBOLS = [
  // US Futures
  "ES=F","NQ=F","RTY=F","YM=F",
  // Vol + Rates
  "^VIX","^TNX","^TYX","^FVX","^IRX",
  // Macro
  "DX-Y.NYB","CL=F","GC=F","SI=F","NG=F","HG=F","BTC-USD","ETH-USD",
  // Europe
  "^FTSE","^GDAXI","^FCHI","^STOXX50E","^IBEX",
  // Asia
  "^N225","^HSI","000001.SS","^KS11","^AXJO","^TWII","^BSESN",
  // FX
  "EURUSD=X","GBPUSD=X","JPY=X","CNHUSD=X",
  // Sectors
  "XLK","XLF","XLY","XLV","XLE","XLI","XLB","XLRE","XLC","XLU","XLP",
  // Portfolio
  "META","UBER","DUOL","VOO","AMZN","PYPL","APLD","AAPL","CMG","ONT","HOOD","NVDA","VUG",
];

type QuoteResult = {
  symbol: string; name: string; price: number; change: number;
  changePct: number; prev: number; high52w: number; low52w: number;
};

// Fetches one symbol via v8/chart meta — no auth needed on query2
async function fetchOne(sym: string): Promise<QuoteResult | null> {
  try {
    const r = await fetch(
      `${YF2}/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d&includePrePost=false`,
      { headers: YF_HDRS, cache: "no-store" }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;
    const price  = meta.regularMarketPrice ?? 0;
    const prev   = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prev;
    const changePct = prev > 0 ? (change / prev) * 100 : 0;
    return {
      symbol: sym,
      name: meta.longName ?? meta.shortName ?? sym,
      price, prev, change, changePct,
      high52w: meta.fiftyTwoWeekHigh ?? 0,
      low52w:  meta.fiftyTwoWeekLow  ?? 0,
    };
  } catch { return null; }
}

// Fetches intraday chart data for ES=F (5d 30m)
async function fetchSpChart(): Promise<{ t: number; v: number }[]> {
  try {
    const r = await fetch(
      `${YF2}/v8/finance/chart/ES%3DF?interval=30m&range=5d&includePrePost=true`,
      { headers: YF_HDRS, cache: "no-store" }
    );
    if (!r.ok) return [];
    const d = await r.json();
    const result = d?.chart?.result?.[0];
    if (!result) return [];
    const ts: number[]     = result.timestamp ?? [];
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
    return ts
      .map((t, i) => ({ t, v: closes[i] }))
      .filter(p => p.v != null && !isNaN(p.v) && p.v > 0);
  } catch { return []; }
}

// ── Finnhub ───────────────────────────────────────────────────────────────────

const FH_KEY  = process.env.FINNHUB_API_KEY;
const FH_BASE = "https://finnhub.io/api/v1";

async function fhGet(path: string): Promise<unknown> {
  if (!FH_KEY) return null;
  try {
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${FH_BASE}${path}${sep}token=${FH_KEY}`, {
      next: { revalidate: 300 },
    });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

type FHNews = {
  id: number; headline: string; source: string;
  summary: string; datetime: number; related: string; url: string;
};

async function fetchNews(): Promise<FHNews[]> {
  if (!FH_KEY) return [];
  const [general, company] = await Promise.all([
    fhGet("/news?category=general") as Promise<FHNews[] | null>,
    fhGet("/news?category=company")  as Promise<FHNews[] | null>,
  ]);
  const cutoff = Date.now() / 1000 - 48 * 3600;
  return [...(general ?? []), ...(company ?? [])]
    .filter(n => n.headline && n.datetime > cutoff)
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 60);
}

async function fetchEarnings(): Promise<{ symbol: string; date: string; epsEstimate: number | null; hour: string }[]> {
  const from = new Date().toISOString().split("T")[0];
  const to   = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const data = await fhGet(`/calendar/earnings?from=${from}&to=${to}`) as {
    earningsCalendar?: { symbol: string; date: string; epsEstimate: number | null; hour: string }[]
  } | null;
  return data?.earningsCalendar?.slice(0, 40) ?? [];
}

// ── Static macro calendar ─────────────────────────────────────────────────────

const CALENDAR = [
  { date: "2026-07-01", label: "ISM Manufacturing PMI", category: "other", impact: "medium" },
  { date: "2026-07-03", label: "ADP Employment Report", category: "jobs", impact: "medium" },
  { date: "2026-07-10", label: "Nonfarm Payrolls (Jun)", category: "jobs", impact: "high", previous: "+139K" },
  { date: "2026-07-15", label: "CPI (Jun)", category: "cpi", impact: "high", previous: "2.4%" },
  { date: "2026-07-16", label: "PPI (Jun)", category: "cpi", impact: "medium" },
  { date: "2026-07-17", label: "Retail Sales (Jun)", category: "other", impact: "medium" },
  { date: "2026-07-24", label: "Initial Jobless Claims", category: "jobs", impact: "medium" },
  { date: "2026-07-29", label: "FOMC Meeting Begins", category: "fomc", impact: "high" },
  { date: "2026-07-30", label: "GDP Q2 Advance", category: "gdp", impact: "high", previous: "1.2%" },
  { date: "2026-07-30", label: "FOMC Rate Decision", category: "fomc", impact: "high" },
  { date: "2026-07-31", label: "PCE Price Index (Jun)", category: "cpi", impact: "high" },
  { date: "2026-08-07", label: "Nonfarm Payrolls (Jul)", category: "jobs", impact: "high" },
  { date: "2026-08-12", label: "CPI (Jul)", category: "cpi", impact: "high" },
  { date: "2026-08-28", label: "PCE Price Index (Jul)", category: "cpi", impact: "high" },
  { date: "2026-09-04", label: "Nonfarm Payrolls (Aug)", category: "jobs", impact: "high" },
  { date: "2026-09-11", label: "CPI (Aug)", category: "cpi", impact: "high" },
  { date: "2026-09-16", label: "FOMC Meeting", category: "fomc", impact: "high" },
  { date: "2026-10-02", label: "Nonfarm Payrolls (Sep)", category: "jobs", impact: "high" },
  { date: "2026-10-14", label: "CPI (Sep)", category: "cpi", impact: "high" },
  { date: "2026-10-28", label: "FOMC Meeting", category: "fomc", impact: "high" },
  { date: "2026-10-29", label: "GDP Q3 Advance", category: "gdp", impact: "high" },
  { date: "2026-10-30", label: "PCE Price Index (Sep)", category: "cpi", impact: "high" },
];

function upcomingEvents() {
  const today = new Date().toISOString().split("T")[0];
  const limit = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  return CALENDAR.filter(e => e.date >= today && e.date <= limit);
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function GET() {
  // All symbol fetches + SP chart + news + earnings in parallel
  const [quotes, spChart, news, earnings] = await Promise.all([
    Promise.all(ALL_SYMBOLS.map(fetchOne)),
    fetchSpChart(),
    fetchNews(),
    fetchEarnings(),
  ]);

  const quoteMap: Record<string, QuoteResult> = {};
  for (const q of quotes) {
    if (q) quoteMap[q.symbol] = q;
  }

  return NextResponse.json({
    ts: new Date().toISOString(),
    quotes: quoteMap,
    spChart,
    news,
    earnings,
    upcomingEvents: upcomingEvents(),
  });
}
