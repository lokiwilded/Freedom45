/**
 * Finnhub API client for Freedom45 MCP server.
 * Free tier: 60 calls/min, 30 calls/sec.
 * Docs: https://finnhub.io/docs/api
 */

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

export interface FinnhubConfig {
  apiKey: string;
}

export interface StockQuote {
  c: number;   // Current price
  d: number;   // Change
  dp: number;  // Percent change
  h: number;   // High price of the day
  l: number;   // Low price of the day
  o: number;   // Open price of the day
  pc: number;  // Previous close price
  t: number;   // Timestamp
}

export interface CongressTrade {
  symbol: string;
  name: string;          // Politician name
  party: string;         // Democrat / Republican
  chamber: string;       // Senate / House
  transactionDate: string;
  type: string;          // Purchase / Sale
  amount: string;        // Dollar range
  assetDescription: string;
  filingDate: string;
}

export interface InsiderTransaction {
  symbol: string;
  name: string;           // Insider name
  share: number;          // Number of shares
  change: number;         // Change in shares
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
  sector: string;
  country: string;
  exchange: string;
  logo: string;
  weburl: string;
  phone: string;
}

class FinnhubProvider {
  private config: FinnhubConfig | null = null;
  private lastCallTime = 0;
  private callsThisMinute = 0;
  private minuteStart = Date.now();

  /**
   * Initialize with API key. Call once at startup.
   */
  init(apiKey: string): void {
    this.config = { apiKey };
  }

  private rateLimitPromise: Promise<void> | null = null;

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
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
      this.callsThisMinute = 0;
      this.minuteStart = Date.now();
    }

    // Ensure at least 33ms between calls (30/sec ceiling)
    const timeSinceLast = now - this.lastCallTime;
    if (timeSinceLast < 33) {
      await new Promise(resolve => setTimeout(resolve, 33 - timeSinceLast));
    }

    this.lastCallTime = Date.now();
    this.callsThisMinute++;
  }

  /**
   * Make a GET request to the Finnhub API.
   */
  private async get<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!this.config) {
      throw new Error('Finnhub provider not initialized. Call init(apiKey) first.');
    }

    await this.rateLimit();

    const url = new URL(`${FINNHUB_BASE}${endpoint}`);
    url.searchParams.set('token', this.config.apiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());
    
    if (response.status === 429) {
      // Wait 1 second, then retry through the normal rate-limited path
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.get<T>(endpoint, params);
    }

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get a real-time stock quote.
   */
  async getQuote(symbol: string): Promise<StockQuote> {
    return this.get<StockQuote>('/quote', { symbol: symbol.toUpperCase() });
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

    const data = await this.get<any>('/stock/congressional-trading', params);
    
    // Finnhub returns { data: [...] }
    if (data && Array.isArray(data.data)) {
      return data.data.map((t: any) => ({
        symbol: t.symbol || '',
        name: t.name || '',
        party: t.party || '',
        chamber: t.chamber || '',
        transactionDate: t.transactionDate || '',
        type: t.type || '',
        amount: t.amount || '',
        assetDescription: t.assetDescription || '',
        filingDate: t.filingDate || '',
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

    const data = await this.get<any>('/stock/insider-transactions', params);
    
    // Finnhub returns { data: [...] }
    if (data && Array.isArray(data.data)) {
      return data.data.map((t: any) => ({
        symbol: t.symbol || '',
        name: t.name || '',
        share: t.share || 0,
        change: t.change || 0,
        filingDate: t.filingDate || '',
        transactionDate: t.transactionDate || '',
        transactionCode: t.transactionCode || '',
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
    const data = await this.get<any>('/stock/profile2', { symbol: symbol.toUpperCase() });
    
    if (!data || !data.name) return null;

    return {
      name: data.name || '',
      ticker: data.ticker || symbol.toUpperCase(),
      marketCapitalization: data.marketCapitalization || 0,
      shareOutstanding: data.shareOutstanding || 0,
      ipo: data.ipo || '',
      industry: data.industry || '',
      sector: data.sector || '',
      country: data.country || '',
      exchange: data.exchange || '',
      logo: data.logo || '',
      weburl: data.weburl || '',
      phone: data.phone || '',
    };
  }

  /**
   * Search for a symbol by name or ticker.
   */
  async searchSymbol(query: string): Promise<any[]> {
    const data = await this.get<any>('/search', { q: query });
    return data.result || [];
  }
}

export const finnhubProvider = new FinnhubProvider();