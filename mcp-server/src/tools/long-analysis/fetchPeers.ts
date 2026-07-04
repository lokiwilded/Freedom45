/**
 * Fetch peer tickers for a company.
 */

import { z } from "zod";
import { finnhubProvider } from "../../providers/finnhub.js";
import { getCachedResponse, setCachedResponse } from "../../lib/cache.js";

export const FetchPeersInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type FetchPeersInput = z.infer<typeof FetchPeersInput>;

export interface PeersResult {
  ticker: string;
  peers: string[];
  fromCache: boolean;
}

const PEERS_TTL_MINUTES = 60 * 24 * 7; // 7 days

export async function fetchPeers(ticker: string): Promise<PeersResult> {
  const normalizedTicker = ticker.toUpperCase();
  const cacheKey = `peers:${normalizedTicker}`;

  let raw = getCachedResponse(cacheKey);
  let fromCache = true;

  if (!raw) {
    raw = await finnhubProvider.getPeers(normalizedTicker);
    setCachedResponse(cacheKey, raw, PEERS_TTL_MINUTES);
    fromCache = false;
  }

  return {
    ticker: normalizedTicker,
    peers: Array.isArray(raw) ? raw.map((p: string) => p.toUpperCase()) : [],
    fromCache,
  };
}

export const fetchPeersTool = {
  name: "fetch_peers",
  description: "Fetch a list of peer/competitor tickers for a company. Cached for 7 days.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = FetchPeersInput.parse(args);
    return await fetchPeers(ticker);
  },
};
