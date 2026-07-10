import { Component, useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { GraphState, GraphLayer, SeriesDataPoint } from "./types";

const COLORS = {
  grid: "rgba(255,255,255,0.06)",
  gridDark: "rgba(255,255,255,0.04)",
  text: "rgba(255,255,255,0.5)",
  border: "rgba(255,255,255,0.1)",
  background: "transparent",
};

// Sort + deduplicate by time — lightweight-charts throws on unsorted/duplicate data.
function cleanData(data: SeriesDataPoint[]): { time: Time; value: number }[] {
  const seen = new Set<string>();
  return data
    .filter((d) => d.value != null && !Number.isNaN(d.value) && d.time)
    .sort((a, b) => a.time.localeCompare(b.time))
    .filter((d) => {
      if (seen.has(d.time)) return false;
      seen.add(d.time);
      return true;
    })
    .map((d) => ({ time: d.time as Time, value: d.value }));
}

function GraphInner({ state }: { state: GraphState }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMap = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const prevLayerIds = useRef<string[]>([]);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const w = el.clientWidth || 600;
    const h = el.clientHeight || 400;

    const chart = createChart(el, {
      width: w,
      height: h,
      layout: { background: { color: COLORS.background }, textColor: COLORS.text, fontSize: 12 },
      grid: { vertLines: { color: COLORS.grid, visible: true }, horzLines: { color: COLORS.gridDark, visible: true } },
      rightPriceScale: { borderColor: COLORS.border, visible: true, scaleMargins: { top: 0.1, bottom: 0.1 }, entireTextOnly: true },
      leftPriceScale: { borderColor: COLORS.border, visible: true, scaleMargins: { top: 0.1, bottom: 0.1 }, entireTextOnly: true },
      timeScale: { borderColor: COLORS.border, visible: true, timeVisible: false, secondsVisible: false, rightOffset: 4, barSpacing: 8 },
      crosshair: { mode: 1 },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, horzTouchDrag: true, vertTouchDrag: true },
    });

    chartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e && chartRef.current) {
        chartRef.current.applyOptions({ width: e.contentRect.width || 600, height: e.contentRect.height || 400 });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      try { chart.remove(); } catch { /* already removed */ }
      chartRef.current = null;
      seriesMap.current.clear();
      prevLayerIds.current = [];
    };
  }, []);

  // Sync layers when state changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    try {
      const currentIds = state.layers.map((l) => l.id);
      const prevIds = prevLayerIds.current;

      // Remove layers no longer present
      for (const id of prevIds) {
        if (!currentIds.includes(id)) {
          const s = seriesMap.current.get(id);
          if (s) {
            try { chart.removeSeries(s); } catch { /* already removed */ }
            seriesMap.current.delete(id);
          }
        }
      }

      // Add or update layers
      for (const layer of state.layers) {
        const data = cleanData(layer.data);
        if (!data.length) continue;

        const existing = seriesMap.current.get(layer.id);
        if (existing) {
          existing.setData(data);
          continue;
        }

        const priceScaleId = layer.yAxis === "left" ? "left" : "right";
        let series: ISeriesApi<any>;

        if (layer.kind === "area") {
          series = chart.addSeries(AreaSeries, {
            title: layer.name,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            priceScaleId,
            lineColor: layer.color,
            topColor: layer.color + "50",
            bottomColor: layer.color + "05",
          });
        } else if (layer.kind === "histogram") {
          series = chart.addSeries(HistogramSeries, {
            color: layer.color,
            priceFormat: { type: "price" },
            priceScaleId,
          });
        } else {
          series = chart.addSeries(LineSeries, {
            color: layer.color,
            title: layer.name,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            priceScaleId,
          });
        }

        series.setData(data);
        seriesMap.current.set(layer.id, series);

        // Markers
        const layerMarkers = state.markers.filter((m) => m.seriesKey === layer.key);
        if (layerMarkers.length) {
          const markers: SeriesMarker<Time>[] = layerMarkers.map((m) => ({
            time: m.time as Time,
            position: m.position,
            color: m.color,
            shape: "arrowDown" as const,
            text: m.text,
          }));
          createSeriesMarkers(series, markers);
        }
      }

      prevLayerIds.current = state.layers.map((l) => l.id);

      if (state.layers.length > 0) {
        chart.timeScale().fitContent();
      }
    } catch (err) {
      console.error("GraphCanvas sync error:", err);
    }
  }, [state]);

  return <div ref={containerRef} className="graph-canvas" />;
}

// Error boundary — catches crashes from lightweight-charts and shows a fallback.
interface EBState { hasError: boolean; message: string; }
class GraphErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { hasError: false, message: "" };
  static getDerivedStateFromError(err: any): EBState {
    return { hasError: true, message: err?.message ?? String(err) };
  }
  componentDidCatch(err: any) {
    console.error("GraphCanvas crashed:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="agent-graph-empty">
          <p>Graph error: {this.state.message}</p>
          <p className="note">The chart failed to render. Try clearing the graph and asking again.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function GraphCanvas({ state }: { state: GraphState }) {
  return (
    <GraphErrorBoundary>
      <GraphInner state={state} />
    </GraphErrorBoundary>
  );
}