import { NextRequest, NextResponse } from "next/server";
import { fetchFinancialNews } from "@/lib/sources/newsapi";
import { fetchEconomicCalendar } from "@/lib/sources/finnhub";

export const dynamic = "force-dynamic";

const FRED = "https://api.stlouisfed.org/fred/series/observations";
const KEY = process.env.FRED_API_KEY;

export type LiveQuote = { price: number; change: number; pct: number };
export type DriverScore = {
  driver: string; score: number; direction: "hawkish" | "dovish" | "neutral";
  trend: string; sensitivity: string; explanation: string;
};
export type TransmissionNode = {
  label: string; state: string; pressure: "hawkish" | "dovish" | "neutral";
  confidence: number; explanation: string;
};
export type AgreementSignal = { signal: string; asset: string; explanation: string };
export type Scenario = {
  name: string; probability: number; tone: "positive" | "negative" | "neutral";
  trigger: string; market: string;
};
export type EdgeInsight = {
  tag: string; title: string; insight: string; why: string; confidence: number;
};
export type UpcomingEvent = {
  event: string; date: string; impact: string; estimate?: string; previous?: string;
};

async function fredLatest(id: string): Promise<LiveQuote | null> {
  if (!KEY) return null;
  try {
    const r = await fetch(
      `${FRED}?series_id=${id}&api_key=${KEY}&file_type=json&sort_order=desc&limit=5`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const obs: { value: string }[] = ((await r.json()).observations ?? []).filter(
      (o: { value: string }) => o.value !== "."
    );
    if (!obs.length) return null;
    const price = parseFloat(obs[0].value);
    const prev = obs.length > 1 ? parseFloat(obs[1].value) : null;
    const change = prev != null ? price - prev : 0;
    return { price, change, pct: prev ? (change / prev) * 100 : 0 };
  } catch {
    return null;
  }
}

async function fredHistory(id: string, start: string): Promise<{ date: string; value: number }[]> {
  if (!KEY) return [];
  try {
    const r = await fetch(
      `${FRED}?series_id=${id}&api_key=${KEY}&file_type=json&sort_order=asc&observation_start=${start}`,
      { cache: "no-store" }
    );
    if (!r.ok) return [];
    return ((await r.json()).observations ?? [])
      .filter((o: { value: string }) => o.value !== ".")
      .map((o: { date: string; value: string }) => ({
        date: new Date(o.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: parseFloat(o.value),
      }));
  } catch {
    return [];
  }
}

function startDate(tf: string): string {
  const d = new Date();
  if (tf === "1M") d.setDate(d.getDate() - 35);
  else if (tf === "3M") d.setMonth(d.getMonth() - 3);
  else if (tf === "6M") d.setMonth(d.getMonth() - 6);
  else if (tf === "1Y") d.setFullYear(d.getFullYear() - 1);
  else if (tf === "FOMC") return "2026-04-30";
  return d.toISOString().split("T")[0];
}

function n(q: LiveQuote | null): number { return q?.price ?? 0; }

function computeDrivers(
  cpi: LiveQuote | null, coreCpi: LiveQuote | null, unrate: LiveQuote | null,
  payems: LiveQuote | null, gdp: LiveQuote | null, hySpread: LiveQuote | null,
  fedfunds: LiveQuote | null, dgs2: LiveQuote | null, oil: LiveQuote | null,
): DriverScore[] {
  const cpiVal = n(cpi);
  const coreVal = n(coreCpi);
  const urVal = n(unrate) || 4.5;
  const gdpVal = n(gdp) || 2;
  const hyVal = n(hySpread) || 380;
  const ffVal = n(fedfunds) || 5;
  const twoYVal = n(dgs2) || 4.5;
  const oilVal = n(oil) || 75;

  return [
    {
      driver: "Inflation",
      score: cpiVal > 4 ? 92 : cpiVal > 3.5 ? 82 : cpiVal > 3 ? 70 : cpiVal > 2.5 ? 52 : 32,
      direction: cpiVal > 2.7 ? "hawkish" : "dovish",
      trend: cpi?.change != null ? (cpi.change >= 0 ? `+${cpi.change.toFixed(1)}` : cpi.change.toFixed(1)) : "0",
      sensitivity: "High",
      explanation: coreVal > 0
        ? `Core CPI at ${coreVal.toFixed(1)}% — services inflation ${coreVal > 3 ? "remains too sticky for a clean easing cycle" : "is decelerating toward target"}.`
        : `Headline CPI at ${cpiVal.toFixed(1)}% — ${cpiVal > 3 ? "above the Fed's 2% target, keeping policy tight" : "approaching the Fed's objective"}.`,
    },
    {
      driver: "Labor",
      score: urVal < 3.8 ? 80 : urVal < 4.2 ? 66 : urVal < 4.5 ? 50 : 36,
      direction: urVal < 4.2 ? "hawkish" : "neutral",
      trend: payems?.change != null ? (payems.change > 0 ? `+${payems.change.toFixed(0)}K` : `${payems.change.toFixed(0)}K`) : "0",
      sensitivity: "High",
      explanation: `Unemployment at ${urVal.toFixed(1)}% — ${urVal < 4 ? "labor remains tight, giving the Fed room to hold rates" : "gradual softening is visible but not yet forcing an easing pivot"}.`,
    },
    {
      driver: "Growth",
      score: gdpVal > 2.5 ? 62 : gdpVal > 1.5 ? 50 : gdpVal > 0 ? 36 : 22,
      direction: gdpVal > 1.5 ? "neutral" : "dovish",
      trend: gdp?.change != null ? (gdp.change >= 0 ? `+${gdp.change.toFixed(1)}` : gdp.change.toFixed(1)) : "0",
      sensitivity: "Medium",
      explanation: `GDP at ${gdpVal.toFixed(1)}% — ${gdpVal > 2 ? "growth holding above stall speed; credit not yet signaling a break" : "growth is slowing enough to put recession risk back on the table"}.`,
    },
    {
      driver: "Fed communication",
      score: ffVal > 5 ? 76 : ffVal > 4.5 ? 66 : ffVal > 4 ? 54 : 40,
      direction: ffVal > 4.5 ? "hawkish" : "neutral",
      trend: twoYVal > 0 ? `${(ffVal - twoYVal).toFixed(2)}` : "0",
      sensitivity: "High",
      explanation: `Fed Funds at ${ffVal.toFixed(2)}% vs 2Y at ${twoYVal.toFixed(2)}% — ${Math.abs(ffVal - twoYVal) < 0.3 ? "2Y closely tracks the policy rate, confirming market conviction in a patient Fed" : "the gap implies markets are pricing significant rate moves ahead"}.`,
    },
    {
      driver: "Energy",
      score: oilVal > 90 ? 70 : oilVal > 75 ? 55 : oilVal > 60 ? 44 : 32,
      direction: oilVal > 80 ? "hawkish" : "neutral",
      trend: oil?.pct != null ? (oil.pct >= 0 ? `+${oil.pct.toFixed(1)}%` : `${oil.pct.toFixed(1)}%`) : "0",
      sensitivity: "Medium",
      explanation: `WTI at $${oilVal.toFixed(0)} — ${oilVal > 80 ? "elevated energy prices keep headline inflation risk alive" : "energy is not the dominant inflation impulse at current levels"}.`,
    },
    {
      driver: "Credit conditions",
      score: hyVal > 600 ? 24 : hyVal > 500 ? 36 : hyVal > 430 ? 48 : hyVal > 360 ? 56 : 66,
      direction: hyVal > 500 ? "dovish" : "neutral",
      trend: hySpread?.change != null ? (hySpread.change >= 0 ? `+${hySpread.change.toFixed(0)}` : `${hySpread.change.toFixed(0)}`) : "0",
      sensitivity: "Medium",
      explanation: `HY OAS at ${hyVal.toFixed(0)}bps — ${hyVal > 500 ? "credit stress is materializing, confirming macro risk-off" : "spreads are contained, not yet confirming a recessionary shock"}.`,
    },
  ];
}

function computePressure(
  dgs10: LiveQuote | null, vix: LiveQuote | null, hySpread: LiveQuote | null,
  dxy: LiveQuote | null, oil: LiveQuote | null,
) {
  const ratesVal = dgs10 ? Math.min(100, Math.max(10, ((dgs10.price - 3) / 2) * 65 + Math.abs(dgs10.change) * 15)) : 50;
  const vixVal = vix ? Math.min(100, (vix.price / 40) * 100) : 50;
  const creditVal = hySpread ? Math.min(100, (hySpread.price / 700) * 100) : 40;
  const fxVal = dxy ? Math.min(100, 35 + Math.abs(dxy.pct) * 22) : 40;
  const commVal = oil ? Math.min(100, 25 + (oil.price / 100) * 42 + Math.abs(oil.pct) * 5) : 40;
  return [
    { name: "Rates",   value: Math.round(ratesVal) },
    { name: "FX",      value: Math.round(fxVal) },
    { name: "Equity",  value: Math.round(vixVal) },
    { name: "Credit",  value: Math.round(creditVal) },
    { name: "Commod.", value: Math.round(commVal) },
  ];
}

function computeTransmission(
  cpi: LiveQuote | null, coreCpi: LiveQuote | null, fedfunds: LiveQuote | null,
  dgs10: LiveQuote | null, sp500: LiveQuote | null, dxy: LiveQuote | null,
  hySpread: LiveQuote | null,
): TransmissionNode[] {
  const cpiVal = n(cpi); const coreVal = n(coreCpi); const ffVal = n(fedfunds);
  const tnxVal = n(dgs10); const sp500Pct = sp500?.pct ?? 0;
  const hyVal = n(hySpread) || 380; const dxyPct = dxy?.pct ?? 0;

  return [
    {
      label: "Inflation",
      state: cpiVal > 3.5 ? "Very sticky" : cpiVal > 3 ? "Sticky" : cpiVal > 2.5 ? "Moderating" : "Near target",
      pressure: cpiVal > 3 ? "hawkish" : "neutral",
      confidence: Math.round(cpiVal > 3.5 ? 86 : cpiVal > 3 ? 74 : 58),
      explanation: `CPI ${cpiVal.toFixed(1)}%, core ${coreVal.toFixed(1)}% — ${cpiVal > 3 ? "services inflation remains the binding macro constraint" : "inflation is decelerating toward the 2% objective"}.`,
    },
    {
      label: "Fed Path",
      state: ffVal > 5 ? "Firmly restrictive" : ffVal > 4.5 ? "Restrictive" : ffVal > 4 ? "Mildly restrictive" : "Neutral",
      pressure: ffVal > 4.5 ? "hawkish" : "neutral",
      confidence: fedfunds ? 78 : 50,
      explanation: `Fed Funds at ${ffVal.toFixed(2)}% — ${ffVal > 4.5 ? "policy is clearly restrictive; cuts require sustained disinflation progress" : "Fed is near neutral and data-dependent"}.`,
    },
    {
      label: "Rates",
      state: tnxVal > 4.5 ? "Long end very elevated" : tnxVal > 4 ? "Long end higher" : "Contained",
      pressure: tnxVal > 4.2 ? "hawkish" : "neutral",
      confidence: dgs10 ? 80 : 50,
      explanation: `10Y at ${tnxVal.toFixed(2)}% — ${tnxVal > 4.2 ? "the long end becomes the main equity valuation pressure point" : "the long end is not yet the dominant macro stress channel"}.`,
    },
    {
      label: "Equities",
      state: sp500Pct > 0.5 ? "Momentum intact" : sp500Pct < -0.5 ? "Multiple pressure" : "Consolidating",
      pressure: "neutral",
      confidence: sp500 ? 65 : 50,
      explanation: `S&P 500 ${sp500Pct >= 0 ? "+" : ""}${sp500Pct.toFixed(2)}% — ${sp500Pct < -0.5 ? "weakness concentrated in rate-sensitive and expensive assets" : "equities are absorbing the rates pressure"}.`,
    },
    {
      label: "FX / Credit",
      state: dxyPct > 0 && hyVal < 450 ? "USD firm; credit calm" : hyVal > 500 ? "Credit stress building" : "Mixed signals",
      pressure: "neutral",
      confidence: dxy && hySpread ? 62 : 45,
      explanation: `DXY ${dxyPct >= 0 ? "+" : ""}${dxyPct.toFixed(2)}%; HY OAS ${hyVal.toFixed(0)}bps — ${hyVal < 450 ? "credit resists full risk-off, confirming this is repricing not crisis" : "credit stress is beginning to broaden beyond rates"}.`,
    },
  ];
}

function computeAgreement(
  dgs10: LiveQuote | null, dgs2: LiveQuote | null, dxy: LiveQuote | null,
  sp500: LiveQuote | null, vix: LiveQuote | null, hySpread: LiveQuote | null,
  gold: LiveQuote | null,
): { confirming: AgreementSignal[]; contradicting: AgreementSignal[] } {
  const confirming: AgreementSignal[] = [];
  const contradicting: AgreementSignal[] = [];

  if (dgs10?.change != null && dgs10.change > 0.02)
    confirming.push({ signal: `10Y +${dgs10.change.toFixed(2)}%`, asset: "Rates", explanation: "The long end confirms higher-for-longer repricing narrative." });
  if (dxy?.pct != null && dxy.pct > 0.1)
    confirming.push({ signal: `USD +${dxy.pct.toFixed(2)}%`, asset: "FX", explanation: "Rate differentials continue to support the dollar." });
  if (sp500?.pct != null && sp500.pct < -0.3)
    confirming.push({ signal: `S&P ${sp500.pct.toFixed(2)}%`, asset: "Equities", explanation: "Rate-sensitive sectors reacting to discount-rate pressure." });
  if (dgs2?.price != null && dgs2.price > 4)
    confirming.push({ signal: `2Y at ${dgs2.price.toFixed(2)}%`, asset: "Rates", explanation: "Front end anchored by a patient Fed." });
  if (gold?.pct != null && gold.pct > 0.3)
    confirming.push({ signal: `Gold +${gold.pct.toFixed(2)}%`, asset: "Safe Haven", explanation: "Safe haven demand confirms underlying macro anxiety." });

  if (hySpread?.price != null && hySpread.price < 450)
    contradicting.push({ signal: `HY OAS ${hySpread.price.toFixed(0)}bps`, asset: "Credit", explanation: "Credit does not yet confirm a broad recessionary regime." });
  if (sp500?.pct != null && sp500.pct > 0.3)
    contradicting.push({ signal: `S&P +${sp500.pct.toFixed(2)}%`, asset: "Equities", explanation: "Equity momentum offsetting part of the rates pressure." });
  if (vix?.price != null && vix.price < 20)
    contradicting.push({ signal: `VIX ${vix.price.toFixed(1)}`, asset: "Risk", explanation: "Market is repricing rates, not yet pricing panic." });
  if (dxy?.pct != null && dxy.pct < -0.1)
    contradicting.push({ signal: `USD ${dxy.pct.toFixed(2)}%`, asset: "FX", explanation: "Dollar weakness contradicts pure hawkish repricing narrative." });

  if (!confirming.length) confirming.push({ signal: "Await data", asset: "–", explanation: "Signals populate once live FRED data loads." });
  if (!contradicting.length) contradicting.push({ signal: "No divergence", asset: "–", explanation: "Cross-asset signals are currently aligned." });

  return { confirming: confirming.slice(0, 4), contradicting: contradicting.slice(0, 3) };
}

function computeScenarios(
  cpi: LiveQuote | null, fedfunds: LiveQuote | null,
  hySpread: LiveQuote | null, gdp: LiveQuote | null,
): Scenario[] {
  const cpiVal = n(cpi) || 3; const ffVal = n(fedfunds) || 5;
  const hyVal = n(hySpread) || 380; const gdpVal = n(gdp) || 2;

  let base = 55, dovish = 20, hawkish = 25;
  if (cpiVal > 3.5) { hawkish += 5; dovish -= 5; }
  if (cpiVal < 2.8) { dovish += 8; hawkish -= 4; base -= 4; }
  if (hyVal > 500)  { base -= 5; hawkish += 5; }
  if (gdpVal < 1)   { dovish += 5; hawkish -= 5; }

  const total = base + dovish + hawkish;
  base = Math.round((base / total) * 100);
  dovish = Math.round((dovish / total) * 100);
  hawkish = 100 - base - dovish;

  return [
    {
      name: "Base case",
      probability: base,
      tone: "neutral",
      trigger: `Sticky inflation at ${cpiVal.toFixed(1)}%, patient Fed at ${ffVal.toFixed(2)}%, elevated long end.`,
      market: "Selective equity pressure; USD supported; credit stable.",
    },
    {
      name: "Dovish break",
      probability: dovish,
      tone: "positive",
      trigger: "Core services inflation surprises lower vs consensus.",
      market: "Yields fall; duration rallies; USD softens; equity multiples expand.",
    },
    {
      name: "Hawkish shock",
      probability: hawkish,
      tone: "negative",
      trigger: `Hot CPI or re-acceleration forces hikes back into distribution.`,
      market: "10Y higher; broad multiple pressure; credit widens.",
    },
  ];
}

function computeEdgeInsights(
  cpi: LiveQuote | null, dgs10: LiveQuote | null,
  hySpread: LiveQuote | null, dxy: LiveQuote | null,
): EdgeInsight[] {
  const cpiVal = n(cpi); const tnxVal = n(dgs10);
  const hyVal = n(hySpread) || 380; const dxyPct = dxy?.pct ?? 0;

  return [
    {
      tag: "Regime",
      title: cpiVal > 3 && hyVal < 450 ? "This is a discount-rate market, not a recession market." : cpiVal > 3.5 ? "Inflation is still the dominant market regime driver." : "The macro regime is in transition.",
      insight: hyVal < 450
        ? `Rates and FX confirm hawkish repricing, but HY spreads at ${hyVal.toFixed(0)}bps are not yet pricing a growth shock.`
        : `Rising credit spreads at ${hyVal.toFixed(0)}bps are beginning to confirm broader macro stress.`,
      why: hyVal < 450
        ? "Equity weakness should stay concentrated in duration-sensitive assets unless credit confirms stress."
        : "If spreads continue widening, the selloff could broaden well beyond rate-sensitive sectors.",
      confidence: Math.min(90, Math.round(58 + (cpiVal - 2.5) * 10)),
    },
    {
      tag: "Rates",
      title: tnxVal > 0 ? `The 10Y at ${tnxVal.toFixed(2)}% is the real equity pressure point.` : "The 10Y yield is the key macro variable to watch.",
      insight: tnxVal > 4
        ? `The 2Y reflects Fed patience, but the 10Y at ${tnxVal.toFixed(2)}% determines how much valuation pain reaches equities.`
        : `With the 10Y at ${tnxVal.toFixed(2)}%, equity multiple pressure is moderate and duration assets are finding a footing.`,
      why: tnxVal > 4.5
        ? "If the long end stabilizes, equities can absorb a hold; if it rises again, multiple pressure broadens."
        : "A break higher in yields remains the key signal for escalating equity stress.",
      confidence: Math.min(90, Math.round(68 + (tnxVal - 4) * 10)),
    },
    {
      tag: "FX",
      title: Math.abs(dxyPct) > 0.3 ? (dxyPct > 0 ? "The dollar is a hidden earnings headwind." : "Dollar weakness is a tailwind for multinationals.") : "The dollar is a neutral factor today.",
      insight: dxyPct > 0.3
        ? `USD strength of +${dxyPct.toFixed(2)}% tightens global financial conditions and pressures multinational revenue translation.`
        : dxyPct < -0.3
        ? `USD softness of ${dxyPct.toFixed(2)}% supports S&P 500 international revenue — a tailwind that may not be priced.`
        : "DXY is range-bound. FX is not the primary driver of cross-asset moves today.",
      why: "The FX impact on earnings appears in company guidance before it shows up in sell-side estimates.",
      confidence: 69,
    },
  ];
}

function computeRegime(
  cpi: LiveQuote | null, dgs10: LiveQuote | null,
  hySpread: LiveQuote | null, gdp: LiveQuote | null,
): { label: string; score: number; headline: string; body1: string; body2: string } {
  const cpiVal = n(cpi); const tnxVal = n(dgs10);
  const hyVal = n(hySpread) || 380; const gdpVal = n(gdp) || 2;

  let label = "Balanced"; let score = 50;
  let headline = "Market is in a balanced, data-dependent regime.";
  let body1 = "No single macro force is dominant enough to drive a clear directional trade.";
  let body2 = "Watch for inflation or labor data surprises to establish a clearer regime.";

  if (cpiVal > 3 && tnxVal > 4 && hyVal < 500) {
    label = "Higher-for-Longer Repricing"; score = 73;
    headline = "Higher-for-longer is back in control.";
    body1 = `Sticky inflation at ${cpiVal.toFixed(1)}% and resilient labor data keep the Fed patient, anchoring the front end and pushing the burden of repricing into the 10Y at ${tnxVal.toFixed(2)}%.`;
    body2 = `Equities are not in full risk-off, but discount-rate pressure is real. The decisive question is whether credit — currently ${hyVal.toFixed(0)}bps — begins to confirm the rates signal.`;
  } else if (cpiVal > 3.5 && hyVal > 500) {
    label = "Stagflation Risk"; score = 58;
    headline = "Stagflation risk is rising.";
    body1 = `Inflation at ${cpiVal.toFixed(1)}% with growth at ${gdpVal.toFixed(1)}% creates a challenging environment — the Fed cannot cut to support growth without risking re-acceleration.`;
    body2 = `HY spreads at ${hyVal.toFixed(0)}bps are beginning to confirm broader stress. Credit is the key variable to monitor.`;
  } else if (cpiVal < 2.5 && gdpVal < 1) {
    label = "Growth Scare"; score = 36;
    headline = "Growth is decelerating faster than inflation.";
    body1 = `GDP at ${gdpVal.toFixed(1)}% with CPI at ${cpiVal.toFixed(1)}% opens the door to easing, but the Fed must balance disinflation progress against labor market signals.`;
    body2 = "Duration assets should outperform in this environment as rate cut expectations re-price.";
  } else if (cpiVal < 2.5 && tnxVal < 4.2) {
    label = "Soft Landing / Risk-On"; score = 80;
    headline = "A soft landing narrative is taking hold.";
    body1 = `CPI at ${cpiVal.toFixed(1)}% approaching target with growth intact creates the ideal backdrop for risk assets and a gradual Fed easing cycle.`;
    body2 = "Equities can expand multiples in this environment. Watch for any inflation re-acceleration as the key invalidation.";
  } else if (hyVal > 600) {
    label = "Risk-Off / Credit Stress"; score = 28;
    headline = "Credit is pricing a genuine stress event.";
    body1 = `HY OAS at ${hyVal.toFixed(0)}bps signals that markets are moving beyond repricing toward a genuine risk-off regime. This is no longer just a rates story.`;
    body2 = "Defensive positioning and duration make sense until credit stabilizes. Watch for a reversal in spreads as the all-clear signal.";
  } else if (cpiVal > 3) {
    label = "Sticky Inflation"; score = 62;
    headline = "Sticky inflation is keeping the Fed's hands tied.";
    body1 = `CPI at ${cpiVal.toFixed(1)}% — well above the 2% target — continues to constrain the Fed's ability to pivot. The market is caught between inflation risk and slowing growth.`;
    body2 = "Sector rotation into real assets, energy, and financials makes sense. Duration remains vulnerable until inflation data breaks lower.";
  }

  return { label, score, headline, body1, body2 };
}

export async function GET(req: NextRequest) {
  const tf = req.nextUrl.searchParams.get("tf") ?? "6M";
  const start = startDate(tf);

  const [
    dgs2, dgs5, dgs10, dgs30, fedfunds,
    cpi, coreCpi, unrate, payems, gdp,
    hySpread, sp500, vix, gold, oil, dxy,
    hist5, hist10,
    rawNews, rawEvents,
  ] = await Promise.all([
    fredLatest("DGS2"), fredLatest("DGS5"), fredLatest("DGS10"),
    fredLatest("DGS30"), fredLatest("FEDFUNDS"),
    fredLatest("CPIAUCSL"), fredLatest("CPILFESL"),
    fredLatest("UNRATE"), fredLatest("PAYEMS"), fredLatest("GDP"),
    fredLatest("BAMLH0A0HYM2"), fredLatest("SP500"), fredLatest("VIXCLS"),
    fredLatest("GOLDAMGBD228NLBM"), fredLatest("DCOILWTICO"), fredLatest("DTWEXBGS"),
    fredHistory("DGS5", start), fredHistory("DGS10", start),
    fetchFinancialNews().catch(() => []),
    fetchEconomicCalendar().catch(() => []),
  ]);

  // Build yield history
  const dateMap = new Map<string, { date: string; tenYear?: number; fiveYear?: number }>();
  (hist10 as { date: string; value: number }[]).forEach((p) => dateMap.set(p.date, { date: p.date, tenYear: p.value }));
  (hist5 as { date: string; value: number }[]).forEach((p) => {
    const e = dateMap.get(p.date) ?? { date: p.date };
    dateMap.set(p.date, { ...e, fiveYear: p.value });
  });
  const history = [...dateMap.values()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const fredConnected = !!(dgs10 || dgs2);
  const regime = computeRegime(cpi, dgs10, hySpread, gdp);

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    tf,
    fredConnected,
    yields:   { dgs2, dgs5, dgs10, dgs30, fedfunds },
    equities: { sp500, vix, gold, oil, dxy },
    macro:    { cpi, coreCpi, unrate, payems, gdp, hySpread },
    history,
    upcomingEvents: (rawEvents as UpcomingEvent[]).slice(0, 6),
    topNews: rawNews.slice(0, 4),
    driverScores:   computeDrivers(cpi, coreCpi, unrate, payems, gdp, hySpread, fedfunds, dgs2, oil),
    pressureIndex:  computePressure(dgs10, vix, hySpread, dxy, oil),
    transmission:   computeTransmission(cpi, coreCpi, fedfunds, dgs10, sp500, dxy, hySpread),
    agreement:      computeAgreement(dgs10, dgs2, dxy, sp500, vix, hySpread, gold),
    scenarios:      computeScenarios(cpi, fedfunds, hySpread, gdp),
    edgeInsights:   computeEdgeInsights(cpi, dgs10, hySpread, dxy),
    regimeLabel:    regime.label,
    regimeScore:    regime.score,
    regimeHeadline: regime.headline,
    regimeBody1:    regime.body1,
    regimeBody2:    regime.body2,
    sources: {
      fred:    fredConnected,
      finnhub: rawEvents.length > 0,
      newsapi: rawNews.length > 0,
    },
  });
}
