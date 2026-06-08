import type { MacroIssue, MacroData } from "@/lib/types";

export async function generateMacroIssue(
  macroData: MacroData,
  watchlistTickers: string[],
  calendarContext: string
): Promise<MacroIssue> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const prompt = buildPrompt(macroData, watchlistTickers, calendarContext);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 8096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]) as MacroIssue;
  parsed.id = `issue-${Date.now()}`;
  return parsed;
}

function buildPrompt(macroData: MacroData, tickers: string[], calendarCtx: string): string {
  const dataNote = macroData.isDemo
    ? "Note: macro data below is DEMO/FALLBACK data. Acknowledge this clearly in dataQualityNote."
    : "Note: macro data below is LIVE from FRED API.";

  return `You are CrossAsset, an institutional macro desk analyst writing a pre-market morning brief for a junior equity research analyst. Generate today's macro desk brief using the provided macro data and context.

STYLE: Concise, sharp, institutional. No hype. No vague statements. Always explain the "so what." Always connect macro to asset implications. Finance-native language. Write as if briefing a desk before market open.

${dataNote}

MACRO DATA:
${JSON.stringify(macroData, null, 2)}

WATCHLIST TICKERS: ${tickers.join(", ")}

UPCOMING CALENDAR:
${calendarCtx}

TODAY'S DATE: ${new Date().toISOString().split("T")[0]}

Return ONLY valid JSON matching this exact TypeScript type (no markdown, no explanation outside the JSON):

{
  id: string,
  date: string,
  title: string,
  regimeLabel: string,  // e.g. "Fed Repricing / Sticky Inflation" | "Risk-On" | "Growth Scare" | "Commodity Shock"
  executiveSummary: string,
  frontPage: Array<{
    headline: string,
    whatHappened: string,
    whyItMatters: string,
    marketImplication: string,
    affectedAssets: string[]
  }>,  // 3 items
  crossAssetMap: {
    equities: string,
    rates: string,
    fx: string,
    commodities: string,
    credit: string
  },
  sectorTranslation: Array<{
    sector: string,
    implication: string,
    tickers?: string[]
  }>,  // 5-6 sectors
  watchlistImpact: Array<{
    ticker: string,
    companyName: string,
    impactLevel: "High" | "Medium" | "Low",
    explanation: string,
    suggestedAction: string
  }>,
  talkingPoints: string[],  // exactly 5
  actionItems: Array<{
    title: string,
    priority: "High" | "Medium" | "Low",
    category: string,  // research | watchlist | calendar | reading | model_update | meeting_prep
    dueDate?: string,
    relatedTicker?: string,
    relatedEvent?: string
  }>,  // 5-7 items
  sourcesUsed: string[],
  dataQualityNote: string
}`;
}
