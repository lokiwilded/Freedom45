/**
 * Bake the API responses to static JSON for the GitHub Pages build.
 *
 * Writes ui/public/data/*.json using the same route handlers the live server uses, so the
 * static site shows identical data. Re-run to refresh (needs FRED_API_KEY + network).
 *
 * Run:  node --env-file=../.env --import tsx src/scripts/dump-static.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routes } from "../api-handlers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../../ui/public/data");

const DEBT_COUNTRIES = ["US", "JP", "GB", "DE", "FR", "IT", "CA", "AU", "CN", "KR"];
const SECTORS = ["government", "households", "corporate"];

// Mirrors ASSET_DEFS in api-handlers.ts — keep in sync.
const ASSET_KEYS = [
  "US_MKTCAP", "SP500", "NASDAQ", "DOW", "FTSE", "DAX", "ESTOXX50", "CAC40",
  "NIKKEI", "HANGSENG", "SHANGHAI", "GOLD", "SILVER",
];

const ELASTICITY_PAIRS: { driver: string; asset: string }[] = [
  { driver: "global_liquidity", asset: "SP500" },
  { driver: "global_liquidity", asset: "US_MKTCAP" },
  { driver: "global_liquidity", asset: "GOLD" },
  { driver: "global_liquidity", asset: "NASDAQ" },
];

const call = (route: string, params: Record<string, string> = {}) =>
  routes[route]!(new URLSearchParams(params));

async function write(name: string, data: unknown) {
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data));
  console.log(`  ✓ ${name}.json`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log(`Dumping static data → ${OUT}`);

  await write("overview", await call("/api/overview"));
  await write("stats", await call("/api/stats"));
  await write("injections", await call("/api/injections"));
  await write("reflexivity", await call("/api/reflexivity"));

  await write("liquidity", await call("/api/liquidity"));

  for (const asset of ASSET_KEYS) {
    await write(`asset-${asset}`, await call("/api/assets", { asset }));
  }

  for (const { driver, asset } of ELASTICITY_PAIRS) {
    await write(`elasticity-${driver}-${asset}`, await call("/api/elasticity", { driver, asset }));
  }

  for (const country of DEBT_COUNTRIES) {
    for (const sector of SECTORS) {
      await write(`debt-${country}-${sector}`, await call("/api/debt", { country, sector }));
    }
  }

  await write("_manifest", {
    generatedAt: new Date().toISOString(),
    countries: DEBT_COUNTRIES,
    sectors: SECTORS,
    assets: ASSET_KEYS,
    elasticityPairs: ELASTICITY_PAIRS,
  });
  console.log("Done.");
}

main().catch((e) => { console.error("Dump failed:", e); process.exit(1); });
