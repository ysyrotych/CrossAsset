// ── Curated superinvestor roster ─────────────────────────────────────────────
// CIKs are VERIFIED against SEC company_tickers / EDGAR company search at ingest
// time — the resolver corrects any mismatch by filer name. Berkshire (1067983)
// is the confident anchor. This file is config, consumed by sec-service ingest.

import type { ManagerType } from "./types";

export type SeedManager = {
  cik: string;
  name: string;
  slug: string;
  manager: string;
  type: ManagerType;
  signatureHolding?: string;
};

export const CURATED_MANAGERS: SeedManager[] = [
  { cik: "1067983", name: "Berkshire Hathaway",        slug: "berkshire-hathaway", manager: "Warren Buffett",       type: "conglomerate", signatureHolding: "AAPL" },
  { cik: "1649339", name: "Scion Asset Management",     slug: "scion",              manager: "Michael Burry",        type: "hedge_fund",   signatureHolding: "PUTS" },
  { cik: "1336528", name: "Pershing Square Capital",    slug: "pershing-square",    manager: "Bill Ackman",          type: "activist",     signatureHolding: "CMG" },
  { cik: "1061768", name: "Baupost Group",              slug: "baupost",            manager: "Seth Klarman",         type: "value",        signatureHolding: "LNG" },
  { cik: "1006438", name: "Appaloosa Management",       slug: "appaloosa",          manager: "David Tepper",         type: "hedge_fund",   signatureHolding: "NVDA" },
  { cik: "1079114", name: "Greenlight Capital",         slug: "greenlight",         manager: "David Einhorn",        type: "hedge_fund",   signatureHolding: "GRBK" },
  { cik: "1536411", name: "Duquesne Family Office",     slug: "duquesne",           manager: "Stanley Druckenmiller",type: "family_office",signatureHolding: "NVDA" },
  { cik: "1040273", name: "Third Point",                slug: "third-point",        manager: "Dan Loeb",             type: "hedge_fund",   signatureHolding: "PCG" },
  { cik: "1167483", name: "Tiger Global Management",    slug: "tiger-global",       manager: "Chase Coleman",        type: "hedge_fund",   signatureHolding: "META" },
  { cik: "1135730", name: "Coatue Management",          slug: "coatue",             manager: "Philippe Laffont",     type: "hedge_fund",   signatureHolding: "NVDA" },
  { cik: "1061165", name: "Lone Pine Capital",          slug: "lone-pine",          manager: "Stephen Mandel",       type: "hedge_fund",   signatureHolding: "MSFT" },
  { cik: "1103804", name: "Viking Global Investors",    slug: "viking-global",      manager: "Andreas Halvorsen",    type: "hedge_fund",   signatureHolding: "AMZN" },
  { cik: "1709323", name: "Himalaya Capital",           slug: "himalaya",           manager: "Li Lu",                type: "value",        signatureHolding: "BAC" },
  { cik: "921669",  name: "Icahn Enterprises",          slug: "icahn",              manager: "Carl Icahn",           type: "activist",     signatureHolding: "IEP" },
  { cik: "949509",  name: "Oaktree Capital",            slug: "oaktree",            manager: "Howard Marks",         type: "value",        signatureHolding: "TORM" },
  { cik: "1418814", name: "ValueAct Capital",           slug: "valueact",           manager: "Mason Morfit",         type: "activist",     signatureHolding: "SPOT" },
];
