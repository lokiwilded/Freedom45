import { fetchFundamentalMetrics } from "../../tools/long-analysis/fetchFundamentalMetrics.js";
import { initProviders } from "../../providers/index.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  initProviders();
  console.log(`Fetching fundamental metrics for: ${ticker}`);
  const result = await fetchFundamentalMetrics(ticker);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });
