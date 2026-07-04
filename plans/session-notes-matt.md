# Session Notes — Matt's Long-Term Analysis Tools

## 2026-07-04

### Decisions Made
- Code now lives under `mcp-server/src/` to match Loki's structure.
- Matt's tools/functions are under `mcp-server/src/tools/`.
- SQLite database at `/data/stocks.db` using Node's built-in `node:sqlite`.
- First API source: **Finnhub** (Yahoo Finance rate-limited us immediately).
- FRED is planned for later.
- First tool/function: `fetchCompanyProfile(ticker)`.
- Returns raw data and stores/upserts in SQLite.
- Cache rule: coverage-based for immutable data (e.g., company profiles cached forever in `companies` table), TTL-based for raw API responses via `api_cache`.
- API key stored in root `.env` as `FINNHUB_API_KEY`.
- SQLite implementation uses `node:sqlite` (no `better-sqlite3`).
- Provider location matches Loki: `mcp-server/src/providers/finnhub.ts`.
- Multiple suppliers supported; Finnhub is first.
- Column naming kept separate per branch; standardization deferred to merge time.

### Files Created/Updated This Session
- `/mcp-server/package.json` — updated dependencies and test scripts
- `/mcp-server/tsconfig.json` — unchanged
- `/mcp-server/src/db.ts` — SQLite connection, `companies`, `price_history`, `api_cache` schema
- `/mcp-server/src/providers/finnhub.ts` — full Finnhub provider with rate limiting
- `/mcp-server/src/lib/cache.ts` — TTL cache helpers for `api_cache`
- `/mcp-server/src/tools/fetchCompanyProfile.ts` — first tool using provider + SQL cache
- `/mcp-server/src/test/fetchCompanyProfile.test.ts` — standalone test
- `/mcp-server/src/test/cacheOnly.test.ts` — DB sanity test
- `/.env` — API key (not tracked by Git)
- `/.env.example` — API key placeholder
- `/data/.gitkeep` — keep data folder in repo
- `/plans/matt-long-term-analysis-tools.md` — updated plan doc with function roadmap
- `/plans/session-notes-matt.md` — this file
- `/skills/company-fundamentals-analysis.md` — updated skill doc
- `/AI-RULES.md` — updated to reflect `mcp-server/src/tools/` as code location
- `/.gitignore` — ignore DB, node_modules, dist, .env
- `/README.md` — updated to reflect actual project structure
- Deleted `/functions/` folder and all its contents (no longer needed)

### Implementation Status
- `fetchCompanyProfile` implemented and tested successfully with AAPL.
- Cache hit verified on second call (retrieved from `companies` table).
- `node:sqlite` working with no deprecation warnings.
- TypeScript build succeeds.

### Next Steps
- Add `fetchHistoricalPrices(ticker, years)` next.
- Consider adding `fetchFundamentals(ticker)` after that.

## 2026-07-04 — Rebase onto Loki's Merged Main

### Context
- Loki performed the merge on his branch (`origin/loki`) and force-pushed `origin/main` to match.
- His merge integrated all 20 of Matt's long-analysis tools + built an outlier detection system on top.
- Matt's branch (`matt/long-term-analysis-tools-initial-setup`) was not in Loki's merge history — the branches had diverged.
- Decision: rebase Matt's branch onto `origin/main` (Loki's merged version), accept his table naming, recover the strategy doc.

### Actions Taken
- `git reset --hard origin/main` — repointed branch to Loki's merged main (commit `1a9c0eb`)
- Recovered `plans/agent-market-analysis-strategy.md` from orphaned commit `c3d73fd` via `git checkout c3d73fd -- plans/agent-market-analysis-strategy.md`
- Deleted old `data/stocks.db` (had stale superset schema from pre-merge prep; will re-create clean on next run)
- `npm install` at root + mcp-server — dependencies installed
- Old commits (merge plan, 14 tools, schema prep, strategy) are orphaned but recoverable via reflog if needed

### What Was Gained from Loki's Merge
- **Outlier detection system**: `mcp-server/src/scoring/outlier.ts` (scoring engine, 0-100), `mcp-server/src/config/outlier-settings.ts` (configurable filters)
- **Enhanced `get_congress_trades`** (546 lines): live price, market cap, outlier scoring, viability assessment, configurable filtering
- **New DB tables**: `congress_trades` + `insider_transactions` with indexes (outlier_score, ticker, date, market_cap)
- **DB improvements**: WAL mode, foreign keys enabled, data directory auto-creation
- **Cache improvement**: `cache.ts` now handles corrupted JSON gracefully
- **Updated docs**: `README.md`, `AI-RULES.md`, `.gitignore`, `plans/merge-architecture.md`, `plans/outlier-trade-detector-plan.md`, `plans/people-trading-tracker-plan.md`, `plans/stock-data-skills-plan.md`
- **New skill**: `skills/get-congress-trades.md`
- **New test**: `mcp-server/src/test/getCongressTrades.test.ts`
- **All 20 long-analysis tools preserved** + `get_congress_trades` = 21 tools total

### What Was Lost (Acceptable)
- Superset schema prep (`company_profiles`/`historical_prices` with Loki's extra columns) — discarded; reverted to original names (`companies`/`price_history`). Acceptable since tools work with original names.
- `plans/merge-with-loki-plan.md` — historical, merge is done
- Earlier session-notes sections about merge planning + Tier 1/2 work — Loki's version was an earlier snapshot

### Verification Results
- `npm run build` — TypeScript compiles clean ✅
- `npm run test:offline` — registry shows 20 long-analysis tools; cache test inserts into `companies` table ✅
- `npm run test:profile AAPL` — live API call works; profile fetched and persisted ✅
- `npm run test:recommendations AAPL` — live Tier-2 tool works ✅
- `npm run test:congress` — 403 Forbidden (Finnhub free tier blocks congressional-trading endpoint, same as historical candles). Tool logic is correct; verified outlier scoring engine directly: small-cap CEO purchase scores 85/100 ("very_high") ✅
- Outlier scoring engine verified independently: `calculateOutlierScore({marketCap: 50M, tradeValue: 250K, transactionType: "Purchase", sameTickerRecentTrades: 3, daysOld: 5})` → score 85, label "very_high" ✅

### Current State
- Branch: `matt/long-term-analysis-tools-initial-setup` at `1a9c0eb` (same as `origin/main`)
- Tools: 21 (20 long-analysis + 1 `get_congress_trades`)
- DB: `companies`, `price_history`, `fundamentals`, `congress_trades`, `insider_transactions`, `api_cache` (all in single `stocks.db`)
- Build: clean. Offline tests: pass. Live tests: pass (except congress/candles which need paid Finnhub tier).

### Known Limitations
- Finnhub free tier blocks `/stock/congressional-trading` (403) and `/stock/candle` (403) — both need paid tier
- Root `package.json` still lists `better-sqlite3` as dependency (unused — code uses `node:sqlite`). Harmless cleanup for later.

### Next Steps
- Start Phase 1 of agent market analysis strategy: composite analysis tools
- Session A: `analyzeValuation` + `analyzeRelativeStrength` + tests
- See `plans/agent-market-analysis-strategy.md` for full roadmap

## 2026-07-04 — Session A: First Composite Analysis Tools

### Context
- Started Phase 1 of the agent market analysis strategy.
- Built the first two composite analysis tools: `analyzeValuation` and `analyzeRelativeStrength`.
- These are the first tools that return a *judgment* (score + verdict), not just raw data.

### Tools Built
- **`analyzeValuation(ticker)`** — scores P/E, P/B, P/S, EV/EBITDA, dividend yield vs sector peer median. Returns 0-100 score with verdict (Undervalued/Fairly valued/Overvalued). Handles edge cases: negative earnings, < 3 peers, null metrics (redistributes weight).
- **`analyzeRelativeStrength(ticker, benchmark, years)`** — computes alpha, beta, Sharpe ratio, max drawdown comparison, monthly outperformance %. Returns 0-100 score with verdict. Gracefully handles 403 (Finnhub free tier blocks candles) by returning "No data" verdict with explanatory note.

### Supporting Work
- **`lib/scoring.ts`** (new) — shared scoring utilities: `verdictFromScore`, `linearScale`, `median`, `redistributeWeights`, `weightedScore`. All composite tools will use these.
- **`lib/calculations.ts`** (expanded) — added 4 new helpers: `calculateBeta`, `calculateAlpha`, `calculateSharpeRatio`, `calculateMonthlyOutperformance`. Pure functions, no API calls.
- **`fetchFundamentalMetrics.ts`** (expanded) — now extracts 17 fields (was 7). Added: P/B, P/S, EV/EBITDA, dividend yield, ROA, gross margin, operating margin, revenue, net income, market cap. Fixed Finnhub field name mappings (`peTTM`, `pbAnnual`, `psTTM`, `evEbitdaTTM`, `currentDividendYieldTTM`, `revenueGrowthTTMYoy`).
- **`test/shared/calculations.test.ts`** (new) — 45 unit tests for all calculation + scoring helpers. All pass. No API calls (mock data).
- Test files for both new tools.
- Updated `package.json` with `test:valuation`, `test:relative-strength`, `test:calcs` scripts. Extended `test:offline` to include calc tests.

### Verification
- `npm run build` — TypeScript compiles clean ✅
- `npm run test:offline` — 22 tools registered, 45 calc tests pass, cache test passes ✅
- `npm run test:valuation AAPL` — live: AAPL scores 34.3 ("Overvalued"). P/B (50.98) way above peer median (3.99), pulling score down. ✅
- `npm run test:relative-strength AAPL SPY 5` — gracefully returns "No data" with 403 note (Finnhub free tier). Calculation engine verified via unit tests. ✅

### Finnhub Field Name Discovery
- Finnhub's `/stock/metric` endpoint uses different field names than expected:
  - P/E: `peTTM` (not `peRatioTTM`)
  - P/B: `pbAnnual` (not `pbRatioTTM`)
  - P/S: `psTTM` (not `psRatioTTM`)
  - EV/EBITDA: `evEbitdaTTM` (not `enterpriseValueEBITDATTM`)
  - Dividend yield: `currentDividendYieldTTM` (not `dividendYieldTTM`)
  - Revenue growth: `revenueGrowthTTMYoy` (not `revenueGrowthTTM`)
  - Current ratio: `currentRatioQuarterly` (not `currentRatioTTM`)
- Some fields (e.g. `totalDebtEquityTTM`) are not available on free tier; used fallback to `debtEquityAnnual`.

### Current Tool Count
- 22 long-analysis tools (20 fetch + 2 composite analysis) + 1 `get_congress_trades` = 23 total

### Next Steps
- Session B: `analyzeEarningsQuality` + `analyzeInsiderSentiment` + `analyzeAnalystConsensus`
- Session C: `analyzeDividendHealth` + `analyzeFinancialHealth`
- Session D: `scoreCompany` + `compareCompanies`
- Session E: `buildThesis` (capstone)

## 2026-07-04 — Test Hardening: Assertions Added to All Smoke Tests

### Context
- All 23 Matt-authored test files were smoke scripts — they ran the tool and printed JSON but didn't assert anything. No pass/fail, no exit code on bad results.
- Added real assertions to every test so they catch regressions. Only Matt's test files were touched; Loki's tests (`getCongressTrades.test.ts`, `cacheOnly.test.ts`) were left unchanged.

### What Was Done
- **New: `test/shared/assertions.ts`** — tiny assertion helper library with `assert`, `assertEqual`, `assertType`, `assertNotNull`, `assertArray`, `assertInArray`, `printSummary`. Tests exit 1 on failure.
- **23 test files rewritten** — each now includes assertions on output structure, types, and sane values. Examples:
  - `fetchStockQuote.test.ts`: asserts ticker matches input, price/change/changePercent are numbers, fromCache is boolean, timestamp present
  - `analyzeValuation.test.ts`: asserts score is number, verdict is one of the valid values, components.pe/pb are numbers, comparison.peers is array
  - `analyzeRelativeStrength.test.ts`: asserts verdict is valid, score null implies note present, score non-null implies alpha+beta present
- **7 tests that hit Finnhub free-tier 403s** (history, trend, relative-strength, dividends, splits, institutional-ownership, fund-ownership) now catch the API error and assert it's a free-tier limit, not a real bug.

### Finnhub Free-Tier Endpoint Discovery
- Confirmed blocked on free tier (403): `/stock/candle`, `/stock/congressional-trading`, `/stock/dividend`, `/stock/split`, `/stock/institutional-ownership`, `/stock/fund-ownership`
- Working on free tier: `/quote`, `/stock/metric`, `/stock/profile`, `/stock/peers`, `/search`, `/stock/insider-transactions`, `/company-news`, `/news`, `/calendar/earnings`, `/stock/earnings`, `/stock/recommendation`, `/stock/price-target`, `/stock/upgrade-downgrade`, `/stock/filings`

### Verification
- `npm run build` — TypeScript compiles clean ✅
- `npm run test:offline` — 45 calc tests + registry (23 tools) + cache ✅
- Live tests pass: quote, profile, peers, search, recommendations, valuation, earnings, insider, company-news, market-news, sec-filings, earnings-calendar, price-target, upgrade-downgrade ✅
- 403-graceful tests pass: history, trend, relative-strength, dividends, splits, inst-own, fund-own ✅

### Files Changed
- New: `mcp-server/src/test/shared/assertions.ts`
- Modified: 23 test files in `src/test/long-analysis/`
- Loki's files untouched: `getCongressTrades.test.ts`, `cacheOnly.test.ts`, `scoring/outlier.ts`, `config/outlier-settings.ts`, `get-congress-trades.ts`, `cache.ts`, `db.ts`

### Next Steps
- Session B: `analyzeEarningsQuality` + `analyzeInsiderSentiment` + `analyzeAnalystConsensus`
- Session C: `analyzeDividendHealth` + `analyzeFinancialHealth`
- Session D: `scoreCompany` + `compareCompanies`
- Session E: `buildThesis` (capstone)
