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
