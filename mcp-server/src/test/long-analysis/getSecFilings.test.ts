import { getSecFilings } from "../../tools/long-analysis/getSecFilings.js";
import { finnhubProvider } from "../../providers/finnhub.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  const from = process.argv[3] || "2026-01-01";
  const to = process.argv[4] || "2026-07-04";
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching SEC filings for: ${ticker} from ${from} to ${to}`);
  const result = await getSecFilings(ticker, from, to);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });