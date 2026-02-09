import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Calculate aggregate stats for a player filtered by specific tournament IDs
 */
export async function calculatePlayerStats(player: any, tournamentIds: string[], championshipAwards: any[], popdKernelAwards: any[]) {
  // Get total tournaments participated
  const { data: teamParticipations } = await supabase
    .from('kkup_team_players')
    .select('team_id')
    .eq('player_profile_id', player.id);

  const uniqueTeamIds = [...new Set(teamParticipations?.map(tp => tp.team_id) || [])];
  
  if (uniqueTeamIds.length === 0 || tournamentIds.length === 0) {
    // Player has no data for this tournament type
    return null;
  }

  const { data: teams } = await supabase
    .from('kkup_teams')
    .select('kernel_kup_id')
    .in('id', uniqueTeamIds)
    .in('kernel_kup_id', tournamentIds);

  const tournamentsFromTeams = new Set(teams?.map(t => t.kernel_kup_id) || []);

  // Get aggregate match stats
  const { data: matchStats } = await supabase
    .from('kkup_match_player_stats')
    .select('kills, deaths, assists, hero_damage, tower_damage, hero_healing, last_hits, denies, gpm, xpm, hero_id, hero_name, is_winner, match_id')
    .eq('player_profile_id', player.id);

  // Filter matchStats to only include matches from the specified tournaments
  const { data: matchesInTournaments } = await supabase
    .from('kkup_matches')
    .select('id')
    .in('kernel_kup_id', tournamentIds);

  const matchIdsInTournaments = new Set(matchesInTournaments?.map(m => m.id) || []);
  const filteredMatchStats = matchStats?.filter(s => matchIdsInTournaments.has(s.match_id)) || [];

  if (filteredMatchStats.length === 0) {
    return null;
  }

  // Calculate aggregate stats - count UNIQUE matches, not player stats records
  const uniqueMatchIds = [...new Set(filteredMatchStats.map(s => s.match_id))];
  const totalMatches = uniqueMatchIds.length;

  // Also get tournaments from match data to ensure we don't miss any
  const { data: matches } = await supabase
    .from('kkup_matches')
    .select('kernel_kup_id')
    .in('id', uniqueMatchIds);

  const tournamentsFromMatches = new Set(matches?.map(m => m.kernel_kup_id) || []);

  // Combine both sources (teams + matches) to get complete tournament list
  const allTournaments = new Set([...tournamentsFromTeams, ...tournamentsFromMatches]);
  const totalTournaments = allTournaments.size;

  const totalKills = filteredMatchStats.reduce((sum, s) => sum + (s.kills || 0), 0);
  const totalDeaths = filteredMatchStats.reduce((sum, s) => sum + (s.deaths || 0), 0);
  const totalAssists = filteredMatchStats.reduce((sum, s) => sum + (s.assists || 0), 0);
  const totalLastHits = filteredMatchStats.reduce((sum, s) => sum + (s.last_hits || 0), 0);
  const totalDenies = filteredMatchStats.reduce((sum, s) => sum + (s.denies || 0), 0);
  const avgKDA = totalDeaths > 0 ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : totalKills + totalAssists;
  const avgGPM = totalMatches > 0 ? (filteredMatchStats.reduce((sum, s) => sum + (s.gpm || 0), 0) / totalMatches).toFixed(0) : '0';
  const avgXPM = totalMatches > 0 ? (filteredMatchStats.reduce((sum, s) => sum + (s.xpm || 0), 0) / totalMatches).toFixed(0) : '0';
  const totalHeroDamage = filteredMatchStats.reduce((sum, s) => sum + (s.hero_damage || 0), 0);
  const totalTowerDamage = filteredMatchStats.reduce((sum, s) => sum + (s.tower_damage || 0), 0);
  const totalHealing = filteredMatchStats.reduce((sum, s) => sum + (s.hero_healing || 0), 0);

  // 🎮 HERO STATS - Calculate signature hero and hero pool
  const heroMap: Record<number, { name: string; games: number; wins: number }> = {};
  filteredMatchStats.forEach(stat => {
    if (stat.hero_id) {
      if (!heroMap[stat.hero_id]) {
        heroMap[stat.hero_id] = { name: stat.hero_name, games: 0, wins: 0 };
      }
      heroMap[stat.hero_id].games++;
      if (stat.is_winner) heroMap[stat.hero_id].wins++;
    }
  });

  const heroList = Object.entries(heroMap).map(([id, data]) => ({
    hero_id: parseInt(id),
    hero_name: data.name,
    games: data.games,
    wins: data.wins,
    winrate: data.games > 0 ? ((data.wins / data.games) * 100).toFixed(1) : '0.0'
  })).sort((a, b) => b.games - a.games);

  const signatureHero = heroList[0] || null;

  // 🏆 SINGLE GAME RECORDS
  const bestKills = filteredMatchStats.reduce((max, s) => Math.max(max, s.kills || 0), 0);
  const bestGPM = filteredMatchStats.reduce((max, s) => Math.max(max, s.gpm || 0), 0);
  const bestXPM = filteredMatchStats.reduce((max, s) => Math.max(max, s.xpm || 0), 0);
  const bestHeroDamage = filteredMatchStats.reduce((max, s) => Math.max(max, s.hero_damage || 0), 0);
  const bestTowerDamage = filteredMatchStats.reduce((max, s) => Math.max(max, s.tower_damage || 0), 0);
  const bestHealing = filteredMatchStats.reduce((max, s) => Math.max(max, s.hero_healing || 0), 0);

  // Calculate wins
  const totalWins = filteredMatchStats.filter(s => s.is_winner).length;
  const totalLosses = totalMatches - totalWins;
  const winrate = totalMatches > 0 ? ((totalWins / totalMatches) * 100).toFixed(1) : '0.0';

  // Calculate championships - count how many times this player was on a championship team in these tournaments
  let championships = 0;
  for (const award of championshipAwards) {
    // Check if award is from a tournament in our filter
    const awardKKupId = award.key.split(':')[1]; // Extract kkup_id from key
    if (!tournamentIds.includes(awardKKupId)) continue;

    // Get all players on the championship team
    const { data: teamPlayers } = await supabase
      .from('kkup_team_players')
      .select('player_profile_id')
      .eq('team_id', award.team_id);
    
    if (teamPlayers?.some(tp => tp.player_profile_id === player.id)) {
      championships++;
    }
  }

  // Calculate Pop'd Kernel awards - count how many times this player won Pop'd Kernel in these tournaments
  let mvps = 0;
  for (const award of popdKernelAwards) {
    const awardKKupId = award.key.split(':')[1]; // Extract kkup_id from key
    if (!tournamentIds.includes(awardKKupId)) continue;
    if (award.player_id === player.id) {
      mvps++;
    }
  }

  return {
    totalTournaments,
    totalMatches,
    totalWins,
    totalLosses,
    wins: totalWins, // Add alias for backward compat
    losses: totalLosses, // Add alias for backward compat
    winrate,
    totalKills,
    totalDeaths,
    totalAssists,
    totalLastHits,
    totalDenies,
    avgKDA,
    avgGPM,
    avgXPM,
    totalHeroDamage,
    totalTowerDamage,
    totalHealing,
    championships,
    mvps,
    // Hero stats
    signatureHero,
    heroPool: heroList.length,
    topHeroes: heroList.slice(0, 5), // Top 5 most played heroes
    // Single game records
    records: {
      bestKills,
      bestGPM,
      bestXPM,
      bestHeroDamage,
      bestTowerDamage,
      bestHealing,
    }
  };
}

/**
 * Calculate team stats for specific tournaments
 */
export async function calculateTeamStats(tournamentIds: string[], championshipAwards: any[], popdKernelAwards: any[]) {
  // Return early if no tournaments specified
  if (!tournamentIds || tournamentIds.length === 0) {
    console.log('⚠️ No tournament IDs provided to calculateTeamStats');
    return [];
  }

  console.log(`📊 Calculating team stats for ${tournamentIds.length} tournaments:`, tournamentIds);

  // 🔥 FIX: Only fetch teams that belong to the specified tournaments
  const { data: allTeams, error: teamsError } = await supabase
    .from('kkup_teams')
    .select('*')
    .in('kernel_kup_id', tournamentIds);  // ← Filter teams by tournament IDs

  if (teamsError) {
    console.error('❌ Fetch teams error:', teamsError);
    return [];
  }

  console.log(`✅ Found ${allTeams?.length || 0} teams in specified tournaments`);

  const teamStats = await Promise.all(allTeams.map(async (team) => {
    // Get all matches this team participated in for the specified tournaments
    const { data: teamMatches } = await supabase
      .from('kkup_matches')
      .select('id, team1_id, team2_id, winner_team_id, kernel_kup_id')
      .or(`team1_id.eq.${team.id},team2_id.eq.${team.id}`)
      .in('kernel_kup_id', tournamentIds);

    const totalMatches = teamMatches?.length || 0;
    const totalWins = teamMatches?.filter(m => m.winner_team_id === team.id).length || 0;
    const totalLosses = totalMatches - totalWins;
    const winRate = totalMatches > 0 ? ((totalWins / totalMatches) * 100).toFixed(1) : '0.0';

    // Get tournaments this team participated in
    const uniqueTournaments = new Set(teamMatches?.map(m => m.kernel_kup_id) || []);
    const tournamentsPlayed = uniqueTournaments.size;

    // Get all player stats for this team
    const matchIds = teamMatches?.map(m => m.id) || [];
    const { data: teamPlayerStats } = await supabase
      .from('kkup_match_player_stats')
      .select('kills, deaths, assists, gpm, xpm, match_id, player_profile_id')
      .in('match_id', matchIds);

    // Get unique players who've played for this team
    const { data: teamPlayers } = await supabase
      .from('kkup_team_players')
      .select('player_profile_id')
      .eq('team_id', team.id);

    const uniquePlayerIds = new Set(teamPlayers?.map(tp => tp.player_profile_id) || []);

    // Filter stats to only include players who are on this team
    const relevantStats = teamPlayerStats?.filter(stat => 
      uniquePlayerIds.has(stat.player_profile_id)
    ) || [];

    const totalKills = relevantStats.reduce((sum, s) => sum + (s.kills || 0), 0);
    const totalDeaths = relevantStats.reduce((sum, s) => sum + (s.deaths || 0), 0);
    const totalAssists = relevantStats.reduce((sum, s) => sum + (s.assists || 0), 0);
    const kda = totalDeaths > 0 ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : totalKills + totalAssists;
    
    // For averages, divide by total matches (not total stats records)
    const avgKills = totalMatches > 0 ? (totalKills / totalMatches).toFixed(1) : '0.0';
    const avgDeaths = totalMatches > 0 ? (totalDeaths / totalMatches).toFixed(1) : '0.0';
    const avgAssists = totalMatches > 0 ? (totalAssists / totalMatches).toFixed(1) : '0.0';
    const avgGPM = relevantStats.length > 0 ? (relevantStats.reduce((sum, s) => sum + (s.gpm || 0), 0) / relevantStats.length).toFixed(0) : '0';
    const avgXPM = relevantStats.length > 0 ? (relevantStats.reduce((sum, s) => sum + (s.xpm || 0), 0) / relevantStats.length).toFixed(0) : '0';

    // Count championships won by this team (only from the specified tournaments)
    const teamChampionships = championshipAwards.filter(award => {
      // Extract kkup_id from key (format: "kkup_championship:kkup_id")
      const awardKKupId = award.key.split(':')[1];
      return award.team_id === team.id && tournamentIds.includes(awardKKupId);
    }).length;

    // Count Pop'd Kernels won by players on this team (only from the specified tournaments)
    let teamPopdKernels = 0;
    for (const award of popdKernelAwards) {
      // Extract kkup_id from key (format: "kkup_popdkernel:kkup_id")
      const awardKKupId = award.key.split(':')[1];
      if (!tournamentIds.includes(awardKKupId)) continue;
      
      const { data: awardPlayerTeam } = await supabase
        .from('kkup_team_players')
        .select('team_id')
        .eq('player_profile_id', award.player_id)
        .eq('team_id', team.id)
        .limit(1);
      
      if (awardPlayerTeam && awardPlayerTeam.length > 0) {
        teamPopdKernels++;
      }
    }

    return {
      id: team.id,
      name: team.name,
      tag: team.tag,
      logo_url: team.logo_url,
      championships: teamChampionships,
      popdKernels: teamPopdKernels,
      tournamentsPlayed,
      totalMatches,
      totalWins,
      totalLosses,
      winRate,
      totalKills,
      totalDeaths,
      totalAssists,
      kda,
      avgKills,
      avgDeaths,
      avgAssists,
      avgGPM,
      avgXPM,
    };
  }));

  // Sort teams by championships first, then by win rate
  teamStats.sort((a, b) => {
    if (b.championships !== a.championships) return b.championships - a.championships;
    return parseFloat(b.winRate) - parseFloat(a.winRate);
  });

  // Filter out teams with zero matches in the specified tournaments
  return teamStats.filter(team => team.totalMatches > 0);
}