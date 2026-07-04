/**
 * Auto-discovery registry for long-term analysis tools.
 * Import this in index.ts to register all tools in this category.
 */

import { fetchCompanyProfileTool } from "./fetchCompanyProfile.js";

export const longAnalysisTools = [
  fetchCompanyProfileTool,
];