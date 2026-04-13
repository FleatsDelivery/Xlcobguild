/**
 * OpenDota API Helpers
 * 
 * Fallback layer for live tournament data when Steam API fails.
 * Used ONLY for Live phase tournaments (never for Completed/Archived).
 */

const OPENDOTA_API_BASE = 'https://api.opendota.com/api';

export interface OpenDotaMatch {
  match_id: number;
  radiant_win: boolean;
  duration: number;
  start_time: number;
  radiant_team_id?: number;
  dire_team_id?: number;
  radiant_score: number;
  dire_score: number;
  players: Array<{
    account_id: number;
    player_slot: number;
    hero_id: number;
    kills: number;
    deaths: number;
    assists: number;
    last_hits: number;
    denies: number;
    gold_per_min: number;
    xp_per_min: number;
    net_worth: number;
    personaname?: string;
  }>;
}

/**
 * Fetch match details from OpenDota API
 * @param matchId - The match_id to fetch
 * @returns Match data or null if failed
 */
export async function fetchOpenDotaMatch(matchId: number | string): Promise<OpenDotaMatch | null> {
  try {
    console.log(`🔍 [OpenDota] Fetching match ${matchId}...`);
    
    const response = await fetch(`${OPENDOTA_API_BASE}/matches/${matchId}`);
    
    if (!response.ok) {
      console.error(`❌ [OpenDota] Failed to fetch match ${matchId}: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    // OpenDota might return 404 for very recent matches or private lobbies
    if (!data || data.error) {
      console.warn(`⚠️ [OpenDota] No data for match ${matchId}:`, data?.error);
      return null;
    }
    
    console.log(`✅ [OpenDota] Successfully fetched match ${matchId}`);
    return data as OpenDotaMatch;
  } catch (err) {
    console.error(`❌ [OpenDota] Error fetching match ${matchId}:`, err);
    return null;
  }
}

/**
 * Fetch multiple matches in parallel with rate limiting
 * @param matchIds - Array of match IDs to fetch
 * @param maxConcurrent - Max concurrent requests (default: 5 to respect OpenDota rate limits)
 * @returns Array of match data (nulls filtered out)
 */
export async function fetchOpenDotaMatches(
  matchIds: (number | string)[],
  maxConcurrent: number = 5
): Promise<OpenDotaMatch[]> {
  console.log(`🔍 [OpenDota] Fetching ${matchIds.length} matches (max ${maxConcurrent} concurrent)...`);
  
  const results: OpenDotaMatch[] = [];
  
  // Process in batches to respect rate limits
  for (let i = 0; i < matchIds.length; i += maxConcurrent) {
    const batch = matchIds.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(id => fetchOpenDotaMatch(id))
    );
    
    results.push(...batchResults.filter((m): m is OpenDotaMatch => m !== null));
    
    // Small delay between batches to be respectful
    if (i + maxConcurrent < matchIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`✅ [OpenDota] Successfully fetched ${results.length}/${matchIds.length} matches`);
  return results;
}

/**
 * Fetch a player's rank_tier from OpenDota by their Steam 32-bit account ID.
 * Returns the rank_tier integer (e.g. 63 = Ancient 3), or null if:
 *   - Player has private match data enabled
 *   - Player hasn't played ranked
 *   - Request fails / OpenDota doesn't have data
 *
 * @param accountId - Steam 32-bit account ID (NOT 64-bit SteamID64)
 */
export async function fetchOpenDotaPlayerRank(accountId: string): Promise<number | null> {
  try {
    const response = await fetch(`${OPENDOTA_API_BASE}/players/${accountId}`);
    if (!response.ok) {
      console.warn(`⚠️ [OpenDota] Player ${accountId} returned ${response.status}`);
      return null;
    }
    const data = await response.json();
    // rank_tier is null for private/unranked players
    if (!data || typeof data.rank_tier !== 'number' || data.rank_tier === 0) return null;
    return data.rank_tier;
  } catch (err) {
    console.error(`❌ [OpenDota] Error fetching player ${accountId}:`, err);
    return null;
  }
}

