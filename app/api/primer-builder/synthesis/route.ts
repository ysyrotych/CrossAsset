import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const { ticker, companyName, sections, thesis } = await req.json() as {
    ticker: string;
    companyName: string;
    sections: Array<{ id: string; title: string; content: string }>;
    thesis: string;
  };

  const generatedSections = sections.filter(s => s.content?.trim().length > 50);
  if (generatedSections.length === 0) {
    return NextResponse.json({ suggestions: [], inconsistencies: [], overallFeedback: "No sections generated yet." });
  }

  const docText = generatedSections.map(s => `## ${s.title}\n\n${s.content}`).join("\n\n---\n\n");
  const wordCount = docText.split(/\s+/).filter(Boolean).length;

  const prompt = `You are reviewing a completed equity research primer for ${ticker} (${companyName}).

INVESTMENT THESIS:
${thesis || "No specific thesis provided — review from a balanced analytical perspective."}

FULL DOCUMENT (${wordCount} words, ${generatedSections.length} sections):
${docText}

YOUR TASK:
1. Identify the top 4 specific improvement suggestions. Each must be:
   - Actionable in one sentence (e.g., "Add the Net Debt/EBITDA ratio in the Balance Sheet section with a leverage assessment")
   - Specific to this document — not generic advice
   - Focused on the highest-impact gaps

2. Identify any factual inconsistencies between sections (e.g., "Section I says revenue grew 12% but Section V cites 10.4%"). If none found, say so.

3. Write one sharp paragraph (3-4 sentences) overall assessment: what the primer does well, what would make it institutional-grade, and the one change that would have the most impact.

Return ONLY valid JSON in this exact format:
{
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4"],
  "inconsistencies": ["inconsistency 1"] or [],
  "overallFeedback": "paragraph here"
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: "You are a senior equity research editor. Return only valid JSON — no markdown fences, no preamble, no explanation outside the JSON object.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Anthropic error: ${err}` }, { status: 502 });
    }

    const data = await res.json();
    const rawText: string = data.content?.[0]?.text ?? "{}";

    // Strip any markdown fences if model adds them despite instructions
    const cleaned = rawText.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      suggestions: parsed.suggestions ?? [],
      inconsistencies: parsed.inconsistencies ?? [],
      overallFeedback: parsed.overallFeedback ?? "",
    });
  } catch (e) {
    return NextResponse.json({ error: `Parse error: ${e}` }, { status: 500 });
  }
}
