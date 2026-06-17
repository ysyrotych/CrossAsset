"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import AppShell from "@/components/layout/AppShell";
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

// Add ILLUSTRATIONS as its own stage between Charts and Final
const STAGES: { id: WorkflowStage | "ILLUSTRATIONS"; label: string; description: string }[] = [
  { id: "DATA_AUDIT",              label: "Data Audit",     description: "Check data coverage and freshness" },
  { id: "THESIS_SELECTION",        label: "Thesis",         description: "Generate and select the issue thesis" },
  { id: "RESEARCH_PLAN",           label: "Research Plan",  description: "Design analysis and chart strategy" },
  { id: "QUANT_ANALYSIS",          label: "Analysis",       description: "Run calculations + adversarial review" },
  { id: "DRAFT",                   label: "Draft",          description: "Write all 8 pages" },
  { id: "CHARTS_AND_ILLUSTRATIONS",label: "Charts",         description: "Chart specifications" },
  { id: "ILLUSTRATIONS",           label: "Illustrations",  description: "3 illustration concepts for the artist" },
  { id: "FINAL_ASSEMBLY",          label: "Final Proof",    description: "Fact-check, assemble, quality score" },
];

const STAGE_ORDER = STAGES.map((s) => s.id);
type AnyStage = WorkflowStage | "ILLUSTRATIONS";

