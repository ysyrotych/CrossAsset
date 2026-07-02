"use client";
import { useState, useRef } from "react";
import dynamic from "next/dynamic";
import AppShell from "@/components/layout/AppShell";
import { Search, FileText, AlertTriangle, ChevronDown, ChevronUp, Sparkles, ExternalLink, TrendingUp, Download, BookOpen, MessageCircle, Send, FileDown, Paperclip, X } from "lucide-react";

const PrimerDownloadButton = dynamic(
  () => import("@/components/PrimerDownloadButton").then(m => m.PrimerDownloadButton),
  { ssr: false }
);

const FinancialAnalytics = dynamic(
  () => import("@/components/FinancialAnalytics"),
  { ssr: false }
);

// ── Types ─────────────────────────────────────────────────────────────────────

type FilingSection = { item: string; title: string; text: string; char_count: number };
type FilingData    = { form_type: string; accession: string; filed_date: string; period_of_report: string; sections: FilingSection[]; raw_financials: Record<string, number> };
type CompanyInfo   = { ticker: string; name: string; cik: string; sic: string; sic_description: string };
type SegmentData   = { date: string; data: Record<string, number> };
type KmHistory     = { date: string; pe: number|null; ev_ebitda: number|null; roic: number|null; p_fcf: number|null; current_ratio: number|null; debt_equity: number|null }[];
type GrowthHistory = { date: string; rev_growth: number; eps_growth: number; fcf_growth: number }[];
type EarningsSurprise = { date: string; eps_actual: number|null; eps_est: number|null; surprise_pct: number|null }[];
type AnalystEstimate = { date: string; rev_avg: number|null; eps_avg: number|null; ebitda_avg: number|null; num_analysts: number|null }[];
type PeerComp      = { symbol: string; pe: number|null; ev_ebitda: number|null; p_fcf: number|null; roic: number; net_margin: number }[];
type RecentNews    = { title: string; date: string; summary: string; source: string }[];
type QuarterlyTrendItem = { date: string; revenue?: number; gross_margin_pct?: number; operating_margin_pct?: number; net_margin_pct?: number; eps_diluted?: number; free_cash_flow?: number };
type FmpExtended   = {
  ceo?: string; sector?: string; fmp_industry?: string; country?: string; exchange?: string;
  website?: string; ipo_date?: string; company_description?: string; fmp_rating?: string;
  segments?: SegmentData; geo_segments?: SegmentData;
  km_history?: KmHistory; growth_history?: GrowthHistory;
  earnings_surprises?: EarningsSurprise; analyst_estimates?: AnalystEstimate;
  peer_comparison?: PeerComp; recent_news?: RecentNews;
  quarterly_trends?: QuarterlyTrendItem[];
};
type Payload       = {
  company: CompanyInfo;
  annual: FilingData | null;
  quarterly: FilingData | null;
  xbrl_facts: Record<string, number>;
  history: Record<string, Record<string, number>>;
  quarterly_xbrl: Record<string, number>;
  quarterly_period: string;
  prior_quarter_xbrl: Record<string, number>;
  prior_quarter_period: string;
  fmp_extended?: FmpExtended;
  earnings_transcript?: string;
};

// ── Quick-picks ───────────────────────────────────────────────────────────────

