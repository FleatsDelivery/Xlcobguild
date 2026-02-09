import { createClient } from "jsr:@supabase/supabase-js@2";
import { findOrCreatePlayer, findOrCreateTeam } from "./kkup-helpers.tsx";

/**
 * 🌽 KERNEL KUP 3 SEED DATA
 * Tournament Date: December 1, 2023
 * Teams: Staff Infection, EAFD, Mutha Shuckas, CA$HFLOW
 * Championship: EAFD (won finals 2-0 over Mutha Shuckas)
 * YouTube: https://youtu.be/aLZYOv48xXI?si=uwejUwljAG2AyxoD
 */

export async function seedKernelKup3(supabase: any, anonSupabase: any, authUser: any) {
  console.log('🌽 ============================================');
  console.log('🌽 SEEDING KERNEL KUP 3 DATA');
  console.log('🌽 ============================================');

  const playerMap = new Map<number, string>(); // account_id -> kkup_players.id
  const teamMap = new Map<number, string>(); // team_id -> kkup_teams.id
  const playerNameMap = new Map<number, string>(); // account_id -> player_name

  // Helper to get hero ID by name
  const getHeroId = (heroName: string): number | null => {
    const heroMapping: Record<string, number> = {
      // Auto-correct typo
      "Nature's Prohpet": 53,
      "Nature's Prophet": 53,
      // KK3 Heroes
      'Viper': 47, 'Gyrocopter': 72, 'Chaos Knight': 81, 'Jakiro': 64, 'Ember Spirit': 106,
      'Lich': 31, 'Grimstroke': 121, 'Wraith King': 7, 'Weaver': 63, 'Kunkka': 23,
      'Skywrath Mage': 79, 'Razor': 15, 'Spirit Breaker': 71, 'Oracle': 111, 'Pangolier': 120,
      'Venomancer': 40, 'Pugna': 45, 'Sven': 18, 'Slardar': 28,
      'Crystal Maiden': 5, 'Phoenix': 110, 'Phantom Lancer': 12,
      'Treant Protector': 83, 'Centaur Warrunner': 96, 'Queen Of Pain': 39,
      'Sand King': 16, 'Spectre': 67, 'Rubick': 86, 'Storm Spirit': 17, 'Invoker': 74,
      'Dawnbreaker': 135, 'Muerta': 138, 'Zeus': 22, 'Drow Ranger': 6,
      'Clockwerk': 51, 'Shadow Shaman': 27, 'Primal Beast': 137, 'Bloodseeker': 4,
      'Lifestealer': 54, 'Night Stalker': 60, 'Techies': 105, 'Phantom Assassin': 44,
      'Bristleback': 99, 'Witch Doctor': 30
    };
    return heroMapping[heroName] || null;
  };

  // Create the tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from('kernel_kups')
    .insert({
      name: 'Kernel Kup 3',
      league_id: null,
      series_id: null,
      tournament_start_date: '2023-12-01',
      tournament_end_date: '2023-12-02',
      description: 'The third annual Corn Field Dota 2 Championship',
      youtube_playlist_url: 'https://youtu.be/aLZYOv48xXI?si=uwejUwljAG2AyxoD',
      prize_pool: null,
      status: 'completed',
      is_manual: true,
    })
    .select()
    .single();

  if (tournamentError || !tournament) {
    throw new Error('Failed to create tournament: ' + tournamentError?.message);
  }

  console.log(`✅ Tournament created: ${tournament.name} (ID: ${tournament.id})`);

  const kkupId = tournament.id;

  // Team Data
  const teams = [
    { valve_team_id: null, name: 'Staff Infection', tag: null, logo: null },
    { valve_team_id: 9239539, name: 'EAFD', tag: null, logo: null },
    { valve_team_id: 9400971, name: 'Mutha Shuckas', tag: null, logo: null },
    { valve_team_id: null, name: 'CA$HFLOW', tag: null, logo: null },
  ];

  // Create teams
  for (const teamData of teams) {
    const teamId = await findOrCreateTeam(supabase, kkupId, teamData.valve_team_id, teamData.name, teamData.tag, teamData.logo);
    if (teamData.valve_team_id) {
      teamMap.set(teamData.valve_team_id, teamId);
    }
    // Also map by name for teams without valve IDs
    teamMap.set(teamData.name as any, teamId);
  }

  console.log(`✅ All ${teams.length} teams processed`);

  // Player Data (account_id, name) - Using final names as per user's recommendation
  const players = [
    // Staff Infection
    { account_id: 32846586, name: 'Dr Clayton' },
    { account_id: 208895278, name: 'Stainless' },
    { account_id: 57751419, name: 'RAMPAGE' },
    { account_id: 162920467, name: 'EsKetIt!!' },
    { account_id: 176598507, name: 'businessCasual' }, // Changed to Moumpt later
    { account_id: 31649623, name: 'Moumpt' }, // This is the actual final player
    // EAFD
    { account_id: 66953342, name: 'A_dam' },
    { account_id: 20720988, name: 'Stream Stray Kids \'Do It\' on YT' },
    { account_id: 102620357, name: 'C Squad' },
    { account_id: 10240989, name: 'partylobster' },
    { account_id: 56950757, name: 'Life_Insurance' },
    // Mutha Shuckas
    { account_id: 83172949, name: '[NLR] Cloud Kicker' },
    { account_id: 192347173, name: 'Ms Anthrope' },
    { account_id: 52899534, name: 'Roctopus' },
    { account_id: 145749278, name: 'Replayz' },
    { account_id: 83741745, name: '7' },
    // CA$HFLOW
    { account_id: 70081477, name: 'Board Man Gets Paid' },
    { account_id: 121916760, name: 'Kiragos' },
    { account_id: 59311372, name: 'Holiday' }, // Original player
    { account_id: 71794697, name: 'Z.T. Pastamancer' }, // Sub player (also used name Holiday)
    { account_id: 12096575, name: 'Bojangles' },
    { account_id: 83605406, name: 'Drink water and stretch' },
  ];

  // Create players
  for (const playerData of players) {
    const playerId = await findOrCreatePlayer(supabase, playerData.account_id, playerData.name);
    playerMap.set(playerData.account_id, playerId);
    playerNameMap.set(playerData.account_id, playerData.name);
  }

  console.log(`✅ All ${players.length} players processed`);

  // Match Data
  const matches = [
    {
      match_number: 1,
      match_id: null,
      duration: 2710,
      match_date: '2023-12-01',
      team1_name: 'Staff Infection',
      team2_id: 9239539,
      winner_id: 9239539,
      team1_score: 27,
      team2_score: 34,
    },
    {
      match_number: 2,
      match_id: '7468071241',
      duration: 2462,
      match_date: '2023-12-01',
      team1_name: 'Staff Infection',
      team2_id: 9239539,
      winner_id: 9239539,
      team1_score: 27,
      team2_score: 36,
    },
    {
      match_number: 3,
      match_id: '7468018330',
      duration: 1903,
      match_date: '2023-12-01',
      team1_id: 9400971,
      team2_name: 'CA$HFLOW',
      winner_name: 'CA$HFLOW',
      team1_score: 15,
      team2_score: 30,
    },
    {
      match_number: 4,
      match_id: '7468067716',
      duration: 2739,
      match_date: '2023-12-01',
      team1_id: 9400971,
      team2_name: 'CA$HFLOW',
      winner_id: 9400971,
      team1_score: 45,
      team2_score: 37,
    },
    {
      match_number: 5,
      match_id: '7468131300',
      duration: 3729,
      match_date: '2023-12-01',
      team1_name: 'CA$HFLOW',
      team2_id: 9400971,
      winner_id: 9400971,
      team1_score: 41,
      team2_score: 58,
    },
    {
      match_number: 6,
      match_id: '7468219577',
      duration: 2466,
      match_date: '2023-12-01',
      team1_name: 'CA$HFLOW',
      team2_name: 'Staff Infection',
      winner_name: 'Staff Infection',
      team1_score: 26,
      team2_score: 41,
    },
    {
      match_number: 7,
      match_id: '7468219880',
      duration: 2376,
      match_date: '2023-12-02',
      team1_id: 9400971,
      team2_id: 9239539,
      winner_id: 9239539,
      team1_score: 43,
      team2_score: 45,
    },
  ];

  // Create matches and player stats
  for (const matchData of matches) {
    console.log(`\n🏈 Creating Match ${matchData.match_number}...`);
    
    // Get team IDs (handling both valve IDs and names)
    const team1Id = (matchData as any).team1_id 
      ? teamMap.get((matchData as any).team1_id)
      : teamMap.get((matchData as any).team1_name);
    const team2Id = (matchData as any).team2_id 
      ? teamMap.get((matchData as any).team2_id)
      : teamMap.get((matchData as any).team2_name);
    const winnerId = (matchData as any).winner_id 
      ? teamMap.get((matchData as any).winner_id)
      : teamMap.get((matchData as any).winner_name);

    const { data: match, error: matchError } = await supabase
      .from('kkup_matches')
      .insert({
        kernel_kup_id: kkupId,
        match_number: matchData.match_number,
        match_id: matchData.match_id ? matchData.match_id : null,
        team1_id: team1Id,
        team2_id: team2Id,
        winner_team_id: winnerId,
        team1_score: matchData.team1_score,
        team2_score: matchData.team2_score,
        stage: 'group_stage',
        status: 'completed',
        duration: matchData.duration,
        scheduled_time: new Date(matchData.match_date).toISOString(),
      })
      .select()
      .single();

    if (matchError) {
      console.error(`   ❌ Failed to create match ${matchData.match_number}:`, matchError);
      throw new Error(`Failed to create match: ${matchError.message}`);
    }

    if (!match) {
      console.error(`   ❌ Match ${matchData.match_number} creation returned null`);
      throw new Error(`Match ${matchData.match_number} creation failed - no data returned`);
    }

    console.log(`   ✅ Match ${matchData.match_number} created (ID: ${match.id})`);

    // Match 1 player stats (K/D/A only, n/a for everything else)
    if (matchData.match_number === 1) {
      const match1Stats = [
        // Staff Infection (Team 1 / Radiant) - LOSERS
        { account_id: 32846586, hero: 'Viper', k: 3, d: 10, a: 12, team_name: 'Staff Infection', is_radiant: true },
        { account_id: 208895278, hero: 'Gyrocopter', k: 7, d: 5, a: 13, team_name: 'Staff Infection', is_radiant: true },
        { account_id: 57751419, hero: 'Chaos Knight', k: 8, d: 11, a: 7, team_name: 'Staff Infection', is_radiant: true },
        { account_id: 162920467, hero: 'Jakiro', k: 3, d: 6, a: 15, team_name: 'Staff Infection', is_radiant: true },
        { account_id: 176598507, hero: 'Ember Spirit', k: 5, d: 3, a: 9, team_name: 'Staff Infection', is_radiant: true },
        // EAFD (Team 2 / Dire) - WINNERS
        { account_id: 66953342, hero: 'Lich', k: 5, d: 6, a: 20, team_id: 9239539, is_radiant: false },
        { account_id: 20720988, hero: 'Grimstroke', k: 3, d: 7, a: 23, team_id: 9239539, is_radiant: false },
        { account_id: 102620357, hero: 'Wraith King', k: 11, d: 1, a: 18, team_id: 9239539, is_radiant: false },
        { account_id: 10240989, hero: 'Weaver', k: 10, d: 4, a: 15, team_id: 9239539, is_radiant: false },
        { account_id: 56950757, hero: 'Kunkka', k: 4, d: 9, a: 22, team_id: 9239539, is_radiant: false },
      ];

      console.log(`   📊 Inserting ${match1Stats.length} player stats...`);
      for (const stats of match1Stats) {
        const playerId = playerMap.get(stats.account_id);
        const teamId = (stats as any).team_id ? teamMap.get((stats as any).team_id) : teamMap.get((stats as any).team_name);
        if (!playerId || !teamId) {
          console.error(`      ⚠️ Skipping player ${stats.account_id} - missing player or team ID`);
          continue;
        }

        const isWinner = winnerId === teamId;

        const { error: statsError } = await supabase.from('kkup_match_player_stats').insert({
          match_id: match.id,
          player_profile_id: playerId,
          team_id: teamId,
          player_name: playerNameMap.get(stats.account_id) || 'Unknown',
          steam_id: stats.account_id,
          hero_id: getHeroId(stats.hero),
          hero_name: stats.hero,
          kills: stats.k,
          deaths: stats.d,
          assists: stats.a,
          last_hits: null,
          denies: null,
          gpm: null,
          xpm: null,
          level: null,
          net_worth: null,
          gold: null,
          hero_damage: null,
          tower_damage: null,
          hero_healing: null,
          item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
          is_winner: isWinner,
        });

        if (statsError) {
          console.error(`      ❌ Failed to insert stats for player ${stats.account_id}:`, statsError);
          throw new Error(`Failed to insert player stats: ${statsError.message}`);
        }
      }
      console.log(`   ✅ All ${match1Stats.length} player stats inserted for Match 1`);
    }

    // Match 2 player stats (Full stats available)
    if (matchData.match_number === 2) {
      const match2Stats = [
        // Staff Infection (Team 1 / Radiant) - LOSERS
        { account_id: 32846586, hero: 'Skywrath Mage', k: 2, d: 12, a: 9, lh: 32, dn: 2, gpm: 235, xpm: 407, lvl: 17, nw: 9344, team_name: 'Staff Infection', is_radiant: true },
        { account_id: 208895278, hero: 'Razor', k: 14, d: 4, a: 5, lh: 311, dn: 7, gpm: 601, xpm: 695, lvl: 22, nw: 20324, team_name: 'Staff Infection', is_radiant: true },
        { account_id: 57751419, hero: 'Spirit Breaker', k: 3, d: 10, a: 16, lh: 194, dn: 7, gpm: 415, xpm: 487, lvl: 19, nw: 13700, team_name: 'Staff Infection', is_radiant: true },
        { account_id: 162920467, hero: 'Oracle', k: 6, d: 6, a: 12, lh: 70, dn: 2, gpm: 324, xpm: 522, lvl: 20, nw: 12667, team_name: 'Staff Infection', is_radiant: true },
        { account_id: 176598507, hero: 'Pangolier', k: 2, d: 5, a: 12, lh: 252, dn: 12, gpm: 462, xpm: 575, lvl: 21, nw: 17580, team_name: 'Staff Infection', is_radiant: true },
        // EAFD (Team 2 / Dire) - WINNERS
        { account_id: 66953342, hero: 'Venomancer', k: 3, d: 8, a: 16, lh: 69, dn: 10, gpm: 354, xpm: 547, lvl: 20, nw: 13722, team_id: 9239539, is_radiant: false },
        { account_id: 20720988, hero: 'Pugna', k: 3, d: 4, a: 23, lh: 66, dn: 3, gpm: 417, xpm: 580, lvl: 21, nw: 13479, team_id: 9239539, is_radiant: false },
        { account_id: 102620357, hero: 'Sven', k: 13, d: 4, a: 9, lh: 433, dn: 5, gpm: 776, xpm: 858, lvl: 26, nw: 29554, team_id: 9239539, is_radiant: false },
        { account_id: 10240989, hero: 'Slardar', k: 3, d: 3, a: 9, lh: 203, dn: 20, gpm: 459, xpm: 612, lvl: 21, nw: 18045, team_id: 9239539, is_radiant: false },
        { account_id: 56950757, hero: "Nature's Prophet", k: 14, d: 8, a: 17, lh: 354, dn: 8, gpm: 745, xpm: 843, lvl: 25, nw: 27074, team_id: 9239539, is_radiant: false },
      ];

      for (const stats of match2Stats) {
        const playerId = playerMap.get(stats.account_id);
        const teamId = (stats as any).team_id ? teamMap.get((stats as any).team_id) : teamMap.get((stats as any).team_name);
        if (!playerId || !teamId) continue;

        const isWinner = winnerId === teamId;

        await supabase.from('kkup_match_player_stats').insert({
          match_id: match.id,
          player_profile_id: playerId,
          team_id: teamId,
          player_name: playerNameMap.get(stats.account_id) || 'Unknown',
          steam_id: stats.account_id,
          hero_id: getHeroId(stats.hero),
          hero_name: stats.hero,
          kills: stats.k,
          deaths: stats.d,
          assists: stats.a,
          last_hits: stats.lh,
          denies: stats.dn,
          gpm: stats.gpm,
          xpm: stats.xpm,
          level: stats.lvl,
          net_worth: stats.nw,
          gold: null,
          hero_damage: null,
          tower_damage: null,
          hero_healing: null,
          item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
          is_winner: isWinner,
        });
      }
    }

    // Match 3 player stats (K/D/A + Net Worth only)
    if (matchData.match_number === 3) {
      const match3Stats = [
        // Mutha Shuckas (Team 1 / Radiant) - LOSERS
        { account_id: 83172949, hero: 'Wraith King', k: 5, d: 4, a: 7, nw: 10343, team_id: 9400971, is_radiant: true },
        { account_id: 192347173, hero: 'Crystal Maiden', k: 1, d: 6, a: 8, nw: 4150, team_id: 9400971, is_radiant: true },
        { account_id: 52899534, hero: 'Phoenix', k: 3, d: 6, a: 7, nw: 7740, team_id: 9400971, is_radiant: true },
        { account_id: 145749278, hero: 'Kunkka', k: 4, d: 7, a: 7, nw: 10421, team_id: 9400971, is_radiant: true },
        { account_id: 83741745, hero: 'Phantom Lancer', k: 1, d: 7, a: 7, nw: 10838, team_id: 9400971, is_radiant: true },
        // CA$HFLOW (Team 2 / Dire) - WINNERS
        { account_id: 70081477, hero: 'Treant Protector', k: 4, d: 3, a: 18, nw: 8485, team_name: 'CA$HFLOW', is_radiant: false },
        { account_id: 121916760, hero: 'Venomancer', k: 3, d: 6, a: 8, nw: 10871, team_name: 'CA$HFLOW', is_radiant: false },
        { account_id: 59311372, hero: 'Centaur Warrunner', k: 6, d: 1, a: 17, nw: 16719, team_name: 'CA$HFLOW', is_radiant: false },
        { account_id: 12096575, hero: 'Weaver', k: 5, d: 4, a: 13, nw: 18431, team_name: 'CA$HFLOW', is_radiant: false },
        { account_id: 83605406, hero: 'Queen Of Pain', k: 12, d: 1, a: 7, nw: 18073, team_name: 'CA$HFLOW', is_radiant: false },
      ];

      for (const stats of match3Stats) {
        const playerId = playerMap.get(stats.account_id);
        const teamId = (stats as any).team_id ? teamMap.get((stats as any).team_id) : teamMap.get((stats as any).team_name);
        if (!playerId || !teamId) continue;

        const isWinner = winnerId === teamId;

        await supabase.from('kkup_match_player_stats').insert({
          match_id: match.id,
          player_profile_id: playerId,
          team_id: teamId,
          player_name: playerNameMap.get(stats.account_id) || 'Unknown',
          steam_id: stats.account_id,
          hero_id: getHeroId(stats.hero),
          hero_name: stats.hero,
          kills: stats.k,
          deaths: stats.d,
          assists: stats.a,
          last_hits: null,
          denies: null,
          gpm: null,
          xpm: null,
          level: null,
          net_worth: stats.nw,
          gold: null,
          hero_damage: null,
          tower_damage: null,
          hero_healing: null,
          item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
          is_winner: isWinner,
        });
      }
    }

    // Match 4 player stats (K/D/A + Net Worth only)
    if (matchData.match_number === 4) {
      const match4Stats = [
        // Mutha Shuckas (Team 1 / Radiant) - WINNERS
        { account_id: 83172949, hero: 'Sand King', k: 6, d: 11, a: 25, nw: 21507, team_id: 9400971, is_radiant: true },
        { account_id: 192347173, hero: 'Jakiro', k: 4, d: 8, a: 29, nw: 25280, team_id: 9400971, is_radiant: true },
        { account_id: 52899534, hero: 'Rubick', k: 4, d: 7, a: 34, nw: 17374, team_id: 9400971, is_radiant: true },
        { account_id: 145749278, hero: 'Spectre', k: 16, d: 5, a: 16, nw: 25280, team_id: 9400971, is_radiant: true },
        { account_id: 83741745, hero: 'Storm Spirit', k: 15, d: 6, a: 19, nw: 24696, team_id: 9400971, is_radiant: true },
        // CA$HFLOW (Team 2 / Dire) - LOSERS
        { account_id: 70081477, hero: 'Treant Protector', k: 4, d: 8, a: 26, nw: 13245, team_name: 'CA$HFLOW', is_radiant: false },
        { account_id: 121916760, hero: 'Vengeful Spirit', k: 4, d: 12, a: 17, nw: 14105, team_name: 'CA$HFLOW', is_radiant: false },
        { account_id: 71794697, hero: 'Dawnbreaker', k: 12, d: 6, a: 13, nw: 20652, team_name: 'CA$HFLOW', is_radiant: false },
        { account_id: 12096575, hero: 'Muerta', k: 11, d: 12, a: 9, nw: 28197, team_name: 'CA$HFLOW', is_radiant: false },
        { account_id: 83605406, hero: 'Zeus', k: 5, d: 7, a: 20, nw: 18250, team_name: 'CA$HFLOW', is_radiant: false },
      ];

      for (const stats of match4Stats) {
        const playerId = playerMap.get(stats.account_id);
        const teamId = (stats as any).team_id ? teamMap.get((stats as any).team_id) : teamMap.get((stats as any).team_name);
        if (!playerId || !teamId) continue;

        const isWinner = winnerId === teamId;

        await supabase.from('kkup_match_player_stats').insert({
          match_id: match.id,
          player_profile_id: playerId,
          team_id: teamId,
          player_name: playerNameMap.get(stats.account_id) || 'Unknown',
          steam_id: stats.account_id,
          hero_id: getHeroId(stats.hero),
          hero_name: stats.hero,
          kills: stats.k,
          deaths: stats.d,
          assists: stats.a,
          last_hits: null,
          denies: null,
          gpm: null,
          xpm: null,
          level: null,
          net_worth: stats.nw,
          gold: null,
          hero_damage: null,
          tower_damage: null,
          hero_healing: null,
          item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
          is_winner: isWinner,
        });
      }
    }

    // Match 5 player stats (K/D/A + Net Worth only)
    if (matchData.match_number === 5) {
      const match5Stats = [
        // CA$HFLOW (Team 1 / Radiant) - LOSERS
        { account_id: 70081477, hero: 'Clockwerk', k: 2, d: 14, a: 23, nw: 14956, team_name: 'CA$HFLOW', is_radiant: true },
        { account_id: 121916760, hero: 'Shadow Shaman', k: 1, d: 12, a: 22, nw: 15923, team_name: 'CA$HFLOW', is_radiant: true },
        { account_id: 59311372, hero: 'Primal Beast', k: 7, d: 13, a: 17, nw: 25318, team_name: 'CA$HFLOW', is_radiant: true },
        { account_id: 12096575, hero: 'Bloodseeker', k: 15, d: 11, a: 12, nw: 32801, team_name: 'CA$HFLOW', is_radiant: true },
        { account_id: 83605406, hero: 'Queen Of Pain', k: 15, d: 9, a: 17, nw: 24412, team_name: 'CA$HFLOW', is_radiant: true },
        // Mutha Shuckas (Team 2 / Dire) - WINNERS
        { account_id: 83172949, hero: 'Spirit Breaker', k: 15, d: 12, a: 26, nw: 39839, team_id: 9400971, is_radiant: false },
        { account_id: 192347173, hero: 'Jakiro', k: 4, d: 8, a: 27, nw: 17053, team_id: 9400971, is_radiant: false },
        { account_id: 52899534, hero: 'Grimstroke', k: 6, d: 9, a: 35, nw: 21713, team_id: 9400971, is_radiant: false },
        { account_id: 145749278, hero: 'Lifestealer', k: 14, d: 9, a: 24, nw: 29162, team_id: 9400971, is_radiant: false },
        { account_id: 83741745, hero: 'Invoker', k: 18, d: 4, a: 30, nw: 38463, team_id: 9400971, is_radiant: false },
      ];

      for (const stats of match5Stats) {
        const playerId = playerMap.get(stats.account_id);
        const teamId = (stats as any).team_id ? teamMap.get((stats as any).team_id) : teamMap.get((stats as any).team_name);
        if (!playerId || !teamId) continue;

        const isWinner = winnerId === teamId;

        await supabase.from('kkup_match_player_stats').insert({
          match_id: match.id,
          player_profile_id: playerId,
          team_id: teamId,
          player_name: playerNameMap.get(stats.account_id) || 'Unknown',
          steam_id: stats.account_id,
          hero_id: getHeroId(stats.hero),
          hero_name: stats.hero,
          kills: stats.k,
          deaths: stats.d,
          assists: stats.a,
          last_hits: null,
          denies: null,
          gpm: null,
          xpm: null,
          level: null,
          net_worth: stats.nw,
          gold: null,
          hero_damage: null,
          tower_damage: null,
          hero_healing: null,
          item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
          is_winner: isWinner,
        });
      }
    }

    // Match 6 player stats (Full stats available)
    if (matchData.match_number === 6) {
      const match6Stats = [
        // CA$HFLOW (Team 1 / Radiant) - LOSERS
        { account_id: 70081477, hero: 'Treant Protector', k: 4, d: 9, a: 14, lh: 44, dn: 1, gpm: 303, xpm: 389, lvl: 17, nw: 8998, team_name: 'CA$HFLOW', is_radiant: true },
        { account_id: 121916760, hero: 'Vengeful Spirit', k: 4, d: 13, a: 8, lh: 37, dn: 0, gpm: 210, xpm: 347, lvl: 16, nw: 6757, team_name: 'CA$HFLOW', is_radiant: true },
        { account_id: 59311372, hero: 'Night Stalker', k: 1, d: 11, a: 9, lh: 166, dn: 22, gpm: 365, xpm: 495, lvl: 19, nw: 13278, team_name: 'CA$HFLOW', is_radiant: true },
        { account_id: 12096575, hero: 'Zeus', k: 9, d: 7, a: 8, lh: 248, dn: 1, gpm: 465, xpm: 540, lvl: 20, nw: 16608, team_name: 'CA$HFLOW', is_radiant: true },
        { account_id: 83605406, hero: 'Drow Ranger', k: 5, d: 1, a: 12, lh: 469, dn: 19, gpm: 631, xpm: 682, lvl: 22, nw: 24671, team_name: 'CA$HFLOW', is_radiant: true },
        // Staff Infection (Team 2 / Dire) - WINNERS
        { account_id: 32846586, hero: 'Phantom Lancer', k: 20, d: 4, a: 10, lh: 312, dn: 5, gpm: 714, xpm: 849, lvl: 25, nw: 28821, team_name: 'Staff Infection', is_radiant: false },
        { account_id: 208895278, hero: 'Wraith King', k: 9, d: 2, a: 24, lh: 294, dn: 4, gpm: 657, xpm: 876, lvl: 26, nw: 26322, team_name: 'Staff Infection', is_radiant: false },
        { account_id: 57751419, hero: 'Sand King', k: 7, d: 7, a: 23, lh: 233, dn: 3, gpm: 561, xpm: 691, lvl: 22, nw: 23131, team_name: 'Staff Infection', is_radiant: false },
        { account_id: 162920467, hero: 'Techies', k: 2, d: 3, a: 25, lh: 131, dn: 2, gpm: 402, xpm: 520, lvl: 19, nw: 15202, team_name: 'Staff Infection', is_radiant: false },
        { account_id: 31649623, hero: 'Oracle', k: 2, d: 10, a: 21, lh: 25, dn: 3, gpm: 301, xpm: 452, lvl: 18, nw: 10843, team_name: 'Staff Infection', is_radiant: false },
      ];

      for (const stats of match6Stats) {
        const playerId = playerMap.get(stats.account_id);
        const teamId = (stats as any).team_id ? teamMap.get((stats as any).team_id) : teamMap.get((stats as any).team_name);
        if (!playerId || !teamId) continue;

        const isWinner = winnerId === teamId;

        await supabase.from('kkup_match_player_stats').insert({
          match_id: match.id,
          player_profile_id: playerId,
          team_id: teamId,
          player_name: playerNameMap.get(stats.account_id) || 'Unknown',
          steam_id: stats.account_id,
          hero_id: getHeroId(stats.hero),
          hero_name: stats.hero,
          kills: stats.k,
          deaths: stats.d,
          assists: stats.a,
          last_hits: stats.lh,
          denies: stats.dn,
          gpm: stats.gpm,
          xpm: stats.xpm,
          level: stats.lvl,
          net_worth: stats.nw,
          gold: null,
          hero_damage: null,
          tower_damage: null,
          hero_healing: null,
          item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
          is_winner: isWinner,
        });
      }
    }

    // Match 7 player stats (Full stats + Hero Healing)
    if (matchData.match_number === 7) {
      const match7Stats = [
        // Mutha Shuckas (Team 1 / Radiant) - LOSERS
        { account_id: 83172949, hero: 'Dawnbreaker', k: 8, d: 11, a: 16, lh: 175, dn: 5, gpm: 447, xpm: 552, lvl: 20, nw: 13678, hh: 3400, team_id: 9400971, is_radiant: true },
        { account_id: 192347173, hero: 'Jakiro', k: 3, d: 10, a: 14, lh: 23, dn: 1, gpm: 246, xpm: 445, lvl: 18, nw: 6698, hh: 0, team_id: 9400971, is_radiant: true },
        { account_id: 52899534, hero: 'Rubick', k: 8, d: 9, a: 21, lh: 88, dn: 0, gpm: 359, xpm: 539, lvl: 19, nw: 10995, hh: 22, team_id: 9400971, is_radiant: true },
        { account_id: 145749278, hero: 'Razor', k: 15, d: 6, a: 14, lh: 261, dn: 14, gpm: 578, xpm: 682, lvl: 22, nw: 20502, hh: 0, team_id: 9400971, is_radiant: true },
        { account_id: 83741745, hero: 'Storm Spirit', k: 9, d: 9, a: 16, lh: 137, dn: 11, gpm: 396, xpm: 531, lvl: 19, nw: 13644, hh: 0, team_id: 9400971, is_radiant: true },
        // EAFD (Team 2 / Dire) - WINNERS
        { account_id: 66953342, hero: 'Venomancer', k: 3, d: 11, a: 24, lh: 45, dn: 3, gpm: 324, xpm: 532, lvl: 19, nw: 13518, hh: 432, team_id: 9239539, is_radiant: false },
        { account_id: 20720988, hero: 'Witch Doctor', k: 0, d: 14, a: 21, lh: 51, dn: 3, gpm: 301, xpm: 414, lvl: 17, nw: 8703, hh: 4996, team_id: 9239539, is_radiant: false },
        { account_id: 102620357, hero: 'Phantom Assassin', k: 22, d: 7, a: 12, lh: 239, dn: 6, gpm: 700, xpm: 929, lvl: 26, nw: 26107, hh: 0, team_id: 9239539, is_radiant: false },
        { account_id: 10240989, hero: 'Night Stalker', k: 7, d: 9, a: 16, lh: 165, dn: 15, gpm: 478, xpm: 659, lvl: 22, nw: 18323, hh: 0, team_id: 9239539, is_radiant: false },
        { account_id: 56950757, hero: 'Bristleback', k: 11, d: 2, a: 20, lh: 210, dn: 4, gpm: 609, xpm: 874, lvl: 25, nw: 23589, hh: 0, team_id: 9239539, is_radiant: false },
      ];

      for (const stats of match7Stats) {
        const playerId = playerMap.get(stats.account_id);
        const teamId = (stats as any).team_id ? teamMap.get((stats as any).team_id) : teamMap.get((stats as any).team_name);
        if (!playerId || !teamId) continue;

        const isWinner = winnerId === teamId;

        await supabase.from('kkup_match_player_stats').insert({
          match_id: match.id,
          player_profile_id: playerId,
          team_id: teamId,
          player_name: playerNameMap.get(stats.account_id) || 'Unknown',
          steam_id: stats.account_id,
          hero_id: getHeroId(stats.hero),
          hero_name: stats.hero,
          kills: stats.k,
          deaths: stats.d,
          assists: stats.a,
          last_hits: stats.lh,
          denies: stats.dn,
          gpm: stats.gpm,
          xpm: stats.xpm,
          level: stats.lvl,
          net_worth: stats.nw,
          gold: null,
          hero_damage: null,
          tower_damage: null,
          hero_healing: stats.hh,
          item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
          is_winner: isWinner,
        });
      }
    }
  }

  console.log('');
  console.log('🔧 ============================================');
  console.log('🔧 BACKFILLING TEAM ROSTERS');
  console.log('🔧 ============================================');
  
  // Backfill kkup_team_players table
  const { data: tournamentMatches } = await supabase
    .from('kkup_matches')
    .select('id')
    .eq('kernel_kup_id', kkupId);
  
  const matchIds = tournamentMatches?.map((m: any) => m.id) || [];
  
  const { data: allPlayerStats } = await supabase
    .from('kkup_match_player_stats')
    .select('player_profile_id, team_id')
    .in('match_id', matchIds);
  
  const uniqueCombos = new Map<string, { player_profile_id: string, team_id: string }>();
  allPlayerStats?.forEach((stat: any) => {
    const key = `${stat.player_profile_id}_${stat.team_id}`;
    if (!uniqueCombos.has(key)) {
      uniqueCombos.set(key, {
        player_profile_id: stat.player_profile_id,
        team_id: stat.team_id
      });
    }
  });

  console.log(`📊 Found ${uniqueCombos.size} unique player-team combinations`);

  let rostersCreated = 0;
  for (const combo of uniqueCombos.values()) {
    const { data: existing } = await supabase
      .from('kkup_team_players')
      .select('id')
      .eq('player_profile_id', combo.player_profile_id)
      .eq('team_id', combo.team_id)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await supabase
        .from('kkup_team_players')
        .insert({
          player_profile_id: combo.player_profile_id,
          team_id: combo.team_id
        });

      if (!insertError) {
        rostersCreated++;
      } else {
        console.error(`⚠️  Failed to insert roster entry:`, insertError);
      }
    }
  }

  console.log(`✅ Created ${rostersCreated} roster entries`);

  console.log('');
  console.log('✅ ============================================');
  console.log('✅ KERNEL KUP 3 SEEDED SUCCESSFULLY');
  console.log('✅ ============================================');

  return {
    success: true,
    tournamentId: kkupId,
    message: 'Kernel Kup 3 data seeded successfully!',
    matchCount: 7
  };
}