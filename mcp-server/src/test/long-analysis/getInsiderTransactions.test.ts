import { getInsiderTransactions } from "../../tools/long-analysis/getInsiderTransactions.js";
import { initProviders } from "../../providers/index.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  initProviders();
  console.log(`Fetching insider transactions for: ${ticker}`);
  const result = await getInsiderTransactions(ticker);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });