# Macro / Liquidity tools

Historical macro data for the liquidity dashboard — national money supply and government
debt — sourced from **FRED** (Federal Reserve Economic Data) and persisted to SQLite
(`macro_series` table). Requires `FRED_API_KEY` in `.env` (free key from
https://fred.stlouisfed.org/docs/api/api_key.html).

Data is fetched once (full series history) per country/indicator, then served from the
local DB on subsequent calls (`fromCache: true`).

## `get_money_supply`
Money supply (M2) time series for a country.

```
get_money_supply({
  country?: "US",   // US (FRED M2SL); JP, KR, AU (DBnomics IMF IFS broad money)
  from?, to?
})
```
Returns native **and USD**: `data[]` of `{date, value (native), valueUsd}`, plus
`latestNative`, `latestUsdTrillions`, `firstUsdTrillions`, `changeUsdPct`. US is already USD
(billions, back to 1959). JP/KR/AU broad money (millions of local currency) is converted to
USD **per month** using FRED FX (`DEXJPUS`, `DEXKOUS`, `DEXUSAL`) — so yen depreciation shows
up (JP: ¥1,634T ≈ $10.8T; +35% in USD since 2000 vs much more in yen).

> Foreign M2 coverage is fragmented: FRED's foreign feeds are discontinued and no single free
> source is current for the euro area / UK / China. `get_debt` (BIS total credit) is the fuller
> cross-country "money-into-assets" measure.

## `get_debt`  (government + private, cross-country)
Debt by sector and country from **BIS credit statistics** (via FRED), **% of GDP**, quarterly.

```
get_debt({
  country?: "US",       // US, JP, GB, DE, FR, IT, CA, AU, CN, KR, IN, BR, CH
  sector?: "total",     // government | households | corporate | private | total
  from?, to?
})
```
Returns the chosen sector's series **plus `latestBreakdown`** across all sectors
(government vs households vs corporate vs private vs total). Private credit (mortgages,
business loans) is the channel where borrowed money + interest flows into assets, so it
often matters as much as government debt. `total` = government + private.

Sample: US total 251% of GDP (govt 111 + private 140); Japan 354% (govt 179 + private 175).

## `get_government_debt`  (US, absolute USD)
US total public debt in **millions of USD** (FRED `GFDEBTN`), quarterly, back to 1966 —
kept for absolute-dollar figures. Use `get_debt` for cross-country / by-sector (% of GDP).

## `get_global_liquidity`
Global liquidity = major central-bank balance sheets summed in USD (monthly). This is the
**QE / "money printing"** measure, not M2.

```
get_global_liquidity({
  from?: "2003-01-01",   // where all 3 banks overlap
  to?: "2026-07-08"
})
```
Basket (all current, all FRED): Fed (`WALCL`), ECB (`ECBASSETSW`), Bank of Japan
(`JPNASSETS`). Each is normalized to whole currency units, converted to USD via FRED FX
(`DEXUSEU`, `DEXJPUS`, monthly), and summed on a shared monthly grid. Returns per-month
`total_usd` / `total_trillions` and per-bank `components`.

> These three are the free/clean maximum: FRED has current balance-sheet *levels* only for the
> Fed, ECB and BOJ. BOE/PBOC/SNB/BOC/RBA are discontinued or annual-%GDP-only on FRED, so adding
> them would require fragile per-central-bank scraping. Starts 2003 (Fed WALCL inception).

> Note: FRED's foreign **M2** series are discontinued (end 2017–2023), which is why the
> global line uses central-bank balance sheets. True foreign M2 (incl. China/UK) is a later
> phase via DBnomics. FX rates ARE current on FRED.

## `get_asset_history`
Historical asset series, persisted to `asset_series`.

```
get_asset_history({
  asset: "SP500",   // SP500 | FTSE | NIKKEI | GOLD | SILVER | US_MKTCAP
  from?: "1900-01-01",
  to?: "2026-07-08"
})
```
- **Levels** (monthly, via Yahoo chart API): `SP500` (^GSPC), `FTSE` (^FTSE), `NIKKEI`
  (^N225), `GOLD` (GC=F), `SILVER` (SI=F). Indices back to ~1985; metals to 2000 (futures
  inception). `metric: "level"`.
- **True US equity market cap** (quarterly, real USD, via FRED Z.1): `US_MKTCAP`
  (`NCBEILQ027S` — nonfinancial corporate equities, market value), back to 1945.
  `metric: "market_cap"`.

> Sourcing note: Stooq is now behind a JS proof-of-work wall and multpl is JS-rendered, so
> there's no clean free source for true *daily* S&P-only market cap. The Fed Z.1 whole-market
> cap (US_MKTCAP) is the honest real-dollar measure; Yahoo levels give the index shapes.

## `get_liquidity_elasticity`
Fits how an asset moves with a liquidity driver, returning TWO views.

```
get_liquidity_elasticity({
  driver: "global_liquidity",  // global_liquidity | us_m2 | us_debt
  asset: "US_MKTCAP",          // SP500 | FTSE | NIKKEI | GOLD | SILVER | US_MKTCAP
  lagMonths?: 6,               // omit to auto-scan 0-18 for best-fit lag
  from?, to?
})
```
- **`levels`** — the cumulative "money went up X%, asset went up Y%, ratio Z" view. Includes
  `arcElasticity` (asset% ÷ driver%) and, when both are USD quantities (e.g.
  global_liquidity → US_MKTCAP), `dollarsPerDollar` — market-cap gain per $1 of liquidity.
  This is descriptive and trend-dominated (not causal), but it is the headline ratio.
- **`regression`** — OLS beta on **year-over-year % changes** (the honest short-run test),
  with `r`, `r2`, a lag scan, and a `whatIf` projection. Typically weak: central banks ease
  into crashes, so same-period YoY co-movement is low. The signal lives in the levels/trend.

Sample findings (2003+): global liquidity → US market cap ≈ **$3.85 of cap per $1 liquidity**
(arc elasticity 1.11); global liquidity → S&P arc elasticity 1.33; → gold 1.71.

## Roadmap
- Phase 5: thin Express REST layer over these tools.
- Phase 6: Vite + React + Recharts dashboard in `ui/`.
- Later: true foreign M2 via DBnomics (ECB/BOJ/PBOC/BOE); China + UK coverage; lead/lag heatmap.

See `plans/liquidity-macro-dashboard-plan.md` for the full design.

## Test
```bash
cd mcp-server
npm run test:macro        # US M2 + debt
npm run test:liquidity    # global central-bank liquidity (Fed+ECB+BOJ, USD)
npm run test:assets       # all asset levels + US market cap (or: -- SP500)
npm run test:elasticity   # levels ratio + YoY regression (or: -- global_liquidity SP500)
npm run test:debt         # debt by sector, multi-country (or: -- JP)
```
