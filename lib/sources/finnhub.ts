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
  const data = (await fhGet("/news?category=general")) as Record<string, unknown>[] | null;
  if (!Array.isArray(data)) return [];

  return data.slice(0, 20).map((n) => ({
    headline: String(n.headline ?? ""),
    source:   String(n.source ?? ""),
    summary:  String(n.summary ?? "").slice(0, 200),
    datetime: Number(n.datetime ?? 0),
  }));
}
