/**
 * Liquidity-elasticity tool: fits how an asset moves with a liquidity driver, on a
 * year-over-year basis, and answers "per +1% liquidity, the asset historically moved +X%".
 *
 * Drivers:  global_liquidity (Fed+ECB+BOJ, 2003+), us_m2 (1959+), us_debt (1966+)
 * Assets:   SP500, FTSE, NIKKEI, GOLD, SILVER (levels), US_MKTCAP (true market cap)
 */

import { z } from "zod";
import { getGlobalLiquidity } from "./getGlobalLiquidity.js";
import { getMoneySupply } from "./getMoneySupply.js";
import { getGovernmentDebt } from "./getGovernmentDebt.js";
import { getAssetHistory } from "./getAssetHistory.js";
import { toYoY, align, regress, predict, mean } from "../../scoring/liquidity-elasticity.js";

// usdScale converts a series value into absolute USD (null/absent = not a USD quantity).
const DRIVERS: Record<
  string,
  { label: string; usdScale: number; load: (from?: string, to?: string) => Promise<Map<string, number>> }
> = {
  global_liquidity: {
    label: "Global central-bank liquidity (Fed+ECB+BOJ, USD)",
    usdScale: 1, // total_usd is already absolute USD
    load: async (from, to) => {
      const r = await getGlobalLiquidity(from, to);
      return new Map((r.data ?? []).map((d: any) => [d.date, d.total_usd]));
    },
  },
  us_m2: {
    label: "US M2 money supply",
    usdScale: 1e9, // billions of USD
    load: async (from, to) => {
      const r = await getMoneySupply("US", from, to);
      return new Map(((r as any).data ?? []).map((d: any) => [d.date, d.value]));
    },
  },
  us_debt: {
    label: "US federal debt",
    usdScale: 1e6, // millions of USD
    load: async (from, to) => {
      const r = await getGovernmentDebt("US", from, to);
      return new Map(((r as any).data ?? []).map((d: any) => [d.date, d.value]));
    },
  },
};

const ASSET_KEYS = ["SP500", "FTSE", "NIKKEI", "GOLD", "SILVER", "US_MKTCAP"];
// Absolute-USD scale for assets that are dollar quantities (index levels are not).
const ASSET_USD_SCALE: Record<string, number> = { US_MKTCAP: 1e6 };

/** Cumulative/levels view over the common window: growth %, arc elasticity, and $-per-$. */
function levelsSummary(
  driver: Map<string, number>,
  asset: Map<string, number>,
  driverUsdScale: number,
  assetUsdScale?: number
) {
  const common = [...driver.keys()].filter((dt) => asset.has(dt)).sort();
  if (common.length < 2) return null;
  const d0 = common[0]!, d1 = common[common.length - 1]!;
  const dv0 = driver.get(d0)!, dv1 = driver.get(d1)!;
  const av0 = asset.get(d0)!, av1 = asset.get(d1)!;
  const driverGrowthPct = (dv1 / dv0 - 1) * 100;
  const assetGrowthPct = (av1 / av0 - 1) * 100;
  const round = (x: number, p = 2) => (Number.isFinite(x) ? Number(x.toFixed(p)) : null);

  let driverAddedUsd: number | null = null;
  let assetAddedUsd: number | null = null;
  let dollarsPerDollar: number | null = null;
  if (assetUsdScale !== undefined) {
    driverAddedUsd = (dv1 - dv0) * driverUsdScale;
    assetAddedUsd = (av1 - av0) * assetUsdScale;
    dollarsPerDollar = driverAddedUsd !== 0 ? assetAddedUsd / driverAddedUsd : null;
  }

  return {
    from: d0,
    to: d1,
    driverGrowthPct: round(driverGrowthPct),
    assetGrowthPct: round(assetGrowthPct),
    arcElasticity: driverGrowthPct !== 0 ? round(assetGrowthPct / driverGrowthPct) : null,
    driverAddedTrillions: driverAddedUsd !== null ? round(driverAddedUsd / 1e12) : null,
    assetAddedTrillions: assetAddedUsd !== null ? round(assetAddedUsd / 1e12) : null,
    dollarsPerDollar: dollarsPerDollar !== null ? round(dollarsPerDollar) : null,
  };
}

export const GetLiquidityElasticityInput = z.object({
  driver: z.string().default("global_liquidity").describe(`Driver: ${Object.keys(DRIVERS).join(", ")}`),
  asset: z.string().default("SP500").describe(`Asset: ${ASSET_KEYS.join(", ")}`),
  lagMonths: z
    .number()
    .optional()
    .describe("Months the driver leads the asset. Omit to auto-scan 0–18 for the best-fit lag."),
  from: z.string().optional().describe("Start date YYYY-MM-DD (limits the sample window)"),
  to: z.string().optional().describe("End date YYYY-MM-DD"),
});

export async function getLiquidityElasticity(
  driver = "global_liquidity",
  asset = "SP500",
  lagMonths?: number,
  from?: string,
  to?: string
) {
  const d = DRIVERS[driver.toLowerCase()];
  if (!d) return { error: `Unknown driver '${driver}'.`, supported: Object.keys(DRIVERS) };
  const assetKey = asset.toUpperCase();
  if (!ASSET_KEYS.includes(assetKey)) return { error: `Unknown asset '${assetKey}'.`, supported: ASSET_KEYS };

  const driverSeries = await d.load(from, to);
  const assetRes = await getAssetHistory(assetKey, from, to);
  const assetSeries = new Map(((assetRes as any).data ?? []).map((p: any) => [p.date, p.value])) as Map<string, number>;

  const driverYoY = toYoY(driverSeries);
  const assetYoY = toYoY(assetSeries);

  // Determine the lag: explicit, or auto-scan 0..18 months for the strongest |r|.
  const step = assetKey === "US_MKTCAP" ? 3 : 1; // quarterly market cap only aligns on 3-month steps
  let lag: number;
  let lagScan: { lagMonths: number; r: number; r2: number; n: number }[] = [];
  if (lagMonths !== undefined) {
    lag = lagMonths;
  } else {
    for (let L = 0; L <= 18; L += step) {
      const p = align(driverYoY, assetYoY, L);
      if (p.length >= 12) {
        const rg = regress(p);
        lagScan.push({ lagMonths: L, r: Number(rg.r.toFixed(3)), r2: Number(rg.r2.toFixed(3)), n: rg.n });
      }
    }
    lag = lagScan.length
      ? lagScan.reduce((best, cur) => (Math.abs(cur.r) > Math.abs(best.r) ? cur : best)).lagMonths
      : 0;
  }

  const pts = align(driverYoY, assetYoY, lag);

  if (pts.length < 3) {
    return {
      driver,
      asset: assetKey,
      error: "Not enough overlapping year-over-year points to fit a relationship.",
      n: pts.length,
      lagMonths: lag,
    };
  }

  const reg = regress(pts);
  const whatIf = [5, 10, 20].map((pct) => predict(reg, pct));

  const levels = levelsSummary(driverSeries, assetSeries, d.usdScale, ASSET_USD_SCALE[assetKey]);

  const round = (x: number, p = 3) => (Number.isFinite(x) ? Number(x.toFixed(p)) : null);

  return {
    driver,
    driverLabel: d.label,
    asset: assetKey,
    assetLabel: (assetRes as any).label,
    assetMetric: (assetRes as any).metric,
    // LEVELS view — the cumulative "money went up X, asset went up Y, ratio Z" relationship.
    // Descriptive and trend-dominated (not causal), but it is the headline ratio.
    levels,
    // YoY-CHANGE view — the honest test of short-run co-movement (typically weak).
    basis: "year-over-year % change",
    lagMonths: lag,
    lagSelection: lagMonths !== undefined ? "explicit" : "auto (max |r|)",
    lagScan,
    sample: {
      from: pts[0]!.date,
      to: pts[pts.length - 1]!.date,
      n: reg.n,
      driverMeanYoYPct: round(mean(pts.map((p) => p.x)) * 100, 2),
      assetMeanYoYPct: round(mean(pts.map((p) => p.y)) * 100, 2),
    },
    regression: {
      beta: round(reg.slope),
      betaStdErr: round(reg.slopeStdErr),
      intercept: round(reg.intercept),
      r: round(reg.r),
      r2: round(reg.r2),
    },
    interpretation:
      `With liquidity leading by ${lag} month${lag === 1 ? "" : "s"}: per +1% YoY in ${d.label}, ` +
      `${assetKey} historically moved ${reg.slope >= 0 ? "+" : ""}${round(reg.slope)}% YoY ` +
      `(R²=${round(reg.r2, 2)}, n=${reg.n}). ` +
      (reg.r2 < 0.1 ? "NOTE: low R² — weak/noisy relationship." : ""),
    whatIf: whatIf.map((w) => ({
      driverChangePct: w.driverChangePct,
      expectedAssetChangePct: round(w.expectedAssetChangePct, 1),
      range95Pct: [round(w.lo95Pct, 1), round(w.hi95Pct, 1)],
    })),
    scatter: pts.map((p) => ({ date: p.date, driverYoYPct: round(p.x * 100, 2), assetYoYPct: round(p.y * 100, 2) })),
  };
}

export const getLiquidityElasticityTool = {
  name: "get_liquidity_elasticity",
  description:
    "Fit how an asset moves with a liquidity driver (year-over-year). Returns the beta ('per +1% liquidity → +X% asset'), R², a what-if projection, and scatter data. Drivers: global_liquidity, us_m2, us_debt. Assets: SP500, FTSE, NIKKEI, GOLD, SILVER, US_MKTCAP.",
  inputSchema: {
    type: "object",
    properties: {
      driver: { type: "string", description: "global_liquidity | us_m2 | us_debt", default: "global_liquidity" },
      asset: { type: "string", description: "SP500 | FTSE | NIKKEI | GOLD | SILVER | US_MKTCAP", default: "SP500" },
      lagMonths: { type: "number", description: "Months the driver leads the asset. Omit to auto-scan 0–18 for best fit." },
      from: { type: "string", description: "Start date YYYY-MM-DD" },
      to: { type: "string", description: "End date YYYY-MM-DD" },
    },
  },
  handler: async (args: unknown) => {
    const { driver, asset, lagMonths, from, to } = GetLiquidityElasticityInput.parse(args);
    return getLiquidityElasticity(driver, asset, lagMonths, from, to);
  },
};
