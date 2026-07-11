import { fetchPeers } from "../../tools/long-analysis/fetchPeers.js";
import { initProviders } from "../../providers/index.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  initProviders();
  console.log(`Fetching peers for: ${ticker}`);
  const result = await fetchPeers(ticker);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });
