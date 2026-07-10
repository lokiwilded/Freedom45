import { getDividends } from "../../tools/long-analysis/getDividends.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assertEqual, assertType, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  const from = process.argv[3] || "2020-01-01";
  const to = process.argv[4] || "2026-07-04";
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching dividends for: ${ticker} from ${from} to ${to}`);
  const result = await getDividends(ticker, from, to);
  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertType(result.fromCache, "boolean", "fromCache is boolean");
  if (result.dividends.length > 0) {
    assertType(result.dividends[0]!.date, "string", "first dividend date is string");
    assertType(result.dividends[0]!.dividend, "number", "first dividend amount is number");
  } else {
    console.log("  ⚠️ No dividend data returned (common on Finnhub free tier)");
  }
  printSummary();
}
main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("403") || message.includes("don't have access")) {
    console.log("  ⚠️ Finnhub free tier blocks dividend endpoint — skipping as expected");
    printSummary();
    return;
  }
  console.error("Error:", err);
  process.exit(1);
});