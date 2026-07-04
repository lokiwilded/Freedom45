/**
 * Verify the MCP tool wrapper for fetch_company_profile.
 */

import { fetchCompanyProfileTool } from "../../tools/long-analysis/fetchCompanyProfile.js";
import { finnhubProvider } from "../../providers/finnhub.js";

async function main() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY is not set");
  }
  finnhubProvider.init(apiKey);

  const result = await fetchCompanyProfileTool.handler({ ticker: "NVDA" });
  console.log("Tool handler result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
