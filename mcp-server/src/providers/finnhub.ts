/**
 * Finnhub API provider for Freedom45.
 *
 * Mirrors the provider pattern used across the project:
 * - Centralized rate limiting (60 calls/min, 30 calls/sec on free tier)
 * - Built-in fetch retry on 429
 * - Pure API client: no storage logic here; caching lives in the SQL layer
 *
 * Free tier limits: https://finnhub.io/docs/api/rate-limit
 */

const FINNHUB_BASE = "https://finnhub.io/api/v1";

export interface FinnhubConfig {
  apiKey: string;
}

export interface StockQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High price of the day
  l: number; // Low price of the day
  o: number; // Open price of the day
  pc: number; // Previous close price
  t: number; // Timestamp
}

export interface CongressTrade {
  symbol: string;
  name: string; // Politician name
  party: string; // Democrat / Republican
  chamber: string; // Senate / House
  transactionDate: string;
  type: string; // Purchase / Sale
  amount: string; // Dollar range
  assetDescription: string;
  filingDate: string;
}

export interface InsiderTransaction {
  symbol: string;
  name: string; // Insider name
  share: number; // Number of shares
  change: number; // Change in shares
  filingDate: string;
  transactionDate: string;
  transactionCode: string; // P = Purchase, S = Sale
  price: number;
  value: number;
}

export interface CompanyProfile {
  name: string;
  ticker: string;
  marketCapitalization: number;
  shareOutstanding: number;
  ipo: string;
  industry: string;
  finnhubIndustry: string;
  sector: string;
  country: string;
  currency: string;
  exchange: string;
  logo: string;
  weburl: string;
  phone: string;
}

export interface HistoricalCandle {
  c: number[]; // Close prices
  h: number[]; // High prices
  l: number[]; // Low prices
  o: number[]; // Open prices
  s: string; // Status: "ok" | "no_data"
  t: number[]; // Unix timestamps
  v: number[]; // Volume
}

export interface CompanyNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface MarketNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface EarningsCalendarItem {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

export interface EarningsSurprise {
  actual: number;
  estimate: number;
  period: string;
  quarter: number;
  surprise: number;
  surprisePercent: number;
  symbol: string;
  year: number;
}

export interface RecommendationTrend {
  buy: number;
  hold: number;
  period: string;
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
}

export interface PriceTarget {
  lastUpdated: string;
  mean: number;
  median: number;
  postHigh: number;
  postLow: number;
  postMean: number;
  postMedian: number;
  preHigh: number;
  preLow: number;
  preMean: number;
  preMedian: number;
  symbol: string;
}

export interface UpgradeDowngrade {
  gradeTime: number;
  fromGrade: string;
  toGrade: string;
  action: string;
  brokerage: string;
  symbol: string;
}

export interface Dividend {
  date: string;
  dividend: number;
  adjustedDividend: number;
  recordDate: string;
  paymentDate: string;
  declarationDate: string;
  symbol: string;
}

export interface Split {
  date: string;
  fromFactor: number;
  toFactor: number;
  ratio: string;
  symbol: string;
}

export interface SecFiling {
  accessNumber: string;
  filingDate: string;
  reportDate: string | null;
  form: string;
  symbol: string;
  link: string;
}

export interface InstitutionalOwnership {
  investor: string;
  stake: number;
  shares: number;
  value: number;
  dateReported: string;
  change: number;
  percentTotal: number;
  symbol: string;
}

export interface FundOwnership {
  owner: string;
  shares: number;
  value: number;
  dateReported: string;
  change: number;
  percentTotal: number;
  symbol: string;
}

class FinnhubProvider {
  private config: FinnhubConfig | null = null;
  private lastCallTime = 0;
  private callsThisMinute = 0;
  private minuteStart = Date.now();
  private rateLimitPromise: Promise<void> | null = null;

  /**
   * Initialize with API key. Call once at startup.
   */
  init(apiKey: string): void {
    this.config = { apiKey };
  }

  /**
   * Rate limiter: ensures we stay within 60 calls/min and 30 calls/sec.
   */
  private async rateLimit(): Promise<void> {
    // Serialize concurrent calls to prevent race conditions
    while (this.rateLimitPromise) {
      await this.rateLimitPromise;
    }

    this.rateLimitPromise = this._rateLimit();
    try {
      await this.rateLimitPromise;
    } finally {
      this.rateLimitPromise = null;
    }
  }

  private async _rateLimit(): Promise<void> {
    const now = Date.now();

    // Reset counter every minute
    if (now - this.minuteStart > 60000) {
      this.callsThisMinute = 0;
      this.minuteStart = now;
    }

    // Check minute limit
    if (this.callsThisMinute >= 60) {
      const waitMs = 60000 - (now - this.minuteStart);
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.callsThisMinute = 0;
      this.minuteStart = Date.now();
    }

    // Ensure at least 33ms between calls (30/sec ceiling)
    const timeSinceLast = now - this.lastCallTime;
    if (timeSinceLast < 33) {
      await new Promise((resolve) => setTimeout(resolve, 33 - timeSinceLast));
    }

    this.lastCallTime = Date.now();
    this.callsThisMinute++;
  }

  /**
   * Make a GET request to the Finnhub API.
   */
  private async get<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!this.config) {
      throw new Error("Finnhub provider not initialized. Call init(apiKey) first.");
    }

    await this.rateLimit();

    const url = new URL(`${FINNHUB_BASE}${endpoint}`);
    url.searchParams.set("token", this.config.apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString());

    if (response.status === 429) {
      // Wait 1 second, then retry through the normal rate-limited path
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return this.get<T>(endpoint, params);
    }

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(
        `Finnhub API error: expected JSON but received ${contentType || "unknown content type"}`
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get a real-time stock quote.
   */
  async getQuote(symbol: string): Promise<StockQuote> {
    return this.get<StockQuote>("/quote", { symbol: symbol.toUpperCase() });
  }

  /**
   * Get congressional stock trades.
   * Returns trades for a given symbol, or all trades if symbol is empty.
   */
  async getCongressTrades(symbol?: string, from?: string, to?: string): Promise<CongressTrade[]> {
    const params: Record<string, string> = {};
    if (symbol) params.symbol = symbol.toUpperCase();
    if (from) params.from = from;
    if (to) params.to = to;

    const data = await this.get<any>("/stock/congressional-trading", params);

    // Finnhub returns { data: [...] }
    if (data && Array.isArray(data.data)) {
      return data.data.map((t: any) => ({
        symbol: t.symbol || "",
        name: t.name || "",
        party: t.party || "",
        chamber: t.chamber || "",
        transactionDate: t.transactionDate || "",
        type: t.type || "",
        amount: t.amount || "",
        assetDescription: t.assetDescription || "",
        filingDate: t.filingDate || "",
      }));
    }

    return [];
  }

  /**
   * Get insider transactions for a symbol.
   */
  async getInsiderTransactions(symbol: string, from?: string, to?: string): Promise<InsiderTransaction[]> {
    const params: Record<string, string> = { symbol: symbol.toUpperCase() };
    if (from) params.from = from;
    if (to) params.to = to;

    const data = await this.get<any>("/stock/insider-transactions", params);

    // Finnhub returns { data: [...] }
    if (data && Array.isArray(data.data)) {
      return data.data.map((t: any) => ({
        symbol: t.symbol || "",
        name: t.name || "",
        share: t.share || 0,
        change: t.change || 0,
        filingDate: t.filingDate || "",
        transactionDate: t.transactionDate || "",
        transactionCode: t.transactionCode || "",
        price: t.price || 0,
        value: t.value || 0,
      }));
    }

    return [];
  }

  /**
   * Get company profile (includes market cap, sector, etc.).
   */
  async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
    const data = await this.get<any>("/stock/profile2", { symbol: symbol.toUpperCase() });

    if (!data || !data.name) return null;

    return {
      name: data.name || '',
      ticker: data.ticker || symbol.toUpperCase(),
      marketCapitalization: data.marketCapitalization || 0,
      shareOutstanding: data.shareOutstanding || 0,
      ipo: data.ipo || '',
      industry: data.industry || '',
      finnhubIndustry: data.finnhubIndustry || '',
      sector: data.sector || '',
      country: data.country || '',
      currency: data.currency || '',
      exchange: data.exchange || '',
      logo: data.logo || '',
      weburl: data.weburl || '',
      phone: data.phone || '',
    };
  }

  /**
   * Get historical OHLCV candles.
   * Resolution: 1, 5, 15, 30, 60, D, W, M
   * Unix timestamps in seconds.
   */
  async getHistoricalCandles(
    symbol: string,
    resolution: string,
    from: number,
    to: number
  ): Promise<HistoricalCandle> {
    return this.get<HistoricalCandle>("/stock/candle", {
      symbol: symbol.toUpperCase(),
      resolution,
      from: String(from),
      to: String(to),
    });
  }

