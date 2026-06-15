import type { MacroIssue, MacroData } from "@/lib/types";
import type { NewsItem } from "@/lib/sources/newsapi";
import type { EconEvent, EarningsEvent } from "@/lib/sources/finnhub";
import type { BeaPoint } from "@/lib/sources/bea";
import type { BlsData } from "@/lib/sources/bls";

export type BriefContext = {
  news?: NewsItem[];
  econCalendar?: EconEvent[];
  earningsCalendar?: EarningsEvent[];
  bea?: { gdp: BeaPoint[]; income: BeaPoint[] };
  bls?: BlsData;
};

export async function generateMacroIssue(
  macroData: MacroData,
  ctx: BriefContext = {}
): Promise<MacroIssue> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const prompt = buildPrompt(macroData, ctx);

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

function buildPrompt(macroData: MacroData, ctx: BriefContext): string {
  // ── News section ──────────────────────────────────────────────────────────
  const newsSection = ctx.news?.length
    ? `\n## TODAY'S NEWS HEADLINES (live · NewsAPI)\n${ctx.news
        .slice(0, 20)
        .map(
          (n, i) =>
            `${i + 1}. [${n.source}] ${n.title}${n.description ? ` — ${n.description}` : ""}`
        )
        .join("\n")}`
    : "";

  // ── Economic calendar ─────────────────────────────────────────────────────
  const econSection = ctx.econCalendar?.length
    ? `\n## US ECONOMIC CALENDAR — NEXT 8 DAYS (Finnhub)\n${ctx.econCalendar
        .map(
          (e) =>
            `- ${e.date}: ${e.event} | Impact: ${e.impact}${e.estimate ? ` | Est: ${e.estimate}` : ""}${e.previous ? ` | Prev: ${e.previous}` : ""}${e.actual ? ` | Actual: ${e.actual}` : ""}`
        )
        .join("\n")}`
    : "";

  // ── Earnings calendar ─────────────────────────────────────────────────────
  const earningsSection = ctx.earningsCalendar?.length
    ? `\n## EARNINGS CALENDAR — NEXT 8 DAYS (Finnhub)\n${ctx.earningsCalendar
        .slice(0, 20)
        .map(
          (e) =>
            `- ${e.date}: ${e.symbol}${e.epsEstimate != null ? ` | EPS est: $${e.epsEstimate.toFixed(2)}` : ""}${e.revenueEstimate != null ? ` | Rev est: $${(e.revenueEstimate / 1e9).toFixed(1)}B` : ""}`
        )
        .join("\n")}`
    : "";

  // ── BEA section ───────────────────────────────────────────────────────────
  const beaSection =
    ctx.bea?.gdp.length || ctx.bea?.income.length
      ? `\n## BEA GDP COMPONENTS (official · bea.gov)\n${[
          ...(ctx.bea.gdp ?? []),
          ...(ctx.bea.income ?? []),
        ]
          .slice(0, 15)
          .map((d) => `- ${d.lineDesc}: ${d.value > 0 ? "+" : ""}${d.value} (${d.period})`)
          .join("\n")}`
      : "";

  // ── BLS section ───────────────────────────────────────────────────────────
  const blsLines: string[] = [];
  if (ctx.bls) {
    const labels: Record<string, string> = {
      CPI_ALL:             "CPI (all items)",
      CPI_CORE:            "Core CPI (ex food & energy)",
      CPI_SERVICES:        "CPI Services",
      CPI_SHELTER:         "CPI Shelter",
      CPI_ENERGY:          "CPI Energy",
      PPI_ALL:             "PPI (all commodities)",
      UNRATE:              "Unemployment rate",
      NONFARM:             "Nonfarm payrolls (000s)",
      AVG_HOURLY_EARNINGS: "Avg hourly earnings",
    };
    for (const [key, pts] of Object.entries(ctx.bls)) {
      if (!pts?.length) continue;
      const latest = pts[0];
      const label  = labels[key] ?? key;
      const chg    = latest.pctChange != null ? ` | YoY: ${latest.pctChange > 0 ? "+" : ""}${latest.pctChange.toFixed(1)}%` : "";
      blsLines.push(`- ${label}: ${latest.value} (${latest.periodName} ${latest.year})${chg}`);
    }
  }
  const blsSection = blsLines.length
    ? `\n## BLS OFFICIAL DATA (bls.gov)\n${blsLines.join("\n")}`
    : "";

  // ── Data source summary ───────────────────────────────────────────────────
  const sources = [
    "FRED (yields, S&P 500, VIX, gold, oil, CPI, GDP, unemployment, HY OAS)",
    ctx.news?.length       ? `NewsAPI (${ctx.news.length} live headlines)`                     : null,
    ctx.econCalendar?.length ? `Finnhub (${ctx.econCalendar.length} economic events)`          : null,
    ctx.earningsCalendar?.length ? `Finnhub (${ctx.earningsCalendar.length} earnings releases)` : null,
    ctx.bea?.gdp.length    ? "BEA (GDP components, personal income)"                           : null,
    blsLines.length        ? `BLS (${blsLines.length} series including CPI detail, PPI, wages)` : null,
  ]
    .filter(Boolean)
    .join("; ");

  return `You are CrossAsset, an elite institutional macro desk analyst writing a pre-market morning brief. You have access to live market data, today's actual news headlines, and official government economic data. Use ALL of it.

STYLE: Concise, sharp, data-driven. Reference specific numbers and real headlines from the data below. Always connect every data point to a concrete asset implication. Write as if briefing a sell-side trading desk before market open. No disclaimers. No generic statements.

TODAY'S DATE: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

## LIVE MARKET DATA (FRED · US Treasury · ${sources})

### Rates
${JSON.stringify(macroData.rates, null, 2)}

### Inflation
${JSON.stringify(macroData.inflation, null, 2)}

### Growth
${JSON.stringify(macroData.growth, null, 2)}

### Risk & Credit
${JSON.stringify(macroData.risk, null, 2)}

### Equities & FX
${JSON.stringify(macroData.equities, null, 2)}

### Commodities
${JSON.stringify(macroData.commodities, null, 2)}
${newsSection}${econSection}${earningsSection}${beaSection}${blsSection}

Return ONLY valid JSON — no markdown fences, no text outside the JSON object:

{
  "id": "string",
  "date": "string",
  "title": "string (one compelling macro thesis that reflects TODAY's data and news)",
  "regimeLabel": "string (e.g. Fed Repricing / Sticky Inflation | Risk-On | Growth Scare | Commodity Shock | Earnings Season Risk-Off)",
  "executiveSummary": "string (3 sharp sentences referencing specific numbers and events from above)",
  "frontPage": [
    { "headline": "string (headline referencing a REAL event from the news above)", "whatHappened": "string", "whyItMatters": "string", "marketImplication": "string", "affectedAssets": ["string"] }
  ],
  "crossAssetMap": { "equities": "string", "rates": "string", "fx": "string", "commodities": "string", "credit": "string" },
  "sectorTranslation": [{ "sector": "string", "implication": "string", "tickers": ["string"] }],
  "actionItems": [{ "title": "string", "priority": "High | Medium | Low", "category": "research | watchlist | calendar | reading | model_update | meeting_prep", "dueDate": "string (optional)", "relatedEvent": "string (optional)" }],
  "sourcesUsed": ["string"],
  "dataQualityNote": "string (list which APIs provided live data today)"
}

frontPage: exactly 4 stories grounded in real headlines above.
sectorTranslation: 5-6 sectors with specific tickers.
actionItems: 5-7 items tied to real upcoming events from the calendar.`;
}
