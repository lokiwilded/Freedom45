/**
 * Fetch key fundamental metrics for a ticker.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { db } from "../../db.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export const FetchFundamentalMetricsInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type FetchFundamentalMetricsInput = z.infer<typeof FetchFundamentalMetricsInput>;

export interface FundamentalMetricsResult {
  ticker: string;
  peRatioTTM: number | null;
  epsTTM: number | null;
  roeTTM: number | null;
  profitMarginTTM: number | null;
  revenueGrowthTTM: number | null;
  debtEquityTTM: number | null;
  currentRatioTTM: number | null;
  fetchedAt: string;
  fromCache: boolean;
}

const FUNDAMENTALS_TTL_MINUTES = 60 * 24;

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && !isNaN(value) ? value : null;
}

export async function fetchFundamentalMetrics(ticker: string): Promise<FundamentalMetricsResult> {
  const normalizedTicker = ticker.toUpperCase();
  const cacheKey = `fundamentals:${normalizedTicker}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.getFundamentalMetrics(normalizedTicker);
    setCachedResponse(cacheKey, raw, FUNDAMENTALS_TTL_MINUTES);
    fromCache = false;
  }

  const metrics = raw.metric || {};

  const result: FundamentalMetricsResult = {
    ticker: normalizedTicker,
    peRatioTTM: safeNumber(metrics.peRatioTTM),
    epsTTM: safeNumber(metrics.epsTTM),
    roeTTM: safeNumber(metrics.roeTTM),
    profitMarginTTM: safeNumber(metrics.netProfitMarginTTM),
    revenueGrowthTTM: safeNumber(metrics.revenueGrowthTTM),
    debtEquityTTM: safeNumber(metrics.totalDebtEquityTTM),
    currentRatioTTM: safeNumber(metrics.currentRatioTTM),
    fetchedAt: new Date().toISOString(),
    fromCache,
  };

  const upsert = db.prepare(
    `INSERT INTO fundamentals (ticker, metric, value, period, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(ticker, metric, period, source) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  );

  const now = new Date().toISOString();
  upsert.run(normalizedTicker, "peRatioTTM", result.peRatioTTM, "ttm", "finnhub", now);
  upsert.run(normalizedTicker, "epsTTM", result.epsTTM, "ttm", "finnhub", now);
  upsert.run(normalizedTicker, "roeTTM", result.roeTTM, "ttm", "finnhub", now);
  upsert.run(normalizedTicker, "profitMarginTTM", result.profitMarginTTM, "ttm", "finnhub", now);
  upsert.run(normalizedTicker, "revenueGrowthTTM", result.revenueGrowthTTM, "ttm", "finnhub", now);
  upsert.run(normalizedTicker, "debtEquityTTM", result.debtEquityTTM, "ttm", "finnhub", now);
  upsert.run(normalizedTicker, "currentRatioTTM", result.currentRatioTTM, "ttm", "finnhub", now);

  return result;
}

export const fetchFundamentalMetricsTool = {
  name: "fetch_fundamental_metrics",
  description: "Fetch key TTM fundamental metrics for a ticker. Cached for 24 hours.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = FetchFundamentalMetricsInput.parse(args);
    return await fetchFundamentalMetrics(ticker);
  },
};
