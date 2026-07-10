import { useEffect, useRef, useState } from "react";
import { useTheme } from "../theme";
import { TimeSeriesChart } from "../charts";
import type { ChatMessage, ChartSpec, ToolResult, Agent } from "./types";
import { AVAILABLE_TOOLS, executeTool } from "./tools";
import { OllamaAgent } from "./ollama";
import { StubAgent } from "./stub";
import { canUseLiveAgent, loadAgentSettings, saveAgentSettings, type AgentSettings } from "./settings";

interface Step {
  id: string;
  kind: "user" | "tool" | "chart" | "text" | "error";
  text: string;
  toolResult?: ToolResult;
  chart?: ChartSpec;
}

const fmtNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function AgentPage() {
  const pal = useTheme();
  const [settings, setSettings] = useState<AgentSettings>(loadAgentSettings);
  const [live, setLive] = useState(canUseLiveAgent());
  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [steps]);

  const agent: Agent = live ? new OllamaAgent(settings) : new StubAgent();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || running) return;

    const prompt = input.trim();
    setInput("");
    setRunning(true);
    setSteps((prev) => [...prev, { id: crypto.randomUUID(), kind: "user", text: prompt }]);

    try {
      const history: ChatMessage[] = steps
        .filter((s) => s.kind === "user" || s.kind === "text")
        .map((s) => ({
          role: s.kind === "user" ? "user" : "assistant",
          content: s.text,
        }));

      // Phase 1: plan.
      const plan = await agent.plan(prompt, AVAILABLE_TOOLS, history);

      // Phase 2: execute tools.
      const results: ToolResult[] = [];
      for (const tc of plan.toolCalls) {
        setSteps((prev) => [
          ...prev,
          { id: crypto.randomUUID(), kind: "tool", text: `Calling ${tc.name}…` },
        ]);
        const r = await executeTool(tc);
        results.push(r);
        setSteps((prev) => [
          ...prev,
          { id: crypto.randomUUID(), kind: "tool", text: `${r.name}: ${r.ok ? "ok" : "failed"}`, toolResult: r },
        ]);
      }

      // Phase 3: interpret.
      const interpretation = await agent.interpret(results, [
        ...history,
        { role: "user", content: prompt },
        plan.raw,
      ]);

      setSteps((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "text", text: interpretation.text },
      ]);

      const chart = interpretation.chart;
      if (chart) {
        setSteps((prev) => [
          ...prev,
          { id: crypto.randomUUID(), kind: "chart", text: chart.title, chart },
        ]);
      }
    } catch (err: any) {
      setSteps((prev) => [
        ...prev,
        { id: crypto.randomUUID(), kind: "error", text: `Agent error: ${err?.message ?? String(err)}` },
      ]);
    } finally {
      setRunning(false);
    }
  }

  function updateSettings(next: Partial<AgentSettings>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    saveAgentSettings(next);
    setLive(canUseLiveAgent());
  }

  return (
    <section className="agent">
      <div className="section-head">
        <h2>Ask the dashboard</h2>
        <p className="note">
          Tell the agent what to graph — e.g. “show liquidity vs gold since 2015”. It picks tools, fetches data, and renders a chart. The agent runs in the browser and is fully swappable.
        </p>
      </div>

      <div className="agent-status">
        <span className={`agent-dot ${live ? "on" : "off"}`} />
        {live ? `Live agent: ${settings.model}` : "Stub agent (no live LLM)"}
        <button type="button" className="agent-settings-toggle" onClick={() => setShowSettings((s) => !s)}>
          {showSettings ? "Hide settings" : "Settings"}
        </button>
      </div>

      {showSettings && (
        <div className="agent-settings">
          <label>
            Base URL
            <input
              type="text"
              value={settings.baseURL}
              onChange={(e) => updateSettings({ baseURL: e.target.value })}
              placeholder="https://ollama.com/v1"
            />
          </label>
          <label>
            Model
            <input
              type="text"
              value={settings.model}
              onChange={(e) => updateSettings({ model: e.target.value })}
              placeholder="glm-5.2"
            />
          </label>
          <label>
            API key
            <input
              type="password"
              value={settings.apiKey ?? ""}
              onChange={(e) => updateSettings({ apiKey: e.target.value || null })}
              placeholder="Set in .env for dev proxy"
            />
          </label>
          <p className="note">In dev, the Vite proxy reads the key from .env and forwards to Ollama. In production, only the StubAgent runs.</p>
        </div>
      )}

      <div className="agent-transcript" ref={scrollRef}>
        {steps.length === 0 && (
          <div className="agent-empty">
            Try: “Show liquidity vs gold”, “Compare Nasdaq and S&amp;P 500”, or “Debt by sector for Japan”.
          </div>
        )}
        {steps.map((s) => (
          <div key={s.id} className={`agent-step agent-step-${s.kind}`}>
            {s.kind === "user" && <div className="agent-bubble user">{s.text}</div>}
            {s.kind === "tool" && (
              <div className="agent-step-tool">
                <span className="agent-time">{fmtNow()}</span> {s.text}
                {s.toolResult && !s.toolResult.ok && <span className="agent-err-detail">{s.toolResult.error}</span>}
              </div>
            )}
            {s.kind === "text" && <div className="agent-bubble assistant">{s.text}</div>}
            {s.kind === "error" && <div className="agent-bubble error">{s.text}</div>}
            {s.kind === "chart" && s.chart && (
              <div className="agent-chart">
                <div className="panel-head"><h3>{s.chart.title}</h3></div>
                <TimeSeriesChart rows={s.chart.rows} series={s.chart.series} pal={pal} height={360} />
              </div>
            )}
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
    </section>
  );
}
