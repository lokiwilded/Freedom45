/**
 * Get stock split history for a symbol within a date range.
 */

import { z } from "zod";
import { fetchSplits } from "../../lib/combo-fetchers.js";

export const GetSplitsInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  from: z.string().describe("Start date YYYY-MM-DD"),
  to: z.string().describe("End date YYYY-MM-DD"),
});

export type GetSplitsInput = z.infer<typeof GetSplitsInput>;

export interface SplitsResult {
  ticker: string;
  splits: {
    date: string;
    fromFactor: number;
    toFactor: number;
    ratio: string;
  }[];
  fromCache: boolean;
}



export async function getSplits(ticker: string, from: string, to: string): Promise<SplitsResult> {
  const normalizedTicker = ticker.toUpperCase();

  const result = await fetchSplits(normalizedTicker, from, to);

  const splits = (result?.splits || []).map((s: any) => ({
    date: s.date || "",
    fromFactor: s.fromFactor ?? 0,
    toFactor: s.toFactor ?? 0,
    ratio: s.ratio || "",
  }));

  return { ticker: normalizedTicker, splits, fromCache: false };
}

export const getSplitsTool = {
  name: "get_splits",
  description: "Get stock split history for a ticker within a date range. Cached indefinitely (historical).",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      from: { type: "string", description: "Start date YYYY-MM-DD" },
      to: { type: "string", description: "End date YYYY-MM-DD" },
    },
    required: ["ticker", "from", "to"],
  },
  handler: async (args: unknown) => {
    const { ticker, from, to } = GetSplitsInput.parse(args);
    return await getSplits(ticker, from, to);
  },
};