import { getEarningsSurprise } from "../../tools/long-analysis/getEarningsSurprise.js";
import { initProviders } from "../../providers/index.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  initProviders();
  console.log(`Fetching earnings surprise for: ${ticker}`);
  const result = await getEarningsSurprise(ticker);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });