/**
 * Shared helpers for macro tools.
 * Fetches a FRED series into the persistent `macro_series` table, then reads a window back.
 */

import { fredProvider } from "../../providers/fred.js";
import { db } from "../../db.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export interface MacroPoint {
  date: string;
  value: number | null;
}

export interface SyncResult {
  points: MacroPoint[];
  fromCache: boolean;
  fetched: number;
}

// A series is re-fetched from source at most once per this window; between refreshes it is
// served from SQLite. This lets the dashboard pick up newly published data (and upstream
// revisions) without hitting the source on every request.
const SYNC_TTL_MINUTES = 12 * 60;

/** True if this series was fetched recently enough to skip the source. */
function isFresh(cacheKey: string): boolean {
  return getCachedResponse(cacheKey) !== null;
}
function markFresh(cacheKey: string): void {
  setCachedResponse(cacheKey, { at: new Date().toISOString() }, SYNC_TTL_MINUTES);
}

/**
 * Ensure a FRED series is persisted, then return the requested [from, to] window.
 *
 * On first request for a (country, indicator, source) we fetch the FULL series history
 * (FRED returns everything when start/end are omitted) and store it. This avoids the
 * partial-window gap that a date-bounded fetch-on-miss would create when a later request
 * asks for an earlier start date.
 */
export async function syncFredSeries(args: {
  country: string;
  currency: string;
  indicator: string; // 'M2' | 'DEBT' | 'CB_ASSETS' | 'FX_USD'
  seriesId: string;
  unit: string;
  from: string;
  to: string;
  source?: string;
  frequency?: string; // FRED aggregation, e.g. 'm' to force monthly
}): Promise<SyncResult> {
  const source = args.source ?? "fred";
  const cacheKey = `sync:${source}:${args.country}:${args.indicator}`;
  const fresh = isFresh(cacheKey);

  let fromCache = fresh;
  let fetched = 0;

  if (!fresh) {
    // Full history; optionally aggregated to a coarser frequency (e.g. monthly).
    const obs = await fredProvider.getSeriesObservations(
      args.seriesId,
      args.frequency ? { frequency: args.frequency } : {}
    );

    const insert = db.prepare(
      `INSERT OR REPLACE INTO macro_series (country, currency, indicator, date, value, value_usd, unit, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const o of obs) {
      if (o.value === null) continue;
      // USD series: value_usd == value. FX conversion for foreign currencies lands in Phase 2.
      const valueUsd = args.currency === "USD" ? o.value : null;
      insert.run(
        args.country,
        args.currency,
        args.indicator,
        o.date,
        o.value,
        valueUsd,
        args.unit,
        source
      );
      fetched++;
    }
    markFresh(cacheKey);
  }

  const points = db
    .prepare(
      "SELECT date, value FROM macro_series WHERE country = ? AND indicator = ? AND source = ? AND date >= ? AND date <= ? ORDER BY date"
    )
    .all(args.country, args.indicator, source, args.from, args.to) as unknown as MacroPoint[];

  return { points, fromCache, fetched };
}

/**
 * Ensure an asset series is persisted to `asset_series`, then return the [from, to] window.
 * `fetchAll` returns the FULL available history; it is called at most once per refresh window.
 */
export async function syncAssetSeries(args: {
  asset: string;
  metric: string; // 'level' | 'market_cap'
  currency: string;
  source: string; // 'yahoo' | 'fred'
  from: string;
  to: string;
  fetchAll: () => Promise<{ date: string; value: number | null }[]>;
}): Promise<SyncResult> {
  const cacheKey = `sync:asset:${args.source}:${args.asset}:${args.metric}`;
  const fresh = isFresh(cacheKey);

  let fromCache = fresh;
  let fetched = 0;

  if (!fresh) {
    const rows = await args.fetchAll();
    const insert = db.prepare(
      `INSERT OR REPLACE INTO asset_series (asset, metric, date, value, currency, source)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const r of rows) {
      if (r.value === null) continue;
      insert.run(args.asset, args.metric, r.date, r.value, args.currency, args.source);
      fetched++;
    }
    markFresh(cacheKey);
  }

  const points = db
    .prepare(
      "SELECT date, value FROM asset_series WHERE asset = ? AND metric = ? AND source = ? AND date >= ? AND date <= ? ORDER BY date"
    )
    .all(args.asset, args.metric, args.source, args.from, args.to) as unknown as MacroPoint[];

  return { points, fromCache, fetched };
}

/**
 * Source-agnostic macro sync: persist a full series to `macro_series` via a fetch callback,
 * then return the [from, to] window. Used for non-FRED sources (e.g. DBnomics).
 */
export async function syncSeriesGeneric(args: {
  country: string;
  currency: string;
  indicator: string;
  unit: string;
  source: string;
  from: string;
  to: string;
  fetchAll: () => Promise<{ date: string; value: number | null }[]>;
}): Promise<SyncResult> {
  const cacheKey = `sync:${args.source}:${args.country}:${args.indicator}`;
  const fresh = isFresh(cacheKey);

  let fromCache = fresh;
  let fetched = 0;

  if (!fresh) {
    const rows = await args.fetchAll();
    const insert = db.prepare(
      `INSERT OR REPLACE INTO macro_series (country, currency, indicator, date, value, value_usd, unit, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of rows) {
      if (r.value === null) continue;
      const valueUsd = args.currency === "USD" ? r.value : null;
      insert.run(args.country, args.currency, args.indicator, r.date, r.value, valueUsd, args.unit, args.source);
      fetched++;
    }
    markFresh(cacheKey);
  }

  const points = db
    .prepare(
      "SELECT date, value FROM macro_series WHERE country = ? AND indicator = ? AND source = ? AND date >= ? AND date <= ? ORDER BY date"
    )
    .all(args.country, args.indicator, args.source, args.from, args.to) as unknown as MacroPoint[];

  return { points, fromCache, fetched };
}

/** Read a persisted series from the DB as a date -> value map. */
export function seriesMap(
  country: string,
  indicator: string,
  from: string,
  to: string,
  source = "fred"
): Map<string, number> {
  const rows = db
    .prepare(
      "SELECT date, value FROM macro_series WHERE country = ? AND indicator = ? AND source = ? AND date >= ? AND date <= ? AND value IS NOT NULL ORDER BY date"
    )
    .all(country, indicator, source, from, to) as unknown as { date: string; value: number }[];
  return new Map(rows.map((r) => [r.date, r.value]));
}

/** Summary stats for a windowed series (first/last + change). */
export function summarize(points: MacroPoint[]) {
  const clean = points.filter((p) => p.value !== null) as { date: string; value: number }[];
  const first = clean[0] ?? null;
  const latest = clean[clean.length - 1] ?? null;
  const changeAbs = first && latest ? latest.value - first.value : null;
  const changePct =
    first && latest && first.value !== 0 ? ((latest.value - first.value) / first.value) * 100 : null;
  return { first, latest, changeAbs, changePct };
}
