import type { ChartSpec, Point, RenderedChart, RenderedSeries, ReportData } from "./types";
import { CHARTS } from "./manifest";
import { applyTransform, trimByYear, average, latest } from "./transforms";
import { curatedSeries, CURATED_META } from "./curated";

const FRED = "https://api.stlouisfed.org/fred/series/observations";
const KEY = process.env.FRED_API_KEY;

// series-specific unit scaling applied to raw values (level/rate series)
const SCALE: Record<string, number> = {
  WRESBAL: 1 / 1000,      // $b → $t
  HOUST: 1 / 1000,        // thousands → millions
  HOUST1F: 1 / 1000,
  T10Y2Y: 100,            // % → bps
  BAMLH0A0HYM2: 100,      // % → bps
  BOPGSTB: 1 / 1000,      // $m → $b
  MTSDS133FMS: 1 / 1000,  // $m → $b
};

async function fredFetch(url: string): Promise<Response> {
  const attempt = () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    return fetch(url, { cache: "no-store", signal: ctrl.signal }).finally(() => clearTimeout(t));
  };
  try { return await attempt(); } catch { return attempt(); }
}

async function fetchFred(seriesId: string, startYear?: number): Promise<Point[]> {
  if (!KEY) return [];
  const start = startYear ? `${startYear - 2}-01-01` : "1980-01-01";
  const url = `${FRED}?series_id=${seriesId}&api_key=${KEY}&file_type=json&observation_start=${start}&sort_order=asc`;
  try {
    const r = await fredFetch(url);
    if (!r.ok) return [];
    const obs: { date: string; value: string }[] = (await r.json()).observations ?? [];
    const scale = SCALE[seriesId] ?? 1;
    return obs
      .filter((o) => o.value !== ".")
      .map((o) => ({ date: o.date, value: parseFloat(o.value) * scale }));
  } catch { return []; }
}

async function fetchYahoo(symbol: string): Promise<Point[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=20y&interval=1mo`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(9000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return [];
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    const ts: number[] = res?.timestamp ?? [];
    const close: (number | null)[] = res?.indicators?.quote?.[0]?.close ?? [];
    const out: Point[] = [];
    for (let i = 0; i < ts.length; i++) {
      if (close[i] != null) out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), value: close[i]! });
    }
    return out;
  } catch { return []; }
}

async function rawSeries(seriesId: string, source: string, startYear?: number): Promise<Point[]> {
  if (source === "fred") return fetchFred(seriesId, startYear);
  if (source === "yahoo") return fetchYahoo(seriesId);
  if (source === "curated") return curatedSeries(seriesId);
  return [];
}

async function buildChart(spec: ChartSpec): Promise<RenderedChart> {
  try {
    const rendered: RenderedSeries[] = [];
    for (const s of spec.series) {
      const raw = await rawSeries(s.id, spec.source, spec.startYear);
      let pts = applyTransform(raw, s.transform ?? "level", spec.freq);
      pts = trimByYear(pts, spec.startYear);
      rendered.push({ name: s.label ?? spec.title, color: s.color, data: pts });
    }
    const primary = rendered[0]?.data ?? [];
    const last = latest(primary);
    const meta = spec.source === "curated" ? CURATED_META[spec.series[0].id] : null;

    // y/y & m/m for the latest tile (from primary series, if enough data)
    let changeYoY: number | undefined, changeMoM: number | undefined;
    if (last && primary.length > 13 && (spec.freq === "m")) {
      const prevY = primary[primary.length - 13]?.value;
      if (prevY) changeYoY = ((last.value / prevY) - 1) * 100;
      const prevM = primary[primary.length - 2]?.value;
      if (prevM) changeMoM = last.value - prevM;
    }

    return {
      id: spec.id, section: spec.section, title: spec.title, unit: spec.unit,
      chartType: spec.chartType, series: rendered,
      avg: spec.avg ? average(primary) : undefined,
      recession: spec.recession,
      latest: last ? { value: last.value, date: last.date, changeYoY, changeMoM } : undefined,
      asOf: meta?.asOf,
      stale: spec.source === "curated",
      precision: spec.precision ?? 1,
      note: spec.note,
      error: primary.length === 0 ? "no data" : undefined,
    };
  } catch (e) {
    return {
      id: spec.id, section: spec.section, title: spec.title, unit: spec.unit,
      chartType: spec.chartType, series: [], precision: spec.precision ?? 1,
      error: e instanceof Error ? e.message : "build error",
    };
  }
}

export async function buildReport(): Promise<ReportData> {
  const results = await Promise.all(CHARTS.map(buildChart));
  const charts: Record<string, RenderedChart> = {};
  for (const c of results) charts[c.id] = c;
  return {
    generatedAt: new Date().toISOString(),
    charts,
    fredConnected: !!KEY,
  };
}
