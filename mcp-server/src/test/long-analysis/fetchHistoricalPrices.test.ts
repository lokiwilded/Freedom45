import { fetchHistoricalPrices } from "../../tools/long-analysis/fetchHistoricalPrices.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assert, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  const years = Number(process.argv[3] || 1);
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching historical prices for: ${ticker} (${years} years)`);
  try {
    const result = await fetchHistoricalPrices(ticker, years);
    console.log(JSON.stringify({ ...result, data: result.data.slice(0, 3) }, null, 2));
    console.log(`... and ${result.data.length - 3} more rows`);
    assert(result.ticker === ticker, "ticker matches input");
    assert(result.years === years, "years matches input");
    assert(typeof result.fromCache === "boolean", "fromCache is a boolean");
    assert(Array.isArray(result.data), "data is an array");
    printSummary();
  } catch (err: any) {
    console.log("Expected error (Finnhub free tier limits candles endpoint):");
    console.log(err.message);
    assert(err.message.includes("403"), "error is 403 (free tier limit)");
    printSummary();
  }
}
main().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });