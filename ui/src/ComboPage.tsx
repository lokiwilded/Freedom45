import { useState } from "react";
import { api } from "./api";
import { TimeSeriesChart } from "./charts";
import type { SeriesConfig, TimeSeriesRow } from "./charts";
import { useTheme } from "./theme";

interface ToolDef {
  key: string;
  name: string;
  group: "combo" | "long-term";
  description: string;
  explanation: string;
  params: { key: string; label: string; type: "text" | "number"; default: string; placeholder?: string; optional?: boolean }[];
  run: (params: Record<string, string>) => Promise<any>;
}

const TOOLS: ToolDef[] = [
  {
    key: "insider-sentiment",
    name: "Insider Sentiment",
    group: "combo",
    description: "Insider buying/selling pressure with a descriptive verdict and 0-100 score.",
    explanation: `WHAT IT DOES: Scores whether company insiders (CEO, CFO, directors, officers) are buying or selling their own stock over a lookback window.

DATA SOURCES: Finnhub insider transactions + company profile (market cap) + stock quote (for dollar value estimation).

WHAT IT SHOWS: A verdict (Heavy Accumulation → Heavy Distribution), a 0-100 score, buy/sell counts, officer vs director splits, largest buy, and a daily net-buy time series chart.

USE CASES:
• "Are AAPL insiders buying or selling?" — check if leadership has conviction
• Spot insider selling before earnings or bad news
• Confirm insider buying as a bullish signal during dips
• Compare insider activity across multiple tickers`,
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
      { key: "lookbackDays", label: "Lookback (days)", type: "number", default: "90" },
    ],
    run: (p) => api.comboInsiderSentiment(p.ticker, Number(p.lookbackDays) || 90),
  },
  {
    key: "earnings-momentum",
    name: "Earnings Momentum",
    group: "combo",
    description: "Earnings surprises + analyst recommendations + price targets + upgrades/downgrades.",
    explanation: `WHAT IT DOES: Combines earnings beats/misses, analyst recommendation trends, price targets, and upgrade/downgrade activity into a single momentum score.

DATA SOURCES: Finnhub earnings surprise + recommendation trends + price target + upgrade/downgrade.

WHAT IT SHOWS: A verdict (Weak → Strong), 0-100 score, beat/miss streaks, avg surprise %, buy rating % trend, price target mean + change, upgrade/downgrade counts, and a period-by-period series.

USE CASES:
• "Is NVDA's earnings momentum improving?" — see if analysts are getting more bullish
• Spot companies with consistent earnings beats (beat streak)
• Track analyst upgrades vs downgrades over time
• See if price targets are rising or falling`,
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
    ],
    run: (p) => api.comboEarningsMomentum(p.ticker),
  },
  {
    key: "smart-money-convergence",
    name: "Smart Money Convergence",
    group: "combo",
    description: "Insiders + institutions + funds + Congress alignment on a ticker.",
    explanation: `WHAT IT DOES: Detects when multiple "smart money" groups — insiders, institutions, funds, and Congress — are all buying or selling the same stock.

DATA SOURCES: Finnhub insider transactions + institutional ownership + fund ownership + congressional trading.

WHAT IT SHOWS: A convergence verdict (No Convergence → Very High Convergence), 0-100 score, per-group signals (buying/selling/neutral/no_data), and a summary table.

LIMITATION: Institutional, fund, and Congress data require Finnhub premium (403 on free tier). Only the insider signal works on the free tier.

USE CASES:
• "Are insiders, institutions, and Congress all buying NVDA?" — find consensus
• Spot when smart money is aligned (high convergence = strong signal)
• Detect divergence (insiders selling while institutions buying = mixed signal)`,
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
      { key: "lookbackDays", label: "Lookback (days)", type: "number", default: "90" },
    ],
    run: (p) => api.comboSmartMoneyConvergence(p.ticker, Number(p.lookbackDays) || 90),
  },
  {
    key: "shareholder-yield",
    name: "Shareholder Yield",
    group: "combo",
    description: "Dividend yield + implied buyback proxy yield with sustainability flag.",
    explanation: `WHAT IT DOES: Computes total shareholder yield = dividend yield + implied buyback yield, with a sustainability assessment.

DATA SOURCES: Finnhub dividends (or Yahoo Finance fallback) + stock splits + fundamental metrics + stock quote.

WHAT IT SHOWS: A yield verdict (No Yield → Very High Yield), 0-100 score, dividend yield %, implied buyback yield %, total yield %, payout ratio, sustainability flag, and an annual yield series.

USE CASES:
• "What's the total shareholder yield for KO?" — see dividends + buybacks combined
• Check if a company's dividend is sustainable (payout ratio analysis)
• Compare shareholder returns across income stocks
• Spot companies returning capital via buybacks vs dividends`,
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
      { key: "years", label: "Years", type: "number", default: "5" },
    ],
    run: (p) => api.comboShareholderYield(p.ticker, Number(p.years) || 5),
  },
  {
    key: "liquidity-regime",
    name: "Liquidity Regime Scanner",
    group: "combo",
    description: "Global liquidity regime + M2 + asset impact with risk-on score.",
    explanation: `WHAT IT DOES: Scans the current global liquidity environment (central bank balance sheets + M2) and its impact on a specific asset class.

DATA SOURCES: FRED global liquidity (Fed + ECB + BOJ) + US M2 + Yahoo asset history + liquidity elasticity regression.

WHAT IT SHOWS: A regime verdict (Expansion Risk-On → Contraction Risk-Off), 0-100 risk-on score, liquidity YoY %, M2 YoY %, asset YoY %, liquidity beta + R², and a merged YoY time series chart.

USE CASES:
• "Is global liquidity expanding or contracting?" — the macro backdrop
• "How does SP500 respond to liquidity changes?" — sensitivity analysis
• Spot regime shifts (expansion → contraction) before they're obvious
• Compare how different assets (GOLD, NASDAQ, SP500) react to liquidity`,
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
    group: "combo",
    description: "Congressional trades matched to nearby news events with catalyst scores.",
    explanation: `WHAT IT DOES: Matches congressional trades to nearby company news events to detect whether politicians may be trading on catalyst information.

DATA SOURCES: Finnhub congressional trading + company news + market news.

WHAT IT SHOWS: A catalyst verdict (High Catalyst Signal → No Clear Catalyst), 0-100 score, trade count, per-trade matches (politician, date, type, amount, matched headline, days offset), and lead/lag statistics.

LIMITATION: Congressional trading data requires Finnhub premium (403 on free tier). Returns "No Data" without it.

USE CASES:
• "Did Congress members trade NVDA before major news?" — detect timing
• See if politicians are trading ahead of catalysts (lead days analysis)
• Match specific trades to specific news headlines
• Quantify how often Congress trades align with news events`,
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
      { key: "lookbackDays", label: "Lookback (days)", type: "number", default: "90" },
    ],
    run: (p) => api.comboCongressNewsCatalyst(p.ticker, Number(p.lookbackDays) || 90),
  },
  {
    key: "sector-valuation",
    name: "Sector Valuation Comparison",
    group: "combo",
    description: "Ticker valuation vs sector peers — percentile ranks, PEG, value-trap flags.",
    explanation: `WHAT IT DOES: Compares a ticker's valuation (P/E, P/B, P/S, EV/EBITDA, PEG) against its sector peers using percentile ranks.

DATA SOURCES: Finnhub peers + fundamental metrics for ticker and up to 5 peers.

WHAT IT SHOWS: A valuation verdict (Deeply Undervalued → Expensive), 0-100 score, percentile ranks for each metric, PEG ratio, value-trap flags, rank-in-sector, and a peer comparison table.

USE CASES:
• "Is AAPL overvalued vs its sector?" — see percentile ranking
• Find undervalued stocks within a sector (low percentile = cheap)
• Spot value traps (cheap but weak growth, thin margins, high debt)
• Compare a ticker's P/E, P/B, P/S, EV/EBITDA side-by-side with peers`,
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
    ],
    run: (p) => api.comboSectorValuation(p.ticker),
  },
  {
    key: "sector-relative-strength",
    name: "Sector Relative Strength",
    group: "combo",
    description: "Sector proxy relative strength vs benchmark + liquidity sensitivity.",
    explanation: `WHAT IT DOES: Analyzes a sector proxy's (e.g. XLK) relative strength vs a benchmark (e.g. SP500) and its sensitivity to global liquidity changes.

DATA SOURCES: Finnhub/Yahoo price history for ticker + benchmark + FRED liquidity elasticity.

WHAT IT SHOWS: A rotation verdict (Leading → Lagging), 0-100 score, alpha, beta, Sharpe ratio, liquidity beta + R², ticker vs benchmark return %, months outperforming, and a normalized comparison series chart.

USE CASES:
• "Is the tech sector (XLK) outperforming the S&P 500?" — sector rotation
• "How sensitive is gold to liquidity changes?" — macro sensitivity
• Spot sectors that are leading or lagging the market
• Compare a stock's performance vs a benchmark over multiple years`,
    params: [
      { key: "ticker", label: "Ticker / asset", type: "text", default: "XLK", placeholder: "e.g. XLK, AAPL" },
      { key: "benchmark", label: "Benchmark", type: "text", default: "SP500" },
      { key: "years", label: "Years", type: "number", default: "3" },
    ],
    run: (p) => api.comboSectorRelativeStrength(p.ticker, p.benchmark, Number(p.years) || 3),
  },
  {
    key: "lt-earnings-quality",
    name: "Earnings Quality",
    group: "long-term",
    description: "10+ years of SEC financial data: revenue/EPS CAGR, margin trends, accrual quality, ROE, ROA.",
    explanation: `WHAT IT DOES: Analyzes 10+ years of SEC filing data to assess whether a company's earnings are high quality — growing, stable, and backed by cash.

DATA SOURCES: SEC EDGAR XBRL companyfacts (free, no key) — Revenues, Net Income, Operating Income, Gross Profit, EPS, R&D, Debt, Equity, Assets, Cash Flow.

WHAT IT SHOWS: A quality verdict (Excellent → Poor), 0-100 score, revenue/EPS CAGR, gross/operating/net margin trends (expanding/contracting/stable), R&D intensity, accrual quality (earnings vs cash flow), earnings volatility, ROE, ROA, debt/equity, current ratio, and an annual financial series chart.

USE CASES:
• "Is AAPL's earnings quality improving or deteriorating?" — 10-year trend
• Spot companies with expanding margins (operating leverage)
• Detect earnings manipulation (high accruals = low quality)
• Find companies with consistent, low-volatility earnings growth`,
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
      { key: "years", label: "Years", type: "number", default: "10" },
    ],
    run: (p) => api.ltEarningsQuality(p.ticker, Number(p.years) || 10),
  },
  {
    key: "lt-capital-allocation",
    name: "Capital Allocation",
    group: "long-term",
    description: "How a company allocates capital over 10+ years: dividends, buybacks, R&D, capex, debt reduction.",
    explanation: `WHAT IT DOES: Evaluates how management allocates capital over 10+ years — dividends, buybacks, R&D, capex, and debt reduction.

DATA SOURCES: SEC EDGAR XBRL companyfacts — Dividends, Buybacks, R&D, Capex, Net Income, Revenue, Debt, Assets, Equity, Shares Outstanding.

WHAT IT SHOWS: An allocation verdict (Exceptional → Value Destructive), 0-100 score, payout ratio, buyback intensity %, R&D/revenue, capex/revenue, reinvestment rate, asset/equity growth, dividend growth CAGR, debt reduction, and an annual allocation series chart.

USE CASES:
• "Is AAPL's management allocating capital wisely?" — CEO scorecard
• See if buybacks are happening at the expense of R&D
• Track whether dividends are growing consistently
• Spot companies reducing debt vs those levering up
• Identify "value destructive" management (diluting shares, no returns)`,
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
      { key: "years", label: "Years", type: "number", default: "10" },
    ],
    run: (p) => api.ltCapitalAllocation(p.ticker, Number(p.years) || 10),
  },
  {
    key: "lt-balance-sheet-health",
    name: "Balance Sheet Health",
    group: "long-term",
    description: "10+ years of balance sheet metrics: current ratio, debt/equity, interest coverage, Altman Z-score.",
    explanation: `WHAT IT DOES: Analyzes 10+ years of balance sheet data to assess financial health and bankruptcy risk.

DATA SOURCES: SEC EDGAR XBRL companyfacts — Assets, Liabilities, Equity, Debt, Current Assets/Liabilities, Cash, Inventory, Revenue, COGS, EBIT, Interest Expense, Retained Earnings.

WHAT IT SHOWS: A health verdict (Fortress → Distressed), 0-100 score, current ratio, quick ratio, debt/equity, debt/assets, interest coverage, working capital, net debt/EBITDA, Altman Z-score (bankruptcy predictor), asset/inventory turnover, and an annual balance sheet series chart.

USE CASES:
• "Is AAPL's balance sheet strong enough to survive a downturn?" — stress test
• Spot companies heading toward distress (low Z-score, high debt)
• Compare financial strength across competitors
• Track leverage trends over 10+ years
• Identify "fortress" balance sheets (cash-rich, low debt)`,
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
      { key: "years", label: "Years", type: "number", default: "10" },
    ],
    run: (p) => api.ltBalanceSheetHealth(p.ticker, Number(p.years) || 10),
  },
  {
    key: "lt-compounder-score",
    name: "Compounder Score",
    group: "long-term",
    description: "Compounder quality over 10+ years: revenue/EPS/BV CAGR, avg ROE/ROIC, margin stability, earnings consistency.",
    explanation: `WHAT IT DOES: Scores whether a company is a true compounder — consistently growing earnings, book value, and dividends at attractive rates with high returns on capital.

DATA SOURCES: SEC EDGAR XBRL companyfacts + Yahoo Finance price history — Revenue, EPS, Equity, Debt, Net Income, Operating Income, Dividends, Buybacks, Capex.

WHAT IT SHOWS: A compounder verdict (Elite → Not a Compounder), 0-100 score, revenue/EPS/book value CAGR, average ROE & ROIC, margin stability, earnings consistency, growth-reinvestment balance, shareholder return years, price CAGR vs earnings CAGR, and an annual growth series chart.

USE CASES:
• "Is MSFT an elite compounder?" — long-term quality assessment
• Find companies that compound wealth consistently over 10+ years
• Compare ROE/ROIC trends to see if returns on capital are improving
• Spot "fake compounders" (growing via leverage, not organic growth)
• Identify companies where price has tracked earnings (fair compounding)`,
    params: [
      { key: "ticker", label: "Ticker", type: "text", default: "AAPL", placeholder: "e.g. AAPL" },
      { key: "years", label: "Years", type: "number", default: "10" },
    ],
    run: (p) => api.ltCompounderScore(p.ticker, Number(p.years) || 10),
  },
];

function fmtVal(v: any): string {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—";
  return String(v);
}

function renderTable(obj: Record<string, any>): { key: string; value: string }[] {
  return Object.entries(obj)
    .filter(([k]) => !["series", "metadata", "metrics", "tradesWithNews", "table", "highlights", "details", "signals", "percentiles", "peg", "valueTrapFlags"].includes(k))
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
        revenueCagr: "Revenue CAGR %",
        epsCagr: "EPS CAGR %",
        bookValueCagr: "Book value CAGR %",
        grossMarginTrend: "Gross margin trend",
        netMarginTrend: "Net margin trend",
        operatingMarginTrend: "Operating margin trend",
        rdIntensityTrend: "R&D intensity trend",
        accuralQuality: "Accrual quality",
        earningsVolatility: "Earnings volatility",
        debtToEquity: "Debt/equity",
        currentRatio: "Current ratio",
        returnOnEquity: "ROE %",
        returnOnAssets: "ROA %",
        quickRatio: "Quick ratio",
        debtToAssets: "Debt/assets",
        interestCoverage: "Interest coverage (x)",
        workingCapital: "Working capital ($B)",
        netDebtToEbitda: "Net debt/EBITDA",
        altmanZScore: "Altman Z-score",
        assetTurnover: "Asset turnover",
        inventoryTurnover: "Inventory turnover",
        dividendPayoutRatio: "Payout ratio",
        buybackIntensity: "Buyback intensity %",
        reinvestmentRate: "Reinvestment rate",
        rdToRevenue: "R&D/revenue",
        capexToRevenue: "Capex/revenue",
        assetGrowth: "Asset growth %",
        equityGrowth: "Equity growth %",
        dividendGrowthCagr: "Dividend growth CAGR %",
        debtReduction: "Debt reduction ($)",
        roeAvg: "Avg ROE %",
        roicAvg: "Avg ROIC %",
        marginStability: "Margin stability",
        earningsConsistency: "Earnings consistency",
        growthReinvestmentBalance: "Growth/reinvestment balance",
        shareholderReturnYears: "Shareholder return years",
        priceCagr: "Price CAGR %",
      };
      return { key: labels[k] ?? k, value: fmtVal(v) };
    });
}

