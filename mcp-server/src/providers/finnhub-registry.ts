/**
 * Finnhub providers for the data registry.
 *
 * Wraps existing Finnhub provider methods so they participate in the
 * multi-provider fallback system. Each method is registered as a provider
 * for its corresponding data type.
 */

import { finnhubProvider } from "./finnhub.js";
import { getCachedResponse, setCachedResponse } from "../lib/cache.js";
import { registerProvider, type DataProvider, type FetchParams } from "../lib/data-registry.js";

function withCache<T>(
  cacheKey: string,
  ttlMinutes: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = getCachedResponse(cacheKey);
  if (cached) return Promise.resolve(cached as T);
  return fetcher().then((result) => {
    setCachedResponse(cacheKey, result, ttlMinutes);
    return result;
  });
}

const dividendsProvider: DataProvider = {
  name: "finnhub-dividends",
  dataType: "dividends",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker || !p.from || !p.to) return null;
    return withCache(`dividends:${ticker}:${p.from}:${p.to}`, 1440, () =>
      finnhubProvider.getDividends(ticker, p.from!, p.to!)
    );
  },
};

const splitsProvider: DataProvider = {
  name: "finnhub-splits",
  dataType: "splits",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker || !p.from || !p.to) return null;
    return withCache(`splits:${ticker}:${p.from}:${p.to}`, 1440, () =>
      finnhubProvider.getSplits(ticker, p.from!, p.to!)
    );
  },
};

const insiderTransactionsProvider: DataProvider = {
  name: "finnhub-insider-transactions",
  dataType: "insider_transactions",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker) return null;
    return withCache(`insider:${ticker}:${p.from || ""}:${p.to || ""}`, 60, () =>
      finnhubProvider.getInsiderTransactions(ticker, p.from, p.to)
    );
  },
};

const congressTradesProvider: DataProvider = {
  name: "finnhub-congress-trades",
  dataType: "congress_trades",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    return withCache(`congress:${ticker || "all"}:${p.from || ""}:${p.to || ""}`, 5, () =>
      finnhubProvider.getCongressTrades(ticker, p.from, p.to)
    );
  },
};

const institutionalOwnershipProvider: DataProvider = {
  name: "finnhub-institutional-ownership",
  dataType: "institutional_ownership",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker) return null;
    return withCache(`instown:${ticker}`, 1440, () =>
      finnhubProvider.getInstitutionalOwnership(ticker)
    );
  },
};

const fundOwnershipProvider: DataProvider = {
  name: "finnhub-fund-ownership",
  dataType: "fund_ownership",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker) return null;
    return withCache(`fundown:${ticker}`, 1440, () =>
      finnhubProvider.getFundOwnership(ticker)
    );
  },
};

const priceTargetProvider: DataProvider = {
  name: "finnhub-price-target",
  dataType: "price_target",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker) return null;
    return withCache(`pricetarget:${ticker}`, 1440, () =>
      finnhubProvider.getPriceTarget(ticker)
    );
  },
};

const upgradeDowngradeProvider: DataProvider = {
  name: "finnhub-upgrade-downgrade",
  dataType: "upgrade_downgrade",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker) return null;
    return withCache(`updown:${ticker}`, 1440, () =>
      finnhubProvider.getUpgradeDowngrade(ticker)
    );
  },
};

const stockQuoteProvider: DataProvider = {
  name: "finnhub-quote",
  dataType: "stock_quote",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker) return null;
    return withCache(`quote:${ticker}`, 5, () =>
      finnhubProvider.getQuote(ticker)
    );
  },
};

const companyProfileProvider: DataProvider = {
  name: "finnhub-company-profile",
  dataType: "company_profile",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker) return null;
    return withCache(`profile:${ticker}`, 1440, () =>
      finnhubProvider.getCompanyProfile(ticker)
    );
  },
};

const companyNewsProvider: DataProvider = {
  name: "finnhub-company-news",
  dataType: "company_news",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker || !p.from || !p.to) return null;
    return withCache(`companynews:${ticker}:${p.from}:${p.to}`, 60, () =>
      finnhubProvider.getCompanyNews(ticker, p.from!, p.to!)
    );
  },
};

const marketNewsProvider: DataProvider = {
  name: "finnhub-market-news",
  dataType: "market_news",
  fetch: async (p: FetchParams) => {
    const category = p.category || "general";
    return withCache(`marketnews:${category}`, 30, () =>
      finnhubProvider.getMarketNews(category)
    );
  },
};

const earningsSurpriseProvider: DataProvider = {
  name: "finnhub-earnings-surprise",
  dataType: "earnings_surprise",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker) return null;
    return withCache(`earnings:${ticker}`, 360, () =>
      finnhubProvider.getEarningsSurprise(ticker)
    );
  },
};

const recommendationTrendsProvider: DataProvider = {
  name: "finnhub-recommendation-trends",
  dataType: "recommendation_trends",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker) return null;
    return withCache(`recommendations:${ticker}`, 360, () =>
      finnhubProvider.getRecommendationTrends(ticker)
    );
  },
};

const fundamentalMetricsProvider: DataProvider = {
  name: "finnhub-fundamental-metrics",
  dataType: "fundamental_metrics",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker) return null;
    return withCache(`metrics:${ticker}`, 360, () =>
      finnhubProvider.getFundamentalMetrics(ticker)
    );
  },
};

const peersProvider: DataProvider = {
  name: "finnhub-peers",
  dataType: "peers",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker) return null;
    return withCache(`peers:${ticker}`, 1440, () =>
      finnhubProvider.getPeers(ticker)
    );
  },
};

const secFilingsProvider: DataProvider = {
  name: "finnhub-sec-filings",
  dataType: "sec_filings",
  fetch: async (p: FetchParams) => {
    const ticker = p.ticker?.toUpperCase();
    if (!ticker || !p.from || !p.to) return null;
    return withCache(`secfilings:${ticker}:${p.from}:${p.to}`, 360, () =>
      finnhubProvider.getSecFilings(ticker, p.from!, p.to!)
    );
  },
};

export function registerFinnhubProviders(): void {
  registerProvider(dividendsProvider);
  registerProvider(splitsProvider);
  registerProvider(insiderTransactionsProvider);
  registerProvider(congressTradesProvider);
  registerProvider(institutionalOwnershipProvider);
  registerProvider(fundOwnershipProvider);
  registerProvider(priceTargetProvider);
  registerProvider(upgradeDowngradeProvider);
  registerProvider(stockQuoteProvider);
  registerProvider(companyProfileProvider);
  registerProvider(companyNewsProvider);
  registerProvider(marketNewsProvider);
  registerProvider(earningsSurpriseProvider);
  registerProvider(recommendationTrendsProvider);
  registerProvider(fundamentalMetricsProvider);
  registerProvider(peersProvider);
  registerProvider(secFilingsProvider);
}