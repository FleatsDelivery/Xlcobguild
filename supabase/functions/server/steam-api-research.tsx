/**
 * Steam Web API Research Endpoints
 * Testing what data we can pull for Kernel Kup tournaments
 */

const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
const STEAM_API_BASE = 'https://api.steampowered.com';

// Dota 2 App ID
const DOTA2_APP_ID = 570;

interface SteamAPITestResult {
  endpoint: string;
  success: boolean;
  data?: any;
  error?: string;
  notes?: string;
}

/**
 * Test all Steam API endpoints with real Kernel Kup 5 data
 */
export async function testAllSteamEndpoints(params: {
  leagueId: number;
  seriesId: number;
  matchId: number;
  teamId: number;
  playerId: number;
}): Promise<SteamAPITestResult[]> {
  const results: SteamAPITestResult[] = [];

  // 1. GetMatchDetails - Get detailed match data
  console.log('🔍 Testing GetMatchDetails...');
  try {
    const matchUrl = `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${params.matchId}`;
    const matchResponse = await fetch(matchUrl);
    const matchData = await matchResponse.json();
    
    results.push({
      endpoint: 'GetMatchDetails',
      success: matchResponse.ok,
      data: matchData,
      notes: 'Should return full match details including players, heroes, items, stats'
    });
  } catch (error) {
    results.push({
      endpoint: 'GetMatchDetails',
      success: false,
      error: String(error)
    });
  }

  // 2. GetLeagueListing - Get all available leagues
  console.log('🔍 Testing GetLeagueListing...');
  try {
    const leaguesUrl = `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetLeagueListing/v1/?key=${STEAM_API_KEY}`;
    const leaguesResponse = await fetch(leaguesUrl);
    const leaguesData = await leaguesResponse.json();
    
    // Try to find our specific league in the listing
    const ourLeague = leaguesData?.result?.leagues?.find((l: any) => l.leagueid === params.leagueId);
    
    results.push({
      endpoint: 'GetLeagueListing',
      success: leaguesResponse.ok,
      data: {
        totalLeagues: leaguesData?.result?.leagues?.length || 0,
        ourLeague: ourLeague || 'Not found in listing',
        sampleLeagues: leaguesData?.result?.leagues?.slice(0, 3) // Just show first 3
      },
      notes: 'Returns all active leagues. Check if Kernel Kup 5 appears here.'
    });
  } catch (error) {
    results.push({
      endpoint: 'GetLeagueListing',
      success: false,
      error: String(error)
    });
  }

  // 3. GetMatchHistory - Try to get league matches
  console.log('🔍 Testing GetMatchHistory with league filter...');
  try {
    const historyUrl = `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchHistory/v1/?key=${STEAM_API_KEY}&league_id=${params.leagueId}`;
    const historyResponse = await fetch(historyUrl);
    const historyData = await historyResponse.json();
    
    results.push({
      endpoint: 'GetMatchHistory (by league)',
      success: historyResponse.ok,
      data: historyData,
      notes: 'Should return all matches from League ID 16273'
    });
  } catch (error) {
    results.push({
      endpoint: 'GetMatchHistory (by league)',
      success: false,
      error: String(error)
    });
  }

  // 4. GetMatchHistory - Try with player account ID
  console.log('🔍 Testing GetMatchHistory with player filter...');
  try {
    const playerHistoryUrl = `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchHistory/v1/?key=${STEAM_API_KEY}&account_id=${params.playerId}`;
    const playerHistoryResponse = await fetch(playerHistoryUrl);
    const playerHistoryData = await playerHistoryResponse.json();
    
    results.push({
      endpoint: 'GetMatchHistory (by player)',
      success: playerHistoryResponse.ok,
      data: playerHistoryData,
      notes: 'Returns recent matches for Sneetch (108977424)'
    });
  } catch (error) {
    results.push({
      endpoint: 'GetMatchHistory (by player)',
      success: false,
      error: String(error)
    });
  }

  // 5. GetTeamInfoByTeamID - Get team data
  console.log('🔍 Testing GetTeamInfoByTeamID...');
  try {
    const teamUrl = `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetTeamInfoByTeamID/v1/?key=${STEAM_API_KEY}&start_at_team_id=${params.teamId}&teams_requested=1`;
    const teamResponse = await fetch(teamUrl);
    const teamData = await teamResponse.json();
    
    results.push({
      endpoint: 'GetTeamInfoByTeamID',
      success: teamResponse.ok,
      data: teamData,
      notes: 'Should return FOOP team info (Team ID 9359693)'
    });
  } catch (error) {
    results.push({
      endpoint: 'GetTeamInfoByTeamID',
      success: false,
      error: String(error)
    });
  }

  // 6. GetTournamentPlayerStats - Tournament-specific player stats
  console.log('🔍 Testing GetTournamentPlayerStats...');
  try {
    const tourneyStatsUrl = `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetTournamentPlayerStats/v2/?key=${STEAM_API_KEY}&league_id=${params.leagueId}&account_id=${params.playerId}`;
    const tourneyStatsResponse = await fetch(tourneyStatsUrl);
    const tourneyStatsData = await tourneyStatsResponse.json();
    
    results.push({
      endpoint: 'GetTournamentPlayerStats',
      success: tourneyStatsResponse.ok,
      data: tourneyStatsData,
      notes: 'Player stats specifically for Kernel Kup 5'
    });
  } catch (error) {
    results.push({
      endpoint: 'GetTournamentPlayerStats',
      success: false,
      error: String(error)
    });
  }

  // 7. GetLiveLeagueGames - Check for live games (probably none)
  console.log('🔍 Testing GetLiveLeagueGames...');
  try {
    const liveUrl = `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetLiveLeagueGames/v1/?key=${STEAM_API_KEY}&league_id=${params.leagueId}`;
    const liveResponse = await fetch(liveUrl);
    const liveData = await liveResponse.json();
    
    results.push({
      endpoint: 'GetLiveLeagueGames',
      success: liveResponse.ok,
      data: liveData,
      notes: 'Live games for this league (probably empty since it\'s past)'
    });
  } catch (error) {
    results.push({
      endpoint: 'GetLiveLeagueGames',
      success: false,
      error: String(error)
    });
  }

  return results;
}

