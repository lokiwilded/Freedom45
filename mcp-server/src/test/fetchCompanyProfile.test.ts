import { fetchCompanyProfile } from "../tools/long-analysis/fetchCompanyProfile.js";
import { finnhubProvider } from "../providers/finnhub.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";

  // Initialize provider with API key from environment
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY is not set");
  }
  finnhubProvider.init(apiKey);

  console.log(`Fetching company profile for: ${ticker}`);
  const profile = await fetchCompanyProfile(ticker);

  console.log("\nResult:");
  console.log(JSON.stringify(profile, null, 2));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});