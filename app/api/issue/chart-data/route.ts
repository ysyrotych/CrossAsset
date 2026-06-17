import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FRED = "https://api.stlouisfed.org/fred/series/observations";
const KEY = () => process.env.FRED_API_KEY ?? "";

type Pt = { date: string; value: number };

async function fredSeries(id: string, limit = 252): Promise<Pt[]> {
  const key = KEY();
  if (!key) return [];
  try {
    const r = await fetch(
      `${FRED}?series_id=${id}&api_key=${key}&file_type=json&sort_order=asc&limit=${limit}`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    const json = await r.json();
    return (json.observations ?? [])
      .filter((o: { value: string }) => o.value !== ".")
      .map((o: { date: string; value: string }) => ({ date: o.date, value: parseFloat(o.value) }));
  } catch {
    return [];
  }
}

// Yahoo Finance fallback for series FRED doesn't cover well
const YF_MAP: Record<string, string> = {
  SP500: "^GSPC",
  NASDAQCOM: "^IXIC",
  VIXCLS: "^VIX",
  DCOILBRENTEU: "BZ=F",
  DCOILWTICO: "CL=F",
  DTWEXBGS: "DX-Y.NYB",
};

async function yfSeries(ticker: string, limit = 252): Promise<Pt[]> {
  try {
    const end = Math.floor(Date.now() / 1000);
    const start = end - limit * 24 * 3600;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${start}&period2=${end}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" });
    if (!r.ok) return [];
    const json = await r.json();
    const ts: number[] = json.chart?.result?.[0]?.timestamp ?? [];
    const closes: number[] = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return ts.map((t, i) => ({
      date: new Date(t * 1000).toISOString().split("T")[0],
      value: parseFloat((closes[i] ?? 0).toFixed(4)),
    })).filter((p) => p.value > 0);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const series = req.nextUrl.searchParams.get("series")?.split(",").filter(Boolean) ?? [];
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "252", 10);

  if (series.length === 0) {
    return NextResponse.json({ error: "No series specified" }, { status: 400 });
  }

  const results: Record<string, Pt[]> = {};
  for (const id of series.slice(0, 6)) {
    let data = await fredSeries(id, limit);
    // Fallback to Yahoo Finance if FRED returns nothing
    if (data.length === 0 && YF_MAP[id]) {
      data = await yfSeries(YF_MAP[id], limit);
    }
    results[id] = data;
  }

  return NextResponse.json(results);
}
