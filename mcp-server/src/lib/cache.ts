/**
 * Cache helpers for SQL-backed TTL cache.
 * Uses the shared `api_cache` table in stocks.db.
 */

import { db } from "../db.js";

export function getCachedResponse(cacheKey: string): any | null {
  const row = db
    .prepare(
      "SELECT response FROM api_cache WHERE cache_key = ? AND expires_at > datetime('now')"
    )
    .get(cacheKey) as { response: string } | undefined;

  if (!row) return null;

  try {
    return JSON.parse(row.response);
  } catch {
    // Corrupted cache entry — treat as cache miss
    return null;
  }
}

export function setCachedResponse(cacheKey: string, response: any, ttlMinutes: number): void {
  db.prepare(
    "INSERT OR REPLACE INTO api_cache (cache_key, response, fetched_at, expires_at) VALUES (?, ?, datetime('now'), datetime('now', ?))"
  ).run(cacheKey, JSON.stringify(response), `+${ttlMinutes} minutes`);
}