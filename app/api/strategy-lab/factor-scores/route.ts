// ── Strategy Lab — Factor Scores API ─────────────────────────────────────────
// POST { holdings: { ticker, weight }[] }
// Returns per-stock factor scores (momentum, low-vol, value, quality, size)
// computed from Yahoo Finance adjusted prices + FMP key-metrics-ttm.
// All factor scores are cross-sectionally z-scored within the portfolio universe.

import { NextRequest, NextResponse } from "next/server";
import { fetchAdjustedHistoryBatch } from "@/lib/sources/yahoo";
import { crossSectionalZ } from "@/lib/strategy-lab/portfolio";
import type { FactorScoreResult, PortfolioExposure, PortfolioPosition } from "@/lib/strategy-lab/portfolio";

export const dynamic  = "force-dynamic";
export const maxDuration = 60;

const FMP_KEY = process.env.FMP_API_KEY ?? "";
const FMP_V3  = "https://financialmodelingprep.com/api/v3";

// ── FMP helpers ───────────────────────────────────────────────────────────────

type FmpMetrics = {
  symbol:                       string;
  marketCapTTM:                 number;
  peRatioTTM:                   number;
  earningsYieldTTM:             number;
  freeCashFlowYieldTTM:         number;
  enterpriseValueOverEBITDATTM: number;
  roicTTM:                      number;
  grossProfitMarginTTM:         number;
  netDebtToEBITDATTM:           number;
  pbRatioTTM:                   number;
  roeTTM:                       number;
};

type FmpProfile = {
  symbol:      string;
  companyName: string;
  sector:      string;
  price:       number;
  mktCap:      number;
};

async function fetchFmpProfiles(tickers: string[]): Promise<FmpProfile[]> {
  if (!FMP_KEY || !tickers.length) return [];
  try {
    const r = await fetch(`${FMP_V3}/profile/${tickers.join(",")}?apikey=${FMP_KEY}`, { cache: "no-store" });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

const YF_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";
async function fetchYahooMarketCaps(tickers: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!tickers.length) return out;
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers.join(",")}&fields=marketCap`;
    const r = await fetch(url, { headers: { "User-Agent": YF_UA }, cache: "no-store" });
    if (!r.ok) return out;
    const result = (await r.json())?.quoteResponse?.result ?? [];
    for (const q of result) {
      if (q.symbol && q.marketCap > 0) out.set(q.symbol, q.marketCap);
    }
  } catch { /* best effort */ }
  return out;
}

async function fetchFmpKeyMetricsOne(ticker: string): Promise<FmpMetrics | null> {
  if (!FMP_KEY) return null;
  try {
    const r = await fetch(`${FMP_V3}/key-metrics-ttm/${ticker}?apikey=${FMP_KEY}`, { cache: "no-store" });
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data) && data.length > 0 ? { ...data[0], symbol: ticker } : null;
  } catch { return null; }
}

// ── Price-based factor computations ──────────────────────────────────────────

type PriceFactor = {
  momentum12_1: number | null;
  momentum6_1:  number | null;
  realizedVol:  number | null;
  beta:         number | null;
};

function computePriceFactors(
  prices:    { date: string; adjClose: number }[],
  spyPrices: { date: string; adjClose: number }[],
): PriceFactor {
  if (prices.length < 30) return { momentum12_1: null, momentum6_1: null, realizedVol: null, beta: null };

  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;

  // Skip last 21 trading days (~1 month) to avoid short-term reversal
  const refIdx = Math.max(0, n - 22);   // price 1 month ago
  const p0     = sorted[refIdx].adjClose;
  const p12    = sorted[Math.max(0, refIdx - 231)].adjClose; // ~12 months before ref
  const p6     = sorted[Math.max(0, refIdx - 105)].adjClose; // ~5 months before ref

  const momentum12_1 = p12 > 0 ? (p0 / p12 - 1) : null;
  const momentum6_1  = p6  > 0 ? (p0 / p6  - 1) : null;

  // Daily log returns for vol + beta (last 252 trading days)
  const window = sorted.slice(Math.max(0, n - 253));
  const stockRets: number[] = [];
  for (let i = 1; i < window.length; i++) {
    if (window[i - 1].adjClose > 0)
      stockRets.push(Math.log(window[i].adjClose / window[i - 1].adjClose));
  }

  // Realised annualised vol
  const muR = stockRets.reduce((s, r) => s + r, 0) / (stockRets.length || 1);
  const varR = stockRets.reduce((s, r) => s + (r - muR) ** 2, 0) / (stockRets.length - 1 || 1);
  const realizedVol = Math.sqrt(varR * 252);

  // Beta vs SPY — align dates
  const spySorted = [...spyPrices].sort((a, b) => a.date.localeCompare(b.date));
  const spySlice  = spySorted.slice(Math.max(0, spySorted.length - 253));
  const spyMap    = new Map(spySlice.map(p => [p.date, p.adjClose]));

  const pairs: [number, number][] = [];
  for (let i = 1; i < window.length; i++) {
    const d    = window[i].date;
    const dPrev= window[i - 1].date;
    const sNow = spyMap.get(d);
    const sPrv = spyMap.get(dPrev);
    if (sNow && sPrv && sPrv > 0 && window[i - 1].adjClose > 0) {
      const sr = Math.log(sNow / sPrv);
      const er = Math.log(window[i].adjClose / window[i - 1].adjClose);
      pairs.push([er, sr]);
    }
  }

  let beta: number | null = null;
  if (pairs.length >= 30) {
    const muE = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
    const muS = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
    const cov = pairs.reduce((s, p) => s + (p[0] - muE) * (p[1] - muS), 0) / pairs.length;
    const vs  = pairs.reduce((s, p) => s + (p[1] - muS) ** 2, 0) / pairs.length;
    beta = vs > 0 ? cov / vs : null;
  }

  return { momentum12_1, momentum6_1, realizedVol, beta };
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { holdings } = await req.json() as { holdings: PortfolioPosition[] };
  if (!holdings?.length) return NextResponse.json({ error: "holdings required" }, { status: 400 });

  const tickers = holdings.map(h => h.ticker).filter(t => t !== "USD" && !t.includes("Crncy") && !t.includes("Cash"));

  // ── Fetch price data + FMP data in parallel ───────────────────────────────
  const [priceMap, fmpProfileRaw, fmpMetricsRaw, yahooMktCaps] = await Promise.all([
    fetchAdjustedHistoryBatch([...tickers, "SPY"], "2y"),
    fetchFmpProfiles(tickers),
    Promise.all(tickers.map(t => fetchFmpKeyMetricsOne(t))).then(r => r.filter(Boolean) as FmpMetrics[]),
    fetchYahooMarketCaps(tickers),
  ]);

  const spyBars  = priceMap.get("SPY") ?? [];
  const metricsMap = new Map(fmpMetricsRaw.map(m => [m.symbol, m]));
  const profileMap = new Map(fmpProfileRaw.map(p => [p.symbol, p]));

  // ── Compute raw factor values per stock ───────────────────────────────────
  type RawRow = {
    ticker: string; weight: number;
    momentum12_1: number | null; momentum6_1: number | null;
    realizedVol:  number | null; beta: number | null;
    earningsYield: number | null; fcfYield: number | null;
    evEbitda: number | null; roic: number | null;
    grossMargin: number | null; netLeverage: number | null;
    logMktCap: number | null;
    name: string; sector: string; price: number; marketCap: number;
    priceDataOk: boolean; fundDataOk: boolean;
  };

  const rawRows: RawRow[] = tickers.map(ticker => {
    const holding = holdings.find(h => h.ticker === ticker)!;
    const bars    = priceMap.get(ticker) ?? [];
    const m       = metricsMap.get(ticker);
    const prof    = profileMap.get(ticker);

    const pf = computePriceFactors(bars, spyBars);

    // FMP fundamental factors
    const earningsYield = m?.earningsYieldTTM            ?? (m?.peRatioTTM && m.peRatioTTM > 0 ? 1 / m.peRatioTTM : null);
    const fcfYield      = m?.freeCashFlowYieldTTM        ?? null;
    const evEbitda      = m?.enterpriseValueOverEBITDATTM ?? null;  // raw EV/EBITDA (lower = better value)
    const roic          = m?.roicTTM                       ?? null;
    const grossMargin   = m?.grossProfitMarginTTM         ?? null;
    const netLeverage   = m?.netDebtToEBITDATTM           ?? null;  // lower = better quality
    const mktCap        = prof?.mktCap ?? m?.marketCapTTM ?? yahooMktCaps.get(ticker) ?? 0;
    const logMktCap     = mktCap > 0 ? Math.log(mktCap) : null;

    return {
      ticker, weight: holding.weight,
      ...pf,
      earningsYield, fcfYield, evEbitda, roic, grossMargin, netLeverage, logMktCap,
      name:      prof?.companyName ?? holding.name ?? ticker,
      sector:    prof?.sector      ?? "Unknown",
      price:     prof?.price       ?? (bars.length ? bars[bars.length - 1].adjClose : 0),
      marketCap: mktCap,
      priceDataOk: bars.length >= 60,
      fundDataOk:  !!m,
    };
  });

  // ── Cross-sectional z-scoring within portfolio ────────────────────────────
  // Momentum composite: 0.6 × (12-1M z) + 0.4 × (6-1M z)
  const z12   = crossSectionalZ(rawRows.map(r => r.momentum12_1));
  const z6    = crossSectionalZ(rawRows.map(r => r.momentum6_1));
  const zMomArr = z12.map((v12, i) => {
    const v6 = z6[i];
    if (v12 == null && v6 == null) return null;
    return ((v12 ?? 0) * 0.6 + (v6 ?? 0) * 0.4) / ((v12 != null ? 0.6 : 0) + (v6 != null ? 0.4 : 0));
  });

  // Low-vol composite: 0.5 × (-vol z) + 0.5 × (-beta z)
  const zVol  = crossSectionalZ(rawRows.map(r => r.realizedVol != null ? -r.realizedVol : null));
  const zBeta = crossSectionalZ(rawRows.map(r => r.beta        != null ? -r.beta        : null));
  const zLVArr = zVol.map((vv, i) => {
    const vb = zBeta[i];
    if (vv == null && vb == null) return null;
    return ((vv ?? 0) * 0.5 + (vb ?? 0) * 0.5) / ((vv != null ? 0.5 : 0) + (vb != null ? 0.5 : 0));
  });

  // Value composite: 0.35 × ey_z + 0.35 × fcfy_z + 0.30 × (-ev_ebitda_z)
  const zEY  = crossSectionalZ(rawRows.map(r => r.earningsYield));
  const zFCF = crossSectionalZ(rawRows.map(r => r.fcfYield));
  const zEVE = crossSectionalZ(rawRows.map(r => r.evEbitda != null ? -r.evEbitda : null)); // inverted
  const zValArr = rawRows.map((_, i) => {
    const ey = zEY[i]; const fc = zFCF[i]; const ev = zEVE[i];
    const parts = ([ey, 0.35] as const).concat(); // typed workaround
    if (ey == null && fc == null && ev == null) return null;
    let sum = 0; let w = 0;
    if (ey != null) { sum += ey * 0.35; w += 0.35; }
    if (fc != null) { sum += fc * 0.35; w += 0.35; }
    if (ev != null) { sum += ev * 0.30; w += 0.30; }
    return w > 0 ? sum / w : null;
  });

  // Quality composite: 0.40 × roic_z + 0.35 × gm_z + 0.25 × (-lev_z)
  const zROIC = crossSectionalZ(rawRows.map(r => r.roic));
  const zGM   = crossSectionalZ(rawRows.map(r => r.grossMargin));
  const zLev  = crossSectionalZ(rawRows.map(r => r.netLeverage != null ? -r.netLeverage : null)); // inverted
  const zQualArr = rawRows.map((_, i) => {
    const ro = zROIC[i]; const gm = zGM[i]; const lv = zLev[i];
    if (ro == null && gm == null && lv == null) return null;
    let sum = 0; let w = 0;
    if (ro != null) { sum += ro * 0.40; w += 0.40; }
    if (gm != null) { sum += gm * 0.35; w += 0.35; }
    if (lv != null) { sum += lv * 0.25; w += 0.25; }
    return w > 0 ? sum / w : null;
  });

  // Size: smaller market cap = positive size tilt (academic factor)
  const zSizeArr = crossSectionalZ(rawRows.map(r => r.logMktCap != null ? -r.logMktCap : null));

  // ── Build final result rows ───────────────────────────────────────────────
  const scores: FactorScoreResult[] = rawRows.map((r, i) => {
    const zm = zMomArr[i];
    const zlv = zLVArr[i];
    const zv  = zValArr[i];
    const zq  = zQualArr[i];
    const zs  = zSizeArr[i];

    // Simple equal-weighted composite for now (regime weighting applied client-side)
    const parts = [zm, zlv, zv, zq, zs].filter(v => v != null) as number[];
    const compositeScore = parts.length ? parts.reduce((s, v) => s + v, 0) / parts.length : 0;

    return {
      ticker:        r.ticker,
      weight:        r.weight,
      name:          r.name,
      sector:        r.sector,
      price:         r.price,
      marketCap:     r.marketCap,
      momentum12_1:  r.momentum12_1 != null ? Math.round(r.momentum12_1 * 1000) / 1000 : null,
      momentum6_1:   r.momentum6_1  != null ? Math.round(r.momentum6_1  * 1000) / 1000 : null,
      realizedVol:   r.realizedVol  != null ? Math.round(r.realizedVol  * 1000) / 1000 : null,
      beta:          r.beta         != null ? Math.round(r.beta          * 100)  / 100  : null,
      earningsYield: r.earningsYield != null ? Math.round(r.earningsYield * 1000) / 1000 : null,
      fcfYield:      r.fcfYield      != null ? Math.round(r.fcfYield      * 1000) / 1000 : null,
      evEbitda:      r.evEbitda      != null ? Math.round(r.evEbitda      * 10)   / 10   : null,
      roic:          r.roic          != null ? Math.round(r.roic          * 1000) / 1000 : null,
      grossMargin:   r.grossMargin   != null ? Math.round(r.grossMargin   * 1000) / 1000 : null,
      netLeverage:   r.netLeverage   != null ? Math.round(r.netLeverage   * 10)   / 10   : null,
      zMomentum:  zm  != null ? Math.round(zm  * 100) / 100 : null,
      zLowVol:    zlv != null ? Math.round(zlv * 100) / 100 : null,
      zValue:     zv  != null ? Math.round(zv  * 100) / 100 : null,
      zQuality:   zq  != null ? Math.round(zq  * 100) / 100 : null,
      zSize:      zs  != null ? Math.round(zs  * 100) / 100 : null,
      compositeScore: Math.round(compositeScore * 100) / 100,
      priceDataOk: r.priceDataOk,
      fundDataOk:  r.fundDataOk,
    };
  });

  // ── Portfolio-level factor exposures (weight-averaged z-scores) ───────────
  const factorNames = ["Momentum", "LowVolatility", "Value", "Quality", "Size"] as const;
  const zArrays = [zMomArr, zLVArr, zValArr, zQualArr, zSizeArr];
  const totalEquityWeight = scores.reduce((s, r) => s + r.weight, 0) || 1;

  const portfolioExposures = factorNames.map((factor, fi): PortfolioExposure => {
    let sum = 0; let wsum = 0;
    scores.forEach((s, si) => {
      const z = zArrays[fi][si];
      if (z != null) { sum += z * s.weight; wsum += s.weight; }
    });
    const portfolioExposure = wsum > 0 ? Math.round((sum / wsum) * 100) / 100 : null;
    return {
      factor,
      portfolioExposure,
      regimeTarget: 0,
      gap: null,
    };
  });

  return NextResponse.json({
    scores,
    portfolioExposures,
    computedAt: new Date().toISOString(),
    totalStocks: scores.length,
    priceDataOk: scores.filter(s => s.priceDataOk).length,
    fundDataOk:  scores.filter(s => s.fundDataOk).length,
  });
}
