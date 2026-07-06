import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const {
    ticker, companyName, industry, facts, history,
    quarterlyFacts, quarterlyPeriod, sections, fmpExtended, earningsTranscript,
  } = await req.json() as {
    ticker: string;
    companyName: string;
    industry: string;
    facts: Record<string, number>;
    history: Record<string, Record<string, number>>;
    quarterlyFacts: Record<string, number>;
    quarterlyPeriod: string;
    sections: { item: string; title: string; text: string }[];
    fmpExtended?: Record<string, any>;
    earningsTranscript?: string;
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      'data: {"error":"ANTHROPIC_API_KEY not configured"}\ndata: [DONE]\n\n',
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const f = facts;
  const fmt = (v?: number) =>
    v == null ? "N/A"
    : Math.abs(v) >= 1e12 ? `$${(v / 1e12).toFixed(2)}T`
    : Math.abs(v) >= 1e9  ? `$${(v / 1e9).toFixed(1)}B`
    : Math.abs(v) >= 1e6  ? `$${(v / 1e6).toFixed(0)}M`
    : `$${v.toFixed(2)}`;
  const pct  = (v?: number) => v == null ? "N/A" : `${v.toFixed(1)}%`;
  const x    = (v?: number) => v == null ? "N/A" : `${v.toFixed(1)}x`;
  const num  = (v?: number) => v == null ? "N/A" : v.toLocaleString();

  // Build 5-year tables
  const revYears = Object.keys(history.revenue ?? {}).sort().slice(-5);
  const revTable = revYears.map(y => `FY${y.slice(0,4)}: ${fmt(history.revenue?.[y])}`).join(" | ");
  const niTable  = Object.keys(history.net_income ?? {}).sort().slice(-5).map(y => `FY${y.slice(0,4)}: ${fmt(history.net_income?.[y])}`).join(" | ");
  const cfTable  = Object.keys(history.operating_cf ?? {}).sort().slice(-5).map(y => `FY${y.slice(0,4)}: ${fmt(history.operating_cf?.[y])}`).join(" | ");
  const fcfTable = Object.keys(history.free_cash_flow ?? {}).sort().slice(-5).map(y => `FY${y.slice(0,4)}: ${fmt(history.free_cash_flow?.[y])}`).join(" | ");
  const epsTable = Object.keys(history.eps_diluted ?? {}).sort().slice(-5).map(y => `FY${y.slice(0,4)}: $${(history.eps_diluted?.[y] ?? 0).toFixed(2)}`).join(" | ");

  // Margin history
  const marginHistory = revYears.map(y => {
    const rev = history.revenue?.[y];
    const gp  = history.gross_profit?.[y];
    const oi  = history.operating_income?.[y];
    const ni  = history.net_income?.[y];
    if (!rev) return null;
    return `FY${y.slice(0,4)}: Gross ${gp && rev ? pct(gp/rev*100) : "—"} / Op ${oi && rev ? pct(oi/rev*100) : "—"} / Net ${ni && rev ? pct(ni/rev*100) : "—"}`;
  }).filter(Boolean).join(" | ");

  const getText = (item: string) =>
    sections.find(s => s.item === item)?.text?.slice(0, 6000) ?? "Not available";

  const businessText = getText("business");
  const risksText    = getText("risks");
  const mdaText      = getText("mda");

  const roe    = f.net_income && f.equity ? (f.net_income / f.equity * 100) : null;
  const roa    = f.net_income && f.total_assets ? (f.net_income / f.total_assets * 100) : null;
  const netDebt = f.long_term_debt != null && f.cash != null ? f.long_term_debt - f.cash : null;
  const ocfNiRatio = f.operating_cf && f.net_income ? (f.operating_cf / f.net_income) : null;
  const sbcPct = f.sbc_expense && f.revenue ? (f.sbc_expense / f.revenue * 100) : null;
  const capexPct = f.capex && f.revenue ? (Math.abs(f.capex) / f.revenue * 100) : null;
  const intCov = f.operating_income && f.interest_expense ? (f.operating_income / f.interest_expense) : null;

  const ext = fmpExtended ?? {};

  const buildSegStr = (segObj: any) => {
    if (!segObj?.data) return "N/A";
    const total = Object.values(segObj.data as Record<string,number>).reduce((s:number, v:any) => s + Math.abs(v), 0);
    return Object.entries(segObj.data as Record<string,number>)
      .sort(([,a],[,b]) => Math.abs(b as number) - Math.abs(a as number))
      .map(([k, v]) => `${k}: ${fmt(v as number)} (${total > 0 ? ((Math.abs(v as number)/total)*100).toFixed(0) : 0}%)`)
      .join(", ");
  };

  const segStr = buildSegStr(ext.segments);
  const geoStr = buildSegStr(ext.geo_segments);

  // Segment YoY growth rates from segment_history
  const buildSegGrowthStr = (hist: any[]) => {
    if (!hist || hist.length < 2) return "N/A";
    const sorted = [...hist].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const prior  = sorted[sorted.length - 2];
    const segs   = Object.keys(latest.data ?? {});
    return segs.map(seg => {
      const cur = latest.data[seg];
      const prv = prior.data[seg];
      if (!cur || !prv || prv === 0) return `${seg}: ${fmt(cur)} (prior N/A)`;
      const growth = ((cur - prv) / Math.abs(prv) * 100).toFixed(1);
      const arrow  = cur > prv ? "▲" : "▼";
      return `${seg}: ${fmt(cur)} ${arrow}${growth}% YoY`;
    }).join(" | ") || "N/A";
  };
  const segGrowthStr = buildSegGrowthStr((ext.segment_history as any[]) ?? []);
  const geoGrowthStr = buildSegGrowthStr((ext.geo_segment_history as any[]) ?? []);

  // Quarterly YoY comparison (current vs same Q prior year)
  const qtTrends = (ext.quarterly_trends as any[]) ?? [];
  const qtSorted = [...qtTrends].sort((a:any, b:any) => a.date.localeCompare(b.date));
  const qtYoYStr = (() => {
    if (qtSorted.length < 5) return "N/A";
    const cur  = qtSorted[qtSorted.length - 1];
    const pryr = qtSorted[qtSorted.length - 5];
    if (!cur || !pryr) return "N/A";
    const revYoY  = cur.revenue && pryr.revenue ? ((cur.revenue - pryr.revenue) / Math.abs(pryr.revenue) * 100).toFixed(1) + "%" : "N/A";
    const gmDelta = cur.gross_margin_pct != null && pryr.gross_margin_pct != null ? ((cur.gross_margin_pct - pryr.gross_margin_pct) > 0 ? "+" : "") + (cur.gross_margin_pct - pryr.gross_margin_pct).toFixed(1) + "pp" : "N/A";
    const opDelta = cur.operating_margin_pct != null && pryr.operating_margin_pct != null ? ((cur.operating_margin_pct - pryr.operating_margin_pct) > 0 ? "+" : "") + (cur.operating_margin_pct - pryr.operating_margin_pct).toFixed(1) + "pp" : "N/A";
    const epsYoY  = cur.eps_diluted && pryr.eps_diluted && pryr.eps_diluted !== 0 ? ((cur.eps_diluted - pryr.eps_diluted) / Math.abs(pryr.eps_diluted) * 100).toFixed(1) + "%" : "N/A";
    return `${cur.date?.slice(0,7)}: Rev ${revYoY} YoY | Gross Margin ${gmDelta} YoY | Op Margin ${opDelta} YoY | EPS ${epsYoY} YoY`;
  })();

  const estStr = (ext.analyst_estimates as any[])?.slice(0,3)
    .map((e:any) => `${e.date?.slice(0,7)}: Rev ${fmt(e.rev_avg)}, EPS $${e.eps_avg?.toFixed(2) ?? "N/A"}, EBITDA ${fmt(e.ebitda_avg)}`)
    .join(" | ") ?? "N/A";

  const surpriseStr = (ext.earnings_surprises as any[])?.slice(0,6)
    .map((e:any) => `${e.date?.slice(0,7)}: actual $${e.eps_actual?.toFixed(2) ?? "?"} vs est $${e.eps_est?.toFixed(2) ?? "?"} (${e.surprise_pct != null ? (e.surprise_pct > 0 ? "+" : "") + e.surprise_pct.toFixed(1) + "%" : "?"})`)
    .join("; ") ?? "N/A";

  // Key metrics history (P/E, ROIC over time)
  const kmHistStr = (ext.km_history as any[])?.slice(0,4)
    .map((k:any) => `${k.date?.slice(0,4)}: P/E ${k.pe?.toFixed(1) ?? "—"}x, EV/EBITDA ${k.ev_ebitda?.toFixed(1) ?? "—"}x, ROIC ${k.roic?.toFixed(1) ?? "—"}%`)
    .join(" | ") ?? "N/A";

  // Growth history
  const growthHistStr = (ext.growth_history as any[])?.slice(0,4)
    .map((g:any) => `${g.date?.slice(0,4)}: Rev ${g.rev_growth > 0 ? "+" : ""}${g.rev_growth?.toFixed(1)}%, EPS ${g.eps_growth > 0 ? "+" : ""}${g.eps_growth?.toFixed(1)}%, FCF ${g.fcf_growth > 0 ? "+" : ""}${g.fcf_growth?.toFixed(1)}%`)
    .join(" | ") ?? "N/A";

  // Peer comparison table
  const peerRows = (ext.peer_comparison as any[]) ?? [];
  const peerTable = peerRows.length > 0
    ? "| Ticker | Mkt Cap | Rev Grw | Gross Mgn | P/E | EV/EBITDA | ROIC | Net Margin |\n|--------|---------|---------|-----------|-----|-----------|------|------------|\n" +
      [{ symbol: ticker, market_cap: f.market_cap, rev_growth: f.revenue_growth_yoy, gross_margin: f.gross_margin_pct, pe: f.pe_ratio, ev_ebitda: f.ev_ebitda, roic: f.roic, net_margin: f.net_margin_pct }, ...peerRows]
        .map((p:any) => `| ${p.symbol === ticker ? `**${ticker}**` : p.symbol} | ${p.market_cap ? fmt(p.market_cap) : "—"} | ${p.rev_growth != null ? (p.rev_growth > 0 ? "+" : "") + p.rev_growth.toFixed(1) + "%" : "—"} | ${p.gross_margin != null ? p.gross_margin.toFixed(1)+"%" : "—"} | ${p.pe ? p.pe+"x" : "—"} | ${p.ev_ebitda ? p.ev_ebitda+"x" : "—"} | ${p.roic != null ? p.roic+"%" : "—"} | ${p.net_margin != null ? p.net_margin+"%" : "—"} |`)
        .join("\n")
    : "Peer data not available.";

  // ── News aggregation: prefer news_combined (3-source), fall back to FMP ─────
  const newsItems: Array<{date:string;title:string;summary:string;source:string;stock_change:string|null;category:string}> =
    (ext.news_combined as any[])?.length
      ? (ext.news_combined as any[])
      : ((ext.recent_news as any[])?.map((n:any) => ({
          date: n.date ?? "", title: n.title ?? "", summary: n.summary ?? "",
          source: n.source ?? "", stock_change: null, category: "GENERAL",
        })) ?? []);

  // Group by category
  const newsByCategory: Record<string, typeof newsItems> = {};
  for (const item of newsItems) {
    const cat = (item.category ?? "GENERAL") as string;
    if (!newsByCategory[cat]) newsByCategory[cat] = [];
    newsByCategory[cat].push(item);
  }
  const catOrder = ["EARNINGS","GUIDANCE","ANALYST ACTION","M&A","REGULATORY/LEGAL","MANAGEMENT","CAPITAL ALLOCATION","PRODUCT/BUSINESS","INSIDER ACTIVITY","GENERAL"];

  // Loop 4: Pre-score impact for EVENTS SCORECARD
  const highImpactTerms = ["guidance","cut","raised","beat","miss","ceo","acquisition","sec ","fda","downgrade","upgrade","lawsuit","resign","restatement","warning"];
  const newsWithScores = newsItems.slice(0, 20).map(n => {
    const tl = (n.title ?? "").toLowerCase();
    const hasHighTerm = highImpactTerms.some(t => tl.includes(t));
    const stockStr = n.stock_change ?? "";
    const stockMoveAbs = stockStr ? Math.abs(parseFloat(stockStr.replace("%",""))) : 0;
    const hasStockMove = !isNaN(stockMoveAbs) && stockMoveAbs > 2;
    const impact = hasStockMove ? "HIGH" : hasHighTerm ? "MEDIUM" : "LOW";
    const dir = stockStr.startsWith("+") ? "+" : stockStr.startsWith("-") ? "-" : "";
    return `${impact}${dir} | ${n.date} | [${n.category ?? "GENERAL"}] ${n.title}${n.stock_change ? ` (Stock: ${n.stock_change})` : ""}`;
  });
  const impactSection = newsWithScores.length > 0
    ? `═══════════════════════════════════════════════════════════════\nPRE-SCORED NEWS IMPACT (top 20 — use for EVENTS SCORECARD)\n═══════════════════════════════════════════════════════════════\n${newsWithScores.join("\n")}\n\n`
    : "";

  // 30-day sentiment score
  const now30 = new Date();
  const cutoff30 = new Date(now30.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last30days = newsItems.filter(n => { try { return new Date(n.date) >= cutoff30; } catch { return false; } });
  const negTerms30 = ["cut","miss","decline","drop","fall","concern","probe","loss","lower","warn","disappoint","weak","below","delay"];
  const posTerms30 = ["beat","raise","launch","win","grow","record","strong","exceed","upgrade","positive","accelerat","above","outperform"];
  let sentScore30 = 0;
  for (const n of last30days) {
    const tl = (n.title ?? "").toLowerCase();
    sentScore30 += posTerms30.filter(t => tl.includes(t)).length;
    sentScore30 -= negTerms30.filter(t => tl.includes(t)).length;
  }
  const sentLabel30 = sentScore30 > 3 ? "POSITIVE" : sentScore30 < -3 ? "NEGATIVE" : "MIXED";

  let newsBlock = `═══════════════════════════════════════════════════════════════\nRECENT NEWS & MARKET INTELLIGENCE (${newsItems.length} items | 30-day sentiment: ${sentScore30 > 0 ? "+" : ""}${sentScore30} ${sentLabel30})\n═══════════════════════════════════════════════════════════════\n\n`;
  for (const cat of catOrder) {
    const catItems = newsByCategory[cat];
    if (!catItems?.length) continue;
    newsBlock += `[${cat}]\n`;
    for (const n of catItems.slice(0, cat === "GENERAL" ? 4 : 6)) {
      const change = n.stock_change ? ` | Stock: ${n.stock_change}` : "";
      newsBlock += `• ${n.date} [${n.source}] ${n.title}${change}\n`;
      if (n.summary) newsBlock += `  → ${n.summary}\n`;
    }
    newsBlock += "\n";
  }
  newsBlock += `NEWS ANALYSIS INSTRUCTIONS — MANDATORY (produce in ## NEWS ANALYSIS & MARKET INTELLIGENCE section):

1. EVENTS SCORECARD — Top 5 most material events from pre-scored list above:
   Format each: [IMPACT] [CATEGORY] [DATE] — Headline
   OUR TAKE: 1 sentence on what this changes for the investment thesis.

2. SENTIMENT TRAJECTORY — Name exactly ONE pattern: "Cluster Break" / "Divergence" / "Quiet Period" / "Deterioration" / "Recovery" / "Debate" / "Normal". Then 2 sentences on what this implies for near-term price action.

3. ANALYST POSITIONING — Any rating changes, PT revisions, initiations in last 30 days. Note delta from prior PT if visible in the headline. State explicitly if none found.

4. WHAT'S PRICED IN vs NOT — Based on observed stock reactions to news:
   "The market appears to have priced in: [X]"
   "What appears NOT yet priced in: [Y]"

5. NEAR-TERM CATALYSTS — 3 specific events/dates to watch in next 30-60 days based on patterns in the news.

Every observation must connect directly to the investment thesis or expected stock reaction. No generic news summaries.`;

  // Earnings transcript (truncated) — use more when available from FMP structured transcript
  const transcriptStr = earningsTranscript ? earningsTranscript.slice(0, 8000) : "Not available";

  // Market positioning data
  const week52 = f.week52_high && f.week52_low && f.stock_price
    ? `52W Range: $${f.week52_low.toFixed(2)} – $${f.week52_high.toFixed(2)} | Current: $${f.stock_price.toFixed(2)} (${(((f.stock_price - f.week52_low) / (f.week52_high - f.week52_low)) * 100).toFixed(0)}th percentile of range)`
    : "N/A";
  const shortInterest = f.short_float_pct != null
    ? `Short Interest: ${f.short_float_pct.toFixed(1)}% of float${f.short_ratio != null ? ` | Days to Cover: ${f.short_ratio.toFixed(1)}d` : ""}`
    : "N/A";
  const analystRecStr = (ext as any).analyst_rec
    ? `Analyst Ratings: ${(ext as any).analyst_rec.strong_buy + (ext as any).analyst_rec.buy} Buy / ${(ext as any).analyst_rec.hold} Hold / ${(ext as any).analyst_rec.sell + (ext as any).analyst_rec.strong_sell} Sell (${(ext as any).analyst_rec.total} analysts)`
    : "N/A";
  const insiderStr = (() => {
    const trades = (ext as any).insider_trading as any[] | undefined;
    if (!trades || !trades.length) return "N/A";
    const buys = trades.filter((t:any) => /purchase|buy|acquired/i.test(t.transaction || "")).length;
    const sells = trades.filter((t:any) => /sale|sell|sold|disposed/i.test(t.transaction || "")).length;
    const recent = trades.slice(0, 5).map((t:any) => `${t.name} (${t.title || "?"}) ${t.transaction} $${((t.value || 0) / 1e6).toFixed(1)}M on ${t.date || "?"}`).join("; ");
    return `Net: ${buys} buys / ${sells} sells (last ${trades.length} transactions). Recent: ${recent}`;
  })();

  // Peer median multiples for snapshot table
  const _med = (arr: (number|null)[]) => { const v = arr.filter((x): x is number => x != null).sort((a,b)=>a-b); return v.length ? v[Math.floor(v.length/2)] : null; };
  const peerPeMed = peerRows.length > 0 ? _med(peerRows.map((p:any) => p.pe)) : null;
  const peerEvMed = peerRows.length > 0 ? _med(peerRows.map((p:any) => p.ev_ebitda)) : null;
  const epsSurprises = (ext.earnings_surprises as any[]) ?? [];
  const epsBeats = epsSurprises.filter((e:any) => (e.surprise_pct ?? 0) > 0).length;
  const epsTotal = epsSurprises.length;

  // ── Advanced computed metrics ──────────────────────────────────────────────

  const roicWaccStr = (() => {
    const rows: string[] = [];
    let sumSpread = 0, count = 0;
    for (const yr of revYears) {
      const oi  = history.operating_income?.[yr];
      const ta  = history.total_assets?.[yr];
      const cl  = history.current_liabilities?.[yr];
      const ca  = history.cash?.[yr];
      if (!oi || !ta) continue;
      const nopat = oi * (1 - 0.21);
      const ic = ta - (cl ?? 0) - (ca ?? 0);
      if (!ic || ic <= 0) continue;
      const roicVal = (nopat / ic) * 100;
      const spread  = roicVal - 9;
      sumSpread += spread; count++;
      rows.push(`FY${yr.slice(0,4)}: ROIC ${roicVal.toFixed(1)}% | Spread ${spread >= 0 ? "+" : ""}${spread.toFixed(1)}pp (${spread >= 0 ? "VALUE CREATION" : "VALUE DESTRUCTION"})`);
    }
    const avgSpread = count > 0 ? sumSpread / count : null;
    if (rows.length === 0) return "Insufficient data";
    return rows.join("\n") + (avgSpread != null ? `\nAverage Spread: ${avgSpread >= 0 ? "+" : ""}${avgSpread.toFixed(1)}pp` : "");
  })();

  const wcStr = (() => {
    const ar  = f.accounts_receivable;
    const inv = f.inventory;
    const ap  = f.accounts_payable;
    const rev = f.revenue;
    const cogs = f.revenue && f.gross_profit ? f.revenue - f.gross_profit : null;
    const dso = ar && rev ? ar / rev * 365 : null;
    const dio = inv && cogs ? inv / cogs * 365 : null;
    const dpo = ap && cogs ? ap / cogs * 365 : null;
    const ccc = dso != null && dio != null && dpo != null ? dso + dio - dpo : null;
    return `DSO: ${dso != null ? dso.toFixed(0)+"d" : "N/A"} | DIO: ${dio != null ? dio.toFixed(0)+"d" : "N/A"} | DPO: ${dpo != null ? dpo.toFixed(0)+"d" : "N/A"} | CCC: ${ccc != null ? ccc.toFixed(0)+"d" : "N/A"}`;
  })();

  const earningsQualityStr = (() => {
    const ni = f.net_income, ocf = f.operating_cf, ta = f.total_assets;
    const shares = f.shares_diluted_wtd;
    const accrual = ni != null && ocf != null && ta ? ((ni - ocf) / ta * 100) : null;
    const cashEps = ocf && shares ? ocf / shares : null;
    const repEps  = f.eps_diluted;
    const gap = cashEps && repEps ? (cashEps - repEps) / Math.abs(repEps) * 100 : null;
    const quality = accrual != null ? (Math.abs(accrual) < 2 ? "HIGH QUALITY" : Math.abs(accrual) < 5 ? "MODERATE" : "ELEVATED ACCRUALS") : "";
    return [
      `Accrual Ratio: ${accrual != null ? (accrual >= 0 ? "+" : "") + accrual.toFixed(1) + "% of assets" : "N/A"} ${quality}`,
      `Cash EPS: ${cashEps != null ? "$"+cashEps.toFixed(2) : "N/A"} vs Reported EPS: ${repEps != null ? "$"+repEps.toFixed(2) : "N/A"}${gap != null ? ` (gap: ${gap >= 0 ? "+" : ""}${gap.toFixed(1)}%)` : ""}`,
    ].join("\n");
  })();

  const dolStr = (() => {
    const sortedYrs = [...revYears].sort();
    const rows: string[] = [];
    for (let i = 1; i < sortedYrs.length; i++) {
      const cy = sortedYrs[i], py = sortedYrs[i-1];
      const cr = history.revenue?.[cy], pr = history.revenue?.[py];
      const co = history.operating_income?.[cy], po = history.operating_income?.[py];
      if (!cr || !pr || !co || !po || pr === 0 || po === 0) continue;
      const dRev = (cr - pr) / Math.abs(pr) * 100;
      const dOI  = (co - po) / Math.abs(po) * 100;
      if (Math.abs(dRev) < 0.1) continue;
      const dol  = dOI / dRev;
      const incM = cr - pr !== 0 ? (co - po) / (cr - pr) * 100 : null;
      rows.push(`FY${cy.slice(0,4)}: DOL ${dol.toFixed(1)}x | Rev ${dRev >= 0 ? "+" : ""}${dRev.toFixed(1)}% → OI ${dOI >= 0 ? "+" : ""}${dOI.toFixed(1)}%${incM != null ? ` | Incr. EBIT Margin: ${incM.toFixed(1)}%` : ""}`);
    }
    return rows.length > 0 ? rows.slice(-3).join("\n") : "Insufficient data";
  })();

  const marginBridgeStr = (() => {
    const sortedYrs = [...revYears].sort();
    if (sortedYrs.length < 2) return "Insufficient data";
    const cy = sortedYrs[sortedYrs.length - 1];
    const py = sortedYrs[sortedYrs.length - 2];
    const cr = history.revenue?.[cy], pr = history.revenue?.[py];
    if (!cr || !pr) return "N/A";
    const gmEff  = history.gross_profit?.[cy] && history.gross_profit?.[py] ? ((history.gross_profit[cy]!/cr - history.gross_profit[py]!/pr) * 100) : null;
    const sgaEff = history.sga_expense?.[cy] && history.sga_expense?.[py] ? ((history.sga_expense[py]!/pr - history.sga_expense[cy]!/cr) * 100) : null;
    const rdEff  = history.rd_expense?.[cy] && history.rd_expense?.[py] ? ((history.rd_expense[py]!/pr - history.rd_expense[cy]!/cr) * 100) : null;
    const oiEff  = history.operating_income?.[cy] && history.operating_income?.[py] ? ((history.operating_income[cy]!/cr - history.operating_income[py]!/pr) * 100) : null;
    const parts: string[] = [`FY${py.slice(0,4)}→FY${cy.slice(0,4)}:`];
    if (gmEff  != null) parts.push(`GM effect ${gmEff  >= 0 ? "+" : ""}${gmEff.toFixed(1)}pp`);
    if (sgaEff != null) parts.push(`SGA leverage ${sgaEff >= 0 ? "+" : ""}${sgaEff.toFixed(1)}pp`);
    if (rdEff  != null) parts.push(`R&D effect ${rdEff >= 0 ? "+" : ""}${rdEff.toFixed(1)}pp`);
    if (oiEff  != null) parts.push(`= Total op. margin ${oiEff >= 0 ? "+" : ""}${oiEff.toFixed(1)}pp`);
    return parts.join(" | ");
  })();

  const fcfYieldVsRfStr = (() => {
    const fcv = f.free_cash_flow, mc = f.market_cap;
    if (!fcv || !mc || mc === 0) return "N/A";
    const yld = fcv / mc * 100;
    const erp = yld - 3.5;
    return `FCF Yield: ${yld.toFixed(1)}% vs 3.5% Risk-Free → Equity Risk Premium: ${erp >= 0 ? "+" : ""}${erp.toFixed(1)}pp (${erp > 3 ? "ATTRACTIVE" : erp > 0 ? "FAIR VALUE" : "EXPENSIVE vs RISK-FREE"})`;
  })();

  const beatAnalysisStr = (() => {
    const surp = (ext.earnings_surprises as any[]) ?? [];
    if (surp.length === 0) return "N/A";
    const sorted2 = [...surp].sort((a,b) => (a.date ?? "").localeCompare(b.date ?? ""));
    const beats2  = sorted2.filter((e:any) => (e.surprise_pct ?? 0) > 0);
    const beatRate2 = beats2.length / sorted2.length * 100;
    const avgMag2   = beats2.length > 0 ? beats2.reduce((s:number,e:any) => s + (e.surprise_pct ?? 0), 0) / beats2.length : 0;
    const mid2 = Math.floor(sorted2.length / 2);
    const firstAvg2  = sorted2.slice(0, mid2).reduce((s:number,e:any) => s + (e.surprise_pct ?? 0), 0) / Math.max(mid2, 1);
    const secondAvg2 = sorted2.slice(mid2).reduce((s:number,e:any) => s + (e.surprise_pct ?? 0), 0) / Math.max(sorted2.length - mid2, 1);
    const trend2 = secondAvg2 > firstAvg2 + 1 ? "EXPANDING" : secondAvg2 < firstAvg2 - 1 ? "SHRINKING" : "STABLE";
    const rev3 = [...sorted2].reverse();
    const lastDir2 = (rev3[0]?.surprise_pct ?? 0) > 0 ? "beat" : "miss";
    let streak2 = 0;
    for (const e of rev3) { if (lastDir2 === "beat" && (e.surprise_pct ?? 0) > 0) streak2++; else if (lastDir2 === "miss" && (e.surprise_pct ?? 0) <= 0) streak2++; else break; }
    return `Beat Rate: ${beats2.length}/${sorted2.length} (${beatRate2.toFixed(0)}%) | Avg Magnitude: +${avgMag2.toFixed(1)}% | ${streak2}-quarter ${lastDir2} streak | Trend: ${trend2} (early avg ${firstAvg2.toFixed(1)}% → recent avg ${secondAvg2.toFixed(1)}%)`;
  })();

  const piotroskiStr = (() => {
    const sortedYrs3 = [...revYears].sort();
    if (sortedYrs3.length < 2) return "Insufficient data";
    const cy = sortedYrs3[sortedYrs3.length - 1];
    const py = sortedYrs3[sortedYrs3.length - 2];
    let score = 0; const factors: string[] = [];
    const curTA3 = history.total_assets?.[cy], prvTA3 = history.total_assets?.[py];
    const curNI3 = history.net_income?.[cy],   prvNI3 = history.net_income?.[py];
    const curOCF3 = history.operating_cf?.[cy];
    const curRev3 = history.revenue?.[cy],    prvRev3 = history.revenue?.[py];
    const curGP3 = history.gross_profit?.[cy], prvGP3 = history.gross_profit?.[py];
    const curLTD3 = history.long_term_debt?.[cy], prvLTD3 = history.long_term_debt?.[py];
    const curCA3 = history.current_assets?.[cy],  prvCA3 = history.current_assets?.[py];
    const curCL3 = history.current_liabilities?.[cy], prvCL3 = history.current_liabilities?.[py];
    if (curNI3 != null && curTA3 && curTA3 > 0) { curNI3/curTA3 > 0 ? (score++, factors.push("ROA+ ✓")) : factors.push("ROA+ ✗"); }
    if (curOCF3 != null) { curOCF3 > 0 ? (score++, factors.push("OCF+ ✓")) : factors.push("OCF+ ✗"); }
    if (curNI3 != null && curTA3 && prvNI3 != null && prvTA3) { curNI3/curTA3 > prvNI3/prvTA3 ? (score++, factors.push("ΔROA+ ✓")) : factors.push("ΔROA+ ✗"); }
    if (curOCF3 != null && curNI3 && curNI3 > 0) { curOCF3/curNI3 > 1 ? (score++, factors.push("OCF>NI ✓")) : factors.push("OCF>NI ✗"); }
    if (curLTD3 != null && prvLTD3 != null && curTA3 && prvTA3) { curLTD3/curTA3 < prvLTD3/prvTA3 ? (score++, factors.push("Lev↓ ✓")) : factors.push("Lev↓ ✗"); }
    if (curCA3 != null && curCL3 && prvCA3 != null && prvCL3) { curCA3/curCL3 > prvCA3/prvCL3 ? (score++, factors.push("CurrRatio↑ ✓")) : factors.push("CurrRatio↑ ✗"); }
    if (curGP3 != null && curRev3 && prvGP3 != null && prvRev3) { curGP3/curRev3 > prvGP3/prvRev3 ? (score++, factors.push("GrossM↑ ✓")) : factors.push("GrossM↑ ✗"); }
    if (curRev3 != null && curTA3 && prvRev3 != null && prvTA3) { curRev3/curTA3 > prvRev3/prvTA3 ? (score++, factors.push("AssetTurn↑ ✓")) : factors.push("AssetTurn↑ ✗"); }
    const label3 = score >= 7 ? "STRONG" : score >= 5 ? "MODERATE" : score >= 3 ? "WEAK" : "DISTRESSED SIGNALS";
    return `Score: ${score}/8 (${label3}) | ${factors.join(", ")}`;
  })();

  const seasonalityStr = (() => {
    const qt3 = (ext.quarterly_trends as any[]) ?? [];
    if (qt3.length < 4) return "N/A";
    const byQ2: Record<string, number[]> = { Q1: [], Q2: [], Q3: [], Q4: [] };
    for (const q of qt3) {
      const month3 = parseInt((q.date ?? "").slice(5,7) || "0");
      const qL = month3 <= 3 ? "Q1" : month3 <= 6 ? "Q2" : month3 <= 9 ? "Q3" : "Q4";
      if (q.revenue != null) byQ2[qL].push(q.revenue);
    }
    const avgQ2: Record<string, number | null> = {};
    for (const [q, vals] of Object.entries(byQ2)) avgQ2[q] = vals.length > 0 ? vals.reduce((s,v) => s+v,0)/vals.length : null;
    const validQ2 = Object.entries(avgQ2).filter(([,v]) => v != null) as [string,number][];
    if (validQ2.length === 0) return "N/A";
    validQ2.sort(([,a],[,b]) => b-a);
    const fs = (v: number) => Math.abs(v) >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`;
    return `Peak: ${validQ2[0][0]} (avg ${fs(validQ2[0][1])}) | Trough: ${validQ2[validQ2.length-1][0]} (avg ${fs(validQ2[validQ2.length-1][1])})\n` +
      ["Q1","Q2","Q3","Q4"].map(q => avgQ2[q] != null ? `${q}: ${fs(avgQ2[q]!)}` : `${q}: N/A`).join(" | ");
  })();

  const debtPaydownStr = (() => {
    const fcv2 = f.free_cash_flow;
    if (netDebt == null || fcv2 == null) return "N/A";
    if (netDebt <= 0) return `Net Cash Position: ${fmt(Math.abs(netDebt))} — balance sheet fortress`;
    if (fcv2 <= 0) return `Net Debt: ${fmt(netDebt)} — negative FCF, leverage rising`;
    const yrs = netDebt / fcv2;
    return `Net Debt: ${fmt(netDebt)} | FCF: ${fmt(fcv2)}/yr → Full paydown in ${yrs.toFixed(1)} years${yrs < 2 ? " (AGGRESSIVE)" : yrs < 4 ? " (MANAGEABLE)" : " (ELEVATED)"}`;
  })();

  const rule40Str = (() => {
    const rg = f.revenue_growth_yoy;
    const fm = f.free_cash_flow && f.revenue ? f.free_cash_flow / f.revenue * 100 : null;
    if (rg == null && fm == null) return "N/A";
    const r40 = (rg ?? 0) + (fm ?? 0);
    return `Rule of 40: ${(rg ?? 0).toFixed(1)}% + ${(fm ?? 0).toFixed(1)}% FCF margin = ${r40.toFixed(1)}${r40 >= 40 ? " ✓ (ELITE)" : r40 >= 30 ? " (APPROACHING)" : " ✗ (BELOW 40)"}`;
  })();

  const sectorCtxStr = (() => {
    const s = (ext.sector ?? ext.fmp_industry ?? industry ?? "").toLowerCase();
    const ind = (ext.fmp_industry ?? industry ?? "").toLowerCase();
    const isSemi = s.includes("semi") || ind.includes("semi") || ind.includes("storage") || ind.includes("memory") || ind.includes("nand") || ind.includes("dram");
    const isSaas = ind.includes("saas") || ind.includes("software") || s.includes("software");
    const isHardware = ind.includes("hardware") || ind.includes("networking") || ind.includes("storage device") || ind.includes("electronic");
    const isAd = ind.includes("internet") || ind.includes("social") || ind.includes("digital media") || ind.includes("advertising");

    if (isSemi)
      return `Semiconductor/memory sector frame. Key metrics: ASP trends ($/GB for NAND/DRAM or $/unit for logic), fab utilization %, inventory levels across supply chain, gross margin sensitivity to pricing vs volume, capex intensity (${capexPct ? pct(capexPct) : "N/A"} of rev). Current cycle position: is the industry in oversupply correction, bottom, recovery, or peak? Vocabulary: ASP, wafer starts, fab utilization, bit growth, inventory correction, pricing power, technology node, HBM/DDR5/QLC migration. ROIC is highly cyclical — assess trough vs. peak ROIC separately.`;
    if (isSaas)
      return `Software/SaaS sector frame. Key metrics: ${rule40Str}, NRR/NDR implied by revenue growth vs. net new ARR, SBC dilution (${sbcPct ? pct(sbcPct) : "N/A"} of rev), CAC payback period. Use ARR/NRR/churn/seat expansion vocabulary. Gross margin (${pct(f.gross_margin_pct)}) determines long-run FCF potential — focus on gross margin durability vs. competition.`;
    if (isHardware)
      return `Hardware sector frame. Key metrics: unit volumes × ASP = revenue, gross margin per unit (${pct(f.gross_margin_pct)}), refresh cycle timing, market share vs. Gartner/IDC data, capex intensity (${capexPct ? pct(capexPct) : "N/A"} of rev). Vocabulary: attach rate, form factor transitions, refresh cycle, competitive displacement, component pricing. R&D efficiency matters: R&D ${f.rd_expense && f.revenue ? (f.rd_expense/f.revenue*100).toFixed(1)+"%" : "N/A"} of rev.`;
    if (isAd)
      return `Digital advertising/internet sector frame. Key metrics: DAU/MAU engagement trends, ARPU trajectory, CPM/CPC pricing dynamics, time-on-platform vs. competition, operating leverage (${rule40Str}). Vocabulary: impressions, click-through, ARPU, engagement, ad load, brand vs. performance advertising, cookie deprecation. SBC dilution (${sbcPct ? pct(sbcPct) : "N/A"}) is especially relevant.`;
    if (s.includes("tech") || s.includes("hardware"))
      return `Technology sector frame. Key metrics: R&D% of revenue (${f.rd_expense && f.revenue ? (f.rd_expense/f.revenue*100).toFixed(1)+"%" : "N/A"}), SBC dilution (${sbcPct ? pct(sbcPct) : "N/A"}), ${rule40Str}. Emphasize durable revenue quality vs. near-term earnings optics.`;
    if (s.includes("health") || s.includes("pharma") || s.includes("bio"))
      return `Healthcare sector frame. Key metrics: gross margin vs peers (${pct(f.gross_margin_pct)}), R&D pipeline economics (R&D ${f.rd_expense && f.revenue ? (f.rd_expense/f.revenue*100).toFixed(1)+"%" : "N/A"} of rev), regulatory/reimbursement risk. Use clinical stage/approval/net pricing vocabulary.`;
    if (s.includes("consumer") || s.includes("retail"))
      return `Consumer sector frame. Key metrics: same-store sales, gross margin (${pct(f.gross_margin_pct)}), SGA leverage (${f.sga_expense && f.revenue ? (f.sga_expense/f.revenue*100).toFixed(1)+"%" : "N/A"} of rev). Use comp/traffic/ticket/loyalty vocabulary.`;
    if (s.includes("financ") || s.includes("bank") || s.includes("insur"))
      return `Financial sector frame. Key metrics: ROE vs cost of equity (ROE: ${roe != null ? pct(roe) : "N/A"}), credit quality, fee income diversification. Use NIM/credit loss/capital ratio vocabulary.`;
    if (s.includes("energy") || s.includes("oil") || s.includes("gas"))
      return `Energy sector frame. Key metrics: reserve replacement, cash breakeven, capex intensity (${capexPct ? pct(capexPct) : "N/A"} of rev). Analyze FCF at multiple commodity price scenarios. Use reserves/production/breakeven/NAV vocabulary.`;
    return `Cross-sector frame. Focus on ROIC vs cost of capital (ROIC: ${f.roic != null ? pct(f.roic) : "N/A"} vs WACC ~9%), FCF conversion quality (OCF/NI: ${ocfNiRatio ? ocfNiRatio.toFixed(2)+"x" : "N/A"}), and capital allocation discipline.`;
  })();

  const prompt = `You are a senior equity research analyst at Edgewood Management, an elite institutional asset manager. You are writing an institutional-grade company primer for ${companyName} (${ticker}). This document will be read by portfolio managers, CIOs, and institutional investors. It must match Goldman Sachs / Morgan Stanley research quality.

═══════════════════════════════════════════════════════════════
COMPANY PROFILE
═══════════════════════════════════════════════════════════════
CEO: ${ext.ceo ?? "N/A"} | Sector: ${ext.sector ?? "N/A"} | Industry: ${ext.fmp_industry ?? industry}
Country: ${ext.country ?? "N/A"} | Exchange: ${ext.exchange ?? "N/A"} | IPO: ${ext.ipo_date ?? "N/A"}
Employees: ${f.employees != null ? num(f.employees) : "N/A"} | Website: ${ext.website ?? "N/A"}
Market Cap: ${fmt(f.market_cap)} | Enterprise Value: ${fmt(f.enterprise_value)} | Beta: ${f.beta != null ? f.beta.toFixed(2) : "N/A"}
${week52}
${shortInterest}
${analystRecStr}
PT Consensus: ${f.pt_consensus != null ? `$${f.pt_consensus.toFixed(0)} (${f.pt_low != null ? `range $${f.pt_low.toFixed(0)}–$${f.pt_high?.toFixed(0)}` : "high/low N/A"})` : "N/A"}

${ext.company_description ? `COMPANY DESCRIPTION: ${ext.company_description.slice(0, 500)}` : ""}

═══════════════════════════════════════════════════════════════
INCOME STATEMENT (MOST RECENT ANNUAL)
═══════════════════════════════════════════════════════════════
Revenue: ${fmt(f.revenue)} | Gross Profit: ${fmt(f.gross_profit)} | Gross Margin: ${pct(f.gross_margin_pct)}
R&D: ${fmt(f.rd_expense)} (${f.rd_expense && f.revenue ? pct(f.rd_expense/f.revenue*100) : "N/A"} of Rev) | SG&A: ${fmt(f.sga_expense)}
Operating Income: ${fmt(f.operating_income)} | Op Margin: ${pct(f.operating_margin_pct)}
EBITDA: ${fmt(f.ebitda)} | D&A: ${fmt(f.da_expense)}
Interest Expense: ${fmt(f.interest_expense)} | Interest Coverage: ${intCov ? intCov.toFixed(1)+"x" : "N/A"}
Pretax Income: ${fmt(f.pretax_income)} | Tax Rate: ${pct(f.effective_tax_rate)}
Net Income: ${fmt(f.net_income)} | Net Margin: ${pct(f.net_margin_pct)}
EPS Diluted: ${f.eps_diluted != null ? `$${f.eps_diluted.toFixed(2)}` : "N/A"} | EPS Basic: ${f.eps_basic != null ? `$${f.eps_basic.toFixed(2)}` : "N/A"}
Diluted Shares: ${f.shares_diluted_wtd != null ? fmt(f.shares_diluted_wtd) : "N/A"}

═══════════════════════════════════════════════════════════════
BALANCE SHEET
═══════════════════════════════════════════════════════════════
Cash & Equivalents: ${fmt(f.cash)} | Short-Term Investments: ${fmt(f.short_term_investments)}
Accounts Receivable: ${fmt(f.accounts_receivable)} | Inventory: ${fmt(f.inventory)}
Current Assets: ${fmt(f.current_assets)} | PPE (net): ${fmt(f.ppe_net)}
Goodwill: ${fmt(f.goodwill)} | Intangibles: ${fmt(f.intangibles)}
Total Assets: ${fmt(f.total_assets)}
Accounts Payable: ${fmt(f.accounts_payable)} | Current Liabilities: ${fmt(f.current_liabilities)}
Long-Term Debt: ${fmt(f.long_term_debt)} | Net Debt: ${netDebt != null ? fmt(netDebt) : "N/A"}
Total Liabilities: ${fmt(f.total_liabilities)} | Equity: ${fmt(f.equity)}
Retained Earnings: ${fmt(f.retained_earnings)}

═══════════════════════════════════════════════════════════════
CASH FLOW STATEMENT
═══════════════════════════════════════════════════════════════
Operating CF: ${fmt(f.operating_cf)} | CapEx: ${fmt(f.capex)} (${capexPct ? pct(capexPct) : "N/A"} of Rev)
Free Cash Flow: ${fmt(f.free_cash_flow)} | FCF Margin: ${f.free_cash_flow && f.revenue ? pct(f.free_cash_flow/f.revenue*100) : "N/A"}
SBC: ${fmt(f.sbc_expense)} (${sbcPct ? pct(sbcPct) : "N/A"} of Rev) | D&A: ${fmt(f.da_expense)}
Buybacks: ${fmt(f.buybacks)} | Dividends Paid: ${fmt(f.dividends_paid)}
Cash Quality (OCF/NI): ${ocfNiRatio ? ocfNiRatio.toFixed(2)+"x" : "N/A"}

═══════════════════════════════════════════════════════════════
RETURNS & EFFICIENCY
═══════════════════════════════════════════════════════════════
ROE: ${roe != null ? pct(roe) : "N/A"} | ROA: ${roa != null ? pct(roa) : "N/A"} | ROIC: ${f.roic != null ? pct(f.roic) : "N/A"}
Current Ratio: ${x(f.current_ratio)} | Debt/Equity: ${x(f.debt_to_equity)}
Dividend Yield: ${pct(f.dividend_yield)} | FCF Yield: ${pct(f.fcf_yield)}

═══════════════════════════════════════════════════════════════
VALUATION MULTIPLES
═══════════════════════════════════════════════════════════════
P/E: ${x(f.pe_ratio)} | EV/EBITDA: ${x(f.ev_ebitda)} | P/FCF: ${x(f.p_fcf)}
P/Sales: ${x(f.p_sales)} | P/Book: ${x(f.p_book)} | EV/Revenue: ${x(f.ev_revenue)}

HISTORICAL VALUATION TREND:
${kmHistStr}

═══════════════════════════════════════════════════════════════
GROWTH PROFILE
═══════════════════════════════════════════════════════════════
YoY Growth (most recent): Revenue ${f.revenue_growth_yoy != null ? pct(f.revenue_growth_yoy) : "N/A"} | EPS ${f.eps_growth_yoy != null ? pct(f.eps_growth_yoy) : "N/A"} | FCF ${f.fcf_growth_yoy != null ? pct(f.fcf_growth_yoy) : "N/A"} | Net Income ${f.ni_growth_yoy != null ? pct(f.ni_growth_yoy) : "N/A"}

HISTORICAL GROWTH RATES:
${growthHistStr}

5-YEAR REVENUE TREND: ${revTable || "N/A"}
5-YEAR NET INCOME:    ${niTable || "N/A"}
5-YEAR OPERATING CF:  ${cfTable || "N/A"}
5-YEAR FREE CASH FLOW:${fcfTable || "N/A"}
5-YEAR EPS DILUTED:   ${epsTable || "N/A"}

5-YEAR MARGIN EVOLUTION:
${marginHistory || "N/A"}

═══════════════════════════════════════════════════════════════
MOST RECENT QUARTER (${quarterlyPeriod})
═══════════════════════════════════════════════════════════════
Revenue: ${fmt(quarterlyFacts.revenue)} | Gross Margin: ${pct(quarterlyFacts.gross_margin_pct)} | Op Margin: ${pct(quarterlyFacts.operating_margin_pct)} | Net Margin: ${pct(quarterlyFacts.net_margin_pct)}
Net Income: ${fmt(quarterlyFacts.net_income)} | EPS: ${quarterlyFacts.eps_diluted != null ? `$${quarterlyFacts.eps_diluted.toFixed(2)}` : "N/A"} | FCF: ${fmt(quarterlyFacts.free_cash_flow)}
YoY Change vs Same Quarter Prior Year: ${qtYoYStr}

═══════════════════════════════════════════════════════════════
ANALYST CONSENSUS
═══════════════════════════════════════════════════════════════
FMP Rating: ${ext.fmp_rating ?? "N/A"} | Price Target: ${f.pt_consensus != null ? fmt(f.pt_consensus) : "N/A"} | # Analysts: ${f.num_analysts != null ? f.num_analysts.toFixed(0) : "N/A"}
Forward Estimates: ${estStr}
EPS Surprise History (last 6Q): ${surpriseStr}

═══════════════════════════════════════════════════════════════
REVENUE SEGMENTS (latest annual + YoY growth)
═══════════════════════════════════════════════════════════════
Business Segments (latest): ${segStr}
Business Segments (YoY growth): ${segGrowthStr}
Geographic Breakdown (latest): ${geoStr}
Geographic Breakdown (YoY growth): ${geoGrowthStr}

═══════════════════════════════════════════════════════════════
PEER COMPARISON
═══════════════════════════════════════════════════════════════
${peerTable}

${impactSection}${newsBlock}

═══════════════════════════════════════════════════════════════
INSIDER TRADING ACTIVITY (Form 4)
═══════════════════════════════════════════════════════════════
${insiderStr}

═══════════════════════════════════════════════════════════════
EARNINGS CALL / MOST RECENT 8-K FILING
═══════════════════════════════════════════════════════════════
${transcriptStr}

═══════════════════════════════════════════════════════════════
10-K BUSINESS SECTION (Item 1)
═══════════════════════════════════════════════════════════════
${businessText}

═══════════════════════════════════════════════════════════════
10-K RISK FACTORS (Item 1A)
═══════════════════════════════════════════════════════════════
${risksText}

═══════════════════════════════════════════════════════════════
10-K MD&A (Item 7)
═══════════════════════════════════════════════════════════════
${mdaText}

═══════════════════════════════════════════════════════════════
COMPUTED ADVANCED METRICS (incorporate these directly in analysis)
═══════════════════════════════════════════════════════════════

ROIC vs WACC (9% assumed) — 5-Year History:
${roicWaccStr}

WORKING CAPITAL EFFICIENCY:
${wcStr}

EARNINGS QUALITY:
${earningsQualityStr}

DEGREE OF OPERATING LEVERAGE:
${dolStr}

MARGIN BRIDGE (latest YoY):
${marginBridgeStr}

FCF YIELD vs RISK-FREE (3.5%):
${fcfYieldVsRfStr}

EPS BEAT ANALYSIS:
${beatAnalysisStr}

PIOTROSKI F-SCORE:
${piotroskiStr}

REVENUE SEASONALITY:
${seasonalityStr}

NET DEBT PAYDOWN:
${debtPaydownStr}

═══════════════════════════════════════════════════════════════
SECTOR-SPECIFIC CONTEXT: ${ext.sector ?? industry}
═══════════════════════════════════════════════════════════════
${sectorCtxStr}

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

MANDATORY PROSE RULES — VIOLATIONS MAKE THIS PRIMER UNUSABLE:

VOICE & TONE:
• Write as a Managing Director who has covered this sector for 10 years and has a strong view. You have seen this cycle before.
• Use active voice always: "Management destroyed value" not "Value was destroyed by management"
• Have a clear opinion: "This is a structurally broken business model at current prices" not "there are risks to consider"
• Vary sentence length aggressively: one sharp punchy sentence. Then a longer, clause-heavy analytical sentence that unpacks the mechanism. Then another short punch.
• Lead with the conclusion, not the setup. Analysts don't explain what revenue is — they argue about whether the growth is real.

SPECIFICITY (non-negotiable):
• Every paragraph must contain at least one specific dollar amount, percentage, or date from the data provided
• Never say "the company" when you can say ${companyName} or a specific product/segment name from the data
• Never say "significant" — write the actual magnitude ("58% gross margin decline" not "a significant margin decline")
• Never say "going forward" — write "in FY2026" or "by Q3 2026" or "over the next 12 months"
• Name specific competitors (Samsung, Micron, AWS, etc.) when discussing competitive dynamics — never "the competition"
• When referencing history, cite the specific year: "gross margin collapsed from 38% in FY2022 to 7% in FY2023" not "margins deteriorated"

FORBIDDEN PHRASES — if any appear, the section fails quality review:
"it is worth noting", "importantly", "in conclusion", "as mentioned", "going forward", "significant" (without a number), "notable", "it should be noted", "in summary", "to summarize", "overall", "at the end of the day", "moving forward", "in the current environment", "in today's landscape", "it is important to", "one must consider", "delve", "leverage" (as a verb), "in terms of", "a number of"

STRUCTURE RULES (per section):
• Executive Summary: The FIRST SENTENCE must be the single most important analytical claim about this stock RIGHT NOW — not "Company X is a leading provider of…" Start with what makes this hard to own or short.
• Financial Analysis: Each subsection opens with the most surprising or counter-intuitive number, not the most obvious one
• Key Risks: Each risk starts with a bold one-line title capturing the specific mechanism ("NAND Pricing Reversion Erases 80% of FY2025 Gross Profit") then 3-4 specific sentences quantifying the exposure
• Investment Thesis: Every bull/bear bullet must contain a specific number — price target math, revenue figure, or margin assumption
• Valuation: Show explicit multiple math for all price targets: "[EV multiple]x × [EBITDA] = [EV], minus [net debt], ÷ [shares] = $[price]"

ANTI-AI STYLE REQUIREMENTS:
• Use sentence fragments strategically for emphasis. "Flat revenue. Expanding losses. A 45x EV/EBITDA multiple. Pick one to defend."
• Reference the Piotroski score, ROIC-WACC spread, earnings beat trend, and FCF yield vs risk-free from the Computed Metrics section — weave them into the narrative, don't list them
• The KEY METRICS DASHBOARD must be sector-specific: for tech use Rule of 40 and SBC dilution; for consumer use comp growth and gross margin; for banks use ROE and credit quality; for semis use ASPs and fab utilization
• MINIMUM CONTENT: Each ### subsection must have at least 2 full paragraphs. Do NOT produce a single short paragraph and move on.
• NEVER begin a paragraph or bullet with: "This", "The company", "It is", "There are", "Furthermore", "Moreover", "Additionally", "In addition", "Overall", "In summary". These are dead giveaways of AI-generated text.
• Use rhetorical questions sparingly but effectively: "Why does gross margin matter here? Because ${companyName} earns $X in FCF only when utilization exceeds Y%."
• Express genuine analytical uncertainty the way analysts do: "Our base case assumes X. If Y proves wrong — and it might — the bear case is Z."
• Where data contradicts the consensus narrative, call it out explicitly: "The bull case rests on margin recovery. The accrual ratio says look again."
• Write as if you know things your reader doesn't — that's the value-add. Not "revenue grew 12%" but "the 12% top-line number obscures a 3pp mix shift toward lower-margin products that won't be visible in consensus models."
• Avoid parallel structure in bullet lists — varying the rhythm of how bullets start prevents the robotic AI list cadence. Some bullets should be declarative, some conditional, some imperative.

TARGET: 5,000–5,500 words total. Section allocation:
Executive Summary: 400-500 words | Business Overview: 600-700 words | Industry Analysis: 500-600 words | Financial Analysis: 700-800 words | Valuation Framework: 500-600 words | Management Commentary: 300-400 words | Management & Governance: 300-400 words | Key Risks: 700-800 words (7 risks, 100+ words each) | News Analysis: 400-500 words | Investment Thesis: 400-500 words | Key Metrics + Earnings Questions: remainder

Write a complete institutional equity research primer using EXACTLY these section headers (## for main sections, ### for subsections). DO NOT add any text before "## EXECUTIVE SUMMARY".

⚠ CRITICAL HEADER RULE: Every ### subsection header below must appear CHARACTER FOR CHARACTER — same spelling, same capitalization, same punctuation, same word order. Do not add words, rename, or abbreviate. Deviating causes content to be silently dropped from the PDF. Required ### headers by section:
• Business Overview: Company Background | Product Portfolio & Revenue Mix | Customers, End Markets & Geographic Exposure
• Industry Analysis: Market Structure & Competitive Dynamics | Key Industry Drivers & Cycle | Competitive Position
• Financial Analysis: Revenue & Profitability Trends | Balance Sheet & Capital Allocation | Free Cash Flow & CapEx | Quality of Earnings & Cash Conversion
• Valuation Framework: Current Valuation vs. Historical Range | Peer Valuation Context | Implied Scenarios
• Management Commentary: Earnings Call Highlights | Forward Guidance & Outlook
• Management & Governance: Leadership & Track Record | Capital Allocation Discipline
• Investment Thesis: Bull Case | Bear Case | Analyst Note

## EXECUTIVE SUMMARY
Write 6-8 bullet points (• prefix). FIRST bullet must be the most important analytical claim — not a company description. Cover: (1) the core tension in this investment (what makes it hard to own AND hard to short), (2) the one metric that matters most right now with the exact current value, (3) revenue growth trajectory: 2-year history + FY forward estimate with specific % numbers, (4) what the current valuation implies about growth (not just the multiple — what must the company deliver to justify ${x(f.ev_ebitda)} EV/EBITDA?), (5) the single bull case catalyst and probability, (6) the single biggest risk with estimated financial impact, (7) verdict: buy/hold/avoid and why in one unambiguous sentence.
Do NOT write a bullet that simply says what the company does. An investor reading this already knows what the company does.

## COMPANY SNAPSHOT
Pipe-delimited table. FIRST ROW must be:
Investment Frame | [One crisp sentence: the single most important question an investor must answer to own this stock]
Then continue with:
Ticker | ${ticker}
Exchange | [exchange]
Sector | [sector]
Industry | ${industry}
Market Cap | ${fmt(f.market_cap)}
Enterprise Value | ${fmt(f.enterprise_value)}
Revenue (FY) | ${fmt(f.revenue)}
EBITDA | ${fmt(f.ebitda)}
FCF | ${fmt(f.free_cash_flow)}
Gross Margin | ${pct(f.gross_margin_pct)}
Operating Margin | ${pct(f.operating_margin_pct)}
Net Margin | ${pct(f.net_margin_pct)}
FCF Margin | ${f.free_cash_flow && f.revenue ? pct(f.free_cash_flow/f.revenue*100) : "N/A"}
EPS Diluted | ${f.eps_diluted != null ? `$${f.eps_diluted.toFixed(2)}` : "N/A"}
Net Debt | ${netDebt != null ? fmt(netDebt) : "N/A"}
ROE | ${roe != null ? pct(roe) : "N/A"}
ROIC | ${f.roic != null ? pct(f.roic) : "N/A"}
P/E | ${x(f.pe_ratio)} ${peerPeMed ? `(peer median: ${peerPeMed.toFixed(1)}x)` : ""}
EV/EBITDA | ${x(f.ev_ebitda)} ${peerEvMed ? `(peer median: ${peerEvMed.toFixed(1)}x)` : ""}
EPS Beat Rate (8Q) | ${epsBeats}/${epsTotal} quarters
Beta | ${f.beta != null ? f.beta.toFixed(2) : "N/A"}
Short Interest | ${f.short_float_pct != null ? pct(f.short_float_pct) + " of float" : "N/A"}
Analyst Rating | ${analystRecStr}

## BUSINESS OVERVIEW

### Company Background
2 paragraphs (5-6 sentences each). Founding, history, what the company does today, how it makes money, and its structural position. Be specific about the business model, not generic.

### Product Portfolio & Revenue Mix
2-3 paragraphs. Each major segment: what it is, how it works, revenue contribution %, growth rate, margin profile if available. Reference the segment data provided. Explain the economic logic of the product/service.

### Customers, End Markets & Geographic Exposure
1-2 paragraphs. Who buys, why they buy, switching costs, customer concentration, geographic revenue split. Use the geographic segment data. Identify any meaningful dependency or customer concentration risk.

## INDUSTRY ANALYSIS

### Market Structure & Competitive Dynamics
2-3 paragraphs. Name the key competitors. What's the industry structure (oligopoly, fragmented, winner-take-most)? What are the barriers to entry? How does pricing work? Is this a market share game or a market growth game? Be specific — name companies.

### Key Industry Drivers & Cycle
2 paragraphs. What are the 3-4 macro/structural drivers of demand? Is there cyclicality (and where are we in the cycle)? What secular trends are accelerating or threatening the industry? Be forward-looking.

### Competitive Position
2 paragraphs. What specifically makes ${companyName} better (or worse) than competitors? Quantify the moat where possible — pricing power evidence, market share, cost structure advantages, network effects, switching costs. Reference actual data from the filing.

## FINANCIAL ANALYSIS

### Revenue & Profitability Trends
3 paragraphs. Start with the 5-year revenue CAGR from the data provided. Analyze what's driving growth (volume vs. price vs. mix). Explain margin dynamics — why margins expanded or compressed. Reference specific numbers from the 5-year history and margin evolution. Address quality of growth (organic vs. acquired).

### Balance Sheet & Capital Allocation
2 paragraphs. Assess the balance sheet health: net debt/cash position, leverage ratio, interest coverage. How does management deploy capital — M&A, buybacks, dividends, R&D? Is capital allocation disciplined or value-destructive? Reference buyback and dividend data.

### Free Cash Flow & CapEx
2 paragraphs. Analyze FCF generation quality: FCF margin, OCF-to-NI ratio (cash quality score), CapEx intensity as % of revenue. Is the business asset-light or capital-intensive? What does FCF conversion look like over 5 years? How sustainable is the FCF?

### Quality of Earnings & Cash Conversion
1-2 paragraphs. Assess earnings quality: OCF/NI ratio ${ocfNiRatio ? ocfNiRatio.toFixed(2)+"x" : "N/A"} — what does this say about accrual risk? Comment on SBC as % of revenue (${sbcPct ? pct(sbcPct) : "N/A"}) and its impact on true FCF. Any red flags in working capital trends?

## VALUATION FRAMEWORK

### Current Valuation vs. Historical Range
2 paragraphs. Context: the company trades at ${x(f.pe_ratio)} P/E, ${x(f.ev_ebitda)} EV/EBITDA. How does this compare to its historical multiple range (use the historical valuation data)? Is the current multiple premium or discount to history, and why? What does the market appear to be pricing in?

### Peer Valuation Context
1-2 paragraphs. Compare the subject company's multiples directly to the peers listed. Is it at a premium or discount? Is the premium/discount justified by growth, returns, or quality differentials? Reference specific peer multiples from the comparison table.

### Implied Scenarios
Write a 3-scenario analysis with explicit price math. Use EV/EBITDA or P/FCF as the valuation anchor (whichever is more relevant for this sector):

**Bull Case ($[price]):** [Multiple]x EV/EBITDA × $[EBITDA estimate], minus $[net debt], ÷ [shares out] = $[price]. [2 sentences on what drives this: specific margin or revenue assumption, catalyst timeline]

**Base Case ($[price]):** [Multiple]x EV/EBITDA × $[EBITDA estimate] = $[price]. [1-2 sentences: what consensus is pricing in]

**Bear Case ($[price]):** [Multiple]x EV/EBITDA × $[EBITDA estimate] = $[price]. [2 sentences on what drives compression: specific risk materializing, financial deterioration]

Show the math every time. "Multiple expansion" without a number is not a scenario — it's a hope.

## MANAGEMENT COMMENTARY & GUIDANCE

### Earnings Call Highlights
2-3 paragraphs synthesizing what management said in the most recent earnings call/8-K. Pull specific quotes or paraphrases if available. What tone did management strike? What did they emphasize? What surprised analysts? If transcript data is limited, note it and focus on what is available.

### Forward Guidance & Outlook
1-2 paragraphs. Synthesize the forward estimates and any guidance provided. How does management guidance compare to consensus? What are the key KPIs management is focusing on going forward? What catalysts could cause guidance to be raised or lowered?

## MANAGEMENT & GOVERNANCE

### Leadership & Track Record
2 paragraphs. Assess the CEO and leadership team quality: tenure, background, prior track record. Have they executed on stated goals? How credible is management guidance based on historical EPS surprise track record? Reference the EPS surprise history to assess execution reliability.

### Capital Allocation Discipline
2 paragraphs. Evaluate capital allocation quality over the past 5 years: when and at what prices did they buy back stock? M&A history — did acquisitions create or destroy value? How do they balance growth investment (R&D CapEx at ${capexPct ? pct(capexPct) : "N/A"} of revenue) vs. shareholder returns? Assess ROIC trajectory as evidence of capital discipline.

## KEY RISKS
Write 7 specific, material risks. Format each as:

**[RISK TITLE: must capture the specific mechanism in plain English, e.g. "NAND Oversupply Cycle Compresses Gross Margin from 38% to Single Digits"]**
3-4 sentences: (1) What specifically causes this risk to materialize for ${companyName}? (2) What is the quantified financial exposure — revenue at risk, margin impact, or balance sheet hit? (3) What early warning signals would confirm this risk is activating? Rate: Probability [Low/Medium/High] | Impact [Low/Medium/High]

Zero boilerplate. If a risk doesn't have a number attached to it, it's not specific enough. Name the customers, competitors, regulators, or macro variables involved. No generic "competitive pressures" risks — name the specific competitor and the specific pressure.

## NEWS ANALYSIS & MARKET INTELLIGENCE
5-part structured analysis following the NEWS ANALYSIS INSTRUCTIONS in the data section above. Include all 5 parts: Events Scorecard, Sentiment Trajectory, Analyst Positioning, What's Priced In vs Not, Near-Term Catalysts. Do not skip or abbreviate.

## INVESTMENT THESIS

### Bull Case
6 bullet points (• prefix). Specific catalysts, time horizons, exact metrics that need to improve, and implied upside. Each bullet must have a number in it.

### Bear Case
6 bullet points (• prefix). Specific risks materializing, what metrics would signal deterioration, and implied downside. Each bullet must have a number in it.

### Analyst Note
2-3 sentences: The single most important variable to monitor. The key debate on the stock right now. What an institutional investor must believe to own this stock at the current valuation.

## KEY METRICS DASHBOARD
Write a compact monitoring table with exactly this format (pipe-delimited):

| KPI | Current | Threshold to Watch | Why It Matters |
|-----|---------|-------------------|----------------|
| [metric 1] | [value] | [bull: above X / bear: below Y] | [1-sentence explanation] |
[Repeat for 6-8 most important KPIs specific to this business model]

Choose metrics that are: (1) directly measurable from public disclosures, (2) leading indicators (not lagging), (3) specific to ${companyName}'s monetization model. For a SaaS company, use NRR/churn. For an advertising company, use CPM/impressions growth. For a bank, use NIM/credit quality. Be sector-specific, not generic.

## EARNINGS CALL QUESTIONS
Write 8 sharp, specific questions an institutional investor would ask in the Q&A. Format:
**Q[n]: [Question]** — [Why this question matters / what answer would be bullish vs bearish]

Questions must be: (1) directly answerable from company data (2) not already answered in the prepared remarks (3) specific enough that a vague answer would itself be signal. Include at least 2 questions about forward guidance, 2 about competitive dynamics, 2 about capital allocation, and 2 about risks.

---

FINAL RULES (non-negotiable):
- Every claim must be grounded in the data provided. Never fabricate numbers.
- Target 5,000-5,500 words total. Respect per-section allocations above.
- Do NOT add any text before "## EXECUTIVE SUMMARY"
- When transcript data is "Not available", synthesize from the MD&A and financial trends instead
- Before writing any section, ask: does this read like a Managing Director wrote it, or does it read like ChatGPT? If the latter, rewrite it.
- If data is missing for a subsection, draw analytical inferences from what you do have — never leave a subsection empty or with a single sentence`;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 24000,
      stream: true,
      system: `You are a Managing Director-level equity analyst at a top-tier investment firm. You write institutional equity research used by portfolio managers managing $10B+ funds. Your writing is precise, conviction-driven, and densely data-referenced. You never use filler. Every sentence earns its place. You write in active voice, cite specific numbers in every paragraph, and take clear directional stances backed by evidence. You never produce boilerplate that could apply to any company.`,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(
      `data: ${JSON.stringify({ error: `Claude error: ${err.slice(0, 200)}` })}\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const j = JSON.parse(raw);
            if (j.type === "content_block_delta" && j.delta?.type === "text_delta" && j.delta.text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: j.delta.text })}\n\n`));
            }
            if (j.type === "message_stop") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            }
          } catch { /* skip */ }
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
