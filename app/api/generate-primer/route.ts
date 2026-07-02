import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const {
    ticker, companyName, industry, facts, history,
    quarterlyFacts, quarterlyPeriod, sections, fmpExtended, earningsTranscript,
  } = await req.json() as {
    ticker: string;
    companyName: string;
    industry: string;
    facts: Record<string, number>;
    history: Record<string, Record<string, number>>;
    quarterlyFacts: Record<string, number>;
    quarterlyPeriod: string;
    sections: { item: string; title: string; text: string }[];
    fmpExtended?: Record<string, any>;
    earningsTranscript?: string;
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      'data: {"error":"ANTHROPIC_API_KEY not configured"}\ndata: [DONE]\n\n',
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const f = facts;
  const fmt = (v?: number) =>
    v == null ? "N/A"
    : Math.abs(v) >= 1e12 ? `$${(v / 1e12).toFixed(2)}T`
    : Math.abs(v) >= 1e9  ? `$${(v / 1e9).toFixed(1)}B`
    : Math.abs(v) >= 1e6  ? `$${(v / 1e6).toFixed(0)}M`
    : `$${v.toFixed(2)}`;
  const pct  = (v?: number) => v == null ? "N/A" : `${v.toFixed(1)}%`;
  const x    = (v?: number) => v == null ? "N/A" : `${v.toFixed(1)}x`;
  const num  = (v?: number) => v == null ? "N/A" : v.toLocaleString();

  // Build 5-year tables
  const revYears = Object.keys(history.revenue ?? {}).sort().slice(-5);
  const revTable = revYears.map(y => `FY${y.slice(0,4)}: ${fmt(history.revenue?.[y])}`).join(" | ");
  const niTable  = Object.keys(history.net_income ?? {}).sort().slice(-5).map(y => `FY${y.slice(0,4)}: ${fmt(history.net_income?.[y])}`).join(" | ");
  const cfTable  = Object.keys(history.operating_cf ?? {}).sort().slice(-5).map(y => `FY${y.slice(0,4)}: ${fmt(history.operating_cf?.[y])}`).join(" | ");
  const fcfTable = Object.keys(history.free_cash_flow ?? {}).sort().slice(-5).map(y => `FY${y.slice(0,4)}: ${fmt(history.free_cash_flow?.[y])}`).join(" | ");
  const epsTable = Object.keys(history.eps_diluted ?? {}).sort().slice(-5).map(y => `FY${y.slice(0,4)}: $${(history.eps_diluted?.[y] ?? 0).toFixed(2)}`).join(" | ");

  // Margin history
  const marginHistory = revYears.map(y => {
    const rev = history.revenue?.[y];
    const gp  = history.gross_profit?.[y];
    const oi  = history.operating_income?.[y];
    const ni  = history.net_income?.[y];
    if (!rev) return null;
    return `FY${y.slice(0,4)}: Gross ${gp && rev ? pct(gp/rev*100) : "—"} / Op ${oi && rev ? pct(oi/rev*100) : "—"} / Net ${ni && rev ? pct(ni/rev*100) : "—"}`;
  }).filter(Boolean).join(" | ");

  const getText = (item: string) =>
    sections.find(s => s.item === item)?.text?.slice(0, 6000) ?? "Not available";

  const businessText = getText("business");
  const risksText    = getText("risks");
  const mdaText      = getText("mda");

  const roe    = f.net_income && f.equity ? (f.net_income / f.equity * 100) : null;
  const roa    = f.net_income && f.total_assets ? (f.net_income / f.total_assets * 100) : null;
  const netDebt = f.long_term_debt != null && f.cash != null ? f.long_term_debt - f.cash : null;
  const ocfNiRatio = f.operating_cf && f.net_income ? (f.operating_cf / f.net_income) : null;
  const sbcPct = f.sbc_expense && f.revenue ? (f.sbc_expense / f.revenue * 100) : null;
  const capexPct = f.capex && f.revenue ? (Math.abs(f.capex) / f.revenue * 100) : null;
  const intCov = f.operating_income && f.interest_expense ? (f.operating_income / f.interest_expense) : null;

  const ext = fmpExtended ?? {};

  const buildSegStr = (segObj: any) => {
    if (!segObj?.data) return "N/A";
    const total = Object.values(segObj.data as Record<string,number>).reduce((s:number, v:any) => s + Math.abs(v), 0);
    return Object.entries(segObj.data as Record<string,number>)
      .sort(([,a],[,b]) => Math.abs(b as number) - Math.abs(a as number))
      .map(([k, v]) => `${k}: ${fmt(v as number)} (${total > 0 ? ((Math.abs(v as number)/total)*100).toFixed(0) : 0}%)`)
      .join(", ");
  };

  const segStr = buildSegStr(ext.segments);
  const geoStr = buildSegStr(ext.geo_segments);

  const estStr = (ext.analyst_estimates as any[])?.slice(0,3)
    .map((e:any) => `${e.date?.slice(0,7)}: Rev ${fmt(e.rev_avg)}, EPS $${e.eps_avg?.toFixed(2) ?? "N/A"}, EBITDA ${fmt(e.ebitda_avg)}`)
    .join(" | ") ?? "N/A";

  const surpriseStr = (ext.earnings_surprises as any[])?.slice(0,6)
    .map((e:any) => `${e.date?.slice(0,7)}: actual $${e.eps_actual?.toFixed(2) ?? "?"} vs est $${e.eps_est?.toFixed(2) ?? "?"} (${e.surprise_pct != null ? (e.surprise_pct > 0 ? "+" : "") + e.surprise_pct.toFixed(1) + "%" : "?"})`)
    .join("; ") ?? "N/A";

  // Key metrics history (P/E, ROIC over time)
  const kmHistStr = (ext.km_history as any[])?.slice(0,4)
    .map((k:any) => `${k.date?.slice(0,4)}: P/E ${k.pe?.toFixed(1) ?? "—"}x, EV/EBITDA ${k.ev_ebitda?.toFixed(1) ?? "—"}x, ROIC ${k.roic?.toFixed(1) ?? "—"}%`)
    .join(" | ") ?? "N/A";

  // Growth history
  const growthHistStr = (ext.growth_history as any[])?.slice(0,4)
    .map((g:any) => `${g.date?.slice(0,4)}: Rev ${g.rev_growth > 0 ? "+" : ""}${g.rev_growth?.toFixed(1)}%, EPS ${g.eps_growth > 0 ? "+" : ""}${g.eps_growth?.toFixed(1)}%, FCF ${g.fcf_growth > 0 ? "+" : ""}${g.fcf_growth?.toFixed(1)}%`)
    .join(" | ") ?? "N/A";

  // Peer comparison table
  const peerRows = (ext.peer_comparison as any[]) ?? [];
  const peerTable = peerRows.length > 0
    ? "| Ticker | P/E | EV/EBITDA | P/FCF | ROIC | Net Margin |\n|--------|-----|-----------|-------|------|------------|\n" +
      [{ symbol: ticker, pe: f.pe_ratio, ev_ebitda: f.ev_ebitda, p_fcf: f.p_fcf, roic: f.roic, net_margin: f.net_margin_pct }, ...peerRows]
        .map((p:any) => `| ${p.symbol === ticker ? `**${ticker}**` : p.symbol} | ${p.pe ? p.pe+"x" : "—"} | ${p.ev_ebitda ? p.ev_ebitda+"x" : "—"} | ${p.p_fcf ? p.p_fcf+"x" : "—"} | ${p.roic ? p.roic+"%" : "—"} | ${p.net_margin ? p.net_margin+"%" : "—"} |`)
        .join("\n")
    : "Peer data not available.";

  // Recent news
  const newsStr = (ext.recent_news as any[])?.slice(0,8)
    .map((n:any) => `• [${n.date}] ${n.title}${n.summary ? ` — ${n.summary}` : ""}`)
    .join("\n") ?? "N/A";

  // Earnings transcript (truncated) — use more when available from FMP structured transcript
  const transcriptStr = earningsTranscript ? earningsTranscript.slice(0, 8000) : "Not available";

  // Market positioning data
  const week52 = f.week52_high && f.week52_low && f.stock_price
    ? `52W Range: $${f.week52_low.toFixed(2)} – $${f.week52_high.toFixed(2)} | Current: $${f.stock_price.toFixed(2)} (${(((f.stock_price - f.week52_low) / (f.week52_high - f.week52_low)) * 100).toFixed(0)}th percentile of range)`
    : "N/A";
  const shortInterest = f.short_float_pct != null
    ? `Short Interest: ${f.short_float_pct.toFixed(1)}% of float${f.short_ratio != null ? ` | Days to Cover: ${f.short_ratio.toFixed(1)}d` : ""}`
    : "N/A";
  const analystRecStr = (ext as any).analyst_rec
    ? `Analyst Ratings: ${(ext as any).analyst_rec.strong_buy + (ext as any).analyst_rec.buy} Buy / ${(ext as any).analyst_rec.hold} Hold / ${(ext as any).analyst_rec.sell + (ext as any).analyst_rec.strong_sell} Sell (${(ext as any).analyst_rec.total} analysts)`
    : "N/A";
  const insiderStr = (() => {
    const trades = (ext as any).insider_trading as any[] | undefined;
    if (!trades || !trades.length) return "N/A";
    const buys = trades.filter((t:any) => /purchase|buy|acquired/i.test(t.transaction || "")).length;
    const sells = trades.filter((t:any) => /sale|sell|sold|disposed/i.test(t.transaction || "")).length;
    const recent = trades.slice(0, 5).map((t:any) => `${t.name} (${t.title || "?"}) ${t.transaction} $${((t.value || 0) / 1e6).toFixed(1)}M on ${t.date || "?"}`).join("; ");
    return `Net: ${buys} buys / ${sells} sells (last ${trades.length} transactions). Recent: ${recent}`;
  })();

  // Peer median multiples for snapshot table
  const _med = (arr: (number|null)[]) => { const v = arr.filter((x): x is number => x != null).sort((a,b)=>a-b); return v.length ? v[Math.floor(v.length/2)] : null; };
  const peerPeMed = peerRows.length > 0 ? _med(peerRows.map((p:any) => p.pe)) : null;
  const peerEvMed = peerRows.length > 0 ? _med(peerRows.map((p:any) => p.ev_ebitda)) : null;
  const epsSurprises = (ext.earnings_surprises as any[]) ?? [];
  const epsBeats = epsSurprises.filter((e:any) => (e.surprise_pct ?? 0) > 0).length;
  const epsTotal = epsSurprises.length;

  const prompt = `You are a senior equity research analyst at Edgewood Management, an elite institutional asset manager. You are writing an institutional-grade company primer for ${companyName} (${ticker}). This document will be read by portfolio managers, CIOs, and institutional investors. It must match Goldman Sachs / Morgan Stanley research quality.

═══════════════════════════════════════════════════════════════
COMPANY PROFILE
═══════════════════════════════════════════════════════════════
CEO: ${ext.ceo ?? "N/A"} | Sector: ${ext.sector ?? "N/A"} | Industry: ${ext.fmp_industry ?? industry}
Country: ${ext.country ?? "N/A"} | Exchange: ${ext.exchange ?? "N/A"} | IPO: ${ext.ipo_date ?? "N/A"}
Employees: ${f.employees != null ? num(f.employees) : "N/A"} | Website: ${ext.website ?? "N/A"}
Market Cap: ${fmt(f.market_cap)} | Enterprise Value: ${fmt(f.enterprise_value)} | Beta: ${f.beta != null ? f.beta.toFixed(2) : "N/A"}
${week52}
${shortInterest}
${analystRecStr}
PT Consensus: ${f.pt_consensus != null ? `$${f.pt_consensus.toFixed(0)} (${f.pt_low != null ? `range $${f.pt_low.toFixed(0)}–$${f.pt_high?.toFixed(0)}` : "high/low N/A"})` : "N/A"}

${ext.company_description ? `COMPANY DESCRIPTION: ${ext.company_description.slice(0, 500)}` : ""}

═══════════════════════════════════════════════════════════════
INCOME STATEMENT (MOST RECENT ANNUAL)
═══════════════════════════════════════════════════════════════
Revenue: ${fmt(f.revenue)} | Gross Profit: ${fmt(f.gross_profit)} | Gross Margin: ${pct(f.gross_margin_pct)}
R&D: ${fmt(f.rd_expense)} (${f.rd_expense && f.revenue ? pct(f.rd_expense/f.revenue*100) : "N/A"} of Rev) | SG&A: ${fmt(f.sga_expense)}
Operating Income: ${fmt(f.operating_income)} | Op Margin: ${pct(f.operating_margin_pct)}
EBITDA: ${fmt(f.ebitda)} | D&A: ${fmt(f.da_expense)}
Interest Expense: ${fmt(f.interest_expense)} | Interest Coverage: ${intCov ? intCov.toFixed(1)+"x" : "N/A"}
Pretax Income: ${fmt(f.pretax_income)} | Tax Rate: ${pct(f.effective_tax_rate)}
Net Income: ${fmt(f.net_income)} | Net Margin: ${pct(f.net_margin_pct)}
EPS Diluted: ${f.eps_diluted != null ? `$${f.eps_diluted.toFixed(2)}` : "N/A"} | EPS Basic: ${f.eps_basic != null ? `$${f.eps_basic.toFixed(2)}` : "N/A"}
Diluted Shares: ${f.shares_diluted_wtd != null ? fmt(f.shares_diluted_wtd) : "N/A"}

═══════════════════════════════════════════════════════════════
BALANCE SHEET
═══════════════════════════════════════════════════════════════
Cash & Equivalents: ${fmt(f.cash)} | Short-Term Investments: ${fmt(f.short_term_investments)}
Accounts Receivable: ${fmt(f.accounts_receivable)} | Inventory: ${fmt(f.inventory)}
Current Assets: ${fmt(f.current_assets)} | PPE (net): ${fmt(f.ppe_net)}
Goodwill: ${fmt(f.goodwill)} | Intangibles: ${fmt(f.intangibles)}
Total Assets: ${fmt(f.total_assets)}
Accounts Payable: ${fmt(f.accounts_payable)} | Current Liabilities: ${fmt(f.current_liabilities)}
Long-Term Debt: ${fmt(f.long_term_debt)} | Net Debt: ${netDebt != null ? fmt(netDebt) : "N/A"}
Total Liabilities: ${fmt(f.total_liabilities)} | Equity: ${fmt(f.equity)}
Retained Earnings: ${fmt(f.retained_earnings)}

═══════════════════════════════════════════════════════════════
CASH FLOW STATEMENT
═══════════════════════════════════════════════════════════════
Operating CF: ${fmt(f.operating_cf)} | CapEx: ${fmt(f.capex)} (${capexPct ? pct(capexPct) : "N/A"} of Rev)
Free Cash Flow: ${fmt(f.free_cash_flow)} | FCF Margin: ${f.free_cash_flow && f.revenue ? pct(f.free_cash_flow/f.revenue*100) : "N/A"}
SBC: ${fmt(f.sbc_expense)} (${sbcPct ? pct(sbcPct) : "N/A"} of Rev) | D&A: ${fmt(f.da_expense)}
Buybacks: ${fmt(f.buybacks)} | Dividends Paid: ${fmt(f.dividends_paid)}
Cash Quality (OCF/NI): ${ocfNiRatio ? ocfNiRatio.toFixed(2)+"x" : "N/A"}

═══════════════════════════════════════════════════════════════
RETURNS & EFFICIENCY
═══════════════════════════════════════════════════════════════
ROE: ${roe != null ? pct(roe) : "N/A"} | ROA: ${roa != null ? pct(roa) : "N/A"} | ROIC: ${f.roic != null ? pct(f.roic) : "N/A"}
Current Ratio: ${x(f.current_ratio)} | Debt/Equity: ${x(f.debt_to_equity)}
Dividend Yield: ${pct(f.dividend_yield)} | FCF Yield: ${pct(f.fcf_yield)}

═══════════════════════════════════════════════════════════════
VALUATION MULTIPLES
═══════════════════════════════════════════════════════════════
P/E: ${x(f.pe_ratio)} | EV/EBITDA: ${x(f.ev_ebitda)} | P/FCF: ${x(f.p_fcf)}
P/Sales: ${x(f.p_sales)} | P/Book: ${x(f.p_book)} | EV/Revenue: ${x(f.ev_revenue)}

HISTORICAL VALUATION TREND:
${kmHistStr}

═══════════════════════════════════════════════════════════════
GROWTH PROFILE
═══════════════════════════════════════════════════════════════
YoY Growth (most recent): Revenue ${f.revenue_growth_yoy != null ? pct(f.revenue_growth_yoy) : "N/A"} | EPS ${f.eps_growth_yoy != null ? pct(f.eps_growth_yoy) : "N/A"} | FCF ${f.fcf_growth_yoy != null ? pct(f.fcf_growth_yoy) : "N/A"} | Net Income ${f.ni_growth_yoy != null ? pct(f.ni_growth_yoy) : "N/A"}

HISTORICAL GROWTH RATES:
${growthHistStr}

5-YEAR REVENUE TREND: ${revTable || "N/A"}
5-YEAR NET INCOME:    ${niTable || "N/A"}
5-YEAR OPERATING CF:  ${cfTable || "N/A"}
5-YEAR FREE CASH FLOW:${fcfTable || "N/A"}
5-YEAR EPS DILUTED:   ${epsTable || "N/A"}

5-YEAR MARGIN EVOLUTION:
${marginHistory || "N/A"}

═══════════════════════════════════════════════════════════════
MOST RECENT QUARTER (${quarterlyPeriod})
═══════════════════════════════════════════════════════════════
Revenue: ${fmt(quarterlyFacts.revenue)} | Gross Margin: ${pct(quarterlyFacts.gross_margin_pct)} | Op Margin: ${pct(quarterlyFacts.operating_margin_pct)} | Net Margin: ${pct(quarterlyFacts.net_margin_pct)}
Net Income: ${fmt(quarterlyFacts.net_income)} | EPS: ${quarterlyFacts.eps_diluted != null ? `$${quarterlyFacts.eps_diluted.toFixed(2)}` : "N/A"} | FCF: ${fmt(quarterlyFacts.free_cash_flow)}

═══════════════════════════════════════════════════════════════
ANALYST CONSENSUS
═══════════════════════════════════════════════════════════════
FMP Rating: ${ext.fmp_rating ?? "N/A"} | Price Target: ${f.pt_consensus != null ? fmt(f.pt_consensus) : "N/A"} | # Analysts: ${f.num_analysts != null ? f.num_analysts.toFixed(0) : "N/A"}
Forward Estimates: ${estStr}
EPS Surprise History (last 6Q): ${surpriseStr}

═══════════════════════════════════════════════════════════════
REVENUE SEGMENTS (latest annual)
═══════════════════════════════════════════════════════════════
Business Segments: ${segStr}
Geographic Breakdown: ${geoStr}

═══════════════════════════════════════════════════════════════
PEER COMPARISON
═══════════════════════════════════════════════════════════════
${peerTable}

═══════════════════════════════════════════════════════════════
RECENT NEWS & CATALYSTS (last 30 days)
═══════════════════════════════════════════════════════════════
${newsStr}

═══════════════════════════════════════════════════════════════
INSIDER TRADING ACTIVITY (Form 4)
═══════════════════════════════════════════════════════════════
${insiderStr}

═══════════════════════════════════════════════════════════════
EARNINGS CALL / MOST RECENT 8-K FILING
═══════════════════════════════════════════════════════════════
${transcriptStr}

═══════════════════════════════════════════════════════════════
10-K BUSINESS SECTION (Item 1)
═══════════════════════════════════════════════════════════════
${businessText}

═══════════════════════════════════════════════════════════════
10-K RISK FACTORS (Item 1A)
═══════════════════════════════════════════════════════════════
${risksText}

═══════════════════════════════════════════════════════════════
10-K MD&A (Item 7)
═══════════════════════════════════════════════════════════════
${mdaText}

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Write a complete institutional equity research primer using EXACTLY these section headers (## for main sections, ### for subsections). DO NOT add any text before "## EXECUTIVE SUMMARY".

## EXECUTIVE SUMMARY
Write 6-8 bullet points (• prefix). Cover: (1) what the company does and why it matters, (2) the core investment question right now, (3) the most compelling financial characteristic with exact numbers, (4) the growth trajectory in concrete numbers, (5) key valuation context vs peers, (6) the single biggest risk that could derail the thesis, (7) the bottom line verdict for a long-term institutional investor.

## COMPANY SNAPSHOT
Pipe-delimited table:
Ticker | ${ticker}
Exchange | [exchange]
Sector | [sector]
Industry | ${industry}
Market Cap | ${fmt(f.market_cap)}
Enterprise Value | ${fmt(f.enterprise_value)}
Revenue (FY) | ${fmt(f.revenue)}
EBITDA | ${fmt(f.ebitda)}
FCF | ${fmt(f.free_cash_flow)}
Gross Margin | ${pct(f.gross_margin_pct)}
Operating Margin | ${pct(f.operating_margin_pct)}
Net Margin | ${pct(f.net_margin_pct)}
FCF Margin | ${f.free_cash_flow && f.revenue ? pct(f.free_cash_flow/f.revenue*100) : "N/A"}
EPS Diluted | ${f.eps_diluted != null ? `$${f.eps_diluted.toFixed(2)}` : "N/A"}
Net Debt | ${netDebt != null ? fmt(netDebt) : "N/A"}
ROE | ${roe != null ? pct(roe) : "N/A"}
ROIC | ${f.roic != null ? pct(f.roic) : "N/A"}
P/E | ${x(f.pe_ratio)} ${peerPeMed ? `(peer median: ${peerPeMed.toFixed(1)}x)` : ""}
EV/EBITDA | ${x(f.ev_ebitda)} ${peerEvMed ? `(peer median: ${peerEvMed.toFixed(1)}x)` : ""}
EPS Beat Rate (8Q) | ${epsBeats}/${epsTotal} quarters
Beta | ${f.beta != null ? f.beta.toFixed(2) : "N/A"}
Short Interest | ${f.short_float_pct != null ? pct(f.short_float_pct) + " of float" : "N/A"}
Analyst Rating | ${analystRecStr}

## BUSINESS OVERVIEW

### Company Background
2 paragraphs (5-6 sentences each). Founding, history, what the company does today, how it makes money, and its structural position. Be specific about the business model, not generic.

### Product Portfolio & Revenue Mix
2-3 paragraphs. Each major segment: what it is, how it works, revenue contribution %, growth rate, margin profile if available. Reference the segment data provided. Explain the economic logic of the product/service.

### Customers, End Markets & Geographic Exposure
1-2 paragraphs. Who buys, why they buy, switching costs, customer concentration, geographic revenue split. Use the geographic segment data. Identify any meaningful dependency or customer concentration risk.

## INDUSTRY ANALYSIS

### Market Structure & Competitive Dynamics
2-3 paragraphs. Name the key competitors. What's the industry structure (oligopoly, fragmented, winner-take-most)? What are the barriers to entry? How does pricing work? Is this a market share game or a market growth game? Be specific — name companies.

### Key Industry Drivers & Cycle
2 paragraphs. What are the 3-4 macro/structural drivers of demand? Is there cyclicality (and where are we in the cycle)? What secular trends are accelerating or threatening the industry? Be forward-looking.

### Competitive Position
2 paragraphs. What specifically makes ${companyName} better (or worse) than competitors? Quantify the moat where possible — pricing power evidence, market share, cost structure advantages, network effects, switching costs. Reference actual data from the filing.

## FINANCIAL ANALYSIS

### Revenue & Profitability Trends
3 paragraphs. Start with the 5-year revenue CAGR from the data provided. Analyze what's driving growth (volume vs. price vs. mix). Explain margin dynamics — why margins expanded or compressed. Reference specific numbers from the 5-year history and margin evolution. Address quality of growth (organic vs. acquired).

### Balance Sheet & Capital Allocation
2 paragraphs. Assess the balance sheet health: net debt/cash position, leverage ratio, interest coverage. How does management deploy capital — M&A, buybacks, dividends, R&D? Is capital allocation disciplined or value-destructive? Reference buyback and dividend data.

### Free Cash Flow & CapEx
2 paragraphs. Analyze FCF generation quality: FCF margin, OCF-to-NI ratio (cash quality score), CapEx intensity as % of revenue. Is the business asset-light or capital-intensive? What does FCF conversion look like over 5 years? How sustainable is the FCF?

### Quality of Earnings & Cash Conversion
1-2 paragraphs. Assess earnings quality: OCF/NI ratio ${ocfNiRatio ? ocfNiRatio.toFixed(2)+"x" : "N/A"} — what does this say about accrual risk? Comment on SBC as % of revenue (${sbcPct ? pct(sbcPct) : "N/A"}) and its impact on true FCF. Any red flags in working capital trends?

## VALUATION FRAMEWORK

### Current Valuation vs. Historical Range
2 paragraphs. Context: the company trades at ${x(f.pe_ratio)} P/E, ${x(f.ev_ebitda)} EV/EBITDA. How does this compare to its historical multiple range (use the historical valuation data)? Is the current multiple premium or discount to history, and why? What does the market appear to be pricing in?

### Peer Valuation Context
1-2 paragraphs. Compare the subject company's multiples directly to the peers listed. Is it at a premium or discount? Is the premium/discount justified by growth, returns, or quality differentials? Reference specific peer multiples from the comparison table.

### Implied Scenarios
Write a compact 3-scenario analysis:
**Bull Case ($[calculate implied price]):** [2-3 sentences on what multiple expansion + earnings upside drives price]
**Base Case ($[calculate implied price]):** [2 sentences on consensus + current multiple]
**Bear Case ($[calculate implied price]):** [2-3 sentences on multiple compression + downside risk]
Use the FCF yield or EV/EBITDA as the anchor for the price targets. Show your math briefly.

## MANAGEMENT COMMENTARY & GUIDANCE

### Earnings Call Highlights
2-3 paragraphs synthesizing what management said in the most recent earnings call/8-K. Pull specific quotes or paraphrases if available. What tone did management strike? What did they emphasize? What surprised analysts? If transcript data is limited, note it and focus on what is available.

### Forward Guidance & Outlook
1-2 paragraphs. Synthesize the forward estimates and any guidance provided. How does management guidance compare to consensus? What are the key KPIs management is focusing on going forward? What catalysts could cause guidance to be raised or lowered?

## MANAGEMENT & GOVERNANCE

### Leadership & Track Record
2 paragraphs. Assess the CEO and leadership team quality: tenure, background, prior track record. Have they executed on stated goals? How credible is management guidance based on historical EPS surprise track record? Reference the EPS surprise history to assess execution reliability.

### Capital Allocation Discipline
2 paragraphs. Evaluate capital allocation quality over the past 5 years: when and at what prices did they buy back stock? M&A history — did acquisitions create or destroy value? How do they balance growth investment (R&D CapEx at ${capexPct ? pct(capexPct) : "N/A"} of revenue) vs. shareholder returns? Assess ROIC trajectory as evidence of capital discipline.

## KEY RISKS
Write 7 specific, material risks (• prefix). For each: **[Risk Name in Bold]** — explain the mechanism, quantify the exposure where possible, and rate Probability (Low/Medium/High) and Impact (Low/Medium/High). No generic boilerplate. Only risks specific to ${companyName}'s actual business model and financial structure.

## INVESTMENT THESIS

### Bull Case
6 bullet points (• prefix). Specific catalysts, time horizons, exact metrics that need to improve, and implied upside. Each bullet must have a number in it.

### Bear Case
6 bullet points (• prefix). Specific risks materializing, what metrics would signal deterioration, and implied downside. Each bullet must have a number in it.

### Analyst Note
2-3 sentences: The single most important variable to monitor. The key debate on the stock right now. What an institutional investor must believe to own this stock at the current valuation.

## KEY METRICS DASHBOARD
Write a compact monitoring table with exactly this format (pipe-delimited):

| KPI | Current | Threshold to Watch | Why It Matters |
|-----|---------|-------------------|----------------|
| [metric 1] | [value] | [bull: above X / bear: below Y] | [1-sentence explanation] |
[Repeat for 6-8 most important KPIs specific to this business model]

Choose metrics that are: (1) directly measurable from public disclosures, (2) leading indicators (not lagging), (3) specific to ${companyName}'s monetization model. For a SaaS company, use NRR/churn. For an advertising company, use CPM/impressions growth. For a bank, use NIM/credit quality. Be sector-specific, not generic.

## EARNINGS CALL QUESTIONS
Write 8 sharp, specific questions an institutional investor would ask in the Q&A. Format:
**Q[n]: [Question]** — [Why this question matters / what answer would be bullish vs bearish]

Questions must be: (1) directly answerable from company data (2) not already answered in the prepared remarks (3) specific enough that a vague answer would itself be signal. Include at least 2 questions about forward guidance, 2 about competitive dynamics, 2 about capital allocation, and 2 about risks.

---

RULES:
- Every claim must be grounded in the data provided. Never fabricate numbers.
- Be institutional: direct, no hedging, no "it is worth noting," no preamble
- Use exact figures throughout — no vague language like "significant" without a number
- Target 3,500-4,000 words total
- Do NOT add any text before "## EXECUTIVE SUMMARY"
- When transcript data is "Not available", synthesize from the MD&A and financial trends instead`;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(
      `data: ${JSON.stringify({ error: `Claude error: ${err.slice(0, 200)}` })}\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const j = JSON.parse(raw);
            if (j.type === "content_block_delta" && j.delta?.type === "text_delta" && j.delta.text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: j.delta.text })}\n\n`));
            }
            if (j.type === "message_stop") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            }
          } catch { /* skip */ }
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
