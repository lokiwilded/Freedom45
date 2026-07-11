/**
 * get_sector_relative_strength — combo tool
 *
 * Analyzes a sector proxy's relative strength vs a benchmark and its liquidity
 * sensitivity. Combines relative-strength analytics with macro liquidity
 * elasticity. Returns a rotation signal, momentum score, and graphable series.
 */

import { z } from "zod";
import { analyzeRelativeStrength } from "../long-analysis/analyzeRelativeStrength.js";
import { getAssetHistory } from "../macro/getAssetHistory.js";
import { getLiquidityElasticity } from "../macro/getLiquidityElasticity.js";
import { rotationLabel, r } from "../../lib/verdicts.js";

export const GetSectorRelativeStrengthInput = z.object({
  ticker: z.string().describe("Sector proxy ticker, e.g. XLK, AAPL, NVDA"),
  benchmark: z.string().default("SP500").describe("Benchmark asset key (default: SP500)"),
  years: z.number().min(1).max(20).default(3).describe("Years to analyze (default 3)"),
});

export type GetSectorRelativeStrengthInput = z.infer<typeof GetSectorRelativeStrengthInput>;

export interface SectorRelativeStrengthResult {
  ticker: string;
  benchmark: string;
  summary: string;
  verdict: string;
  score: number;
  alpha: number | null;
  beta: number | null;
  sharpe: number | null;
  liquidityBeta: number | null;
  liquidityR2: number | null;
  tickerReturn: number | null;
  benchmarkReturn: number | null;
  monthsOutperforming: number | null;
  totalMonths: number | null;
  series: {
    date: string;
    tickerNormalized: number;
    benchmarkNormalized: number;
    relativeRatio: number | null;
  }[];
  metadata: {
    generatedAt: string;
    fromCache: boolean;
    sources: string[];
  };
}

function normalizeSeries(points: { date: string; value: number }[]): { date: string; value: number }[] {
  if (points.length === 0) return [];
  const first = points[0]!.value;
  if (!first) return points.map((p) => ({ date: p.date, value: 100 }));
  return points.map((p) => ({ date: p.date, value: (p.value / first) * 100 }));
}

