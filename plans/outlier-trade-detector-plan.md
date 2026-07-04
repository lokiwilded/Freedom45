# Outlier Trade Detector — Enhanced Plan

## The Real Goal
Don't just track trades. Find the **weird ones** — the outlier buys that signal something big.

The pattern we're looking for:
1. A small-cap or micro-cap company nobody's watching
2. An insider (CEO, director) buys a significant chunk
3. Maybe a famous investor's 13F shows they added it too
4. News comes out later that explains why they were buying
5. The stock runs 2x, 5x, 10x

We want to surface these BEFORE they run.

---

## The Filter System (Configurable Variables)

Every tool gets filter parameters so you can dial in what "weird" means:

### Market Cap Filters
```
market_cap_min: 10_000_000    # $10M minimum (skip penny stock noise)
market_cap_max: 500_000_000   # $500M max (small/mid cap only)
```

### Insider Trade Filters
```
min_shares: 10_000            # At least 10K shares bought
min_value: 100_000            # At least $100K invested
min_ownership_change: 0.01    # At least 1% increase in ownership
days_since_trade: 7           # Only trades in last 7 days
```

### Cross-Reference Filters
```
require_insider_buy: true     # Must have insider buying
require_famous_holder: false  # Optional: famous investor also holds
require_news: false           # Optional: recent news about the stock
news_sentiment_min: 0.3       # Minimum positive sentiment score
```

### Outlier Score (0-100)
```
outlier_score_min: 70         # Only show trades scoring 70+
```

---

## How Outlier Scoring Works

Each trade gets a score based on weighted factors:

| Factor | Weight | Why |
|--------|--------|-----|
| Insider buy vs. sell | 25 pts | Buying is always more interesting |
| Market cap (lower = higher score) | 20 pts | Small caps have more upside |
| % of company bought | 20 pts | Bigger position = more conviction |
| Multiple insiders buying | 15 pts | Consensus among executives |
| Famous investor overlap | 10 pts | Smart money agrees |
| Recent positive news | 10 pts | Catalyst identified |

A trade scoring 80+ means: small cap, CEO just bought 5% of the company, and there's positive news this week. That's the one to watch.

---

## Enhanced Tool Ideas

### Tool 1: `get_congress_trades`
```
get_congress_trades({
  symbol?: string,           // Filter by ticker
  chamber?: "senate" | "house",
  party?: "democrat" | "republican",
  min_amount?: "$15,001-$50,000",  // Minimum trade size bucket
  days_back?: 30,            // How far to look back
  outlier_score_min?: 70     // Only show high-scoring trades
})
```

### Tool 2: `get_insider_trades`
```
get_insider_trades({
  symbol?: string,
  min_value?: 100000,        // Minimum $ amount
  min_shares?: 10000,        // Minimum shares
  market_cap_max?: 500_000_000,  // Only small caps
  days_back?: 7,
  outlier_score_min?: 70
})
```

### Tool 3: `get_famous_investor_holdings`
```
get_famous_investor_holdings({
  investor?: "buffett" | "cathie-wood" | "burry" | "all",
  quarter?: "2024-Q4",
  min_value?: 10_000_000,    // Only positions over $10M
  new_positions_only?: true,  // Only new buys, not adds
  market_cap_max?: 2_000_000_000  // Only small/mid caps
})
```

### Tool 4: `find_outlier_trades` ⭐ (The Killer Tool)
This is the one that ties everything together.

```
find_outlier_trades({
  // What to look for
  insider_buy_min_value: 100000,
  market_cap_max: 500_000_000,
  days_back: 7,
  
  // Cross-references
  check_famous_holders: true,
  check_news: true,
  news_sentiment_min: 0.3,
  
  // Scoring
  outlier_score_min: 70,
  limit: 20
})
```

**What it does:**
1. Scans all insider transactions from the last N days
2. Filters by market cap (small caps only)
3. Scores each trade on the outlier scale
4. Cross-references with famous investor 13F filings
5. Checks for recent news with positive sentiment
6. Returns ranked list of the most interesting trades

**Example output:**
```
OUTLIER TRADE DETECTED — Score: 87/100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Company:   Quantum Materials Corp (QMAT)
Market Cap: $42M
Insider:   Dr. Sarah Chen, CEO
Action:    Bought 50,000 shares @ $3.20 = $160,000
Ownership: Increased from 2.1% to 3.4%

Why it's interesting:
  ✅ CEO buying with own money ($160K)
  ✅ Micro-cap ($42M) — huge upside potential
  ✅ 1.3% ownership increase — significant
  ✅ Cathie Wood added this to ARK fund last quarter
  ✅ News: "Quantum Materials receives DOE grant" (sentiment: 0.72)
  ✅ No other insiders selling

Verdict: STRONG BUY SIGNAL — multiple confirmations
```

### Tool 5: `get_ytd_performance`
```
get_ytd_performance({
  tickers: ["QMAT", "AAPL", "SPY"],
  benchmark: "SPY",
  since: "2025-01-01"
})
```

---

## Database Schema (Enhanced)

### congress.db
```sql
CREATE TABLE congress_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    politician_name TEXT,
    chamber TEXT,
    party TEXT,
    state TEXT,
    ticker TEXT,
    asset_description TEXT,
    transaction_type TEXT,  -- Purchase, Sale, Exchange
    amount_range TEXT,       -- "$1,001 - $15,000"
    transaction_date TEXT,
    disclosure_date TEXT,
    outlier_score REAL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_congress_ticker ON congress_trades(ticker);
CREATE INDEX idx_congress_date ON congress_trades(transaction_date);
CREATE INDEX idx_congress_outlier ON congress_trades(outlier_score);
```

### insider.db
```sql
CREATE TABLE insider_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT,
    company_name TEXT,
    insider_name TEXT,
    position TEXT,
    transaction_type TEXT,  -- Buy, Sell
    shares INTEGER,
    price REAL,
    value REAL,
    ownership_after REAL,   -- % ownership after transaction
    transaction_date TEXT,
    filing_date TEXT,
    market_cap REAL,
    outlier_score REAL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_insider_symbol ON insider_transactions(symbol);
CREATE INDEX idx_insider_date ON insider_transactions(transaction_date);
CREATE INDEX idx_insider_outlier ON insider_transactions(outlier_score);
CREATE INDEX idx_insider_marketcap ON insider_transactions(market_cap);
```

### sec.db
```sql
CREATE TABLE famous_holdings (
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
    change_from_last_q REAL,  -- % change in shares
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_famous_ticker ON famous_holdings(ticker);
CREATE INDEX idx_famous_investor ON famous_holdings(investor_name);
CREATE INDEX idx_famous_date ON famous_holdings(filing_date);
```

### meta.db
```sql
CREATE TABLE cik_mapping (
    cik TEXT PRIMARY KEY,
    name TEXT,
    type TEXT  -- 'famous_investor', 'company', 'fund'
);

CREATE TABLE market_cap_cache (
    symbol TEXT PRIMARY KEY,
    market_cap REAL,
    updated_at TEXT
);
```

---

## v1 Build Order (Still Small)

1. **Add `better-sqlite3` dependency**
2. **Build `src/db/manager.ts`** — Creates all .db files, runs schema
3. **Build `src/providers/finnhub.ts`** — API client
4. **Build `src/tools/get-congress-trades.ts`** — First tool
5. **Register in `src/index.ts`**
6. **Write `skills/get-congress-trades.md`**
7. **Test it**

v1 is still one tool. The outlier scoring and cross-referencing comes in v2 after we have data flowing.

---

## v2 (Add Outlier Detection)

8. **Build `src/providers/yahoo-finance.ts`** — For market cap + insider data
9. **Build `src/providers/fred.ts`** — For macro data
10. **Build `src/tools/get-insider-trades.ts`** — With outlier scoring
11. **Build `src/tools/find-outlier-trades.ts`** — The killer tool
12. **Build `src/scoring/outlier.ts`** — Scoring engine
13. **Write skill docs for each tool**

---

## The Ultimate Vision

A daily scan that runs and says:

> "Here are the 5 most interesting trades today. CEO of XYZ just bought $500K of their own stock. It's a $50M market cap company. Cathie Wood added it last quarter. And there's news about a new patent. Score: 92/100."

That's the goal. Start with one tool, one API, one database. Build the pipeline. Then add the intelligence.