import { useState } from "react";
import { api } from "./api";
import { TimeSeriesChart } from "./charts";
import type { SeriesConfig, TimeSeriesRow } from "./charts";
import { useTheme } from "./theme";

interface ToolDef {
  key: string;
  name: string;
  description: string;
  params: { key: string; label: string; type: "text" | "number"; default: string; placeholder?: string; optional?: boolean }[];
  run: (params: Record<string, string>) => Promise<any>;
}

const TOOLS: ToolDef[] = [
  {
    key: "insider-sentiment",
    name: "Insider Sentiment",
    description: "Insider buying/selling pressure with a descriptive verdict and 0-100 score.",
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
      { key: "lookbackDays", label: "Lookback (days)", type: "number", default: "90" },
    ],
    run: (p) => api.comboInsiderSentiment(p.ticker, Number(p.lookbackDays) || 90),
  },
  {
    key: "earnings-momentum",
    name: "Earnings Momentum",
    description: "Earnings surprises + analyst recommendations + price targets + upgrades/downgrades.",
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
    ],
    run: (p) => api.comboEarningsMomentum(p.ticker),
  },
  {
    key: "smart-money-convergence",
    name: "Smart Money Convergence",
    description: "Insiders + institutions + funds + Congress alignment on a ticker.",
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
      { key: "lookbackDays", label: "Lookback (days)", type: "number", default: "90" },
    ],
    run: (p) => api.comboSmartMoneyConvergence(p.ticker, Number(p.lookbackDays) || 90),
  },
  {
    key: "shareholder-yield",
    name: "Shareholder Yield",
    description: "Dividend yield + implied buyback proxy yield with sustainability flag.",
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
      { key: "years", label: "Years", type: "number", default: "5" },
    ],
    run: (p) => api.comboShareholderYield(p.ticker, Number(p.years) || 5),
  },
  {
    key: "liquidity-regime",
    name: "Liquidity Regime Scanner",
    description: "Global liquidity regime + M2 + asset impact with risk-on score.",
    params: [
      { key: "asset", label: "Asset key", type: "text", default: "SP500", placeholder: "SP500, GOLD, NASDAQ…" },
      { key: "from", label: "From (optional)", type: "text", default: "", placeholder: "2003-01-01", optional: true },
      { key: "to", label: "To (optional)", type: "text", default: "", placeholder: "2025-01-01", optional: true },
    ],
    run: (p) => api.comboLiquidityRegime(p.asset, p.from || undefined, p.to || undefined),
  },
  {
    key: "congress-news-catalyst",
    name: "Congress News Catalyst",
    description: "Congressional trades matched to nearby news events with catalyst scores.",
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
      { key: "lookbackDays", label: "Lookback (days)", type: "number", default: "90" },
    ],
    run: (p) => api.comboCongressNewsCatalyst(p.ticker, Number(p.lookbackDays) || 90),
  },
  {
    key: "sector-valuation",
    name: "Sector Valuation Comparison",
    description: "Ticker valuation vs sector peers — percentile ranks, PEG, value-trap flags.",
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
    ],
    run: (p) => api.comboSectorValuation(p.ticker),
  },
  {
    key: "sector-relative-strength",
    name: "Sector Relative Strength",
    description: "Sector proxy relative strength vs benchmark + liquidity sensitivity.",
    params: [
      { key: "ticker", label: "Ticker / asset", type: "text", default: "XLK", placeholder: "e.g. XLK, AAPL" },
      { key: "benchmark", label: "Benchmark", type: "text", default: "SP500" },
      { key: "years", label: "Years", type: "number", default: "3" },
    ],
    run: (p) => api.comboSectorRelativeStrength(p.ticker, p.benchmark, Number(p.years) || 3),
  },
];

function fmtVal(v: any): string {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—";
  return String(v);
}

