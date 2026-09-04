// ── Weekly Macro Report Engine — shared types ────────────────────────────────

export type Transform =
  | "level"      // raw values
  | "yoy"        // year-over-year % (monthly=12, quarterly=4)
  | "mom"        // month-over-month %
  | "4wkavg"     // trailing 4-week average (weekly series)
  | "rate";      // already a rate/percent — pass through

export type Freq = "d" | "w" | "m" | "q";
export type ChartType = "line" | "area" | "bar" | "multiline";
export type SourceKind = "fred" | "yahoo" | "curated";

export type SeriesSpec = {
  id: string;                 // FRED series id, yahoo symbol, or curated key
  label?: string;             // legend label for multiline
  transform?: Transform;
  color?: string;
};

export type Callout = { text: string; emphasis?: boolean };

export type ChartSpec = {
  id: string;
  section: SectionId;
  title: string;
  unit: string;               // "% y/y", "index", "$b", "millions, SAAR", …
  source: SourceKind;
  freq: Freq;
  chartType: ChartType;
  series: SeriesSpec[];
  avg?: boolean;              // draw the historical-average reference line
  recession?: boolean;        // draw NBER recession bands
  startYear?: number;         // trim history to this year
  precision?: number;         // decimals for latest-value display
  note?: string;              // static footnote
};

export type SectionId =
  | "summary-macro" | "summary-markets" | "monetary-policy" | "commodities"
  | "inflation" | "inflation-expectations" | "labor" | "consumer"
  | "housing" | "confidence" | "nfib" | "ism-services" | "ism-mfg"
  | "other-mfg" | "trade" | "budget" | "gdp" | "financial-conditions";

export type Section = {
  id: SectionId;
  title: string;
  chartIds: string[];         // charts belonging to this section (order matters)
};

// ── computed output (server → client) ────────────────────────────────────────
export type Point = { date: string; value: number };
export type RenderedSeries = { name: string; color?: string; data: Point[] };

export type RenderedChart = {
  id: string;
  section: SectionId;
  title: string;
  unit: string;
  chartType: ChartType;
  series: RenderedSeries[];
  avg?: number | null;         // computed average across visible window
  refLine?: number | null;     // fixed reference line (e.g. 50 for ISM diffusion)
  recession?: boolean;
  latest?: { value: number; date: string; change?: number; changeUnit?: "% y/y" | "pp" };
  stats?: { min: number; max: number; percentile: number }; // percentile of latest in visible window
  asOf?: string;               // for curated series ("Feb 2026")
  stale?: boolean;             // curated & possibly out of date
  precision?: number;
  note?: string;
  error?: string;
  sourceId?: string;   // e.g. "FRED: DGS10" — provenance for the modal
  isDiffusion?: boolean; // ISM-style 50 = expansion line
};

export type ReportData = {
  generatedAt: string;
  charts: Record<string, RenderedChart>;
  fredConnected: boolean;
};

export type SectionNarrative = { section: SectionId; bullets: string[]; source: "claude" | "computed" };
