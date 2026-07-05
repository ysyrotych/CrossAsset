"use client";
import { useState, useRef, useCallback } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Minus, Brain, Copy, Check } from "lucide-react";

const CAT_COLORS: Record<string, string> = {
  "EARNINGS":           "#1e3a5f",
  "GUIDANCE":           "#5c3800",
  "ANALYST ACTION":     "#1e3560",
  "M&A":                "#3b1d6e",
  "REGULATORY/LEGAL":   "#5c1a1a",
  "MANAGEMENT":         "#1a3a2a",
  "CAPITAL ALLOCATION": "#0d4a3a",
  "PRODUCT/BUSINESS":   "#1a3050",
  "INSIDER ACTIVITY":   "#4a2800",
  "GENERAL":            "#1a2540",
};

const CAT_TEXT: Record<string, string> = {
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

const SECTION_META: Record<string, { icon: string; color: string; short: string }> = {
  "FLASH ASSESSMENT":                         { icon: "⚡", color: "#6366f1", short: "Flash" },
  "THE NARRATIVE RIGHT NOW":                  { icon: "📡", color: "#3b82f6", short: "Narrative" },
  "EARNINGS & FINANCIAL SIGNALS":             { icon: "📊", color: "#10b981", short: "Earnings" },
  "COMPETITIVE & STRATEGIC POSITION":         { icon: "⚔️", color: "#8b5cf6", short: "Competitive" },
  "MANAGEMENT CREDIBILITY & INSIDER SIGNALS": { icon: "👁️", color: "#f59e0b", short: "Management" },
  "ANALYST & INSTITUTIONAL SENTIMENT SHIFT":  { icon: "🏦", color: "#06b6d4", short: "Analysts" },
  "REGULATORY & LEGAL WATCH":                 { icon: "⚖️", color: "#ef4444", short: "Regulatory" },
  "MARKET PRICING REALITY CHECK":             { icon: "💹", color: "#ec4899", short: "Pricing" },
  "CATALYSTS TO WATCH — NEXT 30-60 DAYS":    { icon: "🎯", color: "#f97316", short: "Catalysts" },
  "EMERGING RISKS IN THE NEWS":               { icon: "⚠️", color: "#dc2626", short: "Risks" },
  "ONE-PARAGRAPH VERDICT":                    { icon: "✦",  color: "#6366f1", short: "Verdict" },
};

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

function parseAnalysisSections(text: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const lines = text.split("\n");
  let current: { title: string; content: string } | null = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      if (current) sections.push(current);
      current = { title: h2[1].trim(), content: "" };
    } else if (current) {
      current.content += line + "\n";
    }
  }
  if (current) sections.push(current);
  return sections.filter(s => s.content.trim().length > 0);
}

