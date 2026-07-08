import { getGlobalLiquidity } from "../../tools/macro/getGlobalLiquidity.js";
import { fredProvider } from "../../providers/fred.js";

async function main() {
  fredProvider.init(process.env.FRED_API_KEY!);
  console.log("=== Global liquidity (Fed + ECB + BOJ, USD) ===");
  const r = await getGlobalLiquidity();
  const sample = (r as any).data?.slice(-3).map((x: any) => ({
    date: x.date,
    total_trillions: Number(x.total_trillions.toFixed(2)),
    fed_T: Number((x.components.US / 1e12).toFixed(2)),
    ecb_T: Number((x.components.EA / 1e12).toFixed(2)),
    boj_T: Number((x.components.JP / 1e12).toFixed(2)),
  }));
  console.log(JSON.stringify({ ...r, data: sample }, null, 2));
}

main().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });
