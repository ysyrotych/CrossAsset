import { NextResponse } from "next/server";
import { getSecurityView } from "@/lib/institutional/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const view = await getSecurityView(ticker);
  if (!view) return NextResponse.json({ error: "no institutional holders found" }, { status: 404 });
  return NextResponse.json(view);
}
