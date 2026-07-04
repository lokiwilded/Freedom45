import { fetchStockQuote } from "../../tools/long-analysis/fetchStockQuote.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assertEqual, assertType, assertNotNull, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching stock quote for: ${ticker}`);
  const result = await fetchStockQuote(ticker);

  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertType(result.price, "number", "price is a number");
  assertType(result.change, "number", "change is a number");
  assertType(result.changePercent, "number", "changePercent is a number");
  assertType(result.fromCache, "boolean", "fromCache is a boolean");
  assertNotNull(result.timestamp, "timestamp is present");
  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });