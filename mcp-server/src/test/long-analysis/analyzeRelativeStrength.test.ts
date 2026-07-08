import { analyzeRelativeStrength } from "../../tools/long-analysis/analyzeRelativeStrength.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assert, assertEqual, assertInArray, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  const benchmark = (process.argv[3] || "SPY").toUpperCase();
  const years = parseInt(process.argv[4] || "5", 10);
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Analyzing relative strength: ${ticker} vs ${benchmark} over ${years} years`);
  const result = await analyzeRelativeStrength(ticker, benchmark, years);

  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertEqual(result.benchmark, benchmark, "benchmark matches input");
  assertEqual(result.years, years, "years matches input");
  assertInArray(
    result.verdict,
    ["Strong", "Favorable", "Neutral", "Unfavorable", "Weak", "No data"],
    "verdict is valid"
  );
  if (result.score !== null) {
    assert(typeof result.score === "number", "score is a number when not null");
    assert(result.alpha !== null, "alpha is present when score is present");
    assert(result.beta !== null, "beta is present when score is present");
  } else {
    assert(result.note !== undefined, "note explains why score is null");
  }
  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });