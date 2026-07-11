/**
 * Auto-discovery registry for combo / composite analysis tools.
 * Import this in the server entry (index.ts) to register all tools in this category.
 */

import { analyzeInsiderSentimentTool } from "./analyzeInsiderSentiment.js";
import { analyzeEarningsMomentumTool } from "./analyzeEarningsMomentum.js";
import { findSmartMoneyConvergenceTool } from "./findSmartMoneyConvergence.js";
import { analyzeShareholderYieldTool } from "./analyzeShareholderYield.js";
import { scanLiquidityRegimeTool } from "./scanLiquidityRegime.js";
import { analyzeCongressNewsCatalystTool } from "./analyzeCongressNewsCatalyst.js";
import { compareSectorValuationTool } from "./compareSectorValuation.js";
import { getSectorRelativeStrengthTool } from "./getSectorRelativeStrength.js";

export const comboTools = [
  analyzeInsiderSentimentTool,
  analyzeEarningsMomentumTool,
  findSmartMoneyConvergenceTool,
  analyzeShareholderYieldTool,
  scanLiquidityRegimeTool,
  analyzeCongressNewsCatalystTool,
  compareSectorValuationTool,
  getSectorRelativeStrengthTool,
];
