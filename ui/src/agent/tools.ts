// Tool definitions + browser-side executors for the agent.
//
// Tools are NOT MCP tools — they are lightweight wrappers over the dashboard's
// existing static JSON (or the live /api endpoints in dev). This keeps the MCP server
// untouched: the agent consumes data, it does not add code to the MCP server.

import type { ToolSpec, ToolCall, ToolResult, SeriesPoint } from "./types.js";
import { api } from "../api.js";

// The set of tools the LLM (or stub) is allowed to call.
// Descriptions are tuned for LLM reasoning: they tell the model what each tool returns
// and how arguments map to the user's request.
export const AVAILABLE_TOOLS: ToolSpec[] = [
  {
    name: "get_liquidity",
    description:
      "Fetch the global central-bank liquidity time series. Returns monthly data from 2003 to today with total_trillions (USD) and per-bank components. Use this whenever the user asks about central-bank balance sheets, QE, liquidity, or wants to compare an asset against liquidity.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Optional start date YYYY-MM-DD. Default 2003-01-01." },
        to: { type: "string", description: "Optional end date YYYY-MM-DD. Default today." },
      },
    },
  },
  {
    name: "get_asset",
    description:
      "Fetch a historical asset time series for MAJOR INDEXES and COMMODITIES only (not individual stocks). Known assets: SP500, NASDAQ, DOW, US_MKTCAP, FTSE, DAX, ESTOXX50, CAC40, NIKKEI, HANGSENG, SHANGHAI, GOLD, SILVER, KOSPI, ASX200, TSX. The tool will return an error for unknown keys.",
    parameters: {
      type: "object",
      properties: {
        asset: { type: "string", description: "Asset key, e.g. 'SP500' or 'GOLD'" },
        from: { type: "string", description: "Optional start date YYYY-MM-DD." },
        to: { type: "string", description: "Optional end date YYYY-MM-DD." },
      },
      required: ["asset"],
    },
  },
  {
    name: "get_stock",
    description:
      "Fetch historical price data for an INDIVIDUAL STOCK by ticker symbol via Yahoo Finance. Use this when the user names a specific company or stock ticker (e.g. TSLA, AAPL, NVDA, MSFT). The tool tries the ticker directly — if Yahoo has no data it returns an error. Always try the user's term as the ticker first.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker symbol, e.g. 'TSLA', 'AAPL', 'NVDA'" },
        from: { type: "string", description: "Optional start date YYYY-MM-DD." },
        to: { type: "string", description: "Optional end date YYYY-MM-DD." },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_debt",
    description:
      "Fetch debt-to-GDP time series for a country and sector. Country: US, JP, GB, DE, FR, IT, CA, AU, CN, KR. Sectors: government, households, corporate. Use when the user asks about debt.",
    parameters: {
      type: "object",
      properties: {
        country: { type: "string", description: "Country code, e.g. 'US'" },
        sector: { type: "string", description: "Sector: 'government', 'households', or 'corporate'" },
      },
      required: ["country", "sector"],
    },
  },
  {
    name: "get_elasticity",
    description:
      "Fetch the liquidity-elasticity regression and scatter data for a driver/asset pair. Useful when the user asks how sensitive an asset is to liquidity changes.",
    parameters: {
      type: "object",
      properties: {
        driver: { type: "string", description: "Usually 'global_liquidity'" },
        asset: { type: "string", description: "Asset key, e.g. 'SP500' or 'GOLD'" },
      },
      required: ["driver", "asset"],
    },
  },
  {
    name: "get_overview",
    description: "Fetch the dashboard hero snapshot: latest liquidity, US market cap, US debt, M2, and key elasticity summary.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "combo_insider_sentiment",
    description:
      "Analyze insider buying/selling pressure for a ticker. Returns a descriptive verdict (Heavy Accumulation / Accumulation / Neutral / Distribution / Heavy Distribution / No Data), a 0-100 score, and a graphable daily net-buy series.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
        lookbackDays: { type: "number", description: "How many days back (default 90)" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "combo_earnings_momentum",
    description:
      "Analyze earnings and analyst momentum for a ticker. Combines earnings surprises, recommendation trends, price targets, and upgrades/downgrades into a descriptive verdict and 0-100 score.",
    parameters: {
      type: "object",
      properties: { ticker: { type: "string", description: "Stock ticker, e.g. AAPL" } },
      required: ["ticker"],
    },
  },
  {
    name: "combo_smart_money_convergence",
    description:
      "Find when insiders, institutions, funds, and Congress are aligned on a ticker. Returns a convergence verdict and per-group signals.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
        lookbackDays: { type: "number", description: "How many days back (default 90)" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "combo_shareholder_yield",
    description:
      "Analyze total shareholder yield for a ticker (dividend yield + implied buyback proxy). Returns a yield label, sustainability assessment, and annual series.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
        years: { type: "number", description: "Years back (default 5)" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "combo_liquidity_regime",
    description:
      "Scan the current global liquidity regime and its impact on an asset. Combines global CB liquidity, US M2, asset history, and liquidity elasticity. Returns a regime verdict, risk-on score, and graphable YoY series.",
    parameters: {
      type: "object",
      properties: {
        asset: { type: "string", description: "Asset key (SP500, NASDAQ, GOLD, etc.)", default: "SP500" },
        from: { type: "string", description: "Start date YYYY-MM-DD (optional)" },
        to: { type: "string", description: "End date YYYY-MM-DD (optional)" },
      },
    },
  },
  {
    name: "combo_congress_news_catalyst",
    description:
      "Analyze congressional trades for a ticker with nearby news to detect potential catalyst signals. Returns a catalyst verdict, lead/lag stats, and matched headlines.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
        lookbackDays: { type: "number", description: "How many days back (default 90)" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "combo_sector_valuation",
    description:
      "Compare a ticker's valuation vs sector peers. Returns percentile ranks for P/E, P/B, P/S, EV/EBITDA and PEG, a composite score, and value-trap flags.",
    parameters: {
      type: "object",
      properties: { ticker: { type: "string", description: "Stock ticker, e.g. AAPL" } },
      required: ["ticker"],
    },
  },
  {
    name: "combo_sector_relative_strength",
    description:
      "Analyze a sector proxy's relative strength vs a benchmark and its sensitivity to global liquidity. Returns a rotation verdict, alpha, beta, Sharpe, and graphable normalized comparison series.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Sector proxy ticker or asset key, e.g. XLK, AAPL" },
        benchmark: { type: "string", description: "Benchmark asset key (default SP500)", default: "SP500" },
        years: { type: "number", description: "Years to analyze (default 3)", default: 3 },
      },
      required: ["ticker"],
    },
  },
  {
    name: "lt_earnings_quality",
    description:
      "Analyze 10+ years of SEC financial data for earnings quality: revenue/EPS CAGR, margin trends (gross/operating/net), R&D intensity, accrual quality, earnings volatility, debt/equity, current ratio, ROE, ROA. Returns verdict (Excellent/Good/Moderate/Weak/Poor Quality) and 0-100 score with annual series.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
        years: { type: "number", description: "Years to analyze (default 10)", default: 10 },
      },
      required: ["ticker"],
    },
  },
  {
    name: "lt_capital_allocation",
    description:
      "Analyze how a company allocates capital over 10+ years: dividends, buybacks, R&D, capex, debt reduction. Returns verdict (Exceptional/Disciplined/Adequate/Inefficient/Value Destructive) and 0-100 score with annual series.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
        years: { type: "number", description: "Years to analyze (default 10)", default: 10 },
      },
      required: ["ticker"],
    },
  },
  {
    name: "lt_balance_sheet_health",
    description:
      "Analyze 10+ years of balance sheet health from SEC filings: current ratio, quick ratio, debt/equity, debt/assets, interest coverage, working capital, net debt/EBITDA, Altman Z-score. Returns verdict (Fortress/Strong/Adequate/Weak/Distressed) and 0-100 score with annual series.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
        years: { type: "number", description: "Years to analyze (default 10)", default: 10 },
      },
      required: ["ticker"],
    },
  },
  {
    name: "lt_compounder_score",
    description:
      "Score a company's compounder quality over 10+ years: revenue/EPS/book value CAGR, avg ROE and ROIC, margin stability, earnings consistency, growth-reinvestment balance, shareholder return years, price CAGR. Returns verdict (Elite/Strong/Moderate/Weak/Not a Compounder) and 0-100 score with annual series.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
        years: { type: "number", description: "Years to analyze (default 10)", default: 10 },
      },
      required: ["ticker"],
    },
  },
];

// Execute a tool call in the browser. Returns a ToolResult.
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const fail = (msg: string): ToolResult => ({
    toolCallId: call.id,
    name: call.name,
    ok: false,
    data: null,
    error: msg,
  });

  try {
    switch (call.name) {
      case "get_liquidity": {
        const data = await api.liquidity();
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "get_asset": {
        const asset = String(call.arguments.asset).toUpperCase();
        try {
          const data = await api.asset(asset);
          const any = data as { error?: string };
          if (any.error) return fail(any.error);
          return { toolCallId: call.id, name: call.name, ok: true, data };
        } catch (e: any) {
          return fail(e?.message ?? `Could not fetch asset '${asset}'.`);
        }
      }

      case "get_stock": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        try {
          const res = await fetch(`/api/stock?ticker=${encodeURIComponent(ticker)}`);
          if (!res.ok) return fail(`Server returned ${res.status} for ticker '${ticker}'.`);
          const data = await res.json();
          if (data.error) return fail(data.error);
          return { toolCallId: call.id, name: call.name, ok: true, data };
        } catch (e: any) {
          return fail(e?.message ?? `Could not fetch stock '${ticker}'.`);
        }
      }

      case "get_debt": {
        const country = String(call.arguments.country).toUpperCase();
        const sector = String(call.arguments.sector);
        const data = await api.debt(country, sector);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "get_elasticity": {
        const driver = String(call.arguments.driver);
        const asset = String(call.arguments.asset);
        const data = await api.elasticity(driver, asset);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "get_overview": {
        const data = await api.overview();
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      // ── Combo tools ──
      case "combo_insider_sentiment": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        const lookbackDays = Number(call.arguments.lookbackDays) || 90;
        const data = await api.comboInsiderSentiment(ticker, lookbackDays);
        if (data.error) return fail(data.error);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "combo_earnings_momentum": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        const data = await api.comboEarningsMomentum(ticker);
        if (data.error) return fail(data.error);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "combo_smart_money_convergence": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        const lookbackDays = Number(call.arguments.lookbackDays) || 90;
        const data = await api.comboSmartMoneyConvergence(ticker, lookbackDays);
        if (data.error) return fail(data.error);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "combo_shareholder_yield": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        const years = Number(call.arguments.years) || 5;
        const data = await api.comboShareholderYield(ticker, years);
        if (data.error) return fail(data.error);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "combo_liquidity_regime": {
        const asset = String(call.arguments.asset ?? "SP500").toUpperCase();
        const from = call.arguments.from ? String(call.arguments.from) : undefined;
        const to = call.arguments.to ? String(call.arguments.to) : undefined;
        const data = await api.comboLiquidityRegime(asset, from, to);
        if (data.error) return fail(data.error);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "combo_congress_news_catalyst": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        const lookbackDays = Number(call.arguments.lookbackDays) || 90;
        const data = await api.comboCongressNewsCatalyst(ticker, lookbackDays);
        if (data.error) return fail(data.error);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "combo_sector_valuation": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        const data = await api.comboSectorValuation(ticker);
        if (data.error) return fail(data.error);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "combo_sector_relative_strength": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        const benchmark = String(call.arguments.benchmark ?? "SP500").toUpperCase();
        const years = Number(call.arguments.years) || 3;
        const data = await api.comboSectorRelativeStrength(ticker, benchmark, years);
        if (data.error) return fail(data.error);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "lt_earnings_quality": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        const years = Number(call.arguments.years) || 10;
        const data = await api.ltEarningsQuality(ticker, years);
        if (data.error) return fail(data.error);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "lt_capital_allocation": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        const years = Number(call.arguments.years) || 10;
        const data = await api.ltCapitalAllocation(ticker, years);
        if (data.error) return fail(data.error);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "lt_balance_sheet_health": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        const years = Number(call.arguments.years) || 10;
        const data = await api.ltBalanceSheetHealth(ticker, years);
        if (data.error) return fail(data.error);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      case "lt_compounder_score": {
        const ticker = String(call.arguments.ticker).toUpperCase();
        const years = Number(call.arguments.years) || 10;
        const data = await api.ltCompounderScore(ticker, years);
        if (data.error) return fail(data.error);
        return { toolCallId: call.id, name: call.name, ok: true, data };
      }

      default:
        return fail(`Unknown tool: ${call.name}`);
    }
  } catch (err: any) {
    return fail(err?.message ?? String(err));
  }
}
