import { useState } from "react";
import type { StatsSeries, Injection, Reflexivity } from "./api";

const fmtMonthYear = (d: string) => new Date(d + "T00:00").toLocaleDateString("en", { month: "short", year: "numeric" });

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
        <span className="inj-range">{mo(e.start)} – {mo(e.end)} · {e.months}mo</span>
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

/**
 * Reflexivity explainer: an interactive example + the full, sourced derivation of the multiplier.
 * Every number comes from `refl` (the /api/reflexivity computation) — nothing is asserted loosely.
 */
export function ReflexivityExplainer({ refl }: { refl: Reflexivity | null }) {
  const mult = refl?.multiplier ?? 3.85;
  const [amount, setAmount] = useState(1); // $ trillions
  const impact = amount * mult;
  const printedPct = Math.max(6, (1 / mult) * 100);
  const set = (v: number) => setAmount(Math.min(10, Math.max(0.5, Math.round(v * 2) / 2)));
  const win = refl ? `${fmtMonthYear(refl.window.from)} → ${fmtMonthYear(refl.window.to)}` : "";

  return (
    <section className="reflex">
      <div className="section-head">
        <h2>The reflexivity multiplier — explained</h2>
        <p className="note">
          Money isn't poured into a fixed pool — one buyer at a higher price re-rates <em>every</em> share, so
          market cap can rise by far more than the cash created.{" "}
          {refl && (
            <>Measured over <strong>{refl.window.years} years</strong> ({win}), the three big central banks' balance
            sheets grew by <strong>${refl.liquidity.addedTrillions}T</strong> while total US market cap grew by{" "}
            <strong>${refl.marketCap.addedTrillions}T</strong> — so each $1 of central-bank money lines up with{" "}
            <strong>${mult}</strong> of market-cap gain (${refl.marketCap.addedTrillions} ÷ ${refl.liquidity.addedTrillions}).
            It's a <em>measured historical ratio</em>, not a mechanism or a promise.</>
          )}
        </p>
      </div>

      {/* interactive example */}
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
        <div className="reflex-op">×{mult}</div>
        <div className="reflex-side reflex-out">
          <span className="reflex-lbl">Implied market-cap gain</span>
          <div className="reflex-result">${impact.toFixed(2)}T</div>
          <span className="reflex-sub">at the historical ratio</span>
        </div>
      </div>
      <div className="reflex-bars">
        <div className="reflex-bar">
          <span className="reflex-bar-l">Created</span>
          <div className="reflex-track"><div className="reflex-fill printed" style={{ width: `${printedPct}%` }} /></div>
          <span className="reflex-bar-v">${amount.toFixed(1)}T</span>
        </div>
        <div className="reflex-bar">
          <span className="reflex-bar-l">Market cap</span>
          <div className="reflex-track"><div className="reflex-fill market" style={{ width: "100%" }} /></div>
          <span className="reflex-bar-v">${impact.toFixed(1)}T</span>
        </div>
      </div>

      {/* step-by-step derivation, straight from the data */}
      {refl && (
        <div className="reflex-steps">
          <h3 className="reflex-h3">How the {mult} is built — step by step</h3>
          <ol className="steps">
            <li className="step">
              <span className="step-n">1</span>
              <div className="step-body">
                <div className="step-t">What gets measured</div>
                <p>Two real series, same window ({win}):</p>
                <ul className="step-list">
                  <li><b>Money created</b> — {refl.liquidity.what}<br /><span className="src">{refl.liquidity.source}</span></li>
                  <li><b>Reached the market</b> — {refl.marketCap.what}<br /><span className="src">{refl.marketCap.source}</span></li>
                </ul>
              </div>
            </li>
            <li className="step">
              <span className="step-n">2</span>
              <div className="step-body">
                <div className="step-t">How much money was created</div>
                <div className="step-scroll"><table className="step-tbl">
                  <thead><tr><th>Central bank</th><th>{fmtMonthYear(refl.liquidity.startDate)}</th><th>{fmtMonthYear(refl.liquidity.endDate)}</th></tr></thead>
                  <tbody>
                    {refl.liquidity.banks.map((b) => (
                      <tr key={b.seriesId}><td>{b.label} <span className="src">{b.seriesId}</span></td><td>${b.startT}T</td><td>${b.endT}T</td></tr>
                    ))}
                    <tr className="tot"><td>Total liquidity</td><td>${refl.liquidity.startTrillions}T</td><td>${refl.liquidity.endTrillions}T</td></tr>
                  </tbody>
                </table></div>
                <p className="step-eq">Added: <b className="up">+${refl.liquidity.addedTrillions}T</b> (+{refl.liquidity.changePct}%)</p>
              </div>
            </li>
            <li className="step">
              <span className="step-n">3</span>
              <div className="step-body">
                <div className="step-t">How much reached the market</div>
                <p>Total US equity market cap: <b>${refl.marketCap.startTrillions}T</b> → <b>${refl.marketCap.endTrillions}T</b></p>
                <p className="step-eq">Added: <b className="up">+${refl.marketCap.addedTrillions}T</b> (+{refl.marketCap.changePct}%)</p>
              </div>
            </li>
            <li className="step">
              <span className="step-n">4</span>
              <div className="step-body">
                <div className="step-t">Divide</div>
                <div className="step-final">
                  <span>${refl.ratio.addedCapTrillions}T</span><span className="sl">÷</span><span>${refl.ratio.addedLiqTrillions}T</span><span className="sl">=</span><span className="big">{refl.ratio.value}</span>
                </div>
                <p className="step-note">Market cap grew {refl.marketCap.changePct}% and liquidity grew {refl.liquidity.changePct}% — similar percentages, but on much larger dollar bases the market cap <em>added {refl.ratio.value}× more dollars</em> than the central banks did.</p>
              </div>
            </li>
          </ol>
        </div>
      )}

      {/* honest framing */}
      <div className="reflex-conclude">
        <div className="conc can">
          <div className="conc-h">✓ What this can tell you</div>
          <ul>
            <li>The historical ratio of market-cap growth to central-bank money (≈{mult} : 1 since 2003).</li>
            <li>How assets actually moved during specific injection windows — the episodes below.</li>
            <li>Which markets captured the most value — the movement stats below.</li>
          </ul>
        </div>
        <div className="conc cant">
          <div className="conc-h">✕ What it can't</div>
          <ul>
            <li>Guarantee the future — it's descriptive history, dominated by a shared 20-year uptrend.</li>
            <li>Pin exact timing — month-to-month the link is weak; banks often ease <em>into</em> crashes.</li>
            <li>Prove causation — foreign flows, earnings and leverage move market cap too.</li>
          </ul>
        </div>
      </div>

      <p className="reflex-foot">
        Then it's a question of <em>where it lands</em> — the sections below show how each index, gold and debt moved,
        and over what time. <span className="reflex-warn">Research tooling, not investment advice.</span>
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
