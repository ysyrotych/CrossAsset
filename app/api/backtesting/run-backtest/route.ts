/**
 * POST /api/backtesting/run-backtest
 *
 * Body:   { config: BacktestConfig }
 * Returns: BacktestResult (see app/backtesting/page.tsx for type)
 *
 * Implementation steps (ChatGPT):
 *
 * OPTION A — Simulated backtest (no live data required, works immediately):
 *   1. Use the config assumptions to parameterize a simulation engine
 *   2. Generate synthetic but realistic equity curves using GBM or historical
 *      regime-aware returns
 *   3. Apply the stated entry/exit/stop-loss/cost rules to the simulation
 *   4. Calculate all stats (CAGR, Sharpe, Sortino, max DD, win rate, etc.)
 *   5. Generate monthly returns grid
 *   6. Call Claude to write a 2-3 sentence plain-English summary
 *
 * OPTION B — Real historical data (better, requires data source):
 *   1. Fetch OHLCV data from Yahoo Finance (yfinance via Python sidecar)
 *      OR use a free API: polygon.io, Alpha Vantage, or Twelve Data
 *   2. Apply strategy rules to real price history
 *   3. Calculate stats from actual trade log
 *   4. Claude generates summary
 *
 * Recommended for MVP: start with OPTION A (simulated), add OPTION B later.
 *
 * Key stats to compute:
 *   CAGR = (endValue / startValue) ^ (1 / years) - 1
 *   Sharpe = (mean daily return - risk free) / std daily return * sqrt(252)
 *   Sortino = mean daily return / downside std * sqrt(252)
 *   Max drawdown = max(peak - trough) / peak over entire series
 *   Win rate = winning trades / total trades
 *   Profit factor = sum(wins) / abs(sum(losses))
 *   Alpha = strategy CAGR - (beta * benchmark CAGR)
 *   Beta = cov(strategy returns, benchmark returns) / var(benchmark returns)
 *   Calmar = CAGR / abs(max drawdown)
 */

import { NextRequest, NextResponse } from "next/server";

function generateDemoEquityCurve(
  startDate: string,
  endDate: string,
  initialCapital: number
) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const curve: { date: string; portfolio: number; benchmark: number }[] = [];
  const drawdown: { date: string; drawdown: number }[] = [];

  let portfolio = initialCapital;
  let benchmark = initialCapital;
  let peakPortfolio = initialCapital;

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    const portfolioReturn = (Math.random() - 0.47) * 0.012; // slight upward drift
    const benchmarkReturn = (Math.random() - 0.48) * 0.010;

    portfolio *= 1 + portfolioReturn;
    benchmark *= 1 + benchmarkReturn;
    peakPortfolio = Math.max(peakPortfolio, portfolio);

    curve.push({ date: dateStr, portfolio: Math.round(portfolio), benchmark: Math.round(benchmark) });
    drawdown.push({ date: dateStr, drawdown: (portfolio - peakPortfolio) / peakPortfolio });

    // Step by ~5 trading days
    current.setDate(current.getDate() + 7);
  }
  return { curve, drawdown };
}

export async function POST(req: NextRequest) {
  const { config } = await req.json();

  if (!config) {
    return NextResponse.json({ error: "No config provided" }, { status: 400 });
  }

  // ── STUB: demo backtest result ──
  const { curve, drawdown } = generateDemoEquityCurve(
    config.startDate || "2015-01-01",
    config.endDate || "2024-12-31",
    config.initialCapital || 100000
  );

  const finalPortfolio = curve[curve.length - 1]?.portfolio ?? config.initialCapital;
  const finalBenchmark = curve[curve.length - 1]?.benchmark ?? config.initialCapital;
  const years = curve.length / 52;
  const cagr = ((finalPortfolio / config.initialCapital) ** (1 / years) - 1) * 100;
  const benchCagr = ((finalBenchmark / config.initialCapital) ** (1 / years) - 1) * 100;

  const result = {
    config,
    stats: {
      cagr: parseFloat(cagr.toFixed(2)),
      totalReturn: parseFloat(((finalPortfolio / config.initialCapital - 1) * 100).toFixed(2)),
      sharpeRatio: parseFloat((0.8 + Math.random() * 0.8).toFixed(2)),
      sortinoRatio: parseFloat((1.1 + Math.random() * 0.9).toFixed(2)),
      maxDrawdown: parseFloat((-12 - Math.random() * 18).toFixed(2)),
      maxDrawdownDuration: Math.floor(60 + Math.random() * 180),
      winRate: parseFloat((52 + Math.random() * 12).toFixed(1)),
      avgWin: parseFloat((2.1 + Math.random() * 1.5).toFixed(2)),
      avgLoss: parseFloat((-1.2 - Math.random() * 0.8).toFixed(2)),
      profitFactor: parseFloat((1.4 + Math.random() * 0.8).toFixed(2)),
      totalTrades: Math.floor(120 + Math.random() * 200),
      benchmarkCagr: parseFloat(benchCagr.toFixed(2)),
      alpha: parseFloat((cagr - benchCagr).toFixed(2)),
      beta: parseFloat((0.7 + Math.random() * 0.4).toFixed(2)),
      calmarRatio: parseFloat((0.4 + Math.random() * 0.6).toFixed(2)),
    },
    equityCurve: curve,
    drawdownSeries: drawdown,
    trades: [], // TODO: populate with real trade log
    monthlyReturns: [], // TODO: populate with monthly grid
    summary:
      `The strategy delivered a CAGR of ${cagr.toFixed(1)}% vs. ${benchCagr.toFixed(1)}% for the benchmark, ` +
      `generating ${(cagr - benchCagr).toFixed(1)}% of alpha over the period. ` +
      `The maximum drawdown was contained, and the Sharpe ratio indicates adequate risk-adjusted returns for a momentum approach.`,
  };

  // TODO: replace stub with real backtest engine

  return NextResponse.json(result);
}
