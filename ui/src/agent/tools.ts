// Tool definitions + browser-side executors for the agent.
//
// Tools are NOT MCP tools — they are lightweight wrappers over the dashboard's
// existing static JSON (or the live /api endpoints in dev). This keeps the MCP server
// untouched: the agent consumes data, it does not add code to the MCP server.

import type { ToolSpec, ToolCall, ToolResult, SeriesPoint } from "./types.js";
import { api } from "../api.js";

// The set of tools the LLM (or stub) is allowed to call.
// Descriptions are tuned for LLM reasoning: they tell the model what each tool returns
// and how arguments map to the user's request.
export const AVAILABLE_TOOLS: ToolSpec[] = [
  {
    name: "get_liquidity",
    description:
      "Fetch the global central-bank liquidity time series. Returns monthly data from 2003 to today with total_trillions (USD) and per-bank components. Use this whenever the user asks about central-bank balance sheets, QE, liquidity, or wants to compare an asset against liquidity.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Optional start date YYYY-MM-DD. Default 2003-01-01." },
        to: { type: "string", description: "Optional end date YYYY-MM-DD. Default today." },
      },
    },
  },
  {
    name: "get_asset",
    description:
      "Fetch a historical asset time series for MAJOR INDEXES and COMMODITIES only (not individual stocks). Known assets: SP500, NASDAQ, DOW, US_MKTCAP, FTSE, DAX, ESTOXX50, CAC40, NIKKEI, HANGSENG, SHANGHAI, GOLD, SILVER, KOSPI, ASX200, TSX. The tool will return an error for unknown keys.",
    parameters: {
      type: "object",
      properties: {
        asset: { type: "string", description: "Asset key, e.g. 'SP500' or 'GOLD'" },
        from: { type: "string", description: "Optional start date YYYY-MM-DD." },
        to: { type: "string", description: "Optional end date YYYY-MM-DD." },
      },
      required: ["asset"],
    },
  },
  {
    name: "get_stock",
    description:
      "Fetch historical price data for an INDIVIDUAL STOCK by ticker symbol via Yahoo Finance. Use this when the user names a specific company or stock ticker (e.g. TSLA, AAPL, NVDA, MSFT). The tool tries the ticker directly — if Yahoo has no data it returns an error. Always try the user's term as the ticker first.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker symbol, e.g. 'TSLA', 'AAPL', 'NVDA'" },
        from: { type: "string", description: "Optional start date YYYY-MM-DD." },
        to: { type: "string", description: "Optional end date YYYY-MM-DD." },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_debt",
    description:
      "Fetch debt-to-GDP time series for a country and sector. Country: US, JP, GB, DE, FR, IT, CA, AU, CN, KR. Sectors: government, households, corporate. Use when the user asks about debt.",
    parameters: {
      type: "object",
      properties: {
        country: { type: "string", description: "Country code, e.g. 'US'" },
        sector: { type: "string", description: "Sector: 'government', 'households', or 'corporate'" },
      },
      required: ["country", "sector"],
    },
  },
  {
    name: "get_elasticity",
    description:
      "Fetch the liquidity-elasticity regression and scatter data for a driver/asset pair. Useful when the user asks how sensitive an asset is to liquidity changes.",
    parameters: {
      type: "object",
      properties: {
        driver: { type: "string", description: "Usually 'global_liquidity'" },
        asset: { type: "string", description: "Asset key, e.g. 'SP500' or 'GOLD'" },
      },
      required: ["driver", "asset"],
    },
  },
  {
    name: "get_overview",
    description: "Fetch the dashboard hero snapshot: latest liquidity, US market cap, US debt, M2, and key elasticity summary.",
    parameters: { type: "object", properties: {} },
  },
];

// Execute a tool call in the browser. Returns a ToolResult.
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const fail = (msg: string): ToolResult => ({
    toolCallId: call.id,
    name: call.name,
    ok: false,
    data: null,
    error: msg,
  });

  try {
    switch (call.name) {
      case "get_liquidity": {
        const data = await api.liquidity();
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "get_asset": {
        const asset = String(call.arguments.asset).toUpperCase();
        try {
          const data = await api.asset(asset);
          const any = data as { error?: string };
          if (any.error) return fail(any.error);
          return { toolCallId: call.id, name: call.name, ok: true, data };
        } catch (e: any) {
          return fail(e?.message ?? `Could not fetch asset '${asset}'.`);
        }
      }

      case "get_stock": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        try {
          const period1 = -2208988800;
          const period2 = Math.floor(Date.now() / 1000) + 86400;
          const url = `/yh/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1mo`;
          const res = await fetch(url);
          if (!res.ok) return fail(`Yahoo returned ${res.status} for ticker '${ticker}'.`);
          const json = await res.json() as any;
          const result = json?.chart?.result?.[0];
          if (!result) {
            const msg = json?.chart?.error?.description ?? "no data";
            return fail(`No data for ticker '${ticker}': ${msg}`);
          }
          const meta = result.meta ?? {};
          const ts: number[] = result.timestamp ?? [];
          const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
          const data = ts
            .map((t, i) => {
              const v = closes[i];
              if (v == null || Number.isNaN(v)) return null;
              const d = new Date(t * 1000);
              return { date: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`, value: v };
            })
            .filter((x): x is { date: string; value: number } => x !== null);
          if (!data.length) return fail(`No price history for ticker '${ticker}'.`);
          return {
            toolCallId: call.id,
            name: call.name,
            ok: true,
            data: {
              asset: ticker,
              label: meta.longName ?? meta.shortName ?? ticker,
              currency: meta.currency ?? "USD",
              metric: "level",
              data,
              latest: data[data.length - 1],
            },
          };
        } catch (e: any) {
          return fail(e?.message ?? `Could not fetch stock '${ticker}'.`);
        }
      }

      case "get_debt": {
        const country = String(call.arguments.country).toUpperCase();
        const sector = String(call.arguments.sector);
        const data = await api.debt(country, sector);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "get_elasticity": {
        const driver = String(call.arguments.driver);
        const asset = String(call.arguments.asset);
        const data = await api.elasticity(driver, asset);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "get_overview": {
        const data = await api.overview();
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      default:
        return fail(`Unknown tool: ${call.name}`);
    }
  } catch (err: any) {
    return fail(err?.message ?? String(err));
  }
}
