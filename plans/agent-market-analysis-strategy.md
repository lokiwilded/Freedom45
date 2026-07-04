# Freedom45 — Agent Market Analysis System Strategy

## Vision
An agent (opencode, Claude Desktop, Cursor, or any MCP-compatible client) loads the Freedom45 MCP server + skills and gains the ability to: ingest market data, analyze fundamentals/trends/sentiment, cross-reference smart-money flows, and produce high-level investment theses — not just fetch data, but *reason about it*.

## Core Decisions (locked in)
1. **Build composite analysis tools first** (Phase 1, post-merge)
2. **Platform-agnostic** — multi-agent skill format, not just opencode
3. **Structured thesis output** — server returns JSON, agent formats prose
4. **Quantitative + verdict** — tools return 0-100 scores with component breakdowns and threshold-derived verdicts
5. **Multi-agent skill format** — canonical markdown with YAML frontmatter + platform adapters

## Architecture Principle: Thin Agent, Thick Server
The agent stays dumb about market mechanics. The MCP server holds the analysis logic (TypeScript, testable, deterministic). The agent's job is: understand the user's question → pick the right skill → call the right tools → format the output. This keeps the agent's context window free for reasoning about the *result*, not the plumbing.

## Current State (what the agent can do today)
- **20 fetch tools**: quotes, profiles, historical prices, fundamentals, peers, news, earnings, analyst ratings, dividends, splits, SEC filings, institutional/fund ownership, insider transactions, search
- **1 analysis tool**: `analyzeLongTermTrend` (CAGR, volatility, max drawdown)
- **1 Loki tool (pending merge)**: `get_congress_trades`
- **1 skill**: `company-fundamentals-analysis.md`
- **0 composite/reasoning tools**: no valuation, relative strength, scoring, or thesis-generation

## The Gap: Fetch Tools ≠ Analysis
Right now the agent can *pull* data but must *reason* about it in its own head. That works for simple lookups but breaks down for high-level questions like "Is AAPL a good long-term investment?" because the agent has to orchestrate 6+ tool calls, hold all the results in context, and synthesize — inconsistently. The next phase is **composite analysis tools** that do the orchestration server-side and return structured judgments.

---

## Phase 1 — Composite Analysis Tools

### Philosophy
Each tool fetches its own data (by calling existing fetch tools internally), runs a scoring rubric, and returns a structured result: numeric scores + component breakdown + verdict label. The agent never has to orchestrate multiple fetch calls — one composite call does it.

### Scoring Convention (all tools)
- 0-100 scale per dimension
- Verdict thresholds: 80-100 Strong · 60-79 Favorable · 40-59 Neutral · 20-39 Unfavorable · 0-19 Weak
- Every score includes `components` showing what fed the number (transparent, debuggable)

### Tool 1: `analyzeValuation(ticker)`
**Returns:** `{ score, verdict, components, comparison }`
- Fetches: `fetchFundamentalMetrics`, `fetchStockQuote`, `fetchPeers`
- Scoring rubric:
  - P/E vs sector median (lower = better): 30 pts
  - P/B vs sector median: 20 pts
  - P/S vs sector median: 20 pts
  - EV/EBITDA vs sector: 15 pts
  - Dividend yield (if applicable): 15 pts
- Verdict: "Undervalued" / "Fairly valued" / "Overvalued" based on score

### Tool 2: `analyzeRelativeStrength(ticker, benchmark, years)`
**Returns:** `{ score, verdict, alpha, beta, components }`
- Fetches: `fetchHistoricalPrices` (ticker + benchmark)
- Uses: `calculateReturns`, `calculateCAGR`, `calculateVolatility`, `calculateMaxDrawdown` (existing in `lib/calculations.ts`)
- Scoring rubric:
  - Total return vs benchmark (outperformance): 30 pts
  - Risk-adjusted return (Sharpe-like): 25 pts
  - Max drawdown vs benchmark (shallower = better): 20 pts
  - Consistency (% of months beating benchmark): 25 pts

### Tool 3: `analyzeEarningsQuality(ticker)`
**Returns:** `{ score, verdict, beatStreak, components }`
- Fetches: `getEarningsSurprise`, `fetchFundamentalMetrics`
- Scoring rubric:
  - Beat/miss streak (consecutive beats): 25 pts
  - Avg surprise magnitude: 20 pts
  - Revenue growth consistency (YoY): 25 pts
  - Margin trend (improving/declining): 15 pts
  - Guidance history (if available): 15 pts

### Tool 4: `analyzeInsiderSentiment(ticker)`
**Returns:** `{ score, verdict, netBuySellRatio, notableTransactions, components }`
- Fetches: `getInsiderTransactions`
- Scoring rubric:
  - Net buy/sell ratio (3mo): 30 pts
  - Cluster buying (multiple insiders): 25 pts
  - CEO/CFO specific activity: 20 pts
  - Transaction size (material vs token): 15 pts
  - Recency (last 30 days weighted higher): 10 pts

### Tool 5: `analyzeAnalystConsensus(ticker)`
**Returns:** `{ score, verdict, meanRating, targetUpside, recentActions, components }`
- Fetches: `getRecommendationTrends`, `getPriceTarget`, `getUpgradeDowngrade`
- Scoring rubric:
  - Strong-buy/buy ratio: 30 pts
  - Price target upside vs current: 25 pts
  - Recent upgrade momentum (net upgrades): 25 pts
  - Consensus agreement (low dispersion): 20 pts

### Tool 6: `analyzeDividendHealth(ticker)`
**Returns:** `{ score, verdict, yield, payoutRatio, growthStreak, components }`
- Fetches: `getDividends`, `fetchFundamentalMetrics`, `fetchStockQuote`
- Scoring rubric:
  - Yield vs sector: 20 pts
  - Payout ratio sustainability (<60%): 25 pts
  - Dividend growth streak (years): 25 pts
  - Coverage (earnings > dividends): 20 pts
  - Special dividends history: 10 pts

### Tool 7: `analyzeFinancialHealth(ticker)`
**Returns:** `{ score, verdict, components }`
- Fetches: `fetchFundamentalMetrics`
- Scoring rubric:
  - Debt/equity (lower = better): 25 pts
  - Current ratio (liquidity): 20 pts
  - ROE: 20 pts
  - Profit margin: 20 pts
  - Cash flow adequacy: 15 pts

### Tool 8: `scoreCompany(ticker)` — THE COMPOSITE SCORE
**Returns:** `{ overallScore, verdict, dimensionScores, strengths, weaknesses }`
- Calls all 7 analysis tools above internally
- Weighted composite:
  - Valuation: 20%
  - Financial health: 20%
  - Earnings quality: 15%
  - Relative strength: 15%
  - Insider sentiment: 10%
  - Analyst consensus: 10%
  - Dividend health: 10% (0% if no dividend)
- Returns top 3 strengths and weaknesses

### Tool 9: `compareCompanies(tickers[], dimensions[])`
**Returns:** `{ companies: [{ ticker, scores }], rankings, bestPerDimension }`
- Calls `scoreCompany` for each ticker
- Ranks them per dimension and overall

### Tool 10: `buildThesis(ticker)` — THE CAPSTONE
**Returns structured JSON:**
```typescript
{
  ticker: string,
  overallScore: number,
  verdict: "Strong" | "Favorable" | "Neutral" | "Unfavorable" | "Weak",
  bullCase: string[],      // 3-5 data-backed bullish points
  bearCase: string[],      // 3-5 data-backed bearish points
  keyRisks: string[],      // identified risk factors
  catalysts: string[],     // upcoming events that could move the stock
  smartMoneySignal: string, // summary of insider/congress/analyst activity
  valuationSummary: string,
  growthSummary: string,
  recommendation: string,   // one-line verdict for the agent to expand on
  dataCollected: string[],  // list of tools called (for transparency)
  generatedAt: string
}
```
The agent takes this structured output and writes a polished prose thesis. The server stays testable; the agent handles presentation.

---

## Phase 2 — Multi-Agent Skill Format

### Problem
Different agents use different skill/prompt formats:
- opencode: `skills/*.md` (plain markdown)
- Claude Desktop: `CLAUDE.md` or system prompt
- Cursor: `.cursorrules`
- Custom agents: whatever they want

