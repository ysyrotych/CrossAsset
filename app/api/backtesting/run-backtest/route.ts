import { NextRequest, NextResponse } from "next/server";

// ── Seeded RNG (Mulberry32) ────────────────────────────────────────────────────
function mkRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s += 0x6D2B79F5; s |= 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mkNormal(rng: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u: number, v: number, s: number;
    do { u = rng()*2-1; v = rng()*2-1; s = u*u+v*v; } while (s >= 1 || s === 0);
    const m = Math.sqrt(-2 * Math.log(s) / s);
    spare = v * m; return u * m;
  };
}
function strSeed(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return Math.abs(h) || 1;
}

function mean(arr: number[]) { return arr.reduce((a, b) => a + b, 0) / (arr.length || 1); }
function std(arr: number[]) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length || 1));
}

// ── Asset parameters ──────────────────────────────────────────────────────────
const ASSET_PARAMS: Record<string, { mu: number; sigma: number; bMu: number; bSigma: number }> = {
  Equities:    { mu: 0.10,  sigma: 0.18,  bMu: 0.105, bSigma: 0.175 },
  Bonds:       { mu: 0.04,  sigma: 0.06,  bMu: 0.035, bSigma: 0.055 },
  Commodities: { mu: 0.05,  sigma: 0.22,  bMu: 0.04,  bSigma: 0.20  },
  FX:          { mu: 0.03,  sigma: 0.10,  bMu: 0.02,  bSigma: 0.08  },
  Crypto:      { mu: 0.35,  sigma: 0.80,  bMu: 0.30,  bSigma: 0.75  },
  Mixed:       { mu: 0.08,  sigma: 0.14,  bMu: 0.08,  bSigma: 0.14  },
};

// ── Assumption parsers ────────────────────────────────────────────────────────
interface Assumption { id: string; category: string; label: string; value: string; }
interface Config {
  strategyName: string; originalDescription: string; assetClass: string;
  startDate: string; endDate: string; initialCapital: number;
  assumptions: Assumption[];
}

function parseStopLoss(a: Assumption[]): number {
  const sl = a.find(x => x.label.toLowerCase().includes("stop") || (x.category === "Risk" && x.value.toLowerCase().includes("%")));
  if (!sl) return 0.10;
  const m = sl.value.match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) / 100 : 0.10;
}
function parsePositionCount(a: Assumption[]): number {
  const ps = a.find(x => x.category === "Position Sizing");
  if (!ps) return 10;
  const m = ps.value.match(/(\d+)/);
  return m ? Math.min(Math.max(parseInt(m[1]), 1), 50) : 10;
}
function parseRebalanceWeeks(a: Assumption[]): number {
  const rb = a.find(x => x.category === "Rebalance");
  if (!rb) return 4;
  const v = rb.value.toLowerCase();
  if (v.includes("daily")) return 1;
  if (v.includes("weekly")) return 1;
  if (v.includes("quarterly")) return 13;
  if (v.includes("annual")) return 52;
  return 4;
}

// ── GBM equity curve ──────────────────────────────────────────────────────────
function generateEquityCurve(
  cfg: Config, rng: () => number, normal: () => number,
  overrideStart?: string, overrideEnd?: string
) {
  const p = ASSET_PARAMS[cfg.assetClass] || ASSET_PARAMS.Equities;
  const stopLoss = parseStopLoss(cfg.assumptions);
  const posCount = parsePositionCount(cfg.assumptions);
  const rebalWks = parseRebalanceWeeks(cfg.assumptions);

  const alpha = 0.015 + (1 / posCount) * 0.008 + (stopLoss < 0.12 ? 0.008 : 0);
  const stratMu    = p.mu + alpha;
  const stratSigma = p.sigma * (0.82 + rebalWks * 0.003);

  const startStr = overrideStart ?? cfg.startDate;
  const endStr   = overrideEnd   ?? cfg.endDate;
  const start = new Date(startStr), end = new Date(endStr);
  const weeks = Math.max(26, Math.round((end.getTime() - start.getTime()) / (7 * 86400000)));
  const dt = 1 / 52;
  const sDrift = (stratMu - 0.5 * stratSigma ** 2) * dt;
  const sVol   = stratSigma * Math.sqrt(dt);
  const bDrift = (p.bMu - 0.5 * p.bSigma ** 2) * dt;
  const bVol   = p.bSigma * Math.sqrt(dt);

  const curve: { date: string; portfolio: number; benchmark: number }[] = [];
  let portfolio = cfg.initialCapital;
  let benchmark = cfg.initialCapital;
  let pHigh = portfolio;
  let regime = 0;
  let regimeCD = Math.floor(rng() * 156 + 52);
  const cur = new Date(start);

  for (let w = 0; w < weeks; w++) {
    if (--regimeCD <= 0) { regime = 1 - regime; regimeCD = Math.floor(rng() * 104 + 26); }
    const rf = regime === 0 ? 1.0 : -0.45;
    const shock = regime === 1 && regimeCD < 3 ? -0.04 * rng() : 0;
    const z1 = normal(), z2 = normal();
    const corr = 0.78;
    const zb = corr * z1 + Math.sqrt(1 - corr * corr) * z2;
    portfolio *= Math.exp(sDrift * rf + sVol * z1 + shock);
    benchmark *= Math.exp(bDrift * rf + bVol * zb + shock * 0.85);
    pHigh = Math.max(pHigh, portfolio);
    if (portfolio < pHigh * (1 - stopLoss * 1.4)) {
      portfolio = pHigh * (1 - stopLoss * 1.4) * (1 - 0.005 * rng());
      pHigh = portfolio;
    }
    curve.push({ date: cur.toISOString().split("T")[0], portfolio: Math.round(portfolio * 100) / 100, benchmark: Math.round(benchmark * 100) / 100 });
    cur.setDate(cur.getDate() + 7);
  }
  return curve;
}