export async function getSectorRelativeStrength(
  ticker: string,
  benchmark: string = "SP500",
  years: number = 3
): Promise<SectorRelativeStrengthResult> {
  const normalizedTicker = ticker.toUpperCase();

  const [rs, assetTicker, assetBenchmark, liquidityEl] = await Promise.allSettled([
    analyzeRelativeStrength(normalizedTicker, "SPY", years),
    getAssetHistory(normalizedTicker),
    getAssetHistory(benchmark),
    getLiquidityElasticity("global_liquidity", normalizedTicker),
  ]);

  const rsData = rs.status === "fulfilled" ? rs.value : null;
  const tickerAsset = assetTicker.status === "fulfilled" && !("error" in assetTicker.value) ? assetTicker.value : null;
  const benchmarkAsset = assetBenchmark.status === "fulfilled" && !("error" in assetBenchmark.value) ? assetBenchmark.value : null;
  const el = liquidityEl.status === "fulfilled" && !("error" in liquidityEl.value) ? liquidityEl.value : null;

  const tickerPoints: { date: string; value: number }[] = (tickerAsset?.data ?? []).filter(
    (p: any): p is { date: string; value: number } => p.value != null
  );
  const benchmarkPoints: { date: string; value: number }[] = (benchmarkAsset?.data ?? []).filter(
    (p: any): p is { date: string; value: number } => p.value != null
  );

  const normalizedTickerSeries = normalizeSeries(tickerPoints);
  const normalizedBenchmarkSeries = normalizeSeries(benchmarkPoints);

  const tickerMap = new Map(normalizedTickerSeries.map((p) => [p.date, p.value]));
  const benchmarkMap = new Map(normalizedBenchmarkSeries.map((p) => [p.date, p.value]));

  const allDates = new Set([...tickerMap.keys(), ...benchmarkMap.keys()]);
  const series = [...allDates].sort().map((date) => {
    const t = tickerMap.get(date);
    const b = benchmarkMap.get(date);
    return {
      date,
      tickerNormalized: r(t, 2) ?? 100,
      benchmarkNormalized: r(b, 2) ?? 100,
      relativeRatio: t != null && b != null && b !== 0 ? r(t / b, 3) : null,
    };
  });

  const alpha = rsData?.alpha ?? null;
  const beta = rsData?.beta ?? null;
  const sharpe = rsData?.tickerVolatility ? (rsData.tickerReturn ?? 0) / (rsData.tickerVolatility || 1) * Math.sqrt(252) : null;
  const liquidityBeta = el ? (el as any).regression?.beta ?? null : null;
  const liquidityR2 = el ? (el as any).regression?.r2 ?? null : null;

  // Momentum score from relative-strength score if available, otherwise synthesize.
  let score = rsData?.score ?? 50;
  if (alpha != null && alpha > 0) score += 5;
  if (alpha != null && alpha < 0) score -= 5;
  if (liquidityBeta != null && liquidityR2 != null && liquidityR2 >= 0.1) score += Math.min(10, Math.max(-10, liquidityBeta * 4));
  score = Math.max(0, Math.min(100, score));

  const noData = !rsData && tickerPoints.length === 0;
  const verdict = rotationLabel(score, alpha, noData);

  const summary = noData
    ? `${normalizedTicker}: no relative strength data available vs ${benchmark}.`
    : `${normalizedTicker} is ${verdict.toLowerCase()} vs ${benchmark}: alpha ${r(alpha, 3)}, beta ${r(beta, 2)}, Sharpe ${r(sharpe, 2)}, liquidity beta ${r(liquidityBeta, 2)} (R² ${r(liquidityR2, 2)}).`;

  return {
    ticker: normalizedTicker,
    benchmark,
    summary,
    verdict,
    score: r(score, 1) ?? 0,
    alpha: r(alpha, 4),
    beta: r(beta, 3),
    sharpe: r(sharpe, 2),
    liquidityBeta: r(liquidityBeta, 3),
    liquidityR2: r(liquidityR2, 3),
    tickerReturn: r(rsData?.tickerReturn != null ? rsData.tickerReturn * 100 : null, 2),
    benchmarkReturn: r(rsData?.benchmarkReturn != null ? rsData.benchmarkReturn * 100 : null, 2),
    monthsOutperforming: rsData?.monthsOutperforming ?? null,
    totalMonths: rsData?.totalMonths ?? null,
    series,
    metadata: {
      generatedAt: new Date().toISOString(),
      fromCache:
        (rs.status === "fulfilled" ? rs.value.fromCache : true) &&
        (assetTicker.status === "fulfilled" ? true : true) &&
        (assetBenchmark.status === "fulfilled" ? true : true) &&
        (liquidityEl.status === "fulfilled" ? true : true),
      sources: ["finnhub", "yahoo", "fred"],
    },
  };
}

export const getSectorRelativeStrengthTool = {
  name: "get_sector_relative_strength",
  description:
    "Analyze a sector proxy's relative strength vs a benchmark and its sensitivity to global liquidity. Returns a rotation verdict (Leading / Improving / Stable / Weakening / Lagging / No Data), alpha, beta, Sharpe, liquidity beta, and graphable normalized comparison series.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Sector proxy ticker or asset key, e.g. XLK, AAPL, SP500" },
      benchmark: { type: "string", description: "Benchmark asset key (default: SP500)", default: "SP500" },
      years: { type: "number", description: "Years to analyze (default 3, max 20)", default: 3 },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, benchmark, years } = GetSectorRelativeStrengthInput.parse(args);
    return await getSectorRelativeStrength(ticker, benchmark, years);
  },
};
