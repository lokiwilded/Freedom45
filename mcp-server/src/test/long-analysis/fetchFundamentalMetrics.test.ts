import { fetchFundamentalMetrics } from "../../tools/long-analysis/fetchFundamentalMetrics.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assertEqual, assertType, assertNotNull, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching fundamental metrics for: ${ticker}`);
  const result = await fetchFundamentalMetrics(ticker);

  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertType(result.fromCache, "boolean", "fromCache is a boolean");
  assertNotNull(result.epsTTM, "epsTTM is present");
  assertNotNull(result.roeTTM, "roeTTM is present");
  assertNotNull(result.grossMarginTTM, "grossMarginTTM is present");
  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });