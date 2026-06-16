import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FRED = "https://api.stlouisfed.org/fred/series/observations";
const KEY  = process.env.FRED_API_KEY;

async function fredHistory(id: string, start: string): Promise<{ date: string; value: number }[]> {
  if (!KEY) return [];
  try {
    const r = await fetch(
      `${FRED}?series_id=${id}&api_key=${KEY}&file_type=json&sort_order=asc&observation_start=${start}`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    return ((await r.json()).observations ?? [])
      .filter((o: { value: string }) => o.value !== ".")
      .map((o: { date: string; value: string }) => ({ date: o.date, value: parseFloat(o.value) }));
  } catch {
    return [];
  }
}

function startDate(tf: string): string {
  const d = new Date();
  if (tf === "1M")   d.setDate(d.getDate() - 35);
  else if (tf === "3M")  d.setMonth(d.getMonth() - 3);
  else if (tf === "6M")  d.setMonth(d.getMonth() - 6);
  else if (tf === "1Y")  d.setFullYear(d.getFullYear() - 1);
  else if (tf === "FOMC") return "2026-04-30";
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const tf    = req.nextUrl.searchParams.get("tf") ?? "6M";
  const start = startDate(tf);

  const [hist5, hist10, histSP500, histVIX, histGold, histOil, histNasdaq] = await Promise.all([
    fredHistory("DGS5",             start),
    fredHistory("DGS10",            start),
    fredHistory("SP500",            start),
    fredHistory("VIXCLS",           start),
    fredHistory("GOLDAMGBD228NLBM", start),
    fredHistory("DCOILWTICO",       start),
    fredHistory("NASDAQCOM",        start),
  ]);

  const sortH = (arr: { date: string; value: number }[]) =>
    [...arr].sort((a, b) => a.date.localeCompare(b.date));

  // Build merged yield history
  const dateMap = new Map<string, { date: string; tenYear?: number; fiveYear?: number }>();
  sortH(hist10).forEach((p) => dateMap.set(p.date, { date: p.date, tenYear: p.value }));
  sortH(hist5).forEach((p) => {
    const e = dateMap.get(p.date) ?? { date: p.date };
    dateMap.set(p.date, { ...e, fiveYear: p.value });
  });
  const history = [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    tf,
    history,
    historySP500:  sortH(histSP500),
    historyVIX:    sortH(histVIX),
    historyGold:   sortH(histGold),
    historyOil:    sortH(histOil),
    historyNasdaq: sortH(histNasdaq),
  });
}