function computeDrawdown(curve: { date: string; portfolio: number }[]) {
  let peak = curve[0]?.portfolio ?? 0;
  return curve.map(pt => {
    peak = Math.max(peak, pt.portfolio);
    return { date: pt.date, drawdown: peak > 0 ? (pt.portfolio - peak) / peak : 0 };
  });
}

function computeStats(
  curve: { portfolio: number; benchmark: number }[],
  initialCapital: number,
  dd: { drawdown: number }[]
) {
  if (curve.length < 4) throw new Error("Too short");
  const years = curve.length / 52;
  const fin = curve[curve.length - 1];
  const sr: number[] = [], br: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    sr.push(curve[i].portfolio / curve[i-1].portfolio - 1);
    br.push(curve[i].benchmark / curve[i-1].benchmark - 1);
  }
  const sm = mean(sr), bm = mean(br), ss = std(sr);
  const downSide = sr.filter(r => r < 0);
  const dStd = downSide.length > 0 ? Math.sqrt(downSide.reduce((a,b) => a+b*b,0)/downSide.length) : 0.001;
  const rfW = 0.05 / 52;
  const sharpe  = ((sm - rfW) / ss) * Math.sqrt(52);
  const sortino = ((sm - rfW) / dStd) * Math.sqrt(52);
  const maxDD = Math.min(...dd.map(d => d.drawdown));
  let maxDDDays = 0, curStart = -1;
  for (let i = 0; i < dd.length; i++) {
    if (dd[i].drawdown < 0 && curStart === -1) curStart = i;
    if (dd[i].drawdown === 0 && curStart !== -1) { maxDDDays = Math.max(maxDDDays, (i - curStart) * 7); curStart = -1; }
  }
  if (curStart !== -1) maxDDDays = Math.max(maxDDDays, (dd.length - curStart) * 7);
  const wins = sr.filter(r => r > 0), losses = sr.filter(r => r <= 0);
  const winRate = (wins.length / sr.length) * 100;
  const avgWin  = wins.length ? mean(wins) * 100 : 0;
  const avgLoss = losses.length ? mean(losses) * 100 : 0;
  const profitFactor = losses.length && mean(losses) !== 0 ? Math.abs((mean(wins)*wins.length) / (mean(losses)*losses.length)) : 2;
  const cagr      = ((fin.portfolio / initialCapital) ** (1/years) - 1) * 100;
  const benchCagr = ((fin.benchmark / initialCapital) ** (1/years) - 1) * 100;
  const totalReturn = (fin.portfolio / initialCapital - 1) * 100;
  const cov  = sr.reduce((acc,r,i) => acc + (r-sm)*(br[i]-bm), 0);
  const bVar = br.reduce((acc,r) => acc + (r-bm)**2, 0);
  const beta  = bVar > 0 ? cov / bVar : 1;
  const alpha = cagr - beta * benchCagr;
  const calmar = maxDD < 0 ? Math.abs(cagr / (maxDD * 100)) : 0;
  const sorted = [...sr].sort((a,b) => a-b);
  const vi   = Math.floor(sorted.length * 0.05);
  const var95  = sorted[vi] * 100;
  const cvar95 = mean(sorted.slice(0, vi+1)) * 100;
  const skew = sr.reduce((acc,r) => acc + ((r-sm)/ss)**3, 0) / sr.length;
  const kurt = sr.reduce((acc,r) => acc + ((r-sm)/ss)**4, 0) / sr.length - 3;
  const excess = sr.map((r,i) => r - br[i]);
  const ir  = std(excess) > 0 ? (mean(excess) / std(excess)) * Math.sqrt(52) : 0;
  const vol = ss * Math.sqrt(52) * 100;
  return {
    cagr: +cagr.toFixed(2), totalReturn: +totalReturn.toFixed(2),
    sharpeRatio: +sharpe.toFixed(2), sortinoRatio: +sortino.toFixed(2),
    maxDrawdown: +(maxDD * 100).toFixed(2), maxDrawdownDuration: maxDDDays,
    winRate: +winRate.toFixed(1), avgWin: +avgWin.toFixed(2), avgLoss: +avgLoss.toFixed(2),
    profitFactor: +profitFactor.toFixed(2), totalTrades: sr.length,
    benchmarkCagr: +benchCagr.toFixed(2), alpha: +alpha.toFixed(2),
    beta: +beta.toFixed(2), calmarRatio: +calmar.toFixed(2),
    var95: +var95.toFixed(2), cvar95: +cvar95.toFixed(2),
    skewness: +skew.toFixed(2), excessKurtosis: +kurt.toFixed(2),
    informationRatio: +ir.toFixed(2), volatility: +vol.toFixed(2),
  };
}

function computeMonthlyReturns(curve: { date: string; portfolio: number }[]) {
  const byMonth: Record<string, number[]> = {};
  curve.forEach(pt => {
    const d = new Date(pt.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(pt.portfolio);
  });
  const result: { year: number; month: number; return: number }[] = [];
  const keys = Object.keys(byMonth).sort();
  for (let i = 1; i < keys.length; i++) {
    const [y, mo] = keys[i].split("-").map(Number);
    const prev = byMonth[keys[i-1]].at(-1)!;
    const cur  = byMonth[keys[i]][0];
    result.push({ year: y, month: mo, return: +((cur/prev - 1)*100).toFixed(2) });
  }
  return result;
}

function runMonteCarlo(weeklyReturns: number[], initialCapital: number, weeks: number, rng: () => number) {
  const N = 200;
  const paths: number[][] = Array.from({length: N}, () => {
    let v = initialCapital;
    return Array.from({length: weeks}, () => {
      v *= 1 + weeklyReturns[Math.floor(rng() * weeklyReturns.length)];
      return v;
    });
  });
  const step = Math.max(1, Math.floor(weeks / 80));
  const result: { week: number; p5: number; p25: number; p50: number; p75: number; p95: number }[] = [
    { week: 0, p5: initialCapital, p25: initialCapital, p50: initialCapital, p75: initialCapital, p95: initialCapital }
  ];
  for (let w = step; w < weeks; w += step) {
    const vals = paths.map(p => p[w-1]).sort((a,b) => a-b);
    const pct = (q: number) => Math.round(vals[Math.floor(vals.length * q)]);
    result.push({ week: w, p5: pct(0.05), p25: pct(0.25), p50: pct(0.50), p75: pct(0.75), p95: pct(0.95) });
  }
  return result;
}

function computeStressTests(curve: { portfolio: number; benchmark: number }[], rng: () => number) {
  const scenarios = [
    { name: "2008 Financial Crisis",    period: "Sep 2008 – Mar 2009", benchShock: -0.55, durationWks: 26,  context: "Global credit collapse, Lehman bankruptcy" },
    { name: "COVID Crash",              period: "Feb – Mar 2020",      benchShock: -0.34, durationWks: 5,   context: "Fastest bear market in history, -34% in 23 trading days" },
    { name: "2022 Rate Shock",          period: "Jan – Dec 2022",      benchShock: -0.19, durationWks: 52,  context: "Fed tightened 425bps; S&P -19%, bonds -13%, no safe haven" },
    { name: "Dot-com Collapse",         period: "Mar 2000 – Oct 2002", benchShock: -0.49, durationWks: 130, context: "Tech multiple compression, 3-year grinding drawdown" },
    { name: "Black Monday 1987",        period: "19 Oct 1987",         benchShock: -0.22, durationWks: 1,   context: "Portfolio insurance cascade, single-day -22%" },
    { name: "2018 Q4 Selloff",          period: "Oct – Dec 2018",      benchShock: -0.20, durationWks: 12,  context: "Fed rate-hike fear, liquidity withdrawal, no credit stress" },
  ];
  const sr = curve.slice(1).map((p,i)=>p.portfolio/curve[i].portfolio-1);
  const br = curve.slice(1).map((p,i)=>p.benchmark/curve[i].benchmark-1);
  const sm = mean(sr), bm = mean(br);
  const cov = sr.reduce((a,r,i)=>a+(r-sm)*(br[i]-bm),0);
  const bVar = br.reduce((a,r)=>a+(r-bm)**2,0);
  const beta = bVar > 0 ? cov/bVar : 0.75;
  return scenarios.map(s => {
    const stratShock  = s.benchShock * beta * (0.80 + rng() * 0.35);
    const maxDD       = stratShock * (1.05 + rng() * 0.25);
    const recovMo     = Math.round((s.durationWks / 4) * (0.7 + rng() * 0.7));
    return {
      name: s.name, period: s.period, context: s.context,
      benchmarkReturn: +(s.benchShock * 100).toFixed(1),
      strategyReturn:  +(stratShock * 100).toFixed(1),
      maxDrawdown:     +(maxDD * 100).toFixed(1),
      recoveryMonths:  recovMo,
      verdict: stratShock < s.benchShock * 0.65 ? "better" : stratShock < s.benchShock * 1.15 ? "similar" : "worse",
    } as const;
  });
}

function computeRollingMetrics(curve: { date: string; portfolio: number; benchmark: number }[]) {
  const window = 52, step = 4;
  const sr = curve.slice(1).map((p,i) => p.portfolio / curve[i].portfolio - 1);
  const br = curve.slice(1).map((p,i) => p.benchmark / curve[i].benchmark - 1);
  const rfW = 0.05 / 52;
  const result: { date: string; rollingSharpe: number; rollingReturn: number; rollingVolatility: number; rollingBeta: number }[] = [];
  for (let i = window; i < sr.length; i += step) {
    const slice = sr.slice(i-window, i), bslice = br.slice(i-window, i);
    const m = mean(slice), s = std(slice);
    const sharpe  = s > 0 ? ((m - rfW) / s) * Math.sqrt(52) : 0;
    const rolRet  = (slice.reduce((a,b)=>a*(1+b),1)-1)*100;
    const vol     = s * Math.sqrt(52) * 100;
    const bm = mean(bslice), bv = bslice.reduce((a,r)=>a+(r-bm)**2,0);
    const cov = slice.reduce((a,r,j)=>a+(r-m)*(bslice[j]-bm),0);
    const beta = bv > 0 ? cov/bv : 1;
    result.push({
      date: curve[i+1]?.date ?? curve.at(-1)!.date,
      rollingSharpe: +sharpe.toFixed(2), rollingReturn: +rolRet.toFixed(2),
      rollingVolatility: +vol.toFixed(2), rollingBeta: +beta.toFixed(2),
    });
  }
  return result;
}

function computeFactorExposures(curve: { portfolio: number; benchmark: number }[], rng: () => number) {
  const sr = curve.slice(1).map((p,i)=>p.portfolio/curve[i].portfolio-1);
  const br = curve.slice(1).map((p,i)=>p.benchmark/curve[i].benchmark-1);
  const sm = mean(sr), bm = mean(br);
  const cov = sr.reduce((a,r,i)=>a+(r-sm)*(br[i]-bm),0);
  const bVar = br.reduce((a,r)=>a+(r-bm)**2,0);
  const mktBeta = bVar > 0 ? cov/bVar : 1;
  const mom  = 0.18 + rng() * 0.40;
  const qual = 0.10 + rng() * 0.28;
  const val  = -0.15 + rng() * 0.35;
  const lowV = -0.20 + rng() * 0.38;
  const size =  0.05 + rng() * 0.25;
  return [
    { factor: "Market (Mkt-Rf)", exposure: +mktBeta.toFixed(2), tStat: +(mktBeta/0.04).toFixed(1), significant: Math.abs(mktBeta) > 0.1 },
    { factor: "Momentum (WML)",  exposure: +mom.toFixed(2),     tStat: +(mom/0.07).toFixed(1),     significant: mom > 0.15 },
    { factor: "Quality (RMW)",   exposure: +qual.toFixed(2),    tStat: +(qual/0.06).toFixed(1),    significant: qual > 0.15 },
    { factor: "Value (HML)",     exposure: +val.toFixed(2),     tStat: +(Math.abs(val)/0.07).toFixed(1), significant: Math.abs(val) > 0.12 },
    { factor: "Size (SMB)",      exposure: +size.toFixed(2),    tStat: +(size/0.05).toFixed(1),    significant: size > 0.10 },
    { factor: "Low Volatility",  exposure: +lowV.toFixed(2),    tStat: +(Math.abs(lowV)/0.06).toFixed(1), significant: Math.abs(lowV) > 0.12 },
  ];
}

// ── NEW: Walk-Forward Analysis ────────────────────────────────────────────────
function computeWalkForward(cfg: Config, baseSeed: number) {
  const startYear = parseInt(cfg.startDate.split("-")[0]);
  const endYear   = parseInt(cfg.endDate.split("-")[0]);
  const totalYears = endYear - startYear;
  if (totalYears < 4) return [];

  const results: {
    label: string; inSampleSharpe: number; outSampleSharpe: number;
    inSampleReturn: number; outSampleReturn: number; overfit: boolean;
  }[] = [];

  // 2-year in-sample, 1-year out-of-sample, slide by 1 year
  for (let y = 0; y + 3 <= totalYears; y++) {
    const isStart = `${startYear + y}-01-01`;
    const isEnd   = `${startYear + y + 2}-01-01`;
    const oosEnd  = `${startYear + y + 3}-01-01`;

    const seedIS  = mkRng(strSeed(`${cfg.strategyName}IS${y}${baseSeed}`));
    const normIS  = mkNormal(seedIS);
    const curveIS = generateEquityCurve(cfg, seedIS, normIS, isStart, isEnd);
    const ddIS    = computeDrawdown(curveIS);
    const statsIS = computeStats(curveIS, cfg.initialCapital, ddIS);

    const seedOOS  = mkRng(strSeed(`${cfg.strategyName}OOS${y}${baseSeed}`));
    const normOOS  = mkNormal(seedOOS);
    const curveOOS = generateEquityCurve(cfg, seedOOS, normOOS, isEnd, oosEnd);
    const ddOOS    = computeDrawdown(curveOOS);
    const statsOOS = computeStats(curveOOS, cfg.initialCapital, ddOOS);

    results.push({
      label: `${startYear + y}–${startYear + y + 1} → ${startYear + y + 2}`,
      inSampleSharpe:  statsIS.sharpeRatio,
      outSampleSharpe: statsOOS.sharpeRatio,
      inSampleReturn:  statsIS.cagr,
      outSampleReturn: statsOOS.cagr,
      overfit: statsIS.sharpeRatio > 1.4 && statsOOS.sharpeRatio < statsIS.sharpeRatio * 0.45,
    });
  }
  return results;
}

// ── NEW: P&L Attribution (waterfall decomposition) ────────────────────────────
function computePnLAttribution(
  curve: { portfolio: number; benchmark: number }[],
  stats: ReturnType<typeof computeStats>,
  cfg: Config
) {
  const stopLoss    = parseStopLoss(cfg.assumptions);
  const rebalWks    = parseRebalanceWeeks(cfg.assumptions);
  const costsPct    = 0.05;
  const numRebalances = Math.round(curve.length / rebalWks);
  const costsDrag   = -(numRebalances * costsPct * 0.01 * 52 / (curve.length / 52));
  const stopLossDrag = stopLoss < 0.15 ? -(stopLoss * 0.08 * (stats.maxDrawdown < -10 ? 1.5 : 0.6)) : 0;
  const marketBeta   = +(stats.beta * stats.benchmarkCagr).toFixed(2);
  const totalAlpha   = +(stats.cagr - marketBeta).toFixed(2);
  // Split alpha into selection + timing (timing ~35% of alpha)
  const timing    = +(totalAlpha * 0.32).toFixed(2);
  const selection = +(totalAlpha * 0.68).toFixed(2);
  return {
    marketBeta,
    selection,
    timing,
    costs:    +costsDrag.toFixed(2),
    stopLoss: +stopLossDrag.toFixed(2),
  };
}

// ── NEW: Regime Detection ─────────────────────────────────────────────────────
type RegimeType = "bull" | "bear" | "highVol" | "sideways";
function computeRegimes(curve: { date: string; portfolio: number }[]): { startIdx: number; endIdx: number; regime: RegimeType }[] {
  const windowVol = 12, windowTrend = 26;
  const sr = curve.map((p, i) => i === 0 ? 0 : p.portfolio / curve[i-1].portfolio - 1);
  const segments: { startIdx: number; endIdx: number; regime: RegimeType }[] = [];
  let prevRegime: RegimeType | null = null;
  let segStart = 0;

  for (let i = windowTrend; i < curve.length; i++) {
    const volSlice = sr.slice(Math.max(0, i - windowVol), i);
    const realVol  = std(volSlice) * Math.sqrt(52);
    const trendSlice = curve.slice(i - windowTrend, i);
    const trendRet = trendSlice.at(-1)!.portfolio / trendSlice[0].portfolio - 1;
    const annRet   = trendRet * (52 / windowTrend);

    let regime: RegimeType;
    if (realVol > 0.28)      regime = "highVol";
    else if (annRet > 0.12)  regime = "bull";
    else if (annRet < -0.08) regime = "bear";
    else                     regime = "sideways";

    if (regime !== prevRegime) {
      if (prevRegime !== null) segments.push({ startIdx: segStart, endIdx: i - 1, regime: prevRegime });
      segStart = i;
      prevRegime = regime;
    }
  }
  if (prevRegime) segments.push({ startIdx: segStart, endIdx: curve.length - 1, regime: prevRegime });
  return segments;
}

// ── NEW: Parameter Sensitivity Grid ──────────────────────────────────────────
function computeParamSensitivity(cfg: Config, baseSeed: number) {
  const stopLossGrid    = [0.04, 0.07, 0.10, 0.15, 0.20];
  const posCountGrid    = [5, 10, 15, 20, 30];
  const result: { stopLoss: number; positionCount: number; sharpe: number; cagr: number; maxDrawdown: number }[] = [];

  for (const sl of stopLossGrid) {
    for (const pc of posCountGrid) {
      const tweakedAssumptions = cfg.assumptions.map(a => {
        if (a.label.toLowerCase().includes("stop")) return { ...a, value: `${(sl * 100).toFixed(0)}% below entry` };
        if (a.category === "Position Sizing") return { ...a, value: `Equal weight, ${pc} positions` };
        return a;
      });
      const tweakedCfg = { ...cfg, assumptions: tweakedAssumptions };
      const seed = mkRng(strSeed(`${cfg.strategyName}GRID${sl}${pc}${baseSeed}`));
      const norm = mkNormal(seed);
      const curve = generateEquityCurve(tweakedCfg, seed, norm);
      const dd    = computeDrawdown(curve);
      const stats = computeStats(curve, cfg.initialCapital, dd);
      result.push({ stopLoss: sl * 100, positionCount: pc, sharpe: stats.sharpeRatio, cagr: stats.cagr, maxDrawdown: stats.maxDrawdown });
    }
  }
  return result;
}

// ── NEW: Efficient Frontier (random portfolio Monte Carlo) ────────────────────
function computeEfficientFrontier(
  stratReturns: number[],
  stratVol: number,
  stratCagr: number,
  rng: () => number,
  normal: () => number
) {
  // 6 stylised assets with different risk/return profiles
  const assets = [
    { mu: 0.04,  sig: 0.06  }, // Bonds
    { mu: 0.05,  sig: 0.14  }, // Gold
    { mu: 0.07,  sig: 0.12  }, // Low-vol equity
    { mu: 0.10,  sig: 0.18  }, // Broad equity
    { mu: 0.13,  sig: 0.22  }, // Momentum equity
    { mu: 0.08,  sig: 0.15  }, // International equity
  ];
  const N = 52;
  const dt = 1 / 52;
  // Simulate correlated weekly returns for each asset (rough correlation to equity)
  const corrs = [0.0, 0.1, 0.55, 0.90, 0.78, 0.65];
  const assetReturns: number[][] = assets.map((a, idx) =>
    Array.from({ length: N }, () => {
      const z1 = normal(), z2 = normal();
      const zc  = corrs[idx] * z1 + Math.sqrt(1 - corrs[idx] ** 2) * z2;
      return Math.exp((a.mu - 0.5 * a.sig**2) * dt + a.sig * Math.sqrt(dt) * zc) - 1;
    })
  );
  // Compute means and covariance
  const means = assetReturns.map(r => mean(r));
  const numA  = assets.length;
  const cov: number[][] = Array.from({ length: numA }, (_, i) =>
    Array.from({ length: numA }, (__, j) => {
      const mi = means[i], mj = means[j];
      return assetReturns[i].reduce((acc, r, k) => acc + (r - mi) * (assetReturns[j][k] - mj), 0) / N;
    })
  );

  const portfolios: { risk: number; return: number; sharpe: number; current?: boolean; maxSharpe?: boolean; minRisk?: boolean }[] = [];

  for (let iter = 0; iter < 700; iter++) {
    // Random Dirichlet weights
    const raw = Array.from({ length: numA }, () => -Math.log(rng() + 1e-10));
    const s   = raw.reduce((a, b) => a + b, 0);
    const w   = raw.map(v => v / s);
    const portRet = w.reduce((a, wi, i) => a + wi * means[i], 0) * 52 * 100;
    let portVar = 0;
    for (let i = 0; i < numA; i++) for (let j = 0; j < numA; j++) portVar += w[i] * w[j] * cov[i][j];
    const portVol   = Math.sqrt(portVar * 52) * 100;
    const portSharpe = (portRet / 100 - 0.05) / (portVol / 100 + 0.001);
    portfolios.push({ risk: +portVol.toFixed(2), return: +portRet.toFixed(2), sharpe: +portSharpe.toFixed(2) });
  }

  // Current strategy point
  const currentSharpe = (stratCagr / 100 - 0.05) / (stratVol / 100 + 0.001);
  portfolios.push({ risk: +stratVol.toFixed(2), return: +stratCagr.toFixed(2), sharpe: +currentSharpe.toFixed(2), current: true });

  // Mark max Sharpe and min risk
  let maxSharpeIdx = 0, minRiskIdx = 0;
  for (let i = 0; i < portfolios.length; i++) {
    if (!portfolios[i].current) {
      if (portfolios[i].sharpe > portfolios[maxSharpeIdx].sharpe) maxSharpeIdx = i;
      if (portfolios[i].risk < portfolios[minRiskIdx].risk) minRiskIdx = i;
    }
  }
  portfolios[maxSharpeIdx] = { ...portfolios[maxSharpeIdx], maxSharpe: true };
  portfolios[minRiskIdx]   = { ...portfolios[minRiskIdx], minRisk: true };
  return portfolios;
}

// ── NEW: Asset Correlation Matrix ─────────────────────────────────────────────
function computeCorrelationMatrix(
  curve: { date: string; portfolio: number; benchmark: number }[],
  rng: () => number,
  normal: () => number
) {
  const sr = curve.slice(1).map((p, i) => p.portfolio / curve[i].portfolio - 1);
  const n  = sr.length;
  const dt = 1 / 52;

  // Simulate correlated asset return series
  const assetDefs = [
    { name: "S&P 500",  mu: 0.105, sig: 0.175, baseCorr: 0.88 },
    { name: "10Y Bonds",mu: 0.035, sig: 0.055, baseCorr: -0.12 },
    { name: "Gold",     mu: 0.05,  sig: 0.15,  baseCorr: 0.08 },
    { name: "USD Index",mu: 0.01,  sig: 0.08,  baseCorr: -0.22 },
    { name: "Real Est.", mu: 0.08, sig: 0.20,  baseCorr: 0.62 },
    { name: "Crude Oil", mu: 0.04, sig: 0.30,  baseCorr: 0.25 },
  ];

  // Bull/bear classification (first half vs second half as proxy)
  const midpoint = Math.floor(n / 2);

  return assetDefs.map(a => {
    const assetRet = Array.from({ length: n }, (_, i) => {
      const z1 = normal(), z2 = normal();
      const zc  = a.baseCorr * z1 + Math.sqrt(1 - a.baseCorr**2) * z2;
      return Math.exp((a.mu - 0.5*a.sig**2)*dt + a.sig*Math.sqrt(dt)*zc) - 1;
    });

    function pearson(xs: number[], ys: number[]) {
      const mx = mean(xs), my = mean(ys);
      const num = xs.reduce((acc, x, i) => acc + (x-mx)*(ys[i]-my), 0);
      const den = Math.sqrt(xs.reduce((a,x)=>a+(x-mx)**2,0) * ys.reduce((a,y)=>a+(y-my)**2,0));
      return den > 0 ? num/den : 0;
    }

    const full   = +pearson(sr, assetRet).toFixed(2);
    const bull   = +pearson(sr.slice(0, midpoint), assetRet.slice(0, midpoint)).toFixed(2);
    const bear   = +pearson(sr.slice(midpoint), assetRet.slice(midpoint)).toFixed(2);

    // Rolling 26-week correlation
    const rolling: { date: string; corr: number }[] = [];
    const rollWin = 26;
    for (let i = rollWin; i < n; i += 4) {
      const c = +pearson(sr.slice(i-rollWin, i), assetRet.slice(i-rollWin, i)).toFixed(2);
      rolling.push({ date: curve[i]?.date ?? "", corr: c });
    }

    return { asset: a.name, fullPeriod: full, bullRegime: bull, bearRegime: bear, rolling };
  });
}

// ── MD Feedback ───────────────────────────────────────────────────────────────
function generateMDFeedback(stats: ReturnType<typeof computeStats>, cfg: Config): string {
  const { cagr, sharpeRatio, maxDrawdown, alpha, beta, calmarRatio, var95, skewness, informationRatio, volatility, sortinoRatio } = stats;
  const lines: string[] = [];

  if (sharpeRatio > 1.5 && cagr > 12)
    lines.push(`Let me be honest — this is genuinely good. A ${cagr.toFixed(1)}% CAGR against a ${sharpeRatio.toFixed(2)} Sharpe is the kind of number that gets you a second meeting with serious allocators. Before you get excited, let's talk about what keeps me up at night.`);
  else if (sharpeRatio > 1.0)
    lines.push(`This is a respectable set of numbers. ${cagr.toFixed(1)}% CAGR, ${sharpeRatio.toFixed(2)} Sharpe — you're in the range where a Fund of Funds would at least sit across the table from you. The question is whether it survives scrutiny.`);
  else if (sharpeRatio > 0.5)
    lines.push(`I'll be direct: this is mediocre risk-adjusted performance. A ${sharpeRatio.toFixed(2)} Sharpe means you're not being paid enough for the risk you're carrying. You need to get above 1.0 before I'd show this to anyone external.`);
  else
    lines.push(`I'm going to save you time. A ${sharpeRatio.toFixed(2)} Sharpe ratio is not investable. The strategy destroys risk-adjusted value relative to what a leveraged passive approach would give you. Start over with your exit rules.`);

  if (Math.abs(maxDrawdown) > 35)
    lines.push(`The ${maxDrawdown.toFixed(1)}% max drawdown is the problem I keep coming back to. In 20 years on desks and allocating capital, I can tell you: investors say they have a long time horizon until they're sitting on a ${Math.abs(maxDrawdown).toFixed(0)}% loss. Then they redeem, usually at the worst possible moment, and your AUM craters. You need a hard regime filter — VIX > 28, or a 200-day MA signal — to cut exposure before those drawdowns materialise.`);
  else if (Math.abs(maxDrawdown) > 20)
    lines.push(`The ${maxDrawdown.toFixed(1)}% drawdown is manageable for a sophisticated investor, barely. Make sure your LPs understand what this looks like in the trough, not just at the end. Because at the trough, everyone's a short-term investor.`);
  else
    lines.push(`The ${maxDrawdown.toFixed(1)}% drawdown is well-controlled — that reflects genuine risk discipline, whether from the stop-loss or the rebalance logic. It's the kind of number that keeps capital allocated through cycles.`);

  if (alpha > 6)
    lines.push(`The ${alpha.toFixed(1)}% alpha over the benchmark is genuinely exceptional, especially at a beta of ${beta.toFixed(2)}. If this is structural — driven by process, not luck — you have something. But I'd want to see it survive a bear market in live trading before I'd size significantly into it.`);
  else if (alpha > 2)
    lines.push(`${alpha.toFixed(1)}% alpha is real but thin once you layer in 2% management fees, slippage at scale, and the tracking error you'll introduce. At beta ${beta.toFixed(2)}, you're carrying meaningful systematic exposure. Your clients might rationally ask for a cheaper beta product.`);
  else if (alpha < 0)
    lines.push(`Negative alpha (${alpha.toFixed(1)}%) means you're underperforming a simple benchmark exposure on a risk-adjusted basis. The strategy is not generating edge — it's generating fees on worse-than-passive returns. Fix this before any other conversation.`);
  else
    lines.push(`The alpha is marginal at ${alpha.toFixed(1)}%. You're essentially running a complex, expensive beta product. Tighten the signal or widen the universe.`);

  if (skewness < -0.8)
    lines.push(`The negative skew of ${skewness.toFixed(2)} is a structural red flag. This strategy makes money slowly and loses it violently. That's a dangerous psychological profile for LPs and for the manager. Consider asymmetric hedging — cheap puts on the S&P when the model is most exposed.`);
  else if (skewness > 0.5)
    lines.push(`The positive skew (${skewness.toFixed(2)}) is a mark in the strategy's favour. Small frequent losses, occasional large wins — that's a survivable P&L profile and LPs sleep better holding it.`);

  lines.push(`The Sortino of ${sortinoRatio.toFixed(2)} confirms the ${sharpeRatio < sortinoRatio ? "downside discipline is better than the headline Sharpe suggests" : "Sharpe picture — downside risk is proportionate to overall volatility"}. Daily 95% VaR of ${var95.toFixed(2)}% means your worst-5% weeks hit that threshold. Size your positions so a single bad week isn't existential.`);

  const recs: string[] = [];
  if (Math.abs(maxDrawdown) > 20) recs.push(`add a volatility regime filter (reduce exposure when realised vol > 2× historical average)`);
  if (informationRatio < 0.4) recs.push(`increase the signal quality — your information ratio of ${informationRatio.toFixed(2)} suggests noise is overwhelming the edge`);
  if (calmarRatio < 0.4) recs.push(`improve the Calmar ratio — CAGR per unit of max drawdown of ${calmarRatio.toFixed(2)} is too low for institutional consideration`);
  if (beta > 0.85) recs.push(`hedge the systematic exposure — at beta ${beta.toFixed(2)}, you're largely selling levered SPY with operational overhead`);
  if (Math.abs(stats.excessKurtosis) > 2) recs.push(`address the fat tails (excess kurtosis ${stats.excessKurtosis.toFixed(2)}) — the return distribution has tail risk the Sharpe doesn't capture`);
  if (recs.length > 0)
    lines.push(`Three things I'd want you to fix before showing this externally: (1) ${recs[0]}${recs[1] ? `; (2) ${recs[1]}` : ""}${recs[2] ? `; (3) ${recs[2]}` : ""}.`);

  const close = calmarRatio > 0.5 && sharpeRatio > 1.0
    ? `Overall verdict: this is worth developing. It has the structural characteristics of a real strategy. Come back with 2 years of live track record — not backtest — and we'll have a more serious capital conversation.`
    : `Overall verdict: promising framework, weak execution. The architecture of the strategy is right. The parameter optimisation isn't. Don't raise external capital at these metrics. Fix the Sharpe above 1.0 and the max drawdown below 20%, then we talk.`;
  lines.push(close);

  return lines.join("\n\n");
}

// ── Trade log ─────────────────────────────────────────────────────────────────
function generateTrades(curve: { date: string; portfolio: number }[], assumptions: Assumption[], rng: () => number) {
  const tickers = ["AAPL","MSFT","GOOGL","AMZN","META","NVDA","TSLA","JPM","GS","BAC","UNH","LLY","PG","JNJ","XOM","CVX","HD","MA","V","AVGO","COST","AMD","MU","INTC","NFLX","CRM","ADBE","ORCL","QCOM","TXN"];
  const sl = parseStopLoss(assumptions);
  const pc = Math.max(1, Math.floor(parsePositionCount(assumptions) / 3));
  const rw = parseRebalanceWeeks(assumptions);
  const trades: { ticker: string; entryDate: string; exitDate: string; entryPrice: number; exitPrice: number; returnPct: number; holdingDays: number; pnl: number }[] = [];
  for (let i = rw; i < curve.length - rw; i += rw) {
    const exit = Math.min(i + rw + Math.floor(rng() * rw), curve.length - 1);
    for (let j = 0; j < pc; j++) {
      const ticker = tickers[Math.floor(rng() * tickers.length)];
      const ep  = +(20 + rng() * 480).toFixed(2);
      const gr  = (rng() - 0.43) * 0.28;
      const ret = Math.max(gr, -sl * 1.3);
      const xp  = +(ep * (1 + ret)).toFixed(2);
      const shares = Math.max(1, Math.floor(5000 / ep));
      const pnl    = +((xp - ep) * shares).toFixed(2);
      const days   = Math.round((new Date(curve[exit].date).getTime() - new Date(curve[i].date).getTime()) / 86400000);
      trades.push({ ticker, entryDate: curve[i].date, exitDate: curve[exit].date, entryPrice: ep, exitPrice: xp, returnPct: +(ret*100).toFixed(2), holdingDays: days, pnl });
    }
  }
  return trades.slice(0, 250);
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { config }: { config: Config } = await req.json();
    if (!config) return NextResponse.json({ error: "No config" }, { status: 400 });

    const baseSeed = strSeed((config.strategyName ?? "") + (config.startDate ?? ""));
    const rng    = mkRng(baseSeed);
    const normal = mkNormal(rng);

    const equityCurve    = generateEquityCurve(config, rng, normal);
    const drawdownSeries = computeDrawdown(equityCurve);
    const stats          = computeStats(equityCurve, config.initialCapital, drawdownSeries);
    const monthlyReturns = computeMonthlyReturns(equityCurve);
    const weeklyReturns  = equityCurve.slice(1).map((p,i) => p.portfolio / equityCurve[i].portfolio - 1);
    const monteCarloData = runMonteCarlo(weeklyReturns, config.initialCapital, equityCurve.length, rng);
    const stressTests    = computeStressTests(equityCurve, rng);
    const rollingMetrics = computeRollingMetrics(equityCurve);
    const factorExposures = computeFactorExposures(equityCurve, rng);
    const trades         = generateTrades(equityCurve, config.assumptions, rng);
    const mdFeedback     = generateMDFeedback(stats, config);

    // New analytics
    const walkForward    = computeWalkForward(config, baseSeed);
    const pnlAttribution = computePnLAttribution(equityCurve, stats, config);
    const regimeSegments = computeRegimes(equityCurve);
    const paramSensitivity = computeParamSensitivity(config, baseSeed);
    const efficientFrontier = computeEfficientFrontier(weeklyReturns, stats.volatility, stats.cagr, rng, normal);

    // Correlation matrix uses its own fresh normal generator to avoid state bleeding
    const corrRng    = mkRng(strSeed(`CORR${config.strategyName}${config.startDate}`));
    const corrNormal = mkNormal(corrRng);
    const correlations = computeCorrelationMatrix(equityCurve, corrRng, corrNormal);

    const thin = <T>(arr: T[]) => arr.filter((_, i) => i % 2 === 0);

    return NextResponse.json({
      config, stats,
      equityCurve:    thin(equityCurve),
      drawdownSeries: thin(drawdownSeries),
      trades, monthlyReturns, monteCarloData, stressTests, rollingMetrics, factorExposures, mdFeedback,
      walkForward, pnlAttribution, regimeSegments, paramSensitivity, efficientFrontier, correlations,
      summary: `${config.strategyName} delivered ${stats.cagr > 0 ? "+" : ""}${stats.cagr}% CAGR vs. ${stats.benchmarkCagr}% for the benchmark, generating ${stats.alpha > 0 ? "+" : ""}${stats.alpha}% alpha. Sharpe: ${stats.sharpeRatio}. Max drawdown: ${stats.maxDrawdown}%.`,
    });
  } catch (err) {
    console.error("Backtest error:", err);
    return NextResponse.json({ error: "Backtest computation failed" }, { status: 500 });
  }
}
