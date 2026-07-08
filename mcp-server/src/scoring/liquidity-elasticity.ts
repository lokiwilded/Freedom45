/**
 * Liquidity-elasticity math (pure, no I/O).
 *
 * Measures how strongly an asset moves with a liquidity driver, using YEAR-OVER-YEAR
 * percent changes (not raw levels — both series trend up over time, which would manufacture
 * fake correlation). The regression slope of assetYoY on driverYoY is the "beta":
 * "per +1% YoY liquidity, the asset historically moved +beta% YoY".
 */

export interface XYPoint {
  date: string;
  x: number; // driver YoY (fraction, 0.10 = +10%)
  y: number; // asset YoY (fraction)
}

export interface Regression {
  n: number;
  slope: number; // beta
  intercept: number;
  r: number;
  r2: number;
  slopeStdErr: number;
  residStdErr: number;
  xbar: number;
  sxx: number;
}

export interface Prediction {
  driverChangePct: number;
  expectedAssetChangePct: number;
  lo95Pct: number;
  hi95Pct: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Convert a date->value series into a date->YoY-fraction series.
 * Works for monthly (YYYY-MM-01) and quarterly (YYYY-0{1,4,7,10}-01) grids alike:
 * the one-year-prior key is the same month string with the year decremented.
 */
export function toYoY(series: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [date, v] of series) {
    const [y, m] = date.split("-");
    const priorKey = `${Number(y) - 1}-${m}-01`;
    const pv = series.get(priorKey);
    if (pv !== undefined && pv !== 0 && Number.isFinite(v) && Number.isFinite(pv)) {
      out.set(date, v / pv - 1);
    }
  }
  return out;
}

/** Add n months to a YYYY-MM-01 key. */
export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const idx = y! * 12 + (m! - 1) + n;
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}-01`;
}

/**
 * Inner-join two YoY series into regression points, with the driver LEADING the asset by
 * `lagMonths` (driver at t is matched to asset at t+lag). lag=0 is contemporaneous.
 */
export function align(
  driverYoY: Map<string, number>,
  assetYoY: Map<string, number>,
  lagMonths = 0
): XYPoint[] {
  const pts: XYPoint[] = [];
  for (const [date, x] of driverYoY) {
    const assetDate = lagMonths ? addMonths(date, lagMonths) : date;
    const y = assetYoY.get(assetDate);
    if (y !== undefined) pts.push({ date, x, y });
  }
  return pts.sort((a, b) => a.date.localeCompare(b.date));
}

/** Ordinary least squares of y on x. */
export function regress(pts: XYPoint[]): Regression {
  const n = pts.length;
  const xbar = mean(pts.map((p) => p.x));
  const ybar = mean(pts.map((p) => p.y));
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) {
    sxx += (p.x - xbar) ** 2;
    sxy += (p.x - xbar) * (p.y - ybar);
    syy += (p.y - ybar) ** 2;
  }
  const slope = sxy / sxx;
  const intercept = ybar - slope * xbar;
  let sse = 0;
  for (const p of pts) {
    const yhat = intercept + slope * p.x;
    sse += (p.y - yhat) ** 2;
  }
  const r = sxy / Math.sqrt(sxx * syy);
  const residStdErr = n > 2 ? Math.sqrt(sse / (n - 2)) : NaN;
  const slopeStdErr = residStdErr / Math.sqrt(sxx);
  return { n, slope, intercept, r, r2: r * r, slopeStdErr, residStdErr, xbar, sxx };
}

/**
 * Predict expected asset YoY for a projected driver YoY, with a 95% prediction interval.
 * Inputs and outputs are in PERCENT (e.g. 10 = +10%).
 */
export function predict(reg: Regression, driverChangePct: number): Prediction {
  const x0 = driverChangePct / 100;
  const yhat = reg.intercept + reg.slope * x0;
  const sePred = reg.residStdErr * Math.sqrt(1 + 1 / reg.n + (x0 - reg.xbar) ** 2 / reg.sxx);
  return {
    driverChangePct,
    expectedAssetChangePct: yhat * 100,
    lo95Pct: (yhat - 1.96 * sePred) * 100,
    hi95Pct: (yhat + 1.96 * sePred) * 100,
  };
}

export { mean };
