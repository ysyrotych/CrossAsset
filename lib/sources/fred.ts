/**
 * Macro data for the AI brief — all from FRED (reliable from Vercel servers).
 * Yahoo Finance is NOT used here because it is blocked on Vercel's server-side.
 *
 * FRED series:
 *  Yields:      DGS2, DGS5, DGS10, DGS30, T10Y2Y, FEDFUNDS
 *  Inflation:   CPIAUCSL, CPILFESL, PCEPI
 *  Growth:      GDP, UNRATE, PAYEMS
 *  Risk:        BAMLH0A0HYM2 (ICE BofA HY OAS)
 *  Equities:    SP500, VIXCLS
 *  Commodities: GOLDAMGBD228NLBM, DCOILWTICO
 *  FX:          DTWEXBGS (broad USD trade-weighted index)
 *
 * All free — register at fred.stlouisfed.org to get FRED_API_KEY.
 * Without the key, falls back to DEMO_MACRO_DATA.
 */
import type { MacroData } from "@/lib/types";
import { DEMO_MACRO_DATA } from "@/lib/data/demoData";

const BASE = "https://api.stlouisfed.org/fred/series/observations";
const KEY  = process.env.FRED_API_KEY;

type Pair = { current: number | null; prev: number | null };

async function fredTwo(id: string): Promise<Pair> {
  if (!KEY) return { current: null, prev: null };
  try {
    const r = await fetch(
      `${BASE}?series_id=${id}&api_key=${KEY}&file_type=json&sort_order=desc&limit=5`,
      { next: { revalidate: 3600 } }
    );
    if (!r.ok) return { current: null, prev: null };
    const obs: { value: string }[] = ((await r.json()).observations ?? []).filter(
      (o: { value: string }) => o.value !== "."
    );
    return {
      current: obs[0] ? parseFloat(obs[0].value) : null,
      prev:    obs[1] ? parseFloat(obs[1].value) : null,
    };
  } catch {
    return { current: null, prev: null };
  }
}

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

export async function fetchMacroData(): Promise<MacroData> {
  if (!KEY) return DEMO_MACRO_DATA;

  // Fetch all series in parallel
  const [
    dgs2, dgs5, dgs10, dgs30, t10y2y, fedfunds,
    cpi, coreCpi, pce,
    gdp, unrate, payems,
    hySpread,
    sp500, vix,
    gold, oil,
    usdIdx,
  ] = await Promise.all([
    fredTwo("DGS2"),
    fredTwo("DGS5"),
    fredTwo("DGS10"),
    fredTwo("DGS30"),
    fredTwo("T10Y2Y"),
    fredTwo("FEDFUNDS"),
    fredTwo("CPIAUCSL"),
    fredTwo("CPILFESL"),
    fredTwo("PCEPI"),
    fredTwo("GDP"),
    fredTwo("UNRATE"),
    fredTwo("PAYEMS"),
    fredTwo("BAMLH0A0HYM2"),
    fredTwo("SP500"),
    fredTwo("VIXCLS"),
    fredTwo("GOLDAMGBD228NLBM"),
    fredTwo("DCOILWTICO"),
    fredTwo("DTWEXBGS"),
  ]);

  // If FRED key is wrong or rate-limited, core yields will be null — fall back to demo
  if (dgs10.current == null && dgs2.current == null) return DEMO_MACRO_DATA;

  const spread2s10s =
    dgs2.current != null && dgs10.current != null
      ? `${((dgs10.current - dgs2.current) * 100).toFixed(0)}bps`
      : t10y2y.current != null
      ? `${(t10y2y.current * 100).toFixed(0)}bps`
      : "N/A";

  const payrollsChg =
    payems.current != null && payems.prev != null
      ? `${(payems.current - payems.prev).toFixed(0)}K`
      : "N/A";

  return {
    rates: {
      tenYear: {
        label: "10Y Treasury",
        value: fmt(dgs10.current),
        change: chg(dgs10.current, dgs10.prev),
        direction: dir(dgs10.current, dgs10.prev),
        context: "US 10Y yield · FRED DGS10",
      },
      twoYear: {
        label: "2Y Treasury",
        value: fmt(dgs2.current),
        change: chg(dgs2.current, dgs2.prev),
        direction: dir(dgs2.current, dgs2.prev),
        context: "US 2Y yield · FRED DGS2",
      },
      spread2s10s: {
        label: "2s10s Spread",
        value: spread2s10s,
        change: chg(t10y2y.current, t10y2y.prev),
        direction: dir(t10y2y.current, t10y2y.prev),
        context: "Yield curve slope · FRED T10Y2Y",
      },
      fedFunds: {
        label: "Fed Funds",
        value: fmt(fedfunds.current),
        change: chg(fedfunds.current, fedfunds.prev),
        direction: dir(fedfunds.current, fedfunds.prev),
        context: "Effective Fed Funds Rate · FRED FEDFUNDS",
      },
    },
    inflation: {
      cpi: {
        label: "CPI YoY",
        value: fmt(cpi.current, 1),
        change: chg(cpi.current, cpi.prev, 1),
        direction: dir(cpi.current, cpi.prev),
        context: "Consumer Price Index · FRED CPIAUCSL",
      },
      coreCpi: {
        label: "Core CPI YoY",
        value: fmt(coreCpi.current, 1),
        change: chg(coreCpi.current, coreCpi.prev, 1),
        direction: dir(coreCpi.current, coreCpi.prev),
        context: "CPI ex Food & Energy · FRED CPILFESL",
      },
      pce: {
        label: "PCE YoY",
        value: fmt(pce.current, 1),
        change: chg(pce.current, pce.prev, 1),
        direction: dir(pce.current, pce.prev),
        context: "PCE Price Index · FRED PCEPI",
      },
    },
    growth: {
      gdp: {
        label: "GDP QoQ",
        value: fmt(gdp.current, 1),
        change: chg(gdp.current, gdp.prev, 1),
        direction: dir(gdp.current, gdp.prev),
        context: "Real GDP Growth · FRED GDP",
      },
      payrolls: {
        label: "Nonfarm Payrolls",
        value: payrollsChg !== "N/A" ? `${payrollsChg} added` : "N/A",
        change: payrollsChg,
        direction: dir(payems.current, payems.prev),
        context: "Monthly change · FRED PAYEMS",
      },
      unemployment: {
        label: "Unemployment",
        value: fmt(unrate.current, 1),
        change: chg(unrate.current, unrate.prev, 1),
        direction: dir(unrate.current, unrate.prev),
        context: "Unemployment Rate · FRED UNRATE",
      },
    },
    risk: {
      hySpread: {
        label: "HY OAS",
        value: hySpread.current != null ? `${hySpread.current.toFixed(0)}bps` : "N/A",
        change: hySpread.current != null && hySpread.prev != null
          ? `${(hySpread.current - hySpread.prev).toFixed(0)}bps`
          : "N/A",
        direction: dir(hySpread.current, hySpread.prev),
        context: "ICE BofA HY OAS · FRED BAMLH0A0HYM2",
      },
    },
    commodities: {
      oil: {
        label: "WTI Crude",
        value: oil.current != null ? `$${oil.current.toFixed(2)}` : "N/A",
        change: chg(oil.current, oil.prev, 2, "%"),
        direction: dir(oil.current, oil.prev),
        context: "WTI Crude Oil · FRED DCOILWTICO",
      },
      gold: {
        label: "Gold",
        value: gold.current != null ? `$${gold.current.toFixed(0)}/oz` : "N/A",
        change: chg(gold.current, gold.prev, 0, ""),
        direction: dir(gold.current, gold.prev),
        context: "Gold London PM Fix · FRED GOLDAMGBD228NLBM",
      },
    },
    equities: {
      sp500: {
        label: "S&P 500",
        value: sp500.current != null ? sp500.current.toFixed(0) : "N/A",
        change:
          sp500.current != null && sp500.prev != null
            ? `${(((sp500.current - sp500.prev) / sp500.prev) * 100).toFixed(2)}%`
            : "N/A",
        direction: dir(sp500.current, sp500.prev),
        context: "S&P 500 Index · FRED SP500",
      },
      vix: {
        label: "VIX",
        value: vix.current != null ? vix.current.toFixed(1) : "N/A",
        change:
          vix.current != null && vix.prev != null
            ? `${(((vix.current - vix.prev) / vix.prev) * 100).toFixed(1)}%`
            : "N/A",
        direction: dir(vix.current, vix.prev),
        context: "CBOE Volatility Index · FRED VIXCLS",
      },
      dxy: {
        label: "USD Index",
        value: usdIdx.current != null ? usdIdx.current.toFixed(2) : "N/A",
        change:
          usdIdx.current != null && usdIdx.prev != null
            ? `${(((usdIdx.current - usdIdx.prev) / usdIdx.prev) * 100).toFixed(2)}%`
            : "N/A",
        direction: dir(usdIdx.current, usdIdx.prev),
        context: "Broad USD Trade-Weighted Index · FRED DTWEXBGS",
      },
    },
    isDemo: false,
  };
}
