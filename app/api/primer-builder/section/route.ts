import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SECTION_PROMPTS: Record<string, string> = {
  executive_summary:
    "Write a high-conviction executive summary. Open with the single most important thing an investor needs to know right now — the defining fact about this company at this moment. Then: (1) what the business actually does and why the model is unusual, (2) the three financial metrics that define the investment case, (3) valuation snapshot with what the multiple implies, (4) the bull and bear in one sentence each, (5) a one-sentence bottom line with a stance. No hedging. Name specific numbers every other sentence.",

  company_snapshot:
    "Write a company snapshot. Cover: what the company actually does and how it makes money (specific revenue mix), when it was founded and the pivotal business model evolution, what scale looks like today ($revenue, employees, segments), and what the financial profile reveals about business quality that peers lack. Make the reader feel they understand this company in 90 seconds.",

  business_overview:
    "Write a thorough business overview. Cover: the founding story and key strategic pivots, the current product/service portfolio with revenue contribution per segment, the customer base (named customers or concentration %, churn), geographic mix, the moat sources with evidence (retention rates, margins vs peers, pricing power), and switching costs. Name products, segments, and customers. Quote revenue numbers.",

  industry_analysis:
    "Write an industry analysis with a clear directional stance. Cover: the market structure (oligopoly/fragmented/duopoly), total addressable market with the company's current share, the key demand driver right now and where it is in its cycle, barriers to entry (capital intensity, regulatory, network effects), pricing dynamics and who sets prices, and exactly where this company sits on the competitive map. Conclude with your view on industry direction over 12-24 months.",

  financial_analysis:
    "Write a rigorous financial analysis. Lead with the revenue story: what's driving growth or decline and whether it's sustainable. Then: gross margin trajectory and what it reveals about pricing power, operating leverage evidence (does OpEx grow slower than revenue), FCF quality vs reported earnings (is the gap widening or closing), balance sheet durability (debt maturity, coverage ratios, liquidity), and working capital trends. Every paragraph must contain at least one specific dollar amount and one percentage.",

  valuation:
    "Write a valuation framework. Cover: current trading multiples (P/E, EV/EBITDA, EV/Rev, FCF yield) vs the 3-year historical average and sector median. Show what the current multiple mathematically implies about expected growth. Then provide three explicit price scenarios with visible math: Bear [$X revenue × Y multiple ± $Z net debt ÷ N shares = $price], Base [same format], Bull [same format]. Conclude with which scenario you weight most heavily and why.",

  management_commentary:
    "Write management commentary. Cover: what leadership has said about business trends (with direct quote patterns if available), whether guidance has been raised/maintained/cut and the credibility track record (beat rate), what sell-side analysts are focused on heading into the next print, and any notable changes in language around capital allocation. Be specific about guidance numbers.",

  management_governance:
    "Write a management and governance assessment. Cover: CEO tenure and the key strategic decisions they've made (with outcomes), insider ownership % and any recent buying or selling (name the dollars), capital allocation track record (buyback timing, M&A quality), board composition quality, and whether compensation structures align with long-term value creation. Take a stance on management quality.",

  key_risks:
    "Write 7-8 specific, company-relevant risks in structured bullet format. For each risk: (1) what it is — be specific to this company, not generic sector boilerplate, (2) what data or evidence makes it real today, (3) probability assessment (High/Medium/Low) with rationale. Risk categories to cover: competitive, regulatory, financial/leverage, execution, macro/cycle, and company-specific. No generic risks.",

  news_analysis:
    "Write a news flow analysis. Cover: the dominant narrative in recent coverage (not a list, a synthesis), key events by category with the market impact, whether sentiment has been improving or deteriorating and why, what appears already priced in vs what the market seems to be underestimating, and two or three specific events from the news feed that changed your view of the investment case. Be a journalist, not an archivist.",

  investment_thesis:
    "Write a bull/bear investment thesis. BULL CASE: 4-5 specific bullets with the catalysts, timeline, and a price target with math. BEAR CASE: 4-5 specific bullets with what specifically breaks the model, the magnitude of downside, and price with math. Then write a 2-paragraph conviction statement: which case you find more compelling and precisely what data would cause you to flip.",

  key_metrics:
    "Write a key metrics dashboard. For 7-8 KPIs: the current value, the watch threshold (the specific number that would change your thesis), and why this metric matters for THIS company more than others. Format strictly as a table: KPI | Current Value | Watch Threshold | Why It Matters Here. Pick metrics that are specific to this business model — not generic earnings per share.",

  earnings_questions:
    "Write 10 institutional-grade questions for the next earnings call. Each question should: probe a specific inconsistency in the data, test management credibility on a specific guidance number, or seek clarification on an unusual accounting item. No softballs. Questions should be phrased as a PM who has read the last 4 earnings transcripts and noticed something specific.",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response("ANTHROPIC_API_KEY not set", { status: 500 });

  const {
    ticker, companyName, sectionId, sectionTitle, sectionDescription,
    thesis, tone, length, facts, history, fmpExtended, documentContext,
  } = await req.json();

  const wordTarget = length === "brief" ? "350-450" : length === "comprehensive" ? "750-950" : "550-700";
  const sectionGuidance = SECTION_PROMPTS[sectionId] ?? sectionDescription ?? `Write the ${sectionTitle} section.`;

  const fmtV = (v: number | null | undefined) => {
    if (v == null) return "N/A";
    const abs = Math.abs(v);
    if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    return `$${v.toFixed(1)}`;
  };
  const pctV = (v: number | null | undefined) => v != null ? `${Number(v).toFixed(1)}%` : "N/A";
  const numV = (v: number | null | undefined, dp = 1) => v != null ? Number(v).toFixed(dp) : "N/A";

  const factsBlock = facts ? `
COMPANY FINANCIALS (most recent):
Revenue: ${fmtV(facts.revenue)} | YoY Growth: ${pctV(facts.revenue_growth ?? facts.revenue_growth_yoy)}
Gross Margin: ${pctV(facts.gross_margin)} | Op Margin: ${pctV(facts.operating_margin)} | Net Margin: ${pctV(facts.net_margin)}
EBITDA: ${fmtV(facts.ebitda)} | FCF: ${fmtV(facts.free_cash_flow)} | FCF Margin: ${pctV(facts.fcf_margin)}
OCF: ${fmtV(facts.operating_cf)} | CapEx: ${fmtV(facts.capex)}
ROIC: ${pctV(facts.roic)} | Cash: ${fmtV(facts.cash)} | LT Debt: ${fmtV(facts.long_term_debt)} | Net Debt: ${fmtV(facts.net_debt)}
Market Cap: ${fmtV(facts.market_cap)} | EV: ${fmtV(facts.enterprise_value)}
Stock: $${numV(facts.stock_price, 2)} | 52W Low: $${numV(facts.week52_low, 0)} | 52W High: $${numV(facts.week52_high, 0)}
P/E: ${numV(facts.pe_ratio)} | EV/EBITDA: ${numV(facts.ev_ebitda)} | EV/Rev: ${numV(facts.ev_revenue)} | P/FCF: ${facts.free_cash_flow && facts.market_cap ? numV(facts.market_cap / facts.free_cash_flow) : "N/A"}
EPS Diluted: $${numV(facts.eps_diluted, 2)} | Shares: ${facts.shares_outstanding != null ? (facts.shares_outstanding / 1e6).toFixed(0) + "M" : "N/A"}
Dividend Yield: ${pctV(facts.dividend_yield)} | Beta: ${numV(facts.beta)}
` : "";

  const extBlock = fmpExtended ? `
EXTENDED DATA:
Sector: ${fmpExtended.sector ?? "N/A"} | Industry: ${fmpExtended.fmp_industry ?? "N/A"}
CEO: ${fmpExtended.ceo ?? "N/A"} | Employees: ${fmpExtended.employees != null ? Number(fmpExtended.employees).toLocaleString() : "N/A"}
Analyst Rating: ${fmpExtended.fmp_rating ?? "N/A"} | Description: ${typeof fmpExtended.description === "string" ? fmpExtended.description.slice(0, 300) : "N/A"}
` : "";

  const histBlock = history && Object.keys(history).length > 0 ? `
HISTORICAL TRENDS (multi-year):
${Object.entries(history).map(([metric, years]) => {
  const entries = Object.entries(years as Record<string, number>).sort().slice(-5);
  if (entries.length === 0) return null;
  return `${metric}: ${entries.map(([y, v]) => {
    const abs = Math.abs(Number(v));
    const fmt = abs >= 1e9 ? `${(Number(v) / 1e9).toFixed(1)}B` : abs >= 1e6 ? `${(Number(v) / 1e6).toFixed(0)}M` : abs > 100 ? Number(v).toFixed(0) : Number(v).toFixed(1);
    return `${y}:${fmt}`;
  }).join(", ")}`;
}).filter(Boolean).join("\n")}
` : "";

  // Include news for sections that benefit from it
  const newsRelated = ["executive_summary", "news_analysis", "key_risks", "investment_thesis", "management_commentary"];
  const newsBlock = newsRelated.includes(sectionId) && fmpExtended?.news_combined
    ? `
RECENT NEWS (${(fmpExtended.news_combined as unknown[]).length} items, use for this section):
${(fmpExtended.news_combined as Array<{date?: string; title: string; summary?: string; category?: string; stock_change?: number}>)
  .slice(0, 15)
  .map(n => `[${n.category ?? "NEWS"}] ${n.date ? n.date.slice(0, 10) : ""} | ${n.title}${n.stock_change != null ? ` (stock: ${n.stock_change > 0 ? "+" : ""}${n.stock_change.toFixed(1)}%)` : ""}${n.summary ? "\n  " + n.summary.slice(0, 180) : ""}`)
  .join("\n")}
` : "";

  const systemPrompt = `You are a senior equity research analyst at a top-tier institutional fund. You write with the precision of Goldman Sachs research and the directness of a hedge fund PM. Your analysis is used by professionals who read 50+ pages of research daily — they have zero patience for filler.

Style rules (MANDATORY):
- Every paragraph contains at least one specific dollar amount OR percentage OR named date
- Active voice only: "Revenue grew 23%" not "Revenue was seen to grow"
- Never use: "it is worth noting", "importantly", "going forward", "significant", "robust", "landscape", "headwinds/tailwinds", "value creation", "synergies", "leverage the", "in the coming quarters"
- Name specific products, segments, competitors, and customers — no generic references
- If you make a directional claim, back it with a number within the same sentence
- Write for someone who already knows what ${ticker} does — skip the obvious
- Target length: ${wordTarget} words — if you hit the floor, stop. Don't pad.`;

  const userPrompt = `Write the "${sectionTitle}" section for ${ticker} (${companyName}).

INVESTMENT THESIS:
${thesis || "Write from a balanced, analytical perspective with a clear bottom-line view."}

TONE: ${tone ?? "analytical"}

${documentContext ? `ALREADY WRITTEN (maintain consistency, do not repeat):\n${documentContext}\n\n` : ""}${factsBlock}${extBlock}${histBlock}${newsBlock}
TASK: ${sectionGuidance}

FORMATTING:
- Start directly with content — no heading, no intro sentence like "This section covers..."
- Use ### for subsection headers if the section naturally divides
- Bold ($dollar amounts or %) with **bold** for scanability only when the number is the key takeaway
- No bullet soup — use prose paragraphs with embedded data points`;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text();
    return new Response(`Anthropic error: ${err}`, { status: 502 });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            const text: string = j.delta?.text ?? "";
            if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          } catch { /* skip */ }
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
