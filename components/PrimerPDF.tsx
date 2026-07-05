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
    letterSpacing: 1.2, textTransform: "uppercase", paddingHorizontal: 8, paddingVertical: 4,
    marginBottom: 8, marginTop: 16,
  },
  subsectionHeader: {
    fontSize: 9, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 5, marginTop: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 2,
  },

  para:       { fontSize: 8.5, lineHeight: 1.6, color: DGRAY, marginBottom: 6 },
  bullet:     { flexDirection: "row", marginBottom: 5 },
  bulletDot:  { width: 12, fontSize: 8.5, color: NAVY, fontFamily: "Helvetica-Bold" },
  bulletText: { flex: 1, fontSize: 8.5, lineHeight: 1.6, color: DGRAY },

  // Table
  table:          { marginVertical: 8 },
  tableHeader:    { flexDirection: "row", backgroundColor: NAVY, paddingVertical: 4, paddingHorizontal: 6 },
  tableHeaderCell:{ color: "white", fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  tableRow:       { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 3, paddingHorizontal: 6 },
  tableRowAlt:    { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 3, paddingHorizontal: 6, backgroundColor: LGRAY },
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
  coverChip:       { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 },
  coverChipLabel:  { fontSize: 6, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 1 },
  coverChipValue:  { fontSize: 10, fontFamily: "Helvetica-Bold" },

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
  const lines = markdown.split("\n");
  let currentKey = "";
  let buf: string[] = [];
  const flush = () => { if (currentKey) sections[currentKey] = buf.join("\n").trim(); };
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    if (h2) { flush(); currentKey = h2[1].trim().toUpperCase().replace(/\s+/g, "_"); buf = []; }
    else if (h3) { flush(); currentKey = h3[1].trim().toUpperCase().replace(/\s+/g, "_"); buf = []; }
    else { buf.push(line); }
  }
  flush();
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
    .filter(Boolean);
}

function parseParas(text: string): string[] {
  return text.split("\n\n")
    .map(p => p.replace(/^[•\-]\s*/, "").trim())
    .filter(p => p.length > 30 && !p.startsWith("#") && !p.startsWith("|"));
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

  const BAR_W = 32;
  const PAIR_W = BAR_W * 2 + 4;
  const GAP    = (CHART_W - years.length * PAIR_W) / (years.length + 1);

  const fmtShort = (v: number) =>
    Math.abs(v) >= 1e12 ? `$${(v/1e12).toFixed(1)}T`
    : Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B`
    : `$${(v/1e6).toFixed(0)}M`;

  return (
    <View style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>Revenue (■) vs Free Cash Flow (■) — 5-Year ($B)</Text>
      <Svg width={CHART_W} height={CHART_H + 2}>
        <Line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={BORDER} strokeWidth={0.5} />
        {years.map((yr, i) => {
          const rev = revData[yr] ?? 0;
          const fcf = fcfData[yr] ?? 0;
          const x0 = GAP + i * (PAIR_W + GAP);
          const revH = Math.max(2, (rev / maxV) * CHART_H);
          const fcfH = Math.max(2, (Math.abs(fcf) / maxV) * CHART_H);
          return (
            <G key={yr}>
              <Rect x={x0} y={CHART_H - revH} width={BAR_W} height={revH} fill={NAVY} rx={1} />
              <Rect x={x0 + BAR_W + 4} y={CHART_H - fcfH} width={BAR_W} height={fcfH} fill={fcf >= 0 ? GREEN : RED} rx={1} />
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 2 }}>
        {years.map(yr => (
          <Text key={yr} style={{ fontSize: 6, color: GRAY, textAlign: "center", width: PAIR_W + GAP }}>
            FY{yr.slice(0,4)}{"\n"}{fmtShort(revData[yr] ?? 0)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function MarginLineChart({ history }: { history: Record<string, Record<string, number>> }) {
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
  const minV = Math.min(...allVals, 0);
  const maxV = Math.max(...allVals, 1);
  const range = maxV - minV || 1;

  const toY = (v: number | null) => v == null ? null : CHART_H - ((v - minV) / range) * CHART_H;
  const toX = (i: number) => (i / (years.length - 1)) * CHART_W;

  const toPoints = (vals: (number | null)[]) =>
    vals.map((v, i) => v == null ? null : `${toX(i)},${toY(v)!}`)
        .filter((p): p is string => p !== null)
        .join(" ");

  const grossPts = toPoints(grossM);
  const opPts    = toPoints(opM);
  const netPts   = toPoints(netM);
  const zeroY    = toY(0);

  return (
    <View style={{ marginBottom: 2 }}>
      <Text style={S.chartLabel}>Margin Trends — Gross / Operating / Net (%)</Text>
      <Svg width={CHART_W} height={CHART_H + 2}>
        {zeroY != null && <Line x1={0} y1={zeroY} x2={CHART_W} y2={zeroY} stroke={BORDER} strokeWidth={0.5} strokeDasharray="3,2" />}
        <Line x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={BORDER} strokeWidth={0.5} />
        {grossPts && <Polyline points={grossPts} fill="none" stroke={BLUE} strokeWidth={1.5} strokeLinejoin="round" />}
        {opPts    && <Polyline points={opPts}    fill="none" stroke={NAVY} strokeWidth={1.5} strokeLinejoin="round" />}
        {netPts   && <Polyline points={netPts}   fill="none" stroke={GREEN} strokeWidth={1.5} strokeLinejoin="round" />}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 2 }}>
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
          return (
            <G key={yr}>
              <Rect x={x0} y={y0} width={BAR_W} height={barH} fill={v >= 0 ? AMBER : RED} rx={1} />
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

function SectionHdr({ title, accentColor }: { title: string; accentColor?: string }) {
  return <View><Text style={[S.sectionHeader, accentColor ? { backgroundColor: accentColor } : {}]}>{title}</Text></View>;
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
}

export function PrimerDocument({ ticker, companyName, industry, content, generatedDate, history, facts, sector }: PrimerPDFProps) {
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
            : <Para text={secs["EXECUTIVE_SUMMARY"] ?? ""} />}

          {/* II. Company Snapshot */}
          <SectionHdr title="II. Company Snapshot" accentColor={ACCENT.primary} />
          {snapshotRows.length > 0 && <SnapshotTable rows={snapshotRows} />}

          {/* Financial Positioning Card (4 boxes) */}
          {(() => {
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
          {Object.keys(history.revenue ?? {}).length >= 2 && (
            <>
              <SubSectionHdr title="Financial Trends" />
              <View style={{ flexDirection: "row", gap: 16, marginBottom: 8 }}>
                <View style={{ flex: 3 }}>
                  <RevenueBarChart history={history} />
                </View>
                {Object.keys(history.eps_diluted ?? {}).length >= 2 && (
                  <View style={{ flex: 2 }}>
                    <EpsBarChart history={history} />
                  </View>
                )}
              </View>
              <MarginLineChart history={history} />
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
                  { label: "Revenue",       data: history.revenue },
                  { label: "Gross Profit",  data: history.gross_profit },
                  { label: "Op. Income",    data: history.operating_income },
                  { label: "Net Income",    data: history.net_income },
                  { label: "Operating CF",  data: history.operating_cf },
                  { label: "Free Cash Flow",data: history.free_cash_flow },
                ].filter(r => r.data && Object.keys(r.data).length > 0).map((row, ri) => (
                  <View key={row.label} style={ri % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                    <Text style={[S.tableCellBold, { width: "28%" }]}>{row.label}</Text>
                    {allFY.map(y => (
                      <Text key={y} style={[S.tableCellNum, { flex: 1 }]}>{fmtM(row.data?.[y])}</Text>
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

          {/* IV. Industry Analysis */}
          <SectionHdr title="IV. Industry Analysis" accentColor={ACCENT.primary} />
          {mkt.length > 0 && <><SubSectionHdr title="Market Structure & Competitive Dynamics" />{mkt.map((p,i) => <Para key={i} text={p} />)}</>}
          {drv.length > 0 && <><SubSectionHdr title="Key Industry Drivers & Cycle" />{drv.map((p,i) => <Para key={i} text={p} />)}</>}
          {comp.length > 0 && <><SubSectionHdr title="Competitive Position" />{comp.map((p,i) => <Para key={i} text={p} />)}</>}

          {/* V. Financial Analysis */}
          <SectionHdr title="V. Financial Analysis" accentColor={ACCENT.primary} />
          {rev.length > 0 && <><SubSectionHdr title="Revenue & Profitability Trends" />{rev.map((p,i) => <Para key={i} text={p} />)}</>}
          {bal.length > 0 && <><SubSectionHdr title="Balance Sheet & Capital Allocation" />{bal.map((p,i) => <Para key={i} text={p} />)}</>}
          {fcf.length > 0 && <><SubSectionHdr title="Free Cash Flow & CapEx" />{fcf.map((p,i) => <Para key={i} text={p} />)}</>}
          {qoe.length > 0 && <><SubSectionHdr title="Quality of Earnings & Cash Conversion" />{qoe.map((p,i) => <Para key={i} text={p} />)}</>}

          {/* VI. Valuation Framework */}
          {(valCurrHist.length > 0 || valPeer.length > 0 || valScen.length > 0) && (
            <>
              <SectionHdr title="VI. Valuation Framework" accentColor={ACCENT.primary} />
              {valCurrHist.length > 0 && <><SubSectionHdr title="Current Valuation vs. Historical Range" />{valCurrHist.map((p,i) => <Para key={i} text={p} />)}</>}
              {valPeer.length > 0 && <><SubSectionHdr title="Peer Valuation Context" />{valPeer.map((p,i) => <Para key={i} text={p} />)}</>}
              {valScen.length > 0 && (
                <>
                  <SubSectionHdr title="Implied Scenarios" />
                  {valScen.map((p,i) => <Para key={i} text={p} />)}
                  {/* Scenario price range visual */}
                  {(() => {
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
                      return (
                        <View style={{ marginVertical: 8, padding: 8, backgroundColor: LGRAY, borderRadius: 3 }}>
                          <Text style={{ fontSize: 6.5, color: GRAY, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Price Range Visual</Text>
                          <Svg width={BAR_W3 + 30} height={36}>
                            <Line x1={0} y1={16} x2={BAR_W3} y2={16} stroke={BORDER} strokeWidth={2} />
                            {pts.map(p => (
                              <G key={p.label}>
                                <Rect x={toX3(p.price) - 3} y={10} width={6} height={12} fill={p.color} rx={3} />
                                <Line x1={toX3(p.price)} y1={22} x2={toX3(p.price)} y2={28} stroke={p.color} strokeWidth={0.5} />
                              </G>
                            ))}
                          </Svg>
                          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 2 }}>
                            {pts.map(p => (
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
                  {(() => {
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
          {risks.length > 0 && (
            <>
              <SectionHdr title="IX. Key Risks" accentColor={RED} />
              <Bullets items={risks} color={RED} />
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
          <SectionHdr title="XI. Investment Thesis" accentColor={ACCENT.primary} />
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
                  {["KPI", "Current", "Watch Threshold", "Why It Matters"].map((h, i) => (
                    <Text key={h} style={[S.tableHeaderCell, { flex: i === 3 ? 2 : 1 }]}>{h}</Text>
                  ))}
                </View>
                {kpiRows.map((row, i) => (
                  <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
                    <Text style={[S.tableCellBold, { flex: 1 }]}>{row.kpi}</Text>
                    <Text style={[S.tableCell,     { flex: 1 }]}>{row.current}</Text>
                    <Text style={[S.tableCell,     { flex: 1, color: RED }]}>{row.threshold}</Text>
                    <Text style={[S.tableCell,     { flex: 2 }]}>{row.why.replace(/\*\*([^*]+)\*\*/g, "$1")}</Text>
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
