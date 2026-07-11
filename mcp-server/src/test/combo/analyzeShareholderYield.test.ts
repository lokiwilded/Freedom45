import { analyzeShareholderYield } from "../../tools/combo/analyzeShareholderYield.js";
import { initProviders } from "../../providers/index.js";
import {
  assert,
  assertType,
  assertInArray,
  printSummary,
} from "../shared/assertions.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  initProviders();

  console.log(`\n=== analyze_shareholder_yield for ${ticker} ===`);
  const result = await analyzeShareholderYield(ticker, 5);

  assertType(result.summary, "string", "summary is a string");
  assert(result.summary.length > 0, "summary is non-empty");
  assertInArray(
    result.verdict,
    ["No Yield", "Low Yield", "Moderate Yield", "High Yield", "Very High Yield", "No Data"],
    "verdict is valid"
  );
  assertType(result.score, "number", "score is a number");
  assert(result.score >= 0 && result.score <= 100, "score between 0 and 100");
  assertInArray(result.sustainability, ["Safe", "Caution", "Stretched", "Unknown"], "sustainability is valid");
  assertArray(result.series, "series is an array");
  assertType(result.metadata.generatedAt, "string", "metadata.generatedAt exists");

  console.log("\nSample output:");
  console.log(JSON.stringify({ summary: result.summary, verdict: result.verdict, score: result.score, totalShareholderYield: result.totalShareholderYield }, null, 2));

  printSummary();
}

function assertArray(value: unknown, label: string) {
  assert(Array.isArray(value), `${label} (expected array, got ${typeof value})`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
