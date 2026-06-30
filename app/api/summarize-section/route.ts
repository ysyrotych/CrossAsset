import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { title, text, ticker } = await req.json() as { title: string; text: string; ticker: string };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      'data: {"error":"ANTHROPIC_API_KEY not configured"}\ndata: [DONE]\n\n',
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const prompt = `You are a senior equity research analyst at a top-tier asset manager. Summarize the following SEC filing section for ${ticker}.

Section: ${title}

---
${text.slice(0, 18000)}
---

Write an institutional-grade summary that a portfolio manager can read in 90 seconds. Use this exact structure:

**EXECUTIVE SUMMARY**
2-3 sentences capturing the single most important takeaway from this section.

**KEY POINTS**
• [Specific point with concrete data/numbers if available]
• [Specific point]
• [Specific point]
• [Specific point]
• [Specific point]
(5-8 bullets maximum. Each bullet = ONE specific, material insight. Include exact figures, percentages, or dollar amounts when mentioned.)

**ANALYST TAKEAWAY**
1-2 sentences on what this means for the investment thesis — opportunities, risks, or items to monitor.

Rules:
- Be specific, not generic. Reference exact numbers from the text.
- Flag anything that deviates materially from boilerplate (new risks, changes from prior year, specific targets, litigation amounts, etc.)
- If the section contains primarily boilerplate with no material information, say so directly.
- Total length: 180-320 words.`;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
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
