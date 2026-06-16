const BASE = "https://finnhub.io/api/v1";
const KEY  = process.env.FINNHUB_API_KEY;

export type EconEvent = {
  event: string;
  date: string;
  impact: string;
  estimate?: string;
  previous?: string;
  actual?: string;
};

export type EarningsEvent = {
  symbol: string;
  date: string;
  epsEstimate?: number;
  revenueEstimate?: number;
};

export type MarketNewsItem = {
  headline: string;
  source: string;
  summary: string;
  datetime: number;
  url: string;
};

export type FinnhubQuote = {
  price: number; change: number; pct: number;
  high: number; low: number; open: number; prevClose: number;
};

async function fhGet(path: string): Promise<unknown> {
  if (!KEY) return null;
  try {
    const r = await fetch(`${BASE}${path}${path.includes("?") ? "&" : "?"}token=${KEY}`, {
      next: { revalidate: 3600 },
    });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

function isoDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().split("T")[0];
}

export async function fetchEconomicCalendar(): Promise<EconEvent[]> {
  const data = (await fhGet(
    `/calendar/economic?from=${isoDate(0)}&to=${isoDate(8)}`
  )) as { economicCalendar?: Record<string, string>[] } | null;

  if (!data?.economicCalendar) return [];

  return data.economicCalendar
    .filter((e) => e.country === "US" && e.event)
    .map((e) => ({
      event:    e.event,
      date:     e.time ?? e.date ?? "",
      impact:   e.impact ?? "Low",
      estimate: e.estimate ?? undefined,
      previous: e.prev ?? undefined,
      actual:   e.actual ?? undefined,
    }))
    .slice(0, 20);
}

export async function fetchEarningsCalendar(): Promise<EarningsEvent[]> {
  const data = (await fhGet(
    `/calendar/earnings?from=${isoDate(0)}&to=${isoDate(8)}`
  )) as { earningsCalendar?: Record<string, string | number>[] } | null;

  if (!data?.earningsCalendar) return [];

  return data.earningsCalendar
    .filter((e) => e.symbol)
    .map((e) => ({
      symbol:          String(e.symbol),
      date:            String(e.date ?? ""),
      epsEstimate:     e.epsEstimate != null ? Number(e.epsEstimate) : undefined,
      revenueEstimate: e.revenueEstimate != null ? Number(e.revenueEstimate) : undefined,
    }))
    .slice(0, 25);
}

export async function fetchMarketNews(): Promise<MarketNewsItem[]> {
  // Fetch multiple Finnhub categories for source diversity
  const [general, forex, merger] = await Promise.all([
    fhGet("/news?category=general") as Promise<Record<string, unknown>[] | null>,
    fhGet("/news?category=forex")   as Promise<Record<string, unknown>[] | null>,
    fhGet("/news?category=merger")  as Promise<Record<string, unknown>[] | null>,
  ]);

  const all = [
    ...(Array.isArray(general) ? general : []),
    ...(Array.isArray(forex)   ? forex   : []),
    ...(Array.isArray(merger)  ? merger  : []),
  ];

  const seen = new Set<string>();
  const out: MarketNewsItem[] = [];
  for (const n of all) {
    const h = String(n.headline ?? "");
    if (h && !seen.has(h)) {
      seen.add(h);
      out.push({
        headline: h,
        source:   String(n.source ?? ""),
        summary:  String(n.summary ?? "").slice(0, 200),
        datetime: Number(n.datetime ?? 0),
        url:      String(n.url ?? ""),
      });
    }
  }
  // Sort by newest first
  return out.sort((a, b) => b.datetime - a.datetime).slice(0, 20);
}

export async function fetchQuote(symbol: string): Promise<FinnhubQuote | null> {
  const data = (await fhGet(`/quote?symbol=${encodeURIComponent(symbol)}`)) as Record<string, number> | null;
  if (!data || !data.c) return null;
  return {
    price:     data.c,
    change:    data.d ?? 0,
    pct:       data.dp ?? 0,
    high:      data.h ?? data.c,
    low:       data.l ?? data.c,
    open:      data.o ?? data.c,
    prevClose: data.pc ?? data.c,
  };
}

// Spot prices for commodities and FX — more current than FRED
export async function fetchLiveSpotQuotes(): Promise<{
  gold:  { price: number; change: number; pct: number } | null;
  oil:   { price: number; change: number; pct: number } | null;
  dxy:   { price: number; change: number; pct: number } | null;
  silver:{ price: number; change: number; pct: number } | null;
}> {
  const [goldQ, oilQ, uupQ, silverQ] = await Promise.all([
    fetchQuote("OANDA:XAU_USD"),   // gold spot USD/troy oz
    fetchQuote("USO"),              // WTI oil ETF proxy (daily)
    fetchQuote("UUP"),              // PowerShares USD Index Bullish ETF
    fetchQuote("OANDA:XAG_USD"),   // silver spot USD/troy oz
  ]);
  const toQ = (q: FinnhubQuote | null) =>
    q ? { price: q.price, change: q.change, pct: q.pct } : null;
  return { gold: toQ(goldQ), oil: toQ(oilQ), dxy: toQ(uupQ), silver: toQ(silverQ) };
}

// Forex pairs for Currency Matrix
export async function fetchForexQuotes(): Promise<{ pair: string; label: string; price: number; change: number; pct: number }[]> {
  const pairs = [
    { sym: "OANDA:EUR_USD", pair: "EURUSD", label: "EUR / USD" },
    { sym: "OANDA:GBP_USD", pair: "GBPUSD", label: "GBP / USD" },
    { sym: "OANDA:USD_JPY", pair: "USDJPY", label: "USD / JPY" },
    { sym: "OANDA:AUD_USD", pair: "AUDUSD", label: "AUD / USD" },
    { sym: "OANDA:USD_CHF", pair: "USDCHF", label: "USD / CHF" },
    { sym: "OANDA:USD_CNH", pair: "USDCNH", label: "USD / CNH" },
  ];
  const quotes = await Promise.all(pairs.map((p) => fetchQuote(p.sym).catch(() => null)));
  return pairs
    .map((p, i) => {
      const q = quotes[i];
      return q ? { pair: p.pair, label: p.label, price: q.price, change: q.change, pct: q.pct } : null;
    })
    .filter(Boolean) as { pair: string; label: string; price: number; change: number; pct: number }[];
}

// Crypto prices via Binance quotes (Finnhub free)
export async function fetchCryptoQuotes(): Promise<{ symbol: string; name: string; price: number; change: number; pct: number }[]> {
  const coins = [
    { sym: "BINANCE:BTCUSDT", symbol: "BTC", name: "Bitcoin" },
    { sym: "BINANCE:ETHUSDT", symbol: "ETH", name: "Ethereum" },
    { sym: "BINANCE:SOLUSDT", symbol: "SOL", name: "Solana" },
    { sym: "BINANCE:BNBUSDT", symbol: "BNB", name: "BNB" },
  ];
  const quotes = await Promise.all(coins.map((c) => fetchQuote(c.sym).catch(() => null)));
  return coins
    .map((c, i) => {
      const q = quotes[i];
      return q ? { symbol: c.symbol, name: c.name, price: q.price, change: q.change, pct: q.pct } : null;
    })
    .filter(Boolean) as { symbol: string; name: string; price: number; change: number; pct: number }[];
}

// Global index ETF proxies
export async function fetchGlobalIndices(): Promise<{ symbol: string; name: string; region: string; price: number; change: number; pct: number }[]> {
  const indices = [
    { sym: "EWG",  symbol: "DAX",    name: "Germany (EWG)",   region: "Europe" },
    { sym: "EWU",  symbol: "FTSE",   name: "UK (EWU)",        region: "Europe" },
    { sym: "EWJ",  symbol: "NIKKEI", name: "Japan (EWJ)",     region: "Asia" },
    { sym: "EWH",  symbol: "HSI",    name: "Hong Kong (EWH)", region: "Asia" },
    { sym: "EWZ",  symbol: "BOVESPA",name: "Brazil (EWZ)",    region: "EM" },
    { sym: "EEM",  symbol: "EM",     name: "Emerg. Markets",  region: "EM" },
  ];
  const quotes = await Promise.all(indices.map((idx) => fetchQuote(idx.sym).catch(() => null)));
  return indices
    .map((idx, i) => {
      const q = quotes[i];
      return q ? { symbol: idx.symbol, name: idx.name, region: idx.region, price: q.price, change: q.change, pct: q.pct } : null;
    })
    .filter(Boolean) as { symbol: string; name: string; region: string; price: number; change: number; pct: number }[];
}
