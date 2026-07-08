/**
 * Debt by sector and country, from the BIS "credit to the non-financial sector" dataset
 * (mirrored on FRED), quarterly, % of GDP, current.
 *
 * Sectors: government (public debt) + private (households + non-financial corporates).
 * Private credit — mortgages, business loans, etc. — is the channel where borrowed money
 * (plus the interest servicing it) flows into assets, so it often matters as much as
 * government debt. `total` = government + private.
 *
 * Series pattern: Q{CC}{SECTOR}AM770A  (e.g. QUSGAM770A = US general government, % of GDP).
 */

import { z } from "zod";
import { syncFredSeries, summarize, type MacroPoint } from "./_shared.js";

const COUNTRIES: Record<string, string> = {
  US: "United States", JP: "Japan", GB: "United Kingdom", DE: "Germany",
  FR: "France", IT: "Italy", CA: "Canada", AU: "Australia",
  CN: "China", KR: "South Korea", IN: "India", BR: "Brazil", CH: "Switzerland",
};

const SECTORS: Record<string, { letter: string; label: string }> = {
  government: { letter: "G", label: "General government (public debt)" },
  households: { letter: "H", label: "Households & non-profits" },
  corporate: { letter: "N", label: "Non-financial corporations" },
  private: { letter: "P", label: "Private non-financial (households + corporates)" },
  total: { letter: "C", label: "Total non-financial (government + private)" },
};

export const GetDebtInput = z.object({
  country: z.string().default("US").describe(`ISO code. One of: ${Object.keys(COUNTRIES).join(", ")}`),
  sector: z.string().default("total").describe(`One of: ${Object.keys(SECTORS).join(", ")}`),
  from: z.string().optional().describe("Start date YYYY-MM-DD"),
  to: z.string().optional().describe("End date YYYY-MM-DD"),
});

async function syncSector(cc: string, sectorName: string, start: string, end: string) {
  const def = SECTORS[sectorName]!;
  try {
    return await syncFredSeries({
      country: cc,
      currency: "%GDP",
      indicator: `DEBT_${sectorName.toUpperCase()}`,
      seriesId: `Q${cc}${def.letter}AM770A`,
      unit: "% of GDP",
      from: start,
      to: end,
    });
  } catch {
    return null; // sector/country combo not published by BIS
  }
}

export async function getDebt(country = "US", sector = "total", from?: string, to?: string) {
  const cc = country.toUpperCase();
  if (!COUNTRIES[cc]) return { error: `Unknown country '${cc}'.`, supported: Object.keys(COUNTRIES) };
  const sec = sector.toLowerCase();
  if (!SECTORS[sec]) return { error: `Unknown sector '${sec}'.`, supported: Object.keys(SECTORS) };

  const start = from ?? "1960-01-01";
  const end = to ?? new Date().toISOString().split("T")[0]!;

  // Sync every sector (cache-friendly) so we can return the composition alongside the series.
  const latestBreakdown: Record<string, number | null> = {};
  let requested: { points: MacroPoint[]; fromCache: boolean } | null = null;

  for (const name of Object.keys(SECTORS)) {
    const r = await syncSector(cc, name, start, end);
    const latest = r ? [...r.points].reverse().find((p) => p.value !== null) : undefined;
    latestBreakdown[name] = latest?.value ?? null;
    if (name === sec) requested = r;
  }

  if (!requested) {
    return { country: cc, sector: sec, error: `BIS does not publish '${sec}' for ${cc}.` };
  }

  return {
    country: cc,
    countryName: COUNTRIES[cc],
    sector: sec,
    sectorLabel: SECTORS[sec]!.label,
    unit: "% of GDP",
    source: "BIS (via FRED)",
    from: start,
    to: end,
    count: requested.points.length,
    fromCache: requested.fromCache,
    ...summarize(requested.points),
    latestBreakdown, // government vs households vs corporate vs private vs total (latest)
    data: requested.points,
  };
}

export const getDebtTool = {
  name: "get_debt",
  description:
    "Debt by sector (government, households, corporate, private, total) and country, from BIS credit statistics (via FRED), % of GDP, quarterly. Returns the chosen sector's series plus the latest breakdown across all sectors. Countries: " +
    Object.keys(COUNTRIES).join(", ") + ".",
  inputSchema: {
    type: "object",
    properties: {
      country: { type: "string", description: "ISO code (US, JP, GB, DE, FR, IT, CA, AU, CN, KR, IN, BR, CH)", default: "US" },
      sector: { type: "string", description: "government | households | corporate | private | total", default: "total" },
      from: { type: "string", description: "Start date YYYY-MM-DD" },
      to: { type: "string", description: "End date YYYY-MM-DD" },
    },
  },
  handler: async (args: unknown) => {
    const { country, sector, from, to } = GetDebtInput.parse(args);
    return getDebt(country, sector, from, to);
  },
};
