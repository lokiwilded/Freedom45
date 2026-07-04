# Merge Architecture — Loki + Matt

## Goal
Merge both branches into a unified foundation on the `template` branch. Standardize on `node:sqlite` (Node 22+ built-in), keep the multi-DB pattern, wire all tools into the MCP server.

---

## Final File Structure

```
Freedom45/
├── .env.example                  # FINNHUB_API_KEY template
├── .gitignore                    # Ignores .env, data/*.db, node_modules/, dist/
├── AI-RULES.md                   # Soft guidelines
├── README.md                     # Project overview
├── data/                         # SQLite databases (gitignored)
├── plans/                        # Ideas and plans as .md files
│   ├── stock-data-skills-plan.md
│   ├── people-trading-tracker-plan.md
│   ├── outlier-trade-detector-plan.md
│   ├── matt-long-term-analysis-tools.md
│   ├── session-notes-matt.md
│   └── merge-architecture.md
├── skills/                       # Skill documentation
│   ├── get-congress-trades.md
│   └── company-fundamentals-analysis.md
└── mcp-server/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts              # MCP server — auto-discovers tools
        ├── db.ts                 # SQLite connection (node:sqlite) — single shared instance
        ├── lib/
        │   └── cache.ts          # TTL cache helpers (api_cache table)
        ├── providers/
        │   └── finnhub.ts        # Finnhub API client (merged: both branches)
        ├── tools/
        │   ├── hello.ts          # Hello world tool
        │   ├── get-congress-trades.ts  # Congressional trading tool
        │   └── long-analysis/
        │       ├── index.ts      # Auto-discovery registry
        │       └── fetchCompanyProfile.ts  # Company profile tool
        └── test/
            ├── cacheOnly.test.ts
            └── long-analysis/
                ├── fetchCompanyProfile.test.ts
                └── fetchCompanyProfileTool.test.ts
```

---

## Database Schema (Single `stocks.db` via `node:sqlite`)

### `companies` table (from Matt)
```sql
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
```

### `price_history` table (from Matt)
```sql
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
```

### `congress_trades` table (from Loki)
```sql
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
```

### `insider_transactions` table (from Loki — for future)
```sql
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
```

### `api_cache` table (from both — generic TTL cache)
```sql
CREATE TABLE IF NOT EXISTS api_cache (
    cache_key TEXT PRIMARY KEY,
    response TEXT,
    fetched_at TEXT,
    expires_at TEXT
);
```

---

## Tool Registry Pattern

Each tool exports a `tool` object with this shape:

```typescript
export const someTool = {
  name: "tool_name",
  description: "What it does",
  inputSchema: { type: "object", properties: { ... } },
  handler: async (args: any) => { ... }
};
```

Tools are organized by category in subdirectories:
- `tools/` — general tools (hello, get-congress-trades)
- `tools/long-analysis/` — long-term analysis tools (fetchCompanyProfile, future)

The `index.ts` auto-discovers tools from subdirectories:

```typescript
// tools/long-analysis/index.ts
import { fetchCompanyProfileTool } from './fetchCompanyProfile.js';
export const longAnalysisTools = [fetchCompanyProfileTool];

// index.ts
import { longAnalysisTools } from './tools/long-analysis/index.js';
const allTools = { hello, get_congress_trades, ...Object.fromEntries(longAnalysisTools.map(t => [t.name, t])) };
```

---

## Merge Order

1. **Switch `db.ts` from `better-sqlite3` to `node:sqlite`** — single shared connection, all schemas merged
2. **Merge `finnhub.ts`** — take Matt's additions (candles, finnhubIndustry, currency), keep our congress/insider
3. **Add `lib/cache.ts`** — reusable TTL helpers from Matt
4. **Add `tools/long-analysis/fetchCompanyProfile.ts`** — from Matt, with two-tier caching
5. **Rewrite `index.ts`** — auto-discovery pattern, register all tools
6. **Update `package.json`** — remove better-sqlite3, add zod + tsx
7. **Copy test files, plans, skills, .env.example** from Matt's branch
8. **Build and verify**