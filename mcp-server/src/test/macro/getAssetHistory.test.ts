import { getAssetHistory } from "../../tools/macro/getAssetHistory.js";
import { initProviders } from "../../providers/index.js";

async function main() {
  initProviders();
  const assets = process.argv[2] ? [process.argv[2].toUpperCase()] : ["SP500", "GOLD", "US_MKTCAP"];

  for (const a of assets) {
    console.log(`\n=== ${a} ===`);
    const r = await getAssetHistory(a);
    console.log(
      JSON.stringify({ ...r, data: (r as any).data?.slice(-3) }, null, 2)
    );
  }
}

main().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });
