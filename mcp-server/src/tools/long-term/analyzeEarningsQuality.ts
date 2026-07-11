import { z } from "zod";
import { secEdgarProvider } from "../../providers/sec-edgar.js";
import { labelFromBands, r } from "../../lib/verdicts.js";

export const AnalyzeEarningsQualityInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  years: z.number().min(3).max(20).default(10).describe("Years to analyze (default 10)"),
});

export type AnalyzeEarningsQualityInput = z.infer<typeof AnalyzeEarningsQualityInput>;

export interface EarningsQualityResult {
  ticker: string;
  summary: string;
  verdict: string;
  score: number;
  yearsAnalyzed: number;
  metrics: {
    revenueCagr: number | null;
    epsCagr: number | null;
    grossMarginTrend: string;
    netMarginTrend: string;
    operatingMarginTrend: string;
    rdIntensityTrend: string;
    accuralQuality: number | null;
    earningsVolatility: number | null;
    debtToEquity: number | null;
    currentRatio: number | null;
    returnOnEquity: number | null;
    returnOnAssets: number | null;
  };
  series: { fiscalYear: number; revenue: number | null; netIncome: number | null; operatingIncome: number | null; grossProfit: number | null; eps: number | null; rd: number | null }[];
  metadata: { generatedAt: string; sources: string[]; errors?: Record<string, string | undefined> };
}

export async function analyzeEarningsQuality(ticker: string, years = 10): Promise<EarningsQualityResult> {
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
        revenueCagr: null, epsCagr: null, grossMarginTrend: "unknown", netMarginTrend: "unknown",
        operatingMarginTrend: "unknown", rdIntensityTrend: "unknown", accuralQuality: null,
        earningsVolatility: null, debtToEquity: null, currentRatio: null, returnOnEquity: null, returnOnAssets: null,
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

  const revenueRaw = getAnnual("Revenues", ["RevenueFromContractWithCustomerExcludingAssessedTax", "RevenueFromContractWithCustomerIncludingAssessedTax"]);
  const netIncomeRaw = getAnnual("NetIncomeLoss");
  const operatingIncomeRaw = getAnnual("OperatingIncomeLoss");
  const grossProfitRaw = getAnnual("GrossProfit");
  const epsRaw = getAnnual("EarningsPerShareBasic", ["EarningsPerShareBasicAndDiluted"]);
  const rdRaw = getAnnual("ResearchAndDevelopmentExpense");
  const debtRaw = getAnnual("LongTermDebt", ["LongTermDebtNoncurrent"]);
  const equityRaw = getAnnual("StockholdersEquity");
  const assetsRaw = getAnnual("Assets");
  const currentAssetsRaw = getAnnual("AssetsCurrent");
  const currentLiabilitiesRaw = getAnnual("LiabilitiesCurrent");
  const operatingCashFlowRaw = getAnnual("NetCashProvidedByUsedInOperatingActivities", ["CashFlowFromOperatingActivities"]);

  const sortByFy = (arr: any[]) => [...arr].sort((a, b) => a.fy - b.fy);
  const fyMap = (arr: any[]) => new Map(arr.filter(d => d.fy).map(d => [d.fy, d.val]));

  const revByFy = fyMap(sortByFy(revenueRaw));
  const niByFy = fyMap(sortByFy(netIncomeRaw));
  const oiByFy = fyMap(sortByFy(operatingIncomeRaw));
  const gpByFy = fyMap(sortByFy(grossProfitRaw));
  const epsByFy = fyMap(sortByFy(epsRaw));
  const rdByFy = fyMap(sortByFy(rdRaw));

  const allFys = new Set<number>([...revByFy.keys(), ...niByFy.keys(), ...gpByFy.keys()]);
  const recentFys = [...allFys].sort((a, b) => a - b).slice(-years);

  const series = recentFys.map(fy => ({
    fiscalYear: fy,
    revenue: revByFy.get(fy) ?? null,
    netIncome: niByFy.get(fy) ?? null,
    operatingIncome: oiByFy.get(fy) ?? null,
    grossProfit: gpByFy.get(fy) ?? null,
    eps: epsByFy.get(fy) ?? null,
    rd: rdByFy.get(fy) ?? null,
  }));

  // CAGR
  const cagr = (arr: number[]): number | null => {
    if (arr.length < 2 || arr[0]! <= 0 || arr[arr.length - 1]! <= 0) return null;
    const n = arr.length - 1;
    return (Math.pow(arr[arr.length - 1]! / arr[0]!, 1 / n) - 1) * 100;
  };

  const revValues = series.map(s => s.revenue).filter((v): v is number => v != null);
  const epsValues = series.map(s => s.eps).filter((v): v is number => v != null);
  const niValues = series.map(s => s.netIncome).filter((v): v is number => v != null);

  const revenueCagr = cagr(revValues);
  const epsCagr = cagr(epsValues);

  // Margin trends
  const marginTrend = (series.map(s => s.revenue && s.netIncome ? s.netIncome / s.revenue : null).filter((v): v is number => v != null));
  const grossMarginSeries = series.map(s => s.revenue && s.grossProfit ? s.grossProfit / s.revenue : null).filter((v): v is number => v != null);
  const opMarginSeries = series.map(s => s.revenue && s.operatingIncome ? s.operatingIncome / s.revenue : null).filter((v): v is number => v != null);
  const rdIntensitySeries = series.map(s => s.revenue && s.rd ? s.rd / s.revenue : null).filter((v): v is number => v != null);

  const trendLabel = (arr: number[]): string => {
    if (arr.length < 2) return "unknown";
    const recent = arr.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, arr.length);
    const prior = arr.slice(0, Math.min(3, arr.length - 3)).reduce((a, b) => a + b, 0) / Math.min(3, arr.length - 3 || 1);
    const diff = recent - prior;
    if (diff > 0.02) return "expanding";
    if (diff < -0.02) return "contracting";
    return "stable";
  };

  const grossMarginTrend = trendLabel(grossMarginSeries);
  const netMarginTrend = trendLabel(marginTrend);
  const operatingMarginTrend = trendLabel(opMarginSeries);
  const rdIntensityTrend = trendLabel(rdIntensitySeries);

  // Earnings volatility (coefficient of variation of net income)
  const earningsVolatility = niValues.length >= 3 ? (() => {
    const mean = niValues.reduce((a, b) => a + b, 0) / niValues.length;
    if (mean === 0) return null;
    const variance = niValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / niValues.length;
    return Math.sqrt(variance) / Math.abs(mean);
  })() : null;

  // Accrual quality: (net income - operating cash flow) / assets
  const cfByFy = fyMap(sortByFy(operatingCashFlowRaw));
  const assetsByFy = fyMap(sortByFy(assetsRaw));
  const accruals: number[] = [];
  for (const s of series) {
    const cf = cfByFy.get(s.fiscalYear);
    const assets = assetsByFy.get(s.fiscalYear);
    if (s.netIncome != null && cf != null && assets && assets > 0) {
      accruals.push(Math.abs((s.netIncome - cf) / assets));
    }
  }
  const accuralQuality = accruals.length > 0 ? 1 - (accruals.reduce((a, b) => a + b, 0) / accruals.length) : null;

  // Balance sheet metrics (latest year)
  const debtByFy = fyMap(sortByFy(debtRaw));
  const equityByFy = fyMap(sortByFy(equityRaw));
  const currentAssetsByFy = fyMap(sortByFy(currentAssetsRaw));
  const currentLiabilitiesByFy = fyMap(sortByFy(currentLiabilitiesRaw));

  const latestFy = recentFys[recentFys.length - 1] ?? 0;
  const debt = debtByFy.get(latestFy);
  const equity = equityByFy.get(latestFy);
  const currentAssets = currentAssetsByFy.get(latestFy);
  const currentLiabilities = currentLiabilitiesByFy.get(latestFy);
  const assets = assetsByFy.get(latestFy);
  const ni = niByFy.get(latestFy);

  const debtToEquity = debt != null && equity && equity > 0 ? debt / equity : null;
  const currentRatio = currentAssets != null && currentLiabilities && currentLiabilities > 0 ? currentAssets / currentLiabilities : null;
  const returnOnEquity = ni != null && equity && equity > 0 ? ni / equity : null;
  const returnOnAssets = ni != null && assets && assets > 0 ? ni / assets : null;

  // Score (0-100)
  let score = 50;
  if (revenueCagr != null) score += Math.min(15, revenueCagr * 0.75);
  if (epsCagr != null) score += Math.min(15, epsCagr * 0.75);
  if (grossMarginTrend === "expanding") score += 5;
  if (netMarginTrend === "expanding") score += 5;
  if (operatingMarginTrend === "expanding") score += 5;
  if (accuralQuality != null) score += Math.min(10, accuralQuality * 10);
  if (earningsVolatility != null) score -= Math.min(10, earningsVolatility * 20);
  if (returnOnEquity != null) score += Math.min(10, Math.min(returnOnEquity * 50, 10));
  if (debtToEquity != null && debtToEquity > 1.5) score -= 5;
  if (currentRatio != null && currentRatio < 1) score -= 5;
  score = Math.max(0, Math.min(100, score));

  const verdict = labelFromBands(score, [
    { min: 0, max: 20, label: "Poor Quality" },
    { min: 20, max: 40, label: "Weak Quality" },
    { min: 40, max: 60, label: "Moderate Quality" },
    { min: 60, max: 80, label: "Good Quality" },
    { min: 80, max: 101, label: "Excellent Quality" },
  ]);

  const summary = `${normalizedTicker}: ${verdict.toLowerCase()} (score ${r(score, 1)}). Revenue CAGR ${r(revenueCagr, 1)}%, EPS CAGR ${r(epsCagr, 1)}%. Gross margin ${grossMarginTrend}, net margin ${netMarginTrend}. ROE ${r(returnOnEquity != null ? returnOnEquity * 100 : null, 1)}%, debt/equity ${r(debtToEquity, 2)}, current ratio ${r(currentRatio, 2)}.`;

  return {
    ticker: normalizedTicker,
    summary,
    verdict,
    score: r(score, 1) ?? 0,
    yearsAnalyzed: recentFys.length,
    metrics: {
      revenueCagr: r(revenueCagr, 2),
      epsCagr: r(epsCagr, 2),
      grossMarginTrend,
      netMarginTrend,
      operatingMarginTrend,
      rdIntensityTrend,
      accuralQuality: r(accuralQuality, 3),
      earningsVolatility: r(earningsVolatility, 3),
      debtToEquity: r(debtToEquity, 2),
      currentRatio: r(currentRatio, 2),
      returnOnEquity: r(returnOnEquity != null ? returnOnEquity * 100 : null, 2),
      returnOnAssets: r(returnOnAssets != null ? returnOnAssets * 100 : null, 2),
    },
    series,
    metadata: {
      generatedAt: new Date().toISOString(),
      sources: ["sec-edgar"],
    },
  };
}

export const analyzeEarningsQualityTool = {
  name: "analyze_earnings_quality",
  description:
    "Analyze 10+ years of SEC financial data for earnings quality: revenue/EPS CAGR, margin trends (gross/operating/net), R&D intensity, accrual quality, earnings volatility, debt/equity, current ratio, ROE, ROA. Returns a descriptive verdict (Excellent/Good/Moderate/Weak/Poor Quality) and 0-100 score with graphable annual series.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      years: { type: "number", description: "Years to analyze (default 10)" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, years } = AnalyzeEarningsQualityInput.parse(args);
    return await analyzeEarningsQuality(ticker, years);
  },
};