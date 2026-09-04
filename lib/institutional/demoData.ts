// ── Demo dataset for the Institutional Ownership Engine ──────────────────────
// Realistic superinvestor 13F books used (a) as the API fallback when Supabase
// is not configured and (b) to make the UI fully explorable out of the box.
// All view objects (Manager / Security / Consensus / Superinvestor) are DERIVED
// from these raw books by the builders below — same shapes the real DB returns.

import type {
  ManagerListItem, ManagerView, HoldingRow, HoldingAction, PutCall,
  SecurityView, HolderRow, ConsensusRow, SuperinvestorDigest, InsiderTxn,
  CloneAlpha, PortfolioView, PortfolioRow, FundCompare, CompareHolding,
} from "./types";
import { CURATED_MANAGERS } from "./seed";

export const DEMO_PERIOD = "2025-06-30";
const FILED = "2025-08-14";
const STALENESS_DAYS = 24;
const SPY_SINCE_QEND = 5.8; // S&P 500 move since quarter-end — clone-alpha benchmark

// deterministic hash → [0,1) for reproducible synthesized history
function seed01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

// Synthesize ~6 quarters of share counts ending at the current holding.
function sharesHistory(shares: number, action: HoldingAction, key: string): number[] {
  const n = 6;
  const noise = () => 0.9 + seed01(key + n) * 0.2;
  if (action === "NEW") return [0, 0, 0, 0, Math.round(shares * 0.55), shares];
  if (action === "EXIT") return [Math.round(shares * 1.6), Math.round(shares * 1.4), Math.round(shares * 1.2), Math.round(shares), Math.round(shares * 0.5), 0];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); // 0..1
    let factor = 1;
    if (action === "ADD") factor = 0.45 + 0.55 * t;       // ramping up
    else if (action === "TRIM") factor = 1.7 - 0.7 * t;    // trending down
    else factor = 0.95 + 0.1 * seed01(key + i);            // HOLD ~ flat
    out.push(Math.round(shares * factor * (i === n - 1 ? 1 : noise())));
  }
  out[n - 1] = shares;
  return out;
}

type RawHolding = {
  ticker: string | null; issuer: string; value: number; shares: number;
  action: HoldingAction; dValue: number; putCall?: PutCall;
};
type RawBook = { slug: string; aum: number; holdings: RawHolding[] };

// Price move since quarter-end (Jun 30 → now) per ticker — for staleness realism
const PRICE_MOVE: Record<string, number> = {
  AAPL: 8.2, NVDA: 21.4, META: 14.7, GOOG: 9.1, GOOGL: 9.0, AMZN: 6.3, MSFT: 5.1,
  BAC: -3.2, AXP: 4.8, KO: 1.1, CVX: -2.4, OXY: -6.8, MCO: 3.3, KHC: -4.1, CB: 2.0,
  BABA: 18.9, JD: 12.2, PDD: -8.4, TSM: 16.1, INTC: -11.2, CMG: -5.6, HLT: 3.9,
  QSR: 1.4, CP: -1.8, HHH: 7.2, NKE: -9.3, PCG: 2.7, COHR: 19.8, TEVA: 6.1,
  WMT: 5.5, SE: 22.3, APO: 4.4, TSLA: 11.6, LNG: 3.1, MOH: -14.7, HCA: 8.8,
  DHR: -2.2, GRBK: 6.6, TORM: -7.1, SPOT: 15.2, IEP: -12.4, CVI: -4.9, DVA: 2.3,
  C: 1.9, KR: 3.4, SIRI: -6.2, VRSN: 4.1,
  LBRDK: 4.7, WBD: -3.5, CLVT: -9.8, VSAT: 5.2, BHF: 2.1, CNXC: -6.4, HPQ: 1.8,
  EA: 7.9, "BRK.B": 3.2, XRX: -8.1, KKR: 9.4, INSP: -4.3, FLUT: 6.8, TMUS: 4.2,
  UNH: -5.7, WDAY: 8.3, VST: 24.6, SBLK: -3.9, DINO: -2.8, LNC: 3.6, EXPE: 5.9,
};

const RAW_BOOKS: RawBook[] = [
  {
    slug: "berkshire-hathaway", aum: 279_000_000_000,
    holdings: [
      { ticker: "AAPL", issuer: "Apple Inc",              value: 69_900_000_000, shares: 300_000_000, action: "TRIM", dValue: -19_600_000_000 },
      { ticker: "AXP",  issuer: "American Express",        value: 41_100_000_000, shares: 151_600_000, action: "HOLD", dValue: 3_200_000_000 },
      { ticker: "BAC",  issuer: "Bank of America",         value: 30_100_000_000, shares: 942_000_000, action: "TRIM", dValue: -8_400_000_000 },
      { ticker: "KO",   issuer: "Coca-Cola Co",            value: 28_700_000_000, shares: 400_000_000, action: "HOLD", dValue: 1_100_000_000 },
      { ticker: "CVX",  issuer: "Chevron Corp",            value: 18_400_000_000, shares: 118_600_000, action: "ADD",  dValue: 2_900_000_000 },
      { ticker: "OXY",  issuer: "Occidental Petroleum",    value: 13_100_000_000, shares: 255_300_000, action: "ADD",  dValue: 1_700_000_000 },
      { ticker: "MCO",  issuer: "Moody's Corp",            value: 11_200_000_000, shares: 24_700_000,  action: "HOLD", dValue: 900_000_000 },
      { ticker: "KHC",  issuer: "Kraft Heinz",             value: 11_000_000_000, shares: 325_600_000, action: "HOLD", dValue: -600_000_000 },
      { ticker: "CB",   issuer: "Chubb Ltd",               value: 7_900_000_000,  shares: 27_000_000,  action: "NEW",  dValue: 7_900_000_000 },
      { ticker: "DVA",  issuer: "DaVita Inc",              value: 5_500_000_000,  shares: 36_000_000,  action: "HOLD", dValue: 300_000_000 },
      { ticker: "KR",   issuer: "Kroger Co",               value: 2_900_000_000,  shares: 50_000_000,  action: "HOLD", dValue: 100_000_000 },
      { ticker: "SIRI", issuer: "Sirius XM Holdings",      value: 2_600_000_000,  shares: 120_000_000, action: "ADD",  dValue: 500_000_000 },
      { ticker: "VRSN", issuer: "VeriSign Inc",            value: 2_600_000_000,  shares: 13_300_000,  action: "HOLD", dValue: 120_000_000 },
      { ticker: "C",    issuer: "Citigroup Inc",           value: 2_400_000_000,  shares: 55_200_000,  action: "TRIM", dValue: -700_000_000 },
    ],
  },
  {
    slug: "scion", aum: 98_000_000,
    holdings: [
      { ticker: "BABA", issuer: "Alibaba Group",           value: 12_400_000, shares: 155_000,   action: "ADD",  dValue: 4_100_000 },
      { ticker: "JD",   issuer: "JD.com Inc",              value: 9_800_000,  shares: 340_000,   action: "HOLD", dValue: 600_000 },
      { ticker: "BABA", issuer: "Alibaba Group — Puts",    value: 11_200_000, shares: 200_000,   action: "NEW",  dValue: 11_200_000, putCall: "PUT" },
      { ticker: "JD",   issuer: "JD.com Inc — Puts",       value: 8_600_000,  shares: 300_000,   action: "NEW",  dValue: 8_600_000,  putCall: "PUT" },
      { ticker: "MOH",  issuer: "Molina Healthcare",       value: 6_300_000,  shares: 21_000,    action: "NEW",  dValue: 6_300_000 },
      { ticker: "HCA",  issuer: "HCA Healthcare",          value: 5_900_000,  shares: 16_000,    action: "NEW",  dValue: 5_900_000 },
      { ticker: "PDD",  issuer: "PDD Holdings",            value: 4_700_000,  shares: 44_000,    action: "EXIT", dValue: -8_200_000 },
    ],
  },
  {
    slug: "pershing-square", aum: 12_100_000_000,
    holdings: [
      { ticker: "CMG",  issuer: "Chipotle Mexican Grill",  value: 2_320_000_000, shares: 42_000_000, action: "HOLD", dValue: 90_000_000 },
      { ticker: "HLT",  issuer: "Hilton Worldwide",        value: 2_010_000_000, shares: 8_800_000,  action: "TRIM", dValue: -410_000_000 },
      { ticker: "QSR",  issuer: "Restaurant Brands Intl",  value: 1_720_000_000, shares: 23_000_000, action: "HOLD", dValue: 40_000_000 },
      { ticker: "GOOG", issuer: "Alphabet Inc (C)",        value: 1_640_000_000, shares: 9_400_000,  action: "ADD",  dValue: 320_000_000 },
      { ticker: "CP",   issuer: "Canadian Pacific Kansas", value: 1_490_000_000, shares: 18_500_000, action: "HOLD", dValue: -30_000_000 },
      { ticker: "NKE",  issuer: "Nike Inc",                value: 1_390_000_000, shares: 18_800_000, action: "NEW",  dValue: 1_390_000_000 },
      { ticker: "HHH",  issuer: "Howard Hughes Holdings",  value: 910_000_000,   shares: 13_400_000, action: "ADD",  dValue: 180_000_000 },
    ],
  },
  {
    slug: "appaloosa", aum: 6_400_000_000,
    holdings: [
      { ticker: "NVDA", issuer: "NVIDIA Corp",             value: 760_000_000, shares: 6_100_000,  action: "ADD",  dValue: 210_000_000 },
      { ticker: "META", issuer: "Meta Platforms",          value: 690_000_000, shares: 960_000,    action: "HOLD", dValue: 40_000_000 },
      { ticker: "AMZN", issuer: "Amazon.com Inc",          value: 640_000_000, shares: 2_900_000,  action: "HOLD", dValue: 30_000_000 },
      { ticker: "MSFT", issuer: "Microsoft Corp",          value: 520_000_000, shares: 1_100_000,  action: "HOLD", dValue: 20_000_000 },
      { ticker: "BABA", issuer: "Alibaba Group",           value: 610_000_000, shares: 7_600_000,  action: "ADD",  dValue: 190_000_000 },
      { ticker: "PDD",  issuer: "PDD Holdings",            value: 480_000_000, shares: 4_500_000,  action: "ADD",  dValue: 120_000_000 },
      { ticker: "GOOGL",issuer: "Alphabet Inc (A)",        value: 430_000_000, shares: 2_400_000,  action: "ADD",  dValue: 90_000_000 },
      { ticker: "INTC", issuer: "Intel Corp",              value: 210_000_000, shares: 9_600_000,  action: "NEW",  dValue: 210_000_000 },
      { ticker: "TSM",  issuer: "Taiwan Semiconductor",    value: 360_000_000, shares: 2_100_000,  action: "ADD",  dValue: 110_000_000 },
    ],
  },
  {
    slug: "duquesne", aum: 3_200_000_000,
    holdings: [
      { ticker: "NVDA", issuer: "NVIDIA Corp",             value: 190_000_000, shares: 1_530_000,  action: "TRIM", dValue: -260_000_000 },
      { ticker: "MSFT", issuer: "Microsoft Corp",          value: 240_000_000, shares: 510_000,    action: "HOLD", dValue: 10_000_000 },
      { ticker: "COHR", issuer: "Coherent Corp",           value: 220_000_000, shares: 2_800_000,  action: "HOLD", dValue: 30_000_000 },
      { ticker: "TEVA", issuer: "Teva Pharmaceutical",     value: 180_000_000, shares: 9_400_000,  action: "HOLD", dValue: 20_000_000 },
      { ticker: "WMT",  issuer: "Walmart Inc",             value: 160_000_000, shares: 1_700_000,  action: "NEW",  dValue: 160_000_000 },
      { ticker: "APO",  issuer: "Apollo Global Mgmt",      value: 140_000_000, shares: 1_050_000,  action: "ADD",  dValue: 50_000_000 },
      { ticker: "TSM",  issuer: "Taiwan Semiconductor",    value: 130_000_000, shares: 760_000,    action: "NEW",  dValue: 130_000_000 },
    ],
  },
  {
    slug: "third-point", aum: 5_300_000_000,
    holdings: [
      { ticker: "PCG",  issuer: "PG&E Corp",               value: 620_000_000, shares: 32_000_000, action: "HOLD", dValue: 30_000_000 },
      { ticker: "AMZN", issuer: "Amazon.com Inc",          value: 540_000_000, shares: 2_450_000,  action: "HOLD", dValue: 20_000_000 },
      { ticker: "TSM",  issuer: "Taiwan Semiconductor",    value: 480_000_000, shares: 2_800_000,  action: "ADD",  dValue: 140_000_000 },
      { ticker: "META", issuer: "Meta Platforms",          value: 420_000_000, shares: 585_000,    action: "HOLD", dValue: 25_000_000 },
      { ticker: "DHR",  issuer: "Danaher Corp",            value: 310_000_000, shares: 1_250_000,  action: "NEW",  dValue: 310_000_000 },
      { ticker: "NVDA", issuer: "NVIDIA Corp",             value: 290_000_000, shares: 2_330_000,  action: "ADD",  dValue: 95_000_000 },
    ],
  },
  {
    slug: "tiger-global", aum: 24_600_000_000,
    holdings: [
      { ticker: "META", issuer: "Meta Platforms",          value: 3_100_000_000, shares: 4_300_000, action: "HOLD", dValue: 180_000_000 },
      { ticker: "MSFT", issuer: "Microsoft Corp",          value: 2_400_000_000, shares: 5_100_000, action: "HOLD", dValue: 90_000_000 },
      { ticker: "NVDA", issuer: "NVIDIA Corp",             value: 2_200_000_000, shares: 17_700_000,action: "ADD",  dValue: 640_000_000 },
      { ticker: "SE",   issuer: "Sea Limited",             value: 1_900_000_000, shares: 13_600_000,action: "ADD",  dValue: 520_000_000 },
      { ticker: "TSM",  issuer: "Taiwan Semiconductor",    value: 1_700_000_000, shares: 9_900_000, action: "ADD",  dValue: 410_000_000 },
      { ticker: "APO",  issuer: "Apollo Global Mgmt",      value: 1_400_000_000, shares: 10_500_000,action: "HOLD", dValue: 60_000_000 },
      { ticker: "AMZN", issuer: "Amazon.com Inc",          value: 1_300_000_000, shares: 5_900_000, action: "HOLD", dValue: 40_000_000 },
      { ticker: "GOOGL",issuer: "Alphabet Inc (A)",        value: 980_000_000,   shares: 5_500_000, action: "ADD",  dValue: 210_000_000 },
    ],
  },
  {
    slug: "coatue", aum: 27_300_000_000,
    holdings: [
      { ticker: "NVDA", issuer: "NVIDIA Corp",             value: 3_400_000_000, shares: 27_400_000,action: "ADD",  dValue: 910_000_000 },
      { ticker: "META", issuer: "Meta Platforms",          value: 2_700_000_000, shares: 3_750_000, action: "HOLD", dValue: 120_000_000 },
      { ticker: "AMZN", issuer: "Amazon.com Inc",          value: 2_300_000_000, shares: 10_400_000,action: "HOLD", dValue: 80_000_000 },
      { ticker: "MSFT", issuer: "Microsoft Corp",          value: 2_100_000_000, shares: 4_450_000, action: "HOLD", dValue: 70_000_000 },
      { ticker: "TSLA", issuer: "Tesla Inc",               value: 1_600_000_000, shares: 5_050_000, action: "NEW",  dValue: 1_600_000_000 },
      { ticker: "TSM",  issuer: "Taiwan Semiconductor",    value: 1_500_000_000, shares: 8_700_000, action: "ADD",  dValue: 380_000_000 },
      { ticker: "SE",   issuer: "Sea Limited",             value: 900_000_000,   shares: 6_400_000, action: "ADD",  dValue: 240_000_000 },
    ],
  },
  {
    slug: "baupost", aum: 4_100_000_000,
    holdings: [
      { ticker: "LNG",   issuer: "Cheniere Energy",         value: 620_000_000, shares: 2_800_000,  action: "HOLD", dValue: 40_000_000 },
      { ticker: "LBRDK", issuer: "Liberty Broadband",       value: 480_000_000, shares: 6_100_000,  action: "ADD",  dValue: 120_000_000 },
      { ticker: "WBD",   issuer: "Warner Bros. Discovery",  value: 410_000_000, shares: 38_000_000, action: "TRIM", dValue: -90_000_000 },
      { ticker: "CLVT",  issuer: "Clarivate Plc",           value: 300_000_000, shares: 44_000_000, action: "HOLD", dValue: 10_000_000 },
      { ticker: "VSAT",  issuer: "Viasat Inc",              value: 260_000_000, shares: 13_500_000, action: "ADD",  dValue: 70_000_000 },
      { ticker: "GOOG",  issuer: "Alphabet Inc (C)",        value: 240_000_000, shares: 1_400_000,  action: "NEW",  dValue: 240_000_000 },
      { ticker: "WMT",   issuer: "Walmart Inc",             value: 180_000_000, shares: 1_900_000,  action: "HOLD", dValue: 5_000_000 },
    ],
  },
  {
    slug: "greenlight", aum: 1_900_000_000,
    holdings: [
      { ticker: "GRBK", issuer: "Green Brick Partners",     value: 420_000_000, shares: 6_900_000,  action: "HOLD", dValue: 20_000_000 },
      { ticker: "BHF",  issuer: "Brighthouse Financial",    value: 210_000_000, shares: 3_900_000,  action: "ADD",  dValue: 50_000_000 },
      { ticker: "CNXC", issuer: "Concentrix Corp",          value: 180_000_000, shares: 3_400_000,  action: "NEW",  dValue: 180_000_000 },
      { ticker: "HPQ",  issuer: "HP Inc",                   value: 160_000_000, shares: 5_500_000,  action: "HOLD", dValue: -10_000_000 },
      { ticker: "LNC",  issuer: "Lincoln National",         value: 140_000_000, shares: 4_300_000,  action: "ADD",  dValue: 40_000_000 },
      { ticker: "DINO", issuer: "HF Sinclair Corp",         value: 120_000_000, shares: 2_700_000,  action: "HOLD", dValue: 5_000_000 },
    ],
  },
  {
    slug: "himalaya", aum: 2_300_000_000,
    holdings: [
      { ticker: "BAC",  issuer: "Bank of America",          value: 620_000_000, shares: 19_400_000, action: "HOLD", dValue: 20_000_000 },
      { ticker: "GOOG", issuer: "Alphabet Inc (C)",         value: 580_000_000, shares: 3_300_000,  action: "HOLD", dValue: 30_000_000 },
      { ticker: "BRK.B",issuer: "Berkshire Hathaway (B)",   value: 520_000_000, shares: 1_150_000,  action: "HOLD", dValue: 10_000_000 },
      { ticker: "AAPL", issuer: "Apple Inc",                value: 340_000_000, shares: 1_460_000,  action: "ADD",  dValue: 90_000_000 },
      { ticker: "EA",   issuer: "Electronic Arts",          value: 240_000_000, shares: 1_600_000,  action: "NEW",  dValue: 240_000_000 },
    ],
  },
  {
    slug: "icahn", aum: 13_800_000_000,
    holdings: [
      { ticker: "IEP",  issuer: "Icahn Enterprises",        value: 10_900_000_000, shares: 660_000_000, action: "HOLD", dValue: 0 },
      { ticker: "CVI",  issuer: "CVR Energy",               value: 1_400_000_000,  shares: 66_000_000,  action: "HOLD", dValue: -40_000_000 },
      { ticker: "XRX",  issuer: "Xerox Holdings",           value: 380_000_000,    shares: 44_000_000,  action: "HOLD", dValue: -20_000_000 },
      { ticker: "BAC",  issuer: "Bank of America",          value: 210_000_000,    shares: 6_600_000,   action: "NEW",  dValue: 210_000_000 },
    ],
  },
  {
    slug: "valueact", aum: 8_200_000_000,
    holdings: [
      { ticker: "SPOT", issuer: "Spotify Technology",       value: 1_400_000_000, shares: 2_100_000,  action: "ADD",  dValue: 320_000_000 },
      { ticker: "KKR",  issuer: "KKR & Co",                 value: 980_000_000,   shares: 8_100_000,  action: "HOLD", dValue: 40_000_000 },
      { ticker: "INSP", issuer: "Inspire Medical Systems",  value: 640_000_000,   shares: 3_400_000,  action: "NEW",  dValue: 640_000_000 },
      { ticker: "META", issuer: "Meta Platforms",           value: 720_000_000,   shares: 1_000_000,  action: "HOLD", dValue: 30_000_000 },
      { ticker: "EXPE", issuer: "Expedia Group",            value: 480_000_000,   shares: 3_500_000,  action: "TRIM", dValue: -110_000_000 },
    ],
  },
  {
    slug: "lone-pine", aum: 14_200_000_000,
    holdings: [
      { ticker: "MSFT", issuer: "Microsoft Corp",           value: 2_100_000_000, shares: 4_450_000,  action: "HOLD", dValue: 80_000_000 },
      { ticker: "META", issuer: "Meta Platforms",           value: 1_900_000_000, shares: 2_640_000,  action: "ADD",  dValue: 420_000_000 },
      { ticker: "AMZN", issuer: "Amazon.com Inc",           value: 1_700_000_000, shares: 7_700_000,  action: "HOLD", dValue: 50_000_000 },
      { ticker: "FLUT", issuer: "Flutter Entertainment",    value: 1_200_000_000, shares: 4_900_000,  action: "ADD",  dValue: 310_000_000 },
      { ticker: "TMUS", issuer: "T-Mobile US",              value: 980_000_000,   shares: 4_100_000,  action: "NEW",  dValue: 980_000_000 },
      { ticker: "TSM",  issuer: "Taiwan Semiconductor",     value: 860_000_000,   shares: 5_000_000,  action: "ADD",  dValue: 220_000_000 },
    ],
  },
  {
    slug: "viking-global", aum: 24_100_000_000,
    holdings: [
      { ticker: "AMZN", issuer: "Amazon.com Inc",           value: 2_400_000_000, shares: 10_900_000, action: "ADD",  dValue: 560_000_000 },
      { ticker: "UNH",  issuer: "UnitedHealth Group",       value: 1_900_000_000, shares: 3_800_000,  action: "HOLD", dValue: -60_000_000 },
      { ticker: "WDAY", issuer: "Workday Inc",              value: 1_500_000_000, shares: 5_800_000,  action: "ADD",  dValue: 380_000_000 },
      { ticker: "TSM",  issuer: "Taiwan Semiconductor",     value: 1_400_000_000, shares: 8_100_000,  action: "ADD",  dValue: 340_000_000 },
      { ticker: "META", issuer: "Meta Platforms",           value: 1_300_000_000, shares: 1_800_000,  action: "HOLD", dValue: 40_000_000 },
      { ticker: "GOOGL",issuer: "Alphabet Inc (A)",         value: 1_100_000_000, shares: 6_200_000,  action: "NEW",  dValue: 1_100_000_000 },
    ],
  },
  {
    slug: "oaktree", aum: 3_100_000_000,
    holdings: [
      { ticker: "TORM", issuer: "Torm Plc",                 value: 480_000_000, shares: 16_000_000, action: "HOLD", dValue: -20_000_000 },
      { ticker: "VST",  issuer: "Vistra Corp",              value: 420_000_000, shares: 2_600_000,  action: "ADD",  dValue: 140_000_000 },
      { ticker: "SBLK", issuer: "Star Bulk Carriers",       value: 260_000_000, shares: 13_000_000, action: "HOLD", dValue: 10_000_000 },
      { ticker: "CVX",  issuer: "Chevron Corp",             value: 180_000_000, shares: 1_160_000,  action: "NEW",  dValue: 180_000_000 },
    ],
  },
];

// ── Insider (Form 4) overlay — open-market P/S is the signal; A/M/F is noise ──
const INSIDERS: Record<string, InsiderTxn[]> = {
  NVDA: [
    { insiderName: "Jensen Huang",   role: "CEO",      txnDate: "2025-08-11", code: "S", isOpenMarket: true,  shares: 225_000, price: 182.4, value: 41_040_000 },
    { insiderName: "Colette Kress",  role: "CFO",      txnDate: "2025-08-04", code: "S", isOpenMarket: true,  shares: 60_000,  price: 178.9, value: 10_734_000 },
    { insiderName: "Mark Stevens",   role: "Director", txnDate: "2025-07-22", code: "S", isOpenMarket: true,  shares: 120_000, price: 171.2, value: 20_544_000 },
  ],
  OXY: [
    { insiderName: "Vicki Hollub",   role: "CEO",      txnDate: "2025-08-06", code: "P", isOpenMarket: true,  shares: 40_000,  price: 44.1,  value: 1_764_000 },
    { insiderName: "Robert Shearer", role: "Director", txnDate: "2025-07-30", code: "P", isOpenMarket: true,  shares: 25_000,  price: 43.6,  value: 1_090_000 },
  ],
  META: [
    { insiderName: "Mark Zuckerberg",role: "CEO",      txnDate: "2025-08-08", code: "S", isOpenMarket: true,  shares: 38_000,  price: 742.0, value: 28_196_000 },
    { insiderName: "Susan Li",       role: "CFO",      txnDate: "2025-07-25", code: "S", isOpenMarket: true,  shares: 9_000,   price: 715.3, value: 6_437_700 },
  ],
  AAPL: [
    { insiderName: "Tim Cook",       role: "CEO",      txnDate: "2025-08-01", code: "S", isOpenMarket: true,  shares: 110_000, price: 231.5, value: 25_465_000 },
    { insiderName: "Luca Maestri",   role: "Director", txnDate: "2025-07-18", code: "S", isOpenMarket: true,  shares: 20_000,  price: 227.0, value: 4_540_000 },
  ],
  GOOGL: [
    { insiderName: "Ruth Porat",     role: "President",txnDate: "2025-08-05", code: "S", isOpenMarket: true,  shares: 15_000,  price: 196.2, value: 2_943_000 },
  ],
  TSLA: [
    { insiderName: "Elon Musk",      role: "CEO",      txnDate: "2025-08-09", code: "P", isOpenMarket: true,  shares: 500_000, price: 316.0, value: 158_000_000 },
  ],
};

