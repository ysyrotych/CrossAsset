// ─── Pipeline stage names ────────────────────────────────────────────────────

export type WorkflowStage =
  | "DATA_AUDIT"
  | "THESIS_SELECTION"
  | "RESEARCH_PLAN"
  | "QUANT_ANALYSIS"
  | "DRAFT"
  | "CHARTS_AND_ILLUSTRATIONS"
  | "FINAL_ASSEMBLY";

export type StageStatus = "in_progress" | "awaiting_user" | "blocked" | "published" | "completed";

// ─── Stage 1: Data Audit ──────────────────────────────────────────────────────

export interface SeriesMeta {
  series_id: string;
  label: string;
  last_date: string;
  last_value: number | null;
  days_stale: number;
  status: "fresh" | "stale" | "missing";
}

export interface DataAuditOutput {
  coverage: SeriesMeta[];
  asset_class_coverage: Record<string, "full" | "partial" | "gap">;
  missing_series: string[];
  data_quality_issues: string[];
  usable_universe: string[];
  readiness: "pass" | "pass_with_gaps" | "blocked";
  blocking_gaps: string[];
}

// ─── Stage 2: Thesis Selection ────────────────────────────────────────────────

export interface ThesisCandidate {
  thesis_id: string;
  title: string;
  one_sentence: string;
  conventional_view: string;
  differentiated_view: string;
  evidence_available: string[];
  evidence_needed: string[];
  cross_asset_transmission: string;
  falsification_condition: string;
  scores: {
    importance: number;
    timeliness: number;
    originality: number;
    testability: number;
    evidence_quality: number;
    cross_asset_relevance: number;
    visual_potential: number;
    reader_interest: number;
    falsifiability: number;
    page_fit: number;
  };
  total_score: number;
}

export interface ThesisSelectionOutput {
  candidates: ThesisCandidate[];
  recommended_id: string;
  recommendation_rationale: string;
}

// ─── Stage 3: Research Plan ───────────────────────────────────────────────────

export interface AnalysisJob {
  job_id: string;
  series: string[];
  date_range: [string, string];
  frequency: "daily" | "monthly" | "quarterly";
  transformation: string;
  method: string;
  purpose: string;
  expected_chart: string;
  enabled: boolean;
}

export interface ProposedChart {
  chart_id: string;
  type: string;
  question: string;
  series: string[];
  conclusion_hint: string;
}

export interface ResearchPlanOutput {
  hypothesis: string;
  alternative_hypotheses: string[];
  analysis_jobs: AnalysisJob[];
  proposed_charts: ProposedChart[];
  page_allocation: Record<string, string>;
  stop_conditions: string[];
}

// ─── Stage 4: Quant Analysis ──────────────────────────────────────────────────

export interface QuantFinding {
  finding_id: string;
  job_id: string;
  description: string;
  primary_result: string;
  economic_meaning: string;
  statistical_significance: "high" | "moderate" | "low" | "na";
  economic_significance: "high" | "moderate" | "low";
  supports_thesis: "yes" | "partially" | "no" | "unclear";
  claim_classification: "OBSERVED" | "CALCULATED" | "ESTIMATED" | "INFERRED";
  chart_recommendation: string;
  limitation: string;
}

export interface QuantInterpretationOutput {
  findings: QuantFinding[];
  thesis_confidence: number;
  key_evidence: string[];
  primary_charts: string[];
  overall_assessment: string;
}

export interface AdversarialReviewOutput {
  objections: { id: string; description: string; severity: "fatal" | "moderate" | "minor" }[];
  tests_performed: string[];
  findings_that_survive: string[];
  findings_that_fail: string[];
  revised_confidence: number;
  recommendation: "publish" | "revise_thesis" | "needs_more_data" | "reject";
  summary: string;
}

export interface QuantAnalysisOutput {
  interpretation: QuantInterpretationOutput;
  adversarial: AdversarialReviewOutput;
  claim_ledger: ClaimRecord[];
  merged_confidence: number;
  fatal_objections: string[];
}

// ─── Stage 5: Draft ───────────────────────────────────────────────────────────

export interface SectionDraft {
  page: number;
  section_id: string;
  title: string;
  prose: string;
  word_count: number;
  claim_ids: string[];
  chart_refs: string[];
}

export interface DraftOutput {
  sections: SectionDraft[];
  total_word_count: number;
  page_count: number;
}

// ─── Stage 6: Charts & Illustrations ─────────────────────────────────────────

export interface ChartSeriesSpec {
  id: string;
  label: string;
  transform: string;
  color?: string;
}

export interface ChartSpec {
  chart_id: string;
  page: number;
  conclusion_title: string;
  subtitle?: string;
  chart_type: "line" | "bar" | "scatter" | "area" | "composed" | "heatmap";
  series: ChartSeriesSpec[];
  x_axis: string;
  y_axis: string;
  y_axis_right?: string;
  annotations: string[];
  source_footer: string;
  recharts_config: Record<string, unknown>;
  caveats: string[];
}

export interface IllustrationConcept {
  illustration_id: string;
  concept_name: string;
  economic_mechanism: string;
  visual_metaphor: string;
  composition: string;
  key_objects: string[];
  prohibited_elements: string[];
  illustrator_brief: string;
  placement: "cover" | "page_2" | "page_7" | "page_8" | "sidebar";
  aspect_ratio: string;
}

export interface ChartsAndIllustrationsOutput {
  charts: ChartSpec[];
  illustration_concepts: IllustrationConcept[];
  recommended_illustration_id: string;
}

// ─── Stage 7: Final Assembly ──────────────────────────────────────────────────

export interface VerificationRecord {
  claim_id: string;
  exact_claim: string;
  classification: "OBSERVED" | "CALCULATED" | "ESTIMATED" | "INFERRED" | "SPECULATIVE";
  source: string;
  source_date: string;
  supported_value: string;
  article_value: string;
  status: "VERIFIED" | "VERIFIED_WITH_CAVEAT" | "CALCULATION_CONFIRMED" | "UNSUPPORTED" | "CONFLICTING_SOURCES" | "STALE_DATA" | "NEEDS_USER_REVIEW";
  discrepancy?: string;
  required_action?: string;
}

export interface IssueManifest {
  issue_id: string;
  title: string;
  thesis: string;
  regime_label: string;
  cutoff_date: string;
  pages: SectionDraft[];
  charts: ChartSpec[];
  approved_illustration: IllustrationConcept;
  claim_ledger: ClaimRecord[];
  fact_check_ledger: VerificationRecord[];
  quality_score: number;
  quality_breakdown: Record<string, number>;
  web_excerpt: string;
  watchlist: {
    indicators: string[];
    catalysts: string[];
    risks: string[];
    next_issue_question: string;
  };
  ready_to_publish: boolean;
  blocking_issues: string[];
}

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ClaimRecord {
  claim_id: string;
  text: string;
  classification: "OBSERVED" | "CALCULATED" | "ESTIMATED" | "INFERRED" | "SPECULATIVE";
  status: "VERIFIED" | "UNSUPPORTED" | "CONFLICTING" | "PENDING";
  inputs?: string[];
  formula?: string;
  result?: number | string;
  caveat?: string;
  source?: string;
  source_date?: string;
}

export interface ApprovalRecord {
  stage: WorkflowStage;
  action: "approve" | "approve_with_edits" | "request_alternatives" | "return_to_previous" | "auto_continue";
  timestamp: string;
  user_notes?: string;
  selected_id?: string;
}

// ─── Macro diagnostic ─────────────────────────────────────────────────────────

export interface SeriesDiagnostic {
  series_id: string;
  label: string;
  asset_class: string;
  current_value: number;
  value_2w_ago: number | null;
  change_2w: number | null;
  pct_change_2w: number | null;
  z_score: number | null;
  direction: "up" | "down" | "flat";
  is_anomaly: boolean;
}

// ─── Full project state ───────────────────────────────────────────────────────

export interface CrossAssetProject {
  id: string;
  created_at: string;
  stage: WorkflowStage;
  status: StageStatus;
  cutoff_date: string;

  data_audit?: DataAuditOutput;
  thesis_candidates?: ThesisSelectionOutput;
  approved_thesis?: ThesisCandidate;
  research_plan?: ResearchPlanOutput;
  quant_results?: Record<string, unknown>;
  quant_analysis?: QuantAnalysisOutput;
  claim_ledger?: ClaimRecord[];
  drafts?: DraftOutput;
  chart_specs?: ChartsAndIllustrationsOutput;
  approved_illustration?: IllustrationConcept;
  issue_manifest?: IssueManifest;
  approval_log: ApprovalRecord[];
}

// ─── Stage API envelope ───────────────────────────────────────────────────────

export interface StageResponse {
  issue_id: string;
  stage: WorkflowStage;
  status: StageStatus;
  stage_summary: string;
  output: unknown;
  data_quality_issues: string[];
  methodological_issues: string[];
  open_questions: string[];
  recommended_next_action: string;
  approval_required: boolean;
}
