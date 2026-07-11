/**
 * Shared verdict / label helpers for combo analysis tools.
 *
 * All combo tools return descriptive labels instead of raw scores so that agents
 * can answer in plain language. Numeric scores are still available for graphing.
 */

export type RangeBand = { min: number; max: number; label: string };

/**
 * Map a 0-100 score to a descriptive label using ordered bands.
 * Bands are inclusive on the upper bound: [min, max).
 */
export function labelFromBands(score: number, bands: RangeBand[]): string {
  if (!Number.isFinite(score)) return bands[bands.length - 1]?.label ?? "Unknown";
  for (const band of bands) {
    if (score >= band.min && score < band.max) return band.label;
  }
  // Exact 100 falls through, so return the top label.
  return bands[bands.length - 1]?.label ?? "Unknown";
}

/** Standard bullish / bearish pressure labels for buy/sell ratios. */
export function pressureLabel(ratio: number, noData = false): string {
  if (noData) return "No Data";
  if (ratio >= 4) return "Heavy Accumulation";
  if (ratio >= 1.5) return "Accumulation";
  if (ratio > 0.67) return "Neutral";
  if (ratio > 0.25) return "Distribution";
  return "Heavy Distribution";
}

/** Trend direction when comparing current and prior values. */
export function trendDirection(current: number | null, prior: number | null, threshold = 0.01): "rising" | "falling" | "stable" | "unknown" {
  if (current == null || prior == null || prior === 0) return "unknown";
  const change = (current - prior) / Math.abs(prior);
  if (change > threshold) return "rising";
  if (change < -threshold) return "falling";
  return "stable";
}

/** Standard momentum labels for 0-100 scores. */
export function momentumLabel(score: number, noData = false): string {
  if (noData) return "No Data";
  return labelFromBands(score, [
    { min: 0, max: 20, label: "Weak" },
    { min: 20, max: 40, label: "Softening" },
    { min: 40, max: 60, label: "Stable" },
    { min: 60, max: 80, label: "Improving" },
    { min: 80, max: 101, label: "Strong" },
  ]);
}

/** Standard convergence labels. */
export function convergenceLabel(score: number, overlap: number, noData = false): string {
  if (noData) return "No Data";
  if (score >= 80 && overlap >= 3) return "Very High Convergence";
  if (score >= 60 && overlap >= 2) return "High Convergence";
  if (score >= 40 && overlap >= 2) return "Moderate Convergence";
  if (overlap === 0) return "No Convergence";
  return "Mixed Signals";
}

/** Standard valuation labels. */
export function valuationLabel(score: number, noData = false): string {
  if (noData) return "Insufficient Data";
  return labelFromBands(score, [
    { min: 0, max: 20, label: "Expensive" },
    { min: 20, max: 40, label: "Overvalued" },
    { min: 40, max: 60, label: "Fairly Valued" },
    { min: 60, max: 80, label: "Undervalued" },
    { min: 80, max: 101, label: "Deeply Undervalued" },
  ]);
}

/** Standard yield labels. */
export function yieldLabel(totalYield: number, noData = false): string {
  if (noData) return "No Data";
  return labelFromBands(totalYield * 100, [
    { min: 0, max: 1, label: "No Yield" },
    { min: 1, max: 3, label: "Low Yield" },
    { min: 3, max: 5, label: "Moderate Yield" },
    { min: 5, max: 8, label: "High Yield" },
    { min: 8, max: 101, label: "Very High Yield" },
  ]);
}

/** Standard liquidity regime labels. */
export function liquidityRegimeLabel(liquidityYoY: number, riskOnScore: number, noData = false): string {
  if (noData) return "No Data";
  if (liquidityYoY > 5 && riskOnScore >= 60) return "Expansion (Risk-On)";
  if (liquidityYoY > 5) return "Expansion (Caution)";
  if (liquidityYoY < -2 && riskOnScore <= 40) return "Contraction (Risk-Off)";
  if (liquidityYoY < -2) return "Contraction (Defensive)";
  return "Neutral";
}

/** Standard catalyst labels. */
export function catalystLabel(score: number, leadDaysAvg: number | null, noData = false): string {
  if (noData) return "No Data";
  if (score >= 70 && leadDaysAvg != null && leadDaysAvg > 0) return "High Catalyst Signal";
  if (score >= 40) return "Some Catalyst Signal";
  return "No Clear Catalyst";
}

/** Standard relative strength / rotation labels. */
export function rotationLabel(score: number, alpha: number | null, noData = false): string {
  if (noData) return "No Data";
  if (score >= 75 && alpha != null && alpha > 0) return "Leading";
  if (score >= 55) return "Improving";
  if (score <= 25 && alpha != null && alpha < 0) return "Lagging";
  if (score <= 45) return "Weakening";
  return "Stable";
}

/** Clamp and round a number safely. */
export function r(value: number | null | undefined, digits = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}