// ── Builders ─────────────────────────────────────────────────────────────────

function meta(slug: string): ManagerListItem {
  const s = CURATED_MANAGERS.find((m) => m.slug === slug)!;
  const book = RAW_BOOKS.find((b) => b.slug === slug)!;
  return {
    cik: s.cik, name: s.name, slug: s.slug, type: s.type,
    isSuperinvestor: true, aum13f: book.aum, lastFiledPeriod: DEMO_PERIOD,
    signatureHolding: s.signatureHolding, manager: s.manager,
  };
}

function conviction(pctOfBook: number, rank: number, action: HoldingAction, dPctBook: number): number {
  const sizeFactor = Math.min(pctOfBook / 10, 1);
  const rankFactor = Math.max(0, 11 - rank) / 10;
  const dirMap: Record<HoldingAction, number> = { NEW: 1, ADD: 0.6, HOLD: 0.3, TRIM: 0.1, EXIT: 0 };
  const magnitudeFactor = Math.min(Math.abs(dPctBook) / 3, 1);
  const raw = 40 * sizeFactor + 25 * rankFactor + 20 * dirMap[action] + 15 * magnitudeFactor;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function buildHoldings(book: RawBook): HoldingRow[] {
  const total = book.holdings.reduce((s, h) => s + h.value, 0);
  const ranked = [...book.holdings].sort((a, b) => b.value - a.value);
  return ranked.map((h, i) => {
    const rank = i + 1;
    const pctOfBook = (h.value / total) * 100;
    const dPctBook = (h.dValue / total) * 100;
    const dShares = h.value > 0 ? Math.round(h.shares * (h.dValue / h.value)) : 0;
    return {
      ticker: h.ticker, issuer: h.issuer, shares: h.shares, value: h.value,
      pctOfBook, rank, action: h.action, dShares, dValue: h.dValue, dPctBook,
      convictionScore: conviction(pctOfBook, rank, h.action, dPctBook),
      putCall: h.putCall ?? "NONE",
      priceChangeSincePeriodEnd: h.ticker ? PRICE_MOVE[h.ticker] : undefined,
      sharesHistory: sharesHistory(h.shares, h.action, `${book.slug}-${h.ticker}-${h.putCall ?? ""}`),
    };
  });
}

function cloneAlphaFor(holdings: HoldingRow[]): CloneAlpha {
  const buys = holdings.filter((h) => (h.action === "NEW" || h.action === "ADD") && h.putCall === "NONE" && h.priceChangeSincePeriodEnd != null);
  if (!buys.length) return { newBuyReturn: 0, benchmark: SPY_SINCE_QEND, alpha: -SPY_SINCE_QEND, hitRate: 0, sampleSize: 0 };
  const avg = buys.reduce((s, h) => s + (h.priceChangeSincePeriodEnd ?? 0), 0) / buys.length;
  const wins = buys.filter((h) => (h.priceChangeSincePeriodEnd ?? 0) > SPY_SINCE_QEND).length;
  return {
    newBuyReturn: avg, benchmark: SPY_SINCE_QEND, alpha: avg - SPY_SINCE_QEND,
    hitRate: (wins / buys.length) * 100, sampleSize: buys.length,
  };
}

export function demoManagers(): ManagerListItem[] {
  return RAW_BOOKS.map((b) => meta(b.slug)).sort((a, b) => b.aum13f - a.aum13f);
}

export function demoManagerView(slug: string): ManagerView | null {
  const book = RAW_BOOKS.find((b) => b.slug === slug);
  if (!book) return null;
  const holdings = buildHoldings(book);
  const totalValue = holdings.reduce((s, h) => s + h.value, 0);
  const top10 = holdings.slice(0, 10).reduce((s, h) => s + h.value, 0);
  const churn = holdings.reduce((s, h) => s + Math.abs(h.dValue), 0);
  return {
    manager: meta(slug), period: DEMO_PERIOD, filedDate: FILED, stalenessDays: STALENESS_DAYS,
    totalValue, holdingsCount: holdings.length,
    top10Weight: (top10 / totalValue) * 100,
    turnoverPct: Math.min(100, (churn / (totalValue * 2)) * 100),
    holdings,
    newHighConviction: holdings.filter((h) => h.action === "NEW" && h.convictionScore >= 55),
    cloneAlpha: cloneAlphaFor(holdings),
  };
}

// index of (ticker -> [{manager, holding}]) across all books
function tickerIndex() {
  const idx: Record<string, { m: ManagerListItem; h: HoldingRow }[]> = {};
  for (const book of RAW_BOOKS) {
    const rows = buildHoldings(book);
    const m = meta(book.slug);
    for (const h of rows) {
      if (!h.ticker || h.putCall !== "NONE") continue;
      (idx[h.ticker] ||= []).push({ m, h });
    }
  }
  return idx;
}

export function demoSecurityView(ticker: string): SecurityView | null {
  const idx = tickerIndex();
  const holders = idx[ticker.toUpperCase()];
  if (!holders || !holders.length) return null;
  const issuer = holders[0].h.issuer;
  const toRow = ({ m, h }: { m: ManagerListItem; h: HoldingRow }): HolderRow => ({
    manager: m.name, slug: m.slug, action: h.action, shares: h.shares ?? 0,
    value: h.value, dShares: h.dShares, dValue: h.dValue,
    convictionScore: h.convictionScore, pctOfBook: h.pctOfBook,
  });
  const accumulators = holders.filter(({ h }) => h.action === "NEW" || h.action === "ADD")
    .map(toRow).sort((a, b) => b.dValue - a.dValue);
  const distributors = holders.filter(({ h }) => h.action === "TRIM" || h.action === "EXIT")
    .map(toRow).sort((a, b) => a.dValue - b.dValue);
  const insider = INSIDERS[ticker.toUpperCase()] ?? [];
  const netManagerFlow = accumulators.length - distributors.length;
  const insiderBuy = insider.filter((i) => i.isOpenMarket && i.code === "P").length;
  const insiderSell = insider.filter((i) => i.isOpenMarket && i.code === "S").length;
  const insiderNet = insiderBuy - insiderSell;
  let signalAlignment: SecurityView["signalAlignment"] = "NEUTRAL";
  if (netManagerFlow > 0 && insiderNet > 0) signalAlignment = "ALIGNED_BULLISH";
  else if (netManagerFlow < 0 && insiderNet < 0) signalAlignment = "ALIGNED_BEARISH";
  else if (netManagerFlow !== 0 && insiderNet !== 0) signalAlignment = "DIVERGENT";

  // "Funds buying this also bought…" — co-movement across the holders' other books
  const holderSlugs = new Set(holders.map(({ m }) => m.slug));
  const coCount: Record<string, { issuer: string; n: number }> = {};
  for (const book of RAW_BOOKS) {
    if (!holderSlugs.has(book.slug)) continue;
    for (const h of book.holdings) {
      if (!h.ticker || h.putCall || h.ticker === ticker.toUpperCase()) continue;
      if (!(h.action === "NEW" || h.action === "ADD")) continue;
      (coCount[h.ticker] ||= { issuer: h.issuer, n: 0 }).n += 1;
    }
  }
  const alsoBought = Object.entries(coCount)
    .filter(([, v]) => v.n >= 2)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 6)
    .map(([t, v]) => ({ ticker: t, issuer: v.issuer, sharedFunds: v.n }));

  return {
    ticker: ticker.toUpperCase(), issuer, period: DEMO_PERIOD, stalenessDays: STALENESS_DAYS,
    aggregateInstValue: holders.reduce((s, x) => s + x.h.value, 0),
    holderCount: holders.length,
    netShareFlow: holders.reduce((s, x) => s + x.h.dShares, 0),
    netManagerFlow, accumulators, distributors, insiderOverlay: insider, signalAlignment, alsoBought,
  };
}

export function demoConsensus(): ConsensusRow[] {
  const idx = tickerIndex();
  const rows: ConsensusRow[] = Object.entries(idx).map(([ticker, holders]) => {
    const buyers = holders.filter(({ h }) => h.action === "NEW" || h.action === "ADD");
    const sellers = holders.filter(({ h }) => h.action === "TRIM" || h.action === "EXIT");
    const consensusScore =
      buyers.reduce((s, { h }) => s + h.convictionScore, 0) -
      sellers.reduce((s, { h }) => s + h.convictionScore, 0);
    return {
      ticker, issuer: holders[0].h.issuer,
      buyers: buyers.length, sellers: sellers.length,
      newPositions: holders.filter(({ h }) => h.action === "NEW").length,
      fullExits: holders.filter(({ h }) => h.action === "EXIT").length,
      newMoney: holders.filter(({ h }) => h.action === "NEW").reduce((s, { h }) => s + h.value, 0),
      netValueFlow: holders.reduce((s, { h }) => s + h.dValue, 0),
      consensusScore,
      topBuyers: buyers.sort((a, b) => b.h.convictionScore - a.h.convictionScore).map(({ m }) => m.name).slice(0, 4),
    };
  });
  return rows.sort((a, b) => b.consensusScore - a.consensusScore);
}

export function demoSuperinvestors(): SuperinvestorDigest {
  const consensus = demoConsensus();
  const cloneLeaderboard = RAW_BOOKS.map((b) => {
    const m = meta(b.slug);
    const ca = cloneAlphaFor(buildHoldings(b));
    return { slug: b.slug, name: m.name, manager: m.manager ?? m.name, alpha: ca.alpha, hitRate: ca.hitRate };
  }).filter((x) => x.alpha !== -SPY_SINCE_QEND).sort((a, b) => b.alpha - a.alpha);
  return {
    period: DEMO_PERIOD,
    biggestNewBuys: [...consensus].filter((c) => c.buyers > 0).sort((a, b) => b.newMoney - a.newMoney || b.consensusScore - a.consensusScore).slice(0, 8),
    biggestExits: [...consensus].sort((a, b) => a.netValueFlow - b.netValueFlow).slice(0, 6),
    managers: demoManagers(),
    cloneLeaderboard,
  };
}

// ── Portfolio × Smart Money ──────────────────────────────────────────────────
export function demoPortfolioView(tickers: string[]): PortfolioView {
  const rows: PortfolioRow[] = tickers.map((t) => {
    const sv = demoSecurityView(t);
    if (!sv) {
      return { ticker: t.toUpperCase(), issuer: t.toUpperCase(), held: false, holderCount: 0,
        buyers: 0, sellers: 0, netManagerFlow: 0, topHolders: [], insiderSignal: "NONE", signalAlignment: "NEUTRAL" };
    }
    const insBuy = sv.insiderOverlay.filter((i) => i.isOpenMarket && i.code === "P").length;
    const insSell = sv.insiderOverlay.filter((i) => i.isOpenMarket && i.code === "S").length;
    const insiderSignal: PortfolioRow["insiderSignal"] =
      insBuy && insSell ? "MIXED" : insBuy ? "BUY" : insSell ? "SELL" : "NONE";
    return {
      ticker: sv.ticker, issuer: sv.issuer, held: true, holderCount: sv.holderCount,
      buyers: sv.accumulators.length, sellers: sv.distributors.length, netManagerFlow: sv.netManagerFlow,
      topHolders: [...sv.accumulators, ...sv.distributors].sort((a, b) => b.value - a.value).slice(0, 3).map((h) => h.manager),
      insiderSignal, signalAlignment: sv.signalAlignment,
    };
  });
  // held names first, then by holder count
  rows.sort((a, b) => Number(b.held) - Number(a.held) || b.holderCount - a.holderCount);
  return { period: DEMO_PERIOD, rows };
}

// ── Fund comparison ──────────────────────────────────────────────────────────
export function demoCompare(slugA: string, slugB: string): FundCompare | null {
  const bookA = RAW_BOOKS.find((b) => b.slug === slugA);
  const bookB = RAW_BOOKS.find((b) => b.slug === slugB);
  if (!bookA || !bookB) return null;
  const ha = buildHoldings(bookA).filter((h) => h.ticker && h.putCall === "NONE");
  const hb = buildHoldings(bookB).filter((h) => h.ticker && h.putCall === "NONE");
  const mapA = new Map(ha.map((h) => [h.ticker!, h]));
  const mapB = new Map(hb.map((h) => [h.ticker!, h]));
  const all = new Set([...mapA.keys(), ...mapB.keys()]);
  const shared: CompareHolding[] = [], onlyA: CompareHolding[] = [], onlyB: CompareHolding[] = [];
  for (const t of all) {
    const a = mapA.get(t), b = mapB.get(t);
    const row: CompareHolding = {
      ticker: t, issuer: (a ?? b)!.issuer,
      aValue: a?.value ?? 0, aPct: a?.pctOfBook ?? 0, aAction: a?.action ?? null,
      bValue: b?.value ?? 0, bPct: b?.pctOfBook ?? 0, bAction: b?.action ?? null,
    };
    if (a && b) shared.push(row);
    else if (a) onlyA.push(row);
    else onlyB.push(row);
  }
  shared.sort((x, y) => (y.aValue + y.bValue) - (x.aValue + x.bValue));
  onlyA.sort((x, y) => y.aValue - x.aValue);
  onlyB.sort((x, y) => y.bValue - x.bValue);
  return {
    a: meta(slugA), b: meta(slugB), shared, onlyA, onlyB,
    overlapPct: (shared.length / all.size) * 100,
  };
}
