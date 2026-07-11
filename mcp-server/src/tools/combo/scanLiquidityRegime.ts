/**
 * scan_liquidity_regime — combo tool
 *
 * Scans the current global liquidity regime by combining central-bank balance
 * sheets, US M2 money supply, an asset's price history, and liquidity elasticity.
 * Returns a descriptive regime verdict, risk-on score, and graphable YoY series.
 */

import { z } from "zod";
import { getGlobalLiquidity } from "../macro/getGlobalLiquidity.js";
import { getMoneySupply } from "../macro/getMoneySupply.js";
import { getAssetHistory } from "../macro/getAssetHistory.js";
import { getLiquidityElasticity } from "../macro/getLiquidityElasticity.js";
import { liquidityRegimeLabel, r } from "../../lib/verdicts.js";

export const ScanLiquidityRegimeInput = z.object({
  asset: z.string().default("SP500").describe("Asset key to measure against liquidity. One of: SP500, NASDAQ, DOW, FTSE, DAX, ESTOXX50, CAC40, NIKKEI, HANGSENG, SHANGHAI, KOSPI, ASX200, TSX, GOLD, SILVER, US_MKTCAP"),
  from: z.string().optional().describe("Start date YYYY-MM-DD (default 2003-01-01)"),
  to: z.string().optional().describe("End date YYYY-MM-DD (default today)"),
});

export type ScanLiquidityRegimeInput = z.infer<typeof ScanLiquidityRegimeInput>;

export interface LiquidityRegimeResult {
  asset: string;
  summary: string;
  verdict: string;
  score: number;
  liquidityYoY: number | null;
  m2YoY: number | null;
  assetYoY: number | null;
  liquidityBeta: number | null;
  liquidityR2: number | null;
  lagMonths: number | null;
  regimeStart: string;
  regimeEnd: string;
  riskOnScore: number;
  series: {
    date: string;
    liquidityYoYPct: number | null;
    m2YoYPct: number | null;
    assetYoYPct: number | null;
  }[];
  metadata: {
    generatedAt: string;
    fromCache: boolean;
    sources: string[];
  };
}

function toYoY(points: { date: string; value: number }[]): Map<string, number> {
  const sorted = [...points].filter((p) => Number.isFinite(p.value)).sort((a, b) => a.date.localeCompare(b.date));
  const out = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const [cyStr, cmStr] = cur.date.split("-");
    const cy = Number(cyStr);
    const cm = Number(cmStr);
    const prev = sorted.find((p) => {
      const [pyStr, pmStr] = p.date.split("-");
      return Number(pyStr) === cy - 1 && Number(pmStr) === cm;
    });
    if (prev && prev.value !== 0) {
      out.set(cur.date, ((cur.value - prev.value) / prev.value) * 100);
    }
  }
  return out;
}

export async function scanLiquidityRegime(
  asset: string = "SP500",
  from?: string,
  to?: string
): Promise<LiquidityRegimeResult> {
  const assetKey = asset.toUpperCase();
  const start = from ?? "2003-01-01";
  const end = to ?? new Date().toISOString().split("T")[0]!;

  const [liquidity, m2, assetHistory, elasticity] = await Promise.allSettled([
    getGlobalLiquidity(start, end),
    getMoneySupply("US", start, end),
    getAssetHistory(assetKey, start, end),
    getLiquidityElasticity("global_liquidity", assetKey, undefined, start, end),
  ]);

  const liqData = liquidity.status === "fulfilled" ? liquidity.value : null;
  const m2Data = m2.status === "fulfilled" ? m2.value : null;
  const assetData = assetHistory.status === "fulfilled" ? assetHistory.value : null;
  const el = elasticity.status === "fulfilled" && !("error" in elasticity.value) ? elasticity.value : null;

  const liquiditySeries = liqData?.data ?? [];
  const m2Series = m2Data && "data" in m2Data ? (m2Data as any).data : [];
  const assetSeries = assetData && "data" in (assetData as any) ? (assetData as any).data : [];

  const liquidityYoY = toYoY(liquiditySeries.map((d: any) => ({ date: d.date, value: d.total_trillions })));
  const m2YoY = toYoY(m2Series.map((d: any) => ({ date: d.date, value: d.value })));
  const assetYoY = toYoY(assetSeries.map((d: any) => ({ date: d.date, value: d.value })));

  const latestDate = liquiditySeries.length
    ? liquiditySeries[liquiditySeries.length - 1]!.date
    : end;

  const currentLiquidityYoY = liquidityYoY.get(latestDate) ?? null;
  const currentM2YoY = m2YoY.get(latestDate) ?? null;
  const currentAssetYoY = assetYoY.get(latestDate) ?? null;

  const beta = el ? (el as any).regression?.beta ?? null : null;
  const r2 = el ? (el as any).regression?.r2 ?? null : null;
  const lagMonths = el ? (el as any).lagMonths ?? null : null;

  // Risk-on score: liquidity momentum + asset momentum + beta sign.
  let score = 50;
  if (currentLiquidityYoY != null) score += Math.min(25, Math.max(-25, currentLiquidityYoY / 2));
  if (currentM2YoY != null) score += Math.min(10, Math.max(-10, currentM2YoY / 4));
  if (currentAssetYoY != null) score += Math.min(15, Math.max(-15, currentAssetYoY / 4));
  if (beta != null && r2 != null && r2 >= 0.1) score += Math.min(10, Math.max(-10, beta * 5));
  score = Math.max(0, Math.min(100, score));

  const noData = !liqData && !m2Data;
  const verdict = liquidityRegimeLabel(currentLiquidityYoY ?? 0, score, noData);

  // Build merged YoY series.
  const allDates = new Set<string>([...liquidityYoY.keys(), ...m2YoY.keys(), ...assetYoY.keys()]);
  const series = [...allDates].sort().map((date) => ({
    date,
    liquidityYoYPct: r(liquidityYoY.get(date), 2),
    m2YoYPct: r(m2YoY.get(date), 2),
    assetYoYPct: r(assetYoY.get(date), 2),
  }));

  const summary = noData
    ? `Unable to scan liquidity regime: global liquidity and M2 data unavailable.`
    : `${assetKey} liquidity regime is ${verdict.toLowerCase()}: global liquidity +${r(currentLiquidityYoY, 1)}% YoY, US M2 +${r(currentM2YoY, 1)}% YoY, asset +${r(currentAssetYoY, 1)}% YoY, liquidity beta ${r(beta, 2)} (R² ${r(r2, 2)}).`;

  return {
    asset: assetKey,
    summary,
    verdict,
    score: r(score, 1) ?? 0,
    liquidityYoY: r(currentLiquidityYoY, 2),
    m2YoY: r(currentM2YoY, 2),
    assetYoY: r(currentAssetYoY, 2),
    liquidityBeta: r(beta, 3),
    liquidityR2: r(r2, 3),
    lagMonths,
    regimeStart: liqData?.from || start,
    regimeEnd: liqData?.to || end,
    riskOnScore: r(score, 1) ?? 0,
    series,
    metadata: {
      generatedAt: new Date().toISOString(),
      fromCache:
        (liquidity.status === "fulfilled" ? liquidity.value.fromCache : true) &&
        (m2.status === "fulfilled" ? (m2.value as any).fromCache : true) &&
        (assetHistory.status === "fulfilled" ? (assetHistory.value as any).fromCache : true) &&
        (elasticity.status === "fulfilled" ? true : true),
      sources: ["fred", "yahoo"],
    },
  };
}

export const scanLiquidityRegimeTool = {
  name: "scan_liquidity_regime",
  description:
    "Scan the current global liquidity regime and its impact on an asset. Combines global central-bank liquidity, US M2, asset history, and liquidity elasticity. Returns a regime verdict (Expansion Risk-On / Expansion Caution / Neutral / Contraction Risk-Off / Contraction Defensive / No Data), risk-on score, and graphable YoY series.",
  inputSchema: {
    type: "object",
    properties: {
      asset: { type: "string", description: "Asset key (SP500, NASDAQ, GOLD, etc.)", default: "SP500" },
      from: { type: "string", description: "Start date YYYY-MM-DD (default 2003-01-01)" },
      to: { type: "string", description: "End date YYYY-MM-DD (default today)" },
    },
  },
  handler: async (args: unknown) => {
    const { asset, from, to } = ScanLiquidityRegimeInput.parse(args);
    return await scanLiquidityRegime(asset, from, to);
  },
};
