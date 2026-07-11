import { getSplits } from "../../tools/long-analysis/getSplits.js";
import { initProviders } from "../../providers/index.js";
import { assertEqual, assertType, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  const from = process.argv[3] || "2000-01-01";
  const to = process.argv[4] || "2026-07-04";
  initProviders();
  console.log(`Fetching splits for: ${ticker} from ${from} to ${to}`);
  const result = await getSplits(ticker, from, to);
  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertType(result.fromCache, "boolean", "fromCache is boolean");
  if (result.splits.length > 0) {
    assertType(result.splits[0]!.date, "string", "first split date is string");
    assertType(result.splits[0]!.ratio, "string", "first split ratio is string");
  } else {
    console.log("  ⚠️ No split data returned (common on Finnhub free tier)");
  }
  printSummary();
}
main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("403") || message.includes("don't have access")) {
    console.log("  ⚠️ Finnhub free tier blocks splits endpoint — skipping as expected");
    printSummary();
    return;
  }
  console.error("Error:", err);
  process.exit(1);
});