import { createClient } from "jsr:@supabase/supabase-js@2";
import { findOrCreatePlayer, findOrCreateTeam } from "./kkup-helpers.tsx";

/**
 * 🌽 KERNEL KUP 1 SEED DATA
 * Tournament Date: October 6, 2023
 * Teams: Mutha Shuckas, Big Dick LaNm, CaramellRoshan
 * Championship: CaramellRoshan (won finals vs Big Dick LaNm)
 */

export async function seedKernelKup1(supabase: any, anonSupabase: any, authUser: any) {
  console.log('🌽 ============================================');
  console.log('🌽 SEEDING KERNEL KUP 1 DATA');
  console.log('🌽 ============================================');

  const playerMap = new Map<number, string>(); // account_id -> kkup_players.id
  const teamMap = new Map<number, string>(); // team_id -> kkup_teams.id
  const playerNameMap = new Map<number, string>(); // account_id -> player_name

  // Helper to get hero ID by name
  const getHeroId = (heroName: string): number | null => {
    const heroMapping: Record<string, number> = {
      // KK1 Heroes
      'Windranger': 21, 'Lich': 31, 'Lifestealer': 54, 'Vengeful Spirit': 20, 'Razor': 15,
      'Disruptor': 87, 'Mars': 129, 'Lion': 52, 'Hoodwink': 123, 'Phantom Assassin': 44,
      'Grimstroke': 50, 'Invoker': 74, 'Pudge': 14, 'Abaddon': 102, 'Clinkz': 56,
      'Rubick': 86, 'Sand King': 16, 'Crystal Maiden': 25, 'Necrophos': 36, 'Drow Ranger': 6,
      'Sniper': 35, 'Omniknight': 57, 'Weaver': 63, 'Axe': 2, 'Kunkka': 23,
      'Snapfire': 103, 'Oracle': 111, 'Viper': 47
    };
    return heroMapping[heroName] || null;
  };

  // Create the tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from('kernel_kups')
    .insert({
      name: 'Kernel Kup 1',
      league_id: null,
      series_id: null,
      tournament_start_date: '2023-10-06',
      tournament_end_date: '2023-10-06',
      description: 'The inaugural Kernel Kup tournament - where it all began!',
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
    // Big Dick LaNm
    { account_id: 70081477, name: 'Board Man Gets Paid' },
    { account_id: 124479422, name: 'Derk' },
    { account_id: 12096575, name: 'Bojangles' },
    { account_id: 121916760, name: 'Kiragos' },
    { account_id: 63826936, name: 'Sarah' },
    
    // Mutha Shuckas
    { account_id: 52899534, name: 'Roctopus' },
    { account_id: 39058303, name: 'Chhampion' },
    { account_id: 192347173, name: 'Ms Anthrope' },
    { account_id: 145749278, name: 'Replayz' },
    { account_id: 85522662, name: 'FancyPants' },
    
    // CaramellRoshan
    { account_id: 20720988, name: 'Stream Stray Kids \'Do It\' on YT' },
    { account_id: 102620357, name: 'C Squad' }, // CORRECTED ID
    { account_id: 208895278, name: 'businessCasual' },
    { account_id: 31649623, name: 'Moumpt' },
    { account_id: 32846586, name: 'Dr Clayton' },
  ];

  console.log('👥 Creating/finding player profiles...');
  for (const player of players) {
    const playerId = await findOrCreatePlayer(supabase, player.account_id, player.name);
    playerMap.set(player.account_id, playerId);
    playerNameMap.set(player.account_id, player.name);
    console.log(`   ✅ ${player.name} (ID: ${playerId})`);
  }
  console.log(`\n✅ All ${players.length} players ready\n`);

  // Team data
  const teams = [
    { team_id: 9400971, name: 'Mutha Shuckas', tag: 'MSH' },
    { team_id: 3212656, name: 'Big Dick LaNm', tag: 'BDLN' },
    { team_id: 8476119, name: 'CaramellRoshan', tag: 'CARA' }
  ];

  console.log('🏟️ Creating teams...');
  for (const team of teams) {
    const teamId = await findOrCreateTeam(supabase, tournament.id, team.team_id, team.name, team.tag);
    teamMap.set(team.team_id, teamId);
    console.log(`   ✅ ${team.name} (ID: ${teamId})`);
  }
  console.log('\n✅ All 3 teams created\n');

  // Match 1: Mutha Shuckas vs Big Dick LaNm
  console.log('⚔️ Creating Match 1...');
  const { data: match1, error: match1Error } = await supabase
    .from('kkup_matches')
    .insert({
      kernel_kup_id: tournament.id,
      team1_id: teamMap.get(9400971),
      team2_id: teamMap.get(3212656),
      winner_team_id: teamMap.get(3212656),
      team1_score: 32,
      team2_score: 31,
      stage: 'group_stage',
      status: 'completed',
      scheduled_time: '2023-10-06T00:00:00Z',
      match_id: null,
      series_id: 1
    })
    .select()
    .single();

  if (match1Error) throw new Error(`Failed to create match 1: ${match1Error.message}`);
  console.log(`   ✅ Match 1 created (ID: ${match1.id})`);

  // Match 1 Stats
  const match1Stats = [
    // Big Dick LaNm (Winners)
    { player: 70081477, hero: 'Windranger', k: 9, d: 4, a: 12, nw: 19280 },
    { player: 124479422, hero: 'Lich', k: 1, d: 10, a: 15, nw: 11717 },
    { player: 12096575, hero: 'Lifestealer', k: 10, d: 3, a: 16, nw: 28957 },
    { player: 121916760, hero: 'Vengeful Spirit', k: 2, d: 7, a: 15, nw: 12999 },
    { player: 63826936, hero: 'Razor', k: 8, d: 8, a: 14, nw: 22856 },
    
    // Mutha Shuckas
    { player: 52899534, hero: 'Disruptor', k: 4, d: 4, a: 21, nw: 11878 },
    { player: 39058303, hero: 'Mars', k: 5, d: 9, a: 13, nw: 10698 },
    { player: 192347173, hero: 'Lion', k: 5, d: 8, a: 13, nw: 9271 },
    { player: 145749278, hero: 'Hoodwink', k: 7, d: 4, a: 20, nw: 17575 },
    { player: 85522662, hero: 'Phantom Assassin', k: 9, d: 6, a: 7, nw: 20334 },
  ];

  console.log(`   📊 Inserting ${match1Stats.length} player stats...`);
  for (const stat of match1Stats) {
    const teamId = [70081477, 124479422, 12096575, 121916760, 63826936].includes(stat.player) 
      ? teamMap.get(3212656)
      : teamMap.get(9400971);

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
      last_hits: null,
      denies: null,
      gpm: null,
      xpm: null,
      level: null,
      net_worth: stat.nw,
      gold: null,
      hero_damage: null,
      tower_damage: null,
      hero_healing: null,
      item_0: null, item_1: null, item_2: null, item_3: null, item_4: null, item_5: null,
      is_winner: teamId === teamMap.get(3212656)
    });

    if (statsError) {
      console.error(`      ❌ Failed to insert stats for player ${stat.player}:`, statsError);
      throw new Error(`Failed to insert player stats: ${statsError.message}`);
    }
  }
  console.log(`   ✅ All ${match1Stats.length} player stats inserted\n`);

  // Match 2: Mutha Shuckas vs CaramellRoshan
  console.log('⚔️ Creating Match 2...');
  const { data: match2, error: match2Error } = await supabase
    .from('kkup_matches')
    .insert({
      kernel_kup_id: tournament.id,
      team1_id: teamMap.get(9400971),
      team2_id: teamMap.get(8476119),
      winner_team_id: teamMap.get(8476119),
      team1_score: 22,
      team2_score: 35,
      stage: 'group_stage',
      status: 'completed',
      scheduled_time: '2023-10-06T21:34:00Z',
      match_id: 7369357917,
      series_id: 2,
      dotabuff_url: 'https://www.dotabuff.com/matches/7369357917'
    })
    .select()
    .single();

  if (match2Error) throw new Error(`Failed to create match 2: ${match2Error.message}`);
  console.log(`   ✅ Match 2 created (ID: ${match2.id})`);

  // Match 2 Stats
  const match2Stats = [
    // CaramellRoshan (Winners)
    { player: 20720988, hero: 'Grimstroke', k: 5, d: 6, a: 16, nw: 13252, gpm: 420, xpm: 463, lh: 106, dn: 16, lvl: 17 },
    { player: 102620357, hero: 'Invoker', k: 11, d: 2, a: 13, nw: 19928, gpm: 570, xpm: 610, lh: 172, dn: 11, lvl: 19 },
    { player: 208895278, hero: 'Pudge', k: 8, d: 7, a: 15, nw: 12699, gpm: 384, xpm: 490, lh: 51, dn: 4, lvl: 17 },
    { player: 31649623, hero: 'Abaddon', k: 2, d: 5, a: 15, nw: 9857, gpm: 316, xpm: 489, lh: 37, dn: 4, lvl: 17 },
    { player: 32846586, hero: 'Clinkz', k: 9, d: 2, a: 10, nw: 18097, gpm: 517, xpm: 615, lh: 174, dn: 15, lvl: 20 },
    
    // Mutha Shuckas
    { player: 52899534, hero: 'Rubick', k: 3, d: 5, a: 17, nw: 10977, gpm: 327, xpm: 483, lh: 91, dn: 4, lvl: 17 },
    { player: 39058303, hero: 'Sand King', k: 3, d: 5, a: 14, nw: 9951, gpm: 321, xpm: 358, lh: 108, dn: 1, lvl: 15 },
    { player: 192347173, hero: 'Crystal Maiden', k: 5, d: 12, a: 7, nw: 6073, gpm: 218, xpm: 283, lh: 28, dn: 0, lvl: 13 },
    { player: 145749278, hero: 'Necrophos', k: 7, d: 7, a: 8, nw: 13567, gpm: 394, xpm: 505, lh: 160, dn: 7, lvl: 18 },
    { player: 85522662, hero: 'Drow Ranger', k: 4, d: 6, a: 6, nw: 14051, gpm: 452, xpm: 530, lh: 231, dn: 10, lvl: 18 },
  ];

  console.log(`   📊 Inserting ${match2Stats.length} player stats...`);
  for (const stat of match2Stats) {
    const teamId = [20720988, 102620357, 208895278, 31649623, 32846586].includes(stat.player) 
      ? teamMap.get(8476119) 
      : teamMap.get(9400971);

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
      is_winner: teamId === teamMap.get(8476119)
    });

    if (statsError) {
      console.error(`      ❌ Failed to insert stats for player ${stat.player}:`, statsError);
      throw new Error(`Failed to insert player stats: ${statsError.message}`);
    }
  }
  console.log(`   ✅ All ${match2Stats.length} player stats inserted\n`);

  // Match 3: Big Dick LaNm vs CaramellRoshan (Finals)
  console.log('⚔️ Creating Match 3 (Finals)...');
  const { data: match3, error: match3Error } = await supabase
    .from('kkup_matches')
    .insert({
      kernel_kup_id: tournament.id,
      team1_id: teamMap.get(3212656),
      team2_id: teamMap.get(8476119),
      winner_team_id: teamMap.get(8476119),
      team1_score: 37,
      team2_score: 51,
      stage: 'group_stage',
      status: 'completed',
      scheduled_time: '2023-10-06T22:30:00Z',
      match_id: 7369392996,
      series_id: 3,
      dotabuff_url: 'https://www.dotabuff.com/matches/7369392996'
    })
    .select()
    .single();

  if (match3Error) throw new Error(`Failed to create match 3: ${match3Error.message}`);
  console.log(`   ✅ Match 3 created (ID: ${match3.id})`);

  // Match 3 Stats
  const match3Stats = [
    // Big Dick LaNm
    { player: 70081477, hero: 'Sniper', k: 11, d: 7, a: 10, nw: 22037, gpm: 533, xpm: 625, lh: 283, dn: 13, lvl: 23 },
    { player: 124479422, hero: 'Omniknight', k: 1, d: 13, a: 11, nw: 8053, gpm: 212, xpm: 428, lh: 27, dn: 3, lvl: 19 },
    { player: 12096575, hero: 'Weaver', k: 17, d: 9, a: 10, nw: 26324, gpm: 689, xpm: 885, lh: 357, dn: 6, lvl: 28 },
    { player: 121916760, hero: 'Vengeful Spirit', k: 5, d: 12, a: 8, nw: 12059, gpm: 300, xpm: 533, lh: 111, dn: 1, lvl: 21 },
    { player: 63826936, hero: 'Razor', k: 3, d: 11, a: 17, nw: 17956, gpm: 432, xpm: 505, lh: 223, dn: 26, lvl: 21 },
    
    // CaramellRoshan (Winners)
    { player: 20720988, hero: 'Axe', k: 16, d: 12, a: 17, nw: 25364, gpm: 574, xpm: 740, lh: 222, dn: 0, lvl: 25 },
    { player: 102620357, hero: 'Kunkka', k: 5, d: 7, a: 28, nw: 20710, gpm: 531, xpm: 708, lh: 256, dn: 2, lvl: 24 },
    { player: 208895278, hero: 'Snapfire', k: 9, d: 7, a: 26, nw: 19253, gpm: 457, xpm: 682, lh: 123, dn: 2, lvl: 24 },
    { player: 31649623, hero: 'Oracle', k: 2, d: 7, a: 28, nw: 14522, gpm: 360, xpm: 579, lh: 49, dn: 1, lvl: 22 },
    { player: 32846586, hero: 'Viper', k: 19, d: 4, a: 18, nw: 28046, gpm: 622, xpm: 764, lh: 235, dn: 23, lvl: 26 },
  ];

  console.log(`   📊 Inserting ${match3Stats.length} player stats...`);
  for (const stat of match3Stats) {
    const teamId = [20720988, 102620357, 208895278, 31649623, 32846586].includes(stat.player) 
      ? teamMap.get(8476119) 
      : teamMap.get(3212656);

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
      is_winner: teamId === teamMap.get(8476119)
    });

    if (statsError) {
      console.error(`      ❌ Failed to insert stats for player ${stat.player}:`, statsError);
      throw new Error(`Failed to insert player stats: ${statsError.message}`);
    }
  }
  console.log(`   ✅ All ${match3Stats.length} player stats inserted\n`);

  // Backfill team rosters
  console.log('🔧 Backfilling team rosters...');
  const { data: allStats } = await supabase
    .from('kkup_match_player_stats')
    .select('player_profile_id, team_id')
    .in('match_id', [match1.id, match2.id, match3.id])
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
  console.log('✅ KERNEL KUP 1 SEEDED SUCCESSFULLY');
  console.log('✅ ============================================\n');

  return {
    success: true,
    tournament_id: tournament.id,
    tournament_name: tournament.name,
    teams_created: 3,
    matches_created: 3,
    stats_created: match1Stats.length + match2Stats.length + match3Stats.length
  };
}