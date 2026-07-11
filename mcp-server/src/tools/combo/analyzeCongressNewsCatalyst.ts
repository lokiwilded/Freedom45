/**
 * analyze_congress_news_catalyst — combo tool
 *
 * Matches congressional trades for a ticker with nearby company/market news to
 * identify potential catalyst signals. Returns a descriptive catalyst verdict,
 * lead/lag statistics, and graphable event scores.
 */

import { z } from "zod";
import {
  fetchCongressTrades,
  fetchCompanyNews,
  fetchMarketNews,
} from "../../lib/combo-fetchers.js";
import { catalystLabel, r } from "../../lib/verdicts.js";

export const AnalyzeCongressNewsCatalystInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  lookbackDays: z.number().min(1).max(365).default(90).describe("How many days back to analyze (default 90)"),
});

export type AnalyzeCongressNewsCatalystInput = z.infer<typeof AnalyzeCongressNewsCatalystInput>;

export interface CongressNewsCatalystResult {
  ticker: string;
  summary: string;
  verdict: string;
  score: number;
  lookbackDays: number;
  windowStart: string;
  windowEnd: string;
  tradeCount: number;
  tradesWithNews: {
    politician: string;
    date: string;
    type: string;
    amount: string;
    matchedNewsDate: string | null;
    daysOffset: number | null;
    headline: string | null;
    source: string | null;
    catalystScore: number;
  }[];
  leadDaysAvg: number | null;
  leadDaysMedian: number | null;
  newsBeforeTrade: number;
  newsAfterTrade: number;
  series: {
    date: string;
    catalystScore: number;
    type: "trade" | "news";
    headline?: string;
  }[];
  metadata: {
    generatedAt: string;
    fromCache: boolean;
    sources: string[];
  };
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0]!;
}

function parseTradeDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isFinite(d.getTime()) ? d : null;
}

