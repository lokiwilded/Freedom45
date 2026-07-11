# Workflow Skill: Signal Scan

## When to use
User asks about signals, smart money, or catalysts: "what signals are on AAPL", "is smart money buying NVDA", "any catalysts for TSLA", "what are insiders doing", "smart money on MSFT", "signal check on AAPL".

## Tool playbook

### Step 1: All signals (parallel)
1. `analyze_insider_sentiment` — insider buying/selling pressure (90 days)
2. `analyze_earnings_momentum` — earnings beats + analyst recommendations + upgrades/downgrades
3. `find_smart_money_convergence` — insiders + institutions + funds + Congress alignment
4. `analyze_congress_news_catalyst` — congressional trades matched to news (may return no data on free tier)
5. `analyze_shareholder_yield` — is the company returning capital?

### Step 2: Context (parallel)
6. `fetch_stock_quote` — current price
7. `compare_sector_valuation` — is it cheap or expensive vs peers (informs whether signals matter more)

## How to read the results

### Insider sentiment
- Heavy Accumulation = strong bullish signal. Insiders are buying heavily.
- Accumulation = moderately bullish. Insiders net buying.
- Neutral = no clear signal.
- Distribution = moderately bearish. Insiders net selling.
- Heavy Distribution = strong bearish signal. Insiders are dumping.
- Note: 0 buys / many sells is common even at good companies (insiders sell for many reasons). Look at buy/sell ratio, not just sell count.

### Earnings momentum
- Improving/Strong = bullish. Analysts are getting more positive. Beat streak + rising targets.
- Stable = neutral. Consistent but no acceleration.
- Softening/Weak = bearish. Analysts cutting targets or downgrading.

### Smart money convergence
- Very High/High Convergence = multiple groups aligned (bullish if buying, bearish if selling). This is the strongest signal.
- Moderate = some alignment but not all groups agree.
- Mixed Signals = groups disagree (e.g. insiders buying but institutions selling).
- No Convergence = no alignment. On free tier, only insider signal will show; institutions/funds/Congress need premium.

### Congress news catalyst
- High Catalyst Signal = trades closely timed to news. Potentially information-driven.
- Some Catalyst Signal = some timing correlation but not strong.
- No Clear Catalyst = trades don't align with news.
- No Data = no congress trades available (free tier limitation).

### Shareholder yield
- High/Very High Yield = company is meaningfully returning capital. Positive if sustainable.
- Low/No Yield = company is reinvesting or not returning capital. Not necessarily bad for growth companies.

### Valuation context
- If undervalued + bullish signals = more interesting. Signals may precede a re-rating.
- If expensive + bearish signals = more concerning. Signals may precede a de-rating.
- If fairly valued + neutral signals = no strong edge either way.

## Summarize
Write 3-4 paragraphs:
1. **Signal summary**: List each signal group and what they're doing (insider, analyst, smart money). Use a simple table or bullet list.
2. **Convergence or divergence**: Are the signals aligned or mixed? Which are the strongest?
3. **Valuation context**: Is the stock cheap or expensive? Does this make the signals more or less significant?
4. **What stands out**: Highlight the most notable signal (largest trade, biggest upgrade, strongest convergence). Note any free-tier limitations.

Do NOT say buy, sell, or hold. Describe what the signals show and what's notable.