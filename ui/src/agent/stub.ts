// A rule-based, zero-API-key agent fallback.
//
// Lets the Agent tab render charts and demonstrate the UI without any live LLM.
// It recognizes a few keyword patterns, fetches the matching baked JSON, and returns
// a canned ChartSpec. The `Agent` interface keeps it swappable with the real OllamaAgent.

import type { Agent, AgentPlan, AgentInterpretation, ToolCall, ToolResult, ChartSpec } from "./types.js";
import type { SeriesConfig, TimeSeriesRow } from "../charts.js";
import { AVAILABLE_TOOLS, executeTool } from "./tools.js";
import { useTheme } from "../theme.js";

const ASSET_LABELS: Record<string, string> = {
  SP500: "S&P 500",
  NASDAQ: "Nasdaq",
  GOLD: "Gold",
  SILVER: "Silver",
  US_MKTCAP: "US market cap",
  FTSE: "FTSE 100",
  DAX: "DAX 40",
  NIKKEI: "Nikkei 225",
  DOW: "Dow Jones",
  ESTOXX50: "Euro Stoxx 50",
  CAC40: "CAC 40",
  HANGSENG: "Hang Seng",
  SHANGHAI: "Shanghai Composite",
};

function parseRequest(prompt: string): { asset: string; title: string } | null {
  const p = prompt.toLowerCase();
  const assets = Object.entries(ASSET_LABELS);

  // Liquidity alone.
  if (/liquidity|central bank|cb balance|money printing|qe/.test(p) && !/vs|versus|against|and/.test(p)) {
    return { asset: "liquidity", title: "Global central-bank liquidity" };
  }

  for (const [key, label] of assets) {
    const re = new RegExp(`\\b${label.toLowerCase().replace(/\s+/g, "\\s+")}\\b|\\b${key.toLowerCase()}\\b`);
    if (re.test(p)) return { asset: key, title: `${label} vs liquidity` };
  }

  // Default fallback.
  return { asset: "SP500", title: "S&P 500 vs liquidity" };
}

export class StubAgent implements Agent {
  async plan(): Promise<AgentPlan> {
    // The stub doesn't actually call an LLM; it returns an empty plan so the
    // caller can short-circuit and call interpret directly with the original prompt.
    return { toolCalls: [], raw: { role: "assistant", content: "" } };
  }

  async interpret(results: ToolResult[], history: any[]): Promise<AgentInterpretation> {
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    const prompt = (lastUser?.content ?? "") as string;
    const parsed = parseRequest(prompt);
    if (!parsed) {
      return {
        text: "I'm a simple stub agent. Try asking me to compare liquidity with an asset like 'gold', 'S&P 500', or 'Nasdaq'.",
        raw: { role: "assistant", content: "" },
      };
    }

    const toolCalls: ToolCall[] = [{ name: "get_liquidity", arguments: {} }];
    if (parsed.asset !== "liquidity") {
      toolCalls.push({ name: "get_asset", arguments: { asset: parsed.asset } });
    }

    const executed = await Promise.all(toolCalls.map((tc) => executeTool(tc)));
    const liquidityResult = executed.find((r) => r.name === "get_liquidity")?.data as any;
    const assetResult = parsed.asset === "liquidity" ? null : executed.find((r) => r.name === "get_asset")?.data as any;

    const toMap = (rows: { date: string; value: number }[]) =>
      new Map(rows.filter((x) => x.value != null).map((x) => [x.date, x.value]));

    const liqMap = toMap(
      liquidityResult?.data?.map((d: any) => ({ date: d.date, value: d.total_trillions })) ?? []
    );
    const assetMap = assetResult?.data ? toMap(assetResult.data) : new Map<string, number>();

    const dates = new Set([...liqMap.keys(), ...assetMap.keys()]);
    const rows: TimeSeriesRow[] = [...dates].sort().map((date) => ({
      date,
      liquidity: liqMap.get(date) ?? null,
      asset: assetMap.get(date) ?? null,
    }));

    const series: SeriesConfig[] = [
      {
        key: "liquidity",
        name: "Global CB liquidity",
        color: "#2a78d6",
        type: "area",
        yAxisId: "left",
        formatter: (v) => `$${Number(v).toFixed(1)}T`,
      },
    ];

    if (parsed.asset !== "liquidity") {
      series.push({
        key: "asset",
        name: ASSET_LABELS[parsed.asset] ?? parsed.asset,
        color: "#1baf7a",
        type: "line",
        yAxisId: "right",
        formatter: (v) => `${Number(v).toFixed(0)}`,
      });
    }

    const chart: ChartSpec = {
      title: parsed.title,
      rows,
      series,
    };

    return {
      text: `Stub agent: showing ${parsed.title}. This is an offline fallback — add your Ollama API key to .env in dev to use the live glm-5.2 agent.`,
      chart,
      raw: { role: "assistant", content: "" },
    };
  }
}
