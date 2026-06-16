// CoinGecko free API — no key required, crypto prices with 24h change

export async function fetchCryptoCoingecko(): Promise<
  { symbol: string; name: string; price: number; change: number; pct: number }[]
> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true",
      { next: { revalidate: 300 } }
    );
    if (!r.ok) return [];
    const data = await r.json() as Record<string, { usd: number; usd_24h_change: number }>;
    const coins = [
      { id: "bitcoin",     symbol: "BTC", name: "Bitcoin"  },
      { id: "ethereum",    symbol: "ETH", name: "Ethereum" },
      { id: "solana",      symbol: "SOL", name: "Solana"   },
      { id: "binancecoin", symbol: "BNB", name: "BNB"      },
    ];
    return coins
      .map((c) => {
        const d = data[c.id];
        if (!d?.usd) return null;
        const pct    = d.usd_24h_change ?? 0;
        const change = d.usd * (pct / 100);
        return { symbol: c.symbol, name: c.name, price: d.usd, change, pct };
      })
      .filter(Boolean) as { symbol: string; name: string; price: number; change: number; pct: number }[];
  } catch {
    return [];
  }
}
