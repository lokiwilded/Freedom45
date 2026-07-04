/**
 * Shared scoring helpers for composite analysis tools.
 *
 * Convention: all scores are 0-100. Verdict thresholds:
 *   80-100  Strong
 *   60-79   Favorable
 *   40-59   Neutral
 *   20-39   Unfavorable
 *   0-19    Weak
 */

export type Verdict = "Strong" | "Favorable" | "Neutral" | "Unfavorable" | "Weak";

export function verdictFromScore(score: number): Verdict {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Favorable";
  if (score >= 40) return "Neutral";
  if (score >= 20) return "Unfavorable";
  return "Weak";
}

/**
 * Map a value to a 0-100 score where:
 *  - `optimal` (or better) → 100
 *  - `worst` (or worse) → 0
 *  - between → linear
 *
 * For "lower is better" metrics (e.g. P/E): pass optimal < worst.
 * For "higher is better" metrics (e.g. dividend yield): pass optimal > worst.
 */
export function linearScale(value: number, optimal: number, worst: number): number {
  if (worst === optimal) return 50;
  const ratio = (value - worst) / (optimal - worst);
  return Math.max(0, Math.min(100, ratio * 100));
}

/**
 * Compute the median of an array of numbers, ignoring nulls.
 * Returns null if no valid values.
 */
export function median(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && !isNaN(v));
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

/**
 * Redistribute weights when some components are missing (null).
 * Takes the original weights and a set of available component names.
 * Returns adjusted weights that sum to 100 over the available components.
 */
export function redistributeWeights(
  weights: Record<string, number>,
  available: string[]
): Record<string, number> {
  const totalAvailable = available.reduce((sum, k) => sum + (weights[k] ?? 0), 0);
  if (totalAvailable === 0) return {};

  const result: Record<string, number> = {};
  for (const key of available) {
    result[key] = ((weights[key] ?? 0) / totalAvailable) * 100;
  }
  return result;
}

/**
 * Weighted composite score from component scores and their weights.
 * Both weights and scores are 0-100; result is 0-100.
 */
export function weightedScore(
  components: Record<string, number>,
  weights: Record<string, number>
): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [key, score] of Object.entries(components)) {
    const weight = weights[key] ?? 0;
    weightedSum += score * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}