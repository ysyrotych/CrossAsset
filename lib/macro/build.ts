import type { ChartSpec, Point, RenderedChart, RenderedSeries, ReportData } from "./types";
import { CHARTS } from "./manifest";
import { applyTransform, trimByYear, average, latest } from "./transforms";
import { curatedSeries, CURATED_META } from "./curated";

const FRED = "https://api.stlouisfed.org/fred/series/observations";
const KEY = process.env.FRED_API_KEY;

// series-specific unit scaling applied to raw values (level/rate series)
const SCALE: Record<string, number> = {
  WRESBAL: 1 / 1_000_000, // $m → $t
  HOUST: 1 / 1000,        // thousands → millions
  HOUST1F: 1 / 1000,
  ICSA: 1 / 1000,         // count → thousands
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
  // up to 3 tries with small backoff
  for (let i = 0; i < 3; i++) {
    try {
      const r = await attempt();
      if (r.ok || i === 2) return r;
    } catch { if (i === 2) throw new Error("fred fetch failed"); }
    await new Promise((res) => setTimeout(res, 250 * (i + 1)));
  }
  return attempt();
}

// Per-build de-dupe: fetch each series id at most once.
const _seriesCache = new Map<string, Promise<Point[]>>();

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
  const key = `${source}:${seriesId}:${startYear ?? ""}`;
  const cached = _seriesCache.get(key);
  if (cached) return cached;
  const p = (async () => {
    if (source === "fred") return fetchFred(seriesId, startYear);
    if (source === "yahoo") return fetchYahoo(seriesId);
    if (source === "curated") return curatedSeries(seriesId);
    return [];
  })();
  _seriesCache.set(key, p);
  return p;
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

    // Correct change for the latest tile, depending on the series transform:
    //  • level series  → true y/y %  (e.g. auto sales)
    //  • yoy/rate series (already a %/index) → change in percentage points vs prior obs
    const tr = spec.series[0].transform ?? "level";
    // % / index / diffusion series → change in percentage points; $ & count levels → true y/y %;
    // flow series (mom, e.g. payroll additions) → no labeled change (the value IS the change).
    const ppLike = /%|index|month/i.test(spec.unit);
    let change: number | undefined, changeUnit: "% y/y" | "pp" | undefined;
    if (last && primary.length > 1 && tr !== "mom") {
      if (ppLike) {
        change = last.value - primary[primary.length - 2].value;
        changeUnit = "pp";
      } else {
        const lag = spec.freq === "q" ? 4 : spec.freq === "m" ? 12 : spec.freq === "w" ? 52 : 252;
        const py = primary[primary.length - 1 - lag]?.value;
        if (py) { change = ((last.value / py) - 1) * 100; changeUnit = "% y/y"; }
      }
    }
    if (change != null && !Number.isFinite(change)) { change = undefined; changeUnit = undefined; }
    const vals = primary.map((p) => p.value).filter((v) => Number.isFinite(v));
    const mn = vals.length ? Math.min(...vals) : 0;
    const mx = vals.length ? Math.max(...vals) : 0;
    const pctileRaw = last && mx > mn ? ((last.value - mn) / (mx - mn)) * 100 : 50;
    const pctile = Number.isFinite(pctileRaw) ? Math.max(0, Math.min(100, pctileRaw)) : 50;

    return {
      id: spec.id, section: spec.section, title: spec.title, unit: spec.unit,
      chartType: spec.chartType, series: rendered,
      avg: spec.avg ? average(primary) : undefined,
      refLine: spec.refLine ?? (spec.section === "ism-services" || spec.section === "ism-mfg" ? 50 : undefined),
      recession: spec.recession,
      latest: last ? { value: last.value, date: last.date, change, changeUnit } : undefined,
      stats: last ? { min: mn, max: mx, percentile: pctile } : undefined,
      asOf: meta?.asOf,
      stale: spec.source === "curated",
      precision: spec.precision ?? 1,
      note: spec.note,
      sourceId: spec.source === "curated" ? "Seeded (monthly release)" : `${spec.source.toUpperCase()}: ${spec.series.map((s) => s.id).join(", ")}`,
      isDiffusion: spec.section === "ism-services" || spec.section === "ism-mfg",
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

// Warm-instance report cache (30-min TTL) — makes repeat loads near-instant.
let _reportCache: { at: number; data: ReportData } | null = null;
const REPORT_TTL = 30 * 60 * 1000;

export async function buildReport(force = false): Promise<ReportData> {
  if (!force && _reportCache && Date.now() - _reportCache.at < REPORT_TTL) return _reportCache.data;
  _seriesCache.clear();
  const results = await Promise.all(CHARTS.map(buildChart));
  const charts: Record<string, RenderedChart> = {};
  for (const c of results) charts[c.id] = c;
  const data: ReportData = { generatedAt: new Date().toISOString(), charts, fredConnected: !!KEY };
  _reportCache = { at: Date.now(), data };
  return data;
}
