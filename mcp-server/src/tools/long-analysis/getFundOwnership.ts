/**
 * Get fund ownership (mutual funds, ETFs) for a symbol.
 */

import { z } from "zod";
import { fetchFundOwnership } from "../../lib/combo-fetchers.js";

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



export async function getFundOwnership(ticker: string): Promise<FundOwnershipResult> {
  const normalizedTicker = ticker.toUpperCase();

  const result = await fetchFundOwnership(normalizedTicker);

  const owners = (result?.owners || []).map((o: any) => ({
    owner: o.owner || o.name || "",
    shares: o.shares ?? 0,
    value: o.value ?? 0,
    dateReported: o.dateReported || "",
    change: o.change ?? 0,
    percentTotal: o.percentTotal ?? 0,
  }));

  return { ticker: normalizedTicker, owners, fromCache: false };
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