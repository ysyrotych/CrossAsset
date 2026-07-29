// ── Strategy Lab — Universe Scores API ──────────────────────────────────────
// GET /api/strategy-lab/universe-scores
// Returns factor scores for all stocks in the investment universe.

import { NextResponse } from "next/server";
import { fetchAdjustedHistoryBatch } from "@/lib/sources/yahoo";
import { crossSectionalZ } from "@/lib/strategy-lab/portfolio";
import type { FactorScoreResult } from "@/lib/strategy-lab/portfolio";
import { UNIVERSE, getReportingLag } from "@/lib/strategy-lab/universe";

export const dynamic  = "force-dynamic";
export const maxDuration = 60;

const FMP_KEY = process.env.FMP_API_KEY ?? "";
const FMP_V3  = "https://financialmodelingprep.com/api/v3";
const YF_UA   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36";

// ── FMP types ─────────────────────────────────────────────────────────────────

type FmpMetrics = {
  symbol:                       string;
  peRatioTTM:                   number;
  earningsYieldTTM:             number;
  freeCashFlowYieldTTM:         number;
  enterpriseValueOverEBITDATTM: number;
  roicTTM:                      number;
  grossProfitMarginTTM:         number;
  netDebtToEBITDATTM:           number;
  marketCapTTM:                 number;
};

type FmpProfile = {
  symbol: string; companyName: string; sector: string;
  price: number; mktCap: number;
};

// ── Yahoo Finance batch fundamentals (free, no key required) ─────────────────

type YFQuote = {
  symbol: string;
  price: number;
  marketCap: number;
  trailingPE: number | null;
  priceToBook: number | null;
  returnOnEquity: number | null;
  profitMargins: number | null;
};

async function fetchYahooQuotes(tickers: string[]): Promise<Map<string, YFQuote>> {
  const out = new Map<string, YFQuote>();
  if (!tickers.length) return out;
  const fields = "regularMarketPrice,marketCap,trailingPE,priceToBook,returnOnEquity,profitMargins,bookValue";
  try {
    const chunks: string[][] = [];
    for (let i = 0; i < tickers.length; i += 50) chunks.push(tickers.slice(i, i + 50));
    for (const chunk of chunks) {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${chunk.join(",")}&fields=${fields}`;
      const r = await fetch(url, { headers: { "User-Agent": YF_UA }, cache: "no-store" });
      if (!r.ok) continue;
      const result = (await r.json())?.quoteResponse?.result ?? [];
      for (const q of result) {
        if (!q.symbol) continue;
        out.set(q.symbol, {
          symbol: q.symbol,
          price:           typeof q.regularMarketPrice === "number" ? q.regularMarketPrice : 0,
          marketCap:       typeof q.marketCap          === "number" ? q.marketCap          : 0,
          trailingPE:      typeof q.trailingPE         === "number" && q.trailingPE > 0 && q.trailingPE < 500 ? q.trailingPE : null,
          priceToBook:     typeof q.priceToBook        === "number" && q.priceToBook > 0 ? q.priceToBook : null,
          returnOnEquity:  typeof q.returnOnEquity     === "number" ? q.returnOnEquity : null,
          profitMargins:   typeof q.profitMargins      === "number" ? q.profitMargins  : null,
        });
      }
    }
  } catch { /* best effort */ }
  return out;
}

// ── FMP helpers ───────────────────────────────────────────────────────────────

async function fetchFmpProfiles(tickers: string[]): Promise<FmpProfile[]> {
  if (!FMP_KEY || !tickers.length) return [];
  try {
    const r = await fetch(`${FMP_V3}/profile/${tickers.join(",")}?apikey=${FMP_KEY}`, { cache: "no-store" });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
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

function computePriceFactors(
  prices:    { date: string; adjClose: number }[],
  spyPrices: { date: string; adjClose: number }[],
) {
  if (prices.length < 30) return { momentum12_1: null, momentum6_1: null, realizedVol: null, beta: null };

  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;
  const refIdx = Math.max(0, n - 22);
  const p0  = sorted[refIdx].adjClose;
  const p12 = sorted[Math.max(0, refIdx - 231)].adjClose;
  const p6  = sorted[Math.max(0, refIdx - 105)].adjClose;

  const momentum12_1 = p12 > 0 ? (p0 / p12 - 1) : null;
  const momentum6_1  = p6  > 0 ? (p0 / p6  - 1) : null;

  const window = sorted.slice(Math.max(0, n - 253));
  const stockRets: number[] = [];
  for (let i = 1; i < window.length; i++) {
    if (window[i - 1].adjClose > 0)
      stockRets.push(Math.log(window[i].adjClose / window[i - 1].adjClose));
  }

  const muR  = stockRets.reduce((s, r) => s + r, 0) / (stockRets.length || 1);
  const varR = stockRets.reduce((s, r) => s + (r - muR) ** 2, 0) / (stockRets.length - 1 || 1);
  const realizedVol = Math.sqrt(varR * 252);

  const spySorted = [...spyPrices].sort((a, b) => a.date.localeCompare(b.date));
  const spySlice  = spySorted.slice(Math.max(0, spySorted.length - 253));
  const spyMap    = new Map(spySlice.map(p => [p.date, p.adjClose]));

  const pairs: [number, number][] = [];
  for (let i = 1; i < window.length; i++) {
    const sNow = spyMap.get(window[i].date);
    const sPrv = spyMap.get(window[i - 1].date);
    if (sNow && sPrv && sPrv > 0 && window[i - 1].adjClose > 0) {
      pairs.push([
        Math.log(window[i].adjClose / window[i - 1].adjClose),
        Math.log(sNow / sPrv),
      ]);
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

export async function GET() {
  const tickers = UNIVERSE.map(u => u.ticker);

  const [priceMap, fmpProfileRaw, fmpMetricsRaw, yfQuotes] = await Promise.all([
    fetchAdjustedHistoryBatch([...tickers, "SPY"], "2y"),
    fetchFmpProfiles(tickers),
    Promise.all(tickers.map(t => fetchFmpKeyMetricsOne(t))).then(r => r.filter(Boolean) as FmpMetrics[]),
    fetchYahooQuotes(tickers),
  ]);

  const spyBars    = priceMap.get("SPY") ?? [];
  const metricsMap = new Map(fmpMetricsRaw.map(m => [m.symbol, m]));
  const profileMap = new Map(fmpProfileRaw.map(p => [p.symbol, p]));

  type RawRow = {
    ticker: string; weight: 0;
    momentum12_1: number | null; momentum6_1: number | null;
    realizedVol:  number | null; beta: number | null;
    earningsYield: number | null; fcfYield: number | null;
    bookYield: number | null;
    evEbitda: number | null; roic: number | null;
    grossMargin: number | null; netLeverage: number | null;
    roe: number | null;
    logMktCap: number | null;
    name: string; sector: string; price: number; marketCap: number;
    priceDataOk: boolean; fundDataOk: boolean; reportingLagDays: number;
  };

  const rawRows: RawRow[] = tickers.map(ticker => {
    const u    = UNIVERSE.find(u => u.ticker === ticker)!;
    const bars = priceMap.get(ticker) ?? [];
    const m    = metricsMap.get(ticker);
    const prof = profileMap.get(ticker);
    const yf   = yfQuotes.get(ticker);

    const pf = computePriceFactors(bars, spyBars);

    // Value metrics — FMP primary, Yahoo fallback
    const earningsYield = m?.earningsYieldTTM
      ?? (m?.peRatioTTM && m.peRatioTTM > 0 ? 1 / m.peRatioTTM : null)
      ?? (yf?.trailingPE ? 1 / yf.trailingPE : null);
    const fcfYield    = m?.freeCashFlowYieldTTM ?? null;
    const bookYield   = yf?.priceToBook ? 1 / yf.priceToBook : null;
    const evEbitda    = m?.enterpriseValueOverEBITDATTM ?? null;

    // Quality metrics — FMP primary, Yahoo fallback
    const roic        = m?.roicTTM ?? null;
    const grossMargin = m?.grossProfitMarginTTM ?? null;
    const netLeverage = m?.netDebtToEBITDATTM ?? null;
    const roe         = yf?.returnOnEquity ?? null;
    const netMargin   = yf?.profitMargins ?? null;  // Yahoo proxy for gross margin

    const mktCap = prof?.mktCap ?? m?.marketCapTTM ?? yf?.marketCap ?? u.mktCapB * 1e9;

    // Current price: FMP profile → Yahoo quote → latest bar
    const latestBarPrice = bars.length ? bars[bars.length - 1].adjClose : 0;
    const price = (prof?.price && prof.price > 0) ? prof.price
      : (yf?.price && yf.price > 0) ? yf.price
      : latestBarPrice;

    const hasFundamentals = !!(m || yf?.trailingPE || yf?.returnOnEquity);

    return {
      ticker, weight: 0, ...pf,
      earningsYield, fcfYield, bookYield, evEbitda,
      roic, grossMargin: grossMargin ?? netMargin, netLeverage, roe,
      logMktCap: mktCap > 0 ? Math.log(mktCap) : null,
      name:      prof?.companyName ?? u.name,
      sector:    prof?.sector      ?? u.sector,
      price, marketCap: mktCap,
      priceDataOk: bars.length >= 60,
      fundDataOk:  hasFundamentals,
      reportingLagDays: getReportingLag(u),
    };
  });

  const z12  = crossSectionalZ(rawRows.map(r => r.momentum12_1));
  const z6   = crossSectionalZ(rawRows.map(r => r.momentum6_1));
  const zMomArr = z12.map((v12, i) => {
    const v6 = z6[i];
    if (v12 == null && v6 == null) return null;
    return ((v12 ?? 0) * 0.6 + (v6 ?? 0) * 0.4) / ((v12 != null ? 0.6 : 0) + (v6 != null ? 0.4 : 0));
  });

  const zVol  = crossSectionalZ(rawRows.map(r => r.realizedVol != null ? -r.realizedVol : null));
  const zBeta = crossSectionalZ(rawRows.map(r => r.beta        != null ? -r.beta        : null));
  const zLVArr = zVol.map((vv, i) => {
    const vb = zBeta[i];
    if (vv == null && vb == null) return null;
    return ((vv ?? 0) * 0.5 + (vb ?? 0) * 0.5) / ((vv != null ? 0.5 : 0) + (vb != null ? 0.5 : 0));
  });

  // Value: earnings yield + book yield + FCF yield + (-EV/EBITDA)
  const zEY  = crossSectionalZ(rawRows.map(r => r.earningsYield));
  const zBY  = crossSectionalZ(rawRows.map(r => r.bookYield));
  const zFCF = crossSectionalZ(rawRows.map(r => r.fcfYield));
  const zEVE = crossSectionalZ(rawRows.map(r => r.evEbitda != null ? -r.evEbitda : null));
  const zValArr = rawRows.map((_, i) => {
    const ey = zEY[i]; const by = zBY[i]; const fc = zFCF[i]; const ev = zEVE[i];
    if (ey == null && by == null && fc == null && ev == null) return null;
    let sum = 0; let w = 0;
    if (ey != null) { sum += ey * 0.35; w += 0.35; }
    if (by != null) { sum += by * 0.25; w += 0.25; }
    if (fc != null) { sum += fc * 0.25; w += 0.25; }
    if (ev != null) { sum += ev * 0.15; w += 0.15; }
    return w > 0 ? sum / w : null;
  });

  // Quality: ROIC + gross margin + (-leverage) + ROE
  const zROIC = crossSectionalZ(rawRows.map(r => r.roic));
  const zGM   = crossSectionalZ(rawRows.map(r => r.grossMargin));
  const zLev  = crossSectionalZ(rawRows.map(r => r.netLeverage != null ? -r.netLeverage : null));
  const zROE  = crossSectionalZ(rawRows.map(r => r.roe));
  const zQualArr = rawRows.map((_, i) => {
    const ro = zROIC[i]; const gm = zGM[i]; const lv = zLev[i]; const re = zROE[i];
    if (ro == null && gm == null && lv == null && re == null) return null;
    let sum = 0; let w = 0;
    if (ro != null) { sum += ro * 0.35; w += 0.35; }
    if (gm != null) { sum += gm * 0.30; w += 0.30; }
    if (lv != null) { sum += lv * 0.20; w += 0.20; }
    if (re != null) { sum += re * 0.15; w += 0.15; }
    return w > 0 ? sum / w : null;
  });

  const zSizeArr = crossSectionalZ(rawRows.map(r => r.logMktCap != null ? -r.logMktCap : null));

  const scores: FactorScoreResult[] = rawRows.map((r, i) => {
    const zm  = zMomArr[i];
    const zlv = zLVArr[i];
    const zv  = zValArr[i];
    const zq  = zQualArr[i];
    const zs  = zSizeArr[i];
    const parts = [zm, zlv, zv, zq, zs].filter((v): v is number => v != null);
    const compositeScore = parts.length ? parts.reduce((s, v) => s + v, 0) / parts.length : 0;

    return {
      ticker: r.ticker, weight: 0,
      name: r.name, sector: r.sector,
      price:     Math.round(r.price * 100) / 100,
      marketCap: r.marketCap,
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
      priceDataOk:      r.priceDataOk,
      fundDataOk:       r.fundDataOk,
      reportingLagDays: r.reportingLagDays,
    };
  });

  return NextResponse.json({
    scores,
    computedAt:  new Date().toISOString(),
    totalStocks: scores.length,
    priceDataOk: scores.filter(s => s.priceDataOk).length,
    fundDataOk:  scores.filter(s => s.fundDataOk).length,
  });
}
