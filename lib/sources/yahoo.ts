const YF = "https://query1.finance.yahoo.com/v8/finance/chart";
const H = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

export type Quote = { price: number; prev: number; change: number; pct: number };

async function yfGet(sym: string, range: string) {
  try {
    const r = await fetch(
      `${YF}/${encodeURIComponent(sym)}?interval=1d&range=${range}`,
      { headers: H, next: { revalidate: 600 } }
    );
    if (!r.ok) return null;
    return (await r.json()).chart?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function fetchQuote(sym: string): Promise<Quote | null> {
  const d = await yfGet(sym, "5d");
  if (!d) return null;
  const closes: (number | null)[] = d.indicators?.quote?.[0]?.close ?? [];
  const valid = closes.filter((v): v is number => v != null);
  if (!valid.length) return null;
  const price = valid[valid.length - 1];
  const prev = valid.length > 1 ? valid[valid.length - 2] : price;
  return { price, prev, change: price - prev, pct: ((price - prev) / prev) * 100 };
}

export async function fetchHistory(
  sym: string,
  range: string
): Promise<{ date: string; value: number }[]> {
  const d = await yfGet(sym, range);
  if (!d) return [];
  const ts: number[] = d.timestamp ?? [];
  const closes: (number | null)[] = d.indicators?.quote?.[0]?.close ?? [];
  return ts
    .map((t, i) => ({
      date: new Date(t * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: closes[i] ?? 0,
    }))
    .filter((p) => p.value > 0);
}

// Real-time commodity spots via Yahoo Finance futures
export async function fetchCommoditySpots(): Promise<{
  gold:   Quote | null;
  silver: Quote | null;
  oil:    Quote | null;
  dxy:    Quote | null;
}> {
  const [gold, silver, oil, dxy] = await Promise.all([
    fetchQuote("GC=F"),       // COMEX Gold Futures $/troy oz
    fetchQuote("SI=F"),       // COMEX Silver Futures $/troy oz
    fetchQuote("CL=F"),       // NYMEX WTI Crude Oil Futures $/bbl
    fetchQuote("DX-Y.NYB"),  // ICE US Dollar Index
  ]);
  return { gold, silver, oil, dxy };
}

// Real-time forex pairs via Yahoo Finance
export async function fetchForexYahoo(): Promise<
  { pair: string; label: string; price: number; change: number; pct: number }[]
> {
  const pairs = [
    { sym: "EURUSD=X", pair: "EURUSD", label: "EUR / USD" },
    { sym: "GBPUSD=X", pair: "GBPUSD", label: "GBP / USD" },
    { sym: "USDJPY=X", pair: "USDJPY", label: "USD / JPY" },
    { sym: "AUDUSD=X", pair: "AUDUSD", label: "AUD / USD" },
    { sym: "USDCHF=X", pair: "USDCHF", label: "USD / CHF" },
    { sym: "USDCNH=X", pair: "USDCNH", label: "USD / CNH" },
  ];
  const quotes = await Promise.all(pairs.map((p) => fetchQuote(p.sym).catch(() => null)));
  return pairs
    .map((p, i) => {
      const q = quotes[i];
      return q ? { pair: p.pair, label: p.label, price: q.price, change: q.change, pct: q.pct } : null;
    })
    .filter(Boolean) as { pair: string; label: string; price: number; change: number; pct: number }[];
}
