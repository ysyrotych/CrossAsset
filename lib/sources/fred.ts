/**
 * Primary data layer — three free sources, no paid key required for core market data:
 *
 *  1. Yahoo Finance  — yields (5Y, 10Y, 30Y), S&P 500, VIX, Gold, Oil, USD Index
 *  2. US Treasury XML — official 2Y yield (daily, no key)
 *  3. FRED API       — CPI, Core CPI, PCE, GDP, Unemployment, Payrolls, HY OAS
 *                      (free key at fred.stlouisfed.org — set FRED_API_KEY in Vercel)
 *
 * The function returns isDemo:false as long as Yahoo Finance responds,
 * even if FRED_API_KEY is not set.
 */
import type { MacroData } from "@/lib/types";
import { DEMO_MACRO_DATA } from "@/lib/data/demoData";
import { fetchQuote } from "./yahoo";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const FRED_KEY = process.env.FRED_API_KEY;

// ── FRED (optional, free key) ──────────────────────────────────────────────

async function fredTwo(id: string): Promise<{ current: number | null; prev: number | null }> {
  if (!FRED_KEY) return { current: null, prev: null };
  try {
    const r = await fetch(
      `${FRED_BASE}?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=2`,
      { next: { revalidate: 3600 } }
    );
    if (!r.ok) return { current: null, prev: null };
    const obs = (await r.json()).observations ?? [];
    const current = obs[0]?.value !== "." ? parseFloat(obs[0].value) : null;
    const prev    = obs[1]?.value !== "." ? parseFloat(obs[1].value) : null;
    return { current, prev };
  } catch {
    return { current: null, prev: null };
  }
}

// ── US Treasury XML (no key, official 2Y yield) ────────────────────────────

