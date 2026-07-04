# Freedom45

A shared workspace for building MCP tools for trading and investing.

## Structure

```
Freedom45/
├── AI-RULES.md        # Soft guidelines for AI agents
├── plans/             # Ideas and plans as .md files
├── skills/            # Skill documentation for each tool
└── mcp-server/        # MCP server (Node.js/TypeScript)
```

## Getting Started

```bash
git clone https://github.com/lokiwilded/Freedom45.git
cd Freedom45
git checkout -b <your-name> origin/template
git push origin <your-name>
```

Replace `<your-name>` with your branch name (e.g. `matt`, `loki`).

## Branches

- **template** — shared foundation, start here
- **main** — combined version (later)
- **<your-name>** — your personal workspace

Each person works on their own branch. Merge to main when ready to combine.

## MCP Server

```bash
cd mcp-server
npm install
npm run build
npm start
```

The server speaks MCP over stdio. Add your tools in `mcp-server/src/tools/`.
