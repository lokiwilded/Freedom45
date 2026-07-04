import { getEarningsCalendar } from "../../tools/long-analysis/getEarningsCalendar.js";
import { finnhubProvider } from "../../providers/finnhub.js";

async function main() {
  const from = process.argv[2] || "2026-07-01";
  const to = process.argv[3] || "2026-07-31";
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching earnings calendar from ${from} to ${to}`);
  const result = await getEarningsCalendar(from, to);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });