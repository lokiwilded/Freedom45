/**
 * DBnomics API provider for Freedom45.
 *
 * Free aggregator of official statistics (IMF, ECB, national central banks). No API key.
 * Used for foreign broad money (M2/M3) where FRED's series are discontinued.
 * Docs: https://db.nomics.world/docs/api/
 */

const DBNOMICS_BASE = "https://api.db.nomics.world/v22";
const UA = "Mozilla/5.0 (compatible; Freedom45/0.1)";

export interface DbnomicsPoint {
  date: string; // YYYY-MM-01
  value: number | null;
}

/** Snap a DBnomics period/day string to a YYYY-MM-01 key. */
function normDate(raw: string): string {
  // period_start_day like "2025-02-01"; period like "2025-02" or "2025".
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-01`;
  const y = raw.match(/^(\d{4})/);
  return y ? `${y[1]}-01-01` : raw;
}

class DbnomicsProvider {
  private lastCallTime = 0;

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const wait = 300 - (now - this.lastCallTime);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCallTime = Date.now();
  }

  /** Fetch a single series' full observations, e.g. getSeries("IMF", "IFS", "M.JP.FMB_XDC"). */
  async getSeries(provider: string, dataset: string, code: string): Promise<DbnomicsPoint[]> {
    await this.rateLimit();

    const url = `${DBNOMICS_BASE}/series/${provider}/${dataset}/${encodeURIComponent(code)}?observations=1`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      throw new Error(`DBnomics API error: ${res.status} ${res.statusText} for ${provider}/${dataset}/${code}`);
    }

    const json = (await res.json()) as any;
    const docs = json?.series?.docs?.[0];
    if (!docs || !Array.isArray(docs.value)) {
      throw new Error(`DBnomics: no series data for ${provider}/${dataset}/${code}`);
    }

    const dates: string[] = docs.period_start_day ?? docs.period ?? [];
    const out: DbnomicsPoint[] = [];
    for (let i = 0; i < docs.value.length; i++) {
      const v = docs.value[i];
      const num = v === null || v === undefined || v === "NA" || Number.isNaN(Number(v)) ? null : Number(v);
      out.push({ date: normDate(String(dates[i])), value: num });
    }
    return out;
  }
}

export const dbnomicsProvider = new DbnomicsProvider();
