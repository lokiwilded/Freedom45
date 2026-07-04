import { analyzeRelativeStrength } from "../../tools/long-analysis/analyzeRelativeStrength.js";
import { finnhubProvider } from "../../providers/finnhub.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  const benchmark = process.argv[3] || "SPY";
  const years = parseInt(process.argv[4] || "5", 10);
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Analyzing relative strength: ${ticker} vs ${benchmark} over ${years} years`);
  const result = await analyzeRelativeStrength(ticker, benchmark, years);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });