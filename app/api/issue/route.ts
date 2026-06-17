import { NextRequest, NextResponse } from "next/server";
import { createIssue, listIssues } from "@/lib/pipeline/supabase";

export const dynamic = "force-dynamic";

// POST /api/issue — create a new issue
export async function POST() {
  const id = `CA-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
  const cutoffDate = new Date().toISOString().split("T")[0];
  const project = await createIssue(id, cutoffDate);
  return NextResponse.json(project);
}

// GET /api/issue — list all issues
export async function GET(_req: NextRequest) {
  const issues = await listIssues();
  return NextResponse.json(issues);
}
