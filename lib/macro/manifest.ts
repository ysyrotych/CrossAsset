import type { ChartSpec, Section, SectionId } from "./types";

// NBER recession bands (recent) — drawn behind long-history charts
export const RECESSIONS: { start: string; end: string }[] = [
  { start: "1990-07-01", end: "1991-03-01" },
  { start: "2001-03-01", end: "2001-11-01" },
  { start: "2007-12-01", end: "2009-06-01" },
  { start: "2020-02-01", end: "2020-04-01" },
];

const NAVY = "#0c1b38";
const CRIMSON = "#8a1f2b";
const TEAL = "#0e7c86";
const AMBER = "#b7791f";

// ── Chart manifest — every exhibit, mapped to its data series ─────────────────
// source "fred" = live · "yahoo" = live market · "curated" = seeded JSON refreshed monthly
export const CHARTS: ChartSpec[] = [
  // ── Monetary Policy ──
  { id: "fed-funds", section: "monetary-policy", title: "Fed Funds Rate", unit: "%", source: "fred", freq: "d", chartType: "line", series: [{ id: "DFF", transform: "rate" }], startYear: 2000, recession: true, precision: 2 },
  { id: "bank-reserves", section: "monetary-policy", title: "Bank Reserves", unit: "$t", source: "fred", freq: "w", chartType: "area", series: [{ id: "WRESBAL", transform: "level", color: NAVY }], startYear: 2008, precision: 2, note: "Fed flooded banks with trillions of reserves during GFC & COVID" },
  { id: "yield-10y", section: "monetary-policy", title: "U.S. 10-Year Treasury", unit: "%", source: "fred", freq: "d", chartType: "line", series: [{ id: "DGS10", transform: "rate" }], startYear: 2023, precision: 2 },
  { id: "yield-curve-2s10s", section: "monetary-policy", title: "2s10s Treasury Spread", unit: "bps", source: "fred", freq: "d", chartType: "area", series: [{ id: "T10Y2Y", transform: "level" }], startYear: 1990, recession: true, avg: true, precision: 0, note: "value in percentage points" },

  // ── Commodities ──
  { id: "oil-brent", section: "commodities", title: "Oil Prices (Brent)", unit: "$/bbl", source: "fred", freq: "d", chartType: "line", series: [{ id: "DCOILBRENTEU", transform: "level", color: NAVY }], startYear: 2006, recession: true, precision: 0 },
  { id: "gold", section: "commodities", title: "Gold Prices", unit: "$/oz", source: "yahoo", freq: "m", chartType: "line", series: [{ id: "GC=F", transform: "level", color: AMBER }], startYear: 2006, precision: 0 },
  { id: "baltic-dry", section: "commodities", title: "Baltic Dry Index", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "baltic_dry", transform: "level", color: TEAL }], precision: 0 },

  // ── Inflation ──
  { id: "pce", section: "inflation", title: "PCE Inflation", unit: "% y/y", source: "fred", freq: "m", chartType: "multiline", series: [{ id: "PCEPI", label: "Overall", transform: "yoy", color: NAVY }, { id: "PCEPILFE", label: "Core", transform: "yoy", color: CRIMSON }], startYear: 2022, precision: 1 },
  { id: "cpi", section: "inflation", title: "CPI Inflation", unit: "% y/y", source: "fred", freq: "m", chartType: "multiline", series: [{ id: "CPIAUCSL", label: "Overall", transform: "yoy", color: NAVY }, { id: "CPILFESL", label: "Core", transform: "yoy", color: CRIMSON }], startYear: 2022, precision: 1 },
  { id: "ppi", section: "inflation", title: "PPI Final Demand Inflation", unit: "% y/y", source: "fred", freq: "m", chartType: "line", series: [{ id: "PPIFIS", transform: "yoy", color: NAVY }], startYear: 2015, precision: 1 },
  { id: "import-prices", section: "inflation", title: "Import Prices", unit: "index", source: "fred", freq: "m", chartType: "line", series: [{ id: "IR", transform: "level", color: NAVY }], startYear: 2015, precision: 1 },

  // ── Inflation Expectations ──
  { id: "umich-inflexp", section: "inflation-expectations", title: "U-Mich 1-Year Inflation Expectations", unit: "% y/y", source: "fred", freq: "m", chartType: "line", series: [{ id: "MICH", transform: "level", color: NAVY }], startYear: 2015, precision: 1 },
  { id: "tips-10y", section: "inflation-expectations", title: "U.S. 10-Year TIPS", unit: "%", source: "fred", freq: "d", chartType: "line", series: [{ id: "DFII10", transform: "rate" }], startYear: 2015, precision: 2 },
  { id: "nyfed-inflexp", section: "inflation-expectations", title: "NY Fed 1-Year Inflation Expectations", unit: "% y/y", source: "curated", freq: "m", chartType: "line", series: [{ id: "nyfed_1y", transform: "level", color: NAVY }], precision: 1 },

  // ── Labor Market ──
  { id: "claims", section: "labor", title: "Initial Unemployment Claims", unit: "thousands", source: "fred", freq: "w", chartType: "line", series: [{ id: "ICSA", transform: "4wkavg", color: NAVY }], startYear: 2010, recession: true, precision: 0, note: "4-week average" },
  { id: "payrolls", section: "labor", title: "Additions to Payrolls", unit: "thousands", source: "fred", freq: "m", chartType: "bar", series: [{ id: "PAYEMS", transform: "mom", color: NAVY }], startYear: 2018, precision: 0, note: "monthly change" },
  { id: "unrate", section: "labor", title: "Unemployment Rate", unit: "%", source: "fred", freq: "m", chartType: "line", series: [{ id: "UNRATE", transform: "rate", color: NAVY }], startYear: 2000, recession: true, precision: 1 },
  { id: "participation", section: "labor", title: "Labor Force Participation Rate", unit: "%", source: "fred", freq: "m", chartType: "line", series: [{ id: "CIVPART", transform: "rate", color: NAVY }], startYear: 2000, recession: true, precision: 1 },
  { id: "jolts-openings", section: "labor", title: "Job Openings Rate", unit: "%", source: "fred", freq: "m", chartType: "line", series: [{ id: "JTSJOR", transform: "rate", color: NAVY }], startYear: 2001, avg: true, precision: 1 },
  { id: "jolts-quits", section: "labor", title: "Quit Rate", unit: "%", source: "fred", freq: "m", chartType: "line", series: [{ id: "JTSQUR", transform: "rate", color: NAVY }], startYear: 2001, avg: true, precision: 1 },

  // ── Consumer Income & Spending ──
  { id: "real-income", section: "consumer", title: "Real Disposable Income", unit: "% y/y", source: "fred", freq: "m", chartType: "line", series: [{ id: "DSPIC96", transform: "yoy", color: NAVY }], startYear: 2018, precision: 1 },
  { id: "real-pce", section: "consumer", title: "Real Personal Consumption", unit: "% y/y", source: "fred", freq: "m", chartType: "line", series: [{ id: "PCEC96", transform: "yoy", color: NAVY }], startYear: 2018, precision: 1 },
  { id: "retail-sales", section: "consumer", title: "Retail Sales", unit: "% y/y", source: "fred", freq: "m", chartType: "line", series: [{ id: "RSAFS", transform: "yoy", color: NAVY }], startYear: 2018, precision: 1 },
  { id: "auto-sales", section: "consumer", title: "Auto Sales", unit: "million units, SAAR", source: "fred", freq: "m", chartType: "line", series: [{ id: "TOTALSA", transform: "level", color: NAVY }], startYear: 2018, precision: 1 },
  { id: "cc-delinquency", section: "consumer", title: "Credit Card Delinquency Rate", unit: "%", source: "fred", freq: "q", chartType: "line", series: [{ id: "DRCCLACBS", transform: "rate", color: CRIMSON }], startYear: 1991, precision: 2 },

  // ── Housing ──
  { id: "starts", section: "housing", title: "Housing Starts", unit: "millions, SAAR", source: "fred", freq: "m", chartType: "multiline", series: [{ id: "HOUST", label: "Total", transform: "level", color: NAVY }, { id: "HOUST1F", label: "Single-Family", transform: "level", color: CRIMSON }], startYear: 2017, precision: 2, note: "thousands ÷ 1000" },
  { id: "existing-sales", section: "housing", title: "Existing Home Sales", unit: "million, SAAR", source: "fred", freq: "m", chartType: "line", series: [{ id: "EXHOSLUSM495S", transform: "level", color: NAVY }], startYear: 2015, precision: 2 },
  { id: "new-sales", section: "housing", title: "New Single-Family Home Sales", unit: "'000, SAAR", source: "fred", freq: "m", chartType: "line", series: [{ id: "HSN1F", transform: "level", color: NAVY }], startYear: 2015, precision: 0 },
  { id: "mortgage-rate", section: "housing", title: "30-Year Mortgage Rate", unit: "%", source: "fred", freq: "w", chartType: "line", series: [{ id: "MORTGAGE30US", transform: "rate", color: NAVY }], startYear: 2010, precision: 2 },
  { id: "case-shiller", section: "housing", title: "S&P Case-Shiller Home Prices", unit: "% y/y", source: "fred", freq: "m", chartType: "line", series: [{ id: "CSUSHPINSA", transform: "yoy", color: NAVY }], startYear: 2010, precision: 1 },
  { id: "nahb", section: "housing", title: "NAHB Housing Market Index", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "nahb", transform: "level", color: NAVY }], avg: true, precision: 0 },

  // ── Consumer Confidence ──
  { id: "umich-sentiment", section: "confidence", title: "U-Mich Consumer Sentiment", unit: "index", source: "fred", freq: "m", chartType: "line", series: [{ id: "UMCSENT", transform: "level", color: NAVY }], startYear: 2015, recession: true, precision: 1 },
  { id: "conf-board", section: "confidence", title: "Conference Board Consumer Confidence", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "conf_board", transform: "level", color: NAVY }], precision: 1 },

  // ── NFIB (curated) ──
  { id: "nfib-optimism", section: "nfib", title: "Small Business Optimism", unit: "index, SA", source: "curated", freq: "m", chartType: "line", series: [{ id: "nfib_optimism", transform: "level", color: NAVY }], avg: true, precision: 1 },
  { id: "nfib-uncertainty", section: "nfib", title: "Small Business Uncertainty", unit: "index, SA", source: "curated", freq: "m", chartType: "line", series: [{ id: "nfib_uncertainty", transform: "level", color: CRIMSON }], avg: true, precision: 0 },

  // ── ISM Services (curated) ──
  { id: "ism-services", section: "ism-services", title: "ISM Services — Overall", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_services", transform: "level", color: NAVY }], avg: true, precision: 1, note: "50 = expansion/contraction line" },
  { id: "ism-services-neworders", section: "ism-services", title: "ISM Services — New Orders", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_services_neworders", transform: "level", color: TEAL }], precision: 1 },
  { id: "ism-services-prices", section: "ism-services", title: "ISM Services — Prices", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_services_prices", transform: "level", color: AMBER }], precision: 1 },

  // ── ISM Manufacturing (curated) ──
  { id: "ism-mfg", section: "ism-mfg", title: "ISM Manufacturing — Overall", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_mfg", transform: "level", color: NAVY }], avg: true, precision: 1, note: "50 = expansion/contraction line" },
  { id: "ism-mfg-neworders", section: "ism-mfg", title: "ISM Manufacturing — New Orders", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_mfg_neworders", transform: "level", color: TEAL }], precision: 1 },
  { id: "ism-mfg-prices", section: "ism-mfg", title: "ISM Manufacturing — Prices Paid", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_mfg_prices", transform: "level", color: AMBER }], precision: 1 },

  // ── Other Manufacturing ──
  { id: "ind-production", section: "other-mfg", title: "Industrial Production", unit: "index", source: "fred", freq: "m", chartType: "line", series: [{ id: "INDPRO", transform: "level", color: NAVY }], startYear: 2010, recession: true, precision: 1 },
  { id: "capex-orders", section: "other-mfg", title: "Core Capital Goods Orders", unit: "$b", source: "fred", freq: "m", chartType: "line", series: [{ id: "NEWORDER", transform: "level", color: NAVY }], startYear: 2009, precision: 1 },

  // ── Trade ──
  { id: "trade-balance", section: "trade", title: "U.S. Trade Deficit", unit: "$b", source: "fred", freq: "m", chartType: "area", series: [{ id: "BOPGSTB", transform: "level", color: CRIMSON }], startYear: 2016, precision: 1 },
  { id: "dollar", section: "trade", title: "Trade-Weighted U.S. Dollar", unit: "index", source: "fred", freq: "d", chartType: "line", series: [{ id: "DTWEXBGS", transform: "level", color: NAVY }], startYear: 2015, precision: 1 },

  // ── Budget ──
  { id: "budget-balance", section: "budget", title: "U.S. Treasury Budget Balance", unit: "$b", source: "fred", freq: "m", chartType: "area", series: [{ id: "MTSDS133FMS", transform: "level", color: CRIMSON }], startYear: 2016, precision: 0, note: "monthly, NSA" },

  // ── GDP ──
  { id: "gdp-growth", section: "gdp", title: "U.S. GDP Growth", unit: "% q/q SAAR", source: "fred", freq: "q", chartType: "bar", series: [{ id: "A191RL1Q225SBEA", transform: "level", color: NAVY }], startYear: 2015, recession: true, precision: 1 },
  { id: "corp-profits", section: "gdp", title: "Corporate Profits", unit: "$b", source: "fred", freq: "q", chartType: "line", series: [{ id: "CPATAX", transform: "level", color: NAVY }], startYear: 2000, precision: 0 },

  // ── Financial Conditions ──
  { id: "nfci", section: "financial-conditions", title: "Chicago Fed National Financial Conditions Index", unit: "index", source: "fred", freq: "w", chartType: "area", series: [{ id: "NFCI", transform: "level", color: NAVY }], startYear: 2000, recession: true, precision: 2, note: "negative = loose, positive = tight" },

  // ── Financial Market Summary ──
  { id: "hy-oas", section: "summary-markets", title: "High-Yield Credit Spread (ICE BofA OAS)", unit: "bps", source: "fred", freq: "d", chartType: "line", series: [{ id: "BAMLH0A0HYM2", transform: "level", color: CRIMSON }], startYear: 2018, precision: 0, note: "value in percentage points ×100" },
  { id: "vix", section: "summary-markets", title: "VIX Volatility Index", unit: "index", source: "fred", freq: "d", chartType: "line", series: [{ id: "VIXCLS", transform: "level", color: NAVY }], startYear: 2018, avg: true, precision: 1 },
  { id: "move", section: "summary-markets", title: "MOVE Bond Volatility Index", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "move", transform: "level", color: CRIMSON }], avg: true, precision: 1 },

  // ── Loop 1 additions: full ISM component grids (curated) ──
  { id: "ism-services-activity", section: "ism-services", title: "ISM Services — Business Activity", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_services_activity", transform: "level", color: NAVY }], avg: true, precision: 1 },
  { id: "ism-services-backlog", section: "ism-services", title: "ISM Services — Backlog of Orders", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_services_backlog", transform: "level", color: TEAL }], avg: true, precision: 1 },
  { id: "ism-services-employment", section: "ism-services", title: "ISM Services — Employment", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_services_employment", transform: "level", color: NAVY }], avg: true, precision: 1 },
  { id: "ism-services-inventory", section: "ism-services", title: "ISM Services — Inventory", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_services_inventory", transform: "level", color: TEAL }], avg: true, precision: 1 },
  { id: "ism-services-supplier", section: "ism-services", title: "ISM Services — Supplier Deliveries", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_services_supplier", transform: "level", color: NAVY }], avg: true, precision: 1 },
  { id: "ism-services-exports", section: "ism-services", title: "ISM Services — New Export Orders", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_services_exports", transform: "level", color: TEAL }], avg: true, precision: 1 },
  { id: "ism-services-imports", section: "ism-services", title: "ISM Services — Imports", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_services_imports", transform: "level", color: NAVY }], avg: true, precision: 1 },

  { id: "ism-mfg-production", section: "ism-mfg", title: "ISM Manufacturing — Production", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_mfg_production", transform: "level", color: NAVY }], avg: true, precision: 1 },
  { id: "ism-mfg-backlog", section: "ism-mfg", title: "ISM Manufacturing — Backlog of Orders", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_mfg_backlog", transform: "level", color: TEAL }], avg: true, precision: 1 },
  { id: "ism-mfg-employment", section: "ism-mfg", title: "ISM Manufacturing — Employment", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_mfg_employment", transform: "level", color: NAVY }], avg: true, precision: 1 },
  { id: "ism-mfg-inventory", section: "ism-mfg", title: "ISM Manufacturing — Inventory", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_mfg_inventory", transform: "level", color: TEAL }], avg: true, precision: 1 },
  { id: "ism-mfg-vendor", section: "ism-mfg", title: "ISM Manufacturing — Vendor Performance", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_mfg_vendor", transform: "level", color: NAVY }], avg: true, precision: 1 },
  { id: "ism-mfg-exports", section: "ism-mfg", title: "ISM Manufacturing — New Export Orders", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_mfg_exports", transform: "level", color: TEAL }], avg: true, precision: 1 },
  { id: "ism-mfg-imports", section: "ism-mfg", title: "ISM Manufacturing — Imports", unit: "index", source: "curated", freq: "m", chartType: "line", series: [{ id: "ism_mfg_imports", transform: "level", color: NAVY }], avg: true, precision: 1 },

  // ── Loop 1 additions: confident FRED charts ──
  { id: "jolts-hires", section: "labor", title: "Hires Rate", unit: "%", source: "fred", freq: "m", chartType: "line", series: [{ id: "JTSHIR", transform: "rate", color: NAVY }], startYear: 2001, avg: true, precision: 1 },
  { id: "jolts-layoffs", section: "labor", title: "Layoff Rate", unit: "%", source: "fred", freq: "m", chartType: "line", series: [{ id: "JTSLDR", transform: "rate", color: CRIMSON }], startYear: 2001, avg: true, precision: 1 },
  { id: "retail-ex-auto", section: "consumer", title: "Retail Sales ex Autos & Gas", unit: "% y/y", source: "fred", freq: "m", chartType: "line", series: [{ id: "RSFSXMV", transform: "yoy", color: CRIMSON }], startYear: 2018, precision: 1 },
  { id: "mortgage-delinquency", section: "consumer", title: "Mortgage Delinquency Rate", unit: "%", source: "fred", freq: "q", chartType: "line", series: [{ id: "DRSFRMACBS", transform: "rate", color: NAVY }], startYear: 1991, precision: 2 },
  { id: "housing-supply", section: "housing", title: "Months' Supply of New Homes", unit: "months", source: "fred", freq: "m", chartType: "line", series: [{ id: "MSACSR", transform: "level", color: NAVY }], startYear: 2000, avg: true, precision: 1 },
  { id: "affordability", section: "housing", title: "Housing Affordability Index", unit: "index", source: "fred", freq: "m", chartType: "line", series: [{ id: "FIXHAI", transform: "level", color: NAVY }], startYear: 2010, precision: 0 },
  { id: "new-rental", section: "inflation", title: "New Rental Prices vs PCE Housing", unit: "% y/y", source: "curated", freq: "q", chartType: "line", series: [{ id: "new_rental", transform: "level", color: TEAL }], precision: 1, note: "leads PCE housing inflation ~4 quarters" },

  // ── Loop 3: GDP component deep-dive (live FRED, real chained-$ series) ──
  { id: "gdp-consumption", section: "gdp", title: "Real Consumption", unit: "% y/y", source: "fred", freq: "q", chartType: "line", series: [{ id: "PCECC96", transform: "yoy", color: NAVY }], startYear: 2015, recession: true, precision: 1 },
  { id: "gdp-investment", section: "gdp", title: "Real Private Investment", unit: "% y/y", source: "fred", freq: "q", chartType: "line", series: [{ id: "GPDIC1", transform: "yoy", color: NAVY }], startYear: 2015, recession: true, precision: 1 },
  { id: "gdp-residential", section: "gdp", title: "Real Residential Investment", unit: "% y/y", source: "fred", freq: "q", chartType: "line", series: [{ id: "PRFIC1", transform: "yoy", color: TEAL }], startYear: 2015, precision: 1 },
  { id: "gdp-nonres", section: "gdp", title: "Real Nonresidential Investment", unit: "% y/y", source: "fred", freq: "q", chartType: "line", series: [{ id: "PNFIC1", transform: "yoy", color: TEAL }], startYear: 2015, precision: 1 },
  { id: "gdp-government", section: "gdp", title: "Real Government Spending", unit: "% y/y", source: "fred", freq: "q", chartType: "line", series: [{ id: "GCEC1", transform: "yoy", color: CRIMSON }], startYear: 2015, precision: 1 },
  { id: "gdp-exports", section: "gdp", title: "Real Exports vs Imports", unit: "% y/y", source: "fred", freq: "q", chartType: "multiline", series: [{ id: "EXPGSC1", label: "Exports", transform: "yoy", color: NAVY }, { id: "IMPGSC1", label: "Imports", transform: "yoy", color: CRIMSON }], startYear: 2015, precision: 1 },

  // ── Loop 8: additional live FRED breadth ──
  { id: "yield-30y", section: "monetary-policy", title: "U.S. 30-Year Treasury", unit: "%", source: "fred", freq: "d", chartType: "line", series: [{ id: "DGS30", transform: "rate" }], startYear: 2015, precision: 2 },
  { id: "breakeven-10y", section: "inflation-expectations", title: "10-Year Breakeven Inflation", unit: "%", source: "fred", freq: "d", chartType: "line", series: [{ id: "T10YIE", transform: "rate", color: NAVY }], startYear: 2015, precision: 2 },
  { id: "fwd-5y5y", section: "inflation-expectations", title: "5Y5Y Forward Inflation", unit: "%", source: "fred", freq: "d", chartType: "line", series: [{ id: "T5YIFR", transform: "rate", color: TEAL }], startYear: 2015, precision: 2 },
  { id: "saving-rate", section: "consumer", title: "Personal Saving Rate", unit: "%", source: "fred", freq: "m", chartType: "line", series: [{ id: "PSAVERT", transform: "rate", color: NAVY }], startYear: 2015, avg: true, precision: 1 },
  { id: "debt-service", section: "consumer", title: "Household Debt Service Ratio", unit: "%", source: "fred", freq: "q", chartType: "line", series: [{ id: "TDSP", transform: "rate", color: CRIMSON }], startYear: 2000, recession: true, precision: 1 },
  { id: "cap-util", section: "other-mfg", title: "Capacity Utilization", unit: "%", source: "fred", freq: "m", chartType: "line", series: [{ id: "TCU", transform: "rate", color: NAVY }], startYear: 2010, recession: true, avg: true, precision: 1 },

  // ── Loop 17: section depth (all live FRED) ──
  { id: "wti", section: "commodities", title: "WTI Crude Oil", unit: "$/bbl", source: "fred", freq: "d", chartType: "line", series: [{ id: "DCOILWTICO", transform: "level", color: NAVY }], startYear: 2006, recession: true, precision: 0 },
  { id: "natgas", section: "commodities", title: "Henry Hub Natural Gas", unit: "$/MMBtu", source: "fred", freq: "d", chartType: "line", series: [{ id: "DHHNGSP", transform: "level", color: TEAL }], startYear: 2006, precision: 2 },
  { id: "yield-5y", section: "monetary-policy", title: "U.S. 5-Year Treasury", unit: "%", source: "fred", freq: "d", chartType: "line", series: [{ id: "DGS5", transform: "rate" }], startYear: 2015, precision: 2 },
  { id: "empire-state", section: "other-mfg", title: "Empire State Manufacturing", unit: "index", source: "fred", freq: "m", chartType: "line", series: [{ id: "GACDISA066MSFRBNY", transform: "level", color: NAVY }], startYear: 2010, recession: true, precision: 1, note: "real regional Fed survey — ISM proxy" },
  { id: "philly-fed", section: "other-mfg", title: "Philadelphia Fed Manufacturing", unit: "index", source: "fred", freq: "m", chartType: "line", series: [{ id: "GACDFSA066MSFRBPHI", transform: "level", color: TEAL }], startYear: 2010, recession: true, precision: 1, note: "real regional Fed survey — ISM proxy" },
  { id: "debt-gdp", section: "budget", title: "Federal Debt as % of GDP", unit: "%", source: "fred", freq: "q", chartType: "area", series: [{ id: "GFDEGDQ188S", transform: "rate", color: CRIMSON }], startYear: 2000, precision: 1 },
  { id: "nfci-sub", section: "financial-conditions", title: "NFCI Subindexes", unit: "index", source: "fred", freq: "w", chartType: "multiline", series: [{ id: "NFCIRISK", label: "Risk", transform: "level", color: CRIMSON }, { id: "NFCICREDIT", label: "Credit", transform: "level", color: NAVY }, { id: "NFCILEVERAGE", label: "Leverage", transform: "level", color: TEAL }], startYear: 2005, precision: 2 },

  // ── New-loop 1: recession signals (research-driven, live FRED) ──
  { id: "sahm-rule", section: "labor", title: "Sahm Rule Recession Indicator", unit: "pp", source: "fred", freq: "m", chartType: "area", series: [{ id: "SAHMREALTIME", transform: "level", color: CRIMSON }], startYear: 2005, recession: true, refLine: 0.5, precision: 2, note: "≥0.50 has historically signaled recession onset" },
  { id: "recession-prob", section: "financial-conditions", title: "NY Fed 12-Month Recession Probability", unit: "%", source: "fred", freq: "m", chartType: "area", series: [{ id: "RECPROUSM156N", transform: "rate", color: CRIMSON }], startYear: 1990, recession: true, precision: 1, note: "from the 10y-3m Treasury spread" },
];

export const SECTIONS: Section[] = [
  { id: "summary-macro",        title: "Macro Summary",              chartIds: [] },
  { id: "summary-markets",      title: "Financial Market Summary",   chartIds: ["hy-oas", "vix", "move"] },
  { id: "monetary-policy",      title: "Monetary Policy",            chartIds: ["fed-funds", "yield-5y", "yield-10y", "yield-30y", "yield-curve-2s10s", "bank-reserves"] },
  { id: "commodities",          title: "Commodities",                chartIds: ["oil-brent", "wti", "gold", "natgas", "baltic-dry"] },
  { id: "inflation",            title: "Inflation",                  chartIds: ["pce", "cpi", "ppi", "new-rental", "import-prices"] },
  { id: "inflation-expectations", title: "Inflation Expectations",   chartIds: ["umich-inflexp", "nyfed-inflexp", "tips-10y", "breakeven-10y", "fwd-5y5y"] },
  { id: "labor",                title: "Labor Market",               chartIds: ["claims", "payrolls", "unrate", "participation", "jolts-openings", "jolts-hires", "jolts-quits", "jolts-layoffs", "sahm-rule"] },
  { id: "consumer",             title: "Consumer Income & Spending", chartIds: ["real-income", "real-pce", "retail-sales", "retail-ex-auto", "auto-sales", "saving-rate", "cc-delinquency", "mortgage-delinquency", "debt-service"] },
  { id: "housing",              title: "Housing",                    chartIds: ["starts", "existing-sales", "new-sales", "housing-supply", "mortgage-rate", "affordability", "case-shiller", "nahb"] },
  { id: "confidence",           title: "Consumer Confidence",        chartIds: ["umich-sentiment", "conf-board"] },
  { id: "nfib",                 title: "NFIB Small Business",        chartIds: ["nfib-optimism", "nfib-uncertainty"] },
  { id: "ism-services",         title: "ISM Services PMI",           chartIds: ["ism-services", "ism-services-activity", "ism-services-neworders", "ism-services-backlog", "ism-services-employment", "ism-services-prices", "ism-services-inventory", "ism-services-supplier", "ism-services-exports", "ism-services-imports"] },
  { id: "ism-mfg",              title: "ISM Manufacturing PMI",      chartIds: ["ism-mfg", "ism-mfg-production", "ism-mfg-neworders", "ism-mfg-backlog", "ism-mfg-employment", "ism-mfg-prices", "ism-mfg-inventory", "ism-mfg-vendor", "ism-mfg-exports", "ism-mfg-imports"] },
  { id: "other-mfg",            title: "Other Manufacturing",        chartIds: ["ind-production", "cap-util", "capex-orders", "empire-state", "philly-fed"] },
  { id: "trade",                title: "Trade",                      chartIds: ["trade-balance", "dollar"] },
  { id: "budget",               title: "Treasury Budget",            chartIds: ["budget-balance", "debt-gdp"] },
  { id: "gdp",                  title: "GDP",                        chartIds: ["gdp-growth", "gdp-consumption", "gdp-investment", "gdp-residential", "gdp-nonres", "gdp-government", "gdp-exports", "corp-profits"] },
  { id: "financial-conditions", title: "Financial Conditions",       chartIds: ["recession-prob", "nfci", "nfci-sub"] },
];

export const CHART_BY_ID: Record<string, ChartSpec> = Object.fromEntries(CHARTS.map((c) => [c.id, c]));
export const SECTION_TITLE: Record<SectionId, string> = Object.fromEntries(SECTIONS.map((s) => [s.id, s.title])) as Record<SectionId, string>;
