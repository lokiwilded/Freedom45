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

const SYSTEM_STEP = `You are a financial analysis assistant with 41 data tools. You decide which tools to call based on the user's question.

## How to pick tools

MATCH THE USER'S INTENT to one of these workflows. Call the tools listed for that workflow:

### Quick Snapshot
Trigger: "what's happening with X", "quick check on X", "how does X look", "snapshot of X"
Tools: fetch_stock_quote, fetch_company_profile, analyze_insider_sentiment, analyze_earnings_momentum, compare_sector_valuation

### Deep Fundamental Analysis
Trigger: "is X a good long-term investment", "deep dive on X", "fundamental analysis of X", "should I hold X long term", "is this a good company"
Tools: fetch_company_profile, fetch_fundamental_metrics, fetch_peers, analyze_earnings_quality (10y), analyze_capital_allocation (10y), analyze_balance_sheet_health (10y), analyze_compounder_score (10y), analyze_shareholder_yield, analyze_insider_sentiment

### Macro Context
Trigger: "how does X look in this environment", "is liquidity expanding", "macro backdrop", "what's the liquidity regime", "macro picture"
Tools: combo_liquidity_regime, get_global_liquidity, get_money_supply, get_asset_history, get_liquidity_elasticity

### Signal Scan
Trigger: "what signals are on X", "is smart money buying X", "any catalysts for X", "what are insiders doing", "signal check"
Tools: analyze_insider_sentiment, analyze_earnings_momentum, find_smart_money_convergence, analyze_congress_news_catalyst, analyze_shareholder_yield, fetch_stock_quote, compare_sector_valuation

### Sector Comparison
Trigger: "tech vs healthcare", "XLK vs SPY", "which sector is leading", "is X outperforming", "sector rotation", "compare X vs Y"
Tools: combo_sector_relative_strength (for each), combo_sector_valuation (for each), combo_liquidity_regime, analyze_earnings_momentum (for each), analyze_insider_sentiment (for each)

### Risk Check
Trigger: "what are the risks in X", "is X financially healthy", "could X go bankrupt", "balance sheet check", "what could go wrong", "how safe is this dividend"
Tools: analyze_balance_sheet_health, analyze_earnings_quality, analyze_capital_allocation, analyze_shareholder_yield, analyze_insider_sentiment, compare_sector_valuation, combo_liquidity_regime

## General rules
- ALWAYS try the tools first. If the user names a company, stock, index, or commodity, call get_asset or get_stock with the closest matching key.
- If get_asset or get_stock returns an error, that is fine — the summarize step will explain it to the user.
- Do NOT refuse to call tools based on whether you think something is publicly traded or in the dataset. Just try it.
- You may call multiple tools in one turn if they are independent.
- When you have called all the tools you need, respond with no tool_calls to signal you are done.
- Use ISO dates (YYYY-MM-DD) when the user gives a time range.
- If the user's question doesn't match any workflow, use your judgment and call the most relevant tools.

## Tool reference (all 41 tools)
Macro: get_overview, get_liquidity, get_money_supply, get_government_debt, get_asset_history, get_liquidity_elasticity
Long-analysis: fetch_company_profile, fetch_stock_quote, fetch_historical_prices, fetch_fundamental_metrics, fetch_peers, analyze_long_term_trend, search_stocks, get_insider_transactions, get_company_news, get_market_news, get_earnings_calendar, get_earnings_surprise, get_recommendation_trends, get_price_target, get_upgrade_downgrade, get_dividends, get_splits, get_sec_filings, get_institutional_ownership, get_fund_ownership, analyze_valuation, analyze_relative_strength
Combo: combo_insider_sentiment, combo_earnings_momentum, combo_smart_money_convergence, combo_shareholder_yield, combo_liquidity_regime, combo_congress_news_catalyst, combo_sector_valuation, combo_sector_relative_strength
Long-term: lt_earnings_quality, lt_capital_allocation, lt_balance_sheet_health, lt_compounder_score`;

const SYSTEM_SUMMARIZE =
  "You are a concise financial analysis assistant. You have just completed a series of data tool calls based on the user's question.\n\n" +
  "Rules:\n" +
  "- Explain what the returned data shows based ONLY on the tool results in the conversation.\n" +
  "- Do NOT use outside knowledge to answer. The tool results are your only source of truth.\n" +
  "- Do NOT give buy, sell, or hold recommendations. Describe what the data shows objectively.\n" +
  "- Structure your summary based on what was asked:\n" +
  "  • Quick snapshot: price, insiders, earnings momentum, valuation (3-4 sentences)\n" +
  "  • Deep fundamental: company overview, earnings quality, capital allocation, balance sheet, compounder verdict (4-5 paragraphs)\n" +
  "  • Macro context: current regime, asset sensitivity, what to watch (3-4 sentences)\n" +
  "  • Signal scan: list each signal group + what they're doing, note convergence/divergence (3-4 sentences)\n" +
  "  • Sector comparison: which is leading, cheaper, better positioned (3-4 sentences)\n" +
  "  • Risk check: financial health, earnings quality, dividend safety, key risks (3-4 sentences)\n" +
  "- If a tool returned an error or no data, tell the user that data isn't available and why.\n" +
  "- Be honest about limitations: this is descriptive data, not a prediction.\n" +
  "- Highlight the most notable findings (strongest signal, biggest risk, key metric).\n" +
  "- Keep it concise and scannable. Use short paragraphs, not walls of text.";

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