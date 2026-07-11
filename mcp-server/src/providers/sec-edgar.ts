/**
 * SEC EDGAR provider — free structured financial data from XBRL companyfacts API.
 *
 * No API key required. Just needs a User-Agent header with contact info.
 * Provides 10+ years of annual (10-K) and quarterly (10-Q) financial data:
 *   Revenues, NetIncomeLoss, OperatingIncomeLoss, GrossProfit, LongTermDebt,
 *   StockholdersEquity, Assets, Liabilities, R&D, Dividends, etc.
 *
 * Data source: https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json
 * Ticker mapping: https://www.sec.gov/files/company_tickers.json
 */

const SEC_UA = "Freedom45 research@example.com";
const SEC_BASE = "https://data.sec.gov/api/xbrl/companyfacts";
const TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";

export interface SecAnnualDataPoint {
  start: string;
  end: string;
  val: number;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  accn: string;
}

export interface SecFinancialSeries {
  concept: string;
  unit: string;
  annual: SecAnnualDataPoint[];
  quarterly: SecAnnualDataPoint[];
}

export interface SecCompanyFacts {
  cik: number;
  entityName: string;
  facts: Record<string, SecFinancialSeries>;
}

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

class SecEdgarProvider {
  private tickerMap: Map<string, number> | null = null;
  private tickerMapFetched = 0;
  private lastCallTime = 0;

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const wait = 100 - (now - this.lastCallTime);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCallTime = Date.now();
  }

  private async getTickerMap(): Promise<Map<string, number>> {
    if (this.tickerMap && Date.now() - this.tickerMapFetched < 3600000) return this.tickerMap;

    await this.rateLimit();
    const res = await fetch(TICKER_MAP_URL, { headers: { "User-Agent": SEC_UA } });
    if (!res.ok) throw new Error(`SEC ticker map error: ${res.status}`);

    const data = (await res.json()) as Record<string, TickerEntry>;
    this.tickerMap = new Map();
    for (const entry of Object.values(data)) {
      this.tickerMap.set(entry.ticker.toUpperCase(), entry.cik_str);
    }
    this.tickerMapFetched = Date.now();
    return this.tickerMap;
  }

  async getCik(ticker: string): Promise<number | null> {
    const map = await this.getTickerMap();
    return map.get(ticker.toUpperCase()) ?? null;
  }

  async getCompanyFacts(ticker: string): Promise<SecCompanyFacts | null> {
    const cik = await this.getCik(ticker);
    if (!cik) return null;

    const cikPadded = String(cik).padStart(10, "0");
    await this.rateLimit();
    const res = await fetch(`${SEC_BASE}/CIK${cikPadded}.json`, {
      headers: { "User-Agent": SEC_UA },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`SEC EDGAR error: ${res.status}`);
    }

    const data = await res.json() as any;
    const gaap = data.facts?.["us-gaap"] ?? {};
    const facts: Record<string, SecFinancialSeries> = {};

    for (const [concept, conceptData] of Object.entries(gaap)) {
      const units = (conceptData as any).units ?? {};
      const unitKey = Object.keys(units)[0] ?? "";
      const allData: SecAnnualDataPoint[] = units[unitKey] ?? [];

      const annual = allData
        .filter((d: any) => d.form === "10-K" && d.fp === "FY")
        .map((d: any) => ({
          start: d.start ?? "",
          end: d.end ?? "",
          val: d.val ?? 0,
          fy: d.fy ?? 0,
          fp: d.fp ?? "",
          form: d.form ?? "",
          filed: d.filed ?? "",
          accn: d.accn ?? "",
        }));

      const quarterly = allData
        .filter((d: any) => d.form === "10-Q" || (d.fp && d.fp !== "FY" && d.form === "10-Q"))
        .map((d: any) => ({
          start: d.start ?? "",
          end: d.end ?? "",
          val: d.val ?? 0,
          fy: d.fy ?? 0,
          fp: d.fp ?? "",
          form: d.form ?? "",
          filed: d.filed ?? "",
          accn: d.accn ?? "",
        }));

      if (annual.length > 0 || quarterly.length > 0) {
        facts[concept] = { concept, unit: unitKey, annual, quarterly };
      }
    }

    return {
      cik,
      entityName: data.entityName ?? ticker.toUpperCase(),
      facts,
    };
  }

  async getAnnualSeries(ticker: string, concept: string): Promise<SecAnnualDataPoint[] | null> {
    const facts = await this.getCompanyFacts(ticker);
    if (!facts) return null;
    const series = facts.facts[concept];
    return series ? series.annual : null;
  }

  async getMultipleAnnualSeries(
    ticker: string,
    concepts: string[]
  ): Promise<Record<string, SecAnnualDataPoint[] | null>> {
    const facts = await this.getCompanyFacts(ticker);
    if (!facts) return {};

    const result: Record<string, SecAnnualDataPoint[] | null> = {};
    for (const concept of concepts) {
      const series = facts.facts[concept];
      result[concept] = series ? series.annual : null;
    }
    return result;
  }
}

export const secEdgarProvider = new SecEdgarProvider();