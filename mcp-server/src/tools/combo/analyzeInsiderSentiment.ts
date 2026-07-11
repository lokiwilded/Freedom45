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
  nonMarketTransactions: { insiderName: string; date: string; code: string; codeDescription: string; shares: number; estimatedValue: number }[];
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

const TX_CODE_DESCRIPTIONS: Record<string, string> = {
  M: "Option exercise",
  G: "Gift",
  F: "Tax withholding",
  D: "Distribution",
  A: "Grant",
  J: "Other",
  C: "Conversion",
  W: "Warrant",
  L: "Small purchase (<$10k)",
  H: "Expiration of derivative",
};

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
  const nonMarket = enrichedTx.filter((t) => !t.isBuy && !t.isSell);

  const nonMarketTransactions = nonMarket
    .map((t) => {
      const code = (t.transactionCode || "").toUpperCase();
      const estVal = t.value > 0 ? t.value : Math.abs(t.change) * (t.price > 0 ? t.price : (latestPrice ?? 0));
      return {
        insiderName: t.insiderName || t.name,
        date: t.transactionDate || t.filingDate,
        code,
        codeDescription: TX_CODE_DESCRIPTIONS[code] ?? code,
        shares: Math.abs(t.change),
        estimatedValue: r(estVal, 0) ?? 0,
      };
    })
    .sort((a, b) => b.estimatedValue - a.estimatedValue);

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
    : `${normalizedTicker} shows ${verdict.toLowerCase()} over the last ${lookbackDays} days: ${buys.length} purchase${buys.length === 1 ? "" : "s"} vs ${sells.length} sale${sells.length === 1 ? "" : "s"}, with net insider ${netBuyValue >= 0 ? "buy" : "sell"} value of $${r(Math.abs(netBuyValue) / 1e6, 1) ?? 0}M.` +
      (nonMarketTransactions.length > 0 ? ` ${nonMarketTransactions.length} non-market transaction${nonMarketTransactions.length === 1 ? "" : "s"} (exercises, grants, gifts) also reported — see Non-Market Transactions section.` : "");

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
    nonMarketTransactions,
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
