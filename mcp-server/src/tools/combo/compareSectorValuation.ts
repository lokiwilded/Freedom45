/**
 * compare_sector_valuation — combo tool
 *
 * Compares a ticker's valuation vs its sector peers. Reuses analyze_valuation
 * and fundamental metrics to produce percentile ranks, a PEG-style score,
 * rank-in-sector, and value-trap flags. Returns a graphable peer scatter table.
 */

import { z } from "zod";
import { fetchPeers, fetchFundamentalMetrics } from "../../lib/combo-fetchers.js";
import { valuationLabel, r } from "../../lib/verdicts.js";

export const CompareSectorValuationInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type CompareSectorValuationInput = z.infer<typeof CompareSectorValuationInput>;

export interface SectorValuationResult {
  ticker: string;
  summary: string;
  verdict: string;
  score: number;
  peerCount: number;
  rankInSector: number | null;
  percentiles: {
    pe: number | null;
    pb: number | null;
    ps: number | null;
    evEbitda: number | null;
    peg: number | null;
  };
  peg: {
    value: number | null;
    growthProxy: number | null;
    description: string;
  };
  valueTrapFlags: string[];
  table: {
    ticker: string;
    pe: number | null;
    pb: number | null;
    ps: number | null;
    evEbitda: number | null;
    peg: number | null;
    score: number | null;
  }[];
  metadata: {
    generatedAt: string;
    fromCache: boolean;
    sources: string[];
  };
}

function percentileRank(value: number, values: number[]): number {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  // Percentile: % of values below the target.
  const below = sorted.filter((v) => v < value).length;
  return Math.round((below / sorted.length) * 100);
}

export async function compareSectorValuation(ticker: string): Promise<SectorValuationResult> {
  const normalizedTicker = ticker.toUpperCase();

  const [_, peersRes] = await Promise.allSettled([
    Promise.resolve(null),
    fetchPeers(normalizedTicker),
  ]);

  const peersRaw = peersRes.status === "fulfilled" && peersRes.value ? peersRes.value.peers || [] : [];
  const peers = peersRaw.slice(0, 5);

  // Fetch fundamentals for ticker + peers via the registry.
  const allTickers = [normalizedTicker, ...peers];
  const metricsResults = await Promise.all(
    allTickers.map((t) => fetchFundamentalMetrics(t).then((r) => r?.metrics ?? null).catch(() => null))
  );
  const rawMetrics = metricsResults.filter((m): m is NonNullable<typeof m> => m != null);
  // Extract the metric sub-object from Finnhub's { metric: {...} } shape
  const extractMetrics = (raw: any) => {
    const m = raw?.metric ?? raw;
    return {
      ticker: m?.symbol ?? raw?.symbol ?? "",
      peRatioTTM: m?.peRatioTTM ?? null,
      pbRatioTTM: m?.pbRatioTTM ?? null,
      psRatioTTM: m?.psRatioTTM ?? null,
      evEbitdaTTM: m?.evEbitdaTTM ?? null,
      revenueGrowthTTM: m?.revenueGrowthTTM ?? m?.revenueGrowth5Y ?? null,
      profitMarginTTM: m?.profitMarginTTM ?? m?.netProfitMargin ?? null,
      debtEquityTTM: m?.debtEquityTTM ?? m?.debtEquity ?? null,
    };
  };
  const metrics = rawMetrics.map(extractMetrics);
  const tickerMetrics = metrics.find((m) => m.ticker === normalizedTicker) || metrics[0];
  const peerMetrics = metrics.filter((m) => m.ticker !== normalizedTicker);

  const valuesFor = (key: "peRatioTTM" | "pbRatioTTM" | "psRatioTTM" | "evEbitdaTTM") =>
    peerMetrics.map((m) => m[key]).filter((v): v is number => v != null && v > 0);

  const peValues = valuesFor("peRatioTTM");
  const pbValues = valuesFor("pbRatioTTM");
  const psValues = valuesFor("psRatioTTM");
  const evValues = valuesFor("evEbitdaTTM");

  const pePct = tickerMetrics?.peRatioTTM ? percentileRank(tickerMetrics.peRatioTTM, peValues) : null;
  const pbPct = tickerMetrics?.pbRatioTTM ? percentileRank(tickerMetrics.pbRatioTTM, pbValues) : null;
  const psPct = tickerMetrics?.psRatioTTM ? percentileRank(tickerMetrics.psRatioTTM, psValues) : null;
  const evPct = tickerMetrics?.evEbitdaTTM ? percentileRank(tickerMetrics.evEbitdaTTM, evValues) : null;

  // Growth proxy = revenue growth TTM; rough PEG = PE / (growth*100).
  const growthProxy = tickerMetrics?.revenueGrowthTTM ?? null;
  let pegValue: number | null = null;
  if (tickerMetrics?.peRatioTTM != null && tickerMetrics.peRatioTTM > 0 && growthProxy != null && growthProxy > 0) {
    pegValue = tickerMetrics.peRatioTTM / (growthProxy * 100);
  }

  // PEG percentile vs peers (lower is better, so we invert ranking).
  const peerPegs = peerMetrics
    .map((m) => (m.peRatioTTM != null && m.peRatioTTM > 0 && m.revenueGrowthTTM != null && m.revenueGrowthTTM > 0 ? m.peRatioTTM / (m.revenueGrowthTTM * 100) : null))
    .filter((v): v is number => v != null);
  const pegPct = pegValue != null ? 100 - percentileRank(pegValue, peerPegs) : null;

  // Composite score: average percentile of cheapness, with PEG weighted double.
  const components: number[] = [];
  if (pePct != null) components.push(pePct);
  if (pbPct != null) components.push(pbPct);
  if (psPct != null) components.push(psPct);
  if (evPct != null) components.push(evPct);
  if (pegPct != null) {
    components.push(pegPct);
    components.push(pegPct);
  }
  const score = components.length ? components.reduce((a, b) => a + b, 0) / components.length : 0;

  // Rank by score among peers.
  const peerTable = peerMetrics.map((m) => {
    const g = m.revenueGrowthTTM;
    const p = m.peRatioTTM != null && m.peRatioTTM > 0 && g != null && g > 0 ? m.peRatioTTM / (g * 100) : null;
    return {
      ticker: m.ticker,
      pe: r(m.peRatioTTM, 2),
      pb: r(m.pbRatioTTM, 2),
      ps: r(m.psRatioTTM, 2),
      evEbitda: r(m.evEbitdaTTM, 2),
      peg: r(p, 2),
      score: null,
    };
  });
  const selfRow = {
    ticker: normalizedTicker,
    pe: r(tickerMetrics?.peRatioTTM, 2),
    pb: r(tickerMetrics?.pbRatioTTM, 2),
    ps: r(tickerMetrics?.psRatioTTM, 2),
    evEbitda: r(tickerMetrics?.evEbitdaTTM, 2),
    peg: r(pegValue, 2),
    score: r(score, 1),
  };
  const fullTable = [...peerTable, selfRow].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const rankInSector = fullTable.findIndex((row) => row.ticker === normalizedTicker) + 1;

  // Value-trap flags.
  const flags: string[] = [];
  if (tickerMetrics?.peRatioTTM != null && tickerMetrics.peRatioTTM < 10 && growthProxy != null && growthProxy < 0.05) {
    flags.push("Low P/E but weak revenue growth — possible value trap.");
  }
  if (tickerMetrics?.profitMarginTTM != null && tickerMetrics.profitMarginTTM < 0.05) {
    flags.push("Thin profit margin; cheap valuation may reflect low quality.");
  }
  if (tickerMetrics?.debtEquityTTM != null && tickerMetrics.debtEquityTTM > 1.5) {
    flags.push("High debt/equity — leverage risk not captured in multiples.");
  }
  if (peers.length < 3) {
    flags.push("Few comparable peers — sector comparison has low confidence.");
  }

  const noData = !tickerMetrics;
  const verdict = noData ? "Insufficient Data" : valuationLabel(score);

  const summary = noData
    ? `${normalizedTicker}: insufficient valuation data to compare with sector peers.`
    : `${normalizedTicker} is ${verdict.toLowerCase()} vs peers: composite score ${r(score, 1)}, ranked ${rankInSector} of ${fullTable.length} (PE ${r(pePct, 0)}th percentile, PEG ${r(pegPct, 0)}th percentile).`;

  return {
    ticker: normalizedTicker,
    summary,
    verdict,
    score: r(score, 1) ?? 0,
    peerCount: peers.length + 1,
    rankInSector: rankInSector || null,
    percentiles: {
      pe: r(pePct, 0),
      pb: r(pbPct, 0),
      ps: r(psPct, 0),
      evEbitda: r(evPct, 0),
      peg: r(pegPct, 0),
    },
    peg: {
      value: r(pegValue, 2),
      growthProxy: r(growthProxy, 3),
      description: "PE ratio divided by revenue growth (proxy PEG; lower is more growth-cheap).",
    },
    valueTrapFlags: flags,
    table: fullTable,
    metadata: {
      generatedAt: new Date().toISOString(),
      fromCache: false,
      sources: [
        peersRes.status === "fulfilled" && peersRes.value ? peersRes.value.source : "",
      ].filter(Boolean),
    },
  };
}

export const compareSectorValuationTool = {
  name: "compare_sector_valuation",
  description:
    "Compare a ticker's valuation vs sector peers. Returns percentile ranks for P/E, P/B, P/S, EV/EBITDA and PEG, a composite 0-100 score with verdict (Deeply Undervalued / Undervalued / Fairly Valued / Overvalued / Expensive / Insufficient Data), rank-in-sector, value-trap flags, and a graphable peer table.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = CompareSectorValuationInput.parse(args);
    return await compareSectorValuation(ticker);
  },
};
