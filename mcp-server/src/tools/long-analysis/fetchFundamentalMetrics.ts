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
  pbRatioTTM: number | null;
  psRatioTTM: number | null;
  epsTTM: number | null;
  roeTTM: number | null;
  roaTTM: number | null;
  profitMarginTTM: number | null;
  grossMarginTTM: number | null;
  operatingMarginTTM: number | null;
  revenueGrowthTTM: number | null;
  debtEquityTTM: number | null;
  currentRatioTTM: number | null;
  dividendYieldTTM: number | null;
  enterpriseValueEBITDATTM: number | null;
  revenueTTM: number | null;
  netIncomeTTM: number | null;
  marketCapTTM: number | null;
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
    peRatioTTM: safeNumber(metrics.peTTM),
    pbRatioTTM: safeNumber(metrics.pbAnnual),
    psRatioTTM: safeNumber(metrics.psTTM),
    epsTTM: safeNumber(metrics.epsTTM),
    roeTTM: safeNumber(metrics.roeTTM),
    roaTTM: safeNumber(metrics.roaTTM),
    profitMarginTTM: safeNumber(metrics.netProfitMarginTTM),
    grossMarginTTM: safeNumber(metrics.grossMarginTTM),
    operatingMarginTTM: safeNumber(metrics.operatingMarginTTM),
    revenueGrowthTTM: safeNumber(metrics.revenueGrowthTTMYoy),
    debtEquityTTM: safeNumber(metrics.totalDebtEquityTTM) ?? safeNumber(metrics.debtEquityAnnual),
    currentRatioTTM: safeNumber(metrics.currentRatioTTM) ?? safeNumber(metrics.currentRatioQuarterly),
    dividendYieldTTM: safeNumber(metrics.currentDividendYieldTTM),
    enterpriseValueEBITDATTM: safeNumber(metrics.evEbitdaTTM),
    revenueTTM: safeNumber(metrics.revenuePerShareTTM),
    netIncomeTTM: safeNumber(metrics.netIncomeEmployeeTTM),
    marketCapTTM: safeNumber(metrics.marketCapitalization),
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
  const fields = [
    "peRatioTTM", "pbRatioTTM", "psRatioTTM", "epsTTM",
    "roeTTM", "roaTTM", "profitMarginTTM", "grossMarginTTM",
    "operatingMarginTTM", "revenueGrowthTTM", "debtEquityTTM",
    "currentRatioTTM", "dividendYieldTTM", "enterpriseValueEBITDATTM",
    "revenueTTM", "netIncomeTTM", "marketCapTTM",
  ] as const;
  for (const field of fields) {
    const value: number | null = result[field];
    upsert.run(normalizedTicker, field, value ?? null, "ttm", "finnhub", now);
  }

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
