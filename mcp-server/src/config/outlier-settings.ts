import { z } from "zod";

/**
 * User-configurable settings for outlier trade detection.
 *
 * These settings control how the outlier scoring engine filters and ranks
 * congressional (and other) trades. All values have sensible defaults but can
 * be overridden per-call by the tool's input parameters.
 */

export const OutlierSettingsSchema = z.object({
  marketCapMax: z
    .number()
    .positive()
    .default(500_000_000)
    .describe("Ignore stocks above this market cap"),
  marketCapMin: z
    .number()
    .nonnegative()
    .default(10_000_000)
    .describe("Ignore stocks below this market cap"),
  excludedTickers: z
    .array(z.string().toUpperCase())
    .default([])
    .describe("Tickers to always skip"),
  includedTickers: z
    .array(z.string().toUpperCase())
    .optional()
    .describe("Only check these tickers (optional override)"),
  minOutlierScore: z
    .number()
    .min(0)
    .max(100)
    .default(50)
    .describe("Minimum outlier score to show (0-100)"),
  minTradeValue: z
    .number()
    .nonnegative()
    .default(0)
    .describe("Minimum trade dollar amount"),
  maxDaysOld: z
    .number()
    .positive()
    .default(90)
    .describe("Max age of trade in days"),
});

export type OutlierSettings = z.infer<typeof OutlierSettingsSchema>;

export const DEFAULT_OUTLIER_SETTINGS: OutlierSettings = {
  marketCapMax: 500_000_000,
  marketCapMin: 10_000_000,
  excludedTickers: [],
  includedTickers: undefined,
  minOutlierScore: 50,
  minTradeValue: 0,
  maxDaysOld: 90,
};