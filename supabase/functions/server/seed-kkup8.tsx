import { createClient } from "jsr:@supabase/supabase-js@2";
import { findOrCreatePlayer, findOrCreateTeam } from "./kkup-helpers.tsx";

/**
 * 🌽 KERNEL KUP 8 SEED DATA
 * Tournament Date: June 7, 2025
 * Teams: CornHub, Tiny Corn Energy
 * Championship: Tiny Corn Energy (won 2-1 vs CornHub)
 */

export async function seedKernelKup8(supabase: any, anonSupabase: any, authUser: any) {
  console.log('🌽 ============================================');
  console.log('🌽 SEEDING KERNEL KUP 8 DATA');
  console.log('🌽 ============================================');

  const playerMap = new Map<number, string>(); // account_id -> kkup_players.id
  const teamMap = new Map<number, string>(); // team_id -> kkup_teams.id
  const playerNameMap = new Map<number, string>(); // account_id -> player_name

  // Helper to get hero ID by name
  const getHeroId = (heroName: string): number | null => {
    const heroMapping: Record<string, number> = {
      // KK1-3 Heroes
      'Windranger': 21, 'Lich': 31, 'Lifestealer': 54, 'Vengeful Spirit': 20, 'Razor': 15,
      'Disruptor': 87, 'Mars': 129, 'Lion': 52, 'Hoodwink': 123, 'Phantom Assassin': 44,
      'Grimstroke': 50, 'Invoker': 74, 'Pudge': 14, 'Abaddon': 102, 'Clinkz': 56,
      'Rubick': 86, 'Sand King': 16, 'Crystal Maiden': 25, 'Necrophos': 36, 'Drow Ranger': 6,
      'Sniper': 35, 'Omniknight': 57, 'Weaver': 63, 'Axe': 2, 'Kunkka': 23,
      'Snapfire': 103, 'Oracle': 111, 'Viper': 47, 'Wraith King': 7, 'Zeus': 22,
      'Witch Doctor': 30, 'Slardar': 28, 'Spirit Breaker': 71, 'Shadow Shaman': 27, 'Dazzle': 50,
      'Luna': 48, 'Primal Beast': 137, 'Shadow Fiend': 11, 'Puck': 13, 'Ogre Magi': 84,
      'Night Stalker': 60, 'Keeper of the Light': 90, 'Bane': 3, 'Death Prophet': 43,
      'Tusk': 100, 'Bloodseeker': 4, 'Bristleback': 99, 'Centaur Warrunner': 96, 'Clockwerk': 51,
      'Dark Seer': 55, 'Earthshaker': 7, 'Elder Titan': 103, 'Huskar': 59, 'Legion Commander': 104,
      'Magnus': 97, 'Monkey King': 114, 'Phantom Lancer': 12, 'Queen of Pain': 39, 'Slark': 93,
      'Tempest Double': 113, 'Tiny': 19, 'Treant Protector': 83, 'Troll Warlord': 95, 'Underlord': 108,
      'Undying': 85, 'Ursa': 70, 'Vengeful Spirit': 20, 'Venomancer': 40, 'Viper': 47,
      'Visage': 92, 'Void Spirit': 126, 'Warlock': 37, 'Windranger': 21, 'Winter Wyvern': 112,
      // KK8 New Heroes
      'Templar Assassin': 46, 'Ember Spirit': 106, 'Phoenix': 110, 'Medusa': 94, 'Anti-Mage': 1,
      'Ancient Apparition': 68
    };
    return heroMapping[heroName] || null;
  };

  // Create the tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from('kernel_kups')
    .insert({
      name: 'Kernel Kup 8',
      league_id: null,
      series_id: null,
      tournament_start_date: '2025-06-07',
      tournament_end_date: '2025-06-07',
      description: 'Kernel Kup 8 - The battle continues!',
      prize_pool: null,
      status: 'completed',
      is_manual: true,
    })
    .select()
    .single();

  if (tournamentError) throw new Error(`Failed to create tournament: ${tournamentError.message}`);
  console.log(`✅ Tournament created: ${tournament.name} (ID: ${tournament.id})\n`);

  // Player data - ONLY NEW PLAYERS
  const newPlayers = [
    { account_id: 165923715, name: 'The Concept Of Wasp' },
    { account_id: 2702024, name: 'CGarty' },
    { account_id: 1516523759, name: 'alexithymia' },
    { account_id: 42336030, name: 'Pr1de' },
  ];

  // EXISTING PLAYERS - just find them
  const existingPlayers = [
    { account_id: 20413194, name: '.4leks...' },
    { account_id: 237313649, name: 'Mavi' },
    { account_id: 31649623, name: 'Moumpt' },
    { account_id: 176598507, name: 'businessCasual' },
    { account_id: 71794697, name: 'Z.T. Pastamancer' },
    { account_id: 32846586, name: 'Dr.Clayton' },
  ];

  console.log('👥 Creating NEW player profiles...');
  for (const player of newPlayers) {
    const playerId = await findOrCreatePlayer(supabase, player.account_id, player.name);
    playerMap.set(player.account_id, playerId);
    playerNameMap.set(player.account_id, player.name);
    console.log(`   ✅ ${player.name} (ID: ${playerId})`);
  }
  console.log(`\n✅ ${newPlayers.length} new players created\n`);

  console.log('👥 Finding EXISTING player profiles...');
  for (const player of existingPlayers) {
    const playerId = await findOrCreatePlayer(supabase, player.account_id, player.name);
    playerMap.set(player.account_id, playerId);
    playerNameMap.set(player.account_id, player.name);
    console.log(`   ✅ ${player.name} (ID: ${playerId})`);
  }
  console.log(`\n✅ ${existingPlayers.length} existing players found\n`);

  // Team data
  const teams = [
    { team_id: 9658546, name: 'CornHub', tag: 'CHUB' },
    { team_id: 99999993, name: 'Tiny Corn Energy', tag: 'TCE' }, // Fake ID
  ];

  console.log('🏟️ Creating teams...');
  for (const team of teams) {
    const teamId = await findOrCreateTeam(supabase, tournament.id, team.team_id, team.name, team.tag);
    teamMap.set(team.team_id, teamId);
    console.log(`   ✅ ${team.name} (ID: ${teamId})`);
  }
  console.log('\n✅ All 2 teams created\n');

  // Match 1: CornHub vs Tiny Corn Energy (TCE wins 43-11)
  console.log('⚔️ Creating Match 1...');
  const { data: match1, error: match1Error } = await supabase
    .from('kkup_matches')
    .insert({
      kernel_kup_id: tournament.id,
      team1_id: teamMap.get(9658546),
      team2_id: teamMap.get(99999993),
      winner_team_id: teamMap.get(99999993),
      team1_score: 11,
      team2_score: 43,
      stage: 'group_stage',
      status: 'completed',
      scheduled_time: '2025-06-07T18:08:00Z',
      match_id: 8325737430,
      series_id: 1
    })
    .select()
    .single();

  if (match1Error) throw new Error(`Failed to create match 1: ${match1Error.message}`);
  console.log(`   ✅ Match 1 created (ID: ${match1.id})`);

  // Match 1 Stats
  const match1Stats = [
    // CornHub
    { player: 165923715, hero: 'Templar Assassin', k: 0, d: 6, a: 3, lh: 145, dn: 9, gpm: 316, xpm: 399, level: 14, nw: 7612 },
    { player: 2702024, hero: 'Ember Spirit', k: 2, d: 6, a: 5, lh: 167, dn: 6, gpm: 440, xpm: 532, level: 16, nw: 12508 },
    { player: 32846586, hero: 'Axe', k: 4, d: 6, a: 4, lh: 145, dn: 1, gpm: 405, xpm: 507, level: 16, nw: 10848 },
    { player: 237313649, hero: 'Pudge', k: 3, d: 13, a: 2, lh: 30, dn: 2, gpm: 236, xpm: 263, level: 11, nw: 5431 },
    { player: 31649623, hero: 'Oracle', k: 0, d: 12, a: 9, lh: 10, dn: 1, gpm: 175, xpm: 209, level: 10, nw: 3942 },
    
    // Tiny Corn Energy (Winners)
    { player: 20413194, hero: 'Ursa', k: 10, d: 1, a: 8, lh: 189, dn: 21, gpm: 607, xpm: 591, level: 17, nw: 17140 },
    { player: 1516523759, hero: 'Phoenix', k: 16, d: 2, a: 17, lh: 149, dn: 11, gpm: 579, xpm: 656, level: 18, nw: 15923 },
    { player: 71794697, hero: 'Wraith King', k: 10, d: 0, a: 12, lh: 205, dn: 10, gpm: 626, xpm: 624, level: 18, nw: 18427 },
    { player: 176598507, hero: 'Vengeful Spirit', k: 3, d: 4, a: 22, lh: 41, dn: 6, gpm: 342, xpm: 435, level: 15, nw: 8846 },
    { player: 42336030, hero: 'Warlock', k: 3, d: 4, a: 18, lh: 40, dn: 6, gpm: 327, xpm: 463, level: 15, nw: 8517 },
  ];

  console.log(`   📊 Inserting ${match1Stats.length} player stats...`);
  for (const stat of match1Stats) {
    const teamId = [165923715, 2702024, 32846586, 237313649, 31649623].includes(stat.player) 
      ? teamMap.get(9658546)
      : teamMap.get(99999993);

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
      last_hits: stat.lh,
      denies: stat.dn,
      gpm: stat.gpm,
      xpm: stat.xpm,
      level: stat.level,
      net_worth: stat.nw,
      gold: null,
      hero_damage: null,
      tower_damage: null,
      hero_healing: null,
      item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
      is_winner: teamId === teamMap.get(99999993),
    });

    if (statsError) throw new Error(`Failed to insert stats for player ${stat.player}: ${statsError.message}`);
  }
  console.log(`   ✅ ${match1Stats.length} stats inserted\n`);

  // Match 2: CornHub vs Tiny Corn Energy (CornHub wins 53-47)
  console.log('⚔️ Creating Match 2...');
  const { data: match2, error: match2Error } = await supabase
    .from('kkup_matches')
    .insert({
      kernel_kup_id: tournament.id,
      team1_id: teamMap.get(9658546),
      team2_id: teamMap.get(99999993),
      winner_team_id: teamMap.get(9658546),
      team1_score: 53,
      team2_score: 47,
      stage: 'group_stage',
      status: 'completed',
      scheduled_time: '2025-06-07T18:59:00Z',
      match_id: 8325766174,
      series_id: 1
    })
    .select()
    .single();

  if (match2Error) throw new Error(`Failed to create match 2: ${match2Error.message}`);
  console.log(`   ✅ Match 2 created (ID: ${match2.id})`);

  // Match 2 Stats
  const match2Stats = [
    // CornHub (Winners)
    { player: 165923715, hero: 'Razor', k: 20, d: 11, a: 23, lh: 243, dn: 15, gpm: 569, xpm: 917, level: 28, nw: 32292 },
    { player: 2702024, hero: 'Phantom Assassin', k: 24, d: 7, a: 13, lh: 596, dn: 23, gpm: 827, xpm: 1078, level: 30, nw: 38518 },
    { player: 32846586, hero: 'Medusa', k: 1, d: 11, a: 24, lh: 231, dn: 7, gpm: 401, xpm: 707, level: 26, nw: 22986 },
    { player: 237313649, hero: 'Disruptor', k: 3, d: 13, a: 25, lh: 187, dn: 3, gpm: 370, xpm: 583, level: 25, nw: 16550 },
    { player: 31649623, hero: 'Abaddon', k: 4, d: 5, a: 35, lh: 61, dn: 2, gpm: 387, xpm: 765, level: 27, nw: 21495 },
    
    // Tiny Corn Energy
    { player: 20413194, hero: 'Anti-Mage', k: 19, d: 7, a: 14, lh: 470, dn: 30, gpm: 725, xpm: 1077, level: 30, nw: 33360 },
    { player: 1516523759, hero: 'Windranger', k: 7, d: 14, a: 23, lh: 276, dn: 28, gpm: 457, xpm: 526, level: 24, nw: 18101 },
    { player: 71794697, hero: 'Centaur Warrunner', k: 11, d: 8, a: 21, lh: 298, dn: 12, gpm: 486, xpm: 711, level: 26, nw: 23571 },
    { player: 176598507, hero: 'Pudge', k: 2, d: 17, a: 23, lh: 102, dn: 8, gpm: 327, xpm: 624, level: 25, nw: 15034 },
    { player: 42336030, hero: 'Ancient Apparition', k: 8, d: 7, a: 24, lh: 43, dn: 5, gpm: 298, xpm: 494, level: 23, nw: 13831 },
  ];

  console.log(`   📊 Inserting ${match2Stats.length} player stats...`);
  for (const stat of match2Stats) {
    const teamId = [165923715, 2702024, 32846586, 237313649, 31649623].includes(stat.player) 
      ? teamMap.get(9658546)
      : teamMap.get(99999993);

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
      last_hits: stat.lh,
      denies: stat.dn,
      gpm: stat.gpm,
      xpm: stat.xpm,
      level: stat.level,
      net_worth: stat.nw,
      gold: null,
      hero_damage: null,
      tower_damage: null,
      hero_healing: null,
      item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
      is_winner: teamId === teamMap.get(9658546),
    });

    if (statsError) throw new Error(`Failed to insert stats for player ${stat.player}: ${statsError.message}`);
  }
  console.log(`   ✅ ${match2Stats.length} stats inserted\n`);

  // Match 3: CornHub vs Tiny Corn Energy (TCE wins 38-14)
  console.log('⚔️ Creating Match 3...');
  const { data: match3, error: match3Error } = await supabase
    .from('kkup_matches')
    .insert({
      kernel_kup_id: tournament.id,
      team1_id: teamMap.get(9658546),
      team2_id: teamMap.get(99999993),
      winner_team_id: teamMap.get(99999993),
      team1_score: 14,
      team2_score: 38,
      stage: 'group_stage',
      status: 'completed',
      scheduled_time: '2025-06-07T20:26:00Z',
      match_id: 8325821924,
      series_id: 1
    })
    .select()
    .single();

  if (match3Error) throw new Error(`Failed to create match 3: ${match3Error.message}`);
  console.log(`   ✅ Match 3 created (ID: ${match3.id})`);

  // Match 3 Stats
  const match3Stats = [
    // CornHub
    { player: 165923715, hero: 'Death Prophet', k: 3, d: 8, a: 5, lh: 236, dn: 12, gpm: 370, xpm: 501, level: 20, nw: 14514 },
    { player: 2702024, hero: 'Luna', k: 5, d: 5, a: 6, lh: 713, dn: 7, gpm: 747, xpm: 698, level: 24, nw: 28917 },
    { player: 32846586, hero: 'Underlord', k: 2, d: 9, a: 6, lh: 261, dn: 16, gpm: 365, xpm: 498, level: 20, nw: 15797 },
    { player: 237313649, hero: 'Disruptor', k: 1, d: 9, a: 13, lh: 86, dn: 0, gpm: 245, xpm: 384, level: 18, nw: 7746 },
    { player: 31649623, hero: 'Abaddon', k: 3, d: 7, a: 8, lh: 42, dn: 1, gpm: 260, xpm: 395, level: 18, nw: 10743 },
    
    // Tiny Corn Energy (Winners)
    { player: 20413194, hero: 'Lifestealer', k: 15, d: 1, a: 15, lh: 496, dn: 31, gpm: 796, xpm: 1069, level: 28, nw: 36432 },
    { player: 1516523759, hero: 'Snapfire', k: 11, d: 1, a: 17, lh: 412, dn: 31, gpm: 691, xpm: 990, level: 27, nw: 30417 },
    { player: 71794697, hero: 'Wraith King', k: 3, d: 1, a: 21, lh: 358, dn: 8, gpm: 563, xpm: 856, level: 26, nw: 25791 },
    { player: 176598507, hero: 'Hoodwink', k: 4, d: 7, a: 17, lh: 114, dn: 11, gpm: 364, xpm: 531, level: 21, nw: 15388 },
    { player: 42336030, hero: 'Warlock', k: 5, d: 4, a: 24, lh: 33, dn: 2, gpm: 305, xpm: 503, level: 20, nw: 12712 },
  ];

  console.log(`   📊 Inserting ${match3Stats.length} player stats...`);
  for (const stat of match3Stats) {
    const teamId = [165923715, 2702024, 32846586, 237313649, 31649623].includes(stat.player) 
      ? teamMap.get(9658546)
      : teamMap.get(99999993);

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
      last_hits: stat.lh,
      denies: stat.dn,
      gpm: stat.gpm,
      xpm: stat.xpm,
      level: stat.level,
      net_worth: stat.nw,
      gold: null,
      hero_damage: null,
      tower_damage: null,
      hero_healing: null,
      item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
      is_winner: teamId === teamMap.get(99999993),
    });

    if (statsError) throw new Error(`Failed to insert stats for player ${stat.player}: ${statsError.message}`);
  }
  console.log(`   ✅ ${match3Stats.length} stats inserted\n`);

  // Add rosters to teams
  console.log('👥 Adding team rosters...');
  
  // CornHub roster
  const cornhubPlayers = [165923715, 2702024, 32846586, 237313649, 31649623];
  for (const accountId of cornhubPlayers) {
    const { error: rosterError } = await supabase.from('kkup_team_players').insert({
      team_id: teamMap.get(9658546),
      player_profile_id: playerMap.get(accountId),
    });
    if (rosterError) console.error(`   ⚠️ Failed to add player ${accountId} to CornHub: ${rosterError.message}`);
  }
  console.log(`   ✅ CornHub roster added (${cornhubPlayers.length} players)`);

  // Tiny Corn Energy roster
  const tcePlayers = [20413194, 1516523759, 71794697, 176598507, 42336030];
  for (const accountId of tcePlayers) {
    const { error: rosterError } = await supabase.from('kkup_team_players').insert({
      team_id: teamMap.get(99999993),
      player_profile_id: playerMap.get(accountId),
    });
    if (rosterError) console.error(`   ⚠️ Failed to add player ${accountId} to Tiny Corn Energy: ${rosterError.message}`);
  }
  console.log(`   ✅ Tiny Corn Energy roster added (${tcePlayers.length} players)`);

  console.log('\n🌽 ============================================');
  console.log('🌽 KERNEL KUP 8 SEEDED SUCCESSFULLY!');
  console.log('🌽 ============================================');
  console.log(`✅ Tournament: ${tournament.name}`);
  console.log(`✅ Teams: 2`);
  console.log(`✅ Matches: 3`);
  console.log(`✅ Player Stats: 30`);
  console.log(`✅ Series Winner: Tiny Corn Energy (2-1)`);
  console.log('🌽 ============================================\n');

  return {
    success: true,
    message: 'Kernel Kup 8 seeded successfully',
    tournament_id: tournament.id,
    matchCount: 3
  };
}