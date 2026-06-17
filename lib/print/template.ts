// CrossAsset luxury print template — generates self-contained HTML for PDF/Word export.

import type { IssueManifest } from "@/lib/pipeline/types";

const PALETTE = {
  navy: "#0c1b38",
  navyLight: "#162d5a",
  gold: "#b5813c",
  ivory: "#faf8f4",
  ivoryDark: "#f0ede6",
  text: "#1a1208",
  textMid: "#3d3528",
  textLight: "#6b5e4a",
  rule: "#d6cfc4",
};

const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy: ${PALETTE.navy};
    --gold: ${PALETTE.gold};
    --ivory: ${PALETTE.ivory};
    --text: ${PALETTE.text};
    --rule: ${PALETTE.rule};
  }

  body {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 11.5pt;
    line-height: 1.65;
    color: var(--text);
    background: white;
  }

  /* ── PAGE SHELL ── */
  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    position: relative;
    page-break-after: always;
    overflow: hidden;
  }

  /* ── COVER ── */
  .cover {
    background: var(--navy);
    color: white;
    display: flex;
    flex-direction: column;
    padding: 0;
  }
  .cover-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 22px 28px 0;
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
    border-bottom: 1px solid rgba(255,255,255,0.12);
    padding-bottom: 14px;
  }
  .cover-logo-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 28px 0;
    border-bottom: 1px solid rgba(255,255,255,0.12);
    padding-bottom: 22px;
  }
  .cover-compass {
    font-size: 18pt;
    margin-bottom: 6px;
    opacity: 0.8;
  }
  .cover-masthead {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 52pt;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: white;
    line-height: 1;
  }
  .cover-tagline {
    font-family: 'Inter', sans-serif;
    font-size: 7.5pt;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
    margin-top: 6px;
  }
  .cover-body {
    flex: 1;
    padding: 32px 36px 28px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .cover-thesis-label {
    font-family: 'Inter', sans-serif;
    font-size: 7pt;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: ${PALETTE.gold};
    margin-bottom: 14px;
  }
  .cover-title {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 34pt;
    font-weight: 500;
    line-height: 1.15;
    color: white;
    margin-bottom: 22px;
    max-width: 75%;
  }
  .cover-subtitle {
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.55);
    line-height: 1.7;
    max-width: 65%;
    margin-bottom: 32px;
  }
  .cover-rule {
    width: 36px;
    height: 2px;
    background: ${PALETTE.gold};
    margin-bottom: 22px;
  }
  .cover-image-area {
    width: 200px;
    height: 160px;
    position: absolute;
    bottom: 72px;
    right: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cover-image-area img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .cover-footer {
    border-top: 1px solid rgba(255,255,255,0.12);
    padding: 14px 36px;
    display: flex;
    justify-content: space-between;
    font-family: 'Inter', sans-serif;
    font-size: 7pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
  }
  .cover-footer-divider { color: rgba(255,255,255,0.2); }

  /* ── INTERIOR PAGES ── */
  .interior {
    background: white;
    padding: 0;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 28px;
    border-bottom: 1px solid var(--rule);
    font-family: 'Inter', sans-serif;
    font-size: 7.5pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${PALETTE.textLight};
  }
  .page-header-left { display: flex; gap: 16px; }
  .page-header-pub { color: var(--navy); font-weight: 600; }
  .page-header-divider { color: var(--rule); }
  .page-number {
    font-weight: 600;
    color: var(--navy);
  }
  .page-content {
    padding: 28px 28px 24px;
  }
  .section-label {
    font-family: 'Inter', sans-serif;
    font-size: 7pt;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 10px;
  }
  .section-title {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 24pt;
    font-weight: 600;
    line-height: 1.15;
    color: var(--navy);
    margin-bottom: 6px;
  }
  .section-rule {
    width: 28px;
    height: 2px;
    background: var(--gold);
    margin: 14px 0;
  }
  .section-prose {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 11pt;
    line-height: 1.7;
    color: ${PALETTE.text};
    column-count: 2;
    column-gap: 22px;
    column-rule: 1px solid var(--rule);
  }
  .section-prose p {
    margin-bottom: 0.85em;
    text-align: justify;
    hyphens: auto;
  }
  .section-prose p:first-child::first-letter {
    font-size: 2.8em;
    font-weight: 600;
    float: left;
    line-height: 0.85;
    margin-right: 4px;
    color: var(--navy);
  }
  .page-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 10px 28px;
    border-top: 1px solid var(--rule);
    font-family: 'Inter', sans-serif;
    font-size: 7pt;
    letter-spacing: 0.1em;
    color: ${PALETTE.textLight};
    display: flex;
    justify-content: space-between;
  }

  /* ── PULL QUOTE ── */
  .pull-quote {
    border-left: 3px solid var(--gold);
    padding: 10px 14px;
    margin: 16px 0;
    break-inside: avoid;
    column-span: none;
  }
  .pull-quote p {
    font-style: italic;
    font-size: 12pt;
    color: var(--navy);
    line-height: 1.5;
    margin: 0 !important;
  }

  /* ── DATA TABLE ── */
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-family: 'Inter', sans-serif;
    font-size: 8.5pt;
    break-inside: avoid;
    column-span: all;
  }
  table.data-table thead tr {
    background: var(--navy);
    color: white;
  }
  table.data-table thead th {
    padding: 7px 10px;
    text-align: left;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 7pt;
  }
  table.data-table tbody tr:nth-child(even) { background: ${PALETTE.ivoryDark}; }
  table.data-table tbody td {
    padding: 6px 10px;
    border-bottom: 1px solid var(--rule);
    color: ${PALETTE.textMid};
    vertical-align: top;
  }
  table.data-table tbody td:first-child { font-weight: 500; color: var(--text); }

  /* ── INSIGHT SIDEBAR ── */
  .insights-box {
    background: ${PALETTE.ivory};
    border: 1px solid var(--rule);
    border-top: 3px solid var(--navy);
    padding: 14px 16px;
    margin: 16px 0;
    break-inside: avoid;
  }
  .insights-box-title {
    font-family: 'Inter', sans-serif;
    font-size: 7pt;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--navy);
    font-weight: 600;
    margin-bottom: 10px;
  }
  .insight-item {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 9.5pt;
    line-height: 1.45;
  }
  .insight-label {
    font-family: 'Inter', sans-serif;
    font-size: 6.5pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--gold);
    font-weight: 600;
    white-space: nowrap;
    padding-top: 2px;
    min-width: 52px;
  }

  /* ── WEB EXCERPT ── */
  .web-excerpt {
    background: var(--navy);
    color: white;
    padding: 20px 24px;
    margin-top: 20px;
    border-radius: 2px;
    column-span: all;
  }
  .web-excerpt-label {
    font-family: 'Inter', sans-serif;
    font-size: 6.5pt;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: ${PALETTE.gold};
    margin-bottom: 8px;
  }
  .web-excerpt p {
    font-size: 10.5pt;
    line-height: 1.6;
    color: rgba(255,255,255,0.85);
    margin: 0;
  }

  /* ── WATCHLIST ── */
  .watchlist-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 14px;
    margin-top: 16px;
    column-span: all;
  }
  .watchlist-col-title {
    font-family: 'Inter', sans-serif;
    font-size: 6.5pt;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--navy);
    font-weight: 600;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
  .watchlist-item {
    font-size: 9.5pt;
    color: ${PALETTE.textMid};
    padding: 4px 0;
    border-bottom: 1px solid ${PALETTE.ivoryDark};
    display: flex;
    gap: 6px;
    line-height: 1.4;
  }
  .watchlist-item::before { content: "—"; color: var(--gold); flex-shrink: 0; }

  /* ── QUALITY BADGE ── */
  .quality-score-badge {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    background: var(--navy);
    color: white;
    padding: 12px 18px;
    margin-bottom: 16px;
    column-span: all;
  }
  .quality-score-number {
    font-size: 36pt;
    font-weight: 700;
    line-height: 1;
    font-family: 'Inter', sans-serif;
  }
  .quality-score-label {
    font-family: 'Inter', sans-serif;
    font-size: 6.5pt;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.55);
    margin-top: 3px;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { page-break-after: always; width: 100%; margin: 0; }
    .cover { min-height: 100vh; }
    @page { margin: 0; size: A4; }
  }
`;

function proseToParagraphs(prose: string): string {
  return prose
    .split(/\n+/)
    .filter((s) => s.trim())
    .map((p) => `<p>${p.trim()}</p>`)
    .join("\n");
}

function pageLabel(page: number): string {
  const labels: Record<number, string> = {
    1: "Cover & Executive Thesis",
    2: "Macro Regime",
    3: "The Research Argument",
    4: "Cross-Asset Transmission",
    5: "Market Pricing vs Reality",
    6: "Command Center",
    7: "Model Lab & Scenarios",
    8: "Signature Chart & Watchlist",
  };
  return labels[page] ?? `Page ${page}`;
}

export function generatePrintHTML(
  manifest: IssueManifest,
  coverImageUrl?: string
): string {
  const issueNum = manifest.issue_id?.replace(/[^0-9]/g, "") || "01";
  const cutoff = manifest.cutoff_date
    ? new Date(manifest.cutoff_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";

  // Cover page
  const coverPage = `
<div class="page cover">
  <div class="cover-top-bar">
    <span>Issue ${issueNum.padStart(2, "0")}</span>
    <span>✦</span>
    <span>${cutoff}</span>
  </div>
  <div class="cover-logo-area">
    <div class="cover-compass">✦</div>
    <div class="cover-masthead">CrossAsset</div>
    <div class="cover-tagline">Macro Intelligence</div>
  </div>
  <div class="cover-body">
    <div>
      <div class="cover-thesis-label">Issue Thesis</div>
      <div class="cover-title">${manifest.title ?? ""}</div>
      <div class="cover-rule"></div>
      <div class="cover-subtitle">${manifest.thesis ?? ""}</div>
      ${manifest.regime_label ? `<div style="font-family:'Inter',sans-serif;font-size:7pt;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-top:8px">Regime: ${manifest.regime_label}</div>` : ""}
    </div>
    ${coverImageUrl ? `<div class="cover-image-area"><img src="${coverImageUrl}" alt="Cover illustration" /></div>` : ""}
  </div>
  <div class="cover-footer">
    <span>Rates</span><span class="cover-footer-divider">|</span>
    <span>Equities</span><span class="cover-footer-divider">|</span>
    <span>Credit</span><span class="cover-footer-divider">|</span>
    <span>FX</span><span class="cover-footer-divider">|</span>
    <span>Commodities</span>
  </div>
