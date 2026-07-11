/**
 * analyze_shareholder_yield — combo tool
 *
 * Computes total shareholder yield (dividend yield + implied buyback yield)
 * for a ticker. Uses dividend history, splits, fundamentals, and the latest
 * stock quote. Returns a descriptive yield label, sustainability flag, and
 * graphable annual breakdown.
 */

import { z } from "zod";
import {
  fetchDividends,
  fetchSplits,
  fetchFundamentalMetrics,
  fetchStockQuote,
} from "../../lib/combo-fetchers.js";
import { yieldLabel, r } from "../../lib/verdicts.js";

export const AnalyzeShareholderYieldInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  years: z.number().min(1).max(20).default(5).describe("How many years back to analyze (default 5)"),
});

export type AnalyzeShareholderYieldInput = z.infer<typeof AnalyzeShareholderYieldInput>;

export interface ShareholderYieldResult {
  ticker: string;
  summary: string;
  verdict: string;
  score: number;
  dividendYield: number | null;
  impliedBuybackYield: number | null;
  totalShareholderYield: number | null;
  sustainability: "Safe" | "Caution" | "Stretched" | "Unknown";
  payoutRatioEstimate: number | null;
  latestPrice: number | null;
  annualDividend: number | null;
  yearsAnalyzed: number;
  series: {
    fiscalYear: number;
    dividendYield: number;
    buybackYield: number;
    totalYield: number;
    dividendPerShare: number;
  }[];
  metadata: {
    generatedAt: string;
    fromCache: boolean;
    sources: string[];
  };
}

function fiscalYearForDate(date: string): number {
  const [yStr, mStr] = date.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  return m >= 7 ? y + 1 : y;
}

