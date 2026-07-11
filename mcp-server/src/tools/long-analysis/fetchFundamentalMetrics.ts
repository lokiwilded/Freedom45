/**
 * Fetch key fundamental metrics for a ticker.
 */

import { z } from "zod";
import { fetchFundamentalMetrics as fetchFundamentalMetricsCombo } from "../../lib/combo-fetchers.js";
import { db } from "../../db.js";

export const FetchFundamentalMetricsInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type FetchFundamentalMetricsInput = z.infer<typeof FetchFundamentalMetricsInput>;

export interface FundamentalMetricsResult {
  ticker: string;
  peRatioTTM: number | null;
  pbRatioTTM: number | null;
  psRatioTTM: number | null;
  evEbitdaTTM: number | null;
  dividendYieldTTM: number | null;
  epsTTM: number | null;
  roeTTM: number | null;
  profitMarginTTM: number | null;
  revenueGrowthTTM: number | null;
  debtEquityTTM: number | null;
  currentRatioTTM: number | null;
  fetchedAt: string;
  fromCache: boolean;
}



function safeNumber(value: unknown): number | null {
  return typeof value === "number" && !isNaN(value) ? value : null;
}

export async function fetchFundamentalMetrics(ticker: string): Promise<FundamentalMetricsResult> {
  const normalizedTicker = ticker.toUpperCase();

  const result = await fetchFundamentalMetricsCombo(normalizedTicker);

  const metrics = result?.metrics || {};

  const fundamentalResult: FundamentalMetricsResult = {
    ticker: normalizedTicker,
    peRatioTTM: safeNumber(metrics.peRatioTTM),
    pbRatioTTM: safeNumber(metrics.pbRatioTTM),
    psRatioTTM: safeNumber(metrics.psRatioTTM),
    evEbitdaTTM: safeNumber(metrics.evEbitdaTTM),
    dividendYieldTTM: safeNumber(metrics.currentDividendYieldTTM),
    epsTTM: safeNumber(metrics.epsTTM),
    roeTTM: safeNumber(metrics.roeTTM),
    profitMarginTTM: safeNumber(metrics.netProfitMarginTTM),
    revenueGrowthTTM: safeNumber(metrics.revenueGrowthTTM),
    debtEquityTTM: safeNumber(metrics.totalDebtEquityTTM),
    currentRatioTTM: safeNumber(metrics.currentRatioTTM),
    fetchedAt: new Date().toISOString(),
    fromCache: false,
  };

  const upsert = db.prepare(
    `INSERT INTO fundamentals (ticker, metric, value, period, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(ticker, metric, period, source) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  );

  const now = new Date().toISOString();
  const source = result?.source ?? "combo";
  upsert.run(normalizedTicker, "peRatioTTM", fundamentalResult.peRatioTTM, "ttm", source, now);
  upsert.run(normalizedTicker, "pbRatioTTM", fundamentalResult.pbRatioTTM, "ttm", source, now);
  upsert.run(normalizedTicker, "psRatioTTM", fundamentalResult.psRatioTTM, "ttm", source, now);
  upsert.run(normalizedTicker, "evEbitdaTTM", fundamentalResult.evEbitdaTTM, "ttm", source, now);
  upsert.run(normalizedTicker, "dividendYieldTTM", fundamentalResult.dividendYieldTTM, "ttm", source, now);
  upsert.run(normalizedTicker, "epsTTM", fundamentalResult.epsTTM, "ttm", source, now);
  upsert.run(normalizedTicker, "roeTTM", fundamentalResult.roeTTM, "ttm", source, now);
  upsert.run(normalizedTicker, "profitMarginTTM", fundamentalResult.profitMarginTTM, "ttm", source, now);
  upsert.run(normalizedTicker, "revenueGrowthTTM", fundamentalResult.revenueGrowthTTM, "ttm", source, now);
  upsert.run(normalizedTicker, "debtEquityTTM", fundamentalResult.debtEquityTTM, "ttm", source, now);
  upsert.run(normalizedTicker, "currentRatioTTM", fundamentalResult.currentRatioTTM, "ttm", source, now);

  return fundamentalResult;
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
