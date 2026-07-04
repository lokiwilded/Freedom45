import { z } from "zod";
import { finnhubProvider } from "../providers/finnhub.js";
import { db } from "../db.js";
import { getCachedResponse, setCachedResponse } from "../lib/cache.js";
import { calculateOutlierScore, parseAmountRange } from "../scoring/outlier.js";
import { DEFAULT_OUTLIER_SETTINGS } from "../config/outlier-settings.js";

/**
 * get_congress_trades MCP tool
 *
 * Fetches congressional stock trades from Finnhub, caches in SQLite.
 * Supports filtering by symbol, date range, chamber, party, and minimum trade size.
 *
 * ENHANCED: Now includes live price, market cap, outlier scoring (0-100),
 * viability assessment, and configurable outlier filtering.
 */

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------
export const GetCongressTradesInput = z.object({
  symbol: z.string().optional().describe("Stock ticker to filter by (e.g. AAPL)"),
  days_back: z.number().min(1).max(365).default(30).describe("How many days back to look"),
  chamber: z.enum(["senate", "house"]).optional().describe("Filter by chamber"),
  party: z.enum(["democrat", "republican"]).optional().describe("Filter by party"),
  min_amount: z.string().optional().describe("Minimum trade size bucket (e.g. $15,001-$50,000)"),
  limit: z.number().min(1).max(100).default(50).describe("Max results to return"),

  // Outlier / enhancement parameters
  outlier_score_min: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Minimum outlier score (0-100). Trades below this are filtered out."),
  market_cap_max: z
    .number()
    .positive()
    .optional()
    .describe("Maximum market cap to include (defaults to 500M)"),
  market_cap_min: z
    .number()
    .nonnegative()
    .optional()
    .describe("Minimum market cap to include (defaults to 10M)"),
  excluded_tickers: z
    .array(z.string().toUpperCase())
    .optional()
    .describe("Tickers to exclude from results"),
  included_tickers: z
    .array(z.string().toUpperCase())
    .optional()
    .describe("Only show these tickers (optional override)"),
  include_live_price: z
    .boolean()
    .default(true)
    .describe("Fetch live price for each trade (default: true)"),
});

export type GetCongressTradesInput = z.infer<typeof GetCongressTradesInput>;

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------
export interface CongressTradeResult {
  politician: string;
  chamber: string;
  party: string;
  ticker: string;
  asset: string;
  type: string;
  amount: string;
  date: string;
  filed: string;

  // Enhanced fields
  live_price: number | null;
  price_change_pct: number | null; // vs previous close
  market_cap: number | null;
  outlier_score: number;
  outlier_label: string; // "low" | "medium" | "high" | "very_high"
  viability: string; // "viable" | "caution" | "too_far" | "unknown"
  viability_reason: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RawTrade {
  name: string;
  chamber: string;
  party: string;
  symbol: string;
  assetDescription: string;
  type: string;
  amount: string;
  transactionDate: string;
  filingDate: string;
}

/**
 * Fetch a company profile, returning null on failure instead of throwing.
 * Uses the companies table as a fast-path cache to minimize Finnhub calls.
 */
async function fetchProfileSafe(ticker: string): Promise<{ marketCap: number | null } | null> {
  try {
    // Fast path: companies table
    const row = db
      .prepare("SELECT market_cap FROM companies WHERE ticker = ?")
      .get(ticker.toUpperCase()) as { market_cap: number | null } | undefined;

    if (row && row.market_cap != null) {
      return { marketCap: row.market_cap };
    }

    const profile = await finnhubProvider.getCompanyProfile(ticker);
    if (!profile) return null;

    // Finnhub returns marketCapitalization in millions.
    const marketCap =
      typeof profile.marketCapitalization === "number"
        ? profile.marketCapitalization * 1_000_000
        : null;

    return { marketCap };
  } catch {
    return null;
  }
}

/**
 * Fetch a live quote, returning null on failure instead of throwing.
 */
async function fetchQuoteSafe(
  ticker: string
): Promise<{ price: number | null; changePct: number | null } | null> {
  try {
    const quote = await finnhubProvider.getQuote(ticker);
    // Finnhub returns 0 for all fields when a quote is unavailable.
    if (!quote || (quote.c === 0 && quote.pc === 0)) {
      return { price: null, changePct: null };
    }
    const changePct =
      quote.pc && quote.pc !== 0 ? (quote.c - quote.pc) / quote.pc * 100 : null;
    return { price: quote.c, changePct };
  } catch {
    return { price: null, changePct: null };
  }
}

/**
 * Run an async mapper over an array with a concurrency limit.
 * Failed items are caught and returned as null (Promise.allSettled-style).
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await fn(items[i]!, i);
      } catch {
        results[i] = null;
      }
    }
  }

  const workers: Promise<void>[] = [];
  const workerCount = Math.min(limit, items.length);
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

/**
 * Count how many OTHER trades in the current batch reference the same ticker.
 * Used as a cheap proxy for "consensus" (multiple politicians trading together).
 */
function buildConsensusMap(trades: RawTrade[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of trades) {
    const ticker = t.symbol?.toUpperCase();
    if (!ticker) continue;
    counts.set(ticker, (counts.get(ticker) ?? 0) + 1);
  }
  // Consensus = number of OTHER traders (exclude self), so subtract 1.
  return counts;
}

function daysBetween(dateStr: string, now: Date): number {
  if (!dateStr) return Number.MAX_SAFE_INTEGER;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return Number.MAX_SAFE_INTEGER;
  return Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function determineViability(
  outlierScore: number,
  marketCap: number | null,
  marketCapMax: number,
  minOutlierScore: number,
  _livePrice: number | null
): { viability: string; reason: string } {
  // too_far takes precedence over caution
  if (marketCap != null && marketCap > marketCapMax) {
    return { viability: "too_far", reason: `Market cap $${marketCap.toLocaleString()} exceeds max $${marketCapMax.toLocaleString()}` };
  }
  if (outlierScore < minOutlierScore) {
    return { viability: "caution", reason: `Outlier score ${outlierScore} below threshold ${minOutlierScore}` };
  }
  if (marketCap != null && marketCap <= marketCapMax && outlierScore >= minOutlierScore) {
    return { viability: "viable", reason: `Small cap ($${marketCap.toLocaleString()}) + high score (${outlierScore})` };
  }
  return { viability: "unknown", reason: "Insufficient data to assess viability" };
}

// ---------------------------------------------------------------------------
// Main tool implementation
// ---------------------------------------------------------------------------
export async function getCongressTrades(input: GetCongressTradesInput): Promise<{
  trades: CongressTradeResult[];
  total: number;
  from_cache: boolean;
}> {
  const now = new Date();
  const fromDate = new Date(now.getTime() - input.days_back * 24 * 60 * 60 * 1000);
  const fromStr = fromDate.toISOString().split("T")[0];
  const toStr = now.toISOString().split("T")[0];

  // Cache key includes all filter parameters
  const cacheKey = `congress:${input.symbol || "all"}:${input.chamber || "all"}:${input.party || "all"}:${input.min_amount || "all"}:${fromStr}:${toStr}`;

  let rawTrades: RawTrade[] = [];
  let cached = false;

  // Try TTL cache first
  const cachedTrades = getCachedResponse(cacheKey);

  if (cachedTrades) {
    rawTrades = cachedTrades as RawTrade[];
    cached = true;
  } else {
    // Fetch from Finnhub
    const fetched = await finnhubProvider.getCongressTrades(input.symbol, fromStr, toStr);
    rawTrades = fetched.map((t) => ({
      name: t.name,
      chamber: t.chamber,
      party: t.party,
      symbol: t.symbol,
      assetDescription: t.assetDescription,
      type: t.type,
      amount: t.amount || "",
      transactionDate: t.transactionDate,
      filingDate: t.filingDate,
    }));

    // Cache for 5 minutes (congress trades don't update that frequently)
    setCachedResponse(cacheKey, rawTrades, 5);

    // Also store in congress_trades table for historical queries (batch insert).
    // NOTE: node:sqlite's DatabaseSync has no db.transaction() helper (only
    // exec/prepare), so we use the manual BEGIN/COMMIT/ROLLBACK pattern. The
    // prior "fix" recorded in project memory referenced db.transaction(), but
    // that method does not exist in node:sqlite (verified on Node v26 /
    // @types/node@22). exec() returns void which is fine here since we don't
    // assign the result.
    db.exec("BEGIN");
    try {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO congress_trades
          (politician_name, chamber, party, ticker, asset_description, transaction_type, amount_range, transaction_date, disclosure_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const t of rawTrades) {
        stmt.run(
          t.name,
          t.chamber,
          t.party,
          t.symbol,
          t.assetDescription,
          t.type,
          t.amount,
          t.transactionDate,
          t.filingDate
        );
      }
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }

  // -----------------------------------------------------------------------
  // Enrichment: live price + market cap + outlier score per trade
  // -----------------------------------------------------------------------
  const consensusMap = buildConsensusMap(rawTrades);

  // Pre-filter: skip trades without a valid ticker (cannot enrich them).
  const enrichable = rawTrades.filter((t) => t.symbol && t.symbol.trim().length > 0);

  // Fetch profile + quote concurrently (limit=5 to respect Finnhub rate limits).
  const enrichmentInputs = enrichable.map((t) => ({
    ticker: t.symbol.toUpperCase(),
    includePrice: input.include_live_price,
  }));

  const enriched = await mapWithConcurrency(enrichmentInputs, 5, async (ei) => {
    const [profileResult, quoteResult] = await Promise.all([
      fetchProfileSafe(ei.ticker),
      ei.includePrice ? fetchQuoteSafe(ei.ticker) : Promise.resolve(null),
    ]);

    return {
      ticker: ei.ticker,
      marketCap: profileResult?.marketCap ?? null,
      livePrice: quoteResult?.price ?? null,
      priceChangePct: quoteResult?.changePct ?? null,
    };
  });

  // Build a lookup from ticker -> enrichment data.
  const enrichmentByTicker = new Map<string, { marketCap: number | null; livePrice: number | null; priceChangePct: number | null }>();
  enriched.forEach((e) => {
    if (!e) return;
    enrichmentByTicker.set(e.ticker, {
      marketCap: e.marketCap,
      livePrice: e.livePrice,
      priceChangePct: e.priceChangePct,
    });
  });

  // -----------------------------------------------------------------------
  // Build enhanced result rows
  // -----------------------------------------------------------------------
  const results: CongressTradeResult[] = enrichable.map((t) => {
    const ticker = t.symbol.toUpperCase();
    const enr = enrichmentByTicker.get(ticker);
    const marketCap = enr?.marketCap ?? null;
    const livePrice = enr?.livePrice ?? null;
    const priceChangePct = enr?.priceChangePct ?? null;

    const daysOld = daysBetween(t.transactionDate, now);
    const sameTickerRecentTrades = Math.max(0, (consensusMap.get(ticker) ?? 1) - 1);
    const tradeValue = parseAmountRange(t.amount);

    const outlier = calculateOutlierScore({
      marketCap,
      tradeValue,
      transactionType: t.type,
      sameTickerRecentTrades,
      daysOld,
    });

    const marketCapMax = input.market_cap_max ?? DEFAULT_OUTLIER_SETTINGS.marketCapMax;
    const minOutlierScore = input.outlier_score_min ?? DEFAULT_OUTLIER_SETTINGS.minOutlierScore;

    const { viability, reason } = determineViability(
      outlier.score,
      marketCap,
      marketCapMax,
      minOutlierScore,
      livePrice
    );

    return {
      politician: t.name,
      chamber: t.chamber,
      party: t.party,
      ticker,
      asset: t.assetDescription,
      type: t.type,
      amount: t.amount || "",
      date: t.transactionDate,
      filed: t.filingDate,
      live_price: livePrice,
      price_change_pct: priceChangePct,
      market_cap: marketCap,
      outlier_score: outlier.score,
      outlier_label: outlier.label,
      viability,
      viability_reason: reason,
    };
  });

  // -----------------------------------------------------------------------
  // Apply post-fetch filters
  // -----------------------------------------------------------------------
  let filtered = [...results];

  if (input.chamber) {
    const chamber = input.chamber.toLowerCase();
    filtered = filtered.filter((t) => t.chamber?.toLowerCase() === chamber);
  }

  if (input.party) {
    const party = input.party.toLowerCase();
    filtered = filtered.filter((t) => t.party?.toLowerCase() === party);
  }

  if (input.min_amount) {
    const minValue = parseAmountRange(input.min_amount);
    if (minValue !== null) {
      filtered = filtered.filter((t) => {
        if (!t.amount) return false;
        const tradeValue = parseAmountRange(t.amount);
        return tradeValue !== null && tradeValue >= minValue;
      });
    }
  }

  // Outlier-score filter
  const minScore = input.outlier_score_min ?? DEFAULT_OUTLIER_SETTINGS.minOutlierScore;
  filtered = filtered.filter((t) => t.outlier_score >= minScore);

  // Market cap filters
  if (input.market_cap_max !== undefined) {
    filtered = filtered.filter((t) => t.market_cap === null || t.market_cap <= input.market_cap_max!);
  }
  if (input.market_cap_min !== undefined) {
    filtered = filtered.filter((t) => t.market_cap === null || t.market_cap >= input.market_cap_min!);
  }

  // Excluded tickers
  if (input.excluded_tickers && input.excluded_tickers.length > 0) {
    const excluded = new Set(input.excluded_tickers.map((s) => s.toUpperCase()));
    filtered = filtered.filter((t) => !excluded.has(t.ticker.toUpperCase()));
  }

  // Included tickers (if set, only show these)
  if (input.included_tickers && input.included_tickers.length > 0) {
    const included = new Set(input.included_tickers.map((s) => s.toUpperCase()));
    filtered = filtered.filter((t) => included.has(t.ticker.toUpperCase()));
  }

  // Sort by outlier_score descending (most interesting first), tie-break by date.
  filtered.sort((a, b) => {
    if (b.outlier_score !== a.outlier_score) return b.outlier_score - a.outlier_score;
    return b.date.localeCompare(a.date);
  });

  // Apply limit
  filtered = filtered.slice(0, input.limit);

  return {
    trades: filtered,
    total: filtered.length,
    from_cache: cached && !input.include_live_price, // only true if raw cached AND no enrichment
  };
}

// ---------------------------------------------------------------------------
// Tool definition for MCP registration
// ---------------------------------------------------------------------------
export const getCongressTradesTool = {
  name: "get_congress_trades",
  description:
    "Get congressional stock trades with live prices, market caps, and outlier scoring (0-100). " +
    "Tracks what US Senators and Representatives are buying/selling. " +
    "Each trade is scored on market cap, trade size, transaction type, consensus, and recency, " +
    "then assessed for viability (viable / caution / too_far / unknown). " +
    "Supports filtering by ticker, date range, chamber, party, min trade size, outlier score, market cap range, and excluded tickers.",
  inputSchema: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "Stock ticker to filter by (e.g. AAPL)",
      },
      days_back: {
        type: "number",
        description: "How many days back to look (default: 30, max: 365)",
        default: 30,
      },
      chamber: {
        type: "string",
        enum: ["senate", "house"],
        description: "Filter by chamber",
      },
      party: {
        type: "string",
        enum: ["democrat", "republican"],
        description: "Filter by party",
      },
      min_amount: {
        type: "string",
        description: "Minimum trade size bucket (e.g. $15,001-$50,000)",
      },
      limit: {
        type: "number",
        description: "Max results to return (default: 50, max: 100)",
        default: 50,
      },
      outlier_score_min: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description: "Minimum outlier score (0-100). Trades below this are filtered out.",
      },
      market_cap_max: {
        type: "number",
        description: "Maximum market cap to include (defaults to 500M)",
      },
      market_cap_min: {
        type: "number",
        description: "Minimum market cap to include (defaults to 10M)",
      },
      excluded_tickers: {
        type: "array",
        items: { type: "string" },
        description: "Tickers to exclude from results",
      },
      included_tickers: {
        type: "array",
        items: { type: "string" },
        description: "Only show these tickers (optional override)",
      },
      include_live_price: {
        type: "boolean",
        description: "Fetch live price for each trade (default: true)",
        default: true,
      },
    },
  },
  handler: async (args: any) => {
    const input = GetCongressTradesInput.parse(args);
    const result = await getCongressTrades(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};