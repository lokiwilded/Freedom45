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

  for (const country of DEBT_COUNTRIES) {
    for (const sector of SECTORS) {
      await write(`debt-${country}-${sector}`, await call("/api/debt", { country, sector }));
    }
  }

  await write("_manifest", { generatedAt: new Date().toISOString(), countries: DEBT_COUNTRIES, sectors: SECTORS });
  console.log("Done.");
}

main().catch((e) => { console.error("Dump failed:", e); process.exit(1); });
