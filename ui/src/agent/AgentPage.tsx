import { Component, useEffect, useRef, useState } from "react";
import type { ChatMessage, GraphState, ToolResult, Agent } from "./types";
import { AVAILABLE_TOOLS, executeTool } from "./tools";
import { OllamaAgent } from "./ollama";
import { StubAgent } from "./stub";
import { canUseLiveAgent, loadAgentSettings, saveAgentSettings, type AgentSettings } from "./settings";
import { projectResult } from "./projectors";
import GraphCanvas from "./GraphCanvas";

interface ChatStep {
  id: string;
  kind: "user" | "tool" | "text" | "error";
  text: string;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const MAX_TURNS = 10;

// Error boundary — prevents white screen on any React crash.
class PageErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: err?.message ?? String(err) };
  }
  componentDidCatch(err: any) {
    console.error("AgentPage crashed:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="agent-graph-empty" style={{ gridArea: "1 / 1 / -1 / -1" }}>
          <p>Something went wrong: {this.state.message}</p>
          <button type="button" className="agent-clear-btn" onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AgentPage() {
  const [settings, setSettings] = useState<AgentSettings>(loadAgentSettings);
  const [live, setLive] = useState(canUseLiveAgent());
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");
  const [chatSteps, setChatSteps] = useState<ChatStep[]>([]);
  const [running, setRunning] = useState(false);
  const [graph, setGraph] = useState<GraphState>({ layers: [], markers: [] });
  const colorIdxRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatSteps]);

  // Create a fresh agent for each conversation (stub holds internal state).
  const agentRef = useRef<Agent | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || running) return;

    const prompt = input.trim();
    setInput("");
    setRunning(true);
    setChatSteps((prev) => [...prev, { id: makeId(), kind: "user", text: prompt }]);

    // Create a new agent for this conversation.
    agentRef.current = live ? new OllamaAgent(settings) : new StubAgent();
    const agent = agentRef.current;

    try {
      // Build conversation messages for the agent loop.
      const messages: ChatMessage[] = [
        ...chatSteps
          .filter((s) => s.kind === "user" || s.kind === "text")
          .map((s) => ({
            role: (s.kind === "user" ? "user" : "assistant") as "user" | "assistant",
            content: s.text,
          })),
        { role: "user", content: prompt },
      ];

      // Agentic loop: step → execute tools → project onto graph → repeat.
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const step = await agent.step(messages, AVAILABLE_TOOLS);

        // Add assistant's thinking to chat.
        if (step.assistantMessage.content && step.toolCalls.length === 0) {
          // This is the "done" message — hold it for summarize.
        }

        if (step.done) {
          messages.push(step.assistantMessage);
          break;
        }

        messages.push(step.assistantMessage);

        // Execute each tool call and project onto the graph immediately.
        for (const tc of step.toolCalls) {
          setChatSteps((prev) => [
            ...prev,
            { id: makeId(), kind: "tool", text: `Calling ${tc.name}…` },
          ]);

          const result = await executeTool(tc);

          // Add tool result to conversation for the next step.
          messages.push({
            role: "tool",
            name: tc.name,
            content: result.ok ? JSON.stringify(result.data).slice(0, 12000) : `Error: ${result.error}`,
          });

          setChatSteps((prev) => [
            ...prev,
            { id: makeId(), kind: "tool", text: `${tc.name}: ${result.ok ? "ok" : "failed"}` },
          ]);

          // PROJECT onto graph immediately — the user sees the series appear.
          if (result.ok) {
            const projection = projectResult(result, colorIdxRef.current);
            if (projection.layers.length) {
              colorIdxRef.current += projection.layers.length;
              setGraph((prev) => ({
                ...prev,
                layers: [...prev.layers, ...projection.layers],
              }));
            }
          }
        }
      }

      // Summarize.
      const summary = await agent.summarize(messages, prompt);
      setChatSteps((prev) => [...prev, { id: makeId(), kind: "text", text: summary }]);
    } catch (err: any) {
      setChatSteps((prev) => [
        ...prev,
        { id: makeId(), kind: "error", text: `Agent error: ${err?.message ?? String(err)}` },
      ]);
    } finally {
      setRunning(false);
    }
  }

  function clearGraph() {
    setGraph({ layers: [], markers: [] });
    colorIdxRef.current = 0;
  }

  function updateSettings(next: Partial<AgentSettings>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    saveAgentSettings(next);
    setLive(canUseLiveAgent());
  }

  return (
    <PageErrorBoundary>
    <div className="agent-split">
      {/* GRAPH — dominant left panel */}
      <div className="agent-graph-panel">
        <div className="agent-graph-toolbar">
          <span className={`agent-dot ${live ? "on" : "off"}`} />
          {live ? `Live: ${settings.model}` : "Stub agent"}
          <button type="button" className="agent-clear-btn" onClick={clearGraph} disabled={running}>
            Clear graph
          </button>
          <button type="button" className="agent-settings-toggle" onClick={() => setShowSettings((s) => !s)}>
            {showSettings ? "Hide settings" : "Settings"}
          </button>
        </div>

        {showSettings && (
          <div className="agent-settings">
            <label>
              Base URL
              <input type="text" value={settings.baseURL} onChange={(e) => updateSettings({ baseURL: e.target.value })} placeholder="https://ollama.com/v1" />
            </label>
            <label>
              Model
              <input type="text" value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })} placeholder="glm-5.2" />
            </label>
            <label>
              API key
              <input type="password" value={settings.apiKey ?? ""} onChange={(e) => updateSettings({ apiKey: e.target.value || null })} placeholder="Set in .env for dev proxy" />
            </label>
            <p className="note">In dev, the Vite proxy reads the key from .env. In production, only the StubAgent runs.</p>
          </div>
        )}

        <div className="agent-graph-container">
          {graph.layers.length === 0 ? (
            <div className="agent-graph-empty">
              <p>Ask the agent to graph something.</p>
              <p className="note">e.g. "show liquidity vs gold", "show me TSLA", "debt for Japan"</p>
            </div>
          ) : (
            <GraphCanvas state={graph} />
          )}
        </div>
      </div>

      {/* CHAT — right panel */}
      <div className="agent-chat-panel">
        <div className="agent-transcript" ref={chatScrollRef}>
          {chatSteps.length === 0 && (
            <div className="agent-empty">
              Try: "Show liquidity vs gold", "Show me TSLA", or "Debt for Japan".
            </div>
          )}
          {chatSteps.map((s) => (
            <div key={s.id} className={`agent-step agent-step-${s.kind}`}>
              {s.kind === "user" && <div className="agent-bubble user">{s.text}</div>}
              {s.kind === "tool" && <div className="agent-step-tool">{s.text}</div>}
              {s.kind === "text" && <div className="agent-bubble assistant">{s.text}</div>}
              {s.kind === "error" && <div className="agent-bubble error">{s.text}</div>}
            </div>
          ))}
        </div>

        <form className="agent-input-row" onSubmit={onSubmit}>
          <input
            className="agent-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={live ? "Ask the live glm-5.2 agent…" : "Ask the stub agent…"}
            disabled={running}
            aria-label="Ask the agent"
          />
          <button type="submit" className="agent-send" disabled={running || !input.trim()}>
            {running ? "…" : "Send"}
          </button>
        </form>
      </div>
    </div>
    </PageErrorBoundary>
  );
}