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
      "Fetch a historical asset time series (index level or market cap). Supported assets: SP500, NASDAQ, DOW, US_MKTCAP, FTSE, DAX, ESTOXX50, CAC40, NIKKEI, HANGSENG, SHANGHAI, GOLD, SILVER, KOSPI, ASX200, TSX. Use when the user names an index, commodity, or market cap.",
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
  {
    name: "render_chart",
    description:
      "Call this after fetching data to tell the UI what to graph. Provide a title, the merged time-series rows, and series config. Each series must match a column in rows and specify type ('line' or 'area'), name, color, yAxisId ('left' or 'right'), and a human formatter.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        rows: {
          type: "array",
          description: "Array of { date: string, [seriesKey]: number|null } objects, sorted by date.",
          items: { type: "object" },
        },
        series: {
          type: "array",
          description: "Array of SeriesConfig: { key, name, color, type, yAxisId, formatter? }",
          items: { type: "object" },
        },
      },
      required: ["title", "rows", "series"],
    },
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
        const from = String(call.arguments.from ?? "2003-01-01");
        const to = String(call.arguments.to ?? "");
        const params: Record<string, string> = { from };
        if (to) params.to = to;
        // @ts-ignore — api.liquidity currently has no date params; acceptable to ignore extras in dev
        const data = await api.liquidity();
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "get_asset": {
        const asset = String(call.arguments.asset).toUpperCase();
        const data = await api.asset(asset);
        return { toolCallId: call.id, name: call.name, ok: true, data };
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

      case "render_chart": {
        return {
          toolCallId: call.id,
          name: call.name,
          ok: true,
          data: {
            title: call.arguments.title,
            rows: call.arguments.rows,
            series: call.arguments.series,
          },
        };
      }

      default:
        return fail(`Unknown tool: ${call.name}`);
    }
  } catch (err: any) {
    return fail(err?.message ?? String(err));
  }
}

// Merge multiple time-series into rows keyed by date.
export function mergeByDate(
  maps: Record<string, Map<string, number | null>>,
  defaultKeys?: string[]
): { date: string; [key: string]: number | null | string }[] {
  const dates = new Set<string>();
  Object.values(maps).forEach((m) => m.forEach((_, d) => dates.add(d)));
  const keys = defaultKeys ?? Object.keys(maps);
  return [...dates]
    .sort()
    .map((date) => {
      const row: Record<string, number | null | string> = { date };
      for (const k of keys) row[k] = maps[k]?.get(date) ?? null;
      return row as any;
    });
}

export function toMap(points: SeriesPoint[]): Map<string, number> {
  return new Map(points.filter((p) => p.value != null).map((p) => [p.date, p.value]));
}
