import { getRecommendationTrends } from "../../tools/long-analysis/getRecommendationTrends.js";
import { finnhubProvider } from "../../providers/finnhub.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching recommendation trends for: ${ticker}`);
  const result = await getRecommendationTrends(ticker);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });