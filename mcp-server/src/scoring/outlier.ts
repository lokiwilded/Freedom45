/**
 * Outlier trade scoring engine.
 *
 * Scores a trade 0-100 based on how "interesting" it is — small-cap companies,
 * large trade sizes, purchases (vs sales), multiple politicians trading the
 * same ticker, and recency all push the score higher.
 *
 * Scoring breakdown (100 pts total):
 *   - Market cap     (0-20):  Smaller cap = higher score
 *   - Trade size     (0-25):  Bigger trade = higher score
 *   - Tx type        (0-25):  Purchase = 25, Sale = 5
 *   - Consensus      (0-15):  More politicians trading same ticker = higher
 *   - Recency        (0-15):  Fresher trade = higher
 */

export interface OutlierScoreInput {
  /** Company market cap in raw dollars (null if unknown). */
  marketCap: number | null;
  /** Dollar value of the trade, parsed from amount range (null if unparseable). */
  tradeValue: number | null;
  /** Transaction type: "Purchase" or "Sale" (or other). */
  transactionType: string;
  /** How many OTHER politicians traded the same ticker recently. */
  sameTickerRecentTrades: number;
  /** Days since the transaction date. */
  daysOld: number;
}

export interface OutlierScoreBreakdown {
  marketCapScore: number; // 0-20
  tradeSizeScore: number; // 0-25
  transactionTypeScore: number; // 0-25
  consensusScore: number; // 0-15
  recencyScore: number; // 0-15
}

export type OutlierLabel = "low" | "medium" | "high" | "very_high";

export interface OutlierScoreResult {
  /** Aggregate score 0-100. */
  score: number;
  breakdown: OutlierScoreBreakdown;
  label: OutlierLabel;
}

/**
 * Parse a congressional trade amount range string into a midpoint dollar value.
 *
 * Examples:
 *   "$15,001-$50,000"  -> 32500.5  (midpoint of 15001 and 50000)
 *   "$1,001-$15,000"   -> 8000.5
 *   "$1,000,001+"      -> 1000001  (open-ended lower bound)
 *
 * Returns null if the string cannot be parsed.
 */
export function parseAmountRange(range: string): number | null {
  if (!range) return null;

  // Find all numeric groups (with optional commas) in the string.
  const matches = range.match(/\$?([\d,]+)/g);
  if (!matches || matches.length === 0) return null;

  const nums = matches.map((m) => parseInt(m.replace(/[$,]/g, ""), 10));
  if (nums.some((n) => Number.isNaN(n))) return null;

  if (nums.length === 1) {
    // Open-ended range like "$1,000,001+" — use the single value.
    return nums[0]!;
  }

  // Midpoint of first two numbers (typical "$low-$high" format).
  const low = nums[0]!;
  const high = nums[1]!;
  return Math.round((low + high) / 2);
}

function scoreMarketCap(marketCap: number | null): number {
  if (marketCap === null) return 0;
  if (marketCap <= 50_000_000) return 20;
  if (marketCap <= 200_000_000) return 15;
  if (marketCap <= 500_000_000) return 10;
  if (marketCap <= 2_000_000_000) return 5;
  return 0;
}

function scoreTradeSize(tradeValue: number | null): number {
  if (tradeValue === null) return 0;
  if (tradeValue >= 1_000_000) return 25;
  if (tradeValue >= 500_000) return 20;
  if (tradeValue >= 100_000) return 15;
  if (tradeValue >= 50_000) return 10;
  if (tradeValue >= 15_000) return 5;
  return 0;
}

function scoreTransactionType(transactionType: string): number {
  const normalized = transactionType?.trim().toLowerCase();
  if (normalized === "purchase" || normalized === "buy") return 25;
  if (normalized === "sale" || normalized === "sell") return 5;
  return 10;
}

function scoreConsensus(sameTickerRecentTrades: number): number {
  if (sameTickerRecentTrades <= 0) return 0;
  if (sameTickerRecentTrades <= 2) return 5;
  if (sameTickerRecentTrades <= 5) return 10;
  return 15;
}

function scoreRecency(daysOld: number): number {
  if (daysOld <= 7) return 15;
  if (daysOld <= 30) return 10;
  if (daysOld <= 60) return 5;
  return 0;
}

function labelFor(score: number): OutlierLabel {
  if (score >= 80) return "very_high";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

/**
 * Calculate the outlier score for a single trade.
 */
export function calculateOutlierScore(input: OutlierScoreInput): OutlierScoreResult {
  const marketCapScore = scoreMarketCap(input.marketCap);
  const tradeSizeScore = scoreTradeSize(input.tradeValue);
  const transactionTypeScore = scoreTransactionType(input.transactionType);
  const consensusScore = scoreConsensus(input.sameTickerRecentTrades);
  const recencyScore = scoreRecency(input.daysOld);

  const score =
    marketCapScore + tradeSizeScore + transactionTypeScore + consensusScore + recencyScore;

  return {
    score,
    breakdown: {
      marketCapScore,
      tradeSizeScore,
      transactionTypeScore,
      consensusScore,
      recencyScore,
    },
    label: labelFor(score),
  };
}