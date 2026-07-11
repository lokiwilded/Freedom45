/**
 * Combo data fetchers — thin wrappers around the multi-provider registry
 * that return data in the shapes the combo tools expect.
 *
 * Each function tries Finnhub first, then falls back to Yahoo or other
 * registered providers. The combo tools call these instead of calling
 * Finnhub directly.
 */

import { fetchData } from "./data-registry.js";

// ── Insider transactions ──

export interface InsiderTxRow {
  symbol: string;
  name: string;
  insiderName: string;
  share: number;
  change: number;
  filingDate: string;
  transactionDate: string;
  transactionCode: string;
  price: number;
  value: number;
  isBuy: boolean;
}

export async function fetchInsiderTransactions(
  ticker: string,
  from?: string,
  to?: string
): Promise<{ transactions: InsiderTxRow[]; source: string; fromCache: boolean } | null> {
  const result = await fetchData<any[]>("insider_transactions", { ticker, from, to });
  if (!result || !result.data) return null;

  const transactions: InsiderTxRow[] = result.data.map((t) => ({
    symbol: t.symbol || "",
    name: t.name || "",
    insiderName: t.name || t.insiderName || "",
    share: t.share || 0,
    change: t.change || 0,
    filingDate: t.filingDate || "",
    transactionDate: t.transactionDate || "",
    transactionCode: t.transactionCode || "",
    price: t.price || 0,
    value: t.value || 0,
    isBuy: (t.transactionCode || "").toUpperCase().startsWith("P"),
  }));

  return { transactions, source: result.source, fromCache: result.fromCache };
}

// ── Dividends ──

export interface DividendRow {
  date: string;
  dividend: number;
  adjustedDividend: number;
  recordDate: string;
  paymentDate: string;
  declarationDate: string;
}

export async function fetchDividends(
  ticker: string,
  from: string,
  to: string
): Promise<{ dividends: DividendRow[]; source: string } | null> {
  const result = await fetchData<DividendRow[]>("dividends", { ticker, from, to });
  if (!result || !result.data) return null;
  return { dividends: result.data, source: result.source };
}

// ── Stock splits ──

export interface SplitRow {
  date: string;
  fromFactor: number;
  toFactor: number;
  ratio: string;
}

export async function fetchSplits(
  ticker: string,
  from: string,
  to: string
): Promise<{ splits: SplitRow[]; source: string } | null> {
  const result = await fetchData<SplitRow[]>("splits", { ticker, from, to });
  if (!result || !result.data) return null;
  return { splits: result.data, source: result.source };
}

// ── Stock quote ──

