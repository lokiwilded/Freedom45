# Skill: Insider Sentiment Analysis

## Tool
`analyze_insider_sentiment`

## Purpose
Score insider buying/selling pressure for a ticker over a configurable lookback window. Useful for agents that want to answer "Are insiders buying or selling?" or to plot insider activity alongside price.

## Input
| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `ticker` | string | yes | — | Stock ticker, e.g. `AAPL` |
| `lookbackDays` | number | no | 90 | Days back to analyze (max 365) |

## Output
| Field | Type | Description |
|---|---|---|
| `summary` | string | 1-sentence takeaway for the user |
| `verdict` | string | `Heavy Accumulation`, `Accumulation`, `Neutral`, `Distribution`, `Heavy Distribution`, `No Data` |
| `score` | number | 0-100 composite bullishness score |
| `buyCount` | number | Purchase transactions |
| `sellCount` | number | Sale transactions |
| `buySellRatio` | number \| null | Buys ÷ sells |
| `totalBuyValue` | number \| null | Sum of buy transaction values |
| `totalSellValue` | number \| null | Sum of sale transaction values |
| `netBuyValue` | number \| null | `totalBuyValue - totalSellValue` |
| `officerBuyValue` | number \| null | Buys by officers/executives |
| `directorBuyValue` | number \| null | Buys by directors |
| `largestBuy` | object \| null | `{ insiderName, date, value }` |
| `series` | array | `{ date, netBuys, netBuyValue }` for graphing |
| `metadata` | object | `{ generatedAt, fromCache, sources }` |

## Verdict thresholds
| Verdict | Typical condition |
|---|---|
| Heavy Accumulation | Buy/sell ratio ≥ 4 and strong net buy value |
| Accumulation | Ratio 1.5–4, net buying |
| Neutral | Balanced activity |
| Distribution | Ratio 0.25–0.67, net selling |
| Heavy Distribution | Ratio ≤ 0.25 |
| No Data | No insider transactions in window |

## Graphable series
- `series.netBuys` — daily net number of insider purchases vs sales.
- `series.netBuyValue` — daily net dollar value of insider activity.

## Data sources
- Finnhub `insider-transactions`
- Finnhub `company-profile` (market cap context)
- Finnhub `quote` (latest price)

## Caveats
- Transaction codes are inferred from Finnhub (`P`-prefix = purchase).
- Officer/director classification is heuristic based on name text.
- Dollar values are as-reported and may include estimates.
- Low-activity tickers may return `No Data`.

## Example MCP call
```json
{
  "name": "analyze_insider_sentiment",
  "arguments": { "ticker": "AAPL", "lookbackDays": 90 }
}
```
