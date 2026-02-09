import { createClient } from "jsr:@supabase/supabase-js@2";
import { findOrCreatePlayer, findOrCreateTeam } from "./kkup-helpers.tsx";

/**
 * 🌽 KERNEL KUP 2 SEED DATA
 * Tournament Date: November 3, 2023
 * Teams: Elliott Jewelers, Staff Infection, EAFD
 */

export async function seedKernelKup2(supabase: any, anonSupabase: any, authUser: any) {
  console.log('🌽 ============================================');
  console.log('🌽 SEEDING KERNEL KUP 2 DATA');
  console.log('🌽 ============================================');

  const playerMap = new Map<number, string>(); // account_id -> kkup_players.id
  const teamMap = new Map<number, string>(); // team_id -> kkup_teams.id
  const playerNameMap = new Map<number, string>(); // account_id -> player_name

  // Helper to get hero ID by name
  const getHeroId = (heroName: string): number | null => {
    const heroMapping: Record<string, number> = {
      // KK1 + KK2 Heroes
      'Windranger': 21, 'Lich': 31, 'Lifestealer': 54, 'Vengeful Spirit': 20, 'Razor': 15,
      'Disruptor': 87, 'Mars': 129, 'Lion': 52, 'Hoodwink': 123, 'Phantom Assassin': 44,
      'Grimstroke': 50, 'Invoker': 74, 'Pudge': 14, 'Abaddon': 102, 'Clinkz': 56,
      'Rubick': 86, 'Sand King': 16, 'Crystal Maiden': 25, 'Necrophos': 36, 'Drow Ranger': 6,
      'Sniper': 35, 'Omniknight': 57, 'Weaver': 63, 'Axe': 2, 'Kunkka': 23,
      'Snapfire': 103, 'Oracle': 111, 'Viper': 47,
      // New KK2 Heroes
      'Leshrac': 52, 'Treant Protector': 83, 'Centaur Warrunner': 96, 'Witch Doctor': 30,
      'Slark': 93, 'Dawnbreaker': 135, 'Bounty Hunter': 62, 'Death Prophet': 43,
      'Wraith King': 7, 'Jakiro': 64, 'Spectre': 67, 'Dark Willow': 119,
      'Nature\'s Prophet': 53, 'Alchemist': 73, 'Dazzle': 50, 'Clockwerk': 51,
      'Spirit Breaker': 71, 'Mirana': 9, 'Monkey King': 114, 'Venomancer': 40, 'Slardar': 28,
      'Dragon Knight': 49, 'Bane': 3, 'Tidehunter': 29,
      'Naga Siren': 89, 'Elder Titan': 103, 'Lina': 25, 'Luna': 48
    };
    return heroMapping[heroName] || null;
  };

  // Create the tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from('kernel_kups')
    .insert({
      name: 'Kernel Kup 2',
      league_id: null,
      series_id: null,
      tournament_start_date: '2023-11-03',
      tournament_end_date: '2023-11-03',
      description: 'The second annual Corn Field Dota 2 Championship',
      youtube_playlist_url: 'https://www.youtube.com/watch?v=909f42A5Dyg',
      prize_pool: null,
      status: 'completed',
      is_manual: true,
    })
    .select()
    .single();

  if (tournamentError) throw new Error(`Failed to create tournament: ${tournamentError.message}`);
  console.log(`✅ Tournament created: ${tournament.name} (ID: ${tournament.id})\n`);

  // Player data
  const players = [
    // Elliott Jewelers
    { account_id: 12096575, name: 'Bojangles' },
    { account_id: 71794697, name: 'Z.T. Pastamancer' },
    { account_id: 83605406, name: 'Drink water and stretch' },
    { account_id: 63826936, name: 'Sarah' },
    { account_id: 121916760, name: 'Kiragos' },
    // Staff Infection
    { account_id: 83741745, name: '7' },
    { account_id: 83172949, name: '[NLR] Cloud Kicker' },
    { account_id: 237313649, name: 'Mavi' },
    { account_id: 176598507, name: 'Stainless' },
    { account_id: 208895278, name: 'businessCasual' },
    { account_id: 27284686, name: 'Bone Nut' },
    // EAFD
    { account_id: 162920467, name: 'EsKetIt!!' },
    { account_id: 31649623, name: 'Moumpt' },
    { account_id: 14932319, name: 'Gabagool' },
    { account_id: 32846586, name: 'Dr Clayton' },
    { account_id: 20720988, name: "Stream Stray Kids 'Do It' on YT" },
  ];

  console.log('👥 Creating/finding player profiles...');
  for (const player of players) {
    const playerId = await findOrCreatePlayer(supabase, player.account_id, player.name);
    playerMap.set(player.account_id, playerId);
    playerNameMap.set(player.account_id, player.name);
    console.log(`   ✅ ${player.name} (ID: ${playerId})`);
  }
  console.log(`\n✅ All ${players.length} players ready\n`);

  // Team data (using fake team IDs)
  const teams = [
    { team_id: 99999991, name: 'Elliott Jewelers', tag: 'EJ' },
    { team_id: 99999992, name: 'Staff Infection', tag: 'SI' },
    { team_id: 9239539, name: 'EAFD', tag: 'EAFD' }
  ];

  console.log('🏟️ Creating teams...');
  for (const team of teams) {
    const teamId = await findOrCreateTeam(supabase, tournament.id, team.team_id, team.name, team.tag);
    teamMap.set(team.team_id, teamId);
    console.log(`   ✅ ${team.name} (ID: ${teamId})`);
  }
  console.log('\n✅ All 3 teams created\n');

  // Match 1: Elliott Jewelers vs Staff Infection
  console.log('⚔️ Creating Match 1...');
  const { data: match1, error: match1Error } = await supabase
    .from('kkup_matches')
    .insert({
      kernel_kup_id: tournament.id,
      team1_id: teamMap.get(99999991),
      team2_id: teamMap.get(99999992),
      winner_team_id: teamMap.get(99999992),
      team1_score: 16,
      team2_score: 44,
      stage: 'group_stage',
      status: 'completed',
      scheduled_time: '2023-11-03T18:08:00Z',
      match_id: 7416576834,
      series_id: 1,
      dotabuff_url: 'https://www.dotabuff.com/matches/7416576834'
    })
    .select()
    .single();

  if (match1Error) throw new Error(`Failed to create match 1: ${match1Error.message}`);
  console.log(`   ✅ Match 1 created (ID: ${match1.id})`);

  // Match 1 Stats
  const match1Stats = [
    // Elliott Jewelers (Losers)
    { player: 12096575, hero: 'Lifestealer', k: 6, d: 6, a: 4, lh: 138, dn: 16, gpm: 443, xpm: 510, lvl: 16, nw: 9905 },
    { player: 71794697, hero: 'Leshrac', k: 5, d: 10, a: 3, lh: 106, dn: 13, gpm: 388, xpm: 424, lvl: 14, nw: 10187 },
    { player: 83605406, hero: 'Treant Protector', k: 1, d: 13, a: 10, lh: 22, dn: 0, gpm: 223, xpm: 273, lvl: 11, nw: 5009 },
    { player: 63826936, hero: 'Centaur Warrunner', k: 2, d: 5, a: 8, lh: 97, dn: 9, gpm: 347, xpm: 429, lvl: 14, nw: 9366 },
    { player: 121916760, hero: 'Witch Doctor', k: 1, d: 10, a: 5, lh: 30, dn: 3, gpm: 235, xpm: 287, lvl: 11, nw: 5890 },
    
    // Staff Infection (Winners)
    { player: 83741745, hero: 'Slark', k: 14, d: 5, a: 13, lh: 115, dn: 1, gpm: 565, xpm: 517, lvl: 16, nw: 15800 },
    { player: 83172949, hero: 'Dawnbreaker', k: 7, d: 5, a: 20, lh: 149, dn: 9, gpm: 532, xpm: 530, lvl: 16, nw: 14449 },
    { player: 237313649, hero: 'Bounty Hunter', k: 8, d: 4, a: 25, lh: 28, dn: 1, gpm: 495, xpm: 459, lvl: 15, nw: 12084 },
    { player: 176598507, hero: 'Death Prophet', k: 9, d: 1, a: 14, lh: 195, dn: 5, gpm: 603, xpm: 663, lvl: 18, nw: 16724 },
    { player: 208895278, hero: 'Snapfire', k: 6, d: 1, a: 21, lh: 53, dn: 15, gpm: 415, xpm: 524, lvl: 16, nw: 12576 },
  ];

  console.log(`   📊 Inserting ${match1Stats.length} player stats...`);
  for (const stat of match1Stats) {
    const teamId = [12096575, 71794697, 83605406, 63826936, 121916760].includes(stat.player) 
      ? teamMap.get(99999991)
      : teamMap.get(99999992);

    const { error: statsError } = await supabase.from('kkup_match_player_stats').insert({
      match_id: match1.id,
      player_profile_id: playerMap.get(stat.player),
      team_id: teamId,
      player_name: playerNameMap.get(stat.player) || 'Unknown',
      steam_id: stat.player,
      hero_id: getHeroId(stat.hero),
      hero_name: stat.hero,
      kills: stat.k,
      deaths: stat.d,
      assists: stat.a,
      last_hits: stat.lh || null,
      denies: stat.dn || null,
      gpm: stat.gpm || null,
      xpm: stat.xpm || null,
      level: stat.lvl || null,
      net_worth: stat.nw,
      gold: null,
      hero_damage: null,
      tower_damage: null,
      hero_healing: null,
      item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
      is_winner: teamId === teamMap.get(99999992)
    });

    if (statsError) {
      console.error(`      ❌ Failed to insert stats for player ${stat.player}:`, statsError);
      throw new Error(`Failed to insert player stats: ${statsError.message}`);
    }
  }
  console.log(`   ✅ All ${match1Stats.length} player stats inserted\n`);

  // Match 2: EAFD vs Elliott Jewelers
  console.log('⚔️ Creating Match 2...');
  const { data: match2, error: match2Error } = await supabase
    .from('kkup_matches')
    .insert({
      kernel_kup_id: tournament.id,
      team1_id: teamMap.get(9239539),
      team2_id: teamMap.get(99999991),
      winner_team_id: teamMap.get(99999991),
      team1_score: 5,
      team2_score: 26,
      stage: 'group_stage',
      status: 'completed',
      scheduled_time: '2023-11-03T19:05:00Z',
      match_id: 7416624207,
      series_id: 2,
      dotabuff_url: 'https://www.dotabuff.com/matches/7416624207'
    })
    .select()
    .single();

  if (match2Error) throw new Error(`Failed to create match 2: ${match2Error.message}`);
  console.log(`   ✅ Match 2 created (ID: ${match2.id})`);

  // Match 2 Stats
  const match2Stats = [
    // EAFD (Losers)
    { player: 162920467, hero: 'Wraith King', k: 1, d: 5, a: 1, lh: 111, dn: 8, gpm: 323, xpm: 335, lvl: 12, nw: 8294 },
    { player: 31649623, hero: 'Jakiro', k: 0, d: 8, a: 3, lh: 51, dn: 1, gpm: 234, xpm: 316, lvl: 11, nw: 5307 },
    { player: 14932319, hero: 'Spectre', k: 0, d: 4, a: 2, lh: 117, dn: 2, gpm: 309, xpm: 354, lvl: 12, nw: 8046 },
    { player: 32846586, hero: 'Disruptor', k: 1, d: 6, a: 0, lh: 13, dn: 0, gpm: 150, xpm: 203, lvl: 9, nw: 4976 },
    { player: 20720988, hero: 'Dark Willow', k: 3, d: 3, a: 1, lh: 69, dn: 20, gpm: 284, xpm: 337, lvl: 12, nw: 6770 },
    
    // Elliott Jewelers (Winners)
    { player: 71794697, hero: 'Dawnbreaker', k: 4, d: 0, a: 9, lh: 149, dn: 15, gpm: 506, xpm: 599, lvl: 16, nw: 13486 },
    { player: 83605406, hero: 'Nature\'s Prophet', k: 4, d: 0, a: 15, lh: 95, dn: 6, gpm: 198, xpm: 484, lvl: 15, nw: 11243 },
    { player: 12096575, hero: 'Alchemist', k: 8, d: 2, a: 5, lh: 271, dn: 2, gpm: 862, xpm: 724, lvl: 18, nw: 22172 },
    { player: 121916760, hero: 'Crystal Maiden', k: 3, d: 2, a: 10, lh: 27, dn: 0, gpm: 279, xpm: 430, lvl: 14, nw: 7421 },
    { player: 63826936, hero: 'Razor', k: 6, d: 1, a: 4, lh: 181, dn: 18, gpm: 513, xpm: 488, lvl: 15, nw: 13641 },
  ];

  console.log(`   📊 Inserting ${match2Stats.length} player stats...`);
  for (const stat of match2Stats) {
    const teamId = [162920467, 31649623, 14932319, 32846586, 20720988].includes(stat.player) 
      ? teamMap.get(9239539) 
      : teamMap.get(99999991);

    const { error: statsError } = await supabase.from('kkup_match_player_stats').insert({
      match_id: match2.id,
      player_profile_id: playerMap.get(stat.player),
      team_id: teamId,
      player_name: playerNameMap.get(stat.player) || 'Unknown',
      steam_id: stat.player,
      hero_id: getHeroId(stat.hero),
      hero_name: stat.hero,
      kills: stat.k,
      deaths: stat.d,
      assists: stat.a,
      last_hits: stat.lh || null,
      denies: stat.dn || null,
      gpm: stat.gpm || null,
      xpm: stat.xpm || null,
      level: stat.lvl || null,
      net_worth: stat.nw,
      gold: null,
      hero_damage: null,
      tower_damage: null,
      hero_healing: null,
      item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
      is_winner: teamId === teamMap.get(99999991)
    });

    if (statsError) {
      console.error(`      ❌ Failed to insert stats for player ${stat.player}:`, statsError);
      throw new Error(`Failed to insert player stats: ${statsError.message}`);
    }
  }
  console.log(`   ✅ All ${match2Stats.length} player stats inserted\n`);

  // Match 3: EAFD vs Elliott Jewelers
  console.log('⚔️ Creating Match 3...');
  const { data: match3, error: match3Error } = await supabase
    .from('kkup_matches')
    .insert({
      kernel_kup_id: tournament.id,
      team1_id: teamMap.get(9239539),
      team2_id: teamMap.get(99999991),
      winner_team_id: teamMap.get(99999991),
      team1_score: 1,
      team2_score: 18,
      stage: 'group_stage',
      status: 'completed',
      scheduled_time: '2023-11-03T20:00:00Z',
      match_id: 7416675184,
      series_id: 2,
      dotabuff_url: 'https://www.dotabuff.com/matches/7416675184'
    })
    .select()
    .single();

  if (match3Error) throw new Error(`Failed to create match 3: ${match3Error.message}`);
  console.log(`   ✅ Match 3 created (ID: ${match3.id})`);

  // Match 3 Stats
  const match3Stats = [
    // EAFD (Losers)
    { player: 162920467, hero: 'Dazzle', k: 1, d: 2, a: 0, lh: 98, dn: 7, gpm: 404, xpm: 463, lvl: 11, nw: 6841 },
    { player: 31649623, hero: 'Abaddon', k: 0, d: 4, a: 1, lh: 13, dn: 1, gpm: 162, xpm: 258, lvl: 8, nw: 2702 },
    { player: 14932319, hero: 'Clockwerk', k: 0, d: 4, a: 1, lh: 11, dn: 7, gpm: 148, xpm: 192, lvl: 7, nw: 2690 },
    { player: 32846586, hero: 'Clinkz', k: 0, d: 2, a: 1, lh: 49, dn: 5, gpm: 213, xpm: 277, lvl: 8, nw: 3827 },
    { player: 20720988, hero: 'Axe', k: 0, d: 6, a: 1, lh: 50, dn: 3, gpm: 230, xpm: 220, lvl: 7, nw: 4001 },
    
    // Elliott Jewelers (Winners)
    { player: 71794697, hero: 'Spirit Breaker', k: 4, d: 0, a: 5, lh: 98, dn: 6, gpm: 489, xpm: 549, lvl: 12, nw: 8683 },
    { player: 83605406, hero: 'Mirana', k: 0, d: 0, a: 9, lh: 33, dn: 2, gpm: 267, xpm: 367, lvl: 10, nw: 4739 },
    { player: 12096575, hero: 'Monkey King', k: 4, d: 1, a: 1, lh: 109, dn: 27, gpm: 469, xpm: 408, lvl: 10, nw: 8625 },
    { player: 121916760, hero: 'Venomancer', k: 1, d: 0, a: 2, lh: 28, dn: 2, gpm: 221, xpm: 305, lvl: 9, nw: 4204 },
    { player: 63826936, hero: 'Slardar', k: 8, d: 0, a: 2, lh: 74, dn: 12, gpm: 454, xpm: 456, lvl: 11, nw: 8277 },
  ];

  console.log(`   📊 Inserting ${match3Stats.length} player stats...`);
  for (const stat of match3Stats) {
    const teamId = [162920467, 31649623, 14932319, 32846586, 20720988].includes(stat.player) 
      ? teamMap.get(9239539) 
      : teamMap.get(99999991);

    const { error: statsError } = await supabase.from('kkup_match_player_stats').insert({
      match_id: match3.id,
      player_profile_id: playerMap.get(stat.player),
      team_id: teamId,
      player_name: playerNameMap.get(stat.player) || 'Unknown',
      steam_id: stat.player,
      hero_id: getHeroId(stat.hero),
      hero_name: stat.hero,
      kills: stat.k,
      deaths: stat.d,
      assists: stat.a,
      last_hits: stat.lh || null,
      denies: stat.dn || null,
      gpm: stat.gpm || null,
      xpm: stat.xpm || null,
      level: stat.lvl || null,
      net_worth: stat.nw,
      gold: null,
      hero_damage: null,
      tower_damage: null,
      hero_healing: null,
      item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
      is_winner: teamId === teamMap.get(99999991)
    });

    if (statsError) {
      console.error(`      ❌ Failed to insert stats for player ${stat.player}:`, statsError);
      throw new Error(`Failed to insert player stats: ${statsError.message}`);
    }
  }
  console.log(`   ✅ All ${match3Stats.length} player stats inserted\n`);

  // Match 4: Staff Infection vs Elliott Jewelers (K/D/A only)
  console.log('⚔️ Creating Match 4...');
  const { data: match4, error: match4Error } = await supabase
    .from('kkup_matches')
    .insert({
      kernel_kup_id: tournament.id,
      team1_id: teamMap.get(99999992),
      team2_id: teamMap.get(99999991),
      winner_team_id: teamMap.get(99999991),
      team1_score: 28,
      team2_score: 34,
      stage: 'group_stage',
      status: 'completed',
      scheduled_time: '2023-11-03T21:30:00Z',
      match_id: null,
      series_id: 3
    })
    .select()
    .single();

  if (match4Error) throw new Error(`Failed to create match 4: ${match4Error.message}`);
  console.log(`   ✅ Match 4 created (ID: ${match4.id})`);

  // Match 4 Stats (K/D/A only, rest null)
  const match4Stats = [
    // Staff Infection (Losers)
    { player: 27284686, hero: 'Lifestealer', k: 6, d: 5, a: 5 },
    { player: 83172949, hero: 'Dragon Knight', k: 9, d: 8, a: 11 },
    { player: 237313649, hero: 'Jakiro', k: 3, d: 12, a: 15 },
    { player: 176598507, hero: 'Razor', k: 9, d: 3, a: 7 },
    { player: 208895278, hero: 'Bane', k: 1, d: 7, a: 10 },
    
    // Elliott Jewelers (Winners)
    { player: 71794697, hero: 'Dawnbreaker', k: 12, d: 3, a: 18 },
    { player: 83605406, hero: 'Mirana', k: 4, d: 10, a: 21 },
    { player: 12096575, hero: 'Weaver', k: 14, d: 3, a: 15 },
    { player: 121916760, hero: 'Vengeful Spirit', k: 1, d: 10, a: 18 },
    { player: 63826936, hero: 'Tidehunter', k: 2, d: 2, a: 21 },
  ];

  console.log(`   📊 Inserting ${match4Stats.length} player stats (K/D/A only)...`);
  for (const stat of match4Stats) {
    const teamId = [27284686, 83172949, 237313649, 176598507, 208895278].includes(stat.player) 
      ? teamMap.get(99999992) 
      : teamMap.get(99999991);

    const { error: statsError } = await supabase.from('kkup_match_player_stats').insert({
      match_id: match4.id,
      player_profile_id: playerMap.get(stat.player),
      team_id: teamId,
      player_name: playerNameMap.get(stat.player) || 'Unknown',
      steam_id: stat.player,
      hero_id: getHeroId(stat.hero),
      hero_name: stat.hero,
      kills: stat.k,
      deaths: stat.d,
      assists: stat.a,
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
      is_winner: teamId === teamMap.get(99999991)
    });

    if (statsError) {
      console.error(`      ❌ Failed to insert stats for player ${stat.player}:`, statsError);
      throw new Error(`Failed to insert player stats: ${statsError.message}`);
    }
  }
  console.log(`   ✅ All ${match4Stats.length} player stats inserted\n`);

  // Match 5: Staff Infection vs Elliott Jewelers
  console.log('⚔️ Creating Match 5...');
  const { data: match5, error: match5Error } = await supabase
    .from('kkup_matches')
    .insert({
      kernel_kup_id: tournament.id,
      team1_id: teamMap.get(99999992),
      team2_id: teamMap.get(99999991),
      winner_team_id: teamMap.get(99999992),
      team1_score: 41,
      team2_score: 23,
      stage: 'group_stage',
      status: 'completed',
      scheduled_time: '2023-11-03T21:59:00Z',
      match_id: 7416817826,
      series_id: 3,
      dotabuff_url: 'https://www.dotabuff.com/matches/7416817826'
    })
    .select()
    .single();

  if (match5Error) throw new Error(`Failed to create match 5: ${match5Error.message}`);
  console.log(`   ✅ Match 5 created (ID: ${match5.id})`);

  // Match 5 Stats
  const match5Stats = [
    // Staff Infection (Winners)
    { player: 27284686, hero: 'Naga Siren', k: 12, d: 3, a: 8, lh: 379, dn: 7, gpm: 735, xpm: 832, lvl: 26, nw: 30490 },
    { player: 83172949, hero: 'Sand King', k: 9, d: 5, a: 23, lh: 235, dn: 4, gpm: 565, xpm: 553, lvl: 20, nw: 20799 },
    { player: 237313649, hero: 'Elder Titan', k: 7, d: 9, a: 24, lh: 53, dn: 1, gpm: 365, xpm: 546, lvl: 20, nw: 13221 },
    { player: 176598507, hero: 'Death Prophet', k: 8, d: 2, a: 17, lh: 268, dn: 3, gpm: 579, xpm: 818, lvl: 25, nw: 23098 },
    { player: 208895278, hero: 'Lich', k: 4, d: 4, a: 20, lh: 76, dn: 4, gpm: 365, xpm: 532, lvl: 20, nw: 13740 },
    
    // Elliott Jewelers (Losers)
    { player: 71794697, hero: 'Lina', k: 7, d: 6, a: 11, lh: 289, dn: 12, gpm: 565, xpm: 799, lvl: 20, nw: 20723 },
    { player: 83605406, hero: 'Nature\'s Prophet', k: 7, d: 8, a: 13, lh: 168, dn: 4, gpm: 431, xpm: 680, lvl: 23, nw: 15813 },
    { player: 12096575, hero: 'Luna', k: 3, d: 10, a: 11, lh: 448, dn: 5, gpm: 615, xpm: 736, lvl: 23, nw: 23355 },
    { player: 121916760, hero: 'Vengeful Spirit', k: 2, d: 11, a: 9, lh: 31, dn: 1, gpm: 226, xpm: 406, lvl: 17, nw: 8424 },
    { player: 63826936, hero: 'Slardar', k: 3, d: 7, a: 9, lh: 166, dn: 11, gpm: 341, xpm: 429, lvl: 18, nw: 14327 },
  ];

  console.log(`   📊 Inserting ${match5Stats.length} player stats...`);
  for (const stat of match5Stats) {
    const teamId = [27284686, 83172949, 237313649, 176598507, 208895278].includes(stat.player) 
      ? teamMap.get(99999992) 
      : teamMap.get(99999991);

    const { error: statsError } = await supabase.from('kkup_match_player_stats').insert({
      match_id: match5.id,
      player_profile_id: playerMap.get(stat.player),
      team_id: teamId,
      player_name: playerNameMap.get(stat.player) || 'Unknown',
      steam_id: stat.player,
      hero_id: getHeroId(stat.hero),
      hero_name: stat.hero,
      kills: stat.k,
      deaths: stat.d,
      assists: stat.a,
      last_hits: stat.lh || null,
      denies: stat.dn || null,
      gpm: stat.gpm || null,
      xpm: stat.xpm || null,
      level: stat.lvl || null,
      net_worth: stat.nw,
      gold: null,
      hero_damage: null,
      tower_damage: null,
      hero_healing: null,
      item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
      is_winner: teamId === teamMap.get(99999992)
    });

    if (statsError) {
      console.error(`      ❌ Failed to insert stats for player ${stat.player}:`, statsError);
      throw new Error(`Failed to insert player stats: ${statsError.message}`);
    }
  }
  console.log(`   ✅ All ${match5Stats.length} player stats inserted\n`);

  // Backfill team rosters
  console.log('🔧 Backfilling team rosters...');
  const { data: allStats } = await supabase
    .from('kkup_match_player_stats')
    .select('player_profile_id, team_id')
    .in('match_id', [match1.id, match2.id, match3.id, match4.id, match5.id])
    .limit(1000);

  const uniqueRosters = new Map<string, { player_id: string; team_id: string }>();
  (allStats || []).forEach((stat: any) => {
    const key = `${stat.team_id}-${stat.player_profile_id}`;
    if (!uniqueRosters.has(key)) {
      uniqueRosters.set(key, { player_id: stat.player_profile_id, team_id: stat.team_id });
    }
  });

  const rosterEntries = Array.from(uniqueRosters.values()).map(({ player_id, team_id }) => ({
    team_id,
    player_profile_id: player_id
  }));

  const { error: rosterError } = await supabase.from('kkup_team_players').insert(rosterEntries);
  if (rosterError) {
    console.error('      ❌ Failed to insert rosters:', rosterError);
    throw new Error(`Failed to insert rosters: ${rosterError.message}`);
  }
  console.log(`✅ Created ${rosterEntries.length} roster entries\n`);

  console.log('✅ ============================================');
  console.log('✅ KERNEL KUP 2 SEEDED SUCCESSFULLY');
  console.log('✅ ============================================\n');

  return {
    success: true,
    tournament_id: tournament.id,
    tournament_name: tournament.name,
    teams_created: 3,
    matches_created: 5,
    stats_created: match1Stats.length + match2Stats.length + match3Stats.length + match4Stats.length + match5Stats.length
  };
}
