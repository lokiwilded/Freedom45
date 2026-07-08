/**
 * FRED (Federal Reserve Economic Data) API provider for Freedom45.
 *
 * Free API key: https://fred.stlouisfed.org/docs/api/api_key.html
 * Docs: https://fred.stlouisfed.org/docs/api/fred/
 *
 * Mirrors the project's provider pattern:
 * - Pure API client (no storage/caching here — that lives in the tool/DB layer)
 * - Simple rate limiting (FRED allows 120 req/min)
 * - Retry on 429
 */

const FRED_BASE = "https://api.stlouisfed.org/fred";

export interface FredObservation {
  date: string; // YYYY-MM-DD
  value: number | null; // FRED encodes missing values as "."
}

export interface FredSeriesMeta {
  id: string;
  title: string;
  units: string;
  frequency: string;
  seasonalAdjustment: string;
  lastUpdated: string;
  observationStart: string;
  observationEnd: string;
}

class FredProvider {
  private apiKey: string | null = null;
  private lastCallTime = 0;

  /** Initialize with API key. Call once at startup. */
  init(apiKey: string): void {
    this.apiKey = apiKey.trim();
  }

  isInitialized(): boolean {
    return this.apiKey !== null;
  }

  /** FRED allows 120 req/min; keep >= 100ms between calls to stay safe. */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const wait = 100 - (now - this.lastCallTime);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCallTime = Date.now();
  }

  private async get<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    if (!this.apiKey) {
      throw new Error("FRED provider not initialized. Call init(apiKey) first.");
    }

    await this.rateLimit();

    const url = new URL(`${FRED_BASE}${endpoint}`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("file_type", "json");
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString());

    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1000));
      return this.get<T>(endpoint, params);
    }

    if (!res.ok) {
      // FRED returns a helpful error message in the body (e.g. bad api_key / series_id)
      const body = await res.text().catch(() => "");
      throw new Error(`FRED API error: ${res.status} ${res.statusText} ${body}`.trim());
    }

    return res.json() as Promise<T>;
  }

  /**
   * Fetch observations for a series.
   * Omitting observationStart/End returns the full available history.
   */
  async getSeriesObservations(
    seriesId: string,
    opts: { observationStart?: string; observationEnd?: string; frequency?: string; units?: string } = {}
  ): Promise<FredObservation[]> {
    const params: Record<string, string> = { series_id: seriesId };
    if (opts.observationStart) params.observation_start = opts.observationStart;
    if (opts.observationEnd) params.observation_end = opts.observationEnd;
    if (opts.frequency) params.frequency = opts.frequency;
    if (opts.units) params.units = opts.units;

    const data = await this.get<{ observations?: { date: string; value: string }[] }>(
      "/series/observations",
      params
    );

    if (!data.observations) return [];

    return data.observations.map((o) => ({
      date: o.date,
      value: o.value === "." || o.value === "" ? null : Number(o.value),
    }));
  }

  /** Fetch series metadata (title, units, frequency, coverage). */
  async getSeriesMeta(seriesId: string): Promise<FredSeriesMeta | null> {
    const data = await this.get<{ seriess?: any[] }>("/series", { series_id: seriesId });
    const s = data.seriess?.[0];
    if (!s) return null;
    return {
      id: s.id,
      title: s.title,
      units: s.units,
      frequency: s.frequency,
      seasonalAdjustment: s.seasonal_adjustment,
      lastUpdated: s.last_updated,
      observationStart: s.observation_start,
      observationEnd: s.observation_end,
    };
  }
}

export const fredProvider = new FredProvider();
