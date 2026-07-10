import { useEffect, useState } from "react";
import { api } from "./api";
import type { Overview, StatsSeries, SeriesPoint, Injection, Reflexivity, LiquidityResp, AssetResp } from "./api";
import { useTheme } from "./theme";
import { DebtStack, TimeSeriesChart } from "./charts";
import type { SeriesConfig, TimeSeriesRow } from "./charts";
import { Tile, SeriesStatCard, InjectionCard, ReflexivityExplainer, InfoDot } from "./components";

const GROUP_ORDER = ["Macro", "US", "Europe", "Asia", "Commodity"];

function mergeByDate(maps: Record<string, Map<string, number>>) {
  const dates = new Set<string>();
  Object.values(maps).forEach((m) => m.forEach((_, d) => dates.add(d)));
  return [...dates].sort().map((date) => {
    const row: any = { date };
    for (const [k, m] of Object.entries(maps)) row[k] = m.get(date) ?? null;
    return row;
  });
}

const fmtT = (n: number | null | undefined) => (n == null ? "—" : `$${n.toFixed(1)}T`);
const fmtPct = (n: number | null | undefined) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`);

const DEBT_COUNTRIES = ["US", "JP", "GB", "DE", "FR", "IT", "CA", "AU", "CN", "KR"];

const INFO = {
  liquidity: "CB = central bank. The combined balance sheets of the US Federal Reserve, European Central Bank and Bank of Japan, converted to USD — i.e. the money these central banks have created (QE / 'money printing').",
  mktcap: "Total market value of all US corporate equities (Federal Reserve Z.1 flow-of-funds) — broader than the S&P 500.",
  debt: "Combined debt of government + households + companies, as a share of GDP (BIS). 100% means total debt equals one year of the whole economy's output.",
  m2: "US M2 broad money — physical cash, checking/savings deposits and other near-money.",
  reflexivity: "For every $1 the big three central banks added to their balance sheets since 2003, US stock market cap rose about this much. A single buyer at a higher price re-rates every share, so market cap climbs far more than the money 'printed'.",
  liquidityChart: "A live, reusable time-series renderer. The API and static-bake layer now expose any series, so this component can graph liquidity, assets, money supply or any future computed metric.",
};

// Asset keys we can render on the generic time-series chart.
const CHART_ASSETS = [
  { key: "SP500", label: "S&P 500" },
  { key: "US_MKTCAP", label: "US market cap" },
  { key: "NASDAQ", label: "Nasdaq" },
  { key: "GOLD", label: "Gold" },
  { key: "FTSE", label: "FTSE 100" },
  { key: "DAX", label: "DAX 40" },
  { key: "NIKKEI", label: "Nikkei 225" },
  { key: "SILVER", label: "Silver" },
];

export default function App() {
  const pal = useTheme();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [stats, setStats] = useState<StatsSeries[]>([]);
  const [injections, setInjections] = useState<Injection[]>([]);
  const [refl, setRefl] = useState<Reflexivity | null>(null);
  const [country, setCountry] = useState("US");
  const [debtRows, setDebtRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Generic time-series chart state.
  const [liquidity, setLiquidity] = useState<LiquidityResp | null>(null);
  const [assetSeries, setAssetSeries] = useState<Record<string, AssetResp>>({});
  const [selectedAssetKey, setSelectedAssetKey] = useState("SP500");

  useEffect(() => {
    (async () => {
      try {
        const [ov, st, inj, rf, liq] = await Promise.all([
          api.overview(), api.stats(), api.injections(), api.reflexivity(), api.liquidity(),
        ]);
        setOverview(ov);
        setStats(st.series);
        setInjections(inj.episodes);
        setRefl(rf);
        setLiquidity(liq);
      } catch (e: any) { setErr(e.message); }
    })();
  }, []);

  // Load the selected asset time-series when it changes.
  useEffect(() => {
    if (assetSeries[selectedAssetKey]) return;
    (async () => {
      try {
        const a = await api.asset(selectedAssetKey);
        setAssetSeries((prev) => ({ ...prev, [selectedAssetKey]: a }));
      } catch (e: any) { setErr(e.message); }
    })();
  }, [selectedAssetKey, assetSeries]);

  useEffect(() => {
    (async () => {
      try {
        const [g, h, c] = await Promise.all([
          api.debt(country, "government"), api.debt(country, "households"), api.debt(country, "corporate"),
        ]);
        const toMap = (d: SeriesPoint[]) => new Map(d.filter((x) => x.value != null).map((x) => [x.date, x.value]));
        setDebtRows(mergeByDate({ government: toMap(g.data), households: toMap(h.data), corporate: toMap(c.data) }));
      } catch (e: any) { setErr(e.message); }
    })();
  }, [country]);

  const debtSectors = [
    { key: "government", name: "Government", color: pal.cat[0] },
    { key: "households", name: "Households", color: pal.cat[1] },
    { key: "corporate", name: "Corporate", color: pal.cat[2] },
  ];
  const lv = overview?.keyElasticity.levels;

  // Build merged time-series rows for the generic chart.
  const chartRows: TimeSeriesRow[] = (() => {
    if (!liquidity) return [];
    const toMap = (d: SeriesPoint[]) => new Map(d.filter((x) => x.value != null).map((x) => [x.date, x.value]));
    const liqMap = toMap(liquidity.data.map((d) => ({ date: d.date, value: d.total_trillions })));
    const asset = assetSeries[selectedAssetKey];
    const assetMap = asset ? toMap(asset.data) : new Map();
    const dates = new Set([...liqMap.keys(), ...assetMap.keys()]);
    return [...dates].sort().map((date) => ({
      date,
      liquidity: liqMap.get(date) ?? null,
      asset: assetMap.get(date) ?? null,
    }));
  })();

  const chartSeries: SeriesConfig[] = [
    { key: "liquidity", name: "Global CB liquidity", color: pal.cat[0], type: "area", yAxisId: "left", formatter: (v) => `$${Number(v).toFixed(1)}T` },
    { key: "asset", name: CHART_ASSETS.find((a) => a.key === selectedAssetKey)?.label ?? selectedAssetKey, color: pal.cat[1], type: "line", yAxisId: "right", formatter: (v) => `${Number(v).toFixed(0)}` },
  ];

  return (
    <div className="app">
      <header className="masthead">
        <p className="eyebrow">Freedom45 · Liquidity vs Assets</p>
        <h1>Where the money goes</h1>
        <p className="sub">How much global money and debt have grown — and how much the assets moved with them. Every number is computed from the full history and updates as new data lands. Sources: FRED · BIS · Yahoo · DBnomics.</p>
      </header>

      {err && <div className="err">Couldn't reach the API ({err}). Is it running on :8787? Run <code>npm run serve</code> in mcp-server.</div>}

      {/* REFLEXIVITY EXPLAINER */}
      <ReflexivityExplainer refl={refl} />

      {/* HERO SNAPSHOT */}
      <section className="tiles">
        <Tile label="Global CB liquidity" value={fmtT(overview?.globalLiquidity.latest.total_trillions)} sub={`${fmtPct(overview?.globalLiquidity.changePct)} since 2003`} up info={INFO.liquidity} />
        <Tile label="US equity market cap" value={fmtT(overview?.usMarketCapTrillions)} sub="whole US market" info={INFO.mktcap} />
        <Tile label="US total debt" value={overview ? `${overview.usDebt.total}%` : "—"} sub="of GDP · gov + private" info={INFO.debt} />
        <Tile label="US M2 money supply" value={fmtT(overview?.usM2Trillions)} sub="broad money" info={INFO.m2} />
        <Tile label="Reflexivity" value={lv?.dollarsPerDollar ? `$${lv.dollarsPerDollar}` : "—"} sub="mkt-cap per $1 liquidity" accent info={INFO.reflexivity} />
      </section>

      {/* GENERIC TIME-SERIES EXPLORER — proves graphing plumbing */}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Explore the data</h2>
            <p className="note">A generic time-series renderer. Liquidity is on the left axis; pick any asset for the right axis. This is a capability demo — more charts can reuse the same plumbing. <InfoDot text={INFO.liquidityChart} /></p>
          </div>
          <select value={selectedAssetKey} onChange={(e) => setSelectedAssetKey(e.target.value)} aria-label="Asset">
            {CHART_ASSETS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>
        {chartRows.length ? (
          <TimeSeriesChart rows={chartRows} series={chartSeries} pal={pal} height={380} />
        ) : (
          <div className="loading">Loading series…</div>
        )}
      </section>

      {/* LIQUIDITY INJECTIONS — when money was added, what happened */}
      <section>
        <div className="section-head">
          <h2>When money was added, what happened</h2>
          <p className="note">Major central-bank easing (and one tightening) episodes — how much liquidity went in over each window, and how much the S&amp;P 500, total US market cap and gold moved during it.</p>
        </div>
        <div className="injgrid">
          {injections.length
            ? injections.map((e) => <InjectionCard key={e.label} e={e} />)
            : <div className="loading">Loading episodes…</div>}
        </div>
      </section>

      {/* MOVEMENT STATS — the "how much things move" backtest */}
      <section>
        <div className="section-head">
          <h2>How much things move</h2>
          <p className="note">Historical movement per series — cumulative change over each horizon, annualized growth, volatility and the best/worst 12 months on record. Hover an <span className="i-inline">i</span> for what a term means.</p>
        </div>
        {stats.length ? (
          GROUP_ORDER.map((g) => {
            const items = stats.filter((s) => s.group === g);
            if (!items.length) return null;
            return (
              <div key={g} className="statgroup">
                <h3 className="statgroup-h">{g === "Macro" ? "Money & liquidity" : g === "Commodity" ? "Commodities" : `${g} indexes`}</h3>
                <div className="statgrid">
                  {items.map((s) => <SeriesStatCard key={s.key} s={s} />)}
                </div>
              </div>
            );
          })
        ) : <div className="loading">Loading statistics…</div>}
      </section>

      {/* DEBT BY SECTOR */}
      <section className="panel">
        <div className="panel-head">
          <div><h2>Debt by sector</h2><p className="note">Credit to the non-financial sector, % of GDP — government + households + companies (BIS).</p></div>
          <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country">
            {DEBT_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <DebtStack rows={debtRows} sectors={debtSectors} pal={pal} />
      </section>

      <footer className="foot">
        Movement stats are descriptive history, not predictions. Growth over long spans is dominated by the trend; a big "best year" (e.g. central-bank liquidity in 2008) usually coincides with a crisis response, not a boom.
      </footer>
    </div>
  );
}
