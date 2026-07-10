/**
 * Analyze a stock's valuation vs sector peers.
 *
 * Scores P/E, P/B, P/S, EV/EBITDA, and dividend yield against
 * the peer median. Returns a 0-100 score with verdict and
 * component breakdown.
 */

import { z } from "zod";
import { fetchFundamentalMetrics } from "./fetchFundamentalMetrics.js";
import type { FundamentalMetricsResult } from "./fetchFundamentalMetrics.js";
import { fetchPeers } from "./fetchPeers.js";
import { linearScale, median, redistributeWeights, weightedScore } from "../../lib/scoring.js";

export const AnalyzeValuationInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type AnalyzeValuationInput = z.infer<typeof AnalyzeValuationInput>;

export interface ValuationComponentScores {
  pe: number;
  pb: number;
  ps: number;
  evEbitda: number;
  dividend: number;
}

export interface ValuationComparison {
  ticker: {
    pe: number | null;
    pb: number | null;
    ps: number | null;
    evEbitda: number | null;
    dividendYield: number | null;
  };
  peerMedian: {
    pe: number | null;
    pb: number | null;
    ps: number | null;
    evEbitda: number | null;
    dividendYield: number | null;
  };
  peers: string[];
}

export interface ValuationResult {
  ticker: string;
  score: number;
  verdict: "Undervalued" | "Fairly valued" | "Overvalued" | "Insufficient data";
  components: ValuationComponentScores;
  weights: Record<string, number>;
  comparison: ValuationComparison;
  note?: string;
  fromCache: boolean;
  generatedAt: string;
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  pe: 30,
  pb: 20,
  ps: 20,
  evEbitda: 15,
  dividend: 15,
};

function valuationVerdict(score: number): ValuationResult["verdict"] {
  if (score >= 65) return "Undervalued";
  if (score >= 40) return "Fairly valued";
  return "Overvalued";
}

export async function analyzeValuation(ticker: string): Promise<ValuationResult> {
  const normalizedTicker = ticker.toUpperCase();

  const [tickerMetrics, peersResult] = await Promise.all([
    fetchFundamentalMetrics(normalizedTicker),
    fetchPeers(normalizedTicker),
  ]);

  const peers = (peersResult.peers || []).slice(0, 5);

  let fromCache = tickerMetrics.fromCache && peersResult.fromCache;

  const peerMetrics: FundamentalMetricsResult[] = [];
  if (peers.length >= 3) {
    const results = await Promise.all(
      peers.map((p) => fetchFundamentalMetrics(p).catch(() => null))
    );
    for (const r of results) {
      if (r) {
        peerMetrics.push(r);
        if (r.fromCache) fromCache = fromCache && true;
      }
    }
  }

  const peerMedianPE = median(peerMetrics.map((m) => m.peRatioTTM));
  const peerMedianPB = median(peerMetrics.map((m) => m.pbRatioTTM));
  const peerMedianPS = median(peerMetrics.map((m) => m.psRatioTTM));
  const peerMedianEV = median(peerMetrics.map((m) => m.evEbitdaTTM));
  const peerMedianDiv = median(peerMetrics.map((m) => m.dividendYieldTTM));

  const components: Partial<ValuationComponentScores> = {};
  const available: string[] = [];

  if (
    tickerMetrics.peRatioTTM !== null &&
    tickerMetrics.peRatioTTM > 0 &&
    peerMedianPE !== null &&
    peerMedianPE > 0
  ) {
    components.pe = linearScale(tickerMetrics.peRatioTTM, peerMedianPE * 0.5, peerMedianPE * 1.5);
    available.push("pe");
  }

  if (
    tickerMetrics.pbRatioTTM !== null &&
    tickerMetrics.pbRatioTTM > 0 &&
    peerMedianPB !== null &&
    peerMedianPB > 0
  ) {
    components.pb = linearScale(tickerMetrics.pbRatioTTM, peerMedianPB * 0.5, peerMedianPB * 1.5);
    available.push("pb");
  }

  if (
    tickerMetrics.psRatioTTM !== null &&
    tickerMetrics.psRatioTTM > 0 &&
    peerMedianPS !== null &&
    peerMedianPS > 0
  ) {
    components.ps = linearScale(tickerMetrics.psRatioTTM, peerMedianPS * 0.5, peerMedianPS * 1.5);
    available.push("ps");
  }

  if (
    tickerMetrics.evEbitdaTTM !== null &&
    tickerMetrics.evEbitdaTTM > 0 &&
    peerMedianEV !== null &&
    peerMedianEV > 0
  ) {
    components.evEbitda = linearScale(
      tickerMetrics.evEbitdaTTM,
      peerMedianEV * 0.5,
      peerMedianEV * 1.5
    );
    available.push("evEbitda");
  }

  if (
    tickerMetrics.dividendYieldTTM !== null &&
    tickerMetrics.dividendYieldTTM > 0 &&
    peerMedianDiv !== null &&
    peerMedianDiv > 0
  ) {
    components.dividend = linearScale(
      tickerMetrics.dividendYieldTTM,
      peerMedianDiv * 1.5,
      peerMedianDiv * 0.5
    );
    available.push("dividend");
  }

  const adjustedWeights = redistributeWeights(DEFAULT_WEIGHTS, available);
  const score = weightedScore(components as Record<string, number>, adjustedWeights);

  const fullComponents: ValuationComponentScores = {
    pe: components.pe ?? 0,
    pb: components.pb ?? 0,
    ps: components.ps ?? 0,
    evEbitda: components.evEbitda ?? 0,
    dividend: components.dividend ?? 0,
  };

  const notes: string[] = [];
  if (peers.length < 3) {
    notes.push(`Only ${peers.length} peers found — confidence is low.`);
  }
  if (available.length < 3) {
    notes.push(`Only ${available.length} valuation metrics available — limited scoring.`);
  }

  const verdict =
    available.length === 0
      ? ("Insufficient data" as const)
      : valuationVerdict(score);

  return {
    ticker: normalizedTicker,
    score: Math.round(score * 10) / 10,
    verdict,
    components: fullComponents,
    weights: adjustedWeights,
    comparison: {
      ticker: {
        pe: tickerMetrics.peRatioTTM,
        pb: tickerMetrics.pbRatioTTM,
        ps: tickerMetrics.psRatioTTM,
        evEbitda: tickerMetrics.evEbitdaTTM,
        dividendYield: tickerMetrics.dividendYieldTTM,
      },
      peerMedian: {
        pe: peerMedianPE,
        pb: peerMedianPB,
        ps: peerMedianPS,
        evEbitda: peerMedianEV,
        dividendYield: peerMedianDiv,
      },
      peers,
    },
    note: notes.length > 0 ? notes.join(" ") : undefined,
    fromCache,
    generatedAt: new Date().toISOString(),
  };
}

export const analyzeValuationTool = {
  name: "analyze_valuation",
  description:
    "Analyze a stock's valuation vs sector peers. Scores P/E, P/B, P/S, EV/EBITDA, and dividend yield. Returns 0-100 score with verdict (Undervalued/Fairly valued/Overvalued).",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = AnalyzeValuationInput.parse(args);
    return await analyzeValuation(ticker);
  },
};