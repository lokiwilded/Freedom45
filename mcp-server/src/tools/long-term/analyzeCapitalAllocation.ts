import { z } from "zod";
import { secEdgarProvider } from "../../providers/sec-edgar.js";
import { labelFromBands, r } from "../../lib/verdicts.js";

export const AnalyzeCapitalAllocationInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  years: z.number().min(3).max(20).default(10).describe("Years to analyze (default 10)"),
});

export type AnalyzeCapitalAllocationInput = z.infer<typeof AnalyzeCapitalAllocationInput>;

export interface CapitalAllocationResult {
  ticker: string;
  summary: string;
  verdict: string;
  score: number;
  yearsAnalyzed: number;
  metrics: {
    dividendPayoutRatio: number | null;
    buybackIntensity: number | null;
    reinvestmentRate: number | null;
    rdToRevenue: number | null;
    capexToRevenue: number | null;
    assetGrowth: number | null;
    equityGrowth: number | null;
    dividendGrowthCagr: number | null;
    debtReduction: number | null;
  };
  series: { fiscalYear: number; dividends: number | null; rd: number | null; capex: number | null; netIncome: number | null; sharesOutstanding: number | null; debt: number | null }[];
  metadata: { generatedAt: string; sources: string[]; errors?: Record<string, string | undefined> };
}

