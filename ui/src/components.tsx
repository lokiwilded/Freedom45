import { useState } from "react";
import type { StatsSeries, Injection } from "./api";

/** Small "i" affordance with a hover/click explanation popover. */
export function InfoDot({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="info-wrap"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="info-dot" aria-label="More info" aria-expanded={open}
        onClick={() => setOpen((o) => !o)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>i</button>
      {open && <span className="info-pop" role="tooltip">{text}</span>}
    </span>
  );
}

const pct = (v: number | null | undefined) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v}%`);
const tone = (v: number | null | undefined) => (v == null ? "" : v >= 0 ? "up" : "down");

export function StatSquare({ label, value, toneClass, info }: { label: string; value: string; toneClass?: string; info?: string }) {
  return (
    <div className="sq">
      <div className={`sq-v ${toneClass ?? ""}`}>{value}</div>
      <div className="sq-l">{label}{info && <InfoDot text={info} />}</div>
    </div>
  );
}

/** A "how much it moves" card: latest value + a grid of movement stats. */
export function SeriesStatCard({ s }: { s: StatsSeries }) {
  const st = s.stats;
  if (!st) return null;
  return (
    <div className="statcard">
      <div className="statcard-head">
        <span className="statcard-title">{s.label}<InfoDot text={s.info} /></span>
        <span className="statcard-latest">{s.displayLatest}<small>{s.latestDate?.slice(0, 7)}</small></span>
      </div>
      <div className="sq-grid">
        <StatSquare label="1-year" value={pct(st.change1yPct)} toneClass={tone(st.change1yPct)} />
        <StatSquare label="5-year" value={pct(st.change5yPct)} toneClass={tone(st.change5yPct)} />
        <StatSquare label="Since '03" value={pct(st.changeSince2003Pct)} toneClass={tone(st.changeSince2003Pct)}
          info="Total change since January 2003 — the start of the global central-bank liquidity data." />
        <StatSquare label="Growth / yr" value={pct(st.cagrPct)} toneClass={tone(st.cagrPct)}
          info="Compound annual growth rate: the smoothed average yearly growth across the whole history." />
        <StatSquare label="Volatility" value={st.volYoYPct == null ? "—" : `${st.volYoYPct}%`}
          info="How much the yearly change bounces around — the standard deviation of year-over-year moves. Higher = wilder." />
        <StatSquare label="Best year" value={pct(st.bestYoY?.pct)} toneClass="up"
          info={`Biggest 12-month gain in the record${st.bestYoY ? ` — ${st.bestYoY.date.slice(0, 7)}` : ""}.`} />
        <StatSquare label="Worst year" value={pct(st.worstYoY?.pct)} toneClass="down"
          info={`Biggest 12-month drop in the record${st.worstYoY ? ` — ${st.worstYoY.date.slice(0, 7)}` : ""}.`} />
        <StatSquare label="Up years" value={st.positiveYearsPct == null ? "—" : `${st.positiveYearsPct}%`}
          info="Share of months whose year-over-year change was positive." />
      </div>
    </div>
  );
}

const mo = (d: string) => new Date(d + "T00:00").toLocaleDateString("en", { month: "short", year: "2-digit" });

/** One liquidity episode: money added/removed, and how assets responded over the window. */
export function InjectionCard({ e }: { e: Injection }) {
  const drain = e.kind === "drain";
  const resp = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v}%`);
  const respTone = (v: number | null) => (v == null ? "" : v >= 0 ? "up" : "down");
  return (
    <div className={`inj${drain ? " inj-drain" : ""}`}>
      <div className="inj-head">
        <span className="inj-label">{e.label}</span>
        <span className="inj-range">{mo(e.start)} – {mo(e.end)}</span>
      </div>
      <div className="inj-liq">
        <span className={`inj-liq-v ${drain ? "down" : "up"}`}>
          {e.liquidityAddedTrillions != null ? `${e.liquidityAddedTrillions >= 0 ? "+" : ""}$${Math.abs(e.liquidityAddedTrillions)}T` : "—"}
        </span>
        <span className="inj-liq-l">{drain ? "liquidity removed" : "liquidity added"} · {resp(e.liquidityChangePct)}</span>
      </div>
      <div className="inj-note">{e.note}</div>
      <div className="inj-resp">
        <div className="rsp"><span className={`rsp-v ${respTone(e.sp500Pct)}`}>{resp(e.sp500Pct)}</span><span className="rsp-l">S&amp;P 500</span></div>
        <div className="rsp"><span className={`rsp-v ${respTone(e.marketCapPct)}`}>{resp(e.marketCapPct)}</span><span className="rsp-l">US cap</span></div>
        <div className="rsp"><span className={`rsp-v ${respTone(e.goldPct)}`}>{resp(e.goldPct)}</span><span className="rsp-l">Gold</span></div>
      </div>
    </div>
  );
}

export function Tile({ label, value, sub, up, accent, info }: {
  label: string; value: string; sub: string; up?: boolean; accent?: boolean; info?: string;
}) {
  return (
    <div className={`tile${accent ? " tile-accent" : ""}`}>
      <div className="tile-label">{label}{info && <InfoDot text={info} />}</div>
      <div className="tile-value">{value}</div>
      <div className={`tile-sub${up ? " up" : ""}`}>{sub}</div>
    </div>
  );
}
