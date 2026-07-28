"use client";
// ── CrossAsset Strategy Lab — Institutional Tearsheet PDF ────────────────────
// Generates a printable PDF tearsheet from the current portfolio analysis.
// Uses @react-pdf/renderer (already installed in this project).

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Font } from "@react-pdf/renderer";
import type { FactorScoreResult, PortfolioExposure } from "@/lib/strategy-lab/portfolio";

// ── Design tokens (match CrossAsset light theme) ─────────────────────────────
const NAVY  = "#0c1b38";
const GREEN = "#147a4f";
const RED   = "#b42318";
const AMBER = "#b7791f";
const GRAY  = "#777";
const LGRAY = "#f5f3ef";
const BORDER= "#e0dcd5";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: NAVY,
    backgroundColor: "#ffffff",
    paddingTop: 36, paddingBottom: 40, paddingLeft: 40, paddingRight: 40,
  },
  // Header
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    borderBottom: `2px solid ${NAVY}`, paddingBottom: 10, marginBottom: 14,
  },
  headerLeft: { gap: 2 },
  brand:    { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 2 },
  subtitle: { fontSize: 7,  color: GRAY, letterSpacing: 1, textTransform: "uppercase" },
  headerRight: { alignItems: "flex-end", gap: 2 },
  dateLabel: { fontSize: 7, color: GRAY },
  dateLine:  { fontSize: 8, color: NAVY, fontFamily: "Helvetica-Bold" },
  // Section
  sectionTitle: {
    fontSize: 7, fontFamily: "Helvetica-Bold", color: GRAY,
    letterSpacing: 2, textTransform: "uppercase",
    borderBottom: `1px solid ${BORDER}`, paddingBottom: 3, marginBottom: 6, marginTop: 14,
  },
  // Summary stat row
  statRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statBox: {
    flex: 1, backgroundColor: LGRAY, border: `1px solid ${BORDER}`,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  statLabel: { fontSize: 6, color: GRAY, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 },
  statValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY },
  statSub:   { fontSize: 6,  color: GRAY, marginTop: 1 },
  // Table
  table:    { border: `1px solid ${BORDER}` },
  tableHead:{ flexDirection: "row", backgroundColor: LGRAY, borderBottom: `1px solid ${BORDER}` },
  tableRow: { flexDirection: "row", borderBottom: `1px solid ${BORDER}` },
  tableRowLast: { flexDirection: "row" },
  th: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 6, fontFamily: "Helvetica-Bold", color: GRAY, letterSpacing: 0.8, textTransform: "uppercase" },
  td: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 7.5, color: NAVY },
  tdRight: { paddingVertical: 4, paddingHorizontal: 5, fontSize: 7.5, color: NAVY, textAlign: "right" },
  // Footer
  footer: {
    position: "absolute", bottom: 20, left: 40, right: 40,
    flexDirection: "row", justifyContent: "space-between",
    borderTop: `1px solid ${BORDER}`, paddingTop: 5,
  },
  footerText: { fontSize: 6, color: "#aaa" },
});

type TearsheetProps = {
  holdings: { ticker: string; weight: number; name?: string }[];
  factorScores: FactorScoreResult[] | null;
  portExposures: PortfolioExposure[] | null;
  currentRegime: string | null;
  computedAt: string | null;
};

function colorFor(v: number, positive = true): string {
  if (positive) return v > 0.3 ? GREEN : v < -0.3 ? RED : NAVY;
  return v < -0.3 ? GREEN : v > 0.3 ? RED : NAVY;
}

