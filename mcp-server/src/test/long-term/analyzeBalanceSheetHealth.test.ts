import { analyzeBalanceSheetHealth } from "../../tools/long-term/analyzeBalanceSheetHealth.js";
import { initProviders } from "../../providers/index.js";
import { assert, assertType, assertInArray, assertArray, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  const years = Number(process.argv[3]) || 10;
  initProviders();

  console.log(`\n=== analyze_balance_sheet_health for ${ticker} (${years}y) ===`);
  const result = await analyzeBalanceSheetHealth(ticker, years);

  assertType(result.summary, "string", "summary is a string");
  assert(result.summary.length > 0, "summary is non-empty");
  assertInArray(result.verdict, ["Fortress", "Strong", "Adequate", "Weak", "Distressed", "No Data"], "verdict is valid");
  assertType(result.score, "number", "score is a number");
  assert(result.score >= 0 && result.score <= 100, "score between 0 and 100");
  assertArray(result.series, "series is an array");
  assertType(result.metrics.currentRatio, "number", "currentRatio is a number");
  assertType(result.metrics.debtToEquity, "number", "debtToEquity is a number");

  console.log("\nSample output:");
  console.log(JSON.stringify({ summary: result.summary, verdict: result.verdict, score: result.score, seriesLength: result.series.length }, null, 2));

  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });