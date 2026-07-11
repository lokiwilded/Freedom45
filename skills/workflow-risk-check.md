# Workflow Skill: Risk Check

## When to use
User asks about risks, what could go wrong, or financial health: "what are the risks in AAPL", "is NVDA financially healthy", "could TSLA go bankrupt", "balance sheet check", "risk assessment", "what could go wrong with this stock", "how safe is this dividend".

## Tool playbook

### Step 1: Balance sheet (parallel)
1. `analyze_balance_sheet_health` — 10-year balance sheet, Altman Z-score, debt/equity, current ratio
2. `analyze_earnings_quality` — earnings stability, volatility, accrual quality

### Step 2: Cash flow + capital (parallel)
3. `analyze_capital_allocation` — dividend sustainability, payout ratio, debt trajectory
4. `analyze_shareholder_yield` — is the dividend/buyback sustainable

### Step 3: Sentiment risks (parallel)
5. `analyze_insider_sentiment` — are insiders selling heavily?
6. `compare_sector_valuation` — is it expensive vs peers (valuation risk)?

### Step 4: Macro risk (if user asks about macro risk)
7. `combo_liquidity_regime` — is the macro environment risky?

## How to read the results

### Balance sheet health (primary risk indicator)
- Verdict Distressed = high bankruptcy risk. Altman Z < 1.8.
- Verdict Weak = elevated risk. Z between 1.8-2.8.
- Verdict Adequate = moderate. Can survive but not fortress.
- Verdict Strong/Fortress = low financial risk. Z > 3.
- Debt/equity > 2 = highly leveraged. Interest coverage < 2x = struggling to service debt.
- Current ratio < 1 = liquidity risk. May not cover short-term obligations.

### Earnings quality
- Earnings volatility > 0.5 = highly volatile earnings. Hard to predict.
- Accrual quality < 0.5 = earnings not backed by cash. Potential red flag.
- ROE declining or negative = losing money or returns compressing.

### Dividend sustainability
- Payout ratio > 80% = dividend at risk if earnings decline.
- Sustainability = Stretched = dividend may be cut.
- Total shareholder yield declining = company returning less capital over time.

### Insider selling
- Heavy Distribution + expensive valuation = notable risk signal.
- Insiders selling into strength while company looks expensive = they may know something.

### Valuation risk
- Overvalued/Expensive + slowing earnings momentum = valuation could compress.
- PEG > 2 = paying a lot for growth.

## Summarize
Write 3-4 paragraphs:
1. **Financial health**: Balance sheet verdict, Z-score, leverage, liquidity. Can the company survive a downturn?
2. **Earnings quality**: Are earnings stable and cash-backed? Any red flags in accruals or volatility?
3. **Dividend sustainability**: If the company pays dividends, are they safe? Payout ratio, cash coverage.
4. **Risk factors**: List the specific risks the data reveals (high debt, insider selling, expensive valuation, declining margins). Note which are most significant.

Do NOT say buy, sell, or hold. Describe the risks objectively. If the company looks safe, say so. If there are red flags, describe them.