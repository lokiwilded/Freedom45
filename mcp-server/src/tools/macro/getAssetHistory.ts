/**
 * Historical asset series for the liquidity dashboard, persisted to `asset_series`.
 *
 * - Index / commodity LEVELS (monthly, full history) via Yahoo chart API:
 *     SP500, FTSE, NIKKEI, GOLD, SILVER
 * - True aggregate US equity MARKET CAP (quarterly, real dollars) via FRED Z.1:
 *     US_MKTCAP (NCBEILQ027S — nonfinancial corporate equities, market value)
 *
 * Levels give shape/history; US_MKTCAP gives real-dollar market cap for the elasticity
 * engine (Phase 4). Stooq is walled behind a JS challenge and multpl is JS-rendered, so
 * true daily S&P-only cap has no clean free source — the Fed Z.1 whole-market cap is the
 * honest real-dollar measure. See plans/liquidity-macro-dashboard-plan.md.
 */

import { z } from "zod";
import { yahooProvider } from "../../providers/yahoo.js";
import { fredProvider } from "../../providers/fred.js";
import { syncAssetSeries, summarize } from "./_shared.js";

type AssetDef =
  | { source: "yahoo"; symbol: string; metric: "level"; currency: string; label: string }
  | { source: "fred"; seriesId: string; metric: "market_cap"; currency: string; unit: string; label: string };

const ASSETS: Record<string, AssetDef> = {
  // US indexes
  SP500: { source: "yahoo", symbol: "^GSPC", metric: "level", currency: "USD", label: "S&P 500 index" },
  NASDAQ: { source: "yahoo", symbol: "^IXIC", metric: "level", currency: "USD", label: "Nasdaq Composite index" },
  DOW: { source: "yahoo", symbol: "^DJI", metric: "level", currency: "USD", label: "Dow Jones Industrial Average" },
  // Europe
  FTSE: { source: "yahoo", symbol: "^FTSE", metric: "level", currency: "GBP", label: "FTSE 100 index (UK)" },
  DAX: { source: "yahoo", symbol: "^GDAXI", metric: "level", currency: "EUR", label: "DAX 40 index (Germany)" },
  ESTOXX50: { source: "yahoo", symbol: "^STOXX50E", metric: "level", currency: "EUR", label: "Euro Stoxx 50 index" },
  CAC40: { source: "yahoo", symbol: "^FCHI", metric: "level", currency: "EUR", label: "CAC 40 index (France)" },
  // Asia-Pacific
  NIKKEI: { source: "yahoo", symbol: "^N225", metric: "level", currency: "JPY", label: "Nikkei 225 index (Japan)" },
  HANGSENG: { source: "yahoo", symbol: "^HSI", metric: "level", currency: "HKD", label: "Hang Seng index (Hong Kong)" },
  SHANGHAI: { source: "yahoo", symbol: "000001.SS", metric: "level", currency: "CNY", label: "Shanghai Composite index" },
  KOSPI: { source: "yahoo", symbol: "^KS11", metric: "level", currency: "KRW", label: "KOSPI index (South Korea)" },
  ASX200: { source: "yahoo", symbol: "^AXJO", metric: "level", currency: "AUD", label: "ASX 200 index (Australia)" },
  TSX: { source: "yahoo", symbol: "^GSPTSE", metric: "level", currency: "CAD", label: "S&P/TSX index (Canada)" },
  // Commodities
  GOLD: { source: "yahoo", symbol: "GC=F", metric: "level", currency: "USD", label: "Gold (COMEX front-month, USD/oz)" },
  SILVER: { source: "yahoo", symbol: "SI=F", metric: "level", currency: "USD", label: "Silver (COMEX front-month, USD/oz)" },
  US_MKTCAP: {
    source: "fred",
    seriesId: "NCBEILQ027S",
    metric: "market_cap",
    currency: "USD",
    unit: "Millions of USD",
    label: "US equity market cap (Fed Z.1 nonfinancial corp equities)",
  },
};

export const GetAssetHistoryInput = z.object({
  asset: z.string().describe(`Asset key. One of: ${Object.keys(ASSETS).join(", ")}`),
  from: z.string().optional().describe("Start date YYYY-MM-DD"),
  to: z.string().optional().describe("End date YYYY-MM-DD (default today)"),
});

export async function getAssetHistory(asset: string, from?: string, to?: string) {
  const key = asset.toUpperCase();
  const def = ASSETS[key];
  if (!def) {
    return { asset: key, error: `Unknown asset '${key}'.`, supported: Object.keys(ASSETS) };
  }

  const start = from ?? "1900-01-01";
  const end = to ?? new Date().toISOString().split("T")[0]!;

  const fetchAll =
    def.source === "yahoo"
      ? () => yahooProvider.getChart(def.symbol, "1mo")
      : () => fredProvider.getSeriesObservations(def.seriesId);

  const { points, fromCache, fetched } = await syncAssetSeries({
    asset: key,
    metric: def.metric,
    currency: def.currency,
    source: def.source,
    from: start,
    to: end,
    fetchAll,
  });

  return {
    asset: key,
    label: def.label,
    metric: def.metric,
    currency: def.currency,
    source: def.source,
    ...(def.source === "fred" ? { seriesId: def.seriesId, unit: def.unit } : { symbol: def.symbol }),
    from: start,
    to: end,
    count: points.length,
    fromCache,
    fetched,
    ...summarize(points),
    data: points,
  };
}

export const getAssetHistoryTool = {
  name: "get_asset_history",
  description:
    "Historical asset series: index/commodity levels (SP500, FTSE, NIKKEI, GOLD, SILVER via Yahoo) and true US equity market cap (US_MKTCAP via FRED Z.1). Persisted to SQLite.",
  inputSchema: {
    type: "object",
    properties: {
      asset: {
        type: "string",
        description: "SP500, NASDAQ, DOW, FTSE, DAX, ESTOXX50, CAC40, NIKKEI, HANGSENG, SHANGHAI, KOSPI, ASX200, TSX, GOLD, SILVER, US_MKTCAP",
      },
      from: { type: "string", description: "Start date YYYY-MM-DD" },
      to: { type: "string", description: "End date YYYY-MM-DD" },
    },
    required: ["asset"],
  },
  handler: async (args: unknown) => {
    const { asset, from, to } = GetAssetHistoryInput.parse(args);
    return getAssetHistory(asset, from, to);
  },
};
