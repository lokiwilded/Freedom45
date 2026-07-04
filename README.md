# Freedom45 – MCP Server for Trading & Investing Intelligence

## Overview
Freedom45 is a modular MCP (Micro‑Component Processor) server that powers a set of trading and investing intelligence tools.  Two independent workspaces are maintained within the same codebase:

* **Loki** – focuses on congressional trading data with sophisticated outlier detection.
* **Matt** – provides long‑term company profile analytics.

Both toolsets share a common infrastructure (SQLite persistence, caching, Finnhub API wrappers) and expose their functionality via the generic MCP framework.

## Quick Start
```bash
# Clone the repository and move into the MCP server package
git clone https://github.com/lokiwilded/Freedom45.git
cd Freedom45
cd mcp-server

# Install dependencies
npm install

# Provide your Finnhub API key (free tier available at https://finnhub.io)
echo "FINNHUB_API_KEY=your_key_here" > ../.env

# Start the server
npx tsx src/index.ts
```

> **⚠️ Production warning** – Running the MCP server in a public Git repository that is routinely pushed to can accidentally expose the Finnhub key or real‑time data to end‑users.  Ensure the `.env` file is excluded via `.gitignore` and never commit it.

## Available Tools
The MCP server auto‑discovers all tools in `src/tools`.  Below is a snapshot of the two primary tool families.

### `get_congress_trades`
| Parameter | Description | Example |
|-----------|-------------|---------|
| `symbol` | Stock symbol to query (e.g., **AAPL**) | `"AAPL"` |
| `days_back` | Number of days in the past to look for trades | `90` |
| `chamber` | House (`h`) or Senate (`s`) | `"h"` |
| `party` | Congressman party filter (`d`, `r`, or undefined) | `"d"` |
| `outlier_score_min` | Minimum outlier score to surface (0‑100) | `30` |
| `market_cap_max` | Upper bound on company market‑cap (USD) | `1e12` |
| `market_cap_min` | Lower bound on company market‑cap (USD) | `1e6` |
| `excluded_tickers` / `included_tickers` | Blacklist / whitelist of symbols | `["TSLA"]` |
| `include_live_price` | Whether to fetch the current price of each ticker | `true` |

| What the tool returns | Overview |
|-----------------------|----------|
| `live_price` | Latest market price from Finnhub | `$162.34` |
| `market_cap` | Current market value of the company | `$2.5T` |
| `outlier_score` | 0‑100 score representing how unusual the trade is (higher = more suspicious) | `78` |
| `viability` | Generic assessment (`viable`, `caution`, `too_far`, `unknown`) | `viable` |
| `viability_reason` | Short explanation of the assessment | `Insufficient data` |
| `outlier_label` | Convenience label (`low`, `medium`, `high`, `very_high`) | `high` |

---

### `fetch_company_profile`
| Parameter | Description | Example |
|-----------|-------------|---------|
| `ticker` | Target ticker for the profile lookup | `"AAPL"` |

| What the tool returns | Overview |
|-----------------------|----------|
| `name`, `sector`, `industry` | Basic company identifiers | `Apple Inc.`, `Information Technology`, `Consumer Electronics` |
| `market_cap` | Current market value | `$2.3T` |
| `description` | Company overview from Finnhub | `Apple designs, manufactures…` |
| `financials` | Summary of key financial metrics | `Revenue: $365B`, `EBITDA: $110B` |

The tool supports a two‑tier cache:

1. **`companies` table** – Persisted per‑ticker metadata.
2. **TTL cache (`api_cache` table)** – Short‑lived snapshots of the full profile.

## Outlier Scoring Engine
The scoring engine (`src/scoring/outlier.ts`) evaluates each trade on a 0‑100 scale, broken down into five factors:

| Factor | Weight |
|--------|--------|
| Market‑cap alignment | 0‑20 |
| Trade size percentage | 0‑25 |
| Buy vs. sell bias | 0‑25 |
| Consensus alignment | 0‑15 |
| Recency penalty | 0‑15 |

The resultant score is mapped to a label:

| Score Range | Label |
|-------------|-------|
| 0‑24 | `low` |
| 25‑49 | `medium` |
| 50‑74 | `high` |
| 75‑100 | `very_high` |

A higher score indicates a more anomalous trade that warrants deeper investigation.

## Testing
All tests live under `src/test/`.  Run them with the following NPM scripts.

```bash
# Congress trade test with outlier scoring (default ticker AAPL)
npm run test:congress
# or a custom ticker
npm run test:congress -- NVDA

# Company profile test
npm run test:profile

# Cache‑only test
npm run test:cache
```

The tests use a temporary `.env` file in the repository root.  Make sure `FINNHUB_API_KEY` is present before running.

## Branches
* **`loki`** – Current playground for outlier detection and congressional trading.  All commits target these frameworks.
* **`main`** – Long‑term integration of Marcus‑style company‑profile analysis.
* **`template`** – Base project scaffolding used for new servers.

The `loki` branch is the authoritative source for `get_congress_trades`; the `main` branch will eventually merge tools from both sides.

## Environment & Dependencies
| Item | Requirement |
|------|-------------|
| **Node.js** | 22+ (ES modules, built‑in `node:sqlite`) |
| **Finnhub API key** | Free tier subscription at https://finnhub.io |
| **SQLite** | Stored in `src/db.ts`; no external server required |
| **Dependencies** | Listed in `package.json`; run `npm install` |

## Contribution Guidelines
1. Fork and clone the repo.
2. Create a branch off `loki` or `main` depending on your work.
3. Run `npm install`.  Familiarize yourself with the test harness.
4. Write or modify tools, then add / update tests in `src/test/`.
5. Commit with clear subject lines and run `npm run test` before pushing.
6. Open a PR; ensure all tests pass locally and the commit diff is minimal.

**Important**: Never commit `.env` files or any sensitive keys.  Use the provided `.env.example` template.

---

For full usage details of each tool, refer to the corresponding documentation in `skills/`.
