import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json() as { prompt: string };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      'data: {"error": "ANTHROPIC_API_KEY not configured"}\ndata: [DONE]\n\n',
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(
      `data: {"error": "Anthropic API error ${upstream.status}: ${err.slice(0, 200)}"}\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // Transform Anthropic SSE → simple text SSE the client can consume
  const encoder = new TextEncoder();
  const body = upstream.body!;

  const stream = new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
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
            if (j.type === "content_block_delta" && j.delta?.type === "text_delta") {
              const text = j.delta.text ?? "";
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
            }
            if (j.type === "message_stop") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
