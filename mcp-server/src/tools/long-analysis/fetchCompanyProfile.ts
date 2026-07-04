import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { db } from "../../db.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

/**
 * fetch_company_profile MCP tool
 *
 * Fetches company profile from Finnhub with two-tier caching:
 * 1. Fast path: companies table (coverage-based, permanent cache)
 * 2. TTL path: api_cache table (24-hour TTL), fetch from Finnhub if missing
 */

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

const PROFILE_TTL_MINUTES = 60 * 24; // 24 hours

// Input schema
export const FetchCompanyProfileInput = z.object({
  ticker: z.string().min(1).max(10).describe("Stock ticker symbol (e.g. AAPL)"),
});

export type FetchCompanyProfileInput = z.infer<typeof FetchCompanyProfileInput>;

/**
 * Fetch a company profile with two-tier caching.
 */
export async function fetchCompanyProfile(ticker: string): Promise<CompanyProfile> {
  const normalizedTicker = ticker.toUpperCase();
  const cacheKey = `profile:${normalizedTicker}`;

  // 1. Fast path: normalized companies table (coverage-based, permanent)
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
      fromCache: true,
      source: "companies_table",
    };
  }

  // 2. TTL cache: raw Finnhub response
  let rawProfile = getCachedResponse(cacheKey);

  if (!rawProfile) {
    rawProfile = await finnhubProvider.getCompanyProfile(normalizedTicker);
    if (!rawProfile) {
      throw new Error(`No profile found for ${normalizedTicker}`);
    }
    setCachedResponse(cacheKey, rawProfile, PROFILE_TTL_MINUTES);
  }

  // 3. Normalize and persist
  const marketCap =
    typeof rawProfile.marketCapitalization === "number"
      ? rawProfile.marketCapitalization * 1_000_000
      : undefined;

  const profile: CompanyProfile = {
    ticker: normalizedTicker,
    name: rawProfile.name || "Unknown",
    sector: rawProfile.sector || "Unknown",
    industry: rawProfile.industry || rawProfile.finnhubIndustry || "Unknown",
    exchange: rawProfile.exchange || "Unknown",
    currency: rawProfile.currency || "Unknown",
    country: rawProfile.country || "Unknown",
    website: rawProfile.weburl || rawProfile.website || undefined,
    marketCap,
    fetchedAt: new Date().toISOString(),
    fromCache: false,
    source: "finnhub",
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

// Tool definition for MCP registration
export const fetchCompanyProfileTool = {
  name: "fetch_company_profile",
  description: "Get a company's profile including name, sector, industry, exchange, market cap, and more. Data is cached in SQLite to minimize API calls.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: {
        type: "string",
        description: "Stock ticker symbol (e.g. AAPL)",
      },
    },
    required: ["ticker"],
  },
  handler: async (args: any) => {
    const input = FetchCompanyProfileInput.parse(args);
    const profile = await fetchCompanyProfile(input.ticker);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(profile, null, 2),
        },
      ],
    };
  },
};