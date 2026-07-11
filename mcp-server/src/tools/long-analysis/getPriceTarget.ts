/**
 * Get consensus analyst price target for a symbol.
 */

import { z } from "zod";
import { fetchPriceTarget } from "../../lib/combo-fetchers.js";

export const GetPriceTargetInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type GetPriceTargetInput = z.infer<typeof GetPriceTargetInput>;

export interface PriceTargetResult {
  ticker: string;
  target: {
    lastUpdated: string;
    mean: number;
    median: number;
    preMean: number;
    preMedian: number;
    postMean: number;
    postMedian: number;
    preHigh: number;
    preLow: number;
    postHigh: number;
    postLow: number;
  } | null;
  fromCache: boolean;
}



export async function getPriceTarget(ticker: string): Promise<PriceTargetResult> {
  const normalizedTicker = ticker.toUpperCase();

  const result = await fetchPriceTarget(normalizedTicker);

  const target = result?.target ? {
    lastUpdated: result.target.lastUpdated || "",
    mean: result.target.mean ?? 0,
    median: result.target.median ?? 0,
    preMean: result.target.preMean ?? 0,
    preMedian: result.target.preMedian ?? 0,
    postMean: result.target.postMean ?? 0,
    postMedian: result.target.postMedian ?? 0,
    preHigh: result.target.preHigh ?? 0,
    preLow: result.target.preLow ?? 0,
    postHigh: result.target.postHigh ?? 0,
    postLow: result.target.postLow ?? 0,
  } : null;

  return { ticker: normalizedTicker, target, fromCache: false };
}

export const getPriceTargetTool = {
  name: "get_price_target",
  description: "Get consensus analyst price target (mean, median, pre/post earnings) for a ticker. Cached 24h.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = GetPriceTargetInput.parse(args);
    return await getPriceTarget(ticker);
  },
};