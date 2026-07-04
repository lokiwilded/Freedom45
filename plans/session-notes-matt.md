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
