/**
 * Analyze the long-term price trend for a ticker.
 */

import { z } from "zod";
import { fetchHistoricalPrices } from "./fetchHistoricalPrices.js";
import {
  calculateReturns,
  calculateCAGR,
  calculateVolatility,
  calculateMaxDrawdown,
} from "../../lib/calculations.js";

export const AnalyzeLongTermTrendInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  years: z.number().min(1).max(20).default(5).describe("How many years to analyze"),
});

export type AnalyzeLongTermTrendInput = z.infer<typeof AnalyzeLongTermTrendInput>;

export interface LongTermTrendResult {
  ticker: string;
  years: number;
  startPrice: number | null;
  endPrice: number | null;
  cagr: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  dataPoints: number;
  fromCache: boolean;
  insufficientData: boolean;
  note?: string;
}

export async function analyzeLongTermTrend(
  ticker: string,
  years: number = 5
): Promise<LongTermTrendResult> {
  const pricesResult = await fetchHistoricalPrices(ticker, years);
  const prices = pricesResult.data.map((d) => ({ date: d.date, close: d.close }));

  if (prices.length < 2) {
    return {
      ticker: ticker.toUpperCase(),
      years,
      startPrice: null,
      endPrice: null,
      cagr: null,
      volatility: null,
      maxDrawdown: null,
      dataPoints: prices.length,
      fromCache: pricesResult.fromCache,
      insufficientData: true,
      note: pricesResult.note || "Not enough historical price data to calculate trend metrics.",
    };
  }

  const startPrice = prices[0]!.close;
  const endPrice = prices[prices.length - 1]!.close;
  const returns = calculateReturns(prices);

  return {
    ticker: ticker.toUpperCase(),
    years,
    startPrice,
    endPrice,
    cagr: calculateCAGR(startPrice, endPrice, years),
    volatility: calculateVolatility(returns),
    maxDrawdown: calculateMaxDrawdown(prices),
    dataPoints: prices.length,
    fromCache: pricesResult.fromCache,
    insufficientData: false,
  };
}

export const analyzeLongTermTrendTool = {
  name: "analyze_long_term_trend",
  description: "Analyze long-term price trend for a ticker: CAGR, volatility, and max drawdown.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      years: { type: "number", description: "How many years (default 5, max 20)", default: 5 },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, years } = AnalyzeLongTermTrendInput.parse(args);
    return await analyzeLongTermTrend(ticker, years);
  },
};
