const KEY = process.env.BLS_API_KEY;

const SERIES: Record<string, string> = {
  CPI_ALL:       "CUUR0000SA0",      // CPI all urban consumers
  CPI_CORE:      "CUUR0000SA0L1E",   // CPI ex food & energy
  CPI_SERVICES:  "CUUR0000SAS",      // CPI services
  CPI_SHELTER:   "CUUR0000SAH1",     // CPI shelter
  CPI_ENERGY:    "CUUR0000SA0E",     // CPI energy
  PPI_ALL:       "WPU00000000",      // PPI all commodities
  UNRATE:        "LNS14000000",      // Unemployment rate
  NONFARM:       "CES0000000001",    // Total nonfarm payrolls (thousands)
  AVG_HOURLY_EARNINGS: "CES0500000003", // Avg hourly earnings, private sector
  INITIAL_CLAIMS: "ICSA",            // Initial jobless claims
};

export type BlsPoint = {
  year: string;
  period: string;
  periodName: string;
  value: number;
  netChange?: number;
  pctChange?: number;
};

export type BlsData = Partial<Record<keyof typeof SERIES, BlsPoint[]>>;

export async function fetchBlsData(): Promise<BlsData> {
  if (!KEY) return {};

  const currentYear = new Date().getFullYear().toString();
  const prevYear    = (new Date().getFullYear() - 1).toString();

  try {
    const r = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seriesid:        Object.values(SERIES),
        startyear:       prevYear,
        endyear:         currentYear,
        registrationkey: KEY,
        calculations:    true,
      }),
      next: { revalidate: 3600 },
    });

    if (!r.ok) return {};

    const json = await r.json() as {
      status: string;
      Results?: {
        series?: { seriesID: string; data: { year: string; period: string; periodName: string; value: string; calculations?: { net_changes?: Record<string, string>; pct_changes?: Record<string, string> } }[] }[]
      };
    };

    if (json.status !== "REQUEST_SUCCEEDED") return {};

    const out: BlsData = {};
    const idToName = Object.fromEntries(
      Object.entries(SERIES).map(([name, id]) => [id, name])
    );

    for (const series of json.Results?.series ?? []) {
      const name = idToName[series.seriesID] as keyof typeof SERIES | undefined;
      if (!name) continue;

      out[name] = series.data.slice(0, 13).map((d) => ({
        year:       d.year,
        period:     d.period,
        periodName: d.periodName,
        value:      parseFloat(d.value),
        netChange:  d.calculations?.net_changes?.["1"]
          ? parseFloat(d.calculations.net_changes["1"])
          : undefined,
        pctChange:  d.calculations?.pct_changes?.["1"]
          ? parseFloat(d.calculations.pct_changes["1"])
          : undefined,
      }));
    }

    return out;
  } catch {
    return {};
  }
}
