/**
 * Fetch peer tickers for a company.
 */

import { z } from "zod";
import { fetchPeers as fetchPeersCombo } from "../../lib/combo-fetchers.js";

export const FetchPeersInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type FetchPeersInput = z.infer<typeof FetchPeersInput>;

export interface PeersResult {
  ticker: string;
  peers: string[];
  fromCache: boolean;
}



export async function fetchPeers(ticker: string): Promise<PeersResult> {
  const normalizedTicker = ticker.toUpperCase();

  const result = await fetchPeersCombo(normalizedTicker);

  return {
    ticker: normalizedTicker,
    peers: result?.peers ? result.peers.map((p: string) => p.toUpperCase()) : [],
    fromCache: false,
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
