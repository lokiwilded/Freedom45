# Skill: Shareholder Yield Analysis

## Tool
`analyze_shareholder_yield`

## Purpose
Estimate total shareholder yield for a ticker by combining dividend yield with an implied buyback proxy. Helps agents answer "How much cash is this company returning to shareholders?"

## Input
| Field | Type | Required | Default |
|---|---|---|---|
| `ticker` | string | yes | — |
| `years` | number | no | 5 |

## Output
| Field | Type | Description |
|---|---|---|
| `summary` | string | Takeaway sentence |
| `verdict` | string | `No Yield`, `Low Yield`, `Moderate Yield`, `High Yield`, `Very High Yield`, `No Data` |
| `score` | number | 0-100 yield attractiveness score |
| `dividendYield` | number \| null | Latest annual dividend / price |
| `impliedBuybackYield` | number \| null | Proxy from DPS growth gap |
| `totalShareholderYield` | number \| null | Sum of the two |
| `sustainability` | string | `Safe`, `Caution`, `Stretched`, `Unknown` |
| `payoutRatioEstimate` | number \| null | DPS / EPS TTM |
| `latestPrice` | number \| null | Current price |
| `annualDividend` | number \| null | Trailing annual DPS |
| `yearsAnalyzed` | number | Number of fiscal years in series |
| `series` | array | `{ fiscalYear, dividendYield, buybackYield, totalYield, dividendPerShare }` |
| `metadata` | object | `{ generatedAt, fromCache, sources }` |

## Verdict thresholds (total yield %)
| Verdict | Range |
|---|---|
| No Yield | 0–1% |
| Low Yield | 1–3% |
| Moderate Yield | 3–5% |
| High Yield | 5–8% |
| Very High Yield | > 8% |

## Graphable series
- `series.totalYield` — stacked yield by year.
- `series.dividendYield` and `series.buybackYield` — component breakdown.

## Data sources
- Finnhub `dividends`
- Finnhub `splits`
- Finnhub `fundamental-metrics` (EPS, revenue growth)
- Finnhub `quote`

## Caveats
- Implied buyback yield is a proxy based on DPS growth vs a 10% baseline; it is not a true share-count reduction.
- Payout ratio uses trailing EPS if available.
- Companies that return cash only via buybacks may be mislabeled if dividend history is flat.

## Example MCP call
```json
{
  "name": "analyze_shareholder_yield",
  "arguments": { "ticker": "JNJ", "years": 5 }
}
```
