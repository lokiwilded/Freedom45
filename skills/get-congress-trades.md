# get_congress_trades

Track what US Senators and Representatives are buying and selling — with **outlier scoring**, **live prices**, and **viability assessment**. Uses the Finnhub congressional trading API (free tier, 60 calls/min).

## Enhanced Features

- **Live price** — current stock price + % change since trade date
- **Market cap** — company size for each trade
- **Outlier score (0-100)** — how interesting the trade is
- **Viability assessment** — is the trade still worth looking at?
- **Configurable filters** — market cap, tickers, minimum score

## Usage

```
get_congress_trades({
  // Basic filters
  symbol?: "AAPL",              // Filter by ticker
  days_back?: 30,               // How far back (1-365, default 30)
  chamber?: "senate",           // "senate" | "house"
  party?: "democrat",           // "democrat" | "republican"
  min_amount?: "$15,001-$50,000",  // Minimum trade size bucket
  limit?: 50,                   // Max results (1-100, default 50)

  // Outlier / enhancement filters
  outlier_score_min?: 60,       // Only show trades scoring 60+
  market_cap_max?: 500000000,   // Skip companies above this market cap
  market_cap_min?: 10000000,    // Skip companies below this market cap
  excluded_tickers?: ["SPY"],   // Tickers to always skip
  included_tickers?: ["NVDA"],  // Only show these tickers
  include_live_price?: true     // Fetch live prices (default: true)
})
```

## Example

```
get_congress_trades({ symbol: "NVDA", days_back: 90, outlier_score_min: 60 })
```

## Output

Each trade now includes:

```json
{
  "politician": "Nancy Pelosi",
  "chamber": "House",
  "party": "Democrat",
  "ticker": "NVDA",
  "asset": "NVIDIA Corporation",
  "type": "Purchase",
  "amount": "$100,001 - $250,000",
  "date": "2025-06-15",
  "filed": "2025-07-01",
  "live_price": 824.50,
  "price_change_pct": 12.3,
  "market_cap": 2000000000,
  "outlier_score": 78,
  "outlier_label": "high",
  "viability": "viable",
  "viability_reason": "Small cap ($42M) + high score (78)"
}
```

## Outlier Scoring (0-100)

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| Market cap | 0-20 | Smaller cap = more upside potential |
| Trade size | 0-25 | Bigger trade = more conviction |
| Buy vs Sell | 0-25 | Purchases score 25, sales score 5 |
| Consensus | 0-15 | Multiple politicians trading same ticker |
| Recency | 0-15 | Fresher trades are more relevant |

**Labels:** ≥80 = very_high, ≥60 = high, ≥30 = medium, <30 = low

## Viability

| Status | Meaning |
|--------|---------|
| viable | Small cap + high score — worth watching |
| caution | Score below threshold |
| too_far | Market cap too large for outlier potential |
| unknown | Insufficient data |

## Caching

- Raw trade data cached for 5 minutes in `api_cache` table
- Live prices and market caps fetched fresh per call (not cached)
- Trades stored permanently in `congress_trades` table for historical queries

## Data Source

Finnhub `/stock/congressional-trading` endpoint. Aggregates data from:
- Senate: `efdsearch.senate.gov` (STOCK Act disclosures)
- House: `disclosures-clerk.house.gov`

## Rate Limits

- Finnhub free tier: 60 calls/min, 30 calls/sec
- The provider handles rate limiting automatically with backoff
- Live price/profile fetches are batched with concurrency limit of 5

## Setup

Requires `FINNHUB_API_KEY` environment variable. Get a free key at https://finnhub.io