/**
 * Get comprehensive league data if we can piece it together
 */
export async function getLeagueComprehensiveData(leagueId: number) {
  try {
    const data: any = {
      leagueId,
      leagueInfo: null,
      matches: [],
      teams: new Set(),
      players: new Set(),
      errors: []
    };

    // 1. Try to get league info from listing
    try {
      const leaguesUrl = `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetLeagueListing/v1/?key=${STEAM_API_KEY}`;
      const leaguesResponse = await fetch(leaguesUrl);
      const leaguesData = await leaguesResponse.json();
      data.leagueInfo = leaguesData?.result?.leagues?.find((l: any) => l.leagueid === leagueId);
    } catch (error) {
      data.errors.push(`GetLeagueListing failed: ${error}`);
    }

    // 2. Try to get match history for the league
    try {
      const historyUrl = `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchHistory/v1/?key=${STEAM_API_KEY}&league_id=${leagueId}&matches_requested=100`;
      const historyResponse = await fetch(historyUrl);
      const historyData = await historyResponse.json();
      
      if (historyData?.result?.matches) {
        data.matches = historyData.result.matches;
        
        // Extract teams and players from matches
        historyData.result.matches.forEach((match: any) => {
          match.players?.forEach((player: any) => {
            data.players.add(player.account_id);
          });
        });
      }
    } catch (error) {
      data.errors.push(`GetMatchHistory failed: ${error}`);
    }

    return data;
  } catch (error) {
    return { error: String(error) };
  }
}

/**
 * Check what OpenDota knows about this league
 */
export async function checkOpenDotaLeagueData(leagueId: number) {
  try {
    // OpenDota league endpoint
    const leagueUrl = `https://api.opendota.com/api/leagues/${leagueId}`;
    const leagueResponse = await fetch(leagueUrl);
    const leagueData = await leagueResponse.json();

    // OpenDota league matches endpoint
    const matchesUrl = `https://api.opendota.com/api/leagues/${leagueId}/matches`;
    const matchesResponse = await fetch(matchesUrl);
    const matchesData = await matchesResponse.json();

    // OpenDota league teams endpoint
    const teamsUrl = `https://api.opendota.com/api/leagues/${leagueId}/teams`;
    const teamsResponse = await fetch(teamsUrl);
    const teamsData = await teamsResponse.json();

    return {
      success: true,
      league: leagueData,
      matches: matchesData,
      teams: teamsData,
      notes: 'OpenDota may have more detailed data than Steam API'
    };
  } catch (error) {
    return {
      success: false,
      error: String(error)
    };
  }
}

/**
 * Compare Steam vs OpenDota for a specific match
 */
