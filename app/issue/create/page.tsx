"use client";

import React, { useState, useCallback } from "react";
import type {
  WorkflowStage,
  DataAuditOutput,
  ThesisSelectionOutput,
  ThesisCandidate,
  ResearchPlanOutput,
  AnalysisJob,
  QuantAnalysisOutput,
  DraftOutput,
  ChartsAndIllustrationsOutput,
  IssueManifest,
} from "@/lib/pipeline/types";

// ─── Stage metadata ───────────────────────────────────────────────────────────

const STAGES: { id: WorkflowStage; label: string; description: string }[] = [
  { id: "DATA_AUDIT",              label: "Data Audit",         description: "Check data coverage and freshness" },
  { id: "THESIS_SELECTION",        label: "Thesis",             description: "Generate and select the issue thesis" },
  { id: "RESEARCH_PLAN",           label: "Research Plan",      description: "Design analysis and chart strategy" },
  { id: "QUANT_ANALYSIS",          label: "Analysis",           description: "Run calculations + adversarial review" },
  { id: "DRAFT",                   label: "Draft",              description: "Write all 8 pages" },
  { id: "CHARTS_AND_ILLUSTRATIONS",label: "Charts",             description: "Chart specs + illustration brief" },
  { id: "FINAL_ASSEMBLY",          label: "Final Proof",        description: "Fact-check, assemble, quality score" },
];

const STAGE_ORDER = STAGES.map((s) => s.id);

function stageIndex(s: WorkflowStage) {
  return STAGE_ORDER.indexOf(s);
}

// ─── Types for API response ───────────────────────────────────────────────────

