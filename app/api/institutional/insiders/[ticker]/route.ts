import { NextResponse } from "next/server";
import { getSecurityView } from "@/lib/institutional/db";

export const dynamic = "force-dynamic";

// Insider (Form 4) overlay for a ticker — currently sourced through the
// security view; will read insider_txns directly once Form 4 ingest lands.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const view = await getSecurityView(ticker);
  return NextResponse.json({ ticker: ticker.toUpperCase(), insiders: view?.insiderOverlay ?? [] });
}
