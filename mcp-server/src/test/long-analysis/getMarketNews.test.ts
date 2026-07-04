import { getMarketNews } from "../../tools/long-analysis/getMarketNews.js";
import { finnhubProvider } from "../../providers/finnhub.js";

async function main() {
  const category = process.argv[2] || "general";
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching market news: ${category}`);
  const result = await getMarketNews(category);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });