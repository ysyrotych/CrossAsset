"use client";
import React from "react";
import {
  Document, Page, Text, View, StyleSheet,
  Svg, Rect, G, Line, Polyline,
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
    .filter(l => l.trim().startsWith("•") || l.trim().startsWith("-"))
    .map(l => l.replace(/^[•\-]\s*/, "").trim())
    .filter(b => b.length > 3 && b !== "--" && b !== "-");
}

function stripMd(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").trim();
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
    const t = line.trim();
    if (!t) continue;
    // Bold standalone title: **TITLE** (possibly after a bullet marker)
    const titleMatch = t.match(/^[•\-]?\s*\*\*([^*]+)\*\*\s*$/) ?? t.match(/^[•\-]?\s*\*\*([^*]+)\*\*:?\s*$/);
    if (titleMatch) { flush(); curTitle = titleMatch[1].trim(); continue; }
    // Bullet with bold-prefixed title: • **TITLE:** body...
    const inlineMatch = t.match(/^[•\-]\s*\*\*([^*]+)\*\*[:\s]+(.+)$/);
    if (inlineMatch) { flush(); risks.push({ title: inlineMatch[1].trim(), body: inlineMatch[2].trim() }); continue; }
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
    <View style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>Revenue (■) vs Free Cash Flow (■) — 5-Year</Text>
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
    <View style={{ marginBottom: 2 }}>
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
                {v}%
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
    <View style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>EPS Diluted — 5-Year ($)</Text>
      <Svg width={CHART_W} height={CHART_H + 2}>
        <Line x1={0} y1={MID_Y} x2={CHART_W} y2={MID_Y} stroke={BORDER} strokeWidth={0.5} strokeDasharray="3,2" />
        {years.map((yr, i) => {
          const v    = epsData[yr] ?? 0;
          const barH = Math.max(2, (Math.abs(v) / maxAbs) * MID_Y);
          const x0   = GAP + i * (BAR_W + GAP);
          const y0   = v >= 0 ? MID_Y - barH : MID_Y;
          const labelY = v >= 0 ? y0 - 3 : y0 + barH + 7;
          return (
            <G key={yr}>
              <Rect x={x0} y={y0} width={BAR_W} height={barH} fill={v >= 0 ? AMBER : RED} rx={1} />
              <Text x={x0 + BAR_W/2} y={labelY}
                style={{ fontSize: 5, fill: v >= 0 ? AMBER : RED, fontFamily: "Helvetica-Bold", textAnchor: "middle" }}>
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

function StockRangeBar({ facts }: { facts: Record<string, number> }) {
  const lo = facts.week52_low, hi = facts.week52_high, cur = facts.stock_price;
  if (!lo || !hi || !cur || hi <= lo) return null;
  const pct52 = Math.round(((cur - lo) / (hi - lo)) * 100);
  const dotX  = ((cur - lo) / (hi - lo)) * 220;
  return (
    <View style={{ marginTop: 8, marginBottom: 4 }}>
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
    <View style={[S.sectionHeaderWrap, pageBreak ? { break: "before" } as any : {}]}>
      <View style={[S.sectionHeaderAccent, { backgroundColor: accentColor ?? NAVY }]} />
      <Text style={[S.sectionHeader, { flex: 1 }]}>{title}</Text>
    </View>
  );
}

function SubSectionHdr({ title }: { title: string }) {
  return <Text style={S.subsectionHeader}>{title}</Text>;
}
function Para({ text }: { text: string }) {
  const clean = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  return <Text style={S.para}>{clean}</Text>;
}
function Bullets({ items, color }: { items: string[]; color?: string }) {
  return (
    <>
      {items.map((item, i) => {
        const clean = item.replace(/\*\*([^*]+)\*\*/g, "$1");
        return (
          <View key={i} style={S.bullet}>
            <Text style={[S.bulletDot, color ? { color } : {}]}>•</Text>
            <Text style={S.bulletText}>{clean}</Text>
          </View>
        );
      })}
    </>
  );
}
function SnapshotTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <View style={S.snapshotGrid}>
      {rows.map((r, i) => (
        <View key={i} style={S.snapshotCell}>
          <Text style={S.snapshotLabel}>{r.label}</Text>
          <Text style={S.snapshotValue}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}
function PageFooter({ ticker, company, date }: { ticker: string; company: string; date: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>{company} ({ticker}) — Equity Research Primer</Text>
      <Text style={S.footerText}>Edgewood Management | {date} | For institutional use only</Text>
    </View>
  );
}

// ── Main Document ─────────────────────────────────────────────────────────────

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
}

const ALL_CHARTS = ["revenue_fcf", "eps", "margins", "positioning", "price_range", "cap_alloc"];

export function PrimerDocument({ ticker, companyName, industry, content, generatedDate, history, facts, sector, selectedCharts }: PrimerPDFProps) {
  const showChart = (id: string) => !selectedCharts || selectedCharts.length === 0 || selectedCharts.includes(id);
  const secs = parsePrimerSections(content);

  const execBullets  = parseBullets(secs["EXECUTIVE_SUMMARY"] ?? "");
  const snapshotRows = parseSnapshotTable(secs["COMPANY_SNAPSHOT"] ?? "");

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
  const kpiRows = kpiRaw.split("\n").filter(l => l.includes("|")).slice(2).map(l => {
    const parts = l.split("|").map(p => p.trim()).filter(Boolean);
    return parts.length >= 4 ? { kpi: parts[0], current: parts[1], threshold: parts[2], why: parts[3] } : null;
  }).filter((r): r is { kpi: string; current: string; threshold: string; why: string } => r !== null && !r.kpi.match(/^[-=]+$/));

  const qaRaw  = secs["EARNINGS_CALL_QUESTIONS"] ?? "";
  const qaItems = qaRaw.split("\n")
    .filter(l => l.trim().match(/^(\d+[\.\)]\s|\*\*Q|\*\*\d|Q\d)/i))
    .map(l => l.replace(/^\d+[\.\)]\s*/, "").replace(/^\*\*/,"").replace(/\*\*$/,"").trim())
    .filter(Boolean)
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

  // Pull first exec bullet as cover tagline (trim to ~120 chars)
  const execTagline = (() => {
    const raw = execBullets[0] ?? "";
    const clean = raw.replace(/\*\*([^*]+)\*\*/g, "$1");
    return clean.length > 130 ? clean.slice(0, 127) + "…" : clean;
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
            {/* Key stat chips */}
            <View style={S.coverChips}>
              {[
                { label: "Market Cap", value: fmtCover(facts.market_cap) },
                { label: "Revenue (FY)", value: fmtCover(facts.revenue) },
                { label: "FCF Margin", value: fcfMarginCover != null ? `${fcfMarginCover.toFixed(1)}%` : "N/A" },
                { label: "ROIC", value: facts.roic != null ? `${facts.roic.toFixed(1)}%` : "N/A" },
              ].map(chip => (
                <View key={chip.label} style={[S.coverChip, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
                  <Text style={[S.coverChipLabel, { color: "rgba(255,255,255,0.5)" }]}>{chip.label}</Text>
                  <Text style={[S.coverChipValue, { color: "white" }]}>{chip.value}</Text>
                </View>
              ))}
            </View>
            {/* 52W range bar */}
            <StockRangeBar facts={facts} />
            {/* Investment frame */}
            {investmentFrame.length > 0 && (
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)" }}>
                <Text style={{ fontSize: 6.5, color: ACCENT.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 }}>Key Question</Text>
                <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>{investmentFrame}</Text>
              </View>
            )}
            {/* Date */}
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 6.5, marginTop: 12, textAlign: "right" }}>{headerDate} · Edgewood Management · For institutional use only</Text>
          </View>
        </View>

        <View style={S.body}>

          {/* I. Executive Summary */}
          <SectionHdr title="I. Executive Summary" accentColor={ACCENT.primary} />
          {execBullets.length > 0
            ? <Bullets items={execBullets} color={ACCENT.primary} />
            : parseParas(secs["EXECUTIVE_SUMMARY"] ?? "").map((p, i) => <Para key={i} text={p} />)}

          {/* II. Company Snapshot */}
          <SectionHdr title="II. Company Snapshot" accentColor={ACCENT.primary} />
          {snapshotRows.length > 0 && <SnapshotTable rows={snapshotRows} />}

          {/* Financial Positioning Card (4 boxes) */}
          {showChart("positioning") && (() => {
            const roic = facts.roic;
            const roicSpread = roic != null ? roic - 9 : null;
            const fcfYld = facts.free_cash_flow && facts.market_cap ? (facts.free_cash_flow / facts.market_cap * 100) : null;
            const erp = fcfYld != null ? fcfYld - 3.5 : null;
            const ocfNi = facts.operating_cf && facts.net_income ? facts.operating_cf / facts.net_income : null;
            const qLabel = ocfNi == null ? "N/A" : ocfNi > 1.1 ? "STRONG" : ocfNi > 0.8 ? "MODERATE" : "WEAK";
            return (
              <View style={S.positioningRow}>
                <View style={[S.posCard, { borderTopWidth: 2, borderTopColor: roicSpread != null && roicSpread >= 0 ? GREEN : RED }]}>
                  <Text style={S.posCardLabel}>ROIC vs WACC</Text>
                  <Text style={[S.posCardValue, { color: roicSpread != null && roicSpread >= 0 ? GREEN : RED }]}>
                    {roic != null ? `${roic.toFixed(1)}%` : "N/A"}
                  </Text>
                  <Text style={S.posCardSub}>vs 9% WACC{roicSpread != null ? ` | ${roicSpread >= 0 ? "+" : ""}${roicSpread.toFixed(1)}pp spread` : ""}</Text>
                </View>
                <View style={[S.posCard, { borderTopWidth: 2, borderTopColor: erp != null && erp > 0 ? GREEN : AMBER }]}>
                  <Text style={S.posCardLabel}>FCF Yield</Text>
                  <Text style={[S.posCardValue, { color: NAVY }]}>{fcfYld != null ? `${fcfYld.toFixed(1)}%` : "N/A"}</Text>
                  <Text style={S.posCardSub}>vs 3.5% RF{erp != null ? ` | ERP ${erp >= 0 ? "+" : ""}${erp.toFixed(1)}pp` : ""}</Text>
                </View>
                <View style={[S.posCard, { borderTopWidth: 2, borderTopColor: ocfNi != null && ocfNi > 1 ? GREEN : ocfNi != null && ocfNi > 0.8 ? AMBER : RED }]}>
                  <Text style={S.posCardLabel}>Earnings Quality</Text>
                  <Text style={[S.posCardValue, { color: NAVY }]}>{ocfNi != null ? `${ocfNi.toFixed(2)}x` : "N/A"}</Text>
                  <Text style={S.posCardSub}>OCF/Net Income | {qLabel}</Text>
                </View>
                <View style={[S.posCard, { borderTopWidth: 2, borderTopColor: ACCENT.primary }]}>
                  <Text style={S.posCardLabel}>Stock vs 52W Range</Text>
                  <Text style={[S.posCardValue, { color: NAVY }]}>
                    {facts.stock_price != null && facts.week52_low != null && facts.week52_high != null && facts.week52_high > facts.week52_low
                      ? `${Math.round(((facts.stock_price - facts.week52_low) / (facts.week52_high - facts.week52_low)) * 100)}th %ile`
                      : "N/A"}
                  </Text>
                  <Text style={S.posCardSub}>{facts.stock_price != null ? `$${facts.stock_price.toFixed(2)} current` : ""}</Text>
                </View>
              </View>
            );
          })()}

          {/* Charts — Revenue+FCF and EPS side by side */}
          {(showChart("revenue_fcf") || showChart("eps") || showChart("margins")) && Object.keys(history.revenue ?? {}).length >= 2 && (
            <>
              <SubSectionHdr title="Financial Trends" />
              <View style={{ flexDirection: "row", gap: 16, marginBottom: 8 }}>
                {showChart("revenue_fcf") && (
                  <View style={{ flex: 3 }}>
                    <RevenueBarChart history={history} />
                  </View>
                )}
                {showChart("eps") && Object.keys(history.eps_diluted ?? {}).length >= 2 && (
                  <View style={{ flex: 2 }}>
                    <EpsBarChart history={history} />
                  </View>
                )}
              </View>
              {showChart("margins") && <MarginLineChart history={history} />}
            </>
          )}

          {/* 5-Year Financial Summary */}
          {allFY.length > 0 && (
            <>
              <SubSectionHdr title="5-Year Financial Summary" />
              <View style={S.table}>
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
                ].filter(r => r.data && Object.keys(r.data).length > 0).map((row, ri) => (
                  <View key={row.label} style={[ri % 2 === 0 ? S.tableRow : S.tableRowAlt, row.key ? { borderTopWidth: 1, borderTopColor: BORDER } : {}]}>
                    <Text style={[row.key ? S.tableCellBold : S.tableCell, { width: "28%", color: row.key ? NAVY : DGRAY }]}>{row.label}</Text>
                    {allFY.map(y => (
                      <Text key={y} style={[row.key ? { ...S.tableCellNum, fontFamily: "Helvetica-Bold", color: NAVY } : S.tableCellNum, { flex: 1 }]}>{fmtM(row.data?.[y])}</Text>
                    ))}
                  </View>
                ))}
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
          <SectionHdr title="III. Business Overview" accentColor={ACCENT.primary} />
          {bg.length > 0 && <><SubSectionHdr title="Company Background" />{bg.map((p,i) => <Para key={i} text={p} />)}</>}
          {pp.length > 0 && <><SubSectionHdr title="Product Portfolio & Revenue Mix" />{pp.map((p,i) => <Para key={i} text={p} />)}</>}
          {cust.length > 0 && <><SubSectionHdr title="Customers, End Markets & Geographic Exposure" />{cust.map((p,i) => <Para key={i} text={p} />)}</>}
          {parseParas(sectionFallback(secs, "BUSINESS_OVERVIEW", ["COMPANY_BACKGROUND","PRODUCT_PORTFOLIO_&_REVENUE_MIX","CUSTOMERS,_END_MARKETS_&_GEOGRAPHIC_EXPOSURE"])).map((p,i) => <Para key={i} text={p} />)}

          {/* IV. Industry Analysis */}
          <SectionHdr title="IV. Industry Analysis" accentColor={ACCENT.primary} />
          {mkt.length > 0 && <><SubSectionHdr title="Market Structure & Competitive Dynamics" />{mkt.map((p,i) => <Para key={i} text={p} />)}</>}
          {drv.length > 0 && <><SubSectionHdr title="Key Industry Drivers & Cycle" />{drv.map((p,i) => <Para key={i} text={p} />)}</>}
          {comp.length > 0 && <><SubSectionHdr title="Competitive Position" />{comp.map((p,i) => <Para key={i} text={p} />)}</>}
          {parseParas(sectionFallback(secs, "INDUSTRY_ANALYSIS", ["MARKET_STRUCTURE_&_COMPETITIVE_DYNAMICS","KEY_INDUSTRY_DRIVERS_&_CYCLE","COMPETITIVE_POSITION"])).map((p,i) => <Para key={i} text={p} />)}

          {/* V. Financial Analysis */}
          <SectionHdr title="V. Financial Analysis" accentColor={ACCENT.primary} />
          {rev.length > 0 && <><SubSectionHdr title="Revenue & Profitability Trends" />{rev.map((p,i) => <Para key={i} text={p} />)}</>}
          {bal.length > 0 && <><SubSectionHdr title="Balance Sheet & Capital Allocation" />{bal.map((p,i) => <Para key={i} text={p} />)}</>}
          {fcf.length > 0 && <><SubSectionHdr title="Free Cash Flow & CapEx" />{fcf.map((p,i) => <Para key={i} text={p} />)}</>}
          {parseParas(sectionFallback(secs, "FINANCIAL_ANALYSIS", ["REVENUE_&_PROFITABILITY_TRENDS","BALANCE_SHEET_&_CAPITAL_ALLOCATION","FREE_CASH_FLOW_&_CAPEX","QUALITY_OF_EARNINGS_&_CASH_CONVERSION"])).map((p,i) => <Para key={i} text={p} />)}
          {qoe.length > 0 && <><SubSectionHdr title="Quality of Earnings & Cash Conversion" />{qoe.map((p,i) => <Para key={i} text={p} />)}</>}

          {/* VI. Valuation Framework */}
          {(valCurrHist.length > 0 || valPeer.length > 0 || valScen.length > 0) && (
            <>
              <SectionHdr title="VI. Valuation Framework" accentColor={ACCENT.primary} pageBreak />
              {valCurrHist.length > 0 && <><SubSectionHdr title="Current Valuation vs. Historical Range" />{valCurrHist.map((p,i) => <Para key={i} text={p} />)}</>}
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
                        <View style={{ marginVertical: 8, padding: 8, backgroundColor: LGRAY, borderRadius: 3 }}>
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
          {(callHighlights.length > 0 || fwdGuidance.length > 0) && (
            <>
              <SectionHdr title="VII. Management Commentary & Guidance" accentColor={ACCENT.primary} />
              {callHighlights.length > 0 && <><SubSectionHdr title="Earnings Call Highlights" />{callHighlights.map((p,i) => <Para key={i} text={p} />)}</>}
              {fwdGuidance.length > 0 && <><SubSectionHdr title="Forward Guidance & Outlook" />{fwdGuidance.map((p,i) => <Para key={i} text={p} />)}</>}
            </>
          )}

          {/* VIII. Management & Governance */}
          {(leadership.length > 0 || capAlloc.length > 0) && (
            <>
              <SectionHdr title="VIII. Management & Governance" accentColor={ACCENT.primary} />
              {leadership.length > 0 && <><SubSectionHdr title="Leadership & Track Record" />{leadership.map((p,i) => <Para key={i} text={p} />)}</>}
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
                    const BAR_W4 = 300;
                    let x4 = 0;
                    return (
                      <View style={S.capAllocRow}>
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
              {riskItems.length > 0
                ? riskItems.map((r, i) => (
                    <View key={i} style={{ marginBottom: 10, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: i < 2 ? RED : i < 4 ? AMBER : GRAY }}>
                      {r.title ? (
                        <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: i < 2 ? RED : NAVY, marginBottom: 3 }}>
                          {r.title}
                        </Text>
                      ) : null}
                      {r.body ? <Text style={S.para}>{r.body.replace(/\*\*([^*]+)\*\*/g, "$1")}</Text> : null}
                    </View>
                  ))
                : <Bullets items={risks} color={RED} />
              }
            </>
          )}

          {/* X. News Analysis & Market Intelligence */}
          {(() => {
            const newsAnalysisText = secs["NEWS_ANALYSIS_&_MARKET_INTELLIGENCE"] ?? "";
            if (!newsAnalysisText) return null;
            const newsParas = parseParas(newsAnalysisText);
            if (newsParas.length === 0) return null;
            const sentMatch = newsAnalysisText.match(/\b(Cluster Break|Deterioration|Recovery|Debate|Divergence|Quiet Period|Normal)\b/i);
            const sentPattern = sentMatch ? sentMatch[1] : null;
            const sentColor = sentPattern
              ? (["Cluster Break","Deterioration"].some(s => sentPattern.toLowerCase().includes(s.toLowerCase())) ? RED
                : sentPattern.toLowerCase() === "recovery" ? GREEN
                : sentPattern.toLowerCase() === "debate" ? AMBER
                : GRAY)
              : GRAY;
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
          <View style={S.twoCols}>
            <View style={S.col}>
              <Text style={S.colHeaderBull}>Bull Case</Text>
              <Bullets items={bull} color={GREEN} />
            </View>
            <View style={S.col}>
              <Text style={S.colHeaderBear}>Bear Case</Text>
              <Bullets items={bear} color={RED} />
            </View>
          </View>
          {note.length > 0 && (
            <View style={S.noteBox}>
              <Text style={S.noteLabel}>Analyst Note</Text>
              {note.map((p, i) => <Text key={i} style={S.noteText}>{p.replace(/\*\*([^*]+)\*\*/g, "$1")}</Text>)}
            </View>
          )}

          {/* XII. Key Metrics Dashboard */}
          {kpiRows.length > 0 && (
            <>
              <SectionHdr title="XII. Key Metrics Dashboard" accentColor={ACCENT.primary} />
              <View style={S.table}>
                <View style={[S.tableHeader, { backgroundColor: ACCENT.primary }]}>
                  {[["KPI", 1], ["Current", 0.8], ["Watch Threshold", 0.9], ["Why It Matters", 2.3]].map(([h, f]) => (
                    <Text key={h as string} style={[S.tableHeaderCell, { flex: f as number }]}>{h as string}</Text>
                  ))}
                </View>
                {kpiRows.map((row, i) => (
                  <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                    <Text style={[S.tableCellBold, { flex: 1 }]}>{stripMd(row.kpi)}</Text>
                    <Text style={[S.tableCell,     { flex: 0.8 }]}>{stripMd(row.current)}</Text>
                    <Text style={[S.tableCell,     { flex: 0.9, color: RED }]}>{stripMd(row.threshold)}</Text>
                    <Text style={[S.tableCell,     { flex: 2.3 }]}>{stripMd(row.why)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* XIII. Earnings Call Questions */}
          {qaItems.length > 0 && (
            <>
              <SectionHdr title="XIII. Earnings Call Questions" accentColor={ACCENT.primary} />
              <Text style={[S.para, { color: GRAY, marginBottom: 8 }]}>Institutional-grade questions for the upcoming earnings call:</Text>
              {qaItems.map((q, i) => (
                <View key={i} style={[S.bullet, { marginBottom: 7 }]}>
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
