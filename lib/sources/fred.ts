import type { MacroData } from "@/lib/types";
import { DEMO_MACRO_DATA } from "@/lib/data/demoData";

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";
const API_KEY = process.env.FRED_API_KEY;

async function fetchSeries(seriesId: string, limit = 1): Promise<number | null> {
  if (!API_KEY) return null;
  try {
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${API_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const obs = data.observations?.[0]?.value;
    return obs && obs !== "." ? parseFloat(obs) : null;
  } catch {
    return null;
  }
}

async function fetchTwo(seriesId: string): Promise<{ current: number | null; prev: number | null }> {
  if (!API_KEY) return { current: null, prev: null };
  try {
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${API_KEY}&file_type=json&sort_order=desc&limit=2`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return { current: null, prev: null };
    const data = await res.json();
    const obs = data.observations ?? [];
    const current = obs[0]?.value !== "." ? parseFloat(obs[0]?.value) : null;
    const prev = obs[1]?.value !== "." ? parseFloat(obs[1]?.value) : null;
    return { current, prev };
  } catch {
    return { current: null, prev: null };
  }
}

function fmtPct(v: number | null, decimals?: number): string {
  return v != null ? `${v.toFixed(decimals ?? 2)}%` : "N/A";
}

function fmtChange(current: number | null, prev: number | null, decimals = 2): string {
  if (current == null || prev == null) return "N/A";
  const diff = current - prev;
  return (diff >= 0 ? "+" : "") + diff.toFixed(decimals);
}

function direction(current: number | null, prev: number | null): "up" | "down" | "flat" {
  if (current == null || prev == null) return "flat";
  if (current > prev) return "up";
  if (current < prev) return "down";
  return "flat";
}

export async function fetchMacroData(): Promise<MacroData> {
  if (!API_KEY) return DEMO_MACRO_DATA;

  const [dgs10, dgs2, t10y2y, fedfunds, cpi, coreCpi, unrate, payems, gdp, pce] = await Promise.all([
    fetchTwo("DGS10"),
    fetchTwo("DGS2"),
    fetchTwo("T10Y2Y"),
    fetchTwo("FEDFUNDS"),
    fetchTwo("CPIAUCSL"),
    fetchTwo("CPILFESL"),
    fetchTwo("UNRATE"),
    fetchTwo("PAYEMS"),
    fetchTwo("GDP"),
    fetchTwo("PCEPI"),
  ]);

  const allNull = [dgs10.current, dgs2.current, cpi.current].every((v) => v == null);
  if (allNull) return DEMO_MACRO_DATA;

  const pct = (v: number | null, decimals?: number) => fmtPct(v, decimals);
  const chg = (c: number | null, p: number | null, d = 2) => fmtChange(c, p, d);
  const dir = direction;

  return {
    rates: {
      tenYear: { label: "10Y Treasury", value: pct(dgs10.current), change: chg(dgs10.current, dgs10.prev), direction: dir(dgs10.current, dgs10.prev), context: "US 10Y Treasury Yield" },
      twoYear: { label: "2Y Treasury", value: pct(dgs2.current), change: chg(dgs2.current, dgs2.prev), direction: dir(dgs2.current, dgs2.prev), context: "US 2Y Treasury Yield" },
      spread2s10s: { label: "2s10s Spread", value: t10y2y.current != null ? `${t10y2y.current.toFixed(2)}%` : "N/A", change: chg(t10y2y.current, t10y2y.prev), direction: dir(t10y2y.current, t10y2y.prev), context: "Yield curve spread" },
      fedFunds: { label: "Fed Funds", value: pct(fedfunds.current), change: chg(fedfunds.current, fedfunds.prev), direction: dir(fedfunds.current, fedfunds.prev), context: "Effective Federal Funds Rate" },
    },
    inflation: {
      cpi: { label: "CPI YoY", value: pct(cpi.current, 1), change: chg(cpi.current, cpi.prev, 1), direction: dir(cpi.current, cpi.prev), context: "Consumer Price Index" },
      coreCpi: { label: "Core CPI YoY", value: pct(coreCpi.current, 1), change: chg(coreCpi.current, coreCpi.prev, 1), direction: dir(coreCpi.current, coreCpi.prev), context: "CPI ex Food & Energy" },
      pce: { label: "PCE YoY", value: pct(pce.current, 1), change: chg(pce.current, pce.prev, 1), direction: dir(pce.current, pce.prev), context: "PCE Price Index" },
    },
    growth: {
      gdp: { label: "GDP QoQ", value: pct(gdp.current, 1), change: chg(gdp.current, gdp.prev, 1), direction: dir(gdp.current, gdp.prev), context: "Real GDP Growth" },
      payrolls: { label: "Nonfarm Payrolls", value: payems.current != null ? `${(payems.current / 1000).toFixed(0)}K` : "N/A", change: payems.current != null && payems.prev != null ? `${((payems.current - payems.prev)).toFixed(0)}K` : "N/A", direction: dir(payems.current, payems.prev), context: "Monthly change" },
      unemployment: { label: "Unemployment", value: pct(unrate.current, 1), change: chg(unrate.current, unrate.prev, 1), direction: dir(unrate.current, unrate.prev), context: "Unemployment Rate" },
    },
    risk: {
      hySpread: { label: "HY OAS", value: DEMO_MACRO_DATA.risk.hySpread.value, change: DEMO_MACRO_DATA.risk.hySpread.change, direction: DEMO_MACRO_DATA.risk.hySpread.direction, context: "ICE BofA HY OAS (demo)" },
    },
    commodities: {
      oil: DEMO_MACRO_DATA.commodities.oil,
      gold: DEMO_MACRO_DATA.commodities.gold,
    },
    isDemo: false,
  };
}
