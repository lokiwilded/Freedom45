/**
 * Get earnings surprise (actual vs estimate) for a symbol.
 */

import { z } from "zod";
import { fetchEarningsSurprise } from "../../lib/combo-fetchers.js";

export const GetEarningsSurpriseInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type GetEarningsSurpriseInput = z.infer<typeof GetEarningsSurpriseInput>;

export interface EarningsSurpriseResult {
  ticker: string;
  surprises: {
    period: string;
    quarter: number;
    year: number;
    actual: number;
    estimate: number;
    surprise: number;
    surprisePercent: number;
  }[];
  fromCache: boolean;
}



export async function getEarningsSurprise(ticker: string): Promise<EarningsSurpriseResult> {
  const normalizedTicker = ticker.toUpperCase();

  const result = await fetchEarningsSurprise(normalizedTicker);

  const surprises = (result?.surprises || []).map((s: any) => ({
    period: s.period || "",
    quarter: s.quarter || 0,
    year: s.year || 0,
    actual: s.actual ?? 0,
    estimate: s.estimate ?? 0,
    surprise: s.surprise ?? 0,
    surprisePercent: s.surprisePercent ?? 0,
  }));

  return { ticker: normalizedTicker, surprises, fromCache: false };
}

export const getEarningsSurpriseTool = {
  name: "get_earnings_surprise",
  description: "Get earnings surprise (actual vs estimate, beat/miss) for a ticker. Cached 24h.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = GetEarningsSurpriseInput.parse(args);
    return await getEarningsSurprise(ticker);
  },
};