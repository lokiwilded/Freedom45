import { getSecFilings } from "../../tools/long-analysis/getSecFilings.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assertEqual, assertType, assertArray, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  const from = process.argv[3] || "2026-01-01";
  const to = process.argv[4] || "2026-07-04";
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching SEC filings for: ${ticker} from ${from} to ${to}`);
  const result = await getSecFilings(ticker, from, to);

  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertArray(result.filings, "filings is an array");
  assertType(result.fromCache, "boolean", "fromCache is a boolean");
  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });