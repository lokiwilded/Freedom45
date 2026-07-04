import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Central DB manager for Freedom45.
 * Creates and manages separate .db files per data source.
 * Supports cross-database queries via SQLite ATTACH.
 */

const DATA_DIR = path.resolve(import.meta.dirname, '../../data');

export interface DbInstance {
  db: Database.Database;
  name: string;
  filePath: string;
}

class DbManager {
  private instances: Map<string, DbInstance> = new Map();
  private initialized = false;

  /**
   * Initialize all databases. Creates data/ directory and .db files if missing.
   * Call once at server startup.
   */
  init(): void {
    if (this.initialized) return;

    // Create data directory if it doesn't exist
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Initialize each database
    this.createDb('stocks', `
      CREATE TABLE IF NOT EXISTS stock_quotes (
        symbol TEXT PRIMARY KEY,
        price REAL,
        change REAL,
        change_percent REAL,
        volume INTEGER,
        high_52w REAL,
        low_52w REAL,
        market_cap REAL,
        pe_ratio REAL,
        dividend_yield REAL,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS historical_prices (
        symbol TEXT,
        date TEXT,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        volume INTEGER,
        PRIMARY KEY (symbol, date)
      );

      CREATE TABLE IF NOT EXISTS company_profiles (
        symbol TEXT PRIMARY KEY,
        name TEXT,
        sector TEXT,
        industry TEXT,
        description TEXT,
        exchange TEXT,
        employees INTEGER,
        updated_at TEXT
      );
    `);

    this.createDb('congress', `
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
    `);

    this.createDb('insider', `
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
    `);

    this.createDb('fred', `
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        series_id TEXT,
        date TEXT,
        value REAL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(series_id, date)
      );

      CREATE INDEX IF NOT EXISTS idx_fred_series ON observations(series_id);
      CREATE INDEX IF NOT EXISTS idx_fred_date ON observations(date);

      CREATE TABLE IF NOT EXISTS series_meta (
        series_id TEXT PRIMARY KEY,
        title TEXT,
        units TEXT,
        frequency TEXT,
        notes TEXT,
        updated_at TEXT
      );
    `);

    this.createDb('sec', `
      CREATE TABLE IF NOT EXISTS famous_holdings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        investor_name TEXT,
        cik TEXT,
        filing_date TEXT,
        ticker TEXT,
        company_name TEXT,
        value REAL,
        shares REAL,
        percent_of_portfolio REAL,
        is_new_position INTEGER DEFAULT 0,
        change_from_last_q REAL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_sec_ticker ON famous_holdings(ticker);
      CREATE INDEX IF NOT EXISTS idx_sec_investor ON famous_holdings(investor_name);
      CREATE INDEX IF NOT EXISTS idx_sec_date ON famous_holdings(filing_date);
    `);

    this.createDb('meta', `
      CREATE TABLE IF NOT EXISTS cik_mapping (
        cik TEXT PRIMARY KEY,
        name TEXT,
        type TEXT
      );

      CREATE TABLE IF NOT EXISTS market_cap_cache (
        symbol TEXT PRIMARY KEY,
        market_cap REAL,
        updated_at TEXT
      );
    `);

    this.createDb('api_cache', `
      CREATE TABLE IF NOT EXISTS api_cache (
        cache_key TEXT PRIMARY KEY,
        response TEXT,
        fetched_at TEXT,
        expires_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_cache_expires ON api_cache(expires_at);
    `);

    this.initialized = true;
  }

  /**
   * Create or open a database file with the given schema.
   */
  private createDb(name: string, schema: string): void {
    const filePath = path.join(DATA_DIR, `${name}.db`);
    const db = new Database(filePath);

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Run schema
    db.exec(schema);

    this.instances.set(name, { db, name, filePath });
  }

  /**
   * Get a database instance by name.
   */
  get(name: string): Database.Database {
    const instance = this.instances.get(name);
    if (!instance) {
      throw new Error(`Database '${name}' not found. Call init() first.`);
    }
    return instance.db;
  }

  /**
   * Valid database names that can be used as ATTACH aliases.
   */
  private readonly VALID_DB_NAMES = new Set([
    'stocks', 'congress', 'insider', 'fred', 'sec', 'meta', 'api_cache'
  ]);

  /**
   * Run a cross-database query using ATTACH.
   * Attaches all specified databases to the main (first) database.
   *
   * Example:
   *   queryCrossDb(
   *     ['stocks', 'fred'],
   *     `SELECT s.date, s.close, f.value
   *      FROM historical_prices s
   *      INNER JOIN fred.observations f ON date(s.date) = date(f.date)
   *      WHERE s.symbol = 'AAPL' AND f.series_id = 'FEDFUNDS'`
   *   )
   */
  queryCrossDb(dbNames: string[], sql: string, params: any[] = []): any[] {
    if (dbNames.length === 0) throw new Error('At least one database name required');

    const main = this.get(dbNames[0]);

    // Attach additional databases
    for (let i = 1; i < dbNames.length; i++) {
      const name = dbNames[i];

      // Validate database name against allowlist to prevent SQL injection
      if (!this.VALID_DB_NAMES.has(name)) {
        throw new Error(`Invalid database name: '${name}'. Allowed: ${[...this.VALID_DB_NAMES].join(', ')}`);
      }

      const instance = this.instances.get(name);
      if (!instance) throw new Error(`Database '${name}' not found`);
      main.exec(`ATTACH DATABASE '${instance.filePath}' AS ${name}`);
    }

    const stmt = main.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Close all database connections.
   */
  close(): void {
    for (const [name, instance] of this.instances) {
      instance.db.close();
    }
    this.instances.clear();
    this.initialized = false;
  }

  /**
   * Get the data directory path.
   */
  getDataDir(): string {
    return DATA_DIR;
  }
}

export const dbManager = new DbManager();