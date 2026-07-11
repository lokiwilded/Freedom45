# Skill: Sector Relative Strength

## Tool
`get_sector_relative_strength`

## Purpose
Analyze a sector proxy's relative strength versus a benchmark and its sensitivity to global liquidity. Useful for "Is tech leading the market?" or sector-rotation questions.

## Input
| Field | Type | Required | Default |
|---|---|---|---|
| `ticker` | string | yes | — |
| `benchmark` | string | no | SP500 |
| `years` | number | no | 3 |

## Output
| Field | Type | Description |
|---|---|---|
| `summary` | string | Takeaway sentence |
| `verdict` | string | `Leading`, `Improving`, `Stable`, `Weakening`, `Lagging`, `No Data` |
| `score` | number | 0-100 relative-strength score |
| `alpha` | number \| null | Jensen's alpha vs SPY |
| `beta` | number \| null | Market beta |
| `sharpe` | number \| null | Approx. Sharpe ratio |
| `liquidityBeta` | number \| null | Beta vs global liquidity YoY changes |
| `liquidityR2` | number \| null | Liquidity regression R² |
| `tickerReturn` | number \| null | Total return % over window |
| `benchmarkReturn` | number \| null | Benchmark return % over window |
| `monthsOutperforming` | number \| null | Months beating benchmark |
| `totalMonths` | number \| null | Total overlapping months |
| `series` | array | `{ date, tickerNormalized, benchmarkNormalized, relativeRatio }` |
| `metadata` | object | `{ generatedAt, fromCache, sources }` |

## Verdict thresholds
| Verdict | Condition |
|---|---|
| Leading | Score ≥ 75 and positive alpha |
| Improving | Score ≥ 55 |
| Stable | Middle range |
| Weakening | Score ≤ 45 |
| Lagging | Score ≤ 25 and negative alpha |
| No Data | No price history |

## Graphable series
- `series.tickerNormalized` — sector proxy rebased to 100.
- `series.benchmarkNormalized` — benchmark rebased to 100.
- `series.relativeRatio` — sector / benchmark ratio.

## Data sources
- Finnhub `historical-prices` (via `analyze_relative_strength`)
- Yahoo Finance / FRED `get_asset_history`
- FRED `get_liquidity_elasticity`

## Caveats
- Sector proxies like `XLK` work best; individual stocks may be more volatile.
- Liquidity beta requires the ticker to be one of the supported macro asset keys or have enough history.
- Sharpe is a quick approximation using total return / volatility.

## Example MCP call
```json
{
  "name": "get_sector_relative_strength",
  "arguments": { "ticker": "XLK", "benchmark": "SP500", "years": 3 }
}
```
