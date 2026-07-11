// Ollama Cloud agent — OpenAI-compatible chat completions with tool-calling.
//
// Implements the agentic loop interface: step() does one round of tool-calling,
// summarize() writes the final explanation. Talks through the Vite dev proxy
// at /llm (which injects the API key server-side from .env).

import type {
  Agent,
  AgentStep,
  AgentSettings,
  ChatMessage,
  ToolSpec,
  ToolCall,
  ToolResult,
} from "./types";

const SYSTEM_STEP = `You are a financial macro visualization assistant. You decide which data-fetching tools to call so the UI can graph what the user asked for.

RULES:
- ALWAYS try the tools first. If the user names a company, stock, index, or commodity, call get_asset or get_stock with the closest matching key. Let the tool tell you whether data exists — do NOT assume from your own knowledge.
- If the user says "show liquidity", call get_liquidity.
- If the user asks for a comparison (vs, against, and, overlay), call get_liquidity AND get_asset/get_stock for each named asset.
- If get_asset or get_stock returns an error, that is fine — the summarize step will explain it to the user.
- Do NOT refuse to call tools based on whether you think something is publicly traded or in the dataset. Just try it.
- You may call multiple tools in one turn if they are independent.
- When you have called all the tools you need, respond with no tool_calls to signal you are done.
- Use ISO dates (YYYY-MM-DD) when the user gives a time range.

COMBO ANALYSIS TOOLS — call these when the user wants deeper analysis on a ticker:
- combo_insider_sentiment: insider buying/selling pressure + verdict (e.g. "insider activity on AAPL", "are insiders buying NVDA?")
- combo_earnings_momentum: earnings beats, analyst recommendations, price targets (e.g. "earnings momentum for MSFT", "analyst sentiment on TSLA")
- combo_smart_money_convergence: insiders + institutions + funds + Congress alignment (e.g. "smart money on AAPL", "are institutions buying NVDA?")
- combo_shareholder_yield: dividend + buyback yield + sustainability (e.g. "shareholder yield for AAPL", "dividend analysis for KO")
- combo_liquidity_regime: global liquidity regime + asset impact (e.g. "liquidity regime for SP500", "is liquidity expanding or contracting?")
- combo_congress_news_catalyst: congressional trades matched to news (e.g. "congress trades on NVDA with news", "catalyst signals for AAPL")
- combo_sector_valuation: valuation vs sector peers + percentiles (e.g. "is AAPL overvalued vs peers?", "sector valuation for NVDA")
- combo_sector_relative_strength: sector vs benchmark + liquidity sensitivity (e.g. "XLK vs SP500", "relative strength of tech sector")
These tools return rich analysis with verdicts, scores, and graphable series — call them whenever the user asks for analysis beyond raw price/liquidity data.`;

const SYSTEM_SUMMARIZE =
  "You are a concise financial macro assistant. You have just completed a series of data tool calls.\n\n" +
  "Rules:\n" +
  "- Explain what the returned data shows based ONLY on the tool results in the conversation.\n" +
  "- If a tool returned an error or no data, tell the user that asset isn't available and suggest what is.\n" +
  "- Do NOT use outside knowledge to answer. The tool results are your only source of truth.\n" +
  "- Keep the explanation to 2-4 short paragraphs.\n" +
  "- Be honest about limitations: this is descriptive history, not a prediction.";

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

  async step(messages: ChatMessage[], tools: ToolSpec[]): Promise<AgentStep> {
    // Build the messages array for the LLM: system + conversation.
    const llmMessages: any[] = [{ role: "system", content: SYSTEM_STEP }];
    for (const m of messages) {
      if (m.role === "tool") {
        // OpenAI tool result format
        llmMessages.push({
          role: "tool",
          tool_call_id: m.name ?? "unknown",
          content: m.content,
        });
      } else if (m.role === "assistant" && m.toolCalls?.length) {
        llmMessages.push({
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc, i) => ({
            id: tc.id ?? `call_${i}`,
            type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        });
      } else {
        llmMessages.push({ role: m.role, content: m.content });
      }
    }

    const data = await this.chat(llmMessages, convertTools(tools));
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
      toolCalls,
      done: toolCalls.length === 0,
      assistantMessage: {
        role: "assistant",
        content: msg.content ?? "",
        toolCalls: toolCalls.length ? toolCalls : undefined,
      },
    };
  }

  async summarize(messages: ChatMessage[], prompt: string): Promise<string> {
    // Build a summarize request: system + the full conversation (including tool results).
    const llmMessages: any[] = [{ role: "system", content: SYSTEM_SUMMARIZE }];
    for (const m of messages) {
      if (m.role === "tool") {
        llmMessages.push({ role: "user", content: `[Tool result: ${m.name}]\n${m.content}` });
      } else if (m.role === "assistant" && m.toolCalls?.length) {
        // Skip assistant tool-call messages — the tool results that follow cover it
      } else {
        llmMessages.push({ role: m.role, content: m.content });
      }
    }
    llmMessages.push({
      role: "user",
      content: `Original request: ${prompt}\n\nSummarize what the data shows. If tools returned errors, explain what's available.`,
    });

    const data = await this.chat(llmMessages);
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("No response from model");
    return msg.content ?? "Done.";
  }
}