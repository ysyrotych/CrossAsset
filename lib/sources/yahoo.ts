// Yahoo Finance — server-side access requires browser cookie + crumb authentication

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Module-level session cache (reused on warm serverless invocations)
let _session: { crumb: string; cookie: string; exp: number } | null = null;

async function getSession(): Promise<{ crumb: string; cookie: string } | null> {
  if (_session && _session.exp > Date.now()) return _session;
  try {
    // Step 1 — get session cookies from Yahoo Finance
    const r1 = await fetch("https://finance.yahoo.com/", {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      cache: "no-store",
    });

    // Node 18+ exposes getSetCookie() on Headers; fall back to comma-split
    const hdr = r1.headers as Headers & { getSetCookie?: () => string[] };
    const rawCookies: string[] =
      typeof hdr.getSetCookie === "function"
        ? hdr.getSetCookie()
        : (r1.headers.get("set-cookie") ?? "").split(/,(?=[^;]+=[^;]*)/);
    const cookie = rawCookies
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");

    // Step 2 — fetch crumb (requires session cookie)
    const r2 = await fetch(
      "https://query1.finance.yahoo.com/v1/test/getcrumb",
      {
        headers: {
          "User-Agent": UA,
          Cookie: cookie,
          Accept: "*/*",
          Referer: "https://finance.yahoo.com/",
        },
        cache: "no-store",
      }
    );
    if (!r2.ok) return null;
    const crumb = (await r2.text()).trim();
    // Reject if crumb looks like an error page
    if (!crumb || crumb.length < 3 || crumb.startsWith("{") || crumb.startsWith("<"))
      return null;

    _session = { crumb, cookie, exp: Date.now() + 3_600_000 }; // cache 1 h
    return _session;
  } catch {
    return null;
  }
}

export type Quote = { price: number; prev: number; change: number; pct: number };

// Batch-fetch multiple Yahoo Finance symbols in a single API call (v7 quote endpoint)
export async function fetchYFQuotes(
  symbols: string[]
): Promise<Map<string, Quote>> {
  const result = new Map<string, Quote>();
  if (!symbols.length) return result;

  const parseResponse = (quotes: Record<string, unknown>[]) => {
    for (const q of quotes) {
      const sym = String(q.symbol ?? "");
      const price = Number(q.regularMarketPrice ?? 0);
      const prev = Number(q.regularMarketPreviousClose ?? price);
      if (price && sym)
        result.set(sym, {
          price,
          prev,
          change: price - prev,
          pct: prev ? ((price - prev) / prev) * 100 : 0,
        });
    }
  };

  const doFetch = async (s: { crumb: string; cookie: string }) => {
    const symStr = symbols.map(encodeURIComponent).join(",");
    const r = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symStr}&crumb=${encodeURIComponent(s.crumb)}`,
      {
        headers: {
          "User-Agent": UA,
          Cookie: s.cookie,
          Accept: "application/json",
          Referer: "https://finance.yahoo.com/",
        },
        next: { revalidate: 300 },
      }
    );
    if (!r.ok) return false;
    parseResponse(((await r.json())?.quoteResponse?.result ?? []) as Record<string, unknown>[]);
    return true;
  };

  try {
    const session = await getSession();
    if (!session) return result;

    const ok = await doFetch(session);
    if (!ok) {
      // Crumb may have expired — force refresh and retry once
      _session = null;
      const session2 = await getSession();
      if (session2) await doFetch(session2);
    }
  } catch {
    /* silent */
  }
  return result;
}

// Convenience: fetch all commodity spots + DXY in one call
export async function fetchCommoditySpots(): Promise<{
  gold: Quote | null;
  silver: Quote | null;
  oil: Quote | null;
  dxy: Quote | null;
}> {
  const q = await fetchYFQuotes(["GC=F", "SI=F", "CL=F", "DX-Y.NYB"]);
  return {
    gold:   q.get("GC=F")      ?? null,
    silver: q.get("SI=F")      ?? null,
    oil:    q.get("CL=F")      ?? null,
    dxy:    q.get("DX-Y.NYB") ?? null,
  };
}

// Convenience: fetch 6 major forex pairs
export async function fetchForexYahoo(): Promise<
  { pair: string; label: string; price: number; change: number; pct: number }[]
> {
  const pairs = [
    { sym: "EURUSD=X", pair: "EURUSD", label: "EUR / USD" },
    { sym: "GBPUSD=X", pair: "GBPUSD", label: "GBP / USD" },
    { sym: "USDJPY=X", pair: "USDJPY", label: "USD / JPY" },
    { sym: "AUDUSD=X", pair: "AUDUSD", label: "AUD / USD" },
    { sym: "USDCHF=X", pair: "USDCHF", label: "USD / CHF" },
    { sym: "USDCNH=X", pair: "USDCNH", label: "USD / CNH" },
  ];
  const q = await fetchYFQuotes(pairs.map((p) => p.sym));
  return pairs
    .map((p) => {
      const v = q.get(p.sym);
      return v
        ? { pair: p.pair, label: p.label, price: v.price, change: v.change, pct: v.pct }
        : null;
    })
    .filter(Boolean) as { pair: string; label: string; price: number; change: number; pct: number }[];
}

// Legacy single-quote (used by chart history — kept for compatibility)
export async function fetchQuote(sym: string): Promise<Quote | null> {
  const m = await fetchYFQuotes([sym]);
  return m.get(sym) ?? null;
}

export async function fetchHistory(
  sym: string,
  range: string
): Promise<{ date: string; value: number }[]> {
  const session = await getSession();
  if (!session) return [];
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${range}&crumb=${encodeURIComponent(session.crumb)}`,
      {
        headers: {
          "User-Agent": UA,
          Cookie: session.cookie,
          Accept: "application/json",
          Referer: "https://finance.yahoo.com/",
        },
        next: { revalidate: 600 },
      }
    );
    if (!r.ok) return [];
    const d = (await r.json())?.chart?.result?.[0];
    if (!d) return [];
    const ts: number[] = d.timestamp ?? [];
    const closes: (number | null)[] = d.indicators?.quote?.[0]?.close ?? [];
    return ts
      .map((t, i) => ({
        date: new Date(t * 1000).toISOString().split("T")[0], // YYYY-MM-DD for sort stability
        value: closes[i] ?? 0,
      }))
      .filter((p) => p.value > 0);
  } catch {
    return [];
  }
}
