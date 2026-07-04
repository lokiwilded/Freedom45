import { getFundOwnership } from "../../tools/long-analysis/getFundOwnership.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assert, assertEqual, assertArray, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching fund ownership for: ${ticker}`);
  try {
    const result = await getFundOwnership(ticker);
    console.log(JSON.stringify(result, null, 2));
    assertEqual(result.ticker, ticker, "ticker matches input");
    assertArray(result.owners, "owners is an array");
    assert(typeof result.fromCache === "boolean", "fromCache is a boolean");
    printSummary();
  } catch (err: any) {
    console.log("Error:", err.message);
    assert(err.message.includes("403"), "error is 403 (free tier limit)");
    printSummary();
  }
}

main().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });