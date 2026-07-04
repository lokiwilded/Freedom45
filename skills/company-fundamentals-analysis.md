# Skill: Company Fundamentals Analysis

## Description
Analyze a public company's long-term fundamentals and price history.

## Example Prompts
- "Analyze AAPL's fundamentals over the last 5 years"
- "Is MSFT a healthy long-term investment?"
- "Compare TSLA and NVDA financial health"
- "What is the 5-year price trend for AMZN?"

## Tools Used
- `fetchCompanyProfile`
- `fetchHistoricalPrices`
- `fetchFundamentals`
- `analyzeLongTermTrend`

## Notes
- Data is sourced from Finnhub and cached in a local SQLite database.
- A free Finnhub API key is required.
- The database is personal to this branch while we learn; it will merge with Loki's database later.
- Always prefer cached data when available, and fall back to fetching fresh data on request.
