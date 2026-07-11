/**
 * Yahoo Finance fallback providers for the data registry.
 *
 * Provides free alternatives for:
 * - Dividends (via Yahoo v8 chart events=div)
 * - Stock splits (via Yahoo v8 chart events=split)
 * - Company news (via Yahoo search API)
 * - Stock quote (via Yahoo v8 chart latest close)
 */

import { yahooProvider } from "./yahoo.js";
import { getCachedResponse, setCachedResponse } from "../lib/cache.js";
import { registerProvider, type DataProvider, type FetchParams } from "../lib/data-registry.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

// ── Dividends provider ──

const dividendsProvider: DataProvider = {
  name: "yahoo-dividends",
  dataType: "dividends",
  fetch: async (params: FetchParams) => {
    const ticker = params.ticker?.toUpperCase();
    const from = params.from;
    const to = params.to;
    if (!ticker || !from || !to) return null;

    const cacheKey = `yahoo-div:${ticker}:${from}:${to}`;
    let cached = getCachedResponse(cacheKey);
    if (cached) return cached;

    const divs = await yahooProvider.getDividends(ticker, from, to);
    // Map to the same shape as Finnhub's Dividend type
    cached = divs.map((d) => ({
      date: d.date,
      dividend: d.amount,
      adjustedDividend: d.amount,
      recordDate: "",
      paymentDate: d.date,
      declarationDate: "",
      symbol: ticker,
    }));
    setCachedResponse(cacheKey, cached, 1440);
    return cached;
  },
};

// ── Stock splits provider ──

const splitsProvider: DataProvider = {
  name: "yahoo-splits",
  dataType: "splits",
  fetch: async (params: FetchParams) => {
    const ticker = params.ticker?.toUpperCase();
    const from = params.from;
    const to = params.to;
    if (!ticker || !from || !to) return null;

    const cacheKey = `yahoo-splits:${ticker}:${from}:${to}`;
    let cached = getCachedResponse(cacheKey);
    if (cached) return cached;

    const period1 = Math.floor(new Date(from).getTime() / 1000);
    const period2 = Math.floor(new Date(to).getTime() / 1000) + 86400;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d&events=split`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;

    const json = await res.json() as any;
    const splits = json?.chart?.result?.[0]?.events?.splits;
    if (!splits || typeof splits !== "object") return [];

    const result = Object.values(splits as Record<string, any>).map((s) => ({
      date: new Date(s.date * 1000).toISOString().split("T")[0]!,
      fromFactor: s.numerator || 1,
      toFactor: s.denominator || 1,
      ratio: s.splitRatio || "",
      symbol: ticker,
    }));
    setCachedResponse(cacheKey, result, 1440);
    return result;
  },
};

// ── Company news provider ──

const companyNewsProvider: DataProvider = {
  name: "yahoo-company-news",
  dataType: "company_news",
  fetch: async (params: FetchParams) => {
    const ticker = params.ticker?.toUpperCase();
    if (!ticker) return null;

    const cacheKey = `yahoo-news:${ticker}`;
    let cached = getCachedResponse(cacheKey);
    if (cached) return cached;

    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&newsCount=20&quotesCount=0`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;

    const json = await res.json() as any;
    const news = json?.news ?? [];
    const result = news.map((n: any) => ({
      category: "company",
      datetime: Math.floor(new Date(n.publisherPublishTime || n.providerPublishTime || 0).getTime() / 1000),
      headline: n.title || "",
      id: n.uuid || 0,
      image: n.thumbnail?.url || "",
      related: ticker,
      source: n.publisher || "",
      summary: "",
      url: n.link || "",
    }));
    setCachedResponse(cacheKey, result, 60);
    return result;
  },
};

// ── Stock quote provider (from Yahoo chart latest close) ──

const stockQuoteProvider: DataProvider = {
  name: "yahoo-quote",
  dataType: "stock_quote",
  fetch: async (params: FetchParams) => {
    const ticker = params.ticker?.toUpperCase();
    if (!ticker) return null;

    const cacheKey = `yahoo-quote:${ticker}`;
    let cached = getCachedResponse(cacheKey);
    if (cached) return cached;

    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 86400;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${weekAgo}&period2=${now}&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;

    const json = await res.json() as any;
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const lastClose = closes.filter((c: number | null) => c != null).pop() ?? null;
    if (lastClose == null) return null;

    const quote = { c: lastClose, d: 0, dp: 0, h: 0, l: 0, o: 0, pc: lastClose, t: now };
    setCachedResponse(cacheKey, quote, 5);
    return quote;
  },
};

export function registerYahooProviders(): void {
  registerProvider(dividendsProvider);
  registerProvider(splitsProvider);
  registerProvider(companyNewsProvider);
  registerProvider(stockQuoteProvider);
}