# Workflow Skill: Deep Fundamental Analysis

## When to use
User asks for a deep dive, long-term view, or fundamental analysis: "is AAPL a good long-term investment", "deep dive on MSFT", "fundamental analysis of NVDA", "should I hold KO for 10 years", "is this a good company".

## Tool playbook

### Step 1: Context (parallel)
1. `fetch_company_profile` — what the company does, sector, market cap
2. `fetch_fundamental_metrics` — current P/E, P/B, margins, growth
3. `fetch_peers` — who the competitors are

### Step 2: Long-term quality (parallel)
4. `analyze_earnings_quality` — 10-year revenue/EPS CAGR, margin trends, accrual quality, ROE/ROA
5. `analyze_capital_allocation` — 10-year dividends, buybacks, R&D, capex, debt reduction
6. `analyze_balance_sheet_health` — 10-year current ratio, debt/equity, interest coverage, Altman Z-score
7. `analyze_compounder_score` — 10-year compounder quality score (revenue/EPS/BV CAGR, ROE/ROIC, margin stability)

### Step 3: Current signals (parallel)
8. `analyze_shareholder_yield` — current dividend + buyback yield, sustainability
9. `analyze_insider_sentiment` — are insiders buying or selling recently?

## How to read the results

### Earnings quality
- Verdict Excellent/Good = high quality, stable, growing earnings.
- Margin trends expanding = operating leverage (good). Contracting = cost pressure (watch).
- Accrual quality > 0.8 = earnings backed by cash. < 0.5 = potential quality concerns.
- ROE > 15% = strong returns. ROE > 30% = exceptional. Negative = losing money.

### Capital allocation
- Verdict Disciplined/Exceptional = management creates value. Inefficient/Value Destructive = destroys value.
- Payout ratio < 60% = sustainable dividend. > 90% = stretched.
- Buyback intensity > 0% = reducing shares (good). < 0% = diluting shareholders (bad).
- R&D/revenue > 5% = investing in growth. < 2% = may be underinvesting.

### Balance sheet health
- Verdict Fortress/Strong = can survive downturns. Weak/Distressed = financial risk.
- Altman Z > 3 = safe. Z < 1.8 = distress zone. Z between = grey area.
- Current ratio > 1.5 = good liquidity. < 1 = may struggle to pay short-term obligations.
- Debt/equity < 0.5 = low leverage. > 2 = high leverage.

### Compounder score
- Elite/Strong Compounder = consistently compounds wealth. Moderate = mixed. Weak/Not a Compounder = doesn't compound.
- ROE avg > 15% and ROIC avg > 12% = high-quality compounder.
- Margin stability > 0.8 = very consistent earnings.
- Earnings consistency > 0.9 = profitable almost every year.

## Summarize
Write 4-5 paragraphs:
1. **Company overview**: What it does, market cap, sector, current valuation metrics (P/E, P/B, margins).
2. **Earnings quality**: 10-year revenue/EPS growth, margin trends, ROE, accrual quality. Is earnings growth real and cash-backed?
3. **Capital allocation**: How management deploys capital — dividends, buybacks, R&D, capex. Are they disciplined?
4. **Balance sheet**: Financial strength, leverage, ability to survive a downturn. Z-score interpretation.
5. **Compounder verdict**: Is this a company that compounds wealth? Key strengths and weaknesses.

Do NOT say buy, sell, or hold. Describe what the data shows. Highlight any red flags (high debt, declining margins, insider selling) and strengths (consistent growth, fortress balance sheet, disciplined capital allocation).