</div>`;

  // Content pages
  const contentPages = (manifest.pages ?? []).map((section) => {
    const paragraphs = proseToParagraphs(section.prose ?? "");
    return `
<div class="page interior">
  <div class="page-header">
    <div class="page-header-left">
      <span class="page-header-pub">CrossAsset</span>
      <span class="page-header-divider">|</span>
      <span>Issue ${issueNum.padStart(2, "0")}</span>
      <span class="page-header-divider">|</span>
      <span>${cutoff}</span>
    </div>
    <span class="page-number">P.${String(section.page).padStart(2, "0")}</span>
  </div>
  <div class="page-content">
    <div class="section-label">${pageLabel(section.page)}</div>
    <div class="section-title">${section.title}</div>
    <div class="section-rule"></div>
    <div class="section-prose">
      ${paragraphs}
    </div>
  </div>
  <div class="page-footer">
    <span>${manifest.thesis?.slice(0, 80) ?? ""}…</span>
    <span>crossasset.io</span>
  </div>
</div>`;
  });

  // Final page — quality score + watchlist + web excerpt
  const qualityPage = `
<div class="page interior">
  <div class="page-header">
    <div class="page-header-left">
      <span class="page-header-pub">CrossAsset</span>
      <span class="page-header-divider">|</span>
      <span>Issue ${issueNum.padStart(2, "0")}</span>
      <span class="page-header-divider">|</span>
      <span>Editorial Assessment</span>
    </div>
    <span class="page-number">Editorial</span>
  </div>
  <div class="page-content">
    <div class="section-label">Quality Assessment</div>
    <div class="section-title">${manifest.ready_to_publish ? "Issue Cleared for Publication" : "Issue Requires Revision"}</div>
    <div class="section-rule"></div>
    <div style="column-count:2;column-gap:22px;column-rule:1px solid var(--rule)">
      <div class="quality-score-badge" style="column-span:all">
        <div class="quality-score-number" style="color:${(manifest.quality_score ?? 0) >= 85 ? "#4ade80" : "#f87171"}">${manifest.quality_score ?? "–"}</div>
        <div class="quality-score-label">Quality Score · Min 85 to publish</div>
      </div>
      ${manifest.quality_breakdown ? `
      <table class="data-table" style="column-span:all">
        <thead><tr>${Object.keys(manifest.quality_breakdown).map((k) => `<th>${k.replace(/_/g, " ")}</th>`).join("")}</tr></thead>
        <tbody><tr>${Object.values(manifest.quality_breakdown).map((v) => `<td>${v}</td>`).join("")}</tr></tbody>
      </table>` : ""}
      ${manifest.watchlist ? `
      <div class="watchlist-grid" style="column-span:all">
        <div>
          <div class="watchlist-col-title">Watching</div>
          ${(manifest.watchlist.indicators ?? []).map((i) => `<div class="watchlist-item">${i}</div>`).join("")}
        </div>
        <div>
          <div class="watchlist-col-title">Catalysts</div>
          ${(manifest.watchlist.catalysts ?? []).map((c) => `<div class="watchlist-item">${c}</div>`).join("")}
        </div>
        <div>
          <div class="watchlist-col-title">Next Issue</div>
          <div style="font-size:9.5pt;color:#6b5e4a;line-height:1.5;font-style:italic">${manifest.watchlist.next_issue_question ?? ""}</div>
        </div>
      </div>` : ""}
      ${manifest.web_excerpt ? `
      <div class="web-excerpt" style="column-span:all">
        <div class="web-excerpt-label">Web Preview Excerpt</div>
        <p>${manifest.web_excerpt}</p>
      </div>` : ""}
    </div>
  </div>
</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CrossAsset — Issue ${issueNum} — ${manifest.title ?? ""}</title>
<style>${BASE_STYLES}</style>
</head>
<body>
${coverPage}
${contentPages.join("\n")}
${qualityPage}
<script>
  // Load Google Fonts then print
  document.fonts.ready.then(function() {
    setTimeout(function() { window.print(); }, 600);
  });
<\/script>
</body>
</html>`;
}

export function generateWordHTML(manifest: IssueManifest): string {
  const issueNum = manifest.issue_id?.replace(/[^0-9]/g, "") || "01";
  const cutoff = manifest.cutoff_date ?? "";

  const pages = (manifest.pages ?? []).map((s) => `
    <h1 style="font-family:Garamond,serif;font-size:18pt;color:#0c1b38;border-bottom:2pt solid #b5813c;padding-bottom:6pt;margin-top:24pt">
      Page ${s.page}: ${s.title}
    </h1>
    ${s.prose.split(/\n+/).filter(Boolean).map((p) => `<p style="font-family:Garamond,serif;font-size:12pt;line-height:1.7;margin-bottom:8pt;text-align:justify">${p}</p>`).join("")}
  `).join("");

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head><meta charset="utf-8"><title>CrossAsset Issue ${issueNum}</title></head>
<body style="font-family:Garamond,serif;margin:2.5cm;color:#1a1208">
  <p style="font-family:Arial,sans-serif;font-size:8pt;letter-spacing:2pt;text-transform:uppercase;color:#8a7e6c">CrossAsset Macro Intelligence — Issue ${issueNum.padStart(2,"0")} — ${cutoff}</p>
  <h1 style="font-family:Garamond,serif;font-size:28pt;font-weight:bold;color:#0c1b38;margin-top:12pt;line-height:1.2">${manifest.title ?? ""}</h1>
  <p style="font-family:Arial,sans-serif;font-size:9pt;color:#b5813c;text-transform:uppercase;letter-spacing:1pt;margin-top:6pt">Regime: ${manifest.regime_label ?? ""}</p>
  <p style="font-family:Garamond,serif;font-size:13pt;color:#3d3528;margin-top:10pt;line-height:1.6;border-left:3pt solid #b5813c;padding-left:12pt">${manifest.thesis ?? ""}</p>
  <hr style="border:none;border-top:1pt solid #d6cfc4;margin:20pt 0"/>
  ${pages}
  ${manifest.web_excerpt ? `
  <div style="background:#0c1b38;padding:18pt;margin-top:24pt">
    <p style="font-family:Arial,sans-serif;font-size:7pt;letter-spacing:2pt;text-transform:uppercase;color:#b5813c;margin-bottom:8pt">Web Excerpt</p>
    <p style="font-family:Garamond,serif;font-size:12pt;color:rgba(255,255,255,0.85);line-height:1.65;margin:0">${manifest.web_excerpt}</p>
  </div>` : ""}
  <p style="font-family:Arial,sans-serif;font-size:8pt;color:#8a7e6c;margin-top:20pt">Quality Score: ${manifest.quality_score ?? "–"}/100 · Research purposes only. Not investment advice.</p>
</body></html>`;
}