  /**
   * Get fundamental metrics for a symbol.
   * Returns TTM and valuation metrics.
   */
  async getFundamentalMetrics(symbol: string): Promise<any> {
    return this.get<any>("/stock/metric", { symbol: symbol.toUpperCase(), metric: "all" });
  }

  /**
   * Get peer tickers for a symbol.
   */
  async getPeers(symbol: string): Promise<string[]> {
    const data = await this.get<string[]>("/stock/peers", { symbol: symbol.toUpperCase() });
    return Array.isArray(data) ? data : [];
  }

  /**
   * Search for a symbol by name or ticker.
   */
  async searchSymbol(query: string): Promise<any[]> {
    const data = await this.get<any>("/search", { q: query });
    return data.result || [];
  }

  /**
   * Get company news for a symbol within a date range.
   * Dates in YYYY-MM-DD format.
   */
  async getCompanyNews(symbol: string, from: string, to: string): Promise<CompanyNews[]> {
    const data = await this.get<CompanyNews[]>("/company-news", {
      symbol: symbol.toUpperCase(),
      from,
      to,
    });
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get general market news by category.
   * Categories: general, forex, crypto, merger.
   */
  async getMarketNews(category: string = "general"): Promise<MarketNews[]> {
    const data = await this.get<MarketNews[]>("/news", { category });
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get earnings calendar for a date range.
   * Dates in YYYY-MM-DD format.
   */
  async getEarningsCalendar(from: string, to: string): Promise<EarningsCalendarItem[]> {
    const data = await this.get<any>("/calendar/earnings", { from, to });
    return data && Array.isArray(data.earningsCalendar) ? data.earningsCalendar : [];
  }

  /**
   * Get earnings surprise (actual vs estimate) for a symbol.
   */
  async getEarningsSurprise(symbol: string): Promise<EarningsSurprise[]> {
    const data = await this.get<any>("/stock/earnings", { symbol: symbol.toUpperCase() });
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get analyst recommendation trends for a symbol.
   */
  async getRecommendationTrends(symbol: string): Promise<RecommendationTrend[]> {
    const data = await this.get<RecommendationTrend[]>("/stock/recommendation", {
      symbol: symbol.toUpperCase(),
    });
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get consensus analyst price target for a symbol.
   */
  async getPriceTarget(symbol: string): Promise<PriceTarget> {
    return this.get<PriceTarget>("/stock/price-target", { symbol: symbol.toUpperCase() });
  }

  /**
   * Get recent analyst upgrade/downgrade actions for a symbol.
   */
  async getUpgradeDowngrade(symbol: string): Promise<UpgradeDowngrade[]> {
    const data = await this.get<any>("/stock/upgrade-downgrade", {
      symbol: symbol.toUpperCase(),
    });
    return data && Array.isArray(data.upgradeDowngrade) ? data.upgradeDowngrade : [];
  }

  /**
   * Get dividend history for a symbol within a date range.
   * Dates in YYYY-MM-DD format.
   */
  async getDividends(symbol: string, from: string, to: string): Promise<Dividend[]> {
    const data = await this.get<Dividend[]>("/stock/dividend", {
      symbol: symbol.toUpperCase(),
      from,
      to,
    });
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get stock split history for a symbol within a date range.
   * Dates in YYYY-MM-DD format.
   */
  async getSplits(symbol: string, from: string, to: string): Promise<Split[]> {
    const data = await this.get<Split[]>("/stock/split", {
      symbol: symbol.toUpperCase(),
      from,
      to,
    });
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get SEC filings for a symbol within a date range.
   * Dates in YYYY-MM-DD format.
   */
  async getSecFilings(symbol: string, from: string, to: string): Promise<SecFiling[]> {
    const data = await this.get<any>("/stock/filings", {
      symbol: symbol.toUpperCase(),
      from,
      to,
    });
    return data && Array.isArray(data.filings) ? data.filings : [];
  }

  /**
   * Get institutional ownership (13F) for a symbol.
   */
  async getInstitutionalOwnership(symbol: string): Promise<InstitutionalOwnership[]> {
    const data = await this.get<any>("/stock/institutional-ownership", {
      symbol: symbol.toUpperCase(),
    });
    return data && Array.isArray(data.data) ? data.data : [];
  }

  /**
   * Get fund ownership for a symbol.
   */
  async getFundOwnership(symbol: string): Promise<FundOwnership[]> {
    const data = await this.get<any>("/stock/fund-ownership", {
      symbol: symbol.toUpperCase(),
    });
    return data && Array.isArray(data.data) ? data.data : [];
  }
}

export const finnhubProvider = new FinnhubProvider();
