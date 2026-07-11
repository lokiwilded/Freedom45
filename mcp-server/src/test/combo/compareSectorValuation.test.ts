import { compareSectorValuation } from "../../tools/combo/compareSectorValuation.js";
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

  console.log(`\n=== compare_sector_valuation for ${ticker} ===`);
  const result = await compareSectorValuation(ticker);

  assertType(result.summary, "string", "summary is a string");
  assert(result.summary.length > 0, "summary is non-empty");
  assertInArray(
    result.verdict,
    ["Deeply Undervalued", "Undervalued", "Fairly Valued", "Overvalued", "Expensive", "Insufficient Data"],
    "verdict is valid"
  );
  assertType(result.score, "number", "score is a number");
  assert(result.score >= 0 && result.score <= 100, "score between 0 and 100");
  assertType(result.peerCount, "number", "peerCount is a number");
  assertType(result.rankInSector, "number", "rankInSector is a number");
  assertArray(result.table, "table is an array");
  assertType(result.metadata.generatedAt, "string", "metadata.generatedAt exists");

  console.log("\nSample output:");
  console.log(JSON.stringify({ summary: result.summary, verdict: result.verdict, score: result.score, rankInSector: result.rankInSector }, null, 2));

  printSummary();
}

function assertArray(value: unknown, label: string) {
  assert(Array.isArray(value), `${label} (expected array, got ${typeof value})`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
