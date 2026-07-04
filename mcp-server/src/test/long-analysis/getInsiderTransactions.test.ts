import { getInsiderTransactions } from "../../tools/long-analysis/getInsiderTransactions.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assertEqual, assertType, assertArray, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching insider transactions for: ${ticker}`);
  const result = await getInsiderTransactions(ticker);

  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertArray(result.transactions, "transactions is an array");
  assertType(result.fromCache, "boolean", "fromCache is a boolean");
  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });