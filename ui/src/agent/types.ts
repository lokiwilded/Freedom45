// Swappable agent interface for the dashboard's AI chart-explorer.
//
// Design goals:
// - The agent is fully replaceable. Drop in a new Agent impl (OpenAI, local Ollama,
//   rule-based, etc.) and the UI doesn't change.
// - The agent runs an agentic loop: step() decides the next action, summarize() writes
//   the final explanation. Tool execution happens in the browser so the MCP server
//   stays untouched.
// - Graph layers are pure data — the GraphCanvas component renders them incrementally.

// --- Graph layer model (Desmos-style: agent projects layers onto a persistent canvas) ---

export interface SeriesDataPoint {
  time: string; // YYYY-MM-DD or YYYY-MM-01
  value: number;
}

export interface GraphLayer {
  id: string;
  kind: "line" | "area" | "histogram";
  key: string;
  name: string;
  color: string;
  yAxis: "left" | "right";
  data: SeriesDataPoint[];
}

export interface GraphMarker {
  id: string;
  seriesKey: string;
  time: string;
  position: "aboveBar" | "belowBar";
  text: string;
  color: string;
}

export interface GraphState {
  layers: GraphLayer[];
  markers: GraphMarker[];
  title?: string;
}

// --- Agent types ---

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

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  name?: string;
}

export interface AgentStep {
  toolCalls: ToolCall[];
  done: boolean;
  assistantMessage: ChatMessage;
}

export interface AgentSettings {
  baseURL: string;
  model: string;
  apiKey: string | null;
}

export interface Agent {
  /**
   * One step of the agentic loop. Given the conversation so far + available tools,
   * decide whether to call more tools or finish.
   */
  step(messages: ChatMessage[], tools: ToolSpec[]): Promise<AgentStep>;

  /**
   * After the loop finishes (done=true or max turns), produce a human explanation
   * of what was graphed.
   */
  summarize(messages: ChatMessage[], prompt: string): Promise<string>;
}