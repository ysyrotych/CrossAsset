/**
 * Live quotes for the Tournament page — position tracker & portfolio simulator.
 * GET /api/tournament/quotes?tickers=AAPL,MSFT,BTC-USD
 * Returns { quotes: { [ticker]: { price, prev, change, pct } }, asOf }.
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchYFQuotes } from "@/lib/sources/yahoo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = raw.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean).slice(0, 60);
  if (tickers.length === 0) return NextResponse.json({ quotes: {}, asOf: new Date().toISOString() });
  try {
    const map = await fetchYFQuotes(tickers);
    const quotes: Record<string, { price: number; prev: number; change: number; pct: number }> = {};
    for (const t of tickers) {
      const q = map.get(t);
      if (q) quotes[t] = q;
    }
    return NextResponse.json({ quotes, asOf: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ quotes: {}, error: String(e), asOf: new Date().toISOString() }, { status: 200 });
  }
}