function fmtPct(v: number | null, decimals = 1): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(decimals)}%`;
}
function fmtZ(v: number | null): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2);
}

function TearsheetDoc({ holdings, factorScores, portExposures, currentRegime, computedAt }: TearsheetProps) {
  const now = computedAt ? new Date(computedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0);
  const scored = factorScores ?? [];

  // Portfolio-level risk stats (from risk decomp fields present on scored)
  const MARKET_VOL = 0.16;
  const validRisk = scored.filter(s => s.beta != null && s.realizedVol != null && s.weight > 0);
  const portBeta = validRisk.length
    ? validRisk.reduce((s, r) => s + r.weight * (r.beta ?? 0), 0) : null;
  const portVol = (portBeta != null && validRisk.length)
    ? (() => {
        const idioVar = validRisk.reduce((s, r) => {
          const idio = Math.max(0, (r.realizedVol ?? 0)**2 - (r.beta ?? 0)**2 * MARKET_VOL**2);
          return s + r.weight**2 * idio;
        }, 0);
        return Math.sqrt(portBeta**2 * MARKET_VOL**2 + idioVar);
      })()
    : null;

  const sectors = holdings.reduce<Record<string, number>>((acc, h) => {
    const s = scored.find(x => x.ticker === h.ticker)?.sector ?? "Other";
    acc[s] = (acc[s] ?? 0) + h.weight;
    return acc;
  }, {});
  const topSectors = Object.entries(sectors).sort((a,b) => b[1]-a[1]).slice(0,5);

  const FACTOR_LABELS: Record<string, string> = {
    Momentum: "MOM", LowVolatility: "LVOL", Value: "VAL", Quality: "QLTY", Size: "SZ",
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.brand}>CROSSASSET</Text>
            <Text style={styles.subtitle}>Strategy Lab · Portfolio Tearsheet</Text>
            {currentRegime && (
              <Text style={[styles.subtitle, { marginTop: 3, color: NAVY }]}>
                Current Regime: {currentRegime.toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.dateLabel}>Generated</Text>
            <Text style={styles.dateLine}>{now}</Text>
            <Text style={[styles.dateLabel, { marginTop: 4 }]}>Research purposes only</Text>
            <Text style={styles.dateLabel}>Not investment advice</Text>
          </View>
        </View>

        {/* ── Portfolio Summary Stats ── */}
        <Text style={styles.sectionTitle}>Portfolio Summary</Text>
        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Holdings</Text>
            <Text style={styles.statValue}>{holdings.length}</Text>
            <Text style={styles.statSub}>positions</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Weight</Text>
            <Text style={styles.statValue}>{(totalWeight * 100).toFixed(1)}%</Text>
            <Text style={styles.statSub}>allocated</Text>
          </View>
          {portBeta != null && (
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Portfolio Beta</Text>
              <Text style={[styles.statValue, { color: portBeta > 1.2 ? RED : portBeta < 0.8 ? GREEN : NAVY }]}>
                {portBeta.toFixed(2)}
              </Text>
              <Text style={styles.statSub}>vs SPY</Text>
            </View>
          )}
          {portVol != null && (
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Est. Portfolio Vol</Text>
              <Text style={styles.statValue}>{(portVol * 100).toFixed(1)}%</Text>
              <Text style={styles.statSub}>beta model, ann.</Text>
            </View>
          )}
          {portExposures?.map(e => e.factor === "Momentum" && (
            <View key="mom" style={styles.statBox}>
              <Text style={styles.statLabel}>Momentum Score</Text>
              <Text style={[styles.statValue, { color: colorFor(e.portfolioExposure ?? 0) }]}>
                {e.portfolioExposure != null ? (e.portfolioExposure >= 0 ? "+" : "") + e.portfolioExposure.toFixed(2) + "σ" : "—"}
              </Text>
              <Text style={styles.statSub}>cross-sect. z-score</Text>
            </View>
          ))}
        </View>

        {/* ── Holdings Table ── */}
        <Text style={styles.sectionTitle}>Holdings</Text>
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, { width: 50 }]}>Ticker</Text>
            <Text style={[styles.th, { flex: 1 }]}>Name</Text>
            <Text style={[styles.th, { width: 55 }]}>Sector</Text>
            <Text style={[styles.th, { width: 38, textAlign: "right" }]}>Weight</Text>
            <Text style={[styles.th, { width: 32, textAlign: "right" }]}>Beta</Text>
            <Text style={[styles.th, { width: 38, textAlign: "right" }]}>Ann.Vol</Text>
            <Text style={[styles.th, { width: 32, textAlign: "right" }]}>Score</Text>
          </View>
          {[...holdings].sort((a,b) => b.weight - a.weight).map((h, i) => {
            const s = scored.find(x => x.ticker === h.ticker);
            const isLast = i === holdings.length - 1;
            return (
              <View key={h.ticker} style={isLast ? styles.tableRowLast : styles.tableRow}>
                <Text style={[styles.td, { width: 50, fontFamily: "Helvetica-Bold" }]}>{h.ticker}</Text>
                <Text style={[styles.td, { flex: 1 }]}>{s?.name ?? h.name ?? h.ticker}</Text>
                <Text style={[styles.td, { width: 55, color: GRAY }]}>{s?.sector ?? "—"}</Text>
                <Text style={[styles.tdRight, { width: 38 }]}>{(h.weight * 100).toFixed(1)}%</Text>
                <Text style={[styles.tdRight, { width: 32, color: s?.beta != null ? (s.beta > 1.3 ? RED : s.beta < 0.7 ? GREEN : NAVY) : GRAY }]}>
                  {s?.beta != null ? s.beta.toFixed(2) : "—"}
                </Text>
                <Text style={[styles.tdRight, { width: 38, color: GRAY }]}>
                  {s?.realizedVol != null ? fmtPct(s.realizedVol, 1) : "—"}
                </Text>
                <Text style={[styles.tdRight, { width: 32, color: colorFor(s?.compositeScore ?? 0) }]}>
                  {s ? (s.compositeScore >= 0 ? "+" : "") + s.compositeScore.toFixed(2) : "—"}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Factor Exposures ── */}
        {portExposures && portExposures.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Factor Exposures (Portfolio vs Regime Target)</Text>
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { width: 80 }]}>Factor</Text>
                <Text style={[styles.th, { width: 70, textAlign: "right" }]}>Portfolio z-score</Text>
                <Text style={[styles.th, { width: 70, textAlign: "right" }]}>Regime Target</Text>
                <Text style={[styles.th, { flex: 1 }]}>Interpretation</Text>
              </View>
              {portExposures.map((e, i) => {
                const isLast = i === portExposures.length - 1;
                const exp = e.portfolioExposure;
                const label = FACTOR_LABELS[e.factor] ?? e.factor;
                const interp = exp == null ? "No data" : exp > 0.5 ? "Overweight" : exp < -0.5 ? "Underweight" : "Neutral";
                return (
                  <View key={e.factor} style={isLast ? styles.tableRowLast : styles.tableRow}>
                    <Text style={[styles.td, { width: 80, fontFamily: "Helvetica-Bold" }]}>{label}</Text>
                    <Text style={[styles.tdRight, { width: 70, color: exp != null ? colorFor(exp) : GRAY }]}>
                      {exp != null ? fmtZ(exp) + "σ" : "—"}
                    </Text>
                    <Text style={[styles.tdRight, { width: 70, color: GRAY }]}>
                      {e.regimeTarget != null ? (e.regimeTarget >= 0 ? "+" : "") + e.regimeTarget.toFixed(1) + "σ" : "—"}
                    </Text>
                    <Text style={[styles.td, { flex: 1, color: interp === "Overweight" ? GREEN : interp === "Underweight" ? RED : GRAY }]}>
                      {interp}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Sector Concentration ── */}
        {topSectors.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Sector Concentration</Text>
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { flex: 1 }]}>Sector</Text>
                <Text style={[styles.th, { width: 60, textAlign: "right" }]}>Weight</Text>
              </View>
              {topSectors.map(([sector, w], i) => (
                <View key={sector} style={i === topSectors.length - 1 ? styles.tableRowLast : styles.tableRow}>
                  <Text style={[styles.td, { flex: 1 }]}>{sector}</Text>
                  <Text style={[styles.tdRight, { width: 60 }]}>{(w * 100).toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            CrossAsset Strategy Lab · Research prototype — not investment advice · {now}
          </Text>
          <Text style={styles.footerText}>
            Scores are cross-sectional z-scores within universe. Factor data: Yahoo Finance + FMP.
          </Text>
        </View>

      </Page>
    </Document>
  );
}

// ── Download button component ─────────────────────────────────────────────────
export default function TearsheetDownloadButton({
  holdings, factorScores, portExposures, currentRegime, computedAt,
}: TearsheetProps) {
  const filename = `crossasset-tearsheet-${new Date().toISOString().slice(0, 10)}.pdf`;
  return (
    <PDFDownloadLink
      document={
        <TearsheetDoc
          holdings={holdings}
          factorScores={factorScores}
          portExposures={portExposures}
          currentRegime={currentRegime}
          computedAt={computedAt}
        />
      }
      fileName={filename}
    >
      {({ loading: pdfLoading }) => (
        <button
          disabled={pdfLoading}
          className="flex items-center gap-2 border border-[#e8e3da] bg-[#fbfaf7] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0c1b38] hover:bg-[#f0ede8] transition-colors disabled:opacity-50"
        >
          {pdfLoading ? "Building PDF…" : "↓ Export PDF"}
        </button>
      )}
    </PDFDownloadLink>
  );
}