export async function analyzeShareholderYield(
  ticker: string,
  years: number = 5
): Promise<ShareholderYieldResult> {
  const normalizedTicker = ticker.toUpperCase();
  const to = new Date().toISOString().split("T")[0]!;
  const fromDate = new Date();
  fromDate.setFullYear(fromDate.getFullYear() - years);
  const from = fromDate.toISOString().split("T")[0]!;

  const [dividendsRes, splitsRes, fundamentalsRes, quoteRes] = await Promise.allSettled([
    fetchDividends(normalizedTicker, from, to),
    fetchSplits(normalizedTicker, from, to),
    fetchFundamentalMetrics(normalizedTicker),
    fetchStockQuote(normalizedTicker),
  ]);

  const dividends = dividendsRes.status === "fulfilled" && dividendsRes.value ? dividendsRes.value.dividends : [];
  const splits = splitsRes.status === "fulfilled" && splitsRes.value ? splitsRes.value.splits : [];
  const fundamentals = fundamentalsRes.status === "fulfilled" && fundamentalsRes.value ? fundamentalsRes.value.metrics : null;
  const latestPrice = quoteRes.status === "fulfilled" && quoteRes.value ? quoteRes.value.data.c : null;

  // Annualize dividends by fiscal year.
  const byYear = new Map<number, { dps: number; splits: number[] }>();
  for (const d of dividends) {
    const year = fiscalYearForDate(d.date);
    const entry = byYear.get(year) || { dps: 0, splits: [] };
    entry.dps += d.dividend || d.adjustedDividend || 0;
    byYear.set(year, entry);
  }
  for (const s of splits) {
    const year = fiscalYearForDate(s.date);
    const entry = byYear.get(year) || { dps: 0, splits: [] };
    const ratio = s.toFactor && s.fromFactor ? s.toFactor / s.fromFactor : 1;
    entry.splits.push(ratio);
    byYear.set(year, entry);
  }

  // Sort years and compute yields.
  const sortedYears = [...byYear.entries()]
    .filter(([year]) => year <= new Date().getFullYear())
    .sort(([a], [b]) => a - b);

  let latestDps = 0;
  const series: ShareholderYieldResult["series"] = [];
  for (let i = 0; i < sortedYears.length; i++) {
    const [year, { dps }] = sortedYears[i]!;
    // Very rough buyback proxy: compare change in DPS-adjusted payout to prior year.
    // Real buyback yield needs shares outstanding; we estimate via split-adjusted dividend growth gap.
    const prev = sortedYears[i - 1];
    let buybackYield = 0;
    if (prev) {
      const prevDps = prev[1].dps;
      if (prevDps > 0) {
        const dpsGrowth = (dps - prevDps) / prevDps;
        // If DPS grew faster than 10% p.a. we attribute the excess above 10% to buyback effect.
        buybackYield = Math.max(0, dpsGrowth - 0.1);
      }
    }
    const divYield = latestPrice && latestPrice > 0 ? dps / latestPrice : 0;
    const totalYield = divYield + buybackYield;
    if (i === sortedYears.length - 1) latestDps = dps;
    series.push({
      fiscalYear: year,
      dividendYield: r(divYield * 100, 2) ?? 0,
      buybackYield: r(buybackYield * 100, 2) ?? 0,
      totalYield: r(totalYield * 100, 2) ?? 0,
      dividendPerShare: r(dps, 3) ?? 0,
    });
  }

  const currentTotalYield = series.length ? series[series.length - 1]!.totalYield / 100 : 0;
  const currentDivYield = series.length ? series[series.length - 1]!.dividendYield / 100 : 0;
  const currentBuybackYield = series.length ? series[series.length - 1]!.buybackYield / 100 : 0;

  // Payout ratio estimate = dividend per share / EPS if available.
  let payoutRatioEstimate: number | null = null;
  if (fundamentals?.epsTTM && fundamentals.epsTTM > 0 && latestDps > 0) {
    payoutRatioEstimate = latestDps / fundamentals.epsTTM;
  }

  // Sustainability.
  let sustainability: ShareholderYieldResult["sustainability"] = "Unknown";
  if (payoutRatioEstimate != null) {
    if (payoutRatioEstimate <= 0.6) sustainability = "Safe";
    else if (payoutRatioEstimate <= 0.9) sustainability = "Caution";
    else sustainability = "Stretched";
  }

  // Score: total yield percentile-ish 0-100, capped by sustainability.
  let score = Math.min(100, currentTotalYield * 100 * 12); // ~8% yield → ~96
  if (sustainability === "Stretched") score -= 25;
  else if (sustainability === "Caution") score -= 10;
  else if (sustainability === "Unknown") score -= 5;
  score = Math.max(0, Math.min(100, score));

  const noData = dividends.length === 0 && fundamentals == null;
  const verdict = noData ? "No Data" : yieldLabel(currentTotalYield);

  const summary = noData
    ? `${normalizedTicker}: no dividend or fundamental data available to compute shareholder yield.`
    : `${normalizedTicker} shareholder yield is ${verdict.toLowerCase()}: ${r(currentTotalYield * 100, 2)}% total (${r(currentDivYield * 100, 2)}% dividend + ${r(currentBuybackYield * 100, 2)}% buyback proxy), payout sustainability is ${sustainability.toLowerCase()}.`;

  return {
    ticker: normalizedTicker,
    summary,
    verdict,
    score: r(score, 1) ?? 0,
    dividendYield: r(currentDivYield * 100, 2),
    impliedBuybackYield: r(currentBuybackYield * 100, 2),
    totalShareholderYield: r(currentTotalYield * 100, 2),
    sustainability,
    payoutRatioEstimate: r(payoutRatioEstimate, 2),
    latestPrice: r(latestPrice, 2),
    annualDividend: r(latestDps, 3),
    yearsAnalyzed: series.length,
    series,
    metadata: {
      generatedAt: new Date().toISOString(),
      fromCache: true,
      sources: [
        dividendsRes.status === "fulfilled" && dividendsRes.value ? dividendsRes.value.source : "",
        splitsRes.status === "fulfilled" && splitsRes.value ? splitsRes.value.source : "",
        fundamentalsRes.status === "fulfilled" && fundamentalsRes.value ? fundamentalsRes.value.source : "",
        quoteRes.status === "fulfilled" && quoteRes.value ? quoteRes.value.source : "",
      ].filter(Boolean),
    },
  };
}

export const analyzeShareholderYieldTool = {
  name: "analyze_shareholder_yield",
  description:
    "Analyze total shareholder yield for a ticker (dividend yield + implied buyback proxy). Returns a yield label (No Yield / Low / Moderate / High / Very High / No Data), sustainability assessment, and annual graphable series.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      years: { type: "number", description: "Years back to analyze (default 5, max 20)", default: 5 },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, years } = AnalyzeShareholderYieldInput.parse(args);
    return await analyzeShareholderYield(ticker, years);
  },
};
