/**
 * Auto-discovery registry for long-term analysis tools.
 * Import this in index.ts to register all tools in this category.
 */

import { fetchCompanyProfileTool } from "./fetchCompanyProfile.js";
import { fetchStockQuoteTool } from "./fetchStockQuote.js";
import { fetchHistoricalPricesTool } from "./fetchHistoricalPrices.js";
import { fetchFundamentalMetricsTool } from "./fetchFundamentalMetrics.js";
import { fetchPeersTool } from "./fetchPeers.js";
import { analyzeLongTermTrendTool } from "./analyzeLongTermTrend.js";
import { searchStocksTool } from "./searchStocks.js";
import { getInsiderTransactionsTool } from "./getInsiderTransactions.js";
import { getCompanyNewsTool } from "./getCompanyNews.js";
import { getMarketNewsTool } from "./getMarketNews.js";
import { getEarningsCalendarTool } from "./getEarningsCalendar.js";
import { getEarningsSurpriseTool } from "./getEarningsSurprise.js";
import { getRecommendationTrendsTool } from "./getRecommendationTrends.js";
import { getPriceTargetTool } from "./getPriceTarget.js";
import { getUpgradeDowngradeTool } from "./getUpgradeDowngrade.js";
import { getDividendsTool } from "./getDividends.js";
import { getSplitsTool } from "./getSplits.js";
import { getSecFilingsTool } from "./getSecFilings.js";
import { getInstitutionalOwnershipTool } from "./getInstitutionalOwnership.js";
import { getFundOwnershipTool } from "./getFundOwnership.js";
import { analyzeValuationTool } from "./analyzeValuation.js";
import { analyzeRelativeStrengthTool } from "./analyzeRelativeStrength.js";

export const longAnalysisTools = [
  fetchCompanyProfileTool,
  fetchStockQuoteTool,
  fetchHistoricalPricesTool,
  fetchFundamentalMetricsTool,
  fetchPeersTool,
  analyzeLongTermTrendTool,
  searchStocksTool,
  getInsiderTransactionsTool,
  getCompanyNewsTool,
  getMarketNewsTool,
  getEarningsCalendarTool,
  getEarningsSurpriseTool,
  getRecommendationTrendsTool,
  getPriceTargetTool,
  getUpgradeDowngradeTool,
  getDividendsTool,
  getSplitsTool,
  getSecFilingsTool,
  getInstitutionalOwnershipTool,
  getFundOwnershipTool,
  analyzeValuationTool,
  analyzeRelativeStrengthTool,
];