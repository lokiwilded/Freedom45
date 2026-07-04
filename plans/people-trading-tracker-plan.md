# People Trading Tracker — Plan

## The Big Idea
Track what important people are buying/selling and measure their year-to-date performance. Think: members of Congress, Fed officials, famous investors (Buffett, Cathie Wood, etc.), and corporate insiders.

---

## Data Sources (The Three We're Using)

| Source | Cost | Rate Limit | What We Get |
|--------|------|-----------|-------------|
| **Finnhub** | Free (60/min) | 60/min, 30/sec | Congress trades, insider transactions, company news, quotes, fundamentals |
| **Yahoo Finance** | Free (no key) | ~120/min de-facto | Insider transactions, institution ownership, fund ownership, backup quotes, fundamentals time series |
| **FRED** | Free (key needed) | 120/min | Macro data: Fed funds rate, inflation, GDP, yield curve, VIX |

---

## SQLite Database Layout

```
mcp-server/data/
├── stocks.db          # Stock quotes, historical prices, company profiles
├── congress.db        # Congressional trades, politician profiles
├── insider.db         # Insider transactions, institutional ownership
├── fred.db            # FRED economic series observations
├── sec.db             # 13F filings, Form 4 filings
├── api_cache.db       # Generic API response cache (shared)
└── meta.db            # CIK→name mapping, politician→ticker mapping
```

Cross-database queries use SQLite `ATTACH` — e.g., join stock prices from `stocks.db` with FRED data from `fred.db` in a single query.

---

## First Tool Ideas (v1 — Start Small)

### Tool 1: `get_congress_trades`
Track what US Senators and Representatives are buying/selling.

**Data source:** Finnhub `/stock/congressional-trading` (free, no scraping needed)

**What it returns:**
- Politician name, chamber, party
- Ticker, asset description
- Transaction type (buy/sell)
- Amount range ($1K–$15K, $15K–$50K, etc.)
- Transaction date
- Year-to-date performance of their disclosed trades

**Why this is cool:** The STOCK Act requires Congress to disclose trades within 45 days. Finnhub aggregates both chambers. You can see which politicians are beating the market.

### Tool 2: `get_insider_trades`
Track corporate insiders (C-suite, directors) buying/selling their own company's stock.

**Data source:** Finnhub `/stock/insider-transactions` (free, 100 per call) + Yahoo `quoteSummary.insiderTransactions` (backup)

**What it returns:**
- Insider name, position
- Ticker, company name
- Transaction type (buy/sell)
- Shares, price, value
- Post-transaction ownership %
- Year-to-date insider sentiment (net buy/sell ratio)

**Why this is cool:** Insider buying is one of the strongest bullish signals. If multiple executives are buying, that's a strong vote of confidence.

### Tool 3: `get_famous_investor_holdings`
Track what famous investors are holding via their 13F filings.

**Data source:** SEC EDGAR (free, 10 req/sec, needs User-Agent header)

**Pre-loaded investor list:**
| Investor | CIK |
|----------|-----|
| Warren Buffett / Berkshire Hathaway | 0001067983 |
| Cathie Wood / ARK Invest | Multiple ARK fund CIKs |
| Michael Burry / Scion Asset Mgmt | 0001647251 |
| Ray Dalio / Bridgewater | 0001350694 |
| Bill Ackman / Pershing Square | 0001336528 |
| George Soros / Soros Fund Mgmt | 0001029160 |
| Ken Griffin / Citadel | 0001423053 |
| Chase Coleman / Tiger Global | 0001167483 |

**What it returns:**
- Investor name
- Filing date (quarterly, 45-day lag)
- Top 10 holdings with value and shares
- Changes from previous quarter (new buys, sells, adds)
- Year-to-date performance of their portfolio

**Why this is cool:** 13F filings are the only window into what the smartest money is doing. Buffett's 13F is basically a cheat sheet.

### Tool 4: `get_fred_series`
Fetch economic data to correlate with stock performance.

**Data source:** FRED API (free, 120/min)

**Key series:**
| Series ID | What It Is |
|-----------|------------|
| FEDFUNDS | Fed Funds Rate |
| CPIAUCSL | CPI Inflation |
| GDP | Gross Domestic Product |
| UNRATE | Unemployment Rate |
| DGS10 | 10-Year Treasury Yield |
| T10Y2Y | 10Y-2Y Spread (recession indicator) |
| VIXCLS | VIX Volatility Index |
| M2SL | Money Supply |

**What it returns:**
- Series name and description
- Observations for a date range
- Current value vs. historical range

**Why this is cool:** Correlate stock moves with macro data. "When the yield curve inverted, how did AAPL perform?"

### Tool 5: `get_ytd_performance`
Year-to-date performance for any ticker or portfolio.

**Data source:** Finnhub `/stock/candle` or Yahoo `chart`

**What it returns:**
- YTD return %
- Benchmark comparison (SPY, QQQ)
- Max drawdown YTD
- Best/worst month
- Volatility (standard deviation of daily returns)

**Why this is cool:** This is the measurement tool. You can feed it a list of stocks a politician bought and see if they're beating the market.

---

## v1 Build Order (Smallest Possible Start)

1. **Add dependencies:** `better-sqlite3`, `@types/better-sqlite3`
2. **Create `src/db/manager.ts`** — Central DB manager, creates all `.db` files in `data/`, runs schema migrations
3. **Create `src/providers/finnhub.ts`** — API client for Finnhub (quote + congress endpoints)
4. **Create `src/tools/get-congress-trades.ts`** — First tool: fetch congress trades, cache in `congress.db`
5. **Register tool in `src/index.ts`**
6. **Create `skills/get-congress-trades.md`** — Skill doc
7. **Test it**

That's the minimum. One tool, one provider, one database. Everything else builds on that.

---

## Future Tool Ideas (v2+)

- `get_politician_portfolio(name)` — Full portfolio for a specific politician
- `get_insider_sentiment(sector)` — Which sectors have the most insider buying
- `get_buffett_indicator()` — Total market cap / GDP ratio
- `get_economic_calendar()` — Upcoming economic data releases
- `get_correlation(ticker1, ticker2)` — Historical correlation between any two assets
- `get_market_regime()` — Classify current market as bull/bear/sideways using FRED + price data
- `get_politician_trade_alerts()` — Real-time alerts when a politician trades a stock you're watching

---

## Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Primary provider | Finnhub | Free, 60/min, covers Congress + insider + quotes |
| Secondary provider | Yahoo Finance | Free, no key, backup for insider/ownership data |
| Macro data | FRED | Free, 840K+ series, official Fed data |
| Database | better-sqlite3 | Synchronous, fast, supports ATTACH for cross-DB queries |
| DB layout | One .db per source | Clean separation, easy to reset individual caches |
| Cache strategy | Generic api_cache table per DB | Same schema everywhere, TTL per data type |
| Cross-DB queries | SQLite ATTACH | Single SQL query, no app-level stitching |
| 13F parsing | SEC EDGAR Submissions API | Free, 10 req/sec, needs User-Agent header |
| Congress data | Finnhub endpoint | No scraping, both chambers, free |