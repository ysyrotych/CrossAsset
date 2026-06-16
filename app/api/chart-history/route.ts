import { NextRequest, NextResponse } from "next/server";
import { fetchHistory, fetchYFQuotes } from "@/lib/sources/yahoo";

export const dynamic = "force-dynamic";

const FRED = "https://api.stlouisfed.org/fred/series/observations";
const KEY  = process.env.FRED_API_KEY;

type Pt = { date: string; value: number };

async function fredHistory(id: string, start: string): Promise<Pt[]> {
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

// Append a today point if the series doesn't already have one
function patchToday(arr: Pt[], value: number | undefined): Pt[] {
  if (value == null) return arr;
  const today = new Date().toISOString().split("T")[0];
  if (arr.length > 0 && arr[arr.length - 1].date === today) return arr;
  return [...arr, { date: today, value }];
}

function yfRange(tf: string): string {
  if (tf === "1M")   return "1mo";
  if (tf === "3M")   return "3mo";
  if (tf === "1Y")   return "1y";
  if (tf === "FOMC") return "3mo";
  return "6mo";
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
  const range = yfRange(tf);

  // All chart history from Yahoo Finance where possible — FRED only for yields (no YF equivalent)
  // Live quotes patch today's point onto FRED series that lag 1 business day
  const [hist5, hist10, histSP500, histVIX, histNasdaq, histGoldYF, histOilYF, histDowYF, live] = await Promise.all([
    fredHistory("DGS5",      start),
    fredHistory("DGS10",     start),
    fredHistory("SP500",     start),
    fredHistory("VIXCLS",    start),
    fredHistory("NASDAQCOM", start),
    fetchHistory("GC=F",  range),   // Gold futures — live from YF
    fetchHistory("CL=F",  range),   // WTI crude futures — live from YF
    fetchHistory("^DJI",  range),   // Dow Jones — live from YF
    // Live quotes to patch today's point onto FRED series
    // ^GSPC = S&P index, ^TNX = 10Y yield %, ^FVX = 5Y yield %, ^VIX = VIX
    fetchYFQuotes(["^GSPC", "^TNX", "^FVX", "^VIX"]).catch(() => new Map()),
  ]);

  const gspc = live.get("^GSPC");
  const tnx  = live.get("^TNX");
  const fvx  = live.get("^FVX");
  const vix  = live.get("^VIX");

  const patched10  = patchToday(hist10,    tnx?.price);
  const patched5   = patchToday(hist5,     fvx?.price);
  const patchedSP  = patchToday(histSP500, gspc?.price);
  const patchedVIX = patchToday(histVIX,   vix?.price);

  const sortH = (arr: Pt[]) => [...arr].sort((a, b) => a.date.localeCompare(b.date));

  // Build merged yield history
  const dateMap = new Map<string, { date: string; tenYear?: number; fiveYear?: number }>();
  sortH(patched10).forEach((p) => dateMap.set(p.date, { date: p.date, tenYear: p.value }));
  sortH(patched5).forEach((p) => {
    const e = dateMap.get(p.date) ?? { date: p.date };
    dateMap.set(p.date, { ...e, fiveYear: p.value });
  });
  const history = [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    tf,
    history,
    historySP500:  sortH(patchedSP),
    historyVIX:    sortH(patchedVIX),
    historyGold:   sortH(histGoldYF),
    historyOil:    sortH(histOilYF),
    historyNasdaq: sortH(histNasdaq),
    historyDow:    sortH(histDowYF),  // ^DJI directly — no scaling needed
  });
}
