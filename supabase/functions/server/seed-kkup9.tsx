import { createClient } from "jsr:@supabase/supabase-js@2";
import { findOrCreatePlayer } from "./kkup-helpers.tsx";

/**
 * 🎣 KERNEL KUP 9: "HEAPS N' HOOKS" - 1v1 PUDGE TOURNAMENT
 * Date: July 3, 2025
 * Format: Single elimination, Best-of-3 series
 * 8 Players competing individually (repping team banners)
 * 
 * TEAM STRUCTURE FOR HEAPS N' HOOKS:
 * - name = Team banner name (e.g., "Team Mavi", "Elliott Jewelers")
 * - tag = Player name who is competing (e.g., "Mavi", "Bojangles")
 * - valve_team_id = The actual Valve Dota team ID for that team
 * 
 * CHAMPION: Bojangles (Elliott Jewelers) - Won finals 2-1 vs Mavi
 */

export async function seedKKup9(supabase: any, anonSupabase: any, authUser: any) {
  console.log('🎣 ============================================');
  console.log('🎣 SEEDING KERNEL KUP 9 "HEAPS N\' HOOKS"');
  console.log('🎣 ============================================');

  try {
    // Step 1: Create tournament
    console.log('📅 Creating tournament...');
    const { data: tournament, error: tournamentError } = await supabase
      .from('kernel_kups')
      .insert({
        name: 'Kernel Kup 9',
        description: 'Heaps n\' Hooks - The inaugural 1v1 Pudge tournament - 8 competitors battle for individual glory while repping their team banners!',
        tournament_start_date: '2025-07-03',
        tournament_end_date: '2025-07-03',
        status: 'completed',
        youtube_playlist_url: 'https://youtu.be/6PSUxXCszu0?si=MRRqG58Uc78_N-eO',
        league_id: null,
        series_id: null,
        prize_pool: null,
        is_manual: true,
      })
      .select()
      .single();

    if (tournamentError) throw new Error(`Failed to create tournament: ${tournamentError.message}`);
    console.log(`✅ Tournament created: ${tournament.name} (ID: ${tournament.id})\n`);

    // Step 2: Define all players with their team representation
    // Each player competes 1v1 but represents their team banner
    const players = [
      { account_id: 237313649, name: 'Mavi', team_name: 'Team Mavi', valve_team_id: 9824963 },
      { account_id: 12096575, name: 'Bojangles', team_name: 'Elliott Jewelers', valve_team_id: 9504598 },
      { account_id: 32846586, name: 'Dr Clayton', team_name: 'Fear The Hog', valve_team_id: 9073373 },
      { account_id: 20413194, name: '.4leks...', team_name: 'Tiny Corn Energy', valve_team_id: 99999993 },
      { account_id: 208895278, name: 'businessCasual', team_name: 'Nebraska Cornhuskers', valve_team_id: 9658549 },
      { account_id: 42336030, name: 'Pr1de', team_name: 'Tiny Corn Energy', valve_team_id: 99999993 },
      { account_id: 71794697, name: 'Z.T. Pastamancer', team_name: 'Isiah From The News', valve_team_id: 9432594 },
      { account_id: 74713349, name: 'Vriggchan', team_name: 'Eat Booty O\'s', valve_team_id: 9239539 },
    ];

    // Step 3: Create/find player profiles
    console.log('👥 Creating player profiles...');
    const playerMap = new Map<number, string>(); // account_id -> player_profile_id
    const playerNameMap = new Map<number, string>(); // account_id -> name

    for (const player of players) {
      const playerId = await findOrCreatePlayer(supabase, player.account_id, player.name);
      playerMap.set(player.account_id, playerId);
      playerNameMap.set(player.account_id, player.name);
      console.log(`   ✅ ${player.name} (ID: ${playerId})`);
    }
    console.log(`\n✅ ${players.length} player profiles ready\n`);

    // Step 4: Helper function to find existing team logo by valve_team_id
    const findExistingTeamLogo = async (valveTeamId: number | null): Promise<string | null> => {
      if (!valveTeamId) return null;
      
      const { data: existingTeam } = await supabase
        .from('kkup_teams')
        .select('logo_url')
        .eq('valve_team_id', valveTeamId)
        .not('logo_url', 'is', null)
        .limit(1)
        .single();
      
      return existingTeam?.logo_url || null;
    };

    // Step 5: Create "solo teams" for each player (1v1 format)
    // name = Team banner, tag = Player name, valve_team_id = Team ID
    console.log('🏆 Creating solo teams for tournament...');
    const kkupTeams = new Map<number, string>(); // account_id -> kkup_teams.id

    for (const player of players) {
      // Check if this team already exists in the database and grab its logo
      const existingLogo = await findExistingTeamLogo(player.valve_team_id);
      
      const { data: team, error: teamError } = await supabase
        .from('kkup_teams')
        .insert({
          kernel_kup_id: tournament.id,
          name: player.team_name,                    // Team banner name
          tag: player.name,                          // Player competing
          valve_team_id: null,                       // NULL for 1v1 - each player is their own "team"
          logo_url: existingLogo,                    // Copy logo from existing team if found
        })
        .select()
        .single();

      if (teamError) throw new Error(`Failed to create team for ${player.name}: ${teamError.message}`);
      
      const logoStatus = existingLogo ? `✨ Logo copied from existing team` : `No logo found`;
      console.log(`   ✅ ${player.name} repping ${player.team_name} (Valve ID: ${player.valve_team_id}) - ${logoStatus}`);
      kkupTeams.set(player.account_id, team.id);

      // Link player to their solo team
      const { error: linkError } = await supabase.from('kkup_team_players').insert({
        team_id: team.id,
        player_profile_id: playerMap.get(player.account_id),
      });

      if (linkError) throw new Error(`Failed to link player ${player.name} to team: ${linkError.message}`);
    }
    console.log('\n✅ All solo teams created\n');

    // Step 6: Create matches with stats
    console.log('⚔️ Creating matches...');
    
    const matchData = [
      // Match 1: Dr Clayton 2-0 Vriggchan (Series 1, Game 1)
      {
        series_number: 1,
        game_number: 1,
        team1_account: 32846586,
        team2_account: 74713349,
        winner_account: 32846586,
        duration: 663,
        match_date: '2025-07-03',
        stats: [
          { account: 32846586, hero: 14, k: 2, d: 0, a: 0, lh: 58, dn: 16, gpm: 387, xpm: 603, hero_dmg: 1999, tower_dmg: 0, healing: 0 },
          { account: 74713349, hero: 14, k: 0, d: 2, a: 0, lh: 34, dn: 5, gpm: 219, xpm: 422, hero_dmg: 3499, tower_dmg: 0, healing: 0 },
        ]
      },
      // Match 2: .4leks... 2-0 Z.T. Pastamancer (Series 2, Game 1)
      {
        series_number: 2,
        game_number: 1,
        team1_account: 20413194,
        team2_account: 71794697,
        winner_account: 20413194,
        duration: 406,
        match_date: '2025-07-03',
        stats: [
          { account: 20413194, hero: 14, k: 2, d: 0, a: 0, lh: 33, dn: 16, gpm: 387, xpm: 550, hero_dmg: 4079, tower_dmg: 0, healing: 0 },
          { account: 71794697, hero: 14, k: 0, d: 2, a: 0, lh: 22, dn: 8, gpm: 218, xpm: 354, hero_dmg: 1215, tower_dmg: 0, healing: 0 },
        ]
      },
      // Match 3: businessCasual 2-1 Pr1de (Series 3, Game 1)
      {
        series_number: 3,
        game_number: 1,
        team1_account: 42336030,
        team2_account: 208895278,
        winner_account: 208895278,
        duration: 356,
        match_date: '2025-07-03',
        stats: [
          { account: 42336030, hero: 14, k: 1, d: 2, a: 0, lh: 27, dn: 12, gpm: 329, xpm: 400, hero_dmg: 2826, tower_dmg: 0, healing: 0 },
          { account: 208895278, hero: 14, k: 2, d: 1, a: 0, lh: 20, dn: 3, gpm: 336, xpm: 494, hero_dmg: 2509, tower_dmg: 0, healing: 0 },
        ]
      },
      // Match 4: Bojangles 2-1 Z.T. Pastamancer (Series 4, Game 1)
      {
        series_number: 4,
        game_number: 1,
        team1_account: 12096575,
        team2_account: 71794697,
        winner_account: 12096575,
        duration: 399,
        match_date: '2025-07-03',
        stats: [
          { account: 12096575, hero: 14, k: 2, d: 1, a: 0, lh: 34, dn: 6, gpm: 418, xpm: 571, hero_dmg: 4069, tower_dmg: 0, healing: 0 },
          { account: 71794697, hero: 14, k: 1, d: 2, a: 0, lh: 31, dn: 7, gpm: 353, xpm: 426, hero_dmg: 2077, tower_dmg: 0, healing: 0 },
        ]
      },
      // Match 5: Mavi 2-0 Dr Clayton (Series 5, Game 1)
      {
        series_number: 5,
        game_number: 1,
        team1_account: 237313649,
        team2_account: 32846586,
        winner_account: 237313649,
        duration: 166,
        match_date: '2025-07-03',
        stats: [
          { account: 237313649, hero: 14, k: 2, d: 0, a: 0, lh: 8, dn: 2, gpm: 407, xpm: 542, hero_dmg: 1798, tower_dmg: 0, healing: 0 },
          { account: 32846586, hero: 14, k: 0, d: 2, a: 0, lh: 8, dn: 4, gpm: 201, xpm: 365, hero_dmg: 346, tower_dmg: 0, healing: 0 },
        ]
      },
      // Match 6: Mavi 2-0 .4leks... (Series 6, Game 1)
      {
        series_number: 6,
        game_number: 1,
        team1_account: 20413194,
        team2_account: 237313649,
        winner_account: 237313649,
        duration: 418,
        match_date: '2025-07-03',
        stats: [
          { account: 20413194, hero: 14, k: 0, d: 2, a: 0, lh: 27, dn: 12, gpm: 263, xpm: 423, hero_dmg: 2062, tower_dmg: 0, healing: 0 },
          { account: 237313649, hero: 14, k: 2, d: 0, a: 0, lh: 33, dn: 8, gpm: 394, xpm: 514, hero_dmg: 3804, tower_dmg: 0, healing: 0 },
        ]
      },
      // Match 7: Bojangles 2-0 businessCasual (Series 7, Game 1)
      {
        series_number: 7,
        game_number: 1,
        team1_account: 12096575,
        team2_account: 208895278,
        winner_account: 12096575,
        duration: 423,
        match_date: '2025-07-03',
        stats: [
          { account: 12096575, hero: 14, k: 2, d: 0, a: 0, lh: 38, dn: 9, gpm: 425, xpm: 591, hero_dmg: 4521, tower_dmg: 0, healing: 0 },
          { account: 208895278, hero: 14, k: 0, d: 2, a: 0, lh: 21, dn: 3, gpm: 217, xpm: 327, hero_dmg: 1734, tower_dmg: 0, healing: 0 },
        ]
      },
      // Match 8: Mavi wins game 1 of Finals (Series 8, Game 1)
      {
        series_number: 8,
        game_number: 1,
        team1_account: 12096575,
        team2_account: 237313649,
        winner_account: 237313649,
        duration: 216,
        match_date: '2025-07-03',
        stats: [
          { account: 12096575, hero: 14, k: 1, d: 2, a: 0, lh: 16, dn: 7, gpm: 355, xpm: 417, hero_dmg: 2523, tower_dmg: 0, healing: 0 },
          { account: 237313649, hero: 14, k: 2, d: 1, a: 0, lh: 14, dn: 5, gpm: 394, xpm: 495, hero_dmg: 1892, tower_dmg: 0, healing: 0 },
        ]
      },
      // Match 9: Bojangles wins game 2 of Finals (Series 8, Game 2)
      {
        series_number: 8,
        game_number: 2,
        team1_account: 237313649,
        team2_account: 12096575,
        winner_account: 12096575,
        duration: 222,
        match_date: '2025-07-03',
        stats: [
          { account: 237313649, hero: 14, k: 0, d: 2, a: 0, lh: 12, dn: 1, gpm: 219, xpm: 355, hero_dmg: 1799, tower_dmg: 0, healing: 0 },
          { account: 12096575, hero: 14, k: 2, d: 0, a: 0, lh: 18, dn: 5, gpm: 431, xpm: 536, hero_dmg: 2499, tower_dmg: 0, healing: 0 },
        ]
      },
      // Match 10: Bojangles wins game 3 of Finals (Series 8, Game 3)
      {
        series_number: 8,
        game_number: 3,
        team1_account: 12096575,
        team2_account: 237313649,
        winner_account: 12096575,
        duration: 268,
        match_date: '2025-07-03',
        stats: [
          { account: 12096575, hero: 14, k: 2, d: 1, a: 0, lh: 17, dn: 5, gpm: 360, xpm: 464, hero_dmg: 2000, tower_dmg: 0, healing: 0 },
          { account: 237313649, hero: 14, k: 1, d: 2, a: 0, lh: 11, dn: 2, gpm: 270, xpm: 460, hero_dmg: 2568, tower_dmg: 0, healing: 0 },
        ]
      },
    ];

    let matchCount = 0;
    for (const match of matchData) {
      matchCount++;
      const { data: newMatch, error: matchError } = await supabase
        .from('kkup_matches')
        .insert({
          kernel_kup_id: tournament.id,
          team1_id: kkupTeams.get(match.team1_account),
          team2_id: kkupTeams.get(match.team2_account),
          winner_team_id: kkupTeams.get(match.winner_account),
          scheduled_time: `${match.match_date}T18:00:00Z`,
          duration: match.duration,
          match_number: null,
          series_id: match.series_number,
          match_id: null, // No OpenDota match ID
          stage: 'group_stage',
          status: 'completed',
        })
        .select()
        .single();

      if (matchError) throw new Error(`Failed to create match ${matchCount}: ${matchError.message}`);

      // Insert player stats for this match
      for (const stat of match.stats) {
        const winnerAccountId = match.winner_account;
        const isWinner = stat.account === winnerAccountId;

        const { error: statsError } = await supabase.from('kkup_match_player_stats').insert({
          match_id: newMatch.id,
          player_profile_id: playerMap.get(stat.account),
          team_id: kkupTeams.get(stat.account),
          player_name: playerNameMap.get(stat.account) || 'Unknown',
          steam_id: stat.account,
          hero_id: stat.hero,
          hero_name: 'Pudge',
          kills: stat.k,
          deaths: stat.d,
          assists: stat.a,
          last_hits: stat.lh,
          denies: stat.dn,
          gpm: stat.gpm,
          xpm: stat.xpm,
          level: null,
          net_worth: null,
          gold: null,
          hero_damage: stat.hero_dmg,
          tower_damage: stat.tower_dmg,
          hero_healing: stat.healing,
          item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
          is_winner: isWinner,
        });

        if (statsError) throw new Error(`Failed to insert stats for player ${stat.account} in match ${matchCount}: ${statsError.message}`);
      }

      console.log(`   ✅ Match ${match.series_number}-${match.game_number} created with stats`);
    }

    // Step 7: Update team standings (wins/losses)
    console.log('\n📊 Updating team standings...');
    for (const [accountId, teamId] of kkupTeams.entries()) {
      // Count wins for this team
      const { count: winCount } = await supabase
        .from('kkup_matches')
        .select('*', { count: 'exact', head: true })
        .eq('kernel_kup_id', tournament.id)
        .eq('winner_team_id', teamId);

      // Count total matches involving this team
      const { data: teamMatches } = await supabase
        .from('kkup_matches')
        .select('id')
        .eq('kernel_kup_id', tournament.id)
        .or(`team1_id.eq.${teamId},team2_id.eq.${teamId}`);

      const totalMatches = teamMatches?.length || 0;
      const wins = winCount || 0;
      const losses = totalMatches - wins;

      // Update the team record
      await supabase
        .from('kkup_teams')
        .update({ wins, losses })
        .eq('id', teamId);

      const playerName = playerNameMap.get(accountId);
      console.log(`   ✅ ${playerName}: ${wins}-${losses}`);
    }

    console.log('\n🎉 ============================================');
    console.log('🎉 KERNEL KUP 9 SEEDING COMPLETE!');
    console.log('🎉 ============================================');
    console.log('🏆 Champion: Bojangles (Elliott Jewelers)');
    console.log('🥈 Runner-up: Mavi (Team Mavi)');
    console.log('⚠️  Remember to manually award Championship and Pop\'d Kernel via Admin Tools!\n');
    
    return { 
      success: true, 
      tournament,
      message: 'Kernel Kup 9 "Heaps n\' Hooks" seeded successfully! 🎣'
    };
  } catch (error) {
    console.error('❌ Seeding error:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}