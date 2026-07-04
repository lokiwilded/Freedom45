/**
 * Analyze a stock's relative strength vs a benchmark over N years.
 *
 * Computes alpha, beta, Sharpe-like ratio, max drawdown comparison,
 * and monthly outperformance percentage. Returns a 0-100 score with
 * verdict.
 */

import { z } from "zod";
import { fetchHistoricalPrices } from "./fetchHistoricalPrices.js";
import type { HistoricalPriceBar } from "./fetchHistoricalPrices.js";
import {
  calculateReturns,
  calculateVolatility,
  calculateMaxDrawdown,
  calculateBeta,
  calculateAlpha,
  calculateSharpeRatio,
  calculateMonthlyOutperformance,
} from "../../lib/calculations.js";
import type { PricePoint } from "../../lib/calculations.js";
import { verdictFromScore } from "../../lib/scoring.js";

export const AnalyzeRelativeStrengthInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  benchmark: z.string().default("SPY").describe("Benchmark ticker (default: SPY)"),
  years: z.number().min(1).max(20).default(5).describe("How many years to analyze (default 5)"),
});

export type AnalyzeRelativeStrengthInput = z.infer<typeof AnalyzeRelativeStrengthInput>;

export interface RelativeStrengthComponents {
  returnScore: number;
  riskAdjustedScore: number;
  drawdownScore: number;
  consistencyScore: number;
}

export interface RelativeStrengthResult {
  ticker: string;
  benchmark: string;
  years: number;
  score: number | null;
  verdict: "Strong" | "Favorable" | "Neutral" | "Unfavorable" | "Weak" | "No data";
  alpha: number | null;
  beta: number | null;
  components: RelativeStrengthComponents | null;
  tickerReturn: number | null;
  benchmarkReturn: number | null;
  tickerVolatility: number | null;
  benchmarkVolatility: number | null;
  tickerMaxDrawdown: number | null;
  benchmarkMaxDrawdown: number | null;
  monthsOutperforming: number | null;
  totalMonths: number | null;
  fromCache: boolean;
  note?: string;
  generatedAt: string;
}

function toPricePoints(bars: HistoricalPriceBar[]): PricePoint[] {
  return bars.map((b) => ({ date: b.date, close: b.close }));
}

