# Skill: Liquidity Regime Scanner

## Tool
`scan_liquidity_regime`

## Purpose
Scan the current global liquidity regime and how it affects an asset. Combines central-bank balance sheets, US M2, asset price history, and liquidity elasticity. Useful for macro-level answers and charts.

## Input
| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `asset` | string | no | SP500 | Asset key supported by `get_asset_history` |
| `from` | string | no | 2003-01-01 | Start of history window |
| `to` | string | no | today | End of history window |

## Output
| Field | Type | Description |
|---|---|---|
| `summary` | string | Takeaway sentence |
| `verdict` | string | `Expansion (Risk-On)`, `Expansion (Caution)`, `Neutral`, `Contraction (Risk-Off)`, `Contraction (Defensive)`, `No Data` |
| `score` | number | 0-100 risk-on score |
| `liquidityYoY` | number \| null | Global CB liquidity YoY % |
| `m2YoY` | number \| null | US M2 YoY % |
| `assetYoY` | number \| null | Asset YoY % |
| `liquidityBeta` | number \| null | Regression beta vs global liquidity |
| `liquidityR2` | number \| null | Regression R² |
| `lagMonths` | number \| null | Best-fit lag months |
| `series` | array | `{ date, liquidityYoYPct, m2YoYPct, assetYoYPct }` |
| `metadata` | object | `{ generatedAt, fromCache, sources }` |

## Verdict thresholds
| Verdict | Condition |
|---|---|
| Expansion (Risk-On) | Liquidity YoY > 5% and score ≥ 60 |
| Expansion (Caution) | Liquidity YoY > 5% but score < 60 |
| Neutral | Liquidity YoY between -2% and +5% |
| Contraction (Defensive) | Liquidity YoY < -2% but score > 40 |
| Contraction (Risk-Off) | Liquidity YoY < -2% and score ≤ 40 |
| No Data | Liquidity/M2 unavailable |

## Graphable series
- `series.liquidityYoYPct` — global liquidity growth.
- `series.assetYoYPct` — asset growth.
- `series.m2YoYPct` — US M2 growth.

## Data sources
- FRED `WALCL`, `ECBASSETSW`, `JPNASSETS`, `DEXUSEU`, `DEXJPUS` — global liquidity
- FRED `M2SL` — US M2
- Yahoo Finance / FRED — asset history

## Caveats
- YoY comparisons require 12+ months of overlapping data.
- Regression relationships are descriptive, not causal; R² often low.
- Asset keys are limited to those supported by `get_asset_history`.

## Example MCP call
```json
{
  "name": "scan_liquidity_regime",
  "arguments": { "asset": "GOLD" }
}
```
