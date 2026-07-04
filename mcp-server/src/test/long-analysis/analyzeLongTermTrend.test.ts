import { analyzeLongTermTrend } from "../../tools/long-analysis/analyzeLongTermTrend.js";
import { finnhubProvider } from "../../providers/finnhub.js";
import { assert, printSummary } from "../shared/assertions.js";

async function main() {
  const ticker = (process.argv[2] || "AAPL").toUpperCase();
  const years = Number(process.argv[3] || 3);
  finnhubProvider.init(process.env.FINNHUB_API_KEY!);
  console.log(`Analyzing long-term trend for: ${ticker} (${years} years)`);
  try {
    const result = await analyzeLongTermTrend(ticker, years);
    console.log(JSON.stringify(result, null, 2));
    assert(result.ticker === ticker, "ticker matches input");
    assert(typeof result.cagr === "number", "cagr is a number");
    printSummary();
  } catch (err: any) {
    console.log("Expected error (Finnhub free tier limits candles endpoint):");
    console.log(err.message);
    assert(err.message.includes("403"), "error is 403 (free tier limit)");
    printSummary();
  }
}
main().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });