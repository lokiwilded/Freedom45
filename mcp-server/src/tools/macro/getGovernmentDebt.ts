/**
 * Historical government debt for a country, sourced from FRED and persisted to SQLite.
 * v1 scope: US total public debt (GFDEBTN). Phase 2/7 adds cross-country debt (IMF WEO).
 */

import { z } from "zod";
import { syncFredSeries, summarize } from "./_shared.js";

// FRED series per country. Verified: US (GFDEBTN — Federal Debt: Total Public Debt).
const DEBT_SERIES: Record<string, { id: string; currency: string; unit: string; start: string }> = {
  US: { id: "GFDEBTN", currency: "USD", unit: "Millions of USD", start: "1966-01-01" },
};

export const GetGovernmentDebtInput = z.object({
  country: z.string().default("US").describe("ISO country code. v1 supports: US"),
  from: z.string().optional().describe("Start date YYYY-MM-DD"),
  to: z.string().optional().describe("End date YYYY-MM-DD (default today)"),
});

export async function getGovernmentDebt(country = "US", from?: string, to?: string) {
  const key = country.toUpperCase();
  const series = DEBT_SERIES[key];
  if (!series) {
    return {
      country: key,
      indicator: "DEBT",
      error: `No debt series mapped for ${key} yet.`,
      supported: Object.keys(DEBT_SERIES),
    };
  }

  const start = from ?? series.start;
  const end = to ?? new Date().toISOString().split("T")[0]!;

  const { points, fromCache, fetched } = await syncFredSeries({
    country: key,
    currency: series.currency,
    indicator: "DEBT",
    seriesId: series.id,
    unit: series.unit,
    from: start,
    to: end,
  });

  return {
    country: key,
    indicator: "DEBT",
    seriesId: series.id,
    currency: series.currency,
    unit: series.unit,
    from: start,
    to: end,
    count: points.length,
    fromCache,
    fetched,
    ...summarize(points),
    data: points,
  };
}

export const getGovernmentDebtTool = {
  name: "get_government_debt",
  description:
    "Historical government debt for a country from FRED, persisted to SQLite. v1 supports US (total public debt).",
  inputSchema: {
    type: "object",
    properties: {
      country: { type: "string", description: "ISO country code (v1: US)", default: "US" },
      from: { type: "string", description: "Start date YYYY-MM-DD" },
      to: { type: "string", description: "End date YYYY-MM-DD" },
    },
  },
  handler: async (args: unknown) => {
    const { country, from, to } = GetGovernmentDebtInput.parse(args);
    return getGovernmentDebt(country, from, to);
  },
};
