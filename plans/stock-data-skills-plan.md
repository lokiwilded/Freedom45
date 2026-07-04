# Stock Data Skills — Getting Started Plan

## Goal
Build MCP tools that fetch stock market data, cache results in SQLite to save API calls, and start small with free APIs before scaling up.

---

## Free Financial Data APIs (Start Here)

| API | Free Tier | Key Needed | Best For |
|-----|-----------|------------|----------|
| **Alpha Vantage** | 5 calls/min, 500/day | Yes (free) | Prices, fundamentals, technical indicators |
| **Finnhub** | 60 calls/min | Yes (free) | Real-time quotes, news, SEC filings |
| **Yahoo Finance (unofficial)** | No hard limit | No | Current price, historical data, fundamentals |
| **Twelvedata** | 800 calls/day | Yes (free) | Stocks, forex, crypto, technical indicators |
| **Polygon.io** | Limited free tier | Yes (free) | Real-time & historical, options |
| **FRED (Fed data)** | Free | Optional | Macro data: interest rates, GDP, inflation |

**Recommendation:** Start with **Alpha Vantage** (reliable, good free tier, covers everything we need for v1) or **Finnhub** (higher rate limit on free tier).

---

## What Data to Fetch (Tiered by Priority)

### Tier 1 — Core Stock Data (v1, start here)
- Current price / real-time quote
- Daily OHLCV (Open, High, Low, Close, Volume)
- Company info (name, sector, industry, description)
- Key stats: market cap, P/E ratio, dividend yield, 52-week high/low

### Tier 2 — Fundamentals (v2)
- Income statement, balance sheet, cash flow
- Key ratios: EPS, ROE, debt/equity, profit margins
- Earnings dates and estimates

### Tier 3 — Technical Indicators (v3)
- Moving averages (SMA, EMA)
- RSI, MACD, Bollinger Bands
- Volume analysis

---

## SQLite Caching Strategy

Store API responses locally so we only call the API when data is stale.

### Tables

```sql
-- Cache for API responses (generic)
CREATE TABLE api_cache (
    cache_key TEXT PRIMARY KEY,   -- e.g. "quote:AAPL"
    response TEXT,                 -- JSON string
    fetched_at TEXT,               -- ISO timestamp
    expires_at TEXT                -- ISO timestamp
);

-- Stock quotes (denormalized for fast queries)
CREATE TABLE stock_quotes (
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

-- Company profiles
CREATE TABLE company_profiles (
    symbol TEXT PRIMARY KEY,
    name TEXT,
    sector TEXT,
    industry TEXT,
    description TEXT,
    exchange TEXT,
    employees INTEGER,
    updated_at TEXT
);

-- Historical prices (append-only, never deleted)
CREATE TABLE historical_prices (
    symbol TEXT,
    date TEXT,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume INTEGER,
    PRIMARY KEY (symbol, date)
);
```

### Cache TTL Rules
| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Current quote | 1 minute | Changes constantly |
| Company profile | 24 hours | Rarely changes |
| Historical prices | Never expires | Append-only, immutable |
| Financial metrics | 1 hour | Updates during trading day |

This means: if you check AAPL quote 10 times in a minute, only 1 API call is made. The other 9 hit SQLite.

---

## MCP Tool Ideas (v1 — Start Small)

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `get_stock_quote` | Current price + key stats | `symbol: string` | Price, change, P/E, market cap, 52w range |
| `get_company_profile` | Company info | `symbol: string` | Name, sector, industry, description |
| `get_historical_prices` | OHLCV for date range | `symbol, start_date, end_date` | Array of daily bars |
| `search_stocks` | Search by ticker or name | `query: string` | Matching companies |
| `get_market_news` | Latest news for a stock | `symbol: string` | Recent news articles |

---

## Project Structure (How to Add)

```
mcp-server/src/
├── index.ts              # Main server (register tools here)
├── tools/
│   ├── stock-quote.ts    # get_stock_quote tool
│   ├── company-profile.ts
│   ├── historical-prices.ts
│   └── search-stocks.ts
├── db/
│   └── cache.ts          # SQLite cache layer
└── providers/
    └── alpha-vantage.ts   # API client (swap providers easily)
```

Each tool gets a matching skill doc in `skills/`:
```
skills/
├── stock-quote.md
├── company-profile.md
├── historical-prices.md
└── search-stocks.md
```

---

## Dependencies to Add

```bash
cd mcp-server
npm install better-sqlite3    # SQLite for Node.js (synchronous, fast)
npm install -D @types/better-sqlite3
```

No HTTP client needed — Node.js 18+ has `fetch` built-in.

---

## v1 Build Order (Smallest Possible Start)

1. Add `better-sqlite3` dependency
2. Create `src/db/cache.ts` — SQLite init + cache helpers
3. Create `src/providers/alpha-vantage.ts` — API client for one endpoint (quote)
4. Create `src/tools/stock-quote.ts` — single tool: `get_stock_quote`
5. Register it in `src/index.ts`
6. Create `skills/stock-quote.md` — skill doc
7. Test it

That's the minimum viable step. One tool, one API, one database table. Everything else builds on that foundation.

---

## Why This Approach

- **SQLite cache** means you can use a paid API later and still minimize costs — cache hits are free
- **Provider abstraction** lets you swap Alpha Vantage for Finnhub or Polygon.io later by changing one file
- **Append-only historical data** means you build a valuable local dataset over time
- **Start with one tool** keeps it simple and testable