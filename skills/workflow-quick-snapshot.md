# Workflow Skill: Quick Snapshot

## When to use
User asks for a quick take on a ticker: "what's happening with AAPL", "quick check on NVDA", "how does TSLA look", "snapshot of MSFT".

## Tool playbook
Call these in parallel (all independent):
1. `fetch_stock_quote` — current price
2. `fetch_company_profile` — what the company does, market cap, sector
3. `analyze_insider_sentiment` — insider buying/selling (90 days)
4. `analyze_earnings_momentum` — earnings beats, analyst sentiment
5. `compare_sector_valuation` — cheap or expensive vs peers

## How to read the results
- **Price + profile**: Set the scene — what the company is, what it's worth, where it trades.
- **Insider sentiment**: Heavy Accumulation = insiders are buying (notable). Heavy Distribution = insiders are selling (notable). Neutral = nothing unusual.
- **Earnings momentum**: Improving/Strong = analysts getting more bullish. Softening/Weak = analysts turning bearish. Stable = no change.
- **Sector valuation**: Undervalued/Fairly Valued = reasonably priced. Overvalued/Expensive = priced for perfection.

## Summarize
Write 3-4 sentences:
1. What the company is and its current price + market cap.
2. What insiders are doing (buying or selling, and how much).
3. What analysts think (earnings momentum, upgrades/downgrades).
4. Whether it's cheap or expensive vs peers.

Do NOT say buy, sell, or hold. Just describe what the data shows. End with "Use the Combo tab for deeper analysis."