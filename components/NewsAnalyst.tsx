"use client";
import { useState, useRef } from "react";
import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus, X, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

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
  facts?: Record<string, unknown>;
}

function dateGroup(dateStr: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diff === 0) return "TODAY";
    if (diff === 1) return "YESTERDAY";
    if (diff <= 7) return "THIS WEEK";
    if (diff <= 30) return "THIS MONTH";
    return "EARLIER";
  } catch { return "EARLIER"; }
}

function parseAnalysisSections(text: string): { title: string; content: string }[] {
  const secs: { title: string; content: string }[] = [];
  let cur: { title: string; content: string } | null = null;
  for (const line of text.split("\n")) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) { if (cur) secs.push(cur); cur = { title: h[1].trim(), content: "" }; }
    else if (cur) cur.content += line + "\n";
  }
  if (cur) secs.push(cur);
  return secs.filter(s => s.content.trim().length > 0);
}

export default function NewsAnalyst({ ticker, companyName, sector, newsItems, facts }: Props) {
  const [analysis, setAnalysis]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [showPanel, setShowPanel]     = useState(false);
  const [activeCat, setActiveCat]     = useState("ALL");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [articleAnalysis, setArticleAnalysis] = useState<Record<number, string>>({});
  const [articleLoading, setArticleLoading]   = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const cats = Array.from(new Set(newsItems.map(n => n.category ?? "GENERAL"))).sort();
  const filtered = activeCat === "ALL" ? newsItems : newsItems.filter(n => (n.category ?? "GENERAL") === activeCat);

  // Group by date
  const ORDER = ["TODAY", "YESTERDAY", "THIS WEEK", "THIS MONTH", "EARLIER"];
  const byDate: Record<string, NewsItem[]> = {};
  const idxMap: Record<string, number> = {}; // map title→original index for articleAnalysis
  newsItems.forEach((item, i) => { idxMap[item.title] = i; });
  for (const item of filtered) {
    const g = dateGroup(item.date ?? "");
    if (!byDate[g]) byDate[g] = [];
    byDate[g].push(item);
  }
  const grouped = ORDER.filter(g => byDate[g]).map(g => ({ group: g, items: byDate[g] }));

  // Category counts
  const catCounts: Record<string, number> = { "ALL": newsItems.length };
  for (const n of newsItems) { const c = n.category ?? "GENERAL"; catCounts[c] = (catCounts[c] ?? 0) + 1; }

  // Sentiment
  const last30 = newsItems.filter(n => { try { return new Date(n.date) >= new Date(Date.now() - 30*24*60*60*1000); } catch { return false; }});
  let sentScore = 0;
  for (const n of last30) {
    const tl = (n.title ?? "").toLowerCase();
    sentScore += ["beat","raise","launch","win","grow","record","strong","exceed","upgrade","buy","positive"].filter(t => tl.includes(t)).length;
    sentScore -= ["cut","miss","decline","drop","fall","concern","risk","probe","loss","lower","warn","resign","downgrade"].filter(t => tl.includes(t)).length;
  }
  const sentLabel = sentScore > 3 ? "POSITIVE" : sentScore < -3 ? "NEGATIVE" : "MIXED";
  const sentColor = sentScore > 3 ? "#10b981" : sentScore < -3 ? "#ef4444" : "#f59e0b";

  async function runFullAnalysis(targetCat?: string) {
    setLoading(true);
    setShowPanel(true);
    setAnalysis("");
    const items = targetCat ? newsItems.filter(n => (n.category ?? "GENERAL") === targetCat) : newsItems;
    try {
      const res = await fetch("/api/news-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, companyName, sector, newsItems: items, facts }),
      });
      if (!res.body) { setLoading(false); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setAnalysis(text);
        if (panelRef.current) panelRef.current.scrollTop = panelRef.current.scrollHeight;
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function analyzeArticle(item: NewsItem, idx: number) {
    if (articleLoading !== null) return;
    setArticleLoading(idx);
    setArticleAnalysis(prev => ({ ...prev, [idx]: "" }));
    try {
      const res = await fetch("/api/news-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker, companyName, sector, facts,
          newsItems: [item],
          focusArticle: true,
        }),
      });
      if (!res.body) { setArticleLoading(null); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setArticleAnalysis(prev => ({ ...prev, [idx]: text }));
      }
    } catch (e) { console.error(e); }
    setArticleLoading(null);
  }

  const sections = parseAnalysisSections(analysis);
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div style={{ background: "#040d1c", border: "1px solid #1a2d4a", borderRadius: 12, overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>

      {/* ── MASTHEAD ── */}
      <div style={{ background: "#06111f", borderBottom: "1px solid #1a2d4a", padding: "10px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", letterSpacing: "-0.02em" }}>{ticker}</span>
            <span style={{ fontSize: 13, color: "#475569" }}>{companyName}</span>
            {sector && <span style={{ fontSize: 11, color: "#334155" }}>· {sector}</span>}
          </div>
          <div style={{ fontSize: 9, color: "#334155", marginTop: 2, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            News Intelligence · {today} · {newsItems.length} items · yfinance · Finviz · Seeking Alpha
          </div>
        </div>
        {/* Sentiment badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${sentColor}14`, border: `1px solid ${sentColor}40`, borderRadius: 5, padding: "5px 12px" }}>
          {sentScore > 3 ? <TrendingUp size={12} color={sentColor} /> : sentScore < -3 ? <TrendingDown size={12} color={sentColor} /> : <Minus size={12} color={sentColor} />}
          <span style={{ fontSize: 11, fontWeight: 800, color: sentColor, letterSpacing: "0.08em" }}>{sentLabel}</span>
        </div>
        {/* Full analysis button */}
        <button onClick={() => showPanel ? setShowPanel(false) : runFullAnalysis()} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, background: showPanel ? "#0a1520" : "#1e3a5f", border: `1px solid ${showPanel ? "#1a2d4a" : "#2d5a9f"}`, borderRadius: 6, padding: "7px 16px", cursor: loading ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: showPanel ? "#475569" : "#93c5fd" }}>
          {loading ? <RefreshCw size={12} style={{ animation: "ns-spin 1s linear infinite" }} /> : <Brain size={12} />}
          {loading ? "Analyzing…" : showPanel ? "Hide Analysis" : "Full Analysis"}
        </button>
      </div>

      {/* ── IMPORTANT TOPICS BAR ── */}
      <div style={{ background: "#030b18", borderBottom: "1px solid #0d1a28", padding: "10px 24px" }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", color: "#334155", textTransform: "uppercase", marginBottom: 8 }}>Important Topics</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setActiveCat("ALL")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 5, border: `1px solid ${activeCat === "ALL" ? "#3b82f6" : "#1a2d4a"}`, background: activeCat === "ALL" ? "#0f2340" : "transparent", cursor: "pointer", fontSize: 10, fontWeight: 700, color: activeCat === "ALL" ? "#93c5fd" : "#475569" }}>
            <span>All</span>
            <span style={{ background: "#1a2d4a", borderRadius: 3, padding: "1px 5px", fontSize: 9 }}>{newsItems.length}</span>
          </button>
          {cats.map(cat => {
            const count = catCounts[cat] ?? 0;
            const active = activeCat === cat;
            const label = cat.replace("REGULATORY/LEGAL", "Regulatory").replace("CAPITAL ALLOCATION", "Capital Alloc").replace("PRODUCT/BUSINESS", "Product").replace("ANALYST ACTION", "Analyst").replace("INSIDER ACTIVITY", "Insider");
            return (
              <button key={cat} onClick={() => setActiveCat(active ? "ALL" : cat)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 5, border: `1px solid ${active ? (CAT_FG[cat] ?? "#3b82f6") + "80" : "#1a2d4a"}`, background: active ? (CAT_BG[cat] ?? "#0e1f40") : "transparent", cursor: "pointer", fontSize: 10, fontWeight: 700, color: active ? (CAT_FG[cat] ?? "#93c5fd") : "#475569" }}>
                <span>{label}</span>
                <span style={{ background: active ? "rgba(255,255,255,0.1)" : "#1a2d4a", borderRadius: 3, padding: "1px 5px", fontSize: 9, color: active ? (CAT_FG[cat] ?? "#93c5fd") : "#334155" }}>{count}</span>
                {active && (
                  <button onClick={e => { e.stopPropagation(); runFullAnalysis(cat); }}
                    style={{ marginLeft: 2, display: "flex", alignItems: "center", gap: 3, background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 3, padding: "2px 6px", cursor: "pointer", fontSize: 8.5, color: CAT_FG[cat] ?? "#93c5fd" }}>
                    <Sparkles size={9} />Analyze
                  </button>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <div style={{ display: "grid", gridTemplateColumns: showPanel ? "1fr 420px" : "1fr", minHeight: 600 }}>

        {/* ── ARTICLES (primary) ── */}
        <div style={{ overflowY: "auto", maxHeight: 780, borderRight: showPanel ? "1px solid #1a2d4a" : "none" }}>
          {grouped.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", fontSize: 12, color: "#334155" }}>No articles in this category.</div>
          )}
          {grouped.map(({ group, items }) => (
            <div key={group}>
              <div style={{ padding: "12px 24px 6px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, background: "#040d1c", zIndex: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: "#1e3a5f", textTransform: "uppercase" }}>{group}</span>
                <div style={{ flex: 1, height: 1, background: "#0d1a28" }} />
                <span style={{ fontSize: 9, color: "#1a2d4a" }}>{items.length} article{items.length !== 1 ? "s" : ""}</span>
              </div>
              {items.map((item, localIdx) => {
                const globalIdx = idxMap[item.title] ?? localIdx;
                const cat = item.category ?? "GENERAL";
                const isPos = item.stock_change?.startsWith("+");
                const isNeg = item.stock_change?.startsWith("-");
                const isExpanded = expandedIdx === globalIdx;
                const articleAI = articleAnalysis[globalIdx];
                const isAnalyzing = articleLoading === globalIdx;

                return (
                  <div key={globalIdx} style={{ borderBottom: "1px solid #0a1520", padding: "16px 24px", background: isExpanded ? "#030b18" : "transparent" }}>
                    {/* Meta row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.07em", padding: "3px 7px", borderRadius: 3, background: CAT_BG[cat] ?? "#0e1f40", color: CAT_FG[cat] ?? "#93c5fd", textTransform: "uppercase" }}>
                        {cat.replace("REGULATORY/LEGAL","REG/LEGAL").replace("CAPITAL ALLOCATION","CAP ALLOC").replace("PRODUCT/BUSINESS","PRODUCT")}
                      </span>
                      {item.stock_change && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 3, background: isPos ? "#061a0e" : isNeg ? "#1a0606" : "#111827", color: isPos ? "#10b981" : isNeg ? "#ef4444" : "#64748b" }}>
                          Stock {item.stock_change}
                        </span>
                      )}
                      <span style={{ fontSize: 9, color: "#334155", marginLeft: "auto" }}>
                        {item.source && <span style={{ color: "#475569", fontWeight: 600 }}>{item.source}</span>}
                        {item.source && item.date && <span style={{ color: "#1a2d4a" }}> · </span>}
                        {item.date?.slice(0, 10)}
                      </span>
                    </div>

                    {/* Headline */}
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#c8dcff", lineHeight: 1.4, margin: "0 0 6px", cursor: "pointer" }}>
                          {item.title}
                        </p>
                      </a>
                    ) : (
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#c8dcff", lineHeight: 1.4, margin: "0 0 6px" }}>
                        {item.title}
                      </p>
                    )}

                    {/* Summary — always show, full text */}
                    {item.summary && (
                      <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, margin: "0 0 10px" }}>
                        {item.summary}
                      </p>
                    )}

                    {/* Action row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => setExpandedIdx(isExpanded ? null : globalIdx)}
                        style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid #1a2d4a`, borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 9.5, color: "#475569" }}>
                        {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        {isExpanded ? "Collapse" : "Analyze this article"}
                      </button>
                      {isExpanded && !articleAI && !isAnalyzing && (
                        <button onClick={() => analyzeArticle(item, globalIdx)}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: "#0f2340", border: "1px solid #2d5a9f", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 9.5, color: "#93c5fd", fontWeight: 700 }}>
                          <Brain size={10} />
                          Run AI Analysis
                        </button>
                      )}
                    </div>

                    {/* Per-article AI analysis */}
                    {isExpanded && (isAnalyzing || articleAI) && (
                      <div style={{ marginTop: 12, padding: "12px 14px", background: "#030b18", border: "1px solid #1a2d4a", borderRadius: 6 }}>
                        {isAnalyzing && !articleAI && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#334155", fontSize: 11 }}>
                            <RefreshCw size={11} style={{ animation: "ns-spin 1s linear infinite" }} />
                            Analyzing…
                          </div>
                        )}
                        {articleAI && (
                          <p style={{ fontSize: 11.5, color: "#8faec8", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
                            {articleAI.replace(/^##[^\n]+\n/gm, "").trim()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── AI ANALYSIS PANEL (right, opens on demand) ── */}
        {showPanel && (
          <div style={{ background: "#030b18", display: "flex", flexDirection: "column", maxHeight: 780 }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #1a2d4a", display: "flex", alignItems: "center", gap: 8 }}>
              <Brain size={12} color="#3b82f6" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#93c5fd", flex: 1 }}>
                {loading ? "Generating analysis…" : activeCat !== "ALL" ? `${activeCat} Analysis` : "Full Market Analysis"}
              </span>
              <button onClick={() => { setShowPanel(false); setAnalysis(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#334155" }}>
                <X size={13} />
              </button>
            </div>
            <div ref={panelRef} style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              {!analysis && loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} style={{ opacity: 0.7 - i * 0.12 }}>
                      <div style={{ height: 8, background: "#0d1e33", borderRadius: 3, width: "30%", marginBottom: 10 }} />
                      {[...Array(3)].map((_, j) => (
                        <div key={j} style={{ height: 7, background: "#060f1e", borderRadius: 3, width: `${85 - j * 10}%`, marginBottom: 6 }} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {sections.map((sec, i) => {
                const isVerdict = sec.title.includes("VERDICT");
                return (
                  <div key={i} style={{ marginBottom: 22, paddingBottom: 18, borderBottom: i < sections.length - 1 ? "1px solid #0d1a28" : "none" }}>
                    <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", color: "#3b82f6", textTransform: "uppercase", marginBottom: 8 }}>
                      {sec.title}
                    </div>
                    <p style={{ fontSize: 11.5, color: isVerdict ? "#cbd5e1" : "#8faec8", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap", fontStyle: isVerdict ? "italic" : "normal" }}>
                      {sec.content.trim()}
                    </p>
                  </div>
                );
              })}
              {loading && analysis && (
                <span style={{ display: "inline-block", width: 2, height: 12, background: "#3b82f6", animation: "ns-pulse 0.8s ease infinite" }} />
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes ns-spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ns-pulse { 0%,100% { opacity:1; } 50% { opacity:0; } }
      `}</style>
    </div>
  );
}
