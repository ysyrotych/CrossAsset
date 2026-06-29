import { NextResponse } from "next/server";

const YF = "https://query1.finance.yahoo.com";
const YF2 = "https://query2.finance.yahoo.com";

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
  Origin: "https://finance.yahoo.com",
};

// ── Symbol groups ────────────────────────────────────────────────────────────

const SYMBOLS_CORE = [
  "ES=F","NQ=F","RTY=F","YM=F",        // US futures
  "^VIX",                               // volatility
  "^TNX","^TYX","^FVX","^IRX",         // yields 10Y 30Y 5Y 13W
  "DX-Y.NYB",                           // DXY
  "CL=F","GC=F","SI=F","NG=F","HG=F",  // crude gold silver natgas copper
  "BTC-USD","ETH-USD",                  // crypto
];

const SYMBOLS_INTL = [
  "^FTSE","^GDAXI","^FCHI","^STOXX50E","^IBEX",          // Europe
  "^N225","^HSI","000001.SS","^KS11","^AXJO","^TWII","^BSESN", // Asia
  "EURUSD=X","GBPUSD=X","JPY=X","CNHUSD=X",              // FX
];

const SYMBOLS_SECTORS = [
  "XLK","XLF","XLY","XLV","XLE","XLI","XLB","XLRE","XLC","XLU","XLP",
];

const SYMBOLS_PORTFOLIO = [
  "META","UBER","DUOL","VOO","AMZN","PYPL","APLD","AAPL","CMG","ONT","HOOD","NVDA","VUG",
];

// ── Yahoo Finance fetchers ───────────────────────────────────────────────────

type YFQuote = {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketPreviousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketVolume?: number;
};

async function fetchQuotes(symbols: string[]): Promise<YFQuote[]> {
  const encoded = symbols.map(s => encodeURIComponent(s)).join(",");
  const fields = [
    "regularMarketPrice","regularMarketChange","regularMarketChangePercent",
    "regularMarketPreviousClose","shortName","longName",
    "fiftyTwoWeekHigh","fiftyTwoWeekLow","regularMarketVolume",
  ].join(",");

  try {
    const r = await fetch(
      `${YF}/v7/finance/quote?symbols=${encoded}&fields=${fields}&lang=en-US&region=US&corsDomain=finance.yahoo.com`,
      { headers: YF_HEADERS, next: { revalidate: 0 } }
    );
    if (!r.ok) {
      // try v2 host
      const r2 = await fetch(
        `${YF2}/v7/finance/quote?symbols=${encoded}&fields=${fields}`,
        { headers: YF_HEADERS, next: { revalidate: 0 } }
      );
      if (!r2.ok) return [];
      const d2 = await r2.json();
      return d2?.quoteResponse?.result ?? [];
    }
    const d = await r.json();
    return d?.quoteResponse?.result ?? [];
  } catch {
    return [];
  }
}

async function fetchChart(symbol: string): Promise<{ t: number; v: number }[]> {
  try {
    const r = await fetch(
      `${YF}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=30m&range=5d&includePrePost=true`,
      { headers: YF_HEADERS, next: { revalidate: 0 } }
    );
    if (!r.ok) return [];
    const d = await r.json();
    const result = d?.chart?.result?.[0];
    if (!result) return [];
    const timestamps: number[] = result.timestamp ?? [];
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
    return timestamps
      .map((t, i) => ({ t, v: closes[i] }))
      .filter(p => p.v != null && !isNaN(p.v));
  } catch {
    return [];
  }
}

// ── Finnhub fetchers ─────────────────────────────────────────────────────────

const FH_KEY = process.env.FINNHUB_API_KEY;
const FH_BASE = "https://finnhub.io/api/v1";

