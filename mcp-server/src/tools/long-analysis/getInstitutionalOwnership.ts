/**
 * Get institutional ownership (13F) for a symbol.
 */

import { z } from "zod";
import { fetchInstitutionalOwnership } from "../../lib/combo-fetchers.js";

export const GetInstitutionalOwnershipInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type GetInstitutionalOwnershipInput = z.infer<typeof GetInstitutionalOwnershipInput>;

export interface InstitutionalOwnershipResult {
  ticker: string;
  owners: {
    investor: string;
    stake: number;
    shares: number;
    value: number;
    dateReported: string;
    change: number;
    percentTotal: number;
  }[];
  fromCache: boolean;
}



export async function getInstitutionalOwnership(ticker: string): Promise<InstitutionalOwnershipResult> {
  const normalizedTicker = ticker.toUpperCase();

  const result = await fetchInstitutionalOwnership(normalizedTicker);

  const owners = (result?.owners || []).map((o: any) => ({
    investor: o.investor || o.name || "",
    stake: o.stake ?? 0,
    shares: o.shares ?? 0,
    value: o.value ?? 0,
    dateReported: o.dateReported || "",
    change: o.change ?? 0,
    percentTotal: o.percentTotal ?? 0,
  }));

  return { ticker: normalizedTicker, owners, fromCache: false };
}

export const getInstitutionalOwnershipTool = {
  name: "get_institutional_ownership",
  description: "Get institutional ownership (13F filings) for a ticker. Cached 24h.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = GetInstitutionalOwnershipInput.parse(args);
    return await getInstitutionalOwnership(ticker);
  },
};