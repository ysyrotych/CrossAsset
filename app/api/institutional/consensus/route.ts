import { NextRequest, NextResponse } from "next/server";
import { getConsensus } from "@/lib/institutional/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get("dir"); // buy | sell | null
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "40");
  let rows = await getConsensus();
  if (dir === "buy") rows = rows.filter((r) => r.consensusScore > 0);
  if (dir === "sell") rows = rows.filter((r) => r.consensusScore < 0).sort((a, b) => a.consensusScore - b.consensusScore);
  return NextResponse.json({ rows: rows.slice(0, limit) });
}