function stageIndex(s: AnyStage) {
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

// ─── Mock data for dev test mode ─────────────────────────────────────────────

const MOCK_THESIS: ThesisCandidate = {
  thesis_id: "TH-DEV",
  title: "[DEV] Fed Credibility Repricing",
  one_sentence: "Markets are repricing the Fed reaction function, not growth deterioration.",
  conventional_view: "Rally driven by growth fears.",
  differentiated_view: "Warsh appointment signals hawkish credibility shift; front-end repricing.",
  evidence_available: ["DGS2 z-score elevated", "Real yields stable"],
  evidence_needed: ["Confirmed 30Y z-score data"],
  cross_asset_transmission: "Rates → credit → equities → FX",
  falsification_condition: "2Y yield drops below 4% without Fed pivot",
  scores: { importance: 8, timeliness: 9, originality: 8, testability: 8, evidence_quality: 7, cross_asset_relevance: 9, visual_potential: 8, reader_interest: 8, falsifiability: 9, page_fit: 9 },
  total_score: 83,
};

const MOCK_OUTPUTS: Partial<Record<AnyStage, unknown>> = {
  DATA_AUDIT: { coverage: [], asset_class_coverage: {}, missing_series: [], data_quality_issues: [], usable_universe: ["DGS2","DGS10","SP500","BAMLH0A0HYM2"], readiness: "pass_with_gaps", blocking_gaps: [] },
  THESIS_SELECTION: { candidates: [MOCK_THESIS], recommended_id: "TH-DEV", recommendation_rationale: "Dev mode mock." },
  RESEARCH_PLAN: { hypothesis: "Dev mode hypothesis.", alternative_hypotheses: [], analysis_jobs: [], proposed_charts: [{ chart_id: "CH-001", type: "line", question: "2Y yield trend", series: ["DGS2"] }], page_allocation: {}, stop_conditions: [] },
  QUANT_ANALYSIS: { interpretation: { findings: [], thesis_confidence: 70, key_evidence: ["DGS2 elevated"], primary_charts: ["CH-001"], overall_assessment: "Dev mode." }, adversarial: { objections: [], tests_performed: [], findings_that_survive: [], findings_that_fail: [], revised_confidence: 65, recommendation: "publish", summary: "Dev mode adversarial." }, claim_ledger: [], merged_confidence: 68, fatal_objections: [] },
  DRAFT: { sections: [{ page: 1, section_id: "S1", title: "Dev Cover", prose: "This is a development test draft. The full prose would appear here in production.", word_count: 18, claim_ids: [], chart_refs: [] }], total_word_count: 18, page_count: 1 },
};

export default function IssuePipelinePage() {
  const [issueId, setIssueId] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<AnyStage>("DATA_AUDIT");
  const [completedStages, setCompletedStages] = useState<AnyStage[]>([]);
  const [stageOutputs, setStageOutputs] = useState<Partial<Record<AnyStage, unknown>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<ApiResponse | null>(null);
  const [testMode, setTestMode] = useState(false);

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

  const runStage = useCallback(async (stage: AnyStage, extra: Record<string, unknown> = {}) => {
    if (!issueId) return;
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { stage, ...extra };

      // Pass all prior stage outputs so the API works without Supabase
      if (stageOutputs.DATA_AUDIT) body.data_audit = stageOutputs.DATA_AUDIT;
      if (stageOutputs.THESIS_SELECTION) body.thesis_candidates = stageOutputs.THESIS_SELECTION;
      if (stageOutputs.RESEARCH_PLAN) body.research_plan = stageOutputs.RESEARCH_PLAN;
      if (stageOutputs.QUANT_ANALYSIS) {
        body.quant_analysis = stageOutputs.QUANT_ANALYSIS;
        // claim_ledger and quant_results live inside quant_analysis — extract them explicitly
        // so the FINAL_ASSEMBLY stage can pass them to fact-check without Supabase
        const qa = stageOutputs.QUANT_ANALYSIS as QuantAnalysisOutput;
        if (qa?.claim_ledger?.length) body.claim_ledger = qa.claim_ledger;
      }
      if (stageOutputs.DRAFT) body.drafts = stageOutputs.DRAFT;
      if (stageOutputs.CHARTS_AND_ILLUSTRATIONS) body.chart_specs = stageOutputs.CHARTS_AND_ILLUSTRATIONS;
      if (stageOutputs.ILLUSTRATIONS) body.illustrations = stageOutputs.ILLUSTRATIONS;

      // Always send the approved thesis for every stage (API needs it for stages 3–7)
      if (selectedThesis) body.approved_thesis = selectedThesis;
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
      if ((stage === "CHARTS_AND_ILLUSTRATIONS" || stage === "ILLUSTRATIONS") && data.output) {
        const co = data.output as ChartsAndIllustrationsOutput;
        if (co.recommended_illustration_id) setSelectedIllId(co.recommended_illustration_id);
      }

    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [issueId, selectedThesis, enabledJobs, draftGroup, selectedIllId, completedStages]);

  // Activate test mode: pre-populate stages 1-5 with mock data and jump to Charts
  const activateTestMode = useCallback(async () => {
    setTestMode(true);
    setSelectedThesis(MOCK_THESIS);
    setStageOutputs(MOCK_OUTPUTS);
    setCompletedStages(["DATA_AUDIT","THESIS_SELECTION","RESEARCH_PLAN","QUANT_ANALYSIS","DRAFT"]);
    setCurrentStage("CHARTS_AND_ILLUSTRATIONS");
    setError(null);
    // Create a real issue ID if we don't have one
    if (!issueId) {
      try {
        const r = await fetch("/api/issue", { method: "POST" });
        const data = await r.json() as { id: string };
        setIssueId(data.id);
      } catch { /* ignore */ }
    }
  }, [issueId]);

  const approveAndAdvance = useCallback((stage: AnyStage) => {
    if (!issueId) return;
    // Advance UI immediately — don't wait for API
    setCompletedStages((prev) => prev.includes(stage) ? prev : [...prev, stage]);
    const nextIdx = stageIndex(stage as WorkflowStage) + 1;
    if (nextIdx < STAGES.length) {
      setCurrentStage(STAGES[nextIdx].id);
      setError(null);
      setLastResponse(null);
    }
    // Record approval in background
    fetch(`/api/issue/${issueId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, action: "approve" }),
    }).catch(console.error);
  }, [issueId]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppShell><div className="flex gap-0 -mx-10 -my-10 min-h-screen">
      {/* Left sidebar — stage progress */}
      <aside className="w-52 shrink-0 border-r border-[#e8e3da] bg-[#faf9f7] px-4 py-8">
        <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a7e6c] font-semibold mb-6">
          Issue Pipeline
        </p>
        <div className="space-y-1">
          {STAGES.map((s, i) => {
            const done = completedStages.includes(s.id);
            const active = currentStage === s.id;
            // Only allow navigating to completed stages or the current active stage
            const locked = !done && !active;
            return (
              <button
                key={s.id}
                onClick={() => {
                  if (locked) return;
                  setCurrentStage(s.id);
                  setError(null);
                  setLastResponse(null);
                }}
                disabled={locked}
                className={`w-full text-left px-3 py-2.5 rounded-sm transition-all ${
                  active
                    ? "bg-[#0c1b38] text-white"
                    : done
                    ? "text-[#2d5016] hover:bg-[#f0f0eb] cursor-pointer"
                    : "text-[#c8bfad] cursor-default"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] shrink-0 ${
                    done
                      ? "bg-[#2d5016] border-[#2d5016] text-white"
                      : active
                      ? "bg-white border-white text-[#0c1b38]"
                      : "border-[#ddd8ce] text-[#c8bfad]"
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
            <p className="text-[10px] text-[#3d3528] font-mono truncate" title={issueId ?? ""}>{issueId}</p>
          </div>
        )}
      </aside>

      {/* Main panel */}
      <div className="flex-1 overflow-auto px-10 py-8">
        {!issueId ? (
          <StartPanel onStart={createIssue} onTestMode={activateTestMode} loading={loading} />
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
    </div></AppShell>
  );
}

// ─── Start panel ──────────────────────────────────────────────────────────────

function StartPanel({ onStart, onTestMode, loading }: { onStart: () => void; onTestMode: () => void; loading: boolean }) {
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
      <div className="flex items-center gap-3">
        <button
          onClick={onStart}
          disabled={loading}
          className="px-6 py-3 bg-[#0c1b38] text-white text-[13px] font-medium rounded-sm hover:bg-[#162d5a] disabled:opacity-50 transition-colors"
        >
          {loading ? "Creating issue…" : "Start New Issue"}
        </button>
        <button
          onClick={onTestMode}
          disabled={loading}
          className="px-5 py-3 border border-[#c8bfad] text-[#5a4f3f] text-[13px] font-medium rounded-sm hover:bg-[#f5f3ef] disabled:opacity-50 transition-colors"
          title="Skip stages 1–5 with mock data and jump directly to Charts for testing"
        >
          Dev: Skip to Charts →
        </button>
      </div>
    </div>
  );
}

// ─── Stage panel router ───────────────────────────────────────────────────────

interface StagePanelProps {
  stage: AnyStage;
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
  onRun: (stage: AnyStage, extra?: Record<string, unknown>) => void;
  onApprove: (stage: AnyStage) => void;
  completedStages: AnyStage[];
  allOutputs: Partial<Record<AnyStage, unknown>>;
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

      {stage === "DATA_AUDIT" && <DataAuditPanel {...props} />}
      {stage === "THESIS_SELECTION" && <ThesisPanel {...props} />}
      {stage === "RESEARCH_PLAN" && <ResearchPlanPanel {...props} />}
      {stage === "QUANT_ANALYSIS" && <QuantPanel {...props} />}
      {stage === "DRAFT" && <DraftPanel {...props} />}
      {stage === "CHARTS_AND_ILLUSTRATIONS" && <ChartsPanel {...props} />}
      {stage === "ILLUSTRATIONS" && <IllustrationsPanel {...props} />}
      {stage === "FINAL_ASSEMBLY" && <AssemblyPanel {...props} />}

      {lastResponse?.recommended_next_action && !error && (
        <div className="mt-4 text-[12px] text-[#8a7e6c] border-t border-[#e8e3da] pt-4">
          Next: {lastResponse.recommended_next_action}
        </div>
      )}
    </div>
  );
}

// ─── Download helpers ─────────────────────────────────────────────────────────

function downloadWord(filename: string, html: string) {
  const blob = new Blob(
    [`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${filename}</title><style>body{font-family:Garamond,serif;font-size:12pt;line-height:1.6;margin:2cm}h1{font-size:22pt}h2{font-size:16pt}p{margin-bottom:0.8em}</style></head><body>${html}</body></html>`],
    { type: "application/msword" }
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.doc`;
  a.click();
}

function downloadPDF(printHtml: string, filename: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title><style>
    body{font-family:Garamond,serif;font-size:12pt;line-height:1.6;margin:2cm;color:#1a1208}
    h1{font-size:22pt;font-family:Georgia,serif;margin-bottom:0.3em}
    h2{font-size:14pt;margin-top:1.5em;margin-bottom:0.3em;border-bottom:1px solid #ccc;padding-bottom:0.2em}
    p{margin-bottom:0.8em}
    .meta{font-size:9pt;color:#888;text-transform:uppercase;letter-spacing:0.1em}
    @media print{body{margin:1.5cm}}
  </style></head><body>${printHtml}<script>window.onload=function(){window.print()}<\/script></body></html>`);
  win.document.close();
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
  stage: AnyStage;
  hasOutput: boolean;
  loading: boolean;
  onRun: (stage: AnyStage, extra?: Record<string, unknown>) => void;
  onApprove: (stage: AnyStage) => void;
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

function DataAuditPanel({ output: _output, loading, onRun, onApprove, stage }: StagePanelProps) {
  const output = _output as DataAuditOutput | undefined;
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

function ThesisPanel({ output: _output, loading, onRun, onApprove, stage, selectedThesis, setSelectedThesis }: StagePanelProps) {
  const output = _output as ThesisSelectionOutput | undefined;
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

function ResearchPlanPanel({ output: _output, loading, onRun, onApprove, stage, enabledJobs, setEnabledJobs }: StagePanelProps) {
  const output = _output as ResearchPlanOutput | undefined;
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

function QuantPanel({ output: _output, loading, onRun, onApprove, stage }: StagePanelProps) {
  const output = _output as QuantAnalysisOutput | undefined;
  const [selectedObjIds, setSelectedObjIds] = React.useState<Set<string>>(new Set());

  const toggleObj = (id: string) => setSelectedObjIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleImprove = () => {
    if (!output) return;
    const selected = output.adversarial.objections
      .filter((o) => selectedObjIds.has(o.id))
      .map((o) => o.description);
    onRun(stage, { incorporate_feedback: selected });
  };

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

          {/* Improve: select objections to address then regenerate */}
          <div className="mt-5 border border-[#e8e3da] rounded-sm p-4 bg-[#faf9f7]">
            <p className="text-[11px] font-semibold text-[#3d3528] uppercase tracking-wide mb-2">
              Incorporate Feedback & Improve
            </p>
            <p className="text-[11px] text-[#8a7e6c] mb-3">Select adversarial objections to address, then regenerate the interpretation with those corrections built in.</p>
            <div className="space-y-1.5 mb-3">
              {output.adversarial.objections.map((o) => (
                <label key={o.id} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedObjIds.has(o.id)}
                    onChange={() => toggleObj(o.id)}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="text-[11px] text-[#3d3528] leading-snug">
                    <span className={`font-semibold ${o.severity === "fatal" ? "text-red-600" : o.severity === "moderate" ? "text-amber-600" : "text-[#8a7e6c]"}`}>[{o.severity}]</span>{" "}
                    {o.description}
                  </span>
                </label>
              ))}
            </div>
            <button
              onClick={handleImprove}
              disabled={loading || selectedObjIds.size === 0}
              className="px-4 py-2 bg-[#5a3e28] text-white text-[12px] font-medium rounded-sm hover:bg-[#6e4d32] disabled:opacity-40 transition-colors"
            >
              {loading ? "Improving…" : `Incorporate ${selectedObjIds.size} Selected & Regenerate`}
            </button>
          </div>
        </div>
      )}
      <ApprovalBar stage={stage} hasOutput={!!output} loading={loading} onRun={onRun} onApprove={onApprove} runLabel="Run Analysis" disabled={output?.fatal_objections.length ? output.fatal_objections.length > 0 : false} />
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

function DraftPanel({ output: _output, loading, onRun, onApprove, stage, draftGroup, setDraftGroup }: StagePanelProps) {
  const output = _output as DraftOutput | undefined;
  const [expandedPages, setExpandedPages] = React.useState<Set<number>>(new Set());
  const togglePage = (page: number) => setExpandedPages((prev) => {
    const next = new Set(prev);
    next.has(page) ? next.delete(page) : next.add(page);
    return next;
  });
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
                {expandedPages.has(s.page) ? s.prose : `${s.prose.slice(0, 400)}${s.prose.length > 400 ? "…" : ""}`}
              </p>
              {s.prose.length > 400 && (
                <button onClick={() => togglePage(s.page)} className="mt-1 text-[11px] text-[#0c1b38] hover:underline">
                  {expandedPages.has(s.page) ? "Show less" : "Show full page ↓"}
                </button>
              )}
            </div>
          ))}
          <p className="text-[12px] text-[#8a7e6c]">
            {output.page_count}/8 pages · {output.total_word_count} words
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 mt-4 flex-wrap">
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
        {output && output.sections.length > 0 && (
          <>
            <button
              onClick={() => {
                const html = output.sections.map((s) => `<h2>Page ${s.page}: ${s.title}</h2><p>${s.prose.replace(/\n/g, "</p><p>")}</p>`).join("");
                downloadWord("CrossAsset-Draft", `<h1>CrossAsset Draft</h1><p class="meta">${output.total_word_count} words · ${output.page_count} pages</p>${html}`);
              }}
              className="px-4 py-2.5 border border-[#e8e3da] text-[#3d3528] text-[13px] font-medium rounded-sm hover:bg-[#f5f3ef] transition-colors"
            >
              ↓ Word
            </button>
            <button
              onClick={() => {
                const html = output.sections.map((s) => `<h2>Page ${s.page}: ${s.title}</h2><p>${s.prose.replace(/\n/g, "</p><p>")}</p>`).join("");
                downloadPDF(`<h1>CrossAsset Draft</h1><p class="meta">${output.total_word_count} words · ${output.page_count} pages</p>${html}`, "CrossAsset Draft");
              }}
              className="px-4 py-2.5 border border-[#e8e3da] text-[#3d3528] text-[13px] font-medium rounded-sm hover:bg-[#f5f3ef] transition-colors"
            >
              ↓ PDF
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Institutional chart component ───────────────────────────────────────────

type ChartPt = { date: string; value: number };
type SeriesData = Record<string, ChartPt[]>;

const SERIES_COLORS = ["#0c1b38", "#b5813c", "#5a7a9a", "#2d5016", "#8a4a2a"];
const SERIES_LABELS: Record<string, string> = {
  DGS2: "2Y Yield", DGS5: "5Y Yield", DGS10: "10Y Yield", DGS30: "30Y Yield",
  T10Y2Y: "2s10s", DFF: "Fed Funds", DFII10: "10Y Real", T10YIE: "10Y BEI",
  CPIAUCSL: "CPI", CPILFESL: "Core CPI", PCEPI: "PCE", PCEPILFE: "Core PCE",
  SP500: "S&P 500", VIXCLS: "VIX", NASDAQCOM: "Nasdaq",
  GDPC1: "Real GDP", UNRATE: "Unemployment", PAYEMS: "Payrolls",
  BAMLH0A0HYM2: "HY OAS", BAMLC0A0CM: "IG OAS",
  DCOILBRENTEU: "Brent", DCOILWTICO: "WTI", DTWEXBGS: "USD Index",
};

function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

function InstitutionalChart({ chartType, seriesIds, title }: { chartType: string; seriesIds: string[]; title: string }) {
  const [data, setData] = useState<SeriesData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const fetchedRef = useRef(false);
  const ids = seriesIds.slice(0, 3);

  useEffect(() => {
    if (fetchedRef.current || ids.length === 0) return;
    fetchedRef.current = true;
    setStatus("loading");
    fetch(`/api/issue/chart-data?series=${ids.join(",")}&limit=252`)
      .then((r) => r.json())
      .then((d: SeriesData) => { setData(d); setStatus("done"); })
      .catch(() => setStatus("error"));
  }, [ids.join(",")]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="h-48 flex flex-col items-center justify-center bg-[#faf9f7] border border-[#eee8df] rounded mt-2">
        <div className="w-4 h-4 border-2 border-[#0c1b38] border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-[10px] text-[#8a7e6c]">Fetching {ids.join(", ")}…</span>
      </div>
    );
  }
  if (status === "error" || !data) {
    return <div className="h-12 flex items-center justify-center text-[10px] text-red-400 mt-2">Chart data unavailable</div>;
  }

  // Align series by date — take dates present in any series
  const allDates = Array.from(new Set(Object.values(data).flat().map((p) => p.date))).sort();
  if (allDates.length === 0) {
    return <div className="h-12 flex items-center justify-center text-[10px] text-[#8a7e6c] mt-2">No data returned for {ids.join(", ")}</div>;
  }

  // Downsample to ~120 points max
  const step = Math.max(1, Math.floor(allDates.length / 120));
  const sampled = allDates.filter((_, i) => i % step === 0 || i === allDates.length - 1);

  const chartData = sampled.map((date) => {
    const pt: Record<string, string | number> = { date };
    for (const id of ids) {
      // Find closest date on or before this date
      const series = data[id] ?? [];
      const match = series.find((p) => p.date <= date) ?? series[series.length - 1];
      if (match) pt[id] = match.value;
    }
    return pt;
  });

  // Check if series are on wildly different scales — if so, normalize each to % change from first value
  const ranges = ids.map((id) => {
    const vals = chartData.map((d) => d[id] as number).filter((v) => v != null && !isNaN(v));
    if (vals.length === 0) return 0;
    return Math.max(...vals) - Math.min(...vals);
  }).filter((r) => r > 0);
  const maxRange = Math.max(...ranges);
  const minRange = Math.min(...ranges);
  const needsNorm = ids.length > 1 && maxRange / Math.max(minRange, 0.001) > 10;

  let displayData = chartData;
  if (needsNorm) {
    const firstVals: Record<string, number> = {};
    for (const id of ids) {
      const first = chartData.find((d) => d[id] != null)?.[id] as number;
      if (first) firstVals[id] = first;
    }
    displayData = chartData.map((d) => {
      const pt: Record<string, string | number> = { date: d.date };
      for (const id of ids) {
        const v = d[id] as number;
        if (v != null && firstVals[id]) pt[id] = parseFloat(((v / firstVals[id] - 1) * 100).toFixed(2));
      }
      return pt;
    });
  }

  const tickFormatter = (date: string) => {
    const d = new Date(date);
    return `${d.toLocaleString("en-US", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;
  };

  const ChartEl = chartType === "bar" ? BarChart : chartType === "area" ? AreaChart : LineChart;
  const yLabel = needsNorm ? "% chg" : undefined;

  return (
    <div className="mt-3 bg-white border border-[#e8e3da] rounded p-3">
      {/* Source line */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        {ids.map((id, i) => (
          <div key={id} className="flex items-center gap-1">
            <div className="w-3 h-0.5" style={{ backgroundColor: SERIES_COLORS[i] }} />
            <span className="text-[9px] text-[#8a7e6c] font-mono">{SERIES_LABELS[id] ?? id}</span>
          </div>
        ))}
        {needsNorm && <span className="text-[9px] text-[#b5813c] ml-auto">Normalized (% change from start)</span>}
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ChartEl data={displayData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {ids.map((id, i) => (
                <linearGradient key={id} id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SERIES_COLORS[i]} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={SERIES_COLORS[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={{ fontSize: 9, fill: "#8a7e6c" }}
              tickLine={false}
              axisLine={{ stroke: "#e8e3da" }}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 9, fill: "#8a7e6c" }}
              tickLine={false}
              axisLine={false}
              width={yLabel ? 42 : 36}
              tickFormatter={(v: number) => fmt(v)}
              label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", fontSize: 8, fill: "#8a7e6c" } : undefined}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, padding: "6px 10px", background: "#fff", border: "1px solid #e8e3da", borderRadius: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
              labelFormatter={(label: string) => new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              formatter={(value: number, name: string) => [fmt(value) + (needsNorm ? "%" : ""), SERIES_LABELS[name] ?? name]}
            />
            {ids.map((id, i) =>
              chartType === "bar" ? (
                <Bar key={id} dataKey={id} fill={SERIES_COLORS[i]} opacity={0.75} radius={[2, 2, 0, 0]} />
              ) : chartType === "area" ? (
                <Area key={id} dataKey={id} stroke={SERIES_COLORS[i]} fill={`url(#grad-${id})`} strokeWidth={1.5} dot={false} connectNulls />
              ) : (
                <Line key={id} dataKey={id} stroke={SERIES_COLORS[i]} strokeWidth={1.5} dot={false} connectNulls activeDot={{ r: 3 }} />
              )
            )}
          </ChartEl>
        </ResponsiveContainer>
      </div>
      <p className="text-[9px] text-[#b0a898] mt-1">Source: FRED / Yahoo Finance · {allDates[0]} – {allDates[allDates.length - 1]}</p>
    </div>
  );
}

// ─── Stage 6: Charts panel ────────────────────────────────────────────────────

function ChartsPanel({ output: _output, loading, onRun, onApprove, stage }: StagePanelProps) {
  const output = _output as ChartsAndIllustrationsOutput | undefined;
  return (
    <div>
      {!output ? (
        <p className="text-[13px] text-[#8a7e6c] mb-4">
          Claude generates chart specifications with conclusion-led titles. Illustration concepts are generated in the next stage.
        </p>
      ) : (
        <div>
          <p className="text-[12px] font-medium text-[#3d3528] mb-3">{output.charts.length} Charts</p>
          <div className="space-y-3 mb-4">
            {output.charts.map((c) => (
              <div key={c.chart_id} className="border border-[#e8e3da] rounded p-3 bg-white">
                <p className="text-[10px] font-mono text-[#8a7e6c]">{c.chart_id} · p{c.page} · {c.chart_type}</p>
                <p className="text-[12px] text-[#1a1208] font-medium mt-0.5">{c.conclusion_title}</p>
                {c.subtitle && <p className="text-[11px] text-[#5a4f3f]">{c.subtitle}</p>}
                <p className="text-[10px] text-[#8a7e6c] mt-1">{c.series.map((s) => s.id).join(", ")}</p>
                <InstitutionalChart chartType={c.chart_type} seriesIds={c.series.map((s) => s.id)} title={c.conclusion_title} />
              </div>
            ))}
          </div>
        </div>
      )}
      <ApprovalBar stage={stage} hasOutput={!!output} loading={loading} onRun={onRun} onApprove={onApprove} runLabel="Generate Chart Specs" />
    </div>
  );
}

// ─── Stage 7: Illustrations panel ────────────────────────────────────────────

function IllustrationsPanel({ output: _output, loading, onRun, onApprove, stage, selectedIllId, setSelectedIllId, allOutputs }: StagePanelProps) {
  const raw = (_output ?? allOutputs["CHARTS_AND_ILLUSTRATIONS"]) as ChartsAndIllustrationsOutput | undefined;
  const concepts = raw?.illustration_concepts ?? [];
  const recommended = raw?.recommended_illustration_id ?? "";
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<Record<string, string>>({});
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  function copyPrompt(id: string, prompt: string) {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function handleImageUpload(id: string, file: File) {
    const url = URL.createObjectURL(file);
    setUploadedImages((prev) => ({ ...prev, [id]: url }));
  }

  return (
    <div>
      {concepts.length === 0 ? (
        <div>
          <p className="text-[13px] text-[#8a7e6c] mb-4">
            Claude generates 3 Economist-style illustration concepts with ChatGPT image prompts. Copy the prompt, generate in ChatGPT, upload the image here, then approve.
          </p>
          <div className="text-[12px] text-[#5a4f3f] border border-[#e8e3da] rounded p-3 bg-[#faf9f7] mb-4 space-y-1">
            <p className="font-medium text-[#1a1208]">Workflow:</p>
            <p>1. Generate concepts below</p>
            <p>2. Copy the ChatGPT prompt for your chosen concept</p>
            <p>3. Paste into ChatGPT (GPT-4o with image generation) or DALL-E</p>
            <p>4. Upload the generated image here</p>
            <p>5. Approve & continue to final proof</p>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-[12px] font-medium text-[#3d3528] mb-1">3 Economist-Style Concepts</p>
          <p className="text-[11px] text-[#8a7e6c] mb-4">Each has a ready-to-paste ChatGPT prompt. Generate the image, upload it below, then approve.</p>
          <div className="space-y-4 mb-4">
            {concepts.map((ill) => {
              const isSelected = selectedIllId === ill.illustration_id;
              const prompt = ill.chatgpt_image_prompt ?? `Editorial illustration in The Economist style, minimalist, 3 colors only (navy blue, ivory white, warm gold accent), clean white background, simple bold linework, dry wit, no text. ${ill.visual_metaphor}. ${ill.illustrator_brief}`;
              return (
                <div
                  key={ill.illustration_id}
                  onClick={() => setSelectedIllId(ill.illustration_id)}
                  className={`border rounded-sm p-4 cursor-pointer transition-all ${
                    isSelected ? "border-[#0c1b38] bg-[#0c1b38]/5" : "border-[#e8e3da] bg-white hover:border-[#c8bfad]"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[12px] font-semibold text-[#1a1208]">{ill.concept_name}</p>
                      {ill.illustration_id === recommended && (
                        <span className="text-[9px] bg-[#0c1b38] text-white px-2 py-0.5 rounded-full mt-0.5 inline-block">Recommended</span>
                      )}
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 ${isSelected ? "border-[#0c1b38] bg-[#0c1b38]" : "border-[#c8bfad]"}`} />
                  </div>

                  <p className="text-[11px] text-[#5a4f3f] italic mb-1">"{ill.visual_metaphor}"</p>
                  {ill.wit_explanation && (
                    <p className="text-[10px] text-[#8a7e6c] mb-2">Why it works: {ill.wit_explanation}</p>
                  )}
                  <p className="text-[10px] text-[#8a7e6c] mb-1">Mechanism: {ill.economic_mechanism}</p>

                  {/* ChatGPT prompt block */}
                  <div className="mt-3 border border-[#e0dbd2] rounded bg-[#faf9f7] p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-semibold text-[#3d3528] uppercase tracking-wide">ChatGPT Image Prompt</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExpandedPrompt(expandedPrompt === ill.illustration_id ? null : ill.illustration_id)}
                          className="text-[10px] text-[#8a7e6c] hover:text-[#3d3528]"
                        >
                          {expandedPrompt === ill.illustration_id ? "Hide" : "Show"}
                        </button>
                        <button
                          onClick={() => copyPrompt(ill.illustration_id, prompt)}
                          className="text-[10px] px-2 py-0.5 bg-[#0c1b38] text-white rounded hover:bg-[#162d5a] transition-colors"
                        >
                          {copiedId === ill.illustration_id ? "Copied!" : "Copy Prompt"}
                        </button>
                      </div>
                    </div>
                    {expandedPrompt === ill.illustration_id && (
                      <p className="text-[10px] text-[#5a4f3f] leading-relaxed font-mono">{prompt}</p>
                    )}
                  </div>

                  {/* Image upload */}
                  <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                    {uploadedImages[ill.illustration_id] ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={uploadedImages[ill.illustration_id]}
                          alt={ill.concept_name}
                          className="w-full max-h-64 object-contain rounded border border-[#e8e3da] bg-white"
                        />
                        <button
                          onClick={() => setUploadedImages((prev) => { const n = {...prev}; delete n[ill.illustration_id]; return n; })}
                          className="absolute top-2 right-2 text-[10px] px-2 py-0.5 bg-white border border-[#e8e3da] rounded text-[#5a4f3f] hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 text-[11px] text-[#8a7e6c] border border-dashed border-[#c8bfad] rounded px-3 py-2 cursor-pointer hover:border-[#0c1b38] hover:text-[#3d3528] transition-colors">
                        <span>Upload image from ChatGPT →</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(ill.illustration_id, f); }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {!selectedIllId && (
            <p className="text-[12px] text-amber-700 mb-2">Select a concept to approve and continue.</p>
          )}
        </div>
      )}
      <ApprovalBar
        stage={stage}
        hasOutput={concepts.length > 0}
        loading={loading}
        onRun={onRun}
        onApprove={onApprove}
        runLabel="Generate Illustration Concepts"
        approveLabel="Approve Illustration & Continue"
        disabled={concepts.length > 0 && !selectedIllId}
      />
    </div>
  );
}

// ─── Stage 7: Final Assembly panel ───────────────────────────────────────────

function AssemblyPanel({ output: _output, loading, onRun, onApprove, stage }: StagePanelProps) {
  const output = _output as IssueManifest | undefined;
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
            <button
              onClick={() => {
                const pages = output.pages ?? [];
                const pagesHtml = pages.map((s) => `<h2>Page ${s.page}: ${s.title}</h2><p>${s.prose?.replace(/\n/g, "</p><p>") ?? ""}</p>`).join("");
                const html = `<h1>${output.title}</h1><p class="meta">${output.thesis}</p><p class="meta">Quality Score: ${output.quality_score}/100 · Cutoff: ${output.cutoff_date}</p><hr/>${pagesHtml}<h2>Web Excerpt</h2><p>${output.web_excerpt ?? ""}</p>`;
                downloadWord(`CrossAsset-${output.issue_id ?? "Issue"}`, html);
              }}
              className="px-4 py-2.5 border border-[#e8e3da] text-[#3d3528] text-[13px] font-medium rounded-sm hover:bg-[#f5f3ef] transition-colors"
            >
              ↓ Word
            </button>
            <button
              onClick={() => {
                const pages = output.pages ?? [];
                const pagesHtml = pages.map((s) => `<h2>Page ${s.page}: ${s.title}</h2><p>${s.prose?.replace(/\n/g, "</p><p>") ?? ""}</p>`).join("");
                const html = `<h1>${output.title}</h1><p class="meta">${output.thesis}</p><p class="meta">Quality Score: ${output.quality_score}/100 · Cutoff: ${output.cutoff_date}</p><hr/>${pagesHtml}<h2>Web Excerpt</h2><p>${output.web_excerpt ?? ""}</p>`;
                downloadPDF(html, output.title ?? "CrossAsset Issue");
              }}
              className="px-4 py-2.5 border border-[#e8e3da] text-[#3d3528] text-[13px] font-medium rounded-sm hover:bg-[#f5f3ef] transition-colors"
            >
              ↓ PDF
            </button>
          </>
        )}
      </div>
    </div>
  );
}
