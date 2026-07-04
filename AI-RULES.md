# AI-RULES — Freedom45

## Hard Rules

- Never commit `.env` files or API keys
- Never commit `node_modules/` or `dist/`
- Always run `npx tsc --noEmit` from `mcp-server/` before committing
- Always run @reviewer after every implementation
- Log ideas to `plans/` as `.md` files
- When adding MCP tools, add a matching skill doc in `skills/`

## Code Location

- MCP server code: `mcp-server/src/`
- Tools: `mcp-server/src/tools/` (general) or `mcp-server/src/tools/<category>/` (grouped)
- Tests: `mcp-server/src/test/`
- Config/settings: `mcp-server/src/config/`
- Scoring engines: `mcp-server/src/scoring/`
- Providers: `mcp-server/src/providers/`
- Shared DB: `mcp-server/src/db.ts` (node:sqlite, single stocks.db)
- Cache helpers: `mcp-server/src/lib/cache.ts`

## Tool Pattern

Each tool exports:

```typescript
export const someTool = {
  name: "tool_name",
  description: "What it does",
  inputSchema: { type: "object", properties: { ... } },
  handler: async (args: any) => { ... }
};
```

Tools in subdirectories are auto-discovered via `index.ts` registry files.

## Testing

Tests go in `mcp-server/src/test/`. Run with:

```bash
cd mcp-server
node --env-file=../.env --import tsx src/test/<test-name>.test.ts
```

## Branches

- **loki** — Loki's workspace (outlier detection, congressional trading)
- **main** — combined version (future)
- **template** — shared foundation

Push to your own branch. Merge to main when ready to combine.
