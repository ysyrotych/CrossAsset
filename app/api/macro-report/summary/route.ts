import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Fact = { label: string; value: string };

// Executive summary in URETF voice: headline + macro read + markets read.
export async function POST(req: NextRequest) {
  const { facts } = (await req.json().catch(() => ({}))) as { facts: Fact[] };
  const lines = (facts ?? []).map((f) => `${f.label}: ${f.value}`).join("\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && lines) {
    try {
      const prompt = `You are the lead macro strategist writing the top-of-report executive summary for a weekly U.S. economic update, in the crisp, opinionated URETF house style. Given the latest data, return STRICT JSON: {"headline": "...", "macro": ["b1","b2","b3","b4"], "markets": ["b1","b2","b3"]}. Headline = one punchy sentence naming the current regime/theme. macro = 4 bullets on growth, inflation, labor, and the Fed. markets = 3 bullets on rates, equities/credit, and the bottom line. Each bullet under 22 words, specific, opinionated. No text outside the JSON.

LATEST DATA:
${lines}`;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 700, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(28_000),
      });
      if (r.ok) {
        const j = await r.json();
        const text: string = j?.content?.[0]?.text ?? "";
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (parsed.headline) return NextResponse.json({ ...parsed, source: "claude" });
        }
      }
    } catch { /* fall through */ }
  }

  // fallback
  return NextResponse.json({
    headline: "U.S. economy resilient but late-cycle: sticky inflation, softening labor, cautious Fed.",
    macro: (facts ?? []).slice(0, 4).map((f) => `${f.label} at ${f.value}.`),
    markets: (facts ?? []).slice(4, 7).map((f) => `${f.label} at ${f.value}.`),
    source: "computed",
  });
}
