import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChartFact = { title: string; unit: string; latest?: number; change?: number; changeUnit?: "% y/y" | "pp"; avg?: number | null; asOf?: string };

// Generate the section's analytical commentary in the URETF research voice.
export async function POST(req: NextRequest) {
  const { section, title, facts } = (await req.json().catch(() => ({}))) as
    { section: string; title: string; facts: ChartFact[] };

  const factLines = (facts ?? []).map((f) => {
    const bits = [`${f.title}: ${fmt(f.latest, f.unit)}`];
    if (f.change != null) bits.push(f.changeUnit === "pp" ? `${f.change >= 0 ? "+" : ""}${f.change.toFixed(2)} pp` : `${f.change >= 0 ? "+" : ""}${f.change.toFixed(1)}% y/y`);
    if (f.avg != null) bits.push(`vs avg ${f.avg.toFixed(1)}`);
    if (f.asOf) bits.push(`(as of ${f.asOf})`);
    return "• " + bits.join(", ");
  }).join("\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && factLines) {
    try {
      const prompt = `You are a buy-side macro analyst writing the "${title}" section of a weekly U.S. economic update, in the crisp, opinionated URETF house style (e.g. "valuations still look rich", "watch what consumers do rather than what they say"). Write 3-5 tight bullet points interpreting the data below — state the read, the trend, and the "so what" for growth/inflation/markets. No preamble, no headers, one insight per bullet, each under 22 words. Return plain bullets starting with "•".

DATA (${title}):
${factLines}`;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 500, messages: [{ role: "user", content: prompt }] }),
        signal: AbortSignal.timeout(25_000),
      });
      if (r.ok) {
        const j = await r.json();
        const text: string = j?.content?.[0]?.text ?? "";
        const bullets = text.split("\n").map((l) => l.replace(/^[•\-\*]\s*/, "").trim()).filter(Boolean);
        if (bullets.length) return NextResponse.json({ section, bullets, source: "claude" });
      }
    } catch { /* fall through */ }
  }

  // deterministic fallback — describe each metric
  const bullets = (facts ?? []).slice(0, 5).map((f) => {
    const dir = f.change != null ? (f.change >= 0 ? "rose" : "fell") : "printed";
    const chg = f.change != null ? ` (${f.change >= 0 ? "+" : ""}${f.changeUnit === "pp" ? `${f.change.toFixed(2)} pp` : `${f.change.toFixed(1)}% y/y`})` : "";
    const vsAvg = f.avg != null && f.latest != null ? ", " + (f.latest >= f.avg ? "above" : "below") + " its long-run average" : "";
    return `${f.title} ${dir} to ${fmt(f.latest, f.unit)}${chg}${vsAvg}.`;
  });
  return NextResponse.json({ section, bullets: bullets.length ? bullets : ["Data pending."], source: "computed" });
}

function fmt(v: number | undefined, unit: string): string {
  if (v == null) return "n/a";
  const s = Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(Math.abs(v) < 10 ? 2 : 1);
  return unit.includes("%") ? `${s}%` : unit.startsWith("$") ? `$${s}` : `${s}`;
}
