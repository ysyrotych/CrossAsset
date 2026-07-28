// ── Strategy Lab — Investment Universe ───────────────────────────────────────
// 150 large/mid-cap equities across 11 sectors.
// mktCapB: approximate market cap in $B as of mid-2026 (used for Size factor
// when FMP API key is absent — rank is stable even if absolute values drift).
// reportingLagDays: optional override; if absent, derived from mktCapB by
// getReportingLag(). Enforced in point-in-time factor scoring.

export type UniverseStock = {
  ticker: string;
  name: string;
  sector: string;
  mktCapB: number;
  reportingLagDays?: number; // days after quarter-end until 10-Q/10-K available
};

// Derive reporting lag from market cap when no explicit override is given.
// Large caps file in ~30 days; small-mid caps up to ~55 days.
export function getReportingLag(u: UniverseStock): number {
  if (u.reportingLagDays != null) return u.reportingLagDays;
  if (u.mktCapB >= 300) return 30;
  if (u.mktCapB >= 100) return 40;
  if (u.mktCapB >= 50)  return 45;
  return 55;
}

export const UNIVERSE: UniverseStock[] = [
  // ── Technology ──────────────────────────────────────────────────────────────
  { ticker: "MSFT",  name: "Microsoft",             sector: "Technology",        mktCapB: 3100 },
  { ticker: "AAPL",  name: "Apple",                 sector: "Technology",        mktCapB: 3200 },
  { ticker: "NVDA",  name: "NVIDIA",                sector: "Technology",        mktCapB: 3300 },
  { ticker: "AVGO",  name: "Broadcom",              sector: "Technology",        mktCapB:  900 },
  { ticker: "ASML",  name: "ASML Holding",          sector: "Technology",        mktCapB:  310 },
  { ticker: "PLTR",  name: "Palantir",              sector: "Technology",        mktCapB:  350 },
  { ticker: "APP",   name: "AppLovin",              sector: "Technology",        mktCapB:  330 },
  { ticker: "IBM",   name: "IBM",                   sector: "Technology",        mktCapB:  245 },
  { ticker: "ORCL",  name: "Oracle",                sector: "Technology",        mktCapB:  450 },
  { ticker: "CRM",   name: "Salesforce",            sector: "Technology",        mktCapB:  250 },
  { ticker: "NOW",   name: "ServiceNow",            sector: "Technology",        mktCapB:  200 },
  { ticker: "AMD",   name: "Advanced Micro Devices",sector: "Technology",        mktCapB:  230 },
  { ticker: "TXN",   name: "Texas Instruments",     sector: "Technology",        mktCapB:  185 },
  { ticker: "QCOM",  name: "Qualcomm",              sector: "Technology",        mktCapB:  175 },
  { ticker: "AMAT",  name: "Applied Materials",     sector: "Technology",        mktCapB:  155 },
  { ticker: "PANW",  name: "Palo Alto Networks",    sector: "Technology",        mktCapB:  125 },
  { ticker: "MU",    name: "Micron Technology",     sector: "Technology",        mktCapB:  105 },
  { ticker: "CRWD",  name: "CrowdStrike",           sector: "Technology",        mktCapB:  105 },
  { ticker: "INTC",  name: "Intel",                 sector: "Technology",        mktCapB:  100 },
  { ticker: "APH",   name: "Amphenol",              sector: "Technology",        mktCapB:   95 },
  { ticker: "LRCX",  name: "Lam Research",          sector: "Technology",        mktCapB:   90 },
  { ticker: "ADI",   name: "Analog Devices",        sector: "Technology",        mktCapB:   88 },
  { ticker: "KLAC",  name: "KLA Corporation",       sector: "Technology",        mktCapB:   82 },
  { ticker: "CDNS",  name: "Cadence Design Systems",sector: "Technology",        mktCapB:   80 },
  { ticker: "SNPS",  name: "Synopsys",              sector: "Technology",        mktCapB:   87 },
  { ticker: "DELL",  name: "Dell Technologies",     sector: "Technology",        mktCapB:   75 },
  { ticker: "FTNT",  name: "Fortinet",              sector: "Technology",        mktCapB:   62 },
  { ticker: "SNOW",  name: "Snowflake",             sector: "Technology",        mktCapB:   55 },
  { ticker: "DDOG",  name: "Datadog",               sector: "Technology",        mktCapB:   42 },
  { ticker: "FICO",  name: "Fair Isaac",            sector: "Technology",        mktCapB:   45 },

  // ── Communication Services ──────────────────────────────────────────────────
  { ticker: "GOOGL", name: "Alphabet",              sector: "Communication",     mktCapB: 2100 },
  { ticker: "META",  name: "Meta Platforms",        sector: "Communication",     mktCapB: 1500 },
  { ticker: "TMUS",  name: "T-Mobile US",           sector: "Communication",     mktCapB:  265 },
  { ticker: "NFLX",  name: "Netflix",               sector: "Communication",     mktCapB:  380 },
  { ticker: "DIS",   name: "Walt Disney",           sector: "Communication",     mktCapB:  168 },
  { ticker: "T",     name: "AT&T",                  sector: "Communication",     mktCapB:  148 },
  { ticker: "CHTR",  name: "Charter Communications",sector: "Communication",     mktCapB:   42 },
  { ticker: "SPOT",  name: "Spotify",               sector: "Communication",     mktCapB:   80 },
  { ticker: "PINS",  name: "Pinterest",             sector: "Communication",     mktCapB:   24 },
  { ticker: "RDDT",  name: "Reddit",                sector: "Communication",     mktCapB:   30 },

  // ── Consumer Discretionary ──────────────────────────────────────────────────
  { ticker: "AMZN",  name: "Amazon",                sector: "Consumer Disc.",    mktCapB: 2200 },
  { ticker: "TSLA",  name: "Tesla",                 sector: "Consumer Disc.",    mktCapB:  900 },
  { ticker: "BKNG",  name: "Booking Holdings",      sector: "Consumer Disc.",    mktCapB:  178 },
  { ticker: "UBER",  name: "Uber Technologies",     sector: "Consumer Disc.",    mktCapB:  190 },
  { ticker: "TJX",   name: "TJX Companies",         sector: "Consumer Disc.",    mktCapB:  142 },
  { ticker: "LOW",   name: "Lowe's",                sector: "Consumer Disc.",    mktCapB:  148 },
  { ticker: "HD",    name: "Home Depot",            sector: "Consumer Disc.",    mktCapB:  360 },
  { ticker: "MCD",   name: "McDonald's",            sector: "Consumer Disc.",    mktCapB:  200 },
  { ticker: "SHOP",  name: "Shopify",               sector: "Consumer Disc.",    mktCapB:  135 },
  { ticker: "CMG",   name: "Chipotle",              sector: "Consumer Disc.",    mktCapB:   68 },
  { ticker: "ABNB",  name: "Airbnb",                sector: "Consumer Disc.",    mktCapB:   78 },
  { ticker: "ROST",  name: "Ross Stores",           sector: "Consumer Disc.",    mktCapB:   52 },
  { ticker: "SBUX",  name: "Starbucks",             sector: "Consumer Disc.",    mktCapB:   85 },
  { ticker: "NKE",   name: "Nike",                  sector: "Consumer Disc.",    mktCapB:   65 },
  { ticker: "GM",    name: "General Motors",        sector: "Consumer Disc.",    mktCapB:   50 },
  { ticker: "YUM",   name: "Yum! Brands",           sector: "Consumer Disc.",    mktCapB:   36 },

  // ── Consumer Staples ────────────────────────────────────────────────────────
  { ticker: "WMT",   name: "Walmart",               sector: "Consumer Staples",  mktCapB:  720 },
  { ticker: "PM",    name: "Philip Morris",         sector: "Consumer Staples",  mktCapB:  188 },
  { ticker: "COST",  name: "Costco",                sector: "Consumer Staples",  mktCapB:  420 },
  { ticker: "PG",    name: "Procter & Gamble",      sector: "Consumer Staples",  mktCapB:  380 },
  { ticker: "KO",    name: "Coca-Cola",             sector: "Consumer Staples",  mktCapB:  290 },
  { ticker: "PEP",   name: "PepsiCo",               sector: "Consumer Staples",  mktCapB:  200 },
  { ticker: "MO",    name: "Altria Group",          sector: "Consumer Staples",  mktCapB:   78 },
  { ticker: "MDLZ",  name: "Mondelez International",sector: "Consumer Staples",  mktCapB:   62 },
  { ticker: "CL",    name: "Colgate-Palmolive",     sector: "Consumer Staples",  mktCapB:   58 },
  { ticker: "KMB",   name: "Kimberly-Clark",        sector: "Consumer Staples",  mktCapB:   44 },

  // ── Healthcare ──────────────────────────────────────────────────────────────
  { ticker: "LLY",   name: "Eli Lilly",             sector: "Healthcare",        mktCapB:  720 },
  { ticker: "MRK",   name: "Merck",                 sector: "Healthcare",        mktCapB:  250 },
  { ticker: "UNH",   name: "UnitedHealth",          sector: "Healthcare",        mktCapB:  480 },
  { ticker: "JNJ",   name: "Johnson & Johnson",     sector: "Healthcare",        mktCapB:  370 },
  { ticker: "ABBV",  name: "AbbVie",                sector: "Healthcare",        mktCapB:  330 },
  { ticker: "PFE",   name: "Pfizer",                sector: "Healthcare",        mktCapB:  158 },
  { ticker: "AMGN",  name: "Amgen",                 sector: "Healthcare",        mktCapB:  138 },
  { ticker: "BSX",   name: "Boston Scientific",     sector: "Healthcare",        mktCapB:  132 },
  { ticker: "SYK",   name: "Stryker",               sector: "Healthcare",        mktCapB:  132 },
  { ticker: "ABT",   name: "Abbott Labs",           sector: "Healthcare",        mktCapB:  195 },
  { ticker: "TMO",   name: "Thermo Fisher",         sector: "Healthcare",        mktCapB:  190 },
  { ticker: "DHR",   name: "Danaher",               sector: "Healthcare",        mktCapB:  155 },
  { ticker: "MDT",   name: "Medtronic",             sector: "Healthcare",        mktCapB:   92 },
  { ticker: "BMY",   name: "Bristol-Myers Squibb",  sector: "Healthcare",        mktCapB:   98 },
  { ticker: "GILD",  name: "Gilead Sciences",       sector: "Healthcare",        mktCapB:   98 },
  { ticker: "REGN",  name: "Regeneron",             sector: "Healthcare",        mktCapB:   78 },
  { ticker: "HCA",   name: "HCA Healthcare",        sector: "Healthcare",        mktCapB:   62 },
  { ticker: "ISRG",  name: "Intuitive Surgical",    sector: "Healthcare",        mktCapB:  170 },
  { ticker: "VRTX",  name: "Vertex Pharma",         sector: "Healthcare",        mktCapB:  130 },

  // ── Financials ──────────────────────────────────────────────────────────────
  { ticker: "V",     name: "Visa",                  sector: "Financials",        mktCapB:  580 },
  { ticker: "MA",    name: "Mastercard",            sector: "Financials",        mktCapB:  495 },
  { ticker: "JPM",   name: "JPMorgan Chase",        sector: "Financials",        mktCapB:  700 },
  { ticker: "BAC",   name: "Bank of America",       sector: "Financials",        mktCapB:  360 },
  { ticker: "WFC",   name: "Wells Fargo",           sector: "Financials",        mktCapB:  235 },
  { ticker: "MS",    name: "Morgan Stanley",        sector: "Financials",        mktCapB:  218 },
  { ticker: "GS",    name: "Goldman Sachs",         sector: "Financials",        mktCapB:  195 },
  { ticker: "BLK",   name: "BlackRock",             sector: "Financials",        mktCapB:  178 },
  { ticker: "PGR",   name: "Progressive",           sector: "Financials",        mktCapB:  162 },
  { ticker: "C",     name: "Citigroup",             sector: "Financials",        mktCapB:  138 },
  { ticker: "SCHW",  name: "Charles Schwab",        sector: "Financials",        mktCapB:  128 },
  { ticker: "CB",    name: "Chubb",                 sector: "Financials",        mktCapB:  118 },
  { ticker: "AXP",   name: "American Express",      sector: "Financials",        mktCapB:  190 },
  { ticker: "CME",   name: "CME Group",             sector: "Financials",        mktCapB:   88 },
  { ticker: "ICE",   name: "Intercontinental Exch", sector: "Financials",        mktCapB:   90 },
  { ticker: "SPGI",  name: "S&P Global",            sector: "Financials",        mktCapB:  150 },
  { ticker: "BX",    name: "Blackstone",            sector: "Financials",        mktCapB:  180 },
  { ticker: "MSCI",  name: "MSCI Inc.",             sector: "Financials",        mktCapB:   45 },

  // ── Industrials ─────────────────────────────────────────────────────────────
  { ticker: "ETN",   name: "Eaton Corporation",     sector: "Industrials",       mktCapB:  162 },
  { ticker: "UNP",   name: "Union Pacific",         sector: "Industrials",       mktCapB:  148 },
  { ticker: "LMT",   name: "Lockheed Martin",       sector: "Industrials",       mktCapB:  122 },
  { ticker: "BA",    name: "Boeing",                sector: "Industrials",       mktCapB:  112 },
  { ticker: "DE",    name: "Deere & Company",       sector: "Industrials",       mktCapB:  112 },
  { ticker: "GE",    name: "GE Aerospace",          sector: "Industrials",       mktCapB:  230 },
  { ticker: "RTX",   name: "RTX Corp",              sector: "Industrials",       mktCapB:  170 },
  { ticker: "CAT",   name: "Caterpillar",           sector: "Industrials",       mktCapB:  195 },
  { ticker: "UPS",   name: "United Parcel Service", sector: "Industrials",       mktCapB:   92 },
  { ticker: "PH",    name: "Parker Hannifin",       sector: "Industrials",       mktCapB:   82 },
  { ticker: "ITW",   name: "Illinois Tool Works",   sector: "Industrials",       mktCapB:   82 },
  { ticker: "CTAS",  name: "Cintas",                sector: "Industrials",       mktCapB:   82 },
  { ticker: "HON",   name: "Honeywell",             sector: "Industrials",       mktCapB:  155 },
  { ticker: "EMR",   name: "Emerson Electric",      sector: "Industrials",       mktCapB:   72 },
  { ticker: "FDX",   name: "FedEx",                 sector: "Industrials",       mktCapB:   72 },
  { ticker: "NOC",   name: "Northrop Grumman",      sector: "Industrials",       mktCapB:   62 },
  { ticker: "CSX",   name: "CSX Corporation",       sector: "Industrials",       mktCapB:   58 },
  { ticker: "TDG",   name: "TransDigm",             sector: "Industrials",       mktCapB:   72 },
  { ticker: "AXON",  name: "Axon Enterprise",       sector: "Industrials",       mktCapB:   60 },

  // ── Energy ──────────────────────────────────────────────────────────────────
  { ticker: "XOM",   name: "ExxonMobil",            sector: "Energy",            mktCapB:  480 },
  { ticker: "CVX",   name: "Chevron",               sector: "Energy",            mktCapB:  250 },
  { ticker: "OKE",   name: "ONEOK",                 sector: "Energy",            mktCapB:   62 },
  { ticker: "EOG",   name: "EOG Resources",         sector: "Energy",            mktCapB:   72 },
  { ticker: "COP",   name: "ConocoPhillips",        sector: "Energy",            mktCapB:  120 },
  { ticker: "SLB",   name: "SLB",                   sector: "Energy",            mktCapB:   58 },
  { ticker: "MPC",   name: "Marathon Petroleum",    sector: "Energy",            mktCapB:   57 },
  { ticker: "PSX",   name: "Phillips 66",           sector: "Energy",            mktCapB:   52 },
  { ticker: "VLO",   name: "Valero Energy",         sector: "Energy",            mktCapB:   47 },
  { ticker: "KMI",   name: "Kinder Morgan",         sector: "Energy",            mktCapB:   26 },
  { ticker: "HAL",   name: "Halliburton",           sector: "Energy",            mktCapB:   25 },

  // ── Materials ───────────────────────────────────────────────────────────────
  { ticker: "LIN",   name: "Linde",                 sector: "Materials",         mktCapB:  220 },
  { ticker: "ECL",   name: "Ecolab",                sector: "Materials",         mktCapB:   62 },
  { ticker: "FCX",   name: "Freeport-McMoRan",      sector: "Materials",         mktCapB:   67 },
  { ticker: "NEM",   name: "Newmont",               sector: "Materials",         mktCapB:   57 },
  { ticker: "SHW",   name: "Sherwin-Williams",      sector: "Materials",         mktCapB:   90 },
  { ticker: "APD",   name: "Air Products",          sector: "Materials",         mktCapB:   57 },
  { ticker: "PPG",   name: "PPG Industries",        sector: "Materials",         mktCapB:   29 },

  // ── Real Estate ─────────────────────────────────────────────────────────────
  { ticker: "PLD",   name: "Prologis",              sector: "Real Estate",       mktCapB:  108 },
  { ticker: "AMT",   name: "American Tower",        sector: "Real Estate",       mktCapB:   92 },
  { ticker: "EQIX",  name: "Equinix",               sector: "Real Estate",       mktCapB:   78 },
  { ticker: "PSA",   name: "Public Storage",        sector: "Real Estate",       mktCapB:   58 },
  { ticker: "DLR",   name: "Digital Realty Trust",  sector: "Real Estate",       mktCapB:   57 },

  // ── Utilities ───────────────────────────────────────────────────────────────
  { ticker: "NEE",   name: "NextEra Energy",        sector: "Utilities",         mktCapB:  158 },
  { ticker: "SO",    name: "Southern Company",      sector: "Utilities",         mktCapB:   92 },
  { ticker: "DUK",   name: "Duke Energy",           sector: "Utilities",         mktCapB:   78 },
  { ticker: "AEP",   name: "American Electric Power",sector: "Utilities",        mktCapB:   58 },
  { ticker: "EXC",   name: "Exelon",                sector: "Utilities",         mktCapB:   42 },
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
  "Real Estate",
  "Utilities",
] as const;

export type UniverseSector = typeof UNIVERSE_SECTORS[number];
