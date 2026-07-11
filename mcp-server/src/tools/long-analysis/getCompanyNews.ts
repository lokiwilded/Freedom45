/**
 * Get company-specific news for a symbol within a date range.
 */

import { z } from "zod";
import { fetchCompanyNews } from "../../lib/combo-fetchers.js";

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



export async function getCompanyNews(
  ticker: string,
  from: string,
  to: string
): Promise<CompanyNewsResult> {
  const normalizedTicker = ticker.toUpperCase();

  const result = await fetchCompanyNews(normalizedTicker, from, to);

  const news = (result?.news || []).map((n: any) => ({
    category: n.category || "",
    datetime: n.datetime ? new Date(n.datetime * 1000).toISOString() : "",
    headline: n.headline || "",
    source: n.source || "",
    summary: n.summary || "",
    url: n.url || "",
    image: n.image || "",
  }));

  return { ticker: normalizedTicker, news, fromCache: false };
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