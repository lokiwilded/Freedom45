/**
 * Verify auto-discovery registers tools.
 */

import { longAnalysisTools } from "../../tools/long-analysis/index.js";

function main() {
  const names = longAnalysisTools.map((t) => t.name);
  console.log("Registered long-analysis tools:", names);

  const profileTool = longAnalysisTools.find((t) => t.name === "fetch_company_profile");
  if (!profileTool) {
    throw new Error("fetch_company_profile tool not found in registry");
  }

  console.log("fetch_company_profile schema:");
  console.log(JSON.stringify(profileTool.inputSchema, null, 2));
}

main();
