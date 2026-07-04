import { fetchCompanyProfile } from "../../tools/long-analysis/fetchCompanyProfile.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assertEqual, assertType, assertNotNull, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error("FINNHUB_API_KEY is not set");
  finnhubProvider.init(apiKey);

  console.log(`Fetching company profile for: ${ticker}`);
  const result = await fetchCompanyProfile(ticker);

  console.log("\nResult:");
  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertType(result.name, "string", "name is a string");
  assertNotNull(result.sector, "sector is present");
  assertNotNull(result.industry, "industry is present");
  assertType(result.fromCache, "boolean", "fromCache is a boolean");
  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });