/**
 * Fetch a real-time stock quote.
 */

import { z } from "zod";
import { fetchStockQuote as fetchStockQuoteCombo } from "../../lib/combo-fetchers.js";

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



export async function fetchStockQuote(ticker: string): Promise<StockQuoteResult> {
  const normalizedTicker = ticker.toUpperCase();

  const result = await fetchStockQuoteCombo(normalizedTicker);

  const data = result?.data;

  return {
    ticker: normalizedTicker,
    price: data?.c ?? 0,
    change: data?.d ?? 0,
    changePercent: data?.dp ?? 0,
    open: data?.o ?? 0,
    high: data?.h ?? 0,
    low: data?.l ?? 0,
    previousClose: data?.pc ?? 0,
    timestamp: data?.t ? new Date(data.t * 1000).toISOString() : new Date().toISOString(),
    fromCache: false,
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
