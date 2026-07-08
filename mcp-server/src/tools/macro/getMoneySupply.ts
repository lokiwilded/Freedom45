/**
 * Money supply (broad money / M2) by country, reported in BOTH native currency and USD.
 *
 * FRED only carries a current series for the US (its foreign M2 feeds are discontinued),
 * so other countries come from DBnomics (IMF IFS broad money, FMB_XDC). Foreign values are
 * converted to USD with FRED FX (monthly) so every country is comparable on one scale; the
 * native value is kept for display. See plans/liquidity-macro-dashboard-plan.md.
 */

import { z } from "zod";
import { syncFredSeries, syncSeriesGeneric, seriesMap } from "./_shared.js";
import { dbnomicsProvider } from "../../providers/dbnomics.js";

interface FxDef { seriesId: string; invert: boolean } // usdPerUnit = invert ? 1/rate : rate

type M2Def =
  | { source: "fred"; id: string; currency: string; unit: string; start: string; toUsdScale: number }
  | { source: "dbnomics"; provider: string; dataset: string; code: string; currency: string; unit: string; start: string; localScale: number; fx: FxDef };

// toUsdScale (US): native value * scale = absolute USD.  localScale (foreign): native * scale
// = whole local-currency units, then * usdPerUnit(FX) = USD.
const M2_SERIES: Record<string, M2Def> = {
  US: { source: "fred", id: "M2SL", currency: "USD", unit: "Billions of USD (SA)", start: "1959-01-01", toUsdScale: 1e9 },
  JP: { source: "dbnomics", provider: "IMF", dataset: "IFS", code: "M.JP.FMB_XDC", currency: "JPY", unit: "Broad money, millions JPY", start: "2000-01-01", localScale: 1e6, fx: { seriesId: "DEXJPUS", invert: true } },
  KR: { source: "dbnomics", provider: "IMF", dataset: "IFS", code: "M.KR.FMB_XDC", currency: "KRW", unit: "Broad money, millions KRW", start: "2000-01-01", localScale: 1e6, fx: { seriesId: "DEXKOUS", invert: true } },
  AU: { source: "dbnomics", provider: "IMF", dataset: "IFS", code: "M.AU.FMB_XDC", currency: "AUD", unit: "Broad money, millions AUD", start: "2000-01-01", localScale: 1e6, fx: { seriesId: "DEXUSAL", invert: false } },
};

export const GetMoneySupplyInput = z.object({
  country: z.string().default("US").describe(`ISO country code. Supported: ${Object.keys(M2_SERIES).join(", ")}`),
  from: z.string().optional().describe("Start date YYYY-MM-DD"),
  to: z.string().optional().describe("End date YYYY-MM-DD (default today)"),
});

function summarizeUsd(points: { date: string; valueUsd: number | null }[]) {
  const clean = points.filter((p) => p.valueUsd !== null) as { date: string; valueUsd: number }[];
  const first = clean[0] ?? null;
  const latest = clean[clean.length - 1] ?? null;
  return {
    latestUsdTrillions: latest ? Number((latest.valueUsd / 1e12).toFixed(3)) : null,
    firstUsdTrillions: first ? Number((first.valueUsd / 1e12).toFixed(3)) : null,
    changeUsdPct: first && latest && first.valueUsd !== 0
      ? Number((((latest.valueUsd - first.valueUsd) / first.valueUsd) * 100).toFixed(2))
      : null,
  };
}

export async function getMoneySupply(country = "US", from?: string, to?: string) {
  const key = country.toUpperCase();
  const series = M2_SERIES[key];
  if (!series) {
    return {
      country: key,
      indicator: "M2",
      error: `No money-supply series mapped for ${key}. Foreign M2 coverage is limited; try get_debt for cross-country credit.`,
      supported: Object.keys(M2_SERIES),
    };
  }

  const start = from ?? series.start;
  const end = to ?? new Date().toISOString().split("T")[0]!;

  // 1. Native broad-money series.
  const sync =
    series.source === "fred"
      ? await syncFredSeries({ country: key, currency: series.currency, indicator: "M2", seriesId: series.id, unit: series.unit, from: start, to: end })
      : await syncSeriesGeneric({
          country: key, currency: series.currency, indicator: "M2", unit: series.unit,
          source: "dbnomics", from: start, to: end,
          fetchAll: () => dbnomicsProvider.getSeries(series.provider, series.dataset, series.code),
        });

  // 2. USD conversion. US is already USD; foreign countries use monthly FRED FX.
  let fxMap: Map<string, number> | null = null;
  if (series.source === "dbnomics") {
    await syncFredSeries({
      country: series.currency, currency: series.currency, indicator: "FX_USD",
      seriesId: series.fx.seriesId, unit: `FX (${series.fx.seriesId})`, from: start, to: end, frequency: "m",
    });
    fxMap = seriesMap(series.currency, "FX_USD", start, end);
  }

  const data = sync.points
    .filter((p) => p.value !== null)
    .map((p) => {
      let valueUsd: number | null;
      if (series.source === "fred") {
        valueUsd = p.value! * series.toUsdScale;
      } else {
        const rate = fxMap!.get(p.date);
        const usdPerUnit = rate === undefined || rate === 0 ? null : series.fx.invert ? 1 / rate : rate;
        valueUsd = usdPerUnit === null ? null : p.value! * series.localScale * usdPerUnit;
      }
      return { date: p.date, value: p.value!, valueUsd: valueUsd === null ? null : Math.round(valueUsd) };
    });

  const first = data[0] ?? null;
  const latest = data[data.length - 1] ?? null;

  return {
    country: key,
    indicator: "M2",
    source: series.source,
    ...(series.source === "fred" ? { seriesId: series.id } : { code: series.code, fx: series.fx.seriesId }),
    currency: series.currency,
    unit: series.unit,
    from: start,
    to: end,
    count: data.length,
    fromCache: sync.fromCache,
    firstNative: first ? { date: first.date, value: first.value } : null,
    latestNative: latest ? { date: latest.date, value: latest.value } : null,
    ...summarizeUsd(data),
    data, // [{ date, value (native), valueUsd }]
  };
}

export const getMoneySupplyTool = {
  name: "get_money_supply",
  description:
    "Broad money (M2) by country in native currency AND USD. US from FRED (M2SL); JP/KR/AU from DBnomics (IMF IFS) converted via FRED FX. Persisted to SQLite.",
  inputSchema: {
    type: "object",
    properties: {
      country: { type: "string", description: "ISO code: US, JP, KR, AU", default: "US" },
      from: { type: "string", description: "Start date YYYY-MM-DD" },
      to: { type: "string", description: "End date YYYY-MM-DD" },
    },
  },
  handler: async (args: unknown) => {
    const { country, from, to } = GetMoneySupplyInput.parse(args);
    return getMoneySupply(country, from, to);
  },
};
