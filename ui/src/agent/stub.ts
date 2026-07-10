// A rule-based, zero-API-key agent fallback.
//
// Implements the agentic loop interface (step/summarize) so the UI works without
// any live LLM. It recognizes keyword patterns and returns tool calls one at a
// time so the graph builds incrementally even in stub mode.

import type { Agent, AgentStep, ChatMessage, ToolSpec, ToolCall } from "./types";
import { AVAILABLE_TOOLS, executeTool } from "./tools";
import type { ToolResult } from "./types";

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

const TICKER_HINTS: Record<string, string> = {
  TSLA: "Tesla",
  AAPL: "Apple",
  NVDA: "NVIDIA",
  MSFT: "Microsoft",
  AMZN: "Amazon",
  GOOGL: "Alphabet",
  META: "Meta",
};

interface StubPlan {
  toolCalls: ToolCall[];
  summary: string;
}

function planStub(prompt: string): StubPlan {
  const p = prompt.toLowerCase();

  // Check for known tickers first.
  for (const [ticker, name] of Object.entries(TICKER_HINTS)) {
    if (p.includes(ticker.toLowerCase()) || p.includes(name.toLowerCase())) {
      const wantsLiq = /liquidity|central bank|cb balance|money printing|qe/.test(p);
      const calls: ToolCall[] = [{ name: "get_stock", arguments: { ticker } }];
      if (wantsLiq) calls.unshift({ name: "get_liquidity", arguments: {} });
      return { toolCalls: calls, summary: `Showing ${name} (${ticker})${wantsLiq ? " vs liquidity" : ""}.` };
    }
  }

  // Check for known assets.
  for (const [key, label] of Object.entries(ASSET_LABELS)) {
    const re = new RegExp(`\\b${label.toLowerCase().replace(/\s+/g, "\\s+")}\\b|\\b${key.toLowerCase()}\\b`);
    if (re.test(p)) {
      const wantsLiq = /liquidity|central bank|cb balance|money printing|qe/.test(p) || /vs|versus|against|and|overlay/.test(p);
      const calls: ToolCall[] = [{ name: "get_asset", arguments: { asset: key } }];
      if (wantsLiq) calls.unshift({ name: "get_liquidity", arguments: {} });
      return { toolCalls: calls, summary: `Showing ${label}${wantsLiq ? " vs liquidity" : ""}.` };
    }
  }

  // Liquidity alone.
  if (/liquidity|central bank|cb balance|money printing|qe/.test(p)) {
    return { toolCalls: [{ name: "get_liquidity", arguments: {} }], summary: "Showing global central-bank liquidity." };
  }

  // Debt.
  if (/debt/.test(p)) {
    const countryMatch = p.match(/\b(us|jp|gb|uk|de|fr|it|ca|au|cn|kr)\b/);
    const country = countryMatch ? countryMatch[1].toUpperCase() : "US";
    return {
      toolCalls: [{ name: "get_debt", arguments: { country, sector: "government" } }],
      summary: `Showing government debt for ${country}.`,
    };
  }

  // Default fallback.
  return {
    toolCalls: [{ name: "get_liquidity", arguments: {} }, { name: "get_asset", arguments: { asset: "SP500" } }],
    summary: "Showing liquidity vs S&P 500 (default). Try naming a specific asset or stock.",
  };
}

export class StubAgent implements Agent {
  private plan: StubPlan | null = null;
  private callIndex = 0;
  private results: ToolResult[] = [];

  async step(messages: ChatMessage[], _tools: ToolSpec[]): Promise<AgentStep> {
    // On first call, parse the prompt and build a plan.
    if (!this.plan) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      this.plan = planStub(lastUser?.content ?? "");
      this.callIndex = 0;
      this.results = [];
    }

    // Return one tool call at a time so the graph builds incrementally.
    if (this.callIndex < this.plan.toolCalls.length) {
      const tc = this.plan.toolCalls[this.callIndex];
      this.callIndex++;
      return {
        toolCalls: [tc],
        done: false,
        assistantMessage: { role: "assistant", content: `Calling ${tc.name}…`, toolCalls: [tc] },
      };
    }

    // All calls done.
    return {
      toolCalls: [],
      done: true,
      assistantMessage: { role: "assistant", content: this.plan.summary },
    };
  }

  async summarize(_messages: ChatMessage[], _prompt: string): Promise<string> {
    return this.plan?.summary ?? "Done. (stub agent)";
  }
}