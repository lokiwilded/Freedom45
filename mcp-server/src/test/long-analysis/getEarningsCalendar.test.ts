import { getEarningsCalendar } from "../../tools/long-analysis/getEarningsCalendar.js";
import { initProviders } from "../../providers/index.js";

async function main() {
  const from = process.argv[2] || "2026-07-01";
  const to = process.argv[3] || "2026-07-31";
  initProviders();
  console.log(`Fetching earnings calendar from ${from} to ${to}`);
  const result = await getEarningsCalendar(from, to);
  console.log(JSON.stringify(result, null, 2));
}
main().catch((err) => { console.error("Error:", err); process.exit(1); });