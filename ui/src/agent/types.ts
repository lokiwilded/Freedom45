// Swappable agent interface for the dashboard's AI chart-explorer.
//
// Design goals:
// - The agent is fully replaceable. Drop in a new Agent impl (OpenAI, local Ollama,
//   rule-based, etc.) and the UI doesn't change.
// - The agent only plans and interprets. Actual tool execution happens in the browser
//   (fetching static JSON / live API) so the MCP server stays untouched.
// - Chart specs are pure data — the existing TimeSeriesChart renders them.

import type { SeriesConfig, TimeSeriesRow } from "../charts";

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId?: string;
  name: string;
  ok: boolean;
  data: unknown;
  error?: string;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface ChartSpec {
  title: string;
  rows: TimeSeriesRow[];
  series: SeriesConfig[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface AgentPlan {
  text?: string;
  toolCalls: ToolCall[];
  raw: ChatMessage;
}

export interface AgentInterpretation {
  text: string;
  chart?: ChartSpec;
  raw: ChatMessage;
}

export interface AgentSettings {
  baseURL: string;
  model: string;
  apiKey: string | null;
}

export interface Agent {
  /** Given a user prompt + available tools + conversation history, decide which tools to call. */
  plan(prompt: string, tools: ToolSpec[], history: ChatMessage[]): Promise<AgentPlan>;

  /** Given the tool results, produce a human explanation and an optional chart spec. */
  interpret(results: ToolResult[], history: ChatMessage[]): Promise<AgentInterpretation>;
}
