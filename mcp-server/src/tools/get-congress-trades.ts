import { z } from 'zod';
import { finnhubProvider } from '../providers/finnhub.js';
import { dbManager } from '../db/manager.js';

/**
 * get_congress_trades MCP tool
 * 
 * Fetches congressional stock trades from Finnhub, caches in SQLite.
 * Supports filtering by symbol, date range, chamber, party, and minimum trade size.
 */

// Input schema
export const GetCongressTradesInput = z.object({
  symbol: z.string().optional().describe('Stock ticker to filter by (e.g. AAPL)'),
  days_back: z.number().min(1).max(365).default(30).describe('How many days back to look'),
  chamber: z.enum(['senate', 'house']).optional().describe('Filter by chamber'),
  party: z.enum(['democrat', 'republican']).optional().describe('Filter by party'),
  min_amount: z.string().optional().describe('Minimum trade size bucket (e.g. $15,001-$50,000)'),
  limit: z.number().min(1).max(100).default(50).describe('Max results to return'),
});

export type GetCongressTradesInput = z.infer<typeof GetCongressTradesInput>;

// Output type
export interface CongressTradeResult {
  politician: string;
  chamber: string;
  party: string;
  ticker: string;
  asset: string;
  type: string;
  amount: string;
  date: string;
  filed: string;
}

/**
 * Execute the get_congress_trades tool.
 */
export async function getCongressTrades(input: GetCongressTradesInput): Promise<{
  trades: CongressTradeResult[];
  total: number;
  from_cache: boolean;
}> {
  const db = dbManager.get('congress');
  const now = new Date();
  const fromDate = new Date(now.getTime() - input.days_back * 24 * 60 * 60 * 1000);
  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = now.toISOString().split('T')[0];

  // Try cache first
  const cacheKey = `congress:${input.symbol || 'all'}:${input.chamber || 'all'}:${input.party || 'all'}:${input.min_amount || 'all'}:${fromStr}:${toStr}`;
  const cached = db.prepare('SELECT response FROM api_cache WHERE cache_key = ? AND expires_at > datetime(\'now\')').get(cacheKey) as any;

  let trades: CongressTradeResult[] = [];

  if (cached) {
    // Use cached data
    trades = JSON.parse(cached.response);
  } else {
    // Fetch from Finnhub
    const rawTrades = await finnhubProvider.getCongressTrades(input.symbol, fromStr, toStr);

    // Transform to our format
    trades = rawTrades.map(t => ({
      politician: t.name,
      chamber: t.chamber,
      party: t.party,
      ticker: t.symbol,
      asset: t.assetDescription,
      type: t.type,
      amount: t.amount,
      date: t.transactionDate,
      filed: t.filingDate,
    }));

    // Cache for 5 minutes (congress trades don't update that frequently)
    db.prepare(
      'INSERT OR REPLACE INTO api_cache (cache_key, response, fetched_at, expires_at) VALUES (?, ?, datetime(\'now\'), datetime(\'now\', \'+5 minutes\'))'
    ).run(cacheKey, JSON.stringify(trades));

    // Also store in congress_trades table for historical queries
    // Batch insert trades using a transaction
    const insertTrade = db.transaction((trades: any[]) => {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO congress_trades 
          (politician_name, chamber, party, ticker, asset_description, transaction_type, amount_range, transaction_date, disclosure_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const t of trades) {
        stmt.run(
          t.name,
          t.chamber,
          t.party,
          t.symbol,
          t.assetDescription,
          t.type,
          t.amount,
          t.transactionDate,
          t.filingDate
        );
      }
    });

    insertTrade(rawTrades);
  }

  // Apply filters
  let filtered = [...trades];

  if (input.chamber) {
    const chamber = input.chamber;
    filtered = filtered.filter(t => t.chamber?.toLowerCase() === chamber.toLowerCase());
  }

  if (input.party) {
    const party = input.party;
    filtered = filtered.filter(t => t.party?.toLowerCase() === party.toLowerCase());
  }

  if (input.min_amount) {
    // Parse the minimum amount as a number (e.g., "$15,001-$50,000" → 15001)
    const minMatch = input.min_amount.match(/\$?([\d,]+)/);
    if (minMatch) {
      const minValue = parseInt(minMatch[1].replace(/,/g, ''));
      filtered = filtered.filter(t => {
        const tradeMatch = t.amount.match(/\$?([\d,]+)/);
        if (!tradeMatch) return false;
        const tradeValue = parseInt(tradeMatch[1].replace(/,/g, ''));
        return tradeValue >= minValue;
      });
    }
  }

  // Sort by date descending (most recent first)
  filtered.sort((a, b) => b.date.localeCompare(a.date));

  // Apply limit
  filtered = filtered.slice(0, input.limit);

  return {
    trades: filtered,
    total: filtered.length,
    from_cache: !!cached,
  };
}

// Tool definition for MCP registration
export const getCongressTradesTool = {
  name: 'get_congress_trades',
  description: 'Get congressional stock trades. Track what US Senators and Representatives are buying and selling. Supports filtering by ticker, date range, chamber, party, and minimum trade size.',
  inputSchema: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Stock ticker to filter by (e.g. AAPL)',
      },
      days_back: {
        type: 'number',
        description: 'How many days back to look (default: 30, max: 365)',
        default: 30,
      },
      chamber: {
        type: 'string',
        enum: ['senate', 'house'],
        description: 'Filter by chamber',
      },
      party: {
        type: 'string',
        enum: ['democrat', 'republican'],
        description: 'Filter by party',
      },
      min_amount: {
        type: 'string',
        description: 'Minimum trade size bucket (e.g. $15,001-$50,000)',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default: 50, max: 100)',
        default: 50,
      },
    },
  },
  handler: async (args: any) => {
    const input = GetCongressTradesInput.parse(args);
    return await getCongressTrades(input);
  },
};