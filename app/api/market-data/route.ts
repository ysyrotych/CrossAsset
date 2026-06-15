import { NextRequest, NextResponse } from "next/server";
import { fetchQuote, fetchHistory } from "@/lib/sources/yahoo";

export const dynamic = "force-dynamic";

const TF_MAP: Record<string, string> = {
  "1M": "1mo",
  "3M": "3mo",
  "6M": "6mo",
  "1Y": "1y",
  "FOMC": "2mo",
};

export async function GET(req: NextRequest) {
  const tf = req.nextUrl.searchParams.get("tf") ?? "6M";
  const range = TF_MAP[tf] ?? "6mo";

  const [tnx, fvx, tyx, sp500, gold, oil, vix, dxy, tnxHist, fvxHist] =
    await Promise.all([
      fetchQuote("^TNX"),
      fetchQuote("^FVX"),
      fetchQuote("^TYX"),
      fetchQuote("^GSPC"),
      fetchQuote("GC=F"),
      fetchQuote("CL=F"),
      fetchQuote("^VIX"),
      fetchQuote("DX-Y.NYB"),
      fetchHistory("^TNX", range),
      fetchHistory("^FVX", range),
    ]);

  const map = new Map<string, { date: string; tenYear?: number; fiveYear?: number }>();
  tnxHist.forEach((p) => map.set(p.date, { date: p.date, tenYear: p.value }));
  fvxHist.forEach((p) => {
    const e = map.get(p.date) ?? { date: p.date };
    map.set(p.date, { ...e, fiveYear: p.value });
  });

  const history = [...map.values()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return NextResponse.json({
    yields: { tnx, fvx, tyx },
    equities: { sp500, gold, oil, vix, dxy },
    history,
    live: !!tnx,
  });
}
