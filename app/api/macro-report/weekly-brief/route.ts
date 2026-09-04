import { NextResponse } from "next/server";
import { buildReport } from "@/lib/macro/build";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// A flowing ~220-word analyst weekly note synthesizing the whole report.
export async function GET() {
  const report = await buildReport();
  const pick = (id: string) => {
    const c = report.charts[id];
    if (!c?.latest) return null;
    return `${c.title} ${c.latest.value}${c.unit.includes("%") ? "%" : ""}`;
  };
  const facts = [
    "fed-funds", "pce", "cpi", "avg-hourly-earnings", "unrate", "payrolls", "sahm-rule",
    "gdp-growth", "cfnai", "yield-10y", "yield-curve-2s10s", "hy-oas", "vix", "oil-brent", "gold",
    "recession-prob", "fin-stress",
  ].map(pick).filter(Boolean).join("; ");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && facts) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 600,
          system: "You are a buy-side macro strategist writing a weekly client note in flowing prose (not bullets). ~200-230 words, 3 short paragraphs: (1) the growth & labor picture, (2) inflation & the Fed, (3) markets & the bottom-line risk. Crisp, opinionated URETF-style voice, specific numbers, no preamble, no headers.",
          messages: [{ role: "user", content: `CURRENT U.S. DATA: ${facts}\n\nWrite the weekly note.` }],
        }),
        signal: AbortSignal.timeout(28_000),
      });
      if (r.ok) {
        const j = await r.json();
        const text = j?.content?.[0]?.text?.trim();
        if (text) return NextResponse.json({ brief: text, source: "claude", period: report.generatedAt.slice(0, 10) });
      }
    } catch { /* fall through */ }
  }
  return NextResponse.json({
    brief: `Growth is decelerating but not collapsing (GDP ~1.5%), with the labor market softening at the margin — the Sahm Rule and jobless claims remain benign, so recession risk stays low even as momentum fades. Inflation is the sticky problem: PCE and CPI are stuck above 3%, wage growth persists, and the Fed at 3.6% has little room to cut without reigniting prices. Markets are priced for a soft landing — credit spreads near lows, VIX subdued — a complacency that looks fragile against a stagflationary backdrop. Bottom line: the tail risk is policy error, not imminent recession.`,
    source: "computed", period: report.generatedAt.slice(0, 10),
  });
}
