import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ASSETS: { symbol: string; name: string; group: string; kind: "price" | "index" }[] = [
  { symbol: "^GSPC", name: "S&P 500", group: "Equities", kind: "index" },
  { symbol: "^IXIC", name: "Nasdaq", group: "Equities", kind: "index" },
  { symbol: "^RUT", name: "Russell 2000", group: "Equities", kind: "index" },
  { symbol: "^VIX", name: "VIX", group: "Equities", kind: "index" },
  { symbol: "CL=F", name: "WTI Crude", group: "Commodities", kind: "price" },
  { symbol: "GC=F", name: "Gold", group: "Commodities", kind: "price" },
  { symbol: "DX-Y.NYB", name: "U.S. Dollar (DXY)", group: "FX", kind: "index" },
  { symbol: "BTC-USD", name: "Bitcoin", group: "Crypto", kind: "price" },
];

async function fetchQuote(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    const closes: (number | null)[] = (res?.indicators?.quote?.[0]?.close ?? []).filter((v: number | null) => v != null);
    if (closes.length < 2) return null;
    const last = closes[closes.length - 1]!;
    const wkAgo = closes[Math.max(0, closes.length - 6)]!;   // ~5 trading days
    const moAgo = closes[0]!;
    return { last, wkChg: ((last / wkAgo) - 1) * 100, moChg: ((last / moAgo) - 1) * 100 };
  } catch { return null; }
}

export async function GET() {
  const quotes = await Promise.all(ASSETS.map((a) => fetchQuote(a.symbol)));
  const rows = ASSETS.map((a, i) => (quotes[i] ? { ...a, ...quotes[i]! } : null)).filter(Boolean);
  return NextResponse.json({ rows, asOf: new Date().toISOString() });
}