async function fhFetch(path: string): Promise<unknown> {
  if (!FH_KEY) return null;
  try {
    const r = await fetch(`${FH_BASE}${path}${path.includes("?") ? "&" : "?"}token=${FH_KEY}`, {
      next: { revalidate: 300 },
    });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

type FHNews = { headline: string; source: string; summary: string; datetime: number; related: string; url: string; id: number };

async function fetchNews(): Promise<FHNews[]> {
  const [general, portfolio] = await Promise.all([
    fhFetch("/news?category=general") as Promise<FHNews[] | null>,
    fhFetch(`/news?category=company&minId=0`) as Promise<FHNews[] | null>,
  ]);
  const all = [...(general ?? []), ...(portfolio ?? [])];
  const cutoff = Date.now() / 1000 - 48 * 3600;
  return all
    .filter(n => n.datetime > cutoff && n.headline)
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 50);
}

async function fetchUpcomingEarnings(): Promise<{ symbol: string; date: string; epsEstimate: number | null; hour: string }[]> {
  const from = new Date().toISOString().split("T")[0];
  const to = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const data = await fhFetch(`/calendar/earnings?from=${from}&to=${to}`) as { earningsCalendar?: { symbol: string; date: string; epsEstimate: number | null; hour: string }[] } | null;
  return data?.earningsCalendar?.slice(0, 30) ?? [];
}

// ── Static calendar ──────────────────────────────────────────────────────────

const STATIC_EVENTS = [
  { date: "2026-07-10", label: "Nonfarm Payrolls (Jun)", category: "jobs", impact: "high", previous: "+139K" },
  { date: "2026-07-15", label: "CPI (Jun)", category: "cpi", impact: "high", previous: "2.4%" },
  { date: "2026-07-17", label: "Retail Sales (Jun)", category: "other", impact: "medium" },
  { date: "2026-07-29", label: "FOMC Meeting", category: "fomc", impact: "high" },
  { date: "2026-07-30", label: "GDP Q2 Advance", category: "gdp", impact: "high", previous: "1.2%" },
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
  { date: "2026-11-06", label: "Nonfarm Payrolls (Oct)", category: "jobs", impact: "high" },
  { date: "2026-11-12", label: "CPI (Oct)", category: "cpi", impact: "high" },
  { date: "2026-11-25", label: "PCE Price Index (Oct)", category: "cpi", impact: "high" },
  { date: "2026-12-04", label: "Nonfarm Payrolls (Nov)", category: "jobs", impact: "high" },
  { date: "2026-12-09", label: "FOMC Meeting", category: "fomc", impact: "high" },
  { date: "2026-12-11", label: "CPI (Nov)", category: "cpi", impact: "high" },
  { date: "2026-12-12", label: "PPI (Nov)", category: "cpi", impact: "medium" },
  { date: "2026-12-23", label: "PCE Price Index (Nov)", category: "cpi", impact: "high" },
];

function getTodayAndUpcoming() {
  const today = new Date().toISOString().split("T")[0];
  const week = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  return STATIC_EVENTS.filter(e => e.date >= today && e.date <= week);
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const [coreQuotes, intlQuotes, sectorQuotes, portfolioQuotes, chart, news, earnings] = await Promise.all([
    fetchQuotes(SYMBOLS_CORE),
    fetchQuotes(SYMBOLS_INTL),
    fetchQuotes(SYMBOLS_SECTORS),
    fetchQuotes(SYMBOLS_PORTFOLIO),
    fetchChart("ES=F"),
    fetchNews(),
    fetchUpcomingEarnings(),
  ]);

  // Merge all quotes into flat map
  const allQuotes = [...coreQuotes, ...intlQuotes, ...sectorQuotes, ...portfolioQuotes];
  const quotes: Record<string, {
    symbol: string; name: string; price: number; change: number;
    changePct: number; prev: number; high52w: number; low52w: number;
  }> = {};

  for (const q of allQuotes) {
    if (!q.symbol) continue;
    quotes[q.symbol] = {
      symbol: q.symbol,
      name: q.shortName ?? q.longName ?? q.symbol,
      price: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      changePct: q.regularMarketChangePercent ?? 0,
      prev: q.regularMarketPreviousClose ?? 0,
      high52w: q.fiftyTwoWeekHigh ?? 0,
      low52w: q.fiftyTwoWeekLow ?? 0,
    };
  }

  return NextResponse.json({
    ts: new Date().toISOString(),
    quotes,
    spChart: chart,
    news,
    earnings,
    upcomingEvents: getTodayAndUpcoming(),
  });
}