### Solution: Canonical skill format with a build step
A canonical skill format that generates platform-specific files.

**Canonical format** (`skills/<name>.md` with YAML frontmatter):
```yaml
---
name: investment-thesis-builder
description: Build a full investment thesis for any stock
triggers:
  - "give me a thesis on {ticker}"
  - "should I invest in {ticker}"
  - "analyze {ticker} as a long-term investment"
tools:
  - buildThesis
  - scoreCompany
  - analyzeValuation
category: analysis
priority: high
---

# Investment Thesis Builder

## When to use
When the user asks for a comprehensive analysis or investment recommendation.

## Workflow
1. Call `buildThesis` with the ticker
2. Take the structured output and write a polished report:
   - Open with the verdict and overall score
   - Bull case section (use `bullCase` array)
   - Bear case section (use `bearCase` array)
   - Risks and catalysts
   - Smart money signal
   - Close with a measured recommendation
3. If the user asks for comparison, use `compareCompanies` instead

## Output format
Write in clear, professional prose. Use the structured data as your skeleton.
Always cite the data source (e.g., "insider transactions from the last 90 days").
Never fabricate data not in the tool output.
```

**Build step** (`scripts/build-skills.ts`):
- Reads canonical `skills/*.md` files
- Generates:
  - `skills/README.md` — index of all skills (for any agent to read)
  - `AGENTS.md` — root agent instruction file (platform-agnostic core)
  - `CLAUDE.md` — Claude Desktop format (concatenates skills into one prompt)
  - `.cursorrules` — Cursor format
  - `.opencode/skills/` — opencode format (copies markdown as-is)
- Run via `npm run build:skills` in the mcp-server package

### Skill Docs to Write

| Skill | Triggers | Tools |
|-------|----------|-------|
| `company-fundamentals-analysis.md` (exists, update) | "analyze {ticker} fundamentals" | Phase 1 fetch + analysis tools |
| `investment-thesis-builder.md` | "give me a thesis on {ticker}" | `buildThesis` |
| `company-comparison.md` | "compare {tickers}" | `compareCompanies` |
| `earnings-season-prep.md` | "what's reporting this week" | `getEarningsCalendar` + `analyzeEarningsQuality` |
| `insider-activity.md` | "are insiders buying {ticker}" | `analyzeInsiderSentiment` |
| `dividend-analysis.md` | "is {ticker} a good dividend stock" | `analyzeDividendHealth` |

---

## Phase 3 — Agent Onboarding Docs

### `AGENTS.md` (root) — Universal agent instruction file
```markdown
# Freedom45 — Market Analysis Agent

You are a market analysis agent with access to the Freedom45 MCP server.

## What you can do
- Fetch stock market data (prices, fundamentals, news, earnings, analyst ratings)
- Analyze companies using composite scoring tools (valuation, growth, momentum, sentiment)
- Build investment theses with structured bull/bear cases
- Track insider and congressional trading activity

## How to work
1. Read the user's question
2. Check skills/README.md for the matching skill
3. Call the appropriate MCP tools (prefer composite analysis tools over raw fetches)
4. Format the structured output into clear prose
5. Never fabricate data — if a tool didn't return it, don't claim it

## MCP Server
- Location: mcp-server/ (TypeScript, runs via stdio)
- Config: see mcp-server/package.json
- Start: cd mcp-server && npm run build && npm start
- API keys: .env (FINNHUB_API_KEY required, FRED_API_KEY optional)

## Skills
See skills/README.md for the full index.
```

### `docs/AGENT-INTEGRATION.md` — How to connect any MCP client
- Section: opencode (add `.opencode/mcp.json` with server config)
- Section: Claude Desktop (add to `claude_desktop_config.json`)
- Section: Cursor (add MCP server config)
- Section: Generic MCP client (stdio protocol, tool list, example calls)

---

## Phase 4 — Smart-Money Tools (post-Loki merge)
*Once Loki's `get_congress_trades` + DB tables are merged.*

| Tool | Returns |
|------|---------|
| `crossReferenceSmartMoney(ticker)` | `{ congressTrades, insiderTransactions, institutionalOwnership, fundOwnership, signalScore }` |
| `findOutlierTrades(filters)` | Loki's killer tool — ranked list of high-conviction trades |
| `trackPolitician(name)` | Portfolio + YTD performance for a politician |
| `getDailyBriefing()` | Runs all scans, produces a morning briefing |

---

## Phase 5 — Macro Context (FRED provider)
*New provider, new tools.*

| Tool | Returns |
|------|---------|
| `getFredSeries(series_id, from, to)` | Macro data observations |
| `getMarketRegime()` | Bull/bear/sideways classification |
| `getBuffettIndicator()` | Market cap / GDP ratio |
| `correlateWithMacro(ticker, series_id)` | Correlation between a stock and macro data |

---

## Build Order (Session Plan)

| Session | What to build | Deliverable |
|---------|--------------|-------------|
| A (post-merge) | `analyzeValuation` + `analyzeRelativeStrength` + tests | First composite tools working |
| B | `analyzeEarningsQuality` + `analyzeInsiderSentiment` + `analyzeAnalystConsensus` + tests | Sentiment layer complete |
| C | `analyzeDividendHealth` + `analyzeFinancialHealth` + tests | All 7 sub-analyses done |
| D | `scoreCompany` + `compareCompanies` + tests | Composite scoring works |
| E | `buildThesis` + tests | Capstone tool — agent can produce a full thesis |
| F | `scripts/build-skills.ts` + all 6 skill docs + `AGENTS.md` + `docs/AGENT-INTEGRATION.md` | Agent onboarding complete |
| G (post-Loki merge) | `crossReferenceSmartMoney` + `findOutlierTrades` | Smart-money layer |
| H | FRED provider + `getFredSeries` + `getMarketRegime` | Macro context layer |

---

## Final File Structure (after all phases)
```
Freedom45/
├── AGENTS.md                          # Universal agent instructions
├── AI-RULES.md                        # Existing dev guidelines
├── docs/
│   └── AGENT-INTEGRATION.md           # How to connect any MCP client
├── mcp-server/
│   ├── src/
│   │   ├── tools/
│   │   │   ├── long-analysis/         # 20 fetch tools (done)
│   │   │   ├── composite-analysis/    # 10 composite tools (Phase 1)
│   │   │   ├── smart-money/           # 4 tools (Phase 4)
│   │   │   └── macro/                 # 4 tools (Phase 5)
│   │   ├── providers/
│   │   │   ├── finnhub.ts             # Done
│   │   │   └── fred.ts                # Phase 5
│   │   ├── lib/
│   │   │   ├── cache.ts               # Done
│   │   │   ├── calculations.ts        # Done (extend in Phase 1)
│   │   │   └── scoring.ts             # Phase 1 — shared scoring helpers
│   │   └── test/
│   │       ├── long-analysis/         # Done
│   │       ├── composite-analysis/    # Phase 1
│   │       └── shared/
│   ├── scripts/
│   │   └── build-skills.ts            # Phase 2 — skill format compiler
│   └── package.json
├── skills/
│   ├── README.md                      # Auto-generated index
│   ├── company-fundamentals-analysis.md
│   ├── investment-thesis-builder.md
│   ├── company-comparison.md
│   ├── earnings-season-prep.md
│   ├── insider-activity.md
│   ├── dividend-analysis.md
│   └── get-congress-trades.md         # From Loki
├── plans/
│   └── ... (existing)
└── .opencode/                         # Auto-generated for opencode
```

---

## Key Design Principles
1. **Thin agent, thick server** — analysis logic lives in TypeScript (testable, deterministic), not in the agent's prompt
2. **Composite tools fetch their own data** — one call does the orchestration, not the agent
3. **Scores are transparent** — every 0-100 score includes its component breakdown so the agent can explain *why*
4. **Structured output, agent-formatted prose** — server returns JSON, agent writes the final report
5. **Canonical skill format** — one source of truth, platform-specific files generated from it
6. **Never fabricate** — agents are instructed to only present data from tool outputs