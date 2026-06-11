import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a senior quantitative analyst at a top-tier investment bank. Your job is to parse a plain-English strategy description into a structured BacktestConfig JSON object.

Rules:
1. Extract every tradeable rule: entry signals, exit conditions, universe, position sizing, risk controls, costs, rebalance frequency.
2. For each extracted rule, create one Assumption object.
3. Set confidence: "high" when explicitly stated, "medium" when inferred, "low" when defaulted.
4. For anything ambiguous, note what you assumed and why.
5. Apply these defaults when not stated:
   - universe: "S&P 500 constituents"
   - startDate: "2015-01-01", endDate: "2024-12-31"
   - initialCapital: 100000
   - costs: "0.05% per trade (slippage + commission)"
   - rebalance: "Monthly"
6. Invent a concise, descriptive strategyName (3-6 words, title case).
7. Return ONLY valid JSON — no markdown, no explanation.

JSON schema:
{
  "strategyName": string,
  "originalDescription": string,
  "assetClass": "Equities" | "Bonds" | "Commodities" | "FX" | "Crypto" | "Mixed",
  "tickers": string[],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "initialCapital": number,
  "rebalance": string,
  "assumptions": [
    {
      "id": string (snake_case),
      "category": "Universe" | "Entry" | "Exit" | "Position Sizing" | "Risk" | "Costs" | "Rebalance",
      "label": string (2-4 words),
      "value": string (concise, specific),
      "editable": true,
      "confidence": "high" | "medium" | "low",
      "note": string (one sentence explaining the reasoning or what was assumed)
    }
  ]
}`;

const DEMO_CONFIG = {
  strategyName: "S&P 500 Momentum Strategy",
  originalDescription: "",
  assetClass: "Equities",
  tickers: ["SPY"],
  startDate: "2015-01-01",
  endDate: "2024-12-31",
  initialCapital: 100000,
  rebalance: "Monthly",
  assumptions: [
    { id: "universe", category: "Universe", label: "Universe", value: "S&P 500 constituents", editable: true, confidence: "high", note: "Standard S&P 500 universe inferred from description." },
    { id: "entry_signal", category: "Entry", label: "Entry signal", value: "Top 20% by 12-month price momentum", editable: true, confidence: "high", note: "Directly stated: top quintile by trailing 12-month return." },
    { id: "exit_signal", category: "Exit", label: "Exit signal", value: "Drop out of top 30% on monthly rebalance", editable: true, confidence: "medium", note: "Inferred: wider exit band than entry to reduce turnover." },
    { id: "stop_loss", category: "Risk", label: "Stop-loss", value: "8% below entry price", editable: true, confidence: "low", note: "Default applied — no stop-loss level mentioned in description." },
    { id: "position_sizing", category: "Position Sizing", label: "Sizing", value: "Equal weight, 20 positions maximum", editable: true, confidence: "medium", note: "Equal-weight assumed; position count inferred from top-quintile universe (~25 stocks)." },
    { id: "costs", category: "Costs", label: "Transaction costs", value: "0.05% per trade (slippage + commission)", editable: true, confidence: "high", note: "Standard institutional cost assumption." },
    { id: "rebalance", category: "Rebalance", label: "Rebalance frequency", value: "Monthly, first trading day of month", editable: true, confidence: "medium", note: "Monthly inferred; exact timing assumed." },
  ],
};

export async function POST(req: NextRequest) {
  const { description } = await req.json();

  if (!description || description.length < 10) {
    return NextResponse.json({ error: "Description too short" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No API key — return enriched demo config with the user's description attached
    return NextResponse.json({ ...DEMO_CONFIG, originalDescription: description });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 2048,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Parse this trading strategy:\n\n${description}` }],
      }),
    });

    if (!response.ok) throw new Error(`Claude API ${response.status}`);

    const data = await response.json();
    const raw = data.content?.[0]?.text ?? "";

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/gm, "").replace(/```\s*$/gm, "").trim();
    const config = JSON.parse(cleaned);

    if (!config.assumptions || config.assumptions.length === 0) {
      throw new Error("No assumptions extracted");
    }

    return NextResponse.json({ ...config, originalDescription: description });
  } catch (err) {
    console.error("Parse strategy error:", err);
    return NextResponse.json({ ...DEMO_CONFIG, originalDescription: description, _fallback: true });
  }
}