interface ApiResponse {
  issue_id: string;
  stage: WorkflowStage;
  status: string;
  stage_summary: string;
  output: unknown;
  approval_required?: boolean;
  recommended_next_action?: string;
  blocking_issues?: string[];
  error?: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IssuePipelinePage() {
  const [issueId, setIssueId] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<WorkflowStage>("DATA_AUDIT");
  const [completedStages, setCompletedStages] = useState<WorkflowStage[]>([]);
  const [stageOutputs, setStageOutputs] = useState<Partial<Record<WorkflowStage, unknown>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<ApiResponse | null>(null);

  // Thesis selection state
  const [selectedThesis, setSelectedThesis] = useState<ThesisCandidate | null>(null);
  // Research plan: job toggles
  const [enabledJobs, setEnabledJobs] = useState<Set<string>>(new Set());
  // Draft: which page group to generate next
  const [draftGroup, setDraftGroup] = useState<"pages_1_2" | "pages_3_4" | "pages_5_6" | "pages_7_8">("pages_1_2");
  // Illustration selection
  const [selectedIllId, setSelectedIllId] = useState<string | null>(null);

  // ─── Create issue ─────────────────────────────────────────────────────────

  const createIssue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/issue", { method: "POST" });
      const data = await r.json() as { id: string };
      setIssueId(data.id);
      setCurrentStage("DATA_AUDIT");
      setCompletedStages([]);
      setStageOutputs({});
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Run a stage ──────────────────────────────────────────────────────────

  const runStage = useCallback(async (stage: WorkflowStage, extra: Record<string, unknown> = {}) => {
    if (!issueId) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { stage, ...extra };

      if (stage === "RESEARCH_PLAN" && selectedThesis) {
        body.approved_thesis = selectedThesis;
      }
      if (stage === "QUANT_ANALYSIS" && enabledJobs.size > 0) {
        body.enabled_jobs = [...enabledJobs];
      }
      if (stage === "DRAFT") {
        body.page_group = draftGroup;
      }
      if (stage === "FINAL_ASSEMBLY" && selectedIllId) {
        body.approved_illustration_id = selectedIllId;
      }

      const r = await fetch(`/api/issue/${issueId}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await r.json() as ApiResponse;
      setLastResponse(data);

      if (data.error) {
        setError(data.error);
        return;
      }

      setStageOutputs((prev) => ({ ...prev, [stage]: data.output }));

      if (!completedStages.includes(stage)) {
        setCompletedStages((prev) => [...prev, stage]);
      }

      // Auto-initialize job toggles when research plan arrives
      if (stage === "RESEARCH_PLAN" && data.output) {
        const plan = data.output as ResearchPlanOutput;
        setEnabledJobs(new Set(plan.analysis_jobs.map((j) => j.job_id)));
      }

      // Auto-select recommended illustration
      if (stage === "CHARTS_AND_ILLUSTRATIONS" && data.output) {
        const co = data.output as ChartsAndIllustrationsOutput;
        setSelectedIllId(co.recommended_illustration_id);
      }

    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [issueId, selectedThesis, enabledJobs, draftGroup, selectedIllId, completedStages]);

  const approveAndAdvance = useCallback(async (stage: WorkflowStage) => {
    if (!issueId) return;
    // Record approval
    await fetch(`/api/issue/${issueId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, action: "approve" }),
    });
    // Advance UI
    const nextIdx = stageIndex(stage) + 1;
    if (nextIdx < STAGES.length) {
      setCurrentStage(STAGES[nextIdx].id);
    }
  }, [issueId]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-0 -mx-10 -my-10 min-h-screen">
      {/* Left sidebar — stage progress */}
      <aside className="w-52 shrink-0 border-r border-[#e8e3da] bg-[#faf9f7] px-4 py-8">
        <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a7e6c] font-semibold mb-6">
          Issue Pipeline
        </p>
        <div className="space-y-1">
          {STAGES.map((s, i) => {
            const done = completedStages.includes(s.id);
            const active = currentStage === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentStage(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-sm transition-all ${
                  active
                    ? "bg-[#0c1b38] text-white"
                    : done
                    ? "text-[#2d5016] hover:bg-[#f0f0eb]"
                    : "text-[#8a7e6c] hover:bg-[#f0f0eb]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] shrink-0 ${
                    done
                      ? "bg-[#2d5016] border-[#2d5016] text-white"
                      : active
                      ? "bg-white border-white text-[#0c1b38]"
                      : "border-[#c8bfad] text-[#8a7e6c]"
                  }`}>
                    {done ? "✓" : i + 1}
                  </span>
                  <span className="text-[12px] font-medium leading-tight">{s.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {issueId && (
          <div className="mt-8 pt-6 border-t border-[#e8e3da]">
            <p className="text-[9px] text-[#8a7e6c] uppercase tracking-widest mb-1">Issue ID</p>
            <p className="text-[10px] text-[#3d3528] font-mono break-all">{issueId}</p>
          </div>
        )}
      </aside>

      {/* Main panel */}
      <div className="flex-1 overflow-auto px-10 py-8">
        {!issueId ? (
          <StartPanel onStart={createIssue} loading={loading} />
        ) : (
          <StagePanel
            stage={currentStage}
            issueId={issueId}
            output={stageOutputs[currentStage]}
            lastResponse={lastResponse}
            loading={loading}
            error={error}
            selectedThesis={selectedThesis}
            setSelectedThesis={setSelectedThesis}
            enabledJobs={enabledJobs}
            setEnabledJobs={setEnabledJobs}
            draftGroup={draftGroup}
            setDraftGroup={setDraftGroup}
            selectedIllId={selectedIllId}
            setSelectedIllId={setSelectedIllId}
            onRun={runStage}
            onApprove={approveAndAdvance}
            completedStages={completedStages}
            allOutputs={stageOutputs}
          />
        )}
      </div>
    </div>
  );
}

// ─── Start panel ──────────────────────────────────────────────────────────────

function StartPanel({ onStart, loading }: { onStart: () => void; loading: boolean }) {
  return (
    <div className="max-w-xl">
      <p className="text-[10px] tracking-[0.25em] uppercase text-[#8a7e6c] mb-3">CrossAsset</p>
      <h1 className="text-[28px] font-semibold text-[#1a1208] mb-3" style={{ fontFamily: "var(--font-serif)" }}>
        AI Newspaper Pipeline
      </h1>
      <p className="text-[14px] text-[#5a4f3f] leading-relaxed mb-2">
        A 7-stage human-in-the-loop workflow that produces each biweekly CrossAsset issue.
        Claude acts in specialized editorial roles — researcher, analyst, writer, fact-checker — while you
        approve every major decision.
      </p>
      <p className="text-[13px] text-[#8a7e6c] leading-relaxed mb-8">
        Estimated cost per issue: ~$0.80–1.20. All data sourced from FRED, NewsAPI, and Yahoo Finance.
        State persisted to Supabase.
      </p>
      <div className="grid grid-cols-2 gap-3 mb-8 text-[12px]">
        {[
          ["Stage 1", "Data audit — freshness check on 22 series"],
          ["Stage 2", "5 thesis candidates scored 0–100"],
          ["Stage 3", "Research plan with toggleable analysis jobs"],
          ["Stage 4", "Calculations + independent adversarial review"],
          ["Stage 5", "8-page draft in 4 page-group calls"],
          ["Stage 6", "10–14 chart specs + 3 illustration concepts"],
          ["Stage 7", "3-pass fact-check, quality score, final proof"],
        ].map(([stage, desc]) => (
          <div key={stage} className="border border-[#e8e3da] rounded px-3 py-2.5 bg-white">
            <p className="text-[10px] text-[#8a7e6c] uppercase tracking-wide mb-0.5">{stage}</p>
            <p className="text-[#3d3528]">{desc}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onStart}
        disabled={loading}
        className="px-6 py-3 bg-[#0c1b38] text-white text-[13px] font-medium rounded-sm hover:bg-[#162d5a] disabled:opacity-50 transition-colors"
      >
        {loading ? "Creating issue…" : "Start New Issue"}
      </button>
    </div>
  );
}

// ─── Stage panel router ───────────────────────────────────────────────────────

interface StagePanelProps {
  stage: WorkflowStage;
  issueId: string;
  output: unknown;
  lastResponse: ApiResponse | null;
  loading: boolean;
  error: string | null;
  selectedThesis: ThesisCandidate | null;
  setSelectedThesis: (t: ThesisCandidate | null) => void;
  enabledJobs: Set<string>;
  setEnabledJobs: React.Dispatch<React.SetStateAction<Set<string>>>;
  draftGroup: "pages_1_2" | "pages_3_4" | "pages_5_6" | "pages_7_8";
  setDraftGroup: (g: "pages_1_2" | "pages_3_4" | "pages_5_6" | "pages_7_8") => void;
  selectedIllId: string | null;
  setSelectedIllId: (id: string | null) => void;
  onRun: (stage: WorkflowStage, extra?: Record<string, unknown>) => void;
  onApprove: (stage: WorkflowStage) => void;
  completedStages: WorkflowStage[];
  allOutputs: Partial<Record<WorkflowStage, unknown>>;
}

function StagePanel(props: StagePanelProps) {
  const { stage, output, loading, error, lastResponse } = props;

  const stageMeta = STAGES.find((s) => s.id === stage)!;

  return (
    <div>
      {/* Stage header */}
      <div className="mb-6">
        <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a7e6c] mb-1">{stageMeta.description}</p>
        <h2 className="text-[22px] font-semibold text-[#1a1208]" style={{ fontFamily: "var(--font-serif)" }}>
          {stageMeta.label}
        </h2>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-[12px] text-red-700">
          {error}
        </div>
      )}

      {lastResponse?.blocking_issues && lastResponse.blocking_issues.length > 0 && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded text-[12px] text-amber-800">
          <p className="font-semibold mb-1">Blocking issues — resolve before advancing:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {lastResponse.blocking_issues.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {stage === "DATA_AUDIT" && (
        <DataAuditPanel output={output as unknown as DataAuditOutput | undefined} loading={loading} {...props} />
      )}
      {stage === "THESIS_SELECTION" && (
        <ThesisPanel output={output as unknown as ThesisSelectionOutput | undefined} loading={loading} {...props} />
      )}
      {stage === "RESEARCH_PLAN" && (
        <ResearchPlanPanel output={output as unknown as ResearchPlanOutput | undefined} loading={loading} {...props} />
      )}
      {stage === "QUANT_ANALYSIS" && (
        <QuantPanel output={output as unknown as QuantAnalysisOutput | undefined} loading={loading} {...props} />
      )}
      {stage === "DRAFT" && (
        <DraftPanel output={output as unknown as DraftOutput | undefined} loading={loading} {...props} />
      )}
      {stage === "CHARTS_AND_ILLUSTRATIONS" && (
        <ChartsPanel output={output as unknown as ChartsAndIllustrationsOutput | undefined} loading={loading} {...props} />
      )}
      {stage === "FINAL_ASSEMBLY" && (
        <AssemblyPanel output={output as unknown as IssueManifest | undefined} loading={loading} {...props} />
      )}

      {lastResponse?.recommended_next_action && !error && (
        <div className="mt-4 text-[12px] text-[#8a7e6c] border-t border-[#e8e3da] pt-4">
          Next: {lastResponse.recommended_next_action}
        </div>
      )}
    </div>
  );
}

// ─── Shared approval buttons ──────────────────────────────────────────────────

function ApprovalBar({
  stage,
  hasOutput,
  loading,
  onRun,
  onApprove,
  approveLabel = "Approve & Continue",
  runLabel = "Run Stage",
  disabled = false,
  extra,
}: {
  stage: WorkflowStage;
  hasOutput: boolean;
  loading: boolean;
  onRun: (stage: WorkflowStage, extra?: Record<string, unknown>) => void;
  onApprove: (stage: WorkflowStage) => void;
  approveLabel?: string;
  runLabel?: string;
  disabled?: boolean;
  extra?: Record<string, unknown>;
}) {
  return (
    <div className="flex items-center gap-3 mt-6">
      {!hasOutput && (
        <button
          onClick={() => onRun(stage, extra)}
          disabled={loading || disabled}
          className="px-5 py-2.5 bg-[#0c1b38] text-white text-[13px] font-medium rounded-sm hover:bg-[#162d5a] disabled:opacity-40 transition-colors"
        >
          {loading ? "Running…" : runLabel}
        </button>
      )}
      {hasOutput && (
        <>
          <button
            onClick={() => onApprove(stage)}
            disabled={loading}
            className="px-5 py-2.5 bg-[#2d5016] text-white text-[13px] font-medium rounded-sm hover:bg-[#3a6a1e] disabled:opacity-40 transition-colors"
          >
            {approveLabel}
          </button>
          <button
            onClick={() => onRun(stage, extra)}
            disabled={loading}
            className="px-4 py-2.5 border border-[#e8e3da] text-[#3d3528] text-[13px] font-medium rounded-sm hover:bg-[#f5f3ef] disabled:opacity-40 transition-colors"
          >
            {loading ? "Regenerating…" : "Regenerate"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Stage 1: Data Audit panel ────────────────────────────────────────────────

function DataAuditPanel({ output, loading, onRun, onApprove, stage }: StagePanelProps & { output: DataAuditOutput | undefined }) {
  return (
    <div>
      {!output ? (
        <p className="text-[13px] text-[#8a7e6c] mb-4">
          Fetches metadata for 22 FRED series and checks freshness. Claude (Haiku) classifies coverage by asset class.
        </p>
      ) : (
        <div>
          <div className="flex items-center gap-6 mb-4">
            <span className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
              output.readiness === "pass" ? "bg-green-50 text-green-700 border border-green-200" :
              output.readiness === "pass_with_gaps" ? "bg-amber-50 text-amber-700 border border-amber-200" :
              "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {output.readiness.toUpperCase()}
            </span>
            <span className="text-[12px] text-[#8a7e6c]">{output.usable_universe.length} series usable</span>
          </div>

          <div className="overflow-auto mb-4">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-[#e8e3da]">
                  <th className="text-left py-2 pr-4 text-[#8a7e6c] font-medium">Series</th>
                  <th className="text-left py-2 pr-4 text-[#8a7e6c] font-medium">Last date</th>
                  <th className="text-left py-2 pr-4 text-[#8a7e6c] font-medium">Days stale</th>
                  <th className="text-left py-2 text-[#8a7e6c] font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {output.coverage.map((s) => (
                  <tr key={s.series_id} className="border-b border-[#f0ede8]">
                    <td className="py-1.5 pr-4 font-mono text-[11px]">{s.series_id}</td>
                    <td className="py-1.5 pr-4 text-[#5a4f3f]">{s.last_date}</td>
                    <td className="py-1.5 pr-4 text-[#5a4f3f]">{s.days_stale}d</td>
                    <td className="py-1.5">
                      <span className={`text-[10px] font-semibold ${
                        s.status === "fresh" ? "text-green-600" :
                        s.status === "stale" ? "text-amber-600" : "text-red-500"
                      }`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {output.data_quality_issues.length > 0 && (
            <div className="text-[12px] text-amber-700 mb-2">
              Issues: {output.data_quality_issues.join("; ")}
            </div>
          )}
        </div>
      )}
      <ApprovalBar stage={stage} hasOutput={!!output} loading={loading} onRun={onRun} onApprove={onApprove} runLabel="Audit Data Sources" />
    </div>
  );
}

// ─── Stage 2: Thesis Selection panel ─────────────────────────────────────────

function ThesisPanel({ output, loading, onRun, onApprove, stage, selectedThesis, setSelectedThesis }: StagePanelProps & { output: ThesisSelectionOutput | undefined }) {
  return (
    <div>
      {!output ? (
        <p className="text-[13px] text-[#8a7e6c] mb-4">
          Claude (Sonnet) analyzes 2-week FRED anomalies and news headlines to generate 5 thesis candidates, each scored 0–100.
        </p>
      ) : (
        <div>
          <p className="text-[12px] text-[#8a7e6c] mb-4">{output.recommendation_rationale}</p>
          <div className="grid grid-cols-1 gap-3 mb-4">
            {output.candidates.map((c) => {
              const isSelected = selectedThesis?.thesis_id === c.thesis_id;
              const isRecommended = c.thesis_id === output.recommended_id;
              return (
                <button
                  key={c.thesis_id}
                  onClick={() => setSelectedThesis(c)}
                  className={`w-full text-left border rounded-sm p-4 transition-all ${
                    isSelected
                      ? "border-[#0c1b38] bg-[#0c1b38]/5"
                      : "border-[#e8e3da] hover:border-[#c8bfad] bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-[13px] font-semibold text-[#1a1208] leading-tight">{c.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {isRecommended && (
                        <span className="text-[9px] bg-[#0c1b38] text-white px-2 py-0.5 rounded-full uppercase tracking-wide">Recommended</span>
                      )}
                      <span className="text-[13px] font-bold text-[#0c1b38]">{c.total_score.toFixed(0)}</span>
                    </div>
                  </div>
                  <p className="text-[12px] text-[#5a4f3f] mb-2">{c.one_sentence}</p>
                  <p className="text-[11px] text-[#8a7e6c]">
                    <span className="font-medium">Falsification:</span> {c.falsification_condition}
                  </p>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {Object.entries(c.scores).map(([k, v]) => (
                      <span key={k} className="text-[9px] text-[#8a7e6c] border border-[#e8e3da] px-1.5 py-0.5 rounded">
                        {k.replace(/_/g, " ")}: {v}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedThesis && (
            <p className="text-[12px] text-[#2d5016] mb-2 font-medium">
              ✓ Selected: {selectedThesis.title}
            </p>
          )}
        </div>
      )}
      <ApprovalBar
        stage={stage}
        hasOutput={!!output}
        loading={loading}
        onRun={onRun}
        onApprove={onApprove}
        runLabel="Generate Thesis Candidates"
        approveLabel={selectedThesis ? "Approve Selected Thesis" : "Approve Recommended Thesis"}
        disabled={!!output && !selectedThesis && !output.recommended_id}
      />
    </div>
  );
}

// ─── Stage 3: Research Plan panel ────────────────────────────────────────────

function ResearchPlanPanel({ output, loading, onRun, onApprove, stage, enabledJobs, setEnabledJobs }: StagePanelProps & { output: ResearchPlanOutput | undefined }) {
  const toggleJob = (jobId: string) => {
    setEnabledJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  return (
    <div>
      {!output ? (
        <p className="text-[13px] text-[#8a7e6c] mb-4">
          Claude (Sonnet) designs analysis jobs and charts for the approved thesis. You can toggle individual jobs on/off.
        </p>
      ) : (
        <div>
          <p className="text-[13px] text-[#3d3528] mb-1 font-medium">Hypothesis</p>
          <p className="text-[12px] text-[#5a4f3f] mb-4 leading-relaxed">{output.hypothesis}</p>

          <p className="text-[13px] text-[#3d3528] mb-2 font-medium">Analysis Jobs ({output.analysis_jobs.length})</p>
          <div className="space-y-2 mb-4">
            {(output.analysis_jobs as AnalysisJob[]).map((j) => (
              <div
                key={j.job_id}
                className={`flex items-start gap-3 p-3 border rounded-sm ${
                  enabledJobs.has(j.job_id) ? "border-[#e8e3da] bg-white" : "border-[#f0ede8] bg-[#faf9f7] opacity-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={enabledJobs.has(j.job_id)}
                  onChange={() => toggleJob(j.job_id)}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono text-[#8a7e6c]">{j.job_id}</p>
                  <p className="text-[12px] text-[#3d3528]">{j.purpose}</p>
                  <p className="text-[11px] text-[#8a7e6c]">
                    {j.series.join(", ")} · {j.method} · {j.transformation}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[12px] text-[#8a7e6c]">
            {enabledJobs.size}/{output.analysis_jobs.length} jobs enabled
          </p>
        </div>
      )}
      <ApprovalBar stage={stage} hasOutput={!!output} loading={loading} onRun={onRun} onApprove={onApprove} runLabel="Generate Research Plan" />
    </div>
  );
}

// ─── Stage 4: Quant Analysis panel ───────────────────────────────────────────

function QuantPanel({ output, loading, onRun, onApprove, stage }: StagePanelProps & { output: QuantAnalysisOutput | undefined }) {
  return (
    <div>
      {!output ? (
        <p className="text-[13px] text-[#8a7e6c] mb-4">
          Runs calculations deterministically (TypeScript, no LLM), then makes two separate Claude calls:
          one for interpretation, one adversarial review that cannot see the interpretation.
        </p>
      ) : (
        <div>
          <div className="flex items-center gap-6 mb-5">
            <div className="text-center">
              <p className="text-[28px] font-bold text-[#0c1b38]">{output.merged_confidence}</p>
              <p className="text-[10px] text-[#8a7e6c] uppercase tracking-wide">Thesis confidence</p>
            </div>
            <div className="flex-1">
              <p className="text-[12px] text-[#3d3528] mb-1">{output.interpretation.overall_assessment}</p>
              <p className="text-[11px] text-[#8a7e6c]">
                Adversarial: {output.adversarial.recommendation} · {output.adversarial.objections.length} objections
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-[11px] font-semibold text-[#3d3528] uppercase tracking-wide mb-2">Key Findings</p>
              <div className="space-y-2">
                {output.interpretation.findings.map((f) => (
                  <div key={f.finding_id} className="border border-[#e8e3da] rounded p-2.5">
                    <p className="text-[11px] text-[#3d3528] leading-snug">{f.description}</p>
                    <div className="mt-1 flex gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        f.supports_thesis === "yes" ? "bg-green-50 text-green-700" :
                        f.supports_thesis === "partially" ? "bg-amber-50 text-amber-700" :
                        "bg-red-50 text-red-700"
                      }`}>{f.supports_thesis}</span>
                      <span className="text-[9px] text-[#8a7e6c]">{f.claim_classification}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-[#3d3528] uppercase tracking-wide mb-2">Adversarial Review</p>
              <div className="space-y-2">
                {output.adversarial.objections.map((o) => (
                  <div key={o.id} className={`border rounded p-2.5 ${
                    o.severity === "fatal" ? "border-red-200 bg-red-50" :
                    o.severity === "moderate" ? "border-amber-200 bg-amber-50" :
                    "border-[#e8e3da] bg-white"
                  }`}>
                    <p className="text-[11px] text-[#3d3528] leading-snug">{o.description}</p>
                    <span className={`text-[9px] font-semibold ${
                      o.severity === "fatal" ? "text-red-600" :
                      o.severity === "moderate" ? "text-amber-600" : "text-[#8a7e6c]"
                    }`}>{o.severity}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[#8a7e6c]">
                Adversarial confidence: {output.adversarial.revised_confidence}/100
              </p>
            </div>
          </div>

          {output.fatal_objections.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-[12px] text-red-700">
              <p className="font-semibold mb-1">Fatal objections block advancement:</p>
              {output.fatal_objections.map((o, i) => <p key={i}>• {o}</p>)}
            </div>
          )}
        </div>
      )}
      <ApprovalBar stage={stage} hasOutput={!!output} loading={loading} onRun={onRun} onApprove={onApprove} runLabel="Run Analysis" />
    </div>
  );
}

// ─── Stage 5: Draft panel ─────────────────────────────────────────────────────

const PAGE_GROUPS: { id: "pages_1_2" | "pages_3_4" | "pages_5_6" | "pages_7_8"; label: string }[] = [
  { id: "pages_1_2", label: "Pages 1–2: Cover + Regime" },
  { id: "pages_3_4", label: "Pages 3–4: The Big Idea" },
  { id: "pages_5_6", label: "Pages 5–6: Pricing vs Reality + Command Center" },
  { id: "pages_7_8", label: "Pages 7–8: Model Lab + Final Page" },
];

function DraftPanel({ output, loading, onRun, onApprove, stage, draftGroup, setDraftGroup }: StagePanelProps & { output: DraftOutput | undefined }) {
  return (
    <div>
      <p className="text-[13px] text-[#8a7e6c] mb-4">
        Draft is generated in 4 page groups (2 pages per call) to keep token cost under control.
        Each call costs ~$0.15–0.25.
      </p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {PAGE_GROUPS.map((g) => {
          const isDone = output?.sections.some((s) => {
            if (g.id === "pages_1_2") return s.page <= 2;
            if (g.id === "pages_3_4") return s.page >= 3 && s.page <= 4;
            if (g.id === "pages_5_6") return s.page >= 5 && s.page <= 6;
            return s.page >= 7;
          });
          return (
            <button
              key={g.id}
              onClick={() => setDraftGroup(g.id)}
              className={`px-3 py-1.5 text-[12px] rounded-sm border transition-all ${
                draftGroup === g.id
                  ? "bg-[#0c1b38] text-white border-[#0c1b38]"
                  : isDone
                  ? "bg-[#f0f7ec] text-[#2d5016] border-[#c5d9b8]"
                  : "bg-white text-[#5a4f3f] border-[#e8e3da] hover:border-[#c8bfad]"
              }`}
            >
              {isDone && "✓ "}{g.label}
            </button>
          );
        })}
      </div>

      {output && output.sections.length > 0 && (
        <div className="space-y-4 mb-4">
          {output.sections.map((s) => (
            <div key={s.section_id} className="border border-[#e8e3da] rounded-sm p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-[#8a7e6c] uppercase tracking-wide">Page {s.page}</p>
                <p className="text-[10px] text-[#8a7e6c]">{s.word_count}w</p>
              </div>
              <p className="text-[13px] font-semibold text-[#1a1208] mb-2">{s.title}</p>
              <p className="text-[12px] text-[#5a4f3f] leading-relaxed whitespace-pre-wrap">
                {s.prose.slice(0, 400)}{s.prose.length > 400 ? "…" : ""}
              </p>
            </div>
          ))}
          <p className="text-[12px] text-[#8a7e6c]">
            {output.page_count}/8 pages · {output.total_word_count} words
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={() => onRun(stage)}
          disabled={loading}
          className="px-5 py-2.5 bg-[#0c1b38] text-white text-[13px] font-medium rounded-sm hover:bg-[#162d5a] disabled:opacity-40 transition-colors"
        >
          {loading ? "Drafting…" : `Draft ${PAGE_GROUPS.find((g) => g.id === draftGroup)?.label}`}
        </button>
        {output && output.page_count >= 8 && (
          <button
            onClick={() => onApprove(stage)}
            className="px-5 py-2.5 bg-[#2d5016] text-white text-[13px] font-medium rounded-sm hover:bg-[#3a6a1e] transition-colors"
          >
            All 8 Pages Done — Approve
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Stage 6: Charts & Illustrations panel ────────────────────────────────────

function ChartsPanel({ output, loading, onRun, onApprove, stage, selectedIllId, setSelectedIllId }: StagePanelProps & { output: ChartsAndIllustrationsOutput | undefined }) {
  return (
    <div>
      {!output ? (
        <p className="text-[13px] text-[#8a7e6c] mb-4">
          Claude generates chart specifications with conclusion-led titles, plus 3 illustration concepts for a human illustrator.
        </p>
      ) : (
        <div>
          <p className="text-[12px] font-medium text-[#3d3528] mb-3">{output.charts.length} Charts</p>
          <div className="space-y-2 mb-6">
            {output.charts.map((c) => (
              <div key={c.chart_id} className="border border-[#e8e3da] rounded p-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-mono text-[#8a7e6c]">{c.chart_id} · p{c.page} · {c.chart_type}</p>
                    <p className="text-[12px] text-[#1a1208] font-medium mt-0.5">{c.conclusion_title}</p>
                    {c.subtitle && <p className="text-[11px] text-[#5a4f3f]">{c.subtitle}</p>}
                  </div>
                </div>
                <p className="text-[10px] text-[#8a7e6c] mt-1">
                  {c.series.map((s) => s.id).join(", ")}
                </p>
              </div>
            ))}
          </div>

          <p className="text-[12px] font-medium text-[#3d3528] mb-3">Illustration Concepts (select one)</p>
          <div className="space-y-3 mb-4">
            {output.illustration_concepts.map((ill) => (
              <button
                key={ill.illustration_id}
                onClick={() => setSelectedIllId(ill.illustration_id)}
                className={`w-full text-left border rounded-sm p-4 transition-all ${
                  selectedIllId === ill.illustration_id
                    ? "border-[#0c1b38] bg-[#0c1b38]/5"
                    : "border-[#e8e3da] bg-white hover:border-[#c8bfad]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[12px] font-semibold text-[#1a1208]">{ill.concept_name}</p>
                  {ill.illustration_id === output.recommended_illustration_id && (
                    <span className="text-[9px] bg-[#0c1b38] text-white px-2 py-0.5 rounded-full">Recommended</span>
                  )}
                </div>
                <p className="text-[11px] text-[#5a4f3f] mb-2">{ill.visual_metaphor}</p>
                <p className="text-[11px] text-[#8a7e6c] leading-relaxed">{ill.illustrator_brief.slice(0, 200)}…</p>
              </button>
            ))}
          </div>
        </div>
      )}
      <ApprovalBar stage={stage} hasOutput={!!output} loading={loading} onRun={onRun} onApprove={onApprove} runLabel="Generate Charts & Illustrations" />
    </div>
  );
}

// ─── Stage 7: Final Assembly panel ───────────────────────────────────────────

function AssemblyPanel({ output, loading, onRun, onApprove, stage }: StagePanelProps & { output: IssueManifest | undefined }) {
  return (
    <div>
      {!output ? (
        <p className="text-[13px] text-[#8a7e6c] mb-4">
          Three-pass fact-check (data auditor → analytical reviewer → editorial fact-checker), then issue assembly with quality scoring. Score ≥ 85 required to publish.
        </p>
      ) : (
        <div>
          <div className="flex items-start gap-6 mb-6">
            <div className="text-center border border-[#e8e3da] rounded-sm px-6 py-4 bg-white">
              <p className={`text-[36px] font-bold ${output.quality_score >= 85 ? "text-[#2d5016]" : "text-red-600"}`}>
                {output.quality_score}
              </p>
              <p className="text-[10px] text-[#8a7e6c] uppercase tracking-wide">Quality Score</p>
              <p className="text-[10px] text-[#8a7e6c]">Min 85 to publish</p>
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-semibold text-[#1a1208] mb-1">{output.title}</p>
              <p className="text-[12px] text-[#5a4f3f] mb-3">{output.thesis}</p>
              <p className="text-[10px] text-[#8a7e6c]">
                {output.pages?.length ?? 0} pages · {output.charts?.length ?? 0} charts · Cutoff: {output.cutoff_date}
              </p>
            </div>
          </div>

          {Object.entries(output.quality_breakdown ?? {}).length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-[#3d3528] uppercase tracking-wide mb-2">Quality Breakdown</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(output.quality_breakdown).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-[11px] border border-[#f0ede8] rounded px-2 py-1">
                    <span className="text-[#5a4f3f]">{k.replace(/_/g, " ")}</span>
                    <span className="font-semibold text-[#1a1208]">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {output.web_excerpt && (
            <div className="border border-[#e8e3da] rounded-sm p-4 bg-[#faf9f7] mb-4">
              <p className="text-[10px] text-[#8a7e6c] uppercase tracking-wide mb-2">Web Preview Excerpt</p>
              <p className="text-[12px] text-[#3d3528] leading-relaxed">{output.web_excerpt}</p>
            </div>
          )}

          {output.watchlist && (
            <div className="grid grid-cols-3 gap-3 mb-4 text-[11px]">
              <div>
                <p className="font-semibold text-[#3d3528] mb-1">Watching</p>
                {output.watchlist.indicators.map((i, idx) => <p key={idx} className="text-[#5a4f3f]">• {i}</p>)}
              </div>
              <div>
                <p className="font-semibold text-[#3d3528] mb-1">Catalysts</p>
                {output.watchlist.catalysts.map((c, idx) => <p key={idx} className="text-[#5a4f3f]">• {c}</p>)}
              </div>
              <div>
                <p className="font-semibold text-[#3d3528] mb-1">Next Issue</p>
                <p className="text-[#5a4f3f] italic">{output.watchlist.next_issue_question}</p>
              </div>
            </div>
          )}

          {output.blocking_issues.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-[12px] text-red-700 mb-4">
              <p className="font-semibold mb-1">Cannot publish:</p>
              {output.blocking_issues.map((b, i) => <p key={i}>• {b}</p>)}
            </div>
          )}

          {output.ready_to_publish && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-[12px] text-green-700 mb-4">
              ✓ Issue passes all quality checks. Ready to publish.
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-3 mt-4">
        {!output && (
          <button
            onClick={() => onRun(stage)}
            disabled={loading}
            className="px-5 py-2.5 bg-[#0c1b38] text-white text-[13px] font-medium rounded-sm hover:bg-[#162d5a] disabled:opacity-40 transition-colors"
          >
            {loading ? "Assembling…" : "Run Fact-Check & Assembly"}
          </button>
        )}
        {output && (
          <>
            {output.ready_to_publish && (
              <button
                onClick={() => onApprove(stage)}
                className="px-5 py-2.5 bg-[#2d5016] text-white text-[13px] font-medium rounded-sm hover:bg-[#3a6a1e] transition-colors"
              >
                Publish Issue
              </button>
            )}
            <button
              onClick={() => onRun(stage)}
              disabled={loading}
              className="px-4 py-2.5 border border-[#e8e3da] text-[#3d3528] text-[13px] font-medium rounded-sm hover:bg-[#f5f3ef] disabled:opacity-40 transition-colors"
            >
              {loading ? "Re-assembling…" : "Re-run Fact-Check"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
