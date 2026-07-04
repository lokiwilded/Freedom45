/**
 * Shared SQLite connection for Freedom45 MCP server.
 * Uses Node 22+ built-in `node:sqlite` — no external dependencies.
 * Single `stocks.db` file with all tables merged from both branches.
 */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "..", "data");
const dbPath = path.join(DATA_DIR, "stocks.db");

// Ensure data directory exists
import fs from "node:fs";
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Enable WAL mode for better concurrent read performance
db.exec("PRAGMA journal_mode = WAL");
// Enable foreign keys
db.exec("PRAGMA foreign_keys = ON");

// Run all schema migrations
db.exec(`
  -- Company profiles (from Matt — coverage-based cache)
  CREATE TABLE IF NOT EXISTS companies (
    ticker TEXT PRIMARY KEY,
    name TEXT,
    sector TEXT,
    industry TEXT,
    exchange TEXT,
    currency TEXT,
    country TEXT,
    website TEXT,
    market_cap REAL,
    fetched_at TEXT
  );

  -- Historical prices (from Matt — append-only)
  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT,
    date TEXT,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    adjusted_close REAL,
    volume INTEGER,
    source TEXT,
    UNIQUE(ticker, date, source)
  );

  -- Fundamental metrics (from Matt — time-series cache)
  CREATE TABLE IF NOT EXISTS fundamentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker TEXT NOT NULL,
    metric TEXT NOT NULL,
    value REAL,
    period TEXT,
    source TEXT DEFAULT 'finnhub',
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(ticker, metric, period, source)
  );

  -- Congressional trades (from Loki)
  CREATE TABLE IF NOT EXISTS congress_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    politician_name TEXT,
    chamber TEXT,
    party TEXT,
    state TEXT,
    ticker TEXT,
    asset_description TEXT,
    transaction_type TEXT,
    amount_range TEXT,
    transaction_date TEXT,
    disclosure_date TEXT,
    outlier_score REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_congress_ticker ON congress_trades(ticker);
  CREATE INDEX IF NOT EXISTS idx_congress_date ON congress_trades(transaction_date);
  CREATE INDEX IF NOT EXISTS idx_congress_outlier ON congress_trades(outlier_score);

  -- Insider transactions (from Loki — for future tools)
  CREATE TABLE IF NOT EXISTS insider_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT,
    company_name TEXT,
    insider_name TEXT,
    position TEXT,
    transaction_type TEXT,
    shares INTEGER,
    price REAL,
    value REAL,
    ownership_after REAL,
    transaction_date TEXT,
    filing_date TEXT,
    market_cap REAL,
    outlier_score REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_insider_symbol ON insider_transactions(symbol);
  CREATE INDEX IF NOT EXISTS idx_insider_date ON insider_transactions(transaction_date);
  CREATE INDEX IF NOT EXISTS idx_insider_outlier ON insider_transactions(outlier_score);
  CREATE INDEX IF NOT EXISTS idx_insider_marketcap ON insider_transactions(market_cap);

  -- Generic API response cache (from both — TTL-based)
  CREATE TABLE IF NOT EXISTS api_cache (
    cache_key TEXT PRIMARY KEY,
    response TEXT,
    fetched_at TEXT,
    expires_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_cache_expires ON api_cache(expires_at);
`);

export { db };