const SUGGESTIONS = ["AAPL","MSFT","NVDA","META","AMZN","GOOGL","TSLA","JPM","BRK-B","V","JNJ","UNH","XOM","WMT","UBER","DUOL","PYPL","HOOD","APLD","CMG"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined, prefix = "", suffix = ""): string {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (suffix === "%") return `${sign}${abs.toFixed(1)}%`;
  if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${sign}${prefix}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3)  return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${abs.toFixed(2)}${suffix}`;
}

function pctColor(v: number | null | undefined): string {
  if (v == null) return "#666";
  return v >= 0 ? "#0d6b45" : "#b42318";
}

// ── Trend Sparkline ───────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 80; const H = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(" ");
  const positive = values[values.length - 1] >= values[0];
  const color = positive ? "#0d6b45" : "#b42318";
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── 5-Year History Table ──────────────────────────────────────────────────────

function cagr(first: number | null, last: number | null, years: number): number | null {
  if (first == null || last == null || first <= 0 || last <= 0 || years <= 0) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

function HistoryTable({ history }: { history: Record<string, Record<string, number>> }) {
  const revData = history.revenue || {};
  const niData  = history.net_income || {};
  const oiData  = history.operating_income || {};
  const cfData  = history.operating_cf || {};
  const gpData  = history.gross_profit || {};

  const allYears = Array.from(new Set([
    ...Object.keys(revData), ...Object.keys(niData),
    ...Object.keys(oiData),  ...Object.keys(cfData),
    ...Object.keys(gpData),
  ])).sort();

  if (!allYears.length) return null;

  const rows: { label: string; data: Record<string, number>; prefix: string }[] = [
    { label: "Revenue",        data: revData, prefix: "$" },
    { label: "Gross Profit",   data: gpData,  prefix: "$" },
    { label: "Operating Inc.", data: oiData,  prefix: "$" },
    { label: "Net Income",     data: niData,  prefix: "$" },
    { label: "Operating CF",   data: cfData,  prefix: "$" },
  ].filter(r => Object.keys(r.data).length > 0);

  if (!rows.length) return null;

  const displayYears = allYears.slice(-5);

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[#0c1b38] flex items-center justify-between">
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/60">5-Year Financial History</p>
        <TrendingUp size={12} className="text-white/40" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px]">
          <thead>
            <tr className="bg-[#f5f6f8] border-b border-[#ebebeb]">
              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[#999] w-36">Metric</th>
              {displayYears.map(y => (
                <th key={y} className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#999]">
                  {y.slice(0, 4)}
                </th>
              ))}
              <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#999] w-16">CAGR</th>
              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#999] w-20">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, data, prefix }, ri) => {
              const vals = displayYears.map(y => data[y] ?? null);
              const sparkVals = vals.filter((v): v is number => v != null);
              const latest = vals[vals.length - 1];
              const prev   = vals.slice(0, -1).reverse().find(v => v != null);
              const first  = vals.find(v => v != null);
              const yoy    = latest != null && prev != null && prev !== 0
                ? ((latest - prev) / Math.abs(prev)) * 100 : null;
              const nYears = sparkVals.length > 1 ? sparkVals.length - 1 : 0;
              const c = cagr(first ?? null, latest ?? null, nYears);

              return (
                <tr key={label} className={`border-b border-[#f0f0f0] last:border-0 ${ri % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}`}>
                  <td className="px-4 py-2.5 text-[11.5px] font-semibold text-[#333]">
                    <div>{label}</div>
                    {yoy != null && (
                      <div className="text-[9.5px] font-medium mt-0.5" style={{ color: pctColor(yoy) }}>
                        {yoy > 0 ? "▲" : "▼"}{Math.abs(yoy).toFixed(1)}% YoY
                      </div>
                    )}
                  </td>
                  {displayYears.map(y => {
                    const v = data[y] ?? null;
                    return (
                      <td key={y} className="px-3 py-2.5 text-right text-[12px] tabular-nums text-[#1a1a1a] font-medium">
                        {v != null ? fmtNum(v, prefix) : <span className="text-[#ddd]">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2.5 text-right text-[10.5px] font-semibold tabular-nums" style={{ color: c != null ? pctColor(c) : "#ddd" }}>
                    {c != null ? `${c > 0 ? "+" : ""}${c.toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {sparkVals.length >= 2 && <Sparkline values={sparkVals} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Financial Statements ─────────────────────────────────────────────────────

type FinRow = {
  key?: string;          // undefined = divider/header row
  label: string;
  indent?: boolean;
  bold?: boolean;
  prefix?: string;
  suffix?: string;
  dynamic?: boolean;
  divider?: boolean;     // section separator line
  header?: boolean;      // section header (no value)
  derived?: string;      // "pct_of_rev:revenue_key" for % of revenue
};

function getPriorYearVal(history: Record<string, Record<string, number>>, key: string): number | null {
  const series = history[key];
  if (!series) return null;
  const years = Object.keys(series).sort();
  if (years.length < 2) return null;
  return series[years[years.length - 2]] ?? null;
}

function YoYBadge({ current, prior }: { current: number; prior: number | null }) {
  if (prior == null || prior === 0) return null;
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  const pos = pct >= 0;
  return (
    <span className="ml-1 text-[9px] font-bold tabular-nums" style={{ color: pos ? "#0d6b45" : "#b42318" }}>
      {pos ? "▲" : "▼"}{Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function FinStmtTable({
  rows,
  facts,
  history = {},
  showPctRev = false,
}: {
  rows: FinRow[];
  facts: Record<string, number>;
  history?: Record<string, Record<string, number>>;
  showPctRev?: boolean;
}) {
  const rev = facts["revenue"];
  return (
    <table className="w-full">
      <colgroup>
        <col className="w-[55%]" />
        {showPctRev && <col className="w-[12%]" />}
        <col />
      </colgroup>
      <tbody>
        {rows.map((row, i) => {
          if (row.divider) return (
            <tr key={i}><td colSpan={showPctRev ? 3 : 2} className="px-0 py-0"><div className="border-t border-[#d8dde8] mx-4 my-0.5" /></td></tr>
          );
          if (row.header) return (
            <tr key={i} className="bg-[#f5f6f8]">
              <td colSpan={showPctRev ? 3 : 2} className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[#0c1b38]">{row.label}</td>
            </tr>
          );
          if (!row.key) return null;
          const val = facts[row.key];
          if (val == null) return null;
          const prior = getPriorYearVal(history, row.key);
          const prefix = row.prefix ?? "$";
          const suffix = row.suffix ?? "";
          const color = row.dynamic ? (val >= 0 ? "#0d6b45" : "#b42318") : "#111";
          const pctRev = showPctRev && rev && rev !== 0 ? (val / rev * 100) : null;
          const isEven = i % 2 === 0;
          return (
            <tr key={row.key} className={`border-b border-[#f0f0f0] last:border-0 ${isEven ? "bg-white" : "bg-[#fafafa]"}`}>
              <td className={`px-4 ${row.indent ? "pl-7" : ""} py-2 text-[11.5px] text-[#444] ${row.bold ? "font-semibold text-[#0a0a0a]" : ""}`}>
                {row.label}
              </td>
              {showPctRev && (
                <td className="px-2 py-2 text-[10.5px] text-right tabular-nums text-[#bbb]">
                  {pctRev != null ? `${pctRev.toFixed(1)}%` : ""}
                </td>
              )}
              <td className={`px-4 py-2 text-right tabular-nums text-[12px] ${row.bold ? "font-bold" : "font-medium"}`} style={{ color }}>
                {fmtNum(val, prefix, suffix)}
                <YoYBadge current={val} prior={prior} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function MarginBadges({ facts, history }: { facts: Record<string, number>; history: Record<string, Record<string, number>> }) {
  type MR = { key: string; label: string; numKey: string; denKey: string };
  const MARGINS: MR[] = [
    { key: "gross_margin_pct",     label: "Gross Margin",     numKey: "gross_profit",     denKey: "revenue" },
    { key: "operating_margin_pct", label: "Operating Margin", numKey: "operating_income", denKey: "revenue" },
    { key: "net_margin_pct",       label: "Net Margin",       numKey: "net_income",       denKey: "revenue" },
  ];
  const available = MARGINS.filter(m => facts[m.key] != null);
  if (!available.length) return null;

  function priorMargin(numKey: string, denKey: string): number | null {
    const ns = history[numKey], ds = history[denKey];
    if (!ns || !ds) return null;
    const yrs = Object.keys(ns).sort().filter(y => ds[y] != null);
    if (yrs.length < 2) return null;
    const py = yrs[yrs.length - 2];
    return ds[py] ? (ns[py] / ds[py]) * 100 : null;
  }

  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      {available.map(({ key, label, numKey, denKey }) => {
        const val = facts[key];
        const prior = priorMargin(numKey, denKey);
        const delta = prior != null ? val - prior : null;
        return (
          <div key={key} className="border border-[#ebebeb] rounded-lg px-4 py-3 bg-white text-center">
            <p className="text-[9px] uppercase tracking-widest text-[#bbb] mb-1">{label}</p>
            <p className="text-[24px] font-bold tabular-nums leading-none" style={{ color: pctColor(val) }}>{fmtNum(val, "", "%")}</p>
            {delta != null && (
              <p className="text-[9.5px] font-semibold mt-1 tabular-nums" style={{ color: delta >= 0 ? "#0d6b45" : "#b42318" }}>
                {delta >= 0 ? "▲" : "▼"}{Math.abs(delta).toFixed(1)} pp YoY
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Statement definitions ─────────────────────────────────────────────────────

const INCOME_STMT: FinRow[] = [
  { header: true,  label: "Revenue" },
  { key: "revenue",           label: "Total Revenue",           bold: true, prefix: "$" },
  { key: "cost_of_revenue",   label: "Cost of Revenue",         indent: true, prefix: "$" },
  { divider: true, label: "" },
  { key: "gross_profit",      label: "Gross Profit",            bold: true, prefix: "$", dynamic: true },
  { header: true, label: "Operating Expenses" },
  { key: "rd_expense",        label: "Research & Development",  indent: true, prefix: "$" },
  { key: "sga_expense",       label: "SG&A",                    indent: true, prefix: "$" },
  { key: "operating_expenses",label: "Total Operating Expenses",indent: true, prefix: "$" },
  { divider: true, label: "" },
  { key: "operating_income",  label: "Operating Income (EBIT)", bold: true, prefix: "$", dynamic: true },
  { key: "ebitda",            label: "EBITDA",                  indent: true, prefix: "$", dynamic: true },
  { header: true, label: "Below the Line" },
  { key: "interest_expense",  label: "Interest Expense",        indent: true, prefix: "$" },
  { key: "pretax_income",     label: "Pre-tax Income",          indent: true, prefix: "$", dynamic: true },
  { key: "income_tax",           label: "Income Tax",                  indent: true, prefix: "$" },
  { key: "effective_tax_rate",   label: "Effective Tax Rate",          indent: true, prefix: "", suffix: "%" },
  { divider: true, label: "" },
  { key: "net_income",           label: "Net Income",                  bold: true, prefix: "$", dynamic: true },
  { header: true, label: "Per Share" },
  { key: "eps_basic",         label: "EPS — Basic",             indent: true, prefix: "$" },
  { key: "eps_diluted",       label: "EPS — Diluted",           indent: true, prefix: "$", bold: true },
  { key: "shares_basic_wtd",  label: "Shares Basic (wtd avg)",  indent: true, prefix: "" },
  { key: "shares_diluted_wtd",label: "Shares Diluted (wtd avg)",indent: true, prefix: "" },
];

const BALANCE_STMT: FinRow[] = [
  { header: true, label: "Current Assets" },
  { key: "cash",                label: "Cash & Equivalents",       indent: true, prefix: "$" },
  { key: "short_term_investments",label:"Short-term Investments",  indent: true, prefix: "$" },
  { key: "accounts_receivable", label: "Accounts Receivable",      indent: true, prefix: "$" },
  { key: "inventory",           label: "Inventories",              indent: true, prefix: "$" },
  { key: "current_assets",      label: "Total Current Assets",     bold: true, prefix: "$" },
  { header: true, label: "Non-Current Assets" },
  { key: "ppe_net",             label: "PP&E (Net)",               indent: true, prefix: "$" },
  { key: "goodwill",            label: "Goodwill",                 indent: true, prefix: "$" },
  { key: "intangibles",         label: "Intangible Assets",        indent: true, prefix: "$" },
  { divider: true, label: "" },
  { key: "total_assets",        label: "Total Assets",             bold: true, prefix: "$" },
  { header: true, label: "Current Liabilities" },
  { key: "accounts_payable",    label: "Accounts Payable",         indent: true, prefix: "$" },
  { key: "current_liabilities", label: "Total Current Liabilities",bold: true, prefix: "$" },
  { header: true, label: "Non-Current Liabilities" },
  { key: "long_term_debt",      label: "Long-Term Debt",           indent: true, prefix: "$" },
  { divider: true, label: "" },
  { key: "total_liabilities",   label: "Total Liabilities",        bold: true, prefix: "$" },
  { header: true, label: "Shareholders' Equity" },
  { key: "retained_earnings",   label: "Retained Earnings",        indent: true, prefix: "$", dynamic: true },
  { key: "equity",              label: "Total Equity",             bold: true, prefix: "$", dynamic: true },
  { key: "shares_outstanding",  label: "Shares Outstanding",       indent: true, prefix: "" },
];

const CASHFLOW_STMT: FinRow[] = [
  { header: true, label: "Operating Activities" },
  { key: "net_income",          label: "Net Income",               indent: true, prefix: "$", dynamic: true },
  { key: "da_expense",          label: "Depreciation & Amortization",indent: true, prefix: "$" },
  { key: "sbc_expense",         label: "Stock-based Compensation", indent: true, prefix: "$" },
  { divider: true, label: "" },
  { key: "operating_cf",        label: "Operating Cash Flow",      bold: true, prefix: "$", dynamic: true },
  { header: true, label: "Investing Activities" },
  { key: "capex",               label: "Capital Expenditures",     indent: true, prefix: "$" },
  { key: "acquisitions",        label: "Acquisitions",             indent: true, prefix: "$" },
  { divider: true, label: "" },
  { key: "investing_cf",        label: "Investing Cash Flow",      bold: true, prefix: "$", dynamic: true },
  { header: true, label: "Financing Activities" },
  { key: "buybacks",            label: "Share Repurchases",        indent: true, prefix: "$" },
  { key: "dividends_paid",      label: "Dividends Paid",           indent: true, prefix: "$" },
  { divider: true, label: "" },
  { key: "financing_cf",        label: "Financing Cash Flow",      bold: true, prefix: "$", dynamic: true },
  { divider: true, label: "" },
  { key: "free_cash_flow",      label: "Free Cash Flow",           bold: true, prefix: "$", dynamic: true },
];

function FinancialStatements({ facts, history }: { facts: Record<string, number>; history: Record<string, Record<string, number>> }) {
  const [tab, setTab] = useState<"income" | "balance" | "cashflow">("income");

  if (!Object.keys(facts).length) return (
    <div className="border border-[#ebebeb] rounded-lg px-5 py-4 bg-[#fafafa]">
      <p className="text-[11.5px] text-[#999]">XBRL financial data unavailable — SEC filing may not include structured data or extraction failed.</p>
    </div>
  );

  const TABS = [
    { id: "income"   as const, label: "Income Statement" },
    { id: "balance"  as const, label: "Balance Sheet" },
    { id: "cashflow" as const, label: "Cash Flow" },
  ];

  return (
    <div className="space-y-5">
      <MarginBadges facts={facts} history={history} />
      <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-[#ebebeb] bg-[#fafafa]">
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-5 py-3 text-[11.5px] font-semibold border-b-2 transition-colors ${
                tab === id
                  ? "border-[#0c1b38] text-[#0c1b38] bg-white"
                  : "border-transparent text-[#888] hover:text-[#444]"
              }`}>
              {label}
            </button>
          ))}
          <div className="flex-1" />
          {tab === "income" && (
            <span className="self-center pr-4 text-[9.5px] text-[#bbb] uppercase tracking-wider">% of Rev shown</span>
          )}
        </div>
        {/* Statement body */}
        <div className="overflow-x-auto">
          {tab === "income"   && <FinStmtTable rows={INCOME_STMT}   facts={facts} history={history} showPctRev />}
          {tab === "balance"  && <FinStmtTable rows={BALANCE_STMT}  facts={facts} />}
          {tab === "cashflow" && <FinStmtTable rows={CASHFLOW_STMT} facts={facts} history={history} />}
        </div>
      </div>
    </div>
  );
}

// ── Section text renderer with search + number highlights ────────────────────

const NUM_RE = /(\$[\d,]+(?:\.\d+)?(?:\s*(?:billion|million|trillion|thousand|B|M|T|K))?|\d+(?:\.\d+)?%|\bfiscal\s+20\d\d\b|\bFY\s*20\d\d\b)/gi;

function highlightText(text: string, query: string): React.ReactNode[] {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns: { re: RegExp; cls: string }[] = [
    ...(query.trim().length > 1 ? [{ re: new RegExp(`(${escape(query.trim())})`, 'gi'), cls: 'bg-yellow-200 text-yellow-900 rounded px-0.5' }] : []),
    { re: NUM_RE, cls: 'text-[#0c1b38] font-semibold' },
  ];

  const parts: { str: string; cls?: string }[] = [{ str: text }];
  for (const { re, cls } of patterns) {
    const next: { str: string; cls?: string }[] = [];
    for (const p of parts) {
      if (p.cls) { next.push(p); continue; }
      const segs = p.str.split(re);
      segs.forEach((seg, i) => {
        if (i % 2 === 1) next.push({ str: seg, cls });
        else if (seg) next.push({ str: seg });
      });
    }
    parts.splice(0, parts.length, ...next);
  }
  return parts.map((p, i) =>
    p.cls ? <mark key={i} className={p.cls} style={{ background: p.cls.includes('yellow') ? undefined : 'none' }}>{p.str}</mark> : p.str
  );
}

function SectionBody({ text, query }: { text: string; query: string }) {
  const cleaned = text
    .replace(/^(ITEM\s+\d+[A-Z]?\s*[\.\-—]+\s*[^\n]*\n)/im, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paragraphs = cleaned.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const lq = query.trim().toLowerCase();
  const visible = lq
    ? paragraphs.filter(p => p.toLowerCase().includes(lq))
    : paragraphs;

  if (!visible.length) return (
    <p className="text-[12px] text-[#bbb] py-6 text-center italic">No paragraphs match "{query}"</p>
  );

  return (
    <div className="space-y-3">
      {lq && <p className="text-[10px] text-[#999] mb-2">{visible.length} matching paragraph{visible.length !== 1 ? "s" : ""}</p>}
      {visible.map((para, i) => {
        const isHeader = para.length < 120 && /^[A-Z\s\d\-—:\.]+$/.test(para) && !para.endsWith(",");
        if (isHeader) return (
          <p key={i} className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#0c1b38] mt-5 first:mt-0 pb-1 border-b border-[#eef0f5]">{para}</p>
        );
        return (
          <p key={i} className="text-[12.5px] text-[#2c2c2c] leading-[1.8]">{highlightText(para, query)}</p>
        );
      })}
    </div>
  );
}

// ── Section viewer ────────────────────────────────────────────────────────────

type SectionTab = { key: string; label: string; src: "annual" | "quarterly"; item: string };

const SECTION_TABS: SectionTab[] = [
  // 10-K sections
  { key: "business",        label: "Business",        src: "annual",    item: "business" },
  { key: "risks",           label: "Risk Factors",    src: "annual",    item: "risks" },
  { key: "cybersecurity",   label: "Cybersecurity",   src: "annual",    item: "cybersecurity" },
  { key: "properties",      label: "Properties",      src: "annual",    item: "properties" },
  { key: "legal",           label: "Legal",           src: "annual",    item: "legal" },
  { key: "mda",             label: "MD&A Annual",     src: "annual",    item: "mda" },
  { key: "quantitative",    label: "Market Risk",     src: "annual",    item: "quantitative" },
  { key: "controls",        label: "Controls 9A",     src: "annual",    item: "controls" },
  { key: "accountant_fees", label: "Acct Fees",       src: "annual",    item: "accountant_fees" },
  // 10-Q sections
  { key: "mda_q",           label: "MD&A (Q)",        src: "quarterly", item: "mda" },
  { key: "q_quantitative",  label: "Market Risk (Q)", src: "quarterly", item: "q_quantitative" },
  { key: "q_controls",      label: "Controls (Q)",    src: "quarterly", item: "q_controls" },
  { key: "q_legal",         label: "Legal (Q)",       src: "quarterly", item: "q_legal" },
];

function SectionViewer({ annual, quarterly, ticker }: {
  annual: FilingData | null;
  quarterly: FilingData | null;
  ticker: string;
}) {
  const [active, setActive] = useState("business");
  const [query, setQuery]   = useState("");
  const [copied, setCopied] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState<Record<string, boolean>>({});

  const tab = SECTION_TABS.find(t => t.key === active) ?? SECTION_TABS[0];
  const filing = tab.src === "annual" ? annual : quarterly;
  const section = filing?.sections.find(s => s.item === tab.item);

  const hasSec = (t: SectionTab) => {
    const f = t.src === "annual" ? annual : quarterly;
    return f?.sections.some(s => s.item === t.item) ?? false;
  };

  function copyText() {
    if (!section) return;
    navigator.clipboard.writeText(section.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function summarize() {
    if (!section || summarizing) return;
    const key = active;
    if (summaries[key]) {
      setShowSummary(s => ({ ...s, [key]: !s[key] }));
      return;
    }
    setSummarizing(key);
    setShowSummary(s => ({ ...s, [key]: true }));
    let text = "";
    try {
      const r = await fetch("/api/summarize-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: section.title, text: section.text, ticker }),
      });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value, { stream: true }).split("\n")) {
          const raw = line.startsWith("data: ") ? line.slice(6).trim() : null;
          if (!raw || raw === "[DONE]") continue;
          try {
            const j = JSON.parse(raw);
            if (j.text) { text += j.text; setSummaries(s => ({ ...s, [key]: text })); }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setSummaries(s => ({ ...s, [key]: `Error: ${e instanceof Error ? e.message : "Unknown"}` }));
    } finally {
      setSummarizing(null);
    }
  }

  const wordCount = section ? section.text.split(/\s+/).filter(Boolean).length : 0;
  const thisSummary = summaries[active];
  const summaryVisible = showSummary[active] !== false && !!thisSummary;

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#0c1b38] flex items-center gap-2">
        <BookOpen size={12} className="text-white/40" />
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/60">Filing Sections</p>
        <span className="ml-auto text-[9px] text-white/30">Full text — all 10-K & 10-Q items</span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[#ebebeb] bg-[#fafafa] overflow-x-auto">
        {SECTION_TABS.map(t => {
          const has = hasSec(t);
          return (
            <button key={t.key}
              onClick={() => { setActive(t.key); setQuery(""); }}
              disabled={!has}
              className={`px-3.5 py-2.5 text-[11px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                active === t.key
                  ? "border-[#0c1b38] text-[#0c1b38] bg-white"
                  : has
                    ? "border-transparent text-[#888] hover:text-[#444]"
                    : "border-transparent text-[#ccc] cursor-not-allowed"
              }`}>
              {t.label}
              {!has && <span className="ml-1 text-[9px] opacity-50">—</span>}
              {summaries[t.key] && <span className="ml-1 text-[8px] text-[#0d6b45] font-bold">✓</span>}
            </button>
          );
        })}
      </div>

      {section ? (
        <>
          {/* Controls */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[#f0f0f0] bg-[#fdfcfc] flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] font-semibold text-[#0a0a0a] truncate">{section.title}</p>
              <p className="text-[9.5px] text-[#bbb] mt-0.5">{wordCount.toLocaleString()} words · {section.char_count.toLocaleString()} chars · full text</p>
            </div>
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#ccc]" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search in section…"
                className="pl-7 pr-3 py-1.5 text-[11px] border border-[#e0e0e0] rounded w-40 focus:outline-none focus:border-[#0c1b38] focus:ring-1 focus:ring-[#0c1b38]/20 placeholder:text-[#ddd]" />
            </div>
            <button onClick={copyText}
              className="text-[10px] font-semibold px-2.5 py-1.5 border border-[#e8e8e8] rounded text-[#666] hover:border-[#0c1b38] hover:text-[#0c1b38] transition-colors shrink-0">
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <button onClick={summarize} disabled={!!summarizing}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10.5px] font-semibold rounded border transition-colors shrink-0 ${
                thisSummary
                  ? "border-[#0d6b45] text-[#0d6b45] bg-[#f0faf5] hover:bg-[#e0f5ea]"
                  : "border-[#0c1b38] text-white bg-[#0c1b38] hover:bg-[#1a3361]"
              } disabled:opacity-50 disabled:cursor-not-allowed`}>
              {summarizing === active
                ? <><span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" /> Summarizing…</>
                : thisSummary
                  ? <><BookOpen size={10}/> {showSummary[active] !== false ? "Hide" : "Show"} Summary</>
                  : <><Sparkles size={10}/> Summarize</>}
            </button>
          </div>

          {/* AI Summary panel */}
          {summaryVisible && thisSummary && (
            <div className="border-b border-[#e8f5ee] bg-[#f8fdf9] px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0d6b45]" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#0d6b45]">AI Section Summary — Claude Analysis</p>
                {summarizing !== active && (
                  <button onClick={() => { setSummaries(s => { const n = { ...s }; delete n[active]; return n; }); }}
                    className="ml-auto text-[9px] text-[#bbb] hover:text-[#888] transition-colors">
                    Regenerate
                  </button>
                )}
              </div>
              <BriefBody text={thisSummary} />
            </div>
          )}

          {/* Full section body — no height cap, full text */}
          <div className="px-5 py-4">
            <SectionBody text={section.text} query={query} />
          </div>
        </>
      ) : (
        <div className="px-5 py-10 text-center">
          <p className="text-[12px] text-[#bbb]">Section not available in this filing.</p>
          <p className="text-[10.5px] text-[#d0d0d0] mt-1">edgartools could not extract this item. Try Business, Risk Factors, or MD&A.</p>
        </div>
      )}
    </div>
  );
}

// ── Financial Ratios Panel ────────────────────────────────────────────────────

type RatioItem = { label: string; value: string; sub?: string; color?: string };

function RatioCard({ label, value, sub, color = "#0a0a0a" }: RatioItem) {
  return (
    <div className="border border-[#ebebeb] rounded-lg px-3 py-2.5 bg-white">
      <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#bbb] mb-1">{label}</p>
      <p className="text-[15px] font-bold tabular-nums leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-[9.5px] text-[#999] mt-0.5">{sub}</p>}
    </div>
  );
}

function FinancialRatios({ facts }: { facts: Record<string, number> }) {
  const f = facts;
  const ratios: RatioItem[] = [];

  // Returns
  const roe = f.net_income != null && f.equity != null && f.equity !== 0
    ? (f.net_income / f.equity * 100) : null;
  const roa = f.net_income != null && f.total_assets != null && f.total_assets !== 0
    ? (f.net_income / f.total_assets * 100) : null;
  const assetTurnover = f.revenue != null && f.total_assets != null && f.total_assets !== 0
    ? (f.revenue / f.total_assets) : null;

  // Liquidity
  const currentRatio = f.current_assets != null && f.current_liabilities != null && f.current_liabilities !== 0
    ? (f.current_assets / f.current_liabilities) : null;
  const netDebt = f.long_term_debt != null && f.cash != null
    ? (f.long_term_debt - f.cash) : null;
  const debtToEquity = f.total_liabilities != null && f.equity != null && f.equity !== 0
    ? (f.total_liabilities / f.equity) : null;

  // Coverage & FCF
  const interestCoverage = f.operating_income != null && f.interest_expense != null && f.interest_expense !== 0
    ? (f.operating_income / f.interest_expense) : null;
  const fcfMargin = f.free_cash_flow != null && f.revenue != null && f.revenue !== 0
    ? (f.free_cash_flow / f.revenue * 100) : null;
  const ebitdaMargin = f.ebitda != null && f.revenue != null && f.revenue !== 0
    ? (f.ebitda / f.revenue * 100) : null;

  // Per share
  const revPerShare = f.revenue != null && f.shares_diluted_wtd != null && f.shares_diluted_wtd !== 0
    ? (f.revenue / f.shares_diluted_wtd) : null;
  const bvPerShare = f.equity != null && f.shares_outstanding != null && f.shares_outstanding !== 0
    ? (f.equity / f.shares_outstanding) : null;
  const fcfPerShare = f.free_cash_flow != null && f.shares_diluted_wtd != null && f.shares_diluted_wtd !== 0
    ? (f.free_cash_flow / f.shares_diluted_wtd) : null;

  if (roe != null)            ratios.push({ label: "Return on Equity",    value: `${roe.toFixed(1)}%`,           color: pctColor(roe) });
  if (roa != null)            ratios.push({ label: "Return on Assets",    value: `${roa.toFixed(1)}%`,           color: pctColor(roa) });
  if (ebitdaMargin != null)   ratios.push({ label: "EBITDA Margin",       value: `${ebitdaMargin.toFixed(1)}%`,  color: pctColor(ebitdaMargin) });
  if (fcfMargin != null)      ratios.push({ label: "FCF Margin",          value: `${fcfMargin.toFixed(1)}%`,     color: pctColor(fcfMargin) });
  if (currentRatio != null)   ratios.push({ label: "Current Ratio",       value: `${currentRatio.toFixed(2)}x`,  color: currentRatio >= 1.5 ? "#0d6b45" : currentRatio >= 1 ? "#b58b00" : "#b42318" });
  if (debtToEquity != null)   ratios.push({ label: "Debt / Equity",       value: `${debtToEquity.toFixed(2)}x`,  color: debtToEquity < 1 ? "#0d6b45" : debtToEquity < 2 ? "#b58b00" : "#b42318" });
  if (netDebt != null)        ratios.push({ label: "Net Debt",            value: fmtNum(netDebt, "$"),            color: netDebt < 0 ? "#0d6b45" : "#b42318", sub: netDebt < 0 ? "net cash position" : undefined });
  if (interestCoverage != null) ratios.push({ label: "Interest Coverage", value: `${interestCoverage.toFixed(1)}x`, color: interestCoverage > 5 ? "#0d6b45" : interestCoverage > 2 ? "#b58b00" : "#b42318" });
  if (assetTurnover != null)  ratios.push({ label: "Asset Turnover",      value: `${assetTurnover.toFixed(2)}x` });
  if (revPerShare != null)    ratios.push({ label: "Revenue / Share",     value: `$${revPerShare.toFixed(2)}` });
  if (bvPerShare != null)     ratios.push({ label: "Book Value / Share",  value: `$${bvPerShare.toFixed(2)}` });
  if (fcfPerShare != null)    ratios.push({ label: "FCF / Share",         value: `$${fcfPerShare.toFixed(2)}`,    color: pctColor(fcfPerShare) });

  if (!ratios.length) return null;

  // DuPont decomposition: ROE = Net Margin × Asset Turnover × Equity Multiplier
  const netMarginPct = f.net_margin_pct;
  const assetTO      = assetTurnover;
  const equityMult   = f.total_assets != null && f.equity != null && f.equity !== 0
    ? f.total_assets / f.equity : null;
  const showDuPont   = netMarginPct != null && assetTO != null && equityMult != null;

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[#0c1b38] flex items-center gap-2">
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/60">Financial Ratios & Quality Metrics</p>
      </div>
      <div className="p-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {ratios.map(r => <RatioCard key={r.label} {...r} />)}
      </div>
      {showDuPont && (
        <div className="border-t border-[#ebebeb] px-4 py-3 bg-[#fafafa]">
          <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#999] mb-2">DuPont ROE Decomposition</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-[#0c1b38]">{roe?.toFixed(1)}% ROE</span>
            <span className="text-[10px] text-[#bbb]">=</span>
            <span className="text-[11px] font-semibold text-[#444]">{netMarginPct!.toFixed(1)}% Net Margin</span>
            <span className="text-[10px] text-[#bbb]">×</span>
            <span className="text-[11px] font-semibold text-[#444]">{assetTO!.toFixed(2)}× Asset Turnover</span>
            <span className="text-[10px] text-[#bbb]">×</span>
            <span className="text-[11px] font-semibold text-[#444]">{equityMult!.toFixed(2)}× Equity Multiplier</span>
            <span className="text-[9px] text-[#bbb] ml-1">
              {equityMult! > 3 ? "— leverage-driven" : netMarginPct! > 20 ? "— margin-driven" : assetTO! > 1.5 ? "— efficiency-driven" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Company Overview Panel ────────────────────────────────────────────────────

function CompanyOverview({ ext, ticker }: { ext: FmpExtended; ticker: string }) {
  const hasMeta = ext.ceo || ext.sector || ext.fmp_industry || ext.country || ext.exchange || ext.ipo_date || ext.website || ext.fmp_rating || ext.company_description;
  if (!hasMeta) return null;

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[#0c1b38] flex items-center gap-2">
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/60">Company Overview</p>
        {ext.fmp_rating && (
          <span className="ml-auto text-[9px] font-bold text-[#60a5fa] border border-[#60a5fa]/30 rounded px-1.5 py-0.5">{ext.fmp_rating}</span>
        )}
      </div>
      <div className="p-4 space-y-3">
        {ext.company_description && (
          <p className="text-[12px] text-[#333] leading-[1.75] border-l-2 border-[#d0d7e8] pl-3">{ext.company_description}</p>
        )}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4 pt-1">
          {ext.ceo && (
            <div>
              <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#bbb]">CEO</p>
              <p className="text-[11.5px] font-semibold text-[#0a0a0a] mt-0.5">{ext.ceo}</p>
            </div>
          )}
          {ext.sector && (
            <div>
              <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#bbb]">Sector</p>
              <p className="text-[11.5px] font-semibold text-[#0a0a0a] mt-0.5">{ext.sector}</p>
            </div>
          )}
          {ext.fmp_industry && (
            <div>
              <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#bbb]">Industry</p>
              <p className="text-[11.5px] font-semibold text-[#0a0a0a] mt-0.5">{ext.fmp_industry}</p>
            </div>
          )}
          {ext.country && (
            <div>
              <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#bbb]">Country</p>
              <p className="text-[11.5px] font-semibold text-[#0a0a0a] mt-0.5">{ext.country}</p>
            </div>
          )}
          {ext.exchange && (
            <div>
              <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#bbb]">Exchange</p>
              <p className="text-[11.5px] font-semibold text-[#0a0a0a] mt-0.5">{ext.exchange}</p>
            </div>
          )}
          {ext.ipo_date && (
            <div>
              <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#bbb]">IPO Date</p>
              <p className="text-[11.5px] font-semibold text-[#0a0a0a] mt-0.5">{ext.ipo_date}</p>
            </div>
          )}
          {ext.website && (
            <div>
              <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#bbb]">Website</p>
              <a href={ext.website.startsWith("http") ? ext.website : `https://${ext.website}`} target="_blank" rel="noopener noreferrer"
                className="text-[11.5px] font-semibold text-[#1a5a8a] hover:underline mt-0.5 block truncate">
                {ext.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Peer Comparison ───────────────────────────────────────────────────────────

function PeerComparison({ peers, ticker }: { peers: PeerComp; ticker: string }) {
  if (!peers.length) return null;
  const fmt1x = (v: number|null) => v == null ? <span className="text-[#ddd]">—</span> : <span>{v.toFixed(1)}x</span>;
  const fmtPct = (v: number|null) => v == null ? <span className="text-[#ddd]">—</span> : <span style={{ color: pctColor(v) }}>{v.toFixed(1)}%</span>;

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[#0c1b38] flex items-center gap-2">
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/60">Peer Comparison</p>
        <span className="ml-auto text-[9px] text-white/30">{peers.length} peers · FMP data</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[580px]">
          <thead>
            <tr className="bg-[#f5f6f8] border-b border-[#ebebeb]">
              <th className="px-4 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-[#999] w-28">Ticker</th>
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">P/E</th>
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">EV/EBITDA</th>
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">P/FCF</th>
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">ROIC</th>
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">Net Margin</th>
            </tr>
          </thead>
          <tbody>
            {peers.map((p, i) => (
              <tr key={p.symbol} className={`border-b border-[#f0f0f0] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} ${p.symbol === ticker ? "ring-1 ring-inset ring-[#0c1b38]/20" : ""}`}>
                <td className="px-4 py-2.5">
                  <span className={`text-[12px] font-bold tabular-nums ${p.symbol === ticker ? "text-[#0c1b38]" : "text-[#1a1a1a]"}`}>{p.symbol}</span>
                  {p.symbol === ticker && <span className="ml-1 text-[8px] font-bold text-[#0c1b38] bg-[#eef1f8] px-1 rounded">SUBJECT</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-medium text-[#0a0a0a]">{fmt1x(p.pe)}</td>
                <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-medium text-[#0a0a0a]">{fmt1x(p.ev_ebitda)}</td>
                <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-medium text-[#0a0a0a]">{fmt1x(p.p_fcf)}</td>
                <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-medium">{fmtPct(p.roic)}</td>
                <td className="px-3 py-2.5 text-right text-[12px] tabular-nums font-medium">{fmtPct(p.net_margin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── News Feed ─────────────────────────────────────────────────────────────────

function NewsFeed({ news }: { news: RecentNews }) {
  if (!news.length) return null;
  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return d?.slice(0, 10) ?? ""; }
  };

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[#0c1b38] flex items-center gap-2">
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/60">Recent News</p>
        <span className="ml-auto text-[9px] text-white/30">{news.length} articles</span>
      </div>
      <div className="divide-y divide-[#f0f0f0]">
        {news.map((item, i) => (
          <div key={i} className="px-4 py-3 hover:bg-[#fafafa] transition-colors">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[12px] font-semibold text-[#0a0a0a] leading-[1.4] flex-1">{item.title}</p>
              <span className="text-[9.5px] text-[#bbb] whitespace-nowrap shrink-0">{fmtDate(item.date)}</span>
            </div>
            {item.summary && (
              <p className="text-[11px] text-[#777] mt-1 leading-[1.55]">{item.summary}</p>
            )}
            {item.source && (
              <p className="text-[9px] text-[#bbb] mt-1 font-medium uppercase tracking-wider">{item.source}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Multiples History ─────────────────────────────────────────────────────────

function MultiplesHistory({ kmHistory }: { kmHistory: KmHistory }) {
  if (!kmHistory.length) return null;
  const recent = kmHistory.slice(-6).reverse();
  const cols: { key: string; label: string; suffix: string }[] = [
    { key: "pe",            label: "P/E",           suffix: "x" },
    { key: "ev_ebitda",     label: "EV/EBITDA",     suffix: "x" },
    { key: "p_fcf",         label: "P/FCF",          suffix: "x" },
    { key: "roic",          label: "ROIC",           suffix: "%" },
    { key: "current_ratio", label: "Current Ratio",  suffix: "x" },
    { key: "debt_equity",   label: "D/E",            suffix: "x" },
  ].filter(c => recent.some(r => r[c.key as keyof KmHistory[number]] != null));

  if (!cols.length) return null;

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[#0c1b38]">
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/60">Historical Multiples</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="bg-[#f5f6f8] border-b border-[#ebebeb]">
              <th className="px-4 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-[#999] w-28">Period</th>
              {cols.map(c => (
                <th key={c.key as string} className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map((row, i) => (
              <tr key={row.date} className={`border-b border-[#f0f0f0] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"} ${i === 0 ? "font-semibold" : ""}`}>
                <td className="px-4 py-2 text-[11px] text-[#333]">{row.date?.slice(0, 7) ?? "—"}</td>
                {cols.map(c => {
                  const v = row[c.key as keyof KmHistory[number]] as number|null;
                  return (
                    <td key={c.key as string} className="px-3 py-2 text-right text-[11.5px] tabular-nums text-[#0a0a0a]">
                      {v != null ? `${v.toFixed(1)}${c.suffix}` : <span className="text-[#ddd]">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Quality Scorecard ─────────────────────────────────────────────────────────

type SignalType = "green" | "yellow" | "red";
type Signal = { label: string; detail: string; type: SignalType };

function QualityScorecard({
  facts,
  history,
  quarterly,
}: {
  facts: Record<string, number>;
  history: Record<string, Record<string, number>>;
  quarterly: Record<string, number>;
}) {
  const f = facts;

  // Revenue CAGR from history
  const revHist = history.revenue ? Object.values(history.revenue) : [];
  const revCAGR = revHist.length >= 2
    ? ((Math.pow(revHist[revHist.length - 1] / revHist[0], 1 / (revHist.length - 1)) - 1) * 100)
    : null;

  // FCF conversion = FCF / Net Income
  const fcfConversion = f.free_cash_flow != null && f.net_income != null && f.net_income > 0
    ? f.free_cash_flow / f.net_income : null;

  // SBC as % revenue
  const sbcPct = f.sbc_expense != null && f.revenue != null && f.revenue > 0
    ? f.sbc_expense / f.revenue * 100 : null;

  // CapEx intensity
  const capexPct = f.capex != null && f.revenue != null && f.revenue > 0
    ? Math.abs(f.capex) / f.revenue * 100 : null;

  // Working capital
  const workingCapital = f.current_assets != null && f.current_liabilities != null
    ? f.current_assets - f.current_liabilities : null;

  // DSO (days sales outstanding)
  const dso = f.accounts_receivable != null && f.revenue != null && f.revenue > 0
    ? f.accounts_receivable / (f.revenue / 365) : null;

  // DIO (days inventory outstanding)
  const dio = f.inventory != null && f.cost_of_revenue != null && f.cost_of_revenue > 0
    ? f.inventory / (f.cost_of_revenue / 365) : null;

  // Revenue run-rate acceleration
  const qRevRunRate = quarterly.revenue != null ? quarterly.revenue * 4 : null;
  const runRateAccel = qRevRunRate != null && f.revenue != null && f.revenue > 0
    ? (qRevRunRate - f.revenue) / f.revenue * 100 : null;

  // Build signals
  const signals: Signal[] = [];

  if (revCAGR != null) {
    if (revCAGR >= 25) signals.push({ label: "Revenue Growth", detail: `${revCAGR.toFixed(0)}% 5Y CAGR — exceptional compounding`, type: "green" });
    else if (revCAGR >= 10) signals.push({ label: "Revenue Growth", detail: `${revCAGR.toFixed(0)}% 5Y CAGR — healthy growth`, type: "green" });
    else if (revCAGR >= 3) signals.push({ label: "Revenue Growth", detail: `${revCAGR.toFixed(0)}% 5Y CAGR — moderate growth`, type: "yellow" });
    else signals.push({ label: "Revenue Growth", detail: `${revCAGR.toFixed(0)}% 5Y CAGR — low/stagnant`, type: "red" });
  }

  if (runRateAccel != null) {
    if (runRateAccel >= 30) signals.push({ label: "Momentum", detail: `MRQ run-rate ${runRateAccel > 0 ? "+" : ""}${runRateAccel.toFixed(0)}% vs last 10-K — strong acceleration`, type: "green" });
    else if (runRateAccel >= 0) signals.push({ label: "Momentum", detail: `MRQ run-rate +${runRateAccel.toFixed(0)}% vs last 10-K`, type: "yellow" });
    else signals.push({ label: "Momentum", detail: `MRQ run-rate ${runRateAccel.toFixed(0)}% vs last 10-K — decelerating`, type: "red" });
  }

  if (f.operating_margin_pct != null) {
    if (f.operating_margin_pct >= 25) signals.push({ label: "Profitability", detail: `${f.operating_margin_pct.toFixed(1)}% operating margin — exceptional`, type: "green" });
    else if (f.operating_margin_pct >= 12) signals.push({ label: "Profitability", detail: `${f.operating_margin_pct.toFixed(1)}% operating margin — solid`, type: "green" });
    else if (f.operating_margin_pct >= 5) signals.push({ label: "Profitability", detail: `${f.operating_margin_pct.toFixed(1)}% operating margin — thin`, type: "yellow" });
    else signals.push({ label: "Profitability", detail: `${f.operating_margin_pct.toFixed(1)}% operating margin — weak/breakeven`, type: "red" });
  }

  if (fcfConversion != null) {
    if (fcfConversion >= 0.9) signals.push({ label: "FCF Quality", detail: `${(fcfConversion * 100).toFixed(0)}% FCF/NI conversion — high quality earnings`, type: "green" });
    else if (fcfConversion >= 0.6) signals.push({ label: "FCF Quality", detail: `${(fcfConversion * 100).toFixed(0)}% FCF/NI conversion — acceptable`, type: "yellow" });
    else signals.push({ label: "FCF Quality", detail: `${(fcfConversion * 100).toFixed(0)}% FCF/NI conversion — earnings not converting to cash`, type: "red" });
  }

  if (f.long_term_debt != null && f.cash != null) {
    const netDebt = f.long_term_debt - f.cash;
    if (netDebt < 0) signals.push({ label: "Balance Sheet", detail: `Net cash position of ${Math.abs(netDebt / 1e9).toFixed(1)}B — fortress balance sheet`, type: "green" });
    else if (f.ebitda != null && f.ebitda > 0) {
      const leverage = netDebt / f.ebitda;
      if (leverage < 1.5) signals.push({ label: "Balance Sheet", detail: `${leverage.toFixed(1)}× Net Debt/EBITDA — manageable leverage`, type: "green" });
      else if (leverage < 3) signals.push({ label: "Balance Sheet", detail: `${leverage.toFixed(1)}× Net Debt/EBITDA — moderate leverage`, type: "yellow" });
      else signals.push({ label: "Balance Sheet", detail: `${leverage.toFixed(1)}× Net Debt/EBITDA — elevated leverage`, type: "red" });
    }
  }

  if (sbcPct != null) {
    if (sbcPct > 15) signals.push({ label: "Dilution Risk", detail: `SBC = ${sbcPct.toFixed(1)}% of revenue — significant shareholder dilution`, type: "red" });
    else if (sbcPct > 6) signals.push({ label: "Dilution Risk", detail: `SBC = ${sbcPct.toFixed(1)}% of revenue — watch for dilution`, type: "yellow" });
    else signals.push({ label: "SBC", detail: `SBC = ${sbcPct.toFixed(1)}% of revenue — contained`, type: "green" });
  }

  if (f.goodwill != null && f.total_assets != null && f.total_assets > 0) {
    const goodwillPct = f.goodwill / f.total_assets * 100;
    if (goodwillPct > 40) signals.push({ label: "Goodwill Risk", detail: `Goodwill = ${goodwillPct.toFixed(0)}% of total assets — M&A heavy, impairment risk`, type: "red" });
    else if (goodwillPct > 20) signals.push({ label: "Goodwill", detail: `Goodwill = ${goodwillPct.toFixed(0)}% of assets — moderate M&A exposure`, type: "yellow" });
  }

  // Accruals ratio (earnings quality): (NI - OCF) / Total Assets
  // Positive = income > cash (potential concern); negative = cash > income (strong quality)
  if (f.net_income != null && f.operating_cf != null && f.total_assets != null && f.total_assets > 0) {
    const accruals = f.net_income - f.operating_cf;
    const accrualsRatio = (accruals / f.total_assets) * 100;
    if (accrualsRatio < -5) signals.push({ label: "Earnings Quality", detail: `Accruals ratio ${accrualsRatio.toFixed(1)}% — cash earnings significantly exceed reported income`, type: "green" });
    else if (accrualsRatio <= 5) signals.push({ label: "Earnings Quality", detail: `Accruals ratio ${accrualsRatio.toFixed(1)}% — income and cash flow aligned`, type: "green" });
    else if (accrualsRatio <= 15) signals.push({ label: "Earnings Quality", detail: `Accruals ratio +${accrualsRatio.toFixed(1)}% — income ahead of cash; monitor closely`, type: "yellow" });
    else signals.push({ label: "Earnings Quality", detail: `Accruals ratio +${accrualsRatio.toFixed(1)}% — significant accruals gap, earnings quality concern`, type: "red" });
  }

  if (!signals.length) return null;

  const colorMap: Record<SignalType, { bg: string; border: string; dot: string; text: string }> = {
    green:  { bg: "#f0faf5", border: "#b7e4c7", dot: "#0d6b45", text: "#0d6b45" },
    yellow: { bg: "#fffbeb", border: "#fde68a", dot: "#b58b00", text: "#92680a" },
    red:    { bg: "#fef2f2", border: "#fca5a5", dot: "#b42318", text: "#b42318" },
  };

  const greens  = signals.filter(s => s.type === "green").length;
  const yellows = signals.filter(s => s.type === "yellow").length;
  const reds    = signals.filter(s => s.type === "red").length;
  const score   = Math.round((greens * 10 + yellows * 5) / signals.length);
  const grade   = score >= 8 ? "A" : score >= 6 ? "B" : score >= 4 ? "C" : "D";
  const gradeColor = grade === "A" ? "#0d6b45" : grade === "B" ? "#1a5a8a" : grade === "C" ? "#b58b00" : "#b42318";

  // Working capital metrics
  const wcMetrics: { label: string; value: string; sub: string }[] = [];
  if (workingCapital != null)
    wcMetrics.push({ label: "Working Capital", value: `$${(workingCapital / 1e9).toFixed(1)}B`, sub: workingCapital > 0 ? "positive" : "deficit" });
  if (dso != null)
    wcMetrics.push({ label: "Days Sales Outstanding", value: `${dso.toFixed(0)}d`, sub: dso < 30 ? "fast collection" : dso < 60 ? "normal" : "slow" });
  if (dio != null)
    wcMetrics.push({ label: "Days Inventory Outstanding", value: `${dio.toFixed(0)}d`, sub: "inventory turns" });
  if (capexPct != null)
    wcMetrics.push({ label: "CapEx Intensity", value: `${capexPct.toFixed(1)}%`, sub: "capex / revenue" });
  if (sbcPct != null)
    wcMetrics.push({ label: "SBC Intensity", value: `${sbcPct.toFixed(1)}%`, sub: "SBC / revenue" });
  if (fcfConversion != null)
    wcMetrics.push({ label: "FCF Conversion", value: `${(fcfConversion * 100).toFixed(0)}%`, sub: "FCF / net income" });

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[#0c1b38] flex items-center justify-between gap-4">
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/60">Quality Scorecard & Signal Flags</p>
        <div className="flex items-center gap-3 text-right">
          <span className="text-[8.5px] font-bold uppercase tracking-widest text-white/30">
            {greens}✓ {yellows}⚠ {reds}✗
          </span>
          <div className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ backgroundColor: gradeColor + "25", color: gradeColor }}>
            Grade {grade}
          </div>
        </div>
      </div>
      {/* Signal flags */}
      <div className="p-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {signals.map((s, i) => {
          const c = colorMap[s.type];
          return (
            <div key={i} className="flex items-start gap-2.5 rounded-md px-3 py-2" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
              <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: c.dot }} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c.dot }}>{s.label}</p>
                <p className="text-[11px] text-[#333] mt-0.5">{s.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
      {/* Working capital efficiency */}
      {wcMetrics.length > 0 && (
        <div className="border-t border-[#ebebeb]">
          <div className="px-4 py-2 bg-[#f8f8f8]">
            <p className="text-[8.5px] font-bold uppercase tracking-widest text-[#999]">Cash Cycle & Efficiency</p>
          </div>
          <div className="grid grid-cols-3 gap-0 sm:grid-cols-6 divide-x divide-[#ebebeb]">
            {wcMetrics.map(m => (
              <div key={m.label} className="px-3 py-3 text-center">
                <p className="text-[8px] font-bold uppercase tracking-widest text-[#bbb] mb-1">{m.label}</p>
                <p className="text-[14px] font-bold text-[#0a0a0a] tabular-nums">{m.value}</p>
                <p className="text-[9px] text-[#aaa] mt-0.5">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quarterly vs Annual Snapshot ──────────────────────────────────────────────

function QuarterlySnapshot({ annual, quarterly, period, priorQuarter, priorPeriod }: {
  annual: Record<string, number>;
  quarterly: Record<string, number>;
  period: string;
  priorQuarter: Record<string, number>;
  priorPeriod: string;
}) {
  if (!Object.keys(quarterly).length) return null;

  const ROWS: { key: string; label: string; prefix?: string; suffix?: string }[] = [
    { key: "revenue",              label: "Revenue",          prefix: "$" },
    { key: "gross_margin_pct",     label: "Gross Margin",     suffix: "%" },
    { key: "operating_income",     label: "Operating Income", prefix: "$" },
    { key: "operating_margin_pct", label: "Op. Margin",       suffix: "%" },
    { key: "net_income",           label: "Net Income",       prefix: "$" },
    { key: "net_margin_pct",       label: "Net Margin",       suffix: "%" },
    { key: "operating_cf",         label: "Operating CF",     prefix: "$" },
    { key: "free_cash_flow",       label: "Free Cash Flow",   prefix: "$" },
    { key: "eps_diluted",          label: "EPS (Diluted)",    prefix: "$" },
  ].filter(r => quarterly[r.key] != null);

  if (!ROWS.length) return null;

  const hasQoQ = Object.keys(priorQuarter).length > 0;

  const annualizedQ = (key: string, val: number) => {
    if (["revenue","gross_profit","operating_income","net_income","operating_cf","free_cash_flow","rd_expense","sga_expense"].includes(key))
      return val * 4;
    return null;
  };

  const shortDate = (d: string) => d ? d.slice(0, 7) : "Prev Q";

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[#0c1b38] flex items-center justify-between">
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/60">
          Most Recent Quarter vs Annual — {period || "Latest Quarter"}
        </p>
        <p className="text-[9px] text-white/40 uppercase tracking-wider">Single quarter | ×4 implied annual</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-[#f5f6f8] border-b border-[#ebebeb]">
              <th className="px-4 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-[#999] w-40">Metric</th>
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">{shortDate(period)} MRQ</th>
              {hasQoQ && <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">{shortDate(priorPeriod)}</th>}
              {hasQoQ && <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">QoQ</th>}
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">Implied Ann.</th>
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">Annual (10-K)</th>
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">vs Annual</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, label, prefix = "", suffix = "" }, i) => {
              const qVal  = quarterly[key];
              const pqVal = priorQuarter[key] ?? null;
              const aVal  = annual[key];
              const implied = annualizedQ(key, qVal);
              const vsAnnual = aVal != null && aVal !== 0 && implied != null
                ? ((implied - aVal) / Math.abs(aVal)) * 100 : null;
              const qoq = pqVal != null && pqVal !== 0
                ? ((qVal - pqVal) / Math.abs(pqVal)) * 100 : null;
              const isEven  = i % 2 === 0;
              const isMargin = suffix === "%";

              const pctSpan = (val: number | null) => val == null
                ? <span className="text-[#ddd]">—</span>
                : <span style={{ color: val >= 0 ? "#0d6b45" : "#b42318" }} className="font-semibold">{val >= 0 ? "▲" : "▼"}{Math.abs(val).toFixed(1)}%</span>;

              return (
                <tr key={key} className={`border-b border-[#f0f0f0] last:border-0 ${isEven ? "bg-white" : "bg-[#fafafa]"}`}>
                  <td className="px-4 py-2 text-[11.5px] font-semibold text-[#333]">{label}</td>
                  <td className="px-3 py-2 text-right text-[12px] font-bold tabular-nums text-[#0a0a0a]">
                    {fmtNum(qVal, prefix, suffix)}
                  </td>
                  {hasQoQ && (
                    <td className="px-3 py-2 text-right text-[11.5px] tabular-nums text-[#888]">
                      {pqVal != null ? fmtNum(pqVal, prefix, suffix) : "—"}
                    </td>
                  )}
                  {hasQoQ && (
                    <td className="px-3 py-2 text-right text-[11px] tabular-nums">{pctSpan(qoq)}</td>
                  )}
                  <td className="px-3 py-2 text-right text-[11.5px] tabular-nums text-[#888]">
                    {!isMargin && implied != null ? fmtNum(implied, prefix) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-[11.5px] tabular-nums text-[#555]">
                    {aVal != null ? fmtNum(aVal, prefix, suffix) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] tabular-nums">{pctSpan(vsAnnual)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Markdown renderer for AI output ──────────────────────────────────────────

function BriefBody({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  const inline = (s: string, k: number): React.ReactNode => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return <span key={k}>{parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} className="font-semibold text-[#0a0a0a]">{p.slice(2, -2)}</strong>
        : p
    )}</span>;
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { nodes.push(<div key={i} className="h-2" />); return; }
    if (t.startsWith("**") && t.endsWith("**") && !t.slice(2, -2).includes("**")) {
      nodes.push(<p key={i} className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#0c1b38] mt-5 mb-2 first:mt-0">{t.slice(2, -2)}</p>);
    } else if (t.startsWith("• ") || t.startsWith("- ")) {
      nodes.push(<div key={i} className="flex items-start gap-2 py-0.5"><span className="w-1 h-1 rounded-full bg-[#0c1b38] mt-[7px] shrink-0" /><p className="text-[12.5px] text-[#333] leading-[1.7]">{inline(t.slice(2), i)}</p></div>);
    } else if (/^\d+\.\s/.test(t)) {
      const num = t.match(/^(\d+)\./)?.[1] ?? "";
      nodes.push(<div key={i} className="flex items-start gap-2.5 py-0.5"><span className="text-[10px] font-bold text-[#0c1b38] mt-[3px] w-4 shrink-0">{num}.</span><p className="text-[12.5px] text-[#333] leading-[1.7]">{inline(t.replace(/^\d+\.\s*/, ""), i)}</p></div>);
    } else {
      nodes.push(<p key={i} className="text-[12.5px] text-[#1a1a1a] leading-[1.8]">{inline(t, i)}</p>);
    }
  });
  return <div className="space-y-[2px]">{nodes}</div>;
}

// ── Excel Export ─────────────────────────────────────────────────────────────

async function downloadExcel(
  ticker: string,
  companyName: string,
  facts: Record<string, number>,
  history: Record<string, Record<string, number>>,
  quarterly: Record<string, number>,
  quarterlyPeriod: string
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Numbers in millions — standard for financial models
  const M = (v: number | null | undefined): number | string =>
    v != null ? Math.round(v / 1e3) / 1e3 : "";  // → stored as billions float; use 1e6 for millions
  const toM = (v: number | null | undefined): number | string =>
    v != null ? parseFloat((v / 1e6).toFixed(1)) : "";
  const toPct = (v: number | null | undefined): number | string =>
    v != null ? parseFloat(v.toFixed(1)) : "";

  // Derive revenue history — try direct, then GP+COGS
  const getRevHist = (yr: string): number | undefined => {
    const direct = history.revenue?.[yr];
    if (direct != null) return direct;
    const gp = history.gross_profit?.[yr];
    const cogs = history.cost_of_revenue?.[yr];
    if (gp != null && cogs != null) return gp + cogs;
    return undefined;
  };

  // Compute gross profit from history if not direct
  const getGPHist = (yr: string): number | undefined => {
    const direct = history.gross_profit?.[yr];
    if (direct != null) return direct;
    const rev = getRevHist(yr);
    const cogs = history.cost_of_revenue?.[yr];
    if (rev != null && cogs != null) return rev - cogs;
    return undefined;
  };

  // Years: union of all available years from history
  const allYears = Array.from(new Set([
    ...Object.keys(history.revenue ?? {}),
    ...Object.keys(history.net_income ?? {}),
    ...Object.keys(history.operating_income ?? {}),
    ...Object.keys(history.cost_of_revenue ?? {}),
    ...Object.keys(history.gross_profit ?? {}),
    ...Object.keys(history.operating_cf ?? {}),
    ...Object.keys(history.free_cash_flow ?? {}),
  ])).sort().slice(-5);

  const yoy = (curr?: number, prev?: number): number | string => {
    if (curr == null || prev == null || prev === 0) return "";
    return parseFloat(((curr - prev) / Math.abs(prev) * 100).toFixed(1));
  };

  const setCell = (ws: Record<string, unknown>, addr: string, v: unknown, numFmt?: string) => {
    const cell: Record<string, unknown> = { v, t: typeof v === "number" ? "n" : "s" };
    if (numFmt) cell.z = numFmt;
    ws[addr] = cell;
  };

  // ── Income Statement ──────────────────────────────────────────────────────────
  const fy = allYears;
  const isRows: (string | number | "")[][] = [];

  isRows.push([`${companyName} (${ticker}) — INCOME STATEMENT`, "", "", "", "", "", "", "", ""]);
  isRows.push(["$ in Millions", ...fy.map(y => `FY${y.slice(0,4)}`), `MRQ ${quarterlyPeriod.slice(0,7)}`, "% Rev (FY)", "Notes"]);
  isRows.push([""]);

  // Revenue
  const revVals = fy.map(yr => toM(getRevHist(yr)));
  isRows.push(["Revenue", ...revVals, toM(quarterly.revenue), "100.0%", ""]);
  isRows.push(["  YoY Revenue Growth", ...fy.map((yr, i) => {
    if (i === 0) return "";
    return yoy(getRevHist(yr), getRevHist(fy[i-1]));
  }), "", "", "(%)"]);

  isRows.push([""]);

  // COGS & GP
  isRows.push(["Cost of Revenue", ...fy.map(yr => toM(history.cost_of_revenue?.[yr])),
    toM(quarterly.cost_of_revenue),
    facts.revenue && facts.cost_of_revenue ? toPct(facts.cost_of_revenue / facts.revenue * 100) : "", ""]);
  isRows.push(["Gross Profit", ...fy.map(yr => toM(getGPHist(yr))),
    toM(quarterly.gross_profit),
    toPct(facts.gross_margin_pct), ""]);
  isRows.push(["  Gross Margin %", ...fy.map(yr => {
    const gp = getGPHist(yr); const rev = getRevHist(yr);
    return (gp != null && rev && rev > 0) ? toPct(gp / rev * 100) : "";
  }), toPct(quarterly.gross_margin_pct), toPct(facts.gross_margin_pct), "(margin, %)"]);

  isRows.push([""]);

  // OpEx
  isRows.push(["R&D Expense", ...fy.map(yr => toM(history.rd_expense?.[yr])),
    toM(quarterly.rd_expense),
    facts.revenue && facts.rd_expense ? toPct(facts.rd_expense / facts.revenue * 100) : "", ""]);
  isRows.push(["SG&A Expense", ...fy.map(yr => toM(history.sga_expense?.[yr])),
    toM(quarterly.sga_expense),
    facts.revenue && facts.sga_expense ? toPct(facts.sga_expense / facts.revenue * 100) : "", ""]);
  isRows.push(["Operating Income (EBIT)", ...fy.map(yr => toM(history.operating_income?.[yr])),
    toM(quarterly.operating_income),
    toPct(facts.operating_margin_pct), ""]);
  isRows.push(["  Operating Margin %", ...fy.map(yr => {
    const oi = history.operating_income?.[yr]; const rev = getRevHist(yr);
    return (oi != null && rev && rev > 0) ? toPct(oi / rev * 100) : "";
  }), toPct(quarterly.operating_margin_pct), toPct(facts.operating_margin_pct), "(margin, %)"]);
  isRows.push(["EBITDA", ...fy.map(yr => toM(history.ebitda?.[yr])),
    "", toPct(facts.ebitda && facts.revenue ? facts.ebitda / facts.revenue * 100 : undefined), ""]);
  isRows.push(["  EBITDA Margin %", ...fy.map(yr => {
    const eb = history.ebitda?.[yr]; const rev = getRevHist(yr);
    return (eb != null && rev && rev > 0) ? toPct(eb / rev * 100) : "";
  }), "", toPct(facts.ebitda && facts.revenue ? facts.ebitda / facts.revenue * 100 : undefined), "(margin, %)"]);

  isRows.push([""]);

  // Below the line
  isRows.push(["Interest Expense", ...fy.map(yr => toM(history.interest_expense?.[yr])),
    "", facts.interest_expense ? toPct(facts.interest_expense / (facts.revenue || 1) * 100) : "", ""]);
  isRows.push(["Pre-tax Income", ...fy.map(yr => toM(history.pretax_income?.[yr])),
    toM(quarterly.pretax_income), "", ""]);
  isRows.push(["Income Tax", ...fy.map(yr => toM(history.income_tax?.[yr])),
    toM(quarterly.income_tax), "", ""]);
  isRows.push(["Effective Tax Rate %", ...fy.map(yr => {
    const tx = history.income_tax?.[yr]; const pt = history.pretax_income?.[yr];
    return (tx != null && pt && pt !== 0) ? toPct(tx / pt * 100) : "";
  }), toPct(quarterly.effective_tax_rate), toPct(facts.effective_tax_rate), "(tax rate)"]);
  isRows.push(["Net Income", ...fy.map(yr => toM(history.net_income?.[yr])),
    toM(quarterly.net_income),
    toPct(facts.net_margin_pct), ""]);
  isRows.push(["  YoY Net Income Growth", ...fy.map((yr, i) => {
    if (i === 0) return "";
    return yoy(history.net_income?.[yr], history.net_income?.[fy[i-1]]);
  }), "", "", "(%)"]);
  isRows.push(["  Net Margin %", ...fy.map(yr => {
    const ni = history.net_income?.[yr]; const rev = getRevHist(yr);
    return (ni != null && rev && rev > 0) ? toPct(ni / rev * 100) : "";
  }), toPct(quarterly.net_margin_pct), toPct(facts.net_margin_pct), "(margin, %)"]);

  isRows.push([""]);

  // Per share
  isRows.push(["EPS — Basic", ...fy.map(yr => history.eps_basic?.[yr] ? toPct(history.eps_basic[yr]) : ""),
    quarterly.eps_basic ? toPct(quarterly.eps_basic) : "", facts.eps_basic ? toPct(facts.eps_basic) : "", "($)"]);
  isRows.push(["EPS — Diluted", ...fy.map(yr => history.eps_diluted?.[yr] ? toPct(history.eps_diluted[yr]) : ""),
    quarterly.eps_diluted ? toPct(quarterly.eps_diluted) : "", facts.eps_diluted ? toPct(facts.eps_diluted) : "", "($)"]);
  isRows.push(["Diluted Shares (wtd avg)", ...fy.map(yr => toM(history.shares_diluted_wtd?.[yr])),
    toM(quarterly.shares_diluted_wtd), toM(facts.shares_diluted_wtd), "($M)"]);
  isRows.push(["SBC Expense", ...fy.map(yr => toM(history.sbc_expense?.[yr])),
    toM(quarterly.sbc_expense), toM(facts.sbc_expense), ""]);

  const isSheet = XLSX.utils.aoa_to_sheet(isRows);
  isSheet["!cols"] = [{ wch: 32 }, ...fy.map(() => ({ wch: 14 })), { wch: 16 }, { wch: 13 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, isSheet, "Income Statement");

  // ── Balance Sheet ─────────────────────────────────────────────────────────────
  const bsYears = Array.from(new Set([
    ...Object.keys(history.total_assets ?? {}),
    ...Object.keys(history.cash ?? {}),
    ...Object.keys(history.equity ?? {}),
    ...Object.keys(history.current_assets ?? {}),
    ...Object.keys(history.total_liabilities ?? {}),
    ...Object.keys(history.long_term_debt ?? {}),
  ])).sort().slice(-5);

  const bsRows: (string | number | "")[][] = [];
  bsRows.push([`${companyName} (${ticker}) — BALANCE SHEET`]);
  bsRows.push(["$ in Millions", ...bsYears.map(y => `FY${y.slice(0,4)}`), "Current"]);
  bsRows.push([""]);
  bsRows.push(["ASSETS"]);
  bsRows.push(["Cash & Equivalents", ...bsYears.map(yr => toM(history.cash?.[yr])), toM(facts.cash)]);
  bsRows.push(["Accounts Receivable", ...bsYears.map(yr => toM(history.accounts_receivable?.[yr])), toM(facts.accounts_receivable)]);
  bsRows.push(["Inventory", ...bsYears.map(yr => toM(history.inventory?.[yr])), toM(facts.inventory)]);
  bsRows.push(["Current Assets", ...bsYears.map(yr => toM(history.current_assets?.[yr])), toM(facts.current_assets)]);
  bsRows.push(["PP&E (net)", ...bsYears.map(yr => toM(history.ppe_net?.[yr])), toM(facts.ppe_net)]);
  bsRows.push(["Goodwill", ...bsYears.map(yr => toM(history.goodwill?.[yr])), toM(facts.goodwill)]);
  bsRows.push(["Total Assets", ...bsYears.map(yr => toM(history.total_assets?.[yr])), toM(facts.total_assets)]);
  bsRows.push([""]);
  bsRows.push(["LIABILITIES"]);
  bsRows.push(["Accounts Payable", ...bsYears.map(yr => toM(history.accounts_payable?.[yr])), toM(facts.accounts_payable)]);
  bsRows.push(["Current Liabilities", ...bsYears.map(yr => toM(history.current_liabilities?.[yr])), toM(facts.current_liabilities)]);
  bsRows.push(["Long-term Debt", ...bsYears.map(yr => toM(history.long_term_debt?.[yr])), toM(facts.long_term_debt)]);
  bsRows.push(["Total Liabilities", ...bsYears.map(yr => toM(history.total_liabilities?.[yr])), toM(facts.total_liabilities)]);
  bsRows.push([""]);
  bsRows.push(["EQUITY"]);
  bsRows.push(["Retained Earnings", ...bsYears.map(yr => toM(history.retained_earnings?.[yr])), toM(facts.retained_earnings)]);
  bsRows.push(["Stockholders Equity", ...bsYears.map(yr => toM(history.equity?.[yr])), toM(facts.equity)]);
  bsRows.push([""]);
  bsRows.push(["DERIVED"]);
  const nd = facts.long_term_debt != null && facts.cash != null ? facts.long_term_debt - facts.cash : undefined;
  bsRows.push(["Net Debt (LTD − Cash)", ...bsYears.map(yr => {
    const ltd = history.long_term_debt?.[yr]; const c = history.cash?.[yr];
    return (ltd != null && c != null) ? toM(ltd - c) : "";
  }), toM(nd)]);
  bsRows.push(["Current Ratio", ...bsYears.map(yr => {
    const ca = history.current_assets?.[yr]; const cl = history.current_liabilities?.[yr];
    return (ca != null && cl && cl !== 0) ? parseFloat((ca / cl).toFixed(2)) : "";
  }),
    facts.current_assets && facts.current_liabilities ? parseFloat((facts.current_assets / facts.current_liabilities).toFixed(2)) : ""]);

  const bsSheet = XLSX.utils.aoa_to_sheet(bsRows);
  bsSheet["!cols"] = [{ wch: 32 }, ...bsYears.map(() => ({ wch: 14 })), { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, bsSheet, "Balance Sheet");

  // ── Cash Flow ─────────────────────────────────────────────────────────────────
  const cfRows: (string | number | "")[][] = [];
  cfRows.push([`${companyName} (${ticker}) — CASH FLOW STATEMENT`]);
  cfRows.push(["$ in Millions", ...fy.map(y => `FY${y.slice(0,4)}`), `MRQ ${quarterlyPeriod.slice(0,7)}`]);
  cfRows.push([""]);
  cfRows.push(["OPERATING ACTIVITIES"]);
  cfRows.push(["Net Income", ...fy.map(yr => toM(history.net_income?.[yr])), toM(quarterly.net_income)]);
  cfRows.push(["Depreciation & Amortization", ...fy.map(yr => toM(history.da_expense?.[yr])), ""]);
  cfRows.push(["Stock-based Compensation", ...fy.map(yr => toM(history.sbc_expense?.[yr])), ""]);
  cfRows.push(["Operating Cash Flow", ...fy.map(yr => toM(history.operating_cf?.[yr])), toM(quarterly.operating_cf)]);
  cfRows.push(["  YoY OCF Growth", ...fy.map((yr, i) => i === 0 ? "" : yoy(history.operating_cf?.[yr], history.operating_cf?.[fy[i-1]])), ""]);
  cfRows.push([""]);
  cfRows.push(["INVESTING ACTIVITIES"]);
  cfRows.push(["Capital Expenditures", ...fy.map(yr => toM(history.capex?.[yr])), toM(quarterly.capex)]);
  cfRows.push(["Investing Cash Flow", ...fy.map(yr => toM(history.investing_cf?.[yr])), ""]);
  cfRows.push([""]);
  cfRows.push(["FINANCING ACTIVITIES"]);
  cfRows.push(["Share Repurchases", ...fy.map(yr => toM(history.buybacks?.[yr])), ""]);
  cfRows.push(["Dividends Paid", ...fy.map(yr => toM(history.dividends_paid?.[yr])), ""]);
  cfRows.push(["Financing Cash Flow", ...fy.map(yr => toM(history.financing_cf?.[yr])), ""]);
  cfRows.push([""]);
  cfRows.push(["FREE CASH FLOW"]);
  cfRows.push(["Free Cash Flow", ...fy.map(yr => toM(history.free_cash_flow?.[yr])), toM(quarterly.free_cash_flow)]);
  cfRows.push(["  YoY FCF Growth", ...fy.map((yr, i) => i === 0 ? "" : yoy(history.free_cash_flow?.[yr], history.free_cash_flow?.[fy[i-1]])), ""]);
  cfRows.push(["  FCF Margin %", ...fy.map(yr => {
    const fcf = history.free_cash_flow?.[yr]; const rev = getRevHist(yr);
    return (fcf != null && rev && rev > 0) ? toPct(fcf / rev * 100) : "";
  }), facts.free_cash_flow && facts.revenue ? toPct(facts.free_cash_flow / facts.revenue * 100) : ""]);
  cfRows.push(["  FCF / Net Income %", ...fy.map(yr => {
    const fcf = history.free_cash_flow?.[yr]; const ni = history.net_income?.[yr];
    return (fcf != null && ni && ni > 0) ? toPct(fcf / ni * 100) : "";
  }), facts.free_cash_flow && facts.net_income ? toPct(facts.free_cash_flow / facts.net_income * 100) : ""]);

  const cfSheet = XLSX.utils.aoa_to_sheet(cfRows);
  cfSheet["!cols"] = [{ wch: 34 }, ...fy.map(() => ({ wch: 14 })), { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, cfSheet, "Cash Flow");

  // ── Key Ratios ─────────────────────────────────────────────────────────────────
  const roe = facts.net_income && facts.equity ? facts.net_income / facts.equity * 100 : undefined;
  const roa = facts.net_income && facts.total_assets ? facts.net_income / facts.total_assets * 100 : undefined;
  const ratioRows: (string | number | "")[][] = [
    [companyName, "Key Ratios — Most Recent Annual (FY)"],
    [""],
    ["PROFITABILITY", "Value"],
    ["Gross Margin %", toPct(facts.gross_margin_pct)],
    ["Operating Margin %", toPct(facts.operating_margin_pct)],
    ["EBITDA Margin %", facts.ebitda && facts.revenue ? toPct(facts.ebitda / facts.revenue * 100) : ""],
    ["Net Margin %", toPct(facts.net_margin_pct)],
    ["FCF Margin %", facts.free_cash_flow && facts.revenue ? toPct(facts.free_cash_flow / facts.revenue * 100) : ""],
    [""],
    ["RETURNS", "Value"],
    ["Return on Equity (ROE) %", toPct(roe)],
    ["Return on Assets (ROA) %", toPct(roa)],
    ["Asset Turnover", facts.revenue && facts.total_assets ? parseFloat((facts.revenue / facts.total_assets).toFixed(2)) : ""],
    [""],
    ["LEVERAGE & LIQUIDITY", "Value"],
    ["Net Debt ($M)", toM(nd)],
    ["Debt / Equity", facts.total_liabilities && facts.equity ? parseFloat((facts.total_liabilities / facts.equity).toFixed(2)) : ""],
    ["Current Ratio", facts.current_assets && facts.current_liabilities ? parseFloat((facts.current_assets / facts.current_liabilities).toFixed(2)) : ""],
    ["Interest Coverage", facts.operating_income && facts.interest_expense ? parseFloat((facts.operating_income / facts.interest_expense).toFixed(0)) : ""],
    [""],
    ["PER SHARE", "Value"],
    ["EPS — Diluted ($)", facts.eps_diluted ? parseFloat(facts.eps_diluted.toFixed(2)) : ""],
    ["Book Value / Share ($)", facts.equity && facts.shares_outstanding ? parseFloat((facts.equity / facts.shares_outstanding).toFixed(2)) : ""],
    ["Revenue / Share ($)", facts.revenue && facts.shares_diluted_wtd ? parseFloat((facts.revenue / facts.shares_diluted_wtd).toFixed(2)) : ""],
    ["FCF / Share ($)", facts.free_cash_flow && facts.shares_diluted_wtd ? parseFloat((facts.free_cash_flow / facts.shares_diluted_wtd).toFixed(2)) : ""],
    [""],
    ["QUALITY", "Value"],
    ["FCF / Net Income %", facts.free_cash_flow && facts.net_income ? toPct(facts.free_cash_flow / facts.net_income * 100) : ""],
    ["Accruals Ratio %", facts.net_income && facts.operating_cf && facts.total_assets ?
      toPct((facts.net_income - facts.operating_cf) / facts.total_assets * 100) : ""],
    ["SBC % of Revenue", facts.sbc_expense && facts.revenue ? toPct(facts.sbc_expense / facts.revenue * 100) : ""],
    ["R&D % of Revenue", facts.rd_expense && facts.revenue ? toPct(facts.rd_expense / facts.revenue * 100) : ""],
  ];

  const ratioSheet = XLSX.utils.aoa_to_sheet(ratioRows);
  ratioSheet["!cols"] = [{ wch: 34 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ratioSheet, "Key Ratios");

  // ── Quarterly Snapshot ────────────────────────────────────────────────────────
  if (Object.keys(quarterly).length > 0) {
    const qRows: (string | number | "")[][] = [
      [`${companyName} — Most Recent Quarter (${quarterlyPeriod})`],
      ["$ in Millions | % are margins", `MRQ ${quarterlyPeriod.slice(0,7)}`, "Implied Annual (×4)", "% of Implied Rev"],
      [""],
      ["Revenue", toM(quarterly.revenue), toM(quarterly.revenue != null ? quarterly.revenue * 4 : undefined), "100.0%"],
      ["Cost of Revenue", toM(quarterly.cost_of_revenue), toM(quarterly.cost_of_revenue != null ? quarterly.cost_of_revenue * 4 : undefined),
        quarterly.cost_of_revenue && quarterly.revenue ? toPct(quarterly.cost_of_revenue / quarterly.revenue * 100) : ""],
      ["Gross Profit", toM(quarterly.gross_profit), toM(quarterly.gross_profit != null ? quarterly.gross_profit * 4 : undefined),
        toPct(quarterly.gross_margin_pct)],
      ["R&D Expense", toM(quarterly.rd_expense), "", quarterly.rd_expense && quarterly.revenue ? toPct(quarterly.rd_expense / quarterly.revenue * 100) : ""],
      ["Operating Income", toM(quarterly.operating_income), toM(quarterly.operating_income != null ? quarterly.operating_income * 4 : undefined),
        toPct(quarterly.operating_margin_pct)],
      ["Net Income", toM(quarterly.net_income), toM(quarterly.net_income != null ? quarterly.net_income * 4 : undefined),
        toPct(quarterly.net_margin_pct)],
      ["Operating Cash Flow", toM(quarterly.operating_cf), toM(quarterly.operating_cf != null ? quarterly.operating_cf * 4 : undefined), ""],
      ["Free Cash Flow", toM(quarterly.free_cash_flow), toM(quarterly.free_cash_flow != null ? quarterly.free_cash_flow * 4 : undefined), ""],
      ["EPS — Diluted ($)", quarterly.eps_diluted ? parseFloat(quarterly.eps_diluted.toFixed(2)) : "", "", ""],
      [""],
      ["BALANCE SHEET (end of quarter)"],
      ["Cash & Equivalents", toM(quarterly.cash), "", ""],
      ["Total Assets", toM(quarterly.total_assets), "", ""],
      ["Stockholders Equity", toM(quarterly.equity), "", ""],
    ];
    const qSheet = XLSX.utils.aoa_to_sheet(qRows);
    qSheet["!cols"] = [{ wch: 32 }, { wch: 20 }, { wch: 22 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, qSheet, "Most Recent Quarter");
  }

  // ── Write & download ──────────────────────────────────────────────────────────
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ticker}_Financial_Model_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function TenKPage() {
  const [ticker, setTicker]           = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [data, setData]               = useState<Payload | null>(null);
  const [aiText, setAiText]           = useState("");
  const [aiRunning, setAiRunning]     = useState(false);
  const [chatMsgs, setChatMsgs]       = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput]     = useState("");
  const [chatRunning, setChatRunning] = useState(false);
  const [primerText, setPrimerText]   = useState("");
  const [primerRunning, setPrimerRunning] = useState(false);
  const [primerDone, setPrimerDone]   = useState(false);
  const [showPrimer, setShowPrimer]   = useState(false);
  const primerRef = useRef<HTMLDivElement>(null);
  const [uploadedDoc, setUploadedDoc] = useState<{name: string; base64: string; mimeType: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchFiling(sym?: string) {
    const t = (sym ?? ticker).toUpperCase().trim();
    if (!t) return;
    if (sym) setTicker(sym);
    setLoading(true);
    setError("");
    setData(null);
    setAiText("");
    setChatMsgs([]);
    setPrimerText("");
    setPrimerDone(false);
    setShowPrimer(false);
    setUploadedDoc(null);
    try {
      const r = await fetch(`/api/sec?ticker=${encodeURIComponent(t)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setData(j as Payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function generateAI() {
    if (!data || aiRunning) return;
    setAiRunning(true);
    setAiText("");
    try {
      const r = await fetch("/api/sec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: data.company.ticker }),
      });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value, { stream: true }).split("\n")) {
          const raw = line.startsWith("data: ") ? line.slice(6).trim() : null;
          if (!raw || raw === "[DONE]") continue;
          try {
            const j = JSON.parse(raw);
            if (j.text) setAiText(p => p + j.text);
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setAiText(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setAiRunning(false);
    }
  }

  async function generatePrimer() {
    if (!data || primerRunning) return;
    setPrimerRunning(true);
    setPrimerText("");
    setPrimerDone(false);
    setShowPrimer(true);
    const allSections = [
      ...(data.annual?.sections ?? []),
      ...(data.quarterly?.sections ?? []),
    ];
    try {
      const r = await fetch("/api/generate-primer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: data.company.ticker,
          companyName: data.company.name,
          industry: data.fmp_extended?.fmp_industry ?? data.company.sic_description ?? "",
          facts: data.xbrl_facts,
          history: data.history ?? {},
          quarterlyFacts: data.quarterly_xbrl ?? {},
          quarterlyPeriod: data.quarterly_period ?? "",
          sections: allSections,
          fmpExtended: data.fmp_extended ?? {},
          earningsTranscript: data.earnings_transcript ?? "",
        }),
      });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const raw = line.startsWith("data: ") ? line.slice(6).trim() : null;
          if (!raw || raw === "[DONE]") continue;
          try {
            const j = JSON.parse(raw);
            if (j.text) setPrimerText(p => p + j.text);
            if (j.error) setPrimerText(p => p + `\n\nError: ${j.error}`);
          } catch { /* skip */ }
        }
      }
      setPrimerDone(true);
    } catch (e) {
      setPrimerText(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setPrimerRunning(false);
    }
  }

  async function sendChat(msg?: string) {
    if (!data || chatRunning) return;
    const text = (msg ?? chatInput).trim();
    if (!text) return;
    setChatInput("");
    setChatRunning(true);
    const newMsgs: ChatMsg[] = [...chatMsgs, { role: "user", content: text }];
    setChatMsgs(newMsgs);
    try {
      const r = await fetch("/api/chat-filing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: data.company.ticker,
          companyName: data.company.name,
          industry: data.company.sic_description ?? "",
          messages: newMsgs,
          facts: data.xbrl_facts,
          history: data.history ?? {},
          quarterlyPeriod: data.quarterly_period ?? "",
          documentContext: uploadedDoc ?? null,
        }),
      });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const idx = newMsgs.length;
      setChatMsgs(m => [...m, { role: "assistant", content: "" }]);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const raw = line.startsWith("data: ") ? line.slice(6).trim() : null;
          if (!raw || raw === "[DONE]") continue;
          try {
            const j = JSON.parse(raw);
            if (j.text) setChatMsgs(m => m.map((msg, i) =>
              i === idx ? { ...msg, content: msg.content + j.text } : msg
            ));
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setChatMsgs(m => [...m, { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Unknown"}` }]);
    } finally {
      setChatRunning(false);
    }
  }

  return (
    <AppShell>

      {/* Header */}
      <div className="mb-8 pb-6 border-b border-[#ebebeb]">
        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#0c1b38] mb-2">10-K & 10-Q Analysis</p>
        <h1 className="text-[34px] font-light text-[#0a0a0a] tracking-tight leading-none mb-3" style={{ fontFamily: "var(--font-serif)" }}>
          SEC Filing Intelligence
        </h1>
        <p className="text-[13px] text-[#9ca3af]">
          Institutional-grade financial data and filing analysis directly from SEC EDGAR.
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && !loading && fetchFiling()}
              placeholder="Enter ticker — e.g. AAPL, NVDA, META"
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#d0d7e8] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0c1b38]/20 focus:border-[#0c1b38] placeholder:text-[#ccc] transition-colors" />
          </div>
          <button onClick={() => fetchFiling()} disabled={loading || !ticker.trim()}
            className="px-5 py-2.5 bg-[#0c1b38] text-white text-[12px] font-semibold rounded-md hover:bg-[#1a3361] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
            {loading
              ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Fetching…</>
              : <><FileText size={13} /> Fetch Filing</>}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => fetchFiling(s)} disabled={loading}
              className="text-[10.5px] font-semibold px-2.5 py-1 rounded border border-[#e8e8e8] text-[#555] hover:border-[#0c1b38] hover:text-[#0c1b38] hover:bg-[#eef1f8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-[12.5px] text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-16 justify-center text-center">
          <span className="w-6 h-6 border-2 border-[#0c1b38] border-t-transparent rounded-full animate-spin" />
          <p className="text-[13px] text-[#999]">Fetching from SEC EDGAR…</p>
          <p className="text-[11.5px] text-[#bbb]">This may take 20–40 seconds</p>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-6">

          {/* Company header — Bloomberg-style terminal card */}
          <div className="border border-[#d0d7e8] rounded-lg overflow-hidden">
            <div className="bg-[#0c1b38] px-5 py-3 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <span className="text-[26px] font-bold text-white leading-none tracking-tight">{data.company.ticker}</span>
                <div>
                  <p className="text-[13px] font-medium text-white/90">{data.company.name}</p>
                  <p className="text-[10.5px] text-white/40">
                    {data.fmp_extended?.sector ?? data.company.sic_description ?? "—"}
                    {data.fmp_extended?.fmp_industry ? ` · ${data.fmp_extended.fmp_industry}` : ` · SIC ${data.company.sic || "—"}`}
                    {data.fmp_extended?.ceo ? ` · CEO: ${data.fmp_extended.ceo}` : ""}
                    {data.xbrl_facts.employees ? ` · ${(data.xbrl_facts.employees/1000).toFixed(0)}K employees` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-right">
                <div>
                  <p className="text-[8.5px] font-bold uppercase tracking-widest text-white/30 mb-0.5">Latest 10-K</p>
                  <p className="text-[12px] font-semibold text-white">{data.annual?.period_of_report ?? "—"}</p>
                  <p className="text-[9.5px] text-white/40">filed {data.annual?.filed_date ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[8.5px] font-bold uppercase tracking-widest text-white/30 mb-0.5">Latest 10-Q</p>
                  <p className="text-[12px] font-semibold text-white">{data.quarterly?.period_of_report ?? "—"}</p>
                  <p className="text-[9.5px] text-white/40">filed {data.quarterly?.filed_date ?? "—"}</p>
                </div>
                {data.quarterly_period && (
                  <div>
                    <p className="text-[8.5px] font-bold uppercase tracking-widest text-white/30 mb-0.5">MRQ XBRL</p>
                    <p className="text-[12px] font-semibold text-white">{data.quarterly_period}</p>
                    <p className="text-[9.5px] text-white/40">most recent quarter</p>
                  </div>
                )}
                <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.company.cik}&type=10-K&dateb=&owner=include&count=10`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-white/50 hover:text-white text-[10.5px] font-semibold transition-colors">
                  EDGAR <ExternalLink size={9} />
                </a>
              </div>
            </div>
            {/* Key headline metrics strip */}
            {Object.keys(data.xbrl_facts).length > 0 && (() => {
              const f = data.xbrl_facts;
              const metrics = [
                f.market_cap != null ? { label: "Mkt Cap", value: fmtNum(f.market_cap, "$"), sub: f.beta != null ? `β ${f.beta.toFixed(2)}` : "" } : null,
                { label: "Revenue", value: fmtNum(f.revenue, "$"), sub: f.gross_margin_pct != null ? `${f.gross_margin_pct.toFixed(1)}% GM` : "" },
                { label: "Net Income", value: fmtNum(f.net_income, "$"), sub: f.net_margin_pct != null ? `${f.net_margin_pct.toFixed(1)}% NM` : "" },
                { label: "EBITDA", value: fmtNum(f.ebitda, "$"), sub: f.ebitda && f.revenue ? `${(f.ebitda/f.revenue*100).toFixed(1)}% margin` : "" },
                { label: "Free CF", value: fmtNum(f.free_cash_flow, "$"), sub: f.free_cash_flow && f.revenue ? `${(f.free_cash_flow/f.revenue*100).toFixed(1)}% FCF margin` : "" },
                f.pe_ratio != null ? { label: "P/E", value: `${f.pe_ratio.toFixed(1)}x`, sub: f.ev_ebitda != null ? `${f.ev_ebitda.toFixed(1)}x EV/EBITDA` : "" } : null,
                { label: "EPS Diluted", value: fmtNum(f.eps_diluted, "$"), sub: "" },
                { label: "Net Debt", value: f.long_term_debt != null && f.cash != null ? fmtNum(f.long_term_debt - f.cash, "$") : "—", sub: f.long_term_debt != null && f.cash != null && f.long_term_debt < f.cash ? "net cash" : "" },
              ].filter((m): m is {label:string;value:string;sub:string} => m !== null && m.value !== "—");
              return (
                <div className="grid border-t border-[#1e3560] bg-[#0c1b38]" style={{ gridTemplateColumns: `repeat(${metrics.length}, 1fr)` }}>
                  {metrics.map((m, i) => (
                    <div key={m.label} className={`px-4 py-3 text-center ${i < metrics.length - 1 ? "border-r border-[#1e3560]" : ""}`}>
                      <p className="text-[8.5px] font-bold uppercase tracking-widest text-white/30 mb-0.5">{m.label}</p>
                      <p className="text-[14px] font-bold text-white tabular-nums">{m.value}</p>
                      {m.sub && <p className="text-[9px] text-white/40 mt-0.5">{m.sub}</p>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Company Overview */}
          {data.fmp_extended && (
            <CompanyOverview ext={data.fmp_extended} ticker={data.company.ticker} />
          )}

          {/* Key Financials — tabbed statements */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Financial Statements — Most Recent Annual (10-K XBRL)</p>
            <FinancialStatements facts={data.xbrl_facts} history={data.history ?? {}} />
          </div>

          {/* Financial Ratios */}
          {Object.keys(data.xbrl_facts).length > 0 && (
            <FinancialRatios facts={data.xbrl_facts} />
          )}

          {/* Quality Scorecard */}
          {Object.keys(data.xbrl_facts).length > 0 && (
            <QualityScorecard
              facts={data.xbrl_facts}
              history={data.history ?? {}}
              quarterly={data.quarterly_xbrl ?? {}}
            />
          )}

          {/* Quarterly vs Annual Snapshot */}
          {data.quarterly_xbrl && Object.keys(data.quarterly_xbrl).length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Most Recent Quarter vs Annual Run-Rate</p>
              <QuarterlySnapshot
                annual={data.xbrl_facts}
                quarterly={data.quarterly_xbrl}
                period={data.quarterly_period}
                priorQuarter={data.prior_quarter_xbrl ?? {}}
                priorPeriod={data.prior_quarter_period ?? ""}
              />
            </div>
          )}

          {/* 5-Year History */}
          {data.history && Object.keys(data.history).length > 0 && (
            <HistoryTable history={data.history} />
          )}

          {/* Financial Analytics — 30 Charts */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Financial Analytics</p>
            <FinancialAnalytics
              ticker={data.company.ticker}
              companyName={data.company.name}
              facts={data.xbrl_facts}
              history={data.history ?? {}}
              quarterly={data.quarterly_xbrl ?? {}}
              quarterlyPeriod={data.quarterly_period ?? ""}
              kmHistory={data.fmp_extended?.km_history}
              growthHistory={data.fmp_extended?.growth_history}
              earningsSurprises={data.fmp_extended?.earnings_surprises}
              peers={data.fmp_extended?.peer_comparison}
              sector={data.fmp_extended?.sector ?? data.company.sic_description ?? ""}
              segments={data.fmp_extended?.segments}
              geoSegments={data.fmp_extended?.geo_segments}
              analystEstimates={data.fmp_extended?.analyst_estimates}
              fmpRating={data.fmp_extended?.fmp_rating}
              quarterlyTrends={data.fmp_extended?.quarterly_trends}
              earningsTranscript={data.earnings_transcript ?? ""}
            />
          </div>

          {/* Valuation & Returns */}
          {Object.keys(data.xbrl_facts).length > 0 && (() => {
            const f = data.xbrl_facts;
            const valRows = [
              ["P/E Ratio",     f.pe_ratio    != null ? `${f.pe_ratio.toFixed(1)}x` : null],
              ["EV / EBITDA",   f.ev_ebitda   != null ? `${f.ev_ebitda.toFixed(1)}x` : null],
              ["P / FCF",       f.p_fcf       != null ? `${f.p_fcf.toFixed(1)}x` : null],
              ["P / Sales",     f.p_sales     != null ? `${f.p_sales.toFixed(1)}x` : null],
              ["P / Book",      f.p_book      != null ? `${f.p_book.toFixed(1)}x` : null],
              ["EV / Revenue",  f.ev_revenue  != null ? `${f.ev_revenue.toFixed(1)}x` : null],
              ["Ent. Value",    f.enterprise_value != null ? fmtNum(f.enterprise_value, "$") : null],
              ["ROIC",          f.roic        != null ? `${f.roic.toFixed(1)}%` : null],
              ["ROE",           (() => { const v = f.roe_km ?? (f.net_income != null && f.equity != null ? f.net_income/f.equity*100 : null); return v != null ? `${v.toFixed(1)}%` : null; })()],
              ["Current Ratio", f.current_ratio != null ? `${f.current_ratio.toFixed(2)}x` : null],
              ["Debt / Equity", f.debt_to_equity != null ? `${f.debt_to_equity.toFixed(2)}x` : null],
              ["Dividend Yield",f.dividend_yield != null ? `${f.dividend_yield.toFixed(2)}%` : null],
              ["FCF Yield",     f.fcf_yield   != null ? `${f.fcf_yield.toFixed(2)}%` : null],
              ["Rev Growth YoY",f.revenue_growth_yoy != null ? `${f.revenue_growth_yoy.toFixed(1)}%` : null],
              ["EPS Growth YoY",f.eps_growth_yoy != null ? `${f.eps_growth_yoy.toFixed(1)}%` : null],
            ].filter((r): r is [string, string] => r[1] !== null);
            if (valRows.length === 0) return null;
            return (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Valuation & Returns</p>
                <div className="border border-[#1e3560] rounded-lg overflow-hidden">
                  <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                    {valRows.map(([label, val], i) => {
                      const isGrowth = label.includes("Growth") || label.includes("Yield") || label.includes("ROE") || label.includes("ROIC");
                      const numVal = isGrowth ? parseFloat(val) : null;
                      const color = isGrowth && numVal != null ? (numVal >= 0 ? "#0d6b45" : "#b42318") : "#e0e8f7";
                      return (
                        <div key={label} className={`px-4 py-2.5 border-[#1e3560] ${i % 4 !== 3 ? "border-r" : ""} ${i >= 4 ? "border-t" : ""}`} style={{ backgroundColor: "#0c1b38" }}>
                          <p className="text-[8px] font-bold uppercase tracking-widest text-white/30 mb-0.5">{label}</p>
                          <p className="text-[13px] font-bold tabular-nums" style={{ color }}>{val}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Peer Comparison */}
          {data.fmp_extended?.peer_comparison && data.fmp_extended.peer_comparison.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Peer Comparison</p>
              <PeerComparison peers={data.fmp_extended.peer_comparison} ticker={data.company.ticker} />
            </div>
          )}

          {/* Historical Multiples */}
          {data.fmp_extended?.km_history && data.fmp_extended.km_history.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Historical Multiples</p>
              <MultiplesHistory kmHistory={data.fmp_extended.km_history} />
            </div>
          )}

          {/* Analyst Consensus & Estimates */}
          {(() => {
            const f = data.xbrl_facts;
            const ext = data.fmp_extended;
            const hasRating = ext?.fmp_rating || f.pt_consensus != null;
            const hasEstimates = (ext?.analyst_estimates?.length ?? 0) > 0;
            const hasEarnings = (ext?.earnings_surprises?.length ?? 0) > 0;
            if (!hasRating && !hasEstimates && !hasEarnings) return null;
            const fmt2 = (v: number|null|undefined, prefix="") => v == null ? "—" : fmtNum(v, prefix);
            return (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Analyst Consensus</p>
                <div className="grid grid-cols-2 gap-4">
                  {(hasRating || hasEstimates) && (
                    <div className="border border-[#1e3560] rounded-lg overflow-hidden" style={{ backgroundColor: "#0c1b38" }}>
                      <div className="px-4 py-2 border-b border-[#1e3560]">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">FMP Rating & Price Target</p>
                      </div>
                      <div className="px-4 py-3 space-y-2">
                        {ext?.fmp_rating && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-white/50">FMP Rating</span>
                            <span className="text-[11px] font-bold text-[#60a5fa]">{ext.fmp_rating}</span>
                          </div>
                        )}
                        {f.pt_consensus != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-white/50">Price Target (last mo.)</span>
                            <span className="text-[11px] font-bold text-white">{fmt2(f.pt_consensus, "$")}</span>
                          </div>
                        )}
                        {f.num_analysts != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-white/50"># Analysts</span>
                            <span className="text-[11px] font-bold text-white">{f.num_analysts.toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                      {hasEstimates && (
                        <>
                          <div className="px-4 py-2 border-t border-[#1e3560]">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Forward Estimates</p>
                          </div>
                          <div className="px-4 py-2">
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr className="text-white/30">
                                  <th className="text-left pb-1 font-semibold">Period</th>
                                  <th className="text-right pb-1 font-semibold">Rev Est</th>
                                  <th className="text-right pb-1 font-semibold">EPS Est</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ext!.analyst_estimates!.map(e => (
                                  <tr key={e.date} className="border-t border-[#1e3560]">
                                    <td className="py-1 text-white/60">{e.date?.slice(0,4)}</td>
                                    <td className="py-1 text-right text-white tabular-nums">{fmt2(e.rev_avg, "$")}</td>
                                    <td className="py-1 text-right text-white tabular-nums">{e.eps_avg != null ? `$${e.eps_avg.toFixed(2)}` : "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {hasEarnings && (
                    <div className="border border-[#1e3560] rounded-lg overflow-hidden" style={{ backgroundColor: "#0c1b38" }}>
                      <div className="px-4 py-2 border-b border-[#1e3560]">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">EPS Surprises (last 8 quarters)</p>
                      </div>
                      <div className="px-4 py-2">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="text-white/30">
                              <th className="text-left pb-1 font-semibold">Quarter</th>
                              <th className="text-right pb-1 font-semibold">Actual</th>
                              <th className="text-right pb-1 font-semibold">Est</th>
                              <th className="text-right pb-1 font-semibold">Beat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ext!.earnings_surprises!.map(e => {
                              const color = e.surprise_pct != null ? (e.surprise_pct >= 0 ? "#0d6b45" : "#b42318") : "#888";
                              return (
                                <tr key={e.date} className="border-t border-[#1e3560]">
                                  <td className="py-1 text-white/60">{e.date?.slice(0,7)}</td>
                                  <td className="py-1 text-right text-white tabular-nums">{e.eps_actual != null ? `$${e.eps_actual.toFixed(2)}` : "—"}</td>
                                  <td className="py-1 text-right text-white/60 tabular-nums">{e.eps_est != null ? `$${e.eps_est.toFixed(2)}` : "—"}</td>
                                  <td className="py-1 text-right tabular-nums font-bold" style={{ color }}>{e.surprise_pct != null ? `${e.surprise_pct > 0 ? "+" : ""}${e.surprise_pct.toFixed(1)}%` : "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Revenue Segments */}
          {(() => {
            const ext = data.fmp_extended;
            const hasSeg = ext?.segments && Object.keys(ext.segments.data).length > 0;
            const hasGeo = ext?.geo_segments && Object.keys(ext.geo_segments.data).length > 0;
            if (!hasSeg && !hasGeo) return null;
            const renderBars = (segData: Record<string, number>, title: string, date: string) => {
              const total = Object.values(segData).reduce((s, v) => s + Math.abs(v), 0);
              const sorted = Object.entries(segData).sort(([,a],[,b]) => Math.abs(b) - Math.abs(a));
              const COLORS = ["#3b82f6","#60a5fa","#93c5fd","#1d4ed8","#7dd3fc","#2563eb","#bfdbfe"];
              return (
                <div className="border border-[#1e3560] rounded-lg overflow-hidden" style={{ backgroundColor: "#0c1b38" }}>
                  <div className="px-4 py-2 border-b border-[#1e3560] flex justify-between items-center">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">{title}</p>
                    <p className="text-[8.5px] text-white/30">{date}</p>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    {sorted.map(([name, val], i) => {
                      const pct = total > 0 ? Math.abs(val) / total * 100 : 0;
                      return (
                        <div key={name}>
                          <div className="flex justify-between mb-0.5">
                            <span className="text-[9.5px] text-white/70 truncate max-w-[60%]">{name}</span>
                            <span className="text-[9.5px] font-semibold text-white tabular-nums">{fmtNum(val, "$")} <span className="text-white/40">({pct.toFixed(1)}%)</span></span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#1e3560]">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            };
            return (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Revenue Segmentation</p>
                <div className="grid grid-cols-2 gap-4">
                  {hasSeg && renderBars(ext!.segments!.data, "Business Segments", ext!.segments!.date)}
                  {hasGeo && renderBars(ext!.geo_segments!.data, "Geographic Revenue", ext!.geo_segments!.date)}
                </div>
              </div>
            );
          })()}

          {/* Recent News */}
          {data.fmp_extended?.recent_news && data.fmp_extended.recent_news.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Recent News</p>
              <NewsFeed news={data.fmp_extended.recent_news} />
            </div>
          )}

          {/* Filing Sections */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb]">Filing Sections</p>
              <button
                onClick={() => downloadExcel(
                  data.company.ticker,
                  data.company.name,
                  data.xbrl_facts,
                  data.history ?? {},
                  data.quarterly_xbrl ?? {},
                  data.quarterly_period ?? ""
                ).catch(e => alert(`Excel export failed: ${e?.message ?? e}`))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10.5px] font-semibold border border-[#d0d7e8] rounded text-[#0c1b38] hover:bg-[#eef1f8] transition-colors">
                <Download size={11} /> Export Excel
              </button>
            </div>
            <SectionViewer annual={data.annual} quarterly={data.quarterly} ticker={data.company.ticker} />
          </div>

          {/* ── Company Primer Generator ──────────────────────────────────── */}
          <div className="border border-[#d0d7e8] rounded-lg overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#0c1b38] to-[#152a55] flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileDown size={13} className="text-white/60" />
                  <p className="text-[12px] font-bold text-white tracking-wide">Company Primer</p>
                </div>
                <p className="text-[10.5px] text-white/40">
                  Institutional-grade equity research primer — business overview, industry analysis, financial deep-dive, bull/bear thesis. Download as PDF.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {primerDone && (
                  <button onClick={() => setShowPrimer(v => !v)}
                    className="px-3 py-1.5 border border-white/20 text-white/70 text-[10.5px] font-semibold rounded hover:bg-white/10 transition-colors">
                    {showPrimer ? "Hide Preview" : "Show Preview"}
                  </button>
                )}
                <button onClick={generatePrimer} disabled={primerRunning}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-[#0c1b38] text-[11.5px] font-bold rounded-md hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {primerRunning
                    ? <><span className="w-3 h-3 border-2 border-[#0c1b38] border-t-transparent rounded-full animate-spin" /> Writing Primer…</>
                    : <><FileDown size={13} /> {primerDone ? "Regenerate" : "Generate Primer"}</>}
                </button>
              </div>
            </div>

            {/* Generation progress */}
            {primerRunning && (
              <div className="px-5 py-3 border-b border-[#ebebeb] bg-[#fafafa]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-[#0c1b38] animate-pulse" />
                  <span className="text-[10.5px] font-semibold text-[#0c1b38]">
                    {primerText.length < 200 ? "Starting analysis…"
                      : primerText.includes("## BUSINESS OVERVIEW") ? "Writing business overview…"
                      : primerText.includes("## INDUSTRY ANALYSIS") ? "Analyzing industry dynamics…"
                      : primerText.includes("## FINANCIAL ANALYSIS") ? "Building financial deep-dive…"
                      : primerText.includes("## VALUATION FRAMEWORK") ? "Building valuation framework…"
                      : primerText.includes("## MANAGEMENT COMMENTARY") ? "Synthesizing management commentary…"
                      : primerText.includes("## MANAGEMENT & GOVERNANCE") ? "Assessing management & governance…"
                      : primerText.includes("## KEY RISKS") ? "Identifying key risks…"
                      : primerText.includes("## INVESTMENT THESIS") ? "Forming investment thesis…"
                      : "Writing executive summary…"}
                  </span>
                  <span className="text-[10px] text-[#bbb] ml-auto">{primerText.split(/\s+/).filter(Boolean).length} words</span>
                </div>
                <div className="h-1.5 bg-[#ebebeb] rounded-full overflow-hidden">
                  <div className="h-full bg-[#0c1b38] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (primerText.length / 16000) * 100)}%` }} />
                </div>
              </div>
            )}

            {/* Primer preview */}
            {showPrimer && primerText && (
              <div ref={primerRef} className="p-6 border-b border-[#ebebeb]">
                {/* Download PDF button */}
                {primerDone && (
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#0c1b38]">
                      {data.company.name} — Equity Research Primer
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigator.clipboard.writeText(primerText)}
                        className="text-[10.5px] text-[#999] hover:text-[#0c1b38] font-medium border border-[#e8e8e8] px-2.5 py-1 rounded transition-colors">
                        Copy Markdown
                      </button>
                      <PrimerDownloadButton
                        ticker={data.company.ticker}
                        companyName={data.company.name}
                        industry={data.company.sic_description ?? ""}
                        content={primerText}
                        history={data.history ?? {}}
                        facts={data.xbrl_facts}
                      />
                    </div>
                  </div>
                )}
                {/* Rendered primer content */}
                <BriefBody text={primerText} />
              </div>
            )}
          </div>

          {/* Optional AI Note */}
          <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
            <div className="px-5 py-4 bg-[#fafafa] flex items-center justify-between gap-4 border-b border-[#ebebeb]">
              <div>
                <p className="text-[11.5px] font-semibold text-[#0a0a0a]">AI Institutional Research Note</p>
                <p className="text-[11px] text-[#999] mt-0.5">
                  Claude reads the filing and writes an analyst-grade note with risk assessment, investment thesis, and ratings.
                </p>
              </div>
              <button onClick={generateAI} disabled={aiRunning}
                className="flex items-center gap-2 px-4 py-2 bg-[#0c1b38] text-white text-[11.5px] font-semibold rounded-md hover:bg-[#1a3361] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0">
                {aiRunning
                  ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
                  : <><Sparkles size={13} /> Generate Research Note</>}
              </button>
            </div>
            {aiText && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-[#0c1b38]" />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#0c1b38]">
                      {data.company.name} — Research Note
                    </p>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(aiText)}
                    className="text-[10.5px] text-[#999] hover:text-[#0c1b38] font-medium border border-[#e8e8e8] px-2.5 py-1 rounded transition-colors">
                    Copy
                  </button>
                </div>
                <BriefBody text={aiText} />
              </div>
            )}
          </div>

          {/* ── Ask the Filing — AI Chat ──────────────────────────────────────── */}
          <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-[#0c1b38] to-[#1a3361] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                  <MessageCircle size={14} className="text-white/70" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-white">Ask the Filing</p>
                  <p className="text-[9.5px] text-white/40">Chat with {data.company.name}'s 10-K & 10-Q — grounded in real XBRL data</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Document upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const result = ev.target?.result as string;
                      // result is "data:application/pdf;base64,xxxx"
                      const base64 = result.split(",")[1];
                      setUploadedDoc({ name: file.name, base64, mimeType: file.type || "application/pdf" });
                    };
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
                {uploadedDoc ? (
                  <div className="flex items-center gap-1.5 bg-white/10 rounded px-2 py-1">
                    <Paperclip size={10} className="text-white/60" />
                    <span className="text-[9.5px] text-white/70 max-w-[120px] truncate">{uploadedDoc.name}</span>
                    <button onClick={() => setUploadedDoc(null)} className="text-white/30 hover:text-white/70 ml-0.5">
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload PDF or TXT to chat about"
                    className="flex items-center gap-1 text-[9.5px] text-white/40 hover:text-white/70 transition-colors border border-white/20 rounded px-2 py-1">
                    <Paperclip size={10} /> Upload Doc
                  </button>
                )}
                {chatMsgs.length > 0 && (
                  <button onClick={() => setChatMsgs([])} className="text-[9.5px] text-white/30 hover:text-white/60 transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Quick starter questions */}
            {chatMsgs.length === 0 && (
              <div className="px-4 py-3 border-b border-[#f0f0f0] bg-[#fafafa]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#bbb] mb-2">Try asking:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "What drove revenue growth?",
                    "How is FCF quality?",
                    "What are the key risks?",
                    "How does the balance sheet look?",
                    "What's the earnings quality?",
                    "Summarize the investment thesis",
                  ].map(q => (
                    <button key={q} onClick={() => sendChat(q)}
                      className="text-[10.5px] px-2.5 py-1 rounded border border-[#e0e0e0] text-[#555] hover:border-[#0c1b38] hover:text-[#0c1b38] hover:bg-[#eef1f8] transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat history */}
            {chatMsgs.length > 0 && (
              <div className="px-4 py-3 space-y-4 max-h-[500px] overflow-y-auto">
                {chatMsgs.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full bg-[#0c1b38] flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles size={10} className="text-white/70" />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                      msg.role === "user"
                        ? "bg-[#0c1b38] text-white text-[12.5px] leading-[1.7]"
                        : "bg-[#f5f6f8] text-[#1a1a1a] text-[12.5px] leading-[1.8]"
                    }`}>
                      {msg.role === "assistant" && !msg.content
                        ? <span className="inline-flex gap-1 items-center text-[#bbb]">
                            <span className="w-1 h-1 rounded-full bg-[#0c1b38] animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1 h-1 rounded-full bg-[#0c1b38] animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1 h-1 rounded-full bg-[#0c1b38] animate-bounce" style={{ animationDelay: "300ms" }} />
                          </span>
                        : msg.content}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-6 h-6 rounded-full bg-[#e8edf5] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[9px] font-bold text-[#0c1b38]">You</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div className={`flex gap-2 px-4 py-3 border-t border-[#f0f0f0] ${chatMsgs.length === 0 ? "" : "bg-white"}`}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && !chatRunning && sendChat()}
                placeholder={`Ask anything about ${data.company.name}…`}
                disabled={chatRunning}
                className="flex-1 text-[12.5px] border border-[#e0e0e0] rounded-lg px-3.5 py-2 focus:outline-none focus:border-[#0c1b38] focus:ring-1 focus:ring-[#0c1b38]/20 placeholder:text-[#ccc] disabled:opacity-50 transition-colors"
              />
              <button
                onClick={() => sendChat()}
                disabled={!chatInput.trim() || chatRunning}
                className="px-3.5 py-2 bg-[#0c1b38] text-white rounded-lg hover:bg-[#1a3361] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 text-[11.5px] font-semibold shrink-0">
                {chatRunning
                  ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send size={12} />}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Idle */}
      {!data && !loading && !error && (
        <div className="border border-dashed border-[#e0e0e0] rounded-lg py-16 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[#eef1f8] flex items-center justify-center">
            <FileText size={20} className="text-[#0c1b38]" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-[#0a0a0a] mb-1">SEC Filing Browser</p>
            <p className="text-[12.5px] text-[#999] max-w-md">
              Enter a ticker to pull the latest 10-K and 10-Q from EDGAR. Browse financial statements, 5-year history, MD&A, and risk factors.
            </p>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-[#bbb] mt-2">
            <span>✓ Live EDGAR data</span>
            <span>✓ MD&A + Risk Factors</span>
            <span>✓ XBRL financials</span>
            <span>✓ 5-year history</span>
            <span>✓ AI research note</span>
            <span>✓ Ask the Filing</span>
          </div>
        </div>
      )}

    </AppShell>
  );
}
