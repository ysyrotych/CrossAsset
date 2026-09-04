import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FRED = "https://api.stlouisfed.org/fred/series/observations";
const KEY = process.env.FRED_API_KEY;

// Treasury tenors in maturity order (years for the x-axis)
const TENORS: { id: string; label: string; yrs: number }[] = [
  { id: "DGS1MO", label: "1M", yrs: 1 / 12 }, { id: "DGS3MO", label: "3M", yrs: 0.25 },
  { id: "DGS6MO", label: "6M", yrs: 0.5 }, { id: "DGS1", label: "1Y", yrs: 1 },
  { id: "DGS2", label: "2Y", yrs: 2 }, { id: "DGS3", label: "3Y", yrs: 3 },
  { id: "DGS5", label: "5Y", yrs: 5 }, { id: "DGS7", label: "7Y", yrs: 7 },
  { id: "DGS10", label: "10Y", yrs: 10 }, { id: "DGS20", label: "20Y", yrs: 20 },
  { id: "DGS30", label: "30Y", yrs: 30 },
];

async function fetchTenor(id: string): Promise<{ date: string; value: number }[]> {
  if (!KEY) return [];
  try {
    const start = new Date(Date.now() - 500 * 864e5).toISOString().slice(0, 10);
    const r = await fetch(`${FRED}?series_id=${id}&api_key=${KEY}&file_type=json&observation_start=${start}&sort_order=asc`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const obs: { date: string; value: string }[] = (await r.json()).observations ?? [];
    return obs.filter((o) => o.value !== ".").map((o) => ({ date: o.date, value: parseFloat(o.value) }));
  } catch { return []; }
}

export async function GET() {
  const series = await Promise.all(TENORS.map((t) => fetchTenor(t.id)));
  const rows = TENORS.map((t, i) => {
    const s = series[i];
    const current = s.length ? s[s.length - 1].value : null;
    // value ~1 year (252 trading days) ago
    const priorIdx = Math.max(0, s.length - 1 - 252);
    const prior = s.length ? s[priorIdx].value : null;
    return { label: t.label, yrs: t.yrs, current, prior };
  }).filter((r) => r.current != null);
  const asOf = series.flat().length ? series.flat().sort((a, b) => b.date.localeCompare(a.date))[0].date : null;
  return NextResponse.json({ rows, asOf, connected: !!KEY });
}
