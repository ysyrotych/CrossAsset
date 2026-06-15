import { NextResponse } from "next/server";
import { fetchMacroData } from "@/lib/sources/fred";
import { generateMacroIssue } from "@/lib/ai/claude";
import { fetchFinancialNews } from "@/lib/sources/newsapi";
import { fetchEconomicCalendar, fetchEarningsCalendar } from "@/lib/sources/finnhub";
import { fetchBeaContext } from "@/lib/sources/bea";
import { fetchBlsData } from "@/lib/sources/bls";
import { DEMO_ISSUE } from "@/lib/data/demoData";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        issue: DEMO_ISSUE,
        source: "demo",
        warning: "ANTHROPIC_API_KEY not set — returning demo data",
      });
    }

    // Fetch all sources in parallel
    const [macroData, news, econCalendar, earningsCalendar, bea, bls] =
      await Promise.all([
        fetchMacroData(),
        fetchFinancialNews(),
        fetchEconomicCalendar(),
        fetchEarningsCalendar(),
        fetchBeaContext(),
        fetchBlsData(),
      ]);

    const issue = await generateMacroIssue(macroData, {
      news,
      econCalendar,
      earningsCalendar,
      bea,
      bls,
    });

    return NextResponse.json({
      issue,
      source: macroData.isDemo ? "demo-data" : "live-data",
      dataSources: {
        fred: !macroData.isDemo,
        newsapi: news.length > 0,
        finnhubEcon: econCalendar.length > 0,
        finnhubEarnings: earningsCalendar.length > 0,
        bea: bea.gdp.length > 0 || bea.income.length > 0,
        bls: Object.keys(bls).length > 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("generate-issue error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