function parseNewsDate(datetime: number | string | undefined): Date | null {
  if (datetime == null) return null;
  const d = new Date(typeof datetime === "number" ? datetime * 1000 : datetime);
  return Number.isFinite(d.getTime()) ? d : null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export async function analyzeCongressNewsCatalyst(
  ticker: string,
  lookbackDays: number = 90
): Promise<CongressNewsCatalystResult> {
  const normalizedTicker = ticker.toUpperCase();
  const from = daysAgo(lookbackDays);
  const to = new Date().toISOString().split("T")[0]!;

  const [congressRes, companyNewsRes, marketNewsRes] = await Promise.allSettled([
    fetchCongressTrades(normalizedTicker, from, to),
    fetchCompanyNews(normalizedTicker, from, to),
    fetchMarketNews("general"),
  ]);

  const trades = congressRes.status === "fulfilled" && congressRes.value ? congressRes.value.trades : [];
  const companyNews = companyNewsRes.status === "fulfilled" && companyNewsRes.value ? companyNewsRes.value.news : [];
  const marketNews = marketNewsRes.status === "fulfilled" && marketNewsRes.value ? marketNewsRes.value.news : [];

  // Build news index keyed by date.
  const allNews = [
    ...companyNews.map((n: any) => ({
      date: parseNewsDate(n.datetime),
      headline: n.headline || n.title || "",
      source: n.source || "company",
    })),
    ...marketNews
      .filter((n: any) => {
        const text = `${n.headline || ""} ${n.summary || ""}`.toUpperCase();
        return text.includes(normalizedTicker);
      })
      .map((n: any) => ({
        date: parseNewsDate(n.datetime),
        headline: n.headline || n.title || "",
        source: n.source || "market",
      })),
  ];

  const newsByDate = new Map<string, { headline: string; source: string }[]>();
  for (const n of allNews) {
    if (!n.date) continue;
    const key = n.date.toISOString().split("T")[0]!;
    const arr = newsByDate.get(key) || [];
    arr.push({ headline: n.headline, source: n.source });
    newsByDate.set(key, arr);
  }

  // Match each trade to nearest news.
  let totalLead = 0;
  let leadCount = 0;
  const leadDaysList: number[] = [];
  let newsBeforeTrade = 0;
  let newsAfterTrade = 0;

  const tradesWithNews: CongressNewsCatalystResult["tradesWithNews"] = [];
  const series: CongressNewsCatalystResult["series"] = [];

  for (const t of trades) {
    const tradeDate = parseTradeDate(t.transactionDate);
    if (!tradeDate) continue;

    let best: { date: Date; headline: string; source: string; offset: number } | null = null;
    const tradeDay = tradeDate.toISOString().split("T")[0]!;

    for (let offset = -7; offset <= 7; offset++) {
      const d = new Date(tradeDate);
      d.setDate(d.getDate() + offset);
      const key = d.toISOString().split("T")[0]!;
      const candidates = newsByDate.get(key);
      if (candidates && candidates.length) {
        // Prefer closest match; company news beats market news at same offset.
        if (!best || Math.abs(offset) < Math.abs(best.offset) || (Math.abs(offset) === Math.abs(best.offset) && candidates[0]!.source === "company")) {
          best = { date: d, headline: candidates[0]!.headline, source: candidates[0]!.source, offset };
        }
      }
    }

    const catalystScore = best
      ? Math.max(0, 100 - Math.abs(best.offset) * 10) // 100 at same day, 30 at ±7 days
      : 0;

    if (best) {
      const offset = daysBetween(tradeDate, best.date);
      totalLead += offset;
      leadCount++;
      leadDaysList.push(offset);
      if (offset < 0) newsBeforeTrade++;
      if (offset > 0) newsAfterTrade++;
    }

    tradesWithNews.push({
      politician: t.name,
      date: t.transactionDate,
      type: t.type,
      amount: t.amount,
      matchedNewsDate: best ? best.date.toISOString().split("T")[0]! : null,
      daysOffset: best ? daysBetween(tradeDate, best.date) : null,
      headline: best ? best.headline : null,
      source: best ? best.source : null,
      catalystScore: r(catalystScore, 0) ?? 0,
    });

    series.push({
      date: tradeDay,
      catalystScore: r(catalystScore, 0) ?? 0,
      type: "trade",
      headline: best ? best.headline : undefined,
    });
  }

  // Add news-only events to series.
  for (const n of allNews) {
    if (!n.date) continue;
    const key = n.date.toISOString().split("T")[0]!;
    series.push({ date: key, catalystScore: 0, type: "news", headline: n.headline });
  }

  series.sort((a, b) => a.date.localeCompare(b.date));

  const leadDaysAvg = leadCount > 0 ? totalLead / leadCount : null;
  const sortedLeads = [...leadDaysList].sort((a, b) => a - b);
  const leadDaysMedian = sortedLeads.length ? sortedLeads[Math.floor(sortedLeads.length / 2)]! : null;

  // Score: weighted average catalyst score, boosted if news tends to follow trades.
  const avgCatalyst = tradesWithNews.length
    ? tradesWithNews.reduce((s, t) => s + t.catalystScore, 0) / tradesWithNews.length
    : 0;
  let score = avgCatalyst;
  if (leadDaysAvg != null && leadDaysAvg > 0) score += 10;
  if (newsAfterTrade > newsBeforeTrade) score += 10;
  score = Math.max(0, Math.min(100, score));

  const noData = trades.length === 0;
  const verdict = catalystLabel(score, leadDaysAvg, noData);

  const summary = noData
    ? `${normalizedTicker}: no congressional trades in the last ${lookbackDays} days.`
    : `${normalizedTicker} has ${verdict.toLowerCase()}: ${tradesWithNews.filter((t) => t.headline).length} of ${tradesWithNews.length} congressional trades had a nearby news match, with news trailing trades by an average of ${r(leadDaysAvg ?? 0, 1)} days.`;

  return {
    ticker: normalizedTicker,
    summary,
    verdict,
    score: r(score, 1) ?? 0,
    lookbackDays,
    windowStart: from,
    windowEnd: to,
    tradeCount: trades.length,
    tradesWithNews,
    leadDaysAvg: r(leadDaysAvg, 2),
    leadDaysMedian: r(leadDaysMedian, 2),
    newsBeforeTrade,
    newsAfterTrade,
    series,
    metadata: {
      generatedAt: new Date().toISOString(),
      fromCache: true,
      sources: [
        congressRes.status === "fulfilled" && congressRes.value ? congressRes.value.source : "",
        companyNewsRes.status === "fulfilled" && companyNewsRes.value ? companyNewsRes.value.source : "",
        marketNewsRes.status === "fulfilled" && marketNewsRes.value ? marketNewsRes.value.source : "",
      ].filter(Boolean),
    },
  };
}

export const analyzeCongressNewsCatalystTool = {
  name: "analyze_congress_news_catalyst",
  description:
    "Analyze congressional trades for a ticker with nearby news to detect potential catalyst signals. Returns a catalyst verdict (High Catalyst Signal / Some Catalyst Signal / No Clear Catalyst / No Data), average lead/lag days, matched headlines, and graphable event scores.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      lookbackDays: { type: "number", description: "How many days back to analyze (default 90, max 365)", default: 90 },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, lookbackDays } = AnalyzeCongressNewsCatalystInput.parse(args);
    return await analyzeCongressNewsCatalyst(ticker, lookbackDays);
  },
};
