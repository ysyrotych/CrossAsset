// ── Institutional Ownership Engine — shared types ────────────────────────────
// Mirrors supabase/migrations/002_institutional.sql

export type HoldingAction = "NEW" | "ADD" | "TRIM" | "EXIT" | "HOLD";
export type PutCall = "NONE" | "PUT" | "CALL";
export type ManagerType =
  | "value" | "hedge_fund" | "quant" | "family_office" | "activist" | "conglomerate";

export type ManagerListItem = {
  cik: string;
  name: string;
  slug: string;
  type: ManagerType;
  isSuperinvestor: boolean;
  aum13f: number;            // dollars
  lastFiledPeriod: string;   // ISO date (quarter-end)
  signatureHolding?: string; // e.g. "AAPL" — for flavor
  manager?: string;          // the human, e.g. "Warren Buffett"
};

export type HoldingRow = {
  ticker: string | null;
  issuer: string;
  shares: number | null;
  value: number;
  pctOfBook: number;
  rank: number;
  action: HoldingAction;
  dShares: number;
  dValue: number;
  dPctBook: number;
  convictionScore: number;   // 0-100
  putCall: PutCall;
  priceChangeSincePeriodEnd?: number; // %
  sharesHistory?: number[];  // last ~6 quarters, oldest → newest
};

export type CloneAlpha = {
  newBuyReturn: number;   // avg % move of NEW+ADD positions since quarter-end
  benchmark: number;      // SPY move over same window
  alpha: number;          // newBuyReturn - benchmark
  hitRate: number;        // % of tracked buys beating SPY
  sampleSize: number;
};

export type ManagerView = {
  manager: ManagerListItem;
  period: string;
  filedDate: string;
  stalenessDays: number;
  totalValue: number;
  holdingsCount: number;
  top10Weight: number;
  turnoverPct: number;
  holdings: HoldingRow[];
  newHighConviction: HoldingRow[];
  cloneAlpha: CloneAlpha;
};

export type InsiderTxn = {
  insiderName: string;
  role: string;
  txnDate: string;
  code: string;              // P, S, A, M, F, G...
  isOpenMarket: boolean;
  shares: number;
  price: number;
  value: number;
};

export type HolderRow = {
  manager: string;
  slug: string;
  action: HoldingAction;
  shares: number;
  value: number;
  dShares: number;
  dValue: number;
  convictionScore: number;
  pctOfBook: number;
};

export type SecurityView = {
  ticker: string;
  issuer: string;
  period: string;
  stalenessDays: number;
  aggregateInstValue: number;
  holderCount: number;
  netShareFlow: number;
  netManagerFlow: number;    // buyers - sellers
  accumulators: HolderRow[];
  distributors: HolderRow[];
  insiderOverlay: InsiderTxn[];
  signalAlignment: "ALIGNED_BULLISH" | "ALIGNED_BEARISH" | "DIVERGENT" | "NEUTRAL";
  alsoBought: { ticker: string; issuer: string; sharedFunds: number }[];
};

export type ConsensusRow = {
  ticker: string;
  issuer: string;
  buyers: number;
  sellers: number;
  newPositions: number;
  fullExits: number;
  newMoney: number;
  netValueFlow: number;
  consensusScore: number;
  topBuyers?: string[];      // manager names, for the "N funds initiated" headline
};

export type SuperinvestorDigest = {
  period: string;
  biggestNewBuys: ConsensusRow[];
  biggestExits: ConsensusRow[];
  managers: ManagerListItem[];
  cloneLeaderboard: { slug: string; name: string; manager: string; alpha: number; hitRate: number }[];
};

// ── Portfolio × Smart Money ──────────────────────────────────────────────────
export type PortfolioRow = {
  ticker: string;
  issuer: string;
  held: boolean;
  holderCount: number;
  buyers: number;
  sellers: number;
  netManagerFlow: number;
  topHolders: string[];
  insiderSignal: "BUY" | "SELL" | "MIXED" | "NONE";
  signalAlignment: SecurityView["signalAlignment"];
};
export type PortfolioView = { period: string; rows: PortfolioRow[] };

// ── Fund comparison ──────────────────────────────────────────────────────────
export type CompareHolding = {
  ticker: string; issuer: string;
  aValue: number; aPct: number; aAction: HoldingAction | null;
  bValue: number; bPct: number; bAction: HoldingAction | null;
};
export type FundCompare = {
  a: ManagerListItem; b: ManagerListItem;
  shared: CompareHolding[];
  onlyA: CompareHolding[];
  onlyB: CompareHolding[];
  overlapPct: number; // % of names shared
};
