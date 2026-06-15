export type MacroIssue = {
  id: string;
  date: string;
  title: string;
  regimeLabel: string;
  executiveSummary: string;
  frontPage: {
    headline: string;
    whatHappened: string;
    whyItMatters: string;
    marketImplication: string;
    affectedAssets: string[];
  }[];
  crossAssetMap: {
    equities: string;
    rates: string;
    fx: string;
    commodities: string;
    credit: string;
  };
  sectorTranslation: {
    sector: string;
    implication: string;
    tickers?: string[];
  }[];
  watchlistImpact?: {
    ticker: string;
    companyName: string;
    impactLevel: "High" | "Medium" | "Low";
    explanation: string;
    suggestedAction: string;
  }[];
  talkingPoints?: string[];
  actionItems: {
    title: string;
    priority: "High" | "Medium" | "Low";
    category: string;
    dueDate?: string;
    relatedTicker?: string;
    relatedEvent?: string;
  }[];
  sourcesUsed: string[];
  dataQualityNote: string;
};

export type MacroSensitivityTag =
  | "Rates"
  | "Inflation"
  | "Consumer Demand"
  | "FX"
  | "Oil"
  | "Credit"
  | "Labor";

export type WatchlistItem = {
  id: string;
  ticker: string;
  companyName: string;
  sector: string;
  macroTags: MacroSensitivityTag[];
  todayImpact?: string;
  suggestedTask?: string;
};

export type TaskStatus = "not_started" | "in_progress" | "complete";
export type TaskPriority = "High" | "Medium" | "Low";
export type TaskCategory =
  | "research"
  | "watchlist"
  | "calendar"
  | "reading"
  | "model_update"
  | "meeting_prep";

export type Task = {
  id: string;
  title: string;
  category: TaskCategory;
  priority: TaskPriority;
  dueDate?: string;
  relatedEvent?: string;
  relatedTicker?: string;
  status: TaskStatus;
  createdAt: string;
};

export type CalendarEvent = {
  id: string;
  date: string;
  eventName: string;
  whyItMatters: string;
  assetsAffected: string[];
  previousReading?: string;
  forecast?: string;
  actual?: string;
};

export type ReactionEntry = {
  id: string;
  eventDate: string;
  eventName: string;
  surpriseDirection: "Beat" | "Miss" | "In-Line";
  expectedRatesReaction: string;
  actualRatesReaction: string;
  expectedEquityReaction: string;
  actualEquityReaction: string;
  expectedFxReaction?: string;
  actualFxReaction?: string;
  result: "Correct" | "Mixed" | "Wrong";
  lessonLearned: string;
};

export type MacroMetric = {
  label: string;
  value: string;
  change?: string;
  direction?: "up" | "down" | "flat";
  context?: string;
};

export type MacroData = {
  rates: {
    tenYear: MacroMetric;
    twoYear: MacroMetric;
    spread2s10s: MacroMetric;
    fedFunds: MacroMetric;
  };
  inflation: {
    cpi: MacroMetric;
    coreCpi: MacroMetric;
    pce: MacroMetric;
  };
  growth: {
    gdp: MacroMetric;
    payrolls: MacroMetric;
    unemployment: MacroMetric;
  };
  risk: {
    hySpread: MacroMetric;
  };
  commodities: {
    oil: MacroMetric;
    gold: MacroMetric;
  };
  isDemo: boolean;
};

export type ArchiveEntry = {
  id: string;
  date: string;
  title: string;
  regimeLabel: string;
  topMacroEvent: string;
  summary: string;
  issue?: MacroIssue;
};
