import { searchStocks } from "../../tools/long-analysis/searchStocks.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assert, assertType, assertArray, printSummary } from "../shared/assertions.js";

async function main() {
  const query = process.argv[2] || "Apple";
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Searching stocks for: ${query}`);
  const result = await searchStocks(query);

  console.log(JSON.stringify(result, null, 2));

  assertType(result.query, "string", "query is a string");
  assertArray(result.matches, "matches is an array");
  assertType(result.fromCache, "boolean", "fromCache is a boolean");
  if (result.matches.length > 0) {
    assert(typeof result.matches[0]!.symbol === "string", "first match has symbol");
    assert(typeof result.matches[0]!.description === "string", "first match has description");
  }
  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });