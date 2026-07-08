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

/** Interactive reflexivity explainer: money printed × historical multiplier = market-cap impact. */
export function ReflexivityExplainer({ multiplier }: { multiplier: number }) {
  const [amount, setAmount] = useState(1); // $ trillions
  const impact = amount * multiplier;
  const printedPct = Math.max(6, (1 / multiplier) * 100); // width of "printed" bar vs "reaches market"
  const set = (v: number) => setAmount(Math.min(10, Math.max(0.5, Math.round(v * 2) / 2)));

  return (
    <section className="reflex">
      <div className="section-head">
        <h2>The reflexivity multiplier</h2>
        <p className="note">
          Money isn't poured into a fixed pool — one buyer at a higher price re-rates <em>every</em> share.
          So historically, each $1 the major central banks create has coincided with about
          <strong> ${multiplier}</strong> of market-cap gain. Try an amount:
        </p>
      </div>

      <div className="reflex-calc">
        <div className="reflex-side">
          <span className="reflex-lbl">Money created</span>
          <div className="reflex-amount">$<input type="number" min={0.5} max={10} step={0.5} value={amount}
            onChange={(e) => set(Number(e.target.value))} aria-label="Trillions created" />T</div>
          <input className="reflex-range" type="range" min={0.5} max={10} step={0.5} value={amount}
            onChange={(e) => set(Number(e.target.value))} aria-label="Money created slider" />
          <div className="reflex-presets">
            {[1, 3, 5].map((p) => (
              <button key={p} type="button" className={amount === p ? "on" : ""} onClick={() => setAmount(p)}>${p}T</button>
            ))}
          </div>
        </div>

        <div className="reflex-op">×{multiplier}</div>

        <div className="reflex-side reflex-out">
          <span className="reflex-lbl">Expected to reach the market</span>
          <div className="reflex-result">${impact.toFixed(2)}T</div>
          <span className="reflex-sub">added to market cap</span>
        </div>
      </div>

      <div className="reflex-bars">
        <div className="reflex-bar">
          <span className="reflex-bar-l">Printed</span>
          <div className="reflex-track"><div className="reflex-fill printed" style={{ width: `${printedPct}%` }} /></div>
          <span className="reflex-bar-v">${amount.toFixed(1)}T</span>
        </div>
        <div className="reflex-bar">
          <span className="reflex-bar-l">Reaches market</span>
          <div className="reflex-track"><div className="reflex-fill market" style={{ width: "100%" }} /></div>
          <span className="reflex-bar-v">${impact.toFixed(1)}T</span>
        </div>
      </div>

      <p className="reflex-foot">
        Then it's just a question of <em>where it lands</em> — how much flows to US stocks vs. Europe, Asia,
        gold or debt. The sections below show how each actually moved. <span className="reflex-warn">Descriptive history, trend-dominated — not a guarantee.</span>
      </p>
    </section>
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
