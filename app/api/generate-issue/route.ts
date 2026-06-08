import { NextResponse } from "next/server";
import { fetchMacroData } from "@/lib/sources/fred";
import { generateMacroIssue } from "@/lib/ai/claude";
import { DEMO_ISSUE, DEMO_CALENDAR } from "@/lib/data/demoData";

export async function POST() {
  try {
    const macroData = await fetchMacroData();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ issue: DEMO_ISSUE, source: "demo" });
    }

    const calendarContext = DEMO_CALENDAR.slice(0, 4)
      .map((e) => `${e.date}: ${e.eventName} — ${e.whyItMatters}`)
      .join("\n");

    const defaultTickers = ["WMT", "TGT", "COST", "KR", "AMZN", "JPM", "BAC", "XOM", "AAPL", "NVDA"];

    const issue = await generateMacroIssue(macroData, defaultTickers, calendarContext);
    return NextResponse.json({ issue, source: macroData.isDemo ? "demo-data" : "live-data" });
  } catch (err: any) {
    console.error("generate-issue error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
