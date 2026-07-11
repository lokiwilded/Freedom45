import { findSmartMoneyConvergence } from "../../tools/combo/findSmartMoneyConvergence.js";
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

  console.log(`\n=== find_smart_money_convergence for ${ticker} ===`);
  const result = await findSmartMoneyConvergence(ticker, 90);

  assertType(result.summary, "string", "summary is a string");
  assert(result.summary.length > 0, "summary is non-empty");
  assertInArray(
    result.verdict,
    ["Very High Convergence", "High Convergence", "Moderate Convergence", "Mixed Signals", "No Convergence", "No Data"],
    "verdict is valid"
  );
  assertType(result.score, "number", "score is a number");
  assert(result.score >= 0 && result.score <= 100, "score between 0 and 100");
  assertType(result.overlapCount, "number", "overlapCount is a number");
  assertType(result.signals.insider, "string", "insider signal exists");
  assertType(result.signals.institutions, "string", "institutions signal exists");
  assertType(result.signals.funds, "string", "funds signal exists");
  assertType(result.signals.congress, "string", "congress signal exists");
  assertArray(result.table, "table is an array");
  assertType(result.metadata.generatedAt, "string", "metadata.generatedAt exists");

  console.log("\nSample output:");
  console.log(JSON.stringify({ summary: result.summary, verdict: result.verdict, score: result.score, signals: result.signals }, null, 2));

  printSummary();
}

function assertArray(value: unknown, label: string) {
  assert(Array.isArray(value), `${label} (expected array, got ${typeof value})`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
