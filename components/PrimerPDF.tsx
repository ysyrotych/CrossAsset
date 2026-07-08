"use client";
import React from "react";
import {
  Document, Page, Text, View, StyleSheet,
  Svg, Rect, G, Line, Polyline, Polygon,
} from "@react-pdf/renderer";

// ── Colours ───────────────────────────────────────────────────────────────────

const NAVY  = "#0c1b38";
const NAVY2 = "#152a55";
const GREEN = "#0d6b45";
const RED   = "#b42318";
const GRAY  = "#666666";
const LGRAY = "#f5f6f8";
const DGRAY = "#333333";
const BORDER= "#dde1e8";
const BLUE  = "#2563eb";
const AMBER = "#b45309";

function getSectorAccent(sector?: string): { primary: string; light: string; muted: string } {
  const s = (sector ?? "").toLowerCase();
  if (s.includes("tech") || s.includes("software") || s.includes("semi") || s.includes("internet"))
    return { primary: "#1a56db", light: "#e8f0fe", muted: "#93c5fd" };
  if (s.includes("health") || s.includes("pharma") || s.includes("bio") || s.includes("medic"))
    return { primary: "#0d6b45", light: "#d1fae5", muted: "#6ee7b7" };
  if (s.includes("consumer") || s.includes("retail") || s.includes("food") || s.includes("beverage"))
    return { primary: "#b45309", light: "#fef3c7", muted: "#fcd34d" };
  if (s.includes("financ") || s.includes("bank") || s.includes("insur") || s.includes("invest"))
    return { primary: "#1e40af", light: "#dbeafe", muted: "#93c5fd" };
  if (s.includes("energy") || s.includes("oil") || s.includes("gas") || s.includes("util"))
    return { primary: "#92400e", light: "#fef3c7", muted: "#fcd34d" };
  if (s.includes("communic") || s.includes("media") || s.includes("entertain") || s.includes("telecom"))
    return { primary: "#6d28d9", light: "#ede9fe", muted: "#c4b5fd" };
  if (s.includes("industr") || s.includes("manufactur") || s.includes("aerospace"))
    return { primary: "#374151", light: "#f3f4f6", muted: "#9ca3af" };
  return { primary: "#1e3a5f", light: "#e8f0f8", muted: "#93b4cc" };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: DGRAY,
    paddingTop: 0,
    paddingBottom: 36,
    paddingHorizontal: 0,
  },
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 36,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft:  { color: "white", fontSize: 7.5, letterSpacing: 0.8, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  headerRight: { color: "rgba(255,255,255,0.5)", fontSize: 6.5, letterSpacing: 0.5 },

  coverBlock: { backgroundColor: NAVY, paddingHorizontal: 36, paddingVertical: 28 },
  coverName:  { color: "white", fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  coverSub:   { color: "rgba(255,255,255,0.6)", fontSize: 9, letterSpacing: 0.4 },

  body: { paddingHorizontal: 36, paddingTop: 20 },

  // Snapshot table
  snapshotGrid:  { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  snapshotCell:  { width: "50%", flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 4 },
  snapshotLabel: { width: "55%", fontSize: 8, color: GRAY, fontFamily: "Helvetica" },
  snapshotValue: { width: "45%", fontSize: 8, color: NAVY, fontFamily: "Helvetica-Bold", textAlign: "right" },

  // Sections
  sectionHeader: {
    backgroundColor: NAVY, color: "white", fontSize: 7, fontFamily: "Helvetica-Bold",
    letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 12, paddingVertical: 6,
    marginBottom: 12, marginTop: 0,
  },
  sectionHeaderWrap: {
    flexDirection: "row", marginTop: 24, marginBottom: 0,
  },
  sectionHeaderAccent: {
    width: 4, marginBottom: 0,
  },
  subsectionHeader: {
    fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY2, marginBottom: 6, marginTop: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 3,
  },

  para:       { fontSize: 8.5, lineHeight: 1.65, color: DGRAY, marginBottom: 8 },
  bullet:     { flexDirection: "row", marginBottom: 6 },
  bulletDot:  { width: 12, fontSize: 8.5, color: NAVY, fontFamily: "Helvetica-Bold" },
  bulletText: { flex: 1, fontSize: 8.5, lineHeight: 1.65, color: DGRAY },

  // Table
  table:          { marginVertical: 10 },
  tableHeader:    { flexDirection: "row", backgroundColor: NAVY, paddingVertical: 5, paddingHorizontal: 8 },
  tableHeaderCell:{ color: "white", fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  tableRow:       { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 4, paddingHorizontal: 8 },
  tableRowAlt:    { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: LGRAY },
  tableCell:      { fontSize: 8, color: DGRAY },
  tableCellBold:  { fontSize: 8, color: NAVY, fontFamily: "Helvetica-Bold" },
  tableCellNum:   { fontSize: 8, color: DGRAY, textAlign: "right" },

  // Two-column bull/bear
  twoCols:       { flexDirection: "row", gap: 12, marginTop: 8 },
  col:           { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 10 },
  colHeaderBull: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: GREEN, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6, borderBottomWidth: 1, borderBottomColor: "#b7e4c7", paddingBottom: 3 },
  colHeaderBear: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: RED, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6, borderBottomWidth: 1, borderBottomColor: "#fca5a5", paddingBottom: 3 },

  // Footer
  footer:     { position: "absolute", bottom: 14, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 5 },
  footerText: { fontSize: 7, color: GRAY },

  // Analyst note box
  noteBox:   { borderLeftWidth: 3, borderLeftColor: NAVY, backgroundColor: LGRAY, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10 },
  noteLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 },
  noteText:  { fontSize: 8.5, lineHeight: 1.6, color: DGRAY },

  // Chart containers
  chartLabel: { fontSize: 6.5, color: GRAY, marginBottom: 3 },
  chartLegend:{ flexDirection: "row", gap: 12, marginTop: 3, marginBottom: 8 },
  legendDot:  { width: 7, height: 7, borderRadius: 3.5, marginRight: 3 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendText: { fontSize: 6.5, color: GRAY },

  // Positioning card (4-box row)
  positioningRow:  { flexDirection: "row", gap: 6, marginBottom: 14 },
  posCard:         { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 7, backgroundColor: LGRAY },
  posCardLabel:    { fontSize: 6, color: GRAY, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  posCardValue:    { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 1 },
  posCardSub:      { fontSize: 6.5, color: GRAY, lineHeight: 1.4 },

  // Cover stat chips
  coverChips:      { flexDirection: "row", gap: 8, marginTop: 10 },
  coverChip:       { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 3, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.2)" },
  coverChipLabel:  { fontSize: 6.5, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 3 },
  coverChipValue:  { fontSize: 13, fontFamily: "Helvetica-Bold" },

  // Scenario range
  scenarioRow:     { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  scenarioDot:     { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  scenarioLabel:   { fontSize: 7, color: DGRAY, flex: 1 },

  // Capital alloc bar
  capAllocRow:     { marginVertical: 8 },
  capAllocBar:     { flexDirection: "row", height: 14, borderRadius: 2, overflow: "hidden", marginBottom: 3 },
  capAllocLeg:     { flexDirection: "row", gap: 10 },
  capAllocLegItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  capAllocLegDot:  { width: 8, height: 8, borderRadius: 2 },
  capAllocLegText: { fontSize: 6.5, color: GRAY },
});

// ── Parse helpers ─────────────────────────────────────────────────────────────

function parsePrimerSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const h2Accum: Record<string, string[]> = {};
  const lines = markdown.split("\n");
  let h2Key = "";
  let currentKey = "";
  let buf: string[] = [];
  const toKey = (raw: string) => raw.trim().toUpperCase().replace(/\s+/g, "_");

  const flush = () => {
    if (!currentKey) return;
    const content = buf.join("\n").trim();
    sections[currentKey] = content;
    // Accumulate subsection content into parent h2 bucket so fallback rendering always works,
    // even when Claude uses non-standard ### header names that don't match canonical keys.
    if (h2Key && currentKey !== h2Key && content) {
      (h2Accum[h2Key] ??= []).push(content);
    }
  };

  for (const line of lines) {
    const h3 = line.match(/^###\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    if (h3) { flush(); currentKey = toKey(h3[1]); buf = []; }
    else if (h2) { flush(); h2Key = toKey(h2[1]); currentKey = h2Key; buf = []; }
    else { buf.push(line); }
  }
  flush();

  // Fill empty h2 parent keys with accumulated subsection content.
  // This ensures Business Overview/Industry Analysis/Financial Analysis always have
  // renderable content even when Claude's ### headers don't exactly match canonical keys.
  for (const [key, parts] of Object.entries(h2Accum)) {
    if (!(sections[key] ?? "").trim()) {
      sections[key] = parts.join("\n\n");
    }
  }

  // Add stripped versions of keys with roman-numeral prefixes (e.g. "III._BUSINESS_OVERVIEW" → "BUSINESS_OVERVIEW")
  const romanPrefix = /^[IVXLCDM]+\._/;
  for (const [key, val] of Object.entries(sections)) {
    if (romanPrefix.test(key)) {
      const stripped = key.replace(romanPrefix, "");
      if (!sections[stripped]) sections[stripped] = val;
    }
  }
  return sections;
}

function parseSnapshotTable(text: string): { label: string; value: string }[] {
  return text.split("\n")
    .filter(l => l.includes("|"))
    .map(l => {
      const parts = l.split("|").map(p => p.trim()).filter(Boolean);
      return parts.length >= 2 ? { label: parts[0], value: parts[1] } : null;
    })
    .filter((x): x is { label: string; value: string } => x !== null)
    .filter(r =>
      !r.label.match(/^[-=\s]+$/) &&
      !r.value.match(/^[-=\s]+$/) &&
      r.label.toLowerCase() !== "field" &&
      r.label.toLowerCase() !== "metric"
    );
}

function parseBullets(text: string): string[] {
  return text.split("\n")
    .filter(l => l.trim().startsWith("•") || l.trim().startsWith("-") || /^\d+[\.\)]\s/.test(l.trim()))
    .map(l => l.replace(/^[•\-]\s*/, "").replace(/^\d+[\.\)]\s+/, "").trim())
    .filter(b => b.length > 8 && b !== "--" && b !== "-" && !b.match(/^[-=]{3,}/));
}

function stripMd(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/\s*--\s*$/, "").trim();
}

// Renders **bold** and *italic* as actual styled text inline (react-pdf supports nested Text)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RichText({ text, style }: { text: string; style?: any }) {
  const parts = text.replace(/\s*--\s*$/, "").split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        const m = part.match(/^\*\*([^*]+)\*\*$/);
        if (m) return <Text key={i} style={{ fontFamily: "Helvetica-Bold" }}>{m[1]}</Text>;
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

function sectionFallback(
  secs: Record<string, string>,
  mainKey: string,
  subKeys: string[]
): string {
  if (subKeys.some(k => (secs[k] ?? "").trim().length > 0)) return "";
  return secs[mainKey] ?? "";
}

function parseParas(text: string): string[] {
  return text.split("\n\n")
    .map(p => p.replace(/^[•\-]\s*/, "").trim())
    .filter(p => p.length > 30 && !p.startsWith("#") && !p.startsWith("|"));
}

function parseRisks(text: string): { title: string; body: string }[] {
  if (!text) return [];
  // Handle both formats:
  // 1. **RISK TITLE**\nbody text
  // 2. • **RISK TITLE:** body text  (single-line bullet with bold title)
  const risks: { title: string; body: string }[] = [];
  const lines = text.split("\n");
  let curTitle = "";
  let bodyLines: string[] = [];
  const flush = () => {
    if (curTitle) {
      risks.push({ title: curTitle, body: bodyLines.join(" ").trim() });
      curTitle = ""; bodyLines = [];
    }
  };
  for (const line of lines) {
    const t = line.trim().replace(/\s*--\s*$/, "");
    if (!t) continue;
    // Bold standalone title: **TITLE** (possibly after a bullet marker)
    const titleMatch = t.match(/^[•\-]?\s*\*\*([^*]+)\*\*\s*$/) ?? t.match(/^[•\-]?\s*\*\*([^*]+)\*\*:?\s*$/);
    if (titleMatch) { flush(); curTitle = titleMatch[1].trim(); continue; }
    // Bullet with bold-prefixed title: • **TITLE:** body...
    const inlineMatch = t.match(/^[•\-]\s*\*\*([^*]+)\*\*[:\s]+(.+)$/);
    if (inlineMatch) { flush(); risks.push({ title: inlineMatch[1].trim(), body: inlineMatch[2].trim().replace(/\s*--\s*$/, "") }); continue; }
    // Regular line → body content
    if (curTitle) bodyLines.push(t.replace(/^[•\-]\s*/, ""));
  }
  flush();
  // Fallback: if no structure found, treat each paragraph as a risk item
  if (risks.length === 0) {
    return parseParas(text).slice(0, 8).map(p => {
      const m = p.match(/^\*\*([^*]+)\*\*[:\s]*([\s\S]*)/);
      return m ? { title: m[1].trim(), body: m[2].trim() } : { title: "", body: p };
    });
  }
  return risks;
}

function parseNewsAnalysis(text: string): { label: string; icon: string; body: string }[] {
  if (!text) return [];
  const SECTIONS = [
    { key: "EVENTS SCORECARD",      label: "Events Scorecard",       icon: "1" },
    { key: "SENTIMENT TRAJECTORY",  label: "Sentiment Trajectory",   icon: "2" },
    { key: "ANALYST POSITIONING",   label: "Analyst Positioning",    icon: "3" },
    { key: "WHAT'S PRICED IN",      label: "What's Priced In vs Not",icon: "4" },
    { key: "NEAR-TERM CATALYSTS",   label: "Near-Term Catalysts",    icon: "5" },
  ];
  const results: { label: string; icon: string; body: string }[] = [];
  for (let i = 0; i < SECTIONS.length; i++) {
    const sec = SECTIONS[i];
    const nextKey = SECTIONS[i + 1]?.key;
    // Match "1. EVENTS SCORECARD" or "1. **EVENTS SCORECARD**" etc.
    const startRe = new RegExp(`(^|\\n)${i + 1}\\.\\s+\\*?\\*?${sec.key}`, "i");
    const startM = text.match(startRe);
    if (!startM) continue;
    const startIdx = (startM.index ?? 0) + startM[0].length;
    let endIdx = text.length;
    if (nextKey) {
      const endRe = new RegExp(`(^|\\n)${i + 2}\\.\\s+\\*?\\*?${nextKey}`, "i");
      const endM = text.slice(startIdx).match(endRe);
      if (endM) endIdx = startIdx + (endM.index ?? 0);
    }
    const body = text.slice(startIdx, endIdx).replace(/^[\s\n—:]+/, "").trim();
    if (body.length > 5) results.push({ label: sec.label, icon: sec.icon, body });
  }
  return results;
}

// ── SVG Chart Components ──────────────────────────────────────────────────────

const CHART_W  = 460;
const CHART_H  = 72;

function RevenueBarChart({ history }: { history: Record<string, Record<string, number>> }) {
  const revData = history.revenue ?? {};
  const fcfData = history.free_cash_flow ?? {};
  const years   = Object.keys(revData).sort().slice(-5);
  if (years.length < 2) return null;

  const allVals = [
    ...years.map(y => revData[y] ?? 0),
    ...years.map(y => Math.abs(fcfData[y] ?? 0)),
  ].filter(v => v > 0);
  const maxV = allVals.length ? Math.max(...allVals) : 1;

  const BAR_W = 30;
  const PAIR_W = BAR_W * 2 + 4;
  const GAP    = (CHART_W - years.length * PAIR_W) / (years.length + 1);
  const LABEL_H = 14;
  const PLOT_H  = CHART_H - LABEL_H;

  const fmtShort = (v: number) =>
    Math.abs(v) >= 1e12 ? `$${(v/1e12).toFixed(1)}T`
    : Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B`
    : `$${(v/1e6).toFixed(0)}M`;

  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>Revenue vs Free Cash Flow — 5-Year</Text>
      <Svg width={CHART_W} height={CHART_H + LABEL_H + 2}>
        <Line x1={0} y1={PLOT_H} x2={CHART_W} y2={PLOT_H} stroke={BORDER} strokeWidth={0.5} />
        {years.map((yr, i) => {
          const rev = revData[yr] ?? 0;
          const fcf = fcfData[yr] ?? 0;
          const x0 = GAP + i * (PAIR_W + GAP);
          const revH = Math.max(2, (rev / maxV) * PLOT_H);
          const fcfH = Math.max(2, (Math.abs(fcf) / maxV) * PLOT_H);
          const revLabel = fmtShort(rev);
          const fcfLabel = fmtShort(fcf);
          const revLabelInside = revH >= 14;
          const fcfLabelInside = fcfH >= 14;
          return (
            <G key={yr}>
              {/* Revenue bar */}
              <Rect x={x0} y={PLOT_H - revH} width={BAR_W} height={revH} fill={NAVY} rx={1} />
              {/* Revenue label */}
              {revLabelInside
                ? <Text x={x0 + BAR_W/2} y={PLOT_H - revH/2 + 2} style={{ fontSize: 4.5, fill: "white", fontFamily: "Helvetica", textAnchor: "middle" }}>{revLabel}</Text>
                : <Text x={x0 + BAR_W/2} y={PLOT_H - revH - 2} style={{ fontSize: 4.5, fill: NAVY, fontFamily: "Helvetica", textAnchor: "middle" }}>{revLabel}</Text>}
              {/* FCF bar */}
              <Rect x={x0 + BAR_W + 4} y={PLOT_H - fcfH} width={BAR_W} height={fcfH} fill={fcf >= 0 ? GREEN : RED} rx={1} />
              {/* FCF label */}
              {fcfLabelInside
                ? <Text x={x0 + BAR_W + 4 + BAR_W/2} y={PLOT_H - fcfH/2 + 2} style={{ fontSize: 4.5, fill: "white", fontFamily: "Helvetica", textAnchor: "middle" }}>{fcfLabel}</Text>
                : <Text x={x0 + BAR_W + 4 + BAR_W/2} y={PLOT_H - fcfH - 2} style={{ fontSize: 4.5, fill: fcf >= 0 ? GREEN : RED, fontFamily: "Helvetica", textAnchor: "middle" }}>{fcfLabel}</Text>}
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 1 }}>
        {years.map(yr => {
          const rev = revData[yr] ?? 0;
          const fcf = fcfData[yr] ?? 0;
          return (
            <View key={yr} style={{ width: PAIR_W + GAP, alignItems: "center" }}>
              <Text style={{ fontSize: 6, color: GRAY, textAlign: "center" }}>FY{yr.slice(0,4)}</Text>
              <Text style={{ fontSize: 5.5, color: NAVY, textAlign: "center" }}>{fmtShort(rev)}</Text>
              <Text style={{ fontSize: 5.5, color: fcf >= 0 ? GREEN : RED, textAlign: "center" }}>{fmtShort(fcf)}</Text>
            </View>
          );
        })}
      </View>
      <View style={S.chartLegend}>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: NAVY }]} /><Text style={S.legendText}>Revenue</Text></View>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: GREEN }]} /><Text style={S.legendText}>FCF</Text></View>
      </View>
    </View>
  );
}

function MarginLineChart({ history }: { history: Record<string, Record<string, number>> }) {
  const YAXIS_W = 32;
  const PLOT_W  = CHART_W - YAXIS_W;
  const revData = history.revenue ?? {};
  const gpData  = history.gross_profit ?? {};
  const oiData  = history.operating_income ?? {};
  const niData  = history.net_income ?? {};
  const years   = Object.keys(revData).sort().slice(-5);
  if (years.length < 2) return null;

  const margins = (numerData: Record<string, number>) =>
    years.map(y => {
      const rev = revData[y];
      const num = numerData[y];
      return rev && num ? (num / rev) * 100 : null;
    });

  const grossM = margins(gpData);
  const opM    = margins(oiData);
  const netM   = margins(niData);

  const allVals = [...grossM, ...opM, ...netM].filter((v): v is number => v != null);
  const rawMin = Math.min(...allVals, 0);
  const rawMax = Math.max(...allVals, 1);
  // Round to nice 10% increments
  const minV = Math.floor(rawMin / 10) * 10;
  const maxV = Math.ceil(rawMax / 10) * 10;
  const range = maxV - minV || 1;

  const toY = (v: number | null) => v == null ? null : CHART_H - ((v - minV) / range) * CHART_H;
  const toX = (i: number) => YAXIS_W + (i / (years.length - 1)) * PLOT_W;

  const toPoints = (vals: (number | null)[]) =>
    vals.map((v, i) => v == null ? null : `${toX(i)},${toY(v)!}`)
        .filter((p): p is string => p !== null)
        .join(" ");

  const grossPts = toPoints(grossM);
  const opPts    = toPoints(opM);
  const netPts   = toPoints(netM);
  const zeroY    = toY(0);

  // Gridlines at every 10% between minV and maxV
  const gridLines: number[] = [];
  for (let v = minV; v <= maxV; v += 10) gridLines.push(v);

  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>Margin Trends — Gross / Operating / Net (%)</Text>
      <Svg width={CHART_W} height={CHART_H + 2}>
        {/* Y-axis gridlines and labels */}
        {gridLines.map(v => {
          const y = toY(v);
          if (y == null) return null;
          const isZero = v === 0;
          return (
            <G key={v}>
              <Line x1={YAXIS_W} y1={y} x2={CHART_W} y2={y} stroke={isZero ? DGRAY : BORDER}
                strokeWidth={isZero ? 0.8 : 0.4} strokeDasharray={isZero ? "none" : "2,2"} />
              <Text x={YAXIS_W - 2} y={y + 2}
                style={{ fontSize: 5, fill: GRAY, fontFamily: "Helvetica", textAnchor: "end" }}>
                {`${v}%`}
              </Text>
            </G>
          );
        })}
        {/* Baseline */}
        <Line x1={YAXIS_W} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={BORDER} strokeWidth={0.5} />
        {/* Left axis line */}
        <Line x1={YAXIS_W} y1={0} x2={YAXIS_W} y2={CHART_H} stroke={BORDER} strokeWidth={0.5} />
        {/* Series polylines */}
        {grossPts && <Polyline points={grossPts} fill="none" stroke={BLUE} strokeWidth={1.5} strokeLinejoin="round" />}
        {opPts    && <Polyline points={opPts}    fill="none" stroke={NAVY} strokeWidth={1.5} strokeLinejoin="round" />}
        {netPts   && <Polyline points={netPts}   fill="none" stroke={GREEN} strokeWidth={1.5} strokeLinejoin="round" />}
        {/* Dot markers at each year for the last value */}
        {years.map((yr, i) => {
          const gv = grossM[i]; const ov = opM[i]; const nv = netM[i];
          const x = toX(i);
          return (
            <G key={yr}>
              {gv != null && <Rect x={x-2} y={(toY(gv) ?? 0)-2} width={4} height={4} fill={BLUE} rx={2} />}
              {ov != null && <Rect x={x-2} y={(toY(ov) ?? 0)-2} width={4} height={4} fill={NAVY} rx={2} />}
              {nv != null && <Rect x={x-2} y={(toY(nv) ?? 0)-2} width={4} height={4} fill={GREEN} rx={2} />}
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 2, paddingLeft: YAXIS_W }}>
        {years.map(yr => (
          <Text key={yr} style={{ fontSize: 6, color: GRAY, textAlign: "center" }}>FY{yr.slice(0,4)}</Text>
        ))}
      </View>
      <View style={S.chartLegend}>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: BLUE }]} /><Text style={S.legendText}>Gross</Text></View>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: NAVY }]} /><Text style={S.legendText}>Operating</Text></View>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: GREEN }]} /><Text style={S.legendText}>Net</Text></View>
      </View>
    </View>
  );
}

function EpsBarChart({ history }: { history: Record<string, Record<string, number>> }) {
  const epsData = history.eps_diluted ?? {};
  const years   = Object.keys(epsData).sort().slice(-5);
  if (years.length < 2) return null;
  const vals = years.map(y => epsData[y] ?? 0);
  const maxAbs = Math.max(...vals.map(Math.abs), 0.01);
  const BAR_W  = 44;
  const GAP    = (CHART_W - years.length * BAR_W) / (years.length + 1);
  const MID_Y  = CHART_H / 2;
  const fmtEps = (v: number) => `$${v.toFixed(2)}`;
  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>EPS Diluted — 5-Year ($)</Text>
      <Svg width={CHART_W} height={CHART_H + 14}>
        <Line x1={0} y1={MID_Y} x2={CHART_W} y2={MID_Y} stroke={BORDER} strokeWidth={0.5} strokeDasharray="3,2" />
        {years.map((yr, i) => {
          const v    = epsData[yr] ?? 0;
          const barH = Math.max(2, (Math.abs(v) / maxAbs) * MID_Y);
          const x0   = GAP + i * (BAR_W + GAP);
          const y0   = v >= 0 ? MID_Y - barH : MID_Y;
          // Clamp label inside SVG: for tall positive bars, show inside the bar
          const labelAbove = y0 - 8;
          const labelY = labelAbove < 4 ? y0 + barH / 2 + 2 : labelAbove;
          const labelFill = labelAbove < 4 ? "white" : (v >= 0 ? AMBER : RED);
          return (
            <G key={yr}>
              <Rect x={x0} y={y0} width={BAR_W} height={barH} fill={v >= 0 ? AMBER : RED} rx={1} />
              <Text x={x0 + BAR_W/2} y={labelY}
                style={{ fontSize: 5, fill: labelFill, fontFamily: "Helvetica-Bold", textAnchor: "middle" }}>
                {fmtEps(v)}
              </Text>
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 2 }}>
        {years.map(yr => (
          <Text key={yr} style={{ fontSize: 6, color: GRAY, textAlign: "center", width: BAR_W + GAP }}>
            FY{yr.slice(0,4)}{"\n"}{fmtEps(epsData[yr] ?? 0)}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ── Revenue FCF: line overlay variant (variant 1) ──────────────────────────────
function RevenueLineOverlayChart({ history }: { history: Record<string, Record<string, number>> }) {
  const revData = history.revenue ?? {}, fcfData = history.free_cash_flow ?? {};
  const years = Object.keys(revData).sort().slice(-5);
  if (years.length < 2) return null;
  const revVals = years.map(y => revData[y] ?? 0);
  const fcfVals = years.map(y => fcfData[y] ?? 0);
  const maxV = Math.max(...revVals, ...fcfVals.map(Math.abs), 1);
  const fmtS = (v: number) => Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`;
  const BAR_W = 36; const GAP = (CHART_W - years.length * BAR_W) / (years.length + 1);
  const xOf = (i: number) => GAP + i * (BAR_W + GAP) + BAR_W / 2;
  const yOf = (v: number) => CHART_H - (Math.abs(v) / maxV) * CHART_H;
  const pts = years.map((_, i) => `${xOf(i)},${yOf(fcfVals[i])}`).join(" ");
  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>Revenue vs Free Cash Flow — 5-Year</Text>
      <Svg width={CHART_W} height={CHART_H + 14}>
        <Line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={BORDER} strokeWidth={0.5} />
        {years.map((yr, i) => {
          const rev = revData[yr] ?? 0;
          const rH = Math.max(2, (rev / maxV) * CHART_H);
          const x0 = GAP + i * (BAR_W + GAP);
          return <G key={yr}><Rect x={x0} y={CHART_H - rH} width={BAR_W} height={rH} fill={NAVY} rx={1} opacity={0.85} /></G>;
        })}
        <Polyline points={pts} fill="none" stroke={GREEN} strokeWidth={2} />
        {years.map((_, i) => <Rect key={i} x={xOf(i)-3} y={yOf(fcfVals[i])-3} width={6} height={6} fill={GREEN} rx={3} />)}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 1 }}>
        {years.map(yr => <View key={yr} style={{ alignItems: "center" }}><Text style={{ fontSize: 6, color: GRAY }}>{`FY${yr.slice(0,4)}`}</Text><Text style={{ fontSize: 5, color: NAVY }}>{fmtS(revData[yr] ?? 0)}</Text><Text style={{ fontSize: 5, color: GREEN }}>{fmtS(fcfData[yr] ?? 0)}</Text></View>)}
      </View>
      <View style={S.chartLegend}>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: NAVY }]} /><Text style={S.legendText}>Revenue (bars)</Text></View>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: GREEN }]} /><Text style={S.legendText}>FCF (line)</Text></View>
      </View>
    </View>
  );
}

// ── Revenue FCF: area variant (variant 2+) ─────────────────────────────────────
function RevenueAreaChart({ history }: { history: Record<string, Record<string, number>> }) {
  const revData = history.revenue ?? {}, fcfData = history.free_cash_flow ?? {};
  const years = Object.keys(revData).sort().slice(-5);
  if (years.length < 2) return null;
  const revVals = years.map(y => revData[y] ?? 0);
  const fcfVals = years.map(y => fcfData[y] ?? 0);
  const maxV = Math.max(...revVals, ...fcfVals.map(Math.abs), 1);
  const fmtS = (v: number) => Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`;
  const n = years.length;
  const xOf = (i: number) => (i / (n - 1)) * CHART_W;
  const yOf = (v: number) => CHART_H - (v / maxV) * CHART_H;
  const revPts = years.map((_, i) => `${xOf(i)},${yOf(revVals[i])}`).join(" ");
  const fcfPts = years.map((_, i) => `${xOf(i)},${yOf(Math.abs(fcfVals[i]))}`).join(" ");
  const revArea = revPts + ` ${xOf(n-1)},${CHART_H} 0,${CHART_H}`;
  const fcfArea = fcfPts + ` ${xOf(n-1)},${CHART_H} 0,${CHART_H}`;
  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>Revenue vs Free Cash Flow — 5-Year</Text>
      <Svg width={CHART_W} height={CHART_H + 14}>
        <Line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={BORDER} strokeWidth={0.5} />
        <Polygon points={revArea} fill={NAVY} opacity={0.2} stroke="none" />
        <Polygon points={fcfArea} fill={GREEN} opacity={0.3} stroke="none" />
        <Polyline points={revPts} fill="none" stroke={NAVY} strokeWidth={1.5} />
        <Polyline points={fcfPts} fill="none" stroke={GREEN} strokeWidth={1.5} />
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 1 }}>
        {years.map(yr => <View key={yr} style={{ alignItems: "center" }}><Text style={{ fontSize: 6, color: GRAY }}>{`FY${yr.slice(0,4)}`}</Text><Text style={{ fontSize: 5, color: NAVY }}>{fmtS(revData[yr] ?? 0)}</Text></View>)}
      </View>
      <View style={S.chartLegend}>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: NAVY }]} /><Text style={S.legendText}>Revenue</Text></View>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: GREEN }]} /><Text style={S.legendText}>FCF</Text></View>
      </View>
    </View>
  );
}

// ── Margins: filled area variant (variant 1+) ──────────────────────────────────
function MarginAreaChart({ history }: { history: Record<string, Record<string, number>> }) {
  const revData = history.revenue ?? {}, gpData = history.gross_profit ?? {}, oiData = history.operating_income ?? {}, niData = history.net_income ?? {};
  const years = Object.keys(revData).sort().slice(-5);
  if (years.length < 2) return null;
  const toM = (num: Record<string, number>, y: string) => revData[y] ? (num[y] ?? 0) / revData[y] * 100 : null;
  const gm = years.map(y => toM(gpData, y)), om = years.map(y => toM(oiData, y)), nm = years.map(y => toM(niData, y));
  const allV = [...gm, ...om, ...nm].filter((v): v is number => v != null);
  const minV = Math.floor(Math.min(...allV, 0) / 10) * 10;
  const maxV = Math.ceil(Math.max(...allV, 1) / 10) * 10;
  const range = maxV - minV || 1;
  const YAXIS_W = 32; const PLOT_W = CHART_W - YAXIS_W;
  const toX = (i: number) => YAXIS_W + (i / (years.length - 1)) * PLOT_W;
  const toY = (v: number | null) => v == null ? null : CHART_H - ((v - minV) / range) * CHART_H;
  const ptsStr = (ms: (number|null)[]) => ms.map((v,i) => v==null?null:`${toX(i)},${toY(v)}`).filter(Boolean).join(" ");
  const areaStr = (ms: (number|null)[]) => ptsStr(ms) + ` ${toX(years.length-1)},${CHART_H} ${YAXIS_W},${CHART_H}`;
  const gridVals: number[] = []; for (let v = minV; v <= maxV; v += 10) gridVals.push(v);
  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>Margin Trends — Gross / Operating / Net (%)</Text>
      <Svg width={CHART_W} height={CHART_H + 2}>
        {gridVals.map(v => { const y = toY(v); if (y==null) return null; return <G key={v}><Line x1={YAXIS_W} y1={y} x2={CHART_W} y2={y} stroke={BORDER} strokeWidth={0.4} strokeDasharray="2,2"/><Text x={YAXIS_W-2} y={y+2} style={{ fontSize: 5, fill: GRAY, fontFamily: "Helvetica", textAnchor: "end" }}>{`${v}%`}</Text></G>; })}
        <Line x1={YAXIS_W} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={BORDER} strokeWidth={0.5}/>
        <Polygon points={areaStr(gm)} fill={BLUE} opacity={0.1} stroke="none"/>
        <Polygon points={areaStr(om)} fill={NAVY} opacity={0.15} stroke="none"/>
        <Polygon points={areaStr(nm)} fill={GREEN} opacity={0.2} stroke="none"/>
        <Polyline points={ptsStr(gm)} fill="none" stroke={BLUE} strokeWidth={1.5}/>
        <Polyline points={ptsStr(om)} fill="none" stroke={NAVY} strokeWidth={1.5}/>
        <Polyline points={ptsStr(nm)} fill="none" stroke={GREEN} strokeWidth={1.5}/>
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 2, paddingLeft: YAXIS_W }}>
        {years.map(yr => <Text key={yr} style={{ fontSize: 6, color: GRAY, textAlign: "center" }}>{`FY${yr.slice(0,4)}`}</Text>)}
      </View>
      <View style={S.chartLegend}>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: BLUE }]} /><Text style={S.legendText}>Gross</Text></View>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: NAVY }]} /><Text style={S.legendText}>Operating</Text></View>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: GREEN }]} /><Text style={S.legendText}>Net</Text></View>
      </View>
    </View>
  );
}

// ── Margins: bar groups variant (variant 2+) ────────────────────────────────────
function MarginBarGroupChart({ history }: { history: Record<string, Record<string, number>> }) {
  const revData = history.revenue ?? {}, gpData = history.gross_profit ?? {}, oiData = history.operating_income ?? {}, niData = history.net_income ?? {};
  const years = Object.keys(revData).sort().slice(-5);
  if (years.length < 2) return null;
  const toM = (num: Record<string, number>, y: string) => revData[y] ? Math.max(0, (num[y] ?? 0) / revData[y] * 100) : 0;
  const gm = years.map(y => toM(gpData, y)), om = years.map(y => toM(oiData, y)), nm = years.map(y => toM(niData, y));
  const maxV = Math.max(...gm, ...om, ...nm, 1);
  const n = years.length; const BGRP = (CHART_W - 20) / n; const BW = (BGRP - 8) / 3;
  const x0 = (i: number, b: number) => 10 + i * BGRP + b * (BW + 2);
  const bh = (v: number) => Math.max(1, (v / maxV) * CHART_H);
  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>Margin Trends — Gross / Operating / Net (%)</Text>
      <Svg width={CHART_W} height={CHART_H + 14}>
        <Line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={BORDER} strokeWidth={0.5}/>
        {years.map((yr, i) => (
          <G key={yr}>
            <Rect x={x0(i,0)} y={CHART_H-bh(gm[i])} width={BW} height={bh(gm[i])} fill={BLUE} rx={1}/>
            <Rect x={x0(i,1)} y={CHART_H-bh(om[i])} width={BW} height={bh(om[i])} fill={NAVY} rx={1}/>
            <Rect x={x0(i,2)} y={CHART_H-bh(nm[i])} width={BW} height={bh(nm[i])} fill={GREEN} rx={1}/>
            <Text x={10+i*BGRP+BGRP/2} y={CHART_H+10} style={{ fontSize: 5.5, fill: GRAY, fontFamily: "Helvetica", textAnchor: "middle" }}>{`FY${yr.slice(0,4)}`}</Text>
          </G>
        ))}
      </Svg>
      <View style={S.chartLegend}>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: BLUE }]} /><Text style={S.legendText}>Gross</Text></View>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: NAVY }]} /><Text style={S.legendText}>Operating</Text></View>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: GREEN }]} /><Text style={S.legendText}>Net</Text></View>
      </View>
    </View>
  );
}

// ── EPS: lollipop variant (variant 1) ──────────────────────────────────────────
function EpsLollipopChart({ history }: { history: Record<string, Record<string, number>> }) {
  const epsData = history.eps_diluted ?? {};
  const years = Object.keys(epsData).sort().slice(-5);
  if (years.length < 2) return null;
  const vals = years.map(y => epsData[y] ?? 0);
  const maxA = Math.max(...vals.map(Math.abs), 0.01);
  const BAR_W = 44; const GAP = (CHART_W - years.length * BAR_W) / (years.length + 1);
  const MID_Y = CHART_H / 2;
  const xOf = (i: number) => GAP + i * (BAR_W + GAP) + BAR_W / 2;
  const yOf = (v: number) => MID_Y - (v / maxA) * MID_Y;
  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>EPS Diluted — 5-Year ($)</Text>
      <Svg width={CHART_W} height={CHART_H + 14}>
        <Line x1={0} y1={MID_Y} x2={CHART_W} y2={MID_Y} stroke={BORDER} strokeWidth={0.5} strokeDasharray="3,2"/>
        {years.map((yr, i) => {
          const v = epsData[yr] ?? 0; const y = yOf(v); const x = xOf(i);
          return (
            <G key={yr}>
              <Line x1={x} y1={MID_Y} x2={x} y2={y} stroke={v >= 0 ? AMBER : RED} strokeWidth={2}/>
              <Rect x={x-4} y={y-4} width={8} height={8} fill={v >= 0 ? AMBER : RED} rx={4}/>
              <Text x={x} y={Math.max(8, y > MID_Y ? y + 10 : y - 6)} style={{ fontSize: 5, fill: v >= 0 ? AMBER : RED, fontFamily: "Helvetica-Bold", textAnchor: "middle" }}>${v.toFixed(2)}</Text>
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 2 }}>
        {years.map(yr => <Text key={yr} style={{ fontSize: 6, color: GRAY, textAlign: "center", width: BAR_W + GAP }}>{`FY${yr.slice(0,4)}`}</Text>)}
      </View>
    </View>
  );
}

// ── EPS: dual-tone variant (variant 2+) ────────────────────────────────────────
function EpsDualToneChart({ history }: { history: Record<string, Record<string, number>> }) {
  const epsData = history.eps_diluted ?? {};
  const years = Object.keys(epsData).sort().slice(-5);
  if (years.length < 2) return null;
  const vals = years.map(y => epsData[y] ?? 0);
  const maxA = Math.max(...vals.map(Math.abs), 0.01);
  const BAR_W = 44; const GAP = (CHART_W - years.length * BAR_W) / (years.length + 1);
  const MID_Y = CHART_H / 2;
  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>EPS Diluted — 5-Year ($)</Text>
      <Svg width={CHART_W} height={CHART_H + 14}>
        <Line x1={0} y1={MID_Y} x2={CHART_W} y2={MID_Y} stroke={BORDER} strokeWidth={0.5} strokeDasharray="3,2"/>
        {years.map((yr, i) => {
          const v = vals[i]; const barH = Math.max(2, (Math.abs(v)/maxA)*MID_Y);
          const x0 = GAP + i * (BAR_W + GAP); const y0 = v >= 0 ? MID_Y - barH : MID_Y;
          const labelY = y0 > 8 ? y0 - 4 : y0 + barH/2 + 2;
          return (
            <G key={yr}>
              <Rect x={x0} y={y0} width={BAR_W} height={barH} fill={v >= 0 ? GREEN : RED} rx={1}/>
              <Text x={x0 + BAR_W/2} y={labelY} style={{ fontSize: 5, fill: y0 > 8 ? (v >= 0 ? GREEN : RED) : "white", fontFamily: "Helvetica-Bold", textAnchor: "middle" }}>${v.toFixed(2)}</Text>
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 2 }}>
        {years.map(yr => <Text key={yr} style={{ fontSize: 6, color: GRAY, textAlign: "center", width: BAR_W + GAP }}>{`FY${yr.slice(0,4)}`}</Text>)}
      </View>
      <View style={S.chartLegend}>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: GREEN }]} /><Text style={S.legendText}>Positive EPS</Text></View>
        <View style={S.legendItem}><View style={[S.legendDot, { backgroundColor: RED }]} /><Text style={S.legendText}>Negative EPS</Text></View>
      </View>
    </View>
  );
}

// ── Variant selector wrappers ──────────────────────────────────────────────────
function RevenueFCFChart({ history, variant }: { history: Record<string, Record<string, number>>; variant: number }) {
  if (variant === 1) return <RevenueLineOverlayChart history={history} />;
  if (variant === 2 || variant === 3) return <RevenueAreaChart history={history} />;
  return <RevenueBarChart history={history} />;
}
function MarginChart({ history, variant }: { history: Record<string, Record<string, number>>; variant: number }) {
  if (variant === 1 || variant === 3) return <MarginAreaChart history={history} />;
  if (variant === 2 || variant === 4) return <MarginBarGroupChart history={history} />;
  return <MarginLineChart history={history} />;
}
function EpsChart({ history, variant }: { history: Record<string, Record<string, number>>; variant: number }) {
  if (variant === 1 || variant === 3) return <EpsLollipopChart history={history} />;
  if (variant === 2 || variant === 4) return <EpsDualToneChart history={history} />;
  return <EpsBarChart history={history} />;
}

// ── Balance Sheet: Cash vs Long-Term Debt ─────────────────────────────────────
function BalanceSheetChart({ history }: { history: Record<string, Record<string, number>> }) {
  const cashData = history.cash ?? {};
  const debtData = history.long_term_debt ?? {};
  const yrs = [...new Set([...Object.keys(cashData), ...Object.keys(debtData)])].sort().slice(-5);
  if (yrs.length < 2) return null;
  const cash = yrs.map(y => cashData[y] ?? 0);
  const debt = yrs.map(y => debtData[y] ?? 0);
  const mx = Math.max(...cash, ...debt, 1);
  const BW = Math.max(18, (CHART_W - 40) / yrs.length / 2 - 4);
  const GAP = 4;
  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>Cash vs Long-Term Debt — Balance Sheet Trend</Text>
      <Svg width={CHART_W} height={CHART_H + 18}>
        <Line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={BORDER} strokeWidth={0.5} />
        {yrs.map((yr, i) => {
          const totalW = yrs.length * (BW * 2 + GAP) + (yrs.length - 1) * 8;
          const x = (CHART_W - totalW) / 2 + i * (BW * 2 + GAP + 8);
          const ch = (cash[i] / mx) * (CHART_H - 8);
          const dh = (debt[i] / mx) * (CHART_H - 8);
          return (
            <G key={yr}>
              <Rect x={x} y={CHART_H - ch} width={BW} height={Math.max(ch, 1)} fill={GREEN} rx={1} />
              <Rect x={x + BW + GAP} y={CHART_H - dh} width={BW} height={Math.max(dh, 1)} fill={RED} rx={1} opacity={0.8} />
              <Text x={x + BW} y={CHART_H + 9} style={{ fontSize: 5, fill: GRAY, fontFamily: "Helvetica", textAnchor: "middle" }}>{yr.slice(0, 4)}</Text>
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", gap: 14, marginTop: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><View style={{ width: 8, height: 4, backgroundColor: GREEN }} /><Text style={{ fontSize: 5.5, color: GRAY }}>Cash & Equivalents</Text></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><View style={{ width: 8, height: 4, backgroundColor: RED }} /><Text style={{ fontSize: 5.5, color: GRAY }}>Long-Term Debt</Text></View>
      </View>
    </View>
  );
}

// ── FCF Quality: OCF vs FCF ────────────────────────────────────────────────────
function FcfQualityChart({ history }: { history: Record<string, Record<string, number>> }) {
  const ocfData = history.operating_cf ?? {};
  const fcfData = history.free_cash_flow ?? {};
  const yrs = [...new Set([...Object.keys(ocfData), ...Object.keys(fcfData)])].sort().slice(-5);
  if (yrs.length < 2) return null;
  const ocf = yrs.map(y => ocfData[y] ?? 0);
  const fcf = yrs.map(y => fcfData[y] ?? 0);
  const mx = Math.max(...ocf.map(Math.abs), ...fcf.map(Math.abs), 1);
  const BW = Math.max(18, (CHART_W - 40) / yrs.length / 2 - 4);
  const GAP = 3;
  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>Operating CF vs Free Cash Flow — Quality Signal</Text>
      <Svg width={CHART_W} height={CHART_H + 18}>
        <Line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={BORDER} strokeWidth={0.5} />
        {yrs.map((yr, i) => {
          const totalW = yrs.length * (BW * 2 + GAP) + (yrs.length - 1) * 8;
          const x = (CHART_W - totalW) / 2 + i * (BW * 2 + GAP + 8);
          const oh = (Math.max(0, ocf[i]) / mx) * (CHART_H - 8);
          const fh = (Math.max(0, fcf[i]) / mx) * (CHART_H - 8);
          return (
            <G key={yr}>
              <Rect x={x} y={CHART_H - oh} width={BW} height={Math.max(oh, 1)} fill={BLUE} rx={1} opacity={0.85} />
              <Rect x={x + BW + GAP} y={CHART_H - fh} width={BW} height={Math.max(fh, 1)} fill={GREEN} rx={1} />
              <Text x={x + BW} y={CHART_H + 9} style={{ fontSize: 5, fill: GRAY, fontFamily: "Helvetica", textAnchor: "middle" }}>{yr.slice(0, 4)}</Text>
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", gap: 14, marginTop: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><View style={{ width: 8, height: 4, backgroundColor: BLUE }} /><Text style={{ fontSize: 5.5, color: GRAY }}>Operating Cash Flow</Text></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><View style={{ width: 8, height: 4, backgroundColor: GREEN }} /><Text style={{ fontSize: 5.5, color: GRAY }}>Free Cash Flow</Text></View>
      </View>
    </View>
  );
}

// ── Buyback & Dividends vs SBC Dilution ───────────────────────────────────────
function BuybackSbcChart({ history }: { history: Record<string, Record<string, number>> }) {
  const bbData  = history.buybacks ?? {};
  const sbcData = history.sbc_expense ?? {};
  const divData = history.dividends_paid ?? {};
  const yrs = [...new Set([...Object.keys(bbData), ...Object.keys(sbcData), ...Object.keys(divData)])].sort().slice(-5);
  if (yrs.length < 2) return null;
  const bb  = yrs.map(y => Math.abs(bbData[y] ?? 0));
  const sbc = yrs.map(y => Math.abs(sbcData[y] ?? 0));
  const div = yrs.map(y => Math.abs(divData[y] ?? 0));
  const maxReturn = Math.max(...bb.map((b, i) => b + div[i]), 1);
  const mx = Math.max(maxReturn, ...sbc, 1);
  const BW = Math.max(20, (CHART_W - 40) / yrs.length - 10);
  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>Shareholder Returns vs SBC Dilution — Annual</Text>
      <Svg width={CHART_W} height={CHART_H + 18}>
        <Line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={BORDER} strokeWidth={0.5} />
        {yrs.map((yr, i) => {
          const x = 10 + i * (BW + 12);
          const bbH = (bb[i] / mx) * (CHART_H - 8);
          const divH = (div[i] / mx) * (CHART_H - 8);
          const sbcH = (sbc[i] / mx) * (CHART_H - 8);
          const sbcW = Math.max(6, BW * 0.4);
          return (
            <G key={yr}>
              <Rect x={x} y={CHART_H - bbH - divH} width={BW} height={Math.max(divH, 1)} fill={GREEN} rx={0} />
              <Rect x={x} y={CHART_H - bbH} width={BW} height={Math.max(bbH, 1)} fill={BLUE} rx={1} />
              <Rect x={x + BW + 2} y={CHART_H - sbcH} width={sbcW} height={Math.max(sbcH, 1)} fill={RED} rx={1} opacity={0.75} />
              <Text x={x + BW * 0.5} y={CHART_H + 9} style={{ fontSize: 5, fill: GRAY, fontFamily: "Helvetica", textAnchor: "middle" }}>{yr.slice(0, 4)}</Text>
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><View style={{ width: 8, height: 4, backgroundColor: BLUE }} /><Text style={{ fontSize: 5.5, color: GRAY }}>Buybacks</Text></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><View style={{ width: 8, height: 4, backgroundColor: GREEN }} /><Text style={{ fontSize: 5.5, color: GRAY }}>Dividends</Text></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><View style={{ width: 8, height: 4, backgroundColor: RED }} /><Text style={{ fontSize: 5.5, color: GRAY }}>SBC Dilution</Text></View>
      </View>
    </View>
  );
}

// ── CapEx Intensity (% of Revenue) ────────────────────────────────────────────
function CapexTrendChart({ history }: { history: Record<string, Record<string, number>> }) {
  const revData   = history.revenue ?? {};
  const capexData = history.capex ?? {};
  const yrs = [...new Set([...Object.keys(revData), ...Object.keys(capexData)])].sort().slice(-5);
  if (yrs.length < 2) return null;
  const pcts = yrs.map(y => {
    const r = revData[y]; const c = capexData[y];
    return (r && r !== 0 && c != null) ? (Math.abs(c) / r) * 100 : null;
  });
  const valid = pcts.filter(p => p != null) as number[];
  if (valid.length < 2) return null;
  const mx = Math.max(...valid, 1);
  const BW = Math.max(24, (CHART_W - 30) / yrs.length - 8);
  return (
    <View wrap={false} style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>CapEx Intensity — % of Revenue (Reinvestment Rate)</Text>
      <Svg width={CHART_W} height={CHART_H + 18}>
        <Line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={BORDER} strokeWidth={0.5} />
        {yrs.map((yr, i) => {
          const pct = pcts[i];
          const x = 10 + i * (BW + 8);
          if (pct == null) return <Text key={yr} x={x + BW / 2} y={CHART_H + 9} style={{ fontSize: 5, fill: GRAY, fontFamily: "Helvetica", textAnchor: "middle" }}>{yr.slice(0, 4)}</Text>;
          const h = (pct / mx) * (CHART_H - 8);
          return (
            <G key={yr}>
              <Rect x={x} y={CHART_H - h} width={BW} height={Math.max(h, 1)} fill={AMBER} rx={1} />
              <Text x={x + BW / 2} y={Math.max(8, CHART_H - h - 3)} style={{ fontSize: 4.5, fill: NAVY, fontFamily: "Helvetica-Bold", textAnchor: "middle" }}>{pct.toFixed(1)}%</Text>
              <Text x={x + BW / 2} y={CHART_H + 9} style={{ fontSize: 5, fill: GRAY, fontFamily: "Helvetica", textAnchor: "middle" }}>{yr.slice(0, 4)}</Text>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function StockRangeBar({ facts }: { facts: Record<string, number> }) {
  const lo = facts.week52_low, hi = facts.week52_high, cur = facts.stock_price;
  if (!lo || !hi || !cur || hi <= lo) return null;
  const pct52 = Math.round(((cur - lo) / (hi - lo)) * 100);
  const dotX  = ((cur - lo) / (hi - lo)) * 220;
  return (
    <View wrap={false} style={{ marginTop: 8, marginBottom: 4 }}>
      <Svg width={260} height={18}>
        <Rect x={0} y={6} width={220} height={6} fill={BORDER} rx={3} />
        <Rect x={0} y={6} width={dotX} height={6} fill={NAVY2} rx={3} />
        <Rect x={dotX - 3} y={3} width={6} height={12} fill={NAVY} rx={3} />
        <Text x={0}   y={18} style={{ fontSize: 6, fill: GRAY, fontFamily: "Helvetica" }}>${lo.toFixed(0)}</Text>
        <Text x={200} y={18} style={{ fontSize: 6, fill: GRAY, fontFamily: "Helvetica" }}>${hi.toFixed(0)}</Text>
        <Text x={dotX - 10} y={2} style={{ fontSize: 6, fill: NAVY, fontFamily: "Helvetica-Bold" }}>${cur.toFixed(0)}</Text>
      </Svg>
      <Text style={{ fontSize: 6.5, color: GRAY, marginTop: 1 }}>52W Range: ${lo.toFixed(2)} – ${hi.toFixed(2)} | Current ${pct52}th percentile</Text>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHdr({ title, accentColor, pageBreak }: { title: string; accentColor?: string; pageBreak?: boolean }) {
  return (
    <View style={[S.sectionHeaderWrap, pageBreak ? { break: "before" } as any : {}]} minPresenceAhead={60}>
      <View style={[S.sectionHeaderAccent, { backgroundColor: accentColor ?? NAVY }]} />
      <Text style={[S.sectionHeader, { flex: 1 }]}>{title}</Text>
    </View>
  );
}

function SubSectionHdr({ title }: { title: string }) {
  return <Text style={S.subsectionHeader} minPresenceAhead={40}>{title}</Text>;
}
function Para({ text }: { text: string }) {
  return <RichText text={text} style={S.para} />;
}
function CalloutBox({ label, value, context, color }: { label: string; value: string; context: string; color: string }) {
  return (
    <View wrap={false} style={{ borderLeftWidth: 3, borderLeftColor: color, backgroundColor: LGRAY, paddingHorizontal: 10, paddingVertical: 7, marginVertical: 6, borderRadius: 2 }}>
      <Text style={{ fontSize: 6.5, color, fontFamily: "Helvetica-Bold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 12, color: NAVY, fontFamily: "Helvetica-Bold", marginBottom: 2 }}>{value}</Text>
      <Text style={{ fontSize: 7.5, color: GRAY, lineHeight: 1.4 }}>{context}</Text>
    </View>
  );
}
function Bullets({ items, color }: { items: string[]; color?: string }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} style={S.bullet}>
          <Text style={[S.bulletDot, color ? { color } : {}]}>•</Text>
          <RichText text={item} style={S.bulletText} />
        </View>
      ))}
    </>
  );
}
function SnapshotTable({ rows }: { rows: { label: string; value: string }[] }) {
  const pairs: { label: string; value: string }[][] = [];
  for (let i = 0; i < rows.length; i += 2) {
    pairs.push(rows[i + 1] ? [rows[i], rows[i + 1]] : [rows[i]]);
  }
  return (
    <View wrap={false} style={{ marginBottom: 16 }}>
      {pairs.map((pair, pi) => (
        <View key={pi} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, minHeight: 22 }}>
          {pair.map((r, ri) => (
            <View key={ri} style={{ flex: 1, flexDirection: "row", paddingVertical: 5, paddingRight: ri === 0 && pair.length > 1 ? 10 : 0, paddingLeft: ri === 1 ? 10 : 0, borderLeftWidth: ri === 1 ? 1 : 0, borderLeftColor: BORDER }}>
              <Text style={{ width: "48%", fontSize: 7.5, color: GRAY, lineHeight: 1.4 }}>{r.label}</Text>
              <Text style={{ flex: 1, fontSize: 7.5, color: NAVY, fontFamily: "Helvetica-Bold", textAlign: "right", lineHeight: 1.4 }}>{r.value}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
function PageFooter({ ticker, company, date }: { ticker: string; company: string; date: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>{company} ({ticker}) — Equity Research Primer</Text>
      <Text style={S.footerText} render={({ pageNumber, totalPages }) =>
        `Edgewood Management | ${date} | Page ${pageNumber} of ${totalPages} | Institutional Use Only`
      } />
    </View>
  );
}

// ── Main Document ─────────────────────────────────────────────────────────────

interface PeerRow {
  symbol?: string; name?: string; market_cap?: number;
  pe?: number; ev_ebitda?: number; p_fcf?: number; ev_revenue?: number;
  gross_margin?: number; roic?: number; revenue_growth?: number; revenue?: number;
}

interface PrimerPDFProps {
  ticker: string;
  companyName: string;
  industry: string;
  content: string;
  generatedDate: string;
  history: Record<string, Record<string, number>>;
  facts: Record<string, number>;
  sector?: string;
  selectedCharts?: string[];
  chartVariants?: Record<string, number>;
  fmpExtended?: Record<string, unknown>;
}

const ALL_CHARTS = ["revenue_fcf", "eps", "margins", "positioning", "price_range", "cap_alloc", "balance_sheet", "fcf_quality", "buyback_sbc", "capex_trend"];

export function PrimerDocument({ ticker, companyName, industry, content, generatedDate, history, facts, sector, selectedCharts, chartVariants, fmpExtended }: PrimerPDFProps) {
  const showChart = (id: string) => !selectedCharts || selectedCharts.length === 0 || selectedCharts.includes(id);
  const chartVariant = (id: string) => chartVariants?.[id] ?? 0;
  const secs = parsePrimerSections(content);

  const execBullets  = parseBullets(secs["EXECUTIVE_SUMMARY"] ?? "");
  const snapshotRows = parseSnapshotTable(secs["COMPANY_SNAPSHOT"] ?? "");

  const execBulletsText = execBullets.join(" ");
  const ratingMatch = execBulletsText.match(/\b(STRONG BUY|STRONG SELL|OUTPERFORM|UNDERPERFORM|BUY|SELL|HOLD|NEUTRAL)\b/i);
  const ratingText  = ratingMatch ? ratingMatch[1].toUpperCase() : null;
  const ratingColor = ratingText
    ? (["STRONG BUY","BUY","OUTPERFORM"].includes(ratingText) ? GREEN
      : ["STRONG SELL","SELL","UNDERPERFORM"].includes(ratingText) ? RED : AMBER)
    : null;
  const ptMatch = execBulletsText.match(/(?:(?:12[- ]?month|one[- ]?year|1[- ]?yr?)[- ]?(?:price )?target|price target|target price)[^\$]{0,20}\$\s*(\d+(?:\.\d{1,2})?)/i)
    ?? execBulletsText.match(/(?:target)[^\$]{0,10}\$\s*(\d+(?:\.\d{1,2})?)/i);
  const priceTarget = ptMatch ? `$${Math.round(parseFloat(ptMatch[1]))}` : null;

  const bg   = parseParas(secs["COMPANY_BACKGROUND"] ?? "");
  const pp   = parseParas(secs["PRODUCT_PORTFOLIO_&_REVENUE_MIX"] ?? "");
  const cust = parseParas(secs["CUSTOMERS,_END_MARKETS_&_GEOGRAPHIC_EXPOSURE"] ?? "");
  const mkt  = parseParas(secs["MARKET_STRUCTURE_&_COMPETITIVE_DYNAMICS"] ?? "");
  const drv  = parseParas(secs["KEY_INDUSTRY_DRIVERS_&_CYCLE"] ?? "");
  const comp = parseParas(secs["COMPETITIVE_POSITION"] ?? "");
  const rev  = parseParas(secs["REVENUE_&_PROFITABILITY_TRENDS"] ?? "");
  const bal  = parseParas(secs["BALANCE_SHEET_&_CAPITAL_ALLOCATION"] ?? "");
  const fcf  = parseParas(secs["FREE_CASH_FLOW_&_CAPEX"] ?? "");
  const qoe  = parseParas(secs["QUALITY_OF_EARNINGS_&_CASH_CONVERSION"] ?? "");

  // Valuation Framework
  const valCurrHist = parseParas(secs["CURRENT_VALUATION_VS._HISTORICAL_RANGE"] ?? "");
  const valPeer     = parseParas(secs["PEER_VALUATION_CONTEXT"] ?? "");
  const valScen     = parseParas(secs["IMPLIED_SCENARIOS"] ?? "");

  // Management Commentary
  const callHighlights = parseParas(secs["EARNINGS_CALL_HIGHLIGHTS"] ?? "");
  const fwdGuidance    = parseParas(secs["FORWARD_GUIDANCE_&_OUTLOOK"] ?? "");

  // Management & Governance
  const leadership = parseParas(secs["LEADERSHIP_&_TRACK_RECORD"] ?? "");
  const capAlloc   = parseParas(secs["CAPITAL_ALLOCATION_DISCIPLINE"] ?? "");

  const riskItems = parseRisks(secs["KEY_RISKS"] ?? "");
  const risks = parseBullets(secs["KEY_RISKS"] ?? "");
  const itText = secs["INVESTMENT_THESIS"] ?? "";
  const bull  = parseBullets(secs["BULL_CASE"] ?? "").length > 0
    ? parseBullets(secs["BULL_CASE"] ?? "")
    : parseBullets(itText.split(/bear\s+case/i)[0] ?? "");
  const bear  = parseBullets(secs["BEAR_CASE"] ?? "").length > 0
    ? parseBullets(secs["BEAR_CASE"] ?? "")
    : parseBullets(itText.split(/bear\s+case/i)[1] ?? "");
  const note  = parseParas(secs["ANALYST_NOTE"] ?? "");

  // New sections
  const kpiRaw  = secs["KEY_METRICS_DASHBOARD"] ?? "";
  const kpiRows = kpiRaw.split("\n").filter(l => l.includes("|")).map(l => {
    const parts = l.split("|").map(p => p.trim()).filter(Boolean);
    if (parts.length >= 5) return { kpi: parts[0], current: parts[1], ntm: parts[2], threshold: parts[3], why: parts[4] };
    if (parts.length === 4) return { kpi: parts[0], current: parts[1], ntm: null, threshold: parts[2], why: parts[3] };
    return null;
  }).filter((r): r is { kpi: string; current: string; ntm: string | null; threshold: string; why: string } =>
    r !== null
    && !r.kpi.match(/^[-=:]+$/)
    && r.kpi.toLowerCase() !== "kpi"
    && r.kpi.toLowerCase() !== "metric"
    && r.kpi.toLowerCase() !== "key performance indicator"
    && r.kpi.toLowerCase() !== "ltm value"
  );

  const qaRaw  = secs["EARNINGS_CALL_QUESTIONS"] ?? "";
  const qaItems = qaRaw.split("\n")
    .filter(l => l.trim().match(/^(\*{0,2}\d+[\.\)]\s|\*\*Q|\*\*\d|Q\d)/i))
    .map(l => l
      .replace(/^\*{0,2}\d+[\.\)]\s*\*{0,2}\s*/, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*\*/g, "")
      .replace(/^Q[:\s]+/i, "")
      .trim())
    .filter(q => q.length > 15)
    .slice(0, 10);

  // 5-year summary table
  const fmtM = (v?: number) => v == null ? "—"
    : Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B`
    : `$${(v/1e6).toFixed(0)}M`;
  const fmtP = (v?: number) => v == null ? "—" : `${v.toFixed(1)}%`;
  const revYears = Object.keys(history.revenue ?? {}).sort().slice(-5);
  const niYears  = Object.keys(history.net_income ?? {}).sort().slice(-5);
  const cfYears  = Object.keys(history.operating_cf ?? {}).sort().slice(-5);
  const allFY    = Array.from(new Set([...revYears, ...niYears, ...cfYears])).sort().slice(-5);

  const headerDate = generatedDate || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const ACCENT = getSectorAccent(sector ?? industry);

  // Helper: format numbers for cover chips
  const fmtCover = (v?: number) =>
    v == null ? "N/A"
    : Math.abs(v) >= 1e12 ? `$${(v/1e12).toFixed(1)}T`
    : Math.abs(v) >= 1e9  ? `$${(v/1e9).toFixed(1)}B`
    : Math.abs(v) >= 1e6  ? `$${(v/1e6).toFixed(0)}M`
    : `$${v.toFixed(2)}`;

  // Pull first exec bullet as cover tagline (trim to ~220 chars)
  const execTagline = (() => {
    const raw = execBullets[0] ?? "";
    const clean = raw.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\s*--\s*$/, "");
    return clean.length > 240 ? clean.slice(0, 237) + "…" : clean;
  })();

  // Investment Frame from snapshot
  const investmentFrame = snapshotRows.find(r => r.label.toLowerCase().includes("investment frame"))?.value ?? "";

  const fcfMarginCover = facts.free_cash_flow && facts.revenue ? (facts.free_cash_flow / facts.revenue * 100) : null;

  return (
    <Document title={`${companyName} (${ticker}) — Equity Research Primer`} author="Edgewood Management">
      <Page size="LETTER" style={S.page}>

        {/* Header bar */}
        <View style={S.header} fixed>
          <Text style={S.headerLeft}>{companyName} | {ticker} | Equity Research Primer</Text>
          <Text style={S.headerRight}>Edgewood Management | {headerDate}</Text>
        </View>

        {/* Cover block — company-specific with accent strip */}
        <View style={{ flexDirection: "row", backgroundColor: NAVY }}>
          {/* Accent strip */}
          <View style={{ width: 5, backgroundColor: ACCENT.primary }} />
          <View style={{ flex: 1, paddingHorizontal: 31, paddingVertical: 24 }}>
            {/* Sector tag */}
            <Text style={{ color: ACCENT.muted, fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: "Helvetica-Bold", marginBottom: 6 }}>
              {sector ?? industry}
            </Text>
            {/* Company name */}
            <Text style={{ color: "white", fontSize: 26, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>{companyName}</Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, letterSpacing: 0.4, marginBottom: 10 }}>{ticker} · Equity Research Primer</Text>
            {/* Tagline from exec summary */}
            {execTagline.length > 0 && (
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 8.5, lineHeight: 1.5, borderLeftWidth: 2, borderLeftColor: ACCENT.primary, paddingLeft: 8, marginBottom: 10 }}>
                {execTagline}
              </Text>
            )}
            {/* Rating badge */}
            {(ratingText || priceTarget) && (
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                {ratingText && (
                  <View style={{ backgroundColor: ratingColor ?? AMBER, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 2 }}>
                    <Text style={{ color: "white", fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 1 }}>{ratingText}</Text>
                  </View>
                )}
                {priceTarget && (
                  <View style={{ backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
                    <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 6, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 1 }}>12M Price Target</Text>
                    <Text style={{ color: "white", fontSize: 11, fontFamily: "Helvetica-Bold" }}>{priceTarget}</Text>
                  </View>
                )}
              </View>
            )}
            {/* Key stat chips */}
            <View style={S.coverChips}>
              {[
                { label: "Market Cap", value: fmtCover(facts.market_cap) },
                { label: "Revenue (FY)", value: fmtCover(facts.revenue) },
                { label: "FCF Margin", value: fcfMarginCover != null ? `${fcfMarginCover.toFixed(1)}%` : "N/A" },
                { label: "EV/EBITDA", value: facts.ev_ebitda != null ? `${facts.ev_ebitda.toFixed(1)}x` : "N/A" },
                { label: "ROIC", value: facts.roic != null ? `${facts.roic.toFixed(1)}%` : "N/A" },
                { label: "P/E", value: facts.pe_ratio != null ? `${facts.pe_ratio.toFixed(1)}x` : "N/A" },
              ].map(chip => (
                <View key={chip.label} style={[S.coverChip, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
                  <Text style={[S.coverChipLabel, { color: "rgba(255,255,255,0.5)" }]}>{chip.label}</Text>
                  <Text style={[S.coverChipValue, { color: "white" }]}>{chip.value}</Text>
                </View>
              ))}
            </View>
            {/* 52W range bar */}
            <StockRangeBar facts={facts} />
            {/* Analyst consensus + price target range */}
            {(() => {
              const rec = fmpExtended?.analyst_rec as { strong_buy?: number; buy?: number; hold?: number; sell?: number; strong_sell?: number; total?: number } | undefined;
              const ptConsensus = facts.pt_consensus;
              const ptHigh = facts.pt_high;
              const ptLow = facts.pt_low;
              if (!rec && !ptConsensus) return null;
              const bullish = rec ? (rec.strong_buy ?? 0) + (rec.buy ?? 0) : 0;
              const hold = rec?.hold ?? 0;
              const bearish = rec ? (rec.sell ?? 0) + (rec.strong_sell ?? 0) : 0;
              const total = rec?.total ?? (bullish + hold + bearish);
              const upside = ptConsensus && facts.stock_price ? ((ptConsensus - facts.stock_price) / facts.stock_price * 100) : null;
              return (
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
                  {rec && total > 0 && (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 6, color: "rgba(255,255,255,0.45)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>Sell-Side ({total} analysts)</Text>
                      <View style={{ flexDirection: "row", height: 6, borderRadius: 2, overflow: "hidden", marginBottom: 3 }}>
                        <View style={{ flex: bullish, backgroundColor: "#22c55e" }} />
                        <View style={{ flex: hold, backgroundColor: "#f59e0b" }} />
                        <View style={{ flex: bearish, backgroundColor: "#ef4444" }} />
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Text style={{ fontSize: 5.5, color: "#22c55e" }}>▲ {bullish} Buy</Text>
                        <Text style={{ fontSize: 5.5, color: "#f59e0b" }}>■ {hold} Hold</Text>
                        <Text style={{ fontSize: 5.5, color: "#ef4444" }}>▼ {bearish} Sell</Text>
                      </View>
                    </View>
                  )}
                  {ptConsensus && (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 6, color: "rgba(255,255,255,0.45)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 }}>Consensus Price Target</Text>
                      <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: "white" }}>${Math.round(ptConsensus)}</Text>
                      {upside != null && (
                        <Text style={{ fontSize: 6, color: upside >= 0 ? "#22c55e" : "#ef4444" }}>
                          {upside >= 0 ? "+" : ""}{upside.toFixed(1)}% vs current{ptHigh && ptLow ? ` · Range $${Math.round(ptLow)}–$${Math.round(ptHigh)}` : ""}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })()}
            {/* Investment frame */}
            {investmentFrame.length > 0 && (
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)" }}>
                <Text style={{ fontSize: 6.5, color: ACCENT.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 }}>Key Question</Text>
                <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>{investmentFrame.replace(/\*\*([^*]+)\*\*/g, "$1")}</Text>
              </View>
            )}
            {/* Date */}
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 6.5, marginTop: 12, textAlign: "right" }}>{headerDate} · Edgewood Management</Text>
          </View>
        </View>

        {/* Institutional Disclaimer Bar */}
        <View style={{ backgroundColor: "#1a1a1a", paddingHorizontal: 36, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 3, height: 26, backgroundColor: "#c9a227", borderRadius: 1, flexShrink: 0 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: "#c9a227", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2 }}>
              STRICTLY CONFIDENTIAL — FOR INSTITUTIONAL USE ONLY
            </Text>
            <Text style={{ fontSize: 5.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
              {`This document is prepared by Edgewood Management and is intended solely for institutional investors. It does not constitute investment advice, a solicitation, or an offer to buy or sell any security. Past performance is not indicative of future results. All data is sourced from public filings and third-party data providers; accuracy cannot be guaranteed. Not for redistribution.`}
            </Text>
          </View>
        </View>

        <View style={S.body}>

          {/* Table of Contents */}
          <View wrap={false} style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Table of Contents</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {[
                "I. Executive Summary", "II. Company Snapshot", "III. Business Overview",
                "IV. Industry Analysis", "V. Financial Analysis", "VI. Valuation Framework",
                "VII. Management Commentary & Guidance", "VIII. Management & Governance",
                "IX. Key Risks", "X. News Analysis & Market Intelligence",
                "XI. Investment Thesis", "XII. Key Metrics Dashboard", "XIII. Earnings Call Questions",
              ].map((item, i) => (
                <View key={i} style={{ width: "50%", paddingRight: 8, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: ACCENT.primary, flexShrink: 0 }} />
                  <Text style={{ fontSize: 7.5, color: DGRAY }}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Company at a Glance — 8 key metric chips */}
          {(() => {
            const fmtC = (v?: number | null) => v == null ? "—" : Math.abs(v) >= 1e12 ? `$${(v/1e12).toFixed(1)}T` : Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`;
            const fmtP = (v?: number | null) => v == null ? "—" : `${Number(v).toFixed(1)}%`;
            const fmtX = (v?: number | null) => v == null ? "—" : `${Number(v).toFixed(1)}x`;
            const revData = history?.revenue ?? {};
            const revYrs = Object.keys(revData).sort();
            const revGrowth = revYrs.length >= 2
              ? ((revData[revYrs[revYrs.length - 1]] / revData[revYrs[revYrs.length - 2]]) - 1) * 100
              : null;
            const fcfYield2 = facts.free_cash_flow && facts.market_cap && facts.market_cap > 0
              ? (facts.free_cash_flow / facts.market_cap) * 100 : null;
            const glanceItems = [
              { label: "Market Cap",    value: fmtC(facts.market_cap),                    color: NAVY },
              { label: "EV/EBITDA",     value: fmtX(facts.ev_ebitda),                     color: NAVY },
              { label: "Rev Growth",    value: revGrowth != null ? fmtP(revGrowth) : "—", color: revGrowth != null && revGrowth >= 0 ? GREEN : RED },
              { label: "Gross Margin",  value: fmtP(facts.gross_margin),                  color: NAVY },
              { label: "FCF Yield",     value: fcfYield2 != null ? fmtP(fcfYield2) : "—", color: NAVY },
              { label: "ROIC",          value: fmtP(facts.roic),                           color: facts.roic != null && facts.roic >= 9 ? GREEN : RED },
              { label: "Net Debt/EBITDA", value: (() => { const nd = facts.net_debt, eb = facts.ebitda; return nd != null && eb && eb !== 0 ? (nd < 0 ? "Net Cash" : `${(nd/eb).toFixed(1)}x`) : "—"; })(), color: (() => { const nd = facts.net_debt, eb = facts.ebitda; if (!nd || !eb) return NAVY; return nd < 0 ? GREEN : nd / eb < 3 ? NAVY : RED; })() },
              { label: "P/E (NTM)",     value: fmtX(facts.pe_ratio),                      color: NAVY },
            ];
            return (
              <View wrap={false} style={{ flexDirection: "row", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
                {glanceItems.map(item => (
                  <View key={item.label} style={{ flex: 1, minWidth: "10%", backgroundColor: LGRAY, borderRadius: 3, paddingHorizontal: 8, paddingVertical: 6, borderLeftWidth: 2, borderLeftColor: item.color }}>
                    <Text style={{ fontSize: 6, color: GRAY, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{item.label}</Text>
                    <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: item.color }}>{item.value}</Text>
                  </View>
                ))}
              </View>
            );
          })()}

          {/* I. Executive Summary */}
          <SectionHdr title="I. Executive Summary" accentColor={ACCENT.primary} />
          {/* Conviction Badge — parse BUY/HOLD/SELL from the last exec bullet */}
          {(() => {
            const execText = (secs["EXECUTIVE_SUMMARY"] ?? "");
            const stance = execText.match(/\b(BUY|HOLD|SELL)\b/);
            const ptMatch = execText.match(/(?:price target|PT)\s*\$\s*(\d{2,5}(?:\.\d{1,2})?)/i);
            if (!stance) return null;
            const label = stance[1];
            const color = label === "BUY" ? GREEN : label === "SELL" ? RED : AMBER;
            return (
              <View wrap={false} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <View style={{ backgroundColor: color, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 3 }}>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "white", letterSpacing: 1.5 }}>{label}</Text>
                </View>
                {ptMatch && (
                  <View style={{ borderWidth: 1, borderColor: color, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 3 }}>
                    <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color }}>{`PT: $${ptMatch[1]}`}</Text>
                  </View>
                )}
                {facts.stock_price && ptMatch && (
                  <Text style={{ fontSize: 7.5, color: GRAY }}>
                    {`vs current $${facts.stock_price.toFixed(2)} (${(((parseFloat(ptMatch[1]) / facts.stock_price) - 1) * 100).toFixed(0)}% return)`}
                  </Text>
                )}
              </View>
            );
          })()}
          {execBullets.length > 0
            ? <Bullets items={execBullets} color={ACCENT.primary} />
            : parseParas(secs["EXECUTIVE_SUMMARY"] ?? "").map((p, i) => <Para key={i} text={p} />)}
          {/* Pull quote — most impactful exec bullet */}
          {execBullets.length > 0 && (
            <View wrap={false} style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER, paddingVertical: 9, marginVertical: 8 }}>
              <Text style={{ fontSize: 9.5, color: NAVY, fontFamily: "Helvetica-Bold", lineHeight: 1.65 }}>
                {`"${(execBullets[0].replace(/\*\*([^*]+)\*\*/g, "$1")).slice(0, 200)}${execBullets[0].length > 200 ? "…" : ""}"`}
              </Text>
            </View>
          )}

          {/* II. Company Snapshot */}
          <SectionHdr title="II. Company Snapshot" accentColor={ACCENT.primary} />
          {snapshotRows.length > 0 && <SnapshotTable rows={snapshotRows} />}

          {/* Quality signal row — ROIC/WACC, leverage, earnings quality (controlled by positioning chart toggle) */}
          {showChart("positioning") && (() => {
            const nd = facts.net_debt; const eb = facts.ebitda;
            const ndEb = nd != null && eb != null && eb !== 0 ? nd / eb : null;
            const roicSpread2 = facts.roic != null ? facts.roic - 9 : null;
            const fcfConv = facts.operating_cf && facts.net_income && facts.net_income !== 0
              ? facts.operating_cf / facts.net_income : null;
            const signals = [
              {
                label: "ROIC / WACC Spread",
                value: roicSpread2 != null ? `${roicSpread2 >= 0 ? "+" : ""}${roicSpread2.toFixed(1)}pp` : "—",
                badge: roicSpread2 == null ? "N/A" : roicSpread2 >= 10 ? "STRONG" : roicSpread2 >= 0 ? "POSITIVE" : "NEGATIVE",
                color: roicSpread2 == null ? GRAY : roicSpread2 >= 10 ? GREEN : roicSpread2 >= 0 ? AMBER : RED,
                desc: facts.roic != null ? `${facts.roic.toFixed(1)}% ROIC vs 9% WACC hurdle` : "Capital return vs cost",
              },
              {
                label: "Net Debt / EBITDA",
                value: ndEb != null ? (ndEb < 0 ? "Net Cash" : `${ndEb.toFixed(1)}x`) : "—",
                badge: ndEb == null ? "N/A" : ndEb < 0 ? "NET CASH" : ndEb < 1 ? "LOW" : ndEb < 3 ? "MOD" : "HIGH",
                color: ndEb == null ? GRAY : ndEb < 1 ? GREEN : ndEb < 3 ? AMBER : RED,
                desc: "Financial leverage vs operating earnings",
              },
              {
                label: "Earnings Quality",
                value: fcfConv != null ? `${fcfConv.toFixed(2)}x` : "—",
                badge: fcfConv == null ? "N/A" : fcfConv > 1.1 ? "HIGH" : fcfConv > 0.8 ? "MOD" : "LOW",
                color: fcfConv == null ? GRAY : fcfConv > 1.1 ? GREEN : fcfConv > 0.8 ? AMBER : RED,
                desc: "OCF/Net Income — cash backing reported earnings",
              },
            ];
            return (
              <View wrap={false} style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                {signals.map((sig, i) => (
                  <View key={i} style={{ flex: 1, borderWidth: 1, borderColor: BORDER, borderTopWidth: 2, borderTopColor: sig.color, borderRadius: 3, padding: 8 }}>
                    <Text style={{ fontSize: 6, color: GRAY, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 }}>{sig.label}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 }}>
                      <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: NAVY }}>{sig.value}</Text>
                      <View style={{ backgroundColor: LGRAY, borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: sig.color }}>
                        <Text style={{ fontSize: 5.5, fontFamily: "Helvetica-Bold", color: sig.color }}>{sig.badge}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 6, color: GRAY, lineHeight: 1.4 }}>{sig.desc}</Text>
                  </View>
                ))}
              </View>
            );
          })()}

          {/* Financial Trend Sparklines — compact % change indicators replacing SVG charts */}
          {allFY.length >= 3 && (() => {
            const revData = history.revenue ?? {};
            const fcfData = history.free_cash_flow ?? {};
            const gpData  = history.gross_profit ?? {};
            const oiData  = history.operating_income ?? {};
            const epsData = history.eps_diluted ?? {};
            const fmtShort = (v: number) => Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : Math.abs(v) >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v.toFixed(0)}`;
            const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
            const yoyChange = (data: Record<string, number>, yr: string, prevYr: string) => {
              const cur = data[yr]; const prev = data[prevYr];
              return cur != null && prev != null && prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null;
            };
            const sortedYrs = allFY.slice().sort();
            return (
              <View wrap={false} style={{ marginBottom: 14 }}>
                <SubSectionHdr title="Financial Trend — Year-over-Year" />
                <View wrap={false} style={S.table}>
                  <View style={[S.tableHeader, { backgroundColor: ACCENT.primary }]}>
                    <Text style={[S.tableHeaderCell, { width: "24%" }]}>Metric</Text>
                    {sortedYrs.map(y => (
                      <Text key={y} style={[S.tableHeaderCell, { flex: 1, textAlign: "right" }]}>FY{y.slice(0,4)}</Text>
                    ))}
                  </View>
                  {[
                    { label: "Revenue", data: revData, isKpi: true },
                    { label: "FCF",     data: fcfData, isKpi: true },
                    { label: "Gross %", data: Object.fromEntries(sortedYrs.map(y => [y, gpData[y] != null && revData[y] ? gpData[y]/revData[y]*100 : null]).filter(([,v]) => v != null) as [string, number][]), isKpi: false, isPct: true },
                    { label: "Op. %",   data: Object.fromEntries(sortedYrs.map(y => [y, oiData[y] != null && revData[y] ? oiData[y]/revData[y]*100 : null]).filter(([,v]) => v != null) as [string, number][]), isKpi: false, isPct: true },
                    { label: "EPS",     data: epsData, isKpi: false, isEps: true },
                  ].map((row, ri) => (
                    <View key={row.label} style={ri % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                      <Text style={[row.isKpi ? S.tableCellBold : S.tableCell, { width: "24%", color: row.isKpi ? NAVY : GRAY }]}>{row.label}</Text>
                      {sortedYrs.map((y, yi) => {
                        const v = row.data[y];
                        const prev = sortedYrs[yi - 1];
                        const chg = yi > 0 ? yoyChange(row.data, y, prev) : null;
                        const isPos = v != null && v > 0;
                        const chgColor = chg == null ? GRAY : chg > 5 ? GREEN : chg < -5 ? RED : AMBER;
                        return (
                          <View key={y} style={{ flex: 1, alignItems: "flex-end" }}>
                            <Text style={{ fontSize: 7.5, color: row.isKpi ? NAVY : DGRAY, fontFamily: row.isKpi ? "Helvetica-Bold" : "Helvetica", textAlign: "right" }}>
                              {v == null ? "—" : (row as any).isPct ? `${v.toFixed(1)}%` : (row as any).isEps ? `$${v.toFixed(2)}` : fmtShort(v)}
                            </Text>
                            {chg != null && <Text style={{ fontSize: 5.5, color: chgColor, textAlign: "right" }}>{fmtPct(chg)} YoY</Text>}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}

          {/* 5-Year Financial Summary */}
          {allFY.length > 0 && (
            <>
              <SubSectionHdr title="5-Year Financial Summary" />
              <View wrap={false} style={S.table}>
                <View style={S.tableHeader}>
                  <Text style={[S.tableHeaderCell, { width: "28%" }]}>Metric</Text>
                  {allFY.map(y => (
                    <Text key={y} style={[S.tableHeaderCell, { flex: 1, textAlign: "right" }]}>FY{y.slice(0,4)}</Text>
                  ))}
                </View>
                {[
                  { label: "Revenue",       data: history.revenue,        key: true },
                  { label: "Gross Profit",  data: history.gross_profit,   key: false },
                  { label: "Op. Income",    data: history.operating_income,key: false },
                  { label: "Net Income",    data: history.net_income,     key: true },
                  { label: "Operating CF",  data: history.operating_cf,   key: false },
                  { label: "Free Cash Flow",data: history.free_cash_flow, key: true },
                  { label: "EPS Diluted ($)",data: history.eps_diluted,   key: false, isEps: true },
                ].filter(r => r.data && Object.keys(r.data).length > 0).map((row: { label: string; data: Record<string, number> | undefined; key: boolean; isEps?: boolean }, ri) => (
                  <View key={row.label} style={[ri % 2 === 0 ? S.tableRow : S.tableRowAlt, row.key ? { borderTopWidth: 1, borderTopColor: BORDER } : {}]}>
                    <Text style={[row.key ? S.tableCellBold : S.tableCell, { width: "28%", color: row.key ? NAVY : DGRAY }]}>{row.label}</Text>
                    {allFY.map((y, yi) => {
                      const v = row.data?.[y];
                      const prev = yi > 0 ? row.data?.[allFY[yi-1]] : undefined;
                      const yoy = v != null && prev != null && prev !== 0 ? ((v - prev) / Math.abs(prev)) * 100 : null;
                      const display = row.isEps
                        ? (v != null ? `$${v.toFixed(2)}` : "—")
                        : fmtM(v);
                      return (
                        <View key={y} style={{ flex: 1, alignItems: "flex-end" }}>
                          <Text style={row.key ? { ...S.tableCellNum, fontFamily: "Helvetica-Bold", color: NAVY } : S.tableCellNum}>{display}</Text>
                          {yoy != null && <Text style={{ fontSize: 5, color: yoy >= 0 ? GREEN : RED, textAlign: "right" }}>{yoy >= 0 ? "+" : ""}{yoy.toFixed(0)}%</Text>}
                        </View>
                      );
                    })}
                  </View>
                ))}
                {/* Separator */}
                <View style={{ height: 1, backgroundColor: BORDER, marginVertical: 2 }} />
                {[
                  { label: "Gross Margin %", numKey: "gross_profit", denKey: "revenue" },
                  { label: "Op. Margin %",   numKey: "operating_income", denKey: "revenue" },
                  { label: "Net Margin %",    numKey: "net_income", denKey: "revenue" },
                  { label: "FCF Margin %",    numKey: "free_cash_flow", denKey: "revenue" },
                ].map((row, ri) => (
                  <View key={row.label} style={(ri + 6) % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                    <Text style={[S.tableCell, { width: "28%", color: GRAY }]}>{row.label}</Text>
                    {allFY.map(y => {
                      const num = history[row.numKey]?.[y];
                      const den = history[row.denKey]?.[y];
                      const v = num != null && den && den !== 0 ? (num / den * 100) : null;
                      return <Text key={y} style={[S.tableCellNum, { flex: 1, color: GRAY }]}>{fmtP(v ?? undefined)}</Text>;
                    })}
                  </View>
                ))}
              </View>
            </>
          )}

          {/* III. Business Overview */}
          <SectionHdr title="III. Business Overview" accentColor={ACCENT.primary} pageBreak />
          {bg.length > 0 && <><SubSectionHdr title="Company Background" />{bg.map((p,i) => <Para key={i} text={p} />)}</>}
          {pp.length > 0 && <><SubSectionHdr title="Product Portfolio & Revenue Mix" />{pp.map((p,i) => <Para key={i} text={p} />)}</>}
          {cust.length > 0 && <><SubSectionHdr title="Customers, End Markets & Geographic Exposure" />{cust.map((p,i) => <Para key={i} text={p} />)}</>}
          {parseParas(sectionFallback(secs, "BUSINESS_OVERVIEW", ["COMPANY_BACKGROUND","PRODUCT_PORTFOLIO_&_REVENUE_MIX","CUSTOMERS,_END_MARKETS_&_GEOGRAPHIC_EXPOSURE"])).map((p,i) => <Para key={i} text={p} />)}

          {/* IV. Industry Analysis */}
          <SectionHdr title="IV. Industry Analysis" accentColor={ACCENT.primary} pageBreak />
          {mkt.length > 0 && <><SubSectionHdr title="Market Structure & Competitive Dynamics" />{mkt.map((p,i) => <Para key={i} text={p} />)}</>}
          {drv.length > 0 && <><SubSectionHdr title="Key Industry Drivers & Cycle" />{drv.map((p,i) => <Para key={i} text={p} />)}</>}
          {comp.length > 0 && <><SubSectionHdr title="Competitive Position" />{comp.map((p,i) => <Para key={i} text={p} />)}</>}
          {parseParas(sectionFallback(secs, "INDUSTRY_ANALYSIS", ["MARKET_STRUCTURE_&_COMPETITIVE_DYNAMICS","KEY_INDUSTRY_DRIVERS_&_CYCLE","COMPETITIVE_POSITION"])).map((p,i) => <Para key={i} text={p} />)}

          {/* V. Financial Analysis */}
          <SectionHdr title="V. Financial Analysis" accentColor={ACCENT.primary} pageBreak />
          {rev.length > 0 && (
            <>
              <SubSectionHdr title="Revenue & Profitability Trends" />
              {rev.map((p,i) => <Para key={i} text={p} />)}
              {/* Revenue CAGR callout */}
              {(() => {
                const revData = history.revenue ?? {};
                const revYrs = Object.keys(revData).sort();
                if (revYrs.length >= 3) {
                  const oldest = revData[revYrs[0]];
                  const newest = revData[revYrs[revYrs.length - 1]];
                  const n = revYrs.length - 1;
                  if (oldest > 0 && newest > 0) {
                    const cagr = (Math.pow(newest / oldest, 1 / n) - 1) * 100;
                    return (
                      <CalloutBox
                        label={`Revenue CAGR (${n}Y)`}
                        value={`${cagr >= 0 ? "+" : ""}${cagr.toFixed(1)}%`}
                        context={`FY${revYrs[0].slice(0,4)} – FY${revYrs[revYrs.length-1].slice(0,4)} compound annual growth rate`}
                        color={cagr >= 15 ? GREEN : cagr >= 5 ? AMBER : RED}
                      />
                    );
                  }
                }
                return null;
              })()}
              {showChart("revenue_fcf") && <RevenueFCFChart history={history} variant={chartVariant("revenue_fcf")} />}
              {showChart("margins") && <MarginChart history={history} variant={chartVariant("margins")} />}
            </>
          )}
          {bal.length > 0 && (
            <>
              <SubSectionHdr title="Balance Sheet & Capital Allocation" />
              {bal.map((p,i) => <Para key={i} text={p} />)}
              {/* Leverage callout */}
              {(() => {
                const nd = facts.net_debt;
                const eb = facts.ebitda;
                if (nd == null || eb == null || eb === 0) return null;
                const ratio = nd / eb;
                const status = ratio < 0 ? "Net cash position — balance sheet is a strategic asset" : ratio < 1 ? "Conservative leverage — ample financial flexibility" : ratio < 3 ? "Moderate leverage — manageable with stable cash flow" : "Elevated leverage — limits strategic flexibility";
                const color = ratio < 1 ? GREEN : ratio < 3 ? AMBER : RED;
                return (
                  <CalloutBox
                    label="Leverage Ratio"
                    value={ratio < 0 ? "Net Cash" : `${ratio.toFixed(1)}x Net Debt / EBITDA`}
                    context={status}
                    color={color}
                  />
                );
              })()}
              {showChart("balance_sheet") && <BalanceSheetChart history={history} />}
            </>
          )}
          {fcf.length > 0 && (
            <>
              <SubSectionHdr title="Free Cash Flow & CapEx" />
              {fcf.map((p,i) => <Para key={i} text={p} />)}
              {showChart("eps") && <EpsChart history={history} variant={chartVariant("eps")} />}
              {showChart("fcf_quality") && <FcfQualityChart history={history} />}
              {showChart("capex_trend") && <CapexTrendChart history={history} />}
            </>
          )}
          {parseParas(sectionFallback(secs, "FINANCIAL_ANALYSIS", ["REVENUE_&_PROFITABILITY_TRENDS","BALANCE_SHEET_&_CAPITAL_ALLOCATION","FREE_CASH_FLOW_&_CAPEX","QUALITY_OF_EARNINGS_&_CASH_CONVERSION"])).map((p,i) => <Para key={i} text={p} />)}
          {qoe.length > 0 && <><SubSectionHdr title="Quality of Earnings & Cash Conversion" />{qoe.map((p,i) => <Para key={i} text={p} />)}</>}

          {/* VI. Valuation Framework */}
          {(valCurrHist.length > 0 || valPeer.length > 0 || valScen.length > 0 || (Array.isArray(fmpExtended?.peer_comparison) && (fmpExtended!.peer_comparison as PeerRow[]).length > 0)) && (
            <>
              <SectionHdr title="VI. Valuation Framework" accentColor={ACCENT.primary} pageBreak />
              {valCurrHist.length > 0 && <><SubSectionHdr title="Current Valuation vs. Historical Range" />{valCurrHist.map((p,i) => <Para key={i} text={p} />)}</>}
              {/* Peer comparison table — rendered from fmpExtended data, not from LLM text */}
              {Array.isArray(fmpExtended?.peer_comparison) && (fmpExtended!.peer_comparison as PeerRow[]).length > 0 && (() => {
                const peers = fmpExtended!.peer_comparison as PeerRow[];
                const fmtX = (v?: number | null) => v == null ? "—" : `${Number(v).toFixed(1)}x`;
                const fmtPct3 = (v?: number | null) => v == null ? "—" : `${Number(v).toFixed(1)}%`;
                const subjectPe = facts.pe_ratio; const subjectEv = facts.ev_ebitda;
                return (
                  <>
                    <SubSectionHdr title="Peer Valuation Benchmarking" />
                    <View wrap={false} style={S.table}>
                      <View style={[S.tableHeader, { backgroundColor: ACCENT.primary }]}>
                        {[["Company","20%"],["Revenue","10%"],["Mkt Cap","10%"],["P/E","8%"],["EV/EBITDA","10%"],["EV/Rev","8%"],["Gross Mgn","10%"],["ROIC","8%"],["Rev Gr","8%"]].map(([h, w]) => (
                          <Text key={h} style={[S.tableHeaderCell, { width: w, textAlign: h === "Company" ? "left" : "right" }]}>{h}</Text>
                        ))}
                      </View>
                      {/* Subject company row */}
                      {(() => {
                        const fcfYld2 = facts.free_cash_flow && facts.market_cap ? facts.market_cap / facts.free_cash_flow : null;
                        const subEvRev = facts.ev_revenue;
                        return (
                          <View style={[S.tableRow, { backgroundColor: ACCENT.light }]}>
                            <Text style={[S.tableCellBold, { width: "20%", color: ACCENT.primary }]}>{ticker} ◀</Text>
                            <Text style={[S.tableCellNum, { width: "10%", fontFamily: "Helvetica-Bold", color: NAVY }]}>
                              {facts.revenue ? (facts.revenue >= 1e9 ? `$${(facts.revenue/1e9).toFixed(1)}B` : `$${(facts.revenue/1e6).toFixed(0)}M`) : "—"}
                            </Text>
                            <Text style={[S.tableCellNum, { width: "10%", fontFamily: "Helvetica-Bold", color: NAVY }]}>
                              {facts.market_cap ? `$${(facts.market_cap/1e9).toFixed(1)}B` : "—"}
                            </Text>
                            <Text style={[S.tableCellNum, { width: "8%", fontFamily: "Helvetica-Bold" }]}>{fmtX(subjectPe)}</Text>
                            <Text style={[S.tableCellNum, { width: "10%", fontFamily: "Helvetica-Bold" }]}>{fmtX(subjectEv)}</Text>
                            <Text style={[S.tableCellNum, { width: "8%", fontFamily: "Helvetica-Bold" }]}>{fmtX(subEvRev)}</Text>
                            <Text style={[S.tableCellNum, { width: "10%", fontFamily: "Helvetica-Bold" }]}>{fmtPct3(facts.gross_margin)}</Text>
                            <Text style={[S.tableCellNum, { width: "8%", fontFamily: "Helvetica-Bold" }]}>{fmtPct3(facts.roic)}</Text>
                            <Text style={[S.tableCellNum, { width: "8%", fontFamily: "Helvetica-Bold" }]}>{fmtPct3(facts.revenue_growth)}</Text>
                          </View>
                        );
                      })()}
                      {peers.slice(0, 6).map((p, i) => (
                        <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                          <Text style={[S.tableCell, { width: "20%" }]}>{p.symbol} {p.name ? `(${p.name.slice(0,10)})` : ""}</Text>
                          <Text style={[S.tableCellNum, { width: "10%" }]}>
                            {p.revenue ? (p.revenue >= 1e9 ? `$${(p.revenue/1e9).toFixed(1)}B` : `$${(p.revenue/1e6).toFixed(0)}M`) : "—"}
                          </Text>
                          <Text style={[S.tableCellNum, { width: "10%" }]}>{p.market_cap ? `$${(p.market_cap/1e9).toFixed(1)}B` : "—"}</Text>
                          <Text style={[S.tableCellNum, { width: "8%", color: subjectPe && p.pe ? (p.pe < subjectPe ? GREEN : RED) : DGRAY }]}>{fmtX(p.pe)}</Text>
                          <Text style={[S.tableCellNum, { width: "10%", color: subjectEv && p.ev_ebitda ? (p.ev_ebitda < subjectEv ? GREEN : RED) : DGRAY }]}>{fmtX(p.ev_ebitda)}</Text>
                          <Text style={[S.tableCellNum, { width: "8%" }]}>{fmtX(p.ev_revenue)}</Text>
                          <Text style={[S.tableCellNum, { width: "10%", color: facts.gross_margin && p.gross_margin ? (p.gross_margin < facts.gross_margin ? GREEN : RED) : DGRAY }]}>{fmtPct3(p.gross_margin)}</Text>
                          <Text style={[S.tableCellNum, { width: "8%" }]}>{fmtPct3(p.roic)}</Text>
                          <Text style={[S.tableCellNum, { width: "8%" }]}>{fmtPct3(p.revenue_growth)}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={{ fontSize: 6.5, color: GRAY, marginTop: 4 }}>Green = peer trades cheaper than subject; Red = peer more expensive. Source: FMP / yfinance.</Text>
                  </>
                );
              })()}
              {/* Forward Analyst Estimates Table */}
              {Array.isArray(fmpExtended?.analyst_estimates) && (fmpExtended!.analyst_estimates as {date?: string; rev_avg?: number; eps_avg?: number; ebitda_avg?: number; num_analysts?: number}[]).length > 0 && (() => {
                const ests = (fmpExtended!.analyst_estimates as {date?: string; rev_avg?: number; eps_avg?: number; ebitda_avg?: number; num_analysts?: number}[]).slice(0, 4);
                const fmtE = (v?: number | null) => v == null ? "—" : Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v/1e6).toFixed(0)}M` : `$${v.toFixed(2)}`;
                const ntm = ests[0];
                const ntmEvEbitda = ntm?.ebitda_avg && facts.enterprise_value ? `${(facts.enterprise_value / ntm.ebitda_avg).toFixed(1)}x` : null;
                const ntmPE = ntm?.eps_avg && facts.stock_price && ntm.eps_avg > 0 ? `${(facts.stock_price / ntm.eps_avg).toFixed(1)}x` : null;
                return (
                  <>
                    <SubSectionHdr title="Sell-Side Forward Estimates (Consensus)" />
                    <View wrap={false} style={S.table}>
                      <View style={[S.tableHeader, { backgroundColor: NAVY2 }]}>
                        {["Period", "Revenue Est.", "EPS Est.", "EBITDA Est.", "# Analysts"].map((h, hi) => (
                          <Text key={h} style={[S.tableHeaderCell, { flex: hi === 0 ? 1.5 : 1, textAlign: hi === 0 ? "left" : "right" }]}>{h}</Text>
                        ))}
                      </View>
                      {ests.map((e, ei) => (
                        <View key={ei} style={[ei % 2 === 0 ? S.tableRow : S.tableRowAlt]}>
                          <Text style={[S.tableCell, { flex: 1.5 }]}>{e.date ?? "—"}</Text>
                          <Text style={[S.tableCellNum, { flex: 1 }]}>{fmtE(e.rev_avg)}</Text>
                          <Text style={[S.tableCellNum, { flex: 1 }]}>{e.eps_avg != null ? `$${e.eps_avg.toFixed(2)}` : "—"}</Text>
                          <Text style={[S.tableCellNum, { flex: 1 }]}>{fmtE(e.ebitda_avg)}</Text>
                          <Text style={[S.tableCellNum, { flex: 1 }]}>{e.num_analysts != null ? Math.round(e.num_analysts) : "—"}</Text>
                        </View>
                      ))}
                    </View>
                    {(ntmEvEbitda || ntmPE) && (
                      <Text style={{ fontSize: 6.5, color: GRAY, marginTop: 3 }}>
                        NTM implied: {ntmEvEbitda ? `EV/EBITDA ${ntmEvEbitda}` : ""}{ntmEvEbitda && ntmPE ? " · " : ""}{ntmPE ? `P/E ${ntmPE}` : ""}. Source: FMP consensus.
                      </Text>
                    )}
                  </>
                );
              })()}
              {valPeer.length > 0 && <><SubSectionHdr title="Peer Valuation Context" />{valPeer.map((p,i) => <Para key={i} text={p} />)}</>}
              {valScen.length > 0 && (
                <>
                  <SubSectionHdr title="Implied Scenarios" />
                  {valScen.map((p,i) => <Para key={i} text={p} />)}
                  {/* Scenario price range visual */}
                  {showChart("price_range") && (() => {
                    const allText = valScen.join(" ");
                    // Extract scenario prices from the labeled format: "Bear Case ($42):", "Base Case ($105):", "Bull Case ($155):"
                    const bearMatch = allText.match(/bear\s+case\s*[\(\[\{]?\$\s*(\d{1,5}(?:\.\d{1,2})?)/i);
                    const baseMatch = allText.match(/base\s+case\s*[\(\[\{]?\$\s*(\d{1,5}(?:\.\d{1,2})?)/i);
                    const bullMatch = allText.match(/bull\s+case\s*[\(\[\{]?\$\s*(\d{1,5}(?:\.\d{1,2})?)/i);
                    const bear3 = bearMatch ? parseFloat(bearMatch[1]) : null;
                    const base3 = baseMatch ? parseFloat(baseMatch[1]) : null;
                    const bull3 = bullMatch ? parseFloat(bullMatch[1]) : null;
                    const cur = facts.stock_price;
                    if (bear3 && bull3 && cur) {
                      const resolvedBase = base3 ?? cur;
                      const allP = [bear3, cur, resolvedBase, bull3];
                      const minP = Math.min(...allP) * 0.9;
                      const maxP = Math.max(...allP) * 1.1;
                      const BAR_W3 = 300;
                      const toX3 = (v: number) => ((v - minP) / (maxP - minP)) * BAR_W3;
                      const pts: { label: string; price: number; color: string }[] = [
                        { label: "Bear", price: bear3, color: RED },
                        { label: "Current", price: cur, color: AMBER },
                        { label: "Base", price: resolvedBase, color: ACCENT.primary },
                        { label: "Bull", price: bull3, color: GREEN },
                      ];
                      // Stagger labels: sort by price, alternate above/below
                      const sortedPts = [...pts].sort((a, b) => a.price - b.price);
                      return (
                        <View wrap={false} style={{ marginVertical: 8, padding: 8, backgroundColor: LGRAY, borderRadius: 3 }}>
                          <Text style={{ fontSize: 6.5, color: GRAY, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Price Range Visual</Text>
                          <Svg width={BAR_W3 + 40} height={56}>
                            {/* Track */}
                            <Line x1={0} y1={28} x2={BAR_W3} y2={28} stroke={BORDER} strokeWidth={2} />
                            {/* Range fill between bear and bull */}
                            <Rect x={toX3(bear3)} y={26} width={toX3(bull3) - toX3(bear3)} height={4} fill={LGRAY} rx={0} />
                            {pts.map((p, idx) => {
                              // alternate stagger: even = label above, odd = label below
                              const rank = sortedPts.findIndex(s => s.label === p.label);
                              const above = rank % 2 === 0;
                              const lx = toX3(p.price);
                              const stemY1 = above ? 24 : 32;
                              const stemY2 = above ? 18 : 38;
                              const textY  = above ? 15 : 44;
                              return (
                                <G key={p.label}>
                                  <Rect x={lx - 4} y={24} width={8} height={8} fill={p.color} rx={4} />
                                  <Line x1={lx} y1={stemY1} x2={lx} y2={stemY2} stroke={p.color} strokeWidth={0.7} strokeDasharray="1,1" />
                                  <Text x={lx} y={textY}
                                    style={{ fontSize: 5.5, fill: p.color, fontFamily: "Helvetica-Bold", textAnchor: "middle" }}>
                                    {p.label} ${p.price.toFixed(0)}
                                  </Text>
                                </G>
                              );
                            })}
                          </Svg>
                          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 0 }}>
                            {sortedPts.map(p => (
                              <View key={p.label} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.color }} />
                                <Text style={{ fontSize: 6.5, color: DGRAY }}>{p.label}: ${p.price.toFixed(0)}{cur && p.price !== cur ? ` (${((p.price/cur-1)*100).toFixed(0)}%)` : ""}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
            </>
          )}

          {/* VII. Management Commentary & Guidance */}
          {(() => {
            const mgmtFallback = parseParas(secs["MANAGEMENT_COMMENTARY"] ?? "");
            const hasSubsections = callHighlights.length > 0 || fwdGuidance.length > 0;
            if (!hasSubsections && mgmtFallback.length === 0) return null;
            return (
              <>
                <SectionHdr title="VII. Management Commentary & Guidance" accentColor={ACCENT.primary} pageBreak />
                {callHighlights.length > 0 && <><SubSectionHdr title="Earnings Call Highlights" />{callHighlights.map((p,i) => <Para key={i} text={p} />)}</>}
                {fwdGuidance.length > 0 && <><SubSectionHdr title="Forward Guidance & Outlook" />{fwdGuidance.map((p,i) => <Para key={i} text={p} />)}</>}
                {!hasSubsections && mgmtFallback.map((p,i) => <Para key={i} text={p} />)}
                {/* Earnings Beat/Miss History Table */}
                {Array.isArray(fmpExtended?.earnings_surprises) && (fmpExtended!.earnings_surprises as {date?: string; actual_eps?: number; estimated_eps?: number; surprise_pct?: number}[]).length > 0 && (() => {
                  const surps = (fmpExtended!.earnings_surprises as {date?: string; actual_eps?: number; estimated_eps?: number; surprise_pct?: number}[]).slice(0, 8);
                  const beats = surps.filter(s => (s.surprise_pct ?? 0) > 0).length;
                  const beatRate = surps.length > 0 ? (beats / surps.length * 100).toFixed(0) : "?";
                  const avgSurp = surps.length > 0 ? surps.reduce((a, s) => a + (s.surprise_pct ?? 0), 0) / surps.length : null;
                  return (
                    <View wrap={false} style={{ marginTop: 10, marginBottom: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 5 }}>
                        <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: NAVY, textTransform: "uppercase", letterSpacing: 0.6 }}>EPS Beat/Miss History</Text>
                        <View style={{ backgroundColor: beats >= surps.length * 0.7 ? GREEN : beats >= surps.length * 0.5 ? AMBER : RED, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 2 }}>
                          <Text style={{ fontSize: 5.5, color: "white", fontFamily: "Helvetica-Bold" }}>{beatRate}% BEAT RATE ({beats}/{surps.length})</Text>
                        </View>
                        {avgSurp != null && (
                          <Text style={{ fontSize: 6, color: avgSurp >= 0 ? GREEN : RED }}>Avg {avgSurp >= 0 ? "+" : ""}{avgSurp.toFixed(1)}% vs consensus</Text>
                        )}
                      </View>
                      <View wrap={false} style={S.table}>
                        <View style={[S.tableHeader, { backgroundColor: NAVY2 }]}>
                          {["Period", "Actual EPS", "Consensus", "Surprise"].map((h, hi) => (
                            <Text key={hi} style={[S.tableHeaderCell, { flex: hi === 0 ? 2 : 1, textAlign: hi === 0 ? "left" : "right" }]}>{h}</Text>
                          ))}
                        </View>
                        {surps.map((e, ei) => {
                          const isPos = (e.surprise_pct ?? 0) >= 0;
                          return (
                            <View key={ei} style={[S.tableRow, { backgroundColor: ei % 2 === 0 ? "white" : LGRAY }]}>
                              <Text style={[S.tableCell, { flex: 2 }]}>{e.date?.slice(0, 7) ?? "—"}</Text>
                              <Text style={[S.tableCell, { flex: 1, textAlign: "right" }]}>{e.actual_eps != null ? `$${e.actual_eps.toFixed(2)}` : "—"}</Text>
                              <Text style={[S.tableCell, { flex: 1, textAlign: "right" }]}>{e.estimated_eps != null ? `$${e.estimated_eps.toFixed(2)}` : "—"}</Text>
                              <Text style={[S.tableCell, { flex: 1, textAlign: "right", color: isPos ? GREEN : RED, fontFamily: "Helvetica-Bold" }]}>
                                {e.surprise_pct != null ? `${isPos ? "+" : ""}${e.surprise_pct.toFixed(1)}%` : "—"}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}
              </>
            );
          })()}

          {/* VIII. Management & Governance */}
          {(leadership.length > 0 || capAlloc.length > 0) && (
            <>
              <SectionHdr title="VIII. Management & Governance" accentColor={ACCENT.primary} pageBreak />
              {leadership.length > 0 && <><SubSectionHdr title="Leadership & Track Record" />{leadership.map((p,i) => <Para key={i} text={p} />)}</>}
              {/* Insider Activity Signal — rendered from real fmpExtended data */}
              {Array.isArray(fmpExtended?.insider_trading) && (fmpExtended!.insider_trading as {name?: string; title?: string; transaction?: string; shares?: number; price?: number; value?: number; date?: string}[]).length > 0 && (() => {
                const trades = (fmpExtended!.insider_trading as {name?: string; title?: string; transaction?: string; shares?: number; price?: number; value?: number; date?: string}[]).slice(0, 12);
                const buys  = trades.filter(t => (t.transaction ?? "").toLowerCase().includes("buy") || (t.transaction ?? "").toLowerCase() === "purchase");
                const sells = trades.filter(t => (t.transaction ?? "").toLowerCase().includes("sell") || (t.transaction ?? "").toLowerCase() === "sale");
                const buyVal  = buys.reduce((s, t) => s + Math.abs(t.value ?? 0), 0);
                const sellVal = sells.reduce((s, t) => s + Math.abs(t.value ?? 0), 0);
                const net = buyVal - sellVal;
                const fmtMV = (v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;
                const signal = net > 0 ? "NET BUYER" : buys.length === 0 ? "NET SELLER" : "MIXED";
                const signalColor = signal === "NET BUYER" ? GREEN : signal === "NET SELLER" ? RED : AMBER;
                return (
                  <View wrap={false} style={{ borderWidth: 1, borderColor: signalColor, borderRadius: 3, padding: 9, marginBottom: 10, backgroundColor: LGRAY }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <View style={{ backgroundColor: signalColor, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 2 }}>
                        <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "white", letterSpacing: 0.8 }}>INSIDER SIGNAL: {signal}</Text>
                      </View>
                      <Text style={{ fontSize: 6.5, color: GRAY }}>{trades.length} transactions · Net: {net >= 0 ? "+" : ""}{fmtMV(Math.abs(net))}</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <View style={{ flex: 1, backgroundColor: "#dcfce7", borderRadius: 2, padding: 6 }}>
                        <Text style={{ fontSize: 6, color: GREEN, fontFamily: "Helvetica-Bold", marginBottom: 3 }}>PURCHASES ({buys.length})</Text>
                        {buys.slice(0, 3).map((t, j) => (
                          <Text key={j} style={{ fontSize: 6, color: DGRAY, marginBottom: 1 }}>
                            {t.name ? t.name.split(" ").slice(-1)[0] : "?"} ({t.title?.slice(0, 10) ?? "?"}): {fmtMV(Math.abs(t.value ?? 0))} @ ${t.price?.toFixed(0) ?? "?"}
                          </Text>
                        ))}
                      </View>
                      <View style={{ flex: 1, backgroundColor: "#fee2e2", borderRadius: 2, padding: 6 }}>
                        <Text style={{ fontSize: 6, color: RED, fontFamily: "Helvetica-Bold", marginBottom: 3 }}>SALES ({sells.length})</Text>
                        {sells.slice(0, 3).map((t, j) => (
                          <Text key={j} style={{ fontSize: 6, color: DGRAY, marginBottom: 1 }}>
                            {t.name ? t.name.split(" ").slice(-1)[0] : "?"} ({t.title?.slice(0, 10) ?? "?"}): {fmtMV(Math.abs(t.value ?? 0))} @ ${t.price?.toFixed(0) ?? "?"}
                          </Text>
                        ))}
                      </View>
                    </View>
                  </View>
                );
              })()}
              {showChart("buyback_sbc") && <BuybackSbcChart history={history} />}
              {capAlloc.length > 0 && (
                <>
                  <SubSectionHdr title="Capital Allocation Discipline" />
                  {capAlloc.map((p,i) => <Para key={i} text={p} />)}
                  {/* Capital Allocation waterfall */}
                  {showChart("cap_alloc") && (() => {
                    const capex  = facts.capex != null ? Math.abs(facts.capex) : null;
                    const buybk  = facts.buybacks != null ? Math.abs(facts.buybacks) : null;
                    const divs   = facts.dividends_paid != null ? Math.abs(facts.dividends_paid) : null;
                    const fcvCA  = facts.free_cash_flow;
                    if (!fcvCA || fcvCA <= 0) return null;
                    const reinv  = capex ?? 0;
                    const buy2   = buybk ?? 0;
                    const div2   = divs ?? 0;
                    const cashBuild = Math.max(0, fcvCA - reinv - buy2 - div2);
                    const total4 = reinv + buy2 + div2 + cashBuild;
                    if (total4 <= 0) return null;
                    const segs4 = [
                      { label: "CapEx", value: reinv, color: ACCENT.primary },
                      { label: "Buybacks", value: buy2, color: BLUE },
                      { label: "Dividends", value: div2, color: GREEN },
                      { label: "Cash Build", value: cashBuild, color: AMBER },
                    ].filter(s => s.value > 0);
                    const fmtS = (v: number) => v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`;
                    const cv = chartVariant("cap_alloc");

                    if (cv === 1 || cv === 2) {
                      // Vertical grouped bars
                      const BAR_H = 50; const BARW = Math.min(52, 240 / segs4.length - 8);
                      const totalW = segs4.length * (BARW + 8);
                      return (
                        <View wrap={false} style={S.capAllocRow}>
                          <Text style={[S.posCardLabel, { marginBottom: 6 }]}>FCF Deployment — {fmtS(fcvCA)} Total FCF</Text>
                          <Svg width={totalW + 10} height={BAR_H + 22}>
                            {segs4.map((seg, i) => {
                              const bh = (seg.value / total4) * BAR_H;
                              const x = 5 + i * (BARW + 8);
                              return (
                                <G key={seg.label}>
                                  <Rect x={x} y={BAR_H - bh} width={BARW} height={bh} fill={seg.color} rx={2} />
                                  <Rect x={x} y={BAR_H - bh} width={BARW} height={2} fill={seg.color} />
                                </G>
                              );
                            })}
                            {segs4.map((seg, i) => {
                              const x = 5 + i * (BARW + 8);
                              return (
                                <G key={`lbl-${seg.label}`}>
                                  <Polygon points={`${x+BARW/2-3},${BAR_H+3} ${x+BARW/2+3},${BAR_H+3} ${x+BARW/2},${BAR_H}`} fill={seg.color} />
                                </G>
                              );
                            })}
                          </Svg>
                          <View style={S.capAllocLeg}>
                            {segs4.map(seg => (
                              <View key={seg.label} style={S.capAllocLegItem}>
                                <View style={[S.capAllocLegDot, { backgroundColor: seg.color }]} />
                                <Text style={S.capAllocLegText}>{seg.label} {((seg.value/total4)*100).toFixed(0)}% · {fmtS(seg.value)}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      );
                    }

                    if (cv === 3 || cv === 4) {
                      // Treemap-style grid: divide a 300×32 rect proportionally
                      const BAR_W4 = 300; const BAR_H4 = 28;
                      let xTM = 0;
                      return (
                        <View wrap={false} style={S.capAllocRow}>
                          <Text style={[S.posCardLabel, { marginBottom: 4 }]}>FCF Deployment ({fmtS(fcvCA)} FCF)</Text>
                          <Svg width={BAR_W4} height={BAR_H4 + 2}>
                            {segs4.map(seg => {
                              const w4 = (seg.value / total4) * BAR_W4;
                              const rx = xTM; xTM += w4;
                              const pct = ((seg.value / total4) * 100).toFixed(0);
                              const cx = rx + w4 / 2;
                              return (
                                <G key={seg.label}>
                                  <Rect x={rx + 0.5} y={0} width={w4 - 1} height={BAR_H4} fill={seg.color} opacity={0.85} rx={1} />
                                  {w4 > 28 && <Rect x={rx} y={0} width={w4} height={2} fill={seg.color} />}
                                  {w4 > 32 && (
                                    <G>
                                      <Polygon points={`${cx-3},${BAR_H4-3} ${cx+3},${BAR_H4-3} ${cx},${BAR_H4}`} fill="white" opacity={0.4} />
                                    </G>
                                  )}
                                  {w4 > 40 && <Rect x={rx + 2} y={4} width={w4 - 4} height={10} fill="white" opacity={0.08} rx={1} />}
                                </G>
                              );
                            })}
                            {segs4.map(seg => {
                              const w4b = (seg.value / total4) * BAR_W4;
                              let xb = 0;
                              segs4.forEach(s => { if (s.label === seg.label) return; xb += (s.value / total4) * BAR_W4; });
                              // Recompute x position properly
                              let xp = 0;
                              for (const s of segs4) {
                                if (s.label === seg.label) break;
                                xp += (s.value / total4) * BAR_W4;
                              }
                              const pct = ((seg.value / total4) * 100).toFixed(0);
                              if (w4b < 20) return null;
                              return (
                                <G key={`txt-${seg.label}`}>
                                  <Polygon points={`0,0 0,0 0,0`} fill="none" />
                                  <Rect x={xp} y={BAR_H4 / 2 - 4} width={w4b} height={8} fill="transparent" />
                                </G>
                              );
                            })}
                          </Svg>
                          <View style={S.capAllocLeg}>
                            {segs4.map(seg => (
                              <View key={seg.label} style={S.capAllocLegItem}>
                                <View style={[S.capAllocLegDot, { backgroundColor: seg.color }]} />
                                <Text style={S.capAllocLegText}>{seg.label} {fmtS(seg.value)} ({((seg.value/total4)*100).toFixed(0)}%)</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      );
                    }

                    // V0: default horizontal stacked bar
                    const BAR_W4 = 300;
                    let x4 = 0;
                    return (
                      <View wrap={false} style={S.capAllocRow}>
                        <Text style={[S.posCardLabel, { marginBottom: 4 }]}>FCF Deployment ({fmtS(fcvCA)} FCF)</Text>
                        <Svg width={BAR_W4} height={14}>
                          {segs4.map(seg => {
                            const w4 = (seg.value / total4) * BAR_W4;
                            const rx = x4;
                            x4 += w4;
                            return <Rect key={seg.label} x={rx} y={0} width={w4} height={14} fill={seg.color} />;
                          })}
                        </Svg>
                        <View style={S.capAllocLeg}>
                          {segs4.map(seg => (
                            <View key={seg.label} style={S.capAllocLegItem}>
                              <View style={[S.capAllocLegDot, { backgroundColor: seg.color }]} />
                              <Text style={S.capAllocLegText}>{seg.label} {fmtS(seg.value)} ({((seg.value/total4)*100).toFixed(0)}%)</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })()}
                </>
              )}
            </>
          )}

          {/* IX. Key Risks */}
          {(riskItems.length > 0 || risks.length > 0) && (
            <>
              <SectionHdr title="IX. Key Risks" accentColor={RED} pageBreak />
              {/* Risk Heatmap — categorize by HIGH/MEDIUM/LOW probability parsed from body */}
              {riskItems.length > 0 && (() => {
                const categorized = riskItems.map(r => {
                  const m = r.body.match(/\[\s*(HIGH|MEDIUM|LOW)\s*\]\s*probability/i);
                  return { title: r.title, prob: m ? m[1].toUpperCase() : null };
                });
                const high   = categorized.filter(r => r.prob === "HIGH");
                const medium = categorized.filter(r => r.prob === "MEDIUM");
                const low    = categorized.filter(r => r.prob === "LOW");
                const other  = categorized.filter(r => r.prob === null);
                if (high.length + medium.length + low.length === 0) return null;
                return (
                  <View wrap={false} style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 10, marginBottom: 14, backgroundColor: LGRAY }}>
                    <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: DGRAY, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>Risk Probability Heatmap</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {[
                        { label: "HIGH", items: high,   color: RED,   bg: "#fff5f5" },
                        { label: "MEDIUM", items: medium, color: AMBER, bg: "#fffbeb" },
                        { label: "LOW", items: low,     color: GRAY,  bg: "#f9fafb" },
                        ...(other.length > 0 ? [{ label: "UNRATED", items: other, color: GRAY, bg: "#f9fafb" }] : []),
                      ].map(col => col.items.length === 0 ? null : (
                        <View key={col.label} style={{ flex: col.items.length, backgroundColor: col.bg, borderRadius: 2, padding: 6, borderTopWidth: 2, borderTopColor: col.color }}>
                          <Text style={{ fontSize: 5.5, fontFamily: "Helvetica-Bold", color: col.color, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{col.label} ({col.items.length})</Text>
                          {col.items.map((r, j) => (
                            <Text key={j} style={{ fontSize: 6.5, color: DGRAY, marginBottom: 2 }}>• {r.title || `Risk ${j+1}`}</Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })()}
              {riskItems.length > 0
                ? riskItems.map((r, i) => {
                    const prob = r.body.match(/\[\s*(HIGH|MEDIUM|LOW)\s*\]\s*probability/i)?.[1]?.toUpperCase();
                    const accentColor = prob === "HIGH" ? RED : prob === "MEDIUM" ? AMBER : GRAY;
                    return (
                      <View key={i} wrap={false} style={{ marginBottom: 10, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: accentColor }}>
                        {r.title ? (
                          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: accentColor === RED ? RED : NAVY, marginBottom: 3 }}>
                            {r.title}
                          </Text>
                        ) : null}
                        {r.body ? <Text style={S.para}>{r.body.replace(/\*\*([^*]+)\*\*/g, "$1")}</Text> : null}
                      </View>
                    );
                  })
                : <Bullets items={risks} color={RED} />
              }
            </>
          )}

          {/* X. News Analysis & Market Intelligence */}
          {(() => {
            const newsAnalysisText = secs["NEWS_ANALYSIS_&_MARKET_INTELLIGENCE"] ?? secs["NEWS_ANALYSIS"] ?? "";
            if (!newsAnalysisText) return null;
            const subsections = parseNewsAnalysis(newsAnalysisText);
            const sentMatch = newsAnalysisText.match(/\b(Cluster Break|Deterioration|Recovery|Debate|Divergence|Quiet Period|Normal)\b/i);
            const sentPattern = sentMatch ? sentMatch[1] : null;
            const sentColor = sentPattern
              ? (["Cluster Break","Deterioration"].some(s => sentPattern.toLowerCase().includes(s.toLowerCase())) ? RED
                : sentPattern.toLowerCase() === "recovery" ? GREEN
                : sentPattern.toLowerCase() === "debate" ? AMBER
                : GRAY)
              : GRAY;
            // Subsection label colors
            const subColors: Record<string, string> = {
              "1": BLUE, "2": sentColor, "3": NAVY2, "4": GREEN, "5": AMBER,
            };
            if (subsections.length > 0) {
              return (
                <>
                  <SectionHdr title="X. News Analysis & Market Intelligence" accentColor={ACCENT.primary} pageBreak />
                  {subsections.map((sub, i) => {
                    const col = subColors[sub.icon] ?? NAVY;
                    const lines = sub.body.split("\n").map(l => l.trim()).filter(Boolean);
                    return (
                      <View key={i} wrap={false} style={{ marginBottom: 10, borderLeftWidth: 2, borderLeftColor: col }}>
                        <View style={{ backgroundColor: col, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 }}>
                          <Text style={{ color: "white", fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 0.8, textTransform: "uppercase" }}>
                            {sub.icon}. {sub.label}
                          </Text>
                        </View>
                        <View style={{ paddingHorizontal: 8 }}>
                          {lines.map((line, j) => {
                            const isOurTake = line.toUpperCase().startsWith("OUR TAKE:");
                            const isImpact = line.match(/^\[(HIGH|MEDIUM|LOW)\]/i);
                            const isPricedIn = line.match(/^"?The market appears/i) || line.match(/^"?What appears NOT/i);
                            const isCatalyst = line.match(/^\d+[\.\)]/);
                            if (isOurTake) {
                              return (
                                <View key={j} style={{ borderLeftWidth: 1.5, borderLeftColor: AMBER, paddingLeft: 6, marginBottom: 4, marginTop: 2 }}>
                                  <Text style={{ fontSize: 7.5, color: AMBER, fontFamily: "Helvetica-Bold" }}>
                                    {line.replace(/^OUR TAKE:\s*/i, "Our Take: ")}
                                  </Text>
                                </View>
                              );
                            }
                            if (isPricedIn) {
                              const isNot = line.match(/NOT/i);
                              return (
                                <View key={j} style={{ flexDirection: "row", marginBottom: 3 }}>
                                  <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: isNot ? RED : GREEN, marginTop: 4, marginRight: 5 }} />
                                  <Text style={{ flex: 1, fontSize: 8, lineHeight: 1.55, color: DGRAY, fontFamily: isNot ? "Helvetica-Oblique" : "Helvetica" }}>
                                    {stripMd(line.replace(/^[""]/,"").replace(/[""]/,""))}
                                  </Text>
                                </View>
                              );
                            }
                            if (isImpact || line.match(/^\[/)) {
                              return (
                                <View key={j} style={{ flexDirection: "row", marginBottom: 4 }}>
                                  <Text style={{ fontSize: 7, color: GRAY, fontFamily: "Helvetica-Bold", minWidth: 14 }}>•</Text>
                                  <Text style={{ flex: 1, fontSize: 8, lineHeight: 1.55, color: DGRAY }}>{stripMd(line)}</Text>
                                </View>
                              );
                            }
                            if (isCatalyst) {
                              return (
                                <View key={j} style={{ flexDirection: "row", marginBottom: 3 }}>
                                  <Text style={{ fontSize: 8, color: AMBER, fontFamily: "Helvetica-Bold", minWidth: 14 }}>{line.match(/^(\d+)/)?.[1]}.</Text>
                                  <Text style={{ flex: 1, fontSize: 8, lineHeight: 1.55, color: DGRAY }}>{stripMd(line.replace(/^\d+[\.\)]\s*/, ""))}</Text>
                                </View>
                              );
                            }
                            return <Text key={j} style={{ fontSize: 8, lineHeight: 1.6, color: DGRAY, marginBottom: 3 }}>{stripMd(line)}</Text>;
                          })}
                        </View>
                      </View>
                    );
                  })}
                </>
              );
            }
            // Fallback: render as flat paragraphs if no structured subsections found
            const newsParas = parseParas(newsAnalysisText);
            if (newsParas.length === 0) return null;
            return (
              <>
                <SectionHdr title="X. News Analysis & Market Intelligence" accentColor={ACCENT.primary} />
                {sentPattern && (
                  <View style={{ borderLeftWidth: 3, borderLeftColor: sentColor, backgroundColor: LGRAY, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 }}>
                    <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: sentColor, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 }}>
                      Sentiment Pattern: {sentPattern}
                    </Text>
                  </View>
                )}
                {newsParas.map((p, i) => <Para key={i} text={p} />)}
              </>
            );
          })()}

          {/* XI. Investment Thesis */}
          <SectionHdr title="XI. Investment Thesis" accentColor={ACCENT.primary} pageBreak />
          {/* Probability-weighted return bar */}
          {(() => {
            const convText = secs["CONVICTION_STATEMENT"] ?? itText;
            // Parse: Bull X% / Base X% / Bear X% or Bull: X% / Base: X% / Bear: X%
            const bullPctM = convText.match(/bull\s*:?\s*(\d{1,2})%/i);
            const basePctM = convText.match(/base\s*:?\s*(\d{1,2})%/i);
            const bearPctM = convText.match(/bear\s*:?\s*(\d{1,2})%/i);
            // Parse price targets from bull/bear bullets (last bullet has the math format)
            const bullPT = (secs["BULL_CASE"] ?? itText).match(/\$\s*(\d{2,5}(?:\.\d{1,2})?)\s*(?:price target|PT|upside)/i)
              ?? (secs["BULL_CASE"] ?? itText).match(/=\s*\$\s*(\d{2,5})/i);
            const bearPT = (secs["BEAR_CASE"] ?? "").match(/\$\s*(\d{2,5}(?:\.\d{1,2})?)\s*(?:downside|price target)/i)
              ?? (secs["BEAR_CASE"] ?? "").match(/=\s*\$\s*(\d{2,5})/i);
            const bullWt = bullPctM ? parseInt(bullPctM[1]) : null;
            const baseWt = basePctM ? parseInt(basePctM[1]) : null;
            const bearWt = bearPctM ? parseInt(bearPctM[1]) : null;
            const cur = facts.stock_price;
            const bullPrice = bullPT ? parseFloat(bullPT[1]) : null;
            const bearPrice = bearPT ? parseFloat(bearPT[1]) : null;
            const basePrice = cur; // fallback to current if no base PT
            if (!bullWt && !baseWt && !bearWt) return null;
            const total = (bullWt ?? 0) + (baseWt ?? 0) + (bearWt ?? 0);
            if (total === 0) return null;
            const bullRet = bullPrice && cur ? ((bullPrice / cur) - 1) * 100 : null;
            const bearRet = bearPrice && cur ? ((bearPrice / cur) - 1) * 100 : null;
            const wtdReturn = (bullWt && bullRet != null ? bullWt * bullRet / 100 : 0)
              + (bearWt && bearRet != null ? bearWt * bearRet / 100 : 0);
            return (
              <View wrap={false} style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 10, marginBottom: 12, backgroundColor: LGRAY }}>
                <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: DGRAY, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>Scenario Probability Weights</Text>
                {/* Probability bar */}
                <View style={{ flexDirection: "row", height: 10, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                  {bearWt ? <View style={{ flex: bearWt, backgroundColor: RED }} /> : null}
                  {baseWt ? <View style={{ flex: baseWt, backgroundColor: AMBER }} /> : null}
                  {bullWt ? <View style={{ flex: bullWt, backgroundColor: GREEN }} /> : null}
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  {bearWt ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: RED }} />
                    <Text style={{ fontSize: 6.5, color: RED, fontFamily: "Helvetica-Bold" }}>Bear {bearWt}%</Text>
                    {bearPrice ? <Text style={{ fontSize: 6, color: GRAY }}>{` ($${Math.round(bearPrice)})`}</Text> : null}
                  </View> : null}
                  {baseWt ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: AMBER }} />
                    <Text style={{ fontSize: 6.5, color: AMBER, fontFamily: "Helvetica-Bold" }}>Base {baseWt}%</Text>
                  </View> : null}
                  {bullWt ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: GREEN }} />
                    <Text style={{ fontSize: 6.5, color: GREEN, fontFamily: "Helvetica-Bold" }}>Bull {bullWt}%</Text>
                    {bullPrice ? <Text style={{ fontSize: 6, color: GRAY }}>{` ($${Math.round(bullPrice)})`}</Text> : null}
                  </View> : null}
                  {wtdReturn !== 0 && (
                    <View style={{ marginLeft: "auto", backgroundColor: wtdReturn > 0 ? "#dcfce7" : "#fee2e2", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 }}>
                      <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: wtdReturn > 0 ? GREEN : RED }}>
                        {`Wtd Return: ${wtdReturn >= 0 ? "+" : ""}${wtdReturn.toFixed(1)}%`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })()}
          {bull.length > 0 && (
            <View wrap={false} style={{ marginBottom: 12, borderLeftWidth: 3, borderLeftColor: GREEN, paddingLeft: 10, paddingTop: 8, paddingBottom: 8, paddingRight: 8, backgroundColor: "#f0fdf4" }}>
              <Text style={S.colHeaderBull}>Bull Case</Text>
              <Bullets items={bull} color={GREEN} />
            </View>
          )}
          {bear.length > 0 && (
            <View wrap={false} style={{ marginBottom: 12, borderLeftWidth: 3, borderLeftColor: RED, paddingLeft: 10, paddingTop: 8, paddingBottom: 8, paddingRight: 8, backgroundColor: "#fff1f2" }}>
              <Text style={S.colHeaderBear}>Bear Case</Text>
              <Bullets items={bear} color={RED} />
            </View>
          )}
          {/* Conviction statement */}
          {(() => {
            const conviction = parseParas(secs["CONVICTION_STATEMENT"] ?? "");
            if (conviction.length > 0) {
              return (
                <View style={[S.noteBox, { marginTop: 10 }]}>
                  <Text style={S.noteLabel}>Analyst Conviction</Text>
                  {conviction.map((p, i) => <Text key={i} style={S.noteText}>{p.replace(/\*\*([^*]+)\*\*/g, "$1")}</Text>)}
                </View>
              );
            }
            return null;
          })()}
          {note.length > 0 && (
            <View wrap={false} style={S.noteBox}>
              <Text style={S.noteLabel}>Analyst Note</Text>
              {note.map((p, i) => <Text key={i} style={S.noteText}>{p.replace(/\*\*([^*]+)\*\*/g, "$1")}</Text>)}
            </View>
          )}

          {/* XII. Key Metrics Dashboard */}
          {kpiRows.length > 0 && (
            <>
              <SectionHdr title="XII. Key Metrics Dashboard" accentColor={ACCENT.primary} pageBreak />
              <View style={S.table}>
                <View wrap={false} style={[S.tableHeader, { backgroundColor: ACCENT.primary }]}>
                  {[["KPI", "20%"], ["LTM", "13%"], ["NTM Est", "12%"], ["Watch Threshold", "20%"], ["Why It Matters Here", "35%"]].map(([h, w]) => (
                    <Text key={h} style={[S.tableHeaderCell, { width: w }]}>{h}</Text>
                  ))}
                </View>
                {kpiRows.map((row, i) => (
                  <View key={i} wrap={false} style={[i % 2 === 0 ? S.tableRow : S.tableRowAlt, { alignItems: "flex-start" }]}>
                    <Text style={[S.tableCellBold, { width: "20%", lineHeight: 1.4 }]}>{stripMd(row.kpi)}</Text>
                    <Text style={[S.tableCell,     { width: "13%", lineHeight: 1.4 }]}>{stripMd(row.current)}</Text>
                    <Text style={[S.tableCell,     { width: "12%", lineHeight: 1.4, color: BLUE }]}>{row.ntm ? stripMd(row.ntm) : "—"}</Text>
                    <Text style={[S.tableCell,     { width: "20%", color: RED, lineHeight: 1.4 }]}>{stripMd(row.threshold)}</Text>
                    <Text style={[S.tableCell,     { width: "35%", lineHeight: 1.4 }]}>{stripMd(row.why)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* XIII. Earnings Call Questions */}
          {qaItems.length > 0 && (
            <>
              <SectionHdr title="XIII. Earnings Call Questions" accentColor={ACCENT.primary} pageBreak />
              <Text style={[S.para, { color: GRAY, marginBottom: 8 }]}>Institutional-grade questions for the upcoming earnings call:</Text>
              {qaItems.map((q, i) => (
                <View key={i} wrap={false} style={[S.bullet, { marginBottom: 7 }]}>
                  <Text style={[S.bulletDot, { color: BLUE, minWidth: 18 }]}>{i + 1}.</Text>
                  <Text style={[S.bulletText, { fontFamily: "Helvetica" }]}>{q.replace(/\*\*([^*]+)\*\*/g, "$1")}</Text>
                </View>
              ))}
            </>
          )}

        </View>

        <PageFooter ticker={ticker} company={companyName} date={headerDate} />
      </Page>
    </Document>
  );
}
