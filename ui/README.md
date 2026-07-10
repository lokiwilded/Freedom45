# Freedom45 — Liquidity Dashboard + AI Agent (UI)

Vite + React web app with two tabs:

1. **Dashboard** — hero stats, QE-episode breakdowns, movement stats, debt-by-sector
   (Recharts charts, static JSON on Pages, live API in dev).
2. **Ask** — an AI graphing agent with a TradingView lightweight-charts canvas. Tell it
   "show liquidity vs gold" and it calls data tools, projects each series onto the graph
   incrementally, and writes an explanation.

## Run it (two terminals)

```bash
# 1. API (from mcp-server/) — serves http://localhost:8787
cd mcp-server
npm run serve

# 2. Dashboard + agent (from ui/) — opens http://localhost:5173
cd ui
npm install   # first time only
npm run dev
```

Then open **http://localhost:5173**. Vite proxies `/api/*` to the API on :8787 and `/llm/*`
to Ollama Cloud (injects `OLLAMA_API_KEY` from `.env`).

## Dashboard tab

- **Hero tiles** — global CB liquidity, US market cap, US total debt (% GDP), US M2, and the
  reflexivity ratio ($ of market cap per $1 of liquidity). Each has an "i" info icon.
- **Explore the data** — a generic time-series chart: pick any asset from the dropdown, see it
  overlaid against liquidity on a dual-axis plot.
- **How much things move** — a stat square per series (liquidity, US market cap, S&P 500, gold,
  silver, US M2) with cumulative change over 1y/5y/since-'03, annualized growth, volatility,
  best/worst 12 months, and % up-years.
- **Debt by sector** — government / households / corporate, % of GDP, stacked, by country (BIS).

## Ask tab (AI graphing agent)

Desmos-style graph canvas with an AI agent that calls data tools and projects results
incrementally:

- **Graph canvas** — TradingView lightweight-charts (pan, zoom, crosshair, dual Y-axis)
- **Agentic loop** — the agent calls tools one at a time; each result appears on the graph
  immediately as a new layer (line/area/histogram)
- **Accumulates** — ask multiple questions; layers stack on the same canvas. "Clear graph"
  resets
- **Graph-dominant layout** — chart takes ~70% of the space, chat transcript on the right

### Agent tools

| Tool | Fetches | Source |
|---|---|---|
| `get_liquidity` | Global CB balance sheets | `/api/liquidity` |
| `get_asset` | Major indexes & commodities | `/api/assets` |
| `get_stock` | Any stock ticker (TSLA, AAPL, etc.) | `/api/stock` (Yahoo Finance) |
| `get_debt` | Debt-to-GDP by country/sector | `/api/debt` |
| `get_elasticity` | Liquidity sensitivity | `/api/elasticity` |
| `get_overview` | Hero snapshot | `/api/overview` |

### Swappable agent

All agent code is in `ui/src/agent/` — fully separate from the MCP server and dashboard.
Replace `ollama.ts` with any `Agent` implementation (the interface is just `step()` +
`summarize()`). The `StubAgent` works offline with no API key.

## Live site & deploy

**https://lokiwilded.github.io/Freedom45/**

GitHub Pages can't run the Node API, so the site reads **baked static JSON** from
`ui/public/data/` (committed). In dev the app uses the live API; in the production build it
reads those files (`import.meta.env.PROD`). The AI agent falls back to the StubAgent in
production (no live LLM). `.github/workflows/deploy.yml` builds `ui/` and publishes to Pages
on every push to `loki`/`main`.

**Refresh the data** (monthly/quarterly is plenty), then push to auto-deploy:

```bash
cd mcp-server
npm run dump-static     # regenerates ui/public/data/*.json (needs FRED_API_KEY + network)
cd ..
git add ui/public/data && git commit -m "chore: refresh dashboard data" && git push
```

## Environment variables

Set in repo-root `.env` (gitignored):

| Key | Used by | Notes |
|---|---|---|
| `FRED_API_KEY` | MCP server (macro data) | [Free key](https://fred.stlouisfed.org/docs/api/api_key.html) |
| `FINNHUB_API_KEY` | MCP server (stock tools) | [Free key](https://finnhub.io) |
| `OLLAMA_API_KEY` | UI dev proxy → Ollama Cloud | [Ollama Cloud](https://ollama.com/cloud) |
| `OLLAMA_BASE_URL` | UI dev proxy target | Default: `https://ollama.com/v1` |
| `OLLAMA_MODEL` | Default agent model | Default: `glm-5.2` |

## Notes

- Charts: Recharts (Dashboard tab) + TradingView lightweight-charts (Ask tab)
- "i" info icons explain terms (CB, CAGR, volatility, reflexivity) on hover/click
- The API is read-only JSON; endpoints are listed at `GET /api/` (404 body)
- Error boundaries on the graph canvas and agent page prevent white-screen crashes