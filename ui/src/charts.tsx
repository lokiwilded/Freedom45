import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import type { Palette } from "./theme";

const yearTick = (d: string) => d.slice(0, 4);
const monthYearTick = (d: string) => {
  const [y, m] = d.split("-");
  return `${m}/${y?.slice(2)}`;
};

function TooltipBox({ active, payload, label, formatters }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <div className="tt-date">{label}</div>
      {[...payload].reverse().map((p: any) => {
        const fmt = formatters?.[p.dataKey] ?? ((v: unknown) => (v == null ? "—" : String(v)));
        return (
          <div className="tt-row" key={p.dataKey}>
            <span className="tt-swatch" style={{ background: p.stroke || p.fill }} />
            <span className="tt-name">{p.name}</span>
            <span className="tt-val">{fmt(p.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** One series definition for generic multi-line / composed charts. */
export interface SeriesConfig {
  key: string;
  name: string;
  color: string;
  type?: "line" | "area";
  yAxisId?: string;
  strokeWidth?: number;
  formatter?: (v: number | null) => string;
}

export interface TimeSeriesRow {
  date: string;
  [key: string]: string | number | null;
}

/**
 * Generic multi-series time-series chart.
 * Supports any number of line/area series on one or two Y axes.
 */
export function TimeSeriesChart({ rows, series, pal, height = 360, showLegend = true, sparse = false }: {
  rows: TimeSeriesRow[];
  series: SeriesConfig[];
  pal: Palette;
  height?: number;
  showLegend?: boolean;
  sparse?: boolean;
}) {
  const formatters = Object.fromEntries(series.map((s) => [s.key, s.formatter ?? String]));
  const leftSeries = series.filter((s) => s.yAxisId !== "right");
  const rightSeries = series.filter((s) => s.yAxisId === "right");
  const hasRightAxis = rightSeries.length > 0;

  const leftTickFormatter = leftSeries[0]?.formatter ?? String;
  const rightTickFormatter = rightSeries[0]?.formatter ?? String;

  const tickFmt = sparse ? (d: string) => d : yearTick;
  const tickGap = sparse ? 0 : 44;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: hasRightAxis ? 24 : 16, bottom: 4, left: 4 }}>
        <defs>
          {series.filter((s) => s.type === "area").map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.04} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={pal.grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={tickFmt}
          minTickGap={tickGap}
          tick={{ fill: pal.muted, fontSize: 12 }}
          stroke={pal.baseline}
        />
        <YAxis
          yAxisId="left"
          orientation="left"
          tick={{ fill: pal.muted, fontSize: 12 }}
          stroke={pal.baseline}
          width={54}
          tickFormatter={(v: number) => leftTickFormatter(v)}
        />
        {hasRightAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: pal.muted, fontSize: 12 }}
            stroke={pal.baseline}
            width={54}
            tickFormatter={(v: number) => rightTickFormatter(v)}
          />
        )}
        <Tooltip content={<TooltipBox formatters={formatters} />} />
        {showLegend && (
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: pal.secondary }} />
        )}
        {series.map((s) =>
          s.type === "area" ? (
            <Area
              key={s.key}
              yAxisId={s.yAxisId ?? "left"}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={s.strokeWidth ?? 2}
              fill={`url(#g-${s.key})`}
              dot={false}
              isAnimationActive={false}
            />
          ) : (
            <Line
              key={s.key}
              yAxisId={s.yAxisId ?? "left"}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={s.strokeWidth ?? 2}
              dot={false}
              isAnimationActive={false}
            />
          )
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Vertical reference bands for episodes (e.g. QE windows) shown behind the chart data. */
export function EpisodeBands({ episodes }: {
  episodes: { start: string; end: string; label: string; kind: "inject" | "drain" }[];
}) {
  // Recharts ReferenceLine can only draw a single vertical line; use pairs to bracket episodes.
  return episodes.map((e) => (
    <ReferenceLine
      key={`${e.label}-start`}
      x={e.start}
      stroke={e.kind === "drain" ? "#d03b3b" : "#0ca30c"}
      strokeDasharray="3 3"
      opacity={0.35}
    />
  ));
}

/** Debt by sector, stacked to total, % of GDP. */
export function DebtStack({ rows, sectors, pal }: {
  rows: any[]; sectors: { key: string; name: string; color: string }[]; pal: Palette;
}) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <AreaChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <defs>
          {sectors.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.6} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.16} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={pal.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={yearTick} minTickGap={44} tick={{ fill: pal.muted, fontSize: 12 }} stroke={pal.baseline} />
        <YAxis tick={{ fill: pal.muted, fontSize: 12 }} stroke={pal.baseline} width={44} tickFormatter={(v: number) => `${v}%`} />
        <Tooltip content={<TooltipBox formatters={Object.fromEntries(sectors.map((s) => [s.key, (v: number) => (v == null ? "—" : `${v.toFixed(0)}%`)]))} />} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: pal.secondary }} />
        {sectors.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stackId="1"
            stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} isAnimationActive={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Backward-compatible simple line chart for a single series.
export function SimpleLine({ rows, dataKey, name, color, pal, yFmt }: {
  rows: TimeSeriesRow[]; dataKey: string; name: string; color: string; pal: Palette;
  yFmt?: (v: number) => string;
}) {
  return (
    <TimeSeriesChart
      rows={rows}
      pal={pal}
      series={[{ key: dataKey, name, color, type: "line", formatter: (v) => yFmt?.(Number(v)) ?? String(v) }]}
    />
  );
}
