# Liquidity / Macro Dashboard — Plan

## Concept
Track the world's **money supply** and **sovereign debt** over time, alongside historical
levels of major assets (S&P 500 market cap, FTSE, Nikkei, gold, silver, etc.), and fit the
**empirical relationship** between liquidity growth and asset appreciation.

Core thesis (well-documented): global liquidity (M2 / central-bank balance sheets) and
deficit spending drive asset prices. When money supply expands, asset market caps expand —
usually by **far more** than the money "added," because a marginal buyer at a higher price
re-rates every share (reflexivity / multiplier), plus foreign inflows and leverage.

### Honest framing of the model
- NOT "X% of new money flows into the S&P." Money isn't a fixed pool being poured between buckets.
- INSTEAD: an **elasticity / multiplier** we *measure* from history:
  "per +1% global liquidity, S&P market cap historically moved +Y% (range a–b)."
- Track **debt** and **money supply** as two windows on the same liquidity firehose
  (deficit spending injects money; QE monetizes debt).
- Output ranges + confidence, never false precision. Correlation ≠ causation; label it as such.

### Reference numbers from user (sanity anchors)
- Trump 2nd term so far: ~+$1.6T money supply, ~+$3T+ debt.
- Biden term: ~+$7T money supply, ~+$14T debt; S&P ~+180% (~+$25–27T market cap).
- Note market-cap gain >> US money added because it's global + reflexive, not a US-only flow.

---

## Decisions (locked for v1)
- **UI data path:** thin Express REST API over shared data functions; Vite + React + Recharts SPA in `ui/`.
- **Scope:** Global M2 basket — US, Eurozone, China, Japan, UK (+ optionally CA/CH/AU).
  ~80–90% of world money supply. Expand to full country coverage later.
- **Market cap:** TRUE market cap (not index-level proxy). Pull real datapoints; use index
  level only to interpolate daily granularity between/after known cap datapoints.

---

## Data sources

| Need | Source | Coverage / cadence | Auth | Notes |
|---|---|---|---|---|
| Money supply (majors) | **FRED** API | US + majors, monthly, decades | free API key | Primary. e.g. `M2SL` (US), euro-area/JP/UK/CN M2 series. |
| Money supply (gaps) | **World Bank** API / **IMF IFS** | ~all countries; WB annual / IMF monthly | none / none | Fill non-FRED currencies later. |
| Govt debt (cross-country) | **IMF WEO** | every country, annual + projections | none (bulk file) | Definitive debt set. |
| Govt debt (US detail / check) | **FRED** (`GFDEBTN`) + World Bank | US monthly; others annual | free key | |
| FX rates | **FRED** or exchangerate-host | daily/monthly, decades | free/none | Needed to sum local-currency M2 into USD "global M2". |
| Central-bank balance sheets | **FRED** (`WALCL` Fed, ECB, BOJ) | weekly/monthly | free key | Optional richer liquidity signal. |
| Index history (S&P/FTSE/Nikkei) | **Stooq** (or Yahoo) | daily, decades | none | Finnhub free tier too limited for long index history. |
| **S&P 500 true market cap** | multpl.com (monthly) / Siblis (quarterly) | monthly/quarterly | scrape / free page | Store real datapoints; interpolate with index level. |
| Gold / silver | **FRED** (LBMA fixings) / Stooq | daily, decades | free/none | |

> ⚠️ Series IDs and exact endpoints to be **verified during build** (recalled, not confirmed).

---

## Architecture (builds on existing MCP pattern)

```
mcp-server/src/
  providers/
    fred.ts          # FRED API client (rate-limited, same pattern as finnhub.ts)
    worldbank.ts     # World Bank API client
    imf.ts           # IMF WEO/IFS client
    stooq.ts         # Index/commodity history (CSV)
    marketcap.ts     # S&P 500 true market cap (multpl/Siblis)
  tools/macro/
    index.ts               # auto-discovery registry
    getMoneySupply.ts      # per-country M2 time series
    getGovernmentDebt.ts   # per-country debt time series
    getGlobalLiquidity.ts  # basket summed to USD
    getAssetHistory.ts     # index / commodity / market-cap series
    getLiquidityElasticity.ts  # fitted multiplier vs asset
  scoring/
    liquidity-elasticity.ts    # regression: asset level ~ liquidity; multiplier + CI
  http.ts            # NEW: Express REST layer over the same data functions
```

### New SQLite tables (in shared stocks.db)
```sql
CREATE TABLE IF NOT EXISTS macro_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country TEXT,          -- ISO code or 'GLOBAL'
  currency TEXT,         -- USD, EUR, CNY...
  indicator TEXT,        -- 'M2' | 'DEBT' | 'CB_ASSETS' | 'FX_USD'
  date TEXT,             -- YYYY-MM-DD
  value REAL,            -- in local currency (native units)
  value_usd REAL,        -- converted, when applicable
  unit TEXT,
  source TEXT,
  UNIQUE(country, indicator, date, source)
);

CREATE TABLE IF NOT EXISTS asset_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset TEXT,            -- 'SP500' | 'FTSE' | 'GOLD' | 'SILVER'...
  metric TEXT,           -- 'level' | 'market_cap'
  date TEXT,
  value REAL,
  currency TEXT,
  source TEXT,
  UNIQUE(asset, metric, date, source)
);
```

### REST endpoints (Express `http.ts`)
- `GET /api/liquidity?basket=majors&from=&to=`  → global M2 (USD) time series + components
- `GET /api/debt?countries=&from=&to=`
- `GET /api/assets?asset=SP500&metric=market_cap&from=&to=`
- `GET /api/elasticity?asset=SP500&driver=global_m2` → multiplier, R², CI, scatter data

### UI (ui/, Vite + React + Recharts)
- Overview: global M2 line + global debt line + toggle asset overlays.
- Elasticity panel: scatter (liquidity Δ vs asset Δ) + fitted line + "per +1% liquidity → +Y% S&P".
- Per-country drilldown: M2 & debt by country.
- "What-if": input a projected liquidity change → range of expected asset-cap change.

---

## Phased roadmap
1. **Phase 1 — Data spine (FRED first). ✅ DONE.** `fred.ts` provider + `macro_series`/`asset_series`
   tables + `getMoneySupply` / `getGovernmentDebt` (US) verified live (US M2 $23T, debt $39T).
2. **Phase 2 — Global liquidity + FX. ✅ DONE.** `getGlobalLiquidity` = Fed + ECB + BOJ balance
   sheets summed in USD (monthly), via FRED + FX. Live: ~$17.8T, +582% since 2003.
   **KEY FINDING:** FRED's foreign **M2** series are discontinued (end 2017–2023), so the global
   line uses **central-bank balance sheets** (the QE/money-printing measure) instead. FX is current.
   True foreign M2 (incl. China/UK) deferred to a later phase via **DBnomics**.
3. **Phase 3 — Assets. ✅ DONE.** `getAssetHistory` — index/commodity levels via **Yahoo chart API**
   (SP500, FTSE, NIKKEI, GOLD, SILVER; monthly, full depth via explicit period1/period2) + true US
   equity market cap via **FRED Z.1 `NCBEILQ027S`** (US_MKTCAP, quarterly, latest ~$69.5T).
   **KEY FINDING:** Stooq is now behind a JS proof-of-work wall and multpl is JS-rendered → no clean
   free source for true *daily* S&P-only cap. Used Fed Z.1 whole-market cap (honest real dollars) +
   Yahoo levels instead. New `yahoo.ts` provider; `syncAssetSeries` helper writes to `asset_series`.
4. **Phase 4 — Elasticity engine. ✅ DONE.** `scoring/liquidity-elasticity.ts` + `get_liquidity_elasticity`.
   Returns TWO views: (a) **levels** — cumulative growth %, arc elasticity, and $-per-$ (market-cap
   gain per $1 liquidity); (b) **YoY regression** — beta/R² with auto lag scan (0–18mo).
   **KEY FINDING:** YoY co-movement is weak/negative (central banks ease into crashes), but the
   LEVELS view answers the original question: 2003+, global liquidity → US market cap ≈ **$3.85 of
   cap per $1 liquidity** (arc elasticity 1.11); → S&P arc 1.33; → gold 1.71. Reflexivity, measured.
5. **Phase 5 — REST layer. ✅ DONE.** `mcp-server/src/http.ts` on `node:http` (zero deps), port 8787.
   Routes: /api/health, /money-supply, /government-debt, /debt, /liquidity, /assets, /elasticity,
   /overview (bundled hero stats). `npm run serve`.
6. **Phase 6 — UI. ✅ DONE.** `ui/` Vite + React + Recharts. Hero tiles (with info icons), a
   "how much things move" stat-square grid per series (`/api/stats` → `scoring/series-stats.ts`:
   1y/5y/since-'03 change, CAGR, volatility, best/worst 12mo, up-years%), and debt-by-sector stack
   (country picker). Info "i" icons explain terms (CB, CAGR, volatility, reflexivity).
   **Revision:** dropped the elasticity scatter and the indexed growth chart per user — the movement
   stat squares carry the "how much things move" story more clearly; debt-by-sector is the one chart kept.
   Validated dataviz palette, light+dark. `npm run dev` → :5173. Verified typecheck + prod build + live.
7. **Later:** full country coverage (World Bank/IMF), more assets, projections/what-if, FX for a
   true global-M2-in-USD line, lead/lag heatmap.

### Multi-country + debt-by-sector expansion (✅ DONE)
- **`get_debt`** — BIS "credit to non-financial sector" via FRED, **% of GDP, quarterly, current**,
  13 countries (US, JP, GB, DE, FR, IT, CA, AU, CN, KR, IN, BR, CH). Sectors: government,
  households, corporate, private, total. Returns chosen sector + `latestBreakdown`. This captures
  the user's key insight: private credit (loans for assets) + interest is a major channel into
  assets, often rivaling government debt. US total 251% GDP (govt 111 + priv 140); JP 354%.
- **`get_money_supply`** expanded beyond US: US (FRED M2SL) + JP/KR/AU (DBnomics IMF IFS broad money),
  now reported in **native AND USD** (per-month FX via `DEXJPUS`/`DEXKOUS`/`DEXUSAL`).
  **KEY FINDING:** foreign M2 is fragmented — FRED foreign feeds discontinued; DBnomics/World Bank
  cover only a scattered subset (euro area / UK / China have no clean free current M2). BIS total
  credit (`get_debt`) is the recommended cross-country money-into-assets measure. New `dbnomics.ts`
  provider + `syncSeriesGeneric` helper (source-agnostic macro sync).

### Polish pass (audit before API — ✅ DONE)
- **Data refresh fixed:** sync helpers were fetch-once-then-frozen; now freshness-gated (12h TTL in
  `api_cache`) with `INSERT OR REPLACE` so new periods AND upstream revisions land. `get_money_supply`
  converts foreign M2 to USD per month (native kept for display). `get_liquidity_elasticity` now
  advertises `lagMonths` in its schema.
- **Extra central banks — NOT added (by design):** FRED has current balance-sheet levels only for
  Fed/ECB/BOJ; BOE/PBOC/SNB/BOC/RBA are discontinued or annual-%GDP-only. Fed+ECB+BOJ is the clean
  free maximum; more would need fragile per-bank scraping. Global liquidity stays 2003+ (WALCL start).
- US is already covered by `get_debt` (% of GDP, cross-country comparable).

## Open items to verify during build
- FRED foreign M2 series IDs (euro area, JP, UK, CN); FRED API key provisioning.
- Legality/robustness of multpl/Siblis scrape for S&P market cap; cadence.
- Whether to add FX via FRED vs exchangerate-host.
- Node version already 22+ (built-in sqlite) — confirm Express + Vite toolchain choice.
