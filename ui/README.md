# Freedom45 — Liquidity Dashboard (UI)

Vite + React + Recharts dashboard for the macro data layer. Talks to the REST API
(`mcp-server/src/http.ts`), which wraps the same tool functions the MCP server exposes.

## Run it (two terminals)

```bash
# 1. API (from mcp-server/) — serves http://localhost:8787
cd mcp-server
npm run serve

# 2. Dashboard (from ui/) — opens http://localhost:5173
cd ui
npm install   # first time only
npm run dev
```

Then open **http://localhost:5173**. Vite proxies `/api/*` to the API on :8787, so no CORS setup.

## What's on it

- **Hero tiles** — global CB liquidity, US market cap, US total debt (% GDP), US M2, and the
  reflexivity ratio ($ of market cap per $1 of liquidity). Each has an "i" info icon.
- **How much things move** — a stat square per series (liquidity, US market cap, S&P 500, gold,
  silver, US M2) with cumulative change over 1y/5y/since-'03, annualized growth, volatility,
  best/worst 12 months, and % up-years. Computed from full history (`/api/stats`), auto-updating.
- **Debt by sector** — government / households / corporate, % of GDP, stacked, by country (BIS).

## Notes

- The debt chart uses the validated dataviz palette (light + dark, follows the OS theme).
- "i" info icons explain terms (CB, CAGR, volatility, reflexivity) on hover/click.
- The API is read-only JSON; endpoints are listed at `GET /api/` (404 body).
