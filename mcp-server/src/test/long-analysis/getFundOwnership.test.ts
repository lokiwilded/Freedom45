import { getFundOwnership } from "../../tools/long-analysis/getFundOwnership.js";
import { initProviders } from "../../providers/index.js";
import { assertEqual, assertType, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  initProviders();
  console.log(`Fetching fund ownership for: ${ticker}`);
  const result = await getFundOwnership(ticker);
  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertType(result.fromCache, "boolean", "fromCache is boolean");
  if (result.owners.length > 0) {
    assertType(result.owners[0]!.owner, "string", "first fund owner is string");
    assertType(result.owners[0]!.shares, "number", "first fund shares is number");
  } else {
    console.log("  ⚠️ No fund ownership data returned (common on Finnhub free tier)");
  }
  printSummary();
}
main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("403") || message.includes("don't have access")) {
    console.log("  ⚠️ Finnhub free tier blocks fund ownership endpoint — skipping as expected");
    printSummary();
    return;
  }
  console.error("Error:", err);
  process.exit(1);
});