export async function analyzeRelativeStrength(
  ticker: string,
  benchmark: string = "SPY",
  years: number = 5
): Promise<RelativeStrengthResult> {
  const normalizedTicker = ticker.toUpperCase();
  const normalizedBenchmark = benchmark.toUpperCase();

  let tickerPrices, benchmarkPrices;
  try {
    [tickerPrices, benchmarkPrices] = await Promise.all([
      fetchHistoricalPrices(normalizedTicker, years),
      fetchHistoricalPrices(normalizedBenchmark, years),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ticker: normalizedTicker,
      benchmark: normalizedBenchmark,
      years,
      score: null,
      verdict: "No data",
      alpha: null,
      beta: null,
      components: null,
      tickerReturn: null,
      benchmarkReturn: null,
      tickerVolatility: null,
      benchmarkVolatility: null,
      tickerMaxDrawdown: null,
      benchmarkMaxDrawdown: null,
      monthsOutperforming: null,
      totalMonths: null,
      fromCache: false,
      note: `Historical price data unavailable: ${message}`,
      generatedAt: new Date().toISOString(),
    };
  }

  if (
    (tickerPrices.data.length === 0 || tickerPrices.note) &&
    (benchmarkPrices.data.length === 0 || benchmarkPrices.note)
  ) {
    return {
      ticker: normalizedTicker,
      benchmark: normalizedBenchmark,
      years,
      score: null,
      verdict: "No data",
      alpha: null,
      beta: null,
      components: null,
      tickerReturn: null,
      benchmarkReturn: null,
      tickerVolatility: null,
      benchmarkVolatility: null,
      tickerMaxDrawdown: null,
      benchmarkMaxDrawdown: null,
      monthsOutperforming: null,
      totalMonths: null,
      fromCache: false,
      note: tickerPrices.note || benchmarkPrices.note || "No historical price data available.",
      generatedAt: new Date().toISOString(),
    };
  }

  const tickerPoints = toPricePoints(tickerPrices.data);
  const benchmarkPoints = toPricePoints(benchmarkPrices.data);

  const tickerReturns = calculateReturns(tickerPoints);
  const benchmarkReturns = calculateReturns(benchmarkPoints);

  const minLen = Math.min(tickerReturns.length, benchmarkReturns.length);
  const alignedTickerReturns = tickerReturns.slice(tickerReturns.length - minLen);
  const alignedBenchmarkReturns = benchmarkReturns.slice(benchmarkReturns.length - minLen);

  const tickerFirst = tickerPoints[0]!.close;
  const tickerLast = tickerPoints[tickerPoints.length - 1]!.close;
  const benchmarkFirst = benchmarkPoints[0]!.close;
  const benchmarkLast = benchmarkPoints[benchmarkPoints.length - 1]!.close;

  const tickerReturn = (tickerLast - tickerFirst) / tickerFirst;
  const benchmarkReturn = (benchmarkLast - benchmarkFirst) / benchmarkFirst;

  const tickerVol = calculateVolatility(tickerReturns);
  const benchmarkVol = calculateVolatility(benchmarkReturns);

  const tickerDD = calculateMaxDrawdown(tickerPoints);
  const benchmarkDD = calculateMaxDrawdown(benchmarkPoints);

  const beta = calculateBeta(alignedTickerReturns, alignedBenchmarkReturns);
  const alpha = calculateAlpha(alignedTickerReturns, alignedBenchmarkReturns);
  const sharpe = calculateSharpeRatio(tickerReturns);

  const monthly = calculateMonthlyOutperformance(tickerPoints, benchmarkPoints);

  const returnScore = Math.max(
    0,
    Math.min(30, 15 + (tickerReturn - benchmarkReturn) * 75)
  );
  const riskAdjustedScore = Math.max(0, Math.min(25, (sharpe + 1) * 12.5));
  const drawdownScore = Math.max(
    0,
    Math.min(20, 10 + (benchmarkDD - tickerDD) * 100)
  );
  const consistencyScore = monthly.percentage * 25;

  const components: RelativeStrengthComponents = {
    returnScore,
    riskAdjustedScore,
    drawdownScore,
    consistencyScore,
  };

  const score = returnScore + riskAdjustedScore + drawdownScore + consistencyScore;
  const verdict = verdictFromScore(score);

  return {
    ticker: normalizedTicker,
    benchmark: normalizedBenchmark,
    years,
    score: Math.round(score * 10) / 10,
    verdict,
    alpha,
    beta,
    components,
    tickerReturn,
    benchmarkReturn,
    tickerVolatility: tickerVol,
    benchmarkVolatility: benchmarkVol,
    tickerMaxDrawdown: tickerDD,
    benchmarkMaxDrawdown: benchmarkDD,
    monthsOutperforming: monthly.outperformingMonths,
    totalMonths: monthly.totalMonths,
    fromCache: tickerPrices.fromCache && benchmarkPrices.fromCache,
    generatedAt: new Date().toISOString(),
  };
}

export const analyzeRelativeStrengthTool = {
  name: "analyze_relative_strength",
  description:
    "Analyze a stock's relative strength vs a benchmark (default SPY) over N years. Computes alpha, beta, Sharpe ratio, drawdown comparison, and monthly outperformance. Returns 0-100 score with verdict.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      benchmark: { type: "string", description: "Benchmark ticker (default: SPY)", default: "SPY" },
      years: { type: "number", description: "Years to analyze (default 5, max 20)", default: 5 },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, benchmark, years } = AnalyzeRelativeStrengthInput.parse(args);
    return await analyzeRelativeStrength(ticker, benchmark, years);
  },
};