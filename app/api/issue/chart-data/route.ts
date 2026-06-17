import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FRED = "https://api.stlouisfed.org/fred/series/observations";
const KEY = () => process.env.FRED_API_KEY ?? "";

type Pt = { date: string; value: number };

async function fredSeries(id: string, limit = 90): Promise<Pt[]> {
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

export async function GET(req: NextRequest) {
  const series = req.nextUrl.searchParams.get("series")?.split(",").filter(Boolean) ?? [];
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "90", 10);

  if (series.length === 0) {
    return NextResponse.json({ error: "No series specified" }, { status: 400 });
  }

  // Fetch all series in parallel (max 6 to stay under rate limits)
  const results: Record<string, Pt[]> = {};
  for (const id of series.slice(0, 6)) {
    results[id] = await fredSeries(id, limit);
  }

  return NextResponse.json(results);
}
