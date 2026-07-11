/**
 * find_smart_money_convergence — combo tool
 *
 * Detects when multiple "smart money" groups (insiders, institutions, funds, and
 * Congress) are aligned on the same ticker. Returns a descriptive convergence
 * verdict, overlap score, and per-group signals.
 */

import { z } from "zod";
import {
  fetchInsiderTransactions,
  fetchInstitutionalOwnership,
  fetchFundOwnership,
  fetchStockQuote,
  fetchCongressTrades,
} from "../../lib/combo-fetchers.js";
import { convergenceLabel, r } from "../../lib/verdicts.js";

export const FindSmartMoneyConvergenceInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  lookbackDays: z.number().min(1).max(365).default(90).describe("How many days back to analyze (default 90)"),
});

export type FindSmartMoneyConvergenceInput = z.infer<typeof FindSmartMoneyConvergenceInput>;

export interface SmartMoneyConvergenceResult {
  ticker: string;
  summary: string;
  verdict: string;
  score: number;
  overlapCount: number;
  lookbackDays: number;
  windowStart: string;
  windowEnd: string;
  signals: {
    insider: "buying" | "selling" | "neutral" | "no_data";
    institutions: "buying" | "selling" | "neutral" | "no_data";
    funds: "buying" | "selling" | "neutral" | "no_data";
    congress: "buying" | "selling" | "neutral" | "no_data";
  };
  details: {
    insider: {
      buyCount: number;
      sellCount: number;
      netBuyValue: number | null;
    };
    institutions: {
      increasing: number;
      decreasing: number;
      totalValue: number | null;
    };
    funds: {
      increasing: number;
      decreasing: number;
      totalValue: number | null;
    };
    congress: {
      buyTrades: number;
      sellTrades: number;
      totalValue: number | null;
    };
  };
  highlights: string[];
  table: { label: string; value: string; note?: string }[];
  metadata: {
    generatedAt: string;
    fromCache: boolean;
    sources: string[];
    errors?: Record<string, string | undefined>;
  };
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0]!;
}

export async function findSmartMoneyConvergence(
  ticker: string,
  lookbackDays: number = 90
): Promise<SmartMoneyConvergenceResult> {
  const normalizedTicker = ticker.toUpperCase();
  const from = daysAgo(lookbackDays);
  const to = new Date().toISOString().split("T")[0]!;

  const [insiderRes, instRes, fundRes, congressRes, quoteRes] = await Promise.allSettled([
    fetchInsiderTransactions(normalizedTicker, from, to),
    fetchInstitutionalOwnership(normalizedTicker),
    fetchFundOwnership(normalizedTicker),
    fetchCongressTrades(normalizedTicker, from, to),
    fetchStockQuote(normalizedTicker),
  ]);

  const tx = insiderRes.status === "fulfilled" && insiderRes.value ? insiderRes.value.transactions : [];
  const instOwners = instRes.status === "fulfilled" && instRes.value ? instRes.value.owners : [];
  const fundOwners = fundRes.status === "fulfilled" && fundRes.value ? fundRes.value.owners : [];
  const congressTrades = congressRes.status === "fulfilled" && congressRes.value ? congressRes.value.trades : [];
  const latestPrice = quoteRes.status === "fulfilled" && quoteRes.value ? quoteRes.value.data.c : null;

  // Enrich insider values when Finnhub returns price=0/value=0 (common on free tier).
  const enrichedTx = tx.map((t) => ({
    ...t,
    value: t.value > 0 ? t.value : Math.abs(t.change) * (t.price > 0 ? t.price : (latestPrice ?? 0)),
  }));

  // Insider signal — use share change direction when dollar values are unavailable.
  const insiderBuys = enrichedTx.filter((t) => t.isBuy);
  const insiderSells = enrichedTx.filter((t) => !t.isBuy);
  const insiderNetBuy = insiderBuys.reduce((s, t) => s + t.value, 0) - insiderSells.reduce((s, t) => s + t.value, 0);
  const insiderNetChange = insiderBuys.reduce((s, t) => s + t.change, 0) - insiderSells.reduce((s, t) => s + Math.abs(t.change), 0);
  const insiderSignal: SmartMoneyConvergenceResult["signals"]["insider"] =
    tx.length === 0 ? "no_data"
    : insiderNetBuy !== 0 ? (insiderNetBuy > 0 ? "buying" : "selling")
    : insiderNetChange !== 0 ? (insiderNetChange > 0 ? "buying" : "selling")
    : "neutral";

  // Institution signal (change field when available).
  const instIncreasing = instOwners.filter((o) => o.change > 0).length;
  const instDecreasing = instOwners.filter((o) => o.change < 0).length;
  const instTotalValue = instOwners.reduce((s, o) => s + (o.value || 0), 0);
  const institutionsSignal: SmartMoneyConvergenceResult["signals"]["institutions"] =
    instOwners.length === 0 ? "no_data" : instIncreasing > instDecreasing ? "buying" : instDecreasing > instIncreasing ? "selling" : "neutral";

  // Fund signal.
  const fundIncreasing = fundOwners.filter((o) => o.change > 0).length;
  const fundDecreasing = fundOwners.filter((o) => o.change < 0).length;
  const fundTotalValue = fundOwners.reduce((s, o) => s + (o.value || 0), 0);
  const fundsSignal: SmartMoneyConvergenceResult["signals"]["funds"] =
    fundOwners.length === 0 ? "no_data" : fundIncreasing > fundDecreasing ? "buying" : fundDecreasing > fundIncreasing ? "selling" : "neutral";

  // Congress signal.
  const congressBuys = congressTrades.filter((t) => t.type.toLowerCase().includes("buy") || t.type.toLowerCase() === "purchase");
  const congressSells = congressTrades.filter((t) => t.type.toLowerCase().includes("sell"));
  const congressTotalValue = congressTrades.reduce((s, t) => {
    const mid = parseAmountMidpoint(t.amount);
    return s + (mid || 0);
  }, 0);
  const congressSignal: SmartMoneyConvergenceResult["signals"]["congress"] =
    congressTrades.length === 0 ? "no_data" : congressBuys.length > congressSells.length ? "buying" : congressSells.length > congressBuys.length ? "selling" : "neutral";

  // Overlap and score.
  const bullish = [insiderSignal, institutionsSignal, fundsSignal, congressSignal].filter((s) => s === "buying").length;
  const bearish = [insiderSignal, institutionsSignal, fundsSignal, congressSignal].filter((s) => s === "selling").length;
  const withData = [insiderSignal, institutionsSignal, fundsSignal, congressSignal].filter((s) => s !== "no_data").length;

  const overlapCount = bullish;
  let score = 0;
  if (withData > 0) score = 30; // base for having any data
  score += overlapCount * 18;
  if (insiderSignal === "buying") score += 12;
  if (institutionsSignal === "buying") score += 6;
  if (fundsSignal === "buying") score += 6;
  if (congressSignal === "buying") score += 6;
  if (bearish > 0) score -= bearish * 8;
  score = Math.max(0, Math.min(100, score));

  const noData = withData === 0;
  const verdict = convergenceLabel(score, overlapCount, noData);

  const highlights: string[] = [];
  if (insiderSignal === "buying") highlights.push(`${insiderBuys.length} insider purchase${insiderBuys.length === 1 ? "" : "s"} in the last ${lookbackDays} days`);
  if (institutionsSignal === "buying") highlights.push(`${instIncreasing} institutions increased stakes`);
  if (fundsSignal === "buying") highlights.push(`${fundIncreasing} funds increased stakes`);
  if (congressSignal === "buying") highlights.push(`${congressBuys.length} congressional buy${congressBuys.length === 1 ? "" : "s"}`);

  const table: SmartMoneyConvergenceResult["table"] = [
    { label: "Insiders", value: insiderSignal, note: insiderSignal !== "no_data" ? `${insiderBuys.length} buys / ${insiderSells.length} sells` : undefined },
    { label: "Institutions", value: institutionsSignal, note: institutionsSignal !== "no_data" ? `${instIncreasing} up / ${instDecreasing} down` : undefined },
    { label: "Funds", value: fundsSignal, note: fundsSignal !== "no_data" ? `${fundIncreasing} up / ${fundDecreasing} down` : undefined },
    { label: "Congress", value: congressSignal, note: congressSignal !== "no_data" ? `${congressBuys.length} buys / ${congressSells.length} sells` : undefined },
  ];

  const summary = noData
    ? `${normalizedTicker}: no smart-money data available for the last ${lookbackDays} days.`
    : `${normalizedTicker} shows ${verdict.toLowerCase()}: ${overlapCount} of 4 smart-money groups are bullish${highlights.length ? " (" + highlights.join("; ") + ")" : ""}.`;

  return {
    ticker: normalizedTicker,
    summary,
    verdict,
    score: r(score, 1) ?? 0,
    overlapCount,
    lookbackDays,
    windowStart: from,
    windowEnd: to,
    signals: {
      insider: insiderSignal,
      institutions: institutionsSignal,
      funds: fundsSignal,
      congress: congressSignal,
    },
    details: {
      insider: {
        buyCount: insiderBuys.length,
        sellCount: insiderSells.length,
        netBuyValue: r(insiderNetBuy, 2),
      },
      institutions: {
        increasing: instIncreasing,
        decreasing: instDecreasing,
        totalValue: r(instTotalValue, 2),
      },
      funds: {
        increasing: fundIncreasing,
        decreasing: fundDecreasing,
        totalValue: r(fundTotalValue, 2),
      },
      congress: {
        buyTrades: congressBuys.length,
        sellTrades: congressSells.length,
        totalValue: r(congressTotalValue, 2),
      },
    },
    highlights,
    table,
    metadata: {
      generatedAt: new Date().toISOString(),
      fromCache: false,
      sources: [
        insiderRes.status === "fulfilled" && insiderRes.value ? insiderRes.value.source : "",
        instRes.status === "fulfilled" && instRes.value ? instRes.value.source : "",
        fundRes.status === "fulfilled" && fundRes.value ? fundRes.value.source : "",
        congressRes.status === "fulfilled" && congressRes.value ? congressRes.value.source : "",
        quoteRes.status === "fulfilled" && quoteRes.value ? quoteRes.value.source : "",
      ].filter(Boolean),
      errors: {
        insider: insiderRes.status === "rejected" ? insiderRes.reason?.message : undefined,
        institutions: instRes.status === "rejected" ? instRes.reason?.message : undefined,
        funds: fundRes.status === "rejected" ? fundRes.reason?.message : undefined,
        congress: congressRes.status === "rejected" ? congressRes.reason?.message : undefined,
      },
    },
  };
}

function parseAmountMidpoint(amount: string): number | null {
  if (!amount) return null;
  const matches = amount.match(/[\d,]+/g);
  if (!matches) return null;
  const nums = matches.map((m) => parseInt(m.replace(/,/g, ""), 10)).filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  if (nums.length === 1) return nums[0]!;
  return Math.round((nums[0]! + nums[1]!) / 2);
}

export const findSmartMoneyConvergenceTool = {
  name: "find_smart_money_convergence",
  description:
    "Find when insiders, institutions, funds, and Congress are aligned on a ticker. Returns a convergence verdict (Very High / High / Moderate / Mixed Signals / No Convergence / No Data), a 0-100 score, per-group signals, and a summary table.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      lookbackDays: { type: "number", description: "How many days back to analyze (default 90, max 365)", default: 90 },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, lookbackDays } = FindSmartMoneyConvergenceInput.parse(args);
    return await findSmartMoneyConvergence(ticker, lookbackDays);
  },
};
