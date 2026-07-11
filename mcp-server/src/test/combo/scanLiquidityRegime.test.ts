import { scanLiquidityRegime } from "../../tools/combo/scanLiquidityRegime.js";
import { initProviders } from "../../providers/index.js";
import {
  assert,
  assertType,
  assertInArray,
  printSummary,
} from "../shared/assertions.js";

async function main() {
  const asset = process.argv[2] || "SP500";
  initProviders();

  console.log(`\n=== scan_liquidity_regime for ${asset} ===`);
  const result = await scanLiquidityRegime(asset);

  assertType(result.summary, "string", "summary is a string");
  assert(result.summary.length > 0, "summary is non-empty");
  assertInArray(
    result.verdict,
    [
      "Expansion (Risk-On)",
      "Expansion (Caution)",
      "Neutral",
      "Contraction (Risk-Off)",
      "Contraction (Defensive)",
      "No Data",
    ],
    "verdict is valid"
  );
  assertType(result.score, "number", "score is a number");
  assert(result.score >= 0 && result.score <= 100, "score between 0 and 100");
  assertType(result.liquidityYoY, "number", "liquidityYoY is a number");
  assertArray(result.series, "series is an array");
  assert(result.series.length > 0, "series has data");
  assertType(result.metadata.generatedAt, "string", "metadata.generatedAt exists");

  console.log("\nSample output:");
  console.log(JSON.stringify({ summary: result.summary, verdict: result.verdict, score: result.score, liquidityYoY: result.liquidityYoY }, null, 2));

  printSummary();
}

function assertArray(value: unknown, label: string) {
  assert(Array.isArray(value), `${label} (expected array, got ${typeof value})`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
