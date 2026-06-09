"use client";

import AppShell from "@/components/layout/AppShell";
import { DEMO_ISSUE } from "@/lib/data/demoData";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Severity = "high" | "medium" | "low";
type Direction = "positive" | "negative" | "neutral" | "mixed";
type Pressure = "hawkish" | "dovish" | "neutral";

const NAVY = "#0c1b38";
const INK = "#0a0a0a";
const MUTED = "#6f6f6f";
const BORDER = "#e8e3da";
const PAPER = "#fbfaf7";
const POSITIVE = "#147a4f";
const NEGATIVE = "#b42318";
const WARNING = "#b7791f";

const ratesData = [
  { date: "Jan", fedFunds: 5.33, twoYear: 4.31, tenYear: 3.89, realRate: 1.74 },
  { date: "Feb", fedFunds: 5.33, twoYear: 4.55, tenYear: 4.12, realRate: 1.92 },
  { date: "Mar", fedFunds: 5.33, twoYear: 4.62, tenYear: 4.21, realRate: 2.01 },
  { date: "Apr", fedFunds: 5.33, twoYear: 4.78, tenYear: 4.43, realRate: 2.18 },
  { date: "May", fedFunds: 5.33, twoYear: 4.91, tenYear: 4.61, realRate: 2.27 },
  { date: "Jun", fedFunds: 5.33, twoYear: 4.97, tenYear: 4.68, realRate: 2.32 },
];

const fedPath = [
  { meeting: "Jun", cut: 8, hold: 86, hike: 6, bias: "Hold", delta: "Cuts -4" },
  { meeting: "Jul", cut: 14, hold: 72, hike: 14, bias: "Hold", delta: "Hike tail +3" },
  { meeting: "Sep", cut: 28, hold: 58, hike: 14, bias: "Hold / cut", delta: "Cuts -7" },
  { meeting: "Dec", cut: 36, hold: 44, hike: 20, bias: "Split", delta: "Hike tail +5" },
];

const repricingDrivers = [
  {
    driver: "Inflation",
    score: 92,
    direction: "hawkish" as Pressure,
    trend: "+8",
    sensitivity: "High",
    explanation: "Core services remain too sticky for a clean easing cycle.",
  },
  {
    driver: "Labor",
    score: 76,
    direction: "hawkish" as Pressure,
    trend: "+3",
    sensitivity: "High",
    explanation: "Labor is cooling, but not weak enough to force the Fed.",
  },
  {
    driver: "Growth",
    score: 58,
    direction: "neutral" as Pressure,
    trend: "-2",
    sensitivity: "Medium",
    explanation: "Growth is slowing, but credit is not signaling a break.",
  },
  {
    driver: "Fed communication",
    score: 70,
    direction: "hawkish" as Pressure,
    trend: "+5",
    sensitivity: "High",
    explanation: "Fed speakers keep optionality and resist early-cut pricing.",
  },
  {
    driver: "Energy",
    score: 51,
    direction: "neutral" as Pressure,
    trend: "+1",
    sensitivity: "Medium",
    explanation: "Oil is not yet the dominant impulse, but it can keep inflation anxiety alive.",
  },
  {
    driver: "Credit conditions",
    score: 44,
    direction: "neutral" as Pressure,
    trend: "0",
    sensitivity: "Medium",
    explanation: "Spreads are wider, but not yet confirming a recessionary shock.",
  },
];

const transmission = [
  {
    label: "Inflation",
    state: "Sticky",
    pressure: "hawkish",
    confidence: 81,
    explanation: "Services inflation remains the binding macro constraint.",
  },
  {
    label: "Fed Path",
    state: "Cuts delayed",
    pressure: "hawkish",
    confidence: 76,
    explanation: "The market is reducing confidence in near-term easing.",
  },
  {
    label: "Rates",
    state: "Long end higher",
    pressure: "hawkish",
    confidence: 79,
    explanation: "10Y yield becomes the main equity valuation pressure point.",
  },
  {
    label: "Equities",
    state: "Multiple pressure",
    pressure: "neutral",
    confidence: 67,
    explanation: "Weakness is concentrated in rate-sensitive and expensive assets.",
  },
  {
    label: "FX / Credit",
    state: "USD firm; credit calm",
    pressure: "neutral",
    confidence: 63,
    explanation: "FX confirms the rates story, while credit resists full risk-off.",
  },
];

const agreementSignals = {
  confirming: [
    {
      signal: "10Y yield higher",
      asset: "Rates",
      explanation: "The long end confirms the higher-for-longer repricing.",
    },
    {
      signal: "USD firm",
      asset: "FX",
      explanation: "Rate differentials continue to support the dollar.",
    },
    {
      signal: "REITs weaker",
      asset: "Equities",
      explanation: "Rate-sensitive sectors are reacting to discount-rate pressure.",
    },
    {
      signal: "2Y stays elevated",
      asset: "Rates",
      explanation: "The front end remains anchored by a patient Fed.",
    },
  ],
  contradicting: [
    {
      signal: "Credit spreads contained",
      asset: "Credit",
      explanation: "Credit does not yet confirm a broad recessionary regime.",
    },
    {
      signal: "Mega-cap tech resilient",
      asset: "Equities",
      explanation: "AI/earnings momentum is offsetting part of the rates pressure.",
    },
    {
      signal: "VIX not breaking out",
      asset: "Risk",
      explanation: "The market is repricing rates, not yet pricing panic.",
    },
  ],
};

const scenarios = [
  {
    name: "Base case",
    probability: 55,
    tone: "neutral" as Direction,
    trigger: "Sticky inflation, patient Fed, elevated 10Y.",
    market: "Selective equity pressure; USD supported; credit stable.",
  },
  {
    name: "Dovish break",
    probability: 20,
    tone: "positive" as Direction,
    trigger: "Core services inflation surprises lower.",
    market: "Yields fall; duration rallies; USD softens.",
  },
  {
    name: "Hawkish shock",
    probability: 25,
    tone: "negative" as Direction,
    trigger: "Hot CPI or hawkish dots force hikes back into distribution.",
    market: "10Y higher; broad multiple pressure; credit watch.",
  },
];

const heatMatrix = [
  {
    driver: "Hot CPI",
    equities: "Negative",
    rates: "Yields up",
    fx: "USD up",
    commodities: "Mixed",
    credit: "Wider",
    active: true,
  },
  {
    driver: "Strong jobs",
    equities: "Mixed",
    rates: "Yields up",
    fx: "USD up",
    commodities: "Positive",
    credit: "Neutral",
    active: false,
  },
  {
    driver: "Weak growth",
    equities: "Negative",
    rates: "Yields down",
    fx: "Mixed",
    commodities: "Negative",
    credit: "Wider",
    active: false,
  },
  {
    driver: "Dovish Fed",
    equities: "Positive",
    rates: "Yields down",
    fx: "USD down",
    commodities: "Positive",
    credit: "Tighter",
    active: false,
  },
];

const eventRisk = [
  {
    event: "CPI",
    date: "Jun 11",
    sensitivity: "Very High",
    asset: "Rates",
    breaker: "Core services below consensus weakens the entire higher-for-longer setup.",
  },
  {
    event: "FOMC",
    date: "Jun 12",
    sensitivity: "Very High",
    asset: "Rates / FX",
    breaker: "Dovish dots or softer inflation language would challenge repricing.",
  },
  {
    event: "PPI",
    date: "Jun 14",
    sensitivity: "Medium",
    asset: "Rates",
    breaker: "Soft pipeline inflation would lower PCE anxiety.",
  },
  {
    event: "Retail Sales",
    date: "Jun 18",
    sensitivity: "High",
    asset: "Consumer",
    breaker: "Weak control group would shift focus from inflation to growth risk.",
  },
];

const edgeInsights = [
  {
    tag: "Regime",
    title: "This is a discount-rate market, not a recession market.",
    insight:
      "Rates and FX confirm hawkish repricing, but credit is not yet pricing a full growth shock.",
    why:
      "Equity weakness should stay concentrated in duration-sensitive assets unless credit starts confirming stress.",
    confidence: 74,
  },
  {
    tag: "Rates",
    title: "The 10Y is the real pressure point.",
    insight:
      "The 2Y reflects Fed patience, but the 10Y determines how much valuation pain reaches equities.",
    why:
      "If the long end stabilizes, equities can absorb a hold; if it rises again, multiple pressure broadens.",
    confidence: 81,
  },
  {
    tag: "FX",
    title: "The dollar is the hidden earnings variable.",
    insight:
      "USD strength tightens global financial conditions and quietly pressures multinational revenue translation.",
    why:
      "The FX drag may appear in company narratives later than the rates move appears in markets.",
    confidence: 69,
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38]">
      {children}
    </p>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border border-[#e8e3da] bg-white shadow-[0_1px_0_rgba(12,27,56,0.02)] ${className}`}
    >
      {children}
    </section>
  );
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#999]">
      {children}
    </p>
  );
}

function ProbabilityBar({
  value,
  active = false,
}: {
  value: number;
  active?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span
          className={`text-[10.5px] font-bold tabular-nums ${
            active ? "text-[#0c1b38]" : "text-[#777]"
          }`}
        >
          {value}%
        </span>
      </div>
      <div className="h-[5px] bg-[#eee9df]">
        <div
          className={`h-full ${active ? "bg-[#0c1b38]" : "bg-[#b9b1a3]"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function ScoreBar({
  value,
  tone = "neutral",
}: {
  value: number;
  tone?: Direction;
}) {
  const color =
    tone === "positive"
      ? POSITIVE
      : tone === "negative"
        ? NEGATIVE
        : tone === "mixed"
          ? WARNING
          : NAVY;

  return (
    <div className="h-[6px] bg-[#eee9df]">
      <div className="h-full" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  );
}

function PressurePill({ pressure }: { pressure: Pressure }) {
  const cls =
    pressure === "hawkish"
      ? "text-[#b42318] bg-[#fff7f5] border-[#f2d2cc]"
      : pressure === "dovish"
        ? "text-[#147a4f] bg-[#f4fbf7] border-[#cfe8da]"
        : "text-[#555] bg-[#faf8f3] border-[#eee9df]";

  return (
    <span
      className={`border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] ${cls}`}
    >
      {pressure}
    </span>
  );
}

function MatrixCell({ value }: { value: string }) {
  const v = value.toLowerCase();
  const color =
    v.includes("negative") || v.includes("wider") || v.includes("up")
      ? "text-[#b42318]"
      : v.includes("positive") || v.includes("tighter") || v.includes("down")
        ? "text-[#147a4f]"
        : "text-[#555]";

  return <td className={`px-3 py-3 text-[11px] font-bold ${color}`}>{value}</td>;
}

function ToneText({ tone, children }: { tone: Direction; children: React.ReactNode }) {
  const cls =
    tone === "positive"
      ? "text-[#147a4f]"
      : tone === "negative"
        ? "text-[#b42318]"
        : tone === "mixed"
          ? "text-[#b7791f]"
          : "text-[#0c1b38]";

  return <span className={cls}>{children}</span>;
}

export default function DashboardPage() {
  const issue = DEMO_ISSUE;
  const watchlist = issue.watchlistImpact.slice(0, 5);

  return (
    <AppShell>
      <main className="max-w-[1480px] pb-16">
        {/* Top page header */}
        <div className="mb-7 border-b border-[#e8e3da] pb-6">
          <div className="flex items-end justify-between gap-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38] whitespace-nowrap">CrossAsset Command Center</p>
              <h1
                className="mt-3 text-[42px] font-light leading-[0.95] tracking-tight text-[#0a0a0a]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                The market is repricing the cost of money.
              </h1>
              <p className="mt-4 max-w-4xl text-[14px] font-medium leading-[1.75] text-[#555]">
                A single-page macro intelligence system built around the chain that matters:
                regime, market pricing, transmission, cross-asset disagreement, and catalysts.
              </p>
            </div>

            <div className="min-w-[250px] text-right">
              <MiniLabel>Pre-market brief</MiniLabel>
              <p className="mt-1 text-[13px] font-bold text-[#0c1b38]">
                Monday, June 8, 2026
              </p>
              <p className="mt-1 text-[11px] font-semibold text-[#999]">
                Demo data · 6:30 AM update
              </p>
            </div>
          </div>
        </div>

        {/* Layer 1 */}
        <div className="mb-5 grid grid-cols-[1.1fr_1.45fr_1fr] gap-5">
          {/* Chief View */}
          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38] whitespace-nowrap">Chief View</p>
              <span className="border border-[#e8e3da] px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#0c1b38]">
                Regime 74%
              </span>
            </div>

            <h2
              className="text-[24px] font-light leading-[1.15] tracking-tight text-[#0a0a0a]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Higher-for-longer is back in control.
            </h2>

            <div className="mt-5 space-y-4 text-[13.5px] font-medium leading-[1.75] text-[#4b4b4b]">
              <p>
                Sticky inflation and resilient labor data keep the Fed patient, anchoring the
                front end and pushing the burden of repricing into the 10Y.
              </p>
              <p>
                Equities are not yet in full risk-off, but discount-rate pressure is real.
                The decisive question is whether credit begins to confirm the rates signal.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#eee9df] pt-5">
              <div>
                <MiniLabel>Regime</MiniLabel>
                <p className="mt-1 text-[13px] font-bold text-[#0c1b38]">
                  {issue.regimeLabel}
                </p>
              </div>
              <div>
                <MiniLabel>Changed vs yesterday</MiniLabel>
                <p className="mt-1 text-[13px] font-bold text-[#b42318]">
                  Hawkish +6
                </p>
              </div>
              <div>
                <MiniLabel>Invalidated by</MiniLabel>
                <p className="mt-1 text-[12px] font-semibold leading-snug text-[#555]">
                  Downside core inflation surprise.
                </p>
              </div>
              <div>
                <MiniLabel>Market state</MiniLabel>
                <p className="mt-1 text-[12px] font-semibold leading-snug text-[#555]">
                  Repricing, not panic.
                </p>
              </div>
            </div>
          </Card>

          {/* Rates Command */}
          <Card className="p-6">
            <div className="mb-5 flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#0c1b38] whitespace-nowrap">Rates Command Center</p>
                <h3
                  className="mt-3 text-[24px] font-light leading-[1.2] tracking-tight text-[#0a0a0a]"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  The 10Y is where macro becomes equity pressure.
                </h3>
              </div>

              <div className="flex gap-1">
                {["1M", "3M", "6M", "1Y", "FOMC"].map((r, i) => (
                  <span
                    key={r}
                    className={`border px-2.5 py-1.5 text-[9.5px] font-bold uppercase ${
                      i === 4
                        ? "border-[#0c1b38] bg-[#0c1b38] text-white"
                        : "border-[#e8e3da] text-[#777]"
                    }`}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-5 grid grid-cols-4 gap-3">
              {[
                ["Fed Funds", "5.33%", "Policy anchor"],
                ["2Y", "4.97%", "Fed path proxy"],
                ["10Y", "4.68%", "Equity pressure"],
                ["2s10s", "-29bps", "Still inverted"],
              ].map(([label, value, note]) => (
                <div key={label} className="border border-[#eee9df] bg-[#fbfaf7] px-3 py-3">
                  <MiniLabel>{label}</MiniLabel>
                  <p className="mt-1 text-[20px] font-bold tabular-nums text-[#0a0a0a]">
                    {value}
                  </p>
                  <p className="mt-1 text-[10.5px] font-semibold text-[#777]">{note}</p>
                </div>
              ))}
            </div>

            <div className="h-[235px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratesData} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#eee9df" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#777" }}
                  />
                  <YAxis
                    domain={[3.5, 5.6]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#777" }}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #e8e3da",
                      borderRadius: 0,
                      fontSize: 12,
                    }}
                    formatter={(value: unknown, name: unknown) => [
                      `${Number(value).toFixed(2)}%`,
                      String(name),
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="fedFunds"
                    name="Fed Funds"
                    stroke={NAVY}
                    strokeWidth={2.4}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="twoYear"
                    name="2Y Treasury"
                    stroke="#6b7280"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="tenYear"
                    name="10Y Treasury"
                    stroke={NEGATIVE}
                    strokeWidth={2.2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#eee9df] pt-4">
              <div>
                <MiniLabel>Policy gap</MiniLabel>
                <p className="mt-1 text-[13px] font-bold text-[#0c1b38]">
                  Easing path losing confidence
                </p>
              </div>
              <div>
                <MiniLabel>Duration stress</MiniLabel>
                <p className="mt-1 text-[13px] font-bold text-[#b42318]">
                  10Y repricing remains active
                </p>
              </div>
            </div>
          </Card>

          {/* Market Pricing */}
          <Card className="p-6">
            <div className="mb-5">
              <SectionLabel>Market Pricing</SectionLabel>
              <h3
                className="mt-3 text-[22px] font-light leading-[1.2] tracking-tight text-[#0a0a0a]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Fed path distribution is still centered on hold.
              </h3>
            </div>

            <div className="border border-[#eee9df]">
              <table className="w-full text-left">
                <thead className="bg-[#fbfaf7]">
                  <tr className="border-b border-[#eee9df]">
                    {["Mtg", "Cut", "Hold", "Hike", "Bias"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#777]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fedPath.map((row) => {
                    const max = Math.max(row.cut, row.hold, row.hike);
                    return (
                      <tr key={row.meeting} className="border-b border-[#f1eee8] last:border-0">
                        <td className="px-3 py-3 text-[12px] font-bold text-[#0a0a0a]">
                          {row.meeting}
                        </td>
                        <td className="px-3 py-3">
                          <ProbabilityBar value={row.cut} active={row.cut === max} />
                        </td>
                        <td className="px-3 py-3">
                          <ProbabilityBar value={row.hold} active={row.hold === max} />
                        </td>
                        <td className="px-3 py-3">
                          <ProbabilityBar value={row.hike} active={row.hike === max} />
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-[11px] font-bold text-[#0c1b38]">{row.bias}</p>
                          <p className="mt-1 text-[9.5px] font-semibold text-[#999]">{row.delta}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-5 border-t border-[#eee9df] pt-4">
              <MiniLabel>Distribution skew</MiniLabel>
              <div className="mt-2 flex h-2 overflow-hidden bg-[#eee9df]">
                <div className="bg-[#147a4f]" style={{ width: "22%" }} />
                <div className="bg-[#0c1b38]" style={{ width: "58%" }} />
                <div className="bg-[#b42318]" style={{ width: "20%" }} />
              </div>
              <p className="mt-3 text-[12.5px] font-medium leading-relaxed text-[#666]">
                The market is not confidently pricing cuts. The hold distribution dominates, while
                the hike tail is no longer negligible. Demo probabilities shown.
              </p>
            </div>
          </Card>
        </div>

        {/* Layer 2 */}
        <div className="mb-5 grid grid-cols-[0.9fr_1.2fr_0.9fr] gap-5">
          {/* Repricing drivers */}
          <Card className="p-6">
            <SectionLabel>Repricing Drivers</SectionLabel>
            <div className="mt-5 space-y-4">
              {repricingDrivers.map((d) => (
                <div key={d.driver}>
                  <div className="mb-1.5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12.5px] font-bold text-[#0a0a0a]">{d.driver}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <PressurePill pressure={d.direction} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#999]">
                          {d.sensitivity}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold tabular-nums text-[#0c1b38]">{d.score}</p>
                      <p className="text-[10px] font-bold tabular-nums text-[#b42318]">{d.trend}</p>
                    </div>
                  </div>
                  <ScoreBar value={d.score} tone={d.direction === "hawkish" ? "negative" : "neutral"} />
                  <p className="mt-2 text-[11.8px] font-medium leading-relaxed text-[#666]">
                    {d.explanation}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Transmission */}
          <Card className="p-6">
            <SectionLabel>Macro Transmission Chain</SectionLabel>
            <div className="mt-5 space-y-0">
              {transmission.map((node, index) => (
                <div key={node.label} className="relative">
                  <div className="flex items-start gap-4 py-4 border-b border-[#f1eee8] last:border-0">
                    {/* Step number + connector */}
                    <div className="flex flex-col items-center shrink-0 w-8 pt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#bbb]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {index < transmission.length - 1 && (
                        <div className="mt-1.5 w-px flex-1 bg-[#e8e3da]" style={{ minHeight: 20 }} />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-bold text-[#0a0a0a]">{node.label}</p>
                          <span className="text-[11px] font-bold text-[#0c1b38]">→</span>
                          <p className="text-[13px] font-bold text-[#0c1b38]">{node.state}</p>
                        </div>
                        <PressurePill pressure={node.pressure as Pressure} />
                      </div>
                      <p className="text-[12px] font-medium leading-relaxed text-[#666]">
                        {node.explanation}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-[4px] bg-[#eee9df]">
                          <div className="h-full bg-[#0c1b38]" style={{ width: `${node.confidence}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-[#999] tabular-nums shrink-0">
                          {node.confidence}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Agreement map */}
          <Card className="p-6">
            <SectionLabel>Cross-Asset Agreement</SectionLabel>
            <div className="mt-5 space-y-1">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#147a4f]">Confirms</p>
              <div className="space-y-2 mb-5">
                {agreementSignals.confirming.map((s) => (
                  <div key={s.signal} className="flex items-start gap-3 py-2 border-b border-[#f1eee8] last:border-0">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#147a4f] shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-bold text-[#0a0a0a]">{s.signal}</p>
                        <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#147a4f]">{s.asset}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-[#666]">{s.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b42318]">Diverges</p>
              <div className="space-y-2">
                {agreementSignals.contradicting.map((s) => (
                  <div key={s.signal} className="flex items-start gap-3 py-2 border-b border-[#f1eee8] last:border-0">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#b42318] shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-bold text-[#0a0a0a]">{s.signal}</p>
                        <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#b42318]">{s.asset}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-[#666]">{s.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-[#eee9df] pt-4">
              <MiniLabel>Key disagreement</MiniLabel>
              <p className="mt-2 text-[12.5px] font-bold leading-relaxed text-[#0c1b38]">
                If credit continues to ignore rates pressure, this remains a repricing episode —
                not a full risk-off regime.
              </p>
            </div>
          </Card>
        </div>

        {/* Layer 3 */}
        <div className="mb-5 grid grid-cols-[1.15fr_0.95fr_0.9fr] gap-5">
          {/* Edge */}
          <Card className="p-6">
            <SectionLabel>CrossAsset Edge</SectionLabel>
            <div className="mt-5 grid grid-cols-3 gap-5">
              {edgeInsights.map((edge) => (
                <div key={edge.title} className="border-l border-[#e8e3da] pl-4 first:border-l-0 first:pl-0">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="border border-[#eee9df] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#0c1b38]">
                      {edge.tag}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums text-[#0c1b38]">
                      {edge.confidence}%
                    </span>
                  </div>
                  <p className="text-[13px] font-bold leading-snug text-[#0a0a0a]">{edge.title}</p>
                  <p className="mt-2 text-[11.8px] font-medium leading-relaxed text-[#666]">
                    {edge.insight}
                  </p>
                  <p className="mt-3 text-[11.5px] font-semibold leading-relaxed text-[#0c1b38]">
                    {edge.why}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Scenario Grid */}
          <Card className="p-6">
            <SectionLabel>Scenario Grid</SectionLabel>
            <div className="mt-5 space-y-4">
              {scenarios.map((s) => (
                <div key={s.name} className="border-b border-[#f1eee8] pb-4 last:border-0 last:pb-0">
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <p className="text-[13px] font-bold text-[#0a0a0a]">{s.name}</p>
                    <ToneText tone={s.tone}>
                      <span className="text-[13px] font-bold tabular-nums">
                        {s.probability}%
                      </span>
                    </ToneText>
                  </div>
                  <ScoreBar value={s.probability} tone={s.tone} />
                  <p className="mt-2 text-[11.5px] font-medium leading-relaxed text-[#666]">
                    <span className="font-bold text-[#0a0a0a]">Trigger: </span>
                    {s.trigger}
                  </p>
                  <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-[#666]">
                    <span className="font-bold text-[#0a0a0a]">Market: </span>
                    {s.market}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Event risk */}
          <Card className="p-6">
            <SectionLabel>Catalyst Risk</SectionLabel>
            <div className="mt-5 space-y-4">
              {eventRisk.map((e) => (
                <div key={e.event} className="border-l-2 border-[#0c1b38] pl-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-bold text-[#0a0a0a]">{e.event}</p>
                    <p className="text-[11px] font-bold text-[#0c1b38]">{e.date}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`text-[9.5px] font-bold uppercase tracking-[0.14em] ${
                        e.sensitivity === "Very High" ? "text-[#b42318]" : "text-[#b7791f]"
                      }`}
                    >
                      {e.sensitivity}
                    </span>
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#999]">
                      {e.asset}
                    </span>
                  </div>
                  <p className="mt-2 text-[11.5px] font-medium leading-relaxed text-[#666]">
                    {e.breaker}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Layer 4 */}
        <div className="mb-5 grid grid-cols-[1.15fr_0.85fr] gap-5">
          {/* Heat matrix */}
          <Card className="p-6">
            <SectionLabel>Asset-Class Reaction Matrix</SectionLabel>
            <div className="mt-5 overflow-hidden border border-[#eee9df]">
              <table className="w-full text-left">
                <thead className="bg-[#fbfaf7]">
                  <tr className="border-b border-[#eee9df]">
                    {["Driver", "Equities", "Rates", "FX", "Commodities", "Credit"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#777]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatMatrix.map((row) => (
                    <tr
                      key={row.driver}
                      className={`border-b border-[#f1eee8] last:border-0 ${
                        row.active ? "bg-[#fbfaf7]" : ""
                      }`}
                    >
                      <td className="px-3 py-3 text-[11.5px] font-bold text-[#0a0a0a]">
                        {row.driver}
                        {row.active && (
                          <span className="ml-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[#0c1b38]">
                            Current
                          </span>
                        )}
                      </td>
                      <MatrixCell value={row.equities} />
                      <MatrixCell value={row.rates} />
                      <MatrixCell value={row.fx} />
                      <MatrixCell value={row.commodities} />
                      <MatrixCell value={row.credit} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Market pressure */}
          <Card className="p-6">
            <SectionLabel>Market Pressure Index</SectionLabel>
            <div className="mt-5 h-[225px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Rates", value: 88 },
                    { name: "FX", value: 67 },
                    { name: "Equity", value: 61 },
                    { name: "Credit", value: 38 },
                    { name: "Commod.", value: 45 },
                  ]}
                  margin={{ top: 6, right: 0, bottom: 0, left: -24 }}
                >
                  <CartesianGrid stroke="#eee9df" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#777" }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#777" }} />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #e8e3da",
                      borderRadius: 0,
                      fontSize: 12,
                    }}
                    formatter={(value: unknown) => [`${Number(value)}/100`, "Pressure"]}
                  />
                  <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                    {[88, 67, 61, 38, 45].map((v, i) => (
                      <Cell key={i} fill={v > 70 ? NEGATIVE : v > 50 ? WARNING : NAVY} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-4 border-t border-[#eee9df] pt-4 text-[12px] font-medium leading-relaxed text-[#666]">
              Rates remain the dominant pressure channel. Credit is the key confirmation variable:
              if it deteriorates, the regime shifts from repricing to risk-off.
            </p>
          </Card>
        </div>

        {/* Bottom */}
        <div className="grid grid-cols-[1.1fr_0.9fr] gap-5">
          {/* Watchlist sensitivity */}
          <Card className="p-6">
            <SectionLabel>Watchlist Sensitivity</SectionLabel>
            <div className="mt-5 overflow-hidden border border-[#eee9df]">
              <table className="w-full text-left">
                <thead className="bg-[#fbfaf7]">
                  <tr className="border-b border-[#eee9df]">
                    {["Ticker", "Exposure", "Sensitivity", "Why now"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#777]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {watchlist.map((w) => {
                    const tone =
                      w.impactLevel === "High"
                        ? "text-[#b42318]"
                        : w.impactLevel === "Medium"
                          ? "text-[#b7791f]"
                          : "text-[#147a4f]";

                    return (
                      <tr key={w.ticker} className="border-b border-[#f1eee8] last:border-0">
                        <td className="px-3 py-3">
                          <p className="text-[12.5px] font-bold text-[#0a0a0a]">{w.ticker}</p>
                          <p className="mt-0.5 text-[10.5px] font-medium text-[#999]">
                            {w.companyName}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-[11.5px] font-semibold text-[#0c1b38]">
                          {w.ticker === "WMT"
                            ? "Defensive consumer"
                            : w.ticker === "TGT"
                              ? "Inflation / discretionary"
                              : w.ticker === "COST"
                                ? "Quality / valuation"
                                : w.ticker === "KR"
                                  ? "Defensive grocery"
                                  : "Rates / consumer / FX"}
                        </td>
                        <td className={`px-3 py-3 text-[11.5px] font-bold ${tone}`}>
                          {w.impactLevel}
                        </td>
                        <td className="px-3 py-3 text-[11.5px] font-medium leading-relaxed text-[#666]">
                          {w.explanation}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Desk read */}
          <Card className="p-6">
            <SectionLabel>Five Things Before the Open</SectionLabel>
            <div className="mt-5 space-y-4">
              {issue.talkingPoints.slice(0, 5).map((point, index) => (
                <div key={index} className="grid grid-cols-[34px_1fr] gap-3 border-b border-[#f1eee8] pb-4 last:border-0 last:pb-0">
                  <p
                    className="text-[22px] font-light leading-none text-[#0c1b38]"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="line-clamp-3 text-[12.2px] font-medium leading-relaxed text-[#555]">
                    {point}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>
    </AppShell>
  );
}