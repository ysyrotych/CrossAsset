import { NextRequest, NextResponse } from "next/server";
import { loadIssue, patchIssue, recordApproval } from "@/lib/pipeline/supabase";
import { runDataAudit, executeAnalysisJob } from "@/lib/pipeline/analysis";
import {
  runDataAuditStage,
  runThesisSelectionStage,
  runResearchPlanStage,
  runQuantInterpretationStage,
  runAdversarialStage,
  runDraftStage,
  runChartSpecsStage,
  runIllustrationStage,
  runChartsStage,
  runFactCheckStage,
  runAssemblyStage,
} from "@/lib/ai/pipeline";
import { fetchFinancialNews } from "@/lib/sources/newsapi";
import type {
  WorkflowStage,
  ThesisCandidate,
  AnalysisJob,
  ClaimRecord,
  QuantAnalysisOutput,
  DataAuditOutput,
  ResearchPlanOutput,
  ChartsAndIllustrationsOutput,
  DraftOutput,
} from "@/lib/pipeline/types";
import type { JobResult } from "@/lib/pipeline/analysis";

export const dynamic = "force-dynamic";

type StageBody = {
  stage: WorkflowStage | "ILLUSTRATIONS";
  // approval actions
  action?: "approve" | "approve_with_edits" | "request_alternatives" | "return_to_previous" | "auto_continue";
  selected_id?: string;
  user_notes?: string;
  // stage-specific params
  approved_thesis?: ThesisCandidate;
  enabled_jobs?: string[];
  approved_illustration_id?: string;
  page_group?: "pages_1_2" | "pages_3_4" | "pages_5_6" | "pages_7_8";
  incorporate_feedback?: string[];
  // client-supplied prior outputs (fallback when Supabase not configured)
  data_audit?: unknown;
  thesis_candidates?: unknown;
  research_plan?: unknown;
  quant_analysis?: unknown;
  drafts?: unknown;
  chart_specs?: unknown;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as StageBody;
  const { stage } = body;

  // Load existing project state; merge with client-supplied outputs so pipeline
  // works without Supabase configured (client passes all prior outputs in body).
  const saved = await loadIssue(id);
  const existing = {
    id,
    created_at: saved?.created_at ?? new Date().toISOString(),
    stage: (saved?.stage ?? "DATA_AUDIT") as WorkflowStage,
    status: (saved?.status ?? "in_progress") as "in_progress" | "awaiting_user" | "blocked" | "published",
    cutoff_date: saved?.cutoff_date ?? new Date().toISOString().split("T")[0],
    approval_log: saved?.approval_log ?? [],
    // Prefer Supabase values; fall back to what the client sent — cast to proper types here
    data_audit:      (saved?.data_audit      ?? body.data_audit)      as DataAuditOutput | undefined,
    thesis_candidates: (saved?.thesis_candidates ?? body.thesis_candidates) as unknown,
    approved_thesis: (saved?.approved_thesis ?? body.approved_thesis) as ThesisCandidate | undefined,
    research_plan:   (saved?.research_plan   ?? body.research_plan)   as ResearchPlanOutput | undefined,
    quant_analysis:  (saved?.quant_analysis  ?? body.quant_analysis)  as QuantAnalysisOutput | undefined,
    claim_ledger:    saved?.claim_ledger                               as ClaimRecord[] | undefined,
    quant_results:   saved?.quant_results                             as { jobs: JobResult[] } | undefined,
    drafts:          (saved?.drafts          ?? body.drafts)          as DraftOutput | undefined,
    chart_specs:     (saved?.chart_specs     ?? body.chart_specs)     as ChartsAndIllustrationsOutput | undefined,
    issue_manifest:  saved?.issue_manifest,
  };

  try {
    // ── Stage 1: Data Audit ──────────────────────────────────────────────────
    if (stage === "DATA_AUDIT") {
      const [{ metas, diagnostics }, news] = await Promise.all([
        runDataAudit(),
        fetchFinancialNews(),
      ]);

      const auditOutput = await runDataAuditStage(metas, diagnostics, news.length);

      await patchIssue(id, {
        data_audit: auditOutput,
        stage: "DATA_AUDIT",
        status: "awaiting_user",
      });

      return NextResponse.json({
        issue_id: id,
        stage: "DATA_AUDIT",
        status: "awaiting_user",
        stage_summary: `Audited ${metas.length} series. Readiness: ${auditOutput.readiness}.`,
        output: auditOutput,
        approval_required: true,
        recommended_next_action: "Review data coverage and approve to continue to thesis selection.",
      });
    }

    // ── Stage 2: Thesis Selection ────────────────────────────────────────────
    if (stage === "THESIS_SELECTION") {
      const audit = existing.data_audit;
      if (!audit) {
        return NextResponse.json({ error: "Run DATA_AUDIT first" }, { status: 400 });
      }

      const [{ diagnostics }, news] = await Promise.all([
        runDataAudit(),
        fetchFinancialNews(),
      ]);

      const headlines = news.map((n) => `[${n.source}] ${n.title}`);
      const thesisOutput = await runThesisSelectionStage(diagnostics, headlines, audit!);

      await patchIssue(id, {
        thesis_candidates: thesisOutput,
        stage: "THESIS_SELECTION",
        status: "awaiting_user",
      });

      return NextResponse.json({
        issue_id: id,
        stage: "THESIS_SELECTION",
        status: "awaiting_user",
        stage_summary: `Generated ${thesisOutput.candidates.length} thesis candidates. Recommended: ${thesisOutput.recommended_id}.`,
        output: thesisOutput,
        approval_required: true,
        recommended_next_action: `Approve thesis ${thesisOutput.recommended_id} or select an alternative.`,
      });
    }

    // ── Stage 3: Research Plan ───────────────────────────────────────────────
    if (stage === "RESEARCH_PLAN") {
      const approvedThesis = body.approved_thesis ?? existing.approved_thesis;
      if (!approvedThesis) {
        return NextResponse.json({ error: "No approved thesis. Approve a thesis first." }, { status: 400 });
      }
      const audit = existing.data_audit;

      // Save approved thesis
      await patchIssue(id, { approved_thesis: approvedThesis });

      const plan = await runResearchPlanStage(approvedThesis, audit?.usable_universe ?? []);

      await patchIssue(id, {
        research_plan: plan,
        stage: "RESEARCH_PLAN",
        status: "awaiting_user",
      });

      return NextResponse.json({
        issue_id: id,
        stage: "RESEARCH_PLAN",
        status: "awaiting_user",
        stage_summary: `Research plan with ${plan.analysis_jobs.length} analysis jobs and ${plan.proposed_charts.length} charts.`,
        output: plan,
        approval_required: true,
        recommended_next_action: "Toggle analysis jobs on/off, then approve to run calculations.",
      });
    }

    // ── Stage 4: Quant Analysis ──────────────────────────────────────────────
    if (stage === "QUANT_ANALYSIS") {
      const thesis = existing.approved_thesis;
      const plan = existing.research_plan;
      if (!thesis || !plan) {
        return NextResponse.json({ error: "Approve thesis and research plan first." }, { status: 400 });
      }

      // Apply job toggles from user
      const enabledIds = body.enabled_jobs;
      const enabledJobs: AnalysisJob[] = (plan.analysis_jobs as AnalysisJob[]).filter(
        (j) => enabledIds ? enabledIds.includes(j.job_id) : j.enabled !== false
      );

      // Run deterministic calculations — NO LLM for calculations
      const jobResults: JobResult[] = await Promise.all(
        enabledJobs.map((j) =>
          executeAnalysisJob(j.job_id, j.series, j.method, j.transformation, j.date_range)
        )
      );

      // Store raw results
      await patchIssue(id, { quant_results: { jobs: jobResults } });

      // Build a claim ledger from job results
      const claimLedger: ClaimRecord[] = jobResults.map((r, i) => ({
        claim_id: `CLM-${String(i + 1).padStart(3, "0")}`,
        text: r.summary,
        classification: "CALCULATED" as const,
        status: r.error ? "UNSUPPORTED" as const : "VERIFIED" as const,
        inputs: r.series_used,
        result: r.key_stat,
        source: "FRED via deterministic TypeScript",
        source_date: new Date().toISOString().split("T")[0],
      }));

      // Two separate Claude calls — adversarial has NO access to interpretation conclusions
      const [interpretation, adversarial] = await Promise.all([
        runQuantInterpretationStage(thesis, jobResults, enabledJobs, body.incorporate_feedback),
        runAdversarialStage(thesis, jobResults),
      ]);

      const fatalObjections = adversarial.objections
        .filter((o) => o.severity === "fatal")
        .map((o) => o.description);

      const quantOutput: QuantAnalysisOutput = {
        interpretation,
        adversarial,
        claim_ledger: claimLedger,
        merged_confidence: Math.round((interpretation.thesis_confidence + adversarial.revised_confidence) / 2),
        fatal_objections: fatalObjections,
      };

      await patchIssue(id, {
        quant_analysis: quantOutput,
        claim_ledger: claimLedger,
        stage: "QUANT_ANALYSIS",
        status: fatalObjections.length > 0 ? "blocked" : "awaiting_user",
      });

      return NextResponse.json({
        issue_id: id,
        stage: "QUANT_ANALYSIS",
        status: fatalObjections.length > 0 ? "blocked" : "awaiting_user",
        stage_summary: `${jobResults.length} analyses run. Thesis confidence: ${quantOutput.merged_confidence}/100. Fatal objections: ${fatalObjections.length}.`,
        output: quantOutput,
        approval_required: true,
        blocking_issues: fatalObjections,
        recommended_next_action: fatalObjections.length > 0
          ? `Resolve fatal objections before advancing: ${fatalObjections[0]}`
          : "Review findings and adversarial critique, then approve to draft.",
      });
    }

    // ── Stage 5: Draft ───────────────────────────────────────────────────────
    if (stage === "DRAFT") {
      const thesis = existing.approved_thesis;
      const quant = existing.quant_analysis;
      const claims = existing.claim_ledger ?? [];
      if (!thesis || !quant) {
        return NextResponse.json({ error: "Complete quantitative analysis first." }, { status: 400 });
      }

      const pageGroup = body.page_group ?? "pages_1_2";

      const draftOutput = await runDraftStage(thesis, quant.interpretation, claims, pageGroup);

      // Merge with existing drafts
      const existingDrafts = existing.drafts ?? { sections: [], total_word_count: 0, page_count: 0 };
      const mergedSections = [
        ...(existingDrafts.sections ?? []).filter(
          (s) => !draftOutput.sections.some((n) => n.page === s.page)
        ),
        ...draftOutput.sections,
      ].sort((a, b) => a.page - b.page);

      const mergedDraft = {
        sections: mergedSections,
        total_word_count: mergedSections.reduce((a, s) => a + s.word_count, 0),
        page_count: mergedSections.length,
      };

      await patchIssue(id, {
        drafts: mergedDraft,
        stage: "DRAFT",
        status: "awaiting_user",
      });

      return NextResponse.json({
        issue_id: id,
        stage: "DRAFT",
        status: "awaiting_user",
        stage_summary: `Drafted ${pageGroup}. Total: ${mergedDraft.total_word_count} words across ${mergedDraft.page_count} pages.`,
        output: mergedDraft,
        approval_required: true,
        recommended_next_action: mergedDraft.page_count < 8
          ? `Draft next page group. Current: ${mergedDraft.page_count}/8 pages.`
          : "All pages drafted. Proceed to charts and illustrations.",
      });
    }

    // ── Stage 6: Charts & Illustrations ─────────────────────────────────────
    if (stage === "CHARTS_AND_ILLUSTRATIONS") {
      const thesis = existing.approved_thesis;
      const plan = existing.research_plan;
      const quant = existing.quant_analysis;
      if (!thesis || !plan || !quant) {
        return NextResponse.json({ error: "Complete drafting first." }, { status: 400 });
      }

      // Run charts and illustrations as TWO separate calls to stay under token limit
      const charts = await runChartSpecsStage(thesis, plan, quant.interpretation);
      const existing_specs = existing.chart_specs;
      const chartOutput = {
        charts,
        illustration_concepts: existing_specs?.illustration_concepts ?? [],
        recommended_illustration_id: existing_specs?.recommended_illustration_id ?? "",
      };

      await patchIssue(id, {
        chart_specs: chartOutput,
        stage: "CHARTS_AND_ILLUSTRATIONS",
        status: "awaiting_user",
      });

      return NextResponse.json({
        issue_id: id,
        stage: "CHARTS_AND_ILLUSTRATIONS",
        status: "awaiting_user",
        stage_summary: `${charts.length} charts planned.`,
        output: chartOutput,
        approval_required: true,
        recommended_next_action: "Review charts, then generate illustrations in the next step.",
      });
    }

    // ── Stage 6B: Illustrations (separate stage) ─────────────────────────────
    if (stage === "ILLUSTRATIONS") {
      const thesis = existing.approved_thesis;
      if (!thesis) return NextResponse.json({ error: "No approved thesis." }, { status: 400 });

      const { concepts, recommended_id } = await runIllustrationStage(thesis);
      const existingCharts = existing.chart_specs;
      const merged = {
        charts: existingCharts?.charts ?? [],
        illustration_concepts: concepts,
        recommended_illustration_id: recommended_id,
      };

      await patchIssue(id, { chart_specs: merged, stage: "ILLUSTRATIONS" as WorkflowStage, status: "awaiting_user" });

      return NextResponse.json({
        issue_id: id,
        stage: "ILLUSTRATIONS",
        status: "awaiting_user",
        stage_summary: `${concepts.length} illustration concepts generated.`,
        output: merged,
        approval_required: true,
        recommended_next_action: "Select an illustration concept and approve to proceed to final assembly.",
      });
    }

    // ── Stage 7: Final Assembly ──────────────────────────────────────────────
    if (stage === "FINAL_ASSEMBLY") {
      const thesis = existing.approved_thesis;
      const drafts = existing.drafts;
      const charts = existing.chart_specs;
      const claims = existing.claim_ledger ?? [];
      const quantResults = existing.quant_results?.jobs ?? [];

      if (!thesis || !drafts || !charts) {
        return NextResponse.json({ error: "Complete charts and illustrations first." }, { status: 400 });
      }

      const approvedIllId = body.approved_illustration_id ?? charts.recommended_illustration_id;

      // Three-pass fact check
      const { verified_claims, blocking_issues } = await runFactCheckStage(drafts, claims, quantResults);

      // Assembly
      const manifest = await runAssemblyStage(id, thesis, drafts, charts, approvedIllId, verified_claims);

      // Merge blocking issues
      const allBlocking = [...blocking_issues, ...manifest.blocking_issues];
      manifest.blocking_issues = allBlocking;
      manifest.ready_to_publish = allBlocking.length === 0 && manifest.quality_score >= 85;

      await patchIssue(id, {
        issue_manifest: manifest,
        claim_ledger: verified_claims,
        stage: "FINAL_ASSEMBLY",
        status: manifest.ready_to_publish ? "awaiting_user" : "blocked",
      });

      return NextResponse.json({
        issue_id: id,
        stage: "FINAL_ASSEMBLY",
        status: manifest.ready_to_publish ? "awaiting_user" : "blocked",
        stage_summary: `Quality score: ${manifest.quality_score}/100. Ready to publish: ${manifest.ready_to_publish}.`,
        output: manifest,
        approval_required: true,
        blocking_issues: allBlocking,
        recommended_next_action: manifest.ready_to_publish
          ? "Issue is ready. Review the final proof and approve to publish."
          : `Resolve ${allBlocking.length} blocking issue(s) before publishing.`,
      });
    }

    // ── Approval recording ───────────────────────────────────────────────────
    if (body.action) {
      await recordApproval(id, existing.approval_log, {
        stage,
        action: body.action,
        timestamp: new Date().toISOString(),
        user_notes: body.user_notes,
        selected_id: body.selected_id,
      });
      return NextResponse.json({ ok: true, recorded: body.action });
    }

    return NextResponse.json({ error: `Unknown stage: ${stage}` }, { status: 400 });
  } catch (e) {
    console.error(`Pipeline error at stage ${stage}:`, e);
    return NextResponse.json(
      { error: String(e), stage },
      { status: 500 }
    );
  }
}
