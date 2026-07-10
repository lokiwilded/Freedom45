import { useEffect, useRef } from "react";
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
import type { GraphState, GraphLayer } from "./types";

const COLORS = {
  grid: "rgba(255,255,255,0.06)",
  gridDark: "rgba(255,255,255,0.04)",
  text: "rgba(255,255,255,0.5)",
  border: "rgba(255,255,255,0.1)",
  background: "transparent",
};

export default function GraphCanvas({ state }: { state: GraphState }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMap = useRef<Map<string, ISeriesApi<any>>>(new Map());
  const prevLayerIds = useRef<string[]>([]);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: COLORS.background },
        textColor: COLORS.text,
        fontSize: 12,
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.gridDark },
      },
      rightPriceScale: { borderColor: COLORS.border },
      leftPriceScale: { borderColor: COLORS.border, visible: true },
      timeScale: {
        borderColor: COLORS.border,
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, horzTouchDrag: true, vertTouchDrag: true },
    });

    chartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e && chartRef.current) {
        chartRef.current.applyOptions({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesMap.current.clear();
      prevLayerIds.current = [];
    };
  }, []);

  // Sync layers when state changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const currentIds = state.layers.map((l) => l.id);
    const prevIds = prevLayerIds.current;

    // Remove layers that are no longer present
    for (const id of prevIds) {
      if (!currentIds.includes(id)) {
        const s = seriesMap.current.get(id);
        if (s) {
          chart.removeSeries(s);
          seriesMap.current.delete(id);
        }
      }
    }

    // Add or update layers
    for (const layer of state.layers) {
      const existing = seriesMap.current.get(layer.id);
      const data = layer.data.map((d) => ({ time: d.time as Time, value: d.value }));

      if (existing) {
        // Update existing series data
        existing.setData(data);
        continue;
      }

      // Create new series
      let series: ISeriesApi<any>;
      const priceScaleId = layer.yAxis === "left" ? "left" : "right";
      const seriesOptions: any = {
        color: layer.color,
        title: layer.name,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        priceScaleId,
      };

      if (layer.kind === "area") {
        series = chart.addSeries(AreaSeries, {
          ...seriesOptions,
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
        series = chart.addSeries(LineSeries, seriesOptions);
      }

      series.setData(data);
      seriesMap.current.set(layer.id, series);

      // Attach markers if this layer has any.
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

    prevLayerIds.current = currentIds;

    // Fit content if we have data
    if (state.layers.length > 0) {
      chart.timeScale().fitContent();
    }
  }, [state]);

  return <div ref={containerRef} className="graph-canvas" />;
}