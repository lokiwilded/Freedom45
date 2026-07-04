/**
 * Get earnings calendar for a date range.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export const GetEarningsCalendarInput = z.object({
  from: z.string().describe("Start date YYYY-MM-DD"),
  to: z.string().describe("End date YYYY-MM-DD"),
});

export type GetEarningsCalendarInput = z.infer<typeof GetEarningsCalendarInput>;

export interface EarningsCalendarResult {
  from: string;
  to: string;
  earnings: {
    date: string;
    symbol: string;
    quarter: number;
    year: number;
    hour: string;
    epsEstimate: number | null;
    epsActual: number | null;
    revenueEstimate: number | null;
    revenueActual: number | null;
  }[];
  fromCache: boolean;
}

const TTL_MINUTES = 60 * 6;

export async function getEarningsCalendar(from: string, to: string): Promise<EarningsCalendarResult> {
  const cacheKey = `earningscal:${from}:${to}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.getEarningsCalendar(from, to);
    setCachedResponse(cacheKey, raw, TTL_MINUTES);
    fromCache = false;
  }

  const earnings = (raw || []).map((e: any) => ({
    date: e.date || "",
    symbol: e.symbol || "",
    quarter: e.quarter || 0,
    year: e.year || 0,
    hour: e.hour || "",
    epsEstimate: e.epsEstimate ?? null,
    epsActual: e.epsActual ?? null,
    revenueEstimate: e.revenueEstimate ?? null,
    revenueActual: e.revenueActual ?? null,
  }));

  return { from, to, earnings, fromCache };
}

export const getEarningsCalendarTool = {
  name: "get_earnings_calendar",
  description: "Get earnings calendar (who reports when) for a date range. Cached 6h.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Start date YYYY-MM-DD" },
      to: { type: "string", description: "End date YYYY-MM-DD" },
    },
    required: ["from", "to"],
  },
  handler: async (args: unknown) => {
    const { from, to } = GetEarningsCalendarInput.parse(args);
    return await getEarningsCalendar(from, to);
  },
};