export default function NewsAnalyst({ ticker, companyName, sector, newsItems, facts }: Props) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeCat, setActiveCat] = useState("ALL");
  const [copied, setCopied] = useState(false);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sections = parseAnalysisSections(analysis);
  const cats = ["ALL", ...Array.from(new Set(newsItems.map(n => n.category ?? "GENERAL"))).sort()];
  const filtered = activeCat === "ALL" ? newsItems : newsItems.filter(n => (n.category ?? "GENERAL") === activeCat);

  // 30-day sentiment
  const last30 = newsItems.filter(n => {
    try { return new Date(n.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); } catch { return false; }
  });
  const posTerms = ['beat','raise','launch','win','grow','record','strong','exceed','upgrade','buy','positive','initiate','partnership'];
  const negTerms = ['cut','miss','decline','drop','fall','concern','risk','probe','loss','lower','warn','resign','downgrade','short'];
  let sentScore = 0;
  for (const n of last30) {
    const tl = (n.title ?? '').toLowerCase();
    sentScore += posTerms.filter(t => tl.includes(t)).length;
    sentScore -= negTerms.filter(t => tl.includes(t)).length;
  }
  const sentLabel = sentScore > 3 ? "POSITIVE" : sentScore < -3 ? "NEGATIVE" : "MIXED";
  const sentColor = sentScore > 3 ? "#10b981" : sentScore < -3 ? "#ef4444" : "#f59e0b";

  const scrollToSection = useCallback((title: string) => {
    const el = sectionRefs.current[title];
    if (el && rightPanelRef.current) {
      rightPanelRef.current.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
    }
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
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAnalysis(text);
        // auto-scroll right panel to bottom while streaming
        if (rightPanelRef.current) {
          rightPanelRef.current.scrollTop = rightPanelRef.current.scrollHeight;
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  function copyAnalysis() {
    if (!analysis) return;
    navigator.clipboard.writeText(analysis).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ background: "#040d1c", border: "1px solid #1a2d4a", borderRadius: 12, overflow: "hidden", marginTop: 24 }}>
      {/* ── Header ── */}
      <div style={{ background: "#06111f", borderBottom: "1px solid #1a2d4a", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Brain size={18} color="#3b82f6" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.02em" }}>
              News Intelligence — {ticker}
            </div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>
              {newsItems.length} items · {last30.length} in last 30d · yfinance + Finviz + Seeking Alpha
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Sentiment badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: `${sentColor}18`, border: `1px solid ${sentColor}45`, borderRadius: 6, padding: "4px 10px" }}>
            {sentScore > 3 ? <TrendingUp size={11} color={sentColor} /> : sentScore < -3 ? <TrendingDown size={11} color={sentColor} /> : <Minus size={11} color={sentColor} />}
            <span style={{ fontSize: 10, fontWeight: 700, color: sentColor, letterSpacing: "0.08em" }}>{sentLabel}</span>
            <span style={{ fontSize: 9, color: "#475569" }}>30d</span>
          </div>
          {/* Copy button */}
          {analysis && (
            <button onClick={copyAnalysis} style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid #1a2d4a", borderRadius: 7, padding: "6px 12px", cursor: "pointer", fontSize: 10, color: "#64748b" }}>
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          {/* Analyze button */}
          <button
            onClick={runAnalysis}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: loading ? "#0f1e33" : "#1e3a5f",
              border: `1px solid ${loading ? "#1a2d4a" : "#2a4a7f"}`,
              borderRadius: 8, padding: "8px 16px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 11, fontWeight: 700, color: loading ? "#475569" : "#93bbff",
              letterSpacing: "0.04em", transition: "all 0.15s",
            }}
          >
            {loading
              ? <RefreshCw size={13} style={{ animation: "na-spin 1s linear infinite" }} />
              : <Brain size={13} />}
            {loading ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze News"}
          </button>
        </div>
      </div>

      {/* ── Section nav chips (visible once sections load) ── */}
      {sections.length > 0 && (
        <div style={{ background: "#040d1c", borderBottom: "1px solid #1a2d4a", padding: "7px 16px", display: "flex", gap: 5, flexWrap: "wrap" }}>
          {sections.map(sec => {
            const meta = SECTION_META[sec.title] ?? { icon: "•", color: "#3b82f6", short: sec.title.slice(0, 10) };
            return (
              <button
                key={sec.title}
                onClick={() => scrollToSection(sec.title)}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "#06111f", border: `1px solid #1a2d4a`,
                  borderRadius: 5, padding: "3px 9px", cursor: "pointer",
                  fontSize: 9.5, fontWeight: 600, color: meta.color,
                  letterSpacing: "0.03em", transition: "border-color 0.1s",
                }}
              >
                <span style={{ fontSize: 11 }}>{meta.icon}</span>
                {meta.short}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Two-panel body ── */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr" }}>

        {/* LEFT: News feed */}
        <div style={{ borderRight: "1px solid #1a2d4a", height: 660, overflowY: "auto" }}>
          {/* Category filters */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#06111f", borderBottom: "1px solid #1a2d4a", padding: "7px 10px", display: "flex", flexWrap: "wrap", gap: 4 }}>
            {cats.map(cat => {
              const count = cat === "ALL" ? newsItems.length : newsItems.filter(n => (n.category ?? "GENERAL") === cat).length;
              const isActive = activeCat === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  style={{
                    fontSize: 8.5, fontWeight: 700, letterSpacing: "0.05em",
                    padding: "3px 7px", borderRadius: 4, border: "1px solid",
                    cursor: "pointer",
                    background: isActive ? (CAT_COLORS[cat] ?? "#1e3560") : "transparent",
                    borderColor: isActive ? "#3a5580" : "#1a2d4a",
                    color: isActive ? (CAT_TEXT[cat] ?? "#c8dcff") : "#475569",
                  }}
                >
                  {cat === "ALL" ? `ALL (${count})` : `${cat.replace("REGULATORY/LEGAL", "REG/LEGAL").replace("CAPITAL ALLOCATION", "CAP ALLOC").replace("PRODUCT/BUSINESS", "PRODUCT")} (${count})`}
                </button>
              );
            })}
          </div>

          {/* News items */}
          {filtered.length === 0 && (
            <div style={{ padding: 20, fontSize: 11, color: "#334155", textAlign: "center" }}>No items in this category.</div>
          )}
          {filtered.map((item, i) => {
            const isPos = item.stock_change?.startsWith("+");
            const isNeg = item.stock_change?.startsWith("-");
            return (
              <div key={i} style={{ padding: "9px 12px", borderBottom: "1px solid #0d1a28" }}>
                {/* Top row: category badge + stock change + date */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 7.5, fontWeight: 700, letterSpacing: "0.06em",
                    padding: "2px 5px", borderRadius: 3, flexShrink: 0,
                    background: CAT_COLORS[item.category ?? "GENERAL"] ?? "#1e3560",
                    color: CAT_TEXT[item.category ?? "GENERAL"] ?? "#c8dcff",
                  }}>
                    {(item.category ?? "GENERAL").replace("REGULATORY/LEGAL","REG/LEGAL").replace("CAPITAL ALLOCATION","CAP ALLOC").replace("PRODUCT/BUSINESS","PRODUCT")}
                  </span>
                  {item.stock_change && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 3, flexShrink: 0,
                      background: isPos ? "#0a2218" : isNeg ? "#2a0a0a" : "#151f30",
                      color: isPos ? "#10b981" : isNeg ? "#ef4444" : "#64748b",
                    }}>
                      {item.stock_change}
                    </span>
                  )}
                  <span style={{ fontSize: 9, color: "#334155", marginLeft: "auto" }}>{(item.date ?? "").slice(0, 10)}</span>
                </div>
                {/* Title */}
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#bdd3f0", lineHeight: 1.45, marginBottom: 3, cursor: "pointer" }}>
                      {item.title}
                    </div>
                  </a>
                ) : (
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#bdd3f0", lineHeight: 1.45, marginBottom: 3 }}>
                    {item.title}
                  </div>
                )}
                {/* Summary */}
                {item.summary && (
                  <div style={{ fontSize: 9.5, color: "#4a6080", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as any}>
                    {item.summary}
                  </div>
                )}
                {/* Source */}
                {item.source && (
                  <div style={{ fontSize: 9, color: "#263040", marginTop: 3 }}>{item.source}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT: AI Analysis */}
        <div ref={rightPanelRef} style={{ height: 660, overflowY: "auto", padding: "16px 20px", background: "#040d1c" }}>

          {/* Empty state */}
          {!analysis && !loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, textAlign: "center" }}>
              <Brain size={44} color="#1a2d4a" />
              <div style={{ fontSize: 14, color: "#334155", fontWeight: 600 }}>
                AI News Analyst — {ticker}
              </div>
              <div style={{ fontSize: 11, color: "#263040", maxWidth: 340, lineHeight: 1.6 }}>
                Click <strong style={{ color: "#475569" }}>Analyze News</strong> to generate a multi-topic narrative intelligence brief. Claude reads all {newsItems.length} news items and produces analyst-grade commentary across 10 topics.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 360 }}>
                {Object.entries(SECTION_META).slice(1, 6).map(([title, meta]) => (
                  <span key={title} style={{ fontSize: 9, color: meta.color, background: `${meta.color}12`, border: `1px solid ${meta.color}30`, borderRadius: 4, padding: "3px 8px" }}>
                    {meta.icon} {meta.short}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && sections.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ background: "#06111f", border: "1px solid #1a2d4a", borderRadius: 8, padding: 14, opacity: Math.max(0.2, 0.7 - i * 0.12) }}>
                  <div style={{ height: 11, background: "#1a2d4a", borderRadius: 4, width: "45%", marginBottom: 10 }} />
                  <div style={{ height: 8, background: "#0f1e33", borderRadius: 3, width: "92%", marginBottom: 6 }} />
                  <div style={{ height: 8, background: "#0f1e33", borderRadius: 3, width: "78%", marginBottom: 6 }} />
                  <div style={{ height: 8, background: "#0f1e33", borderRadius: 3, width: "86%" }} />
                </div>
              ))}
            </div>
          )}

          {/* Rendered sections */}
          {sections.map((sec, i) => {
            const meta = SECTION_META[sec.title] ?? { icon: "•", color: "#3b82f6", short: sec.title };
            const isFlash = sec.title === "FLASH ASSESSMENT";
            const isVerdict = sec.title.includes("VERDICT");

            // Parse FLASH ASSESSMENT signal line
            let flashSignal = "";
            let flashPattern = "";
            let flashConviction = "";
            let flashBody = sec.content.trim();
            if (isFlash) {
              const sigLine = sec.content.match(/SIGNAL:\s*(\w+)/i);
              const patLine = sec.content.match(/PATTERN:\s*([^|]+)/i);
              const conLine = sec.content.match(/CONVICTION:\s*(\w+)/i);
              if (sigLine) flashSignal = sigLine[1].toUpperCase();
              if (patLine) flashPattern = patLine[1].trim();
              if (conLine) flashConviction = conLine[1].toUpperCase();
              // Get the sentence after the first line
              const lines = sec.content.trim().split("\n").filter(Boolean);
              flashBody = lines.slice(1).join(" ").trim();
            }

            const signalColor = flashSignal === "BULLISH" ? "#10b981" : flashSignal === "BEARISH" ? "#ef4444" : "#f59e0b";

            return (
              <div
                key={i}
                ref={el => { sectionRefs.current[sec.title] = el; }}
                style={{
                  background: isFlash ? `${meta.color}0e` : isVerdict ? `${meta.color}08` : "#06111f",
                  border: `1px solid ${isFlash || isVerdict ? meta.color + "35" : "#1a2d4a"}`,
                  borderLeft: `3px solid ${meta.color}`,
                  borderRadius: 8, padding: isFlash ? 16 : 14, marginBottom: 10,
                }}
              >
                {/* Section header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isFlash ? 10 : 8 }}>
                  <span style={{ fontSize: 15 }}>{meta.icon}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.09em", color: meta.color, textTransform: "uppercase", flex: 1 }}>
                    {sec.title}
                  </span>
                </div>

                {/* Flash Assessment special rendering */}
                {isFlash && flashSignal ? (
                  <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${signalColor}18`, border: `1px solid ${signalColor}40`, borderRadius: 6, padding: "5px 12px" }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: signalColor, letterSpacing: "0.1em" }}>SIGNAL</span>
                        <span style={{ fontSize: 12, fontWeight: 900, color: signalColor }}>{flashSignal}</span>
                      </div>
                      {flashPattern && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f1e33", border: "1px solid #1a2d4a", borderRadius: 6, padding: "5px 12px" }}>
                          <span style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.08em" }}>PATTERN</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{flashPattern}</span>
                        </div>
                      )}
                      {flashConviction && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f1e33", border: "1px solid #1a2d4a", borderRadius: 6, padding: "5px 12px" }}>
                          <span style={{ fontSize: 9, color: "#475569", fontWeight: 700, letterSpacing: "0.08em" }}>CONVICTION</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: flashConviction === "HIGH" ? "#10b981" : flashConviction === "LOW" ? "#ef4444" : "#f59e0b" }}>{flashConviction}</span>
                        </div>
                      )}
                    </div>
                    {flashBody && (
                      <div style={{ fontSize: 12, color: "#c8dcff", lineHeight: 1.65, fontStyle: "italic", borderTop: "1px solid #1a2d4a", paddingTop: 10 }}>
                        {flashBody}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 11.5, color: "#8faec8", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                    {sec.content.trim()}
                  </div>
                )}
              </div>
            );
          })}

          {/* Streaming cursor */}
          {loading && analysis && (
            <div style={{ display: "inline-block", width: 2, height: 14, background: "#3b82f6", marginLeft: 2, animation: "na-pulse 0.8s ease infinite" }} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes na-spin  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes na-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
