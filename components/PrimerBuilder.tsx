"use client";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  CheckCircle2, ChevronUp, ChevronDown, Lock, Unlock,
  Pencil, RefreshCw, Sparkles, Send, Copy, FileDown,
  Plus, Trash2, X, ArrowRight, Wand2, MessageSquare,
  LayoutList, Lightbulb, Hammer, Eye, Check, BarChart2,
} from "lucide-react";

const PrimerDownloadButton = dynamic(
  () => import("@/components/PrimerDownloadButton").then(m => m.PrimerDownloadButton),
  { ssr: false }
);

// ── Types ─────────────────────────────────────────────────────────────────────

type BuildStage = "configure" | "thesis" | "charts" | "build" | "review";
type Tone = "analytical" | "bullish" | "bearish" | "balanced";
type Length = "brief" | "standard" | "comprehensive";

interface SectionDef {
  id: string;
  title: string;
  description: string;
  included: boolean;
  generated: boolean;
  generating: boolean;
  content: string;
  userEdited: boolean;
  charts: string[];
  custom?: boolean;
}

interface ThesisOption {
  title: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  core_argument: string;
  key_assumptions: string[];
  key_risk: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

// ── Default sections ───────────────────────────────────────────────────────────

const DEFAULT_SECTIONS: Omit<SectionDef, "generating">[] = [
  { id: "executive_summary", title: "Executive Summary", description: "High-level investment case, key financials, bottom line conviction", included: true, generated: false, content: "", userEdited: false, charts: [] },
  { id: "company_snapshot", title: "Company Snapshot", description: "Metrics table, charts (revenue, EPS, margins), business model", included: true, generated: false, content: "", userEdited: false, charts: [] },
  { id: "business_overview", title: "Business Overview", description: "Company background, products, customers, geography, moat", included: true, generated: false, content: "", userEdited: false, charts: [] },
  { id: "industry_analysis", title: "Industry Analysis", description: "Market structure, competitive dynamics, key drivers, cycle position", included: true, generated: false, content: "", userEdited: false, charts: [] },
  { id: "financial_analysis", title: "Financial Analysis", description: "Revenue trends, margins, balance sheet, FCF quality, earnings quality", included: true, generated: false, content: "", userEdited: false, charts: [] },
  { id: "valuation", title: "Valuation Framework", description: "Multiples, peer context, bull/base/bear scenarios with explicit price math", included: true, generated: false, content: "", userEdited: false, charts: [] },
  { id: "management_commentary", title: "Management Commentary", description: "Earnings call highlights, guidance track record, outlook", included: true, generated: false, content: "", userEdited: false, charts: [] },
  { id: "management_governance", title: "Management & Governance", description: "Leadership, insider activity, capital allocation discipline", included: true, generated: false, content: "", userEdited: false, charts: [] },
  { id: "key_risks", title: "Key Risks", description: "Prioritized risk register with probability assessment (6-8 risks)", included: true, generated: false, content: "", userEdited: false, charts: [] },
  { id: "news_analysis", title: "News Analysis", description: "Recent news narrative, sentiment trajectory, catalysts, pricing reality", included: true, generated: false, content: "", userEdited: false, charts: [] },
  { id: "investment_thesis", title: "Investment Thesis", description: "Bull/bear cases with price math, conviction statement", included: true, generated: false, content: "", userEdited: false, charts: [] },
  { id: "key_metrics", title: "Key Metrics Dashboard", description: "KPI table with watch thresholds and why each matters", included: true, generated: false, content: "", userEdited: false, charts: [] },
  { id: "earnings_questions", title: "Earnings Call Questions", description: "Institutional-grade Q&A for next earnings call (8-10 questions)", included: false, generated: false, content: "", userEdited: false, charts: [] },
];

// ── Style constants ────────────────────────────────────────────────────────────

const BG = "#040d1c";
const CARD = "#06111f";
const BORDER = "#1a2d4a";
const ACCENT = "#1e3a5f";
const BLUE = "#3b82f6";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const TEXT = "#e2e8f0";
const MUTED = "#64748b";
const SUBTLE = "#94a3b8";

const sentimentColor = (s: string) =>
  s === "BULLISH" ? GREEN : s === "BEARISH" ? RED : AMBER;

// ── Sub-components ─────────────────────────────────────────────────────────────

function StageIndicator({ stage, setStage, sections }: { stage: BuildStage; setStage: (s: BuildStage) => void; sections: SectionDef[] }) {
  const stages: { id: BuildStage; label: string; icon: React.ReactNode }[] = [
    { id: "configure", label: "Configure", icon: <LayoutList size={13} /> },
    { id: "thesis", label: "Thesis", icon: <Lightbulb size={13} /> },
    { id: "charts", label: "Charts", icon: <BarChart2 size={13} /> },
    { id: "build", label: "Build", icon: <Hammer size={13} /> },
    { id: "review", label: "Review", icon: <Eye size={13} /> },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "0 20px" }}>
      {stages.map((s, i) => {
        const isActive = stage === s.id;
        const isPast = stages.findIndex(x => x.id === stage) > i;
        return (
          <button
            key={s.id}
            onClick={() => setStage(s.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "12px 16px", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.04em", border: "none", cursor: "pointer",
              background: "transparent",
              color: isActive ? TEXT : isPast ? GREEN : MUTED,
              borderBottom: isActive ? `2px solid ${BLUE}` : "2px solid transparent",
              transition: "all 0.15s",
            }}
          >
            <span style={{ opacity: isPast ? 1 : 0.7 }}>
              {isPast ? <CheckCircle2 size={13} color={GREEN} /> : s.icon}
            </span>
            {i + 1}. {s.label}
            {i < stages.length - 1 && <ChevronDown size={10} style={{ transform: "rotate(-90deg)", marginLeft: 4, opacity: 0.3 }} />}
          </button>
        );
      })}
      <div style={{ marginLeft: "auto", fontSize: 10, color: MUTED, paddingRight: 4 }}>
        {sections.filter(s => s.included && s.generated).length}/{sections.filter(s => s.included).length} sections ready
      </div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
        background: value ? BLUE : "#1a2d4a", position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: value ? 18 : 2,
        width: 16, height: 16, borderRadius: 8,
        background: "white", transition: "left 0.2s",
      }} />
    </button>
  );
}

// ── Stage 1: Configure ─────────────────────────────────────────────────────────


