// Ollama Cloud agent — OpenAI-compatible chat completions with tool-calling.
//
// Talks through the Vite dev proxy at /llm (which injects the API key server-side
// from .env). In production the proxy doesn't exist, so we fall back to StubAgent.
//
// The agent is two-phase:
//   1. plan()    : send prompt + tool list, get tool_calls from the model.
//   2. interpret(): send tool results back, get text answer + an optional chart spec.

import type {
  Agent,
  AgentPlan,
  AgentInterpretation,
  AgentSettings,
  ChatMessage,
  ToolSpec,
  ToolCall,
  ToolResult,
  ChartSpec,
} from "./types";

const SYSTEM_PLAN = `You are a financial macro visualization assistant. Your job is to decide which data-fetching tools to call so the UI can graph what the user asked for.

Rules:
- Only call the provided tools.
- Prefer fetching both liquidity and the asset(s) the user named so the chart can show both on a dual-axis plot.
- If the user just says "show liquidity", call get_liquidity only.
- If the user asks for a comparison (vs, against, and, overlay), fetch liquidity AND the named asset(s).
- Output valid tool_calls; do not write prose in this turn.
- Use ISO dates (YYYY-MM-DD) when the user gives a time range. Defaults: from=2003-01-01, to=today.`;

const SYSTEM_INTERPRET =
  "You are a concise financial macro assistant explaining a chart to the user.\n\n" +
  "Rules:\n" +
  "- Summarize what the data shows in 2-4 short paragraphs.\n" +
  "- Be honest about limitations: this is descriptive history, not a prediction.\n" +
  "- At the end, output a JSON chart spec inside a markdown code block labelled \"```json\", using this exact schema:\n\n" +
  "{\n" +
  "  \"title\": \"string\",\n" +
  "  \"rows\": [{ \"date\": \"YYYY-MM-DD\", \"liquidity\": number|null, \"asset\": number|null }],\n" +
  "  \"series\": [\n" +
  "    { \"key\": \"liquidity\", \"name\": \"Global CB liquidity\", \"color\": \"#2a78d6\", \"type\": \"area\", \"yAxisId\": \"left\", \"formatter\": \"currencyT\" },\n" +
  "    { \"key\": \"asset\", \"name\": \"Asset name\", \"color\": \"#1baf7a\", \"type\": \"line\", \"yAxisId\": \"right\", \"formatter\": \"integer\" }\n" +
  "  ]\n" +
  "}\n\n" +
  "Formatter options: \"currencyT\" (e.g. $12.3T), \"integer\", \"percent\".\n" +
  "Rows must cover the same dates for both series; use null when a date is missing for one side.\n" +
  "If the user did not ask for a chart, you may omit the chart block.";

function convertTools(tools: ToolSpec[]): any[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function buildPlanMessages(prompt: string, tools: ToolSpec[], history: ChatMessage[]): any[] {
  const msgs: any[] = [{ role: "system", content: SYSTEM_PLAN }];
  for (const m of history) {
    if (m.role === "user") msgs.push({ role: "user", content: m.content });
    if (m.role === "assistant") {
      msgs.push({
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls?.map((tc, i) => ({
          id: tc.id ?? `call_${i}`,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      });
    }
  }
  msgs.push({ role: "user", content: prompt });
  return msgs;
}

function buildInterpretMessages(results: ToolResult[], history: ChatMessage[]): any[] {
  const msgs: any[] = [{ role: "system", content: SYSTEM_INTERPRET }];
  for (const m of history) {
    if (m.role === "user") msgs.push({ role: "user", content: m.content });
    if (m.role === "assistant") msgs.push({ role: "assistant", content: m.content });
  }
  // Append tool results as one user message.
  msgs.push({
    role: "user",
    content: `Tool results:\n\n${results
      .map((r) => `${r.name}: ${r.ok ? JSON.stringify(r.data).slice(0, 12000) : r.error}`)
      .join("\n\n")}\n\nNow explain this to the user and provide the JSON chart spec if appropriate.`,
  });
  return msgs;
}

export class OllamaAgent implements Agent {
  constructor(private settings: AgentSettings) {}

  private async chat(messages: any[], tools?: any[]): Promise<any> {
    const body: any = {
      model: this.settings.model,
      messages,
      stream: false,
      ...(tools ? { tools } : {}),
    };

    const res = await fetch("/llm/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Ollama proxy error ${res.status}: ${txt}`);
    }
    return res.json();
  }

  async plan(prompt: string, tools: ToolSpec[], history: ChatMessage[]): Promise<AgentPlan> {
    const data = await this.chat(buildPlanMessages(prompt, tools, history), convertTools(tools));
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("No response from model");

    const toolCalls: ToolCall[] =
      msg.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function?.name ?? tc.name,
        arguments: (() => {
          try {
            return JSON.parse(tc.function?.arguments ?? tc.arguments ?? "{}");
          } catch {
            return {};
          }
        })(),
      })) ?? [];

    return {
      text: msg.content ?? undefined,
      toolCalls,
      raw: { role: "assistant", content: msg.content ?? "", toolCalls },
    };
  }

  async interpret(results: ToolResult[], history: ChatMessage[]): Promise<AgentInterpretation> {
    const data = await this.chat(buildInterpretMessages(results, history));
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("No response from model");

    const content = msg.content ?? "";
    const chart = extractChart(content);

    return {
      text: chart ? content.split("```json")[0]?.trim() || content : content,
      chart,
      raw: { role: "assistant", content },
    };
  }
}

function extractChart(content: string): ChartSpec | undefined {
  const m = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!m) return undefined;
  try {
    const raw = JSON.parse(m[1]);
    return {
      title: raw.title,
      rows: raw.rows,
      series: raw.series.map((s: any) => ({
        ...s,
        formatter: parseFormatter(s.formatter),
      })),
    };
  } catch {
    return undefined;
  }
}

function parseFormatter(name?: string): (v: number | null) => string {
  switch (name) {
    case "currencyT":
      return (v) => (v == null ? "—" : `$${Number(v).toFixed(1)}T`);
    case "percent":
      return (v) => (v == null ? "—" : `${Number(v).toFixed(1)}%`);
    case "integer":
    default:
      return (v) => (v == null ? "—" : `${Math.round(Number(v))}`);
  }
}
