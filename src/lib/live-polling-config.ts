/**
 * Live Polling Config — Shared TCF+ tiered polling settings.
 *
 * Used by any page that polls live game data (practice tournaments,
 * tournament hub, tournament cards, etc.)
 *
 * TCF+ members get faster refresh + manual refresh button.
 * Free members get a comfortable but slower auto-refresh.
 */

// Polling intervals
export const POLL_INTERVAL_PLUS_MS = 10_000;  // TCF+ members: 10s
export const POLL_INTERVAL_FREE_MS = 30_000;  // Free members: 30s

/** Get the correct polling interval based on TCF+ status */
export function getPollInterval(isTcfPlus: boolean): number {
  return isTcfPlus ? POLL_INTERVAL_PLUS_MS : POLL_INTERVAL_FREE_MS;
}

/** Whether this user gets manual refresh capability */
export function canManualRefresh(isTcfPlus: boolean): boolean {
  return isTcfPlus;
}
