import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SECTION_PROMPTS: Record<string, string> = {
  executive_summary:
    "Write a high-conviction executive summary AS A BULLET LIST — use '•' bullets, one per idea. Required bullets in order: (1) Open with the single most important thing an investor needs to know right now — cite the specific ROIC-WACC spread or FCF yield vs risk-free rate from COMPUTED QUALITY METRICS; (2) What the business does and WHY the model generates above-average returns (or why it doesn't) — name the specific structural advantage; (3) Financial quality argument: FCF margin trajectory, OCF/NI earnings quality ratio, and operating leverage evidence with specific dollar amounts from HISTORICAL TRENDS; (4) Valuation — NTM multiple from ANALYST FORWARD ESTIMATES vs what revenue growth and margin that embeds; (5) Bull case in one sentence with a specific price target and the key catalyst; (6) Bear case in one sentence with a specific downside number and what triggers it; (7) Bottom line stance — use EXACTLY this format: '[BUY/HOLD/SELL] — 12-month price target $[number]. [One sentence on conviction and key catalyst.]' No hedging. Every bullet must contain at least one number.",

  company_snapshot:
    "Write a company snapshot as a PIPE-DELIMITED TABLE with rows in this format: 'Field | Value'. Required rows: Ticker, Company, Sector/Industry, Headquarters, Founded/IPO, CEO (name + years in role), Employees, Business Model (2-3 words), Primary Revenue Drivers, Top Customers / Markets, Geographic Mix, Key Products/Services, Investment Frame (the single most important question for this stock right now). Each value should be specific and data-driven — never 'N/A' if you can derive it. The Investment Frame row is the most important — it should pose the exact analytical question that determines whether the stock works.",

  business_overview:
    "Write a thorough business overview using EXACTLY these ### subsection headers:\n### Company Background\nFounding/history, key strategic pivots, what structural advantage was built and how. One defining paragraph.\n### Product Portfolio & Revenue Mix\nEvery major product line / segment with exact revenue contribution from REVENUE SEGMENTS data. Name gross margins per segment if available. What drives pricing power per product.\n### Customers, End Markets & Geographic Exposure\nNamed customers or concentration metrics (top customer % of revenue if known). End market breakdown with growth rates. Geographic revenue mix using the GEOGRAPHIC REVENUE MIX data. Where the next dollar of growth comes from. Use specific numbers throughout.",

  industry_analysis:
    "Write an industry analysis with a clear directional stance. Cover: the market structure (oligopoly/fragmented/duopoly), the key demand driver right now and where the company sits in its cycle, barriers to entry (capital intensity, regulatory, network effects), pricing dynamics and who sets prices. Use EXACTLY these ### subsection headers:\n### Market Structure & Competitive Dynamics\nMarket structure type, TAM, who controls pricing, consolidation trajectory. Reference named peers from PEER COMPARISON data — compare their gross margin and revenue growth vs subject company, and explain who is gaining or losing share.\n### Key Industry Drivers & Cycle\nThe 1-2 biggest macro/sector drivers right now. Where in the cycle (early/mid/late expansion; early/mid downturn). Quantify cycle timing where possible.\n### Competitive Position\nSubject company's rank, differentiated vs commoditized products, switching costs, evidence of or challenge to moat. Conclude with a directional 12-24 month industry view.",

  financial_analysis:
    "Write a rigorous financial analysis using EXACTLY these ### subsection headers in order:\n### Revenue & Profitability Trends\nRevenue trajectory using the CAGR from HISTORICAL TRENDS — is it accelerating or decelerating quarter-to-quarter? Gross margin story: is pricing power growing or eroding YoY? Operating leverage: explicitly compare revenue growth % to OpEx growth % from historical data.\n### Balance Sheet & Capital Allocation\nNet Debt/EBITDA ratio from computed metrics. Debt maturity profile if discernible. Cash generation vs debt service coverage. Capital allocation priorities (buybacks, M&A, dividends) with specific dollar amounts from the data.\n### Free Cash Flow & CapEx\nFCF conversion: what % of EBITDA converts to FCF and why. CapEx intensity trend. What is maintenance vs growth CapEx (estimate if necessary). FCF per share trajectory.\n### Quality of Earnings & Cash Conversion\nOCF/Net Income ratio from computed metrics — characterize HIGH/MODERATE/LOW. Are SBC charges inflating reported earnings? Accrual ratio signal. Every paragraph in all subsections must cite at least one specific dollar amount and one percentage.",

  valuation:
    "Write a valuation framework using EXACTLY these ### subsection headers in order:\n### Current Valuation vs. Historical Range\nStart with the NTM multiples derived from ANALYST FORWARD ESTIMATES: show the math explicitly (EV ÷ NTM EBITDA = Xx; Stock ÷ NTM EPS = Xx). Compare these NTM multiples to the 3-year LTM average to quantify whether the stock trades at a premium or discount and what justifies it. State whether you view current valuation as cheap, fair, or expensive relative to history.\n### Peer Valuation Context\nUse PEER COMPARISON data to benchmark this company's P/E, EV/EBITDA, P/FCF, and gross margin against each named peer. For every peer, explicitly state whether it trades at a premium or discount to the subject company AND why the market assigns that spread. Conclude with a 1-sentence verdict on whether the subject's premium/discount is warranted.\n### Implied Scenarios\nThree explicit price target scenarios — use EXACTLY this format for each:\nBear Case ($XX): [NTM revenue estimate × EBITDA margin = EBITDA × EV/EBITDA multiple − net debt ÷ shares = $XX]. [Narrative: what breaks.]\nBase Case ($XX): [same math structure]. [Narrative: what happens.]\nBull Case ($XX): [same math structure]. [Narrative: what accelerates.]\nConclude with which scenario you weight most heavily (assign a probability) and the exact single metric that would cause you to upgrade or downgrade your view.",

  management_commentary:
    "Write management commentary using EXACTLY these ### subsection headers:\n### Earnings Call Highlights\nLead with the earnings beat/miss rate from EARNINGS SURPRISE HISTORY — quote the exact percentages. Name 2-3 specific things management said on the most recent call that moved the stock. Quote revenue or EPS guidance numbers directly. Flag any tone shift vs the prior quarter.\n### Forward Guidance & Outlook\nWhat management is guiding for next quarter and FY — use exact dollar amounts if available. What are the sell-side debate points heading into the next print based on RECENT NEWS? What did consensus miss last time? One clear sentence on whether guidance is conservative, in-line, or aggressive based on the beat rate.",

  management_governance:
    "Write a management and governance assessment using EXACTLY these ### subsection headers:\n### Leadership & Track Record\nCEO name, tenure, 2-3 specific strategic decisions they made and the outcome (use specific numbers). Insider ownership %. Board composition signal. Take a stance: has this team created or destroyed value?\n### Capital Allocation Discipline\nUse the INSIDER TRADING data — name the executives, quote exact dollar amounts from the data, characterize the signal (cluster buying vs isolated selling vs routine 10b5-1). Buyback track record: was timing value-accretive (did they buy at historical lows or at peak)? M&A history: deal name, price paid, and current evidence of value creation. One clear verdict sentence on whether you trust this team with capital.",

  key_risks:
    "Write 7-8 specific, company-relevant risks. Use any news items categorized as REGULATORY/LEGAL, GUIDANCE, or ANALYST ACTION to make risks current and specific. If SHORT INTEREST is elevated (>10% of float), include a short squeeze risk OR a structural bear risk explaining why the shorts are there — not both. For each risk: (1) bold risk title on its own line formatted as **RISK NAME**, (2) one tight paragraph: what specifically breaks, what current evidence makes it real (cite a data point — revenue %, margin trend, debt figure, or news date), (3) probability rating in this exact format: [HIGH / MEDIUM / LOW] probability — trigger: [specific event or threshold that would activate this risk]. Cover competitive, regulatory, financial/leverage, execution, macro, and (if applicable) short-interest-related risks. Every risk must reference at least one specific dollar amount, percentage, or news item.",

  news_analysis:
    "Write a structured news flow analysis using EXACTLY these 5 numbered headers in order:\n1. EVENTS SCORECARD — tally the news by category (Earnings X, Analyst Actions X, Regulatory X, etc.), identify the dominant theme, and rate overall news flow as [BULLISH/BEARISH/MIXED] with a one-sentence conviction statement.\n2. SENTIMENT TRAJECTORY — how has market narrative shifted in the last 30 days vs prior 60? Reference specific stock price reactions to headline events (use the stock_change % where provided). Label the pattern: [Cluster Break / Deterioration / Recovery / Debate / Normal].\n3. ANALYST POSITIONING — what are sell-side analysts doing (upgrades/downgrades/initiations)? Where is the consensus debate concentrated? Name specific firms if visible in the data.\n4. WHAT'S PRICED IN — based on stock reactions, what does the market appear to have priced in already? What appears NOT priced in that could be a catalyst? Start with: 'The market appears to have already priced in...' and then 'What appears NOT yet priced in is...'\n5. NEAR-TERM CATALYSTS — list 3 specific upcoming catalysts with format: 1. [Catalyst name] | Timing estimate | Bull outcome vs Bear outcome.\nEvery section must reference specific headlines with dates.",

  investment_thesis:
    "Write a bull/bear investment thesis using EXACTLY these ### headers in order:\n### BULL CASE\nWrite 4-5 specific bullets using '•' prefix — each must name a catalyst, a timeline, and a specific metric that would confirm the thesis (e.g. 'Gross margin expansion to 45%+ by Q3 2025 driven by...'). Final bullet must be a price target with explicit math: 'NTM EBITDA of $XB × Xx EV/EBITDA − $XM net debt ÷ XM shares = $XX price target (X% upside).'\n### BEAR CASE\nWrite 4-5 specific bullets using '•' prefix — each must name exactly what breaks, cite the specific magnitude (e.g. 'Revenue misses by $XB if...'), and the exact trigger event. Final bullet: downside price target with same math format = $XX (X% downside).\n### CONVICTION STATEMENT\nTwo paragraphs. Para 1: state which case you weight more heavily and assign explicit probabilities (Bull X% / Base X% / Bear X%). Name the single most important upcoming catalyst or data print. Para 2: state exactly what data point or event would cause you to flip your position — be specific about the threshold (e.g. 'Two consecutive quarters of gross margin below 35% would force a downgrade'). Reference ANALYST CONSENSUS to contextualize your view vs the street.",

  key_metrics:
    "Write a key metrics dashboard for 7-8 KPIs specific to THIS business model. Current value, specific watch threshold that changes the thesis, and why this metric matters more than standard metrics for this company. NEVER include Rule of 40 or Piotroski F-Score — these are screener metrics, not PM-grade analytics. Use business-model-specific KPIs: for marketplaces use take rate / gross bookings growth; for SaaS use NRR / ARR; for financials use NIM / efficiency ratio; for industrials use book-to-bill. Always include: (1) Revenue CAGR trend, (2) Gross margin trajectory, (3) FCF conversion (OCF/NI), (4) ROIC/WACC spread, (5) CapEx intensity, (6) Net Debt/EBITDA, (7-8) business-model-specific KPIs. Format strictly as a table: KPI | Current Value | Watch Threshold | Why It Matters Here.",

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

  const wordTarget = length === "brief" ? "450-600" : length === "comprehensive" ? "900-1200" : "650-850";
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
  const fcfEbitdaConv = facts?.free_cash_flow != null && facts?.ebitda != null && facts.ebitda !== 0 ? (facts.free_cash_flow / facts.ebitda) * 100 : null;
  const revenueYrs = Object.keys(history?.revenue ?? {}).sort();
  const revCagr = revenueYrs.length >= 3 ? (() => {
    const rv = history.revenue;
    const oldest = rv[revenueYrs[0]]; const newest = rv[revenueYrs[revenueYrs.length - 1]]; const n = revenueYrs.length - 1;
    return oldest > 0 && newest > 0 ? (Math.pow(newest / oldest, 1 / n) - 1) * 100 : null;
  })() : null;
  // Incremental operating margin — YoY operating leverage signal (ΔEBIT / ΔRevenue)
  const incrEbitdaMargin = (() => {
    const revData = history?.revenue ?? {};
    const oiData  = history?.operating_income ?? {};
    const revYrs  = Object.keys(revData).sort();
    const oiYrs   = Object.keys(oiData).sort();
    if (revYrs.length < 2 || oiYrs.length < 2) return null;
    const curRevYr = revYrs[revYrs.length - 1]; const priorRevYr = revYrs[revYrs.length - 2];
    const curOiYr  = oiYrs[oiYrs.length - 1];   const priorOiYr  = oiYrs[oiYrs.length - 2];
    const dRev = (revData[curRevYr] ?? 0) - (revData[priorRevYr] ?? 0);
    const dOi  = (oiData[curOiYr]  ?? 0) - (oiData[priorOiYr]  ?? 0);
    return dRev !== 0 ? (dOi / dRev) * 100 : null;
  })();

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
FCF / EBITDA Conversion: ${fcfEbitdaConv != null ? `${fcfEbitdaConv.toFixed(1)}% — ${fcfEbitdaConv > 70 ? "HIGH CONVERSION (strong cash generation)" : fcfEbitdaConv > 40 ? "MODERATE" : "LOW (CapEx-heavy or working capital drag)"}` : "N/A"}
Incremental Op Margin YoY (ΔEBIT/ΔRev): ${incrEbitdaMargin != null ? `${incrEbitdaMargin.toFixed(1)}% — ${incrEbitdaMargin > 30 ? "STRONG OPERATING LEVERAGE" : incrEbitdaMargin > 15 ? "POSITIVE LEVERAGE" : incrEbitdaMargin > 0 ? "MARGINAL LEVERAGE" : "NEGATIVE (OpEx growing faster than revenue)"}` : "N/A"}
Short Interest: ${facts?.short_float_pct != null ? `${facts.short_float_pct.toFixed(1)}% of float — ${facts.short_float_pct > 15 ? "ELEVATED (crowded short, squeeze risk)" : facts.short_float_pct > 5 ? "MODERATE" : "LOW"}` : "N/A"}${facts?.short_ratio != null ? ` | ${facts.short_ratio.toFixed(1)} days to cover` : ""}
CapEx Intensity: ${facts?.capex != null && facts?.revenue != null && facts.revenue > 0 ? `${(Math.abs(facts.capex) / facts.revenue * 100).toFixed(1)}% of revenue` : "N/A"}
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

  // Forward analyst estimates — critical for valuation section
  const estimateSections = ["valuation", "investment_thesis", "executive_summary", "financial_analysis"];
  const estimatesBlock = estimateSections.includes(sectionId) && Array.isArray(fmpExtended?.analyst_estimates) && (fmpExtended.analyst_estimates as any[]).length > 0
    ? (() => {
        const ests = fmpExtended.analyst_estimates as Array<{
          date?: string; rev_avg?: number; eps_avg?: number; ebitda_avg?: number; num_analysts?: number;
        }>;
        const fmtM2 = (v?: number | null) => v == null ? "N/A" : Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(2)}B` : `$${(v/1e6).toFixed(0)}M`;
        const lines = ests.slice(0, 4).map(e =>
          `${e.date ?? "?"}: Rev ${fmtM2(e.rev_avg)} | EPS ${e.eps_avg != null ? `$${e.eps_avg.toFixed(2)}` : "N/A"} | EBITDA ${fmtM2(e.ebitda_avg)} (${e.num_analysts ?? "?"} analysts)`
        );
        // Compute implied NTM EV/EBITDA if we have the data
        const ntm = ests[0];
        const ntmEvEbitda = ntm?.ebitda_avg && facts?.enterprise_value ? (facts.enterprise_value / ntm.ebitda_avg).toFixed(1) + "x" : null;
        const ntmPE = ntm?.eps_avg && facts?.stock_price ? (facts.stock_price / ntm.eps_avg).toFixed(1) + "x" : null;
        return `\nANALYST FORWARD ESTIMATES (use NTM multiples in valuation):\n${lines.join("\n")}\n${ntmEvEbitda ? `Implied NTM EV/EBITDA: ${ntmEvEbitda}` : ""}${ntmPE ? ` | Implied NTM P/E: ${ntmPE}` : ""}\n`;
      })()
    : "";

  // Geographic revenue segments — for business overview
  const geoSections = ["business_overview", "company_snapshot"];
  const geoBlock = geoSections.includes(sectionId) && Array.isArray(fmpExtended?.geo_segments) && (fmpExtended.geo_segments as any[]).length > 0
    ? (() => {
        const geo = fmpExtended.geo_segments as Array<{ segment?: string; revenue?: number; pct?: number }>;
        const lines = geo.slice(0, 8).map(g =>
          `${g.segment ?? "?"}: $${g.revenue != null ? (Math.abs(g.revenue) >= 1e9 ? (g.revenue/1e9).toFixed(1) + "B" : (g.revenue/1e6).toFixed(0) + "M") : "N/A"}${g.pct != null ? ` (${g.pct.toFixed(0)}%)` : ""}`
        );
        return `\nGEOGRAPHIC REVENUE MIX:\n${lines.join("\n")}\n`;
      })()
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
          pe?: number; ev_ebitda?: number; p_fcf?: number; ev_revenue?: number;
          gross_margin?: number; net_margin?: number; roic?: number;
          revenue_growth?: number; revenue?: number;
        }>;
        const fmtM = (v?: number | null) => v == null ? "—" : Math.abs(v) >= 1e12 ? `$${(v/1e12).toFixed(1)}T` : Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`;
        const fmtPct2 = (v?: number | null) => v == null ? "—" : `${Number(v).toFixed(1)}%`;
        const fmtX = (v?: number | null) => v == null ? "—" : `${Number(v).toFixed(1)}x`;
        const header = `Symbol | Revenue | Mkt Cap | P/E | EV/EBITDA | EV/Rev | Gross Mgn | ROIC | Rev Growth`;
        const rows = peers.slice(0, 6).map(p =>
          `${p.symbol ?? "?"} (${p.name ? p.name.slice(0, 18) : "?"}) | ${fmtM(p.revenue)} | ${fmtM(p.market_cap)} | ${fmtX(p.pe)} | ${fmtX(p.ev_ebitda)} | ${fmtX(p.ev_revenue)} | ${fmtPct2(p.gross_margin)} | ${fmtPct2(p.roic)} | ${fmtPct2(p.revenue_growth)}`
        );
        return `\nPEER COMPARISON (use these exact numbers — reference peers by name in your analysis):\n${header}\n${rows.join("\n")}\n`;
      })()
    : "";

  // Include news for sections that benefit from it
  const newsRelated = ["executive_summary", "news_analysis", "key_risks", "investment_thesis", "management_commentary", "industry_analysis"];
  const newsBlock = newsRelated.includes(sectionId) && fmpExtended?.news_combined
    ? `
RECENT NEWS (${(fmpExtended.news_combined as unknown[]).length} items, use for this section):
${(fmpExtended.news_combined as Array<{date?: string; title: string; summary?: string; category?: string; stock_change?: number}>)
  .slice(0, 15)
  .map(n => `[${n.category ?? "NEWS"}] ${n.date ? n.date.slice(0, 10) : ""} | ${n.title}${n.stock_change != null ? ` (stock: ${n.stock_change > 0 ? "+" : ""}${n.stock_change.toFixed(1)}%)` : ""}${n.summary ? "\n  " + n.summary.slice(0, 180) : ""}`)
  .join("\n")}
` : "";

  const systemPrompt = `You are a managing director-level equity analyst at a top-10 global hedge fund. You write with the analytical precision of Goldman Sachs prime brokerage research and the unhedged directness of a Citadel sector PM who is accountable for P&L. Every sentence you write will be read by a CIO who can fire you for wasting their time with empty prose.

MANDATORY STYLE (violating any rule makes the output worthless):
1. Every claim gets a number in the same sentence — no exceptions. "Gross margins compressed" is worthless. "Gross margins compressed 320bps YoY to 38.4% as input costs rose $1.2B" is acceptable.
2. Active voice only. Never write passive constructions.
3. BANNED PHRASES (using any = automatic rejection): "it is worth noting", "importantly", "going forward", "significant", "robust", "landscape", "headwinds/tailwinds", "value creation", "synergies", "leverage the", "in the coming quarters", "Rule of 40", "Piotroski", "delve", "intersection", "testament to", "poised to", "well-positioned", "at the end of the day", "moving forward", "it should be noted", "plays a crucial role", "remains to be seen"
4. Name specifics: specific products (not "products"), specific competitors by ticker, specific customers by name, specific dates, specific deal names.
5. ZERO REPETITION: Check ALREADY WRITTEN context. If a metric was already cited in a prior section, do NOT restate it — you may reference it in one clause and move on. New ground only.
6. Every risk, thesis point, and recommendation must be falsifiable — state exactly what data would prove you wrong.
7. Write for an expert: skip setup, skip definitions, skip background the reader knows. Every sentence is new information.
8. Target length: ${wordTarget} words. Hit the floor minimum. Do not pad to ceiling.`;

  const userPrompt = `Write the "${sectionTitle}" section for ${ticker} (${companyName}).

INVESTMENT THESIS:
${thesis || "Write from a balanced, analytical perspective with a clear bottom-line view."}

TONE: ${tone ?? "analytical"}

${documentContext ? `ALREADY WRITTEN (maintain consistency, do not repeat):\n${documentContext}\n\n` : ""}${factsBlock}${extBlock}${histBlock}${segmentBlock}${geoBlock}${insiderBlock}${surpriseBlock}${analystRecBlock}${estimatesBlock}${peerBlock}${newsBlock}
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
      max_tokens: 4000,
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
