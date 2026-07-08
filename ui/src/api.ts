// Data access for the dashboard.
// - Dev: hits the live API (Vite proxies /api → :8787).
// - Prod (GitHub Pages): reads static JSON baked at build time (no server available).
// Relative "data/…" paths resolve under the site's base path, whatever the repo is named.
const STATIC = import.meta.env.PROD;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// Map an API path (with query) to a baked JSON file for the static build.
const staticPath: Record<string, (q: URLSearchParams) => string> = {
  "/api/overview": () => "data/overview.json",
  "/api/stats": () => "data/stats.json",
  "/api/injections": () => "data/injections.json",
  "/api/debt": (q) => `data/debt-${q.get("country")}-${q.get("sector")}.json`,
};

function route<T>(apiPath: string, params: Record<string, string> = {}): Promise<T> {
  const q = new URLSearchParams(params);
  if (STATIC) return get<T>(staticPath[apiPath]!(q));
  const qs = q.toString();
  return get<T>(qs ? `${apiPath}?${qs}` : apiPath);
}

export interface Overview {
  globalLiquidity: { latest: { date: string; total_trillions: number }; changePct: number; banks: { country: string; label: string }[] };
  usDebt: Record<string, number>;
  usMarketCapTrillions: number;
  usM2Trillions: number;
  keyElasticity: { levels: LevelsView; interpretation: string };
}

export interface SeriesPoint { date: string; value: number }
export interface LiquidityResp { data: { date: string; total_trillions: number; total_usd: number; components: Record<string, number> }[]; latest: any; changePct: number; }
export interface AssetResp { asset: string; label: string; metric: string; data: SeriesPoint[]; latest: SeriesPoint | null; }
export interface DebtResp { country: string; countryName: string; sector: string; data: SeriesPoint[]; latestBreakdown: Record<string, number | null>; latest: SeriesPoint | null; }

export interface LevelsView {
  from: string; to: string; driverGrowthPct: number; assetGrowthPct: number;
  arcElasticity: number | null; driverAddedTrillions: number | null;
  assetAddedTrillions: number | null; dollarsPerDollar: number | null;
}
export interface ElasticityResp {
  driver: string; driverLabel: string; asset: string; assetLabel: string;
  levels: LevelsView; lagMonths: number;
  regression: { beta: number; r: number; r2: number; intercept: number };
  interpretation: string;
  whatIf: { driverChangePct: number; expectedAssetChangePct: number; range95Pct: [number, number] }[];
  scatter: { date: string; driverYoYPct: number; assetYoYPct: number }[];
}

export interface SeriesStatsT {
  latest: { date: string; value: number };
  change1yPct: number | null; change3yPct: number | null; change5yPct: number | null;
  changeSince2003Pct: number | null; cagrPct: number | null; avgYoYPct: number | null;
  volYoYPct: number | null; bestYoY: { date: string; pct: number } | null;
  worstYoY: { date: string; pct: number } | null; positiveYearsPct: number | null;
}
export interface StatsSeries {
  key: string; label: string; group: string; unit: string; info: string;
  latestDate: string | null; displayLatest: string; stats: SeriesStatsT | null;
}
export interface Injection {
  label: string; note: string; start: string; end: string; kind: "inject" | "drain";
  liquidityAddedTrillions: number | null; liquidityChangePct: number | null;
  sp500Pct: number | null; marketCapPct: number | null; goldPct: number | null;
}

export const api = {
  overview: () => route<Overview>("/api/overview"),
  stats: () => route<{ series: StatsSeries[] }>("/api/stats"),
  injections: () => route<{ episodes: Injection[] }>("/api/injections"),
  debt: (country: string, sector: string) => route<DebtResp>("/api/debt", { country, sector }),
};
