/**
 * Multi-provider data registry with automatic fallback.
 *
 * Each data type (dividends, congress_trades, institutional_ownership, etc.)
 * has an ordered list of providers. When a combo tool needs data, it calls
 * `fetchData("dividends", { ticker })` and the registry tries each provider
 * in order until one returns usable data.
 *
 * Adding a new API source:
 * 1. Implement the DataProvider interface for that data type
 * 2. Call registerProvider("dividends", myProvider)
 * 3. The combo tools automatically pick it up
 *
 * The registry tries providers in registration order. If a provider throws,
 * returns null, or returns an empty array, it falls through to the next.
 */

export type DataType =
  | "dividends"
  | "congress_trades"
  | "institutional_ownership"
  | "fund_ownership"
  | "price_target"
  | "upgrade_downgrade"
  | "insider_transactions"
  | "stock_quote"
  | "company_profile"
  | "company_news"
  | "market_news"
  | "earnings_surprise"
  | "recommendation_trends"
  | "fundamental_metrics"
  | "peers"
  | "splits"
  | "sec_filings";

export interface FetchParams {
  ticker?: string;
  from?: string;
  to?: string;
  lookbackDays?: number;
  years?: number;
  category?: string;
  [key: string]: unknown;
}

export interface FetchResult<T = unknown> {
  data: T;
  source: string;
  fromCache: boolean;
  error?: string;
}

export interface DataProvider<T = unknown> {
  name: string;
  dataType: DataType;
  fetch: (params: FetchParams) => Promise<T | null>;
}

const registry = new Map<DataType, DataProvider[]>();

export function registerProvider(provider: DataProvider): void {
  const list = registry.get(provider.dataType) ?? [];
  list.push(provider);
  registry.set(provider.dataType, list);
}

export function getProviders(dataType: DataType): DataProvider[] {
  return registry.get(dataType) ?? [];
}

export function listRegisteredProviders(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [dt, providers] of registry.entries()) {
    out[dt] = providers.map((p) => p.name);
  }
  return out;
}

/**
 * Try each registered provider for a data type in order.
 * Returns the first non-null, non-empty result.
 * If all providers fail, returns null.
 */
export async function fetchData<T = unknown>(
  dataType: DataType,
  params: FetchParams
): Promise<FetchResult<T> | null> {
  const providers = registry.get(dataType);
  if (!providers || providers.length === 0) return null;

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const data = await provider.fetch(params);
      if (data != null && !(Array.isArray(data) && data.length === 0)) {
        return {
          data: data as T,
          source: provider.name,
          fromCache: false,
        };
      }
    } catch (e: any) {
      errors.push(`${provider.name}: ${e?.message ?? String(e)}`);
    }
  }

  // All providers failed or returned empty
  return {
    data: null as T,
    source: "none",
    fromCache: false,
    error: errors.join("; "),
  };
}

/**
 * Like fetchData, but returns all results from all providers merged.
 * Useful when different providers have partial coverage.
 */
export async function fetchAllProviders<T = unknown>(
  dataType: DataType,
  params: FetchParams
): Promise<{ data: T[]; sources: string[]; errors: string[] }> {
  const providers = registry.get(dataType) ?? [];
  const results: T[] = [];
  const sources: string[] = [];
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const data = await provider.fetch(params);
      if (data != null) {
        if (Array.isArray(data)) {
          results.push(...(data as T[]));
        } else {
          results.push(data as T);
        }
        sources.push(provider.name);
      }
    } catch (e: any) {
      errors.push(`${provider.name}: ${e?.message ?? String(e)}`);
    }
  }

  return { data: results, sources, errors };
}