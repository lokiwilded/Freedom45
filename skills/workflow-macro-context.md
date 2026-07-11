# Workflow Skill: Macro Context

## When to use
User asks about the macro environment, liquidity, or how an asset fits the current backdrop: "how does gold look in this environment", "is liquidity expanding", "macro backdrop for stocks", "what's the liquidity regime", "how is the market environment", "what's the macro picture".

## Tool playbook

### Step 1: Regime (parallel)
1. `combo_liquidity_regime` — current global liquidity regime, risk-on score, liquidity YoY%
2. `get_global_liquidity` — raw Fed+ECB+BOJ balance sheet history
3. `get_money_supply` — US M2 growth

### Step 2: Asset sensitivity (parallel, pick the asset the user mentioned, default SP500)
4. `get_asset_history` — asset price history
5. `get_liquidity_elasticity` — how sensitive is the asset to liquidity changes (beta, R², lag)
6. `combo_sector_relative_strength` — if user mentions a sector or stock, how is it vs the benchmark

### Step 3: Debt context (if user asks about sovereign or macro)
7. `get_government_debt` — sovereign debt burden by country

## How to read the results

### Liquidity regime
- Expansion (Risk-On) = liquidity growing > 5% YoY, risk assets tend to do well.
- Expansion (Caution) = liquidity growing but other signals mixed.
- Neutral = liquidity flat, no strong direction.
- Contraction (Defensive) = liquidity shrinking, risk assets face headwinds.
- Contraction (Risk-Off) = liquidity shrinking significantly, defensive stance.

### Elasticity
- Liquidity beta > 0.5 = asset is highly sensitive to liquidity changes.
- R² > 0.3 = liquidity explains a meaningful portion of the asset's movement.
- Lag > 3 months = asset follows liquidity with a delay (useful for timing).

### M2 growth
- M2 YoY > 5% = money supply expanding, supportive of risk assets.
- M2 YoY < 0% = money supply contracting, rare and significant.

## Summarize
Write 3-4 paragraphs:
1. **Current regime**: Is liquidity expanding or contracting? What's the risk-on score? What does M2 show?
2. **Asset sensitivity**: How does the asset the user asked about respond to liquidity? High or low beta? What's the R²?
3. **Historical context**: How has the asset moved during similar regimes in the past?
4. **What to watch**: Key levels or trends the user should monitor.

Do NOT say buy, sell, or hold. Describe the macro environment and how the asset relates to it.