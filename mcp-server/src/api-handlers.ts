/**
 * Route handlers for the macro API — pure functions of query params, no server.
 *
 * Shared by the live HTTP server (http.ts) and the static data dump (scripts/dump-static.ts),
 * so the API served locally and the JSON baked for GitHub Pages come from identical logic.
 */

import { fredProvider } from "./providers/fred.js";
import { yahooProvider } from "./providers/yahoo.js";
import { getMoneySupply } from "./tools/macro/getMoneySupply.js";
import { getGovernmentDebt } from "./tools/macro/getGovernmentDebt.js";
import { getDebt } from "./tools/macro/getDebt.js";
import { getGlobalLiquidity } from "./tools/macro/getGlobalLiquidity.js";
import { getAssetHistory } from "./tools/macro/getAssetHistory.js";
import { getLiquidityElasticity } from "./tools/macro/getLiquidityElasticity.js";
import { seriesStats, type Pt } from "./scoring/series-stats.js";

const fredKey = process.env.FRED_API_KEY;
if (fredKey) fredProvider.init(fredKey);
else console.error("Warning: FRED_API_KEY not set — macro endpoints will fail.");

export type Handler = (q: URLSearchParams) => Promise<unknown>;

const num = (v: string | null): number | undefined => (v === null || v === "" ? undefined : Number(v));

