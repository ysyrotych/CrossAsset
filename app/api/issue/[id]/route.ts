import { NextRequest, NextResponse } from "next/server";
import { loadIssue } from "@/lib/pipeline/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const issue = await loadIssue(id);
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(issue);
}
