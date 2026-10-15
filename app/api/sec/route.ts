import { NextRequest, NextResponse } from "next/server";
import { META_SECTIONS_FY2024 } from "@/lib/data/meta-10k-static";

export const dynamic = "force-dynamic";

const SEC_SERVICE = (process.env.SEC_SERVICE_URL ?? "http://localhost:8000").trim().replace(/\/+$/, "");

// ── Types mirroring the Python service ───────────────────────────────────────

export type FilingSection = { item: string; title: string; text: string; char_count: number };
export type FilingData    = { form_type: string; accession: string; filed_date: string; period_of_report: string; sections: FilingSection[]; raw_financials: Record<string, number> };
export type CompanyInfo   = { ticker: string; name: string; cik: string; sic: string; sic_description: string };
export type AnalysisPayload = { company: CompanyInfo; annual: FilingData | null; quarterly: FilingData | null; xbrl_facts: Record<string, number>; history: Record<string, Record<string, number>>; quarterly_xbrl: Record<string, number>; quarterly_period: string; prior_quarter_xbrl: Record<string, number>; prior_quarter_period: string };

// Fetch raw filing data from the Python sidecar
async function fetchFromSidecar(ticker: string): Promise<AnalysisPayload> {
  const url = `${SEC_SERVICE}/company/${encodeURIComponent(ticker)}?sections=business,risks,cybersecurity,properties,legal,mda,quantitative,controls,accountant_fees,q_quantitative,q_controls,q_legal`;
  console.log("[sec] SEC_SERVICE_URL env:", process.env.SEC_SERVICE_URL);
  console.log("[sec] fetching:", url);
  let r: Response;
  try {
    r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    const cause = e instanceof Error ? `${e.message} | cause: ${JSON.stringify((e as NodeJS.ErrnoException).cause)}` : String(e);
    throw new Error(`Network error reaching ${url} — ${cause}`);
  }
  if (!r.ok) {
    const msg = await r.text().catch(() => `HTTP ${r.status}`);
    throw new Error(`SEC service HTTP ${r.status}: ${msg}`);
  }
  return r.json() as Promise<AnalysisPayload>;
}

// Build a rich Claude prompt from the filing data
function buildPrompt(payload: AnalysisPayload): string {
  const { company, annual, quarterly, xbrl_facts } = payload;

  const section = (filing: FilingData | null, key: string) =>
    filing?.sections.find(s => s.item === key)?.text ?? "";

  const xbrl = Object.keys(xbrl_facts).length > 0
    ? Object.entries(xbrl_facts)
        .map(([k, v]) => `${k}: ${v != null ? v.toLocaleString() : "N/A"}`)
        .join("\n")
    : "Not available";

  const annualPeriod    = annual?.period_of_report   ?? "N/A";
  const annualFiled     = annual?.filed_date          ?? "N/A";
  const quarterlyPeriod = quarterly?.period_of_report ?? "N/A";
  const quarterlyFiled  = quarterly?.filed_date       ?? "N/A";

  return `You are a senior equity research analyst at a top-tier asset manager. Analyze the following SEC filings for ${company.name} (${company.ticker}) and produce an institutional-grade research note.

COMPANY: ${company.name} | Ticker: ${company.ticker} | CIK: ${company.cik}
Industry: ${company.sic_description} (SIC ${company.sic})
Latest 10-K: Period ending ${annualPeriod} (filed ${annualFiled})
Latest 10-Q: Period ending ${quarterlyPeriod} (filed ${quarterlyFiled})

=== STRUCTURED FINANCIAL DATA (XBRL) ===
${xbrl}

=== 10-K: BUSINESS OVERVIEW ===
${truncateSection(section(annual, "business"), 3000)}

=== 10-K: RISK FACTORS (Key Risks) ===
${truncateSection(section(annual, "risks"), 4000)}

=== 10-K: MANAGEMENT DISCUSSION & ANALYSIS ===
${truncateSection(section(annual, "mda"), 4000)}

=== 10-Q: MANAGEMENT DISCUSSION & ANALYSIS (Most Recent Quarter) ===
${truncateSection(section(quarterly, "mda"), 3000)}

---

Write a comprehensive institutional equity research note structured as follows:

**COMPANY OVERVIEW**
2-3 sentences: What does this company do, what is its core business model, what market does it serve?

**FINANCIAL HEALTH SCORECARD**
Analyze the key financial metrics from the XBRL data. Comment on revenue trajectory, profitability, margins, debt load, and cash position. Be specific with numbers. Rate each dimension: Revenue Growth [Strong/Moderate/Weak], Profitability [Strong/Moderate/Weak], Balance Sheet [Strong/Moderate/Weak].

**KEY BUSINESS DRIVERS**
3-5 bullet points on what drives this company's revenue and earnings. What are the main growth levers? Where is management focusing investment?

**TOP RISK FACTORS (from 10-K)**
Extract and synthesize the 5 most material risks from the Risk Factors section. For each: name the risk, explain why it matters for this specific company, and rate its likelihood and impact [High/Medium/Low].

**MANAGEMENT'S STRATEGIC PRIORITIES (from MD&A)**
What is management signaling about the company's direction? What investments are they making? What challenges are they acknowledging? What metrics are they watching?

**QUARTER-OVER-QUARTER DEVELOPMENTS**
Based on the 10-Q MD&A, what changed materially from the annual report? Any new risks, new opportunities, or business model shifts?

**INVESTMENT THESIS**
2-3 sentences: If you were recommending this stock to a portfolio manager, what is the bull case in one sentence? What is the bear case in one sentence? What is the single most important thing to monitor?

**ANALYST RATING**
- Fundamental Quality: [1-10 score] — brief rationale
- Balance Sheet Strength: [1-10 score] — brief rationale
- Management Quality (based on MD&A tone/candor): [1-10 score] — brief rationale
- Risk Level: [Low/Medium/High/Very High]

Be direct, specific, and institutional. Use exact figures from the data where available. Total length: 700-900 words.`;
}

function truncateSection(text: string, max: number): string {
  if (!text) return "Not available in filing.";
  return text.length > max ? text.slice(0, max) + "\n[... truncated]" : text;
}

// ── EDGAR direct-fetch fallback ───────────────────────────────────────────────
// When edgartools can't extract sections, fetch the filing HTML from EDGAR
// archives and split it into sections by scanning for ITEM headers.

const EDGAR_HEADERS = {
  "User-Agent": "CrossAsset Research crossasset@research.com",
  "Accept-Encoding": "gzip",
};

const ANNUAL_SECTION_MAP: Record<string, { title: string; pattern: RegExp; next: RegExp }> = {
  business:       { title: "Item 1 — Business",          pattern: /ITEM\s+1[\.\s](?!A|B|C)/i,  next: /ITEM\s+1A[\.\s]/i },
  risks:          { title: "Item 1A — Risk Factors",     pattern: /ITEM\s+1A[\.\s]/i,           next: /ITEM\s+1B[\.\s]|ITEM\s+1C[\.\s]|ITEM\s+2[\.\s]/i },
  cybersecurity:  { title: "Item 1C — Cybersecurity",    pattern: /ITEM\s+1C[\.\s]/i,           next: /ITEM\s+2[\.\s]/i },
  mda:            { title: "Item 7 — MD&A",              pattern: /ITEM\s+7[\.\s](?!A)/i,       next: /ITEM\s+7A[\.\s]|ITEM\s+8[\.\s]/i },
  quantitative:   { title: "Item 7A — Market Risk",      pattern: /ITEM\s+7A[\.\s]/i,           next: /ITEM\s+8[\.\s]/i },
  controls:       { title: "Item 9A — Controls",         pattern: /ITEM\s+9A[\.\s]/i,           next: /ITEM\s+9B[\.\s]|ITEM\s+10[\.\s]/i },
};

async function fetchEdgarSectionsFallback(
  cik: string,
  accession: string,
  formType: "10-K" | "10-Q"
): Promise<FilingSection[]> {
  try {
    const cikNum = cik.replace(/^0+/, "");
    const accClean = accession.replace(/-/g, "");

    // 1. Get the filing index to find the primary document
    const idxUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${accession}-index.json`;
    const idxRes = await fetch(idxUrl, { headers: EDGAR_HEADERS, cache: "no-store" });
    if (!idxRes.ok) {
      console.log(`[edgar-fallback] index fetch failed: ${idxRes.status} for ${idxUrl}`);
      return [];
    }
    const idxJson = await idxRes.json() as { documents?: { type: string; document: string }[] };
    let primaryDoc = idxJson.documents?.find(d => d.type === formType && d.document.endsWith(".htm"))?.document
      ?? idxJson.documents?.find(d => d.document.endsWith(".htm"))?.document;
    if (!primaryDoc) {
      console.log(`[edgar-fallback] no .htm document found in index`);
      return [];
    }

    // 2. Fetch the filing HTML
    const docUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${primaryDoc}`;
    console.log(`[edgar-fallback] fetching ${docUrl}`);
    const docRes = await fetch(docUrl, { headers: EDGAR_HEADERS, cache: "no-store" });
    if (!docRes.ok) return [];

    // 3. Strip HTML tags
    let text = await docRes.text();
    text = text.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ");
    text = text.replace(/[ \t]{3,}/g, " ").replace(/\n{4,}/g, "\n\n\n");

    // 4. Extract sections by finding ITEM headers
    const map = ANNUAL_SECTION_MAP;
    const sections: FilingSection[] = [];
    for (const [key, cfg] of Object.entries(map)) {
      const startM = cfg.pattern.exec(text);
      if (!startM) continue;
      const start = startM.index;
      const nextM = cfg.next.exec(text.slice(start + 10));
      const end = nextM ? start + 10 + nextM.index : start + 80000;
      const chunk = text.slice(start, end).trim();
      if (chunk.length < 200) continue;
      sections.push({ item: key, title: cfg.title, text: chunk.slice(0, 120000), char_count: chunk.length });
      console.log(`[edgar-fallback] extracted '${key}': ${chunk.length} chars`);
    }
    console.log(`[edgar-fallback] total sections extracted: ${sections.length}`);
    return sections;
  } catch (e) {
    console.log(`[edgar-fallback] error: ${e}`);
    return [];
  }
}

// ── GET: fetch filing data only (no AI analysis) ─────────────────────────────

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    const payload = await fetchFromSidecar(ticker.toUpperCase());

    // If edgartools returned no annual sections, fall back to direct EDGAR fetch
    if (payload.annual && (!payload.annual.sections || payload.annual.sections.length === 0)) {
      const cik = payload.company.cik;
      const accession = payload.annual.accession;
      if (cik && accession) {
        console.log(`[sec-route] annual sections empty for ${ticker} — trying EDGAR fallback`);
        const fallbackSections = await fetchEdgarSectionsFallback(cik, accession, "10-K");
        if (fallbackSections.length > 0) {
          payload.annual = { ...payload.annual, sections: fallbackSections };
        }
      }
    }

    // Last resort: inject hardcoded sections for known tickers (handles annual=null or empty)
    const annualSectionsEmpty = !payload.annual || !payload.annual.sections || payload.annual.sections.length === 0;
    if (annualSectionsEmpty && ticker.toUpperCase() === "META") {
      console.log(`[sec-route] injecting hardcoded FY2024 10-K sections for META`);
      payload.annual = {
        form_type: "10-K",
        accession: "0001326801-25-000017",
        filed_date: "2025-01-29",
        period_of_report: "2024-12-31",
        raw_financials: {},
        ...(payload.annual ?? {}),
        sections: META_SECTIONS_FY2024,
      };
    }

    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

// ── POST: fetch data + stream Claude analysis ─────────────────────────────────

export async function POST(req: NextRequest) {
  const { ticker } = await req.json() as { ticker: string };
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      'data: {"error":"ANTHROPIC_API_KEY not configured"}\ndata: [DONE]\n\n',
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  // Fetch filing data first
  let payload: AnalysisPayload;
  try {
    payload = await fetchFromSidecar(ticker.toUpperCase());
  } catch (e) {
    return new Response(
      `data: ${JSON.stringify({ error: `SEC data fetch failed: ${e instanceof Error ? e.message : e}` })}\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const prompt = buildPrompt(payload);

  // Stream Claude analysis
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      stream: true,
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

  // Pipe Anthropic SSE → simple {text} SSE
  const encoder = new TextEncoder();
  const stream  = new ReadableStream({
    async start(controller) {
      // First emit the raw filing metadata so the page can render it
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ meta: { company: payload.company, annual: { period: payload.annual?.period_of_report, filed: payload.annual?.filed_date }, quarterly: { period: payload.quarterly?.period_of_report, filed: payload.quarterly?.filed_date }, xbrl: payload.xbrl_facts } })}\n\n`));

      const reader = upstream.body!.getReader();
      const dec    = new TextDecoder();
      let buf      = "";

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
