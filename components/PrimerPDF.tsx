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
    .filter((x): x is { label: string; value: string } => x !== null);
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

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHdr({ title }: { title: string }) {
  return <View><Text style={S.sectionHeader}>{title}</Text></View>;
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
}

export function PrimerDocument({ ticker, companyName, industry, content, generatedDate, history, facts }: PrimerPDFProps) {
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
  const bull  = parseBullets(secs["BULL_CASE"] ?? "");
  const bear  = parseBullets(secs["BEAR_CASE"] ?? "");
  const note  = parseParas(secs["ANALYST_NOTE"] ?? "");

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

  return (
    <Document title={`${companyName} (${ticker}) — Equity Research Primer`} author="Edgewood Management">
      <Page size="LETTER" style={S.page}>

        {/* Header bar */}
        <View style={S.header} fixed>
          <Text style={S.headerLeft}>{companyName} | {ticker} | Equity Research Primer</Text>
          <Text style={S.headerRight}>Edgewood Management | {headerDate}</Text>
        </View>

        {/* Cover block */}
        <View style={S.coverBlock}>
          <Text style={S.coverName}>{companyName}</Text>
          <Text style={S.coverSub}>{ticker} · {industry}</Text>
        </View>

        <View style={S.body}>

          {/* I. Executive Summary */}
          <SectionHdr title="I. Executive Summary" />
          {execBullets.length > 0
            ? <Bullets items={execBullets} />
            : <Para text={secs["EXECUTIVE_SUMMARY"] ?? ""} />}

          {/* II. Company Snapshot */}
          <SectionHdr title="II. Company Snapshot" />
          {snapshotRows.length > 0 && <SnapshotTable rows={snapshotRows} />}

          {/* Charts */}
          {Object.keys(history.revenue ?? {}).length >= 2 && (
            <>
              <SubSectionHdr title="Financial Trends" />
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <RevenueBarChart history={history} />
                </View>
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
          <SectionHdr title="III. Business Overview" />
          {bg.length > 0 && <><SubSectionHdr title="Company Background" />{bg.map((p,i) => <Para key={i} text={p} />)}</>}
          {pp.length > 0 && <><SubSectionHdr title="Product Portfolio & Revenue Mix" />{pp.map((p,i) => <Para key={i} text={p} />)}</>}
          {cust.length > 0 && <><SubSectionHdr title="Customers, End Markets & Geographic Exposure" />{cust.map((p,i) => <Para key={i} text={p} />)}</>}

          {/* IV. Industry Analysis */}
          <SectionHdr title="IV. Industry Analysis" />
          {mkt.length > 0 && <><SubSectionHdr title="Market Structure & Competitive Dynamics" />{mkt.map((p,i) => <Para key={i} text={p} />)}</>}
          {drv.length > 0 && <><SubSectionHdr title="Key Industry Drivers & Cycle" />{drv.map((p,i) => <Para key={i} text={p} />)}</>}
          {comp.length > 0 && <><SubSectionHdr title="Competitive Position" />{comp.map((p,i) => <Para key={i} text={p} />)}</>}

          {/* V. Financial Analysis */}
          <SectionHdr title="V. Financial Analysis" />
          {rev.length > 0 && <><SubSectionHdr title="Revenue & Profitability Trends" />{rev.map((p,i) => <Para key={i} text={p} />)}</>}
          {bal.length > 0 && <><SubSectionHdr title="Balance Sheet & Capital Allocation" />{bal.map((p,i) => <Para key={i} text={p} />)}</>}
          {fcf.length > 0 && <><SubSectionHdr title="Free Cash Flow & CapEx" />{fcf.map((p,i) => <Para key={i} text={p} />)}</>}
          {qoe.length > 0 && <><SubSectionHdr title="Quality of Earnings & Cash Conversion" />{qoe.map((p,i) => <Para key={i} text={p} />)}</>}

          {/* VI. Valuation Framework */}
          {(valCurrHist.length > 0 || valPeer.length > 0 || valScen.length > 0) && (
            <>
              <SectionHdr title="VI. Valuation Framework" />
              {valCurrHist.length > 0 && <><SubSectionHdr title="Current Valuation vs. Historical Range" />{valCurrHist.map((p,i) => <Para key={i} text={p} />)}</>}
              {valPeer.length > 0 && <><SubSectionHdr title="Peer Valuation Context" />{valPeer.map((p,i) => <Para key={i} text={p} />)}</>}
              {valScen.length > 0 && <><SubSectionHdr title="Implied Scenarios" />{valScen.map((p,i) => <Para key={i} text={p} />)}</>}
            </>
          )}

          {/* VII. Management Commentary & Guidance */}
          {(callHighlights.length > 0 || fwdGuidance.length > 0) && (
            <>
              <SectionHdr title="VII. Management Commentary & Guidance" />
              {callHighlights.length > 0 && <><SubSectionHdr title="Earnings Call Highlights" />{callHighlights.map((p,i) => <Para key={i} text={p} />)}</>}
              {fwdGuidance.length > 0 && <><SubSectionHdr title="Forward Guidance & Outlook" />{fwdGuidance.map((p,i) => <Para key={i} text={p} />)}</>}
            </>
          )}

          {/* VIII. Management & Governance */}
          {(leadership.length > 0 || capAlloc.length > 0) && (
            <>
              <SectionHdr title="VIII. Management & Governance" />
              {leadership.length > 0 && <><SubSectionHdr title="Leadership & Track Record" />{leadership.map((p,i) => <Para key={i} text={p} />)}</>}
              {capAlloc.length > 0 && <><SubSectionHdr title="Capital Allocation Discipline" />{capAlloc.map((p,i) => <Para key={i} text={p} />)}</>}
            </>
          )}

          {/* IX. Key Risks */}
          {risks.length > 0 && (
            <>
              <SectionHdr title="IX. Key Risks" />
              <Bullets items={risks} color={RED} />
            </>
          )}

          {/* X. Investment Thesis */}
          <SectionHdr title="X. Investment Thesis" />
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

        </View>

        <PageFooter ticker={ticker} company={companyName} date={headerDate} />
      </Page>
    </Document>
  );
}
