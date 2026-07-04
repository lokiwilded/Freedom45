/**
 * Get analyst recommendation trends for a symbol.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export const GetRecommendationTrendsInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type GetRecommendationTrendsInput = z.infer<typeof GetRecommendationTrendsInput>;

export interface RecommendationTrendsResult {
  ticker: string;
  trends: {
    period: string;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  }[];
  fromCache: boolean;
}

const TTL_MINUTES = 60 * 24;

export async function getRecommendationTrends(ticker: string): Promise<RecommendationTrendsResult> {
  const normalizedTicker = ticker.toUpperCase();
  const cacheKey = `recommendations:${normalizedTicker}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.getRecommendationTrends(normalizedTicker);
    setCachedResponse(cacheKey, raw, TTL_MINUTES);
    fromCache = false;
  }

  const trends = (raw || []).map((t: any) => ({
    period: t.period || "",
    strongBuy: t.strongBuy || 0,
    buy: t.buy || 0,
    hold: t.hold || 0,
    sell: t.sell || 0,
    strongSell: t.strongSell || 0,
  }));

  return { ticker: normalizedTicker, trends, fromCache };
}

export const getRecommendationTrendsTool = {
  name: "get_recommendation_trends",
  description: "Get analyst recommendation trends (strongBuy/buy/hold/sell/strongSell) for a ticker. Cached 24h.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = GetRecommendationTrendsInput.parse(args);
    return await getRecommendationTrends(ticker);
  },
};