import { analyzeEarningsQuality } from "../../tools/long-term/analyzeEarningsQuality.js";
import { initProviders } from "../../providers/index.js";
import { assert, assertType, assertInArray, assertArray, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  const years = Number(process.argv[3]) || 10;
  initProviders();

  console.log(`\n=== analyze_earnings_quality for ${ticker} (${years}y) ===`);
  const result = await analyzeEarningsQuality(ticker, years);

  assertType(result.summary, "string", "summary is a string");
  assert(result.summary.length > 0, "summary is non-empty");
  assertInArray(result.verdict, ["Excellent Quality", "Good Quality", "Moderate Quality", "Weak Quality", "Poor Quality", "No Data"], "verdict is valid");
  assertType(result.score, "number", "score is a number");
  assert(result.score >= 0 && result.score <= 100, "score between 0 and 100");
  assertType(result.yearsAnalyzed, "number", "yearsAnalyzed is a number");
  assertArray(result.series, "series is an array");
  if (result.verdict !== "No Data") {
    assert(result.series.length > 0, "series has data when verdict is not No Data");
  }
  assert(result.metrics.revenueCagr === null || typeof result.metrics.revenueCagr === "number", "revenueCagr is number or null");
  assert(result.metrics.epsCagr === null || typeof result.metrics.epsCagr === "number", "epsCagr is number or null");
  assertType(result.metrics.grossMarginTrend, "string", "grossMarginTrend is a string");
  assertType(result.metrics.debtToEquity, "number", "debtToEquity is a number");
  assertType(result.metrics.returnOnEquity, "number", "returnOnEquity is a number");

  console.log("\nSample output:");
  console.log(JSON.stringify({ summary: result.summary, verdict: result.verdict, score: result.score, yearsAnalyzed: result.yearsAnalyzed, seriesLength: result.series.length }, null, 2));

  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });