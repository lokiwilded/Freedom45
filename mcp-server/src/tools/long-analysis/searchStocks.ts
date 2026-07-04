/**
 * Search for stocks by ticker or company name.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export const SearchStocksInput = z.object({
  query: z.string().describe("Search query — ticker or company name, e.g. 'Apple' or 'AAPL'"),
});

export type SearchStocksInput = z.infer<typeof SearchStocksInput>;

export interface SearchStocksResult {
  query: string;
  matches: {
    symbol: string;
    description: string;
    displaySymbol: string;
    type: string;
  }[];
  fromCache: boolean;
}

const SEARCH_TTL_MINUTES = 60 * 24;

export async function searchStocks(query: string): Promise<SearchStocksResult> {
  const normalizedQuery = query.trim();
  const cacheKey = `search:${normalizedQuery.toLowerCase()}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.searchSymbol(normalizedQuery);
    setCachedResponse(cacheKey, raw, SEARCH_TTL_MINUTES);
    fromCache = false;
  }

  const matches = (raw || []).map((r: any) => ({
    symbol: r.symbol || "",
    description: r.description || "",
    displaySymbol: r.displaySymbol || r.symbol || "",
    type: r.type || "",
  }));

  return { query: normalizedQuery, matches, fromCache };
}

export const searchStocksTool = {
  name: "search_stocks",
  description: "Search for stocks by ticker or company name. Returns matching tickers. Cached 24h.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query — ticker or company name" },
    },
    required: ["query"],
  },
  handler: async (args: unknown) => {
    const { query } = SearchStocksInput.parse(args);
    return await searchStocks(query);
  },
};