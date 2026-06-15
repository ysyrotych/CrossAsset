import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function testFred() {
  const key = process.env.FRED_API_KEY;
  if (!key) return { hasKey: false, live: false };
  try {
    const r = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&limit=1&sort_order=desc&api_key=${key}&file_type=json`,
      { cache: "no-store" }
    );
    if (!r.ok) return { hasKey: true, live: false };
    const obs = (await r.json()).observations?.[0];
    const val = parseFloat(obs?.value);
    return { hasKey: true, live: !isNaN(val), sample: isNaN(val) ? null : `DGS10=${obs.value}% on ${obs.date}` };
  } catch {
    return { hasKey: true, live: false };
  }
}

async function testNewsApi() {
  const key = process.env.NEWS_API_KEY;
  if (!key) return { hasKey: false, live: false };
  try {
    const r = await fetch(`https://newsapi.org/v2/top-headlines?category=business&pageSize=1&apiKey=${key}`, { cache: "no-store" });
    return { hasKey: true, live: r.ok };
  } catch {
    return { hasKey: true, live: false };
  }
}

async function testFinnhub() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return { hasKey: false, live: false };
  try {
    const today = new Date().toISOString().split("T")[0];
    const r = await fetch(`https://finnhub.io/api/v1/calendar/economic?from=${today}&to=${today}&token=${key}`, { cache: "no-store" });
    return { hasKey: true, live: r.ok };
  } catch {
    return { hasKey: true, live: false };
  }
}

async function testBea() {
  const key = process.env.BEA_API_KEY;
  if (!key) return { hasKey: false, live: false };
  try {
    const p = new URLSearchParams({ method: "GetData", DataSetName: "NIPA", TableName: "T10101", Frequency: "Q", Year: "2024", UserID: key, ResultFormat: "JSON" });
    const r = await fetch(`https://apps.bea.gov/api/data?${p}`, { cache: "no-store" });
    return { hasKey: true, live: r.ok };
  } catch {
    return { hasKey: true, live: false };
  }
}

async function testBls() {
  const key = process.env.BLS_API_KEY;
  if (!key) return { hasKey: false, live: false };
  try {
    const r = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesid: ["CUUR0000SA0"], startyear: "2024", endyear: "2024", registrationkey: key }),
      cache: "no-store",
    } as RequestInit);
    if (!r.ok) return { hasKey: true, live: false };
    const j = await r.json();
    return { hasKey: true, live: j.status === "REQUEST_SUCCEEDED" };
  } catch {
    return { hasKey: true, live: false };
  }
}

export async function GET() {
  const anthKey = process.env.ANTHROPIC_API_KEY;

  const [fred, newsapi, finnhub, bea, bls] = await Promise.all([
    testFred(), testNewsApi(), testFinnhub(), testBea(), testBls(),
  ]);

  return NextResponse.json({
    anthropic: { hasKey: !!anthKey, keyLength: anthKey?.length ?? 0, prefix: anthKey ? anthKey.slice(0, 12) + "…" : null },
    fred,
    newsapi,
    finnhub,
    bea,
    bls,
    nodeEnv: process.env.NODE_ENV,
  });
}