function ConfigureStage({
  sections, setSections, tone, setTone, length, setLength, onNext,
  ticker, companyName, facts,
}: {
  sections: SectionDef[];
  setSections: React.Dispatch<React.SetStateAction<SectionDef[]>>;
  tone: Tone; setTone: (t: Tone) => void;
  length: Length; setLength: (l: Length) => void;
  onNext: () => void;
  ticker?: string; companyName?: string; facts?: Record<string, number | null>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customContent, setCustomContent] = useState("");

  function move(id: string, dir: -1 | 1) {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === id);
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  function addCustom() {
    if (!customTitle.trim()) return;
    const id = `custom_${Date.now()}`;
    setSections(prev => [...prev, {
      id, title: customTitle, description: customDesc,
      included: true, generated: !!customContent, generating: false,
      content: customContent, userEdited: !!customContent, charts: [], custom: true,
    }]);
    setCustomTitle(""); setCustomDesc(""); setCustomContent("");
    setShowCustomModal(false);
  }

  const tones: { id: Tone; label: string }[] = [
    { id: "analytical", label: "Analytical" },
    { id: "bullish", label: "Bullish" },
    { id: "bearish", label: "Bearish" },
    { id: "balanced", label: "Balanced" },
  ];
  const lengths: { id: Length; label: string; sub: string }[] = [
    { id: "brief", label: "Brief", sub: "~2k words" },
    { id: "standard", label: "Standard", sub: "~4k words" },
    { id: "comprehensive", label: "Comprehensive", sub: "~6k words" },
  ];

  const fmtV2 = (v?: number | null) => v == null ? "—" : Math.abs(v) >= 1e12 ? `$${(v/1e12).toFixed(1)}T` : Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : Math.abs(v) >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v.toFixed(2)}`;
  const contextStats = facts ? [
    { label: "Stock", value: facts.stock_price != null ? `$${Number(facts.stock_price).toFixed(2)}` : "—" },
    { label: "Mkt Cap", value: fmtV2(facts.market_cap) },
    { label: "Revenue", value: fmtV2(facts.revenue) },
    { label: "FCF", value: fmtV2(facts.free_cash_flow) },
    { label: "EV/EBITDA", value: facts.ev_ebitda != null ? `${Number(facts.ev_ebitda).toFixed(1)}x` : "—" },
    { label: "ROIC", value: facts.roic != null ? `${Number(facts.roic).toFixed(1)}%` : "—" },
    { label: "Gross Mgn", value: facts.gross_margin != null ? `${Number(facts.gross_margin).toFixed(1)}%` : "—" },
    { label: "P/E", value: facts.pe_ratio != null ? `${Number(facts.pe_ratio).toFixed(1)}x` : "—" },
  ] : [];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Company context banner */}
      {ticker && facts && (
        <div style={{ background: ACCENT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>{ticker}</div>
            <div style={{ fontSize: 10, color: MUTED }}>{companyName}</div>
          </div>
          <div style={{ width: 1, height: 32, background: BORDER, flexShrink: 0 }} />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", flex: 1 }}>
            {contextStats.map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 8, color: MUTED, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 1 }}>{s.label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Configure Your Primer</h2>
      <p style={{ fontSize: 11, color: MUTED, marginBottom: 20 }}>Choose which sections to include, reorder them, and set the tone and depth.</p>

      {/* Section grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
        {sections.map((sec, i) => (
          <div key={sec.id} style={{
            background: sec.included ? ACCENT + "40" : CARD,
            border: `1px solid ${sec.included ? BLUE + "60" : BORDER}`,
            borderRadius: 8, padding: "10px 12px",
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            {editingId === sec.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "4px 8px", fontSize: 11, color: TEXT, outline: "none" }}
                />
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={2}
                  style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 4, padding: "4px 8px", fontSize: 10, color: SUBTLE, resize: "none", outline: "none" }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => {
                    setSections(prev => prev.map(s => s.id === sec.id ? { ...s, title: editTitle, description: editDesc } : s));
                    setEditingId(null);
                  }} style={{ fontSize: 10, color: GREEN, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Save</button>
                  <button onClick={() => setEditingId(null)} style={{ fontSize: 10, color: MUTED, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Toggle value={sec.included} onChange={v => setSections(prev => prev.map(s => s.id === sec.id ? { ...s, included: v } : s))} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: sec.included ? TEXT : MUTED, flex: 1 }}>{sec.title}</span>
                  <div style={{ display: "flex", gap: 2 }}>
                    <button onClick={() => { setEditingId(sec.id); setEditTitle(sec.title); setEditDesc(sec.description); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 2 }}><Pencil size={11} /></button>
                    {sec.custom && (
                      <button onClick={() => setSections(prev => prev.filter(s => s.id !== sec.id))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: RED, padding: 2 }}><Trash2 size={11} /></button>
                    )}
                    <button onClick={() => move(sec.id, -1)} disabled={i === 0}
                      style={{ background: "none", border: "none", cursor: i === 0 ? "not-allowed" : "pointer", color: MUTED, padding: 2, opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={11} /></button>
                    <button onClick={() => move(sec.id, 1)} disabled={i === sections.length - 1}
                      style={{ background: "none", border: "none", cursor: i === sections.length - 1 ? "not-allowed" : "pointer", color: MUTED, padding: 2, opacity: i === sections.length - 1 ? 0.3 : 1 }}><ChevronDown size={11} /></button>
                  </div>
                </div>
                <p style={{ fontSize: 10, color: MUTED, margin: 0, lineHeight: 1.4 }}>{sec.description}</p>
                {sec.generated && <span style={{ fontSize: 9, color: GREEN, fontWeight: 700 }}>✓ Generated</span>}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add custom section */}
      <button onClick={() => setShowCustomModal(true)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px dashed ${BORDER}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: MUTED, fontSize: 11, marginBottom: 24, width: "100%" }}>
        <Plus size={13} /> Add Custom Section
      </button>

      {/* Tone + Length */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Tone</label>
          <div style={{ display: "flex", gap: 6 }}>
            {tones.map(t => (
              <button key={t.id} onClick={() => setTone(t.id)}
                style={{
                  flex: 1, padding: "8px 4px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: `1px solid ${tone === t.id ? BLUE : BORDER}`,
                  background: tone === t.id ? ACCENT : "transparent", color: tone === t.id ? TEXT : MUTED, cursor: "pointer",
                }}>{t.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Depth</label>
          <div style={{ display: "flex", gap: 6 }}>
            {lengths.map(l => (
              <button key={l.id} onClick={() => setLength(l.id)}
                style={{
                  flex: 1, padding: "8px 4px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: `1px solid ${length === l.id ? BLUE : BORDER}`,
                  background: length === l.id ? ACCENT : "transparent", color: length === l.id ? TEXT : MUTED, cursor: "pointer",
                }}>
                {l.label}<br /><span style={{ fontSize: 9, fontWeight: 400, color: MUTED }}>{l.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={onNext}
        style={{ display: "flex", alignItems: "center", gap: 8, background: BLUE, border: "none", borderRadius: 8, padding: "12px 24px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "white" }}>
        Next: Choose Thesis <ArrowRight size={14} />
      </button>

      {/* Custom section modal */}
      {showCustomModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, width: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: TEXT, margin: 0 }}>Add Custom Section</h3>
              <button onClick={() => setShowCustomModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}><X size={16} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>Section Title</label>
                <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="e.g. ESG Risk Assessment"
                  style={{ width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px", fontSize: 12, color: TEXT, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>Description (optional)</label>
                <input value={customDesc} onChange={e => setCustomDesc(e.target.value)} placeholder="What this section covers"
                  style={{ width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px", fontSize: 12, color: TEXT, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>Content (optional — paste your own content)</label>
                <textarea value={customContent} onChange={e => setCustomContent(e.target.value)} rows={6}
                  placeholder="Leave blank to let AI generate it, or paste your own content here..."
                  style={{ width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px", fontSize: 11, color: TEXT, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setShowCustomModal(false)}
                  style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 14px", cursor: "pointer", fontSize: 11, color: MUTED }}>Cancel</button>
                <button onClick={addCustom}
                  style={{ background: BLUE, border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "white" }}>Add Section</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stage 2: Thesis ────────────────────────────────────────────────────────────

function ThesisStage({
  ticker, companyName, sector, facts, tone, fmpExtended,
  theses, setTheses, selectedThesis, setSelectedThesis, onNext, onBack,
}: {
  ticker: string; companyName: string; sector: string;
  facts: Record<string, number | null>;
  tone: Tone;
  fmpExtended: Record<string, unknown>;
  theses: ThesisOption[]; setTheses: (t: ThesisOption[]) => void;
  selectedThesis: string; setSelectedThesis: (t: string) => void;
  onNext: () => void; onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customThesis, setCustomThesis] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    if (theses.length === 0) generate();
  }, []);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/primer-builder/thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, companyName, sector, facts, tone, fmpExtended }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setTheses(j.theses ?? []);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: 0 }}>Choose Your Investment Thesis</h2>
        <button onClick={generate} disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 12px", cursor: loading ? "not-allowed" : "pointer", fontSize: 10, color: MUTED }}>
          <RefreshCw size={11} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Regenerate
        </button>
      </div>
      <p style={{ fontSize: 11, color: MUTED, marginBottom: 20 }}>Select an investment frame to anchor the entire primer. Claude will write every section through this lens.</p>

      {error && <div style={{ background: "#2e0d0d", border: `1px solid ${RED}40`, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 11, color: "#fca5a5" }}>{error}</div>}

      {/* Skeleton or cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {loading ? [...Array(5)].map((_, i) => (
          <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16, opacity: 1 - i * 0.12 }}>
            <div style={{ height: 14, background: ACCENT, borderRadius: 4, width: "35%", marginBottom: 10 }} />
            <div style={{ height: 10, background: ACCENT, borderRadius: 3, width: "90%", marginBottom: 6 }} />
            <div style={{ height: 10, background: ACCENT, borderRadius: 3, width: "70%" }} />
          </div>
        )) : theses.map((t, i) => {
          const isSelected = selectedThesis === t.core_argument;
          const sc = sentimentColor(t.sentiment);
          return (
            <div key={i} onClick={() => setSelectedThesis(t.core_argument)}
              style={{
                background: isSelected ? ACCENT + "60" : CARD,
                border: `1px solid ${isSelected ? BLUE : BORDER}`,
                borderRadius: 8, padding: 16, cursor: "pointer",
                transition: "all 0.15s",
              }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{t.title}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", padding: "2px 7px", borderRadius: 4, background: sc + "20", color: sc, border: `1px solid ${sc}40` }}>
                      {t.sentiment}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.6, margin: "0 0 0 0", borderLeft: `2px solid ${isSelected ? BLUE : BORDER}`, paddingLeft: 8, fontStyle: "italic" }}>{t.core_argument}</p>
                </div>
                <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 10, border: `2px solid ${isSelected ? BLUE : BORDER}`, background: isSelected ? BLUE : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isSelected && <Check size={12} color="white" />}
                </div>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Key Assumptions</div>
                  {t.key_assumptions.map((a, j) => (
                    <div key={j} style={{ fontSize: 10, color: SUBTLE, marginBottom: 2 }}>• {a}</div>
                  ))}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: RED + "aa", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Invalidating Risk</div>
                  <div style={{ fontSize: 10, color: SUBTLE }}>{t.key_risk}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom thesis */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setShowCustom(v => !v)}
          style={{ fontSize: 11, color: MUTED, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          {showCustom ? "Hide" : "Write my own thesis instead"}
        </button>
        {showCustom && (
          <div style={{ marginTop: 10 }}>
            <textarea
              value={customThesis}
              onChange={e => setCustomThesis(e.target.value)}
              rows={3}
              placeholder="Write your investment thesis here (2-4 sentences)..."
              style={{ width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px", fontSize: 11, color: TEXT, resize: "vertical", outline: "none", boxSizing: "border-box" }}
            />
            <button onClick={() => { setSelectedThesis(customThesis); setShowCustom(false); }}
              style={{ marginTop: 6, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 11, color: TEXT }}>
              Use This Thesis
            </button>
          </div>
        )}
      </div>

      {selectedThesis && (
        <div style={{ background: ACCENT + "30", border: `1px solid ${BLUE}40`, borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 11, color: SUBTLE }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: BLUE, letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>SELECTED THESIS</span>
          {selectedThesis}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack}
          style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 11, color: MUTED }}>
          ← Back
        </button>
        <button onClick={onNext} disabled={!selectedThesis}
          style={{ display: "flex", alignItems: "center", gap: 8, background: selectedThesis ? BLUE : ACCENT, border: "none", borderRadius: 8, padding: "10px 24px", cursor: selectedThesis ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 700, color: selectedThesis ? "white" : MUTED, opacity: selectedThesis ? 1 : 0.6 }}>
          Next: Select Charts <ArrowRight size={14} />
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Stage 3: Charts ────────────────────────────────────────────────────────────

const CHART_DEFS = [
  {
    id: "revenue_fcf",
    label: "Revenue vs Free Cash Flow",
    desc: "5-year paired bars showing revenue growth trajectory alongside FCF. Reveals CapEx compression and OCF quality.",
    dataKeys: ["revenue", "free_cash_flow"],
    type: "bar",
  },
  {
    id: "margins",
    label: "Margin Trends",
    desc: "Gross / Operating / Net margin lines over 5 years. Shows operating leverage, pricing power, and cost structure shift.",
    dataKeys: ["gross_profit", "operating_income", "net_income", "revenue"],
    type: "line",
  },
  {
    id: "eps",
    label: "EPS Trend",
    desc: "Diluted EPS 5-year bars. Shows earnings per share growth, tax effects, and buyback leverage.",
    dataKeys: ["eps_diluted"],
    type: "bar",
  },
  {
    id: "price_range",
    label: "Bear / Base / Bull Scenario Range",
    desc: "Visual price target range with current price shown. Embedded in Valuation section after scenario math.",
    dataKeys: [],
    type: "scenario",
  },
  {
    id: "cap_alloc",
    label: "Capital Allocation Waterfall",
    desc: "FCF deployment: CapEx vs Buybacks vs Dividends vs Cash build. Shows capital priorities at a glance.",
    dataKeys: [],
    type: "bar",
  },
  {
    id: "positioning",
    label: "Quality Signal Cards",
    desc: "ROIC/WACC spread, Net Debt/EBITDA, and OCF/NI earnings quality — with color-coded threshold badges.",
    dataKeys: [],
    type: "cards",
  },
  {
    id: "balance_sheet",
    label: "Balance Sheet — Cash vs Debt",
    desc: "5-year cash & equivalents vs long-term debt bars. Reveals de-leveraging trends, net cash position, and financial flexibility.",
    dataKeys: ["cash", "long_term_debt"],
    type: "bar",
  },
  {
    id: "fcf_quality",
    label: "OCF vs FCF Quality",
    desc: "Operating cash flow vs free cash flow side-by-side. FCF conversion gap exposes CapEx drag and earnings quality.",
    dataKeys: ["operating_cf", "free_cash_flow"],
    type: "bar",
  },
  {
    id: "buyback_sbc",
    label: "Shareholder Returns vs SBC Dilution",
    desc: "Buybacks + dividends (stacked) vs stock-based compensation cost per year. Net value return to shareholders.",
    dataKeys: ["buybacks", "dividends_paid", "sbc_expense"],
    type: "bar",
  },
  {
    id: "capex_trend",
    label: "CapEx Intensity (% of Revenue)",
    desc: "CapEx as a percent of revenue each year. Asset-light vs capital-intensive business model trend at a glance.",
    dataKeys: ["capex", "revenue"],
    type: "line",
  },
  {
    id: "op_leverage",
    label: "Operating Leverage",
    desc: "YoY Revenue Growth % vs Operating Income Growth % side-by-side. When op income outgrows revenue, fixed-cost leverage is working.",
    dataKeys: ["revenue", "operating_income"],
    type: "bar",
  },
  {
    id: "net_debt_trend",
    label: "Net Debt Evolution",
    desc: "Long-term debt minus cash each year. Green bars = net cash, red = net debt. Shows deleveraging or re-leveraging trajectory.",
    dataKeys: ["long_term_debt", "cash"],
    type: "bar",
  },
  {
    id: "fcf_per_share",
    label: "FCF/Share vs EPS",
    desc: "Free cash flow per share vs diluted EPS side-by-side. FCF/share > EPS confirms earnings aren't propped by accruals.",
    dataKeys: ["free_cash_flow", "eps_diluted"],
    type: "bar",
  },
  {
    id: "quality_trend",
    label: "Earnings Quality (OCF/NI)",
    desc: "Operating cash flow divided by net income each year. Consistently above 1.0x confirms cash earnings exceed reported GAAP.",
    dataKeys: ["operating_cf", "net_income"],
    type: "bar",
  },
  {
    id: "revenue_composition",
    label: "Revenue Decomposition",
    desc: "Revenue → Gross Profit → Op Income → Net Income overlaid bars. Shows how much of each revenue dollar reaches shareholders.",
    dataKeys: ["revenue", "gross_profit", "operating_income", "net_income"],
    type: "bar",
  },
];

// ── Chart variant thumbnail renderers ──────────────────────────────────────────

const TW = 128, TH = 72;

// ── Revenue vs FCF ─────────────────────────────────────────────────────────────

function RevV1(revs: number[], fcfs: number[], yrs: string[]) {
  const mx = Math.max(...revs, ...fcfs.map(Math.abs), 1);
  const n = yrs.length; const bw = 9; const sp = (TW - n * bw * 2 - n * 3) / (n + 1);
  return <svg width={TW} height={TH}>
    <line x1={0} y1={TH-14} x2={TW} y2={TH-14} stroke="#2a3a55" strokeWidth={0.5}/>
    {yrs.map((yr, i) => {
      const x = sp + i * (bw * 2 + 3 + sp); const rh = (revs[i] / mx) * (TH - 22); const fh = (Math.abs(fcfs[i]) / mx) * (TH - 22);
      return <g key={yr}><rect x={x} y={TH-14-rh} width={bw} height={Math.max(rh,1)} fill="#1a56db" rx={1}/><rect x={x+bw+3} y={TH-14-fh} width={bw} height={Math.max(fh,1)} fill="#0d6b45" rx={1}/><text x={x+bw} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text></g>;
    })}
  </svg>;
}

function RevV2(revs: number[], fcfs: number[], yrs: string[]) {
  const mx = Math.max(...revs, 1); const bw = Math.max(1, (TW - 20) / yrs.length - 4);
  const xOf = (i: number) => 10 + i * (bw + 4);
  const yOf = (v: number) => TH - 14 - (v / mx) * (TH - 22);
  const pts = yrs.map((_, i) => `${xOf(i) + bw/2},${yOf(fcfs[i])}`).join(" ");
  return <svg width={TW} height={TH}>
    <line x1={0} y1={TH-14} x2={TW} y2={TH-14} stroke="#2a3a55" strokeWidth={0.5}/>
    {yrs.map((yr, i) => {
      const rh = (revs[i] / mx) * (TH - 22);
      return <g key={yr}><rect x={xOf(i)} y={TH-14-rh} width={bw} height={Math.max(rh,1)} fill="#0c1b38" rx={1}/><text x={xOf(i)+bw/2} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text></g>;
    })}
    <polyline points={pts} fill="none" stroke="#16a34a" strokeWidth={1.5}/>
    {yrs.map((_,i) => <circle key={i} cx={xOf(i)+bw/2} cy={yOf(fcfs[i])} r={2.5} fill="#16a34a" stroke="#0a1628" strokeWidth={0.5}/>)}
  </svg>;
}

function RevV3(revs: number[], fcfs: number[], yrs: string[]) {
  const mx = Math.max(...revs, 1); const n = yrs.length;
  const xOf = (i: number) => 4 + (i / (n - 1)) * (TW - 8);
  const yRev = (v: number) => TH - 14 - (v / mx) * (TH - 22);
  const yFcf = (v: number) => TH - 14 - (Math.abs(v) / mx) * (TH - 22);
  const polyR = yrs.map((_,i) => `${xOf(i)},${yRev(revs[i])}`).join(" ") + ` ${xOf(n-1)},${TH-14} 4,${TH-14}`;
  const polyF = yrs.map((_,i) => `${xOf(i)},${yFcf(fcfs[i])}`).join(" ") + ` ${xOf(n-1)},${TH-14} 4,${TH-14}`;
  return <svg width={TW} height={TH}>
    <polygon points={polyR} fill="#1a56db" opacity={0.25}/>
    <polygon points={polyF} fill="#0d6b45" opacity={0.4}/>
    <polyline points={yrs.map((_,i) => `${xOf(i)},${yRev(revs[i])}`).join(" ")} fill="none" stroke="#1a56db" strokeWidth={1.5}/>
    <polyline points={yrs.map((_,i) => `${xOf(i)},${yFcf(fcfs[i])}`).join(" ")} fill="none" stroke="#0d6b45" strokeWidth={1.5}/>
    <line x1={0} y1={TH-14} x2={TW} y2={TH-14} stroke="#2a3a55" strokeWidth={0.5}/>
    {yrs.map((yr,i) => <text key={yr} x={xOf(i)} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text>)}
  </svg>;
}

function RevV4(revs: number[], fcfs: number[], yrs: string[]) {
  const mx = Math.max(...revs, 1); const bw = Math.max(1, (TW - 20) / yrs.length - 4);
  const xOf = (i: number) => 10 + i * (bw + 4);
  return <svg width={TW} height={TH}>
    <line x1={0} y1={TH-14} x2={TW} y2={TH-14} stroke="#2a3a55" strokeWidth={0.5}/>
    {yrs.map((yr, i) => {
      const rh = (revs[i] / mx) * (TH - 22); const fh = (Math.abs(fcfs[i]) / mx) * (TH - 22);
      return <g key={yr}>
        <rect x={xOf(i)} y={TH-14-rh} width={bw} height={Math.max(rh,1)} fill="#1a3a6b" rx={1}/>
        <rect x={xOf(i)} y={TH-14-fh} width={bw} height={Math.max(fh,1)} fill="#0d6b45" rx={1}/>
        <text x={xOf(i)+bw/2} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text>
      </g>;
    })}
  </svg>;
}

function RevV5(revs: number[], fcfs: number[], yrs: string[]) {
  const mx = Math.max(...revs, ...fcfs.map(Math.abs), 1); const n = yrs.length;
  const ROW = (TH - 14) / n; const bMax = TW - 32;
  return <svg width={TW} height={TH}>
    {yrs.map((yr, i) => {
      const y = 4 + i * ROW; const rw = (revs[i] / mx) * bMax; const fw = (Math.abs(fcfs[i]) / mx) * bMax;
      return <g key={yr}>
        <rect x={24} y={y+1} width={Math.max(rw,1)} height={ROW/2-1} fill="#1a56db" rx={1}/>
        <rect x={24} y={y+ROW/2+1} width={Math.max(fw,1)} height={ROW/2-2} fill="#0d6b45" rx={1}/>
        <text x={22} y={y+ROW/2} textAnchor="end" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text>
      </g>;
    })}
    <line x1={TH-14} y1={0} x2={14} y2={TH} stroke="#2a3a55" strokeWidth={0.5}/>
  </svg>;
}

// ── Margins ─────────────────────────────────────────────────────────────────────

function MarV1(gm: number[], om: number[], nm: number[], yrs: string[]) {
  const mx = Math.max(...gm, 10); const mn = Math.min(...nm, 0); const n = yrs.length;
  const xOf = (i: number) => 4 + (i / Math.max(n-1,1)) * (TW - 8);
  const yOf = (v: number) => TH - 14 - ((v - mn) / (mx - mn)) * (TH - 22);
  const pts = (ms: number[]) => ms.map((v,i) => `${xOf(i)},${yOf(v)}`).join(" ");
  return <svg width={TW} height={TH}>
    <polyline points={pts(gm)} fill="none" stroke="#2563eb" strokeWidth={1.5}/>
    <polyline points={pts(om)} fill="none" stroke="#0c1b38" strokeWidth={1.5}/>
    <polyline points={pts(nm)} fill="none" stroke="#0d6b45" strokeWidth={1.5}/>
    <line x1={0} y1={TH-14} x2={TW} y2={TH-14} stroke="#2a3a55" strokeWidth={0.5}/>
    {yrs.map((yr,i) => <text key={yr} x={xOf(i)} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text>)}
  </svg>;
}

function MarV2(gm: number[], om: number[], nm: number[], yrs: string[]) {
  const mx = Math.max(...gm, 10); const mn = Math.min(...nm, 0); const n = yrs.length;
  const xOf = (i: number) => 4 + (i / Math.max(n-1,1)) * (TW - 8);
  const yOf = (v: number) => TH - 14 - ((v - mn) / (mx - mn)) * (TH - 22);
  const area = (ms: number[]) => ms.map((v,i) => `${xOf(i)},${yOf(v)}`).join(" ") + ` ${xOf(n-1)},${TH-14} 4,${TH-14}`;
  return <svg width={TW} height={TH}>
    <polygon points={area(gm)} fill="#2563eb" opacity={0.15}/>
    <polygon points={area(om)} fill="#7c3aed" opacity={0.2}/>
    <polygon points={area(nm)} fill="#0d6b45" opacity={0.3}/>
    <polyline points={gm.map((v,i) => `${xOf(i)},${yOf(v)}`).join(" ")} fill="none" stroke="#2563eb" strokeWidth={1.2}/>
    <polyline points={om.map((v,i) => `${xOf(i)},${yOf(v)}`).join(" ")} fill="none" stroke="#7c3aed" strokeWidth={1.2}/>
    <polyline points={nm.map((v,i) => `${xOf(i)},${yOf(v)}`).join(" ")} fill="none" stroke="#0d6b45" strokeWidth={1.2}/>
    <line x1={0} y1={TH-14} x2={TW} y2={TH-14} stroke="#2a3a55" strokeWidth={0.5}/>
    {yrs.map((yr,i) => <text key={yr} x={xOf(i)} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text>)}
  </svg>;
}

function MarV3(gm: number[], om: number[], nm: number[], yrs: string[]) {
  const mx = Math.max(...gm, 10); const n = yrs.length; const groupW = (TW - 12) / n; const bw = groupW / 3 - 1;
  return <svg width={TW} height={TH}>
    <line x1={0} y1={TH-14} x2={TW} y2={TH-14} stroke="#2a3a55" strokeWidth={0.5}/>
    {yrs.map((yr, i) => {
      const x0 = 6 + i * groupW;
      const gh = (gm[i] / mx) * (TH - 22); const oh = (om[i] / mx) * (TH - 22); const nh = (nm[i] / mx) * (TH - 22);
      return <g key={yr}>
        <rect x={x0} y={TH-14-gh} width={bw} height={Math.max(gh,1)} fill="#2563eb" rx={1}/>
        <rect x={x0+bw+1} y={TH-14-oh} width={bw} height={Math.max(oh,1)} fill="#7c3aed" rx={1}/>
        <rect x={x0+bw*2+2} y={TH-14-nh} width={bw} height={Math.max(nh,1)} fill="#0d6b45" rx={1}/>
        <text x={x0+groupW/2-2} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text>
      </g>;
    })}
  </svg>;
}

function MarV4(gm: number[], om: number[], nm: number[], yrs: string[]) {
  const mx = Math.max(...gm, 10); const mn = Math.min(...nm, 0); const n = yrs.length;
  const xOf = (i: number) => 4 + (i / Math.max(n-1,1)) * (TW - 8);
  const yOf = (v: number) => TH - 14 - ((v - mn) / (mx - mn)) * (TH - 22);
  const step = (ms: number[]) => ms.flatMap((v,i) => i < ms.length-1 ? [`${xOf(i)},${yOf(v)}`, `${xOf(i+1)},${yOf(v)}`] : [`${xOf(i)},${yOf(v)}`]).join(" ");
  return <svg width={TW} height={TH}>
    {/* band fill between gross and net */}
    <polygon points={[...gm.map((v,i) => `${xOf(i)},${yOf(v)}`), ...[...nm].reverse().map((v,i) => `${xOf(n-1-i)},${yOf(v)}`)].join(" ")} fill="#1a56db" opacity={0.08}/>
    <polyline points={step(gm)} fill="none" stroke="#2563eb" strokeWidth={1.5} strokeLinejoin="round"/>
    <polyline points={step(om)} fill="none" stroke="#7c3aed" strokeWidth={1.2} strokeDasharray="4,2"/>
    <polyline points={step(nm)} fill="none" stroke="#0d6b45" strokeWidth={1.5} strokeLinejoin="round"/>
    <line x1={0} y1={TH-14} x2={TW} y2={TH-14} stroke="#2a3a55" strokeWidth={0.5}/>
    {yrs.map((yr,i) => <text key={yr} x={xOf(i)} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text>)}
  </svg>;
}

function MarV5(gm: number[], _om: number[], _nm: number[], yrs: string[]) {
  const mx = Math.max(...gm, 10); const n = yrs.length; const bw = Math.max(1, (TW - 20) / n - 4);
  const xOf = (i: number) => 10 + i * (bw + 4);
  return <svg width={TW} height={TH}>
    <line x1={0} y1={TH-14} x2={TW} y2={TH-14} stroke="#2a3a55" strokeWidth={0.5}/>
    {yrs.map((yr, i) => {
      const gh = (gm[i] / mx) * (TH - 22);
      const intensity = Math.round(40 + (gm[i] / mx) * 175);
      return <g key={yr}>
        <rect x={xOf(i)} y={TH-14-gh} width={bw} height={Math.max(gh,1)} fill={`rgb(${intensity},${Math.round(intensity*0.5)},0)`} rx={1}/>
        <text x={xOf(i)+bw/2} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text>
      </g>;
    })}
  </svg>;
}

// ── EPS ─────────────────────────────────────────────────────────────────────────

function EpsV1(vals: number[], yrs: string[]) {
  const mx = Math.max(...vals.map(Math.abs), 0.01); const bw = Math.max(1, (TW - 20) / yrs.length - 4);
  const xOf = (i: number) => 10 + i * (bw + 4);
  return <svg width={TW} height={TH}>
    <line x1={0} y1={TH/2} x2={TW} y2={TH/2} stroke="#2a3a55" strokeWidth={0.4} strokeDasharray="2,2"/>
    <line x1={0} y1={TH-14} x2={TW} y2={TH-14} stroke="#2a3a55" strokeWidth={0.5}/>
    {yrs.map((yr, i) => {
      const v = vals[i]; const bh = (Math.abs(v) / mx) * (TH/2 - 8);
      const y = v >= 0 ? TH/2 - bh : TH/2;
      return <g key={yr}><rect x={xOf(i)} y={y} width={bw} height={Math.max(bh,1)} fill="#b45309" rx={1}/><text x={xOf(i)+bw/2} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text></g>;
    })}
  </svg>;
}

function EpsV2(vals: number[], yrs: string[]) {
  const mx = Math.max(...vals.map(Math.abs), 0.01);
  const xOf = (i: number) => 8 + i * ((TW - 16) / Math.max(yrs.length-1,1));
  const yOf = (v: number) => TH/2 - (v/mx) * (TH/2 - 8);
  return <svg width={TW} height={TH}>
    <line x1={0} y1={TH/2} x2={TW} y2={TH/2} stroke="#2a3a55" strokeWidth={0.4} strokeDasharray="2,2"/>
    {yrs.map((yr, i) => {
      const cy = yOf(vals[i]);
      return <g key={yr}><line x1={xOf(i)} y1={TH/2} x2={xOf(i)} y2={cy} stroke="#b45309" strokeWidth={1.5}/><circle cx={xOf(i)} cy={cy} r={3} fill="#b45309"/><text x={xOf(i)} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text></g>;
    })}
  </svg>;
}

function EpsV3(vals: number[], yrs: string[]) {
  const mx = Math.max(...vals.map(Math.abs), 0.01); const bw = Math.max(1, (TW - 20) / yrs.length - 4);
  const xOf = (i: number) => 10 + i * (bw + 4);
  return <svg width={TW} height={TH}>
    <line x1={0} y1={TH/2} x2={TW} y2={TH/2} stroke="#2a3a55" strokeWidth={0.4} strokeDasharray="2,2"/>
    {yrs.map((yr, i) => {
      const v = vals[i]; const bh = (Math.abs(v)/mx) * (TH/2-8); const y = v >= 0 ? TH/2-bh : TH/2;
      return <g key={yr}><rect x={xOf(i)} y={y} width={bw} height={Math.max(bh,1)} fill={v >= 0 ? "#0d6b45" : "#b42318"} rx={1}/><text x={xOf(i)+bw/2} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text></g>;
    })}
  </svg>;
}

function EpsV4(vals: number[], yrs: string[]) {
  const mx = Math.max(...vals.map(Math.abs), 0.01); const bw = Math.max(1,(TW-20)/yrs.length-4);
  const xOf = (i: number) => 10 + i*(bw+4);
  return <svg width={TW} height={TH}>
    <line x1={0} y1={TH/2} x2={TW} y2={TH/2} stroke="#2a3a55" strokeWidth={0.4} strokeDasharray="2,2"/>
    {yrs.map((yr, i) => {
      const v = vals[i]; const bh = (Math.abs(v)/mx)*(TH/2-8); const y = v>=0?TH/2-bh:TH/2;
      return <g key={yr}><rect x={xOf(i)} y={y} width={bw} height={Math.max(bh,1)} fill="none" stroke="#b45309" strokeWidth={1} rx={1}/><text x={xOf(i)+bw/2} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text></g>;
    })}
  </svg>;
}

function EpsV5(vals: number[], yrs: string[]) {
  const mx = Math.max(...vals.map(Math.abs), 0.01); const n = yrs.length;
  const xOf = (i: number) => 4+(i/Math.max(n-1,1))*(TW-8);
  const yOf = (v: number) => TH/2-(v/mx)*(TH/2-8);
  const pts = vals.map((v,i) => `${xOf(i)},${yOf(v)}`).join(" ");
  const area = pts + ` ${xOf(n-1)},${TH/2} 4,${TH/2}`;
  return <svg width={TW} height={TH}>
    <line x1={0} y1={TH/2} x2={TW} y2={TH/2} stroke="#2a3a55" strokeWidth={0.4} strokeDasharray="2,2"/>
    <polygon points={area} fill="#b45309" opacity={0.25}/>
    <polyline points={pts} fill="none" stroke="#b45309" strokeWidth={1.5}/>
    {yrs.map((yr,i) => <text key={yr} x={xOf(i)} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>{yr.slice(2,4)}</text>)}
  </svg>;
}

// ── Price Range ─────────────────────────────────────────────────────────────────

const PR_TARGETS = [{ l: "Bear", c: "#b42318", v: 430 }, { l: "Curr", c: "#b45309", v: 620 }, { l: "Base", c: "#1a56db", v: 720 }, { l: "Bull", c: "#0d6b45", v: 950 }];

function PrV1() {
  return <svg width={TW} height={TH}>
    {PR_TARGETS.map((p, i) => { const x = 12 + i * 26; return <g key={p.l}><circle cx={x} cy={TH/2-6} r={7} fill={p.c}/><text x={x} y={TH/2-3} textAnchor="middle" fill="white" fontSize={6} fontWeight="bold">{p.l[0]}</text><text x={x} y={TH-8} textAnchor="middle" fill={p.c} fontSize={7}>${p.v}</text><text x={x} y={TH-1} textAnchor="middle" fill="#4b6484" fontSize={6}>{p.l}</text></g>; })}
  </svg>;
}
function PrV2() {
  const min = 350, max = 1050, range = max - min;
  const xOf = (v: number) => 4 + ((v - min) / range) * (TW - 8);
  return <svg width={TW} height={TH}>
    <rect x={4} y={TH/2-5} width={TW-8} height={10} rx={2} fill="#1a2d4a"/>
    {PR_TARGETS.map(p => <line key={p.l} x1={xOf(p.v)} y1={TH/2-10} x2={xOf(p.v)} y2={TH/2+10} stroke={p.c} strokeWidth={2}/>)}
    {PR_TARGETS.map(p => <text key={p.l} x={xOf(p.v)} y={TH/2-13} textAnchor="middle" fill={p.c} fontSize={6}>{p.l}</text>)}
    {PR_TARGETS.map(p => <text key={p.l+1} x={xOf(p.v)} y={TH-5} textAnchor="middle" fill="#4b6484" fontSize={6}>${p.v}</text>)}
  </svg>;
}
function PrV3() {
  const rowH = (TH - 12) / PR_TARGETS.length;
  return <svg width={TW} height={TH}>
    {PR_TARGETS.map((p, i) => {
      const y = 4 + i * rowH; const bw = (p.v / 1200) * (TW - 40);
      return <g key={p.l}><text x={28} y={y+rowH/2+3} textAnchor="end" fill={p.c} fontSize={6} fontWeight="bold">{p.l}</text><rect x={32} y={y+2} width={Math.max(bw,2)} height={rowH-4} fill={p.c} opacity={0.8} rx={1}/><text x={34+bw} y={y+rowH/2+3} fill="white" fontSize={6}>${p.v}</text></g>;
    })}
  </svg>;
}
function PrV4() {
  return <svg width={TW} height={TH}>
    {PR_TARGETS.map((p, i) => {
      const x = 14 + i * 26; const isUp = i >= 2;
      return <g key={p.l}><line x1={x} y1={isUp?TH/2:TH/2-12} x2={x} y2={isUp?TH/2-12:TH/2} stroke={p.c} strokeWidth={2} markerEnd={`url(#arr-${i})`}/><circle cx={x} cy={TH/2} r={3} fill={p.c} opacity={0.5}/><text x={x} y={isUp?TH/2-16:TH/2+18} textAnchor="middle" fill={p.c} fontSize={6}>${p.v}</text></g>;
    })}
  </svg>;
}
function PrV5() {
  const cx = TW/2, cy = TH/2, r = TH/2-8;
  const tot = 1200 - 350;
  const arc = (start: number, end: number, color: string) => {
    const s = ((start-350)/tot)*Math.PI; const e = ((end-350)/tot)*Math.PI;
    const x1=cx+r*Math.cos(Math.PI+s); const y1=cy+r*Math.sin(Math.PI+s);
    const x2=cx+r*Math.cos(Math.PI+e); const y2=cy+r*Math.sin(Math.PI+e);
    return <path key={color} d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`} fill={color} opacity={0.75}/>;
  };
  const segs = [[350,620,"#b42318"],[620,720,"#b45309"],[720,950,"#1a56db"],[950,1200,"#0d6b45"]] as const;
  return <svg width={TW} height={TH}>{segs.map(([s,e,c]) => arc(s,e,c))}<text x={cx} y={cy+4} textAnchor="middle" fill="white" fontSize={7} fontWeight="bold">$720</text></svg>;
}

// ── Capital Allocation ──────────────────────────────────────────────────────────

const CA_SEGS = [{ l: "CapEx", p: 0.69, c: "#1a56db" }, { l: "Buybacks", p: 0.26, c: "#0c1b38" }, { l: "Dividends", p: 0.05, c: "#0d6b45" }];

function CaV1() {
  let x = 4;
  return <svg width={TW} height={TH}>
    {CA_SEGS.map(s => { const w = s.p * (TW - 8); const el = <rect key={s.l} x={x} y={TH/2-10} width={w} height={20} fill={s.c}/>; x += w; return el; })}
    {(() => { let ox = 4; return CA_SEGS.map(s => { const w = s.p*(TW-8); const el = <text key={s.l} x={ox+w/2} y={TH-5} textAnchor="middle" fill="#4b6484" fontSize={6}>{s.l}</ text>; ox+=w; return el; }); })()}
  </svg>;
}
function CaV2() {
  const cx=TW/2, cy=TH/2, r=Math.min(TW,TH)/2-8;
  let ang = -Math.PI/2;
  return <svg width={TW} height={TH}>
    {CA_SEGS.map(s => {
      const startA=ang; ang+=s.p*2*Math.PI;
      const x1=cx+r*Math.cos(startA); const y1=cy+r*Math.sin(startA);
      const x2=cx+r*Math.cos(ang); const y2=cy+r*Math.sin(ang);
      const large=s.p>0.5?1:0;
      return <path key={s.l} d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`} fill={s.c}/>;
    })}
    <circle cx={cx} cy={cy} r={r*0.45} fill="#0d1020"/>
  </svg>;
}
function CaV3() {
  const sorted = [...CA_SEGS].sort((a,b)=>b.p-a.p);
  let x=2; const H3=TH-16;
  return <svg width={TW} height={TH}>
    <rect x={0} y={0} width={TW} height={TH} fill="#0a1220"/>
    {sorted.map(s => {
      const w = s.p*(TW-4); const el = <g key={s.l}><rect x={x} y={2} width={w-2} height={H3} fill={s.c} opacity={0.85} rx={2}/><text x={x+4} y={H3-4} fill="white" fontSize={6} fontWeight="bold">{s.l}</text></g>; x+=w; return el;
    })}
    {CA_SEGS.map((s,i) => <text key={i} x={4+i*38} y={TH-2} fill="#4b6484" fontSize={6}>{`${(s.p*100).toFixed(0)}%`}</text>)}
  </svg>;
}
function CaV4() {
  const mx = Math.max(...CA_SEGS.map(s=>s.p)); const n=CA_SEGS.length; const bw=(TW-20)/n-4;
  return <svg width={TW} height={TH}>
    <line x1={0} y1={TH-14} x2={TW} y2={TH-14} stroke="#2a3a55" strokeWidth={0.5}/>
    {CA_SEGS.map((s, i) => { const bh=(s.p/mx)*(TH-22); const x=10+i*(bw+4); return <g key={s.l}><rect x={x} y={TH-14-bh} width={bw} height={Math.max(bh,1)} fill={s.c} rx={1}/><text x={x+bw/2} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={5}>{s.l.slice(0,3)}</text></g>; })}
  </svg>;
}
function CaV5() {
  const cols=10, rows=5, total=cols*rows;
  const cells: string[] = [];
  let filled=0;
  CA_SEGS.forEach(s => { const n=Math.round(s.p*total); for(let j=0;j<n&&filled<total;j++,filled++) cells.push(s.c); });
  while(cells.length<total) cells.push("#1a2d4a");
  const cw=(TW-4)/cols, ch=(TH-4)/rows;
  return <svg width={TW} height={TH}>
    {cells.map((c,i) => { const row=Math.floor(i/cols); const col=i%cols; return <rect key={i} x={2+col*cw} y={2+row*ch} width={cw-1} height={ch-1} fill={c} rx={0.5}/>; })}
  </svg>;
}

// ── Positioning (Quality Signals) ───────────────────────────────────────────────

const PQ_CARDS = [{ l: "ROIC/WACC", v: "+12pp", c: "#0d6b45" }, { l: "ND/EBITDA", v: "Net Cash", c: "#0d6b45" }, { l: "OCF/NI", v: "1.28x", c: "#b45309" }];

function PqV1() {
  return <svg width={TW} height={TH}>
    {PQ_CARDS.map((p, i) => { const x=2+i*41; return <g key={p.l}><rect x={x} y={4} width={39} height={TH-10} fill="#0d1f3c" rx={2}/><rect x={x} y={4} width={39} height={2} fill={p.c}/><text x={x+4} y={18} fill="#4b6484" fontSize={5}>{p.l}</text><text x={x+4} y={30} fill="white" fontSize={7} fontWeight="bold">{p.v}</text><rect x={x+4} y={TH-20} width={30} height={8} fill={p.c} opacity={0.25} rx={2}/><text x={x+19} y={TH-13} textAnchor="middle" fill={p.c} fontSize={5} fontWeight="bold">{p.c==="#0d6b45"?"STRONG":"MOD"}</text></g>; })}
  </svg>;
}
function PqV2() {
  return <svg width={TW} height={TH}>
    {PQ_CARDS.map((p, i) => { const y=2+i*((TH-6)/3); const bw=(p.c==="#0d6b45"?0.85:0.55)*(TW-50); return <g key={p.l}><rect x={0} y={y} width={TW} height={(TH-6)/3-1} fill="#f0f4f8" opacity={0.04}/><text x={4} y={y+(TH-6)/3/2+3} fill="#4b6484" fontSize={6}>{p.l}</text><rect x={42} y={y+3} width={bw} height={(TH-6)/3-8} fill={p.c} opacity={0.7} rx={1}/><text x={44+bw} y={y+(TH-6)/3/2+3} fill="white" fontSize={6}>{p.v}</text></g>; })}
  </svg>;
}
function PqV3() {
  const arcs = [0.72, 0.9, 0.55];
  return <svg width={TW} height={TH}>
    {PQ_CARDS.map((p, i) => {
      const cx=14+i*37; const cy=TH/2+4; const r=TH/2-6; const frac=arcs[i];
      const startA=Math.PI; const endA=Math.PI+frac*Math.PI;
      const x1=cx+r*Math.cos(startA); const y1=cy+r*Math.sin(startA);
      const x2=cx+r*Math.cos(endA); const y2=cy+r*Math.sin(endA);
      return <g key={p.l}>
        <path d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="#1a2d4a" strokeWidth={4}/>
        <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${frac>0.5?1:0} 1 ${x2} ${y2}`} fill="none" stroke={p.c} strokeWidth={4}/>
        <text x={cx} y={cy+3} textAnchor="middle" fill="white" fontSize={6} fontWeight="bold">{p.v}</text>
        <text x={cx} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{p.l.slice(0,7)}</text>
      </g>;
    })}
  </svg>;
}
function PqV4() {
  return <svg width={TW} height={TH}>
    {PQ_CARDS.map((p, i) => { const cx=14+i*37; return <g key={p.l}><circle cx={cx} cy={TH/2-4} r={18} fill={p.c} opacity={0.15}/><circle cx={cx} cy={TH/2-4} r={18} fill="none" stroke={p.c} strokeWidth={1.5}/><text x={cx} y={TH/2-8} textAnchor="middle" fill="white" fontSize={6} fontWeight="bold">{p.v}</text><text x={cx} y={TH-5} textAnchor="middle" fill="#4b6484" fontSize={5}>{p.l.slice(0,7)}</text></g>; })}
  </svg>;
}
function PqV5() {
  const scores = [0.85, 0.95, 0.6];
  return <svg width={TW} height={TH}>
    {PQ_CARDS.map((p, i) => {
      const y=4+i*((TH-8)/3); const row=(TH-8)/3-2; const sw=scores[i]*(TW-52);
      return <g key={p.l}><text x={4} y={y+row/2+3} fill="#4b6484" fontSize={6}>{p.l}</text><rect x={46} y={y+2} width={TW-52} height={row-4} fill="#1a2d4a" rx={2}/><rect x={46} y={y+2} width={sw} height={row-4} fill={p.c} rx={2}/><text x={46+sw+2} y={y+row/2+3} fill="white" fontSize={6}>{p.v}</text></g>;
    })}
  </svg>;
}

// Map chart ID → array of {name, render}
function buildVariants(history: Record<string, Record<string, number>>, _facts: Record<string, number | null> | null) {
  const revData = history.revenue ?? {}, fcfData = history.free_cash_flow ?? {};
  const epsData = history.eps_diluted ?? {};
  const gpData = history.gross_profit ?? {}, oiData = history.operating_income ?? {}, niData = history.net_income ?? {};
  const yrs = Object.keys(revData).sort().slice(-5);
  const epYrs = Object.keys(epsData).sort().slice(-5);
  const revs = yrs.map(y => revData[y] ?? 0);
  const fcfs = yrs.map(y => fcfData[y] ?? 0);
  const eps = epYrs.map(y => epsData[y] ?? 0);
  const gm = yrs.map(y => revData[y] ? (gpData[y] ?? 0) / revData[y] * 100 : 0);
  const om = yrs.map(y => revData[y] ? (oiData[y] ?? 0) / revData[y] * 100 : 0);
  const nm = yrs.map(y => revData[y] ? (niData[y] ?? 0) / revData[y] * 100 : 0);
  return {
    revenue_fcf: [
      { name: "Grouped Bars", el: RevV1(revs, fcfs, yrs) },
      { name: "Line Overlay", el: RevV2(revs, fcfs, yrs) },
      { name: "Filled Area", el: RevV3(revs, fcfs, yrs) },
      { name: "Stacked", el: RevV4(revs, fcfs, yrs) },
      { name: "Horizontal", el: RevV5(revs, fcfs, yrs) },
    ],
    margins: [
      { name: "Multi-Line", el: MarV1(gm, om, nm, yrs) },
      { name: "Filled Area", el: MarV2(gm, om, nm, yrs) },
      { name: "Bar Groups", el: MarV3(gm, om, nm, yrs) },
      { name: "Stepped Band", el: MarV4(gm, om, nm, yrs) },
      { name: "Heat Gradient", el: MarV5(gm, om, nm, yrs) },
    ],
    eps: [
      { name: "Bar Chart", el: EpsV1(eps, epYrs) },
      { name: "Lollipop", el: EpsV2(eps, epYrs) },
      { name: "Dual-Tone", el: EpsV3(eps, epYrs) },
      { name: "Outline", el: EpsV4(eps, epYrs) },
      { name: "Mountain", el: EpsV5(eps, epYrs) },
    ],
    price_range: (() => {
      // Use real price data if available
      const cur = _facts?.stock_price ?? null;
      const lo52 = _facts?.week52_low ?? null;
      const hi52 = _facts?.week52_high ?? null;
      const ptC = _facts?.pt_consensus ?? null;
      const ptH = _facts?.pt_high ?? null;
      const ptL = _facts?.pt_low ?? null;
      if (cur && lo52 && hi52) {
        // Build real targets: 52W Low, Current, Consensus PT, 52W High
        const bear = ptL ?? lo52; const bull = ptH ?? hi52 * 1.05;
        const base = ptC ?? (cur * 1.15);
        const realTargets = [
          { l: "52W Low", c: "#b42318", v: Math.round(lo52) },
          { l: "Current", c: "#b45309", v: Math.round(cur) },
          { l: "Consensus", c: "#1a56db", v: Math.round(base) },
          { l: "52W High", c: "#0d6b45", v: Math.round(hi52) },
        ];
        const min2 = Math.min(...realTargets.map(t => t.v)) * 0.95;
        const max2 = Math.max(...realTargets.map(t => t.v)) * 1.05;
        const xOf2 = (v: number) => 4 + ((v - min2) / (max2 - min2)) * (TW - 8);
        return [
          { name: "Color Dots", el: <svg width={TW} height={TH}>
            {realTargets.map((p, i) => { const x = 10 + i * 26; return <g key={p.l}><circle cx={x} cy={TH/2-6} r={7} fill={p.c}/><text x={x} y={TH/2-3} textAnchor="middle" fill="white" fontSize={5.5} fontWeight="bold">{p.l.slice(0,4)}</text><text x={x} y={TH-8} textAnchor="middle" fill={p.c} fontSize={6}>${p.v}</text></g>; })}
          </svg> },
          { name: "Spectrum Bar", el: <svg width={TW} height={TH}>
            <rect x={4} y={TH/2-5} width={TW-8} height={10} rx={2} fill="#1a2d4a"/>
            {realTargets.map(p => <line key={p.l} x1={xOf2(p.v)} y1={TH/2-10} x2={xOf2(p.v)} y2={TH/2+10} stroke={p.c} strokeWidth={2}/>)}
            {realTargets.map(p => <text key={p.l} x={xOf2(p.v)} y={TH/2-13} textAnchor="middle" fill={p.c} fontSize={5.5}>{p.l.slice(0,4)}</text>)}
            {realTargets.map(p => <text key={p.l+1} x={xOf2(p.v)} y={TH-3} textAnchor="middle" fill="#4b6484" fontSize={6}>${p.v}</text>)}
          </svg> },
          { name: "Price Ladder", el: PrV3() },
          { name: "Arrow Targets", el: PrV4() },
          { name: "Donut Gauge", el: PrV5() },
        ];
      }
      return [
        { name: "Color Dots", el: PrV1() },
        { name: "Spectrum Bar", el: PrV2() },
        { name: "Price Ladder", el: PrV3() },
        { name: "Arrow Targets", el: PrV4() },
        { name: "Donut Gauge", el: PrV5() },
      ];
    })(),
    cap_alloc: (() => {
      // Use real cap alloc data if available
      const fcv = _facts?.free_cash_flow ?? null;
      if (fcv && fcv > 0) {
        const capex = _facts?.capex != null ? Math.abs(_facts.capex) : 0;
        const buybk = _facts?.buybacks != null ? Math.abs(_facts.buybacks) : 0;
        const divs = _facts?.dividends_paid != null ? Math.abs(_facts.dividends_paid) : 0;
        const cashBld = Math.max(0, fcv - capex - buybk - divs);
        const total = capex + buybk + divs + cashBld;
        if (total > 0) {
          const segs = [
            { l: "CapEx", p: capex / total, c: "#1a56db" },
            { l: "Buybacks", p: buybk / total, c: "#0c1b38" },
            { l: "Dividends", p: divs / total, c: "#0d6b45" },
            { l: "Cash", p: cashBld / total, c: "#b45309" },
          ].filter(s => s.p > 0.01);
          // Use the real segs — override global
          const oldSegs = [...CA_SEGS];
          CA_SEGS.length = 0; segs.forEach(s => CA_SEGS.push(s));
          const result = [
            { name: "Stacked Bar", el: CaV1() },
            { name: "Donut", el: CaV2() },
            { name: "Treemap", el: CaV3() },
            { name: "Bar per Category", el: CaV4() },
            { name: "Waffle Grid", el: CaV5() },
          ];
          CA_SEGS.length = 0; oldSegs.forEach(s => CA_SEGS.push(s)); // restore
          return result;
        }
      }
      return [
        { name: "Stacked Bar", el: CaV1() },
        { name: "Donut", el: CaV2() },
        { name: "Treemap", el: CaV3() },
        { name: "Bar per Category", el: CaV4() },
        { name: "Waffle Grid", el: CaV5() },
      ];
    })(),
    positioning: (() => {
      // Use real positioning data if available
      const roic = _facts?.roic ?? null;
      const nd = _facts?.net_debt ?? null; const eb = _facts?.ebitda ?? null;
      const ocf = _facts?.operating_cf ?? null; const ni = _facts?.net_income ?? null;
      const roicSprd = roic != null ? roic - 9 : null;
      const ndEb = nd != null && eb != null && eb !== 0 ? nd / eb : null;
      const fcfQ = ocf != null && ni != null && ni !== 0 ? ocf / ni : null;
      if (roicSprd != null || ndEb != null) {
        const cards = [
          { l: "ROIC/WACC", v: roicSprd != null ? `${roicSprd >= 0 ? "+" : ""}${roicSprd.toFixed(1)}pp` : "N/A", c: roicSprd != null ? (roicSprd >= 5 ? "#0d6b45" : roicSprd >= 0 ? "#b45309" : "#b42318") : "#4b6484" },
          { l: "ND/EBITDA", v: ndEb != null ? (ndEb < 0 ? "Net Cash" : `${ndEb.toFixed(1)}x`) : "N/A", c: ndEb != null ? (ndEb < 1 ? "#0d6b45" : ndEb < 3 ? "#b45309" : "#b42318") : "#4b6484" },
          { l: "OCF/NI", v: fcfQ != null ? `${fcfQ.toFixed(2)}x` : "N/A", c: fcfQ != null ? (fcfQ > 1.1 ? "#0d6b45" : fcfQ > 0.8 ? "#b45309" : "#b42318") : "#4b6484" },
        ];
        const oldCards = [...PQ_CARDS];
        PQ_CARDS.length = 0; cards.forEach(c => PQ_CARDS.push(c));
        const result = [
          { name: "Dark Cards", el: PqV1() },
          { name: "Score Bars", el: PqV2() },
          { name: "Gauge Arcs", el: PqV3() },
          { name: "Badge Circles", el: PqV4() },
          { name: "Progress Bars", el: PqV5() },
        ];
        PQ_CARDS.length = 0; oldCards.forEach(c => PQ_CARDS.push(c)); // restore
        return result;
      }
      return [
        { name: "Dark Cards", el: PqV1() },
        { name: "Score Bars", el: PqV2() },
        { name: "Gauge Arcs", el: PqV3() },
        { name: "Badge Circles", el: PqV4() },
        { name: "Progress Bars", el: PqV5() },
      ];
    })(),
    balance_sheet: (() => {
      const cashData = history.cash ?? {}, debtData = history.long_term_debt ?? {};
      const bsYrs = [...new Set([...Object.keys(cashData), ...Object.keys(debtData)])].sort().slice(-5);
      const csh = bsYrs.map(y => cashData[y] ?? 0);
      const dbt = bsYrs.map(y => debtData[y] ?? 0);
      const bsMx = Math.max(...csh, ...dbt, 1);
      const bw2 = Math.max(6, (TW - 20) / Math.max(bsYrs.length, 1) / 2 - 2);
      function BsV1() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {bsYrs.map((yr, i) => {
            const totalW = bsYrs.length * (bw2 * 2 + 2) + (bsYrs.length - 1) * 4;
            const x = (TW - totalW) / 2 + i * (bw2 * 2 + 2 + 4);
            const ch = (csh[i] / bsMx) * (TH - 18); const dh = (dbt[i] / bsMx) * (TH - 18);
            return <g key={yr}><rect x={x} y={TH-12-ch} width={bw2} height={Math.max(ch,1)} fill="#0d6b45" rx={1}/><rect x={x+bw2+2} y={TH-12-dh} width={bw2} height={Math.max(dh,1)} fill="#b42318" rx={1} opacity={0.8}/><text x={x+bw2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;
          })}
        </svg>;
      }
      function BsV2() {
        const n = bsYrs.length; const bw3 = Math.max(4, (TW-16)/n-3);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {bsYrs.map((yr, i) => {
            const x = 4+i*(bw3+3); const ch=(csh[i]/bsMx)*(TH-18); const dh=(dbt[i]/bsMx)*(TH-18);
            return <g key={yr}>
              <rect x={x} y={TH-12-ch} width={bw3} height={Math.max(ch,1)} fill="#1a56db" rx={1}/>
              <line x1={x} y1={TH-12-dh} x2={x+bw3} y2={TH-12-dh} stroke="#b42318" strokeWidth={1.5}/>
              <text x={x+bw3/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text>
            </g>;
          })}
        </svg>;
      }
      function BsV3() {
        const netDebt = bsYrs.map((_,i) => dbt[i] - csh[i]);
        const ndMx = Math.max(...netDebt.map(Math.abs),1);
        const n = bsYrs.length; const bw3 = Math.max(4,(TW-16)/n-3);
        const mid = TH/2-4;
        return <svg width={TW} height={TH}>
          <line x1={0} y1={mid} x2={TW} y2={mid} stroke="#2a3a55" strokeWidth={0.5}/>
          {bsYrs.map((yr,i) => {
            const x=4+i*(bw3+3); const v=netDebt[i]; const h=(Math.abs(v)/ndMx)*(mid-4);
            return <g key={yr}>
              <rect x={x} y={v>=0?mid:mid-h} width={bw3} height={Math.max(h,1)} fill={v>=0?"#b42318":"#0d6b45"} rx={1}/>
              <text x={x+bw3/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text>
            </g>;
          })}
        </svg>;
      }
      function BsV4() {
        const n = bsYrs.length; const xOf = (i:number) => 6+(i/(n-1))*(TW-12);
        const yCsh = (v:number) => TH-12-(v/bsMx)*(TH-18);
        const yDbt = (v:number) => TH-12-(v/bsMx)*(TH-18);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          <polyline points={bsYrs.map((_,i)=>`${xOf(i)},${yCsh(csh[i])}`).join(" ")} fill="none" stroke="#0d6b45" strokeWidth={1.5}/>
          <polyline points={bsYrs.map((_,i)=>`${xOf(i)},${yDbt(dbt[i])}`).join(" ")} fill="none" stroke="#b42318" strokeWidth={1.5}/>
          {bsYrs.map((_,i)=><circle key={i} cx={xOf(i)} cy={yCsh(csh[i])} r={2} fill="#0d6b45"/>)}
          {bsYrs.map((_,i)=><circle key={i+"d"} cx={xOf(i)} cy={yDbt(dbt[i])} r={2} fill="#b42318"/>)}
        </svg>;
      }
      function BsV5() {
        const n = bsYrs.length; const bw3 = Math.max(5,(TW-16)/n-3);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {bsYrs.map((yr,i)=>{
            const x=4+i*(bw3+3); const ch=(csh[i]/bsMx)*(TH-18); const dh=(dbt[i]/bsMx)*(TH-18); const top=TH-12-Math.max(ch,dh);
            return <g key={yr}>
              <rect x={x} y={TH-12-dh} width={bw3} height={Math.max(dh,1)} fill="#b42318" rx={1} opacity={0.35}/>
              <rect x={x} y={TH-12-ch} width={bw3} height={Math.max(ch,1)} fill="#0d6b45" rx={1} opacity={0.9}/>
              <line x1={x} y1={top} x2={x+bw3} y2={top} stroke={csh[i]>dbt[i]?"#0d6b45":"#b42318"} strokeWidth={1}/>
              <text x={x+bw3/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text>
            </g>;
          })}
        </svg>;
      }
      return [
        { name: "Paired Bars", el: BsV1() },
        { name: "Bar + Line", el: BsV2() },
        { name: "Net Debt View", el: BsV3() },
        { name: "Dual Line", el: BsV4() },
        { name: "Overlay Bars", el: BsV5() },
      ];
    })(),
    fcf_quality: (() => {
      const ocfData = history.operating_cf ?? {}, fcfData2 = history.free_cash_flow ?? {};
      const qYrs = [...new Set([...Object.keys(ocfData), ...Object.keys(fcfData2)])].sort().slice(-5);
      const ocf = qYrs.map(y => ocfData[y] ?? 0);
      const fcf2 = qYrs.map(y => fcfData2[y] ?? 0);
      const qMx = Math.max(...ocf.map(Math.abs), ...fcf2.map(Math.abs), 1);
      const bwQ = Math.max(5,(TW-16)/Math.max(qYrs.length,1)/2-2);
      function FqV1() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {qYrs.map((yr,i)=>{
            const totalW=qYrs.length*(bwQ*2+2)+(qYrs.length-1)*4;
            const x=(TW-totalW)/2+i*(bwQ*2+2+4);
            const oh=(Math.max(0,ocf[i])/qMx)*(TH-18); const fh=(Math.max(0,fcf2[i])/qMx)*(TH-18);
            return <g key={yr}><rect x={x} y={TH-12-oh} width={bwQ} height={Math.max(oh,1)} fill="#1a56db" rx={1} opacity={0.85}/><rect x={x+bwQ+2} y={TH-12-fh} width={bwQ} height={Math.max(fh,1)} fill="#0d6b45" rx={1}/><text x={x+bwQ} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;
          })}
        </svg>;
      }
      function FqV2() {
        const n=qYrs.length; const xOf=(i:number)=>6+(i/(n-1))*(TW-12);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          <polyline points={qYrs.map((_,i)=>`${xOf(i)},${TH-12-(Math.max(0,ocf[i])/qMx)*(TH-18)}`).join(" ")} fill="none" stroke="#1a56db" strokeWidth={1.5}/>
          <polyline points={qYrs.map((_,i)=>`${xOf(i)},${TH-12-(Math.max(0,fcf2[i])/qMx)*(TH-18)}`).join(" ")} fill="none" stroke="#0d6b45" strokeWidth={1.5} strokeDasharray="3,2"/>
          {qYrs.map((_,i)=><circle key={i} cx={xOf(i)} cy={TH-12-(Math.max(0,ocf[i])/qMx)*(TH-18)} r={2} fill="#1a56db"/>)}
        </svg>;
      }
      function FqV3() {
        const ratios = qYrs.map((_,i) => ocf[i] !== 0 ? fcf2[i]/ocf[i] : null);
        const n=qYrs.length; const bwQ2=Math.max(5,(TW-16)/n-4);
        const rMx = Math.max(...ratios.filter(r=>r!=null) as number[], 1);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {qYrs.map((yr,i)=>{
            const r=ratios[i]; const x=4+i*(bwQ2+4);
            const h=r!=null?(Math.max(0,r)/rMx)*(TH-18):0;
            return <g key={yr}><rect x={x} y={TH-12-h} width={bwQ2} height={Math.max(h,1)} fill={r!=null&&r>0.85?"#0d6b45":r!=null&&r>0.6?"#b45309":"#b42318"} rx={1}/><text x={x+bwQ2/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;
          })}
        </svg>;
      }
      function FqV4() {
        const n=qYrs.length; const bwQ2=Math.max(4,(TW-16)/n-3);
        return <svg width={TW} height={TH}>
          {qYrs.map((yr,i)=>{
            const x=4+i*(bwQ2+3); const oh=(Math.max(0,ocf[i])/qMx)*(TH-12); const fh=(Math.max(0,fcf2[i])/qMx)*(TH-12);
            return <g key={yr}>
              <rect x={x} y={TH-oh} width={bwQ2} height={Math.max(oh,1)} fill="#0c1b38" rx={1} opacity={0.3}/>
              <rect x={x+bwQ2*0.15} y={TH-fh} width={bwQ2*0.7} height={Math.max(fh,1)} fill="#1a56db" rx={1}/>
              <text x={x+bwQ2/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text>
            </g>;
          })}
        </svg>;
      }
      function FqV5() {
        const n=qYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        const polyO=qYrs.map((_,i)=>`${xOf(i)},${TH-12-(Math.max(0,ocf[i])/qMx)*(TH-18)}`).join(" ")+` ${xOf(n-1)},${TH-12} 6,${TH-12}`;
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          <polygon points={polyO} fill="#1a56db" opacity={0.2}/>
          <polyline points={qYrs.map((_,i)=>`${xOf(i)},${TH-12-(Math.max(0,ocf[i])/qMx)*(TH-18)}`).join(" ")} fill="none" stroke="#1a56db" strokeWidth={1.2}/>
          <polyline points={qYrs.map((_,i)=>`${xOf(i)},${TH-12-(Math.max(0,fcf2[i])/qMx)*(TH-18)}`).join(" ")} fill="none" stroke="#0d6b45" strokeWidth={1.5}/>
        </svg>;
      }
      return [
        { name: "Paired Bars", el: FqV1() },
        { name: "Dual Line", el: FqV2() },
        { name: "Conversion %", el: FqV3() },
        { name: "Overlay Bars", el: FqV4() },
        { name: "Area + Line", el: FqV5() },
      ];
    })(),
    buyback_sbc: (() => {
      const bbData2 = history.buybacks ?? {}, sbcData2 = history.sbc_expense ?? {}, divData2 = history.dividends_paid ?? {};
      const sYrs = [...new Set([...Object.keys(bbData2), ...Object.keys(sbcData2)])].sort().slice(-5);
      const bb2 = sYrs.map(y => Math.abs(bbData2[y] ?? 0));
      const sbc2 = sYrs.map(y => Math.abs(sbcData2[y] ?? 0));
      const div2 = sYrs.map(y => Math.abs(divData2[y] ?? 0));
      const sMx = Math.max(...bb2.map((b,i)=>b+div2[i]), ...sbc2, 1);
      const bwS = Math.max(5,(TW-16)/Math.max(sYrs.length,1)-6);
      function SbV1() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {sYrs.map((yr,i)=>{
            const x=4+i*(bwS+6); const bbH=(bb2[i]/sMx)*(TH-18); const divH=(div2[i]/sMx)*(TH-18); const sbcH=(sbc2[i]/sMx)*(TH-18);
            return <g key={yr}>
              <rect x={x} y={TH-12-bbH-divH} width={bwS} height={Math.max(divH,1)} fill="#0d6b45" rx={0}/>
              <rect x={x} y={TH-12-bbH} width={bwS} height={Math.max(bbH,1)} fill="#1a56db" rx={1}/>
              <rect x={x+bwS+2} y={TH-12-sbcH} width={Math.max(3,bwS*0.4)} height={Math.max(sbcH,1)} fill="#b42318" rx={1} opacity={0.75}/>
              <text x={x+bwS/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text>
            </g>;
          })}
        </svg>;
      }
      function SbV2() {
        const n=sYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          <polyline points={sYrs.map((_,i)=>`${xOf(i)},${TH-12-(bb2[i]/sMx)*(TH-18)}`).join(" ")} fill="none" stroke="#1a56db" strokeWidth={1.5}/>
          <polyline points={sYrs.map((_,i)=>`${xOf(i)},${TH-12-(sbc2[i]/sMx)*(TH-18)}`).join(" ")} fill="none" stroke="#b42318" strokeWidth={1.5} strokeDasharray="3,2"/>
          {sYrs.map((_,i)=>[
            <circle key={i+"bb"} cx={xOf(i)} cy={TH-12-(bb2[i]/sMx)*(TH-18)} r={2} fill="#1a56db"/>,
            <circle key={i+"s"} cx={xOf(i)} cy={TH-12-(sbc2[i]/sMx)*(TH-18)} r={2} fill="#b42318"/>
          ])}
        </svg>;
      }
      function SbV3() {
        const net = sYrs.map((_,i) => bb2[i]+div2[i]-sbc2[i]);
        const nMx=Math.max(...net.map(Math.abs),1); const mid=TH/2-2; const n=sYrs.length; const bwS2=Math.max(5,(TW-16)/n-4);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={mid} x2={TW} y2={mid} stroke="#2a3a55" strokeWidth={0.5}/>
          {sYrs.map((yr,i)=>{
            const x=4+i*(bwS2+4); const v=net[i]; const h=(Math.abs(v)/nMx)*(mid-4);
            return <g key={yr}><rect x={x} y={v>=0?mid-h:mid} width={bwS2} height={Math.max(h,1)} fill={v>=0?"#0d6b45":"#b42318"} rx={1}/><text x={x+bwS2/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;
          })}
        </svg>;
      }
      function SbV4() {
        const n=sYrs.length; const bwS2=Math.max(4,(TW-16)/n-3);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {sYrs.map((yr,i)=>{
            const x=4+i*(bwS2+3); const ret=bb2[i]+div2[i]; const retH=(ret/sMx)*(TH-18); const sbcH=(sbc2[i]/sMx)*(TH-18);
            return <g key={yr}>
              <rect x={x} y={TH-12-retH} width={bwS2} height={Math.max(retH,1)} fill="#1a56db" rx={1} opacity={0.9}/>
              <line x1={x} y1={TH-12-sbcH} x2={x+bwS2} y2={TH-12-sbcH} stroke="#b42318" strokeWidth={1.5}/>
              <text x={x+bwS2/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text>
            </g>;
          })}
        </svg>;
      }
      function SbV5() {
        const n=sYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        const polyB=sYrs.map((_,i)=>`${xOf(i)},${TH-12-((bb2[i]+div2[i])/sMx)*(TH-18)}`).join(" ")+` ${xOf(n-1)},${TH-12} 6,${TH-12}`;
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          <polygon points={polyB} fill="#1a56db" opacity={0.2}/>
          <polyline points={sYrs.map((_,i)=>`${xOf(i)},${TH-12-((bb2[i]+div2[i])/sMx)*(TH-18)}`).join(" ")} fill="none" stroke="#1a56db" strokeWidth={1.5}/>
          <polyline points={sYrs.map((_,i)=>`${xOf(i)},${TH-12-(sbc2[i]/sMx)*(TH-18)}`).join(" ")} fill="none" stroke="#b42318" strokeWidth={1.2} strokeDasharray="3,2"/>
        </svg>;
      }
      return [
        { name: "Stacked Returns", el: SbV1() },
        { name: "Dual Line", el: SbV2() },
        { name: "Net Return Bar", el: SbV3() },
        { name: "Bar + Threshold", el: SbV4() },
        { name: "Area vs Line", el: SbV5() },
      ];
    })(),
    capex_trend: (() => {
      const cxYrs = [...new Set([...Object.keys(history.revenue ?? {}), ...Object.keys(history.capex ?? {})])].sort().slice(-5);
      const cxPcts = cxYrs.map(y => {
        const r = (history.revenue ?? {})[y]; const c = (history.capex ?? {})[y];
        return (r && r !== 0 && c != null) ? (Math.abs(c)/r)*100 : null;
      });
      const cxMx = Math.max(...(cxPcts.filter(p=>p!=null) as number[]), 1);
      const bwCx = Math.max(5,(TW-16)/Math.max(cxYrs.length,1)-5);
      function CxV1() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {cxYrs.map((yr,i)=>{
            const p=cxPcts[i]; const x=4+i*(bwCx+5);
            const h=p!=null?(p/cxMx)*(TH-18):0;
            return <g key={yr}><rect x={x} y={TH-12-h} width={bwCx} height={Math.max(h,1)} fill="#b45309" rx={1}/><text x={x+bwCx/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;
          })}
        </svg>;
      }
      function CxV2() {
        const n=cxYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          <polyline points={cxYrs.map((_,i)=>{const p=cxPcts[i];return `${xOf(i)},${p!=null?TH-12-(p/cxMx)*(TH-18):TH-12}`;}).join(" ")} fill="none" stroke="#b45309" strokeWidth={1.5}/>
          {cxYrs.map((_,i)=>{const p=cxPcts[i];return <circle key={i} cx={xOf(i)} cy={p!=null?TH-12-(p/cxMx)*(TH-18):TH-12} r={2.5} fill="#b45309"/>;}).filter(Boolean)}
        </svg>;
      }
      function CxV3() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {cxYrs.map((yr,i)=>{
            const p=cxPcts[i]; const x=4+i*(bwCx+5); const h=p!=null?(p/cxMx)*(TH-18):0;
            const color=p!=null&&p>15?"#b42318":p!=null&&p>8?"#b45309":"#0d6b45";
            return <g key={yr}><rect x={x} y={TH-12-h} width={bwCx} height={Math.max(h,1)} fill={color} rx={1}/><text x={x+bwCx/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;
          })}
        </svg>;
      }
      function CxV4() {
        const n=cxYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        const poly=cxYrs.map((_,i)=>{const p=cxPcts[i];return `${xOf(i)},${p!=null?TH-12-(p/cxMx)*(TH-18):TH-12}`;}).join(" ")+` ${xOf(n-1)},${TH-12} 6,${TH-12}`;
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          <polygon points={poly} fill="#b45309" opacity={0.2}/>
          <polyline points={cxYrs.map((_,i)=>{const p=cxPcts[i];return `${xOf(i)},${p!=null?TH-12-(p/cxMx)*(TH-18):TH-12}`;}).join(" ")} fill="none" stroke="#b45309" strokeWidth={1.5}/>
        </svg>;
      }
      function CxV5() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {cxYrs.map((yr,i)=>{
            const p=cxPcts[i]; const x=4+i*(bwCx+5); const h=p!=null?(p/cxMx)*(TH-18):0;
            return <g key={yr}>
              <rect x={x} y={TH-12-h} width={bwCx} height={Math.max(h,1)} fill="#0c1b38" rx={1} opacity={0.85}/>
              <rect x={x} y={TH-12-h} width={bwCx} height={2} fill="#b45309"/>
              <text x={x+bwCx/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text>
            </g>;
          })}
        </svg>;
      }
      return [
        { name: "Amber Bars", el: CxV1() },
        { name: "Line + Dots", el: CxV2() },
        { name: "Color-Coded", el: CxV3() },
        { name: "Filled Area", el: CxV4() },
        { name: "Navy + Cap", el: CxV5() },
      ];
    })(),
    op_leverage: (() => {
      const olRevData = history.revenue ?? {}, olOiData = history.operating_income ?? {};
      const olYrs = Object.keys(olRevData).sort().slice(-5);
      const olPairs = olYrs.slice(1).map((yr, i) => {
        const r0=olRevData[olYrs[i]], r1=olRevData[yr], o0=olOiData[olYrs[i]], o1=olOiData[yr];
        return { yr, rev: r0&&r0!==0?((r1-r0)/Math.abs(r0))*100:null, oi: o0&&o0!==0?((o1-o0)/Math.abs(o0))*100:null };
      });
      const olMx = Math.max(...olPairs.flatMap(p=>[Math.abs(p.rev??0),Math.abs(p.oi??0)]),1);
      const olBw = Math.max(5,(TW-16)/Math.max(olPairs.length,1)/2-2);
      const olMid = TH/2-4;
      function OlV1() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={olMid} x2={TW} y2={olMid} stroke="#2a3a55" strokeWidth={0.5} strokeDasharray="3,2"/>
          {olPairs.map((p,i)=>{
            const tot=olPairs.length*(olBw*2+2)+(olPairs.length-1)*4;
            const x=(TW-tot)/2+i*(olBw*2+2+4);
            const rh=p.rev!=null?(Math.abs(p.rev)/olMx)*(olMid-2):0;
            const oh=p.oi!=null?(Math.abs(p.oi)/olMx)*(olMid-2):0;
            const ry=p.rev!=null&&p.rev>=0?olMid-rh:olMid;
            const oy=p.oi!=null&&p.oi>=0?olMid-oh:olMid;
            return <g key={p.yr}><rect x={x} y={ry} width={olBw} height={Math.max(rh,1)} fill="#1a56db" rx={1}/><rect x={x+olBw+2} y={oy} width={olBw} height={Math.max(oh,1)} fill="#0d6b45" rx={1}/><text x={x+olBw} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{p.yr.slice(2,4)}</text></g>;
          })}
        </svg>;
      }
      function OlV2() {
        const n=olPairs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={olMid} x2={TW} y2={olMid} stroke="#2a3a55" strokeWidth={0.5} strokeDasharray="3,2"/>
          <polyline points={olPairs.map((_,i)=>{const p=olPairs[i];return `${xOf(i)},${p.rev!=null?olMid-(p.rev/olMx)*(olMid-2):olMid}`;}).join(" ")} fill="none" stroke="#1a56db" strokeWidth={1.5}/>
          <polyline points={olPairs.map((_,i)=>{const p=olPairs[i];return `${xOf(i)},${p.oi!=null?olMid-(p.oi/olMx)*(olMid-2):olMid}`;}).join(" ")} fill="none" stroke="#0d6b45" strokeWidth={1.5}/>
          {olPairs.map((_,i)=><circle key={i} cx={xOf(i)} cy={(() => {const p=olPairs[i];return p.rev!=null?olMid-(p.rev/olMx)*(olMid-2):olMid;})()} r={2} fill="#1a56db"/>)}
        </svg>;
      }
      function OlV3() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={olMid} x2={TW} y2={olMid} stroke="#2a3a55" strokeWidth={0.5}/>
          {olPairs.map((p,i)=>{
            const bw3=Math.max(4,(TW-12)/Math.max(olPairs.length,1)-4); const x=4+i*(bw3+4);
            const rh=p.rev!=null?(Math.abs(p.rev)/olMx)*(olMid-2):0;
            const oh=p.oi!=null?(Math.abs(p.oi)/olMx)*(olMid-2):0;
            const ry=p.rev!=null&&p.rev>=0?olMid-rh:olMid;
            const oy=p.oi!=null&&p.oi>=0?olMid-oh:olMid;
            const outpacing=p.oi!=null&&p.rev!=null&&Math.abs(p.oi)>Math.abs(p.rev);
            return <g key={p.yr}>
              <rect x={x} y={ry} width={bw3} height={Math.max(rh,1)} fill="#1a56db" opacity={0.4} rx={1}/>
              <rect x={x+bw3*0.15} y={oy} width={bw3*0.7} height={Math.max(oh,1)} fill={outpacing?"#0d6b45":"#b42318"} rx={1}/>
              <text x={x+bw3/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{p.yr.slice(2,4)}</text>
            </g>;
          })}
        </svg>;
      }
      function OlV4() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-10} x2={TW} y2={TH-10} stroke="#2a3a55" strokeWidth={0.5}/>
          {olPairs.map((p,i)=>{
            const bw3=Math.max(5,(TW-14)/Math.max(olPairs.length,1)-3); const x=4+i*(bw3+3);
            const spread=p.rev!=null&&p.oi!=null?p.oi-p.rev:null;
            const h=spread!=null?(Math.abs(spread)/olMx)*(TH-16):0;
            return <g key={p.yr}><rect x={x} y={TH-10-h} width={bw3} height={Math.max(h,1)} fill={spread!=null&&spread>0?"#0d6b45":"#b42318"} rx={1}/><text x={x+bw3/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{p.yr.slice(2,4)}</text></g>;
          })}
        </svg>;
      }
      function OlV5() {
        const n=olPairs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        const polyR=olPairs.map((_,i)=>{const p=olPairs[i];return `${xOf(i)},${p.rev!=null?olMid-(p.rev/olMx)*(olMid-2):olMid}`;}).join(" ")+` ${xOf(n-1)},${olMid} 6,${olMid}`;
        return <svg width={TW} height={TH}>
          <line x1={0} y1={olMid} x2={TW} y2={olMid} stroke="#2a3a55" strokeWidth={0.5}/>
          <polygon points={polyR} fill="#1a56db" opacity={0.15}/>
          <polyline points={olPairs.map((_,i)=>{const p=olPairs[i];return `${xOf(i)},${p.rev!=null?olMid-(p.rev/olMx)*(olMid-2):olMid}`;}).join(" ")} fill="none" stroke="#1a56db" strokeWidth={1.2}/>
          <polyline points={olPairs.map((_,i)=>{const p=olPairs[i];return `${xOf(i)},${p.oi!=null?olMid-(p.oi/olMx)*(olMid-2):olMid}`;}).join(" ")} fill="none" stroke="#0d6b45" strokeWidth={1.5}/>
        </svg>;
      }
      return [
        { name: "Paired Growth Bars", el: OlV1() },
        { name: "Dual Growth Lines", el: OlV2() },
        { name: "Leverage Overlay", el: OlV3() },
        { name: "Spread Bars", el: OlV4() },
        { name: "Area + Line", el: OlV5() },
      ];
    })(),
    net_debt_trend: (() => {
      const ndCashData = history.cash ?? {}, ndDebtData = history.long_term_debt ?? {};
      const ndYrs = [...new Set([...Object.keys(ndCashData), ...Object.keys(ndDebtData)])].sort().slice(-5);
      const ndVals = ndYrs.map(y => (ndDebtData[y] ?? 0) - (ndCashData[y] ?? 0));
      const ndMx = Math.max(...ndVals.map(Math.abs), 1);
      const ndMid = TH / 2 - 4;
      const ndBw = Math.max(5, (TW - 16) / Math.max(ndYrs.length, 1) - 4);
      function NdV1() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={ndMid} x2={TW} y2={ndMid} stroke="#2a3a55" strokeWidth={0.5} strokeDasharray="3,2"/>
          {ndYrs.map((yr,i)=>{const v=ndVals[i]; const h=(Math.abs(v)/ndMx)*(ndMid-2); const x=4+i*(ndBw+4); const y2=v>=0?ndMid:ndMid-h; return <g key={yr}><rect x={x} y={y2} width={ndBw} height={Math.max(h,1)} fill={v<0?"#0d6b45":v/ndMx<0.33?"#b45309":"#b42318"} rx={1}/><text x={x+ndBw/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;})}
        </svg>;
      }
      function NdV2() {
        const n=ndYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={ndMid} x2={TW} y2={ndMid} stroke="#2a3a55" strokeWidth={0.5}/>
          <polyline points={ndYrs.map((_,i)=>`${xOf(i)},${ndMid-(ndVals[i]/ndMx)*(ndMid-2)}`).join(" ")} fill="none" stroke="#1a56db" strokeWidth={1.5}/>
          {ndYrs.map((_,i)=><circle key={i} cx={xOf(i)} cy={ndMid-(ndVals[i]/ndMx)*(ndMid-2)} r={2.5} fill={ndVals[i]<0?"#0d6b45":"#b42318"}/>)}
        </svg>;
      }
      function NdV3() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={ndMid} x2={TW} y2={ndMid} stroke="#2a3a55" strokeWidth={0.5} strokeDasharray="3,2"/>
          {ndYrs.map((yr,i)=>{const v=ndVals[i]; const h=(Math.abs(v)/ndMx)*(ndMid-2); const x=4+i*(ndBw+4); const y2=v>=0?ndMid:ndMid-h;
            return <g key={yr}><rect x={x} y={y2} width={ndBw} height={Math.max(h,1)} fill="#0c1b38" rx={1} opacity={0.3}/><rect x={x} y={y2} width={ndBw} height={2} fill={v<0?"#0d6b45":"#b42318"}/><text x={x+ndBw/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;})}
        </svg>;
      }
      function NdV4() {
        const n=ndYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        const poly=ndYrs.map((_,i)=>`${xOf(i)},${ndMid-(ndVals[i]/ndMx)*(ndMid-2)}`).join(" ")+` ${xOf(n-1)},${ndMid} 6,${ndMid}`;
        return <svg width={TW} height={TH}>
          <line x1={0} y1={ndMid} x2={TW} y2={ndMid} stroke="#2a3a55" strokeWidth={0.5}/>
          <polygon points={poly} fill={ndVals[ndVals.length-1]<0?"#0d6b45":"#b42318"} opacity={0.2}/>
          <polyline points={ndYrs.map((_,i)=>`${xOf(i)},${ndMid-(ndVals[i]/ndMx)*(ndMid-2)}`).join(" ")} fill="none" stroke={ndVals[ndVals.length-1]<0?"#0d6b45":"#b42318"} strokeWidth={1.5}/>
        </svg>;
      }
      function NdV5() {
        return <svg width={TW} height={TH}>
          {ndYrs.map((yr,i)=>{const v=ndVals[i]; const pct=Math.round((v/ndMx)*50+50); const x=4+i*(ndBw+4);
            return <g key={yr}><rect x={x} y={4} width={ndBw} height={TH-14} rx={1} fill="#0c1b38" opacity={0.1}/><rect x={x} y={4+(100-pct)*(TH-14)/100} width={ndBw} height={(pct)*(TH-14)/100} rx={1} fill={v<0?"#0d6b45":"#b42318"} opacity={0.75}/><text x={x+ndBw/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;})}
        </svg>;
      }
      return [
        { name: "Color Bars", el: NdV1() },
        { name: "Line + Dots", el: NdV2() },
        { name: "Cap Bars", el: NdV3() },
        { name: "Filled Area", el: NdV4() },
        { name: "Fill Level", el: NdV5() },
      ];
    })(),
    fcf_per_share: (() => {
      const fpsData = history.free_cash_flow ?? {}, fpsEps = history.eps_diluted ?? {};
      const shares = _facts?.shares_diluted_wtd ?? null;
      const fpsYrs = Object.keys(fpsEps).sort().slice(-5);
      const fpsFcf = fpsYrs.map(y => { const f=fpsData[y]; return (f!=null&&shares&&shares>0)?f/shares:null; });
      const fpsEpV = fpsYrs.map(y => fpsEps[y]??null);
      const fpsAll = [...fpsFcf.filter(v=>v!=null),...fpsEpV.filter(v=>v!=null)] as number[];
      const fpsMx = Math.max(...fpsAll.map(Math.abs),1);
      const fpsBw = Math.max(5,(TW-16)/Math.max(fpsYrs.length,1)/2-2);
      function FpV1() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {fpsYrs.map((yr,i)=>{
            const tot=fpsYrs.length*(fpsBw*2+2)+(fpsYrs.length-1)*4;
            const x=(TW-tot)/2+i*(fpsBw*2+2+4);
            const fh=fpsFcf[i]!=null?(Math.max(0,fpsFcf[i]!)/fpsMx)*(TH-18):0;
            const eh=fpsEpV[i]!=null?(Math.max(0,fpsEpV[i]!)/fpsMx)*(TH-18):0;
            return <g key={yr}><rect x={x} y={TH-12-fh} width={fpsBw} height={Math.max(fh,1)} fill="#0d6b45" rx={1}/><rect x={x+fpsBw+2} y={TH-12-eh} width={fpsBw} height={Math.max(eh,1)} fill="#b45309" rx={1}/><text x={x+fpsBw} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;
          })}
        </svg>;
      }
      function FpV2() {
        const n=fpsYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          <polyline points={fpsYrs.map((_,i)=>`${xOf(i)},${TH-12-(fpsFcf[i]!=null?(Math.max(0,fpsFcf[i]!)/fpsMx)*(TH-18):0)}`).join(" ")} fill="none" stroke="#0d6b45" strokeWidth={1.5}/>
          <polyline points={fpsYrs.map((_,i)=>`${xOf(i)},${TH-12-(fpsEpV[i]!=null?(Math.max(0,fpsEpV[i]!)/fpsMx)*(TH-18):0)}`).join(" ")} fill="none" stroke="#b45309" strokeWidth={1.5} strokeDasharray="3,2"/>
          {fpsYrs.map((_,i)=><circle key={i} cx={xOf(i)} cy={TH-12-(fpsFcf[i]!=null?(Math.max(0,fpsFcf[i]!)/fpsMx)*(TH-18):0)} r={2} fill="#0d6b45"/>)}
        </svg>;
      }
      function FpV3() {
        const ratios=fpsYrs.map((_,i)=>fpsFcf[i]!=null&&fpsEpV[i]!=null&&fpsEpV[i]!>0?fpsFcf[i]!/fpsEpV[i]!:null);
        const rMx=Math.max(...ratios.filter(r=>r!=null) as number[],1);
        const bw3=Math.max(5,(TW-14)/Math.max(fpsYrs.length,1)-3);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {fpsYrs.map((yr,i)=>{const r=ratios[i]; const x=4+i*(bw3+3); const h=r!=null?(r/rMx)*(TH-18):0;
            return <g key={yr}><rect x={x} y={TH-12-h} width={bw3} height={Math.max(h,1)} fill={r!=null&&r>1?"#0d6b45":r!=null&&r>0.7?"#b45309":"#b42318"} rx={1}/><text x={x+bw3/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;})}
        </svg>;
      }
      function FpV4() {
        const n=fpsYrs.length; const bw3=Math.max(4,(TW-14)/n-3);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {fpsYrs.map((yr,i)=>{const x=4+i*(bw3+3); const fh=fpsFcf[i]!=null?(Math.max(0,fpsFcf[i]!)/fpsMx)*(TH-18):0; const eh=fpsEpV[i]!=null?(Math.max(0,fpsEpV[i]!)/fpsMx)*(TH-18):0;
            return <g key={yr}><rect x={x} y={TH-12-eh} width={bw3} height={Math.max(eh,1)} fill="#0c1b38" rx={1} opacity={0.25}/><rect x={x+bw3*0.1} y={TH-12-fh} width={bw3*0.8} height={Math.max(fh,1)} fill="#0d6b45" rx={1}/><text x={x+bw3/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;})}
        </svg>;
      }
      function FpV5() {
        const n=fpsYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        const poly=fpsYrs.map((_,i)=>`${xOf(i)},${TH-12-(fpsFcf[i]!=null?(Math.max(0,fpsFcf[i]!)/fpsMx)*(TH-18):0)}`).join(" ")+` ${xOf(n-1)},${TH-12} 6,${TH-12}`;
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          <polygon points={poly} fill="#0d6b45" opacity={0.2}/>
          <polyline points={fpsYrs.map((_,i)=>`${xOf(i)},${TH-12-(fpsFcf[i]!=null?(Math.max(0,fpsFcf[i]!)/fpsMx)*(TH-18):0)}`).join(" ")} fill="none" stroke="#0d6b45" strokeWidth={1.5}/>
          <polyline points={fpsYrs.map((_,i)=>`${xOf(i)},${TH-12-(fpsEpV[i]!=null?(Math.max(0,fpsEpV[i]!)/fpsMx)*(TH-18):0)}`).join(" ")} fill="none" stroke="#b45309" strokeWidth={1.2} strokeDasharray="3,2"/>
        </svg>;
      }
      return [
        { name: "Paired Bars", el: FpV1() },
        { name: "Dual Line", el: FpV2() },
        { name: "Quality Ratio", el: FpV3() },
        { name: "Overlay Bars", el: FpV4() },
        { name: "Area + Line", el: FpV5() },
      ];
    })(),
    quality_trend: (() => {
      const qtOcf = history.operating_cf ?? {}, qtNi = history.net_income ?? {};
      const qtYrs = [...new Set([...Object.keys(qtOcf), ...Object.keys(qtNi)])].sort().slice(-5);
      const qtRatios = qtYrs.map(y => { const o=qtOcf[y], n=qtNi[y]; return (o!=null&&n!=null&&n!==0)?o/n:null; });
      const qtMx = Math.max(...(qtRatios.filter(r=>r!=null) as number[]),1);
      const qtBw = Math.max(5,(TW-14)/Math.max(qtYrs.length,1)-4);
      const qtRef = TH-12-(1.0/qtMx)*(TH-18);
      function QtV1() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          <line x1={0} y1={qtRef} x2={TW} y2={qtRef} stroke="#b45309" strokeWidth={0.8} strokeDasharray="3,2"/>
          {qtYrs.map((yr,i)=>{const r=qtRatios[i]; const x=4+i*(qtBw+4); const h=r!=null?(Math.max(0,r)/qtMx)*(TH-18):0;
            return <g key={yr}><rect x={x} y={TH-12-h} width={qtBw} height={Math.max(h,1)} fill={r!=null&&r>=1.1?"#0d6b45":r!=null&&r>=0.8?"#b45309":"#b42318"} rx={1}/><text x={x+qtBw/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;})}
        </svg>;
      }
      function QtV2() {
        const n=qtYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          <line x1={0} y1={qtRef} x2={TW} y2={qtRef} stroke="#b45309" strokeWidth={0.8} strokeDasharray="3,2"/>
          <polyline points={qtYrs.map((_,i)=>`${xOf(i)},${qtRatios[i]!=null?TH-12-(Math.max(0,qtRatios[i]!)/qtMx)*(TH-18):TH-12}`).join(" ")} fill="none" stroke="#0d6b45" strokeWidth={1.5}/>
          {qtYrs.map((_,i)=><circle key={i} cx={xOf(i)} cy={qtRatios[i]!=null?TH-12-(Math.max(0,qtRatios[i]!)/qtMx)*(TH-18):TH-12} r={2.5} fill={qtRatios[i]!=null&&qtRatios[i]!>=1?"#0d6b45":"#b42318"}/>)}
        </svg>;
      }
      function QtV3() {
        const n=qtYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        const poly=qtYrs.map((_,i)=>`${xOf(i)},${qtRatios[i]!=null?TH-12-(Math.max(0,qtRatios[i]!)/qtMx)*(TH-18):TH-12}`).join(" ")+` ${xOf(n-1)},${TH-12} 6,${TH-12}`;
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          <line x1={0} y1={qtRef} x2={TW} y2={qtRef} stroke="#b45309" strokeWidth={0.8} strokeDasharray="3,2"/>
          <polygon points={poly} fill="#0d6b45" opacity={0.2}/>
          <polyline points={qtYrs.map((_,i)=>`${xOf(i)},${qtRatios[i]!=null?TH-12-(Math.max(0,qtRatios[i]!)/qtMx)*(TH-18):TH-12}`).join(" ")} fill="none" stroke="#0d6b45" strokeWidth={1.5}/>
        </svg>;
      }
      function QtV4() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {qtYrs.map((yr,i)=>{const r=qtRatios[i]; const x=4+i*(qtBw+4); const h=r!=null?(Math.max(0,r)/qtMx)*(TH-18):0;
            return <g key={yr}><rect x={x} y={TH-12-h} width={qtBw} height={Math.max(h,1)} fill="#0c1b38" rx={1} opacity={0.2}/><rect x={x} y={TH-12-h} width={qtBw} height={2} fill={r!=null&&r>=1?"#0d6b45":"#b42318"}/><text x={x+qtBw/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;})}
        </svg>;
      }
      function QtV5() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {qtYrs.map((yr,i)=>{const r=qtRatios[i]; const x=4+i*(qtBw+4); const h=r!=null?(Math.max(0,r)/qtMx)*(TH-18):0;
            const midH=TH-12-(1.0/qtMx)*(TH-18);
            return <g key={yr}><rect x={x} y={TH-12-h} width={qtBw} height={Math.max(h,1)} fill={r!=null&&r>=1?"#0d6b45":"#b42318"} rx={1} opacity={0.7}/>{r!=null&&r>=1&&<rect x={x} y={midH} width={qtBw} height={Math.max(h-(TH-12-midH),0)} fill="#0d6b45" opacity={0.9}/>}<text x={x+qtBw/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;})}
        </svg>;
      }
      return [
        { name: "Color Bars + 1x", el: QtV1() },
        { name: "Line + Threshold", el: QtV2() },
        { name: "Filled Area", el: QtV3() },
        { name: "Cap Bars", el: QtV4() },
        { name: "Split at 1x", el: QtV5() },
      ];
    })(),
    revenue_composition: (() => {
      const rcRev = history.revenue ?? {}, rcGp = history.gross_profit ?? {}, rcOi = history.operating_income ?? {}, rcNi = history.net_income ?? {};
      const rcYrs = Object.keys(rcRev).sort().slice(-5);
      const revVals = rcYrs.map(y => rcRev[y] ?? 0);
      const gpVals  = rcYrs.map(y => rcGp[y]  ?? 0);
      const oiVals  = rcYrs.map(y => rcOi[y]  ?? 0);
      const niVals  = rcYrs.map(y => rcNi[y]  ?? 0);
      const rcMx = Math.max(...revVals, 1);
      const rcBw = Math.max(6, (TW - 16) / Math.max(rcYrs.length, 1) - 4);
      const colors4 = ["#1a56db","#0d6b45","#b45309","#0c1b38"];
      function RcV1() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {rcYrs.map((yr,i)=>{
            const vals=[revVals[i],gpVals[i],oiVals[i],niVals[i]]; const x=4+i*(rcBw+4);
            return <g key={yr}>{vals.map((v,j)=>{const h=(Math.max(0,v)/rcMx)*(TH-18); const off=j*1.5;
              return <rect key={j} x={x+off} y={TH-12-h} width={Math.max(1,rcBw-off*2)} height={Math.max(h,1)} fill={colors4[j]} rx={1} opacity={j===0?0.2:j===1?0.5:j===2?0.8:1}/>;})}<text x={x+rcBw/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;
          })}
        </svg>;
      }
      function RcV2() {
        const n=rcYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        const series=[[revVals,"#1a56db"],[gpVals,"#0d6b45"],[oiVals,"#b45309"],[niVals,"#0c1b38"]] as [number[], string][];
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {series.map(([vals,clr],si)=><polyline key={si} points={rcYrs.map((_,i)=>`${xOf(i)},${TH-12-(Math.max(0,vals[i])/rcMx)*(TH-18)}`).join(" ")} fill="none" stroke={clr} strokeWidth={1.2} opacity={0.9}/>)}
        </svg>;
      }
      function RcV3() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {rcYrs.map((yr,i)=>{
            const x=4+i*(rcBw+4);
            const revH=(Math.max(0,revVals[i])/rcMx)*(TH-18);
            const cogsH=revH-(Math.max(0,gpVals[i])/rcMx)*(TH-18);
            const gpH=(Math.max(0,gpVals[i])/rcMx)*(TH-18);
            return <g key={yr}>
              <rect x={x} y={TH-12-cogsH} width={rcBw} height={Math.max(cogsH,1)} fill="#b42318" rx={0} opacity={0.6}/>
              <rect x={x} y={TH-12-revH} width={rcBw} height={Math.max(gpH,1)} fill="#1a56db" rx={1} opacity={0.8}/>
              <text x={x+rcBw/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text>
            </g>;
          })}
        </svg>;
      }
      function RcV4() {
        const n=rcYrs.length; const xOf=(i:number)=>6+(i/(n-1||1))*(TW-12);
        const gpPcts=rcYrs.map((_,i)=>revVals[i]>0?gpVals[i]/revVals[i]*100:0);
        const oiPcts=rcYrs.map((_,i)=>revVals[i]>0?oiVals[i]/revVals[i]*100:0);
        const niPcts=rcYrs.map((_,i)=>revVals[i]>0?niVals[i]/revVals[i]*100:0);
        const pMx=Math.max(...gpPcts,1);
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {[[gpPcts,"#0d6b45"],[oiPcts,"#b45309"],[niPcts,"#0c1b38"]] .map(([pcts, clr],si)=><polyline key={si} points={(pcts as number[]).map((_,i)=>`${xOf(i)},${TH-12-((pcts as number[])[i]/pMx)*(TH-18)}`).join(" ")} fill="none" stroke={clr as string} strokeWidth={1.5}/>)}
        </svg>;
      }
      function RcV5() {
        return <svg width={TW} height={TH}>
          <line x1={0} y1={TH-12} x2={TW} y2={TH-12} stroke="#2a3a55" strokeWidth={0.5}/>
          {rcYrs.map((yr,i)=>{
            const vals=[revVals[i],gpVals[i],oiVals[i],niVals[i]]; const x=4+i*(rcBw+4); const bw5=rcBw/4;
            return <g key={yr}>{vals.map((v,j)=>{const h=(Math.max(0,v)/rcMx)*(TH-18); return <rect key={j} x={x+j*bw5} y={TH-12-h} width={bw5-0.5} height={Math.max(h,1)} fill={colors4[j]} rx={0.5}/>;})}<text x={x+rcBw/2} y={TH-2} textAnchor="middle" fill="#4b6484" fontSize={5}>{yr.slice(2,4)}</text></g>;
          })}
        </svg>;
      }
      return [
        { name: "Nested Bars", el: RcV1() },
        { name: "4-Line Flow", el: RcV2() },
        { name: "Rev vs GP Stack", el: RcV3() },
        { name: "Margin % Lines", el: RcV4() },
        { name: "4 Adjacent Bars", el: RcV5() },
      ];
    })(),
  } as Record<string, { name: string; el: React.ReactNode }[]>;
}

function ChartsStage({
  history, facts,
  selectedCharts, setSelectedCharts,
  chartVariants, setChartVariants,
  onNext, onBack,
}: {
  history: Record<string, Record<string, number>>;
  facts: Record<string, number | null>;
  selectedCharts: string[];
  setSelectedCharts: (c: string[]) => void;
  chartVariants: Record<string, number>;
  setChartVariants: (v: Record<string, number>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const variants = buildVariants(history, facts);

  function toggle(id: string) {
    setSelectedCharts(
      selectedCharts.includes(id)
        ? selectedCharts.filter(c => c !== id)
        : [...selectedCharts, id]
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Select Charts &amp; Designs</h2>
      <p style={{ fontSize: 11, color: MUTED, marginBottom: 22 }}>
        Toggle charts on/off, then pick your preferred design from the 5 style variants below each one.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 28 }}>
        {CHART_DEFS.map(chart => {
          const on = selectedCharts.includes(chart.id);
          const chartVars = variants[chart.id] ?? [];
          const selVariant = chartVariants[chart.id] ?? 0;
          return (
            <div key={chart.id} style={{ background: CARD, border: `2px solid ${on ? BLUE : BORDER}`, borderRadius: 10, padding: 16, transition: "border-color 0.15s" }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 3 }}>{chart.label}</div>
                  <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.5, maxWidth: 600 }}>{chart.desc}</div>
                </div>
                {/* Include toggle */}
                <button
                  onClick={() => toggle(chart.id)}
                  style={{
                    flexShrink: 0, marginLeft: 16,
                    padding: "6px 14px", fontSize: 11, fontWeight: 600, borderRadius: 6,
                    border: `1px solid ${on ? BLUE : BORDER}`,
                    background: on ? BLUE : "transparent",
                    color: on ? "white" : MUTED,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                  {on ? <><Check size={11} /> Included</> : "Include"}
                </button>
              </div>

              {/* 5 variant thumbnails */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {chartVars.map((v, vi) => (
                  <div
                    key={vi}
                    onClick={() => setChartVariants({ ...chartVariants, [chart.id]: vi })}
                    style={{
                      cursor: "pointer",
                      border: `2px solid ${selVariant === vi ? BLUE : BORDER}`,
                      borderRadius: 8,
                      overflow: "hidden",
                      background: selVariant === vi ? "#0d1f3c" : BG,
                      transition: "border-color 0.12s, background 0.12s",
                      opacity: on ? 1 : 0.45,
                    }}
                  >
                    <div style={{ padding: "8px 10px 2px", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      {v.el}
                    </div>
                    <div style={{
                      padding: "4px 6px",
                      fontSize: 9, fontWeight: selVariant === vi ? 700 : 400,
                      color: selVariant === vi ? BLUE : MUTED,
                      textAlign: "center",
                      borderTop: `1px solid ${selVariant === vi ? BLUE + "44" : BORDER}`,
                    }}>
                      {v.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={onBack}
          style={{ padding: "10px 20px", fontSize: 11, fontWeight: 600, borderRadius: 7, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, cursor: "pointer" }}>
          ← Back
        </button>
        <button
          onClick={() => setSelectedCharts(CHART_DEFS.map(c => c.id))}
          style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, borderRadius: 7, border: `1px solid ${BORDER}`, background: "transparent", color: TEXT, cursor: "pointer" }}>
          Select All
        </button>
        <button
          onClick={() => setSelectedCharts([])}
          style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, borderRadius: 7, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, cursor: "pointer" }}>
          Clear All
        </button>
        <button onClick={onNext}
          style={{ display: "flex", alignItems: "center", gap: 8, background: BLUE, border: "none", borderRadius: 8, padding: "12px 24px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "white", marginLeft: "auto" }}>
          Next: Build Sections ({selectedCharts.length} chart{selectedCharts.length !== 1 ? "s" : ""}) <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Stage 4: Build ─────────────────────────────────────────────────────────────

function BuildStage({
  ticker, companyName, sections, setSections,
  thesis, tone, length, facts, history, fmpExtended,
  onNext, onBack, initialExpandedId,
}: {
  ticker: string; companyName: string;
  sections: SectionDef[]; setSections: React.Dispatch<React.SetStateAction<SectionDef[]>>;
  thesis: string; tone: Tone; length: Length;
  facts: Record<string, number | null>;
  history: Record<string, Record<string, number>>;
  fmpExtended: Record<string, unknown>;
  onNext: () => void; onBack: () => void;
  initialExpandedId?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [editContent, setEditContent] = useState("");
  const [generatingAll, setGeneratingAll] = useState(false);

  // When arriving from ReviewStage with a target section, expand and scroll to it
  useEffect(() => {
    if (!initialExpandedId) return;
    const target = sections.find(s => s.id === initialExpandedId);
    if (target?.generated && target.content) {
      setEditingId(initialExpandedId);
      setEditContent(target.content);
    }
    const el = sectionRefs.current[initialExpandedId];
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }, [initialExpandedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const included = sections.filter(s => s.included);
  const generated = included.filter(s => s.generated).length;

  function buildDocumentContext(upToId: string): string {
    const relevant = sections.filter(s => s.included && s.generated && s.content && s.id !== upToId);
    if (relevant.length === 0) return "";
    // Extract key numbers already cited to prevent repetition — pass short summaries, not full text
    const snippets = relevant.map(s => {
      const text = s.content;
      // Pull out any dollar amounts, percentages, and named metrics cited
      const dollars = (text.match(/\$[\d,.]+[BMK]?/g) ?? []).slice(0, 4);
      const pcts    = (text.match(/[\d.]+%/g) ?? []).slice(0, 4);
      const bullets = text.split("\n").filter(l => l.trim().startsWith("•")).slice(0, 3).map(l => l.trim().slice(0, 80));
      const citedNumbers = [...dollars, ...pcts].join(", ");
      const preview = bullets.length > 0
        ? bullets.join(" | ")
        : text.slice(0, 200).replace(/\n/g, " ").trim();
      return `## ${s.title} [already written — do NOT repeat these facts: ${citedNumbers}]\n${preview}`;
    });
    return snippets.join("\n\n");
  }

  async function generateSection(id: string) {
    const sec = sections.find(s => s.id === id);
    if (!sec || sec.userEdited) return;
    setSections(prev => prev.map(s => s.id === id ? { ...s, generating: true, content: "" } : s));
    setExpandedId(id);

    const docCtx = buildDocumentContext(id);
    try {
      const r = await fetch("/api/primer-builder/section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker, companyName,
          sectionId: sec.id, sectionTitle: sec.title, sectionDescription: sec.description,
          thesis, tone, length, facts, history, fmpExtended, documentContext: docCtx,
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
            if (j.text) setSections(prev => prev.map(s => s.id === id ? { ...s, content: s.content + j.text } : s));
          } catch { /* skip */ }
        }
      }
      setSections(prev => prev.map(s => s.id === id ? { ...s, generating: false, generated: true } : s));
    } catch (e) {
      setSections(prev => prev.map(s => s.id === id ? { ...s, generating: false, content: `Error: ${e}` } : s));
    }
  }

  async function generateAll() {
    setGeneratingAll(true);
    const toGenerate = included.filter(s => !s.generated && !s.userEdited);
    // Smart ordering: executive_summary last — it needs context from all others
    const execIdx = toGenerate.findIndex(s => s.id === "executive_summary");
    const ordered = execIdx >= 0
      ? [...toGenerate.slice(0, execIdx), ...toGenerate.slice(execIdx + 1), toGenerate[execIdx]]
      : toGenerate;
    // Run in parallel batches of 3 — dramatically faster than sequential
    const BATCH = 3;
    for (let i = 0; i < ordered.length; i += BATCH) {
      await Promise.all(ordered.slice(i, i + BATCH).map(s => generateSection(s.id)));
    }
    setGeneratingAll(false);
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: 0, marginBottom: 2 }}>Build Sections</h2>
          <div style={{ fontSize: 11, color: MUTED }}>{generated}/{included.length} sections generated</div>
        </div>
        {/* Progress bar */}
        <div style={{ width: 160, height: 4, background: ACCENT, borderRadius: 2 }}>
          <div style={{ height: "100%", background: BLUE, borderRadius: 2, width: `${included.length > 0 ? (generated / included.length) * 100 : 0}%`, transition: "width 0.5s" }} />
        </div>
        <button onClick={generateAll} disabled={generatingAll || generated === included.length}
          style={{ display: "flex", alignItems: "center", gap: 6, background: generatingAll ? ACCENT : BLUE, border: "none", borderRadius: 8, padding: "8px 16px", cursor: generatingAll ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: "white" }}>
          <Sparkles size={12} style={{ animation: generatingAll ? "spin 1s linear infinite" : "none" }} />
          {generatingAll ? `Generating… (${generated}/${included.length})` : "Generate All (3× parallel)"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {included.map(sec => {
          const isExpanded = expandedId === sec.id;
          const isEditing = editingId === sec.id;
          const statusColor = sec.userEdited ? AMBER : sec.generated ? GREEN : MUTED;
          const statusLabel = sec.userEdited ? "Edited" : sec.generated ? "Generated" : sec.generating ? "Generating…" : "Not generated";
          const wordCount = sec.content ? sec.content.split(/\s+/).filter(Boolean).length : 0;

          return (
            <div key={sec.id} ref={el => { sectionRefs.current[sec.id] = el; }}
              style={{ background: CARD, border: `1px solid ${initialExpandedId === sec.id ? BLUE : BORDER}`, borderRadius: 8, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" }}
                onClick={() => setExpandedId(isExpanded ? null : sec.id)}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: statusColor, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, flex: 1 }}>{sec.title}</span>
                <span style={{ fontSize: 9, color: statusColor, fontWeight: 700, letterSpacing: "0.06em" }}>
                  {statusLabel}{wordCount > 0 && <span style={{ color: MUTED, fontWeight: 400, marginLeft: 4 }}>· {wordCount}w</span>}
                </span>
                {sec.userEdited && <Lock size={10} color={AMBER} />}
                <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                  {!sec.userEdited && (
                    <button onClick={() => generateSection(sec.id)} disabled={sec.generating}
                      style={{ display: "flex", alignItems: "center", gap: 4, background: ACCENT, border: `1px solid ${BLUE}60`, borderRadius: 5, padding: "4px 10px", cursor: sec.generating ? "not-allowed" : "pointer", fontSize: 10, color: TEXT }}>
                      {sec.generating ? <RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Wand2 size={10} />}
                      {sec.generated ? "Regenerate" : "Generate"}
                    </button>
                  )}
                  {sec.generated && !isEditing && (
                    <button onClick={() => { setEditingId(sec.id); setEditContent(sec.content); setExpandedId(sec.id); }}
                      style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 10, color: MUTED }}>
                      <Pencil size={10} /> Edit
                    </button>
                  )}
                  {sec.userEdited && (
                    <button onClick={() => setSections(prev => prev.map(s => s.id === sec.id ? { ...s, userEdited: false } : s))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: AMBER, fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}>
                      <Unlock size={10} /> Unlock
                    </button>
                  )}
                </div>
                <ChevronDown size={13} color={MUTED} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </div>

              {/* Content */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: 14 }}>
                  {isEditing ? (
                    <div>
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={16}
                        style={{ width: "100%", background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "10px 12px", fontSize: 11, color: TEXT, resize: "vertical", outline: "none", fontFamily: "monospace", boxSizing: "border-box" }}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => {
                          setSections(prev => prev.map(s => s.id === sec.id ? { ...s, content: editContent, userEdited: true, generated: true } : s));
                          setEditingId(null);
                        }} style={{ background: GREEN + "20", border: `1px solid ${GREEN}40`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: GREEN }}>
                          <Check size={11} style={{ marginRight: 4 }} />Save
                        </button>
                        <button onClick={() => setEditingId(null)}
                          style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 11, color: MUTED }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : sec.content ? (
                    <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {sec.content}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: MUTED, textAlign: "center", padding: "20px 0" }}>
                      Click "Generate" to write this section with AI, or "Edit" to write it yourself.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack}
          style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 11, color: MUTED }}>
          ← Back
        </button>
        <button onClick={onNext}
          style={{ display: "flex", alignItems: "center", gap: 8, background: BLUE, border: "none", borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "white" }}>
          Review & Export <ArrowRight size={14} />
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Stage 4: Review ────────────────────────────────────────────────────────────

interface SynthesisResult {
  suggestions: string[];
  inconsistencies: string[];
  overallFeedback: string;
}

function ReviewStage({
  ticker, companyName, industry, sections, selectedThesis, facts, history, sector, selectedCharts, chartVariants, fmpExtended,
  onBack, onEditSection, onRestart,
}: {
  ticker: string; companyName: string; industry: string;
  sections: SectionDef[];
  selectedThesis: string;
  facts: Record<string, number | null>;
  history: Record<string, Record<string, number>>;
  sector: string;
  selectedCharts?: string[];
  chartVariants?: Record<string, number>;
  fmpExtended?: Record<string, unknown>;
  onBack: () => void; onEditSection: (sectionId: string) => void; onRestart: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null);
  const assembled = sections
    .filter(s => s.included && s.content)
    .map(s => `## ${s.title.toUpperCase()}\n\n${s.content}`)
    .join("\n\n---\n\n");

  function copyMarkdown() {
    navigator.clipboard.writeText(assembled).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  async function polish() {
    setPolishing(true);
    setSynthesis(null);
    try {
      const res = await fetch("/api/primer-builder/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker, companyName,
          thesis: selectedThesis,
          sections: sections.filter(s => s.included && s.content).map(s => ({ id: s.id, title: s.title, content: s.content })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSynthesis(data);
      }
    } catch { /* ignore */ }
    setPolishing(false);
  }

  const wordCount = assembled.split(/\s+/).filter(Boolean).length;
  const readMin = Math.ceil(wordCount / 250);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: 0, flex: 1 }}>Review & Export</h2>
        <span style={{ fontSize: 10, color: MUTED }}>{wordCount} words · {readMin} min read</span>
        <button onClick={polish} disabled={polishing}
          style={{ display: "flex", alignItems: "center", gap: 6, background: polishing ? ACCENT : "#1a2d4a", border: `1px solid ${BLUE}40`, borderRadius: 6, padding: "7px 14px", cursor: polishing ? "not-allowed" : "pointer", fontSize: 11, color: BLUE, fontWeight: 600, opacity: polishing ? 0.7 : 1 }}>
          <Sparkles size={11} /> {polishing ? "Analyzing…" : "Polish Document"}
        </button>
        <button onClick={copyMarkdown}
          style={{ display: "flex", alignItems: "center", gap: 6, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 11, color: copied ? GREEN : MUTED }}>
          {copied ? <Check size={11} color={GREEN} /> : <Copy size={11} />} {copied ? "Copied!" : "Copy Markdown"}
        </button>
        <PrimerDownloadButton
          ticker={ticker}
          companyName={companyName}
          industry={industry}
          content={assembled}
          history={history}
          facts={facts as Record<string, number>}
          sector={sector}
          selectedCharts={selectedCharts}
          chartVariants={chartVariants}
          fmpExtended={fmpExtended as Record<string, unknown>}
        />
        <button onClick={onBack}
          style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 11, color: MUTED }}>
          ← Edit
        </button>
        <button onClick={onRestart}
          style={{ background: "none", border: `1px solid ${RED}40`, borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 11, color: RED + "99" }}>
          Start Over
        </button>
      </div>

      {/* Synthesis / Polish results */}
      {synthesis && (
        <div style={{ background: CARD, border: `1px solid ${BLUE}40`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: BLUE, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={12} /> Editor&apos;s Assessment
          </div>
          {synthesis.overallFeedback && (
            <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.7, marginBottom: 14, padding: "10px 14px", background: BG, borderRadius: 6, borderLeft: `3px solid ${BLUE}` }}>
              {synthesis.overallFeedback}
            </div>
          )}
          {synthesis.suggestions.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Improvement Suggestions</div>
              {synthesis.suggestions.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 9, background: GREEN + "20", border: `1px solid ${GREEN}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color: GREEN }}>{i + 1}</span>
                  </div>
                  <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.6 }}>{s}</div>
                </div>
              ))}
            </div>
          )}
          {synthesis.inconsistencies.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Inconsistencies Found</div>
              {synthesis.inconsistencies.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 11, color: AMBER, flexShrink: 0 }}>⚠</span>
                  <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.6 }}>{s}</div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setSynthesis(null)}
            style={{ marginTop: 10, fontSize: 10, color: MUTED, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Sections preview */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, background: "#04090f", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{companyName} ({ticker}) — Equity Research Primer</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
              {sections.filter(s => s.included && s.content).length} sections · {wordCount} words
            </div>
          </div>
          {/* Section progress chips */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 360 }}>
            {sections.filter(s => s.included).map(sec => (
              <span key={sec.id} style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, fontWeight: 700, background: sec.content ? (sec.userEdited ? AMBER + "20" : GREEN + "15") : ACCENT, color: sec.content ? (sec.userEdited ? AMBER : GREEN) : MUTED, border: `1px solid ${sec.content ? (sec.userEdited ? AMBER + "40" : GREEN + "30") : BORDER}` }}>
                {sec.title.split(" ").slice(0, 2).join(" ")}
              </span>
            ))}
          </div>
        </div>
        <div style={{ padding: "20px 24px", maxHeight: 600, overflowY: "auto" }}>
          {sections.filter(s => s.included && s.content).map((sec, i) => {
            const wc = sec.content.split(/\s+/).filter(Boolean).length;
            const wcColor = wc < 300 ? RED : wc < 600 ? AMBER : GREEN;
            return (
            <div key={i} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: BLUE, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {sec.title}
                  {sec.userEdited && <span style={{ fontSize: 8, color: AMBER, fontWeight: 600 }}>• edited</span>}
                  <span style={{ fontSize: 8, color: wcColor, fontWeight: 600 }}>{wc}w</span>
                </span>
                <button onClick={() => onEditSection(sec.id)} style={{ fontSize: 8, color: MUTED, background: "none", border: `1px solid ${BORDER}`, borderRadius: 3, padding: "2px 7px", cursor: "pointer", fontWeight: 600, letterSpacing: "0.04em", textTransform: "none" }}>
                  ✎ Edit
                </button>
              </div>
              <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                {sec.content}
              </div>
            </div>
            );
          })}
          {sections.filter(s => s.included && !s.content).length > 0 && (
            <div style={{ background: ACCENT + "30", border: `1px solid ${AMBER}30`, borderRadius: 6, padding: "10px 14px", fontSize: 11, color: AMBER }}>
              ⚠ {sections.filter(s => s.included && !s.content).length} section(s) have not been generated yet and are excluded from the export.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Chat Panel helpers ─────────────────────────────────────────────────────────

function parseSectionBlocks(content: string): { id: string; text: string }[] {
  const regex = /```section:([a-z_]+)\n([\s\S]*?)```/g;
  const blocks: { id: string; text: string }[] = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    blocks.push({ id: m[1], text: m[2].trim() });
  }
  return blocks;
}

// ── Chat Panel ─────────────────────────────────────────────────────────────────

function ChatPanel({
  ticker, companyName, stage, sections, setSections, selectedThesis, tone, length,
}: {
  ticker: string; companyName: string; stage: BuildStage;
  sections: SectionDef[]; setSections: React.Dispatch<React.SetStateAction<SectionDef[]>>;
  selectedThesis: string; tone: Tone; length: Length;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: `I'm your primer co-pilot for **${ticker}** (${companyName}). Ask me to refine any section, explore a different investment angle, add a specific risk, or rewrite content in a different tone. I can also produce full section drafts for you to paste in.` }
  ]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const generatedIds = sections.filter(s => s.included && s.generated).map(s => s.id);
  const quickActions = [
    ...(generatedIds.includes("executive_summary") ? ["Punch up the Executive Summary opening"] : []),
    ...(generatedIds.includes("key_risks") ? ["What risk am I most likely missing?"] : []),
    ...(generatedIds.includes("valuation") ? ["Check the valuation math — does the price target arithmetic work?"] : []),
    ...(generatedIds.includes("investment_thesis") ? ["Strengthen the bear case with specific numbers"] : []),
    ...(generatedIds.includes("financial_analysis") ? ["What's the most important financial trend to call out?"] : []),
    ...(generatedIds.includes("earnings_questions") ? ["Make the earnings questions more pointed and specific"] : []),
    "What's the single number to watch most closely?",
    "What would cause you to flip your thesis?",
  ].slice(0, 5);

  const handleChatScroll = () => {
    if (!chatRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
    userScrolledRef.current = scrollHeight - scrollTop - clientHeight > 100;
  };

  useEffect(() => {
    if (!userScrolledRef.current && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!running) {
      userScrolledRef.current = false;
      if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [running]);

  const handleApplySectionContent = (sectionId: string, content: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, content, userEdited: true, generated: true } : s
    ));
  };

  const systemPrompt = `You are an AI co-pilot helping build an institutional equity research primer for ${ticker} (${companyName}).

Current state:
- Stage: ${stage} | Tone: ${tone} | Length: ${length}
- Thesis: ${selectedThesis || "none selected yet"}
- Sections included: ${sections.filter(s => s.included).map(s => s.title).join(", ")}
- Not yet generated: ${sections.filter(s => s.included && !s.generated).map(s => s.title).join(", ") || "all generated"}

COMPLETE DOCUMENT CONTENT (full text of all generated sections):
${sections.filter(s => s.included && s.generated && s.content).map(s =>
  `\n---\n## ${s.title}\n${s.content}`
).join("\n") || "(no sections generated yet)"}

You have the FULL text of every generated section above. When the user asks you to check, verify, or improve a section, read the actual content above and respond with specific numbers and references.

When producing replacement content for a section, format it EXACTLY like this so the user can click Apply:
\`\`\`section:SECTION_ID
[full replacement content here]
\`\`\`

Available section IDs: ${sections.filter(s => s.included).map(s => s.id).join(", ")}

Be direct. Reference specific numbers. Never say "I don't see the content" — it is all above.`;

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || running) return;
    setInput("");
    const newMsgs: ChatMsg[] = [...messages, { role: "user", content: msg }];
    setMessages(newMsgs);
    setRunning(true);

    const assistantIdx = newMsgs.length;
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const r = await fetch("/api/primer-builder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, systemPrompt }),
      });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMessages(prev => prev.map((m, i) => i === assistantIdx ? { ...m, content: m.content + chunk } : m));
      }
    } catch (e) {
      setMessages(prev => prev.map((m, i) => i === assistantIdx ? { ...m, content: `Error: ${e}` } : m));
    }
    setRunning(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: CARD, borderLeft: `1px solid ${BORDER}` }}>
      {/* Header */}
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
        <MessageSquare size={13} color={BLUE} />
        <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>Primer Co-Pilot</span>
      </div>

      {/* Messages */}
      <div ref={chatRef} onScroll={handleChatScroll} style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0" }}>
        {messages.map((m, i) => {
          const sectionBlocks = m.role === "assistant" ? parseSectionBlocks(m.content) : [];
          // Strip section code blocks from displayed text
          const displayContent = m.role === "assistant"
            ? m.content.replace(/```section:[a-z_]+\n[\s\S]*?```/g, "").trim()
            : m.content;
          return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "85%", padding: "8px 11px", borderRadius: 8, fontSize: 11, lineHeight: 1.6,
                  background: m.role === "user" ? ACCENT : BG,
                  border: `1px solid ${m.role === "user" ? BLUE + "60" : BORDER}`,
                  color: m.role === "user" ? TEXT : SUBTLE,
                  whiteSpace: "pre-wrap",
                }}>
                  {displayContent || (running && i === messages.length - 1 ? "▋" : "")}
                </div>
              </div>
              {sectionBlocks.map((blk, bi) => {
                const sec = sections.find(s => s.id === blk.id);
                return (
                  <div key={bi} style={{ margin: "6px 0 6px 4px", background: "#0a1628", border: `1px solid ${BLUE}40`, borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ padding: "6px 10px", background: "#0d1e38", borderBottom: `1px solid ${BLUE}30`, fontSize: 9, color: MUTED, fontWeight: 700, letterSpacing: "0.06em" }}>
                      REPLACEMENT CONTENT FOR: {sec?.title ?? blk.id.toUpperCase()}
                    </div>
                    <div style={{ padding: "8px 10px", fontSize: 10, color: SUBTLE, maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {blk.text.slice(0, 400)}{blk.text.length > 400 ? "…" : ""}
                    </div>
                    <div style={{ padding: "6px 10px", borderTop: `1px solid ${BLUE}30` }}>
                      <button
                        onClick={() => handleApplySectionContent(blk.id, blk.text)}
                        style={{ fontSize: 9, fontWeight: 700, padding: "4px 12px", borderRadius: 4, background: BLUE, border: "none", color: "white", cursor: "pointer", letterSpacing: "0.04em" }}
                      >
                        ✓ Apply to {sec?.title ?? blk.id}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div style={{ padding: "8px 10px 0", display: "flex", flexWrap: "wrap", gap: 4 }}>
        {quickActions.map(a => (
          <button key={a} onClick={() => send(a)}
            style={{ fontSize: 9, padding: "3px 8px", borderRadius: 10, background: BG, border: `1px solid ${BORDER}`, cursor: "pointer", color: MUTED }}>
            {a}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "10px 10px 12px", display: "flex", gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (!e.shiftKey || e.metaKey || e.ctrlKey) && (e.preventDefault(), send())}
          placeholder="Ask anything about the primer…"
          style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "7px 10px", fontSize: 11, color: TEXT, outline: "none" }}
        />
        <button onClick={() => send()} disabled={running || !input.trim()}
          style={{ background: BLUE, border: "none", borderRadius: 6, padding: "7px 10px", cursor: running ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: running || !input.trim() ? 0.5 : 1 }}>
          <Send size={13} color="white" />
        </button>
      </div>
    </div>
  );
}

// ── Main PrimerBuilder ─────────────────────────────────────────────────────────

interface PrimerBuilderProps {
  ticker: string;
  data: {
    company: { ticker: string; name: string; sic_description?: string };
    xbrl_facts: Record<string, number | null>;
    history: Record<string, Record<string, number>>;
    fmp_extended?: Record<string, unknown>;
    annual?: { sections: unknown[] };
    quarterly?: { sections: unknown[] };
  };
}

export default function PrimerBuilder({ ticker, data }: PrimerBuilderProps) {
  const companyName = data.company.name ?? ticker;
  const sector = (data.fmp_extended?.sector as string) ?? data.company.sic_description ?? "";
  const industry = (data.fmp_extended?.fmp_industry as string) ?? data.company.sic_description ?? "";
  const facts = data.xbrl_facts ?? {};
  const history = data.history ?? {};
  const fmpExtended = data.fmp_extended ?? {};

  const [stage, setStage] = useState<BuildStage>("configure");
  const [sections, setSections] = useState<SectionDef[]>(
    DEFAULT_SECTIONS.map(s => ({ ...s, generating: false }))
  );
  const [tone, setTone] = useState<Tone>("analytical");
  const [length, setLength] = useState<Length>("standard");
  const [theses, setTheses] = useState<ThesisOption[]>([]);
  const [selectedThesis, setSelectedThesis] = useState("");
  const [selectedCharts, setSelectedCharts] = useState<string[]>(["revenue_fcf", "eps", "margins", "positioning", "price_range", "cap_alloc", "balance_sheet", "fcf_quality", "buyback_sbc", "capex_trend", "op_leverage", "net_debt_trend", "fcf_per_share", "quality_trend", "revenue_composition"]);
  const [chartVariants, setChartVariants] = useState<Record<string, number>>({});
  const [editTargetId, setEditTargetId] = useState<string | undefined>(undefined);

  function restart() {
    setSections(DEFAULT_SECTIONS.map(s => ({ ...s, generating: false })));
    setTone("analytical");
    setLength("standard");
    setTheses([]);
    setSelectedThesis("");
    setSelectedCharts(["revenue_fcf", "eps", "margins", "positioning", "price_range", "cap_alloc", "balance_sheet", "fcf_quality", "buyback_sbc", "capex_trend", "op_leverage", "net_debt_trend", "fcf_per_share", "quality_trend", "revenue_composition"]);
    setChartVariants({});
    setStage("configure");
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <a href="/10k" style={{ fontSize: 10, color: MUTED, textDecoration: "none" }}>← Dashboard</a>
        <span style={{ color: BORDER }}>|</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{ticker} Primer Builder</span>
        <span style={{ fontSize: 10, color: MUTED }}>{companyName}</span>
      </div>

      {/* Stage nav */}
      <StageIndicator stage={stage} setStage={setStage} sections={sections} />

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: Stage content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {stage === "configure" && (
            <ConfigureStage
              sections={sections} setSections={setSections}
              tone={tone} setTone={setTone}
              length={length} setLength={setLength}
              onNext={() => setStage("thesis")}
              ticker={ticker} companyName={companyName} facts={facts}
            />
          )}
          {stage === "thesis" && (
            <ThesisStage
              ticker={ticker} companyName={companyName} sector={sector} facts={facts} tone={tone} fmpExtended={fmpExtended}
              theses={theses} setTheses={setTheses}
              selectedThesis={selectedThesis} setSelectedThesis={setSelectedThesis}
              onNext={() => setStage("charts")} onBack={() => setStage("configure")}
            />
          )}
          {stage === "charts" && (
            <ChartsStage
              history={history} facts={facts}
              selectedCharts={selectedCharts} setSelectedCharts={setSelectedCharts}
              chartVariants={chartVariants} setChartVariants={setChartVariants}
              onNext={() => setStage("build")} onBack={() => setStage("thesis")}
            />
          )}
          {stage === "build" && (
            <BuildStage
              ticker={ticker} companyName={companyName}
              sections={sections} setSections={setSections}
              thesis={selectedThesis} tone={tone} length={length}
              facts={facts} history={history} fmpExtended={fmpExtended}
              onNext={() => { setEditTargetId(undefined); setStage("review"); }}
              onBack={() => { setEditTargetId(undefined); setStage("charts"); }}
              initialExpandedId={editTargetId}
            />
          )}
          {stage === "review" && (
            <ReviewStage
              ticker={ticker} companyName={companyName} industry={industry}
              sections={sections} selectedThesis={selectedThesis} facts={facts} history={history} sector={sector}
              selectedCharts={selectedCharts} chartVariants={chartVariants}
              fmpExtended={fmpExtended as Record<string, unknown>}
              onBack={() => setStage("build")}
              onEditSection={(sectionId) => { setEditTargetId(sectionId); setStage("build"); }}
              onRestart={restart}
            />
          )}
        </div>

        {/* Right: Chat panel */}
        <div style={{ width: 300, flexShrink: 0, height: "calc(100vh - 96px)" }}>
          <ChatPanel
            ticker={ticker} companyName={companyName}
            stage={stage} sections={sections} setSections={setSections}
            selectedThesis={selectedThesis} tone={tone} length={length}
          />
        </div>
      </div>
    </div>
  );
}
