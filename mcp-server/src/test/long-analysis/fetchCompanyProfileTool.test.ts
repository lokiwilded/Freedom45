/**
 * Verify the MCP tool wrapper for fetch_company_profile.
 */

import { fetchCompanyProfileTool } from "../../tools/long-analysis/fetchCompanyProfile.js";
import { initProviders } from "../../providers/index.js";

async function main() {
  initProviders();

  const result = await fetchCompanyProfileTool.handler({ ticker: "NVDA" });
  console.log("Tool handler result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
