# Skill: Sector Valuation Comparison

## Tool
`compare_sector_valuation`

## Purpose
Compare a ticker's valuation multiples against its sector peers. Produces percentile ranks, a PEG-style growth-adjusted score, rank-in-sector, and value-trap flags. Useful for "Is X cheap vs peers?" questions.

## Input
| Field | Type | Required |
|---|---|---|
| `ticker` | string | yes |

## Output
| Field | Type | Description |
|---|---|---|
| `summary` | string | Takeaway sentence |
| `verdict` | string | `Deeply Undervalued`, `Undervalued`, `Fairly Valued`, `Overvalued`, `Expensive`, `Insufficient Data` |
| `score` | number | 0-100 composite value score |
| `peerCount` | number | Ticker + peers analyzed |
| `rankInSector` | number \| null | Rank by score (1 = cheapest) |
| `percentiles` | object | `{ pe, pb, ps, evEbitda, peg }` percentiles |
| `peg` | object | `{ value, growthProxy, description }` |
| `valueTrapFlags` | string[] | Warnings about cheap-looking but risky stocks |
| `table` | array | Peer + self rows with multiples, PEG, score |
| `metadata` | object | `{ generatedAt, fromCache, sources }` |

## Verdict thresholds
| Verdict | Score range |
|---|---|
| Deeply Undervalued | 80–100 |
| Undervalued | 60–79 |
| Fairly Valued | 40–59 |
| Overvalued | 20–39 |
| Expensive | 0–19 |
| Insufficient Data | No metrics available |

## Graphable output
- `table` can be rendered as a scatter plot (PE vs PEG) or a ranked bar chart.
- `percentiles` can be shown as a radar/heatmap.

## Data sources
- Finnhub `peers`
- Finnhub `fundamental-metrics` (P/E, P/B, P/S, EV/EBITDA, revenue growth, margin, debt/equity)
- Reuses `analyze_valuation`

## Caveats
- Peer sets from Finnhub may be small (< 3).
- PEG uses revenue growth as a growth proxy, not earnings growth.
- Value-trap flags are heuristic and should not replace due diligence.

## Example MCP call
```json
{
  "name": "compare_sector_valuation",
  "arguments": { "ticker": "MSFT" }
}
```
