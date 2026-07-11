import { fetchHistoricalPrices } from "../../tools/long-analysis/fetchHistoricalPrices.js";
import { initProviders } from "../../providers/index.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  const years = Number(process.argv[3] || 1);
  initProviders();
  console.log(`Fetching historical prices for: ${ticker} (${years} years)`);
  try {
    const result = await fetchHistoricalPrices(ticker, years);
    console.log(JSON.stringify({ ...result, data: result.data.slice(0, 3) }, null, 2));
    console.log(`... and ${result.data.length - 3} more rows`);
  } catch (err: any) {
    console.log("Expected error (Finnhub free tier limits candles endpoint):");
    console.log(err.message);
  }
}
main().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });
