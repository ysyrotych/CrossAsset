/**
 * POST /api/backtesting/parse-strategy
 *
 * Body:   { description: string }
 * Returns: BacktestConfig (see app/backtesting/page.tsx for type)
 *
 * Implementation steps (ChatGPT):
 * 1. Call Claude with PARSE_PROMPT (below) + user description
 * 2. Parse the JSON response into BacktestConfig
 * 3. Validate required fields, fill in defaults
 * 4. Return the config
 *
 * PARSE_PROMPT should instruct Claude to:
 *   - Extract: asset class, tickers (or universe description), date range,
 *     initial capital, rebalance frequency
 *   - For each rule (entry, exit, position sizing, stop-loss, costs):
 *     create one Assumption with id, category, label, value, confidence, note
 *   - Return strict JSON matching BacktestConfig
 *   - For anything ambiguous, set confidence: "low" and note what was assumed
 *   - If no ticker is specified, default to S&P 500 universe
 *   - If no date range, default to last 10 years
 *   - If no initial capital, default to $100,000
 */

import { NextRequest, NextResponse } from "next/server";
// import Anthropic from "@anthropic-ai/sdk";  // uncomment when implementing

export async function POST(req: NextRequest) {
  const { description } = await req.json();

  if (!description || description.length < 10) {
    return NextResponse.json({ error: "Description too short" }, { status: 400 });
  }

  // ── STUB: return demo config so the page flow works end-to-end ──
  const demoConfig = {
    strategyName: "Momentum Strategy",
    originalDescription: description,
    assetClass: "Equities",
    tickers: ["SPY", "QQQ", "IWM"],
    startDate: "2015-01-01",
    endDate: "2024-12-31",
    initialCapital: 100000,
    rebalance: "Monthly",
    assumptions: [
      {
        id: "universe",
        category: "Universe",
        label: "Universe",
        value: "S&P 500 constituents",
        editable: true,
        confidence: "high",
        note: "Inferred from description",
      },
      {
        id: "entry",
        category: "Entry",
        label: "Entry signal",
        value: "Top 20% by 12-month price momentum",
        editable: true,
        confidence: "high",
        note: "Directly stated",
      },
      {
        id: "exit",
        category: "Exit",
        label: "Exit signal",
        value: "Drop out of top 30% on rebalance",
        editable: true,
        confidence: "medium",
        note: "Assumed momentum exit; not explicitly stated",
      },
      {
        id: "stoploss",
        category: "Risk",
        label: "Stop-loss",
        value: "10% below entry",
        editable: true,
        confidence: "low",
        note: "Default applied — not mentioned in description",
      },
      {
        id: "sizing",
        category: "Position Sizing",
        label: "Sizing",
        value: "Equal weight across all positions",
        editable: true,
        confidence: "medium",
        note: "Assumed equal-weight unless stated otherwise",
      },
      {
        id: "costs",
        category: "Costs",
        label: "Transaction costs",
        value: "0.05% per trade (slippage + commission)",
        editable: true,
        confidence: "high",
        note: "Standard institutional assumption",
      },
      {
        id: "rebalance",
        category: "Rebalance",
        label: "Rebalance",
        value: "Monthly, at open on first trading day",
        editable: true,
        confidence: "medium",
        note: "Monthly inferred; timing assumed",
      },
    ],
  };

  // TODO: replace stub with real Claude call:
  // const client = new Anthropic();
  // const response = await client.messages.create({ ... });
  // const config = JSON.parse(response.content[0].text);

  return NextResponse.json(demoConfig);
}
