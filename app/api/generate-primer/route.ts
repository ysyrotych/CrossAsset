import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const {
    ticker, companyName, industry, facts, history,
    quarterlyFacts, quarterlyPeriod, sections,
  } = await req.json() as {
    ticker: string;
    companyName: string;
    industry: string;
    facts: Record<string, number>;
    history: Record<string, Record<string, number>>;
    quarterlyFacts: Record<string, number>;
    quarterlyPeriod: string;
    sections: { item: string; title: string; text: string }[];
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
  const pct = (v?: number) => v == null ? "N/A" : `${v.toFixed(1)}%`;
  const x = (v?: number) => v == null ? "N/A" : `${v.toFixed(1)}x`;

  // Build 5-year revenue table
  const revYears = Object.keys(history.revenue ?? {}).sort().slice(-5);
  const revTable = revYears.map(y => `${y.slice(0,4)}: ${fmt(history.revenue?.[y])}`).join(" | ");

  // Build key section text
  const getText = (item: string) =>
    sections.find(s => s.item === item)?.text?.slice(0, 6000) ?? "Not available";

  const businessText  = getText("business");
  const risksText     = getText("risks");
  const mdaText       = getText("mda");
  const mdaQ          = getText("mda");

  const roe  = f.net_income && f.equity ? (f.net_income / f.equity * 100) : null;
  const roa  = f.net_income && f.total_assets ? (f.net_income / f.total_assets * 100) : null;
  const netDebt = f.long_term_debt != null && f.cash != null ? f.long_term_debt - f.cash : null;

  const prompt = `You are a senior equity research analyst at Edgewood Management, an institutional asset manager. You are writing an institutional-grade company primer for ${companyName} (${ticker}).

FINANCIAL DATA:
Revenue: ${fmt(f.revenue)} | Gross Margin: ${pct(f.gross_margin_pct)} | Op Margin: ${pct(f.operating_margin_pct)} | Net Margin: ${pct(f.net_margin_pct)}
EBITDA: ${fmt(f.ebitda)} | FCF: ${fmt(f.free_cash_flow)} | Operating CF: ${fmt(f.operating_cf)}
Net Income: ${fmt(f.net_income)} | EPS Diluted: ${f.eps_diluted != null ? `$${f.eps_diluted.toFixed(2)}` : "N/A"}
Cash: ${fmt(f.cash)} | LT Debt: ${fmt(f.long_term_debt)} | Net Debt: ${netDebt != null ? fmt(netDebt) : "N/A"} | Total Assets: ${fmt(f.total_assets)} | Equity: ${fmt(f.equity)}
ROE: ${roe != null ? pct(roe) : "N/A"} | ROA: ${roa != null ? pct(roa) : "N/A"}
R&D: ${fmt(f.rd_expense)} | CapEx: ${fmt(f.capex)} | SBC: ${fmt(f.sbc_expense)} | D&A: ${fmt(f.da_expense)}
Interest Expense: ${fmt(f.interest_expense)} | Pretax Income: ${fmt(f.pretax_income)} | Tax Rate: ${pct(f.effective_tax_rate)}
EPS Basic: ${f.eps_basic != null ? `$${f.eps_basic.toFixed(2)}` : "N/A"} | Shares (diluted): ${f.shares_diluted_wtd != null ? fmt(f.shares_diluted_wtd) : "N/A"}

5-YEAR REVENUE TREND: ${revTable || "N/A"}
5-YEAR NET INCOME: ${Object.keys(history.net_income ?? {}).sort().slice(-5).map(y => `${y.slice(0,4)}: ${fmt(history.net_income?.[y])}`).join(" | ") || "N/A"}
5-YEAR OPERATING CF: ${Object.keys(history.operating_cf ?? {}).sort().slice(-5).map(y => `${y.slice(0,4)}: ${fmt(history.operating_cf?.[y])}`).join(" | ") || "N/A"}
5-YEAR FCF: ${Object.keys(history.free_cash_flow ?? {}).sort().slice(-5).map(y => `${y.slice(0,4)}: ${fmt(history.free_cash_flow?.[y])}`).join(" | ") || "N/A"}

MOST RECENT QUARTER (${quarterlyPeriod}):
Revenue: ${fmt(quarterlyFacts.revenue)} | Gross Margin: ${pct(quarterlyFacts.gross_margin_pct)} | Op Margin: ${pct(quarterlyFacts.operating_margin_pct)} | Net Margin: ${pct(quarterlyFacts.net_margin_pct)}
Net Income: ${fmt(quarterlyFacts.net_income)} | EPS: ${quarterlyFacts.eps_diluted != null ? `$${quarterlyFacts.eps_diluted.toFixed(2)}` : "N/A"} | FCF: ${fmt(quarterlyFacts.free_cash_flow)}

INDUSTRY: ${industry}

10-K BUSINESS SECTION:
${businessText}

10-K RISK FACTORS:
${risksText}

10-K MD&A:
${mdaText}

---

Write a complete institutional equity research primer. Use EXACTLY this format with these EXACT section headers (use markdown ## for headers and ### for subheaders):

## EXECUTIVE SUMMARY
Write 4-6 bullet points (using • prefix). Each bullet is 2-3 sentences covering: what the company does, why it matters now, the core investment question, key financial characteristics, the dominant risk, and the bottom line for investors. Be specific — use exact numbers.

## COMPANY SNAPSHOT
Write a concise table in this format (pipe-delimited):
Ticker | ${ticker}
Exchange | [exchange name]
Sector | [sector]
Industry | ${industry}
Revenue (FY) | ${fmt(f.revenue)}
Operating Margin | ${pct(f.operating_margin_pct)}
Net Margin | ${pct(f.net_margin_pct)}
EBITDA | ${fmt(f.ebitda)}
FCF | ${fmt(f.free_cash_flow)}
EPS Diluted | ${f.eps_diluted != null ? `$${f.eps_diluted.toFixed(2)}` : "N/A"}
Net Debt / Cash | ${netDebt != null ? fmt(netDebt) : "N/A"}
Total Assets | ${fmt(f.total_assets)}
Equity | ${fmt(f.equity)}
ROE | ${roe != null ? pct(roe) : "N/A"}
ROA | ${roa != null ? pct(roa) : "N/A"}

## BUSINESS OVERVIEW

### Company Background
Write 2 paragraphs (4-6 sentences each): founding and history, what the company does today, its competitive positioning.

### Product Portfolio & Revenue Mix
Write 2-3 paragraphs describing the main revenue segments or product lines. Include specific revenue contribution percentages where inferable. Reference segment-level data from the filing.

### Customers, End Markets & Geographic Exposure
Write 1-2 paragraphs on customer concentration, end markets served, and geographic revenue breakdown where available.

## INDUSTRY ANALYSIS

### Market Structure & Competitive Dynamics
Write 2-3 paragraphs on the competitive landscape: how many players, who the key competitors are, barriers to entry, pricing dynamics. Be specific about the industry structure.

### Key Industry Drivers & Cycle
Write 2 paragraphs on the main demand drivers, supply dynamics, and any cyclicality or structural secular growth trends.

### Competitive Position
Write 2 paragraphs assessing ${companyName}'s specific competitive advantages, moat, market share, and any structural advantages or vulnerabilities.

## FINANCIAL ANALYSIS

### Revenue & Profitability Trends
Write 2-3 paragraphs analyzing the revenue trajectory, margin structure, and profitability trend. Reference specific numbers from the 5-year history. Comment on drivers of margin expansion or compression.

### Balance Sheet & Capital Allocation
Write 2 paragraphs on balance sheet strength, liquidity, debt profile, and how management deploys capital (buybacks, dividends, M&A, R&D).

### Free Cash Flow & CapEx
Write 2 paragraphs on FCF generation, CapEx intensity, FCF conversion, and what this means for future capital returns or growth investment.

## KEY RISKS
Write 5 specific, material risks as bullet points (• prefix). For each: name the risk in bold, explain the mechanism, and rate probability/impact. Reference specific filing language or financial metrics. No generic boilerplate.

## INVESTMENT THESIS

### Bull Case
Write 4-5 bullet points (• prefix) on the bull case. Specific catalysts, time horizon considerations, what needs to go right.

### Bear Case
Write 4-5 bullet points (• prefix) on the bear case. Specific risks, what could go wrong, under what scenarios.

### Analyst Note
Write 2-3 sentences synthesizing: the single most important thing to monitor, the key debate on the stock, and what an investor needs to believe to own it.

---

RULES:
- Use exact numbers from the financial data throughout. Never say "strong" without quantifying it.
- Be institutional: direct, no hedging, no preamble, no "it is worth noting"
- Total length: 1,400-2,000 words
- Reference specific filing language or disclosures where relevant
- Do NOT add any text before "## EXECUTIVE SUMMARY"`;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
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
