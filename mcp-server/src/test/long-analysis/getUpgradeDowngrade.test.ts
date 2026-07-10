import { getUpgradeDowngrade } from "../../tools/long-analysis/getUpgradeDowngrade.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assertEqual, assertType, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching upgrade/downgrade for: ${ticker}`);
  const result = await getUpgradeDowngrade(ticker);
  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertType(result.fromCache, "boolean", "fromCache is boolean");
  if (result.actions.length > 0) {
    assertType(result.actions[0]!.toGrade, "string", "first rating toGrade is string");
    assertType(result.actions[0]!.action, "string", "first rating action is string");
  } else {
    console.log("  ⚠️ No upgrade/downgrade data returned (common on Finnhub free tier)");
  }
  printSummary();
}
main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("403") || message.includes("don't have access")) {
    console.log("  ⚠️ Finnhub free tier blocks upgrade/downgrade endpoint — skipping as expected");
    printSummary();
    return;
  }
  console.error("Error:", err);
  process.exit(1);
});