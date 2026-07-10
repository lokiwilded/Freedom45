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