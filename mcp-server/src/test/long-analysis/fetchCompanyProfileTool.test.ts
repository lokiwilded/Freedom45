import { fetchCompanyProfileTool } from "../../tools/long-analysis/fetchCompanyProfile.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assert, assertEqual, assertNotNull, printSummary } from "../shared/assertions.js";

async function main() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error("FINNHUB_API_KEY is not set");
  finnhubProvider.init(apiKey);

  const result = await fetchCompanyProfileTool.handler({ ticker: "NVDA" }) as any;
  console.log("Tool handler result:");
  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, "NVDA", "ticker is NVDA");
  assertNotNull(result.name, "name is present");
  assert(typeof result.fromCache === "boolean", "fromCache is a boolean");
  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });