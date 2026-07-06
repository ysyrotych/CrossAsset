"use client";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  CheckCircle2, ChevronUp, ChevronDown, Lock, Unlock,
  Pencil, RefreshCw, Sparkles, Send, Copy, FileDown,
  Plus, Trash2, X, ArrowRight, Wand2, MessageSquare,
  LayoutList, Lightbulb, Hammer, Eye, Check,
} from "lucide-react";

const PrimerDownloadButton = dynamic(
  () => import("@/components/PrimerDownloadButton").then(m => m.PrimerDownloadButton),
  { ssr: false }
);

// ── Types ─────────────────────────────────────────────────────────────────────

type BuildStage = "configure" | "thesis" | "build" | "review";
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
}: {
  sections: SectionDef[];
  setSections: React.Dispatch<React.SetStateAction<SectionDef[]>>;
  tone: Tone; setTone: (t: Tone) => void;
  length: Length; setLength: (l: Length) => void;
  onNext: () => void;
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

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
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
  ticker, companyName, sector, facts, tone,
  theses, setTheses, selectedThesis, setSelectedThesis, onNext, onBack,
}: {
  ticker: string; companyName: string; sector: string;
  facts: Record<string, number | null>;
  tone: Tone;
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
        body: JSON.stringify({ ticker, companyName, sector, facts, tone }),
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
                  <p style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.6, margin: 0 }}>{t.core_argument}</p>
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
          Next: Build Sections <ArrowRight size={14} />
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Stage 3: Build ─────────────────────────────────────────────────────────────

function BuildStage({
  ticker, companyName, sections, setSections,
  thesis, tone, length, facts, history, fmpExtended,
  onNext, onBack,
}: {
  ticker: string; companyName: string;
  sections: SectionDef[]; setSections: React.Dispatch<React.SetStateAction<SectionDef[]>>;
  thesis: string; tone: Tone; length: Length;
  facts: Record<string, number | null>;
  history: Record<string, Record<string, number>>;
  fmpExtended: Record<string, unknown>;
  onNext: () => void; onBack: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [generatingAll, setGeneratingAll] = useState(false);

  const included = sections.filter(s => s.included);
  const generated = included.filter(s => s.generated).length;

  function buildDocumentContext(upToId: string): string {
    const relevant = sections.filter(s => s.included && s.generated && s.content && s.id !== upToId);
    if (relevant.length === 0) return "";
    return relevant.map(s => `## ${s.title}\n${s.content.slice(0, 400)}...`).join("\n\n");
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
    for (const sec of included.filter(s => !s.generated && !s.userEdited)) {
      await generateSection(sec.id);
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
          style={{ display: "flex", alignItems: "center", gap: 6, background: ACCENT, border: `1px solid ${BLUE}60`, borderRadius: 8, padding: "8px 14px", cursor: generatingAll ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: TEXT }}>
          <Sparkles size={12} style={{ animation: generatingAll ? "spin 1s linear infinite" : "none" }} />
          {generatingAll ? "Generating…" : "Generate All"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {included.map(sec => {
          const isExpanded = expandedId === sec.id;
          const isEditing = editingId === sec.id;
          const statusColor = sec.userEdited ? AMBER : sec.generated ? GREEN : MUTED;
          const statusLabel = sec.userEdited ? "Edited" : sec.generated ? "Generated" : sec.generating ? "Generating…" : "Not generated";

          return (
            <div key={sec.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" }}
                onClick={() => setExpandedId(isExpanded ? null : sec.id)}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: statusColor, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT, flex: 1 }}>{sec.title}</span>
                <span style={{ fontSize: 9, color: statusColor, fontWeight: 700, letterSpacing: "0.06em" }}>{statusLabel}</span>
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

function ReviewStage({
  ticker, companyName, industry, sections, facts, history, sector,
  onBack, onRestart,
}: {
  ticker: string; companyName: string; industry: string;
  sections: SectionDef[];
  facts: Record<string, number | null>;
  history: Record<string, Record<string, number>>;
  sector: string;
  onBack: () => void; onRestart: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const assembled = sections
    .filter(s => s.included && s.content)
    .map(s => `## ${s.title.toUpperCase()}\n\n${s.content}`)
    .join("\n\n---\n\n");

  function copyMarkdown() {
    navigator.clipboard.writeText(assembled).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const wordCount = assembled.split(/\s+/).filter(Boolean).length;
  const readMin = Math.ceil(wordCount / 250);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: TEXT, margin: 0, flex: 1 }}>Review & Export</h2>
        <span style={{ fontSize: 10, color: MUTED }}>{wordCount} words · {readMin} min read</span>
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
          {sections.filter(s => s.included && s.content).map((sec, i) => (
            <div key={i} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: BLUE, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 6 }}>
                {sec.title}
                {sec.userEdited && <span style={{ fontSize: 8, color: AMBER, fontWeight: 600 }}>• edited</span>}
              </div>
              <div style={{ fontSize: 11, color: SUBTLE, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                {sec.content}
              </div>
            </div>
          ))}
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

  const quickActions = [
    "Improve the Executive Summary",
    "Add a risk I might be missing",
    "Make the thesis more bearish",
    "What's the key number to watch?",
  ];

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
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
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

  function restart() {
    setSections(DEFAULT_SECTIONS.map(s => ({ ...s, generating: false })));
    setTone("analytical");
    setLength("standard");
    setTheses([]);
    setSelectedThesis("");
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
            />
          )}
          {stage === "thesis" && (
            <ThesisStage
              ticker={ticker} companyName={companyName} sector={sector} facts={facts} tone={tone}
              theses={theses} setTheses={setTheses}
              selectedThesis={selectedThesis} setSelectedThesis={setSelectedThesis}
              onNext={() => setStage("build")} onBack={() => setStage("configure")}
            />
          )}
          {stage === "build" && (
            <BuildStage
              ticker={ticker} companyName={companyName}
              sections={sections} setSections={setSections}
              thesis={selectedThesis} tone={tone} length={length}
              facts={facts} history={history} fmpExtended={fmpExtended}
              onNext={() => setStage("review")} onBack={() => setStage("thesis")}
            />
          )}
          {stage === "review" && (
            <ReviewStage
              ticker={ticker} companyName={companyName} industry={industry}
              sections={sections} facts={facts} history={history} sector={sector}
              onBack={() => setStage("build")} onRestart={restart}
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