export const routes: Record<string, Handler> = {
  "/api/health": async () => ({ ok: true, service: "freedom45-macro", time: new Date().toISOString() }),

  "/api/money-supply": async (q) => getMoneySupply(q.get("country") ?? "US", q.get("from") ?? undefined, q.get("to") ?? undefined),

  "/api/government-debt": async (q) => getGovernmentDebt(q.get("country") ?? "US", q.get("from") ?? undefined, q.get("to") ?? undefined),

  "/api/debt": async (q) => getDebt(q.get("country") ?? "US", q.get("sector") ?? "total", q.get("from") ?? undefined, q.get("to") ?? undefined),

  "/api/liquidity": async (q) => getGlobalLiquidity(q.get("from") ?? undefined, q.get("to") ?? undefined),

  "/api/assets": async (q) => getAssetHistory(q.get("asset") ?? "SP500", q.get("from") ?? undefined, q.get("to") ?? undefined),

  "/api/stock": async (q) => {
    const ticker = (q.get("ticker") ?? "").toUpperCase();
    if (!ticker) return { error: "Missing 'ticker' parameter." };
    try {
      const points = await yahooProvider.getChart(ticker, "1mo");
      return {
        asset: ticker,
        label: ticker,
        currency: "USD",
        metric: "level",
        count: points.length,
        data: points,
        latest: points[points.length - 1] ?? null,
      };
    } catch (e: any) {
      return { asset: ticker, error: e?.message ?? `Could not fetch ticker '${ticker}'.` };
    }
  },

  "/api/elasticity": async (q) =>
    getLiquidityElasticity(
      q.get("driver") ?? "global_liquidity",
      q.get("asset") ?? "SP500",
      num(q.get("lag")),
      q.get("from") ?? undefined,
      q.get("to") ?? undefined
    ),

  // "How much things move" — descriptive stats per key series, computed from full history.
  "/api/stats": async () => {
    const ASSET_DEFS: { key: string; group: string; info: string; disp: (v: number) => string }[] = [
      { key: "US_MKTCAP", group: "US", info: "Total market value of all US corporate equities (Fed Z.1) — broader than the S&P 500.", disp: (v) => `$${(v / 1e6).toFixed(1)}T` },
      { key: "SP500", group: "US", info: "S&P 500 index level — the 500 largest US companies.", disp: (v) => v.toFixed(0) },
      { key: "NASDAQ", group: "US", info: "Nasdaq Composite — tech-heavy US index.", disp: (v) => v.toFixed(0) },
      { key: "DOW", group: "US", info: "Dow Jones Industrial Average — 30 large US companies.", disp: (v) => v.toFixed(0) },
      { key: "FTSE", group: "Europe", info: "FTSE 100 — 100 largest UK-listed companies.", disp: (v) => v.toFixed(0) },
      { key: "DAX", group: "Europe", info: "DAX 40 — Germany's benchmark index.", disp: (v) => v.toFixed(0) },
      { key: "ESTOXX50", group: "Europe", info: "Euro Stoxx 50 — 50 large eurozone companies.", disp: (v) => v.toFixed(0) },
      { key: "CAC40", group: "Europe", info: "CAC 40 — France's benchmark index.", disp: (v) => v.toFixed(0) },
      { key: "NIKKEI", group: "Asia", info: "Nikkei 225 — Japan's benchmark index.", disp: (v) => v.toFixed(0) },
      { key: "HANGSENG", group: "Asia", info: "Hang Seng — Hong Kong's benchmark index.", disp: (v) => v.toFixed(0) },
      { key: "SHANGHAI", group: "Asia", info: "Shanghai Composite — mainland China.", disp: (v) => v.toFixed(0) },
      { key: "GOLD", group: "Commodity", info: "Gold, US dollars per troy ounce.", disp: (v) => `$${v.toFixed(0)}` },
      { key: "SILVER", group: "Commodity", info: "Silver, US dollars per troy ounce.", disp: (v) => `$${v.toFixed(2)}` },
    ];

    const [liq, m2, ...assets] = await Promise.all([
      getGlobalLiquidity(), getMoneySupply("US"), ...ASSET_DEFS.map((a) => getAssetHistory(a.key)),
    ]);

    const mk = (key: string, label: string, group: string, unit: string, info: string, pts: Pt[], disp: (v: number) => string) => {
      const stats = seriesStats(pts);
      return { key, label, group, unit, info, latestDate: stats?.latest.date ?? null, displayLatest: stats ? disp(stats.latest.value) : "—", stats };
    };
    const assetPts = (r: any): Pt[] => r.data.map((d: any) => ({ date: d.date, value: d.value }));

    return {
      series: [
        mk("liquidity", "Global CB liquidity", "Macro", "$T",
          "CB = central bank. Combined balance sheets of the US Federal Reserve, European Central Bank and Bank of Japan, converted to USD — the money these central banks have created (QE / 'money printing').",
          (liq as any).data.map((d: any) => ({ date: d.date, value: d.total_trillions })), (v) => `$${v.toFixed(1)}T`),
        mk("us_m2", "US M2 money supply", "Macro", "$T",
          "US M2 broad money — physical cash, checking/savings deposits and near-money (FRED M2SL, billions USD).",
          (m2 as any).data.map((d: any) => ({ date: d.date, value: d.value })), (v) => `$${(v / 1000).toFixed(1)}T`),
        ...ASSET_DEFS.map((d, i) => {
          const r: any = assets[i];
          return mk(d.key, r.label, d.group, r.metric === "market_cap" ? "$T" : "index/px", d.info, assetPts(r), d.disp);
        }),
      ],
    };
  },

  // Liquidity injection episodes — "when money was added, what happened to assets".
  "/api/injections": async () => {
    const [liq, sp, mc, gold] = await Promise.all([
      getGlobalLiquidity(), getAssetHistory("SP500"), getAssetHistory("US_MKTCAP"), getAssetHistory("GOLD"),
    ]);
    const liqArr: Pt[] = (liq as any).data.map((d: any) => ({ date: d.date, value: d.total_usd }));
    const spArr: Pt[] = (sp as any).data;
    const mcArr: Pt[] = (mc as any).data;
    const goldArr: Pt[] = (gold as any).data;

    const after = (arr: Pt[], t: string) => arr.find((p) => p.date >= t)?.value;
    const before = (arr: Pt[], t: string) => [...arr].reverse().find((p) => p.date <= t)?.value;
    const r1 = (x: number | null) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(1)));
    const chg = (arr: Pt[], s: string, e: string): number | null => {
      const a = after(arr, s), b = before(arr, e);
      return a && b && a !== 0 ? r1((b / a - 1) * 100) : null;
    };

    const episodes = [
      { label: "GFC — QE1", note: "Fed's first bond-buying after the 2008 crash", start: "2008-09-01", end: "2010-03-01", kind: "inject" },
      { label: "QE2", note: "Second round of Fed easing", start: "2010-11-01", end: "2011-06-01", kind: "inject" },
      { label: "QE3", note: "Open-ended asset purchases", start: "2012-09-01", end: "2014-10-01", kind: "inject" },
      { label: "COVID QE", note: "Emergency global money-printing", start: "2020-02-01", end: "2022-03-01", kind: "inject" },
      { label: "QT tightening", note: "Balance-sheet runoff — money removed", start: "2022-04-01", end: "2023-10-01", kind: "drain" },
    ];

    return {
      episodes: episodes.map((e) => {
        const a = after(liqArr, e.start), b = before(liqArr, e.end);
        const months = Math.round((Date.parse(e.end) - Date.parse(e.start)) / (30.44 * 864e5));
        return {
          ...e,
          months,
          liquidityAddedTrillions: a != null && b != null ? r1((b - a) / 1e12) : null,
          liquidityChangePct: chg(liqArr, e.start, e.end),
          sp500Pct: chg(spArr, e.start, e.end),
          marketCapPct: chg(mcArr, e.start, e.end),
          goldPct: chg(goldArr, e.start, e.end),
        };
      }),
    };
  },

  // The full, auditable derivation of the reflexivity multiplier — every intermediate number.
  "/api/reflexivity": async () => {
    const [liq, mc] = await Promise.all([getGlobalLiquidity(), getAssetHistory("US_MKTCAP")]);
    const liqData = (liq as any).data as { date: string; total_usd: number; components: Record<string, number> }[];
    const mcData = (mc as any).data as { date: string; value: number }[]; // millions USD

    // Common window: months where BOTH the liquidity total and the market-cap figure exist.
    const mcMap = new Map(mcData.map((d) => [d.date, d.value]));
    const common = liqData.filter((d) => mcMap.has(d.date));
    const first = common[0]!, last = common[common.length - 1]!;

    const liqStart = first.total_usd, liqEnd = last.total_usd;
    const capStart = mcMap.get(first.date)! * 1e6, capEnd = mcMap.get(last.date)! * 1e6;
    const addedLiq = liqEnd - liqStart, addedCap = capEnd - capStart;
    const multiplier = addedCap / addedLiq;

    const T = (x: number) => Number((x / 1e12).toFixed(2));
    const pct = (a: number, b: number) => Number(((b / a - 1) * 100).toFixed(1));
    const years = Number(((Date.parse(last.date) - Date.parse(first.date)) / (365.25 * 864e5)).toFixed(1));

    const banks = (liq as any).banks as { country: string; label: string; currency: string; seriesId: string }[];
    const bankRows = banks.map((b) => ({
      label: b.label, currency: b.currency, seriesId: b.seriesId,
      startT: T((first.components[b.country] ?? 0)), endT: T((last.components[b.country] ?? 0)),
    }));

    return {
      multiplier: Number(multiplier.toFixed(2)),
      window: { from: first.date, to: last.date, years },
      liquidity: {
        what: "Combined balance sheets of the Fed, ECB and Bank of Japan, each converted to USD.",
        source: "FRED — WALCL (Fed), ECBASSETSW (ECB), JPNASSETS (BOJ); FX via DEXUSEU, DEXJPUS",
        startDate: first.date, endDate: last.date,
        startTrillions: T(liqStart), endTrillions: T(liqEnd), addedTrillions: T(addedLiq), changePct: pct(liqStart, liqEnd),
        banks: bankRows,
      },
      marketCap: {
        what: "Total market value of all US corporate equities (broader than the S&P 500).",
        source: "FRED Z.1 — NCBEILQ027S (nonfinancial corporate equities, market value)",
        startDate: first.date, endDate: last.date,
        startTrillions: T(capStart), endTrillions: T(capEnd), addedTrillions: T(addedCap), changePct: pct(capStart, capEnd),
      },
      ratio: {
        formula: "market-cap added ÷ liquidity added",
        addedCapTrillions: T(addedCap), addedLiqTrillions: T(addedLiq), value: Number(multiplier.toFixed(2)),
      },
    };
  },

  // Bundled headline numbers for the dashboard hero (one round-trip).
  "/api/overview": async () => {
    const [liquidity, debt, mktcap, m2, elasticity] = await Promise.all([
      getGlobalLiquidity(),
      getDebt("US", "total"),
      getAssetHistory("US_MKTCAP"),
      getMoneySupply("US"),
      getLiquidityElasticity("global_liquidity", "US_MKTCAP"),
    ]);
    const liq = liquidity as any;
    return {
      globalLiquidity: { latest: liq.latest, changePct: liq.changePct, banks: liq.banks },
      usDebt: (debt as any).latestBreakdown,
      usMarketCapTrillions: ((mktcap as any).latest?.value ?? 0) / 1e6,
      usM2Trillions: (m2 as any).latestUsdTrillions,
      keyElasticity: {
        levels: (elasticity as any).levels,
        interpretation: (elasticity as any).interpretation,
      },
    };
  },
};
