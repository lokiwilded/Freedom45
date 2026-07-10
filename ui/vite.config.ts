import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Dev: proxy /api → the local macro API on :8787 (no CORS), and /llm → Ollama Cloud
// (injects OLLAMA_API_KEY from .env so the browser never sees it).
// Build: relative base so assets resolve under the GitHub Pages subpath (/<repo>/), whatever
// the repo is named. In prod the app reads baked static JSON instead of the API.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");

  return {
    base: command === "build" ? "./" : "/",
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": { target: "http://localhost:8787", changeOrigin: true },
        "/llm": {
          target: env.OLLAMA_BASE_URL || "https://ollama.com/v1",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/llm/, ""),
          configure: (proxy, _options) => {
            proxy.on("proxyReq", (proxyReq, _req, _res) => {
              const key = env.OLLAMA_API_KEY;
              if (key) proxyReq.setHeader("Authorization", `Bearer ${key}`);
            });
          },
        },
      },
    },
  };
});
