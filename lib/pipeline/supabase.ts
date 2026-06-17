// Supabase persistence for the pipeline.
// Falls back gracefully if Supabase is not configured.

import type { CrossAssetProject, WorkflowStage, StageStatus, ApprovalRecord } from "./types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function supaHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: KEY ?? "",
    Authorization: `Bearer ${KEY ?? ""}`,
    Prefer: "return=representation",
  };
}

function isConfigured(): boolean {
  return !!(URL && KEY);
}

// ─── Create a new issue row ───────────────────────────────────────────────────

export async function createIssue(id: string, cutoffDate: string): Promise<CrossAssetProject> {
  const project: CrossAssetProject = {
    id,
    created_at: new Date().toISOString(),
    stage: "DATA_AUDIT",
    status: "in_progress",
    cutoff_date: cutoffDate,
    approval_log: [],
  };

  if (!isConfigured()) return project;

  try {
    await fetch(`${URL}/rest/v1/issues`, {
      method: "POST",
      headers: supaHeaders(),
      body: JSON.stringify({
        id,
        created_at: project.created_at,
        stage: project.stage,
        status: project.status,
        cutoff_date: cutoffDate,
        approval_log: [],
      }),
    });
  } catch {
    // non-fatal — continue without persistence
  }

  return project;
}

// ─── Load an issue ────────────────────────────────────────────────────────────

export async function loadIssue(id: string): Promise<CrossAssetProject | null> {
  if (!isConfigured()) return null;

  try {
    const r = await fetch(`${URL}/rest/v1/issues?id=eq.${id}&limit=1`, {
      headers: supaHeaders(),
    });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!rows.length) return null;
    return rows[0] as CrossAssetProject;
  } catch {
    return null;
  }
}

// ─── List all issues ──────────────────────────────────────────────────────────

export async function listIssues(): Promise<Pick<CrossAssetProject, "id" | "created_at" | "stage" | "status" | "cutoff_date">[]> {
  if (!isConfigured()) return [];

  try {
    const r = await fetch(`${URL}/rest/v1/issues?select=id,created_at,stage,status,cutoff_date&order=created_at.desc`, {
      headers: supaHeaders(),
    });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

// ─── Update stage artifacts ───────────────────────────────────────────────────

type PatchableColumns =
  | "data_audit" | "thesis_candidates" | "approved_thesis"
  | "research_plan" | "quant_results" | "quant_analysis"
  | "claim_ledger" | "drafts" | "chart_specs" | "approved_illustration"
  | "issue_manifest" | "stage" | "status" | "approval_log";

export async function patchIssue(
  id: string,
  updates: Partial<Record<PatchableColumns, unknown>>
): Promise<void> {
  if (!isConfigured()) return;

  try {
    await fetch(`${URL}/rest/v1/issues?id=eq.${id}`, {
      method: "PATCH",
      headers: supaHeaders(),
      body: JSON.stringify(updates),
    });
  } catch {
    // non-fatal
  }
}

// ─── Advance stage with approval ──────────────────────────────────────────────

export async function recordApproval(
  id: string,
  currentLog: ApprovalRecord[],
  approval: ApprovalRecord
): Promise<void> {
  const updated = [...currentLog, approval];
  await patchIssue(id, { approval_log: updated });
}

export async function advanceStage(
  id: string,
  nextStage: WorkflowStage,
  nextStatus: StageStatus,
  columnUpdates: Partial<Record<PatchableColumns, unknown>>
): Promise<void> {
  await patchIssue(id, { stage: nextStage, status: nextStatus, ...columnUpdates });
}