export interface QuoteRow {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export async function fetchStockQuote(
  ticker: string
): Promise<{ data: QuoteRow; source: string } | null> {
  const result = await fetchData<QuoteRow>("stock_quote", { ticker });
  if (!result || !result.data) return null;
  return { data: result.data, source: result.source };
}

// ── Company profile ──

export interface CompanyProfileRow {
  name: string;
  ticker: string;
  marketCapitalization: number;
  shareOutstanding: number;
  industry: string;
  sector: string;
  exchange: string;
  currency: string;
  country: string;
  website: string;
}

export async function fetchCompanyProfile(
  ticker: string
): Promise<{ profile: CompanyProfileRow | null; source: string } | null> {
  const result = await fetchData<CompanyProfileRow>("company_profile", { ticker });
  if (!result || !result.data) return null;
  return { profile: result.data, source: result.source };
}

// ── Company news ──

export interface NewsRow {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export async function fetchCompanyNews(
  ticker: string,
  from: string,
  to: string
): Promise<{ news: NewsRow[]; source: string } | null> {
  const result = await fetchData<NewsRow[]>("company_news", { ticker, from, to });
  if (!result || !result.data) return null;
  return { news: result.data, source: result.source };
}

// ── Market news ──

export async function fetchMarketNews(
  category: string
): Promise<{ news: NewsRow[]; source: string } | null> {
  const result = await fetchData<NewsRow[]>("market_news", { category });
  if (!result || !result.data) return null;
  return { news: result.data, source: result.source };
}

// ── Earnings surprise ──

export interface EarningsSurpriseRow {
  actual: number;
  estimate: number;
  period: string;
  quarter: number;
  surprise: number;
  surprisePercent: number;
  symbol: string;
  year: number;
}

export async function fetchEarningsSurprise(
  ticker: string
): Promise<{ surprises: EarningsSurpriseRow[]; source: string } | null> {
  const result = await fetchData<EarningsSurpriseRow[]>("earnings_surprise", { ticker });
  if (!result || !result.data) return null;
  return { surprises: result.data, source: result.source };
}

// ── Recommendation trends ──

export interface RecommendationTrendRow {
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  period: string;
  symbol: string;
}

export async function fetchRecommendationTrends(
  ticker: string
): Promise<{ trends: RecommendationTrendRow[]; source: string } | null> {
  const result = await fetchData<RecommendationTrendRow[]>("recommendation_trends", { ticker });
  if (!result || !result.data) return null;
  return { trends: result.data, source: result.source };
}

// ── Price target ──

export interface PriceTargetRow {
  lastUpdated: string;
  mean: number;
  median: number;
  postHigh: number;
  postLow: number;
  postMean: number;
  postMedian: number;
  preHigh: number;
  preLow: number;
  preMean: number;
  preMedian: number;
  symbol: string;
}

export async function fetchPriceTarget(
  ticker: string
): Promise<{ target: PriceTargetRow | null; source: string } | null> {
  const result = await fetchData<PriceTargetRow>("price_target", { ticker });
  if (!result || !result.data) return null;
  return { target: result.data, source: result.source };
}

// ── Upgrade/downgrade ──

export interface UpgradeDowngradeRow {
  gradeTime: number;
  fromGrade: string;
  toGrade: string;
  action: string;
  brokerage: string;
  symbol: string;
}

export async function fetchUpgradeDowngrade(
  ticker: string
): Promise<{ actions: UpgradeDowngradeRow[]; source: string } | null> {
  const result = await fetchData<UpgradeDowngradeRow[]>("upgrade_downgrade", { ticker });
  if (!result || !result.data) return null;
  return { actions: result.data, source: result.source };
}

// ── Fundamental metrics ──

export async function fetchFundamentalMetrics(
  ticker: string
): Promise<{ metrics: any; source: string } | null> {
  const result = await fetchData<any>("fundamental_metrics", { ticker });
  if (!result || !result.data) return null;
  return { metrics: result.data, source: result.source };
}

// ── Peers ──

export async function fetchPeers(
  ticker: string
): Promise<{ peers: string[]; source: string } | null> {
  const result = await fetchData<string[]>("peers", { ticker });
  if (!result || !result.data) return null;
  return { peers: result.data, source: result.source };
}

// ── Congress trades ──

export interface CongressTradeRow {
  symbol: string;
  name: string;
  party: string;
  chamber: string;
  transactionDate: string;
  type: string;
  amount: string;
  assetDescription: string;
  filingDate: string;
}

export async function fetchCongressTrades(
  ticker: string,
  from?: string,
  to?: string
): Promise<{ trades: CongressTradeRow[]; source: string } | null> {
  const result = await fetchData<CongressTradeRow[]>("congress_trades", { ticker, from, to });
  if (!result || !result.data) return null;
  return { trades: result.data, source: result.source };
}

// ── Institutional ownership ──

export interface InstitutionalOwnerRow {
  investor: string;
  stake: number;
  shares: number;
  value: number;
  dateReported: string;
  change: number;
  percentTotal: number;
}

export async function fetchInstitutionalOwnership(
  ticker: string
): Promise<{ owners: InstitutionalOwnerRow[]; source: string } | null> {
  const result = await fetchData<InstitutionalOwnerRow[]>("institutional_ownership", { ticker });
  if (!result || !result.data) return null;
  return { owners: result.data, source: result.source };
}

// ── Fund ownership ──

export interface FundOwnerRow {
  owner: string;
  shares: number;
  value: number;
  dateReported: string;
  change: number;
  percentTotal: number;
}

export async function fetchFundOwnership(
  ticker: string
): Promise<{ owners: FundOwnerRow[]; source: string } | null> {
  const result = await fetchData<FundOwnerRow[]>("fund_ownership", { ticker });
  if (!result || !result.data) return null;
  return { owners: result.data, source: result.source };
}