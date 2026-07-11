/**
 * Get recent analyst upgrade/downgrade actions for a symbol.
 */

import { z } from "zod";
import { fetchUpgradeDowngrade } from "../../lib/combo-fetchers.js";

export const GetUpgradeDowngradeInput = z.object({
  ticker: z.string().describe("Stock ticker, e.g. AAPL"),
});

export type GetUpgradeDowngradeInput = z.infer<typeof GetUpgradeDowngradeInput>;

export interface UpgradeDowngradeResult {
  ticker: string;
  actions: {
    gradeTime: string;
    fromGrade: string;
    toGrade: string;
    action: string;
    brokerage: string;
  }[];
  fromCache: boolean;
}



export async function getUpgradeDowngrade(ticker: string): Promise<UpgradeDowngradeResult> {
  const normalizedTicker = ticker.toUpperCase();

  const result = await fetchUpgradeDowngrade(normalizedTicker);

  const actions = (result?.actions || []).map((a: any) => ({
    gradeTime: a.gradeTime ? new Date(a.gradeTime * 1000).toISOString() : "",
    fromGrade: a.fromGrade || "",
    toGrade: a.toGrade || "",
    action: a.action || "",
    brokerage: a.brokerage || "",
  }));

  return { ticker: normalizedTicker, actions, fromCache: false };
}

export const getUpgradeDowngradeTool = {
  name: "get_upgrade_downgrade",
  description: "Get recent analyst upgrade/downgrade actions for a ticker. Cached 24h.",
  inputSchema: {
    type: "object",
    properties: {
      ticker: { type: "string", description: "Stock ticker, e.g. AAPL" },
    },
    required: ["ticker"],
  },
  handler: async (args: unknown) => {
    const { ticker } = GetUpgradeDowngradeInput.parse(args);
    return await getUpgradeDowngrade(ticker);
  },
};