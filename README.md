# Freedom45

**A macro-liquidity research platform + trading-intelligence MCP server.**

Track how much money the world's central banks and governments have created, how much debt
sits under every major economy, and how much the world's assets (stocks, indexes, gold)
actually moved with it — then explore it in a live dashboard, query it from an AI assistant,
or hit it as a plain REST API.

### 🌐 Live dashboard → **https://lokiwilded.github.io/Freedom45/**

---

## Why this exists

Everyone repeats "money printing pumps markets," but rarely with numbers. Freedom45 pulls the
**real** series — central-bank balance sheets, money supply, sovereign + private debt,
index/commodity history — stores them, and computes the actual relationships. It answers, with
sourced data:

- **How much money has been created**, globally and per country, and how fast.
- **How much debt** (government *and* private) sits under each economy.
- **How much every major market moved** over any window — and during specific money-printing episodes.
- **The reflexivity multiplier** — historically, each $1 of central-bank money has lined up with
  ~$3.85 of US market-cap gain (2003→2026). The dashboard shows exactly how that's derived.

### What you can build with it

- A **liquidity dashboard** (already built) — hero stats, QE-episode breakdowns, movement stats, debt-by-sector.
- An **AI research assistant** — point Claude at the MCP server and ask "how did gold move during QE3?" or "show me Japan's debt by sector."
- Your **own charts / notebooks / bots** — the REST API returns clean JSON for any of it.
- **Congressional-trade & insider screens** — outlier-scored trades with live prices.
- **Company deep-dives** — 22 equity-research tools (fundamentals, valuation, ownership, news, filings).

---

## Table of contents

- [Quick start](#quick-start)
- [Three ways to use it](#three-ways-to-use-it)
- [The dashboard](#the-dashboard)
- [How the 3.85 multiplier is calculated](#how-the-385-multiplier-is-calculated)
- [How data flows](#how-data-flows)
- [Data sources](#data-sources)
- [MCP tools (29)](#mcp-tools-29)
  - [Macro / liquidity (6)](#macro--liquidity-6)
  - [Congressional trading (1)](#congressional-trading-1)
  - [Company & market analysis (22)](#company--market-analysis-22)
- [REST API](#rest-api)
- [Running it](#running-it)
- [Refreshing data & deploying](#refreshing-data--deploying)
- [Repo layout](#repo-layout)
- [Data model](#data-model)
- [Honest caveats](#honest-caveats)

---

## Quick start

```bash
git clone https://github.com/lokiwilded/Freedom45.git
cd Freedom45
cp .env.example .env      # add FRED_API_KEY (free) and FINNHUB_API_KEY (free)

# API + dashboard (two terminals)
cd mcp-server && npm install && npm run serve      # REST API on :8787
cd ui          && npm install && npm run dev       # dashboard on :5173
```

Open **http://localhost:5173**. Keys: [FRED](https://fred.stlouisfed.org/docs/api/api_key.html)
(macro), [Finnhub](https://finnhub.io) (stock tools). **Node.js 22+** required (built-in `node:sqlite`).

---

## Three ways to use it

| Way | What it is | Entry point |
|---|---|---|
| **MCP server** | 29 tools an AI assistant can call | `mcp-server/src/index.ts` |
| **REST API** | Read-only JSON over the macro tools | `mcp-server/src/http.ts` → `:8787` |
| **Dashboard** | Vite + React + Recharts web app | `ui/` → GitHub Pages |

All three share the same data layer, so they never drift. Everything runs on **free** sources.

---

## The dashboard

Single page, light/dark, mobile-friendly:

- **The reflexivity multiplier — explained** — an interactive example (enter money created → see
  the implied market-cap gain at the historical ratio), the full **step-by-step derivation** with
  the real numbers and sources, and an honest "what it can / can't tell you."
- **Hero tiles** — global CB liquidity, US market cap, US total debt (% GDP), US M2, the multiplier.
  Each has an **ⓘ** info icon.
- **When money was added, what happened** — QE1–3, COVID QE and a QT episode, each with duration
  and how the S&P, US market cap and gold moved. *COVID QE: +$10.1T over 25mo → S&P +53%.*
- **How much things move** — 15 series (US / Europe / Asia / commodities / macro): change over
  1y/5y/since-2003, CAGR, volatility, best & worst 12 months, % up-years.
- **Debt by sector** — government + households + corporate, % of GDP, 10 countries.

In production it reads static JSON baked at build time (Pages can't run a server); in dev it hits
the live API.

---

## How the 3.85 multiplier is calculated

Measured over **Jan 2003 → Jan 2026 (23 years)** — the window where both series exist:

| Step | What | Numbers |
|---|---|---|
| 1 | **Money created** = Fed + ECB + BOJ balance sheets in USD (`WALCL`, `ECBASSETSW`, `JPNASSETS` + FX) | $2.61T → $18.33T = **+$15.73T** |
| 2 | **Reached the market** = total US equity market cap (FRED Z.1 `NCBEILQ027S`) | $9.02T → $69.51T = **+$60.49T** |
| 3 | **Divide** | $60.49T ÷ $15.73T = **3.85** |

It's a **measured historical ratio, not a mechanism or a promise** — the month-to-month link is
weak, and foreign flows / earnings / leverage move market cap too. Live at `GET /api/reflexivity`.

---

## How data flows

```
 Sources                Providers              Store                Tools / API            Surfaces
 FRED  ───┐            fred.ts      ┐                          ┌ 6 macro MCP tools ┐
 BIS   ───┤──(HTTP)──▶ yahoo.ts     ├─▶  SQLite (stocks.db) ──▶┤ 23 stock MCP tools├─▶ MCP client (AI)
 Yahoo ───┤            dbnomics.ts  │    macro_series          │                   │
 DBnom ───┤            finnhub.ts   ┘    asset_series + caches └ REST /api/* ───────┼─▶ Dashboard (dev)
 Finnhub ─┘                                                       dump-static.ts ───┴─▶ Static JSON → Pages
```

On each call: check a 12-hour freshness marker → if stale, pull full history and
`INSERT OR REPLACE` into SQLite (captures new periods *and* upstream revisions) → read the window
→ compute → return. Between refreshes everything is served locally.

---

## Data sources

| Provider | Used for | Auth | Cadence |
|---|---|---|---|
| **FRED** | US M2, US debt, BIS credit, Fed/ECB/BOJ balance sheets, FX, US market cap | free key | daily→quarterly |
| **BIS** (via FRED) | Debt by sector & country (`Q<CC><S>AM770A`) | — | quarterly |
| **Yahoo Finance** | 16 index & commodity levels | none | monthly |
| **DBnomics** | Foreign broad money (IMF IFS) where FRED is discontinued | none | monthly |
| **Finnhub** | Congressional trades + company/market data | free key | realtime→daily |

---

## MCP tools (29)

Auto-discovered and exposed over MCP (stdio). Tool inputs are shown as `{ param: type }`.

### Macro / liquidity (6)

**`get_global_liquidity`** — Fed + ECB + BOJ balance sheets summed in USD, monthly (the "money
printing" measure).
```js
get_global_liquidity({ from?: "2003-01-01", to?: "2026-01-01" })
// → { data:[{date,total_usd,total_trillions,components:{US,EA,JP}}], latest, changePct, banks }
```

**`get_money_supply`** — broad money (M2) by country, in **native + USD** (per-month FX).
```js
get_money_supply({ country?: "US" })   // US, JP, KR, AU
// → { data:[{date,value,valueUsd}], latestUsdTrillions, changeUsdPct, currency, source }
```

**`get_debt`** — debt by sector & country, **% of GDP** (BIS), with a full sector breakdown.
```js
get_debt({ country?: "US", sector?: "total" })
// country: US JP GB DE FR IT CA AU CN KR IN BR CH
// sector:  government | households | corporate | private | total
// → { data:[{date,value}], latestBreakdown:{government,households,corporate,private,total} }
```

**`get_government_debt`** — US total public debt in absolute USD (FRED `GFDEBTN`).
```js
get_government_debt({ country?: "US" })   // → { data, latest, changePct, unit:"Millions of USD" }
```

**`get_asset_history`** — index & commodity levels + true US market cap.
```js
get_asset_history({ asset: "NASDAQ" })
// assets: SP500 NASDAQ DOW FTSE DAX ESTOXX50 CAC40 NIKKEI HANGSENG SHANGHAI KOSPI ASX200 TSX GOLD SILVER US_MKTCAP
// → { data:[{date,value}], latest, metric:"level"|"market_cap", label }
```

**`get_liquidity_elasticity`** — how an asset moves with a liquidity driver: a **levels ratio**
($-per-$, arc elasticity) and a **YoY regression** (β, R², lag scan, what-if).
```js
get_liquidity_elasticity({ driver?: "global_liquidity", asset?: "SP500", lagMonths?: 0 })
// driver: global_liquidity | us_m2 | us_debt
// → { levels:{dollarsPerDollar,arcElasticity,...}, regression:{beta,r2,...}, whatIf, scatter, lagMonths }
```

### Congressional trading (1)

**`get_congress_trades`** — US House/Senate trades with an **outlier score (0–100)**, live prices,
market cap and a viability assessment.
```js
get_congress_trades({
  symbol?: "NVDA", days_back?: 90, chamber?: "senate", party?: "democrat",
  outlier_score_min?: 60, market_cap_min?: 1e7, market_cap_max?: 1e12,
  included_tickers?: ["NVDA"], excluded_tickers?: ["SPY"],
  include_live_price?: true, limit?: 50
})
// → trades with { live_price, market_cap, outlier_score, outlier_label, viability, viability_reason }
```

### Company & market analysis (22)

Finnhub-backed equity research, all cached in SQLite. Most take `{ ticker }` or `{ symbol }`.

| Tool | Returns | Example |
|---|---|---|
| `fetch_company_profile` | name, sector, market cap, description | `{ ticker: "AAPL" }` |
| `fetch_stock_quote` | live price + day range | `{ ticker: "AAPL" }` |
| `fetch_historical_prices` | daily OHLCV (append-only cache) | `{ ticker: "AAPL", years: 5 }` |
| `fetch_fundamental_metrics` | TTM & valuation metrics | `{ ticker: "AAPL" }` |
| `fetch_peers` | peer tickers | `{ ticker: "AAPL" }` |
| `analyze_long_term_trend` | multi-year trend summary | `{ ticker: "AAPL" }` |
| `analyze_valuation` | composite valuation read | `{ ticker: "AAPL" }` |
| `analyze_relative_strength` | strength vs peers/market | `{ ticker: "AAPL" }` |
| `search_stocks` | symbol search | `{ query: "apple" }` |
| `get_insider_transactions` | insider buys/sells | `{ symbol: "AAPL" }` |
| `get_institutional_ownership` | 13F holders | `{ symbol: "AAPL" }` |
| `get_fund_ownership` | fund holders | `{ symbol: "AAPL" }` |
| `get_company_news` | company headlines | `{ symbol: "AAPL", from, to }` |
| `get_market_news` | general market news | `{ category: "general" }` |
| `get_earnings_calendar` | upcoming earnings | `{ from, to }` |
| `get_earnings_surprise` | actual vs estimate | `{ symbol: "AAPL" }` |
| `get_recommendation_trends` | analyst buy/hold/sell | `{ symbol: "AAPL" }` |
| `get_price_target` | consensus target | `{ symbol: "AAPL" }` |
| `get_upgrade_downgrade` | rating changes | `{ symbol: "AAPL" }` |
| `get_dividends` | dividend history | `{ symbol: "AAPL", from, to }` |
| `get_splits` | split history | `{ symbol: "AAPL", from, to }` |
| `get_sec_filings` | SEC filings | `{ symbol: "AAPL", from, to }` |

Scoring engines live in `mcp-server/src/scoring/` (outlier detection, series stats,
liquidity-elasticity math).

---

## REST API

Read-only JSON on `http://localhost:8787` (`npm run serve`). Examples:

```bash
curl http://localhost:8787/api/reflexivity
# → { "multiplier":3.85, "window":{"from":"2003-01-01","to":"2026-01-01","years":23},
#     "liquidity":{"addedTrillions":15.73,"banks":[...]}, "marketCap":{"addedTrillions":60.49}, "ratio":{...} }

curl "http://localhost:8787/api/debt?country=JP&sector=total"
curl "http://localhost:8787/api/assets?asset=NASDAQ"
```

| Endpoint | Returns |
|---|---|
| `GET /api/health` | Liveness check |
| `GET /api/overview` | Bundled hero numbers (one round-trip) |
| `GET /api/reflexivity` | Full multiplier derivation (sourced, step numbers) |
| `GET /api/stats` | Movement stats for all 15 dashboard series |
| `GET /api/injections` | QE/QT episodes + durations + asset responses |
| `GET /api/liquidity` | Global CB liquidity time series |
| `GET /api/money-supply?country=US` | M2 series (native + USD) |
| `GET /api/debt?country=US&sector=total` | Debt series + sector breakdown |
| `GET /api/government-debt?country=US` | US public debt (absolute USD) |
| `GET /api/assets?asset=SP500` | Asset/index history |
| `GET /api/elasticity?driver=global_liquidity&asset=SP500` | Elasticity levels + regression |

Hitting an unknown path returns `404` with the full route list, so `GET /api/` self-documents.

---

## Running it

**As an MCP server** (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "freedom45": {
      "command": "npx",
      "args": ["tsx", "ABSOLUTE/PATH/TO/Freedom45/mcp-server/src/index.ts"],
      "env": { "FRED_API_KEY": "your_key", "FINNHUB_API_KEY": "your_key" }
    }
  }
}
```
Then ask your assistant things like *"global liquidity vs the Nasdaq since 2010"*,
*"Japan's debt by sector"*, or *"congress trades in NVDA with outlier score over 60."*

**As the dashboard** — `npm run serve` (mcp-server) + `npm run dev` (ui) → localhost:5173.

**Tests** (from `mcp-server/`): `npm run test:offline` (no network) runs registry + cache +
calculation tests. Live tool checks: `test:liquidity`, `test:debt`, `test:assets`,
`test:elasticity`, `test:macro`, `test:congress`, `test:valuation`, `test:relative-strength`.

---

## Refreshing data & deploying

The live site serves a **static snapshot** (Pages can't run Node). Data is monthly/quarterly, so
refresh occasionally:

```bash
cd mcp-server
npm run dump-static           # regenerates ui/public/data/*.json (needs FRED_API_KEY + network)
cd ..
git add ui/public/data && git commit -m "chore: refresh data" && git push
```
Every push to `loki`/`main` runs `.github/workflows/deploy.yml`, which builds `ui/` and publishes
to GitHub Pages.

---

## Repo layout

```
Freedom45/
├── mcp-server/
│   └── src/
│       ├── index.ts              # MCP server (auto-discovers tools)
│       ├── http.ts               # REST server (node:http)
│       ├── api-handlers.ts       # route logic (shared by server + dump)
│       ├── db.ts                 # SQLite (node:sqlite)
│       ├── providers/            # fred, yahoo, dbnomics, finnhub
│       ├── tools/macro/          # the 6 macro tools
│       ├── tools/long-analysis/  # the 22 company tools
│       ├── tools/get-congress-trades.ts
│       ├── scoring/              # outlier + series-stats + elasticity math
│       └── scripts/dump-static.ts
├── ui/                           # Vite + React + Recharts dashboard
│   └── public/data/              # baked JSON snapshot (served on Pages)
├── skills/  plans/               # tool docs & design notes
└── .github/workflows/deploy.yml  # Pages deploy
```

---

## Data model

One SQLite file (`stocks.db`, `node:sqlite`, WAL). Key tables:

| Table | Holds |
|---|---|
| `macro_series` | money supply, debt (all sectors), CB assets, FX — `(country, indicator, date, source)` |
| `asset_series` | index/commodity levels, US market cap — `(asset, metric, date, source)` |
| `companies`, `price_history`, `fundamentals` | company profiles & prices (stock tools) |
| `congress_trades`, `insider_transactions` | trades with outlier scores |
| `api_cache` | TTL cache + per-series freshness markers |

---

## Honest caveats

- **Foreign M2 is thin** — only US/JP/KR/AU have clean current series; euro area / UK / China don't.
  `get_debt` (BIS total credit) is the fuller cross-country lens.
- **Global liquidity = Fed + ECB + BOJ** — the free/clean maximum on FRED.
- **"US market cap" is the whole US market** (Fed Z.1), broader than the S&P 500; quarterly.
- **Index history** starts ~1985 (indexes) / 2000 (metals).
- **Correlation, not causation** — the reflexivity ratio is descriptive and trend-dominated; the
  YoY regression (the honest short-run test) is weak. Both are shown on purpose.
  **Research tooling, not investment advice.**

---

*Branches: `loki` (active), `main` (default/combined), `template` (scaffold). Never commit `.env`
or `node_modules/`. Run `npx tsc --noEmit` before committing.*
