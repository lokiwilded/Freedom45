import { analyzeLongTermTrend } from "../../tools/long-analysis/analyzeLongTermTrend.js";
import { initProviders } from "../../providers/index.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  const years = Number(process.argv[3] || 3);
  initProviders();
  console.log(`Analyzing long-term trend for: ${ticker} (${years} years)`);
  try {
    const result = await analyzeLongTermTrend(ticker, years);
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.log("Expected error (Finnhub free tier limits candles endpoint):");
    console.log(err.message);
  }
}
main().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });
