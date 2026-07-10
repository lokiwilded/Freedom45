// Agent settings resolver.
//
// In development the Vite proxy at /llm forwards to Ollama Cloud and injects the
// API key from .env, so the browser does not need to know the key. We only need
// the baseURL + model name from the environment (or hardcoded defaults) to display
// in the UI.
//
// In production (GitHub Pages static build) there is no proxy, so we always fall
// back to the StubAgent.

import type { AgentSettings } from "./types";
export type { AgentSettings };

const DEFAULTS: AgentSettings = {
  baseURL: "https://ollama.com/v1",
  model: "glm-5.2",
  apiKey: null,
};

const STORAGE_KEY = "freedom45-agent-settings";

function isDev(): boolean {
  return import.meta.env.DEV;
}

export function loadAgentSettings(): AgentSettings {
  const stored = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Partial<AgentSettings>) : null;
    } catch {
      return null;
    }
  })();

  // In dev we allow overriding via localStorage; in prod we ignore the key.
  const apiKey = isDev() ? stored?.apiKey ?? DEFAULTS.apiKey : null;

  return {
    baseURL: stored?.baseURL || DEFAULTS.baseURL,
    model: stored?.model || DEFAULTS.model,
    apiKey,
  };
}

export function saveAgentSettings(partial: Partial<AgentSettings>) {
  const current = loadAgentSettings();
  const next = {
    baseURL: partial.baseURL ?? current.baseURL,
    model: partial.model ?? current.model,
    apiKey: partial.apiKey ?? current.apiKey,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function canUseLiveAgent(): boolean {
  // In dev, the Vite proxy injects the key from .env server-side, so the browser
  // does not need to possess the key. We simply need to be in dev mode.
  // localStorage key is treated as an optional override, not a requirement.
  return isDev();
}
