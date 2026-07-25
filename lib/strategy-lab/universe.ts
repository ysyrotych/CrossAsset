// ── Strategy Lab — Investment Universe ───────────────────────────────────────
// ~60 large/mid-cap equities across 9 sectors.
// Includes all DEFAULT_PORTFOLIO equity holdings plus additional candidates.

export type UniverseStock = {
  ticker: string;
  name: string;
  sector: string;
};

export const UNIVERSE: UniverseStock[] = [
  // ── Technology ──────────────────────────────────────────────────────────────
  { ticker: "MSFT",  name: "Microsoft",            sector: "Technology" },
  { ticker: "AAPL",  name: "Apple",                sector: "Technology" },
  { ticker: "NVDA",  name: "NVIDIA",               sector: "Technology" },
  { ticker: "AVGO",  name: "Broadcom",             sector: "Technology" },
  { ticker: "ASML",  name: "ASML Holding",         sector: "Technology" },
  { ticker: "SNPS",  name: "Synopsys",             sector: "Technology" },
  { ticker: "AMD",   name: "Advanced Micro Devices",sector: "Technology" },
  { ticker: "QCOM",  name: "Qualcomm",             sector: "Technology" },
  { ticker: "APH",   name: "Amphenol",             sector: "Technology" },
  { ticker: "FICO",  name: "Fair Isaac",           sector: "Technology" },
  { ticker: "NOW",   name: "ServiceNow",           sector: "Technology" },
  { ticker: "CRM",   name: "Salesforce",           sector: "Technology" },
  { ticker: "ORCL",  name: "Oracle",               sector: "Technology" },

  // ── Communication Services ──────────────────────────────────────────────────
  { ticker: "GOOGL", name: "Alphabet",             sector: "Communication" },
  { ticker: "META",  name: "Meta Platforms",       sector: "Communication" },
  { ticker: "NFLX",  name: "Netflix",              sector: "Communication" },
  { ticker: "SPOT",  name: "Spotify",              sector: "Communication" },
  { ticker: "RDDT",  name: "Reddit",               sector: "Communication" },

  // ── Consumer Discretionary ──────────────────────────────────────────────────
  { ticker: "AMZN",  name: "Amazon",               sector: "Consumer Disc." },
  { ticker: "TSLA",  name: "Tesla",                sector: "Consumer Disc." },
  { ticker: "SHOP",  name: "Shopify",              sector: "Consumer Disc." },
  { ticker: "MCD",   name: "McDonald's",           sector: "Consumer Disc." },
  { ticker: "NKE",   name: "Nike",                 sector: "Consumer Disc." },
  { ticker: "HD",    name: "Home Depot",           sector: "Consumer Disc." },
  { ticker: "SBUX",  name: "Starbucks",            sector: "Consumer Disc." },

  // ── Consumer Staples ────────────────────────────────────────────────────────
  { ticker: "PG",    name: "Procter & Gamble",     sector: "Consumer Staples" },
  { ticker: "KO",    name: "Coca-Cola",            sector: "Consumer Staples" },
  { ticker: "PEP",   name: "PepsiCo",              sector: "Consumer Staples" },
  { ticker: "COST",  name: "Costco",               sector: "Consumer Staples" },
  { ticker: "WMT",   name: "Walmart",              sector: "Consumer Staples" },

  // ── Healthcare ──────────────────────────────────────────────────────────────
  { ticker: "LLY",   name: "Eli Lilly",            sector: "Healthcare" },
  { ticker: "ISRG",  name: "Intuitive Surgical",   sector: "Healthcare" },
  { ticker: "VRTX",  name: "Vertex Pharma",        sector: "Healthcare" },
  { ticker: "UNH",   name: "UnitedHealth",         sector: "Healthcare" },
  { ticker: "ABT",   name: "Abbott Labs",          sector: "Healthcare" },
  { ticker: "TMO",   name: "Thermo Fisher",        sector: "Healthcare" },
  { ticker: "DHR",   name: "Danaher",              sector: "Healthcare" },
  { ticker: "ABBV",  name: "AbbVie",               sector: "Healthcare" },
  { ticker: "JNJ",   name: "Johnson & Johnson",    sector: "Healthcare" },

  // ── Financials ──────────────────────────────────────────────────────────────
  { ticker: "V",     name: "Visa",                 sector: "Financials" },
  { ticker: "BX",    name: "Blackstone",           sector: "Financials" },
  { ticker: "SPGI",  name: "S&P Global",           sector: "Financials" },
  { ticker: "MSCI",  name: "MSCI Inc.",            sector: "Financials" },
  { ticker: "JPM",   name: "JPMorgan Chase",       sector: "Financials" },
  { ticker: "GS",    name: "Goldman Sachs",        sector: "Financials" },
  { ticker: "AXP",   name: "American Express",     sector: "Financials" },
  { ticker: "ICE",   name: "Intercontinental Exch",sector: "Financials" },

  // ── Industrials ─────────────────────────────────────────────────────────────
  { ticker: "TDG",   name: "TransDigm",            sector: "Industrials" },
  { ticker: "AXON",  name: "Axon Enterprise",      sector: "Industrials" },
  { ticker: "HON",   name: "Honeywell",            sector: "Industrials" },
  { ticker: "RTX",   name: "RTX Corp",             sector: "Industrials" },
  { ticker: "CAT",   name: "Caterpillar",          sector: "Industrials" },
  { ticker: "GE",    name: "GE Aerospace",         sector: "Industrials" },

  // ── Energy ──────────────────────────────────────────────────────────────────
  { ticker: "XOM",   name: "ExxonMobil",           sector: "Energy" },
  { ticker: "CVX",   name: "Chevron",              sector: "Energy" },
  { ticker: "COP",   name: "ConocoPhillips",       sector: "Energy" },

  // ── Materials ───────────────────────────────────────────────────────────────
  { ticker: "LIN",   name: "Linde",                sector: "Materials" },
  { ticker: "APD",   name: "Air Products",         sector: "Materials" },
  { ticker: "SHW",   name: "Sherwin-Williams",     sector: "Materials" },
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
