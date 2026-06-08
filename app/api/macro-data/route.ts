import { NextResponse } from "next/server";
import { fetchMacroData } from "@/lib/sources/fred";

export async function GET() {
  try {
    const data = await fetchMacroData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch macro data" }, { status: 500 });
  }
}
