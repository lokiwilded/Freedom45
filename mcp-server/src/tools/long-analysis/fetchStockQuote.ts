/**
 * Fetch a real-time stock quote.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export const FetchStockQuoteInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type FetchStockQuoteInput = z.infer<typeof FetchStockQuoteInput>;

export interface StockQuoteResult {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  timestamp: string;
  fromCache: boolean;
}

const QUOTE_TTL_MINUTES = 1;

export async function fetchStockQuote(ticker: string): Promise<StockQuoteResult> {
  const normalizedTicker = ticker.toUpperCase();
  const cacheKey = `quote:${normalizedTicker}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.getQuote(normalizedTicker);
    setCachedResponse(cacheKey, raw, QUOTE_TTL_MINUTES);
    fromCache = false;
  }

  return {
    ticker: normalizedTicker,
    price: raw.c ?? 0,
    change: raw.d ?? 0,
    changePercent: raw.dp ?? 0,
    open: raw.o ?? 0,
    high: raw.h ?? 0,
    low: raw.l ?? 0,
    previousClose: raw.pc ?? 0,
    timestamp: raw.t ? new Date(raw.t * 1000).toISOString() : new Date().toISOString(),
    fromCache,
  };
}

export const fetchStockQuoteTool = {
  name: "fetch_stock_quote",
  description: "Fetch a real-time stock quote for a ticker. Cached for 1 minute.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = FetchStockQuoteInput.parse(args);
    return await fetchStockQuote(ticker);
  },
};