export async function compareSteamVsOpenDota(matchId: number) {
  const results: any = {
    matchId,
    timestamp: new Date().toISOString(),
    steam: {
      success: false,
      data: null,
      error: null
    },
    opendota: {
      success: false,
      data: null,
      error: null
    },
    comparison: {
      dataAvailability: {},
      recommendations: []
    }
  };

  // 1. Try Steam API - GetMatchDetails
  console.log('🔍 Fetching from Steam API...');
  try {
    const steamUrl = `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${matchId}`;
    const steamResponse = await fetch(steamUrl);
    const steamData = await steamResponse.json();
    
    results.steam.success = steamResponse.ok && steamData.result;
    results.steam.data = steamData;
    
    if (results.steam.success) {
      console.log('✅ Steam API returned match data');
    } else {
      results.steam.error = 'No match data in response';
      console.log('❌ Steam API did not return match data');
    }
  } catch (error) {
    results.steam.error = String(error);
    console.error('❌ Steam API error:', error);
  }

  // 2. Try OpenDota API - Match details
  console.log('🔍 Fetching from OpenDota API...');
  try {
    const openDotaUrl = `https://api.opendota.com/api/matches/${matchId}`;
    const openDotaResponse = await fetch(openDotaUrl);
    const openDotaData = await openDotaResponse.json();
    
    results.opendota.success = openDotaResponse.ok && !openDotaData.error;
    results.opendota.data = openDotaData;
    
    if (results.opendota.success) {
      console.log('✅ OpenDota API returned match data');
    } else {
      results.opendota.error = openDotaData.error || 'No match data in response';
      console.log('❌ OpenDota API did not return match data');
    }
  } catch (error) {
    results.opendota.error = String(error);
    console.error('❌ OpenDota API error:', error);
  }

  // 3. Compare what data each API provides
  results.comparison.dataAvailability = {
    steam: {
      basicMatchInfo: !!results.steam.data?.result?.match_id,
      players: !!results.steam.data?.result?.players,
      heroes: !!results.steam.data?.result?.players?.[0]?.hero_id,
      items: !!results.steam.data?.result?.players?.[0]?.item_0,
      kills: !!results.steam.data?.result?.players?.[0]?.kills,
      winner: results.steam.data?.result?.radiant_win !== undefined,
      duration: !!results.steam.data?.result?.duration,
      leagueId: !!results.steam.data?.result?.leagueid
    },
    opendota: {
      basicMatchInfo: !!results.opendota.data?.match_id,
      players: !!results.opendota.data?.players,
      heroes: !!results.opendota.data?.players?.[0]?.hero_id,
      items: !!results.opendota.data?.players?.[0]?.item_0,
      kills: !!results.opendota.data?.players?.[0]?.kills,
      winner: results.opendota.data?.radiant_win !== undefined,
      duration: !!results.opendota.data?.duration,
      leagueId: !!results.opendota.data?.leagueid,
      // OpenDota extras
      detailedStats: !!results.opendota.data?.players?.[0]?.gold_per_min,
      itemTimings: !!results.opendota.data?.players?.[0]?.purchase_log,
      objectives: !!results.opendota.data?.objectives,
      teamfights: !!results.opendota.data?.teamfights,
      parsedData: !!results.opendota.data?.version,
      playerNames: !!results.opendota.data?.players?.[0]?.personaname
    }
  };

  // 4. Generate recommendations
  if (results.steam.success && results.opendota.success) {
    results.comparison.recommendations.push('✅ Both APIs work! Use Steam for verification, OpenDota for detailed stats');
    results.comparison.recommendations.push('🎯 Steam: League ID, Team IDs, Basic match info');
    results.comparison.recommendations.push('📊 OpenDota: Player stats, GPM/XPM, item builds, timelines');
  } else if (results.steam.success && !results.opendota.success) {
    results.comparison.recommendations.push('⚠️ Only Steam API works - may be limited data');
    results.comparison.recommendations.push('💡 Consider using Steam GetMatchHistory for league data');
  } else if (!results.steam.success && results.opendota.success) {
    results.comparison.recommendations.push('✅ OpenDota works but Steam failed');
    results.comparison.recommendations.push('💡 Use OpenDota for all data - has league_id and team info');
  } else {
    results.comparison.recommendations.push('❌ Neither API returned data for this match');
    results.comparison.recommendations.push('💡 Match may be too old or not in public databases');
  }

  return results;
}
