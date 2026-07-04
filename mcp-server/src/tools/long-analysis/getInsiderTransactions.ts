/**
 * Get insider transactions (CEO, directors, officers buying/selling their own company's stock).
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export const GetInsiderTransactionsInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  from: z.string().optional().describe("Start date YYYY-MM-DD"),
  to: z.string().optional().describe("End date YYYY-MM-DD"),
});

export type GetInsiderTransactionsInput = z.infer<typeof GetInsiderTransactionsInput>;

export interface InsiderTransactionsResult {
  ticker: string;
  transactions: {
    symbol: string;
    insiderName: string;
    shares: number;
    change: number;
    filingDate: string;
    transactionDate: string;
    transactionCode: string;
    price: number;
    value: number;
    isBuy: boolean;
  }[];
  fromCache: boolean;
}

const TTL_MINUTES = 60;

export async function getInsiderTransactions(
  ticker: string,
  from?: string,
  to?: string
): Promise<InsiderTransactionsResult> {
  const normalizedTicker = ticker.toUpperCase();
  const cacheKey = `insider:${normalizedTicker}:${from || ""}:${to || ""}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.getInsiderTransactions(normalizedTicker, from, to);
    setCachedResponse(cacheKey, raw, TTL_MINUTES);
    fromCache = false;
  }

  const transactions = (raw || []).map((t: any) => ({
    symbol: t.symbol || "",
    insiderName: t.name || "",
    shares: t.share || 0,
    change: t.change || 0,
    filingDate: t.filingDate || "",
    transactionDate: t.transactionDate || "",
    transactionCode: t.transactionCode || "",
    price: t.price || 0,
    value: t.value || 0,
    isBuy: (t.transactionCode || "").toUpperCase().startsWith("P"),
  }));

  return { ticker: normalizedTicker, transactions, fromCache };
}

export const getInsiderTransactionsTool = {
  name: "get_insider_transactions",
  description:
    "Get insider transactions (C-suite, directors, officers buying/selling their own company's stock). Transaction code P = purchase. Cached 1h.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      from: { type: "string", description: "Start date YYYY-MM-DD (optional)" },
      to: { type: "string", description: "End date YYYY-MM-DD (optional)" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, from, to } = GetInsiderTransactionsInput.parse(args);
    return await getInsiderTransactions(ticker, from, to);
  },
};