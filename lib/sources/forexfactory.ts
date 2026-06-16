// ForexFactory economic calendar — free, no API key required

export type CalEvent = {
  event: string;
  date: string;
  impact: "High" | "Medium" | "Low";
  estimate?: string;
  previous?: string;
  actual?: string;
};

type FFEvent = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
};

export async function fetchEconCalendar(): Promise<CalEvent[]> {
  try {
    const r = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      next: { revalidate: 3600 },
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!r.ok) return [];
    const raw = (await r.json()) as FFEvent[];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e) => e.country === "USD" && e.title)
      .map((e) => ({
        event:    e.title ?? "",
        date:     e.date  ?? "",
        impact:   (e.impact === "High" ? "High" : e.impact === "Medium" ? "Medium" : "Low") as "High" | "Medium" | "Low",
        estimate: e.forecast  || undefined,
        previous: e.previous  || undefined,
        actual:   e.actual    || undefined,
      }))
      .slice(0, 25);
  } catch {
    return [];
  }
}
