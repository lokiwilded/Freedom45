import { analyzeValuation } from "../../tools/long-analysis/analyzeValuation.js";
import { initProviders } from "../../providers/index.js";
import { assert, assertEqual, assertType, assertInArray, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  initProviders();
  console.log(`Analyzing valuation for: ${ticker}`);
  const result = await analyzeValuation(ticker);

  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertType(result.score, "number", "score is a number");
  assertInArray(result.verdict, ["Undervalued", "Fairly valued", "Overvalued", "Insufficient data"], "verdict is valid");
  assertType(result.components.pe, "number", "components.pe is a number");
  assertType(result.components.pb, "number", "components.pb is a number");
  assertType(result.fromCache, "boolean", "fromCache is a boolean");
  assert(Array.isArray(result.comparison.peers), "comparison.peers is an array");
  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });