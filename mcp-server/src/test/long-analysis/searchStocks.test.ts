import { searchStocks } from "../../tools/long-analysis/searchStocks.js";
import { finnhubProvider } from "../../providers/finnhub.js";

async function main() {
  const query = process.argv[2] || "Apple";
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Searching stocks for: ${query}`);
  const result = await searchStocks(query);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });