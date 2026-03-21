/**
 * Steam ID Helper Functions
 * 
 * Steam has multiple ID formats for the same account:
 * - Account ID (Steam32): 51579950 (8-10 digits) ← OpenDota/Dota 2 match data
 * - Steam64: 76561198011845678 (17 digits) ← Steam profile lookups
 * - Vanity URL: "permasnooze" ← Custom profile URL
 * 
 * We canonically store Account ID (Steam32) in the database.
 */

const STEAM_ID_OFFSET = 76561197960265728;
const STEAM_API_BASE = 'https://api.steampowered.com';

/**
 * Convert Steam64 to Account ID (Steam32)
 */
export function steam64ToSteam32(steam64: string | number): number {
  const steam64Num = typeof steam64 === 'string' ? parseInt(steam64) : steam64;
  return steam64Num - STEAM_ID_OFFSET;
}

/**
 * Convert Account ID (Steam32) to Steam64
 */
export function steam32ToSteam64(accountId: string | number): string {
  const accountIdNum = typeof accountId === 'string' ? parseInt(accountId) : accountId;
  return String(accountIdNum + STEAM_ID_OFFSET);
}

/**
 * Resolve a Steam vanity URL (custom profile name) to Steam64
 * Example: "permasnooze" → "76561198011845678"
 * 
 * Requires STEAM_WEB_API_KEY environment variable
 */
export async function resolveVanityUrl(vanityUrl: string): Promise<string | null> {
  try {
    const apiKey = Deno.env.get('STEAM_WEB_API_KEY');
    if (!apiKey) {
      console.error('STEAM_WEB_API_KEY not set - cannot resolve vanity URL');
      return null;
    }

    const url = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v0001/?key=${apiKey}&vanityurl=${vanityUrl}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.response?.success === 1) {
      return data.response.steamid; // Returns Steam64
    }

    console.warn(`Failed to resolve vanity URL "${vanityUrl}":`, data.response?.message || 'Unknown error');
    return null;
  } catch (error) {
    console.error(`Error resolving vanity URL "${vanityUrl}":`, error);
    return null;
  }
}

/**
 * Normalize ANY Steam ID format to Account ID (Steam32)
 * 
 * Accepts:
 * - Account ID: "51579950" or 51579950
 * - Steam64: "76561198011845678"
 * - Vanity URL: "permasnooze"
 * 
 * Returns: Account ID as number, or null if invalid/unresolvable
 */
export async function normalizeToAccountId(input: string | number): Promise<number | null> {
  if (!input) return null;

  const inputStr = String(input).trim();

  // Handle numeric Account ID (8-10 digits) - already correct format
  if (/^\d{8,10}$/.test(inputStr)) {
    return parseInt(inputStr);
  }

  // Handle Steam64 (17 digits)
  if (/^\d{17}$/.test(inputStr)) {
    return steam64ToSteam32(inputStr);
  }

  // Handle vanity URL (alphanumeric + underscores/hyphens)
  // Must be at least 3 chars (Steam requirement)
  if (/^[a-zA-Z0-9_-]{3,}$/.test(inputStr)) {
    const steam64 = await resolveVanityUrl(inputStr);
    if (steam64) {
      return steam64ToSteam32(steam64);
    }
  }

  console.warn(`Could not normalize Steam ID input: "${inputStr}"`);
  return null;
}

/**
 * Get Dotabuff URL from Account ID
 */
export function getDotabuffUrl(accountId: string | number): string {
  return `https://www.dotabuff.com/players/${accountId}`;
}

/**
 * Get OpenDota URL from Account ID
 */
export function getOpendotaUrl(accountId: string | number): string {
  return `https://www.opendota.com/players/${accountId}`;
}

/**
 * Get Steam profile URL from Account ID (converts to Steam64)
 */
export function getSteamProfileUrl(accountId: string | number): string {
  const steam64 = steam32ToSteam64(accountId);
  return `https://steamcommunity.com/profiles/${steam64}`;
}
