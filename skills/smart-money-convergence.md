# Skill: Smart Money Convergence

## Tool
`find_smart_money_convergence`

## Purpose
Detect when multiple "smart money" groups (insiders, institutions, mutual funds/ETFs, and members of Congress) are aligned on the same ticker. Useful for generating "who is buying together?" answers and heat-map tables.

## Input
| Field | Type | Required | Default |
|---|---|---|---|
| `ticker` | string | yes | — |
| `lookbackDays` | number | no | 90 |

## Output
| Field | Type | Description |
|---|---|---|
| `summary` | string | Takeaway sentence |
| `verdict` | string | `Very High Convergence`, `High Convergence`, `Moderate Convergence`, `Mixed Signals`, `No Convergence`, `No Data` |
| `score` | number | 0-100 convergence score |
| `overlapCount` | number | How many groups are bullish |
| `signals` | object | `{ insider, institutions, funds, congress }` each `buying`/`selling`/`neutral`/`no_data` |
| `details` | object | Counts and net values per group |
| `highlights` | string[] | Human-readable bullet points |
| `table` | array | `{ label, value, note? }` for display |
| `metadata` | object | `{ generatedAt, fromCache, sources }` |

## Verdict thresholds
| Verdict | Condition |
|---|---|
| Very High Convergence | Score ≥ 80 and ≥ 3 groups buying |
| High Convergence | Score ≥ 60 and ≥ 2 groups buying |
| Moderate Convergence | Score ≥ 40 and ≥ 2 groups buying |
| Mixed Signals | Some bullish, some bearish |
| No Convergence | No bullish alignment |
| No Data | All groups returned no data |

## Graphable output
- `table` can be rendered as a group-by-group signal grid.
- `details.netBuyValue` can be plotted as a bar chart per group.

## Data sources
- Finnhub `insider-transactions`
- Finnhub `institutional-ownership` (13F)
- Finnhub `fund-ownership`
- Finnhub `congressional-trades`

## Caveats
- 13F and fund ownership data is quarterly and lagged.
- Congressional trades are disclosed with a delay.
- "Buying" for institutions/funds is based on reported `change` field; if missing, signal may be `neutral`.

## Example MCP call
```json
{
  "name": "find_smart_money_convergence",
  "arguments": { "ticker": "TSLA", "lookbackDays": 90 }
}
```
