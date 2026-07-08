import { getDebt } from "../../tools/macro/getDebt.js";
import { fredProvider } from "../../providers/fred.js";

async function main() {
  fredProvider.init(process.env.FRED_API_KEY!);
  const countries = process.argv[2] ? [process.argv[2].toUpperCase()] : ["US", "JP", "CN"];

  for (const c of countries) {
    const r = await getDebt(c, "total");
    const o = r as any;
    if (o.error) { console.log(`${c}: ${o.error}`); continue; }
    console.log(`\n=== ${o.countryName} (${c}) — debt % of GDP ===`);
    console.log("latest total:", o.latest, "| n:", o.count, "| from", o.first?.date);
    console.log("latest breakdown:", JSON.stringify(o.latestBreakdown));
  }
}

main().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });
