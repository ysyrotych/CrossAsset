import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SECTION_PROMPTS: Record<string, string> = {
  executive_summary: "Write a punchy, high-conviction executive summary. Open with the single most important thing an investor needs to know about this company right now. Cover: investment frame (1 sentence), what makes this company financially distinctive, key growth trajectory numbers, valuation context, biggest risk, and a clear bottom-line stance.",
  company_snapshot: "Write a company snapshot covering: founding story and key pivot moments, what the business model actually is and how it makes money, what the key metrics reveal about the business quality, and what makes this company's financial profile unusual vs typical sector peers.",
  business_overview: "Write a thorough business overview covering: company background and founding, core product/service portfolio and revenue mix, key customers and end markets, geographic exposure, competitive moat sources, and switching costs. Name the actual products, segments, and customers.",
  industry_analysis: "Write an industry analysis covering: market structure and competitive dynamics, key industry drivers and cycle position, barriers to entry, pricing power dynamics, and where this company sits competitively. Take a clear stance on the industry direction.",
  financial_analysis: "Write a rigorous financial analysis covering: revenue growth drivers and sustainability, margin evolution story, balance sheet health, FCF quality and cash conversion, and working capital dynamics. Every claim must anchor to specific numbers.",
  valuation: "Write a valuation framework covering: current trading multiples vs historical range and sector peers, what the current multiple implies about expectations, and three explicit price scenarios (Bear/Base/Bull) with specific math shown: [metric] × [multiple] ± [net debt] ÷ [shares] = [$price].",
  management_commentary: "Write management commentary covering: what management said about the business outlook (from available data), key guidance numbers and credibility track record, what analysts are focused on, and any notable changes in forward-looking language.",
  management_governance: "Write a management and governance section covering: leadership team tenure and track record, insider ownership and recent buying/selling activity, capital allocation discipline, board quality, and whether management incentives align with long-term shareholders.",
  key_risks: "Write 6-8 specific, company-relevant risks in bullet format. Each risk: what it is (specific), what evidence suggests it's real, and a probability assessment (High/Medium/Low). Avoid generic sector risks — every bullet must be specific to this company's situation.",
  news_analysis: "Write a news flow analysis covering: the dominant narrative in recent news, key events by category, sentiment trajectory (improving/deteriorating/stable), and what the market seems to have and not have priced in.",
  investment_thesis: "Write a bull/bear investment thesis. BULL CASE: 4-5 bullets with specific price target math and key catalyst. BEAR CASE: 4-5 bullets with downside math and what specifically would go wrong. End with a one-paragraph conviction statement on which case is more likely.",
  key_metrics: "Write a key metrics dashboard. For each of 6-8 KPIs: current value, watch threshold (what number signals a thesis change), and why this specific metric matters for THIS company more than others. Format as: KPI | Current | Watch Threshold | Why It Matters.",
  earnings_questions: "Write 8-10 institutional-grade questions for the next earnings call. Questions should probe specific risks visible in data, test management credibility on guidance, seek clarification on confusing accounting items. No softball questions.",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response("ANTHROPIC_API_KEY not set", { status: 500 });

  const {
    ticker, companyName, sectionId, sectionTitle, sectionDescription,
    thesis, tone, length, facts, history, fmpExtended, documentContext,
  } = await req.json();

  const wordTarget = length === "brief" ? "300-400" : length === "comprehensive" ? "700-900" : "500-600";
  const sectionGuidance = SECTION_PROMPTS[sectionId] ?? sectionDescription ?? `Write the ${sectionTitle} section.`;

  const fmtV = (v: number | null | undefined) => {
    if (v == null) return "N/A";
    const abs = Math.abs(v);
    if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    return String(v.toFixed(1));
  };
  const pctV = (v: number | null | undefined) => v != null ? `${Number(v).toFixed(1)}%` : "N/A";

  const factsBlock = facts ? `
COMPANY FINANCIALS:
- Revenue: ${fmtV(facts.revenue)} | Growth YoY: ${pctV(facts.revenue_growth ?? facts.revenue_growth_yoy)}
- Gross Margin: ${pctV(facts.gross_margin)} | Op Margin: ${pctV(facts.operating_margin)} | Net Margin: ${pctV(facts.net_margin)}
- FCF: ${fmtV(facts.free_cash_flow)} | FCF Margin: ${pctV(facts.fcf_margin)} | EBITDA: ${fmtV(facts.ebitda)}
- ROIC: ${pctV(facts.roic)} | Cash: ${fmtV(facts.cash)} | LT Debt: ${fmtV(facts.long_term_debt)} | Net Debt: ${fmtV(facts.net_debt)}
- Market Cap: ${fmtV(facts.market_cap)} | EV: ${fmtV(facts.enterprise_value)}
- Stock: $${facts.stock_price != null ? Number(facts.stock_price).toFixed(2) : "N/A"} | 52W: $${facts.week52_low != null ? Number(facts.week52_low).toFixed(0) : "?"} – $${facts.week52_high != null ? Number(facts.week52_high).toFixed(0) : "?"}
- P/E: ${facts.pe_ratio != null ? Number(facts.pe_ratio).toFixed(1) : "N/A"} | EV/EBITDA: ${facts.ev_ebitda != null ? Number(facts.ev_ebitda).toFixed(1) : "N/A"} | EV/Rev: ${facts.ev_revenue != null ? Number(facts.ev_revenue).toFixed(1) : "N/A"}
- EPS Diluted: $${facts.eps_diluted != null ? Number(facts.eps_diluted).toFixed(2) : "N/A"} | CapEx: ${fmtV(facts.capex)} | OCF: ${fmtV(facts.operating_cf)}
` : "";

  const extBlock = fmpExtended ? `
ADDITIONAL:
- Sector: ${fmpExtended.sector ?? "N/A"} | Industry: ${fmpExtended.fmp_industry ?? "N/A"}
- CEO: ${fmpExtended.ceo ?? "N/A"} | Analyst rating: ${fmpExtended.fmp_rating ?? "N/A"}
` : "";

  const histBlock = history && Object.keys(history).length > 0 ? `
HISTORICAL TRENDS (5-year):
${Object.entries(history).slice(0, 6).map(([metric, years]) => {
  const entries = Object.entries(years as Record<string, number>).sort().slice(-4);
  return `- ${metric}: ${entries.map(([y, v]) => `${y}:${typeof v === "number" && Math.abs(v) > 1e6 ? (v / 1e9).toFixed(1) + "B" : v}`).join(", ")}`;
}).join("\n")}
` : "";

  const prompt = `You are writing the "${sectionTitle}" section of an equity research primer for ${ticker} (${companyName}).

INVESTMENT THESIS — the spine of this document:
${thesis || "Write from a balanced, analytical perspective."}

TONE: ${tone ?? "analytical"} | TARGET LENGTH: ${wordTarget} words

${documentContext ? `DOCUMENT CONTEXT (already written — maintain consistency):\n${documentContext}\n\n` : ""}${factsBlock}${extBlock}${histBlock}

YOUR TASK: ${sectionGuidance}

WRITING RULES:
1. Start directly with content — no heading, no "In this section", no preamble
2. Every claim requires a specific number or named fact
3. Use ## for subsection headers if needed
4. Tone is ${tone ?? "analytical"} — ${tone === "bullish" ? "lead with positives, highlight upside" : tone === "bearish" ? "lead with risks, be skeptical" : "balanced but take a clear stance at the end"}
5. NEVER use: "it is worth noting", "importantly", "going forward", "significant"
6. Write for a PM who has 5 minutes and wants only what matters`;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      stream: true,
      messages: [{ role: "user", content: prompt }],
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
