// ── Strategy Lab — Investment Universe ───────────────────────────────────────
// ~60 large/mid-cap equities across 9 sectors.
// Includes all DEFAULT_PORTFOLIO equity holdings plus additional candidates.
// mktCapB: approximate market cap in $B as of mid-2026 (used for Size factor
// when FMP API key is absent — rank is stable even if absolute values drift).

export type UniverseStock = {
  ticker: string;
  name: string;
  sector: string;
  mktCapB: number;
};

export const UNIVERSE: UniverseStock[] = [
  // ── Technology ──────────────────────────────────────────────────────────────
  { ticker: "MSFT",  name: "Microsoft",            sector: "Technology",        mktCapB: 3100 },
  { ticker: "AAPL",  name: "Apple",                sector: "Technology",        mktCapB: 3200 },
  { ticker: "NVDA",  name: "NVIDIA",               sector: "Technology",        mktCapB: 3300 },
  { ticker: "AVGO",  name: "Broadcom",             sector: "Technology",        mktCapB:  900 },
  { ticker: "ASML",  name: "ASML Holding",         sector: "Technology",        mktCapB:  310 },
  { ticker: "SNPS",  name: "Synopsys",             sector: "Technology",        mktCapB:   87 },
  { ticker: "AMD",   name: "Advanced Micro Devices",sector: "Technology",       mktCapB:  230 },
  { ticker: "QCOM",  name: "Qualcomm",             sector: "Technology",        mktCapB:  175 },
  { ticker: "APH",   name: "Amphenol",             sector: "Technology",        mktCapB:   95 },
  { ticker: "FICO",  name: "Fair Isaac",           sector: "Technology",        mktCapB:   45 },
  { ticker: "NOW",   name: "ServiceNow",           sector: "Technology",        mktCapB:  200 },
  { ticker: "CRM",   name: "Salesforce",           sector: "Technology",        mktCapB:  250 },
  { ticker: "ORCL",  name: "Oracle",               sector: "Technology",        mktCapB:  450 },

  // ── Communication Services ──────────────────────────────────────────────────
  { ticker: "GOOGL", name: "Alphabet",             sector: "Communication",     mktCapB: 2100 },
  { ticker: "META",  name: "Meta Platforms",       sector: "Communication",     mktCapB: 1500 },
  { ticker: "NFLX",  name: "Netflix",              sector: "Communication",     mktCapB:  380 },
  { ticker: "SPOT",  name: "Spotify",              sector: "Communication",     mktCapB:   80 },
  { ticker: "RDDT",  name: "Reddit",               sector: "Communication",     mktCapB:   30 },

  // ── Consumer Discretionary ──────────────────────────────────────────────────
  { ticker: "AMZN",  name: "Amazon",               sector: "Consumer Disc.",    mktCapB: 2200 },
  { ticker: "TSLA",  name: "Tesla",                sector: "Consumer Disc.",    mktCapB:  900 },
  { ticker: "SHOP",  name: "Shopify",              sector: "Consumer Disc.",    mktCapB:  135 },
  { ticker: "MCD",   name: "McDonald's",           sector: "Consumer Disc.",    mktCapB:  200 },
  { ticker: "NKE",   name: "Nike",                 sector: "Consumer Disc.",    mktCapB:   65 },
  { ticker: "HD",    name: "Home Depot",           sector: "Consumer Disc.",    mktCapB:  360 },
  { ticker: "SBUX",  name: "Starbucks",            sector: "Consumer Disc.",    mktCapB:   85 },

  // ── Consumer Staples ────────────────────────────────────────────────────────
  { ticker: "PG",    name: "Procter & Gamble",     sector: "Consumer Staples",  mktCapB:  380 },
  { ticker: "KO",    name: "Coca-Cola",            sector: "Consumer Staples",  mktCapB:  290 },
  { ticker: "PEP",   name: "PepsiCo",              sector: "Consumer Staples",  mktCapB:  200 },
  { ticker: "COST",  name: "Costco",               sector: "Consumer Staples",  mktCapB:  420 },
  { ticker: "WMT",   name: "Walmart",              sector: "Consumer Staples",  mktCapB:  720 },

  // ── Healthcare ──────────────────────────────────────────────────────────────
  { ticker: "LLY",   name: "Eli Lilly",            sector: "Healthcare",        mktCapB:  720 },
  { ticker: "ISRG",  name: "Intuitive Surgical",   sector: "Healthcare",        mktCapB:  170 },
  { ticker: "VRTX",  name: "Vertex Pharma",        sector: "Healthcare",        mktCapB:  130 },
  { ticker: "UNH",   name: "UnitedHealth",         sector: "Healthcare",        mktCapB:  480 },
  { ticker: "ABT",   name: "Abbott Labs",          sector: "Healthcare",        mktCapB:  195 },
  { ticker: "TMO",   name: "Thermo Fisher",        sector: "Healthcare",        mktCapB:  190 },
  { ticker: "DHR",   name: "Danaher",              sector: "Healthcare",        mktCapB:  155 },
  { ticker: "ABBV",  name: "AbbVie",               sector: "Healthcare",        mktCapB:  330 },
  { ticker: "JNJ",   name: "Johnson & Johnson",    sector: "Healthcare",        mktCapB:  370 },

  // ── Financials ──────────────────────────────────────────────────────────────
  { ticker: "V",     name: "Visa",                 sector: "Financials",        mktCapB:  580 },
  { ticker: "BX",    name: "Blackstone",           sector: "Financials",        mktCapB:  180 },
  { ticker: "SPGI",  name: "S&P Global",           sector: "Financials",        mktCapB:  150 },
  { ticker: "MSCI",  name: "MSCI Inc.",            sector: "Financials",        mktCapB:   45 },
  { ticker: "JPM",   name: "JPMorgan Chase",       sector: "Financials",        mktCapB:  700 },
  { ticker: "GS",    name: "Goldman Sachs",        sector: "Financials",        mktCapB:  195 },
  { ticker: "AXP",   name: "American Express",     sector: "Financials",        mktCapB:  190 },
  { ticker: "ICE",   name: "Intercontinental Exch",sector: "Financials",        mktCapB:   90 },

  // ── Industrials ─────────────────────────────────────────────────────────────
  { ticker: "TDG",   name: "TransDigm",            sector: "Industrials",       mktCapB:   72 },
  { ticker: "AXON",  name: "Axon Enterprise",      sector: "Industrials",       mktCapB:   60 },
  { ticker: "HON",   name: "Honeywell",            sector: "Industrials",       mktCapB:  155 },
  { ticker: "RTX",   name: "RTX Corp",             sector: "Industrials",       mktCapB:  170 },
  { ticker: "CAT",   name: "Caterpillar",          sector: "Industrials",       mktCapB:  195 },
  { ticker: "GE",    name: "GE Aerospace",         sector: "Industrials",       mktCapB:  230 },

  // ── Energy ──────────────────────────────────────────────────────────────────
  { ticker: "XOM",   name: "ExxonMobil",           sector: "Energy",            mktCapB:  480 },
  { ticker: "CVX",   name: "Chevron",              sector: "Energy",            mktCapB:  250 },
  { ticker: "COP",   name: "ConocoPhillips",       sector: "Energy",            mktCapB:  120 },

  // ── Materials ───────────────────────────────────────────────────────────────
  { ticker: "LIN",   name: "Linde",                sector: "Materials",         mktCapB:  220 },
  { ticker: "APD",   name: "Air Products",         sector: "Materials",         mktCapB:   57 },
  { ticker: "SHW",   name: "Sherwin-Williams",     sector: "Materials",         mktCapB:   90 },
];

export const UNIVERSE_SECTORS = [
  "All",
  "Technology",
  "Communication",
  "Consumer Disc.",
  "Consumer Staples",
  "Healthcare",
  "Financials",
  "Industrials",
  "Energy",
  "Materials",
] as const;

export type UniverseSector = typeof UNIVERSE_SECTORS[number];
