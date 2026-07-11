/**
 * analyze_earnings_momentum — combo tool
 *
 * Combines earnings surprises, analyst recommendations, price targets and
 * upgrades/downgrades into a single earnings/analyst momentum score with a
 * descriptive verdict and graphable series.
 */

import { z } from "zod";
import {
  fetchEarningsSurprise,
  fetchRecommendationTrends,
  fetchPriceTarget,
  fetchUpgradeDowngrade,
} from "../../lib/combo-fetchers.js";
import { momentumLabel, trendDirection, r } from "../../lib/verdicts.js";

export const AnalyzeEarningsMomentumInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type AnalyzeEarningsMomentumInput = z.infer<typeof AnalyzeEarningsMomentumInput>;

export interface EarningsMomentumResult {
  ticker: string;
  summary: string;
  verdict: string;
  score: number;
  beatStreak: number;
  missStreak: number;
  surpriseAvgPct: number | null;
  surpriseCount: number;
  buyPct: number | null;
  buyPctPrior: number | null;
  recommendationTrend: "rising" | "falling" | "stable" | "unknown";
  priceTargetMean: number | null;
  priceTargetChangePct: number | null;
  upgrades90d: number;
  downgrades90d: number;
  upgradeDowngradeFlow: number;
  series: {
    period: string;
    surprisePct: number;
    buyPct: number | null;
    holdPct: number | null;
    sellPct: number | null;
  }[];
  metadata: {
    generatedAt: string;
    fromCache: boolean;
    sources: string[];
  };
}

function buyPctOfTrend(t: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }): number {
  const total = t.strongBuy + t.buy + t.hold + t.sell + t.strongSell;
  if (total === 0) return 0;
  return ((t.strongBuy + t.buy) / total) * 100;
}

