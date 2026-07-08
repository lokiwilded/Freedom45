import { getMarketNews } from "../../tools/long-analysis/getMarketNews.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assertType, assertArray, printSummary } from "../shared/assertions.js";

async function main() {
  const category = process.argv[2] || "general";
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching market news: ${category}`);
  const result = await getMarketNews(category);

  console.log(JSON.stringify(result, null, 2));

  assertType(result.category, "string", "category is a string");
  assertArray(result.news, "news is an array");
  assertType(result.fromCache, "boolean", "fromCache is a boolean");
  printSummary();
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });