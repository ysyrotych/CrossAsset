// CrossAsset AI Pipeline — master prompt + stage-specific call wrappers.
// Each stage call sends only: master system prompt + compact state + stage-specific data.

import type {
  WorkflowStage,
  SeriesMeta,
  SeriesDiagnostic,
  DataAuditOutput,
  ThesisSelectionOutput,
  ThesisCandidate,
  ResearchPlanOutput,
  AnalysisJob,
  QuantInterpretationOutput,
  AdversarialReviewOutput,
  DraftOutput,
  ChartsAndIllustrationsOutput,
  IssueManifest,
  ClaimRecord,
} from "@/lib/pipeline/types";
import type { JobResult } from "@/lib/pipeline/analysis";

const ANTHROPIC_KEY = () => process.env.ANTHROPIC_API_KEY ?? "";

// ─── Model config ─────────────────────────────────────────────────────────────

const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
} as const;

type ModelKey = keyof typeof MODELS;

// ─── Core Claude caller ───────────────────────────────────────────────────────

async function callClaude(
  model: ModelKey,
  system: string,
  userContent: string,
  maxTokens = 4096
): Promise<string> {
  const key = ANTHROPIC_KEY();
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELS[model],
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return (data.content?.[0]?.text ?? "") as string;
}

function extractJSON<T>(text: string): T {
  // Strip markdown code fences if present
  const stripped = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON found in Claude response. Raw: ${stripped.slice(0, 200)}`);
  try {
    return JSON.parse(match[0]) as T;
  } catch (e) {
    // If truncated, try to salvage by closing open structures
    throw new Error(`Claude returned malformed JSON (response may have been cut off — check max_tokens). Parse error: ${e}. Snippet: ${match[0].slice(-200)}`);
  }
}

// ─── Master system prompt ─────────────────────────────────────────────────────

const MASTER_SYSTEM = `You are CROSSASSET EDITORIAL INTELLIGENCE — an institutional-grade AI research organization producing a luxury biweekly macro-financial publication called CrossAsset.

CrossAsset is 8 pages. One dominant thesis per issue.
Central editorial question: "What is the market pricing, what is reality doing, where is the disagreement, and what would force a repricing?"

OPERATING RULES:
1. Complete only the stage assigned in CURRENT_STAGE. Do not advance further.
2. Return valid JSON matching REQUIRED_OUTPUT_SCHEMA exactly. No markdown outside JSON.
3. Never invent a fact, number, date, source, or model result.
4. Classify claims: OBSERVED | CALCULATED | ESTIMATED | INFERRED | SPECULATIVE.
5. Surface weaknesses before they become errors. State limitations honestly.
6. Set status "awaiting_user" whenever approval is required.
7. Set status "blocked" if evidence is insufficient — state exactly what is missing.
8. Do not treat prior model-generated content as verified evidence.
9. Every thesis must have an explicit falsification condition.
10. Prefer compression and precision over completeness.

INTERNAL ROLES (apply the relevant ones per stage):
- Editor-in-Chief: thesis discipline, page budget, structural decisions
- Macro Strategist: growth, inflation, labor, policy, liquidity, financial conditions
- Rates Strategist: yield curve, real yields, breakevens, term premium, supply
- Equity Strategist: earnings, valuations, breadth, concentration, factor leadership
- Credit Strategist: spreads, defaults, refinancing, lending standards
- FX Strategist: rate differentials, real rates, carry, external balances
- Commodities Strategist: energy / metals / agriculture separately — never as one trade
- Quantitative Researcher: model design, robustness, benchmarks, uncertainty
- Data Engineer: timestamps, units, revisions, lineage, transformations
- Skeptical Reviewer: falsification, omitted variables, reverse causality, look-ahead bias
- Fact-Checker: claim-level verification ledger
- Narrative Editor: finding → evidence → mechanism → implication paragraph structure
- Visualization Editor: conclusion-led chart titles, no decorative charts
- Cartoon Editor: economic mechanism as minimal visual metaphor, brief for human illustrator

WRITING PHILOSOPHY — CrossAsset reads like the best FT Alphaville or Economist leader: authoritative, clean, no noise.

TONE: Professional but human. A smart generalist can follow every sentence. A specialist finds nothing imprecise.
RHYTHM: Short paragraphs (3–4 sentences). Vary sentence length. Never three long sentences in a row.
STRUCTURE: Every paragraph has one idea. Lead with the conclusion. Follow with evidence. Close with the implication.
TRANSITIONS: Each paragraph must connect to the next. Use a single bridging clause — not a heading — to move the argument forward.
VOCABULARY: Precise financial terms are fine. Define the first use of any acronym. No Latin, no corporate speak, no "robust framework".
VOICE: Active. "The Fed held rates" not "rates were held by the Fed". "Credit spreads widened" not "there was a widening in credit spreads".

FORBIDDEN PHRASES (never write these):
"markets remain uncertain" / "investors are closely watching" / "time will tell" / "there are many moving parts" / "the outlook is mixed" / "this could create volatility" / "it is important to note" / "going forward" / "in today's complex environment" / "a confluence of factors" / "headwinds and tailwinds" / "robust" / "granular" / "paradigm shift" / "transformative" / "key takeaway"

EVERY FORECAST must include: probability + horizon + invalidation condition. (Good: "There is a 55% probability Brent recovers above $90 within 60 days if Iranian export volumes disappoint — a print below 300k b/d above baseline for three consecutive weeks would confirm this.")
CHART TITLES: state the finding, never the variable. Bad: "10Y Treasury Yield". Good: "Real yields are doing more tightening than the policy rate."
NUMBERS: always include units, always compare to a benchmark or historical reference.

PUBLICATION STANDARD:
- Quality score ≥ 85/100 required to publish
- No material claim may be unsupported
- No chart may use unidentified data
- The thesis must have an explicit invalidation condition`;

// ─── Stage 1: Data Audit ──────────────────────────────────────────────────────

export async function runDataAuditStage(
  metas: SeriesMeta[],
  diagnostics: SeriesDiagnostic[],
  newsHeadlineCount: number
): Promise<DataAuditOutput> {
  const userContent = `CURRENT_STAGE: DATA_AUDIT

Today's date: ${new Date().toISOString().split("T")[0]}

DATA CATALOG (${metas.length} series):
${JSON.stringify(metas, null, 2)}

ANOMALIES DETECTED (z-score > 1.5 over trailing 252 days):
${JSON.stringify(diagnostics.filter((d) => d.is_anomaly), null, 2)}

NEWS API: ${newsHeadlineCount} headlines available.

REQUIRED_OUTPUT_SCHEMA:
{
  "coverage": [{"series_id":"string","label":"string","last_date":"string","last_value":number|null,"days_stale":number,"status":"fresh|stale|missing"}],
  "asset_class_coverage": {"rates":"full|partial|gap","inflation":"full|partial|gap","equities":"full|partial|gap","growth":"full|partial|gap","labor":"full|partial|gap","credit":"full|partial|gap","commodities":"full|partial|gap","fx":"full|partial|gap"},
  "missing_series": ["string"],
  "data_quality_issues": ["string"],
  "usable_universe": ["string"],
  "readiness": "pass|pass_with_gaps|blocked",
  "blocking_gaps": ["string"]
}

Return valid JSON only. No markdown.`;

  const text = await callClaude("haiku", MASTER_SYSTEM, userContent, 4096);
  return extractJSON<DataAuditOutput>(text);
}

// ─── Stage 2: Thesis Selection ────────────────────────────────────────────────

export async function runThesisSelectionStage(
  diagnostics: SeriesDiagnostic[],
  headlines: string[],
  auditOutput: DataAuditOutput
): Promise<ThesisSelectionOutput> {
  const anomalies = diagnostics.filter((d) => d.is_anomaly);

  const userContent = `CURRENT_STAGE: THESIS_SELECTION

Today's date: ${new Date().toISOString().split("T")[0]}

MACRO DIAGNOSTIC — SERIES ANOMALIES (|z| > 1.5, past 14-day moves):
${JSON.stringify(anomalies, null, 2)}

ALL SERIES DIAGNOSTICS (2-week changes and z-scores):
${JSON.stringify(diagnostics.map((d) => ({
  id: d.series_id,
  label: d.label,
  asset_class: d.asset_class,
  current: d.current_value,
  change_2w: d.change_2w,
  pct_change_2w: d.pct_change_2w?.toFixed(2),
  z_score: d.z_score?.toFixed(2),
  direction: d.direction,
})), null, 2)}

NEWS HEADLINES (${headlines.length} total — top 20):
${headlines.slice(0, 20).map((h, i) => `${i + 1}. ${h}`).join("\n")}

USABLE DATA UNIVERSE: ${auditOutput.usable_universe.join(", ")}

REQUIRED_OUTPUT_SCHEMA:
{
  "candidates": [
    {
      "thesis_id": "TH-001",
      "title": "string (compelling headline)",
      "one_sentence": "string (one tight sentence stating the thesis)",
      "conventional_view": "string (what most market commentary says)",
      "differentiated_view": "string (CrossAsset's more precise mechanism)",
      "evidence_available": ["string"],
      "evidence_needed": ["string"],
      "cross_asset_transmission": "string (how the thesis moves across rates/equities/credit/fx/commodities)",
      "falsification_condition": "string (what data would disprove this)",
      "scores": {
        "importance": 0,
        "timeliness": 0,
        "originality": 0,
        "testability": 0,
        "evidence_quality": 0,
        "cross_asset_relevance": 0,
        "visual_potential": 0,
        "reader_interest": 0,
        "falsifiability": 0,
        "page_fit": 0
      },
      "total_score": 0
    }
  ],
  "recommended_id": "TH-00X",
  "recommendation_rationale": "string"
}

Generate exactly 5 materially different thesis candidates grounded in the data above.
Score each 0–10 on each dimension. Total score = sum of all dimensions (max 100).
Return valid JSON only. No markdown.`;

  const text = await callClaude("sonnet", MASTER_SYSTEM, userContent, 8192);
  return extractJSON<ThesisSelectionOutput>(text);
}

// ─── Stage 3: Research Plan ───────────────────────────────────────────────────

export async function runResearchPlanStage(
  approvedThesis: ThesisCandidate,
  usableUniverse: string[]
): Promise<ResearchPlanOutput> {
  const userContent = `CURRENT_STAGE: RESEARCH_PLAN

APPROVED THESIS:
${JSON.stringify(approvedThesis, null, 2)}

AVAILABLE FRED SERIES: ${usableUniverse.join(", ")}

Design a research plan executable by deterministic TypeScript code. Specify only calculations that can be done with the available series.

REQUIRED_OUTPUT_SCHEMA:
{
  "hypothesis": "string",
  "alternative_hypotheses": ["string"],
  "analysis_jobs": [
    {
      "job_id": "JOB-001",
      "series": ["FRED_SERIES_ID"],
      "date_range": ["YYYY-MM-DD", "YYYY-MM-DD"],
      "frequency": "daily|monthly|quarterly",
      "transformation": "string (e.g. rolling_zscore_252d, yoy_pct_change, level_change)",
      "method": "rolling_correlation|yoy_change|zscore_level|decomposition",
      "purpose": "string",
      "expected_chart": "string",
      "enabled": true
    }
  ],
  "proposed_charts": [
    {
      "chart_id": "CH-001",
      "type": "line|bar|scatter|area",
      "question": "string",
      "series": ["FRED_SERIES_ID"],
      "conclusion_hint": "string (what this chart should show)"
    }
  ],
  "page_allocation": {
    "page_1": "string",
    "page_2": "string",
    "page_3_4": "string",
    "page_5": "string",
    "page_6": "string",
    "page_7": "string",
    "page_8": "string"
  },
  "stop_conditions": ["string"]
}

Use only the FRED series IDs listed in AVAILABLE FRED SERIES. Max 8 analysis jobs. Return valid JSON only.`;

  const text = await callClaude("sonnet", MASTER_SYSTEM, userContent, 6000);
  return extractJSON<ResearchPlanOutput>(text);
}

// ─── Stage 4A: Quant Interpretation ──────────────────────────────────────────

export async function runQuantInterpretationStage(
  approvedThesis: ThesisCandidate,
  jobResults: JobResult[],
  enabledJobs: AnalysisJob[],
  incorporateFeedback?: string[]
): Promise<QuantInterpretationOutput> {
  const feedbackBlock = incorporateFeedback?.length
    ? `\nINSTRUCTOR FEEDBACK TO INCORPORATE:\n${incorporateFeedback.map((f, i) => `${i + 1}. ${f}`).join("\n")}\nAddress each point above explicitly in your findings.\n`
    : "";
  const userContent = `CURRENT_STAGE: QUANT_INTERPRETATION${feedbackBlock}

APPROVED THESIS: ${approvedThesis.one_sentence}
FALSIFICATION CONDITION: ${approvedThesis.falsification_condition}

VERIFIED ANALYSIS RESULTS (computed by deterministic TypeScript — not estimated):
${JSON.stringify(jobResults, null, 2)}

JOB PURPOSES:
${enabledJobs.map((j) => `${j.job_id}: ${j.purpose}`).join("\n")}

REQUIRED_OUTPUT_SCHEMA:
{
  "findings": [
    {
      "finding_id": "FND-001",
      "job_id": "JOB-001",
      "description": "1 sentence max",
      "primary_result": "1 number or short phrase",
      "economic_meaning": "1 sentence max",
      "statistical_significance": "high|moderate|low|na",
      "economic_significance": "high|moderate|low",
      "supports_thesis": "yes|partially|no|unclear",
      "claim_classification": "OBSERVED|CALCULATED|ESTIMATED|INFERRED",
      "chart_recommendation": "chart type and series only, no prose",
      "limitation": "1 sentence max"
    }
  ],
  "thesis_confidence": 0,
  "key_evidence": ["3 items max, each under 15 words"],
  "primary_charts": ["chart IDs only"],
  "overall_assessment": "2 sentences max"
}

BREVITY RULES: Every string field max 25 words. Max 6 findings. Return valid JSON only. Do not invent statistics.`;

  const text = await callClaude("sonnet", MASTER_SYSTEM, userContent, 8192);
  return extractJSON<QuantInterpretationOutput>(text);
}

// ─── Stage 4B: Adversarial Validation (separate call, no access to 4A conclusions) ──

export async function runAdversarialStage(
  approvedThesis: ThesisCandidate,
  jobResults: JobResult[]
): Promise<AdversarialReviewOutput> {
  // Note: This call does NOT receive the interpretation from 4A — only the raw results and thesis.
  const userContent = `CURRENT_STAGE: ADVERSARIAL_VALIDATION

You are a skeptical independent reviewer. Your objective is NOT to improve the thesis below. Your objective is to attempt to falsify it.

THESIS UNDER REVIEW: ${approvedThesis.one_sentence}
CONVENTIONAL VIEW: ${approvedThesis.conventional_view}

RAW ANALYSIS RESULTS:
${JSON.stringify(jobResults, null, 2)}

Attempt to falsify by checking:
- Alternative explanations not considered
- Omitted variables that could explain the relationship
- Reverse causality
- Cherry-picked date ranges
- Small sample dependence
- Data revision risk
- Inconsistent signals across markets
- Difference between statistical and economic significance

REQUIRED_OUTPUT_SCHEMA:
{
  "objections": [
    {
      "id": "OBJ-001",
      "description": "string",
      "severity": "fatal|moderate|minor"
    }
  ],
  "tests_performed": ["string"],
  "findings_that_survive": ["string"],
  "findings_that_fail": ["string"],
  "revised_confidence": 0,
  "recommendation": "publish|revise_thesis|needs_more_data|reject",
  "summary": "string"
}

BREVITY RULES: Max 5 objections. Every string field max 20 words. Return valid JSON only.`;

  const text = await callClaude("sonnet", MASTER_SYSTEM, userContent, 8192);
  return extractJSON<AdversarialReviewOutput>(text);
}

// ─── Stage 5: Drafting ────────────────────────────────────────────────────────

export async function runDraftStage(
  approvedThesis: ThesisCandidate,
  findings: QuantInterpretationOutput,
  claimLedger: ClaimRecord[],
  pageGroup: "pages_1_2" | "pages_3_4" | "pages_5_6" | "pages_7_8"
): Promise<DraftOutput> {
  const pageInstructions: Record<string, string> = {
    pages_1_2: "Page 1: Cover + Executive Thesis (title, one-sentence thesis, 3 conclusions, regime label). Page 2: Macro Regime (growth/inflation/labor/policy/liquidity/financial conditions — what changed in 2 weeks).",
    pages_3_4: "Pages 3-4: The Big Research Idea — conventional view → CrossAsset hypothesis → quantitative evidence → cross-asset transmission → invalidation condition. This is the intellectual center. 4-6 charts referenced.",
    pages_5_6: "Page 5: Market Pricing vs Reality table (variable / current data / market pricing / CrossAsset estimate / gap) + cross-asset consequence matrix. Page 6: Cross-Asset Command Center (rates / equities / credit / FX / commodities — one chart and one conclusion each).",
    pages_7_8: "Page 7: Model Lab (one transparent model, current output, limitations) + Scenario table (4 scenarios with probabilities). Page 8: One signature chart + Watchlist (3 indicators, 2 catalysts, 1 thesis risk, 1 next-issue question).",
  };

  const userContent = `CURRENT_STAGE: DRAFT_${pageGroup.toUpperCase()}

APPROVED THESIS: ${approvedThesis.one_sentence}
FALSIFICATION CONDITION: ${approvedThesis.falsification_condition}

KEY FINDINGS (verified):
${findings.key_evidence.map((e, i) => `${i + 1}. ${e}`).join("\n")}

OVERALL ASSESSMENT: ${findings.overall_assessment}

VERIFIED CLAIM LEDGER (use these claim_ids when citing facts):
${claimLedger.slice(0, 20).map((c) => `[${c.claim_id}] ${c.text} (${c.classification})`).join("\n")}

PAGE INSTRUCTIONS: ${pageInstructions[pageGroup]}

WRITING RULES FOR THIS DRAFT:
- Lead every paragraph with the conclusion. Then the evidence. Then the mechanism. Then the implication.
- Short paragraphs — 3 to 4 sentences. One idea per paragraph. Bridge each to the next without a subheading.
- Active voice throughout. No passive constructions.
- Every number needs a unit and a reference point ("4.43%, up 18bp in two weeks, now +1.8 standard deviations above its 12-month mean").
- No forbidden phrases (see master system). No hedges that don't add probability information.
- Write for someone who reads the FT but may not be a macro specialist: define terms once, then use them freely.
- Reference charts as [CHART: CH-001] inline where data supports a claim. Never decorate — only place a chart reference where it genuinely adds precision.
- Target prose density: every sentence either advances the argument or it should not exist.

REQUIRED_OUTPUT_SCHEMA:
{
  "sections": [
    {
      "page": 1,
      "section_id": "string",
      "title": "string",
      "prose": "string (full reader-facing text for this page)",
      "word_count": 0,
      "claim_ids": ["string"],
      "chart_refs": ["string"]
    }
  ],
  "total_word_count": 0,
  "page_count": 0
}

Return valid JSON only. No markdown outside JSON.`;

  const text = await callClaude("sonnet", MASTER_SYSTEM, userContent, 6000);
  return extractJSON<DraftOutput>(text);
}

// ─── Stage 6A: Chart specs only (separate call to stay under token limit) ──────

export async function runChartSpecsStage(
  approvedThesis: ThesisCandidate,
  researchPlan: ResearchPlanOutput,
  findings: QuantInterpretationOutput
): Promise<ChartsAndIllustrationsOutput["charts"]> {
  const userContent = `CURRENT_STAGE: CHART_SPECS

THESIS: ${approvedThesis.one_sentence}

PROPOSED CHARTS: ${researchPlan.proposed_charts.map((c) => `${c.chart_id}: ${c.question}`).join("; ")}
PRIORITY CHARTS FROM ANALYSIS: ${findings.primary_charts.join(", ")}

FRED SERIES AVAILABLE: DGS2,DGS5,DGS10,DGS30,T10Y2Y,DFF,DFII10,T10YIE,CPIAUCSL,CPILFESL,PCEPI,PCEPILFE,SP500,VIXCLS,NASDAQCOM,GDPC1,UNRATE,PAYEMS,BAMLH0A0HYM2,BAMLC0A0CM,DCOILWTICO,DCOILBRENTEU,DTWEXBGS

OUTPUT: A JSON array of chart objects (NOT wrapped in an object):
[
  {
    "chart_id": "CH-001",
    "page": 1,
    "conclusion_title": "MUST state the finding not the variable name",
    "chart_type": "line|bar|scatter|area",
    "series": [{"id":"FRED_ID","label":"short label","color":"#hex"}],
    "y_axis": "unit",
    "annotation": "under 8 words or null",
    "source_footer": "FRED"
  }
]

RULES: Max 6 charts. Every string under 15 words. Return the array only — no wrapper object.`;

  const text = await callClaude("haiku", MASTER_SYSTEM, userContent, 4096);
  // Response is a bare array
  const stripped = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`No chart array in response: ${stripped.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

// ─── Stage 6B: Illustration concepts only (separate call) ────────────────────

export async function runIllustrationStage(
  approvedThesis: ThesisCandidate
): Promise<{ concepts: ChartsAndIllustrationsOutput["illustration_concepts"]; recommended_id: string }> {
  const userContent = `CURRENT_STAGE: ILLUSTRATION_CONCEPTS

THESIS: ${approvedThesis.one_sentence}
CONVENTIONAL VIEW: ${approvedThesis.conventional_view}
MECHANISM: ${approvedThesis.differentiated_view}

Generate 3 illustration concepts. TARGET STYLE: The Economist magazine cover illustrations.
Characteristics: dry wit, minimal linework, one clever visual metaphor that makes a reader smile AND think.
Think Economist covers — a central character or object in an absurd-but-precise situation that encodes the macro thesis.
Must be: instantly readable, funny-smart (not corny), something people would share on LinkedIn/Twitter.
Technically: 2-3 colors max (navy + ivory + one accent), no text in image, clean white/ivory background, simple geometry.
Each concept must encode a DIFFERENT visual metaphor for the same thesis.

OUTPUT: A JSON array of exactly 3 illustration objects:
[
  {
    "illustration_id": "ILL-001",
    "concept_name": "short punchy name",
    "economic_mechanism": "one sentence — the exact economic dynamic being visualized",
    "visual_metaphor": "one sentence — the clever central image/scene (make it witty)",
    "wit_explanation": "one sentence — why this image is funny/smart, what the joke is",
    "key_objects": ["object 1", "object 2", "object 3"],
    "prohibited_elements": ["no literal dollar signs", "no stock tickers", "no bar charts inside the illustration"],
    "illustrator_brief": "3 sentences describing exactly what to draw and the composition. Reference the Economist aesthetic explicitly.",
    "chatgpt_image_prompt": "A detailed DALL-E / GPT-4o image generation prompt. Start with: 'Editorial illustration in The Economist style, minimalist, 3 colors only (navy blue, ivory white, warm gold accent), clean white background, simple bold linework, dry wit, no text...' then describe the exact scene.",
    "placement": "cover",
    "aspect_ratio": "1:1"
  }
]

Return the array only. No wrapper object.`;

  const text = await callClaude("sonnet", MASTER_SYSTEM, userContent, 4096);
  const stripped = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`No illustration array in response: ${stripped.slice(0, 200)}`);
  const concepts = JSON.parse(match[0]);
  return { concepts, recommended_id: concepts[0]?.illustration_id ?? "ILL-001" };
}

// ─── Stage 6: Combined (used by route for backwards compat) ──────────────────

export async function runChartsStage(
  approvedThesis: ThesisCandidate,
  researchPlan: ResearchPlanOutput,
  findings: QuantInterpretationOutput
): Promise<ChartsAndIllustrationsOutput> {
  const [charts, { concepts, recommended_id }] = await Promise.all([
    runChartSpecsStage(approvedThesis, researchPlan, findings),
    runIllustrationStage(approvedThesis),
  ]);
  return { charts, illustration_concepts: concepts, recommended_illustration_id: recommended_id };
}

// ─── Stage 7: Fact-Check + Assembly ──────────────────────────────────────────

export async function runFactCheckStage(
  drafts: DraftOutput,
  claimLedger: ClaimRecord[],
  jobResults: JobResult[]
): Promise<{ verified_claims: ClaimRecord[]; blocking_issues: string[] }> {
  // Compress inputs to stay well under 8192 output token limit
  const compressedClaims = claimLedger.slice(0, 20).map((c) => ({
    id: c.claim_id,
    text: c.text.slice(0, 60),
    status: c.status,
    result: String(c.result ?? "").slice(0, 40),
  }));
  const compressedJobs = jobResults.slice(0, 10).map((j) => ({
    id: j.job_id,
    stat: j.key_stat?.slice(0, 60),
    ok: !j.error,
  }));

  const hasClaims = compressedClaims.length > 0;

  const userContent = `CURRENT_STAGE: FACT_CHECK

THREE-PASS VERIFICATION (editorial quality gate, not a blocking compliance check):
Pass 1 — Data Auditor: verify any numerical values, dates, units mentioned in prose
Pass 2 — Analytical Reviewer: check internal consistency of quantitative claims
Pass 3 — Editorial Fact-Checker: check prose narrative cohesion and claim clarity

IMPORTANT: If the claim ledger is empty, generate VERIFIED_WITH_CAVEAT records from the draft prose
itself, classifying each quantitative assertion found in the prose. Do NOT block the stage —
produce the best possible verification given available inputs.

DRAFT SECTIONS:
${drafts.sections.map((s) => `[p${s.page}] ${s.title}: ${s.prose.slice(0, 200)}`).join("\n\n")}

CLAIM LEDGER (${claimLedger.length} claims):
${hasClaims ? JSON.stringify(compressedClaims) : "EMPTY — extract claims from draft prose above"}

ANALYSIS GROUND TRUTH:
${compressedJobs.length > 0 ? JSON.stringify(compressedJobs) : "EMPTY — treat draft assertions as INFERRED"}

REQUIRED_OUTPUT_SCHEMA:
{
  "verified_claims": [
    {
      "claim_id": "string",
      "text": "string",
      "classification": "OBSERVED|CALCULATED|ESTIMATED|INFERRED|SPECULATIVE",
      "status": "VERIFIED|VERIFIED_WITH_CAVEAT|CALCULATION_CONFIRMED|UNSUPPORTED|CONFLICTING_SOURCES|STALE_DATA|NEEDS_USER_REVIEW",
      "inputs": ["string"],
      "formula": "string",
      "result": "string",
      "caveat": "string",
      "source": "string",
      "source_date": "string"
    }
  ],
  "blocking_issues": ["string (any UNSUPPORTED or CONFLICTING claim that must be resolved before publication)"]
}

Return valid JSON only.`;

  const text = await callClaude("sonnet", MASTER_SYSTEM, userContent, 6000);
  return extractJSON<{ verified_claims: ClaimRecord[]; blocking_issues: string[] }>(text);
}

export async function runAssemblyStage(
  issueId: string,
  approvedThesis: ThesisCandidate,
  drafts: DraftOutput,
  charts: ChartsAndIllustrationsOutput,
  approvedIllustrationId: string,
  claimLedger: ClaimRecord[]
): Promise<IssueManifest> {
  const userContent = `CURRENT_STAGE: FINAL_ASSEMBLY

ISSUE ID: ${issueId}
CUTOFF DATE: ${new Date().toISOString().split("T")[0]}

APPROVED THESIS: ${approvedThesis.one_sentence}
TITLE: ${approvedThesis.title}

SECTIONS (${drafts.sections.length} pages, ${drafts.total_word_count} words total):
${drafts.sections.map((s) => `Page ${s.page}: ${s.title} (${s.word_count}w)`).join("\n")}

CHARTS: ${charts.charts.length} charts approved
ILLUSTRATION: ${approvedIllustrationId}

CLAIM LEDGER STATUS:
${claimLedger.filter((c) => c.status !== "VERIFIED").map((c) => `⚠ [${c.claim_id}] ${c.status}: ${c.text.slice(0, 80)}`).join("\n") || "All claims verified."}

Score the issue 0-100 on:
- thesis_importance: /10
- originality: /10
- quantitative_rigor: /15
- source_quality: /10
- cross_asset_integration: /10
- falsifiability: /10
- writing_quality: /10
- visual_quality: /10
- internal_consistency: /10
- reader_value: /5

REQUIRED_OUTPUT_SCHEMA:
{
  "issue_id": "string",
  "title": "string",
  "thesis": "string",
  "regime_label": "string",
  "cutoff_date": "string",
  "quality_score": 0,
  "quality_breakdown": {"thesis_importance":0,"originality":0,"quantitative_rigor":0,"source_quality":0,"cross_asset_integration":0,"falsifiability":0,"writing_quality":0,"visual_quality":0,"internal_consistency":0,"reader_value":0},
  "web_excerpt": "string (200-word compelling preview for the website)",
  "watchlist": {
    "indicators": ["string","string","string"],
    "catalysts": ["string","string"],
    "risks": ["string"],
    "next_issue_question": "string"
  },
  "ready_to_publish": true,
  "blocking_issues": ["string"]
}

ready_to_publish must be false if quality_score < 85 or any blocking_issues exist.
Return valid JSON only.`;

  const text = await callClaude("haiku", MASTER_SYSTEM, userContent, 4096);
  const manifest = extractJSON<IssueManifest>(text);

  // Attach full content
  manifest.pages = drafts.sections;
  manifest.charts = charts.charts;
  const approvedIll = charts.illustration_concepts.find((c) => c.illustration_id === approvedIllustrationId)
    ?? charts.illustration_concepts[0];
  manifest.approved_illustration = approvedIll;
  manifest.claim_ledger = claimLedger;
  manifest.fact_check_ledger = [];

  return manifest;
}

// ─── Stage routing entry point ────────────────────────────────────────────────

export type StageCallResult = {
  output: unknown;
  stageSummary: string;
  approvalRequired: boolean;
  nextStage: WorkflowStage | null;
};
