/**
 * Pure calculation helpers for price-series analytics.
 * No API calls here. Inputs are arrays of { date, close }.
 */

export interface PricePoint {
  date: string;
  close: number;
}

export function calculateReturns(prices: PricePoint[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1]!;
    const curr = prices[i]!;
    returns.push((curr.close - prev.close) / prev.close);
  }
  return returns;
}

export function calculateCAGR(startPrice: number, endPrice: number, years: number): number {
  if (years <= 0 || startPrice <= 0) return 0;
  return Math.pow(endPrice / startPrice, 1 / years) - 1;
}

export function calculateVolatility(returns: number[]): number {
  if (returns.length === 0) return 0;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252); // Annualized
}

export function calculateMaxDrawdown(prices: PricePoint[]): number {
  let peak = -Infinity;
  let maxDrawdown = 0;

  for (const p of prices) {
    if (p.close > peak) peak = p.close;
    const drawdown = (peak - p.close) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return maxDrawdown;
}

export function calculateBeta(tickerReturns: number[], benchmarkReturns: number[]): number {
  if (tickerReturns.length < 2 || tickerReturns.length !== benchmarkReturns.length) return 0;

  const n = tickerReturns.length;
  const meanTicker = tickerReturns.reduce((s, r) => s + r, 0) / n;
  const meanBench = benchmarkReturns.reduce((s, r) => s + r, 0) / n;

  let covariance = 0;
  let benchmarkVariance = 0;

  for (let i = 0; i < n; i++) {
    const tDiff = tickerReturns[i]! - meanTicker;
    const bDiff = benchmarkReturns[i]! - meanBench;
    covariance += tDiff * bDiff;
    benchmarkVariance += bDiff * bDiff;
  }

  if (benchmarkVariance === 0) return 0;
  return covariance / benchmarkVariance;
}

export function calculateAlpha(
  tickerReturns: number[],
  benchmarkReturns: number[],
  riskFreeRate: number = 0.02
): number {
  const beta = calculateBeta(tickerReturns, benchmarkReturns);
  const annualizedRiskFree = riskFreeRate / 252;

  const meanTicker = tickerReturns.reduce((s, r) => s + r, 0) / tickerReturns.length;
  const meanBench = benchmarkReturns.reduce((s, r) => s + r, 0) / benchmarkReturns.length;

  return meanTicker - (annualizedRiskFree + beta * (meanBench - annualizedRiskFree));
}

export function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
  if (returns.length === 0) return 0;

  const annualizedRiskFree = riskFreeRate / 252;
  const excessReturns = returns.map((r) => r - annualizedRiskFree);
  const meanExcess = excessReturns.reduce((s, r) => s + r, 0) / excessReturns.length;

  if (excessReturns.length < 2) return 0;

  const variance =
    excessReturns.reduce((sum, r) => sum + Math.pow(r - meanExcess, 2), 0) / excessReturns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  return (meanExcess / stdDev) * Math.sqrt(252);
}

export interface MonthlyOutperformanceResult {
  outperformingMonths: number;
  totalMonths: number;
  percentage: number;
}

export function calculateMonthlyOutperformance(
  tickerPrices: PricePoint[],
  benchmarkPrices: PricePoint[]
): MonthlyOutperformanceResult {
  const tickerMonthly = groupByMonth(tickerPrices);
  const benchmarkMonthly = groupByMonth(benchmarkPrices);

  const commonMonths = Object.keys(tickerMonthly).filter((m) => m in benchmarkMonthly);
  if (commonMonths.length === 0) {
    return { outperformingMonths: 0, totalMonths: 0, percentage: 0 };
  }

  let outperforming = 0;
  for (const month of commonMonths) {
    const tReturn = tickerMonthly[month]!;
    const bReturn = benchmarkMonthly[month]!;
    if (tReturn > bReturn) outperforming++;
  }

  return {
    outperformingMonths: outperforming,
    totalMonths: commonMonths.length,
    percentage: outperforming / commonMonths.length,
  };
}

function groupByMonth(prices: PricePoint[]): Record<string, number> {
  const monthly: Record<string, { first: number; last: number }> = {};

  for (const p of prices) {
    const monthKey = p.date.substring(0, 7);
    if (!(monthKey in monthly)) {
      monthly[monthKey] = { first: p.close, last: p.close };
    }
    monthly[monthKey]!.last = p.close;
  }

  const result: Record<string, number> = {};
  for (const [month, { first, last }] of Object.entries(monthly)) {
    if (first > 0) {
      result[month] = (last - first) / first;
    }
  }

  return result;
}
