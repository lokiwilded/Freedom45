import { getCongressTrades } from "../tools/get-congress-trades.js";
import { initProviders } from "../providers/index.js";

async function main() {
  const ticker = process.argv[2] || "AAPL";

  initProviders();

  console.log(`Fetching congress trades for: ${ticker}`);
  const result = await getCongressTrades({
    symbol: ticker,
    days_back: 90,
    limit: 10,
    include_live_price: true,
    outlier_score_min: 0, // show all so we can see the range
  });

  console.log("\nResult:");
  console.log(JSON.stringify(result, null, 2));

  // --- Summary -------------------------------------------------------------
  const trades = result.trades;
  const total = trades.length;

  const viable = trades.filter((t) => t.viability === "viable").length;
  const caution = trades.filter((t) => t.viability === "caution").length;
  const tooFar = trades.filter((t) => t.viability === "too_far").length;
  const unknown = trades.filter((t) => t.viability === "unknown").length;

  const avgScore =
    total > 0
      ? trades.reduce((sum, t) => sum + t.outlier_score, 0) / total
      : 0;

const highest = total > 0
  ? trades.reduce((best, t) => (t.outlier_score > best.outlier_score ? t : best), trades[0] as any)
  : null;

  console.log("\n--- Summary ---");
  console.log(`Total trades found:    ${total}`);
  console.log(`  viable:              ${viable}`);
  console.log(`  caution:             ${caution}`);
  console.log(`  too_far:             ${tooFar}`);
  console.log(`  unknown:             ${unknown}`);
  console.log(`Average outlier score: ${avgScore.toFixed(2)}`);
  if (highest) {
    console.log(`Highest outlier score: ${highest.outlier_score} (${highest.outlier_label})`);
    console.log(`  by ${highest.politician} on ${highest.ticker} — ${highest.type} ${highest.amount} (${highest.viability})`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});