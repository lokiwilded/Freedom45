# Workflow Skill: Sector Comparison

## When to use
User asks about sectors, relative strength, or which sector/stock to compare: "tech vs healthcare", "XLK vs SPY", "which sector is leading", "is NVDA outperforming", "sector rotation", "compare AAPL vs MSFT", "relative strength of XLK".

## Tool playbook

### Step 1: Sector strength (parallel)
1. `combo_sector_relative_strength` — for each sector/stock mentioned, vs benchmark
2. `combo_sector_valuation` — for each stock mentioned, vs sector peers

### Step 2: Macro context (parallel)
3. `combo_liquidity_regime` — current macro backdrop
4. `get_liquidity_elasticity` — how sensitive are these assets to liquidity

### Step 3: Company-level (parallel, for each stock mentioned)
5. `analyze_earnings_momentum` — which has better earnings momentum
6. `analyze_insider_sentiment` — where are insiders buying/selling

## How to read the results

### Sector relative strength
- Leading = sector is outperforming the benchmark. Positive rotation signal.
- Improving = sector is gaining momentum relative to benchmark.
- Stable = sector tracks the benchmark.
- Weakening/Lagging = sector is underperforming. Negative rotation signal.
- Alpha > 0 = sector is adding excess return vs benchmark.
- Liquidity beta > 0.5 = sector is highly sensitive to liquidity changes.

### Sector valuation
- Deeply Undervalued/Undervalued = stock is cheap vs peers. Potential opportunity.
- Fairly Valued = appropriately priced.
- Overvalued/Expensive = priced for perfection.
- Rank-in-sector: 1 = most expensive in peer group. Last = cheapest.

### Macro context
- Expansion (Risk-On) favors growth/tech sectors.
- Contraction (Defensive) favors staples, healthcare, utilities.
- High liquidity beta sectors outperform when liquidity is expanding.

## Summarize
Write 3-4 paragraphs:
1. **Sector positioning**: Which sector is leading vs lagging? Alpha and beta for each.
2. **Valuation comparison**: Which stock is cheaper or more expensive vs its sector peers?
3. **Macro fit**: Does the current liquidity regime favor this sector?
4. **Earnings + insiders**: Which stock has better earnings momentum and insider sentiment?

Do NOT say which to buy or sell. Describe what the relative data shows — which is stronger, cheaper, better positioned.