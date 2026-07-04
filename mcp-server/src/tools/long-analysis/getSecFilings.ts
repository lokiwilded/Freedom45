/**
 * Get SEC filings (10-K, 10-Q, 8-K, etc.) for a symbol within a date range.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export const GetSecFilingsInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  from: z.string().describe("Start date YYYY-MM-DD"),
  to: z.string().describe("End date YYYY-MM-DD"),
});

export type GetSecFilingsInput = z.infer<typeof GetSecFilingsInput>;

export interface SecFilingsResult {
  ticker: string;
  filings: {
    accessNumber: string;
    filingDate: string;
    reportDate: string | null;
    form: string;
    link: string;
  }[];
  fromCache: boolean;
}

const TTL_MINUTES = 60 * 24;

export async function getSecFilings(ticker: string, from: string, to: string): Promise<SecFilingsResult> {
  const normalizedTicker = ticker.toUpperCase();
  const cacheKey = `secfilings:${normalizedTicker}:${from}:${to}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.getSecFilings(normalizedTicker, from, to);
    setCachedResponse(cacheKey, raw, TTL_MINUTES);
    fromCache = false;
  }

  const filings = (raw || []).map((f: any) => ({
    accessNumber: f.accessNumber || "",
    filingDate: f.filingDate || "",
    reportDate: f.reportDate ?? null,
    form: f.form || "",
    link: f.link || "",
  }));

  return { ticker: normalizedTicker, filings, fromCache };
}

export const getSecFilingsTool = {
  name: "get_sec_filings",
  description: "Get SEC filings (10-K, 10-Q, 8-K, etc.) for a ticker within a date range. Cached 24h.",
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
    const { ticker, from, to } = GetSecFilingsInput.parse(args);
    return await getSecFilings(ticker, from, to);
  },
};