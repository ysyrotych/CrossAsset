import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const { ticker, companyName, industry, messages, facts, history, quarterlyPeriod, fmpExtended, documentContext } = await req.json() as {
    ticker: string;
    companyName: string;
    industry: string;
    messages: Msg[];
    facts: Record<string, number>;
    history: Record<string, Record<string, number>>;
    quarterlyPeriod: string;
    fmpExtended?: Record<string, any>;
    documentContext?: { base64: string; mimeType: string; name: string } | null;
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response('data: {"error":"ANTHROPIC_API_KEY not configured"}\ndata: [DONE]\n\n',
      { headers: { "Content-Type": "text/event-stream" } });
  }

  const f = facts;
  const fmt = (v?: number) => v == null ? "N/A"
    : Math.abs(v) >= 1e12 ? `$${(v/1e12).toFixed(2)}T`
    : Math.abs(v) >= 1e9  ? `$${(v/1e9).toFixed(1)}B`
    : Math.abs(v) >= 1e6  ? `$${(v/1e6).toFixed(0)}M`
    : `$${v.toFixed(2)}`;
  const pct = (v?: number) => v == null ? "N/A" : `${v.toFixed(1)}%`;

  const revHist = history.revenue
    ? Object.entries(history.revenue).sort(([a],[b]) => a.localeCompare(b))
        .map(([yr, v]) => `${yr.slice(0,4)}: ${fmt(v)}`).join(" → ")
    : "N/A";

  const niHist = history.net_income
    ? Object.entries(history.net_income).sort(([a],[b]) => a.localeCompare(b))
        .map(([yr, v]) => `${yr.slice(0,4)}: ${fmt(v)}`).join(" → ")
    : "N/A";

  const ext = fmpExtended ?? {};
  const peerRows = (ext.peer_comparison as any[]) ?? [];
  const peerStr = peerRows.length > 0
    ? peerRows.map((p:any) => `${p.symbol}: P/E ${p.pe ?? "—"}x | EV/EBITDA ${p.ev_ebitda ?? "—"}x | Net Margin ${p.net_margin ?? "—"}% | Rev Growth ${p.rev_growth != null ? (p.rev_growth > 0 ? "+" : "") + p.rev_growth + "%" : "—"}`).join(" | ")
    : "N/A";
  const newsStr = (ext.recent_news as any[])?.slice(0, 5).map((n:any) => `[${n.date}] ${n.title}`).join("; ") ?? "N/A";
  const insiderStr = (ext.insider_trading as any[])?.slice(0, 6).map((t:any) => `${t.name} (${t.title ?? "?"}): ${t.transaction ?? "?"} $${((t.value ?? 0) / 1e6).toFixed(1)}M on ${t.date ?? "?"}`).join("; ") ?? "N/A";
  const analystRec = ext.analyst_rec as any;
  const analystRecStr = analystRec ? `${analystRec.strong_buy + analystRec.buy} Buy / ${analystRec.hold} Hold / ${analystRec.sell + analystRec.strong_sell} Sell (${analystRec.total} analysts)` : "N/A";

  const system = `You are a senior equity research analyst at a top-tier asset management firm. You have deep knowledge of ${companyName} (${ticker}) based on their SEC filings and market data.

COMPANY: ${companyName} | Ticker: ${ticker} | Industry: ${industry}
CEO: ${ext.ceo ?? "N/A"} | Sector: ${ext.sector ?? "N/A"} | Exchange: ${ext.exchange ?? "N/A"}

KEY FINANCIALS (Most Recent Annual):
Revenue: ${fmt(f.revenue)} | Gross Margin: ${pct(f.gross_margin_pct)} | Op Margin: ${pct(f.operating_margin_pct)} | Net Margin: ${pct(f.net_margin_pct)}
EBITDA: ${fmt(f.ebitda)} | FCF: ${fmt(f.free_cash_flow)} | Op CF: ${fmt(f.operating_cf)}
Net Income: ${fmt(f.net_income)} | EPS Diluted: ${f.eps_diluted != null ? `$${f.eps_diluted.toFixed(2)}` : "N/A"}
Cash: ${fmt(f.cash)} | LT Debt: ${fmt(f.long_term_debt)} | Total Assets: ${fmt(f.total_assets)} | Equity: ${fmt(f.equity)}
ROE: ${f.net_income && f.equity ? pct(f.net_income/f.equity*100) : "N/A"} | ROIC: ${pct(f.roic)}
SBC: ${fmt(f.sbc_expense)} | R&D: ${fmt(f.rd_expense)} | CapEx: ${fmt(f.capex)}

VALUATION:
P/E: ${f.pe_ratio != null ? f.pe_ratio.toFixed(1)+"x" : "N/A"} | EV/EBITDA: ${f.ev_ebitda != null ? f.ev_ebitda.toFixed(1)+"x" : "N/A"} | P/FCF: ${f.p_fcf != null ? f.p_fcf.toFixed(1)+"x" : "N/A"}
Current Price: ${f.stock_price != null ? `$${f.stock_price.toFixed(2)}` : "N/A"} | 52W: ${f.week52_low != null ? `$${f.week52_low.toFixed(0)}–$${f.week52_high?.toFixed(0)}` : "N/A"}
PT Consensus: ${f.pt_consensus != null ? `$${f.pt_consensus.toFixed(0)}` : "N/A"} | Analyst Ratings: ${analystRecStr}
Short Interest: ${f.short_float_pct != null ? `${f.short_float_pct.toFixed(1)}% of float` : "N/A"}

5-YEAR REVENUE TREND: ${revHist}
5-YEAR NET INCOME TREND: ${niHist}

PEER COMPARISON:
${peerStr}

RECENT NEWS: ${newsStr}

INSIDER ACTIVITY: ${insiderStr}

MOST RECENT QUARTER (${quarterlyPeriod || "N/A"}): Available in XBRL data.

INSTRUCTIONS:
- Answer in 2-5 sentences for simple questions, up to 8 for complex ones
- Be specific — cite exact numbers from the data above
- Be institutional and direct — no hedging, no preamble
- If asked about something not in the data, say so clearly
- If asked to compare, do a crisp side-by-side
- End with ONE key insight or implication for investors`;

  // Build messages — prepend document block to first user message if a document was uploaded
  const builtMessages = messages.map((m, i) => {
    if (i === 0 && m.role === "user" && documentContext?.base64) {
      return {
        role: m.role,
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: documentContext.mimeType,
              data: documentContext.base64,
            },
            title: documentContext.name,
          },
          { type: "text", text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "pdfs-2024-09-25",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      stream: true,
      system,
      messages: builtMessages,
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
