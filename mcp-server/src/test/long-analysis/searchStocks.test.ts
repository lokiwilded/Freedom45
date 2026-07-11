import { searchStocks } from "../../tools/long-analysis/searchStocks.js";
import { initProviders } from "../../providers/index.js";

async function main() {
  const query = process.argv[2] || "Apple";
  initProviders();
  console.log(`Searching stocks for: ${query}`);
  const result = await searchStocks(query);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });