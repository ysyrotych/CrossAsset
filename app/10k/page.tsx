"use client";
import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { Search, FileText, AlertTriangle, ChevronDown, ChevronUp, Sparkles, ExternalLink, TrendingUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilingSection = { item: string; title: string; text: string; char_count: number };
type FilingData    = { form_type: string; accession: string; filed_date: string; period_of_report: string; sections: FilingSection[]; raw_financials: Record<string, number> };
type CompanyInfo   = { ticker: string; name: string; cik: string; sic: string; sic_description: string };
type Payload       = {
  company: CompanyInfo;
  annual: FilingData | null;
  quarterly: FilingData | null;
  xbrl_facts: Record<string, number>;
  history: Record<string, Record<string, number>>;
  quarterly_xbrl: Record<string, number>;
  quarterly_period: string;
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
  { key: "income_tax",        label: "Income Tax",              indent: true, prefix: "$" },
  { divider: true, label: "" },
  { key: "net_income",        label: "Net Income",              bold: true, prefix: "$", dynamic: true },
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

function SectionBody({ text, query, expanded }: { text: string; query: string; expanded: boolean }) {
  const cleaned = text
    .replace(/^(ITEM\s+\d+[A-Z]?\s*[\.\-—]+\s*[^\n]*\n)/im, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paragraphs = cleaned.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const lq = query.trim().toLowerCase();
  const visible = !lq
    ? (expanded ? paragraphs : paragraphs.slice(0, 25))
    : paragraphs.filter(p => p.toLowerCase().includes(lq));

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
      {!lq && !expanded && paragraphs.length > 25 && (
        <p className="text-[10.5px] text-[#bbb] italic pt-2">{paragraphs.length - 25} more paragraphs hidden — click "Show full" to expand</p>
      )}
    </div>
  );
}

// ── Section viewer ────────────────────────────────────────────────────────────

const SECTION_TABS = [
  { key: "business", label: "Business Overview",  src: "annual"    },
  { key: "risks",    label: "Risk Factors",        src: "annual"    },
  { key: "mda",      label: "MD&A Annual",         src: "annual"    },
  { key: "mda_q",    label: "MD&A Quarterly",      src: "quarterly" },
];

function SectionViewer({ annual, quarterly }: { annual: FilingData | null; quarterly: FilingData | null }) {
  const [active, setActive]   = useState("business");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery]     = useState("");
  const [copied, setCopied]   = useState(false);

  const section = active === "mda_q"
    ? quarterly?.sections.find(s => s.item === "mda")
    : annual?.sections.find(s => s.item === active);

  function copyText() {
    if (!section) return;
    navigator.clipboard.writeText(section.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const wordCount = section ? section.text.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[#ebebeb] bg-[#fafafa] overflow-x-auto">
        {SECTION_TABS.map(({ key, label }) => {
          const hasSec = key === "mda_q"
            ? quarterly?.sections.some(s => s.item === "mda")
            : annual?.sections.some(s => s.item === key);
          return (
            <button key={key}
              onClick={() => { setActive(key); setExpanded(false); setQuery(""); }}
              disabled={!hasSec}
              className={`px-4 py-3 text-[11.5px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                active === key
                  ? "border-[#0c1b38] text-[#0c1b38] bg-white"
                  : hasSec
                    ? "border-transparent text-[#888] hover:text-[#444]"
                    : "border-transparent text-[#ccc] cursor-not-allowed"
              }`}>
              {label}
              {!hasSec && <span className="ml-1 text-[9px]">—</span>}
            </button>
          );
        })}
      </div>

      {section ? (
        <>
          {/* Section meta + controls */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[#f0f0f0] bg-[#fdfcfc] flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] font-semibold text-[#0a0a0a] truncate">{section.title}</p>
              <p className="text-[9.5px] text-[#bbb] mt-0.5">{wordCount.toLocaleString()} words · {section.char_count.toLocaleString()} chars</p>
            </div>
            {/* Search box */}
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#ccc]" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search in section…"
                className="pl-7 pr-3 py-1.5 text-[11px] border border-[#e0e0e0] rounded w-44 focus:outline-none focus:border-[#0c1b38] focus:ring-1 focus:ring-[#0c1b38]/20 placeholder:text-[#ddd]"
              />
            </div>
            <button onClick={copyText}
              className="text-[10px] font-semibold px-2.5 py-1.5 border border-[#e8e8e8] rounded text-[#666] hover:border-[#0c1b38] hover:text-[#0c1b38] transition-colors shrink-0">
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <button onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-[10px] text-[#0c1b38] font-semibold hover:underline shrink-0">
              {expanded ? <><ChevronUp size={11}/> Collapse</> : <><ChevronDown size={11}/> Expand</>}
            </button>
          </div>

          {/* Section body */}
          <div className={`px-5 py-4 relative ${!expanded && !query ? "max-h-96 overflow-hidden" : ""}`}>
            <SectionBody text={section.text} query={query} expanded={expanded} />
            {!expanded && !query && (
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent pointer-events-none" />
            )}
          </div>
        </>
      ) : (
        <div className="px-5 py-10 text-center">
          <p className="text-[12px] text-[#bbb]">Section not extracted from this filing.</p>
          <p className="text-[10.5px] text-[#d0d0d0] mt-1">edgartools may not have parsed this item from the filing document.</p>
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

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[#0c1b38] flex items-center gap-2">
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/60">Financial Ratios & Quality Metrics</p>
      </div>
      <div className="p-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {ratios.map(r => <RatioCard key={r.label} {...r} />)}
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

function QuarterlySnapshot({ annual, quarterly, period }: {
  annual: Record<string, number>;
  quarterly: Record<string, number>;
  period: string;
}) {
  if (!Object.keys(quarterly).length) return null;

  const ROWS: { key: string; label: string; prefix?: string; suffix?: string }[] = [
    { key: "revenue",           label: "Revenue",          prefix: "$" },
    { key: "gross_margin_pct",  label: "Gross Margin",     suffix: "%" },
    { key: "operating_income",  label: "Operating Income", prefix: "$" },
    { key: "operating_margin_pct", label: "Op. Margin",   suffix: "%" },
    { key: "net_income",        label: "Net Income",       prefix: "$" },
    { key: "net_margin_pct",    label: "Net Margin",       suffix: "%" },
    { key: "operating_cf",      label: "Operating CF",     prefix: "$" },
    { key: "free_cash_flow",    label: "Free Cash Flow",   prefix: "$" },
    { key: "eps_diluted",       label: "EPS (Diluted)",    prefix: "$" },
  ].filter(r => quarterly[r.key] != null);

  if (!ROWS.length) return null;

  const annualizedQuarterly = (key: string, val: number) => {
    if (["revenue","gross_profit","operating_income","net_income","operating_cf","free_cash_flow","rd_expense","sga_expense"].includes(key))
      return val * 4;
    return null;
  };

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[#0c1b38] flex items-center justify-between">
        <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/60">
          Most Recent Quarter vs Annual — {period || "Latest Quarter"}
        </p>
        <p className="text-[9px] text-white/40 uppercase tracking-wider">Single quarter | (×4 implied annual)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="bg-[#f5f6f8] border-b border-[#ebebeb]">
              <th className="px-4 py-2 text-left text-[9.5px] font-bold uppercase tracking-wider text-[#999] w-40">Metric</th>
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">Quarter</th>
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">Implied Ann.</th>
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">Annual (10-K)</th>
              <th className="px-3 py-2 text-right text-[9.5px] font-bold uppercase tracking-wider text-[#999]">vs Annual</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ key, label, prefix = "", suffix = "" }, i) => {
              const qVal = quarterly[key];
              const aVal = annual[key];
              const implied = annualizedQuarterly(key, qVal);
              const pct = aVal != null && aVal !== 0 && implied != null
                ? ((implied - aVal) / Math.abs(aVal)) * 100 : null;
              const isEven = i % 2 === 0;
              const isMargin = suffix === "%";
              return (
                <tr key={key} className={`border-b border-[#f0f0f0] last:border-0 ${isEven ? "bg-white" : "bg-[#fafafa]"}`}>
                  <td className="px-4 py-2 text-[11.5px] font-semibold text-[#333]">{label}</td>
                  <td className="px-3 py-2 text-right text-[12px] font-medium tabular-nums text-[#0a0a0a]">
                    {fmtNum(qVal, prefix, suffix)}
                  </td>
                  <td className="px-3 py-2 text-right text-[11.5px] tabular-nums text-[#888]">
                    {!isMargin && implied != null ? fmtNum(implied, prefix) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-[11.5px] tabular-nums text-[#555]">
                    {aVal != null ? fmtNum(aVal, prefix, suffix) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-[11px] font-semibold tabular-nums">
                    {pct != null
                      ? <span style={{ color: pct >= 0 ? "#0d6b45" : "#b42318" }}>{pct >= 0 ? "▲" : "▼"}{Math.abs(pct).toFixed(1)}%</span>
                      : <span className="text-[#ddd]">—</span>}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TenKPage() {
  const [ticker, setTicker]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [data, setData]           = useState<Payload | null>(null);
  const [aiText, setAiText]       = useState("");
  const [aiRunning, setAiRunning] = useState(false);

  async function fetchFiling(sym?: string) {
    const t = (sym ?? ticker).toUpperCase().trim();
    if (!t) return;
    if (sym) setTicker(sym);
    setLoading(true);
    setError("");
    setData(null);
    setAiText("");
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
                  <p className="text-[10.5px] text-white/40">{data.company.sic_description || "—"} · SIC {data.company.sic || "—"} · CIK {data.company.cik}</p>
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
                { label: "Revenue", value: fmtNum(f.revenue, "$"), sub: f.gross_margin_pct != null ? `${f.gross_margin_pct.toFixed(1)}% GM` : "" },
                { label: "Net Income", value: fmtNum(f.net_income, "$"), sub: f.net_margin_pct != null ? `${f.net_margin_pct.toFixed(1)}% NM` : "" },
                { label: "EBITDA", value: fmtNum(f.ebitda, "$"), sub: f.ebitda && f.revenue ? `${(f.ebitda/f.revenue*100).toFixed(1)}% margin` : "" },
                { label: "Free CF", value: fmtNum(f.free_cash_flow, "$"), sub: f.free_cash_flow && f.revenue ? `${(f.free_cash_flow/f.revenue*100).toFixed(1)}% FCF margin` : "" },
                { label: "EPS Diluted", value: fmtNum(f.eps_diluted, "$"), sub: "" },
                { label: "Total Assets", value: fmtNum(f.total_assets, "$"), sub: "" },
                { label: "Net Debt", value: f.long_term_debt != null && f.cash != null ? fmtNum(f.long_term_debt - f.cash, "$") : "—", sub: f.long_term_debt != null && f.cash != null && f.long_term_debt < f.cash ? "net cash" : "" },
              ].filter(m => m.value !== "—");
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
              />
            </div>
          )}

          {/* 5-Year History */}
          {data.history && Object.keys(data.history).length > 0 && (
            <HistoryTable history={data.history} />
          )}

          {/* Filing Sections */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Filing Sections</p>
            <SectionViewer annual={data.annual} quarterly={data.quarterly} />
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
          </div>
        </div>
      )}

    </AppShell>
  );
}
