import { getEarningsSurprise } from "../../tools/long-analysis/getEarningsSurprise.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assertEqual, assertType, assertArray, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching earnings surprise for: ${ticker}`);
  const result = await getEarningsSurprise(ticker);

  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertArray(result.surprises, "surprises is an array");
  assertType(result.fromCache, "boolean", "fromCache is a boolean");
  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });