import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fmt(v: number | null | undefined): string {
  if (v == null) return "N/A";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}
function pct(v: number | null | undefined): string {
  return v != null ? `${Number(v).toFixed(1)}%` : "N/A";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set", theses: [] }, { status: 500 });

  const { ticker, companyName, sector, facts, tone } = await req.json();

  const w52h = facts?.week52_high;
  const price = facts?.stock_price;
  const pctFromHigh = w52h && price ? `${(((price / w52h) - 1) * 100).toFixed(0)}%` : "N/A";

  const pe = facts?.pe_ratio;
  const evEbitda = facts?.ev_ebitda;
  const fcfYield = facts?.free_cash_flow && facts?.market_cap ? ((facts.free_cash_flow / facts.market_cap) * 100).toFixed(1) : null;
  const opMargin = facts?.operating_margin;
  const grossMargin = facts?.gross_margin;

  const prompt = `Generate exactly 5 distinct investment thesis angles for ${ticker} (${companyName}${sector ? `, ${sector}` : ""}).

Company snapshot:
- Revenue: ${fmt(facts?.revenue)} | Growth YoY: ${pct(facts?.revenue_growth ?? facts?.revenue_growth_yoy)}
- Gross Margin: ${pct(grossMargin)} | Op Margin: ${pct(opMargin)} | FCF Margin: ${pct(facts?.fcf_margin)}
- ROIC: ${pct(facts?.roic)} | Net Debt: ${fmt(facts?.net_debt)} | Market Cap: ${fmt(facts?.market_cap)}
- P/E: ${pe ? Number(pe).toFixed(1) : "N/A"} | EV/EBITDA: ${evEbitda ? Number(evEbitda).toFixed(1) : "N/A"} | FCF Yield: ${fcfYield ? fcfYield + "%" : "N/A"}
- Stock: $${price ? Number(price).toFixed(2) : "N/A"} | 52W High: $${facts?.week52_high ? Number(facts.week52_high).toFixed(0) : "N/A"} | vs 52W high: ${pctFromHigh}
- EPS: $${facts?.eps_diluted ? Number(facts.eps_diluted).toFixed(2) : "N/A"}
- Analyst tone preference: ${tone ?? "analytical"}

Rules for the 5 theses:
- Each must be a FUNDAMENTALLY DIFFERENT angle — not just optimistic/pessimistic variants of the same story
- Include: 1-2 pure bull (market underappreciates something specific in the numbers), 1-2 pure bear (market is pricing in growth that won't materialize), 1 contrarian or event-driven angle
- Give each a punchy, memorable title using financial jargon or a vivid image (e.g. "The Hidden Margin Flywheel", "The Valuation Mirage", "Priced for Perfection It Can't Deliver")
- core_argument must reference at least one specific number from the snapshot above
- key_assumptions must be falsifiable — things you could check in an earnings call
- Be specific to THIS company's actual numbers — no generic thesis that could apply to any company in the sector

Return ONLY a valid JSON array of exactly 5 objects, no markdown, no preamble:
[
  {
    "title": "Short catchy thesis name",
    "sentiment": "BULLISH",
    "core_argument": "2-3 sentence core investment argument using specific numbers and company-specific logic",
    "key_assumptions": ["Specific assumption 1", "Specific assumption 2", "Specific assumption 3"],
    "key_risk": "The single most important thing that would invalidate this thesis"
  }
]`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const j = await r.json();
    const text: string = j.content?.[0]?.text ?? "[]";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const theses = JSON.parse(cleaned);
    return NextResponse.json({ theses });
  } catch (e) {
    return NextResponse.json({ error: String(e), theses: [] }, { status: 500 });
  }
}
