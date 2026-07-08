/**
 * Unit tests for calculation helpers and scoring utilities.
 * Uses mock data — no API calls.
 */

import {
  calculateReturns,
  calculateCAGR,
  calculateVolatility,
  calculateMaxDrawdown,
  calculateBeta,
  calculateAlpha,
  calculateSharpeRatio,
  calculateMonthlyOutperformance,
} from "../../lib/calculations.js";
import type { PricePoint } from "../../lib/calculations.js";
import {
  verdictFromScore,
  linearScale,
  median,
  redistributeWeights,
  weightedScore,
} from "../../lib/scoring.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

function approxEqual(a: number, b: number, tolerance: number = 0.001): boolean {
  return Math.abs(a - b) < tolerance;
}

console.log("=== calculateReturns ===");
{
  const prices: PricePoint[] = [
    { date: "2026-01-01", close: 100 },
    { date: "2026-01-02", close: 110 },
    { date: "2026-01-03", close: 105 },
  ];
  const returns = calculateReturns(prices);
  assert(returns.length === 2, "returns array length = 2");
  assert(approxEqual(returns[0]!, 0.1), "first return = 10%");
  assert(approxEqual(returns[1]!, -0.04545, 0.0001), "second return ≈ -4.5%");
}

console.log("\n=== calculateCAGR ===");
{
  assert(approxEqual(calculateCAGR(100, 200, 5), 0.1487, 0.001), "100→200 over 5y ≈ 14.87%");
  assert(calculateCAGR(0, 200, 5) === 0, "zero start price → 0");
  assert(calculateCAGR(100, 100, 5) === 0, "no growth → 0");
}

console.log("\n=== calculateVolatility ===");
{
  const returns = [0.01, -0.02, 0.03, 0.01, -0.01];
  const vol = calculateVolatility(returns);
  assert(vol > 0, "volatility > 0");
  assert(vol < 1, "volatility < 1 (reasonable annualized)");
}

console.log("\n=== calculateMaxDrawdown ===");
{
  const prices: PricePoint[] = [
    { date: "2026-01-01", close: 100 },
    { date: "2026-01-02", close: 120 },
    { date: "2026-01-03", close: 90 },
    { date: "2026-01-04", close: 110 },
  ];
  const dd = calculateMaxDrawdown(prices);
  assert(approxEqual(dd, 0.25), "max drawdown = 25% (120→90)");
}

console.log("\n=== calculateBeta ===");
{
  const ticker = [0.01, 0.02, -0.01, 0.03, 0.01];
  const bench = [0.005, 0.01, -0.005, 0.015, 0.005];
  const beta = calculateBeta(ticker, bench);
  assert(beta > 0, "beta > 0 (positively correlated)");
  assert(approxEqual(beta, 2.0, 0.01), "beta ≈ 2.0 (ticker moves 2x benchmark)");

  assert(calculateBeta([], bench) === 0, "empty returns → 0");
  assert(calculateBeta(ticker, [0, 0, 0, 0, 0]) === 0, "zero variance benchmark → 0");
}

console.log("\n=== calculateAlpha ===");
{
  const ticker = [0.001, 0.002, 0.001, 0.003, 0.001];
  const bench = [0.0005, 0.001, 0.0005, 0.0015, 0.0005];
  const alpha = calculateAlpha(ticker, bench, 0.02);
  assert(typeof alpha === "number", "alpha is a number");
  assert(alpha !== 0 || ticker.length < 2, "alpha computed (non-trivial)");
}

console.log("\n=== calculateSharpeRatio ===");
{
  const returns = [0.001, 0.002, -0.001, 0.003, 0.001, 0.002, -0.001, 0.002, 0.001, 0.003];
  const sharpe = calculateSharpeRatio(returns, 0.02);
  assert(typeof sharpe === "number", "sharpe is a number");
  assert(sharpe > 0, "positive sharpe for positive excess returns");

  assert(calculateSharpeRatio([], 0.02) === 0, "empty returns → 0");
  assert(calculateSharpeRatio([0.001], 0.02) === 0, "single return → 0");
}

console.log("\n=== calculateMonthlyOutperformance ===");
{
  const ticker: PricePoint[] = [
    { date: "2026-01-01", close: 100 },
    { date: "2026-01-31", close: 110 },
    { date: "2026-02-01", close: 110 },
    { date: "2026-02-28", close: 115 },
    { date: "2026-03-01", close: 115 },
    { date: "2026-03-31", close: 108 },
  ];
  const bench: PricePoint[] = [
    { date: "2026-01-01", close: 100 },
    { date: "2026-01-31", close: 105 },
    { date: "2026-02-01", close: 105 },
    { date: "2026-02-28", close: 120 },
    { date: "2026-03-01", close: 120 },
    { date: "2026-03-31", close: 125 },
  ];
  const result = calculateMonthlyOutperformance(ticker, bench);
  assert(result.totalMonths === 3, "3 common months");
  assert(result.outperformingMonths === 1, "1 outperforming month (Jan: +10% vs +5%)");
  assert(approxEqual(result.percentage, 1 / 3, 0.01), "percentage ≈ 33.3%");
}

console.log("\n=== verdictFromScore ===");
{
  assert(verdictFromScore(85) === "Strong", "85 → Strong");
  assert(verdictFromScore(70) === "Favorable", "70 → Favorable");
  assert(verdictFromScore(50) === "Neutral", "50 → Neutral");
  assert(verdictFromScore(30) === "Unfavorable", "30 → Unfavorable");
  assert(verdictFromScore(10) === "Weak", "10 → Weak");
  assert(verdictFromScore(80) === "Strong", "80 → Strong (boundary)");
  assert(verdictFromScore(79.9) === "Favorable", "79.9 → Favorable (just below boundary)");
}

console.log("\n=== linearScale ===");
{
  assert(approxEqual(linearScale(10, 10, 20), 100), "value=optimal → 100");
  assert(approxEqual(linearScale(20, 10, 20), 0), "value=worst → 0");
  assert(approxEqual(linearScale(15, 10, 20), 50), "midpoint → 50");
  assert(approxEqual(linearScale(5, 10, 20), 100), "better than optimal → clamped to 100");
  assert(approxEqual(linearScale(25, 10, 20), 0), "worse than worst → clamped to 0");

  assert(approxEqual(linearScale(5, 10, 0), 50), "higher-is-better: midpoint → 50");
  assert(approxEqual(linearScale(10, 10, 0), 100), "higher-is-better: optimal → 100");
}

console.log("\n=== median ===");
{
  assert(median([1, 2, 3]) === 2, "odd count median = 2");
  assert(median([1, 2, 3, 4]) === 2.5, "even count median = 2.5");
  assert(median([null, 1, null, 2, 3]) === 2, "ignores nulls");
  assert(median([null, null]) === null, "all nulls → null");
  assert(median([]) === null, "empty → null");
}

console.log("\n=== redistributeWeights ===");
{
  const weights = { pe: 30, pb: 20, ps: 20, evEbitda: 15, div: 15 };
  const adjusted = redistributeWeights(weights, ["pe", "pb", "ps"]);
  assert(approxEqual(adjusted.pe!, 42.86, 0.1), "pe weight redistributed to ~42.86");
  assert(approxEqual(adjusted.pb! + adjusted.ps! + adjusted.pe!, 100, 0.1), "weights sum to 100");
  assert(adjusted.evEbitda === undefined, "missing component excluded");
}

console.log("\n=== weightedScore ===");
{
  const components = { pe: 80, pb: 60, ps: 40 };
  const weights = { pe: 50, pb: 30, ps: 20 };
  const score = weightedScore(components, weights);
  assert(approxEqual(score, 66, 0.1), "weighted score = (80*50 + 60*30 + 40*20)/100 = 66");
}

console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  process.exit(1);
}