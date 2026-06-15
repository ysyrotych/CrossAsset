const BASE = "https://apps.bea.gov/api/data";
const KEY  = process.env.BEA_API_KEY;

export type BeaPoint = { period: string; value: number; lineDesc: string };

async function beaGet(params: Record<string, string>): Promise<unknown> {
  if (!KEY) return null;
  try {
    const p = new URLSearchParams({ ...params, UserID: KEY, ResultFormat: "JSON" });
    const r = await fetch(`${BASE}?${p}`, { next: { revalidate: 86400 } });
    if (!r.ok) return null;
    return ((await r.json()) as { BEAAPI?: { Results?: unknown } }).BEAAPI?.Results ?? null;
  } catch {
    return null;
  }
}

function parseBeaData(results: unknown, lineNumbers: string[]): BeaPoint[] {
  const data = (results as { Data?: Record<string, string>[] } | null)?.Data ?? [];
  return data
    .filter((d) => lineNumbers.includes(d.LineNumber) && d.DataValue)
    .map((d) => ({
      period:   d.TimePeriod,
      value:    parseFloat(d.DataValue.replace(/,/g, "")),
      lineDesc: d.LineDescription,
    }));
}

export async function fetchGdpComponents(): Promise<BeaPoint[]> {
  const results = await beaGet({
    method:      "GetData",
    DataSetName: "NIPA",
    TableName:   "T10101",
    Frequency:   "Q",
    Year:        "LAST4",
  });
  // Lines: 1=GDP, 2=PCE, 6=Gross Private Investment, 15=Govt, 22=Net Exports
  return parseBeaData(results, ["1", "2", "6", "15", "22"]);
}

export async function fetchPersonalIncomeOutlays(): Promise<BeaPoint[]> {
  const results = await beaGet({
    method:      "GetData",
    DataSetName: "NIPA",
    TableName:   "T20806",
    Frequency:   "M",
    Year:        "LAST2",
  });
  // Lines: 1=Personal Income, 8=PCE, 12=Personal Savings Rate
  return parseBeaData(results, ["1", "8", "12"]);
}

export async function fetchBeaContext(): Promise<{
  gdp: BeaPoint[];
  income: BeaPoint[];
}> {
  const [gdp, income] = await Promise.all([
    fetchGdpComponents(),
    fetchPersonalIncomeOutlays(),
  ]);
  return { gdp, income };
}
