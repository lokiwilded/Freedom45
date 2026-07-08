import { getMoneySupply } from "../../tools/macro/getMoneySupply.js";
import { getGovernmentDebt } from "../../tools/macro/getGovernmentDebt.js";
import { fredProvider } from "../../providers/fred.js";

async function main() {
  const country = (process.argv[2] || "US").toUpperCase();
  fredProvider.init(process.env.FRED_API_KEY!);

  console.log(`=== Money supply (M2) for ${country} ===`);
  const m2 = await getMoneySupply(country);
  console.log(
    JSON.stringify({ ...m2, data: (m2 as any).data?.slice(-3) }, null, 2)
  );

  console.log(`\n=== Government debt for ${country} ===`);
  const debt = await getGovernmentDebt(country);
  console.log(
    JSON.stringify({ ...debt, data: (debt as any).data?.slice(-3) }, null, 2)
  );
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
