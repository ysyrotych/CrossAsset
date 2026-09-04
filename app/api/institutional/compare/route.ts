import { NextRequest, NextResponse } from "next/server";
import { getCompare } from "@/lib/institutional/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const a = req.nextUrl.searchParams.get("a");
  const b = req.nextUrl.searchParams.get("b");
  if (!a || !b) return NextResponse.json({ error: "a and b slugs required" }, { status: 400 });
  const cmp = await getCompare(a, b);
  if (!cmp) return NextResponse.json({ error: "fund not found" }, { status: 404 });
  return NextResponse.json(cmp);
}
