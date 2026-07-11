import { z } from "zod";
import { fetchCompanyProfile as fetchCompanyProfileCombo } from "../../lib/combo-fetchers.js";
import { db } from "../../db.js";

export const FetchCompanyProfileInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type FetchCompanyProfileInput = z.infer<typeof FetchCompanyProfileInput>;

export interface CompanyProfile {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
  currency: string;
  country: string;
  website?: string;
  marketCap?: number;
  fetchedAt: string;
  fromCache: boolean;
  source?: string;
}



export async function fetchCompanyProfile(ticker: string): Promise<CompanyProfile> {
  const normalizedTicker = ticker.toUpperCase();

  const normalizedRow = db
    .prepare("SELECT * FROM companies WHERE ticker = ?")
    .get(normalizedTicker) as
    | {
        ticker: string;
        name: string;
        sector: string;
        industry: string;
        exchange: string;
        currency: string;
        country: string;
        website: string;
        market_cap: number;
        fetched_at: string;
      }
    | undefined;

  if (normalizedRow) {
    return {
      ticker: normalizedRow.ticker,
      name: normalizedRow.name,
      sector: normalizedRow.sector,
      industry: normalizedRow.industry,
      exchange: normalizedRow.exchange,
      currency: normalizedRow.currency,
      country: normalizedRow.country || "Unknown",
      website: normalizedRow.website || undefined,
      marketCap: normalizedRow.market_cap || undefined,
      fetchedAt: normalizedRow.fetched_at,
      fromCache: false,
      source: "companies_table",
    };
  }

  const result = await fetchCompanyProfileCombo(normalizedTicker);

  if (!result || !result.profile) {
    throw new Error(`No profile found for ${normalizedTicker}`);
  }

  const { profile: data, source } = result;

  const profile: CompanyProfile = {
    ticker: normalizedTicker,
    name: data.name || "Unknown",
    sector: data.sector || "Unknown",
    industry: data.industry || "Unknown",
    exchange: data.exchange || "Unknown",
    currency: data.currency || "Unknown",
    country: data.country || "Unknown",
    website: data.website || undefined,
    marketCap: data.marketCapitalization || undefined,
    fetchedAt: new Date().toISOString(),
    fromCache: false,
    source,
  };

  db.prepare(
    `INSERT INTO companies (ticker, name, sector, industry, exchange, currency, country, website, market_cap, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET
       name = excluded.name,
       sector = excluded.sector,
       industry = excluded.industry,
       exchange = excluded.exchange,
       currency = excluded.currency,
       country = excluded.country,
       website = excluded.website,
       market_cap = excluded.market_cap,
       fetched_at = excluded.fetched_at`
  ).run(
    profile.ticker,
    profile.name,
    profile.sector,
    profile.industry,
    profile.exchange,
    profile.currency,
    profile.country,
    profile.website || null,
    profile.marketCap || null,
    profile.fetchedAt
  );

  return profile;
}

export const fetchCompanyProfileTool = {
  name: "fetch_company_profile",
  description: "Fetch a public company's profile from Finnhub and cache it in SQLite.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: {
        type: "string",
        description: "Stock ticker, e.g. AAPL",
      },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = FetchCompanyProfileInput.parse(args);
    return await fetchCompanyProfile(ticker);
  },
};