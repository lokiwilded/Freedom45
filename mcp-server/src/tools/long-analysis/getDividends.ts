/**
 * Get dividend history for a symbol within a date range.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export const GetDividendsInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  from: z.string().describe("Start date YYYY-MM-DD"),
  to: z.string().describe("End date YYYY-MM-DD"),
});

export type GetDividendsInput = z.infer<typeof GetDividendsInput>;

export interface DividendsResult {
  ticker: string;
  dividends: {
    date: string;
    dividend: number;
    adjustedDividend: number;
    recordDate: string;
    paymentDate: string;
    declarationDate: string;
  }[];
  fromCache: boolean;
}

const TTL_MINUTES = 60 * 24;

export async function getDividends(ticker: string, from: string, to: string): Promise<DividendsResult> {
  const normalizedTicker = ticker.toUpperCase();
  const cacheKey = `dividends:${normalizedTicker}:${from}:${to}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.getDividends(normalizedTicker, from, to);
    setCachedResponse(cacheKey, raw, TTL_MINUTES);
    fromCache = false;
  }

  const dividends = (raw || []).map((d: any) => ({
    date: d.date || "",
    dividend: d.dividend ?? 0,
    adjustedDividend: d.adjustedDividend ?? 0,
    recordDate: d.recordDate || "",
    paymentDate: d.paymentDate || "",
    declarationDate: d.declarationDate || "",
  }));

  return { ticker: normalizedTicker, dividends, fromCache };
}

export const getDividendsTool = {
  name: "get_dividends",
  description: "Get dividend history for a ticker within a date range. Cached 24h.",
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
    const { ticker, from, to } = GetDividendsInput.parse(args);
    return await getDividends(ticker, from, to);
  },
};