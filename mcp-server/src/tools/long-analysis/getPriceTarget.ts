/**
 * Get consensus analyst price target for a symbol.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

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

const TTL_MINUTES = 60 * 24;

export async function getPriceTarget(ticker: string): Promise<PriceTargetResult> {
  const normalizedTicker = ticker.toUpperCase();
  const cacheKey = `pricetarget:${normalizedTicker}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.getPriceTarget(normalizedTicker);
    setCachedResponse(cacheKey, raw, TTL_MINUTES);
    fromCache = false;
  }

  const target = raw && raw.mean !== undefined ? {
    lastUpdated: raw.lastUpdated || "",
    mean: raw.mean ?? 0,
    median: raw.median ?? 0,
    preMean: raw.preMean ?? 0,
    preMedian: raw.preMedian ?? 0,
    postMean: raw.postMean ?? 0,
    postMedian: raw.postMedian ?? 0,
    preHigh: raw.preHigh ?? 0,
    preLow: raw.preLow ?? 0,
    postHigh: raw.postHigh ?? 0,
    postLow: raw.postLow ?? 0,
  } : null;

  return { ticker: normalizedTicker, target, fromCache };
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