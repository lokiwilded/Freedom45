import { getLiquidityElasticity } from "../../tools/macro/getLiquidityElasticity.js";
import { initProviders } from "../../providers/index.js";

async function main() {
  initProviders();

  const combos: [string, string][] = process.argv[2] && process.argv[3]
    ? [[process.argv[2], process.argv[3]]]
    : [
        ["global_liquidity", "SP500"],
        ["global_liquidity", "US_MKTCAP"],
        ["global_liquidity", "GOLD"],
        ["us_m2", "SP500"],
      ];

  for (const [driver, asset] of combos) {
    const r = await getLiquidityElasticity(driver, asset);
    console.log(`\n=== ${driver} -> ${asset} ===`);
    if ((r as any).error) { console.log((r as any).error); continue; }
    const o = r as any;
    console.log("LEVELS view:", JSON.stringify(o.levels));
    console.log("YoY regression:", JSON.stringify(o.regression), "lag=", o.lagMonths);
    console.log("interpretation:", o.interpretation);
  }
}

main().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });
