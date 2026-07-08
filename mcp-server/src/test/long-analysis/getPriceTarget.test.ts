import { getPriceTarget } from "../../tools/long-analysis/getPriceTarget.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assertEqual, assertType, assertNotNull, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching price target for: ${ticker}`);
  const result = await getPriceTarget(ticker);

  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertType(result.fromCache, "boolean", "fromCache is a boolean");
  if (result.target) {
    assertNotNull(result.target.mean, "target.mean is present");
    assertNotNull(result.target.median, "target.median is present");
  }
  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });