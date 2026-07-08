import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { Palette } from "./theme";

const yearTick = (d: string) => d.slice(0, 4);

function TooltipBox({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <div className="tt-date">{label}</div>
      {[...payload].reverse().map((p: any) => (
        <div className="tt-row" key={p.dataKey}>
          <span className="tt-swatch" style={{ background: p.stroke || p.fill }} />
          <span className="tt-name">{p.name}</span>
          <span className="tt-val">{fmt ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
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
        <Tooltip content={<TooltipBox fmt={(v: number) => (v == null ? "—" : `${v.toFixed(0)}%`)} />} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: pal.secondary }} />
        {sectors.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stackId="1"
            stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} isAnimationActive={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
