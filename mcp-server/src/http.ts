/**
 * Thin REST layer over the macro tools — powers the dashboard UI in local dev.
 *
 * Zero external deps: built on node:http. Route logic lives in api-handlers.ts (shared with
 * the static data dump). Read-only JSON, permissive CORS (personal/local dashboard).
 *
 * Run:  node --env-file=../.env --import tsx src/http.ts   (PORT env optional, default 8787)
 */

import http from "node:http";
import { routes } from "./api-handlers.js";

const PORT = Number(process.env.PORT ?? 8787);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const handler = routes[url.pathname];
  if (!handler) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Not found: ${url.pathname}`, routes: Object.keys(routes) }));
    return;
  }

  try {
    const data = await handler(url.searchParams);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  } catch (err: any) {
    console.error(`${url.pathname} failed:`, err?.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err?.message ?? "internal error" }));
  }
});

server.listen(PORT, () => {
  console.error(`Freedom45 macro API on http://localhost:${PORT}`);
  console.error(`Routes: ${Object.keys(routes).join(", ")}`);
});
