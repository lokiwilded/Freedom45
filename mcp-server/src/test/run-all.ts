/**
 * Unified test runner — runs all tool tests and reports a summary.
 *
 * Usage:
 *   node --env-file=../.env --import tsx src/test/run-all.ts
 *   node --env-file=../.env --import tsx src/test/run-all.ts --combo
 *   node --env-file=../.env --import tsx src/test/run-all.ts --long
 *   node --env-file=../.env --import tsx src/test/run-all.ts --macro
 *
 * Flags:
 *   --combo   only combo tests
 *   --long    only long-analysis tests
 *   --macro   only macro tests
 *   --congress only congress trades test
 *   (no flag)  run everything
 */

import { execSync } from "child_process";
import { existsSync } from "fs";

interface TestDef {
  name: string;
  file: string;
  group: "combo" | "long" | "longterm" | "macro" | "congress";
}

const TESTS: TestDef[] = [
  // Combo
  { name: "analyze_insider_sentiment", file: "src/test/combo/analyzeInsiderSentiment.test.ts", group: "combo" },
  { name: "analyze_earnings_momentum", file: "src/test/combo/analyzeEarningsMomentum.test.ts", group: "combo" },
  { name: "find_smart_money_convergence", file: "src/test/combo/findSmartMoneyConvergence.test.ts", group: "combo" },
  { name: "analyze_shareholder_yield", file: "src/test/combo/analyzeShareholderYield.test.ts", group: "combo" },
  { name: "scan_liquidity_regime", file: "src/test/combo/scanLiquidityRegime.test.ts", group: "combo" },
  { name: "analyze_congress_news_catalyst", file: "src/test/combo/analyzeCongressNewsCatalyst.test.ts", group: "combo" },
  { name: "compare_sector_valuation", file: "src/test/combo/compareSectorValuation.test.ts", group: "combo" },
  { name: "get_sector_relative_strength", file: "src/test/combo/getSectorRelativeStrength.test.ts", group: "combo" },
  // Long-analysis
  { name: "fetch_company_profile", file: "src/test/long-analysis/fetchCompanyProfile.test.ts", group: "long" },
  { name: "fetch_stock_quote", file: "src/test/long-analysis/fetchStockQuote.test.ts", group: "long" },
  { name: "fetch_historical_prices", file: "src/test/long-analysis/fetchHistoricalPrices.test.ts", group: "long" },
  { name: "fetch_fundamental_metrics", file: "src/test/long-analysis/fetchFundamentalMetrics.test.ts", group: "long" },
  { name: "fetch_peers", file: "src/test/long-analysis/fetchPeers.test.ts", group: "long" },
  { name: "analyze_long_term_trend", file: "src/test/long-analysis/analyzeLongTermTrend.test.ts", group: "long" },
  { name: "search_stocks", file: "src/test/long-analysis/searchStocks.test.ts", group: "long" },
  { name: "get_insider_transactions", file: "src/test/long-analysis/getInsiderTransactions.test.ts", group: "long" },
  { name: "get_company_news", file: "src/test/long-analysis/getCompanyNews.test.ts", group: "long" },
  { name: "get_market_news", file: "src/test/long-analysis/getMarketNews.test.ts", group: "long" },
  { name: "get_earnings_calendar", file: "src/test/long-analysis/getEarningsCalendar.test.ts", group: "long" },
  { name: "get_earnings_surprise", file: "src/test/long-analysis/getEarningsSurprise.test.ts", group: "long" },
  { name: "get_recommendation_trends", file: "src/test/long-analysis/getRecommendationTrends.test.ts", group: "long" },
  { name: "get_price_target", file: "src/test/long-analysis/getPriceTarget.test.ts", group: "long" },
  { name: "get_upgrade_downgrade", file: "src/test/long-analysis/getUpgradeDowngrade.test.ts", group: "long" },
  { name: "get_dividends", file: "src/test/long-analysis/getDividends.test.ts", group: "long" },
  { name: "get_splits", file: "src/test/long-analysis/getSplits.test.ts", group: "long" },
  { name: "get_sec_filings", file: "src/test/long-analysis/getSecFilings.test.ts", group: "long" },
  { name: "get_institutional_ownership", file: "src/test/long-analysis/getInstitutionalOwnership.test.ts", group: "long" },
  { name: "get_fund_ownership", file: "src/test/long-analysis/getFundOwnership.test.ts", group: "long" },
  { name: "analyze_valuation", file: "src/test/long-analysis/analyzeValuation.test.ts", group: "long" },
  { name: "analyze_relative_strength", file: "src/test/long-analysis/analyzeRelativeStrength.test.ts", group: "long" },
  // Long-term
  { name: "lt_earnings_quality", file: "src/test/long-term/analyzeEarningsQuality.test.ts", group: "longterm" },
  { name: "lt_capital_allocation", file: "src/test/long-term/analyzeCapitalAllocation.test.ts", group: "longterm" },
  { name: "lt_balance_sheet_health", file: "src/test/long-term/analyzeBalanceSheetHealth.test.ts", group: "longterm" },
  { name: "lt_compounder_score", file: "src/test/long-term/analyzeCompounderScore.test.ts", group: "longterm" },
  // Congress
  { name: "get_congress_trades", file: "src/test/getCongressTrades.test.ts", group: "congress" },
  // Macro
  { name: "get_global_liquidity", file: "src/test/macro/getGlobalLiquidity.test.ts", group: "macro" },
  { name: "get_money_supply", file: "src/test/macro/getMoneySupply.test.ts", group: "macro" },
  { name: "get_government_debt", file: "src/test/macro/getDebt.test.ts", group: "macro" },
  { name: "get_asset_history", file: "src/test/macro/getAssetHistory.test.ts", group: "macro" },
  { name: "get_liquidity_elasticity", file: "src/test/macro/getLiquidityElasticity.test.ts", group: "macro" },
];

