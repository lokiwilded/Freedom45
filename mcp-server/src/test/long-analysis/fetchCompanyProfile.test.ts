import { fetchCompanyProfile } from "../../tools/long-analysis/fetchCompanyProfile.js";
import { initProviders } from "../../providers/index.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";

  initProviders();

  console.log(`Fetching company profile for: ${ticker}`);
  const profile = await fetchCompanyProfile(ticker);

  console.log("\nResult:");
  console.log(JSON.stringify(profile, null, 2));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
