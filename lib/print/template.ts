// CrossAsset luxury print template — self-contained HTML for PDF/Word export.

import type { IssueManifest, ChartSpec } from "@/lib/pipeline/types";

const NAVY = "#0c1b38";
const GOLD = "#b5813c";
const IVORY = "#faf8f4";
const IVORY_D = "#f0ede6";
const TEXT = "#1a1208";
const TEXT_MID = "#3d3528";
const TEXT_LIGHT = "#6b5e4a";
const RULE = "#d6cfc4";

const SERIES_COLORS = ["#0c1b38", "#b5813c", "#5a7a9a", "#2d5016"];

// ─── Inline SVG chart renderer ────────────────────────────────────────────────

type Pt = { date: string; value: number };
type ChartDataMap = Record<string, Record<string, Pt[]>>; // chart_id → series_id → points

function renderInlineSVG(
  seriesMap: Record<string, Pt[]>,
  chartType: string,
  w = 480,
  h = 130
): string {
  const ids = Object.keys(seriesMap).slice(0, 3);
  if (ids.length === 0) return "";

  // Collect all dates across series
  const allDates = Array.from(new Set(ids.flatMap((id) => seriesMap[id].map((p) => p.date)))).sort();
  if (allDates.length < 2) return "";

  // Downsample to ~80 pts
  const step = Math.max(1, Math.floor(allDates.length / 80));
  const dates = allDates.filter((_, i) => i % step === 0 || i === allDates.length - 1);

  // Check if series need normalization (scale differs >10×)
  const ranges = ids.map((id) => {
    const vals = seriesMap[id].map((p) => p.value);
    return vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
  }).filter((r) => r > 0);
  const needsNorm = ranges.length > 1 && Math.max(...ranges) / Math.min(...ranges) > 10;

  // Build display values
  const display: Record<string, number[]> = {};
  for (const id of ids) {
    const raw = seriesMap[id];
    const pts = dates.map((d) => {
      const m = raw.find((p) => p.date <= d);
      return m?.value ?? NaN;
    });
    if (needsNorm) {
      const first = pts.find((v) => !isNaN(v)) ?? 1;
      display[id] = pts.map((v) => isNaN(v) ? NaN : ((v / first - 1) * 100));
    } else {
      display[id] = pts;
    }
  }

  // Global min/max across all series
  const allVals = ids.flatMap((id) => display[id].filter((v) => !isNaN(v)));
  if (allVals.length === 0) return "";
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const vRange = maxV - minV || 1;

  // Padding
  const pl = 38, pr = 8, pt = 8, pb = 22;
  const cw = w - pl - pr;
  const ch = h - pt - pb;

  const toX = (i: number) => pl + (i / (dates.length - 1)) * cw;
  const toY = (v: number) => pt + ch - ((v - minV) / vRange) * ch;

  // Y-axis ticks (4)
  const yTicks = Array.from({ length: 5 }, (_, i) => minV + (vRange * i / 4));
  const yTicksSvg = yTicks.map((v) => {
    const y = toY(v).toFixed(1);
    const label = Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
    return `<line x1="${pl}" y1="${y}" x2="${pl + cw}" y2="${y}" stroke="${RULE}" stroke-width="0.5"/>
<text x="${pl - 3}" y="${(parseFloat(y) + 3).toFixed(1)}" text-anchor="end" font-size="7" fill="${TEXT_LIGHT}" font-family="Inter,sans-serif">${label}</text>`;
  }).join("");

  // X-axis date labels (first and last)
  const xLabels = `
<text x="${pl}" y="${h - 5}" font-size="7" fill="${TEXT_LIGHT}" font-family="Inter,sans-serif">${dates[0]?.slice(0, 7) ?? ""}</text>
<text x="${pl + cw}" y="${h - 5}" text-anchor="end" font-size="7" fill="${TEXT_LIGHT}" font-family="Inter,sans-serif">${dates[dates.length - 1]?.slice(0, 7) ?? ""}</text>`;

  // Series paths / bars
  const seriesSvg = ids.map((id, idx) => {
    const color = SERIES_COLORS[idx] ?? NAVY;
    const pts = display[id];

    if (chartType === "bar") {
      const bw = Math.max(1, cw / dates.length - 1);
      return pts.map((v, i) => {
        if (isNaN(v)) return "";
        const x = toX(i) - bw / 2;
        const y0 = toY(0);
        const y1 = toY(v);
        const barH = Math.abs(y0 - y1);
        return `<rect x="${x.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${bw.toFixed(1)}" height="${barH.toFixed(1)}" fill="${color}" opacity="0.75"/>`;
      }).join("");
    }

    // Line or area
    const validPts = pts.map((v, i) => ({ v, i })).filter((p) => !isNaN(p.v));
    if (validPts.length < 2) return "";
    const d = validPts.map(({ v, i }, j) => `${j === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(" ");

    if (chartType === "area") {
      const first = validPts[0];
      const last = validPts[validPts.length - 1];
      const baseline = toY(Math.max(0, minV)).toFixed(1);
      const areaD = `${d} L ${toX(last.i).toFixed(1)} ${baseline} L ${toX(first.i).toFixed(1)} ${baseline} Z`;
      return `<path d="${areaD}" fill="${color}" opacity="0.12"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`;
    }

    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`;
  }).join("");

  // Legend
  const legend = ids.map((id, idx) => {
    const color = SERIES_COLORS[idx] ?? NAVY;
    const x = pl + idx * 90;
    return `<line x1="${x}" y1="${h + 10}" x2="${x + 14}" y2="${h + 10}" stroke="${color}" stroke-width="1.5"/>
<text x="${x + 18}" y="${h + 13}" font-size="7" fill="${TEXT_LIGHT}" font-family="Inter,sans-serif">${id}</text>`;
  }).join("");

  const normLabel = needsNorm ? `<text x="${pl + cw}" y="${pt - 2}" text-anchor="end" font-size="6.5" fill="${GOLD}" font-family="Inter,sans-serif">% change from start</text>` : "";

  return `<svg viewBox="0 0 ${w} ${h + 20}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-height:${h + 20}px">
  <rect width="${w}" height="${h}" fill="${IVORY}" rx="1"/>
  ${yTicksSvg}
  <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt + ch}" stroke="${RULE}" stroke-width="0.8"/>
  ${seriesSvg}
  ${xLabels}
  ${normLabel}
  ${legend}
</svg>`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const BASE_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'EB Garamond',Georgia,serif;font-size:11.5pt;line-height:1.65;color:${TEXT};background:white}

.page{width:210mm;min-height:297mm;margin:0 auto;position:relative;page-break-after:always;overflow:hidden}

/* ── COVER: uploaded image full-bleed ── */
.cover-img-page{background:#000;display:flex;align-items:stretch;justify-content:center}
.cover-img-page img{width:100%;height:100%;object-fit:cover;object-position:center}
/* Fallback text cover (no image) */
.cover-text{background:${NAVY};color:white;display:flex;flex-direction:column}
.cover-topbar{display:flex;justify-content:space-between;padding:20px 28px 14px;border-bottom:1px solid rgba(255,255,255,.12);font-family:'Inter',sans-serif;font-size:8pt;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.45)}
.cover-logo{display:flex;flex-direction:column;align-items:center;padding:24px 28px 18px;border-bottom:1px solid rgba(255,255,255,.12)}
.cover-masthead{font-family:'EB Garamond',Georgia,serif;font-size:52pt;font-weight:600;letter-spacing:.08em;text-transform:uppercase;line-height:1}
.cover-sub{font-family:'Inter',sans-serif;font-size:7.5pt;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-top:5px}
.cover-body{flex:1;padding:32px 36px}
.cover-label{font-family:'Inter',sans-serif;font-size:7pt;letter-spacing:.25em;text-transform:uppercase;color:${GOLD};margin-bottom:12px}
.cover-title{font-family:'EB Garamond',Georgia,serif;font-size:34pt;font-weight:500;line-height:1.15;color:white;margin-bottom:16px;max-width:80%}
.cover-rule{width:32px;height:2px;background:${GOLD};margin-bottom:16px}
.cover-thesis{font-family:'Inter',sans-serif;font-size:8pt;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5);line-height:1.7;max-width:70%}
.cover-footer{border-top:1px solid rgba(255,255,255,.12);padding:13px 36px;display:flex;justify-content:space-between;font-family:'Inter',sans-serif;font-size:7pt;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.35)}
.cover-footer span.div{color:rgba(255,255,255,.18)}

/* ── INTERIOR ── */
.page-hdr{display:flex;justify-content:space-between;align-items:center;padding:13px 26px;border-bottom:1px solid ${RULE};font-family:'Inter',sans-serif;font-size:7.5pt;letter-spacing:.1em;text-transform:uppercase;color:${TEXT_LIGHT}}
.page-hdr-pub{color:${NAVY};font-weight:600}
.page-hdr-div{color:${RULE}}
.page-num{font-weight:600;color:${NAVY}}
.page-body{padding:24px 26px 48px}
.sec-label{font-family:'Inter',sans-serif;font-size:7pt;letter-spacing:.25em;text-transform:uppercase;color:${GOLD};margin-bottom:9px}
.sec-title{font-family:'EB Garamond',Georgia,serif;font-size:22pt;font-weight:600;line-height:1.15;color:${NAVY};margin-bottom:5px}
.sec-rule{width:26px;height:2px;background:${GOLD};margin:12px 0}
.prose{font-family:'EB Garamond',Georgia,serif;font-size:11pt;line-height:1.7;color:${TEXT};column-count:2;column-gap:20px;column-rule:1px solid ${RULE}}
.prose p{margin-bottom:.85em;text-align:justify;hyphens:auto}
.prose p:first-child::first-letter{font-size:2.8em;font-weight:600;float:left;line-height:.85;margin-right:4px;color:${NAVY}}
.page-ftr{position:absolute;bottom:0;left:0;right:0;padding:9px 26px;border-top:1px solid ${RULE};font-family:'Inter',sans-serif;font-size:7pt;letter-spacing:.08em;color:${TEXT_LIGHT};display:flex;justify-content:space-between}

/* ── CHART BOX ── */
.chart-box{background:white;border:1px solid ${RULE};border-top:2px solid ${NAVY};padding:12px 14px;margin:14px 0;break-inside:avoid;column-span:all}
.chart-title{font-family:'EB Garamond',Georgia,serif;font-size:11pt;font-weight:600;color:${NAVY};margin-bottom:3px}
.chart-sub{font-family:'Inter',sans-serif;font-size:7.5pt;color:${TEXT_LIGHT};margin-bottom:8px}
.chart-src{font-family:'Inter',sans-serif;font-size:6.5pt;color:${TEXT_LIGHT};margin-top:6px;letter-spacing:.05em}

/* ── ILLUSTRATION ── */
.ill-box{margin:14px 0;break-inside:avoid;column-span:all;text-align:center}
.ill-box img{max-width:100%;max-height:220px;object-fit:contain}
.ill-caption{font-family:'Inter',sans-serif;font-size:7pt;color:${TEXT_LIGHT};text-align:center;margin-top:5px;letter-spacing:.08em;text-transform:uppercase}

/* ── WATCHLIST ── */
.watchlist{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:14px;column-span:all}
.wl-head{font-family:'Inter',sans-serif;font-size:6.5pt;letter-spacing:.2em;text-transform:uppercase;color:${NAVY};font-weight:600;border-bottom:1px solid ${RULE};padding-bottom:4px;margin-bottom:7px}
.wl-item{font-size:9.5pt;color:${TEXT_MID};padding:3px 0;border-bottom:1px solid ${IVORY_D};display:flex;gap:5px;line-height:1.4}
.wl-item::before{content:"—";color:${GOLD};flex-shrink:0}

/* ── WEB EXCERPT ── */
.excerpt{background:${NAVY};color:white;padding:18px 22px;margin-top:18px;column-span:all}
.excerpt-lbl{font-family:'Inter',sans-serif;font-size:6.5pt;letter-spacing:.2em;text-transform:uppercase;color:${GOLD};margin-bottom:7px}
.excerpt p{font-size:10.5pt;line-height:1.6;color:rgba(255,255,255,.85);margin:0}

@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{page-break-after:always;width:100%;margin:0}
  .cover-img-page,.cover-text{min-height:100vh}
  @page{margin:0;size:A4}
}
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function proseToParagraphs(prose: string): string {
  return prose.split(/\n+/).filter((s) => s.trim()).map((p) => `<p>${p.trim()}</p>`).join("\n");
}

function pageLabel(page: number): string {
  return ({
    1: "Cover & Executive Thesis", 2: "Macro Regime", 3: "The Research Argument",
    4: "Cross-Asset Transmission", 5: "Market Pricing vs Reality",
    6: "Command Center", 7: "Model Lab & Scenarios", 8: "Signature Chart & Watchlist",
  } as Record<number, string>)[page] ?? `Page ${page}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generatePrintHTML(
  manifest: IssueManifest,
  coverImageUrl?: string,
  illImageUrl?: string,
  chartSpecs?: ChartSpec[],
  chartData?: ChartDataMap
): string {
  const issueNum = (manifest.issue_id?.replace(/[^0-9]/g, "") || "01").padStart(2, "0");
  const cutoff = manifest.cutoff_date
    ? new Date(manifest.cutoff_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";

  // Cover — uploaded image if available, else text cover
  const coverPage = coverImageUrl
    ? `<div class="page cover-img-page"><img src="${coverImageUrl}" alt="Cover"/></div>`
    : `<div class="page cover-text">
        <div class="cover-topbar"><span>Issue ${issueNum}</span><span>✦</span><span>${cutoff}</span></div>
        <div class="cover-logo"><div style="font-size:18pt;opacity:.7;margin-bottom:5px">✦</div><div class="cover-masthead">CrossAsset</div><div class="cover-sub">Macro Intelligence</div></div>
        <div class="cover-body">
          <div class="cover-label">Issue Thesis</div>
          <div class="cover-title">${manifest.title ?? ""}</div>
          <div class="cover-rule"></div>
          <div class="cover-thesis">${manifest.thesis ?? ""}</div>
        </div>
        <div class="cover-footer">
          <span>Rates</span><span class="div">|</span><span>Equities</span><span class="div">|</span>
          <span>Credit</span><span class="div">|</span><span>FX</span><span class="div">|</span><span>Commodities</span>
        </div>
      </div>`;

  // Content pages
  const contentPages = (manifest.pages ?? []).map((section) => {
    // Charts that belong on this page
    const pageCharts = (chartSpecs ?? []).filter((c) => c.page === section.page);
    const chartHtml = pageCharts.map((chart) => {
      const seriesMap = chartData?.[chart.chart_id] ?? {};
      const svgStr = Object.keys(seriesMap).length > 0
        ? renderInlineSVG(seriesMap, chart.chart_type)
        : `<div style="height:60px;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;font-size:8pt;color:${TEXT_LIGHT}">Chart data not available</div>`;
      return `<div class="chart-box">
        <div class="chart-title">${chart.conclusion_title}</div>
        ${chart.subtitle ? `<div class="chart-sub">${chart.subtitle}</div>` : ""}
        ${svgStr}
        <div class="chart-src">Source: FRED · Series: ${chart.series.map((s) => s.id).join(", ")}</div>
      </div>`;
    }).join("");

    // Illustration on page 1
    const illHtml = section.page === 1 && illImageUrl
      ? `<div class="ill-box"><img src="${illImageUrl}" alt="Editorial illustration"/><div class="ill-caption">Editorial Illustration</div></div>`
      : "";

    return `<div class="page interior">
      <div class="page-hdr">
        <div style="display:flex;gap:14px;align-items:center">
          <span class="page-hdr-pub">CrossAsset</span><span class="page-hdr-div">|</span>
          <span>Issue ${issueNum}</span><span class="page-hdr-div">|</span><span>${cutoff}</span>
        </div>
        <span class="page-num">P.${String(section.page).padStart(2, "0")}</span>
      </div>
      <div class="page-body">
        <div class="sec-label">${pageLabel(section.page)}</div>
        <div class="sec-title">${section.title}</div>
        <div class="sec-rule"></div>
        ${illHtml}
        ${chartHtml}
        <div class="prose">${proseToParagraphs(section.prose ?? "")}</div>
      </div>
      <div class="page-ftr">
        <span>${(manifest.thesis ?? "").slice(0, 80)}…</span>
        <span>crossasset.io · Research purposes only</span>
      </div>
    </div>`;
  });

  // Final page — watchlist + web excerpt (no quality score)
  const finalPage = `<div class="page interior">
    <div class="page-hdr">
      <div style="display:flex;gap:14px;align-items:center">
        <span class="page-hdr-pub">CrossAsset</span><span class="page-hdr-div">|</span>
        <span>Issue ${issueNum}</span><span class="page-hdr-div">|</span><span>Watchlist & Outlook</span>
      </div>
      <span class="page-num">Appendix</span>
    </div>
    <div class="page-body">
      <div class="sec-label">Forward-Looking Indicators</div>
      <div class="sec-title">What to Watch, What Would Change Everything</div>
      <div class="sec-rule"></div>
      <div style="column-count:1">
        ${manifest.watchlist ? `
        <div class="watchlist">
          <div>
            <div class="wl-head">Watching</div>
            ${(manifest.watchlist.indicators ?? []).map((i) => `<div class="wl-item">${i}</div>`).join("")}
          </div>
          <div>
            <div class="wl-head">Catalysts</div>
            ${(manifest.watchlist.catalysts ?? []).map((c) => `<div class="wl-item">${c}</div>`).join("")}
          </div>
          <div>
            <div class="wl-head">Next Issue</div>
            <p style="font-size:9.5pt;color:${TEXT_LIGHT};line-height:1.5;font-style:italic;margin-top:4px">${manifest.watchlist.next_issue_question ?? ""}</p>
          </div>
        </div>` : ""}
        ${manifest.web_excerpt ? `
        <div class="excerpt">
          <div class="excerpt-lbl">Web Preview</div>
          <p>${manifest.web_excerpt}</p>
        </div>` : ""}
      </div>
    </div>
  </div>`;

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<title>CrossAsset — Issue ${issueNum}${manifest.title ? ` — ${manifest.title}` : ""}</title>
<style>${BASE_STYLES}</style>
</head><body>
${coverPage}
${contentPages.join("\n")}
${finalPage}
<script>document.fonts.ready.then(function(){setTimeout(function(){window.print();},700)});<\/script>
</body></html>`;
}

