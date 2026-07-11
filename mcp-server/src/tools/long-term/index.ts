import { analyzeEarningsQualityTool } from "./analyzeEarningsQuality.js";
import { analyzeCapitalAllocationTool } from "./analyzeCapitalAllocation.js";
import { analyzeBalanceSheetHealthTool } from "./analyzeBalanceSheetHealth.js";
import { analyzeCompounderScoreTool } from "./analyzeCompounderScore.js";

export const longTermTools = [
  analyzeEarningsQualityTool,
  analyzeCapitalAllocationTool,
  analyzeBalanceSheetHealthTool,
  analyzeCompounderScoreTool,
];