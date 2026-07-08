/**
 * Descriptive "how much does it move" statistics for a time series (pure, no I/O).
 *
 * Backtest-style summary: cumulative changes over standard horizons, annualized growth,
 * and the distribution of year-over-year moves (average, volatility, best/worst). Recomputes
 * from the full history each call, so it tracks new data automatically.
 */

export interface Pt { date: string; value: number }
export interface DatedPct { date: string; pct: number }

export interface SeriesStats {
  first: Pt;
  latest: Pt;
  spanYears: number;
  cagrPct: number | null;        // annualized growth over the whole series
  change1yPct: number | null;
  change3yPct: number | null;
  change5yPct: number | null;
  changeSince2003Pct: number | null;
  avgYoYPct: number | null;      // mean year-over-year move
  volYoYPct: number | null;      // std dev of year-over-year moves
  bestYoY: DatedPct | null;
  worstYoY: DatedPct | null;
  positiveYearsPct: number | null; // share of months whose YoY was positive
}

const clean = (d: Pt[]) =>
  d.filter((p) => p.value != null && Number.isFinite(p.value)).sort((a, b) => a.date.localeCompare(b.date));

function monthsBefore(dateISO: string, n: number): string {
  const [y, m] = dateISO.split("-").map(Number);
  const idx = y! * 12 + (m! - 1) - n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}-01`;
}
const valueAtOrBefore = (d: Pt[], target: string) => [...d].reverse().find((p) => p.date <= target)?.value;
const valueAtOrAfter = (d: Pt[], target: string) => d.find((p) => p.date >= target)?.value;

export function seriesStats(raw: Pt[]): SeriesStats | null {
  const d = clean(raw);
  if (d.length < 2) return null;
  const first = d[0]!, latest = d[d.length - 1]!;

  const spanYears = (Date.parse(latest.date) - Date.parse(first.date)) / (365.25 * 864e5);
  const cagrPct = spanYears > 0 && first.value > 0 ? (Math.pow(latest.value / first.value, 1 / spanYears) - 1) * 100 : null;

  const changeOver = (months: number): number | null => {
    const v = valueAtOrBefore(d, monthsBefore(latest.date, months));
    return v && v !== 0 ? (latest.value / v - 1) * 100 : null;
  };
  const v2003 = valueAtOrAfter(d, "2003-01-01");
  const changeSince2003Pct = v2003 && v2003 !== 0 ? (latest.value / v2003 - 1) * 100 : null;

  // Year-over-year distribution.
  const map = new Map(d.map((p) => [p.date, p.value]));
  const yoy: DatedPct[] = [];
  for (const p of d) {
    const priorKey = `${Number(p.date.slice(0, 4)) - 1}${p.date.slice(4)}`;
    const pv = map.get(priorKey);
    if (pv && pv !== 0) yoy.push({ date: p.date, pct: (p.value / pv - 1) * 100 });
  }
  const arr = yoy.map((y) => y.pct);
  const mean = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const vol = arr.length > 1 && mean != null
    ? Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / (arr.length - 1))
    : null;
  const best = yoy.length ? yoy.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;
  const worst = yoy.length ? yoy.reduce((a, b) => (b.pct < a.pct ? b : a)) : null;
  const positiveYearsPct = arr.length ? (arr.filter((x) => x > 0).length / arr.length) * 100 : null;

  const r = (x: number | null, p = 1) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(p)));
  return {
    first, latest, spanYears: Number(spanYears.toFixed(1)),
    cagrPct: r(cagrPct), change1yPct: r(changeOver(12)), change3yPct: r(changeOver(36)),
    change5yPct: r(changeOver(60)), changeSince2003Pct: r(changeSince2003Pct),
    avgYoYPct: r(mean), volYoYPct: r(vol),
    bestYoY: best ? { date: best.date, pct: r(best.pct)! } : null,
    worstYoY: worst ? { date: worst.date, pct: r(worst.pct)! } : null,
    positiveYearsPct: r(positiveYearsPct, 0),
  };
}
