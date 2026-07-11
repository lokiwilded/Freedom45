/**
 * Get insider transactions (CEO, directors, officers buying/selling their own company's stock).
 */

import { z } from "zod";
import { fetchInsiderTransactions } from "../../lib/combo-fetchers.js";

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



export async function getInsiderTransactions(
  ticker: string,
  from?: string,
  to?: string
): Promise<InsiderTransactionsResult> {
  const normalizedTicker = ticker.toUpperCase();

  const result = await fetchInsiderTransactions(normalizedTicker, from, to);

  const transactions = (result?.transactions || []).map((t: any) => {
    const change = t.change || 0;
    const price = t.price || 0;
    const reportedValue = t.value || 0;
    const computedValue = reportedValue > 0 ? reportedValue : Math.abs(change) * price;
    return {
      symbol: t.symbol || "",
      insiderName: t.name || "",
      shares: t.share || 0,
      change,
      filingDate: t.filingDate || "",
      transactionDate: t.transactionDate || "",
      transactionCode: t.transactionCode || "",
      price,
      value: computedValue,
      isBuy: t.isBuy || false,
    };
  });

  return { ticker: normalizedTicker, transactions, fromCache: false };
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