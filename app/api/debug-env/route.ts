import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const anthKey = process.env.ANTHROPIC_API_KEY;
  const fredKey = process.env.FRED_API_KEY;

  // Live FRED test
  let fredLive = false;
  let fredSample: string | null = null;
  if (fredKey) {
    try {
      const r = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${fredKey}&file_type=json&sort_order=desc&limit=1`,
        { cache: "no-store" }
      );
      if (r.ok) {
        const obs = (await r.json()).observations?.[0];
        if (obs && obs.value !== ".") {
          fredLive   = true;
          fredSample = `DGS10=${obs.value}% on ${obs.date}`;
        }
      }
    } catch {}
  }

  return NextResponse.json({
    anthropic: {
      hasKey: !!anthKey,
      keyLength: anthKey?.length ?? 0,
      prefix: anthKey ? anthKey.slice(0, 12) + "…" : null,
    },
    fred: {
      hasKey: !!fredKey,
      keyLength: fredKey?.length ?? 0,
      live: fredLive,
      sample: fredSample,
    },
    nodeEnv: process.env.NODE_ENV,
  });
}
