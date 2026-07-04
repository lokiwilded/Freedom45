# get_congress_trades

Track what US Senators and Representatives are buying and selling. Uses the Finnhub congressional trading API (free tier, 60 calls/min).

## Usage

```
get_congress_trades({
  symbol?: "AAPL",           // Filter by ticker
  days_back?: 30,            // How far back (1-365, default 30)
  chamber?: "senate",        // "senate" | "house"
  party?: "democrat",        // "democrat" | "republican"
  min_amount?: "$15,001-$50,000",  // Minimum trade size bucket
  limit?: 50                 // Max results (1-100, default 50)
})
```

## Example

```
get_congress_trades({ symbol: "NVDA", days_back: 90 })
```

Returns all congressional trades in NVDA from the last 90 days.

## Output

```json
{
  "trades": [
    {
      "politician": "Nancy Pelosi",
      "chamber": "House",
      "party": "Democrat",
      "ticker": "NVDA",
      "asset": "NVIDIA Corporation",
      "type": "Purchase",
      "amount": "$1,001 - $15,000",
      "date": "2025-06-15",
      "filed": "2025-07-01"
    }
  ],
  "total": 1,
  "from_cache": true
}
```

## Caching

- API responses cached for 5 minutes in `data/api_cache.db`
- Trades also stored permanently in `data/congress.db` for historical queries
- Cache key format: `congress:{symbol}:{from}:{to}`

## Data Source

Finnhub `/stock/congressional-trading` endpoint. Aggregates data from:
- Senate: `efdsearch.senate.gov` (STOCK Act disclosures)
- House: `disclosures-clerk.house.gov`

## Rate Limits

- Finnhub free tier: 60 calls/min, 30 calls/sec
- The provider handles rate limiting automatically with backoff

## Setup

Requires `FINNHUB_API_KEY` environment variable. Get a free key at https://finnhub.io