import { NextResponse } from "next/server";
import { getSuperinvestors } from "@/lib/institutional/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const digest = await getSuperinvestors();
  return NextResponse.json(digest);
}
