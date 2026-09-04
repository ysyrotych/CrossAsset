import { NextRequest, NextResponse } from "next/server";
import { getConsensus, getManagers } from "@/lib/institutional/db";
import { fmtMoney } from "@/lib/institutional/briefFormat";

export const dynamic = "force-dynamic";

// Ask questions about the smart-money data in natural language.
export async function POST(req: NextRequest) {
  const { question } = (await req.json().catch(() => ({}))) as { question?: string };
  if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });

  const [consensus, managers] = await Promise.all([getConsensus(), getManagers()]);
  const buys = consensus.filter((c) => c.consensusScore > 0).slice(0, 12);
  const sells = [...consensus].sort((a, b) => a.consensusScore - b.consensusScore).slice(0, 6);

  const context =
    `Tracked funds (${managers.length}): ${managers.map((m) => `${m.manager} (${m.name}, ${fmtMoney(m.aum13f)})`).join("; ")}.\n` +
    `Consensus BUYS: ${buys.map((c) => `${c.ticker} [${c.buyers} funds buying, ${c.sellers} selling${c.newMoney > 0 ? `, ${fmtMoney(c.newMoney)} new` : ""}${c.topBuyers?.length ? `, led by ${c.topBuyers.slice(0, 3).join("/")}` : ""}]`).join("; ")}.\n` +
    `Consensus SELLS: ${sells.map((c) => `${c.ticker} [${c.sellers} funds selling]`).join("; ")}.`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 500,
          system: "You are a sharp buy-side analyst. Answer ONLY from the provided 13F smart-money data. Be specific, cite fund names and tickers, 2-4 sentences, no hedging, no preamble. If the data doesn't cover it, say so briefly.",
          messages: [{ role: "user", content: `DATA:\n${context}\n\nQUESTION: ${question}` }],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (r.ok) {
        const j = await r.json();
        const text = j?.content?.[0]?.text?.trim();
        if (text) return NextResponse.json({ answer: text, source: "claude" });
      }
    } catch { /* fall through */ }
  }

  // Deterministic fallback — grounded in the data
  const q = question.toLowerCase();
  const hit = consensus.find((c) => q.includes(c.ticker.toLowerCase()) || q.includes(c.issuer.toLowerCase().split(" ")[0]));
  let answer: string;
  if (hit) {
    answer = `${hit.ticker} (${hit.issuer}): ${hit.buyers} tracked fund${hit.buyers === 1 ? "" : "s"} accumulating vs ${hit.sellers} distributing this quarter` +
      `${hit.topBuyers?.length ? `, led by ${hit.topBuyers.slice(0, 3).join(", ")}` : ""}` +
      `${hit.newMoney > 0 ? `, with ${fmtMoney(hit.newMoney)} in fresh initiations` : ""}. Consensus score ${Math.round(hit.consensusScore)}.`;
  } else {
    answer = `Across ${managers.length} tracked funds this quarter, the strongest consensus buys are ${buys.slice(0, 4).map((c) => c.ticker).join(", ")}, and the heaviest selling is in ${sells.slice(0, 3).map((c) => c.ticker).join(", ")}. Ask about a specific ticker or fund for detail.`;
  }
  return NextResponse.json({ answer, source: "computed" });
}
