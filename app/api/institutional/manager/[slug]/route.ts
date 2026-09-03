import { NextResponse } from "next/server";
import { getManagerView } from "@/lib/institutional/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const view = await getManagerView(slug);
  if (!view) return NextResponse.json({ error: "manager not found" }, { status: 404 });
  return NextResponse.json(view);
}
