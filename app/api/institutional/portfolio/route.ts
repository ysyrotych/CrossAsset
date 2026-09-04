import { NextRequest, NextResponse } from "next/server";
import { getPortfolioView } from "@/lib/institutional/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = raw.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean).slice(0, 40);
  if (!tickers.length) return NextResponse.json({ period: "", rows: [] });
  const view = await getPortfolioView(tickers);
  return NextResponse.json(view);
}
