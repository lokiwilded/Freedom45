/**
 * Fetch historical daily OHLCV prices for a ticker.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { db } from "../../db.js";

export const FetchHistoricalPricesInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
  years: z.number().min(1).max(20).default(5).describe("How many years of daily history to fetch"),
});

export type FetchHistoricalPricesInput = z.infer<typeof FetchHistoricalPricesInput>;

export interface HistoricalPriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalPricesResult {
  ticker: string;
  years: number;
  requestedFrom: string;
  requestedTo: string;
  actualFrom: string;
  actualTo: string;
  count: number;
  fromCache: boolean;
  data: HistoricalPriceBar[];
  source: string;
  note?: string;
}

function toISODate(timestampSec: number): string {
  return new Date(timestampSec * 1000).toISOString().split("T")[0]!;
}

function toDateOnly(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

export async function fetchHistoricalPrices(
  ticker: string,
  years: number = 5
): Promise<HistoricalPricesResult> {
  const normalizedTicker = ticker.toUpperCase();
  const now = new Date();
  const requestedTo = toDateOnly(now);
  const requestedFrom = toDateOnly(new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000));

  const fromUnix = Math.floor(new Date(requestedFrom).getTime() / 1000);
  const toUnix = Math.floor(new Date(requestedTo).getTime() / 1000);

  const cachedStmt = db.prepare(
    "SELECT COUNT(*) as count FROM price_history WHERE ticker = ? AND date >= ? AND date <= ?"
  );
  const cachedCount = (cachedStmt.get(normalizedTicker, requestedFrom, requestedTo) as { count: number }).count;

  let fromCache = false;
  let note: string | undefined;
  if (cachedCount === 0) {
    const raw = await finnhubProvider.getHistoricalCandles(normalizedTicker, "D", fromUnix, toUnix);

    if (raw.s === "ok" && raw.t) {
      const insert = db.prepare(
        `INSERT OR IGNORE INTO price_history (ticker, date, open, high, low, close, adjusted_close, volume, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (let i = 0; i < raw.t.length; i++) {
        insert.run(
          normalizedTicker,
          toISODate(raw.t[i]!),
          raw.o[i]!,
          raw.h[i]!,
          raw.l[i]!,
          raw.c[i]!,
          raw.c[i]!,
          raw.v[i]!,
          "finnhub"
        );
      }
    } else if (raw.s === "no_data") {
      note = "Finnhub returned no data for this range.";
    }
  } else {
    fromCache = true;
  }

  const rows = db
    .prepare(
      "SELECT * FROM price_history WHERE ticker = ? AND date >= ? AND date <= ? ORDER BY date"
    )
    .all(normalizedTicker, requestedFrom, requestedTo) as {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];

  const data = rows.map((r) => ({
    date: r.date,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));

  const actualFrom = data[0]?.date || requestedFrom;
  const actualTo = data[data.length - 1]?.date || requestedTo;

  return {
    ticker: normalizedTicker,
    years,
    requestedFrom,
    requestedTo,
    actualFrom,
    actualTo,
    count: data.length,
    fromCache,
    data,
    source: data.length > 0 ? (fromCache ? "cache" : "finnhub") : "none",
    note,
  };
}

export const fetchHistoricalPricesTool = {
  name: "fetch_historical_prices",
  description: "Fetch daily OHLCV historical prices for a ticker. Append-only SQLite cache.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
      years: { type: "number", description: "How many years of history (default 5, max 20)", default: 5 },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker, years } = FetchHistoricalPricesInput.parse(args);
    return await fetchHistoricalPrices(ticker, years);
  },
};
