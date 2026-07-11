import { z } from "zod";
import { secEdgarProvider } from "../../providers/sec-edgar.js";
import { labelFromBands, r } from "../../lib/verdicts.js";

export const AnalyzeBalanceSheetHealthInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  years: z.number().min(3).max(20).default(10).describe("Years to analyze (default 10)"),
});

export type AnalyzeBalanceSheetHealthInput = z.infer<typeof AnalyzeBalanceSheetHealthInput>;

export interface BalanceSheetHealthResult {
  ticker: string;
  summary: string;
  verdict: string;
  score: number;
  yearsAnalyzed: number;
  metrics: {
    currentRatio: number | null;
    quickRatio: number | null;
    debtToEquity: number | null;
    debtToAssets: number | null;
    interestCoverage: number | null;
    workingCapital: number | null;
    netDebtToEbitda: number | null;
    altmanZScore: number | null;
    assetTurnover: number | null;
    inventoryTurnover: number | null;
  };
  series: { fiscalYear: number; assets: number | null; liabilities: number | null; equity: number | null; debt: number | null; currentAssets: number | null; currentLiabilities: number | null; cash: number | null }[];
  metadata: { generatedAt: string; sources: string[]; errors?: Record<string, string | undefined> };
}

export async function analyzeBalanceSheetHealth(ticker: string, years = 10): Promise<BalanceSheetHealthResult> {
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
        currentRatio: null, quickRatio: null, debtToEquity: null, debtToAssets: null,
        interestCoverage: null, workingCapital: null, netDebtToEbitda: null, altmanZScore: null,
        assetTurnover: null, inventoryTurnover: null,
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

  const assetsRaw = getAnnual("Assets");
  const liabilitiesRaw = getAnnual("Liabilities");
  const equityRaw = getAnnual("StockholdersEquity");
  const debtRaw = getAnnual("LongTermDebt", ["LongTermDebtNoncurrent"]);
  const currentAssetsRaw = getAnnual("AssetsCurrent");
  const currentLiabilitiesRaw = getAnnual("LiabilitiesCurrent");
  const cashRaw = getAnnual("CashAndCashEquivalentsAtCarryingValue", ["CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"]);
  const inventoryRaw = getAnnual("InventoryNet");
  const revRaw = getAnnual("Revenues", ["RevenueFromContractWithCustomerExcludingAssessedTax"]);
  const cogsRaw = getAnnual("CostOfGoodsAndServicesSold", ["CostOfRevenue", "CostsAndExpenses"]);
  const ebitRaw = getAnnual("OperatingIncomeLoss");
  const interestRaw = getAnnual("InterestExpense", ["InterestExpenseDebt"]);
  const retainedEarningsRaw = getAnnual("RetainedEarningsAccumulatedDeficit", ["RetainedEarnings"]);

  const assetsByFy = fyMap(sortByFy(assetsRaw));
  const liabilitiesByFy = fyMap(sortByFy(liabilitiesRaw));
  const equityByFy = fyMap(sortByFy(equityRaw));
  const debtByFy = fyMap(sortByFy(debtRaw));
  const currentAssetsByFy = fyMap(sortByFy(currentAssetsRaw));
  const currentLiabilitiesByFy = fyMap(sortByFy(currentLiabilitiesRaw));
  const cashByFy = fyMap(sortByFy(cashRaw));
  const inventoryByFy = fyMap(sortByFy(inventoryRaw));
  const revByFy = fyMap(sortByFy(revRaw));
  const cogsByFy = fyMap(sortByFy(cogsRaw));
  const ebitByFy = fyMap(sortByFy(ebitRaw));
  const interestByFy = fyMap(sortByFy(interestRaw));
  const retainedByFy = fyMap(sortByFy(retainedEarningsRaw));

  const allFys = new Set<number>([...assetsByFy.keys(), ...liabilitiesByFy.keys()]);
  const recentFys = [...allFys].sort((a, b) => a - b).slice(-years);

  const series = recentFys.map(fy => ({
    fiscalYear: fy,
    assets: assetsByFy.get(fy) ?? null,
    liabilities: liabilitiesByFy.get(fy) ?? null,
    equity: equityByFy.get(fy) ?? null,
    debt: debtByFy.get(fy) ?? null,
    currentAssets: currentAssetsByFy.get(fy) ?? null,
    currentLiabilities: currentLiabilitiesByFy.get(fy) ?? null,
    cash: cashByFy.get(fy) ?? null,
  }));

  const latestFy = recentFys[recentFys.length - 1] ?? 0;
  const assets = assetsByFy.get(latestFy);
  const liabilities = liabilitiesByFy.get(latestFy);
  const equity = equityByFy.get(latestFy);
  const debt = debtByFy.get(latestFy);
  const currentAssets = currentAssetsByFy.get(latestFy);
  const currentLiabilities = currentLiabilitiesByFy.get(latestFy);
  const cash = cashByFy.get(latestFy);
  const inventory = inventoryByFy.get(latestFy);
  const rev = revByFy.get(latestFy);
  const cogs = cogsByFy.get(latestFy);
  const ebit = ebitByFy.get(latestFy);
  const interest = interestByFy.get(latestFy);
  const retained = retainedByFy.get(latestFy);

  const currentRatio = currentAssets != null && currentLiabilities && currentLiabilities > 0 ? currentAssets / currentLiabilities : null;
  const quickRatio = currentAssets != null && inventory != null && currentLiabilities && currentLiabilities > 0
    ? (currentAssets - inventory) / currentLiabilities : null;
  const debtToEquity = debt != null && equity && equity > 0 ? debt / equity : null;
  const debtToAssets = debt != null && assets && assets > 0 ? debt / assets : null;
  const interestCoverage = ebit != null && interest && interest > 0 ? ebit / interest : null;
  const workingCapital = currentAssets != null && currentLiabilities != null ? currentAssets - currentLiabilities : null;
  const netDebt = debt != null && cash != null ? debt - cash : null;
  const ebitda = ebit != null ? ebit : null;
  const netDebtToEbitda = netDebt != null && ebitda && ebitda > 0 ? netDebt / ebitda : null;
  const assetTurnover = rev != null && assets && assets > 0 ? rev / assets : null;
  const inventoryTurnover = cogs != null && inventory && inventory > 0 ? cogs / inventory : null;

  // Altman Z-Score (simplified for manufacturing; non-manufacturers use adapted version)
  // Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 1.0*X5
  // X1 = working capital / total assets
  // X2 = retained earnings / total assets
  // X3 = EBIT / total assets
  // X4 = market equity / book liabilities (using book equity as proxy)
  // X5 = revenue / total assets
  let altmanZScore: number | null = null;
  if (assets && assets > 0 && workingCapital != null && retained != null && ebit != null && equity != null && liabilities && liabilities > 0 && rev != null) {
    const x1 = workingCapital / assets;
    const x2 = retained / assets;
    const x3 = ebit / assets;
    const x4 = equity / liabilities;
    const x5 = rev / assets;
    altmanZScore = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 1.0 * x5;
  }

  // Score (0-100)
  let score = 50;
  if (currentRatio != null) {
    if (currentRatio > 1.5) score += 8;
    if (currentRatio < 1) score -= 10;
  }
  if (debtToEquity != null) {
    if (debtToEquity < 0.5) score += 8;
    if (debtToEquity > 2) score -= 10;
  }
  if (interestCoverage != null) {
    if (interestCoverage > 5) score += 8;
    if (interestCoverage < 2) score -= 8;
  }
  if (netDebtToEbitda != null) {
    if (netDebtToEbitda < 2) score += 5;
    if (netDebtToEbitda > 4) score -= 5;
  }
  if (altmanZScore != null) {
    if (altmanZScore > 3) score += 10;
    if (altmanZScore < 1.8) score -= 15;
  }
  if (assetTurnover != null && assetTurnover > 0.5) score += 4;
  if (debtToAssets != null && debtToAssets < 0.3) score += 5;
  score = Math.max(0, Math.min(100, score));

  const verdict = labelFromBands(score, [
    { min: 0, max: 20, label: "Distressed" },
    { min: 20, max: 40, label: "Weak" },
    { min: 40, max: 60, label: "Adequate" },
    { min: 60, max: 80, label: "Strong" },
    { min: 80, max: 101, label: "Fortress" },
  ]);

  const summary = `${normalizedTicker}: ${verdict.toLowerCase()} balance sheet (score ${r(score, 1)}). Current ratio ${r(currentRatio, 2)}, debt/equity ${r(debtToEquity, 2)}, interest coverage ${r(interestCoverage, 1)}x, net debt/EBITDA ${r(netDebtToEbitda, 2)}, Altman Z ${r(altmanZScore, 2)}.`;

  return {
    ticker: normalizedTicker,
    summary,
    verdict,
    score: r(score, 1) ?? 0,
    yearsAnalyzed: recentFys.length,
    metrics: {
      currentRatio: r(currentRatio, 2),
      quickRatio: r(quickRatio, 2),
      debtToEquity: r(debtToEquity, 2),
      debtToAssets: r(debtToAssets, 3),
      interestCoverage: r(interestCoverage, 2),
      workingCapital: r(workingCapital != null ? workingCapital / 1e9 : null, 2),
      netDebtToEbitda: r(netDebtToEbitda, 2),
      altmanZScore: r(altmanZScore, 2),
      assetTurnover: r(assetTurnover, 3),
      inventoryTurnover: r(inventoryTurnover, 2),
    },
    series,
    metadata: { generatedAt: new Date().toISOString(), sources: ["sec-edgar"] },
  };
}

export const analyzeBalanceSheetHealthTool = {
  name: "analyze_balance_sheet_health",
  description:
    "Analyze 10+ years of balance sheet health from SEC filings: current ratio, quick ratio, debt/equity, debt/assets, interest coverage, working capital, net debt/EBITDA, Altman Z-score, asset turnover, inventory turnover. Returns verdict (Fortress/Strong/Adequate/Weak/Distressed) and 0-100 score with annual series.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      years: { type: "number", description: "Years to analyze (default 10)" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, years } = AnalyzeBalanceSheetHealthInput.parse(args);
    return await analyzeBalanceSheetHealth(ticker, years);
  },
};