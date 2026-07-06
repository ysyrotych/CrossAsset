"use client";
import { useState, useRef, useCallback } from "react";
import { RefreshCw, Brain, Copy, Check, TrendingUp, TrendingDown, Minus } from "lucide-react";

// ── Category palette ──────────────────────────────────────────────────────────

const CAT_BG: Record<string, string> = {
  "EARNINGS":           "#0e2240",
  "GUIDANCE":           "#3d2000",
  "ANALYST ACTION":     "#0e1f40",
  "M&A":                "#250d50",
  "REGULATORY/LEGAL":   "#3d0d0d",
  "MANAGEMENT":         "#0d2c1c",
  "CAPITAL ALLOCATION": "#073028",
  "PRODUCT/BUSINESS":   "#0d1f38",
  "INSIDER ACTIVITY":   "#301800",
  "GENERAL":            "#111827",
};
const CAT_FG: Record<string, string> = {
  "EARNINGS":           "#93c5fd",
  "GUIDANCE":           "#fcd34d",
  "ANALYST ACTION":     "#a5b4fc",
  "M&A":                "#c4b5fd",
  "REGULATORY/LEGAL":   "#fca5a5",
  "MANAGEMENT":         "#6ee7b7",
  "CAPITAL ALLOCATION": "#34d399",
  "PRODUCT/BUSINESS":   "#7dd3fc",
  "INSIDER ACTIVITY":   "#fdba74",
  "GENERAL":            "#94a3b8",
};

// ── Section metadata (icon + accent) ─────────────────────────────────────────

const SEC_META: Record<string, { icon: string; color: string; short: string }> = {
  "FLASH ASSESSMENT":                          { icon: "⚡", color: "#818cf8", short: "Flash" },
  "THE NARRATIVE RIGHT NOW":                   { icon: "📡", color: "#3b82f6", short: "Narrative" },
  "EARNINGS & FINANCIAL SIGNALS":              { icon: "📊", color: "#10b981", short: "Earnings" },
  "COMPETITIVE & STRATEGIC POSITION":          { icon: "⚔️",  color: "#8b5cf6", short: "Competitive" },
  "MANAGEMENT CREDIBILITY & INSIDER SIGNALS":  { icon: "👁️",  color: "#f59e0b", short: "Management" },
  "ANALYST & INSTITUTIONAL SENTIMENT SHIFT":   { icon: "🏦", color: "#06b6d4", short: "Analysts" },
  "REGULATORY & LEGAL WATCH":                  { icon: "⚖️",  color: "#ef4444", short: "Regulatory" },
  "MARKET PRICING REALITY CHECK":              { icon: "💹", color: "#ec4899", short: "Pricing" },
  "CATALYSTS TO WATCH — NEXT 30-60 DAYS":     { icon: "🎯", color: "#f97316", short: "Catalysts" },
  "EMERGING RISKS IN THE NEWS":                { icon: "⚠️",  color: "#dc2626", short: "Risks" },
  "ONE-PARAGRAPH VERDICT":                     { icon: "✦",  color: "#6366f1", short: "Verdict" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface NewsItem {
  date: string;
  title: string;
  summary?: string;
  source?: string;
  url?: string;
  stock_change?: string | null;
  category?: string;
}

interface Props {
  ticker: string;
  companyName: string;
  sector?: string;
  newsItems: NewsItem[];
  facts?: Record<string, any>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAnalysisSections(text: string): { title: string; content: string }[] {
  const secs: { title: string; content: string }[] = [];
  let cur: { title: string; content: string } | null = null;
  for (const line of text.split("\n")) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) {
      if (cur) secs.push(cur);
      cur = { title: h[1].trim(), content: "" };
    } else if (cur) {
      cur.content += line + "\n";
    }
  }
  if (cur) secs.push(cur);
  return secs.filter(s => s.content.trim().length > 0);
}

function dateGroup(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "TODAY";
    if (diffDays === 1) return "YESTERDAY";
    if (diffDays <= 7) return "THIS WEEK";
    if (diffDays <= 30) return "THIS MONTH";
    return "EARLIER";
  } catch { return "EARLIER"; }
}

function groupByDate(items: NewsItem[]): { group: string; items: NewsItem[] }[] {
  const ORDER = ["TODAY", "YESTERDAY", "THIS WEEK", "THIS MONTH", "EARLIER"];
  const map: Record<string, NewsItem[]> = {};
  for (const item of items) {
    const g = dateGroup(item.date ?? "");
    if (!map[g]) map[g] = [];
    map[g].push(item);
  }
  return ORDER.filter(g => map[g]).map(g => ({ group: g, items: map[g] }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewsAnalyst({ ticker, companyName, sector, newsItems, facts }: Props) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading]   = useState(false);
  const [activeCat, setActiveCat] = useState("ALL");
  const [copied, setCopied]     = useState(false);
  const analysisRef             = useRef<HTMLDivElement>(null);
  const sectionRefs             = useRef<Record<string, HTMLDivElement | null>>({});

  const sections = parseAnalysisSections(analysis);
  const cats = ["ALL", ...Array.from(new Set(newsItems.map(n => n.category ?? "GENERAL"))).sort()];
  const filtered = activeCat === "ALL" ? newsItems : newsItems.filter(n => (n.category ?? "GENERAL") === activeCat);
  const grouped  = groupByDate(filtered);

  // 30-day sentiment
  const last30 = newsItems.filter(n => {
    try { return new Date(n.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); } catch { return false; }
  });
  const posTerms = ["beat","raise","launch","win","grow","record","strong","exceed","upgrade","buy","positive","initiate","partnership","bullish"];
  const negTerms = ["cut","miss","decline","drop","fall","concern","risk","probe","loss","lower","warn","resign","downgrade","short","bearish"];
  let sentScore = 0;
  for (const n of last30) {
    const tl = (n.title ?? "").toLowerCase();
    sentScore += posTerms.filter(t => tl.includes(t)).length;
    sentScore -= negTerms.filter(t => tl.includes(t)).length;
  }
  const sentLabel = sentScore > 3 ? "POSITIVE" : sentScore < -3 ? "NEGATIVE" : "MIXED";
  const sentColor = sentScore > 3 ? "#10b981" : sentScore < -3 ? "#ef4444" : "#f59e0b";

  const scrollTo = useCallback((title: string) => {
    const el = sectionRefs.current[title];
    if (el && analysisRef.current) analysisRef.current.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
  }, []);

  async function runAnalysis() {
    setLoading(true);
    setAnalysis("");
    try {
      const res = await fetch("/api/news-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, companyName, sector, newsItems, facts }),
      });
      if (!res.body) { setLoading(false); return; }
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAnalysis(text);
        if (analysisRef.current) analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function copyAnalysis() {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // ── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: "#040d1c", border: "1px solid #1a2d4a", borderRadius: 12, overflow: "hidden" }}>

      {/* ── MASTHEAD ── */}
      <div style={{ background: "#06111f", borderBottom: "2px solid #1a2d4a", padding: "0 24px" }}>
        {/* Top strip */}
        <div style={{ borderBottom: "1px solid #1a2d4a", padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", color: "#3b82f6", textTransform: "uppercase" }}>
              Market Intelligence
            </span>
            <span style={{ fontSize: 9, color: "#1a2d4a" }}>│</span>
            <span style={{ fontSize: 9, color: "#334155" }}>{today}</span>
            <span style={{ fontSize: 9, color: "#1a2d4a" }}>│</span>
            <span style={{ fontSize: 9, color: "#334155" }}>{newsItems.length} items · {last30.length} in 30d</span>
            <span style={{ fontSize: 9, color: "#1a2d4a" }}>│</span>
            <span style={{ fontSize: 9, color: "#334155" }}>yfinance · Finviz · Seeking Alpha</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Sentiment */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: `${sentColor}14`, border: `1px solid ${sentColor}40`, borderRadius: 4, padding: "3px 9px" }}>
              {sentScore > 3 ? <TrendingUp size={10} color={sentColor} /> : sentScore < -3 ? <TrendingDown size={10} color={sentColor} /> : <Minus size={10} color={sentColor} />}
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: sentColor }}>{sentLabel}</span>
            </div>
            {/* Copy */}
            {analysis && (
              <button onClick={copyAnalysis} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "1px solid #1a2d4a", borderRadius: 4, padding: "3px 9px", cursor: "pointer", fontSize: 9, color: "#475569" }}>
                {copied ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
            {/* Analyze */}
            <button onClick={runAnalysis} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, background: loading ? "#0a1520" : "#1e3a5f", border: `1px solid ${loading ? "#1a2d4a" : "#2d5a9f"}`, borderRadius: 5, padding: "5px 14px", cursor: loading ? "not-allowed" : "pointer", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: loading ? "#334155" : "#93c5fd" }}>
              {loading ? <RefreshCw size={11} style={{ animation: "na-spin 1s linear infinite" }} /> : <Brain size={11} />}
              {loading ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze"}
            </button>
          </div>
        </div>

        {/* Main masthead line */}
        <div style={{ padding: "16px 0 12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-0.02em", margin: 0, lineHeight: 1 }}>
              {ticker}
            </h1>
            <div style={{ width: 1, height: 28, background: "#1a2d4a", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 300, color: "#64748b", letterSpacing: "0.02em" }}>
              {companyName}
            </span>
            {sector && <>
              <span style={{ fontSize: 11, color: "#1a2d4a" }}>·</span>
              <span style={{ fontSize: 11, color: "#334155", letterSpacing: "0.04em" }}>{sector}</span>
            </>}
          </div>
          <p style={{ fontSize: 11, color: "#334155", marginTop: 4, letterSpacing: "0.06em", fontWeight: 600, textTransform: "uppercase" }}>
            News Intelligence Brief
          </p>
        </div>

        {/* Section nav chips — visible after analysis loads */}
        {sections.length > 0 && (
          <div style={{ borderTop: "1px solid #0d1a28", padding: "8px 0", display: "flex", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 8.5, color: "#334155", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", alignSelf: "center", marginRight: 4 }}>Sections:</span>
            {sections.map(sec => {
              const m = SEC_META[sec.title] ?? { icon: "•", color: "#3b82f6", short: sec.title.slice(0, 12) };
              return (
                <button key={sec.title} onClick={() => scrollTo(sec.title)} style={{ display: "flex", alignItems: "center", gap: 3, background: "#040d1c", border: `1px solid #1a2d4a`, borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 8.5, fontWeight: 700, color: m.color, letterSpacing: "0.04em" }}>
                  <span style={{ fontSize: 10 }}>{m.icon}</span>
                  {m.short}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FLASH ASSESSMENT BANNER ── */}
      {sections[0]?.title === "FLASH ASSESSMENT" && (() => {
        const sec = sections[0];
        const sigM = sec.content.match(/SIGNAL:\s*(\w+)/i);
        const patM = sec.content.match(/PATTERN:\s*([^|\n]+)/i);
        const conM = sec.content.match(/CONVICTION:\s*(\w+)/i);
        const signal = sigM?.[1]?.toUpperCase() ?? "";
        const pattern = patM?.[1]?.trim() ?? "";
        const conviction = conM?.[1]?.toUpperCase() ?? "";
        const bodyLines = sec.content.trim().split("\n").filter(Boolean).slice(1).join(" ").trim();
        const sigColor = signal === "BULLISH" ? "#10b981" : signal === "BEARISH" ? "#ef4444" : "#f59e0b";
        if (!signal) return null;
        return (
          <div style={{ background: `${sigColor}08`, borderBottom: `1px solid ${sigColor}25`, padding: "14px 24px", display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
              <div style={{ background: `${sigColor}20`, border: `1px solid ${sigColor}50`, borderRadius: 5, padding: "6px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.12em", color: `${sigColor}99`, textTransform: "uppercase" }}>Signal</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: sigColor, letterSpacing: "0.04em" }}>{signal}</div>
              </div>
              {pattern && (
                <div style={{ background: "#06111f", border: "1px solid #1a2d4a", borderRadius: 5, padding: "6px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.12em", color: "#334155", textTransform: "uppercase" }}>Pattern</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{pattern}</div>
                </div>
              )}
              {conviction && (
                <div style={{ background: "#06111f", border: "1px solid #1a2d4a", borderRadius: 5, padding: "6px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.12em", color: "#334155", textTransform: "uppercase" }}>Conviction</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: conviction === "HIGH" ? "#10b981" : conviction === "LOW" ? "#ef4444" : "#f59e0b" }}>{conviction}</div>
                </div>
              )}
            </div>
            {bodyLines && (
              <p style={{ fontSize: 12, color: "#c8dcff", lineHeight: 1.7, fontStyle: "italic", margin: 0, paddingTop: 4 }}>
                {bodyLines}
              </p>
            )}
          </div>
        );
      })()}

      {/* ── MAIN BODY: two-column newspaper ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", minHeight: 700 }}>

        {/* LEFT: Editorial analysis */}
        <div ref={analysisRef} style={{ padding: "24px 28px", overflowY: "auto", maxHeight: 780, borderRight: "1px solid #1a2d4a" }}>

          {/* Empty state */}
          {!analysis && !loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 500, gap: 16, textAlign: "center" }}>
              <div style={{ fontSize: 40, lineHeight: 1 }}>📰</div>
              <p style={{ fontSize: 16, color: "#1e3a5f", fontWeight: 700, margin: 0 }}>
                Click <span style={{ color: "#3b82f6" }}>Analyze</span> to generate the brief
              </p>
              <p style={{ fontSize: 12, color: "#1a2d4a", lineHeight: 1.6, maxWidth: 340, margin: 0 }}>
                Claude reads all {newsItems.length} news items and writes a structured editorial — narrative, earnings signals, competitive dynamics, analyst sentiment, catalysts, and risks.
              </p>
              {/* Preview section chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: 380 }}>
                {Object.entries(SEC_META).slice(1, 7).map(([, m]) => (
                  <span key={m.short} style={{ fontSize: 9, color: m.color, background: `${m.color}12`, border: `1px solid ${m.color}28`, borderRadius: 4, padding: "3px 8px" }}>
                    {m.icon} {m.short}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && sections.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ opacity: 0.7 - i * 0.15 }}>
                  <div style={{ height: 9, background: "#0d1e33", borderRadius: 3, width: "20%", marginBottom: 14 }} />
                  <div style={{ height: 1, background: "#0d1e33", marginBottom: 14 }} />
                  {[...Array(4)].map((_, j) => (
                    <div key={j} style={{ height: 8, background: "#060f1e", borderRadius: 3, width: `${90 - j * 10}%`, marginBottom: 8 }} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Rendered sections (skip FLASH ASSESSMENT — it's in the banner) */}
          {sections.filter(s => s.title !== "FLASH ASSESSMENT").map((sec, i) => {
            const m = SEC_META[sec.title] ?? { icon: "•", color: "#3b82f6", short: sec.title };
            const isVerdict = sec.title.includes("VERDICT");
            const isAlt = i % 2 === 1;
            return (
              <div
                key={sec.title}
                ref={el => { sectionRefs.current[sec.title] = el; }}
                style={{
                  marginBottom: 28,
                  padding: isVerdict ? "16px 18px" : 0,
                  background: isVerdict ? `${m.color}0a` : isAlt ? "#030b18" : "transparent",
                  borderRadius: isVerdict ? 8 : 0,
                  border: isVerdict ? `1px solid ${m.color}30` : "none",
                }}
              >
                {/* Section label (newspaper style: small caps + colored rule) */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 3, height: 16, background: m.color, borderRadius: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: m.color, textTransform: "uppercase" }}>
                    {m.icon} {sec.title}
                  </span>
                </div>

                {/* Article body */}
                {isVerdict ? (
                  <div style={{ position: "relative", paddingLeft: 20 }}>
                    <span style={{ position: "absolute", left: 0, top: -4, fontSize: 36, color: m.color, lineHeight: 1, opacity: 0.3, fontFamily: "Georgia, serif" }}>"</span>
                    <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.8, margin: 0, fontStyle: "italic", fontFamily: "Georgia, serif" }}>
                      {sec.content.trim()}
                    </p>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "#8faec8", lineHeight: 1.85, margin: 0, whiteSpace: "pre-wrap" }}>
                    {sec.content.trim()}
                  </p>
                )}

                {/* Divider */}
                {!isVerdict && (
                  <div style={{ height: 1, background: "linear-gradient(to right, #1a2d4a, transparent)", marginTop: 20 }} />
                )}
              </div>
            );
          })}

          {/* Streaming cursor */}
          {loading && analysis && (
            <span style={{ display: "inline-block", width: 2, height: 13, background: "#3b82f6", animation: "na-pulse 0.8s ease infinite", marginLeft: 2 }} />
          )}
        </div>

        {/* RIGHT: News Feed */}
        <div style={{ background: "#030b18", overflowY: "auto", maxHeight: 780 }}>
          {/* Category filter tabs */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#04111f", borderBottom: "1px solid #1a2d4a", padding: "8px 12px", display: "flex", flexWrap: "wrap", gap: 4 }}>
            {cats.map(cat => {
              const count = cat === "ALL" ? newsItems.length : newsItems.filter(n => (n.category ?? "GENERAL") === cat).length;
              const active = activeCat === cat;
              const label = cat === "ALL" ? "ALL" : cat.replace("REGULATORY/LEGAL", "REG/LEGAL").replace("CAPITAL ALLOCATION", "CAP ALLOC").replace("PRODUCT/BUSINESS", "PRODUCT");
              return (
                <button key={cat} onClick={() => setActiveCat(cat)} style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.07em", padding: "3px 7px", borderRadius: 3, border: "1px solid", cursor: "pointer", background: active ? (CAT_BG[cat] ?? "#0e1f40") : "transparent", borderColor: active ? "#3a5580" : "#1a2d4a", color: active ? (CAT_FG[cat] ?? "#93c5fd") : "#334155", textTransform: "uppercase" }}>
                  {label} {count}
                </button>
              );
            })}
          </div>

          {/* News articles grouped by date */}
          {grouped.length === 0 && (
            <div style={{ padding: 24, fontSize: 11, color: "#1a2d4a", textAlign: "center" }}>No items in this category.</div>
          )}
          {grouped.map(({ group, items }) => (
            <div key={group}>
              {/* Date group header */}
              <div style={{ padding: "8px 14px 4px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 7.5, fontWeight: 900, letterSpacing: "0.16em", color: "#1a2d4a", textTransform: "uppercase" }}>{group}</span>
                <div style={{ flex: 1, height: 1, background: "#0d1a28" }} />
              </div>
              {items.map((item, i) => {
                const cat     = item.category ?? "GENERAL";
                const isPos   = item.stock_change?.startsWith("+");
                const isNeg   = item.stock_change?.startsWith("-");
                return (
                  <div key={i} style={{ padding: "11px 14px", borderBottom: "1px solid #0a1520" }}>
                    {/* Category pill + stock change + date */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: "0.07em", padding: "2px 6px", borderRadius: 3, background: CAT_BG[cat] ?? "#0e1f40", color: CAT_FG[cat] ?? "#93c5fd", textTransform: "uppercase", flexShrink: 0 }}>
                        {cat.replace("REGULATORY/LEGAL", "REG/LEGAL").replace("CAPITAL ALLOCATION", "CAP ALLOC").replace("PRODUCT/BUSINESS", "PRODUCT")}
                      </span>
                      {item.stock_change && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: isPos ? "#061a0e" : isNeg ? "#1a0606" : "#111827", color: isPos ? "#10b981" : isNeg ? "#ef4444" : "#64748b", flexShrink: 0 }}>
                          Stock {item.stock_change}
                        </span>
                      )}
                      <span style={{ fontSize: 8.5, color: "#1e3050", marginLeft: "auto" }}>{(item.date ?? "").slice(0, 10)}</span>
                    </div>

                    {/* Headline (newspaper style) */}
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                        <p style={{ fontSize: 12.5, fontWeight: 700, color: "#c8dcff", lineHeight: 1.45, margin: "0 0 4px", cursor: "pointer" }}>
                          {item.title}
                        </p>
                      </a>
                    ) : (
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: "#c8dcff", lineHeight: 1.45, margin: "0 0 4px" }}>
                        {item.title}
                      </p>
                    )}

                    {/* Byline */}
                    <p style={{ fontSize: 9, color: "#334155", margin: "0 0 4px" }}>
                      {[item.source, item.date?.slice(0, 10)].filter(Boolean).join(" · ")}
                    </p>

                    {/* Lede */}
                    {item.summary && (
                      <p style={{ fontSize: 10.5, color: "#3d5570", lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}>
                        {item.summary}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes na-spin  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes na-pulse { 0%,100% { opacity: 1; }             50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
