import { NextRequest, NextResponse } from "next/server";
import { buildReport } from "@/lib/macro/build";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Q&A grounded in the live macro report data.
export async function POST(req: NextRequest) {
  const { question } = (await req.json().catch(() => ({}))) as { question?: string };
  if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });

  const report = await buildReport();
  const facts = Object.values(report.charts)
    .filter((c) => c.latest)
    .map((c) => {
      const chg = c.latest!.change != null ? ` (${c.latest!.change >= 0 ? "+" : ""}${c.latest!.change.toFixed(2)}${c.latest!.changeUnit === "pp" ? "pp" : "% y/y"})` : "";
      return `${c.title}: ${c.latest!.value}${c.unit.includes("%") ? "%" : ""}${chg}`;
    })
    .join("; ");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 450,
          system: "You are a sharp macro strategist. Answer ONLY from the provided current U.S. data. Be specific, cite the numbers, 2-4 sentences, opinionated, no hedging or preamble. If the data doesn't cover it, say so briefly.",
          messages: [{ role: "user", content: `CURRENT DATA:\n${facts}\n\nQUESTION: ${question}` }],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (r.ok) {
        const j = await r.json();
        const text = j?.content?.[0]?.text?.trim();
        if (text) return NextResponse.json({ answer: text, source: "claude" });
      }
    } catch { /* fall through */ }
  }

  // fallback: try to surface the most relevant metric
  const q = question.toLowerCase();
  const hit = Object.values(report.charts).find((c) => c.latest && q.includes(c.title.toLowerCase().split(" ")[0]));
  const answer = hit?.latest
    ? `${hit.title} is currently ${hit.latest.value}${hit.unit.includes("%") ? "%" : ` (${hit.unit})`}${hit.latest.change != null ? `, ${hit.latest.change >= 0 ? "up" : "down"} ${Math.abs(hit.latest.change).toFixed(2)}${hit.latest.changeUnit === "pp" ? "pp" : "% y/y"}` : ""}.`
    : "Ask about a specific indicator (inflation, unemployment, GDP, yields, ISM, housing…) and I'll pull the latest reading.";
  return NextResponse.json({ answer, source: "computed" });
}
