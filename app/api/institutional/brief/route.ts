import { NextResponse } from "next/server";
import { getConsensus, getSuperinvestors } from "@/lib/institutional/db";
import { fmtMoney } from "@/lib/institutional/briefFormat";

export const dynamic = "force-dynamic";

// A short narrative of the quarter's smart-money moves. Uses Claude when an
// API key is configured; otherwise returns a strong data-driven summary.
export async function GET() {
  const [consensus, digest] = await Promise.all([getConsensus(), getSuperinvestors()]);
  const topBuys = consensus.filter((c) => c.consensusScore > 0).slice(0, 5);
  const topSells = [...consensus].sort((a, b) => a.consensusScore - b.consensusScore).slice(0, 3);
  const crowded = consensus.filter((c) => c.buyers + c.sellers >= 4);
  const totalNew = consensus.reduce((s, c) => s + (c.newMoney ?? 0), 0);

  const facts = {
    period: digest.period,
    topBuys: topBuys.map((c) => `${c.ticker} (${c.buyers} funds${c.newMoney > 0 ? `, ${fmtMoney(c.newMoney)} new` : ""}${c.topBuyers?.length ? `, led by ${c.topBuyers.slice(0, 2).join(" & ")}` : ""})`),
    topSells: topSells.map((c) => `${c.ticker} (${c.sellers} funds trimming/exiting)`),
    crowded: crowded.map((c) => c.ticker),
    totalNew: fmtMoney(totalNew),
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const prompt = `You are a hedge-fund analyst. Write a tight 110-140 word institutional brief on this quarter's 13F smart-money activity. Be specific and confident, no hedging, no preamble. Data (${facts.period}):
Top consensus buys: ${facts.topBuys.join("; ")}
Top consensus sells: ${facts.topSells.join("; ")}
Crowded names: ${facts.crowded.join(", ")}
Total fresh initiations across tracked funds: ${facts.totalNew}.
End with one sharp "what to watch" sentence.`;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(20_000),
      });
      if (r.ok) {
        const j = await r.json();
        const text = j?.content?.[0]?.text?.trim();
        if (text) return NextResponse.json({ brief: text, source: "claude", period: facts.period });
      }
    } catch { /* fall through to deterministic */ }
  }

  // Deterministic fallback — always available, genuinely useful
  const lead = topBuys[0];
  const brief =
    `This quarter (${quarter(facts.period)}), tracked superinvestors put roughly ${facts.totalNew} of fresh capital to work. ` +
    (lead ? `The clearest consensus was ${lead.ticker}, accumulated by ${lead.buyers} funds${lead.topBuyers?.length ? ` including ${lead.topBuyers.slice(0, 2).join(" and ")}` : ""}. ` : "") +
    (topBuys.length > 1 ? `Other crowded longs building conviction: ${topBuys.slice(1).map((c) => c.ticker).join(", ")}. ` : "") +
    (topSells.length ? `On the sell side, ${topSells.map((c) => c.ticker).join(", ")} saw the heaviest distribution. ` : "") +
    (facts.crowded.length ? `Watch crowding risk in ${facts.crowded.slice(0, 4).join(", ")} — consensus longs can unwind violently if the narrative cracks.` : "");
  return NextResponse.json({ brief, source: "computed", period: facts.period });
}

function quarter(iso: string): string {
  const d = new Date(iso);
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
}
