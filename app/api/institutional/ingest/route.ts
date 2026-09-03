import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SEC_SERVICE = (process.env.SEC_SERVICE_URL ?? "http://localhost:8000").trim().replace(/\/+$/, "");
const INGEST_SECRET = process.env.INGEST_SECRET;

// ADMIN: trigger an ingest of a manager (by CIK) or the curated sweep.
// Proxies to the Python sec-service which does the EDGAR parsing + delta compute.
export async function POST(req: NextRequest) {
  if (INGEST_SECRET && req.headers.get("x-ingest-secret") !== INGEST_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { cik, period, sweep } = body as { cik?: string; period?: string; sweep?: boolean };

  const endpoint = sweep ? "/institutional/sweep" : "/institutional/ingest";
  try {
    const r = await fetch(`${SEC_SERVICE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cik, period }),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