export async function analyzeCapitalAllocation(ticker: string, years = 10): Promise<CapitalAllocationResult> {
  const normalizedTicker = ticker.toUpperCase();
  const facts = await secEdgarProvider.getCompanyFacts(normalizedTicker);

  if (!facts) {
    return {
      ticker: normalizedTicker,
      summary: `${normalizedTicker}: no SEC EDGAR financial data found.`,
      verdict: "No Data",
      score: 0,
      yearsAnalyzed: 0,
      metrics: {
        dividendPayoutRatio: null, buybackIntensity: null, reinvestmentRate: null, rdToRevenue: null,
        capexToRevenue: null, assetGrowth: null, equityGrowth: null, dividendGrowthCagr: null, debtReduction: null,
      },
      series: [],
      metadata: { generatedAt: new Date().toISOString(), sources: [], errors: { edgar: "No company facts found" } },
    };
  }

  const getAnnual = (concept: string, fallback?: string[]) => {
    let series = facts.facts[concept]?.annual ?? [];
    if (series.length === 0 && fallback) {
      for (const f of fallback) {
        series = facts.facts[f]?.annual ?? [];
        if (series.length > 0) break;
      }
    }
    return series;
  };

  const sortByFy = (arr: any[]) => [...arr].sort((a, b) => a.fy - b.fy);
  const fyMap = (arr: any[]) => new Map(arr.filter(d => d.fy).map(d => [d.fy, d.val]));

  const dividendsRaw = getAnnual("PaymentsOfDividends", ["PaymentsOfDividendsCommonStock"]);
  const rdRaw = getAnnual("ResearchAndDevelopmentExpense");
  const capexRaw = getAnnual("PaymentsToAcquirePropertyPlantAndEquipment", ["PaymentsToAcquireProductiveAssets"]);
  const niRaw = getAnnual("NetIncomeLoss");
  const revRaw = getAnnual("Revenues", ["RevenueFromContractWithCustomerExcludingAssessedTax"]);
  const debtRaw = getAnnual("LongTermDebt", ["LongTermDebtNoncurrent"]);
  const assetsRaw = getAnnual("Assets");
  const equityRaw = getAnnual("StockholdersEquity");
  const sharesRaw = getAnnual("CommonStockSharesOutstanding");
  const buybackRaw = getAnnual("PaymentsForRepurchaseOfEquity", ["PaymentsToAcquireCommonStock"]);

  const divByFy = fyMap(sortByFy(dividendsRaw));
  const rdByFy = fyMap(sortByFy(rdRaw));
  const capexByFy = fyMap(sortByFy(capexRaw));
  const niByFy = fyMap(sortByFy(niRaw));
  const revByFy = fyMap(sortByFy(revRaw));
  const debtByFy = fyMap(sortByFy(debtRaw));
  const assetsByFy = fyMap(sortByFy(assetsRaw));
  const equityByFy = fyMap(sortByFy(equityRaw));
  const sharesByFy = fyMap(sortByFy(sharesRaw));
  const _buybackByFy = fyMap(sortByFy(buybackRaw));
  void _buybackByFy;

  const allFys = new Set<number>([...divByFy.keys(), ...niByFy.keys(), ...assetsByFy.keys()]);
  const recentFys = [...allFys].sort((a, b) => a - b).slice(-years);

  const series = recentFys.map(fy => ({
    fiscalYear: fy,
    dividends: divByFy.get(fy) ?? null,
    rd: rdByFy.get(fy) ?? null,
    capex: capexByFy.get(fy) ?? null,
    netIncome: niByFy.get(fy) ?? null,
    sharesOutstanding: sharesByFy.get(fy) ?? null,
    debt: debtByFy.get(fy) ?? null,
  }));

  // Metrics
  const latestFy = recentFys[recentFys.length - 1] ?? 0;
  const firstFy = recentFys[0] ?? 0;
  const ni = niByFy.get(latestFy);
  const rev = revByFy.get(latestFy);
  const div = divByFy.get(latestFy);
  const rd = rdByFy.get(latestFy);
  const capex = capexByFy.get(latestFy);

  const dividendPayoutRatio = ni != null && ni > 0 && div != null ? div / ni : null;
  const rdToRevenue = rd != null && rev && rev > 0 ? rd / rev : null;
  const capexToRevenue = capex != null && rev && rev > 0 ? capex / rev : null;

  const reinvestmentRate = capex != null && ni != null && ni > 0 ? capex / ni : null;

  const assetsFirst = assetsByFy.get(firstFy);
  const assetsLast = assetsByFy.get(latestFy);
  const assetGrowth = assetsFirst != null && assetsLast != null && assetsFirst > 0 ? ((assetsLast / assetsFirst) - 1) * 100 : null;

  const equityFirst = equityByFy.get(firstFy);
  const equityLast = equityByFy.get(latestFy);
  const equityGrowth = equityFirst != null && equityLast != null && equityFirst > 0 ? ((equityLast / equityFirst) - 1) * 100 : null;

  const debtFirst = debtByFy.get(firstFy);
  const debtLast = debtByFy.get(latestFy);
  const debtReduction = debtFirst != null && debtLast != null ? debtFirst - debtLast : null;

  const divValues = [...divByFy.values()].filter((v): v is number => v != null && v > 0).sort((a, b) => a - b);
  const dividendGrowthCagr = divValues.length >= 2 && divValues[0]! > 0 && divValues[divValues.length - 1]! > 0
    ? (Math.pow(divValues[divValues.length - 1]! / divValues[0]!, 1 / (divValues.length - 1)) - 1) * 100
    : null;

  const sharesFirst = sharesByFy.get(firstFy);
  const sharesLast = sharesByFy.get(latestFy);
  const buybackIntensity = sharesFirst != null && sharesLast != null && sharesFirst > 0
    ? ((sharesFirst - sharesLast) / sharesFirst) * 100
    : null;

  // Score (0-100)
  let score = 50;
  if (dividendPayoutRatio != null) {
    if (dividendPayoutRatio > 0 && dividendPayoutRatio < 0.6) score += 8;
    if (dividendPayoutRatio > 0.9) score -= 5;
  }
  if (buybackIntensity != null && buybackIntensity > 0) score += Math.min(12, buybackIntensity * 0.6);
  if (reinvestmentRate != null && reinvestmentRate > 0 && reinvestmentRate < 1) score += 8;
  if (rdToRevenue != null && rdToRevenue > 0.05) score += 5;
  if (dividendGrowthCagr != null && dividendGrowthCagr > 5) score += 5;
  if (debtReduction != null && debtReduction > 0) score += 5;
  if (equityGrowth != null && equityGrowth > 0) score += 5;
  if (assetGrowth != null && assetGrowth > 5) score += 4;
  if (buybackIntensity != null && buybackIntensity < 0 && dividendPayoutRatio === 0) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const verdict = labelFromBands(score, [
    { min: 0, max: 20, label: "Value Destructive" },
    { min: 20, max: 40, label: "Inefficient" },
    { min: 40, max: 60, label: "Adequate" },
    { min: 60, max: 80, label: "Disciplined" },
    { min: 80, max: 101, label: "Exceptional" },
  ]);

  const summary = `${normalizedTicker}: ${verdict.toLowerCase()} capital allocation (score ${r(score, 1)}). Payout ratio ${r(dividendPayoutRatio != null ? dividendPayoutRatio * 100 : null, 1)}%, buyback intensity ${r(buybackIntensity, 1)}%, R&D/revenue ${r(rdToRevenue != null ? rdToRevenue * 100 : null, 1)}%, capex/revenue ${r(capexToRevenue != null ? capexToRevenue * 100 : null, 1)}%. Asset growth ${r(assetGrowth, 1)}%, equity growth ${r(equityGrowth, 1)}%, debt change ${r(debtReduction != null ? debtReduction / 1e9 : null, 1)}B.`;

  return {
    ticker: normalizedTicker,
    summary,
    verdict,
    score: r(score, 1) ?? 0,
    yearsAnalyzed: recentFys.length,
    metrics: {
      dividendPayoutRatio: r(dividendPayoutRatio, 3),
      buybackIntensity: r(buybackIntensity, 2),
      reinvestmentRate: r(reinvestmentRate, 3),
      rdToRevenue: r(rdToRevenue, 3),
      capexToRevenue: r(capexToRevenue, 3),
      assetGrowth: r(assetGrowth, 2),
      equityGrowth: r(equityGrowth, 2),
      dividendGrowthCagr: r(dividendGrowthCagr, 2),
      debtReduction: r(debtReduction, 0),
    },
    series,
    metadata: { generatedAt: new Date().toISOString(), sources: ["sec-edgar"] },
  };
}

export const analyzeCapitalAllocationTool = {
  name: "analyze_capital_allocation",
  description:
    "Analyze how a company allocates capital over 10+ years: dividends, buybacks, R&D, capex, debt reduction. Returns a verdict (Exceptional/Disciplined/Adequate/Inefficient/Value Destructive) and 0-100 score with annual series.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      years: { type: "number", description: "Years to analyze (default 10)" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, years } = AnalyzeCapitalAllocationInput.parse(args);
    return await analyzeCapitalAllocation(ticker, years);
  },
};