import { db } from "../../db.js";

function main() {
  // Insert a fake cached company row
  db.prepare(
    `INSERT INTO companies (ticker, name, sector, industry, exchange, currency, country, website, market_cap, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET
       name = excluded.name,
       sector = excluded.sector,
       industry = excluded.industry,
       exchange = excluded.exchange,
       currency = excluded.currency,
       country = excluded.country,
       website = excluded.website,
       market_cap = excluded.market_cap,
       fetched_at = excluded.fetched_at`
  ).run("TEST", "Test Company Inc.", "Technology", "Software", "NASDAQ", "USD", "US", "https://test.com", 1000000, new Date().toISOString());

  const row = db.prepare("SELECT * FROM companies WHERE ticker = ?").get("TEST");
  console.log("Cached row:");
  console.log(JSON.stringify(row, null, 2));
}

main();