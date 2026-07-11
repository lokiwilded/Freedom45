# Skill: Congress News Catalyst

## Tool
`analyze_congress_news_catalyst`

## Purpose
Match congressional trades for a ticker with nearby company and market news to identify potential catalyst signals. Helps agents answer "Did congressional trades precede news?"

## Input
| Field | Type | Required | Default |
|---|---|---|---|
| `ticker` | string | yes | — |
| `lookbackDays` | number | no | 90 |

## Output
| Field | Type | Description |
|---|---|---|
| `summary` | string | Takeaway sentence |
| `verdict` | string | `High Catalyst Signal`, `Some Catalyst Signal`, `No Clear Catalyst`, `No Data` |
| `score` | number | 0-100 catalyst score |
| `tradeCount` | number | Number of congressional trades found |
| `tradesWithNews` | array | Trades with matched headline and day offset |
| `leadDaysAvg` | number \| null | Average days from trade to nearest news |
| `leadDaysMedian` | number \| null | Median days from trade to nearest news |
| `newsBeforeTrade` | number | News that occurred before the trade |
| `newsAfterTrade` | number | News that occurred after the trade |
| `series` | array | `{ date, catalystScore, type, headline? }` |
| `metadata` | object | `{ generatedAt, fromCache, sources }` |

## Verdict thresholds
| Verdict | Condition |
|---|---|
| High Catalyst Signal | Score ≥ 70 and news tends to follow trades |
| Some Catalyst Signal | Score ≥ 40 |
| No Clear Catalyst | Score < 40 |
| No Data | No trades in window |

## Graphable series
- `series.catalystScore` — event-level scores over time.
- Trade vs news events can be plotted as markers on a timeline.

## Data sources
- Finnhub `congressional-trades`
- Finnhub `company-news`
- Finnhub `market-news` (filtered for ticker mentions)

## Caveats
- News matching is within ±7 days and keyword-based.
- Congressional disclosure dates lag actual transaction dates.
- A match does not prove causation or insider information.

## Example MCP call
```json
{
  "name": "analyze_congress_news_catalyst",
  "arguments": { "ticker": "NVDA", "lookbackDays": 90 }
}
```
