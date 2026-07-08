import { getSplits } from "../../tools/long-analysis/getSplits.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assert, assertEqual, assertArray, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  const from = process.argv[3] || "2000-01-01";
  const to = process.argv[4] || "2026-07-04";
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching splits for: ${ticker} from ${from} to ${to}`);
  try {
    const result = await getSplits(ticker, from, to);
    console.log(JSON.stringify(result, null, 2));
    assertEqual(result.ticker, ticker, "ticker matches input");
    assertArray(result.splits, "splits is an array");
    assert(typeof result.fromCache === "boolean", "fromCache is a boolean");
    printSummary();
  } catch (err: any) {
    console.log("Error:", err.message);
    assert(err.message.includes("403"), "error is 403 (free tier limit)");
    printSummary();
  }
}

main().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });