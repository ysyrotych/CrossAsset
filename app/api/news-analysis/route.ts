import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { ticker, companyName, sector, newsItems, facts } = await req.json() as {
    ticker: string;
    companyName: string;
    sector?: string;
    newsItems?: any[];
    facts?: Record<string, any>;
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("ANTHROPIC_API_KEY not configured", { status: 500 });
  }

  const catOrder = ['EARNINGS','GUIDANCE','ANALYST ACTION','M&A','REGULATORY/LEGAL','MANAGEMENT','CAPITAL ALLOCATION','PRODUCT/BUSINESS','INSIDER ACTIVITY','GENERAL'];
  const byCategory: Record<string, any[]> = {};
  for (const item of (newsItems ?? [])) {
    const cat = item.category ?? 'GENERAL';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }

  let newsBlock = '';
  for (const cat of catOrder) {
    const items = byCategory[cat];
    if (!items?.length) continue;
    newsBlock += `\n[${cat}]\n`;
    for (const n of items) {
      const change = n.stock_change ? ` | Stock reaction: ${n.stock_change}` : '';
      newsBlock += `• ${n.date} [${n.source}] ${n.title}${change}\n`;
      if (n.summary) newsBlock += `  "${n.summary}"\n`;
    }
  }

  const fmt = (v: any) =>
    v == null ? 'N/A'
    : Math.abs(v) >= 1e12 ? `$${(v/1e12).toFixed(1)}T`
    : Math.abs(v) >= 1e9  ? `$${(v/1e9).toFixed(1)}B`
    : Math.abs(v) >= 1e6  ? `$${(v/1e6).toFixed(0)}M`
    : `$${Number(v).toFixed(0)}`;
  const fmtPct = (v: any) => v != null ? `${Number(v).toFixed(1)}%` : 'N/A';

  // Pre-compute 30-day sentiment
  const posTerms = ['beat','raise','launch','win','grow','record','strong','exceed','upgrade','buy','positive','initiate','partnership'];
  const negTerms = ['cut','miss','decline','drop','fall','concern','risk','probe','loss','lower','warn','resign','downgrade','short'];
  const now = Date.now();
  const last30Items = (newsItems ?? []).filter((n: any) => {
    try { return new Date(n.date).getTime() >= now - 30 * 24 * 60 * 60 * 1000; } catch { return false; }
  });
  let sentScore = 0;
  for (const n of last30Items) {
    const tl = (n.title ?? '').toLowerCase();
    sentScore += posTerms.filter(t => tl.includes(t)).length;
    sentScore -= negTerms.filter(t => tl.includes(t)).length;
  }
  const sentLabel = sentScore > 3 ? 'POSITIVE' : sentScore < -3 ? 'NEGATIVE' : 'MIXED';

  const price = facts?.stock_price;
  const high52 = facts?.week52_high;
  const pricePct52w = price && high52 ? `${((price / high52 - 1) * 100).toFixed(1)}% from 52W high` : null;

  const prompt = `You are a senior equity research analyst at a top-tier investment bank. You have ${newsItems?.length ?? 0} news items about ${ticker} (${companyName}, ${sector ?? 'unknown'} sector) from the last 90 days.

COMPANY CONTEXT:
- Stock price: ${price ? `$${Number(price).toFixed(2)}` : 'N/A'}${pricePct52w ? ` (${pricePct52w})` : ''} | Market cap: ${fmt(facts?.market_cap)}
- Revenue (LTM): ${fmt(facts?.revenue)} | Revenue growth YoY: ${fmtPct(facts?.revenue_growth ?? facts?.revenue_growth_yoy)}
- FCF margin: ${fmtPct(facts?.fcf_margin)} | Gross margin: ${fmtPct(facts?.gross_margin)}
- Net debt: ${fmt(facts?.net_debt)} | ROIC: ${fmtPct(facts?.roic)}
- 52-week range: $${facts?.week52_low != null ? Number(facts.week52_low).toFixed(0) : '?'} – $${high52 != null ? Number(high52).toFixed(0) : '?'}
- Pre-computed 30-day news sentiment: ${sentLabel} (score: ${sentScore > 0 ? '+' : ''}${sentScore}, based on ${last30Items.length} items in last 30 days)

NEWS ITEMS (${newsItems?.length ?? 0} items, last 90 days):
${newsBlock}

REQUIRED OUTPUT — write as a senior analyst briefing a portfolio manager. Use these exact ## headers in this order:

## FLASH ASSESSMENT
SIGNAL: [BULLISH / BEARISH / MIXED] | PATTERN: [Cluster Break / Deterioration / Recovery / Debate / Normal] | CONVICTION: [HIGH / MEDIUM / LOW]
[One sentence only: the single most important thing this news flow tells us about this stock right now.]

## THE NARRATIVE RIGHT NOW
What is the dominant story the market is telling about this company through its news flow? What has shifted in the last 30 days vs prior? Start with a conviction statement.

## EARNINGS & FINANCIAL SIGNALS
What do earnings news, guidance updates, and analyst estimate revisions collectively signal? Are beats expanding or compressing? Reference specific dates and numbers.

## COMPETITIVE & STRATEGIC POSITION
What do product launches, partnerships, customer wins/losses, and competitor news tell us about strategic momentum? Name specific developments.

## MANAGEMENT CREDIBILITY & INSIDER SIGNALS
What do management actions, insider buying/selling, capital allocation decisions, and leadership changes signal? Be direct about alignment or divergence with shareholders.

## ANALYST & INSTITUTIONAL SENTIMENT SHIFT
What are sell-side analysts doing — upgrades, downgrades, initiations, PT changes? Is the debate intensifying or resolving? Name the specific disagreement points if visible.

## REGULATORY & LEGAL WATCH
Any regulatory actions, investigations, approvals, or legal risks? Probability-weight each item's materiality explicitly (High / Medium / Low).

## MARKET PRICING REALITY CHECK
Based on stock price reactions to specific news items (use the "Stock reaction" % where provided): what does the market appear to have already priced in? What moved the stock more or less than expected?

## CATALYSTS TO WATCH — NEXT 30-60 DAYS
Name the top 3-4 specific events or data points to watch. For each: catalyst name, timing estimate, and what a bullish vs bearish outcome looks like.

## EMERGING RISKS IN THE NEWS
What new or escalating risks are visible in the recent news flow that may not be fully in the market consensus? These must be risks the news reveals — not generic sector risks. Reference specific headlines.

## ONE-PARAGRAPH VERDICT
In exactly one dense paragraph (5-7 sentences): what does the overall news flow signal about this company's investment setup right now? Give a directional view — don't hedge.

MANDATORY WRITING RULES:
1. Every section opens with a conviction statement — never "it appears" — use "the news flow signals" / "the data shows" / "management is clearly"
2. Reference specific headlines with dates: "(June 24, Seeking Alpha)"
3. Use exact stock reaction % when making market pricing claims
4. 130-180 words per section (except FLASH ASSESSMENT: 2 lines; ONE-PARAGRAPH VERDICT: exactly one paragraph)
5. Write to a PM with 5 minutes — no hedging, no generic statements
6. If a section has no relevant news: "No material [topic] news in the review period — this absence is notable because [specific reason tied to this company]."
7. BANNED phrases: "it is worth noting", "importantly", "as we can see", "in conclusion", "going forward", "significant" (replace with the actual magnitude)`;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text();
    return new Response(`Anthropic error: ${err}`, { status: 502 });
  }

  // Stream SSE from Anthropic, forward raw text chunks to client
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
            const text = j.delta?.text ?? j.content?.[0]?.text ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          } catch { /* skip malformed */ }
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
