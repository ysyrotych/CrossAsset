import AppShell from "@/components/layout/AppShell";
import { DEMO_MACRO_DATA, DEMO_ISSUE } from "@/lib/data/demoData";

function MetricRow({ label, value, change, direction }: {
  label: string; value: string; change?: string; direction?: "up" | "down" | "flat";
}) {
  const changeColor = !direction || direction === "flat"
    ? "text-[#999]"
    : direction === "up" ? "text-[#c0392b]" : "text-[#27ae60]";
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#f0f0f0] last:border-0">
      <span className="text-[12.5px] font-medium text-[#555]">{label}</span>
      <div className="flex items-center gap-3">
        {change && <span className={`text-[11.5px] font-semibold tabular-nums ${changeColor}`}>{change}</span>}
        <span className="text-[14px] font-semibold text-[#0a0a0a] tabular-nums">{value}</span>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#0c1b38] mb-3">{label}</p>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const d = DEMO_MACRO_DATA;
  const issue = DEMO_ISSUE;

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-10 pb-8 border-b border-[#ebebeb]">
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#0c1b38] mb-3">Dashboard</p>
        <h1 className="text-[38px] font-light text-[#0a0a0a] tracking-tight leading-tight mb-1.5"
          style={{ fontFamily: "var(--font-serif)" }}>
          Good morning.
        </h1>
        <p className="text-[14px] font-medium text-[#888]">Your macro brief is ready for today.</p>
      </div>

      {/* Regime strip */}
      <div className="mb-10 flex items-center gap-4 py-3.5 px-5 bg-[#f5f8ff] border border-[#dce5ff] rounded-md">
        <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#0c1b38]">Current Regime</span>
        <span className="w-px h-3.5 bg-[#c0cdf5]" />
        <span className="text-[13.5px] font-semibold text-[#0c1b38]">{issue.regimeLabel}</span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-7 mb-10">
        <Section label="Rates">
          <div className="border border-[#e8e8e8] rounded-md px-4 divide-y divide-[#f5f5f5]">
            <MetricRow label="10Y Treasury" value={d.rates.tenYear.value} change={d.rates.tenYear.change} direction={d.rates.tenYear.direction} />
            <MetricRow label="2Y Treasury" value={d.rates.twoYear.value} change={d.rates.twoYear.change} direction={d.rates.twoYear.direction} />
            <MetricRow label="2s10s Spread" value={d.rates.spread2s10s.value} change={d.rates.spread2s10s.change} direction={d.rates.spread2s10s.direction} />
            <MetricRow label="Fed Funds" value={d.rates.fedFunds.value} />
          </div>
        </Section>

        <Section label="Inflation">
          <div className="border border-[#e8e8e8] rounded-md px-4 divide-y divide-[#f5f5f5]">
            <MetricRow label="CPI YoY" value={d.inflation.cpi.value} change={d.inflation.cpi.change} direction={d.inflation.cpi.direction} />
            <MetricRow label="Core CPI YoY" value={d.inflation.coreCpi.value} change={d.inflation.coreCpi.change} direction={d.inflation.coreCpi.direction} />
            <MetricRow label="PCE YoY" value={d.inflation.pce.value} change={d.inflation.pce.change} direction={d.inflation.pce.direction} />
          </div>
        </Section>

        <Section label="Growth & Labor">
          <div className="border border-[#e8e8e8] rounded-md px-4 divide-y divide-[#f5f5f5]">
            <MetricRow label="GDP QoQ" value={d.growth.gdp.value} change={d.growth.gdp.change} direction={d.growth.gdp.direction} />
            <MetricRow label="Nonfarm Payrolls" value={d.growth.payrolls.value} change={d.growth.payrolls.change} direction={d.growth.payrolls.direction} />
            <MetricRow label="Unemployment" value={d.growth.unemployment.value} change={d.growth.unemployment.change} direction={d.growth.unemployment.direction} />
          </div>
        </Section>

        <Section label="Risk / Credit">
          <div className="border border-[#e8e8e8] rounded-md px-4 divide-y divide-[#f5f5f5]">
            <MetricRow label="HY OAS" value={d.risk.hySpread.value} change={d.risk.hySpread.change} direction={d.risk.hySpread.direction} />
          </div>
        </Section>

        <Section label="Commodities">
          <div className="border border-[#e8e8e8] rounded-md px-4 divide-y divide-[#f5f5f5]">
            <MetricRow label="WTI Crude" value={d.commodities.oil.value} change={d.commodities.oil.change} direction={d.commodities.oil.direction} />
            <MetricRow label="Gold" value={d.commodities.gold.value} change={d.commodities.gold.change} direction={d.commodities.gold.direction} />
          </div>
        </Section>

        <Section label="Lead Story">
          <div className="border border-[#e8e8e8] rounded-md p-4 h-full">
            <p className="text-[13.5px] font-semibold text-[#0a0a0a] leading-snug mb-2.5">
              {issue.frontPage[0].headline}
            </p>
            <p className="text-[12.5px] font-medium text-[#666] leading-relaxed line-clamp-3">
              {issue.frontPage[0].whyItMatters}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {issue.frontPage[0].affectedAssets.map((a) => (
                <span key={a} className="text-[10.5px] font-semibold px-2 py-0.5 border border-[#dce5ff] text-[#0c1b38] rounded-full">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* Executive summary */}
      <div className="pt-8 border-t border-[#ebebeb] mb-10">
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#0c1b38] mb-4">Today's Setup</p>
        <p className="text-[14px] font-medium text-[#444] leading-[1.8] max-w-3xl">
          {issue.executiveSummary}
        </p>
      </div>

      {/* Talking points */}
      <div className="pt-8 border-t border-[#ebebeb]">
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#0c1b38] mb-5">Desk Talking Points</p>
        <div className="space-y-4 max-w-3xl">
          {issue.talkingPoints.map((pt, i) => (
            <div key={i} className="flex gap-4">
              <span className="text-[12px] font-bold text-[#0c1b38] mt-0.5 w-5 shrink-0">{i + 1}.</span>
              <p className="text-[14px] font-medium text-[#444] leading-relaxed">{pt}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
