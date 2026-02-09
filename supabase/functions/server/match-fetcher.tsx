/**
 * 🎮 Match Fetcher with Cascading Fallback
 * 
 * Attempts to fetch match data via:
 * 1. Steam API (fast, recent matches)
 * 2. OpenDota cache (historical matches already parsed)
 * 3. OpenDota parse request (triggers parse and polls until ready)
 */

interface MatchFetchResult {
  success: boolean;
  matchData?: any;
  source?: string;
  error?: string;
}

/**
 * Fetches match data with cascading fallback strategy
 */
export async function fetchMatchWithFallback(matchId: string): Promise<MatchFetchResult> {
  console.log(`📍 Fetching match ${matchId} with cascading fallback...`);
  
  // Step 1: Try Steam API first (works for recent matches)
  console.log(`   🎮 [1/3] Trying Steam API (recent matches)...`);
  try {
    const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
    const steamMatchUrl = `https://api.steampowered.com/IDOTA2Match_570/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${matchId}`;
    
    const steamResponse = await fetch(steamMatchUrl);
    
    if (steamResponse.ok) {
      const steamData = await steamResponse.json();
      
      if (steamData?.result && !steamData.result.error) {
        console.log(`   ✅ Match found via Steam API!`);
        return {
          success: true,
          matchData: steamData.result,
          source: 'Steam API'
        };
      } else {
        console.log(`   ⚠️  Steam API returned error: ${steamData?.result?.error || 'Unknown'}`);
      }
    } else {
      console.log(`   ⚠️  Steam API request failed: ${steamResponse.status}`);
    }
  } catch (error) {
    console.log(`   ⚠️  Steam API error:`, error);
  }
  
  // Step 2: If Steam fails, try OpenDota (might already have it cached)
  console.log(`   🔍 [2/3] Trying OpenDota (cached historical matches)...`);
  try {
    const odotaResponse = await fetch(`https://api.opendota.com/api/matches/${matchId}`);
    
    if (odotaResponse.ok) {
      const odotaData = await odotaResponse.json();
      
      if (odotaData && !odotaData.error && odotaData.match_id) {
        console.log(`   ✅ Match found in OpenDota cache!`);
        return {
          success: true,
          matchData: odotaData,
          source: 'OpenDota (cached)'
        };
      } else if (odotaData.error) {
        console.log(`   ⚠️  OpenDota error: ${odotaData.error}`);
      }
    } else {
      console.log(`   ⚠️  OpenDota doesn't have this match cached (${odotaResponse.status})`);
    }
  } catch (error) {
    console.log(`   ⚠️  OpenDota fetch error:`, error);
  }
  
  // Step 3: If OpenDota doesn't have it, request a parse and wait
  console.log(`   📡 [3/3] Requesting OpenDota to parse match...`);
  try {
    // Request parse
    const parseResponse = await fetch(`https://api.opendota.com/api/request/${matchId}`, {
      method: 'POST'
    });
    
    if (parseResponse.ok) {
      const parseData = await parseResponse.json();
      console.log(`   ⏳ Parse requested. Job ID: ${parseData?.job?.jobId || 'N/A'}`);
      console.log(`   ⏳ Polling for match data (max 180 seconds)...`);
      
      // Poll for the match (max 90 attempts, 2 seconds apart = 180 seconds)
      for (let attempt = 1; attempt <= 90; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        console.log(`   🔄 Poll attempt ${attempt}/90...`);
        
        const pollResponse = await fetch(`https://api.opendota.com/api/matches/${matchId}`);
        
        if (pollResponse.ok) {
          const pollData = await pollResponse.json();
          
          if (pollData && !pollData.error && pollData.match_id) {
            console.log(`   ✅ Match parsed and retrieved! (took ${attempt * 2} seconds)`);
            return {
              success: true,
              matchData: pollData,
              source: 'OpenDota (parsed)'
            };
          }
        }
      }
      
      console.log(`   ❌ Parse timed out after 180 seconds. Match may still be processing.`);
      return {
        success: false,
        error: 'Parse timeout after 3 minutes - match is still processing. Try again in a few minutes.'
      };
    } else {
      const errorData = await parseResponse.json().catch(() => ({}));
      console.log(`   ❌ Parse request failed: ${parseResponse.status}`);
      return {
        success: false,
        error: `Parse request failed: ${errorData.error || parseResponse.statusText}`
      };
    }
  } catch (error) {
    console.log(`   ❌ Parse request error:`, error);
    return {
      success: false,
      error: `Parse request error: ${error}`
    };
  }
}

/**
 * Normalizes match data from different sources to a common format
 */
export function normalizeMatchData(matchData: any, source: string, team1Name: string, team2Name: string): any {
  if (source === 'Steam API') {
    // Convert Steam format to OpenDota-like format
    return {
      match_id: matchData.match_id,
      radiant_win: matchData.radiant_win,
      duration: matchData.duration,
      start_time: matchData.start_time,
      game_mode: matchData.game_mode,
      lobby_type: matchData.lobby_type,
      radiant_score: matchData.radiant_score || 0,
      dire_score: matchData.dire_score || 0,
      radiant_team_id: matchData.radiant_team_id || null,
      dire_team_id: matchData.dire_team_id || null,
      radiant_name: matchData.radiant_name || team1Name || 'Radiant',
      dire_name: matchData.dire_name || team2Name || 'Dire',
      players: matchData.players?.map((p: any) => ({
        account_id: p.account_id === 4294967295 ? null : p.account_id,
        player_slot: p.player_slot,
        hero_id: p.hero_id,
        kills: p.kills || 0,
        deaths: p.deaths || 0,
        assists: p.assists || 0,
        last_hits: p.last_hits || 0,
        denies: p.denies || 0,
        gold_per_min: p.gold_per_min || 0,
        xp_per_min: p.xp_per_min || 0,
        level: p.level || 0,
        hero_damage: p.hero_damage || 0,
        tower_damage: p.tower_damage || 0,
        hero_healing: p.hero_healing || 0,
        gold: p.gold || 0,
        item_0: p.item_0 || null,
        item_1: p.item_1 || null,
        item_2: p.item_2 || null,
        item_3: p.item_3 || null,
        item_4: p.item_4 || null,
        item_5: p.item_5 || null,
        isRadiant: p.player_slot < 128,
        personaname: null,
        avatarfull: null
      })) || []
    };
  } else {
    // OpenDota format is already correct, just ensure team names
    return {
      ...matchData,
      radiant_name: matchData.radiant_name || team1Name || 'Radiant',
      dire_name: matchData.dire_name || team2Name || 'Dire'
    };
  }
}