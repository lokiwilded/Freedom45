/**
 * Global liquidity = combined major central-bank balance sheets, converted to USD.
 *
 * v1 basket (all current, all from FRED):
 *   - Federal Reserve  (WALCL,      millions USD)
 *   - ECB              (ECBASSETSW, millions EUR)
 *   - Bank of Japan    (JPNASSETS,  100-million yen)
 *
 * This is the QE / "money printing" measure of global liquidity. Each bank's balance
 * sheet is normalized to whole currency units, converted to USD via FRED FX (monthly),
 * and summed on a shared monthly grid. Foreign M2 / broad money (incl. China, UK) is a
 * later phase via DBnomics. See plans/liquidity-macro-dashboard-plan.md.
 */

import { z } from "zod";
import { syncFredSeries, seriesMap } from "./_shared.js";

interface BankDef {
  country: string; // macro_series key
  label: string;
  currency: string;
  seriesId: string;
  unit: string;
  nativeToUnits: number; // native series value * this = whole currency units
}

const BANKS: BankDef[] = [
  { country: "US", label: "Federal Reserve", currency: "USD", seriesId: "WALCL", unit: "Millions of USD", nativeToUnits: 1e6 },
  { country: "EA", label: "ECB", currency: "EUR", seriesId: "ECBASSETSW", unit: "Millions of EUR", nativeToUnits: 1e6 },
  { country: "JP", label: "Bank of Japan", currency: "JPY", seriesId: "JPNASSETS", unit: "100 Million Yen", nativeToUnits: 1e8 },
];

interface FxDef {
  currency: string;
  seriesId: string;
  inverted: boolean; // usdPerUnit = inverted ? 1/rate : rate
}

// USD value of 1 unit of the currency. DEXUSEU is already USD-per-EUR; DEXJPUS is JPY-per-USD (invert).
const FX: Record<string, FxDef> = {
  EUR: { currency: "EUR", seriesId: "DEXUSEU", inverted: false },
  JPY: { currency: "JPY", seriesId: "DEXJPUS", inverted: true },
};

export const GetGlobalLiquidityInput = z.object({
  from: z.string().optional().describe("Start date YYYY-MM-DD (default 2003-01-01, where all 3 banks overlap)"),
  to: z.string().optional().describe("End date YYYY-MM-DD (default today)"),
});

export async function getGlobalLiquidity(from?: string, to?: string) {
  const start = from ?? "2003-01-01";
  const end = to ?? new Date().toISOString().split("T")[0]!;

  // 1. Ensure every component is synced to a monthly grid.
  const syncMeta: Record<string, { fromCache: boolean }> = {};
  for (const b of BANKS) {
    const r = await syncFredSeries({
      country: b.country,
      currency: b.currency,
      indicator: "CB_ASSETS",
      seriesId: b.seriesId,
      unit: b.unit,
      from: start,
      to: end,
      frequency: "m",
    });
    syncMeta[b.seriesId] = { fromCache: r.fromCache };
  }
  for (const fx of Object.values(FX)) {
    const r = await syncFredSeries({
      country: fx.currency,
      currency: fx.currency,
      indicator: "FX_USD",
      seriesId: fx.seriesId,
      unit: `FX rate (${fx.seriesId})`,
      from: start,
      to: end,
      frequency: "m",
    });
    syncMeta[fx.seriesId] = { fromCache: r.fromCache };
  }

  // 2. Load each component as a date -> value map.
  const bankMaps = BANKS.map((b) => ({ def: b, map: seriesMap(b.country, "CB_ASSETS", start, end) }));
  const fxMaps: Record<string, Map<string, number>> = {};
  for (const [cur, fx] of Object.entries(FX)) {
    fxMaps[cur] = seriesMap(fx.currency, "FX_USD", start, end);
  }

  // 3. Build the shared monthly grid: months where ALL banks (and needed FX) have data.
  const usdPerUnit = (cur: string, date: string): number | null => {
    if (cur === "USD") return 1;
    const fx = FX[cur];
    const rate = fx ? fxMaps[cur]?.get(date) : undefined;
    if (rate === undefined || rate === null || rate === 0) return null;
    return fx!.inverted ? 1 / rate : rate;
  };

  const allDates = new Set<string>();
  for (const { map } of bankMaps) for (const d of map.keys()) allDates.add(d);

  const rows: {
    date: string;
    total_usd: number;
    total_trillions: number;
    components: Record<string, number>;
  }[] = [];

  for (const date of [...allDates].sort()) {
    const components: Record<string, number> = {};
    let ok = true;
    let total = 0;
    for (const { def, map } of bankMaps) {
      const native = map.get(date);
      const fx = usdPerUnit(def.currency, date);
      if (native === undefined || fx === null) { ok = false; break; }
      const usd = native * def.nativeToUnits * fx;
      components[def.country] = usd;
      total += usd;
    }
    if (!ok) continue;
    rows.push({
      date,
      total_usd: total,
      total_trillions: total / 1e12,
      components,
    });
  }

  const first = rows[0] ?? null;
  const latest = rows[rows.length - 1] ?? null;

  return {
    metric: "central_bank_liquidity",
    description: "Fed + ECB + BOJ balance sheets, converted to USD (QE / money-printing measure).",
    banks: BANKS.map((b) => ({ country: b.country, label: b.label, currency: b.currency, seriesId: b.seriesId })),
    from: start,
    to: end,
    count: rows.length,
    fromCache: Object.values(syncMeta).every((m) => m.fromCache),
    first: first && { date: first.date, total_trillions: first.total_trillions },
    latest: latest && { date: latest.date, total_trillions: latest.total_trillions },
    changePct: first && latest && first.total_usd ? ((latest.total_usd - first.total_usd) / first.total_usd) * 100 : null,
    data: rows,
  };
}

export const getGlobalLiquidityTool = {
  name: "get_global_liquidity",
  description:
    "Global liquidity: Fed + ECB + BOJ central-bank balance sheets summed in USD (monthly). The QE / money-printing measure. Sourced from FRED, persisted to SQLite.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Start date YYYY-MM-DD (default 2003-01-01)" },
      to: { type: "string", description: "End date YYYY-MM-DD" },
    },
  },
  handler: async (args: unknown) => {
    const { from, to } = GetGlobalLiquidityInput.parse(args);
    return getGlobalLiquidity(from, to);
  },
};
