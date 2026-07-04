# Matt's Long-Term Stock & Company Analysis Tools

## Goal
Build reusable functions, MCP tools, and an OpenCode skill for long-term analysis of stocks and companies: fundamentals, multi-year financial health, trend summaries, and relative comparisons.

## Data Sources
- **Primary:** Finnhub
  - Free tier: 60 calls/minute
  - Requires a free API key from https://finnhub.io/
  - Provides company profiles, fundamentals, earnings, news, and historical prices
- **Later:** FRED for macroeconomic indicators (DXY, rates, inflation)
- **Future:** SEC EDGAR, Alpha Vantage, or Financial Modeling Prep for deeper fundamentals

## Code Location
Matt's tools live in `mcp-server/src/tools/`.
Shared infrastructure (`db.ts`, providers, helpers) lives in `mcp-server/src/`.
This matches Loki's branch structure for easier merging later.

## Database (personal while learning)
- **SQLite:** `data/stocks.db` using Node's built-in `node:sqlite`
- **Tables:**
  - `companies` — ticker, name, sector, industry, exchange, currency, country, website, market_cap, fetched_at
  - `price_history` — ticker, date, open, high, low, close, adjusted_close, volume, source
  - `api_cache` — cache_key, response, fetched_at, expires_at (raw API response cache with TTL)
  - `fundamentals` — ticker, metric, value, period, source, updated_at (planned)
- This schema stays on this branch while learning. It will be merged with Loki's database later.

## Caching Strategy
- **Immutable / slow-changing data:** coverage-based. If already stored, do not refetch.
- **Raw API responses:** TTL-based via `api_cache` table. Profiles cached 24 hours, quotes 1 minute, etc.
- **Historical prices:** append-only, never refetch a date that is already cached.

## Function Roadmap

### Data ingestion
- `fetchCompanyProfile(ticker)` — ✅ done
- `fetchHistoricalPrices(ticker, years)` — next
- `fetchFundamentals(ticker, period?)`
- `fetchQuote(ticker)`
- `fetchPeers(ticker)`

### Calculation / transformation
- `calculateReturns(prices)`
- `calculateMovingAverage(prices, window)`
- `calculateVolatility(prices, window)`
- `calculateCAGR(startPrice, endPrice, years)`
- `calculateDrawdowns(prices)`
- `calculateCorrelation(tickers, years)`

### Analysis
- `analyzeLongTermTrend(ticker, years)`
- `analyzeValuation(ticker)`
- `analyzeRelativeStrength(ticker, benchmarkTicker, years)`
- `scoreCompany(ticker)`

### Comparison / reporting
- `compareCompanies(tickers, metrics)`
- `buildSummaryReport(tickers)`

### Introspection
- `getStoredTickers()`
- `getDataCoverage(ticker)`

## Skill
- File: `skills/company-fundamentals-analysis.md`
- Handles prompts like:
  - "Analyze AAPL's long-term fundamentals"
  - "Is MSFT a healthy company over 5 years?"
  - "Compare TSLA and NVDA financial health"
  - "What is AAPL's risk-adjusted return vs SPY?"

## Next Steps
1. Implement `fetchHistoricalPrices(ticker, years)`.
2. Add a matching test in `mcp-server/src/test/`.
3. Verify cache-by-date behavior.
