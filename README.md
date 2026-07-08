# Freedom45

**A macro-liquidity research platform + trading-intelligence MCP server.**

Track how much money the world's central banks and governments have created, how much debt
sits under every major economy, and how much the world's assets (stocks, indexes, gold)
actually moved with it — then explore it in a live dashboard or query it from an AI assistant.

### 🌐 Live dashboard → **https://lokiwilded.github.io/Freedom45/**

The original question this answers: *"When money gets added, assets usually rise — by how
much, historically?"* Freedom45 pulls the real series (central-bank balance sheets, money
supply, sovereign + private debt, index/commodity history), stores them, and computes the
movement — no hand-waving.

---

## Table of contents

- [What's in the box](#whats-in-the-box)
- [The dashboard](#the-dashboard)
- [How data flows](#how-data-flows)
- [Data sources](#data-sources)
- [MCP tools](#mcp-tools)
  - [Macro / liquidity](#macro--liquidity-6-tools)
  - [Congressional trading](#congressional-trading)
  - [Company & market analysis](#company--market-analysis-20-tools)
- [REST API](#rest-api)
- [Running it](#running-it)
- [Refreshing data & deploying](#refreshing-data--deploying)
- [Repo layout](#repo-layout)
- [Honest caveats](#honest-caveats)

---

## What's in the box

Three ways to use the same data:

| Layer | What it is | Entry point |
|---|---|---|
| **MCP server** | 27 tools an AI assistant (Claude, etc.) can call | `mcp-server/src/index.ts` |
| **REST API** | Read-only JSON over the macro tools | `mcp-server/src/http.ts` → `:8787` |
| **Dashboard** | Vite + React + Recharts web app | `ui/` → GitHub Pages |

Everything runs on **free** data sources (FRED, BIS, Yahoo Finance, DBnomics; Finnhub for the
stock tools). Only FRED and Finnhub need a free API key.

---

## The dashboard

A single-page, light/dark, mobile-friendly view of the whole picture:

- **Hero tiles** — global central-bank liquidity, total US equity market cap, US total debt
  (% of GDP), US M2, and the *reflexivity* ratio ($ of market cap gained per $1 of central-bank
  liquidity added). Every tile has an **ⓘ info icon** explaining the term.
- **"When money was added, what happened"** — the major QE episodes (QE1–3, COVID QE) plus one
  tightening (QT), each showing how much liquidity went in over the window and how the S&P 500,
  total US market cap, and gold responded. *e.g. COVID QE: +$10.1T → S&P +53%, US cap +48%.*
- **"How much things move"** — a stat card per series (15 of them, grouped US / Europe / Asia /
  Commodities / Macro): cumulative change over 1y / 5y / since-2003, annualized growth (CAGR),
  volatility, best & worst 12 months, and % of up-years — all computed from full history.
- **Debt by sector** — government + households + corporate, % of GDP, stacked, for 10 countries.

In production it reads static JSON baked at build time (Pages can't run a server); in local dev
it hits the live API.

---

## How data flows

```
 Sources                Providers              Store                Tools / API            Surfaces
 ───────                ─────────              ─────                ───────────            ────────
 FRED  ───┐            fred.ts      ┐                          ┌ 6 macro MCP tools ┐
 BIS   ───┤──(HTTP)──▶ yahoo.ts     ├─▶  SQLite (stocks.db) ──▶┤ 21 stock MCP tools├─▶ MCP client (AI)
 Yahoo ───┤            dbnomics.ts  │    macro_series          │                   │
 DBnom ───┤            finnhub.ts   ┘    asset_series          └ REST /api/* ──────┼─▶ Dashboard (dev)
 Finnhub ─┘                              + caches                 dump-static.ts ──┴─▶ Static JSON → Pages
```

On each call: check a 12-hour freshness marker → if stale, pull full history from the source
and `INSERT OR REPLACE` into SQLite (captures new periods *and* upstream revisions) → read the
window back → compute → return. Between refreshes everything is served locally.

---

## Data sources

| Provider | Used for | Auth | Cadence |
|---|---|---|---|
| **FRED** | US M2, US debt, BIS credit, Fed/ECB/BOJ balance sheets, FX, US market cap | free key | daily→quarterly |
| **BIS** (via FRED) | Debt by sector & country (`Q<CC><S>AM770A`) | — | quarterly |
| **Yahoo Finance** | Index & commodity levels (S&P, Nasdaq, DAX, Nikkei, gold, …) | none | monthly |
| **DBnomics** | Foreign broad money (IMF IFS) where FRED is discontinued | none | monthly |
| **Finnhub** | Congressional trades + company/market data (stock tools) | free key | realtime→daily |

---

## MCP tools

The server auto-discovers every tool and exposes it over MCP (stdio). **27 tools** in three
families.

### Macro / liquidity (6 tools)

| Tool | What it returns |
|---|---|
| `get_global_liquidity` | Fed + ECB + BOJ balance sheets summed in USD, monthly (the "money printing" measure). ~$17.8T, +582% since 2003. |
| `get_money_supply` | Broad money (M2) by country in **native + USD**. US (FRED); JP/KR/AU (DBnomics), FX-converted per month. |
| `get_debt` | Debt by sector — government / households / corporate / private / total — **% of GDP**, 13 countries (BIS). |
| `get_government_debt` | US total public debt in absolute USD (FRED `GFDEBTN`). |
| `get_asset_history` | Index & commodity levels (16 assets: SP500, NASDAQ, DOW, FTSE, DAX, ESTOXX50, CAC40, NIKKEI, HANGSENG, SHANGHAI, KOSPI, ASX200, TSX, GOLD, SILVER) + true US equity market cap (Fed Z.1). |
| `get_liquidity_elasticity` | How an asset moves with a liquidity driver — a **levels ratio** ($-per-$, arc elasticity) and a **YoY regression** (β, R², lag scan, what-if). |

### Congressional trading

| Tool | What it returns |
|---|---|
| `get_congress_trades` | US House/Senate trades with an **outlier score (0–100)**, live prices, market cap, and viability assessment. Rich filters (chamber, party, ticker, market-cap band, min score). |

### Company & market analysis (20 tools)

Finnhub-backed equity research, all cached in SQLite:

`fetch_company_profile` · `fetch_stock_quote` · `fetch_historical_prices` ·
`fetch_fundamental_metrics` · `fetch_peers` · `analyze_long_term_trend` · `search_stocks` ·
`get_insider_transactions` · `get_company_news` · `get_market_news` · `get_earnings_calendar` ·
`get_earnings_surprise` · `get_recommendation_trends` · `get_price_target` ·
`get_upgrade_downgrade` · `get_dividends` · `get_splits` · `get_sec_filings` ·
`get_institutional_ownership` · `get_fund_ownership`

---

## REST API

Read-only JSON on `http://localhost:8787` (`npm run serve` in `mcp-server`). The dashboard uses
these; you can curl them too.

| Endpoint | Returns |
|---|---|
| `GET /api/overview` | Bundled hero numbers (one round-trip) |
| `GET /api/stats` | Movement stats for all 15 dashboard series |
| `GET /api/injections` | The QE/QT episodes + asset responses |
| `GET /api/liquidity` | Global CB liquidity time series |
| `GET /api/money-supply?country=US` | M2 series (native + USD) |
| `GET /api/debt?country=US&sector=total` | Debt series + sector breakdown |
| `GET /api/assets?asset=SP500` | Asset/index history |
| `GET /api/elasticity?driver=global_liquidity&asset=SP500` | Elasticity levels + regression |
| `GET /api/health` | Liveness check |

---

## Running it

**Requirements:** Node.js 22+ (uses the built-in `node:sqlite`), a free
[FRED API key](https://fred.stlouisfed.org/docs/api/api_key.html), and (for the stock tools) a
free [Finnhub key](https://finnhub.io).

```bash
git clone https://github.com/lokiwilded/Freedom45.git
cd Freedom45

# keys
cp .env.example .env      # then edit:  FRED_API_KEY=...   FINNHUB_API_KEY=...

cd mcp-server && npm install
```

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

**As the dashboard** (two terminals):

```bash
# 1) API  (mcp-server/)
npm run serve                 # http://localhost:8787

# 2) UI   (ui/)
npm install                   # first time
npm run dev                   # http://localhost:5173  (proxies /api → :8787)
```

**Quick tool tests** (from `mcp-server/`): `npm run test:liquidity`, `test:debt`,
`test:assets`, `test:macro`, `test:elasticity`, `test:congress`.

---

## Refreshing data & deploying

The live site serves a **static snapshot** (Pages can't run Node). Data is monthly/quarterly,
so refreshing occasionally is plenty:

```bash
cd mcp-server
npm run dump-static           # regenerates ui/public/data/*.json (needs FRED_API_KEY + network)
cd ..
git add ui/public/data && git commit -m "chore: refresh data" && git push
```

Every push to `loki`/`main` runs `.github/workflows/deploy.yml`, which builds `ui/` and
publishes to GitHub Pages automatically.

---

## Repo layout

```
Freedom45/
├── mcp-server/
│   └── src/
│       ├── index.ts              # MCP server (auto-discovers tools)
│       ├── http.ts               # REST server (node:http)
│       ├── api-handlers.ts       # route logic (shared by server + dump)
│       ├── db.ts                 # SQLite (node:sqlite) — macro_series, asset_series, …
│       ├── providers/            # fred, yahoo, dbnomics, finnhub
│       ├── tools/macro/          # the 6 macro tools
│       ├── tools/long-analysis/  # the 20 company tools
│       ├── tools/get-congress-trades.ts
│       ├── scoring/              # outlier + series-stats + elasticity math
│       └── scripts/dump-static.ts
├── ui/                           # Vite + React + Recharts dashboard
│   ├── src/                      # App, charts, components, api, theme
│   └── public/data/              # baked JSON snapshot (committed, served on Pages)
├── skills/                       # tool docs (macro-liquidity.md, …)
├── plans/                        # design notes & roadmap
└── .github/workflows/deploy.yml  # Pages deploy
```

---

## Honest caveats

These are the real edges of the data, surfaced so nothing implies false precision:

- **Foreign M2 is thin** — only US/JP/KR/AU have clean current series; the euro area, UK and
  China don't (no free source). `get_debt` (BIS total credit) is the fuller cross-country lens.
- **Global liquidity = Fed + ECB + BOJ** — the free/clean maximum; FRED carries current
  balance-sheet *levels* only for these three.
- **"US market cap" is the whole US market** (Fed Z.1), broader than the S&P 500; quarterly.
- **Index history depth** — monthly levels start ~1985 (indexes) / 2000 (metals).
- **Correlation, not causation** — the levels ratio ($3.85 of cap per $1 liquidity) is
  trend-dominated and descriptive; the year-over-year regression is deliberately the honest
  short-run test, and it's weak (central banks ease *into* crashes). Both views are shown on
  purpose. This is research tooling, not investment advice.

---

*Branches: `loki` (active — macro dashboard + outlier detection), `main` (combined),
`template` (scaffold). Never commit `.env` or `node_modules/`.*