async function fetchTreasury2Y(): Promise<{ current: number | null; prev: number | null }> {
  try {
    const now = new Date();
    const ym  = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=${ym}`;
    const r   = await fetch(url, { next: { revalidate: 3600 } });
    if (!r.ok) return { current: null, prev: null };
    const text    = await r.text();
    const matches = [...text.matchAll(/<d:BC_2YEAR>([\d.]+)<\/d:BC_2YEAR>/g)];
    if (!matches.length) return { current: null, prev: null };
    const vals = matches.map((m) => parseFloat(m[1]));
    return {
      current: vals[vals.length - 1],
      prev:    vals.length > 1 ? vals[vals.length - 2] : null,
    };
  } catch {
    return { current: null, prev: null };
  }
}

// ── Formatters ─────────────────────────────────────────────────────────────

function fmt(v: number | null, d = 2, suffix = "%"): string {
  return v != null ? `${v.toFixed(d)}${suffix}` : "N/A";
}

function chg(c: number | null, p: number | null, d = 2, suffix = ""): string {
  if (c == null || p == null) return "N/A";
  const diff = c - p;
  return (diff >= 0 ? "+" : "") + diff.toFixed(d) + suffix;
}

function dir(c: number | null, p: number | null): "up" | "down" | "flat" {
  if (c == null || p == null) return "flat";
  return c > p ? "up" : c < p ? "down" : "flat";
}

// ── Main export ────────────────────────────────────────────────────────────

export async function fetchMacroData(): Promise<MacroData> {
  // Always run Yahoo Finance + Treasury in parallel (no key needed)
  const [tnxQ, fvxQ, tyxQ, goldQ, oilQ, vixQ, spQ, dxyQ, twoYr] = await Promise.all([
    fetchQuote("^TNX"),          // 10Y Treasury yield
    fetchQuote("^FVX"),          // 5Y Treasury yield
    fetchQuote("^TYX"),          // 30Y Treasury yield
    fetchQuote("GC=F"),          // Gold spot
    fetchQuote("CL=F"),          // WTI Crude Oil
    fetchQuote("^VIX"),          // CBOE Volatility Index
    fetchQuote("^GSPC"),         // S&P 500
    fetchQuote("DX-Y.NYB"),      // US Dollar Index
    fetchTreasury2Y(),           // 2Y yield from US Treasury XML
  ]);

  // If Yahoo Finance is completely unavailable, fall back to demo
  if (!tnxQ) return DEMO_MACRO_DATA;

  // FRED (optional — only runs if FRED_API_KEY is set)
  const [fedfunds, cpi, coreCpi, unrate, payems, gdp, pce, hySpread] = await Promise.all([
    fredTwo("FEDFUNDS"),
    fredTwo("CPIAUCSL"),
    fredTwo("CPILFESL"),
    fredTwo("UNRATE"),
    fredTwo("PAYEMS"),
    fredTwo("GDP"),
    fredTwo("PCEPI"),
    fredTwo("BAMLH0A0HYM2"),     // ICE BofA HY OAS spread
  ]);

  const spread2s10s =
    twoYr.current != null ? ((tnxQ.price - twoYr.current) * 100).toFixed(0) + "bps" : "N/A";

  const payrollsChange =
    payems.current != null && payems.prev != null
      ? `${((payems.current - payems.prev)).toFixed(0)}K`
      : "N/A";

  return {
    rates: {
      tenYear: {
        label: "10Y Treasury",
        value: fmt(tnxQ.price),
        change: chg(tnxQ.price, tnxQ.prev),
        direction: dir(tnxQ.price, tnxQ.prev),
        context: "US 10Y yield · Yahoo Finance",
      },
      twoYear: {
        label: "2Y Treasury",
        value: fmt(twoYr.current),
        change: chg(twoYr.current, twoYr.prev),
        direction: dir(twoYr.current, twoYr.prev),
        context: "US 2Y yield · US Treasury official",
      },
      spread2s10s: {
        label: "2s10s Spread",
        value: spread2s10s,
        change: "N/A",
        direction: twoYr.current != null && tnxQ.price > twoYr.current ? "up" : "down",
        context: "10Y minus 2Y",
      },
      fedFunds: {
        label: "Fed Funds",
        value: fedfunds.current != null ? fmt(fedfunds.current) : DEMO_MACRO_DATA.rates.fedFunds.value,
        change: chg(fedfunds.current, fedfunds.prev),
        direction: dir(fedfunds.current, fedfunds.prev),
        context: fedfunds.current != null ? "Effective Fed Funds Rate · FRED" : "Effective Fed Funds Rate · last known",
      },
    },
    inflation: {
      cpi: {
        label: "CPI YoY",
        value: cpi.current != null ? fmt(cpi.current, 1) : DEMO_MACRO_DATA.inflation.cpi.value,
        change: chg(cpi.current, cpi.prev, 1),
        direction: dir(cpi.current, cpi.prev),
        context: FRED_KEY ? "Consumer Price Index · FRED" : "CPI — add FRED_API_KEY to Vercel for live data",
      },
      coreCpi: {
        label: "Core CPI YoY",
        value: coreCpi.current != null ? fmt(coreCpi.current, 1) : DEMO_MACRO_DATA.inflation.coreCpi.value,
        change: chg(coreCpi.current, coreCpi.prev, 1),
        direction: dir(coreCpi.current, coreCpi.prev),
        context: FRED_KEY ? "CPI ex Food & Energy · FRED" : "Core CPI — add FRED_API_KEY",
      },
      pce: {
        label: "PCE YoY",
        value: pce.current != null ? fmt(pce.current, 1) : DEMO_MACRO_DATA.inflation.pce.value,
        change: chg(pce.current, pce.prev, 1),
        direction: dir(pce.current, pce.prev),
        context: FRED_KEY ? "PCE Price Index · FRED" : "PCE — add FRED_API_KEY",
      },
    },
    growth: {
      gdp: {
        label: "GDP QoQ",
        value: gdp.current != null ? fmt(gdp.current, 1) : DEMO_MACRO_DATA.growth.gdp.value,
        change: chg(gdp.current, gdp.prev, 1),
        direction: dir(gdp.current, gdp.prev),
        context: FRED_KEY ? "Real GDP Growth · FRED" : "GDP — add FRED_API_KEY",
      },
      payrolls: {
        label: "Nonfarm Payrolls",
        value: payems.current != null && payems.prev != null
          ? `${payrollsChange} added`
          : DEMO_MACRO_DATA.growth.payrolls.value,
        change: payrollsChange,
        direction: dir(payems.current, payems.prev),
        context: FRED_KEY ? "Nonfarm Payrolls monthly change · FRED" : "Payrolls — add FRED_API_KEY",
      },
      unemployment: {
        label: "Unemployment",
        value: unrate.current != null ? fmt(unrate.current, 1) : DEMO_MACRO_DATA.growth.unemployment.value,
        change: chg(unrate.current, unrate.prev, 1),
        direction: dir(unrate.current, unrate.prev),
        context: FRED_KEY ? "Unemployment Rate · FRED" : "Unemployment — add FRED_API_KEY",
      },
    },
    risk: {
      hySpread: {
        label: "HY OAS",
        value: hySpread.current != null
          ? `${hySpread.current.toFixed(0)}bps`
          : DEMO_MACRO_DATA.risk.hySpread.value,
        change: hySpread.current != null && hySpread.prev != null
          ? chg(hySpread.current, hySpread.prev, 0, "bps")
          : "N/A",
        direction: dir(hySpread.current, hySpread.prev),
        context: hySpread.current != null ? "ICE BofA HY OAS · FRED" : "HY OAS — add FRED_API_KEY",
      },
    },
    commodities: {
      oil: {
        label: "WTI Crude",
        value: oilQ ? `$${oilQ.price.toFixed(2)}` : DEMO_MACRO_DATA.commodities.oil.value,
        change: oilQ ? `${oilQ.pct >= 0 ? "+" : ""}${oilQ.pct.toFixed(2)}%` : "N/A",
        direction: oilQ ? (oilQ.change >= 0 ? "up" : "down") : "flat",
        context: oilQ ? "WTI Crude futures · Yahoo Finance" : "WTI Crude",
      },
      gold: {
        label: "Gold",
        value: goldQ ? `$${goldQ.price.toFixed(0)}/oz` : DEMO_MACRO_DATA.commodities.gold.value,
        change: goldQ ? `${goldQ.pct >= 0 ? "+" : ""}${goldQ.pct.toFixed(2)}%` : "N/A",
        direction: goldQ ? (goldQ.change >= 0 ? "up" : "down") : "flat",
        context: goldQ ? "Gold futures · Yahoo Finance" : "Gold",
      },
    },
    equities: {
      sp500: {
        label: "S&P 500",
        value: spQ ? spQ.price.toFixed(0) : "N/A",
        change: spQ ? `${spQ.pct >= 0 ? "+" : ""}${spQ.pct.toFixed(2)}%` : "N/A",
        direction: spQ ? (spQ.change >= 0 ? "up" : "down") : "flat",
        context: spQ ? "S&P 500 Index · Yahoo Finance" : "S&P 500",
      },
      vix: {
        label: "VIX",
        value: vixQ ? vixQ.price.toFixed(1) : "N/A",
        change: vixQ ? `${vixQ.pct >= 0 ? "+" : ""}${vixQ.pct.toFixed(1)}%` : "N/A",
        direction: vixQ ? (vixQ.change >= 0 ? "up" : "down") : "flat",
        context: vixQ ? "CBOE VIX · Yahoo Finance" : "VIX",
      },
      dxy: {
        label: "USD Index",
        value: dxyQ ? dxyQ.price.toFixed(2) : "N/A",
        change: dxyQ ? `${dxyQ.pct >= 0 ? "+" : ""}${dxyQ.pct.toFixed(2)}%` : "N/A",
        direction: dxyQ ? (dxyQ.change >= 0 ? "up" : "down") : "flat",
        context: dxyQ ? "US Dollar Index · Yahoo Finance" : "DXY",
      },
    },
    isDemo: false,
  };
}
