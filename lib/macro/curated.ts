import type { Point } from "./types";

// ── Curated proprietary series ────────────────────────────────────────────────
// These have no free historical API (ISM, NFIB, Conference Board, NAHB, NY Fed
// survey, Baltic Dry, MOVE). We seed a realistic recent history ending at the
// latest published value, and refresh the latest value monthly from the free
// press release (option 1). Each carries an `asOf` so the UI can stamp it.
//
// To update monthly: bump `latest` and append the new value; Claude can do this
// from the release text.

type Curated = { latest: number; asOf: string; avg: number; vol: number };

// latest values sourced from the URETF Mar-2026 deck; avg = long-run mean
export const CURATED_META: Record<string, Curated> = {
  ism_services:            { latest: 56.1, asOf: "Feb 2026", avg: 54.7, vol: 3.5 },
  ism_services_neworders:  { latest: 58.6, asOf: "Feb 2026", avg: 56.6, vol: 4.0 },
  ism_services_prices:     { latest: 63.0, asOf: "Feb 2026", avg: 60.1, vol: 5.0 },
  ism_mfg:                 { latest: 52.4, asOf: "Feb 2026", avg: 52.8, vol: 4.0 },
  ism_mfg_neworders:       { latest: 55.8, asOf: "Feb 2026", avg: 55.2, vol: 5.0 },
  ism_mfg_prices:          { latest: 70.0, asOf: "Feb 2026", avg: 61.9, vol: 8.0 },
  nfib_optimism:           { latest: 98.8, asOf: "Feb 2026", avg: 98.0, vol: 4.0 },
  nfib_uncertainty:        { latest: 88.0, asOf: "Feb 2026", avg: 68.0, vol: 12.0 },
  conf_board:              { latest: 91.2, asOf: "Feb 2026", avg: 100.0, vol: 12.0 },
  nahb:                    { latest: 25.0, asOf: "Mar 2026", avg: 40.0, vol: 12.0 },
  nyfed_1y:                { latest: 3.0,  asOf: "Feb 2026", avg: 3.2,  vol: 0.8 },
  baltic_dry:              { latest: 1500, asOf: "Mar 2026", avg: 1800, vol: 700 },
  move:                    { latest: 108.8, asOf: "Mar 2026", avg: 93.6, vol: 18 },
};

// deterministic pseudo-random for reproducible synthesized history
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Synthesize ~48 monthly points ending at `latest`, mean-reverting to `avg`.
export function curatedSeries(key: string, months = 48): Point[] {
  const meta = CURATED_META[key];
  if (!meta) return [];
  const rand = rng(hash(key));
  const now = new Date();
  const vals: number[] = [];
  let v = meta.avg;
  for (let i = 0; i < months; i++) {
    const shock = (rand() - 0.5) * meta.vol;
    v = v + 0.25 * (meta.avg - v) + shock;      // mean-reverting
    vals.push(v);
  }
  vals[vals.length - 1] = meta.latest;           // pin the latest to the real value
  // ease the last few points toward the pinned latest
  for (let i = Math.max(0, months - 4); i < months - 1; i++) {
    const w = (i - (months - 5)) / 4;
    vals[i] = vals[i] * (1 - w) + meta.latest * w;
  }
  const out: Point[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1));
    out.push({ date: d.toISOString().slice(0, 10), value: Math.round(vals[i] * 10) / 10 });
  }
  return out;
}
