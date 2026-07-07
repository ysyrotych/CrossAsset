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

  const { ticker, companyName, sector, facts, tone, fmpExtended } = await req.json();

  const ext = fmpExtended ?? {};
  const w52h = facts?.week52_high;
  const price = facts?.stock_price;
  const pctFromHigh = w52h && price ? `${(((price / w52h) - 1) * 100).toFixed(0)}%` : "N/A";

  const pe = facts?.pe_ratio;
  const evEbitda = facts?.ev_ebitda;
  const fcfYield = facts?.free_cash_flow && facts?.market_cap ? ((facts.free_cash_flow / facts.market_cap) * 100).toFixed(1) : null;
  const opMargin = facts?.operating_margin;
  const grossMargin = facts?.gross_margin;

  // EPS surprise history
  const surprises = (ext.earnings_surprises as any[]) ?? [];
  const beats = surprises.filter((e: any) => (e.surprise_pct ?? 0) > 0).length;
  const surpriseStr = surprises.length > 0
    ? `EPS Beat Rate: ${beats}/${surprises.length} quarters (${Math.round(beats / surprises.length * 100)}%). Recent: ${
        surprises.slice(0, 4).map((e: any) =>
          `${e.date?.slice(0,7) ?? "?"}: ${e.surprise_pct != null ? (e.surprise_pct > 0 ? "+" : "") + e.surprise_pct.toFixed(1) + "%" : "?"}`
        ).join(", ")
      }`
    : "EPS surprise history: N/A";

  // Analyst rec
  const rec = ext.analyst_rec as any;
  const analystStr = rec
    ? `Analyst Consensus: ${(rec.strong_buy ?? 0) + (rec.buy ?? 0)} Buy / ${rec.hold ?? 0} Hold / ${(rec.sell ?? 0) + (rec.strong_sell ?? 0)} Sell (${rec.total ?? 0} analysts)`
    : "";

  // Recent news (top 8 items from combined feed)
  const newsItems = (ext.news_combined as any[]) ?? [];
  const newsStr = newsItems.length > 0
    ? `Recent newsflow (${newsItems.length} items):\n` + newsItems.slice(0, 8).map((n: any) =>
        `[${n.category ?? "NEWS"}] ${n.date?.slice(0,10) ?? ""} | ${n.title}${n.stock_change ? ` (stock: ${n.stock_change})` : ""}${n.summary ? `\n  → ${n.summary.slice(0, 120)}` : ""}`
      ).join("\n")
    : "";

  // Insider activity summary
  const insiders = (ext.insider_trading as any[]) ?? [];
  const insiderStr = insiders.length > 0
    ? `Insider Activity: ${insiders.filter((t: any) => /purchase|buy/i.test(t.transaction ?? "")).length} buys / ${insiders.filter((t: any) => /sale|sell/i.test(t.transaction ?? "")).length} sells (last ${Math.min(insiders.length, 10)} txns)`
    : "";

  const prompt = `Generate exactly 5 distinct investment thesis angles for ${ticker} (${companyName}${sector ? `, ${sector}` : ""}).

COMPANY SNAPSHOT:
- Revenue: ${fmt(facts?.revenue)} | Growth YoY: ${pct(facts?.revenue_growth ?? facts?.revenue_growth_yoy)}
- Gross Margin: ${pct(grossMargin)} | Op Margin: ${pct(opMargin)} | FCF Margin: ${pct(facts?.fcf_margin)}
- ROIC: ${pct(facts?.roic)} | Net Debt: ${fmt(facts?.net_debt)} | Market Cap: ${fmt(facts?.market_cap)}
- P/E: ${pe ? Number(pe).toFixed(1) : "N/A"}x | EV/EBITDA: ${evEbitda ? Number(evEbitda).toFixed(1) : "N/A"}x | FCF Yield: ${fcfYield ? fcfYield + "%" : "N/A"}
- Stock: $${price ? Number(price).toFixed(2) : "N/A"} | 52W High: $${facts?.week52_high ? Number(facts.week52_high).toFixed(0) : "N/A"} | vs 52W high: ${pctFromHigh}
- EPS Diluted: $${facts?.eps_diluted ? Number(facts.eps_diluted).toFixed(2) : "N/A"}
${surpriseStr}
${analystStr}
${insiderStr}

${newsStr}

ANALYST PREFERENCE: ${tone ?? "analytical"}

THESIS GENERATION RULES:
- Each thesis must use a FUNDAMENTALLY DIFFERENT angle — not just optimistic/pessimistic variants
- Include: 1-2 pure bull (market underappreciates something specific), 1-2 pure bear (growth priced in won't materialize), 1 contrarian or event-driven angle
- Title: punchy, memorable, uses financial jargon or a vivid image — must make the reader feel the specific tension (e.g. "The Hidden Margin Flywheel", "Consensus Ignores The Inventory Trap", "The Cheapest AI Compounder Nobody Owns")
- core_argument: 2-3 sentences using AT LEAST ONE specific number from the snapshot; must explain WHY the market is currently mispricing this, not just what the company does
- key_assumptions: 3 falsifiable items an analyst could verify on the next earnings call or from public data
- key_risk: the single most important invalidator — specific, not generic
- Reference recent news events where relevant to make theses timely
- NO thesis that could apply to any company — must be specific to ${ticker}'s actual situation

Return ONLY a valid JSON array of exactly 5 objects, no markdown, no preamble:
[
  {
    "title": "Short catchy thesis name (4-7 words)",
    "sentiment": "BULLISH",
    "core_argument": "2-3 sentence core investment argument using specific numbers and company-specific logic. Explain the market mispricing.",
    "key_assumptions": ["Specific falsifiable assumption 1", "Specific falsifiable assumption 2", "Specific falsifiable assumption 3"],
    "key_risk": "The single most important thing that would invalidate this thesis with a number attached"
  }
]`;

  const systemPrompt = `You are a Managing Director-level portfolio manager at a $20B+ long/short equity fund. You've covered this stock for 5 years. You write investment theses that are counterintuitive, specific, and grounded in data. You never write generic sector theses. Your titles are memorable and create conviction. You think in terms of market mispricing, not just "this is a good company."`;

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
        max_tokens: 2500,
        system: systemPrompt,
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
