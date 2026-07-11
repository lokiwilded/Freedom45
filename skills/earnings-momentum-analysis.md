# Skill: Earnings Momentum Analysis

## Tool
`analyze_earnings_momentum`

## Purpose
Combine earnings surprises, analyst recommendations, price targets, and upgrades/downgrades into a single earnings-momentum score. Helps agents answer "Is earnings momentum improving or weakening?"

## Input
| Field | Type | Required | Description |
|---|---|---|---|
| `ticker` | string | yes | Stock ticker, e.g. `AAPL` |

## Output
| Field | Type | Description |
|---|---|---|
| `summary` | string | Takeaway sentence |
| `verdict` | string | `Strong`, `Improving`, `Stable`, `Softening`, `Weak`, `No Data` |
| `score` | number | 0-100 momentum score |
| `beatStreak` | number | Consecutive quarters with positive surprise |
| `missStreak` | number | Consecutive quarters with negative surprise |
| `surpriseAvgPct` | number \| null | Average EPS surprise % |
| `buyPct` | number \| null | Latest analyst buy/strong-buy % |
| `buyPctPrior` | number \| null | Prior period buy % |
| `recommendationTrend` | string | `rising`, `falling`, `stable`, `unknown` |
| `priceTargetMean` | number \| null | Consensus mean target |
| `priceTargetChangePct` | number \| null | Pre-to-post earnings target change % |
| `upgrades90d` | number | Net upgrades in last 90 days |
| `downgrades90d` | number | Net downgrades in last 90 days |
| `upgradeDowngradeFlow` | number | `upgrades90d - downgrades90d` |
| `series` | array | `{ period, surprisePct, buyPct, holdPct, sellPct }` |
| `metadata` | object | `{ generatedAt, fromCache, sources }` |

## Verdict thresholds
| Verdict | Typical condition |
|---|---|
| Strong | Long beat streak, rising buy %, positive target/upgrade flow |
| Improving | Beat streak building, buy % rising |
| Stable | Mixed but balanced signals |
| Softening | Misses or declining buy % |
| Weak | Multiple misses, downgrades, falling targets |
| No Data | No earnings or recommendation data |

## Graphable series
- `series.surprisePct` — EPS surprise by period.
- `series.buyPct` — Analyst buy rating trend.
- `series.sellPct` — Analyst sell rating trend.

## Data sources
- Finnhub `earnings-surprises`
- Finnhub `recommendation-trends`
- Finnhub `price-target`
- Finnhub `upgrade-downgrade`

## Caveats
- Surprise % can be noisy for companies with low estimate coverage.
- Price-target change uses pre/post earnings means when available.
- Upgrade/downgrade parsing is keyword-based.

## Example MCP call
```json
{
  "name": "analyze_earnings_momentum",
  "arguments": { "ticker": "NVDA" }
}
```
