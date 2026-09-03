import { NextRequest, NextResponse } from "next/server";
import { getManagers } from "@/lib/institutional/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase() ?? "";
  let managers = await getManagers();
  if (q) {
    managers = managers.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.manager ?? "").toLowerCase().includes(q),
    );
  }
  return NextResponse.json({ managers });
}
