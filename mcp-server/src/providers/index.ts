/**
 * Provider registration entry point.
 *
 * Call `initProviders()` once at startup to register all data providers
 * with the fallback registry. Providers are registered in priority order —
 * the first one that returns data wins.
 *
 * To add a new API source:
 * 1. Create a provider file in providers/
 * 2. Implement the DataProvider interface
 * 3. Call registerProvider() from this file
 *
 * Current provider order (per data type):
 *   Finnhub (primary) → Yahoo (fallback for dividends, splits, news, quote)
 */

import { finnhubProvider } from "./finnhub.js";
import { fredProvider } from "./fred.js";
import { registerFinnhubProviders } from "./finnhub-registry.js";
import { registerYahooProviders } from "./yahoo-fallbacks.js";

let initialized = false;

export function initProviders(): void {
  if (initialized) return;
  initialized = true;

  // Initialize Finnhub with API key from env
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    finnhubProvider.init(finnhubKey);
  } else {
    console.error("Warning: FINNHUB_API_KEY not set. Combo tools will use fallbacks only.");
  }

  // Initialize FRED with API key from env
  const fredKey = process.env.FRED_API_KEY;
  if (fredKey) {
    fredProvider.init(fredKey);
  } else {
    console.error("Warning: FRED_API_KEY not set. Macro tools will fail.");
  }

  // Register providers in priority order:
  // Finnhub first (primary), then Yahoo (fallback for dividends, splits, news, quote)
  registerFinnhubProviders();
  registerYahooProviders();
}