// ── Institutional data readers ───────────────────────────────────────────────
// Source of truth is Supabase (populated by the sec-service ingest pipeline).
// Until a manager/period is ingested, we serve the rich demo dataset so the
// interface is fully explorable. Same shapes either way.

import type {
  ManagerListItem, ManagerView, SecurityView, ConsensusRow, SuperinvestorDigest,
} from "./types";
import {
  demoManagers, demoManagerView, demoSecurityView, demoConsensus, demoSuperinvestors,
} from "./demoData";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function configured() { return !!(URL && KEY); }

async function sb<T>(path: string): Promise<T[] | null> {
  if (!configured()) return null;
  try {
    const r = await fetch(`${URL}/rest/v1/${path}`, {
      headers: { apikey: KEY!, Authorization: `Bearer ${KEY!}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const rows = (await r.json()) as T[];
    return Array.isArray(rows) && rows.length ? rows : null;
  } catch {
    return null;
  }
}

// Whether real institutional data has been ingested yet.
export async function hasRealData(): Promise<boolean> {
  const rows = await sb<{ cik: string }>("managers?select=cik&limit=1");
  return !!rows;
}

// ── Managers ─────────────────────────────────────────────────────────────────
export async function getManagers(): Promise<ManagerListItem[]> {
  // Real query would map DB columns → ManagerListItem. Falls back to demo.
  const rows = await sb<Record<string, unknown>>("managers?select=*&order=aum_13f.desc");
  if (!rows) return demoManagers();
  return rows.map((r) => ({
    cik: String(r.cik), name: String(r.name), slug: String(r.slug),
    type: (r.type as ManagerListItem["type"]) ?? "hedge_fund",
    isSuperinvestor: !!r.is_superinvestor, aum13f: Number(r.aum_13f ?? 0),
    lastFiledPeriod: String(r.last_filed_period ?? ""),
    manager: r.manager as string | undefined,
    signatureHolding: r.signature_holding as string | undefined,
  }));
}

// ── Manager view (falls back to demo builder) ────────────────────────────────
export async function getManagerView(slug: string): Promise<ManagerView | null> {
  // The full delta join lives in the ingest pipeline; when present we would read
  // holdings_delta here. For now, demo builder produces the same shape.
  return demoManagerView(slug);
}

// ── Security view ─────────────────────────────────────────────────────────────
export async function getSecurityView(ticker: string): Promise<SecurityView | null> {
  return demoSecurityView(ticker);
}

// ── Consensus ─────────────────────────────────────────────────────────────────
export async function getConsensus(): Promise<ConsensusRow[]> {
  return demoConsensus();
}

// ── Superinvestor digest ─────────────────────────────────────────────────────
export async function getSuperinvestors(): Promise<SuperinvestorDigest> {
  return demoSuperinvestors();
}