function ChartFromSeries({ data, pal }: { data: any; pal: any }) {
  if (!data?.series || !Array.isArray(data.series) || data.series.length === 0) return null;

  const series: any[] = data.series;
  const keys = Object.keys(series[0]!);

  const dateKey = keys.find((k) => k.toLowerCase().includes("date")) || keys.find((k) => k === "period") || keys.find((k) => k === "fiscalYear") || "date";
  const valueKeys = keys.filter((k) => k !== dateKey && typeof series[0]![k] === "number");

  if (valueKeys.length === 0) return null;

  const rows: TimeSeriesRow[] = series.map((s) => ({
    date: dateKey === "fiscalYear" ? String(s[dateKey]) : s[dateKey],
    ...Object.fromEntries(valueKeys.map((k) => [k, s[k]])),
  }));
  const chartSeries: SeriesConfig[] = valueKeys.map((k, i) => ({
    key: k,
    name: k,
    color: pal.cat[i % pal.cat.length],
    type: "line",
    yAxisId: i === 0 ? "left" : "right",
    formatter: (v: number | null) => v == null ? "—" : Number(v).toFixed(2),
  }));

  const isSparse = dateKey === "fiscalYear" || series.length <= 20;

  return (
    <div style={{ marginTop: 16 }}>
      <TimeSeriesChart rows={rows} series={chartSeries} pal={pal} height={280} sparse={isSparse} />
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

  if (data.metrics && typeof data.metrics === "object") {
    const labelMap: Record<string, string> = {
      revenueCagr: "Revenue CAGR %", epsCagr: "EPS CAGR %", bookValueCagr: "Book value CAGR %",
      grossMarginTrend: "Gross margin trend", netMarginTrend: "Net margin trend",
      operatingMarginTrend: "Operating margin trend", rdIntensityTrend: "R&D intensity trend",
      accuralQuality: "Accrual quality", earningsVolatility: "Earnings volatility",
      debtToEquity: "Debt/equity", currentRatio: "Current ratio", returnOnEquity: "ROE %",
      returnOnAssets: "ROA %", quickRatio: "Quick ratio", debtToAssets: "Debt/assets",
      interestCoverage: "Interest coverage (x)", workingCapital: "Working capital ($B)",
      netDebtToEbitda: "Net debt/EBITDA", altmanZScore: "Altman Z-score",
      assetTurnover: "Asset turnover", inventoryTurnover: "Inventory turnover",
      dividendPayoutRatio: "Payout ratio", buybackIntensity: "Buyback intensity %",
      reinvestmentRate: "Reinvestment rate", rdToRevenue: "R&D/revenue",
      capexToRevenue: "Capex/revenue", assetGrowth: "Asset growth %",
      equityGrowth: "Equity growth %", dividendGrowthCagr: "Dividend growth CAGR %",
      debtReduction: "Debt reduction ($)", roeAvg: "Avg ROE %", roicAvg: "Avg ROIC %",
      marginStability: "Margin stability", earningsConsistency: "Earnings consistency",
      growthReinvestmentBalance: "Growth/reinvestment balance",
      shareholderReturnYears: "Shareholder return years", priceCagr: "Price CAGR %",
    };
    blocks.push({
      title: "Metrics",
      rows: Object.entries(data.metrics).map(([k, v]) => ({
        label: labelMap[k] ?? k,
        value: fmtVal(v),
      })),
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
  const [showInfo, setShowInfo] = useState<string | false>(false);

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
            <h2>{tool.group === "long-term" ? "Long-Term Analysis" : "Combo Analysis Tools"}</h2>
            <p className="note">{tool.description}</p>
          </div>
        </div>

        {/* Tool selector — grouped */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          {TOOLS.filter((t) => t.group === "combo").map((t) => (
            <button
              key={t.key}
              type="button"
              className={`toggle ${t.key === toolKey ? "on" : ""}`}
              onClick={() => { setToolKey(t.key); setResult(null); setErr(null); setShowInfo(false); }}
              style={t.key === toolKey ? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 600 } : {}}
              title={t.description}
            >
              {t.name}
              <span style={{ marginLeft: 4, opacity: 0.5, fontSize: "0.85em", cursor: "help" }} onClick={(e) => { e.stopPropagation(); setShowInfo(s => s !== t.key ? t.key : false); }}>ⓘ</span>
            </button>
          ))}
          <span style={{ borderLeft: "1px solid var(--border)", margin: "2px 4px" }} />
          {TOOLS.filter((t) => t.group === "long-term").map((t) => (
            <button
              key={t.key}
              type="button"
              className={`toggle ${t.key === toolKey ? "on" : ""}`}
              onClick={() => { setToolKey(t.key); setResult(null); setErr(null); setShowInfo(false); }}
              style={t.key === toolKey ? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 600 } : {}}
              title={t.description}
            >
              {t.name}
              <span style={{ marginLeft: 4, opacity: 0.5, fontSize: "0.85em", cursor: "help" }} onClick={(e) => { e.stopPropagation(); setShowInfo(s => s !== t.key ? t.key : false); }}>ⓘ</span>
            </button>
          ))}
        </div>

        {/* Info panel */}
        {showInfo && (() => {
          const infoTool = TOOLS.find((t) => t.key === showInfo);
          if (!infoTool) return null;
          return (
            <div className="panel" style={{ marginBottom: 14, padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h3 style={{ fontSize: 14, margin: 0, color: "var(--accent)" }}>{infoTool.name}</h3>
                <button type="button" onClick={() => setShowInfo(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font)", fontSize: 13, lineHeight: 1.55, color: "var(--ink)", margin: 0 }}>
                {infoTool.explanation}
              </pre>
            </div>
          );
        })()}

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