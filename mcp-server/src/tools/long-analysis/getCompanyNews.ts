/**
 * Get company-specific news for a symbol within a date range.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export const GetCompanyNewsInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  from: z.string().describe("Start date YYYY-MM-DD"),
  to: z.string().describe("End date YYYY-MM-DD"),
});

export type GetCompanyNewsInput = z.infer<typeof GetCompanyNewsInput>;

export interface CompanyNewsResult {
  ticker: string;
  news: {
    category: string;
    datetime: string;
    headline: string;
    source: string;
    summary: string;
    url: string;
    image: string;
  }[];
  fromCache: boolean;
}

const TTL_MINUTES = 30;

export async function getCompanyNews(
  ticker: string,
  from: string,
  to: string
): Promise<CompanyNewsResult> {
  const normalizedTicker = ticker.toUpperCase();
  const cacheKey = `news:${normalizedTicker}:${from}:${to}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.getCompanyNews(normalizedTicker, from, to);
    setCachedResponse(cacheKey, raw, TTL_MINUTES);
    fromCache = false;
  }

  const news = (raw || []).map((n: any) => ({
    category: n.category || "",
    datetime: n.datetime ? new Date(n.datetime * 1000).toISOString() : "",
    headline: n.headline || "",
    source: n.source || "",
    summary: n.summary || "",
    url: n.url || "",
    image: n.image || "",
  }));

  return { ticker: normalizedTicker, news, fromCache };
}

export const getCompanyNewsTool = {
  name: "get_company_news",
  description:
    "Get company-specific news for a ticker within a date range. Cached 30min.",
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
    const { ticker, from, to } = GetCompanyNewsInput.parse(args);
    return await getCompanyNews(ticker, from, to);
  },
};