"use client";
import { useState, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import { Search, FileText, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CompanyMeta = {
  ticker: string; name: string; cik: string;
  sic: string; sic_description: string;
};
type FilingMeta  = { period?: string; filed?: string };
type XBRLFacts   = Record<string, number | null>;

type StreamMeta  = {
  company: CompanyMeta;
  annual:  FilingMeta;
  quarterly: FilingMeta;
  xbrl: XBRLFacts;
};

// ── Suggested tickers ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "AAPL","MSFT","NVDA","META","AMZN","GOOGL","TSLA","JPM","BRK-B",
  "V","JNJ","UNH","XOM","WMT","MA","LLY","AVGO","CVX","HD",
  // portfolio names
  "UBER","DUOL","PYPL","HOOD","APLD","CMG","VOO",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined, prefix = "", suffix = ""): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e9)  return `${prefix}${(n / 1e9).toFixed(1)}B${suffix}`;
  if (Math.abs(n) >= 1e6)  return `${prefix}${(n / 1e6).toFixed(1)}M${suffix}`;
  if (Math.abs(n) >= 1e3)  return `${prefix}${(n / 1e3).toFixed(1)}K${suffix}`;
  return `${prefix}${n.toFixed(2)}${suffix}`;
}

const XBRL_LABELS: Record<string, { label: string; prefix: string; suffix: string }> = {
  revenue:          { label: "Revenue",          prefix: "$", suffix: "" },
  net_income:       { label: "Net Income",        prefix: "$", suffix: "" },
  gross_profit:     { label: "Gross Profit",      prefix: "$", suffix: "" },
  operating_income: { label: "Operating Income",  prefix: "$", suffix: "" },
  eps_diluted:      { label: "EPS (Diluted)",     prefix: "$", suffix: "" },
  long_term_debt:   { label: "Long-Term Debt",    prefix: "$", suffix: "" },
  cash:             { label: "Cash & Equivalents",prefix: "$", suffix: "" },
  rd_expense:       { label: "R&D Expense",       prefix: "$", suffix: "" },
  shares_outstanding:{ label: "Shares Outstanding", prefix: "", suffix: "" },
};

// ── Mini markdown renderer (reused from morning page) ─────────────────────────

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
    if (!t) { nodes.push(<div key={i} className="h-3" />); return; }
    if (t.startsWith("**") && t.endsWith("**") && !t.slice(2, -2).includes("**")) {
      nodes.push(<p key={i} className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#0c1b38] mt-5 mb-2 first:mt-0">{t.slice(2, -2)}</p>);
    } else if (t.startsWith("• ") || t.startsWith("- ")) {
      nodes.push(
        <div key={i} className="flex items-start gap-2 py-0.5">
          <span className="w-1 h-1 rounded-full bg-[#0c1b38] mt-[7px] shrink-0" />
          <p className="text-[12.5px] text-[#333] leading-[1.7]">{inline(t.slice(2), i)}</p>
        </div>
      );
    } else if (/^\d+\.\s/.test(t)) {
      const num = t.match(/^(\d+)\./)?.[1] ?? "";
      nodes.push(
        <div key={i} className="flex items-start gap-2.5 py-0.5">
          <span className="text-[10px] font-bold text-[#0c1b38] mt-[3px] w-4 shrink-0">{num}.</span>
          <p className="text-[12.5px] text-[#333] leading-[1.7]">{inline(t.replace(/^\d+\.\s*/, ""), i)}</p>
        </div>
      );
    } else if (t.startsWith("---")) {
      nodes.push(<hr key={i} className="border-[#ebebeb] my-3" />);
    } else {
      nodes.push(<p key={i} className="text-[12.5px] text-[#1a1a1a] leading-[1.8]">{inline(t, i)}</p>);
    }
  });

  return <div className="space-y-[2px]">{nodes}</div>;
}

// ── Collapsible section ───────────────────────────────────────────────────────

function CollapsibleSection({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#fafafa] transition-colors">
        <div className="flex items-center gap-3">
          <p className="text-[11.5px] font-semibold text-[#0a0a0a]">{title}</p>
          {badge && <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[#eef1f8] text-[#0c1b38] border border-[#c8d0e8]">{badge}</span>}
        </div>
        {open ? <ChevronUp size={14} className="text-[#bbb]" /> : <ChevronDown size={14} className="text-[#bbb]" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-[#f5f5f5]"><div className="pt-4 text-[12px] text-[#555] leading-relaxed whitespace-pre-wrap font-mono text-[11px]">{children}</div></div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TenKPage() {
  const [ticker, setTicker]       = useState("");
  const [status, setStatus]       = useState<"idle"|"loading"|"streaming"|"done"|"error">("idle");
  const [errorMsg, setErrorMsg]   = useState("");
  const [meta, setMeta]           = useState<StreamMeta | null>(null);
  const [analysis, setAnalysis]   = useState("");
  const [rawOpen, setRawOpen]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(sym?: string) {
    const t = (sym ?? ticker).toUpperCase().trim();
    if (!t) return;
    if (sym) setTicker(sym);

    setStatus("loading");
    setErrorMsg("");
    setMeta(null);
    setAnalysis("");

    try {
      const r = await fetch("/api/sec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t }),
      });
      if (!r.ok || !r.body) throw new Error(`API error ${r.status}`);

      setStatus("streaming");
      const reader = r.body.getReader();
      const dec    = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of dec.decode(value, { stream: true }).split("\n")) {
          const raw = line.startsWith("data: ") ? line.slice(6).trim() : null;
          if (!raw || raw === "[DONE]") continue;
          try {
            const j = JSON.parse(raw);
            if (j.error)  { setErrorMsg(j.error); setStatus("error"); return; }
            if (j.meta)   setMeta(j.meta as StreamMeta);
            if (j.text)   setAnalysis(prev => prev + j.text);
          } catch { /* skip */ }
        }
      }
      setStatus("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  }

  const busy = status === "loading" || status === "streaming";

  return (
    <AppShell>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 pb-6 border-b border-[#ebebeb]">
        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#0c1b38] mb-2">10-K & 10-Q Analysis</p>
        <h1 className="text-[34px] font-light text-[#0a0a0a] tracking-tight leading-none mb-3"
            style={{ fontFamily: "var(--font-serif)" }}>
          SEC Filing Intelligence
        </h1>
        <p className="text-[13px] text-[#9ca3af]">
          Powered by edgartools + Claude · Pulls the latest 10-K and 10-Q directly from SEC EDGAR, extracts MD&amp;A, risk factors, and financial data, then generates an institutional research note.
        </p>
      </div>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
            <input
              ref={inputRef}
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && !busy && run()}
              placeholder="Enter ticker — e.g. AAPL, NVDA, META"
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#d0d7e8] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0c1b38]/20 focus:border-[#0c1b38] placeholder:text-[#ccc] transition-colors"
            />
          </div>
          <button onClick={() => run()} disabled={busy || !ticker.trim()}
            className="px-5 py-2.5 bg-[#0c1b38] text-white text-[12px] font-semibold rounded-md hover:bg-[#1a3361] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
            {busy ? (
              <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {status === "loading" ? "Fetching SEC data…" : "Analyzing…"}</>
            ) : (
              <><FileText size={13} /> Analyze Filing</>
            )}
          </button>
        </div>

        {/* Quick-pick tickers */}
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => run(s)} disabled={busy}
              className="text-[10.5px] font-semibold px-2.5 py-1 rounded border border-[#e8e8e8] text-[#555] hover:border-[#0c1b38] hover:text-[#0c1b38] hover:bg-[#eef1f8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {status === "error" && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[12.5px] font-semibold text-red-700">Analysis failed</p>
            <p className="text-[11.5px] text-red-600 mt-0.5">{errorMsg}</p>
            {errorMsg.includes("SEC service") && (
              <p className="text-[11px] text-red-500 mt-1">
                Make sure the Python sidecar is running: <code className="bg-red-100 px-1 rounded">cd sec-service && uvicorn main:app --reload</code>
                {" "}and SEC_SERVICE_URL is set.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Company + Filing Metadata ───────────────────────────────────────── */}
      {meta && (
        <div className="mb-7 p-5 border border-[#ebebeb] rounded-lg bg-[#fafafa]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-[22px] font-semibold text-[#0c1b38]">{meta.company.ticker}</span>
                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full border border-[#c8d0e8] bg-[#eef1f8] text-[#0c1b38]">SEC EDGAR</span>
              </div>
              <p className="text-[14px] font-medium text-[#0a0a0a] mb-1">{meta.company.name}</p>
              <p className="text-[11.5px] text-[#999]">{meta.company.sic_description} · CIK {meta.company.cik}</p>
            </div>
            <div className="flex gap-5 text-[11.5px] shrink-0">
              <div className="text-right">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#bbb] mb-1">Latest 10-K</p>
                <p className="font-semibold text-[#0a0a0a]">{meta.annual.period ?? "—"}</p>
                <p className="text-[#bbb]">filed {meta.annual.filed ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#bbb] mb-1">Latest 10-Q</p>
                <p className="font-semibold text-[#0a0a0a]">{meta.quarterly.period ?? "—"}</p>
                <p className="text-[#bbb]">filed {meta.quarterly.filed ?? "—"}</p>
              </div>
              <div className="text-right">
                <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${meta.company.cik}&type=10-K&dateb=&owner=include&count=10`}
                   target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1 text-[#0c1b38] font-semibold hover:underline">
                  View on EDGAR <ExternalLink size={11} />
                </a>
              </div>
            </div>
          </div>

          {/* XBRL financial snapshot */}
          {Object.keys(meta.xbrl).length > 0 && (
            <div className="mt-5 pt-4 border-t border-[#ebebeb]">
              <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#bbb] mb-3">Financial Snapshot (XBRL)</p>
              <div className="grid grid-cols-5 gap-3">
                {Object.entries(XBRL_LABELS).map(([key, { label, prefix, suffix }]) => {
                  const val = meta.xbrl[key];
                  if (val == null) return null;
                  const color = key === "net_income" || key === "operating_income"
                    ? val >= 0 ? "#147a4f" : "#b42318"
                    : "#0a0a0a";
                  return (
                    <div key={key} className="border border-[#ebebeb] rounded-md px-3 py-2.5 bg-white">
                      <p className="text-[9.5px] text-[#999] uppercase tracking-wide mb-1">{label}</p>
                      <p className="text-[15px] font-semibold tabular-nums" style={{ color }}>
                        {fmtNum(val, prefix, suffix)}
                      </p>
                    </div>
                  );
                }).filter(Boolean).slice(0, 10)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Streaming analysis ──────────────────────────────────────────────── */}
      {(analysis || status === "streaming") && (
        <div className="border border-[#ebebeb] rounded-lg overflow-hidden">
          <div className="bg-[#0c1b38] px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/50 mb-1">AI Research Note</p>
              <p className="text-[13px] font-medium text-white">
                {meta?.company.name ?? ticker} — Institutional Equity Analysis
              </p>
            </div>
            <div className="flex items-center gap-3">
              {status === "streaming" && (
                <span className="flex items-center gap-1.5 text-[10.5px] text-white/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Streaming…
                </span>
              )}
              {status === "done" && analysis && (
                <button onClick={() => navigator.clipboard.writeText(analysis)}
                  className="text-[10.5px] font-semibold text-white/50 hover:text-white border border-white/20 hover:border-white/40 px-2.5 py-1 rounded-md transition-colors">
                  Copy
                </button>
              )}
              <TrendingUp size={16} className="text-white/30" />
            </div>
          </div>

          <div className="p-6">
            {analysis ? (
              <BriefBody text={analysis} />
            ) : (
              <div className="flex items-center gap-3 py-8 justify-center text-[12px] text-[#bbb]">
                <span className="w-4 h-4 border-2 border-[#0c1b38] border-t-transparent rounded-full animate-spin" />
                Fetching SEC filing and building analysis…
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Idle state ─────────────────────────────────────────────────────── */}
      {status === "idle" && (
        <div className="border border-dashed border-[#e0e0e0] rounded-lg py-16 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[#eef1f8] flex items-center justify-center">
            <FileText size={20} className="text-[#0c1b38]" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-[#0a0a0a] mb-1">SEC Filing Analysis</p>
            <p className="text-[12.5px] text-[#999] max-w-md">
              Enter a ticker above or click a quick-pick to fetch the latest 10-K and 10-Q directly from SEC EDGAR and generate an institutional research note with Claude.
            </p>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-[#bbb] mt-2">
            <span>✓ Live EDGAR data</span>
            <span>✓ MD&amp;A + Risk Factors</span>
            <span>✓ XBRL financials</span>
            <span>✓ Claude Sonnet analysis</span>
          </div>
        </div>
      )}

      {/* ── Setup notice ───────────────────────────────────────────────────── */}
      <div className="mt-8 border border-amber-200 bg-amber-50 rounded-lg px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-2">Setup Required</p>
        <p className="text-[12px] text-amber-700 mb-3">
          This page requires the Python SEC sidecar service to be running. Deploy it once and set <code className="bg-amber-100 px-1 rounded">SEC_SERVICE_URL</code> in your environment.
        </p>
        <div className="space-y-1.5 text-[11.5px] font-mono text-amber-800 bg-amber-100 rounded-md px-4 py-3">
          <p># Install and run locally</p>
          <p>cd sec-service</p>
          <p>pip install -r requirements.txt</p>
          <p>uvicorn main:app --reload --port 8000</p>
          <p className="mt-2"># Then add to .env.local:</p>
          <p>SEC_SERVICE_URL=http://localhost:8000</p>
          <p className="mt-2"># Or deploy to Railway and set:</p>
          <p>SEC_SERVICE_URL=https://your-service.railway.app</p>
        </div>
      </div>

    </AppShell>
  );
}