function renderTable(obj: Record<string, any>): { key: string; value: string }[] {
  return Object.entries(obj)
    .filter(([k]) => !["series", "metadata", "tradesWithNews", "table", "highlights", "details", "signals", "percentiles", "peg", "valueTrapFlags"].includes(k))
    .map(([k, v]) => {
      const labels: Record<string, string> = {
        ticker: "Ticker",
        summary: "Summary",
        verdict: "Verdict",
        score: "Score",
        lookbackDays: "Lookback (days)",
        windowStart: "Window start",
        windowEnd: "Window end",
        buyCount: "Buy count",
        sellCount: "Sell count",
        buySellRatio: "Buy/sell ratio",
        totalBuyValue: "Total buy value ($M)",
        totalSellValue: "Total sell value ($M)",
        netBuyValue: "Net buy value ($M)",
        officerBuyValue: "Officer buy ($M)",
        officerSellValue: "Officer sell ($M)",
        directorBuyValue: "Director buy ($M)",
        directorSellValue: "Director sell ($M)",
        latestPrice: "Latest price",
        marketCap: "Market cap ($T)",
        beatStreak: "Beat streak",
        missStreak: "Miss streak",
        surpriseAvgPct: "Avg surprise %",
        surpriseCount: "Surprise count",
        buyPct: "Buy ratings %",
        buyPctPrior: "Prior buy %",
        recommendationTrend: "Recommendation trend",
        priceTargetMean: "Price target mean",
        priceTargetChangePct: "Price target Δ%",
        upgrades90d: "Upgrades (90d)",
        downgrades90d: "Downgrades (90d)",
        upgradeDowngradeFlow: "Upgrade flow",
        overlapCount: "Overlap count",
        dividendYield: "Dividend yield %",
        impliedBuybackYield: "Implied buyback yield %",
        totalShareholderYield: "Total shareholder yield %",
        sustainability: "Sustainability",
        payoutRatioEstimate: "Payout ratio",
        annualDividend: "Annual dividend ($)",
        yearsAnalyzed: "Years analyzed",
        liquidityYoY: "Liquidity YoY %",
        m2YoY: "M2 YoY %",
        assetYoY: "Asset YoY %",
        liquidityBeta: "Liquidity beta",
        liquidityR2: "Liquidity R²",
        lagMonths: "Lag (months)",
        regimeStart: "Regime start",
        regimeEnd: "Regime end",
        riskOnScore: "Risk-on score",
        tradeCount: "Trade count",
        leadDaysAvg: "Avg lead days",
        leadDaysMedian: "Median lead days",
        newsBeforeTrade: "News before trade",
        newsAfterTrade: "News after trade",
        peerCount: "Peer count",
        rankInSector: "Rank in sector",
        alpha: "Alpha",
        beta: "Beta",
        sharpe: "Sharpe",
        tickerReturn: "Ticker return %",
        benchmarkReturn: "Benchmark return %",
        monthsOutperforming: "Months outperforming",
        totalMonths: "Total months",
        asset: "Asset",
        benchmark: "Benchmark",
      };
      return { key: labels[k] ?? k, value: fmtVal(v) };
    });
}

function ChartFromSeries({ data, pal }: { data: any; pal: any }) {
  if (!data?.series || !Array.isArray(data.series) || data.series.length === 0) return null;

  const series: any[] = data.series;
  const keys = Object.keys(series[0]!);

  const dateKey = keys.find((k) => k.toLowerCase().includes("date")) || keys.find((k) => k === "period") || "date";
  const valueKeys = keys.filter((k) => k !== dateKey && typeof series[0]![k] === "number");

  if (valueKeys.length === 0) return null;

  const rows: TimeSeriesRow[] = series.map((s) => ({ date: s[dateKey], ...Object.fromEntries(valueKeys.map((k) => [k, s[k]])) }));
  const chartSeries: SeriesConfig[] = valueKeys.map((k, i) => ({
    key: k,
    name: k,
    color: pal.cat[i % pal.cat.length],
    type: "line",
    yAxisId: i === 0 ? "left" : "right",
    formatter: (v: number | null) => v == null ? "—" : Number(v).toFixed(2),
  }));

  return (
    <div style={{ marginTop: 16 }}>
      <TimeSeriesChart rows={rows} series={chartSeries} pal={pal} height={280} />
    </div>
  );
}

function SubTable({ data, pal }: { data: any; pal: any }) {
  if (!data) return null;

  const blocks: { title: string; rows: { label: string; value: string }[] }[] = [];

  if (data.signals && data.details) {
    blocks.push({
      title: "Signals",
      rows: Object.entries(data.signals).map(([k, v]) => ({
        label: k.charAt(0).toUpperCase() + k.slice(1),
        value: String(v),
      })),
    });
    blocks.push({
      title: "Details",
      rows: Object.entries(data.details).flatMap(([group, d]: [string, any]) =>
        Object.entries(d as Record<string, any>).map(([k, v]) => ({
          label: `${group}.${k}`,
          value: fmtVal(v),
        }))
      ),
    });
  }

  if (data.percentiles) {
    blocks.push({
      title: "Percentiles",
      rows: Object.entries(data.percentiles).map(([k, v]) => ({ label: k.toUpperCase(), value: fmtVal(v) })),
    });
  }

  if (data.peg) {
    blocks.push({
      title: "PEG",
      rows: Object.entries(data.peg).map(([k, v]) => ({ label: k, value: fmtVal(v) })),
    });
  }

  if (data.valueTrapFlags && data.valueTrapFlags.length) {
    blocks.push({
      title: "Value-Trap Flags",
      rows: data.valueTrapFlags.map((f: string, i: number) => ({ label: `Flag ${i + 1}`, value: f })),
    });
  }

  if (data.highlights && data.highlights.length) {
    blocks.push({
      title: "Highlights",
      rows: data.highlights.map((h: string, i: number) => ({ label: `#${i + 1}`, value: h })),
    });
  }

  if (data.table && Array.isArray(data.table)) {
    const cols = Object.keys(data.table[0]!);
    blocks.push({
      title: "Peer Table",
      rows: data.table.map((row: any) => ({
        label: row.ticker,
        value: cols.filter((c) => c !== "ticker").map((c) => `${c}: ${fmtVal(row[c])}`).join("  ·  "),
      })),
    });
  }

  if (data.tradesWithNews && Array.isArray(data.tradesWithNews)) {
    blocks.push({
      title: "Trades + News Matches",
      rows: data.tradesWithNews.map((t: any) => ({
        label: `${t.politician} — ${t.date}`,
        value: `${t.type} ${t.amount}${t.headline ? `  →  ${t.headline} (${t.daysOffset}d)` : "  →  no match"}`,
      })),
    });
  }

  if (blocks.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
      {blocks.map((b) => (
        <div key={b.title} className="panel" style={{ marginBottom: 0 }}>
          <h2 style={{ fontSize: 14, marginBottom: 8 }}>{b.title}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
            {b.rows.map((r, i) => (
              <div key={i} className="mini">
                <span className="mini-l">{r.label}</span>
                <span className="mini-v" style={{ fontSize: 13 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ComboPage() {
  const pal = useTheme();
  const [toolKey, setToolKey] = useState(TOOLS[0]!.key);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tool = TOOLS.find((t) => t.key === toolKey)!;

  async function run() {
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const p: Record<string, string> = {};
      for (const param of tool.params) p[param.key] = params[param.key] ?? param.default;
      const r = await tool.run(p);
      if (r.error) throw new Error(r.error);
      setResult(r);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const topRows = result ? renderTable(result) : [];

  return (
    <div>
      <section className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <div>
            <h2>Combo Analysis Tools</h2>
            <p className="note">{tool.description}</p>
          </div>
        </div>

        {/* Tool selector */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`toggle ${t.key === toolKey ? "on" : ""}`}
              onClick={() => { setToolKey(t.key); setResult(null); setErr(null); }}
              style={t.key === toolKey ? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 600 } : {}}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Params */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
          {tool.params.map((p) => (
            <label key={p.key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--muted)" }}>
              {p.label}
              <input
                type={p.type}
                placeholder={p.placeholder ?? p.default}
                value={params[p.key] ?? p.default}
                onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: e.target.value }))}
                style={{ background: "var(--page)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "var(--ink)", fontFamily: "var(--font)", width: p.type === "number" ? 90 : 140 }}
              />
            </label>
          ))}
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="agent-send"
            style={{ padding: "7px 18px", fontSize: 13 }}
          >
            {loading ? "Running…" : "Run"}
          </button>
        </div>
      </section>

      {err && <div className="err">Error: {err}</div>}

      {result && (
        <div>
          {/* Top-level metrics */}
          {topRows.length > 0 && (
            <div className="panel" style={{ marginBottom: 14 }}>
              {result.summary && (
                <p style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600, marginBottom: 12, lineHeight: 1.45 }}>{result.summary}</p>
              )}
              <div className="sq-grid">
                {topRows
                  .filter((r) => r.key !== "Summary")
                  .map((r) => (
                    <div key={r.key} className="sq">
                      <span className="sq-v" style={{ fontSize: 14 }}>{r.value}</span>
                      <span className="sq-l">{r.key}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Chart */}
          <ChartFromSeries data={result} pal={pal} />

          {/* Sub-tables */}
          <SubTable data={result} pal={pal} />

          {/* Raw JSON */}
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)" }}>Raw JSON</summary>
            <pre style={{ fontSize: 11, overflowX: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {!result && !err && !loading && (
        <div className="loading">Pick a tool, enter parameters, and hit Run.</div>
      )}
    </div>
  );
}