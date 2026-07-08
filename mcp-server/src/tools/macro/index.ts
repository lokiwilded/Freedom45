/**
 * Auto-discovery registry for macro / liquidity tools.
 * Import this in the server entry (index.ts) to register all tools in this category.
 */

import { getMoneySupplyTool } from "./getMoneySupply.js";
import { getGovernmentDebtTool } from "./getGovernmentDebt.js";
import { getDebtTool } from "./getDebt.js";
import { getGlobalLiquidityTool } from "./getGlobalLiquidity.js";
import { getAssetHistoryTool } from "./getAssetHistory.js";
import { getLiquidityElasticityTool } from "./getLiquidityElasticity.js";

export const macroTools = [
  getMoneySupplyTool,
  getGovernmentDebtTool,
  getDebtTool,
  getGlobalLiquidityTool,
  getAssetHistoryTool,
  getLiquidityElasticityTool,
];