export async function analyzeEarningsMomentum(ticker: string): Promise<EarningsMomentumResult> {
  const normalizedTicker = ticker.toUpperCase();

  const [earningsRes, recsRes, ptRes, udRes] = await Promise.allSettled([
    fetchEarningsSurprise(normalizedTicker),
    fetchRecommendationTrends(normalizedTicker),
    fetchPriceTarget(normalizedTicker),
    fetchUpgradeDowngrade(normalizedTicker),
  ]);

  const surprises = earningsRes.status === "fulfilled" && earningsRes.value ? earningsRes.value.surprises : [];
  const trends = recsRes.status === "fulfilled" && recsRes.value ? recsRes.value.trends : [];
  const target = ptRes.status === "fulfilled" && ptRes.value ? ptRes.value.target : null;
  const actions = udRes.status === "fulfilled" && udRes.value ? udRes.value.actions : [];

  // Earnings streaks and average surprise.
  let beatStreak = 0;
  let missStreak = 0;
  for (const s of surprises) {
    if (s.surprisePercent > 0) {
      beatStreak++;
      missStreak = 0;
    } else if (s.surprisePercent < 0) {
      missStreak++;
      beatStreak = 0;
    }
  }
  const validSurprises = surprises.filter((s) => Number.isFinite(s.surprisePercent));
  const surpriseAvgPct = validSurprises.length
    ? validSurprises.reduce((sum, s) => sum + s.surprisePercent, 0) / validSurprises.length
    : null;

  // Recommendation trend.
  const sortedTrends = [...trends].sort((a, b) => a.period.localeCompare(b.period));
  const latestTrend = sortedTrends[sortedTrends.length - 1];
  const priorTrend = sortedTrends[sortedTrends.length - 2];
  const buyPct = latestTrend ? buyPctOfTrend(latestTrend) : null;
  const buyPctPrior = priorTrend ? buyPctOfTrend(priorTrend) : null;
  const recommendationTrend = trendDirection(buyPct, buyPctPrior, 0.02);

  // Price target change from pre to post earnings mean (if available), else mean only.
  let priceTargetMean: number | null = null;
  let priceTargetChangePct: number | null = null;
  if (target) {
    priceTargetMean = target.mean || target.postMean || target.preMean || null;
    if (target.preMean && target.postMean && target.preMean > 0) {
      priceTargetChangePct = ((target.postMean - target.preMean) / target.preMean) * 100;
    }
  }

  // Upgrades/downgrades in the last 90 days.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const recentActions = actions.filter((a) => {
    if (!a.gradeTime) return false;
    const t = new Date(a.gradeTime).getTime();
    return Number.isFinite(t) && t >= cutoff.getTime();
  });
  const upgrades90d = recentActions.filter((a) =>
    ["Upgrade", "upgrade", "Upgrade to", "Reiterated Buy", "Initiated Buy"].some((u) => a.action.includes(u))
  ).length;
  const downgrades90d = recentActions.filter((a) =>
    ["Downgrade", "downgrade", "Downgrade to", "Reiterated Sell", "Initiated Sell"].some((u) => a.action.includes(u))
  ).length;
  const upgradeDowngradeFlow = upgrades90d - downgrades90d;

  // Score: beats, recommendation direction, price target change, upgrade flow.
  let score = 50;
  if (beatStreak >= 4) score += 15;
  else if (beatStreak >= 2) score += 8;
  if (surpriseAvgPct != null) score += Math.min(10, Math.max(-10, surpriseAvgPct / 5));
  if (recommendationTrend === "rising") score += 10;
  else if (recommendationTrend === "falling") score -= 10;
  if (priceTargetChangePct != null) score += Math.min(10, Math.max(-10, priceTargetChangePct / 5));
  score += Math.min(10, Math.max(-10, upgradeDowngradeFlow * 2));
  score = Math.max(0, Math.min(100, score));

  const noData = surprises.length === 0 && trends.length === 0 && actions.length === 0;
  const verdict = noData ? "No Data" : momentumLabel(score);

  // Merge recommendation periods with surprise periods for a graphable series.
  const periodMap = new Map<string, { surprisePct: number | null; buyPct: number | null; holdPct: number | null; sellPct: number | null }>();
  for (const s of surprises) {
    const key = s.period || `${s.year}-Q${s.quarter}`;
    periodMap.set(key, { ...(periodMap.get(key) || { buyPct: null, holdPct: null, sellPct: null }), surprisePct: s.surprisePercent });
  }
  for (const t of sortedTrends) {
    const total = t.strongBuy + t.buy + t.hold + t.sell + t.strongSell;
    const existing = periodMap.get(t.period) || { surprisePct: null, buyPct: null, holdPct: null, sellPct: null };
    if (total > 0) {
      existing.buyPct = ((t.strongBuy + t.buy) / total) * 100;
      existing.holdPct = (t.hold / total) * 100;
      existing.sellPct = ((t.sell + t.strongSell) / total) * 100;
    }
    periodMap.set(t.period, existing);
  }
  const series = [...periodMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, v]) => ({
    period,
    surprisePct: r(v.surprisePct, 2) ?? 0,
    buyPct: r(v.buyPct, 1),
    holdPct: r(v.holdPct, 1),
    sellPct: r(v.sellPct, 1),
  }));

  const summary = noData
    ? `${normalizedTicker}: no earnings, recommendation, or upgrade/downgrade data available.`
    : `${normalizedTicker} earnings momentum is ${verdict.toLowerCase()}: ${beatStreak}-quarter beat streak, avg surprise ${r(surpriseAvgPct, 1) ?? 0}%, buy ratings ${recommendationTrend}${priceTargetChangePct != null ? ` and price target moved ${r(priceTargetChangePct, 1)}%` : ""}.`;

  return {
    ticker: normalizedTicker,
    summary,
    verdict,
    score: r(score, 1) ?? 0,
    beatStreak,
    missStreak,
    surpriseAvgPct: r(surpriseAvgPct, 2),
    surpriseCount: validSurprises.length,
    buyPct: r(buyPct, 1),
    buyPctPrior: r(buyPctPrior, 1),
    recommendationTrend,
    priceTargetMean: r(priceTargetMean, 2),
    priceTargetChangePct: r(priceTargetChangePct, 2),
    upgrades90d,
    downgrades90d,
    upgradeDowngradeFlow,
    series,
    metadata: {
      generatedAt: new Date().toISOString(),
      fromCache: true,
      sources: [
        earningsRes.status === "fulfilled" && earningsRes.value ? earningsRes.value.source : "",
        recsRes.status === "fulfilled" && recsRes.value ? recsRes.value.source : "",
        ptRes.status === "fulfilled" && ptRes.value ? ptRes.value.source : "",
        udRes.status === "fulfilled" && udRes.value ? udRes.value.source : "",
      ].filter(Boolean),
    },
  };
}

export const analyzeEarningsMomentumTool = {
  name: "analyze_earnings_momentum",
  description:
    "Analyze earnings and analyst momentum for a ticker. Combines earnings surprises, recommendation trends, price targets, and upgrades/downgrades into a descriptive verdict (Strong / Improving / Stable / Softening / Weak / No Data), a 0-100 score, and a graphable period-by-period series.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = AnalyzeEarningsMomentumInput.parse(args);
    return await analyzeEarningsMomentum(ticker);
  },
};