function main() {
  const args = process.argv.slice(2);
  const filter = args.find((a) => a.startsWith("--"))?.slice(2) as "combo" | "long" | "longterm" | "macro" | "congress" | undefined;

  let tests = filter ? TESTS.filter((t) => t.group === filter) : TESTS;
  tests = tests.filter((t) => existsSync(t.file));

  console.log(`\n${"=".repeat(70)}`);
  console.log(`  Freedom45 Test Runner — ${tests.length} test${tests.length === 1 ? "" : "s"}`);
  console.log(`${"=".repeat(70)}\n`);

  const results: { name: string; group: string; passed: boolean; output: string; error?: string }[] = [];

  for (const test of tests) {
    process.stdout.write(`  ▸ ${test.name}... `);
    try {
      const output = execSync(
        `node --env-file=../.env --import tsx ${test.file}`,
        { encoding: "utf-8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] }
      );
      const hasError = output.includes("Error:") || output.includes("❌");
      const summaryMatch = output.match(/=== Summary: (\d+) passed, (\d+) failed ===/);
      const passed = summaryMatch ? summaryMatch[2] === "0" : !hasError;

      results.push({ name: test.name, group: test.group, passed, output });
      console.log(passed ? "✅ PASS" : "❌ FAIL");
      if (!passed) {
        const lines = output.split("\n").filter((l) => l.includes("❌") || l.includes("Error"));
        for (const line of lines) console.log(`      ${line.trim()}`);
      }
    } catch (e: any) {
      const output = e.stdout || e.stderr || e.message;
      results.push({ name: test.name, group: test.group, passed: false, output, error: e.message });
      console.log("❌ ERROR");
      if (output) {
        const lines = output.split("\n").slice(-3);
        for (const line of lines) console.log(`      ${line.trim()}`);
      }
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n${"=".repeat(70)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log(`${"=".repeat(70)}`);

  if (failed > 0) {
    console.log("\n  Failed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    ❌ ${r.name} (${r.group})`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();