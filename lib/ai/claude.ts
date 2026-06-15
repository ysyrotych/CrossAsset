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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
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
  return `You are CrossAsset, an institutional macro desk analyst writing a pre-market morning brief for a junior equity research analyst. Generate today's macro desk brief based on the live market data below.

STYLE: Concise, sharp, institutional. Write as if briefing a sell-side desk before market open. Always explain the "so what" and connect every data point to an asset implication. Finance-native language — no disclaimers, no hedging language about data quality.

LIVE MARKET DATA (sourced from Yahoo Finance, US Treasury, FRED):
${JSON.stringify(macroData, null, 2)}

UPCOMING CALENDAR EVENTS:
${calendarCtx}

TODAY'S DATE: ${new Date().toISOString().split("T")[0]}

Return ONLY valid JSON (no markdown, no explanation outside the JSON):

{
  "id": "string",
  "date": "string (today, formatted e.g. June 15, 2026)",
  "title": "string (compelling one-line macro thesis for today)",
  "regimeLabel": "string (e.g. Fed Repricing / Sticky Inflation | Risk-On | Growth Scare | Commodity Shock)",
  "executiveSummary": "string (2-3 sentences: what matters today and why)",
  "frontPage": [
    {
      "headline": "string",
      "whatHappened": "string",
      "whyItMatters": "string",
      "marketImplication": "string",
      "affectedAssets": ["string"]
    }
  ],
  "crossAssetMap": {
    "equities": "string",
    "rates": "string",
    "fx": "string",
    "commodities": "string",
    "credit": "string"
  },
  "sectorTranslation": [
    { "sector": "string", "implication": "string", "tickers": ["string"] }
  ],
  "actionItems": [
    {
      "title": "string",
      "priority": "High | Medium | Low",
      "category": "research | watchlist | calendar | reading | model_update | meeting_prep",
      "dueDate": "string (optional)",
      "relatedEvent": "string (optional)"
    }
  ],
  "sourcesUsed": ["string"],
  "dataQualityNote": "string"
}

frontPage must have exactly 4 stories. sectorTranslation must have 5-6 sectors. actionItems must have 5-7 items.`;
}
