"use client";
import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { Search, FileText, AlertTriangle, ChevronDown, ChevronUp, Sparkles, ExternalLink, TrendingUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilingSection = { item: string; title: string; text: string; char_count: number };
type FilingData    = { form_type: string; accession: string; filed_date: string; period_of_report: string; sections: FilingSection[]; raw_financials: Record<string, number> };
type CompanyInfo   = { ticker: string; name: string; cik: string; sic: string; sic_description: string };
type Payload       = { company: CompanyInfo; annual: FilingData | null; quarterly: FilingData | null; xbrl_facts: Record<string, number> };

// ── Quick-picks ───────────────────────────────────────────────────────────────

const SUGGESTIONS = ["AAPL","MSFT","NVDA","META","AMZN","GOOGL","TSLA","JPM","BRK-B","V","JNJ","UNH","XOM","WMT","UBER","DUOL","PYPL","HOOD","APLD","CMG"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined, prefix = ""): string {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${n.toFixed(2)}`;
}

const XBRL_LABELS: Record<string, { label: string; prefix: string; color?: string }> = {
  revenue:           { label: "Revenue",            prefix: "$" },
  gross_profit:      { label: "Gross Profit",        prefix: "$" },
  operating_income:  { label: "Operating Income",    prefix: "$", color: "dynamic" },
  net_income:        { label: "Net Income",          prefix: "$", color: "dynamic" },
  eps_diluted:       { label: "EPS (Diluted)",       prefix: "$", color: "dynamic" },
  cash:              { label: "Cash & Equiv.",       prefix: "$" },
  long_term_debt:    { label: "Long-Term Debt",      prefix: "$" },
  rd_expense:        { label: "R&D Expense",         prefix: "$" },
  shares_outstanding:{ label: "Shares Outstanding",  prefix: "" },
};

// ── Markdown renderer ─────────────────────────────────────────────────────────

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
    } else if (t.startsWith("---")) {
      nodes.push(<hr key={i} className="border-[#ebebeb] my-3" />);
    } else {
      nodes.push(<p key={i} className="text-[12.5px] text-[#1a1a1a] leading-[1.8]">{inline(t, i)}</p>);
    }
  });
  return <div className="space-y-[2px]">{nodes}</div>;
}

// ── Section viewer ────────────────────────────────────────────────────────────

const SECTION_TABS = [
  { key: "business", label: "Business Overview" },
  { key: "risks",    label: "Risk Factors" },
  { key: "mda",      label: "MD&A (Annual)" },
  { key: "mda_q",    label: "MD&A (Quarterly)" },
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
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb]">
                {section.char_count.toLocaleString()} chars · {section.title}
              </p>
              <button onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-[10.5px] text-[#0c1b38] font-semibold hover:underline">
                {expanded ? <><ChevronUp size={12}/> Collapse</> : <><ChevronDown size={12}/> Show full</>}
              </button>
            </div>
            <div className={`relative overflow-hidden transition-all ${expanded ? "" : "max-h-72"}`}>
              <pre className="text-[11px] text-[#333] leading-relaxed whitespace-pre-wrap font-mono">
                {section.text}
              </pre>
              {!expanded && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none" />
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
          Browse sections and financials directly from SEC EDGAR. AI research note is optional.
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
          <p className="text-[11.5px] text-[#bbb]">This takes 15–30 seconds for first load</p>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-6">

          {/* Company card */}
          <div className="p-5 border border-[#ebebeb] rounded-lg bg-[#fafafa] flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[26px] font-semibold text-[#0c1b38]">{data.company.ticker}</span>
                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full border border-[#c8d0e8] bg-[#eef1f8] text-[#0c1b38]">SEC EDGAR</span>
              </div>
              <p className="text-[15px] font-medium text-[#0a0a0a] mb-0.5">{data.company.name}</p>
              <p className="text-[11.5px] text-[#999]">{data.company.sic_description || "—"} · CIK {data.company.cik}</p>
            </div>
            <div className="flex gap-6 text-[11.5px] shrink-0 items-start">
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#bbb] mb-1">Latest 10-K</p>
                <p className="font-semibold text-[#0a0a0a]">{data.annual?.period_of_report ?? "—"}</p>
                <p className="text-[#bbb] text-[11px]">filed {data.annual?.filed_date ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#bbb] mb-1">Latest 10-Q</p>
                <p className="font-semibold text-[#0a0a0a]">{data.quarterly?.period_of_report ?? "—"}</p>
                <p className="text-[#bbb] text-[11px]">filed {data.quarterly?.filed_date ?? "—"}</p>
              </div>
              <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.company.cik}&type=10-K&dateb=&owner=include&count=10`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 self-center text-[#0c1b38] font-semibold text-[11.5px] hover:underline mt-4">
                View on EDGAR <ExternalLink size={10} />
              </a>
            </div>
          </div>

          {/* XBRL Financial Snapshot */}
          {Object.keys(data.xbrl_facts).length > 0 ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Financial Snapshot (XBRL — Most Recent Annual)</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {Object.entries(XBRL_LABELS).map(([key, { label, prefix, color }]) => {
                  const val = data.xbrl_facts[key];
                  if (val == null) return null;
                  const textColor = color === "dynamic" ? (val >= 0 ? "#147a4f" : "#b42318") : "#0a0a0a";
                  return (
                    <div key={key} className="border border-[#ebebeb] rounded-md px-3 py-3 bg-white">
                      <p className="text-[9px] text-[#999] uppercase tracking-wide mb-1.5">{label}</p>
                      <p className="text-[16px] font-semibold tabular-nums leading-none" style={{ color: textColor }}>
                        {fmtNum(val, prefix)}
                      </p>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </div>
          ) : (
            <div className="border border-[#ebebeb] rounded-lg px-5 py-4 bg-[#fafafa]">
              <p className="text-[11.5px] text-[#999]">XBRL financial data not available for this filing — section text is still accessible below.</p>
            </div>
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
                  Claude Sonnet reads the filing and writes an analyst-grade research note with risk factors, investment thesis, and ratings.
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
              Enter a ticker to pull the latest 10-K and 10-Q from EDGAR. Browse sections and financials — generate an AI research note only when you need it.
            </p>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-[#bbb] mt-2">
            <span>✓ Live EDGAR data</span>
            <span>✓ MD&A + Risk Factors</span>
            <span>✓ XBRL financials</span>
            <span>✓ Optional AI note</span>
          </div>
        </div>
      )}

    </AppShell>
  );
}
