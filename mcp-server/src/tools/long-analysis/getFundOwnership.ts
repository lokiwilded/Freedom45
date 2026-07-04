/**
 * Get fund ownership (mutual funds, ETFs) for a symbol.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export const GetFundOwnershipInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type GetFundOwnershipInput = z.infer<typeof GetFundOwnershipInput>;

export interface FundOwnershipResult {
  ticker: string;
  owners: {
    owner: string;
    shares: number;
    value: number;
    dateReported: string;
    change: number;
    percentTotal: number;
  }[];
  fromCache: boolean;
}

const TTL_MINUTES = 60 * 24;

export async function getFundOwnership(ticker: string): Promise<FundOwnershipResult> {
  const normalizedTicker = ticker.toUpperCase();
  const cacheKey = `fundown:${normalizedTicker}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.getFundOwnership(normalizedTicker);
    setCachedResponse(cacheKey, raw, TTL_MINUTES);
    fromCache = false;
  }

  const owners = (raw || []).map((o: any) => ({
    owner: o.owner || o.name || "",
    shares: o.shares ?? 0,
    value: o.value ?? 0,
    dateReported: o.dateReported || "",
    change: o.change ?? 0,
    percentTotal: o.percentTotal ?? 0,
  }));

  return { ticker: normalizedTicker, owners, fromCache };
}

export const getFundOwnershipTool = {
  name: "get_fund_ownership",
  description: "Get fund ownership (mutual funds, ETFs) for a ticker. Cached 24h.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = GetFundOwnershipInput.parse(args);
    return await getFundOwnership(ticker);
  },
};