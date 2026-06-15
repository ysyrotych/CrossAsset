const KEY = process.env.NEWS_API_KEY;

export type NewsItem = {
  title: string;
  source: string;
  description: string;
  publishedAt: string;
};

export async function fetchFinancialNews(): Promise<NewsItem[]> {
  if (!KEY) return [];

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  try {
    const [business, macro] = await Promise.all([
      fetch(
        `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=20&apiKey=${KEY}`,
        { next: { revalidate: 1800 } }
      ),
      fetch(
        `https://newsapi.org/v2/everything?q=Federal+Reserve+OR+inflation+OR+interest+rates+OR+GDP+OR+earnings+OR+S%26P+500&language=en&sortBy=publishedAt&from=${yesterday}&pageSize=20&apiKey=${KEY}`,
        { next: { revalidate: 1800 } }
      ),
    ]);

    const b = business.ok ? ((await business.json()).articles ?? []) : [];
    const m = macro.ok    ? ((await macro.json()).articles ?? [])    : [];

    const seen = new Set<string>();
    const out: NewsItem[] = [];

    for (const a of [...b, ...m]) {
      if (
        a.title &&
        a.title !== "[Removed]" &&
        !seen.has(a.title)
      ) {
        seen.add(a.title);
        out.push({
          title:       a.title,
          source:      a.source?.name ?? "Unknown",
          description: (a.description ?? "").slice(0, 160),
          publishedAt: a.publishedAt ?? "",
        });
      }
    }

    return out.slice(0, 25);
  } catch {
    return [];
  }
}
