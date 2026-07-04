/**
 * Get general market news by category.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export const GetMarketNewsInput = z.object({
  category: z
    .string()
    .optional()
    .describe("News category: general, forex, crypto, merger. Defaults to general."),
});

export type GetMarketNewsInput = z.infer<typeof GetMarketNewsInput>;

export interface MarketNewsResult {
  category: string;
  news: {
    category: string;
    datetime: string;
    headline: string;
    source: string;
    summary: string;
    url: string;
    image: string;
  }[];
  fromCache: boolean;
}

const TTL_MINUTES = 30;

export async function getMarketNews(category: string = "general"): Promise<MarketNewsResult> {
  const normalizedCategory = category || "general";
  const cacheKey = `marketnews:${normalizedCategory}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.getMarketNews(normalizedCategory);
    setCachedResponse(cacheKey, raw, TTL_MINUTES);
    fromCache = false;
  }

  const news = (raw || []).map((n: any) => ({
    category: n.category || "",
    datetime: n.datetime ? new Date(n.datetime * 1000).toISOString() : "",
    headline: n.headline || "",
    source: n.source || "",
    summary: n.summary || "",
    url: n.url || "",
    image: n.image || "",
  }));

  return { category: normalizedCategory, news, fromCache };
}

export const getMarketNewsTool = {
  name: "get_market_news",
  description:
    "Get general market news by category (general, forex, crypto, merger). Cached 30min.",
  inputSchema: {
    type: "object",
    properties: {
      category: { type: "string", description: "general | forex | crypto | merger (default: general)" },
    },
  },
  handler: async (args: unknown) => {
    const { category } = GetMarketNewsInput.parse(args);
    return await getMarketNews(category);
  },
};