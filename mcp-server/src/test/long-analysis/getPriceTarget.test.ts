import { getPriceTarget } from "../../tools/long-analysis/getPriceTarget.js";
import { initProviders } from "../../providers/index.js";
import { assertEqual, assertType, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  initProviders();
  console.log(`Fetching price target for: ${ticker}`);
  const result = await getPriceTarget(ticker);
  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertType(result.fromCache, "boolean", "fromCache is boolean");
  if (result.target) {
    assertType(result.target.mean, "number", "target.mean is a number");
    assertType(result.target.median, "number", "target.median is a number");
  } else {
    console.log("  ⚠️ No price target data returned (common on Finnhub free tier)");
  }
  printSummary();
}
main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("403") || message.includes("don't have access")) {
    console.log("  ⚠️ Finnhub free tier blocks price target endpoint — skipping as expected");
    printSummary();
    return;
  }
  console.error("Error:", err);
  process.exit(1);
});