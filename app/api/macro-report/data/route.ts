import { NextRequest, NextResponse } from "next/server";
import { buildReport } from "@/lib/macro/build";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const report = await buildReport(force);
  return NextResponse.json(report);
}
