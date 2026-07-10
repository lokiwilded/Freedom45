import { getInstitutionalOwnership } from "../../tools/long-analysis/getInstitutionalOwnership.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assertEqual, assertType, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Fetching institutional ownership for: ${ticker}`);
  const result = await getInstitutionalOwnership(ticker);
  console.log(JSON.stringify(result, null, 2));

  assertEqual(result.ticker, ticker, "ticker matches input");
  assertType(result.fromCache, "boolean", "fromCache is boolean");
  if (result.owners.length > 0) {
    assertType(result.owners[0]!.investor, "string", "first owner investor is string");
    assertType(result.owners[0]!.shares, "number", "first owner shares is number");
  } else {
    console.log("  ⚠️ No institutional ownership data returned (common on Finnhub free tier)");
  }
  printSummary();
}
main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("403") || message.includes("don't have access") || message.includes("expected JSON")) {
    console.log("  ⚠️ Finnhub free tier blocks institutional ownership endpoint — skipping as expected");
    printSummary();
    return;
  }
  console.error("Error:", err);
  process.exit(1);
});