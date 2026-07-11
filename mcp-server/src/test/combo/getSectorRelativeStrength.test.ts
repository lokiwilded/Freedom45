import { getSectorRelativeStrength } from "../../tools/combo/getSectorRelativeStrength.js";
import { initProviders } from "../../providers/index.js";
import {
  assert,
  assertType,
  assertInArray,
  printSummary,
} from "../shared/assertions.js";

async function main() {
  const ticker = process.argv[2] || "XLK";
  initProviders();

  console.log(`\n=== get_sector_relative_strength for ${ticker} ===`);
  const result = await getSectorRelativeStrength(ticker, "SP500", 3);

  assertType(result.summary, "string", "summary is a string");
  assert(result.summary.length > 0, "summary is non-empty");
  assertInArray(
    result.verdict,
    ["Leading", "Improving", "Stable", "Weakening", "Lagging", "No Data"],
    "verdict is valid"
  );
  assertType(result.score, "number", "score is a number");
  assert(result.score >= 0 && result.score <= 100, "score between 0 and 100");
  assert(result.alpha === null || typeof result.alpha === "number", "alpha is a number or null");
  assert(result.beta === null || typeof result.beta === "number", "beta is a number or null");
  assertArray(result.series, "series is an array");
  assert(result.series.length > 0, "series has data");
  assertType(result.metadata.generatedAt, "string", "metadata.generatedAt exists");

  console.log("\nSample output:");
  console.log(JSON.stringify({ summary: result.summary, verdict: result.verdict, score: result.score, alpha: result.alpha, beta: result.beta }, null, 2));

  printSummary();
}

function assertArray(value: unknown, label: string) {
  assert(Array.isArray(value), `${label} (expected array, got ${typeof value})`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
