import { NextResponse } from "next/server";
import { buildReport } from "@/lib/macro/build";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const report = await buildReport();
  return NextResponse.json(report);
}
