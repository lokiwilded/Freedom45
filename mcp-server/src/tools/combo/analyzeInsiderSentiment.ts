/**
 * analyze_insider_sentiment — combo tool
 *
 * Scores insider buying/selling pressure for a ticker over a lookback window.
 * Combines insider transactions with company profile (for context) and the latest
 * stock quote. Returns a descriptive verdict, numeric score, and graphable series.
 */

import { z } from "zod";
import {
  fetchInsiderTransactions,
  fetchCompanyProfile,
  fetchStockQuote,
} from "../../lib/combo-fetchers.js";
import { pressureLabel, r } from "../../lib/verdicts.js";

export const AnalyzeInsiderSentimentInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  lookbackDays: z.number().min(1).max(365).default(90).describe("How many days back to analyze (default 90)"),
});

export type AnalyzeInsiderSentimentInput = z.infer<typeof AnalyzeInsiderSentimentInput>;

export interface InsiderSentimentResult {
  ticker: string;
  summary: string;
  verdict: string;
  score: number;
  lookbackDays: number;
  windowStart: string;
  windowEnd: string;
  buyCount: number;
  sellCount: number;
  buySellRatio: number | null;
  totalBuyValue: number | null;
  totalSellValue: number | null;
  netBuyValue: number | null;
  officerBuyValue: number | null;
  officerSellValue: number | null;
  directorBuyValue: number | null;
  directorSellValue: number | null;
  largestBuy: { insiderName: string; date: string; value: number } | null;
  latestPrice: number | null;
  marketCap: number | null;
  series: { date: string; netBuys: number; netBuyValue: number }[];
  metadata: {
    generatedAt: string;
    fromCache: boolean;
    sources: string[];
  };
}

function isOfficer(name: string): boolean {
  const n = name.toUpperCase();
  return /(CEO|CFO|COO|CTO|CMO|CHRO|CIO|EVP|SVP|VP|PRESIDENT|CHIEF)/.test(n);
}

function isDirector(name: string): boolean {
  return name.toUpperCase().includes("DIRECTOR");
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0]!;
}

export async function analyzeInsiderSentiment(
  ticker: string,
  lookbackDays: number = 90
): Promise<InsiderSentimentResult> {
  const normalizedTicker = ticker.toUpperCase();
  const from = daysAgo(lookbackDays);
  const to = new Date().toISOString().split("T")[0]!;

  const [insiderRes, profileRes, quoteRes] = await Promise.allSettled([
    fetchInsiderTransactions(normalizedTicker, from, to),
    fetchCompanyProfile(normalizedTicker),
    fetchStockQuote(normalizedTicker),
  ]);

  const tx = insiderRes.status === "fulfilled" && insiderRes.value ? insiderRes.value.transactions : [];
  const profileData = profileRes.status === "fulfilled" && profileRes.value ? profileRes.value.profile : null;
  const marketCap = profileData?.marketCapitalization ?? null;
  const latestPrice =
    quoteRes.status === "fulfilled" && quoteRes.value ? quoteRes.value.data.c : null;

  // Finnhub free tier often returns price=0 and value=0 for insider transactions.
  // When that happens, estimate value = |share change| × current stock price.
  const enrichedTx = tx.map((t) => {
    const estimatedValue = t.value > 0 ? t.value : Math.abs(t.change) * (t.price > 0 ? t.price : (latestPrice ?? 0));
    return { ...t, value: estimatedValue };
  });

  const buys = enrichedTx.filter((t) => t.isBuy);
  const sells = enrichedTx.filter((t) => t.isSell);

  const sumValue = (arr: typeof tx) =>
    arr.reduce((sum, t) => {
      const v = Number.isFinite(t.value) && t.value > 0 ? t.value : Math.abs(t.change) * t.price;
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);

  const totalBuyValue = sumValue(buys);
  const totalSellValue = sumValue(sells);
  const netBuyValue = totalBuyValue - totalSellValue;

  const officerBuyValue = sumValue(buys.filter((t) => isOfficer(t.insiderName)));
  const officerSellValue = sumValue(sells.filter((t) => isOfficer(t.insiderName)));
  const directorBuyValue = sumValue(buys.filter((t) => isDirector(t.insiderName)));
  const directorSellValue = sumValue(sells.filter((t) => isDirector(t.insiderName)));

  const buySellRatio = sells.length === 0 ? (buys.length > 0 ? Infinity : null) : buys.length / sells.length;

  const largestBuy = buys.length
    ? buys.reduce((biggest, t) => (t.value > biggest.value ? t : biggest), buys[0]!)
    : null;

  // Score: 0-100. Buys vs sells ratio weighted, plus net buy value relative to market cap,
  // capped so a single large trade doesn't dominate.
  let score = 50;
  if (buySellRatio !== null && Number.isFinite(buySellRatio)) {
    score += Math.min(25, (Math.log(buySellRatio + 1) / Math.log(5)) * 25);
  }
  if (marketCap && marketCap > 0 && Number.isFinite(netBuyValue)) {
    const capWeight = Math.min(25, (Math.max(0, netBuyValue) / marketCap) * 1e5);
    score += capWeight;
  }
  if (officerBuyValue > officerSellValue) score += 10;
  if (directorBuyValue > directorSellValue) score += 5;
  score = Math.max(0, Math.min(100, score));

  const noData = tx.length === 0;
  let verdict = pressureLabel(buySellRatio ?? 0, noData);
  if (noData) verdict = "No Data";

  // Daily net-buy series for graphing — only open-market buys/sells.
  const byDate = new Map<string, { netBuys: number; netBuyValue: number }>();
  for (const t of enrichedTx) {
    if (!t.isBuy && !t.isSell) continue;
    const d = t.transactionDate || t.filingDate;
    if (!d) continue;
    const v = t.value > 0 ? t.value : Math.abs(t.change) * (t.price > 0 ? t.price : (latestPrice ?? 0));
    const prev = byDate.get(d) || { netBuys: 0, netBuyValue: 0 };
    prev.netBuys += t.isBuy ? 1 : -1;
    prev.netBuyValue += t.isBuy ? v : -v;
    byDate.set(d, prev);
  }
  const series = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
    date,
    netBuys: v.netBuys,
    netBuyValue: r(v.netBuyValue, 2) ?? 0,
  }));

  const summary = noData
    ? `${normalizedTicker}: no insider transactions reported in the last ${lookbackDays} days.`
    : `${normalizedTicker} shows ${verdict.toLowerCase()} over the last ${lookbackDays} days: ${buys.length} purchase${buys.length === 1 ? "" : "s"} vs ${sells.length} sale${sells.length === 1 ? "" : "s"}, with net insider buy value of $${r(Math.abs(netBuyValue), 2) ?? 0}M.`;

  return {
    ticker: normalizedTicker,
    summary,
    verdict,
    score: r(score, 1) ?? 0,
    lookbackDays,
    windowStart: from,
    windowEnd: to,
    buyCount: buys.length,
    sellCount: sells.length,
    buySellRatio: r(buySellRatio === Infinity ? null : buySellRatio, 2),
    totalBuyValue: r(totalBuyValue, 2),
    totalSellValue: r(totalSellValue, 2),
    netBuyValue: r(netBuyValue, 2),
    officerBuyValue: r(officerBuyValue, 2),
    officerSellValue: r(officerSellValue, 2),
    directorBuyValue: r(directorBuyValue, 2),
    directorSellValue: r(directorSellValue, 2),
    largestBuy: largestBuy
      ? { insiderName: largestBuy.insiderName, date: largestBuy.transactionDate || largestBuy.filingDate, value: r(largestBuy.value, 2) ?? 0 }
      : null,
    latestPrice: r(latestPrice, 2),
    marketCap: marketCap ? r(marketCap / 1e6, 1) : null,
    series,
    metadata: {
      generatedAt: new Date().toISOString(),
      fromCache: insiderRes.status === "fulfilled" && insiderRes.value ? insiderRes.value.fromCache : false,
      sources: [
        insiderRes.status === "fulfilled" && insiderRes.value ? insiderRes.value.source : "",
        profileRes.status === "fulfilled" && profileRes.value ? profileRes.value.source : "",
        quoteRes.status === "fulfilled" && quoteRes.value ? quoteRes.value.source : "",
      ].filter(Boolean),
    },
  };
}

export const analyzeInsiderSentimentTool = {
  name: "analyze_insider_sentiment",
  description:
    "Analyze insider buying/selling pressure for a ticker. Returns a descriptive verdict (Heavy Accumulation / Accumulation / Neutral / Distribution / Heavy Distribution / No Data), a 0-100 score, officer/director splits, and a graphable daily net-buy series.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      lookbackDays: { type: "number", description: "How many days back to analyze (default 90, max 365)", default: 90 },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, lookbackDays } = AnalyzeInsiderSentimentInput.parse(args);
    return await analyzeInsiderSentiment(ticker, lookbackDays);
  },
};
