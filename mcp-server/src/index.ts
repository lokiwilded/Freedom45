#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { finnhubProvider } from "./providers/finnhub.js";
import { getCongressTradesTool } from "./tools/get-congress-trades.js";
import { longAnalysisTools } from "./tools/long-analysis/index.js";

// Initialize Finnhub provider (API key from env)
const finnhubApiKey = process.env.FINNHUB_API_KEY;
if (finnhubApiKey) {
  finnhubProvider.init(finnhubApiKey);
} else {
  console.error("Warning: FINNHUB_API_KEY not set. Tools that use Finnhub will fail.");
}

// Tool registry — all tools from all categories
const tools: Record<string, { name: string; description: string; inputSchema: any; handler: (args: any) => Promise<any> }> = {
  // General tools
  hello: {
    name: "hello",
    description: "A simple hello world tool to verify the server works",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Your name" },
      },
      required: ["name"],
    },
    handler: async (args: { name: string }) => {
      return {
        content: [
          {
            type: "text",
            text: `Hello ${args.name}! Freedom45 MCP server is running.`,
          },
        ],
      };
    },
  },

  // Congressional trading
  get_congress_trades: getCongressTradesTool,
};

// Auto-discover tools from subdirectories
for (const tool of longAnalysisTools) {
  tools[tool.name] = tool;
}

const server = new Server(
  {
    name: "freedom45-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.values(tools).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
});

// Handle tool call requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = tools[name];
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await tool.handler(args || {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Freedom45 MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});