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

function HistoryTable({ history }: { history: Record<string, Record<string, number>> }) {
  const revData = history.revenue || {};
  const niData  = history.net_income || {};
  const oiData  = history.operating_income || {};
  const cfData  = history.operating_cf || {};

  const allYears = Array.from(new Set([
    ...Object.keys(revData),
    ...Object.keys(niData),
    ...Object.keys(oiData),
    ...Object.keys(cfData),
  ])).sort();

  if (!allYears.length) return null;

  const rows: { label: string; data: Record<string, number>; prefix: string }[] = [
    { label: "Revenue",        data: revData, prefix: "$" },
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
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="bg-[#f5f6f8] border-b border-[#ebebeb]">
              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[#999] w-36">Metric</th>
              {displayYears.map(y => (
                <th key={y} className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#999]">
                  {y.slice(0, 4)}
                </th>
              ))}
              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#999] w-20">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, data, prefix }, ri) => {
              const vals = displayYears.map(y => data[y] ?? null);
              const sparkVals = vals.filter((v): v is number => v != null);
              const latest = vals[vals.length - 1];
              const prev   = vals.slice(0, -1).reverse().find(v => v != null);
              const yoy    = latest != null && prev != null && prev !== 0
                ? ((latest - prev) / Math.abs(prev)) * 100 : null;
              return (
                <tr key={label} className={`border-b border-[#f0f0f0] last:border-0 ${ri % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}`}>
                  <td className="px-4 py-2.5 text-[11.5px] font-semibold text-[#333]">
                    <div>{label}</div>
                    {yoy != null && (
                      <div className="text-[10px] font-normal mt-0.5" style={{ color: pctColor(yoy) }}>
                        {yoy > 0 ? "+" : ""}{yoy.toFixed(1)}% YoY
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

// ── Section text renderer ─────────────────────────────────────────────────────

function SectionText({ text }: { text: string }) {
  const cleaned = text
    .replace(/^(ITEM\s+\d+[A-Z]?\s*[\.\-—]+\s*[^\n]*\n)/im, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paragraphs = cleaned.split(/\n\n+/);
  return (
    <div className="space-y-3">
      {paragraphs.slice(0, 40).map((para, i) => {
        const t = para.trim();
        if (!t) return null;
        const isHeader = t.length < 120 && /^[A-Z\s\d\-—:]+$/.test(t) && !t.endsWith(".");
        if (isHeader) return (
          <p key={i} className="text-[10.5px] font-bold tracking-[0.12em] uppercase text-[#0c1b38] mt-4 first:mt-0">{t}</p>
        );
        return (
          <p key={i} className="text-[12.5px] text-[#333] leading-[1.75]">{t}</p>
        );
      })}
    </div>
  );
}

// ── Section viewer ────────────────────────────────────────────────────────────

const SECTION_TABS = [
  { key: "business", label: "Business Overview" },
  { key: "risks",    label: "Risk Factors" },
  { key: "mda",      label: "MD&A Annual" },
  { key: "mda_q",    label: "MD&A Quarterly" },
];

function SectionViewer({ annual, quarterly }: { annual: FilingData | null; quarterly: FilingData | null }) {
  const [active, setActive] = useState("business");
  const [expanded, setExpanded] = useState(false);

  const section = active === "mda_q"
    ? quarterly?.sections.find(s => s.item === "mda")
    : annual?.sections.find(s => s.item === active);

  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      <div className="flex border-b border-[#ebebeb] bg-[#fafafa] overflow-x-auto">
        {SECTION_TABS.map(({ key, label }) => {
          const hasSec = key === "mda_q"
            ? quarterly?.sections.some(s => s.item === "mda")
            : annual?.sections.some(s => s.item === key);
          return (
            <button key={key} onClick={() => { setActive(key); setExpanded(false); }}
              disabled={!hasSec}
              className={`px-4 py-3 text-[11.5px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                active === key
                  ? "border-[#0c1b38] text-[#0c1b38]"
                  : hasSec
                    ? "border-transparent text-[#888] hover:text-[#444]"
                    : "border-transparent text-[#ccc] cursor-not-allowed"
              }`}>
              {label}
            </button>
          );
        })}
      </div>
      <div className="p-5">
        {section ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[12px] font-semibold text-[#0a0a0a]">{section.title}</p>
                <p className="text-[10px] text-[#bbb] mt-0.5">{section.char_count.toLocaleString()} characters</p>
              </div>
              <button onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-[10.5px] text-[#0c1b38] font-semibold hover:underline shrink-0">
                {expanded ? <><ChevronUp size={12}/> Collapse</> : <><ChevronDown size={12}/> Show full</>}
              </button>
            </div>
            <div className={`relative overflow-hidden transition-all ${expanded ? "" : "max-h-80"}`}>
              <SectionText text={section.text} />
              {!expanded && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              )}
            </div>
          </>
        ) : (
          <p className="text-[12px] text-[#bbb] py-8 text-center">Section not available in this filing extract.</p>
        )}
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

          {/* Company card */}
          <div className="p-5 border border-[#d0d7e8] rounded-lg bg-[#fafcff] flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-[30px] font-bold text-[#0c1b38] leading-none">{data.company.ticker}</span>
                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full border border-[#c8d0e8] bg-[#eef1f8] text-[#0c1b38]">SEC EDGAR</span>
              </div>
              <p className="text-[16px] font-medium text-[#0a0a0a] mb-0.5">{data.company.name}</p>
              <p className="text-[11.5px] text-[#999]">{data.company.sic_description || "—"} · CIK {data.company.cik}</p>
            </div>
            <div className="flex gap-6 text-[11.5px] shrink-0 items-start">
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#bbb] mb-1">Latest 10-K</p>
                <p className="font-semibold text-[#0a0a0a]">{data.annual?.period_of_report ?? "—"}</p>
                <p className="text-[#bbb] text-[10.5px]">filed {data.annual?.filed_date ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#bbb] mb-1">Latest 10-Q</p>
                <p className="font-semibold text-[#0a0a0a]">{data.quarterly?.period_of_report ?? "—"}</p>
                <p className="text-[#bbb] text-[10.5px]">filed {data.quarterly?.filed_date ?? "—"}</p>
              </div>
              <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.company.cik}&type=10-K&dateb=&owner=include&count=10`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 self-center text-[#0c1b38] font-semibold text-[11.5px] hover:underline mt-4">
                EDGAR <ExternalLink size={10} />
              </a>
            </div>
          </div>

          {/* Key Financials */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Key Financials — Most Recent Annual (XBRL)</p>
            <FinancialStatements facts={data.xbrl_facts} history={data.history ?? {}} />
          </div>

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
