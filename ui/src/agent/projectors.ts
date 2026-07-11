// Projectors: convert ToolResult data into GraphLayer(s) for the GraphCanvas.
//
// Each projector handles a specific tool's data shape and produces the right
// layer type (line/area/histogram) with sensible axis assignment and color.

import type { ToolResult, GraphLayer, SeriesDataPoint } from "./types";

let layerCounter = 0;
function nextId() {
  return `layer-${++layerCounter}`;
}

const PALETTE = [
  "#2a78d6", // blue
  "#1baf7a", // green
  "#e8a838", // amber
  "#d466d4", // magenta
  "#e85d5d", // red
  "#5d9ce8", // light blue
  "#8bc34a", // light green
  "#ff8a65", // orange
];

function pickColor(index: number) {
  return PALETTE[index % PALETTE.length];
}

function toSeriesData(rows: { date: string; value: number | null }[] | undefined): SeriesDataPoint[] {
  if (!rows) return [];
  return rows
    .filter((r) => r.value != null && !Number.isNaN(r.value))
    .map((r) => ({ time: r.date, value: r.value as number }));
}

export interface ProjectionResult {
  layers: GraphLayer[];
  label?: string;
}

export function projectResult(result: ToolResult, colorIndex = 0): ProjectionResult {
  if (!result.ok) return { layers: [] };

  switch (result.name) {
    case "get_liquidity":
      return projectLiquidity(result, colorIndex);
    case "get_asset":
      return projectAsset(result, colorIndex);
    case "get_stock":
      return projectStock(result, colorIndex);
    case "get_debt":
      return projectDebt(result, colorIndex);
    case "get_elasticity":
      return projectElasticity(result, colorIndex);
    case "combo_insider_sentiment":
      return projectComboSeries(result, colorIndex, "netBuyValue", "Insider net buy $M", "line", "right");
    case "combo_earnings_momentum":
      return projectComboSeries(result, colorIndex, "surprisePct", "Earnings surprise %", "histogram", "right", "period");
    case "combo_smart_money_convergence":
      return { layers: [] }; // no time series — signals table only
    case "combo_shareholder_yield":
      return projectComboSeries(result, colorIndex, "totalYield", "Total yield %", "line", "right", "fiscalYear");
    case "combo_liquidity_regime":
      return projectComboSeries(result, colorIndex, "liquidityYoYPct", "Liquidity YoY %", "area", "left");
    case "combo_congress_news_catalyst":
      return projectComboSeries(result, colorIndex, "catalystScore", "Catalyst score", "histogram", "right");
    case "combo_sector_valuation":
      return { layers: [] }; // peer table, no time series
    case "combo_sector_relative_strength":
      return projectComboRs(result, colorIndex);
    case "lt_earnings_quality":
      return projectLtSeries(result, colorIndex, ["revenue", "netIncome", "operatingIncome", "grossProfit"], ["Revenue", "Net income", "Operating income", "Gross profit"], "fiscalYear");
    case "lt_capital_allocation":
      return projectLtSeries(result, colorIndex, ["dividends", "rd", "capex", "netIncome"], ["Dividends", "R&D", "Capex", "Net income"], "fiscalYear");
    case "lt_balance_sheet_health":
      return projectLtSeries(result, colorIndex, ["assets", "liabilities", "equity", "debt"], ["Assets", "Liabilities", "Equity", "Debt"], "fiscalYear");
    case "lt_compounder_score":
      return projectLtSeries(result, colorIndex, ["revenue", "eps", "bookValue"], ["Revenue", "EPS", "Book value"], "fiscalYear");
    default:
      return { layers: [] };
  }
}

function projectLiquidity(result: ToolResult, colorIndex: number): ProjectionResult {
  const data = result.data as { data?: { date: string; total_trillions: number }[] };
  const rows = data?.data?.map((d) => ({ date: d.date, value: d.total_trillions }));
  return {
    layers: [{
      id: nextId(),
      kind: "area",
      key: "liquidity",
      name: "Global CB liquidity",
      color: pickColor(colorIndex),
      yAxis: "left",
      data: toSeriesData(rows),
    }],
    label: "Global CB liquidity",
  };
}

function projectAsset(result: ToolResult, colorIndex: number): ProjectionResult {
  const data = result.data as { data?: { date: string; value: number }[]; label?: string; asset?: string };
  const label = data?.label ?? data?.asset ?? "Asset";
  return {
    layers: [{
      id: nextId(),
      kind: "line",
      key: data?.asset ?? "asset",
      name: label,
      color: pickColor(colorIndex),
      yAxis: "right",
      data: toSeriesData(data?.data),
    }],
    label,
  };
}

function projectStock(result: ToolResult, colorIndex: number): ProjectionResult {
  const data = result.data as { data?: { date: string; value: number }[]; label?: string; asset?: string };
  const label = data?.label ?? data?.asset ?? "Stock";
  return {
    layers: [{
      id: nextId(),
      kind: "line",
      key: `stock_${data?.asset ?? "unknown"}`,
      name: label,
      color: pickColor(colorIndex),
      yAxis: "right",
      data: toSeriesData(data?.data),
    }],
    label,
  };
}

function projectDebt(result: ToolResult, colorIndex: number): ProjectionResult {
  const data = result.data as { data?: { date: string; value: number }[]; country?: string; sector?: string };
  const label = `${data?.country ?? ""} ${data?.sector ?? "debt"}`.trim();
  return {
    layers: [{
      id: nextId(),
      kind: "line",
      key: `debt_${data?.country}_${data?.sector}`,
      name: label,
      color: pickColor(colorIndex),
      yAxis: "right",
      data: toSeriesData(data?.data),
    }],
    label,
  };
}

function projectElasticity(result: ToolResult, colorIndex: number): ProjectionResult {
  const data = result.data as { scatter?: { date: string; driverYoYPct: number; assetYoYPct: number }[]; asset?: string };
  // Render the asset YoY% as a line over time — a proxy for sensitivity visualization.
  const rows = data?.scatter?.map((d) => ({ date: d.date, value: d.assetYoYPct }));
  return {
    layers: [{
      id: nextId(),
      kind: "histogram",
      key: `elasticity_${data?.asset ?? "asset"}`,
      name: `${data?.asset ?? "Asset"} YoY%`,
      color: pickColor(colorIndex),
      yAxis: "right",
      data: toSeriesData(rows),
    }],
    label: `${data?.asset ?? "Asset"} elasticity`,
  };
}

// ── Combo tool projectors ──

function projectComboSeries(
  result: ToolResult,
  colorIndex: number,
  valueKey: string,
  name: string,
  kind: "line" | "area" | "histogram",
  yAxis: "left" | "right",
  dateKey = "date"
): ProjectionResult {
  const data = result.data as { series?: Record<string, any>[]; ticker?: string; asset?: string };
  const rows = data?.series?.map((s) => ({ date: s[dateKey] as string, value: s[valueKey] as number })) ?? [];
  const label = data?.ticker ?? data?.asset ?? name;
  return {
    layers: [{
      id: nextId(),
      kind,
      key: `combo_${valueKey}_${colorIndex}`,
      name: `${label}: ${name}`,
      color: pickColor(colorIndex),
      yAxis,
      data: toSeriesData(rows),
    }],
    label,
  };
}

function projectComboRs(result: ToolResult, colorIndex: number): ProjectionResult {
  const data = result.data as {
    series?: { date: string; tickerNormalized: number; benchmarkNormalized: number; relativeRatio: number | null }[];
    ticker?: string; benchmark?: string;
  };
  const rows1 = data?.series?.map((s) => ({ date: s.date, value: s.tickerNormalized })) ?? [];
  const rows2 = data?.series?.map((s) => ({ date: s.date, value: s.benchmarkNormalized })) ?? [];
  return {
    layers: [
      {
        id: nextId(),
        kind: "line",
        key: `rs_${data?.ticker ?? "ticker"}`,
        name: data?.ticker ?? "Ticker",
        color: pickColor(colorIndex),
        yAxis: "right",
        data: toSeriesData(rows1),
      },
      {
        id: nextId(),
        kind: "line",
        key: `rs_${data?.benchmark ?? "bench"}`,
        name: data?.benchmark ?? "Benchmark",
        color: pickColor(colorIndex + 1),
        yAxis: "right",
        data: toSeriesData(rows2),
      },
    ],
    label: `${data?.ticker ?? "RS"} vs ${data?.benchmark ?? "Benchmark"}`,
  };
}

function projectLtSeries(
  result: ToolResult,
  colorIndex: number,
  valueKeys: string[],
  names: string[],
  dateKey: string
): ProjectionResult {
  const data = result.data as { series?: Record<string, any>[]; ticker?: string };
  const series = data?.series ?? [];
  if (series.length === 0) return { layers: [], label: data?.ticker ?? "" };

  const layers = valueKeys.map((key, i) => {
    const rows = series
      .map((s) => ({ date: String(s[dateKey]), value: s[key] as number | null }))
      .filter((r) => r.value != null);
    return {
      id: nextId(),
      kind: "line" as const,
      key: `lt_${key}_${i}`,
      name: names[i] ?? key,
      color: pickColor(colorIndex + i),
      yAxis: "left" as const,
      data: toSeriesData(rows),
    };
  }).filter((l) => l.data.length > 0);

  return { layers, label: data?.ticker ?? "Long-term analysis" };
}