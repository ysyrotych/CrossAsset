import type { Point, Transform, Freq } from "./types";

// periods per year for y/y lookback
function yoyLag(freq: Freq): number {
  return freq === "q" ? 4 : freq === "m" ? 12 : freq === "w" ? 52 : 252;
}

export function applyTransform(points: Point[], transform: Transform, freq: Freq): Point[] {
  const clean = points.filter((p) => Number.isFinite(p.value));
  switch (transform) {
    case "yoy": {
      const lag = yoyLag(freq);
      const out: Point[] = [];
      for (let i = lag; i < clean.length; i++) {
        const prev = clean[i - lag].value;
        if (prev !== 0) out.push({ date: clean[i].date, value: ((clean[i].value / prev) - 1) * 100 });
      }
      return out;
    }
    case "mom": {
      const out: Point[] = [];
      for (let i = 1; i < clean.length; i++) {
        // for level series like PAYEMS, mom "change" is the raw difference (thousands)
        out.push({ date: clean[i].date, value: clean[i].value - clean[i - 1].value });
      }
      return out;
    }
    case "4wkavg": {
      const out: Point[] = [];
      for (let i = 3; i < clean.length; i++) {
        const avg = (clean[i].value + clean[i - 1].value + clean[i - 2].value + clean[i - 3].value) / 4;
        out.push({ date: clean[i].date, value: avg });
      }
      return out;
    }
    case "rate":
    case "level":
    default:
      return clean;
  }
}

export function trimByYear(points: Point[], startYear?: number): Point[] {
  if (!startYear) return points;
  return points.filter((p) => new Date(p.date).getUTCFullYear() >= startYear);
}

export function average(points: Point[]): number | null {
  if (!points.length) return null;
  return points.reduce((s, p) => s + p.value, 0) / points.length;
}

export function latest(points: Point[]): { value: number; date: string } | null {
  if (!points.length) return null;
  const p = points[points.length - 1];
  return { value: p.value, date: p.date };
}