export function generateWordHTML(manifest: IssueManifest): string {
  const issueNum = (manifest.issue_id?.replace(/[^0-9]/g, "") || "01").padStart(2, "0");
  const cutoff = manifest.cutoff_date ?? "";
  const pages = (manifest.pages ?? []).map((s) => `
    <h2 style="font-family:Garamond,serif;font-size:16pt;color:${NAVY};border-bottom:1pt solid ${GOLD};padding-bottom:5pt;margin-top:22pt">
      Page ${s.page}: ${s.title}
    </h2>
    ${s.prose.split(/\n+/).filter(Boolean).map((p) => `<p style="font-family:Garamond,serif;font-size:12pt;line-height:1.7;margin-bottom:8pt;text-align:justify">${p}</p>`).join("")}
  `).join("");

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head><meta charset="utf-8"><title>CrossAsset Issue ${issueNum}</title></head>
<body style="font-family:Garamond,serif;margin:2.5cm;color:${TEXT}">
  <p style="font-family:Arial,sans-serif;font-size:8pt;letter-spacing:2pt;text-transform:uppercase;color:${TEXT_LIGHT}">CrossAsset Macro Intelligence — Issue ${issueNum} — ${cutoff}</p>
  <h1 style="font-family:Garamond,serif;font-size:28pt;font-weight:bold;color:${NAVY};margin-top:12pt;line-height:1.2">${manifest.title ?? ""}</h1>
  ${manifest.regime_label ? `<p style="font-family:Arial,sans-serif;font-size:9pt;color:${GOLD};text-transform:uppercase;letter-spacing:1pt;margin-top:6pt">Regime: ${manifest.regime_label}</p>` : ""}
  <p style="font-family:Garamond,serif;font-size:13pt;color:${TEXT_MID};margin-top:10pt;line-height:1.6;border-left:3pt solid ${GOLD};padding-left:12pt">${manifest.thesis ?? ""}</p>
  <hr style="border:none;border-top:1pt solid ${RULE};margin:20pt 0"/>
  ${pages}
  ${manifest.web_excerpt ? `
  <div style="background:${NAVY};padding:18pt;margin-top:24pt">
    <p style="font-family:Arial,sans-serif;font-size:7pt;letter-spacing:2pt;text-transform:uppercase;color:${GOLD};margin-bottom:8pt">Web Preview</p>
    <p style="font-family:Garamond,serif;font-size:12pt;color:rgba(255,255,255,0.85);line-height:1.65;margin:0">${manifest.web_excerpt}</p>
  </div>` : ""}
  <p style="font-family:Arial,sans-serif;font-size:8pt;color:${TEXT_LIGHT};margin-top:20pt">Research purposes only. Not investment advice.</p>
</body></html>`;
}
