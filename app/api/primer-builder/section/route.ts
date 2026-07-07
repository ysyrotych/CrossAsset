import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SECTION_PROMPTS: Record<string, string> = {
  executive_summary:
    "Write a high-conviction executive summary. Open with the single most important thing an investor needs to know right now — cite the specific ROIC-WACC spread or FCF yield vs risk-free rate from the computed metrics block. Then: (1) what the business actually does and why the model is unusual, (2) reference the Rule of 40 score and Piotroski F-Score to anchor the financial quality argument, (3) valuation snapshot with what the multiple implies about implied growth, (4) the bull and bear in one sentence each using specific numbers, (5) a one-sentence bottom line with a clear stance. No hedging. Every other sentence must contain a specific number.",

  company_snapshot:
    "Write a company snapshot. Cover: what the company actually does and how it makes money (specific revenue mix from the segments data), what scale looks like today ($revenue, employees, key product lines), and what the financial profile reveals about business quality. Lead with the most defining financial characteristic of the business model — whether that's margin structure, cash conversion, asset intensity, or network economics. Make the reader feel they understand this company in 90 seconds.",

  business_overview:
    "Write a thorough business overview. Open with the most important structural fact about this company. Cover: the current product/service portfolio with exact revenue contribution per segment (use the REVENUE SEGMENTS data), named customers or concentration metrics, geographic mix with percentages, the moat sources with hard evidence (retention rates, margin comparison, pricing power), and switching costs. Name specific products and quote segment revenue numbers. Do not use generic placeholders.",

  industry_analysis:
    "Write an industry analysis with a clear directional stance. Cover: the market structure (oligopoly/fragmented/duopoly), the key demand driver right now and where the company sits in its cycle, barriers to entry (capital intensity, regulatory, network effects), pricing dynamics and who sets prices, and exactly where this company sits on the competitive map vs named peers from the PEER COMPARISON data — name each peer, quote their gross margin and revenue growth vs the subject company's, and explain who is gaining or losing share. Conclude with a concrete directional view on the industry over the next 12-24 months. Take a stance.",

  financial_analysis:
    "Write a rigorous financial analysis that integrates the computed metrics provided. REQUIRED: (1) Lead with revenue trajectory — use the CAGR from HISTORICAL TRENDS, call out if it is accelerating or decelerating. (2) Gross margin story — is pricing power growing or eroding? (3) Operating leverage — explicitly compare revenue growth to OpEx growth rates from the historical data. (4) Earnings quality — use the accrual ratio or OCF/Net Income ratio from computed metrics; if OCF > net income, say why and by how much. (5) Balance sheet durability — use Net Debt/EBITDA ratio from computed metrics, reference debt maturity if known. (6) FCF conversion — what % of EBITDA converts to FCF and why. Every paragraph must cite at least one specific dollar amount and one percentage from the data provided.",

  valuation:
    "Write a valuation framework that shows explicit math. REQUIRED: (1) Current trading multiples vs the 3-year average — quote P/E, EV/EBITDA, EV/Rev, and FCF yield. (2) PEER MULTIPLES TABLE: use the PEER COMPARISON data to show how this company's P/E, EV/EBITDA, and gross margin compare to each named peer — identify whether the company trades at a premium or discount and explicitly justify or challenge that spread. (3) What the current multiple mathematically implies about expected growth — show the algebra. (4) Three explicit price target scenarios using the format: [Bear: $X revenue × Y EV/EBITDA multiple ± $Z net cash/debt ÷ N shares = $TT]. [Base: same format]. [Bull: same format]. Use the shares outstanding and net debt/cash from the data. (5) Conclude with which scenario you weight most heavily and the single number that would cause you to move between scenarios.",

  management_commentary:
    "Write management commentary. Use the EARNINGS SURPRISE HISTORY to assess guidance credibility — what is the beat rate, is it consistent or deteriorating, are beats driven by real upside or just sandbagging? Cover what leadership has communicated about business trends with specific guidance numbers, what sell-side analysts are focused on heading into the next print based on recent news/commentary, and any notable capital allocation language shifts. Reference specific quarters by name.",

  management_governance:
    "Write a management and governance assessment. Use the INSIDER TRADING data provided — name the executives, quote the exact dollar amounts, and characterize the signal (cluster buying vs isolated selling). Cover CEO tenure and the key strategic decisions they've made (with outcomes). Assess capital allocation quality: has buyback timing been value-accretive? What M&A has been done and what was the outcome? Take a clear stance on whether you trust this management team with capital.",

  key_risks:
    "Write 7-8 specific, company-relevant risks. Use any news items categorized as REGULATORY/LEGAL, GUIDANCE, or ANALYST ACTION to make risks current and specific. For each risk: (1) the specific threat — no generic sector boilerplate, reference actual company data, (2) what evidence makes it real today (data, news, trend), (3) probability (High/Medium/Low) and what would trigger it. Format: bold risk title on its own line, then a tight paragraph of evidence and assessment. Cover competitive, regulatory, financial, execution, and macro risks.",

  news_analysis:
    "Write a news flow analysis. Synthesize the news data into a coherent narrative — not a list. Cover: the dominant theme driving recent coverage, how market sentiment has shifted and why (reference stock price reactions to specific events if available), what appears already priced in vs what the market seems to be underestimating, 2-3 specific events that materially changed the investment picture. Conclude with the single most important upcoming catalyst from the news flow. Be a journalist synthesizing a story, not an archivist cataloguing events.",

  investment_thesis:
    "Write a bull/bear investment thesis. BULL CASE: 4-5 specific bullets — each must name a catalyst, a timeline, and a specific metric that would confirm the thesis. End with an explicit price target showing the math. BEAR CASE: 4-5 specific bullets — each must name what specifically breaks, the magnitude of the downside, and the specific trigger. End with an explicit downside price target. Then write a 2-paragraph conviction statement: which case you find more compelling based on the data, and precisely what single data point would cause you to flip.",

  key_metrics:
    "Write a key metrics dashboard. For 7-8 KPIs: current value, the specific watch threshold that would change your thesis, and why this metric matters for THIS business model more than others. Include metrics specific to this company's business model — not generic EPS. Consider: revenue CAGR, gross margin trajectory, FCF conversion, Rule of 40, Net Debt/EBITDA, key operational KPI (ARR/NRR for SaaS, same-store sales for retail, book-to-bill for semiconductors, etc.). Format strictly as a table: KPI | Current Value | Watch Threshold | Why It Matters Here.",

  earnings_questions:
    "Write 10 institutional-grade questions for the next earnings call. Use the EARNINGS SURPRISE HISTORY to probe guidance credibility — note specific quarters where beats/misses occurred. Questions must probe specific inconsistencies in the data, test management credibility on guidance numbers, or seek clarification on unusual accounting items. Phrase each question as if you've read the last 4 transcripts and noticed something specific. No softballs. Avoid generic questions about 'the macro environment' or 'competitive dynamics.'"
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

  // Computed derived metrics
  const roicWaccSpread = facts?.roic != null ? facts.roic - 9 : null;
  const fcfYield = facts?.free_cash_flow != null && facts?.market_cap != null && facts.market_cap > 0 ? (facts.free_cash_flow / facts.market_cap) * 100 : null;
  const fcfYieldErp = fcfYield != null ? fcfYield - 3.5 : null;
  const ocfNiRatio = facts?.operating_cf != null && facts?.net_income != null && facts.net_income !== 0 ? facts.operating_cf / facts.net_income : null;
  const netDebtEbitda = facts?.net_debt != null && facts?.ebitda != null && facts.ebitda !== 0 ? facts.net_debt / facts.ebitda : null;
  const ruleOf40 = (facts?.revenue_growth ?? 0) + (facts?.free_cash_flow != null && facts?.revenue != null && facts.revenue > 0 ? (facts.free_cash_flow / facts.revenue) * 100 : facts?.operating_margin ?? 0);
  const revenueYrs = Object.keys(history?.revenue ?? {}).sort();
  const revCagr = revenueYrs.length >= 3 ? (() => {
    const rv = history.revenue;
    const oldest = rv[revenueYrs[0]]; const newest = rv[revenueYrs[revenueYrs.length - 1]]; const n = revenueYrs.length - 1;
    return oldest > 0 && newest > 0 ? (Math.pow(newest / oldest, 1 / n) - 1) * 100 : null;
  })() : null;

  const factsBlock = facts ? `
COMPANY FINANCIALS (most recent):
Revenue: ${fmtV(facts.revenue)} | YoY Growth: ${pctV(facts.revenue_growth ?? facts.revenue_growth_yoy)} | ${revenueYrs.length >= 3 ? `${revenueYrs.length - 1}Y CAGR: ${revCagr != null ? pctV(revCagr) : "N/A"}` : ""}
Gross Margin: ${pctV(facts.gross_margin)} | Op Margin: ${pctV(facts.operating_margin)} | Net Margin: ${pctV(facts.net_margin)}
EBITDA: ${fmtV(facts.ebitda)} | FCF: ${fmtV(facts.free_cash_flow)} | FCF Margin: ${pctV(facts.fcf_margin ?? (facts.free_cash_flow != null && facts.revenue ? facts.free_cash_flow / facts.revenue * 100 : undefined))}
OCF: ${fmtV(facts.operating_cf)} | CapEx: ${fmtV(facts.capex)}
ROIC: ${pctV(facts.roic)} | Cash: ${fmtV(facts.cash)} | LT Debt: ${fmtV(facts.long_term_debt)} | Net Debt: ${fmtV(facts.net_debt)}
Market Cap: ${fmtV(facts.market_cap)} | EV: ${fmtV(facts.enterprise_value)}
Stock: $${numV(facts.stock_price, 2)} | 52W Low: $${numV(facts.week52_low, 0)} | 52W High: $${numV(facts.week52_high, 0)}
P/E: ${numV(facts.pe_ratio)} | EV/EBITDA: ${numV(facts.ev_ebitda)} | EV/Rev: ${numV(facts.ev_revenue)} | P/FCF: ${facts.free_cash_flow && facts.market_cap ? numV(facts.market_cap / facts.free_cash_flow) : "N/A"}
EPS Diluted: $${numV(facts.eps_diluted, 2)} | Shares: ${facts.shares_outstanding != null ? (facts.shares_outstanding / 1e6).toFixed(0) + "M" : "N/A"}
Dividend Yield: ${pctV(facts.dividend_yield)} | Beta: ${numV(facts.beta)}

COMPUTED QUALITY METRICS (use these explicitly in the analysis):
ROIC vs WACC: ${roicWaccSpread != null ? `${roicWaccSpread >= 0 ? "+" : ""}${roicWaccSpread.toFixed(1)}pp spread vs 9% WACC — ${roicWaccSpread >= 3 ? "VALUE-CREATING" : roicWaccSpread >= 0 ? "MARGINAL" : "VALUE-DESTROYING"}` : "N/A"}
FCF Yield: ${fcfYield != null ? `${fcfYield.toFixed(1)}% vs 3.5% RF (ERP: ${fcfYieldErp != null ? (fcfYieldErp >= 0 ? "+" : "") + fcfYieldErp.toFixed(1) + "pp" : "N/A"})` : "N/A"}
Earnings Quality (OCF/NI): ${ocfNiRatio != null ? `${ocfNiRatio.toFixed(2)}x — ${ocfNiRatio > 1.2 ? "HIGH QUALITY (OCF > earnings)" : ocfNiRatio > 0.8 ? "MODERATE" : "LOW QUALITY (earnings outrun cash)"}` : "N/A"}
Net Debt / EBITDA: ${netDebtEbitda != null ? `${netDebtEbitda.toFixed(1)}x — ${netDebtEbitda < 0 ? "NET CASH" : netDebtEbitda < 1 ? "LOW LEVERAGE" : netDebtEbitda < 3 ? "MODERATE" : "ELEVATED"}` : "N/A"}
Rule of 40: ${ruleOf40.toFixed(0)} (rev growth + FCF margin) — ${ruleOf40 >= 40 ? "ABOVE threshold (efficiency + growth)" : ruleOf40 >= 25 ? "BELOW threshold but approaching" : "WELL BELOW threshold — growth/profitability tension"}
` : "";

  const extBlock = fmpExtended ? `
EXTENDED DATA:
Sector: ${fmpExtended.sector ?? "N/A"} | Industry: ${fmpExtended.fmp_industry ?? "N/A"}
CEO: ${fmpExtended.ceo ?? "N/A"} | Employees: ${fmpExtended.employees != null ? Number(fmpExtended.employees).toLocaleString() : "N/A"}
Analyst Rating: ${fmpExtended.fmp_rating ?? "N/A"} | Description: ${typeof fmpExtended.description === "string" ? fmpExtended.description.slice(0, 300) : "N/A"}
` : "";

  // Insider trading block for management/governance sections
  const insiderSections = ["management_governance", "management_commentary", "key_risks"];
  const insiderBlock = insiderSections.includes(sectionId) && Array.isArray(fmpExtended?.insider_trading) && fmpExtended.insider_trading.length > 0
    ? `\nINSIDER TRADING (last ${Math.min((fmpExtended.insider_trading as any[]).length, 10)} transactions):
${(fmpExtended.insider_trading as Array<{name?: string; title?: string; transaction?: string; shares?: number; price?: number; value?: number; date?: string}>)
  .slice(0, 10)
  .map(t => `${t.date ? t.date.slice(0, 10) : "?"} | ${t.name ?? "?"} (${t.title ?? "?"}) | ${t.transaction ?? "?"} | ${t.shares != null ? Number(t.shares).toLocaleString() + " shares" : ""} @ $${t.price?.toFixed(2) ?? "?"} | Value: $${t.value != null ? (Math.abs(t.value) / 1e6).toFixed(2) + "M" : "?"}`)
  .join("\n")}
`
    : "";

  // Earnings surprise history for earnings questions and management sections
  const surpriseSections = ["earnings_questions", "management_commentary", "management_governance", "executive_summary"];
  const surpriseBlock = surpriseSections.includes(sectionId) && Array.isArray(fmpExtended?.earnings_surprises) && fmpExtended.earnings_surprises.length > 0
    ? `\nEARNINGS SURPRISE HISTORY (${(fmpExtended.earnings_surprises as any[]).length} quarters):
${(fmpExtended.earnings_surprises as Array<{date?: string; quarter?: string; actual_eps?: number; estimated_eps?: number; surprise_pct?: number}>)
  .slice(0, 8)
  .map(e => {
    const surp = e.surprise_pct ?? (e.actual_eps != null && e.estimated_eps != null ? ((e.actual_eps - e.estimated_eps) / Math.abs(e.estimated_eps)) * 100 : null);
    return `${e.date?.slice(0, 7) ?? e.quarter ?? "?"}: Actual EPS $${e.actual_eps?.toFixed(2) ?? "?"} vs Est $${e.estimated_eps?.toFixed(2) ?? "?"} (${surp != null ? (surp >= 0 ? "+" : "") + surp.toFixed(1) + "%" : "?"})`;
  })
  .join("\n")}
`
    : "";

  // Analyst rec breakdown for thesis/investment sections
  const analysisSections = ["investment_thesis", "executive_summary", "key_risks"];
  const analystRecBlock = analysisSections.includes(sectionId) && fmpExtended?.analyst_rec != null
    ? (() => {
        const rec = fmpExtended.analyst_rec as { strong_buy: number; buy: number; hold: number; sell: number; strong_sell: number; total: number };
        const bullish = (rec.strong_buy ?? 0) + (rec.buy ?? 0);
        const bearish = (rec.sell ?? 0) + (rec.strong_sell ?? 0);
        return `\nANALYST CONSENSUS: ${bullish} Buy / ${rec.hold ?? 0} Hold / ${bearish} Sell (of ${rec.total ?? 0} analysts)\n`;
      })()
    : "";

  // Segment revenue for business/snapshot sections
  const segmentSections = ["business_overview", "company_snapshot", "financial_analysis"];
  const segmentBlock = segmentSections.includes(sectionId) && fmpExtended?.segments?.data != null
    ? (() => {
        const segs = fmpExtended.segments as { data: Record<string, number> };
        const total = Object.values(segs.data).reduce((s, v) => s + Math.abs(v), 0);
        const lines = Object.entries(segs.data)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
          .map(([name, val]) => `${name}: $${Math.abs(val) >= 1e9 ? (val / 1e9).toFixed(1) + "B" : (val / 1e6).toFixed(0) + "M"} (${total > 0 ? (Math.abs(val) / total * 100).toFixed(0) : "?"}%)`);
        return `\nREVENUE SEGMENTS:\n${lines.join("\n")}\n`;
      })()
    : "";

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

  // Peer comparison block for valuation / industry / financial sections
  const peerSections = ["valuation", "industry_analysis", "financial_analysis", "investment_thesis", "executive_summary"];
  const peerBlock = peerSections.includes(sectionId) && Array.isArray(fmpExtended?.peer_comparison) && (fmpExtended.peer_comparison as any[]).length > 0
    ? (() => {
        const peers = fmpExtended.peer_comparison as Array<{
          symbol?: string; name?: string; market_cap?: number;
          pe?: number; ev_ebitda?: number; p_fcf?: number;
          gross_margin?: number; net_margin?: number; roic?: number;
          revenue_growth?: number; revenue?: number;
        }>;
        const fmtM = (v?: number | null) => v == null ? "—" : Math.abs(v) >= 1e12 ? `$${(v/1e12).toFixed(1)}T` : Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`;
        const fmtPct2 = (v?: number | null) => v == null ? "—" : `${Number(v).toFixed(1)}%`;
        const fmtX = (v?: number | null) => v == null ? "—" : `${Number(v).toFixed(1)}x`;
        const header = `Symbol | Mkt Cap | P/E | EV/EBITDA | P/FCF | Gross Mgn | ROIC | Rev Growth`;
        const rows = peers.slice(0, 6).map(p =>
          `${p.symbol ?? "?"} (${p.name ? p.name.slice(0, 18) : "?"}) | ${fmtM(p.market_cap)} | ${fmtX(p.pe)} | ${fmtX(p.ev_ebitda)} | ${fmtX(p.p_fcf)} | ${fmtPct2(p.gross_margin)} | ${fmtPct2(p.roic)} | ${fmtPct2(p.revenue_growth)}`
        );
        return `\nPEER COMPARISON (use these exact numbers — reference peers by name in your analysis):\n${header}\n${rows.join("\n")}\n`;
      })()
    : "";

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

${documentContext ? `ALREADY WRITTEN (maintain consistency, do not repeat):\n${documentContext}\n\n` : ""}${factsBlock}${extBlock}${histBlock}${segmentBlock}${insiderBlock}${surpriseBlock}${analystRecBlock}${peerBlock}${newsBlock}
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
      max_tokens: 3000,
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
