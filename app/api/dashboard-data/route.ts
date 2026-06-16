import { NextRequest, NextResponse } from "next/server";
import { fetchFinancialNews } from "@/lib/sources/newsapi";
import { fetchMarketNews, fetchQuote } from "@/lib/sources/finnhub";

// Finnhub ETF proxies (SPY, GLD, USO) are NOT index values — only use for sectors.
// All main equities quotes come from FRED which has the actual index/commodity levels.

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
export type SectorQuote = { symbol: string; name: string; price: number; change: number; pct: number };

async function fredLatest(id: string, limit = 5): Promise<LiveQuote | null> {
  if (!KEY) return null;
  try {
    const r = await fetch(
      `${FRED}?series_id=${id}&api_key=${KEY}&file_type=json&sort_order=desc&limit=${limit}`,
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

// For index-level series (CPI, PCE) — compute proper YoY % from 13 monthly observations
async function fredYoY(id: string): Promise<LiveQuote | null> {
  if (!KEY) return null;
  try {
    const r = await fetch(
      `${FRED}?series_id=${id}&api_key=${KEY}&file_type=json&sort_order=desc&limit=15`,
      { cache: "no-store" }
    );
    if (!r.ok) return null;
    const obs: { value: string }[] = ((await r.json()).observations ?? []).filter(
      (o: { value: string }) => o.value !== "."
    );
    if (obs.length < 13) return null;
    const cur  = parseFloat(obs[0].value);
    const prev = parseFloat(obs[1].value);
    const yr   = parseFloat(obs[12].value);
    const yrP  = obs[13] ? parseFloat(obs[13].value) : yr;
    const yoy     = ((cur  / yr)  - 1) * 100;
    const prevYoy = ((prev / yrP) - 1) * 100;
    return { price: yoy, change: yoy - prevYoy, pct: yoy - prevYoy };
  } catch {
    return null;
  }
}

// Returns raw ISO dates (YYYY-MM-DD) — never format here, format in the chart component
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
      .map((o: { date: string; value: string }) => ({ date: o.date, value: parseFloat(o.value) }));
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
      explanation: `Core CPI at ${coreVal.toFixed(1)}% — services inflation ${coreVal > 3 ? "remains too sticky for a clean easing cycle" : "is decelerating toward target"}.`,
    },
    {
      driver: "Labor",
      score: urVal < 3.8 ? 80 : urVal < 4.2 ? 66 : urVal < 4.5 ? 50 : 36,
      direction: urVal < 4.2 ? "hawkish" : "neutral",
      trend: payems?.change != null ? (payems.change > 0 ? `+${payems.change.toFixed(0)}K` : `${payems.change.toFixed(0)}K`) : "0",
      sensitivity: "High",
      explanation: `Unemployment at ${urVal.toFixed(1)}%.`,
    },
    {
      driver: "Growth",
      score: gdpVal > 2.5 ? 62 : gdpVal > 1.5 ? 50 : gdpVal > 0 ? 36 : 22,
      direction: gdpVal > 1.5 ? "neutral" : "dovish",
      trend: gdp?.change != null ? (gdp.change >= 0 ? `+${gdp.change.toFixed(1)}` : gdp.change.toFixed(1)) : "0",
      sensitivity: "Medium",
      explanation: `GDP at ${gdpVal.toFixed(1)}%.`,
    },
    {
      driver: "Fed communication",
      score: ffVal > 5 ? 76 : ffVal > 4.5 ? 66 : ffVal > 4 ? 54 : 40,
      direction: ffVal > 4.5 ? "hawkish" : "neutral",
      trend: twoYVal > 0 ? `${(ffVal - twoYVal).toFixed(2)}` : "0",
      sensitivity: "High",
      explanation: `Fed Funds at ${ffVal.toFixed(2)}% vs 2Y at ${twoYVal.toFixed(2)}%.`,
    },
    {
      driver: "Energy",
      score: oilVal > 90 ? 70 : oilVal > 75 ? 55 : oilVal > 60 ? 44 : 32,
      direction: oilVal > 80 ? "hawkish" : "neutral",
      trend: oil?.pct != null ? (oil.pct >= 0 ? `+${oil.pct.toFixed(1)}%` : `${oil.pct.toFixed(1)}%`) : "0",
      sensitivity: "Medium",
      explanation: `WTI at $${oilVal.toFixed(0)}.`,
    },
    {
      driver: "Credit conditions",
      score: hyVal > 600 ? 24 : hyVal > 500 ? 36 : hyVal > 430 ? 48 : hyVal > 360 ? 56 : 66,
      direction: hyVal > 500 ? "dovish" : "neutral",
      trend: hySpread?.change != null ? (hySpread.change >= 0 ? `+${hySpread.change.toFixed(0)}` : `${hySpread.change.toFixed(0)}`) : "0",
      sensitivity: "Medium",
      explanation: `HY OAS at ${hyVal.toFixed(0)}bps.`,
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
      explanation: `CPI ${cpiVal.toFixed(1)}%, core ${coreVal.toFixed(1)}%.`,
    },
    {
      label: "Fed Path",
      state: ffVal > 5 ? "Firmly restrictive" : ffVal > 4.5 ? "Restrictive" : ffVal > 4 ? "Mildly restrictive" : "Neutral",
      pressure: ffVal > 4.5 ? "hawkish" : "neutral",
      confidence: fedfunds ? 78 : 50,
      explanation: `Fed Funds at ${ffVal.toFixed(2)}%.`,
    },
    {
      label: "Rates",
      state: tnxVal > 4.5 ? "Long end very elevated" : tnxVal > 4 ? "Long end higher" : "Contained",
      pressure: tnxVal > 4.2 ? "hawkish" : "neutral",
      confidence: dgs10 ? 80 : 50,
      explanation: `10Y at ${tnxVal.toFixed(2)}%.`,
    },
    {
      label: "Equities",
      state: sp500Pct > 0.5 ? "Momentum intact" : sp500Pct < -0.5 ? "Multiple pressure" : "Consolidating",
      pressure: "neutral",
      confidence: sp500 ? 65 : 50,
      explanation: `S&P 500 ${sp500Pct >= 0 ? "+" : ""}${sp500Pct.toFixed(2)}%.`,
    },
    {
      label: "FX / Credit",
      state: dxyPct > 0 && hyVal < 450 ? "USD firm; credit calm" : hyVal > 500 ? "Credit stress building" : "Mixed signals",
      pressure: "neutral",
      confidence: dxy && hySpread ? 62 : 45,
      explanation: `DXY ${dxyPct >= 0 ? "+" : ""}${dxyPct.toFixed(2)}%; HY OAS ${hyVal.toFixed(0)}bps.`,
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
    confirming.push({ signal: `10Y +${dgs10.change.toFixed(2)}%`, asset: "Rates", explanation: "" });
  if (dxy?.pct != null && dxy.pct > 0.1)
    confirming.push({ signal: `USD +${dxy.pct.toFixed(2)}%`, asset: "FX", explanation: "" });
  if (sp500?.pct != null && sp500.pct < -0.3)
    confirming.push({ signal: `S&P ${sp500.pct.toFixed(2)}%`, asset: "Equities", explanation: "" });
  if (dgs2?.price != null && dgs2.price > 4)
    confirming.push({ signal: `2Y at ${dgs2.price.toFixed(2)}%`, asset: "Rates", explanation: "" });
  if (gold?.pct != null && gold.pct > 0.3)
    confirming.push({ signal: `Gold +${gold.pct.toFixed(2)}%`, asset: "Safe Haven", explanation: "" });

  if (hySpread?.price != null && hySpread.price < 450)
    contradicting.push({ signal: `HY OAS ${hySpread.price.toFixed(0)}bps`, asset: "Credit", explanation: "" });
  if (sp500?.pct != null && sp500.pct > 0.3)
    contradicting.push({ signal: `S&P +${sp500.pct.toFixed(2)}%`, asset: "Equities", explanation: "" });
  if (vix?.price != null && vix.price < 20)
    contradicting.push({ signal: `VIX ${vix.price.toFixed(1)}`, asset: "Risk", explanation: "" });
  if (dxy?.pct != null && dxy.pct < -0.1)
    contradicting.push({ signal: `USD ${dxy.pct.toFixed(2)}%`, asset: "FX", explanation: "" });

  if (!confirming.length) confirming.push({ signal: "Await data", asset: "–", explanation: "" });
  if (!contradicting.length) contradicting.push({ signal: "No divergence", asset: "–", explanation: "" });

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
    { name: "Base case",    probability: base,    tone: "neutral",  trigger: "", market: "" },
    { name: "Dovish break", probability: dovish,  tone: "positive", trigger: "", market: "" },
    { name: "Hawkish shock",probability: hawkish, tone: "negative", trigger: "", market: "" },
  ];
}

function computeRegime(
  cpi: LiveQuote | null, dgs10: LiveQuote | null,
  hySpread: LiveQuote | null, gdp: LiveQuote | null,
): { label: string; score: number } {
  const cpiVal = n(cpi); const tnxVal = n(dgs10);
  const hyVal = n(hySpread) || 380; const gdpVal = n(gdp) || 2;

  if (cpiVal > 3 && tnxVal > 4 && hyVal < 500)
    return { label: "Higher-for-Longer Repricing", score: 73 };
  if (cpiVal > 3.5 && hyVal > 500)
    return { label: "Stagflation Risk", score: 58 };
  if (cpiVal < 2.5 && gdpVal < 1)
    return { label: "Growth Scare", score: 36 };
  if (cpiVal < 2.5 && tnxVal < 4.2)
    return { label: "Soft Landing / Risk-On", score: 80 };
  if (hyVal > 600)
    return { label: "Risk-Off / Credit Stress", score: 28 };
  if (cpiVal > 3)
    return { label: "Sticky Inflation", score: 62 };
  return { label: "Balanced", score: 50 };
}

const SECTORS: { symbol: string; name: string }[] = [
  { symbol: "XLK", name: "Technology" },
  { symbol: "XLF", name: "Financials" },
  { symbol: "XLE", name: "Energy" },
  { symbol: "XLV", name: "Healthcare" },
  { symbol: "XLI", name: "Industrials" },
  { symbol: "XLU", name: "Utilities" },
  { symbol: "XLY", name: "Cons. Disc." },
  { symbol: "XLP", name: "Cons. Staples" },
];

export async function GET(req: NextRequest) {
  const tf = req.nextUrl.searchParams.get("tf") ?? "6M";
  const start = startDate(tf);

  const [
    dgs2, dgs5, dgs10, dgs30, fedfunds,
    cpi, coreCpi, pce, unrate, payems, gdp,
    hySpread, fredSP500, fredVix, fredGold, oil, dxy,
    breakeven, mortgage, sentiment, indpro, retail, t10y2y, claims,
    fredNasdaq,
    hist5, hist10, histSP500, histVIX, histGold, histOil, histNasdaq,
    rawNews, rawFinnhubNews,
    ...sectorQuotes
  ] = await Promise.all([
    fredLatest("DGS2"), fredLatest("DGS5"), fredLatest("DGS10"),
    fredLatest("DGS30"), fredLatest("FEDFUNDS"),
    fredYoY("CPIAUCSL"), fredYoY("CPILFESL"), fredYoY("PCEPI"),
    fredLatest("UNRATE"), fredLatest("PAYEMS"),
    fredLatest("A191RL1Q225SBEA"),
    fredLatest("BAMLH0A0HYM2"),
    fredLatest("SP500"),
    fredLatest("VIXCLS"),
    fredLatest("GOLDAMGBD228NLBM", 10),
    fredLatest("DCOILWTICO"),
    fredLatest("DTWEXBGS"),
    // Extra FRED series for Global Data Snapshot
    fredLatest("T10YIE"),
    fredLatest("MORTGAGE30US"),
    fredLatest("UMCSENT"),
    fredLatest("INDPRO"),
    fredLatest("RSXFS"),
    fredLatest("T10Y2Y"),
    fredLatest("ICSA"),
    fredLatest("NASDAQCOM", 5),
    // History — keep raw ISO dates, sort ascending
    fredHistory("DGS5", start), fredHistory("DGS10", start),
    fredHistory("SP500", start), fredHistory("VIXCLS", start),
    fredHistory("GOLDAMGBD228NLBM", start), fredHistory("DCOILWTICO", start),
    fredHistory("NASDAQCOM", start),
    // News
    fetchFinancialNews().catch(() => []),
    fetchMarketNews().catch(() => []),
    // Sector ETFs only from Finnhub
    ...SECTORS.map((s) => fetchQuote(s.symbol).catch(() => null)),
  ]);

  // Sort history arrays (ISO dates sort lexicographically = chronologically)
  const sortH = (arr: { date: string; value: number }[]) =>
    [...arr].sort((a, b) => a.date.localeCompare(b.date));

  const historySP500  = sortH(histSP500  as { date: string; value: number }[]);
  const historyVIX    = sortH(histVIX    as { date: string; value: number }[]);
  const historyGold   = sortH(histGold   as { date: string; value: number }[]);
  const historyOil    = sortH(histOil    as { date: string; value: number }[]);
  const historyNasdaq = sortH(histNasdaq as { date: string; value: number }[]);

  // Build yield history map
  const dateMap = new Map<string, { date: string; tenYear?: number; fiveYear?: number }>();
  (hist10 as { date: string; value: number }[]).forEach((p) => dateMap.set(p.date, { date: p.date, tenYear: p.value }));
  (hist5  as { date: string; value: number }[]).forEach((p) => {
    const e = dateMap.get(p.date) ?? { date: p.date };
    dateMap.set(p.date, { ...e, fiveYear: p.value });
  });
  const history = [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Derive live quotes from last two history points (consistent with chart, avoids FRED lag mismatch)
  function quoteFromHistory(arr: { date: string; value: number }[]): LiveQuote | null {
    if (arr.length < 2) return arr.length === 1 ? { price: arr[0].value, change: 0, pct: 0 } : null;
    const cur = arr[arr.length - 1].value;
    const prev = arr[arr.length - 2].value;
    const change = cur - prev;
    return { price: cur, change, pct: prev ? (change / prev) * 100 : 0 };
  }

  // Use history-derived quotes for index series so tile and chart are always consistent
  const sp500  = quoteFromHistory(historySP500)  ?? fredSP500;
  const vix    = quoteFromHistory(historyVIX)    ?? fredVix;
  const gold   = quoteFromHistory(historyGold)   ?? fredGold;
  const nasdaq = quoteFromHistory(historyNasdaq) ?? fredNasdaq;

  // BAMLH0A0HYM2 is in percent (e.g. 2.97 = 297bps) — convert to bps
  const hySpreadBps: typeof hySpread = hySpread
    ? { price: hySpread.price * 100, change: hySpread.change * 100, pct: hySpread.pct }
    : null;

  // Build sector array
  const sectors: SectorQuote[] = SECTORS.map((s, i) => {
    const q = sectorQuotes[i] as { price: number; change: number; pct: number } | null;
    return {
      symbol: s.symbol,
      name:   s.name,
      price:  q?.price ?? 0,
      change: q?.change ?? 0,
      pct:    q?.pct ?? 0,
    };
  }).filter((s) => s.price > 0);

  const fredConnected = !!(dgs10 || dgs2);
  const regime = computeRegime(cpi, dgs10, hySpreadBps, gdp);

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    tf,
    fredConnected,
    yields:   { dgs2, dgs5, dgs10, dgs30, fedfunds },
    equities: { sp500, vix, gold, oil, dxy, nasdaq: nasdaq ?? fredNasdaq },
    macro:    { cpi, coreCpi, pce, unrate, payems, gdp, hySpread: hySpreadBps },
    extraData: { breakeven, mortgage, sentiment, indpro, retail, t10y2y, claims },
    history,
    historySP500,
    historyVIX,
    historyGold,
    historyOil,
    historyNasdaq,
    sectors,
    finnhubNews: (rawFinnhubNews as { headline: string; source: string; url: string }[]).slice(0, 8),
    topNews: (rawNews as { title: string; source: string; description: string; url: string }[]).slice(0, 8),
    driverScores:  computeDrivers(cpi, coreCpi, unrate, payems, gdp, hySpreadBps, fedfunds, dgs2, oil),
    pressureIndex: computePressure(dgs10, vix, hySpreadBps, dxy, oil),
    transmission:  computeTransmission(cpi, coreCpi, fedfunds, dgs10, sp500, dxy, hySpreadBps),
    agreement:     computeAgreement(dgs10, dgs2, dxy, sp500, vix, hySpreadBps, gold),
    scenarios:     computeScenarios(cpi, fedfunds, hySpreadBps, gdp),
    regimeLabel:   regime.label,
    regimeScore:   regime.score,
    sources: {
      fred:    fredConnected,
      finnhub: (rawFinnhubNews as unknown[]).length > 0,
      newsapi: (rawNews as unknown[]).length > 0,
    },
  });
}
