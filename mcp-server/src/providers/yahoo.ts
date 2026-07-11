/**
 * Yahoo Finance chart API provider for Freedom45.
 *
 * Uses the public v8 chart endpoint (no key required, needs a browser User-Agent).
 * Returns historical closes for indices, commodities (futures), FX, etc.
 * Pure API client: no storage/caching here.
 */

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export interface AssetPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface DividendPoint {
  date: string;   // YYYY-MM-DD
  amount: number;  // per-share dividend amount
}

class YahooProvider {
  private lastCallTime = 0;

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const wait = 250 - (now - this.lastCallTime);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCallTime = Date.now();
  }

  /**
   * Fetch historical closes for a symbol.
   * Uses explicit period1/period2 rather than range=max — Yahoo caps monthly "max" at ~168
   * points, but an explicit epoch window returns the full available history.
   * @param symbol Yahoo symbol, e.g. "^GSPC", "GC=F"
   * @param interval "1d" | "1wk" | "1mo"
   * @param normalizeMonth if true (default for 1mo), snap dates to YYYY-MM-01
   */
  async getChart(
    symbol: string,
    interval: "1d" | "1wk" | "1mo" = "1mo",
    normalizeMonth = true
  ): Promise<AssetPoint[]> {
    await this.rateLimit();

    const period1 = -2208988800; // 1900-01-01
    const period2 = Math.floor(Date.now() / 1000) + 86400;
    const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=${interval}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Yahoo API error for ${symbol}: ${res.status} ${res.statusText} ${body.slice(0, 120)}`.trim());
    }

    const json = (await res.json()) as any;
    const result = json?.chart?.result?.[0];
    if (!result || !Array.isArray(result.timestamp)) {
      const msg = json?.chart?.error?.description ?? "no data";
      throw new Error(`Yahoo returned no series for ${symbol}: ${msg}`);
    }

    const ts: number[] = result.timestamp;
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

    const points: AssetPoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const v = closes[i];
      if (v === null || v === undefined || Number.isNaN(v)) continue;
      const d = new Date(ts[i]! * 1000);
      const iso =
        interval === "1mo" && normalizeMonth
          ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`
          : d.toISOString().split("T")[0]!;
      points.push({ date: iso, value: v });
    }
    return points;
  }

  /**
   * Fetch dividend history for a symbol within a date range.
   * Uses Yahoo's v8 chart API with events=div.
   * @param symbol Stock ticker, e.g. "KO", "AAPL"
   * @param from Start date YYYY-MM-DD
   * @param to End date YYYY-MM-DD
   */
  async getDividends(symbol: string, from: string, to: string): Promise<DividendPoint[]> {
    await this.rateLimit();

    const period1 = Math.floor(new Date(from).getTime() / 1000);
    const period2 = Math.floor(new Date(to).getTime() / 1000) + 86400;
    const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=div`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Yahoo dividend error for ${symbol}: ${res.status} ${body.slice(0, 120)}`.trim());
    }

    const json = (await res.json()) as any;
    const result = json?.chart?.result?.[0];
    const dividends = result?.events?.dividends;
    if (!dividends || typeof dividends !== "object") return [];

    const points: DividendPoint[] = [];
    for (const key of Object.keys(dividends)) {
      const d = dividends[key];
      if (d && typeof d.amount === "number") {
        const date = new Date(d.date * 1000).toISOString().split("T")[0]!;
        points.push({ date, amount: d.amount });
      }
    }
    points.sort((a, b) => a.date.localeCompare(b.date));
    return points;
  }
}

export const yahooProvider = new YahooProvider();
