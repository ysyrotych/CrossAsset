import AppShell from "@/components/layout/AppShell";
import MetricCard from "@/components/cards/MetricCard";
import MacroCard from "@/components/cards/MacroCard";
import { YieldChart, CpiChart } from "@/components/charts/MacroCharts";
import { DEMO_MACRO_DATA, DEMO_ISSUE, DEMO_TASKS } from "@/lib/data/demoData";
import { fetchMacroData } from "@/lib/sources/fred";
import Link from "next/link";
import { ArrowRight, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let macroData = DEMO_MACRO_DATA;
  try {
    macroData = await fetchMacroData();
  } catch {
    // fallback to demo
  }

  const issue = DEMO_ISSUE;
  const tasks = DEMO_TASKS.filter((t) => t.status !== "complete").slice(0, 4);

  return (
    <AppShell isDemo={macroData.isDemo}>
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Macro Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            AI daily macro desk brief — cross-asset implications for your watchlist.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/issue"
            className="flex items-center gap-1.5 text-xs border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 px-3 py-1.5 rounded transition-colors"
          >
            View Latest Issue <ArrowRight size={11} />
          </Link>
          <Link
            href="/watchlist"
            className="flex items-center gap-1.5 text-xs border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 px-3 py-1.5 rounded transition-colors"
          >
            Watchlist <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* Regime banner */}
      <div className="mb-5 bg-zinc-950 border border-zinc-800 border-l-2 border-l-[#E8C468] rounded-md px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle size={13} className="text-[#E8C468]" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Current Regime</span>
          <span className="text-xs text-white font-semibold ml-1">{issue.regimeLabel}</span>
        </div>
        <span className="text-[10px] text-zinc-500">{issue.date}</span>
      </div>

      {/* Macro Metrics */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <div className="col-span-1">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Rates</p>
          <div className="space-y-2">
            <MetricCard metric={macroData.rates.tenYear} invertColor />
            <MetricCard metric={macroData.rates.twoYear} invertColor />
            <MetricCard metric={macroData.rates.spread2s10s} />
          </div>
        </div>
        <div className="col-span-1">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Inflation</p>
          <div className="space-y-2">
            <MetricCard metric={macroData.inflation.cpi} invertColor />
            <MetricCard metric={macroData.inflation.coreCpi} invertColor />
            <MetricCard metric={macroData.inflation.pce} invertColor />
          </div>
        </div>
        <div className="col-span-1">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Growth</p>
          <div className="space-y-2">
            <MetricCard metric={macroData.growth.gdp} />
            <MetricCard metric={macroData.growth.payrolls} />
            <MetricCard metric={macroData.growth.unemployment} invertColor />
          </div>
        </div>
        <div className="col-span-1">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Risk / Credit</p>
          <div className="space-y-2">
            <MetricCard metric={macroData.risk.hySpread} invertColor />
            <MetricCard metric={macroData.rates.fedFunds} invertColor />
          </div>
        </div>
        <div className="col-span-1">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Commodities</p>
          <div className="space-y-2">
            <MetricCard metric={macroData.commodities.oil} />
            <MetricCard metric={macroData.commodities.gold} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <MacroCard title="Treasury Yields — 10Y vs 2Y (6M)">
          <YieldChart />
          <p className="text-[10px] text-zinc-600 mt-1">Demo data · FRED DGS10, DGS2</p>
        </MacroCard>
        <MacroCard title="CPI vs Core CPI YoY (6M)">
          <CpiChart />
          <p className="text-[10px] text-zinc-600 mt-1">Demo data · FRED CPIAUCSL, CPILFESL</p>
        </MacroCard>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-3 gap-4">
        <MacroCard title="Today's Macro Setup" accent className="col-span-1">
          <p className="text-xs text-zinc-300 leading-relaxed line-clamp-6">{issue.executiveSummary}</p>
          <Link href="/issue" className="inline-flex items-center gap-1 text-[10px] text-[#E8C468] mt-2 hover:underline">
            Read full brief <ArrowRight size={10} />
          </Link>
        </MacroCard>

        <MacroCard title="Lead Story" accent className="col-span-1">
          <p className="text-xs font-semibold text-white mb-1.5 leading-snug">{issue.frontPage[0].headline}</p>
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-4">{issue.frontPage[0].whyItMatters}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {issue.frontPage[0].affectedAssets.slice(0, 4).map((a) => (
              <span key={a} className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                {a}
              </span>
            ))}
          </div>
        </MacroCard>

        <MacroCard title="Priority Tasks" className="col-span-1">
          <div className="space-y-2.5">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-start gap-2">
                <span
                  className={`mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                    t.priority === "High" ? "bg-red-400" : t.priority === "Medium" ? "bg-amber-400" : "bg-zinc-500"
                  }`}
                />
                <p className="text-xs text-zinc-300 leading-snug">{t.title}</p>
              </div>
            ))}
          </div>
          <Link href="/tasks" className="inline-flex items-center gap-1 text-[10px] text-[#E8C468] mt-3 hover:underline">
            All tasks <ArrowRight size={10} />
          </Link>
        </MacroCard>

        <MacroCard title="Watchlist Impact" className="col-span-2">
          <div className="grid grid-cols-2 gap-2">
            {issue.watchlistImpact.slice(0, 6).map((w) => (
              <div key={w.ticker} className="flex items-start gap-2 bg-zinc-900 rounded p-2">
                <div>
                  <span className="font-mono text-xs font-semibold text-white">{w.ticker}</span>
                  <span
                    className={`ml-1.5 text-[10px] px-1 py-0.5 rounded font-medium ${
                      w.impactLevel === "High"
                        ? "bg-red-950 text-red-400"
                        : w.impactLevel === "Medium"
                        ? "bg-amber-950 text-amber-400"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {w.impactLevel}
                  </span>
                  <p className="text-[10px] text-zinc-500 leading-snug mt-0.5 line-clamp-2">{w.explanation.slice(0, 90)}…</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/watchlist" className="inline-flex items-center gap-1 text-[10px] text-[#E8C468] mt-3 hover:underline">
            Full watchlist <ArrowRight size={10} />
          </Link>
        </MacroCard>

        <MacroCard title="Cross-Asset Summary" className="col-span-1">
          {Object.entries(issue.crossAssetMap).map(([key, val]) => (
            <div key={key} className="mb-2.5 last:mb-0">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{key}</p>
              <p className="text-xs text-zinc-300 leading-snug line-clamp-2">{val}</p>
            </div>
          ))}
        </MacroCard>
      </div>
    </AppShell>
  );
}
