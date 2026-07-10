import { fetchStockQuote } from "../../tools/long-analysis/fetchStockQuote.js";
import { finnhubProvider } from "../../providers/finnhub.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching stock quote for: ${ticker}`);
  const result = await fetchStockQuote(ticker);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });
