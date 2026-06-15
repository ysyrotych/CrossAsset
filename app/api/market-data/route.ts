/**
 * Market data endpoint — primary source: FRED API (reliable from Vercel servers)
 * Yahoo Finance used as secondary fallback (often blocked from server-side).
 *
 * FRED series used:
 *  DGS2, DGS5, DGS10, DGS30  — treasury yields (daily, 1-day lag)
 *  SP500                      — S&P 500 index (daily, 1-day lag)
 *  VIXCLS                     — CBOE VIX (daily, 1-day lag)
 *  GOLDAMGBD228NLBM           — Gold London PM fix (daily)
 *  DCOILWTICO                 — WTI crude oil (daily)
 *  DTWEXBGS                   — USD broad trade-weighted index (weekly proxy for DXY)
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FRED   = "https://api.stlouisfed.org/fred/series/observations";
const FRED_KEY = process.env.FRED_API_KEY;

const YF = "https://query1.finance.yahoo.com/v8/finance/chart";
const YF_H = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/",
};

// ── FRED ──────────────────────────────────────────────────────────────────

type Quote = { price: number; prev: number | null; change: number; pct: number } | null;

async function fredLatest(id: string): Promise<Quote> {
  if (!FRED_KEY) return null;
  try {
    const r = await fetch(
      `${FRED}?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=5`,
      { next: { revalidate: 600 } }
    );
    if (!r.ok) return null;
    const obs: { value: string }[] = ((await r.json()).observations ?? []).filter(
      (o: { value: string }) => o.value !== "."
    );
    if (!obs.length) return null;
    const price  = parseFloat(obs[0].value);
    const prev   = obs.length > 1 ? parseFloat(obs[1].value) : null;
    const change = prev != null ? price - prev : 0;
    return { price, prev, change, pct: prev ? (change / prev) * 100 : 0 };
  } catch {
    return null;
  }
}

async function fredHistory(id: string, start: string): Promise<{ date: string; value: number }[]> {
  if (!FRED_KEY) return [];
  try {
    const r = await fetch(
      `${FRED}?series_id=${id}&api_key=${FRED_KEY}&file_type=json&sort_order=asc&observation_start=${start}`,
      { next: { revalidate: 3600 } }
    );
    if (!r.ok) return [];
    return ((await r.json()).observations ?? [])
      .filter((o: { value: string }) => o.value !== ".")
      .map((o: { date: string; value: string }) => ({
        date: new Date(o.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: parseFloat(o.value),
      }));
  } catch {
    return [];
  }
}

// ── Yahoo Finance fallback ─────────────────────────────────────────────────

async function yfQuote(sym: string): Promise<Quote> {
  try {
    const r = await fetch(`${YF}/${encodeURIComponent(sym)}?interval=1d&range=5d`, {
      headers: YF_H,
      next: { revalidate: 600 },
    });
    if (!r.ok) return null;
    const closes: (number | null)[] =
      (await r.json()).chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const valid = closes.filter((v): v is number => v != null);
    if (!valid.length) return null;
    const price  = valid[valid.length - 1];
    const prev   = valid.length > 1 ? valid[valid.length - 2] : null;
    const change = prev != null ? price - prev : 0;
    return { price, prev, change, pct: prev ? (change / prev) * 100 : 0 };
  } catch {
    return null;
  }
}

async function yfHistory(sym: string, range: string): Promise<{ date: string; value: number }[]> {
  try {
    const r = await fetch(`${YF}/${encodeURIComponent(sym)}?interval=1d&range=${range}`, {
      headers: YF_H,
      next: { revalidate: 3600 },
    });
    if (!r.ok) return [];
    const result = (await r.json()).chart?.result?.[0];
    if (!result) return [];
    const ts: number[]      = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    return ts
      .map((t, i) => ({
        date: new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: closes[i] ?? 0,
      }))
      .filter((p) => p.value > 0);
  } catch {
    return [];
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function startDate(tf: string): string {
  const d = new Date();
  if (tf === "1M")  d.setDate(d.getDate() - 35);
  else if (tf === "3M")  d.setMonth(d.getMonth() - 3);
  else if (tf === "6M")  d.setMonth(d.getMonth() - 6);
  else if (tf === "1Y")  d.setFullYear(d.getFullYear() - 1);
  else if (tf === "FOMC") return "2026-04-30"; // last FOMC meeting
  return d.toISOString().split("T")[0];
}

const YF_RANGE: Record<string, string> = {
  "1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y", "FOMC": "2mo",
};

// ── Handler ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const tf    = req.nextUrl.searchParams.get("tf") ?? "6M";
  const start = startDate(tf);
  const yfRng = YF_RANGE[tf] ?? "6mo";

  // Fetch quotes: FRED primary, Yahoo fallback for each
  const [
    fredDgs5,  fredDgs10, fredDgs30,
    fredSp500, fredVix,   fredGold, fredOil, fredDxy,
    fredHist5, fredHist10,
  ] = await Promise.all([
    fredLatest("DGS5"),
    fredLatest("DGS10"),
    fredLatest("DGS30"),
    fredLatest("SP500"),
    fredLatest("VIXCLS"),
    fredLatest("GOLDAMGBD228NLBM"),
    fredLatest("DCOILWTICO"),
    fredLatest("DTWEXBGS"),
    fredHistory("DGS5",  start),
    fredHistory("DGS10", start),
  ]);

  // Yahoo fallback if FRED failed or key not set
  const [yfDgs5, yfDgs10, yfDgs30, yfSp500, yfVix, yfGold, yfOil, yfDxy,
         yfHist10, yfHist5] = await Promise.all([
    fredDgs5  ? null : yfQuote("^FVX"),
    fredDgs10 ? null : yfQuote("^TNX"),
    fredDgs30 ? null : yfQuote("^TYX"),
    fredSp500 ? null : yfQuote("^GSPC"),
    fredVix   ? null : yfQuote("^VIX"),
    fredGold  ? null : yfQuote("GC=F"),
    fredOil   ? null : yfQuote("CL=F"),
    fredDxy   ? null : yfQuote("DX-Y.NYB"),
    fredHist10.length ? null : yfHistory("^TNX", yfRng),
    fredHist5.length  ? null : yfHistory("^FVX", yfRng),
  ]);

  const dgs5  = fredDgs5  ?? yfDgs5;
  const dgs10 = fredDgs10 ?? yfDgs10;
  const dgs30 = fredDgs30 ?? yfDgs30;
  const sp500 = fredSp500 ?? yfSp500;
  const vix   = fredVix   ?? yfVix;
  const gold  = fredGold  ?? yfGold;
  const oil   = fredOil   ?? yfOil;
  const dxy   = fredDxy   ?? yfDxy;

  // Merge history by date
  const hist10 = fredHist10.length ? fredHist10 : (yfHist10 ?? []);
  const hist5  = fredHist5.length  ? fredHist5  : (yfHist5  ?? []);

  const dateMap = new Map<string, { date: string; tenYear?: number; fiveYear?: number }>();
  hist10.forEach((p) => dateMap.set(p.date, { date: p.date, tenYear: p.value }));
  hist5.forEach((p) => {
    const e = dateMap.get(p.date) ?? { date: p.date };
    dateMap.set(p.date, { ...e, fiveYear: p.value });
  });

  const history = [...dateMap.values()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const live = !!(dgs10 || dgs5);

  return NextResponse.json({
    yields: { fvx: dgs5, tnx: dgs10, tyx: dgs30 },
    equities: { sp500, vix, gold, oil, dxy },
    history,
    live,
    sources: {
      yields: fredDgs10 ? "FRED" : dgs10 ? "Yahoo Finance" : "unavailable",
      equities: fredSp500 ? "FRED" : sp500 ? "Yahoo Finance" : "unavailable",
    },
  });
}
