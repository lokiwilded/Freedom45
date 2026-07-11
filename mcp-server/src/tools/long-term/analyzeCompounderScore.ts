import { z } from "zod";
import { secEdgarProvider } from "../../providers/sec-edgar.js";
import { yahooProvider } from "../../providers/yahoo.js";
import { labelFromBands, r } from "../../lib/verdicts.js";

export const AnalyzeCompounderScoreInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  years: z.number().min(3).max(20).default(10).describe("Years to analyze (default 10)"),
});

export type AnalyzeCompounderScoreInput = z.infer<typeof AnalyzeCompounderScoreInput>;

export interface CompounderScoreResult {
  ticker: string;
  summary: string;
  verdict: string;
  score: number;
  yearsAnalyzed: number;
  metrics: {
    revenueCagr: number | null;
    epsCagr: number | null;
    bookValueCagr: number | null;
    roeAvg: number | null;
    roicAvg: number | null;
    marginStability: number | null;
    earningsConsistency: number | null;
    growthReinvestmentBalance: number | null;
    shareholderReturnYears: number | null;
    priceCagr: number | null;
  };
  series: { fiscalYear: number; revenue: number | null; eps: number | null; bookValue: number | null; roe: number | null; roic: number | null }[];
  metadata: { generatedAt: string; sources: string[]; errors?: Record<string, string | undefined> };
}

export async function analyzeCompounderScore(ticker: string, years = 10): Promise<CompounderScoreResult> {
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
        revenueCagr: null, epsCagr: null, bookValueCagr: null, roeAvg: null, roicAvg: null,
        marginStability: null, earningsConsistency: null, growthReinvestmentBalance: null,
        shareholderReturnYears: null, priceCagr: null,
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

  const revRaw = getAnnual("Revenues", ["RevenueFromContractWithCustomerExcludingAssessedTax"]);
  const niRaw = getAnnual("NetIncomeLoss");
  const equityRaw = getAnnual("StockholdersEquity");
  const epsRaw = getAnnual("EarningsPerShareBasic", ["EarningsPerShareBasicAndDiluted"]);
  const debtRaw = getAnnual("LongTermDebt", ["LongTermDebtNoncurrent"]);
  const assetsRaw = getAnnual("Assets");
  const divRaw = getAnnual("PaymentsOfDividends", ["PaymentsOfDividendsCommonStock"]);
  const buybackRaw = getAnnual("PaymentsForRepurchaseOfEquity", ["PaymentsToAcquireCommonStock"]);
  const capexRaw = getAnnual("PaymentsToAcquirePropertyPlantAndEquipment", ["PaymentsToAcquireProductiveAssets"]);
  const operatingIncomeRaw = getAnnual("OperatingIncomeLoss");

  const revByFy = fyMap(sortByFy(revRaw));
  const niByFy = fyMap(sortByFy(niRaw));
  const equityByFy = fyMap(sortByFy(equityRaw));
  const epsByFy = fyMap(sortByFy(epsRaw));
  const debtByFy = fyMap(sortByFy(debtRaw));
  const _assetsByFy = fyMap(sortByFy(assetsRaw));
  void _assetsByFy;
  const divByFy = fyMap(sortByFy(divRaw));
  const buybackByFy = fyMap(sortByFy(buybackRaw));
  const capexByFy = fyMap(sortByFy(capexRaw));
  const oiByFy = fyMap(sortByFy(operatingIncomeRaw));

  const allFys = new Set<number>([...revByFy.keys(), ...niByFy.keys(), ...equityByFy.keys()]);
  const recentFys = [...allFys].sort((a, b) => a - b).slice(-years);

  const cagr = (arr: number[]): number | null => {
    if (arr.length < 2 || arr[0]! <= 0 || arr[arr.length - 1]! <= 0) return null;
    const n = arr.length - 1;
    return (Math.pow(arr[arr.length - 1]! / arr[0]!, 1 / n) - 1) * 100;
  };

  const revValues = recentFys.map(fy => revByFy.get(fy) ?? null).filter((v): v is number => v != null);
  const epsValues = recentFys.map(fy => epsByFy.get(fy) ?? null).filter((v): v is number => v != null);
  const bvValues = recentFys.map(fy => equityByFy.get(fy) ?? null).filter((v): v is number => v != null);

  const revenueCagr = cagr(revValues);
  const epsCagr = cagr(epsValues);
  const bookValueCagr = cagr(bvValues);

  const series = recentFys.map(fy => {
    const ni = niByFy.get(fy) ?? null;
    const equity = equityByFy.get(fy) ?? null;
    const debt = debtByFy.get(fy) ?? null;
    const oi = oiByFy.get(fy) ?? null;

    const roe = ni != null && equity && equity > 0 ? ni / equity : null;
    const investedCapital = (equity ?? 0) + (debt ?? 0);
    const roic = oi != null && investedCapital > 0 ? oi / investedCapital : null;

    return {
      fiscalYear: fy,
      revenue: revByFy.get(fy) ?? null,
      eps: epsByFy.get(fy) ?? null,
      bookValue: equity,
      roe: roe != null ? r(roe * 100, 2) : null,
      roic: roic != null ? r(roic * 100, 2) : null,
    };
  });

  const roeValues = series.map(s => s.roe).filter((v): v is number => v != null);
  const roicValues = series.map(s => s.roic).filter((v): v is number => v != null);
  const roeAvg = roeValues.length > 0 ? roeValues.reduce((a, b) => a + b, 0) / roeValues.length : null;
  const roicAvg = roicValues.length > 0 ? roicValues.reduce((a, b) => a + b, 0) / roicValues.length : null;

  const marginValues = recentFys.map(fy => {
    const ni = niByFy.get(fy);
    const rev = revByFy.get(fy);
    return ni != null && rev && rev > 0 ? ni / rev : null;
  }).filter((v): v is number => v != null);

  const marginStability = marginValues.length >= 3 ? (() => {
    const mean = marginValues.reduce((a, b) => a + b, 0) / marginValues.length;
    if (mean === 0) return null;
    const variance = marginValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / marginValues.length;
    return 1 - Math.sqrt(variance) / Math.abs(mean);
  })() : null;

  const earningsConsistency = epsValues.length >= 3
    ? epsValues.filter(v => v > 0).length / epsValues.length
    : null;

  let growthReinvestmentBalance: number | null = null;
  const capexValues = recentFys.map(fy => capexByFy.get(fy) ?? null).filter((v): v is number => v != null);
  const niValues = recentFys.map(fy => niByFy.get(fy) ?? null).filter((v): v is number => v != null);
  if (capexValues.length > 0 && niValues.length > 0) {
    const avgCapex = capexValues.reduce((a, b) => a + b, 0) / capexValues.length;
    const avgNi = niValues.reduce((a, b) => a + b, 0) / niValues.length;
    if (avgNi > 0) {
      const reinvestmentRate = avgCapex / avgNi;
      growthReinvestmentBalance = reinvestmentRate > 0 && reinvestmentRate < 1.5 ? 1 : 0;
    }
  }

  let shareholderReturnYears = 0;
  for (const fy of recentFys) {
    const div = divByFy.get(fy) ?? 0;
    const buyback = buybackByFy.get(fy) ?? 0;
    if (div > 0 || buyback > 0) shareholderReturnYears++;
  }

  let priceCagr: number | null = null;
  try {
    const chartPoints = await yahooProvider.getChart(normalizedTicker, "1mo", true);
    if (chartPoints.length >= 2) {
      const yearsData = chartPoints.slice(-Math.min(years * 12, chartPoints.length));
      if (yearsData.length >= 2) {
        const first = yearsData[0]!.value;
        const last = yearsData[yearsData.length - 1]!.value;
        if (first > 0 && last > 0) {
          const n = yearsData.length / 12;
          priceCagr = (Math.pow(last / first, 1 / n) - 1) * 100;
        }
      }
    }
  } catch { /* Yahoo may fail for some tickers */ }

  // Score (0-100)
  let score = 50;
  if (revenueCagr != null) score += Math.min(10, revenueCagr * 0.5);
  if (epsCagr != null) score += Math.min(10, epsCagr * 0.5);
  if (bookValueCagr != null) score += Math.min(8, bookValueCagr * 0.4);
  if (roeAvg != null) score += Math.min(12, roeAvg * 0.15);
  if (roicAvg != null) score += Math.min(12, roicAvg * 0.2);
  if (marginStability != null) score += Math.min(8, marginStability * 8);
  if (earningsConsistency != null) score += Math.min(8, earningsConsistency * 8);
  if (growthReinvestmentBalance === 1) score += 5;
  score += Math.min(5, (shareholderReturnYears / Math.max(1, recentFys.length)) * 5);
  if (priceCagr != null && epsCagr != null && priceCagr < epsCagr) score += 3;
  score = Math.max(0, Math.min(100, score));

  const verdict = labelFromBands(score, [
    { min: 0, max: 20, label: "Not a Compounder" },
    { min: 20, max: 40, label: "Weak Compounder" },
    { min: 40, max: 60, label: "Moderate Compounder" },
    { min: 60, max: 80, label: "Strong Compounder" },
    { min: 80, max: 101, label: "Elite Compounder" },
  ]);

  const summary = `${normalizedTicker}: ${verdict.toLowerCase()} (score ${r(score, 1)}). Revenue CAGR ${r(revenueCagr, 1)}%, EPS CAGR ${r(epsCagr, 1)}%, BV CAGR ${r(bookValueCagr, 1)}%. Avg ROE ${r(roeAvg, 1)}%, avg ROIC ${r(roicAvg, 1)}%. Margin stability ${r(marginStability, 2)}, earnings consistency ${r(earningsConsistency, 2)}. ${shareholderReturnYears}/${recentFys.length} years with shareholder returns.`;

  return {
    ticker: normalizedTicker,
    summary,
    verdict,
    score: r(score, 1) ?? 0,
    yearsAnalyzed: recentFys.length,
    metrics: {
      revenueCagr: r(revenueCagr, 2),
      epsCagr: r(epsCagr, 2),
      bookValueCagr: r(bookValueCagr, 2),
      roeAvg: r(roeAvg, 2),
      roicAvg: r(roicAvg, 2),
      marginStability: r(marginStability, 3),
      earningsConsistency: r(earningsConsistency, 3),
      growthReinvestmentBalance,
      shareholderReturnYears,
      priceCagr: r(priceCagr, 2),
    },
    series,
    metadata: { generatedAt: new Date().toISOString(), sources: ["sec-edgar", "yahoo"] },
  };
}

export const analyzeCompounderScoreTool = {
  name: "analyze_compounder_score",
  description:
    "Score a company's compounder quality over 10+ years: revenue/EPS/book value CAGR, average ROE and ROIC, margin stability, earnings consistency, growth-reinvestment balance, shareholder return years, price CAGR vs earnings CAGR. Returns verdict (Elite/Strong/Moderate/Weak/Not a Compounder) and 0-100 score with annual series.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      years: { type: "number", description: "Years to analyze (default 10)" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, years } = AnalyzeCompounderScoreInput.parse(args);
    return await analyzeCompounderScore(ticker, years);
  },
};