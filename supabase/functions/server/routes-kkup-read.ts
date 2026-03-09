/**
 * KKUP Read Routes -- all GET endpoints for Kernel Kup tournament data
 * Routes: list, detail, hall-of-fame (players/teams/combined), players, awards, achievements
 */
import type { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { PREFIX, getHeroName, getHeroIdFromName, getSteamLogoUrl } from "./helpers.ts";

// Cache key and TTL for total Dota hero count from OpenDota
const DOTA_HERO_COUNT_KEY = 'dota_total_hero_count';
const HERO_COUNT_TTL_DAYS = 30;

async function getTotalDotaHeroCount(): Promise<number> {
  try {
    // Check KV cache first
    const cached = await kv.get(DOTA_HERO_COUNT_KEY);
    if (cached && cached.count && cached.fetched_at) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < HERO_COUNT_TTL_DAYS * 24 * 60 * 60 * 1000) {
        return cached.count;
      }
    }

    // Fetch from OpenDota API (free, no auth required)
    const res = await fetch('https://api.opendota.com/api/heroes');
    if (res.ok) {
      const heroes = await res.json();
      const count = Array.isArray(heroes) ? heroes.length : 0;
      if (count > 0) {
        await kv.set(DOTA_HERO_COUNT_KEY, { count, fetched_at: new Date().toISOString() });
        console.log(`Cached total Dota hero count: ${count}`);
        return count;
      }
    }

    // Fallback if API fails — return cached value if we have one, otherwise 126
    return cached?.count || 126;
  } catch (err) {
    console.error('Failed to fetch Dota hero count:', err);
    return 126; // safe fallback
  }
}

export function registerKkupReadRoutes(app: Hono, supabase: any, _anonSupabase: any) {

  // ============================================================
  // HALL OF FAME — must be registered BEFORE /:kkup_id routes
  // ============================================================

  // Hall of Fame — players (aggregated across all tournaments)
  app.get(`${PREFIX}/kkup/hall-of-fame/players`, async (c) => {
    try {
      const startTime = Date.now();

      // Parallel fetch: stats, tournaments, users, and prize awards all at once
      const [statsResult, tournamentsResult, usersResult, prizeAwardsResult] = await Promise.all([
        supabase
          .from('kkup_player_match_stats')
          .select(`
            id, match_id, person_id, team_id, hero, kills, deaths, assists,
            last_hits, denies, gpm, xpm, net_worth,
            person:kkup_persons!person_id(id, steam_id, display_name, tournaments_won, prize_money_won),
            match:kkup_matches!match_id(id, tournament_id, winning_team_id)
          `),
        supabase
          .from('kkup_tournaments')
          .select('id, winning_team_id, tournament_type, popd_kernel_1_person_id, popd_kernel_2_person_id'),
        supabase
          .from('users')
          .select('id, discord_username, discord_avatar, rank_id, prestige_level, role, steam_id')
          .not('steam_id', 'is', null),
        supabase
          .from('prize_awards')
          .select('person_id, amount_cents, status, tournament_id')
          .not('status', 'in', '("revoked")'),
      ]);

      const { data: allStats, error: statsError } = statsResult;
      if (statsError) {
        console.error('Hall of Fame stats error:', statsError);
        return c.json({ error: 'Failed to fetch stats', details: statsError.message }, 500);
      }

      const { data: tournaments } = tournamentsResult;
      const { data: usersWithSteam } = usersResult;

      // Aggregate prize winnings per person_id (overall + by tournament type)
      const { data: prizeAwards } = prizeAwardsResult;
      const prizeByPerson = new Map<string, { overall: number; kernel_kup: number; heaps_n_hooks: number }>();
      const tournamentTypeMap = new Map<string, string>(); // built below after tournaments

      const winningTeamIds = new Set((tournaments || []).map((t: any) => t.winning_team_id).filter(Boolean));

      // Build tournament lookup: id → { type, winning_team_id }
      const tournamentMap = new Map<string, any>();
      (tournaments || []).forEach((t: any) => { tournamentMap.set(t.id, t); });

      // Aggregate prize winnings by person (now that tournamentMap is available)
      (prizeAwards || []).forEach((a: any) => {
        if (!a.person_id) return;
        const tType = a.tournament_id ? (tournamentMap.get(a.tournament_id)?.tournament_type || 'kernel_kup') : 'kernel_kup';
        if (!prizeByPerson.has(a.person_id)) prizeByPerson.set(a.person_id, { overall: 0, kernel_kup: 0, heaps_n_hooks: 0 });
        const entry = prizeByPerson.get(a.person_id)!;
        entry.overall += a.amount_cents || 0;
        if (tType === 'heaps_n_hooks') entry.heaps_n_hooks += a.amount_cents || 0;
        else entry.kernel_kup += a.amount_cents || 0;
      });

      // Count Pop'd Kernel (MVP) awards per person — split by tournament type
      const popdKernelCount = new Map<string, number>(); // overall
      const popdKernelByType = new Map<string, { kernel_kup: number; heaps_n_hooks: number }>(); // by type

      (tournaments || []).forEach((t: any) => {
        const tType = t.tournament_type || 'kernel_kup';
        for (const pid of [t.popd_kernel_1_person_id, t.popd_kernel_2_person_id]) {
          if (!pid) continue;
          popdKernelCount.set(pid, (popdKernelCount.get(pid) || 0) + 1);
          if (!popdKernelByType.has(pid)) popdKernelByType.set(pid, { kernel_kup: 0, heaps_n_hooks: 0 });
          const entry = popdKernelByType.get(pid)!;
          if (tType === 'heaps_n_hooks') entry.heaps_n_hooks++;
          else entry.kernel_kup++;
        }
      });

      // Get winning team rosters to determine champions — also track per tournament_type
      const { data: winningRosters } = await supabase
        .from('kkup_team_rosters')
        .select('team_id, person_id')
        .in('team_id', Array.from(winningTeamIds));

      // Build reverse map: winning_team_id → tournament (so we can look up tournament_type from a team_id)
      const winningTeamToTournament = new Map<string, any>();
      (tournaments || []).forEach((t: any) => {
        if (t.winning_team_id) winningTeamToTournament.set(t.winning_team_id, t);
      });

      const championsByType = new Map<string, { kernel_kup: number; heaps_n_hooks: number }>(); // by type

      (winningRosters || []).forEach((r: any) => {
        const tInfo = winningTeamToTournament.get(r.team_id);
        const tType = tInfo?.tournament_type || 'kernel_kup';
        if (!championsByType.has(r.person_id)) championsByType.set(r.person_id, { kernel_kup: 0, heaps_n_hooks: 0 });
        const entry = championsByType.get(r.person_id)!;
        if (tType === 'heaps_n_hooks') entry.heaps_n_hooks++;
        else entry.kernel_kup++;
      });

      const championPersonIds = new Set(championsByType.keys());

      // Try to link kkup_persons to discord users via steam_id
      const userBySteamId = new Map();
      (usersWithSteam || []).forEach((u: any) => {
        if (u.steam_id) userBySteamId.set(u.steam_id, u);
      });

      // Helper to create empty stat bucket
      const emptyBucket = () => ({
        totalMatches: 0, totalWins: 0, totalLosses: 0,
        totalKills: 0, totalDeaths: 0, totalAssists: 0,
        totalLastHits: 0, totalDenies: 0, totalGPM: 0, totalXPM: 0,
        totalNetWorth: 0, bestKills: 0, bestGPM: 0, bestXPM: 0,
        heroes: new Map<string, { games: number; wins: number }>(),
        tournaments: new Set<string>(),
      });

      // Aggregate stats by person, split by overall / kernel_kup / heaps_n_hooks
      const playerAgg = new Map<string, any>();
      const uniqueHeroes = new Set<string>();
      const uniqueMatches = new Set<string>();

      (allStats || []).forEach((s: any) => {
        if (!s.person) return;
        const pid = s.person_id;
        uniqueMatches.add(s.match_id);
        if (s.hero) uniqueHeroes.add(s.hero.toLowerCase());

        const tournamentId = s.match?.tournament_id;
        const tInfo = tournamentId ? tournamentMap.get(tournamentId) : null;
        const tType = tInfo?.tournament_type || 'kernel_kup';

        if (!playerAgg.has(pid)) {
          playerAgg.set(pid, {
            person_id: pid,
            steam_id: s.person.steam_id,
            display_name: s.person.display_name,
            tournaments_won: s.person.tournaments_won || 0,
            prize_money_won_dollars: parseFloat(s.person.prize_money_won || '0'),
            overall: emptyBucket(),
            kernel_kup: emptyBucket(),
            heaps_n_hooks: emptyBucket(),
          });
        }

        const p = playerAgg.get(pid)!;
        const isWin = s.match && s.team_id === s.match.winning_team_id;

        // Accumulate into both overall and type-specific buckets
        const buckets = [p.overall, tType === 'heaps_n_hooks' ? p.heaps_n_hooks : p.kernel_kup];
        for (const b of buckets) {
          b.totalMatches++;
          if (isWin) b.totalWins++;
          else b.totalLosses++;
          b.totalKills += s.kills || 0;
          b.totalDeaths += s.deaths || 0;
          b.totalAssists += s.assists || 0;
          b.totalLastHits += s.last_hits || 0;
          b.totalDenies += s.denies || 0;
          b.totalGPM += s.gpm || 0;
          b.totalXPM += s.xpm || 0;
          b.totalNetWorth += s.net_worth || 0;
          if ((s.kills || 0) > b.bestKills) b.bestKills = s.kills;
          if ((s.gpm || 0) > b.bestGPM) b.bestGPM = s.gpm;
          if ((s.xpm || 0) > b.bestXPM) b.bestXPM = s.xpm;
          if (tournamentId) b.tournaments.add(tournamentId);
          if (s.hero) {
            if (!b.heroes.has(s.hero)) b.heroes.set(s.hero, { games: 0, wins: 0 });
            const h = b.heroes.get(s.hero)!;
            h.games++;
            if (isWin) h.wins++;
          }
        }
      });

      // Batch-load all avatars from KV in a single query
      const allAvatarEntries = await kv.getByPrefix('kkup_avatar:');
      const hofAvatarMap = new Map<string, string>();
      allAvatarEntries.forEach((entry: any) => {
        const steamId = entry.key?.replace('kkup_avatar:', '');
        if (steamId && entry.avatar_url) hofAvatarMap.set(steamId, entry.avatar_url);
      });

      // Helper to build a stats object from a bucket
      const buildStats = (bucket: any, personId: string, champCount: number, mvpCount: number, prizeCents: number) => {
        if (bucket.totalMatches === 0) return null;
        const winrate = bucket.totalMatches > 0 ? ((bucket.totalWins / bucket.totalMatches) * 100).toFixed(1) : '0.0';
        const avgKDA = bucket.totalDeaths > 0 ? ((bucket.totalKills + bucket.totalAssists) / bucket.totalDeaths).toFixed(2) : (bucket.totalKills + bucket.totalAssists).toFixed(2);
        const avgGPM = bucket.totalMatches > 0 ? (bucket.totalGPM / bucket.totalMatches).toFixed(0) : '0';
        const avgXPM = bucket.totalMatches > 0 ? (bucket.totalXPM / bucket.totalMatches).toFixed(0) : '0';

        // Signature hero
        let signatureHero: any = null;
        let maxGames = 0;
        bucket.heroes.forEach((h: any, heroName: string) => {
          if (h.games > maxGames) {
            maxGames = h.games;
            const heroId = getHeroIdFromName(heroName);
            signatureHero = {
              hero_id: heroId,
              hero_name: heroName,
              games: h.games,
              wins: h.wins,
              winrate: h.games > 0 ? ((h.wins / h.games) * 100).toFixed(1) : '0.0',
            };
          }
        });

        return {
          totalTournaments: bucket.tournaments.size,
          totalMatches: bucket.totalMatches,
          totalWins: bucket.totalWins,
          totalLosses: bucket.totalLosses,
          winrate,
          totalKills: bucket.totalKills,
          totalDeaths: bucket.totalDeaths,
          totalAssists: bucket.totalAssists,
          totalLastHits: bucket.totalLastHits,
          totalDenies: bucket.totalDenies,
          avgKDA,
          avgGPM,
          avgXPM,
          totalNetWorth: bucket.totalNetWorth,
          avgNetWorth: bucket.totalMatches > 0 ? Math.round(bucket.totalNetWorth / bucket.totalMatches) : 0,
          championships: champCount,
          mvps: mvpCount,
          prizeWinnings: prizeCents,
          signatureHero,
          records: {
            bestKills: bucket.bestKills,
            bestGPM: bucket.bestGPM,
            bestXPM: bucket.bestXPM,
          },
        };
      };

      // Build response
      const players = Array.from(playerAgg.values()).map((p: any) => {
        const linkedUser = userBySteamId.get(p.steam_id);
        const avatarUrl = hofAvatarMap.get(p.steam_id) || null;
        const mvpCount = popdKernelCount.get(p.person_id) || 0;
        const kkMvps = popdKernelByType.get(p.person_id)?.kernel_kup || 0;
        const hnhMvps = popdKernelByType.get(p.person_id)?.heaps_n_hooks || 0;
        const overallChamps = championsByType.has(p.person_id)
          ? (championsByType.get(p.person_id)!.kernel_kup + championsByType.get(p.person_id)!.heaps_n_hooks)
          : (p.tournaments_won || 0);
        const kkChamps = championsByType.get(p.person_id)?.kernel_kup || 0;
        const hnhChamps = championsByType.get(p.person_id)?.heaps_n_hooks || 0;

        return {
          id: p.person_id,
          name: p.display_name,
          avatar_url: avatarUrl,
          steam_id: p.steam_id,
          user: linkedUser ? {
            id: linkedUser.id,
            discord_username: linkedUser.discord_username,
            discord_avatar: linkedUser.discord_avatar,
            rank_id: linkedUser.rank_id,
            prestige_level: linkedUser.prestige_level || 0,
            role: linkedUser.role,
          } : null,
          // For overall: use the greater of kkup_persons.prize_money_won (denormalized) vs prize_awards aggregate
          // This catches both historical manual entries and new award-system entries
          stats: buildStats(p.overall, p.person_id, overallChamps, mvpCount,
            Math.max(Math.round(p.prize_money_won_dollars * 100), prizeByPerson.get(p.person_id)?.overall || 0)),
          // For per-type: use prize_awards aggregate (has tournament_id → type mapping)
          kernelKupStats: buildStats(p.kernel_kup, p.person_id, kkChamps, kkMvps, prizeByPerson.get(p.person_id)?.kernel_kup || 0),
          heapsNHooksStats: buildStats(p.heaps_n_hooks, p.person_id, hnhChamps, hnhMvps, prizeByPerson.get(p.person_id)?.heaps_n_hooks || 0),
        };
      }).filter((p: any) => p.stats !== null)
        .sort((a: any, b: any) => {
          const aCh = a.stats?.championships || 0;
          const bCh = b.stats?.championships || 0;
          if (bCh !== aCh) return bCh - aCh;
          return (b.stats?.totalMatches || 0) - (a.stats?.totalMatches || 0);
        });

      const responseTime = Date.now() - startTime;
      console.log(`Hall of Fame players: ${players.length} players in ${responseTime}ms`);

      // Fetch total Dota hero count (cached, non-blocking for response)
      const totalDotaHeroes = await getTotalDotaHeroCount();

      return c.json({
        players,
        overallStats: {
          totalUniquePlayers: players.length,
          totalUniqueMatches: uniqueMatches.size,
          totalChampions: Array.from(championPersonIds).length,
          totalUniqueHeroes: uniqueHeroes.size,
          totalDotaHeroes,
        },
      });
    } catch (error: any) {
      console.error('Hall of Fame players error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Hall of Fame — teams (deduped by master_team_id for canonical identity)
  app.get(`${PREFIX}/kkup/hall-of-fame/teams`, async (c) => {
    try {
      // Parallel fetch all data needed for team aggregation
      const [teamsResult, tournamentsResult, matchesResult, statsResult, rostersResult, masterTeamsResult] = await Promise.all([
        supabase.from('kkup_teams').select('id, tournament_id, team_name, team_tag, valve_team_id, logo_url, master_team_id'),
        supabase.from('kkup_tournaments').select('id, winning_team_id, tournament_type, popd_kernel_1_person_id, popd_kernel_2_person_id'),
        supabase.from('kkup_matches').select('id, tournament_id, radiant_team_id, dire_team_id, winning_team_id'),
        supabase.from('kkup_player_match_stats').select('match_id, team_id, kills, deaths, assists, gpm, xpm'),
        supabase.from('kkup_team_rosters').select('team_id, person_id'),
        supabase.from('kkup_master_teams').select('id, current_name, current_tag, current_logo_url, total_prize_money_won'),
      ]);

      const allTeams = teamsResult.data || [];
      const tournaments = tournamentsResult.data || [];
      const allMatches = matchesResult.data || [];
      const allStats = statsResult.data || [];
      const allRosters = rostersResult.data || [];
      const masterTeamsData = masterTeamsResult.data || [];

      // Build lookups
      const tournamentMap = new Map<string, any>();
      tournaments.forEach((t: any) => { tournamentMap.set(t.id, t); });

      const matchTournamentMap = new Map<string, string>();
      allMatches.forEach((m: any) => { matchTournamentMap.set(m.id, m.tournament_id); });

      const masterTeamMap = new Map<string, any>();
      masterTeamsData.forEach((mt: any) => { masterTeamMap.set(mt.id, mt); });

      const teamIdToTournamentId = new Map<string, string>();
      allTeams.forEach((t: any) => { if (t.tournament_id) teamIdToTournamentId.set(t.id, t.tournament_id); });

      const teamDbIdToMaster = new Map<string, string>();
      allTeams.forEach((t: any) => { if (t.master_team_id) teamDbIdToMaster.set(t.id, t.master_team_id); });

      const personToTeamIds = new Map<string, Set<string>>();
      allRosters.forEach((r: any) => {
        if (!personToTeamIds.has(r.person_id)) personToTeamIds.set(r.person_id, new Set());
        personToTeamIds.get(r.person_id)!.add(r.team_id);
      });

      // Count Pop'd Kernels per master team
      const teamPopdKernels = new Map<string, { overall: number; kernel_kup: number; heaps_n_hooks: number }>();
      tournaments.forEach((t: any) => {
        const tType = t.tournament_type || 'kernel_kup';
        for (const pid of [t.popd_kernel_1_person_id, t.popd_kernel_2_person_id]) {
          if (!pid) continue;
          const personTeams = personToTeamIds.get(pid);
          if (!personTeams) continue;
          for (const teamId of personTeams) {
            if (teamIdToTournamentId.get(teamId) === t.id) {
              const mtId = teamDbIdToMaster.get(teamId);
              if (mtId) {
                if (!teamPopdKernels.has(mtId)) teamPopdKernels.set(mtId, { overall: 0, kernel_kup: 0, heaps_n_hooks: 0 });
                const entry = teamPopdKernels.get(mtId)!;
                entry.overall++;
                if (tType === 'heaps_n_hooks') entry.heaps_n_hooks++; else entry.kernel_kup++;
              }
              break;
            }
          }
        }
      });

      // Deduplicate teams by master_team_id (canonical identity across tournaments)
      type TeamBucket = { tournaments: Set<string>; championships: number; totalMatches: number; totalWins: number; totalLosses: number; totalKills: number; totalDeaths: number; totalAssists: number; totalGPM: number; totalXPM: number; statCount: number; };
      const emptyTeamBucket = (): TeamBucket => ({
        tournaments: new Set(), championships: 0,
        totalMatches: 0, totalWins: 0, totalLosses: 0,
        totalKills: 0, totalDeaths: 0, totalAssists: 0,
        totalGPM: 0, totalXPM: 0, statCount: 0,
      });

      const teamsByMaster = new Map<string, {
        name: string; tag: string | null; logo_url: string | null;
        teamDbIds: Set<string>;
        overall: TeamBucket; kernel_kup: TeamBucket; heaps_n_hooks: TeamBucket;
      }>();

      allTeams.forEach((t: any) => {
        const mtId = t.master_team_id;
        if (!mtId) return;

        if (!teamsByMaster.has(mtId)) {
          const mt = masterTeamMap.get(mtId);
          teamsByMaster.set(mtId, {
            name: mt?.current_name || t.team_name,
            tag: mt?.current_tag || t.team_tag,
            logo_url: mt?.current_logo_url || t.logo_url || (t.valve_team_id ? getSteamLogoUrl(t.valve_team_id) : null),
            teamDbIds: new Set(),
            overall: emptyTeamBucket(), kernel_kup: emptyTeamBucket(), heaps_n_hooks: emptyTeamBucket(),
          });
        }

        const entry = teamsByMaster.get(mtId)!;
        entry.teamDbIds.add(t.id);

        const tInfo = t.tournament_id ? tournamentMap.get(t.tournament_id) : null;
        const tType = tInfo?.tournament_type || 'kernel_kup';
        if (tInfo && tInfo.winning_team_id === t.id) {
          entry.overall.championships++;
          if (tType === 'heaps_n_hooks') entry.heaps_n_hooks.championships++; else entry.kernel_kup.championships++;
        }
        if (tInfo) {
          entry.overall.tournaments.add(t.tournament_id);
          if (tType === 'heaps_n_hooks') entry.heaps_n_hooks.tournaments.add(t.tournament_id);
          else entry.kernel_kup.tournaments.add(t.tournament_id);
        }
      });

      // Aggregate match W/L by master team
      allMatches.forEach((m: any) => {
        const tInfo = m.tournament_id ? tournamentMap.get(m.tournament_id) : null;
        const tType = tInfo?.tournament_type || 'kernel_kup';
        const processTeam = (teamId: string) => {
          const mtId = teamDbIdToMaster.get(teamId);
          if (!mtId) return;
          const entry = teamsByMaster.get(mtId);
          if (!entry) return;
          for (const b of [entry.overall, tType === 'heaps_n_hooks' ? entry.heaps_n_hooks : entry.kernel_kup]) {
            b.totalMatches++;
            if (m.winning_team_id === teamId) b.totalWins++;
            else if (m.winning_team_id) b.totalLosses++;
          }
        };
        if (m.radiant_team_id) processTeam(m.radiant_team_id);
        if (m.dire_team_id) processTeam(m.dire_team_id);
      });

      // Aggregate player stats by master team
      allStats.forEach((s: any) => {
        if (!s.team_id) return;
        const mtId = teamDbIdToMaster.get(s.team_id);
        if (!mtId) return;
        const entry = teamsByMaster.get(mtId);
        if (!entry) return;
        const matchTournId = s.match_id ? matchTournamentMap.get(s.match_id) : null;
        const tInfo = matchTournId ? tournamentMap.get(matchTournId) : null;
        const tType = tInfo?.tournament_type || 'kernel_kup';
        for (const b of [entry.overall, tType === 'heaps_n_hooks' ? entry.heaps_n_hooks : entry.kernel_kup]) {
          b.totalKills += s.kills || 0; b.totalDeaths += s.deaths || 0; b.totalAssists += s.assists || 0;
          b.totalGPM += s.gpm || 0; b.totalXPM += s.xpm || 0; b.statCount++;
        }
      });

      // Build response arrays
      const buildTeamStats = (bucket: TeamBucket, mtId: string, name: string, tag: string | null, logo_url: string | null, popdKernels: number, prizeCents: number) => ({
        id: mtId, name, tag, logo_url,
        championships: bucket.championships, popdKernels, prizeWinnings: prizeCents,
        tournamentsPlayed: bucket.tournaments.size,
        totalMatches: bucket.totalMatches, totalWins: bucket.totalWins, totalLosses: bucket.totalLosses,
        winRate: bucket.totalMatches > 0 ? ((bucket.totalWins / bucket.totalMatches) * 100).toFixed(1) : '0.0',
        totalKills: bucket.totalKills, totalDeaths: bucket.totalDeaths, totalAssists: bucket.totalAssists,
        kda: bucket.totalDeaths > 0 ? ((bucket.totalKills + bucket.totalAssists) / bucket.totalDeaths).toFixed(2) : (bucket.totalKills + bucket.totalAssists).toFixed(2),
        avgKills: bucket.totalMatches > 0 ? (bucket.totalKills / bucket.totalMatches).toFixed(1) : '0',
        avgDeaths: bucket.totalMatches > 0 ? (bucket.totalDeaths / bucket.totalMatches).toFixed(1) : '0',
        avgAssists: bucket.totalMatches > 0 ? (bucket.totalAssists / bucket.totalMatches).toFixed(1) : '0',
        avgGPM: bucket.statCount > 0 ? (bucket.totalGPM / bucket.statCount).toFixed(0) : '0',
        avgXPM: bucket.statCount > 0 ? (bucket.totalXPM / bucket.statCount).toFixed(0) : '0',
      });

      const teamStatsAll: any[] = [];
      const kkTeams: any[] = [];
      const hnhTeams: any[] = [];

      teamsByMaster.forEach((entry, mtId) => {
        const pkData = teamPopdKernels.get(mtId);
        const mt = masterTeamMap.get(mtId);
        const totalPrizeCents = Math.round(parseFloat(mt?.total_prize_money_won || '0') * 100);
        if (entry.overall.totalMatches > 0) {
          teamStatsAll.push(buildTeamStats(entry.overall, mtId, entry.name, entry.tag, entry.logo_url, pkData?.overall || 0, totalPrizeCents));
        }
        if (entry.kernel_kup.totalMatches > 0) {
          kkTeams.push(buildTeamStats(entry.kernel_kup, mtId, entry.name, entry.tag, entry.logo_url, pkData?.kernel_kup || 0, 0));
        }
        if (entry.heaps_n_hooks.totalMatches > 0) {
          hnhTeams.push(buildTeamStats(entry.heaps_n_hooks, mtId, entry.name, entry.tag, entry.logo_url, pkData?.heaps_n_hooks || 0, 0));
        }
      });

      const sortTeams = (arr: any[]) => arr.sort((a: any, b: any) => {
        if (b.championships !== a.championships) return b.championships - a.championships;
        return b.totalWins - a.totalWins;
      });

      return c.json({
        teamStats: sortTeams(teamStatsAll),
        kernelKupTeamStats: sortTeams(kkTeams),
        heapsNHooksTeamStats: sortTeams(hnhTeams),
      });
    } catch (error: any) {
      console.error('Hall of Fame teams error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Hall of Fame — staff (aggregated across all tournaments)
  app.get(`${PREFIX}/kkup/hall-of-fame/staff`, async (c) => {
    try {
      const startTime = Date.now();

      // Parallel fetch: staff assignments, tournaments, users, and avatars
      const [staffResult, tournamentsResult, usersResult, avatarEntries] = await Promise.all([
        supabase
          .from('kkup_tournament_staff')
          .select(`
            id, tournament_id, person_id, role,
            person:kkup_persons!person_id(id, steam_id, display_name)
          `),
        supabase
          .from('kkup_tournaments')
          .select('id, name, tournament_type'),
        supabase
          .from('users')
          .select('id, discord_username, discord_avatar, rank_id, prestige_level, role, steam_id')
          .not('steam_id', 'is', null),
        kv.getByPrefix('kkup_avatar:'),
      ]);

      const { data: allStaff, error: staffError } = staffResult;
      if (staffError) {
        console.error('Hall of Fame staff error:', staffError);
        return c.json({ error: 'Failed to fetch staff data', details: staffError.message }, 500);
      }

      const { data: tournaments } = tournamentsResult;
      const { data: usersWithSteam } = usersResult;

      // Build lookups
      const tournamentMap = new Map<string, any>();
      (tournaments || []).forEach((t: any) => { tournamentMap.set(t.id, t); });

      const userBySteamId = new Map();
      (usersWithSteam || []).forEach((u: any) => {
        if (u.steam_id) userBySteamId.set(u.steam_id, u);
      });

      const avatarMap = new Map<string, string>();
      avatarEntries.forEach((entry: any) => {
        const steamId = entry.key?.replace('kkup_avatar:', '');
        if (steamId && entry.avatar_url) avatarMap.set(steamId, entry.avatar_url);
      });

      // Aggregate staff by person
      const staffAgg = new Map<string, {
        person_id: string;
        display_name: string;
        steam_id: string | null;
        roles: Set<string>;
        overall: { tournaments: Set<string>; roles: Map<string, number> };
        kernel_kup: { tournaments: Set<string>; roles: Map<string, number> };
        heaps_n_hooks: { tournaments: Set<string>; roles: Map<string, number> };
      }>();

      (allStaff || []).forEach((s: any) => {
        if (!s.person) return;
        const pid = s.person_id;
        const tInfo = s.tournament_id ? tournamentMap.get(s.tournament_id) : null;
        const tType = tInfo?.tournament_type || 'kernel_kup';

        if (!staffAgg.has(pid)) {
          staffAgg.set(pid, {
            person_id: pid,
            display_name: s.person.display_name,
            steam_id: s.person.steam_id,
            roles: new Set(),
            overall: { tournaments: new Set(), roles: new Map() },
            kernel_kup: { tournaments: new Set(), roles: new Map() },
            heaps_n_hooks: { tournaments: new Set(), roles: new Map() },
          });
        }

        const entry = staffAgg.get(pid)!;
        const role = s.role || 'Unknown';
        entry.roles.add(role);

        // Overall
        entry.overall.tournaments.add(s.tournament_id);
        entry.overall.roles.set(role, (entry.overall.roles.get(role) || 0) + 1);

        // Type-specific
        const typeBucket = tType === 'heaps_n_hooks' ? entry.heaps_n_hooks : entry.kernel_kup;
        typeBucket.tournaments.add(s.tournament_id);
        typeBucket.roles.set(role, (typeBucket.roles.get(role) || 0) + 1);
      });

      // Build response
      const buildStaffStats = (bucket: { tournaments: Set<string>; roles: Map<string, number> }) => {
        if (bucket.tournaments.size === 0) return null;
        // Find primary role (most frequent)
        let primaryRole = 'Unknown';
        let maxCount = 0;
        bucket.roles.forEach((count, role) => {
          if (count > maxCount) { maxCount = count; primaryRole = role; }
        });
        return {
          totalTournaments: bucket.tournaments.size,
          primaryRole,
          allRoles: Array.from(bucket.roles.entries()).map(([role, count]) => ({ role, count }))
            .sort((a, b) => b.count - a.count),
        };
      };

      const staffMembers = Array.from(staffAgg.values()).map((s) => {
        const linkedUser = s.steam_id ? userBySteamId.get(s.steam_id) : null;
        const avatarUrl = s.steam_id ? avatarMap.get(s.steam_id) || null : null;
        return {
          id: s.person_id,
          name: s.display_name,
          avatar_url: avatarUrl,
          steam_id: s.steam_id,
          user: linkedUser ? {
            id: linkedUser.id,
            discord_username: linkedUser.discord_username,
            discord_avatar: linkedUser.discord_avatar,
            rank_id: linkedUser.rank_id,
            prestige_level: linkedUser.prestige_level || 0,
            role: linkedUser.role,
          } : null,
          allRoles: Array.from(s.roles),
          stats: buildStaffStats(s.overall),
          kernelKupStats: buildStaffStats(s.kernel_kup),
          heapsNHooksStats: buildStaffStats(s.heaps_n_hooks),
        };
      }).filter((s) => s.stats !== null)
        .sort((a, b) => (b.stats?.totalTournaments || 0) - (a.stats?.totalTournaments || 0));

      const responseTime = Date.now() - startTime;
      console.log(`Hall of Fame staff: ${staffMembers.length} staff in ${responseTime}ms`);

      return c.json({ staff: staffMembers });
    } catch (error: any) {
      console.error('Hall of Fame staff error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Hall of Fame — coaches (aggregated from kkup_teams.coach_person_id)
  app.get(`${PREFIX}/kkup/hall-of-fame/coaches`, async (c) => {
    try {
      const startTime = Date.now();

      // Parallel fetch: teams (with coach), tournaments, matches, player stats, users, avatars
      const [teamsResult, tournamentsResult, matchesResult, statsResult, usersResult, avatarEntries] = await Promise.all([
        supabase.from('kkup_teams').select('id, tournament_id, team_name, team_tag, coach_person_id, master_team_id, logo_url')
          .not('coach_person_id', 'is', null),
        supabase.from('kkup_tournaments').select('id, name, tournament_type, winning_team_id'),
        supabase.from('kkup_matches').select('id, tournament_id, radiant_team_id, dire_team_id, winning_team_id'),
        supabase.from('kkup_player_match_stats').select('match_id, team_id, kills, deaths, assists, gpm, xpm'),
        supabase.from('users').select('id, discord_username, discord_avatar, rank_id, prestige_level, role, steam_id')
          .not('steam_id', 'is', null),
        kv.getByPrefix('kkup_avatar:'),
      ]);

      const coachedTeams = teamsResult.data || [];
      const tournaments = tournamentsResult.data || [];
      const allMatches = matchesResult.data || [];
      const allStats = statsResult.data || [];
      const usersWithSteam = usersResult.data || [];

      // Build lookups
      const tournamentMap = new Map<string, any>();
      tournaments.forEach((t: any) => { tournamentMap.set(t.id, t); });

      const matchTournamentMap = new Map<string, string>();
      allMatches.forEach((m: any) => { matchTournamentMap.set(m.id, m.tournament_id); });

      const userBySteamId = new Map<string, any>();
      usersWithSteam.forEach((u: any) => { if (u.steam_id) userBySteamId.set(u.steam_id, u); });

      const avatarMap = new Map<string, string>();
      avatarEntries.forEach((entry: any) => {
        const steamId = entry.key?.replace('kkup_avatar:', '');
        if (steamId && entry.avatar_url) avatarMap.set(steamId, entry.avatar_url);
      });

      // Get person details for all coaches
      const coachPersonIds = [...new Set(coachedTeams.map((t: any) => t.coach_person_id))];
      const { data: coachPersons } = await supabase
        .from('kkup_persons')
        .select('id, steam_id, display_name')
        .in('id', coachPersonIds);

      const personMap = new Map<string, any>();
      (coachPersons || []).forEach((p: any) => { personMap.set(p.id, p); });

      // Build match W/L per team (kkup_teams.id → {wins, losses, totalMatches})
      const teamMatchStats = new Map<string, { totalMatches: number; wins: number; losses: number }>();
      const teamDbIds = new Set(coachedTeams.map((t: any) => t.id));
      allMatches.forEach((m: any) => {
        for (const teamId of [m.radiant_team_id, m.dire_team_id]) {
          if (!teamId || !teamDbIds.has(teamId)) continue;
          if (!teamMatchStats.has(teamId)) teamMatchStats.set(teamId, { totalMatches: 0, wins: 0, losses: 0 });
          const s = teamMatchStats.get(teamId)!;
          s.totalMatches++;
          if (m.winning_team_id === teamId) s.wins++;
          else if (m.winning_team_id) s.losses++;
        }
      });

      // Build team avg stats (GPM, XPM, kills, etc.) per team
      const teamAggStats = new Map<string, { totalKills: number; totalDeaths: number; totalAssists: number; totalGPM: number; totalXPM: number; statCount: number }>();
      allStats.forEach((s: any) => {
        if (!s.team_id || !teamDbIds.has(s.team_id)) return;
        if (!teamAggStats.has(s.team_id)) teamAggStats.set(s.team_id, { totalKills: 0, totalDeaths: 0, totalAssists: 0, totalGPM: 0, totalXPM: 0, statCount: 0 });
        const a = teamAggStats.get(s.team_id)!;
        a.totalKills += s.kills || 0; a.totalDeaths += s.deaths || 0; a.totalAssists += s.assists || 0;
        a.totalGPM += s.gpm || 0; a.totalXPM += s.xpm || 0; a.statCount++;
      });

      // Aggregate per coach_person_id, split by tournament type
      type CoachBucket = {
        tournaments: Set<string>; championships: number;
        totalMatches: number; totalWins: number; totalLosses: number;
        teamsCoached: Set<string>; // master_team_ids
        teamNames: Set<string>;
      };
      const emptyCoachBucket = (): CoachBucket => ({
        tournaments: new Set(), championships: 0,
        totalMatches: 0, totalWins: 0, totalLosses: 0,
        teamsCoached: new Set(), teamNames: new Set(),
      });

      const coachAgg = new Map<string, {
        person_id: string; steam_id: string | null; display_name: string;
        overall: CoachBucket; kernel_kup: CoachBucket; heaps_n_hooks: CoachBucket;
      }>();

      coachedTeams.forEach((t: any) => {
        const pid = t.coach_person_id;
        const person = personMap.get(pid);
        if (!person) return;

        const tInfo = t.tournament_id ? tournamentMap.get(t.tournament_id) : null;
        const tType = tInfo?.tournament_type || 'kernel_kup';

        if (!coachAgg.has(pid)) {
          coachAgg.set(pid, {
            person_id: pid,
            steam_id: person.steam_id,
            display_name: person.display_name,
            overall: emptyCoachBucket(), kernel_kup: emptyCoachBucket(), heaps_n_hooks: emptyCoachBucket(),
          });
        }

        const entry = coachAgg.get(pid)!;
        const buckets = [entry.overall, tType === 'heaps_n_hooks' ? entry.heaps_n_hooks : entry.kernel_kup];

        const matchStats = teamMatchStats.get(t.id);
        const isChampion = tInfo && tInfo.winning_team_id === t.id;

        for (const b of buckets) {
          b.tournaments.add(t.tournament_id);
          if (t.master_team_id) b.teamsCoached.add(t.master_team_id);
          b.teamNames.add(t.team_name);
          if (isChampion) b.championships++;
          if (matchStats) {
            b.totalMatches += matchStats.totalMatches;
            b.totalWins += matchStats.wins;
            b.totalLosses += matchStats.losses;
          }
        }
      });

      // Build response
      const buildCoachStats = (bucket: CoachBucket) => {
        if (bucket.tournaments.size === 0) return null;
        return {
          totalTournaments: bucket.tournaments.size,
          championships: bucket.championships,
          teamsCoached: bucket.teamsCoached.size,
          teamNames: Array.from(bucket.teamNames),
          totalMatches: bucket.totalMatches,
          totalWins: bucket.totalWins,
          totalLosses: bucket.totalLosses,
          winrate: bucket.totalMatches > 0 ? ((bucket.totalWins / bucket.totalMatches) * 100).toFixed(1) : '0.0',
        };
      };

      const coaches = Array.from(coachAgg.values()).map((c) => {
        const linkedUser = c.steam_id ? userBySteamId.get(c.steam_id) : null;
        const avatarUrl = c.steam_id ? avatarMap.get(c.steam_id) || null : null;
        return {
          id: c.person_id,
          name: c.display_name,
          avatar_url: avatarUrl,
          steam_id: c.steam_id,
          user: linkedUser ? {
            id: linkedUser.id,
            discord_username: linkedUser.discord_username,
            discord_avatar: linkedUser.discord_avatar,
            rank_id: linkedUser.rank_id,
            prestige_level: linkedUser.prestige_level || 0,
            role: linkedUser.role,
          } : null,
          stats: buildCoachStats(c.overall),
          kernelKupStats: buildCoachStats(c.kernel_kup),
          heapsNHooksStats: buildCoachStats(c.heaps_n_hooks),
        };
      }).filter((c) => c.stats !== null)
        .sort((a, b) => {
          const aCh = a.stats?.championships || 0;
          const bCh = b.stats?.championships || 0;
          if (bCh !== aCh) return bCh - aCh;
          return (b.stats?.totalTournaments || 0) - (a.stats?.totalTournaments || 0);
        });

      const responseTime = Date.now() - startTime;
      console.log(`Hall of Fame coaches: ${coaches.length} coaches in ${responseTime}ms`);

      return c.json({ coaches });
    } catch (error: any) {
      console.error('Hall of Fame coaches error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Hall of Fame — combined
  app.get(`${PREFIX}/kkup/hall-of-fame`, async (c) => {
    return c.json({
      players: [], teamStats: [], kernelKupTeamStats: [], heapsNHooksTeamStats: [],
      overallStats: { totalUniquePlayers: 0, totalUniqueMatches: 0, totalChampions: 0, totalUniqueHeroes: 0 },
      message: 'Use /hall-of-fame/players and /hall-of-fame/teams endpoints for data.'
    });
  });

  // ============================================================
  // OTHER ROUTES
  // ============================================================

  // Get user's achievements
  app.get(`${PREFIX}/kkup/user/:user_id/achievements`, async (c) => {
    return c.json({ achievements: [] });
  });

  // List all Kernel Kups
  app.get(`${PREFIX}/kkup`, async (c) => {
    try {
      const { data: tournaments, error } = await supabase
        .from('kkup_tournaments').select('*').order('tournament_start_date', { ascending: true });
      if (error) {
        console.error('Fetch Kernel Kups error:', error);
        return c.json({ error: 'Failed to fetch Kernel Kups' }, 500);
      }
      return c.json({ tournaments: tournaments || [] });
    } catch (error: any) {
      console.error('Get Kernel Kups error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Get players for a Kernel Kup
  app.get(`${PREFIX}/kkup/:kkup_id/players`, async (c, next) => {
    const kkupId = c.req.param('kkup_id');
    if (kkupId === 'hall-of-fame' || kkupId === 'tournaments') return await next();
    try {
      if (!kkupId) return c.json({ error: 'Kernel Kup ID is required' }, 400);
      const { data: teams } = await supabase
        .from('kkup_teams').select('id').eq('tournament_id', kkupId);
      const teamIds = teams?.map((t: any) => t.id) || [];
      if (teamIds.length === 0) return c.json({ players: [] });

      const { data: rosters } = await supabase
        .from('kkup_team_rosters')
        .select(`person_id, person:kkup_persons!person_id(id, steam_id, display_name)`)
        .in('team_id', teamIds);

      const uniquePlayers = new Map();
      (rosters || []).forEach((r: any) => {
        if (r.person && !uniquePlayers.has(r.person.id)) {
          uniquePlayers.set(r.person.id, r.person);
        }
      });
      const players = Array.from(uniquePlayers.values()).sort((a: any, b: any) =>
        (a.display_name || '').localeCompare(b.display_name || '')
      );
      return c.json({ players });
    } catch (error: any) {
      console.error('Get Kernel Kup players error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Get awards for a Kernel Kup
  app.get(`${PREFIX}/kkup/:kernel_kup_id/awards`, async (c, next) => {
    const kkupId = c.req.param('kernel_kup_id');
    if (kkupId === 'hall-of-fame' || kkupId === 'tournaments') return await next();
    try {
      // Get tournament for winning_team_id and popd_kernel data
      const { data: tournament } = await supabase
        .from('kkup_tournaments')
        .select('winning_team_id, winning_team_name, popd_kernel_1_person_id, popd_kernel_2_person_id')
        .eq('id', kkupId).single();

      let currentChampion = null;
      if (tournament?.winning_team_id) {
        const { data: team } = await supabase
          .from('kkup_teams').select('id, team_name').eq('id', tournament.winning_team_id).single();
        if (team) {
          currentChampion = { team_id: team.id, team_name: team.team_name, team_logo: null };
        }
      }

      const popdKernelWinners: any[] = [];
      for (const pid of [tournament?.popd_kernel_1_person_id, tournament?.popd_kernel_2_person_id]) {
        if (pid) {
          const { data: person } = await supabase
            .from('kkup_persons').select('id, display_name, steam_id').eq('id', pid).single();
          if (person) {
            popdKernelWinners.push({
              player_id: person.id, player_name: person.display_name,
              player_steam_id: person.steam_id, player_avatar: null,
            });
          }
        }
      }

      return c.json({ championship: currentChampion, popdKernelWinners });
    } catch (error: any) {
      console.error('Get current awards error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Get achievements for a tournament — DEPRECATED
  app.get(`${PREFIX}/kkup/:kkup_id/achievements`, async (c) => {
    return c.json({ achievements: [], message: 'Achievements are deprecated. Awards are managed via /connect/award-batch.' });
  });

  // ============================================================
  // TOURNAMENT DETAIL — the big endpoint
  // ============================================================

  app.get(`${PREFIX}/kkup/:kkup_id`, async (c, next) => {
    const kkupId = c.req.param('kkup_id');
    if (kkupId === 'hall-of-fame' || kkupId === 'tournaments') return await next();

    try {
      const startTime = Date.now();

      // 1. Fetch tournament
      const { data: rawTournament, error: tournamentError } = await supabase
        .from('kkup_tournaments').select('*').eq('id', kkupId).single();
      if (tournamentError || !rawTournament) {
        console.error('Tournament not found:', kkupId, tournamentError?.message);
        return c.json({ error: 'Tournament not found' }, 404);
      }

      // Resolve Pop'd Kernel names from person IDs
      let popdKernel1Name: string | null = null;
      let popdKernel2Name: string | null = null;
      const popdIds = [rawTournament.popd_kernel_1_person_id, rawTournament.popd_kernel_2_person_id].filter(Boolean);
      if (popdIds.length > 0) {
        const { data: popdPersons } = await supabase
          .from('kkup_persons')
          .select('id, display_name')
          .in('id', popdIds);
        if (popdPersons) {
          for (const p of popdPersons) {
            if (p.id === rawTournament.popd_kernel_1_person_id) popdKernel1Name = p.display_name;
            if (p.id === rawTournament.popd_kernel_2_person_id) popdKernel2Name = p.display_name;
          }
        }
      }

      const tournament = {
        id: rawTournament.id,
        name: rawTournament.name,
        league_id: rawTournament.league_id,
        tournament_start_date: rawTournament.tournament_start_date,
        tournament_end_date: rawTournament.tournament_end_date,
        prize_pool: rawTournament.prize_pool ? String(rawTournament.prize_pool) : '0',
        prize_pool_donations: rawTournament.prize_pool_donations ?? 0,
        status: rawTournament.status,
        description: rawTournament.description,
        tournament_type: rawTournament.tournament_type,
        twitch_channel: rawTournament.twitch_url_1 || null,
        twitch_url_1: rawTournament.twitch_url_1,
        twitch_url_2: rawTournament.twitch_url_2,
        youtube_url: rawTournament.youtube_url,
        youtube_playlist_url: rawTournament.youtube_url,
        cover_photo_url: null,
        winning_team_id: rawTournament.winning_team_id,
        winning_team_name: rawTournament.winning_team_name,
        popd_kernel_1_person_id: rawTournament.popd_kernel_1_person_id,
        popd_kernel_2_person_id: rawTournament.popd_kernel_2_person_id,
        popd_kernel_1_name: popdKernel1Name,
        popd_kernel_2_name: popdKernel2Name,
        staff_count: rawTournament.staff_count,
        team_count: rawTournament.team_count,
        player_count: rawTournament.player_count,
        match_count: rawTournament.match_count,
        player_match_stats_count: rawTournament.player_match_stats_count,
        created_at: rawTournament.created_at,
      };

      // 2. Fetch teams
      const { data: rawTeams } = await supabase
        .from('kkup_teams').select('*').eq('tournament_id', kkupId);

      const teamLookup = new Map();
      (rawTeams || []).forEach((t: any) => {
        teamLookup.set(t.id, {
          id: t.id, name: t.team_name, tag: t.team_tag || t.team_name,
          logo_url: t.logo_url || (t.valve_team_id ? getSteamLogoUrl(t.valve_team_id) : null),
          valve_team_id: t.valve_team_id,
          captain_person_id: t.captain_person_id, coach_person_id: t.coach_person_id,
        });
      });

      // 3. Fetch matches
      const { data: rawMatches } = await supabase
        .from('kkup_matches').select('*').eq('tournament_id', kkupId)
        .order('match_date', { ascending: true });

      const matches = (rawMatches || []).map((m: any) => {
        const radiantTeam = teamLookup.get(m.radiant_team_id);
        const direTeam = teamLookup.get(m.dire_team_id);
        const winnerTeam = m.winning_team_id ? teamLookup.get(m.winning_team_id) : null;
        return {
          id: m.id,
          team1_id: m.radiant_team_id,
          team2_id: m.dire_team_id,
          team1: radiantTeam ? { id: radiantTeam.id, name: radiantTeam.name, tag: radiantTeam.tag, logo_url: radiantTeam.logo_url } : null,
          team2: direTeam ? { id: direTeam.id, name: direTeam.name, tag: direTeam.tag, logo_url: direTeam.logo_url } : null,
          winner: winnerTeam ? { id: winnerTeam.id, name: winnerTeam.name, tag: winnerTeam.tag, logo_url: winnerTeam.logo_url } : null,
          winner_team_id: m.winning_team_id,
          team1_score: m.radiant_team_score || 0,
          team2_score: m.dire_team_score || 0,
          stage: m.game_mode || 'captains_mode',
          status: m.winning_team_id ? 'completed' : 'scheduled',
          scheduled_time: m.match_date || m.match_time || rawTournament.tournament_start_date,
          match_id: m.external_match_id,
          series_id: m.series_id,
          match_length: m.match_length,
          match_time: m.match_time,
          match_date: m.match_date,
          game_mode: m.game_mode,
          radiant_person_id: m.radiant_person_id,
          dire_person_id: m.dire_person_id,
        };
      });

      // 4. Infer series_id
      let inferredSeriesCounter = 1000000;
      const seriesMap = new Map();
      for (const match of matches) {
        if (!match.series_id && match.team1_id && match.team2_id) {
          const teamPair = [match.team1_id, match.team2_id].sort();
          const seriesKey = `${teamPair[0]}-${teamPair[1]}`;
          if (!seriesMap.has(seriesKey)) seriesMap.set(seriesKey, String(inferredSeriesCounter++));
          match.series_id = seriesMap.get(seriesKey);
        }
      }

      // 5. Calculate records
      const teamRecords = new Map();
      teamLookup.forEach((_: any, teamId: string) => {
        teamRecords.set(teamId, { series_wins: 0, series_losses: 0, game_wins: 0, game_losses: 0, total_kills: 0 });
      });

      matches.forEach((match: any) => {
        if (match.winner_team_id) {
          if (match.team1_id === match.winner_team_id) {
            const r = teamRecords.get(match.team1_id); if (r) r.game_wins++;
            const o = teamRecords.get(match.team2_id); if (o) o.game_losses++;
          } else if (match.team2_id === match.winner_team_id) {
            const r = teamRecords.get(match.team2_id); if (r) r.game_wins++;
            const o = teamRecords.get(match.team1_id); if (o) o.game_losses++;
          }
        }
      });

      const seriesAgg = new Map();
      matches.forEach((match: any) => {
        if (!match.series_id) return;
        if (!seriesAgg.has(match.series_id)) {
          seriesAgg.set(match.series_id, { team1_id: match.team1_id, team2_id: match.team2_id, team1_wins: 0, team2_wins: 0 });
        }
        const s = seriesAgg.get(match.series_id);
        if (match.winner_team_id === s.team1_id) s.team1_wins++;
        else if (match.winner_team_id === s.team2_id) s.team2_wins++;
      });
      seriesAgg.forEach((series: any) => {
        if (series.team1_wins > series.team2_wins) {
          const r = teamRecords.get(series.team1_id); if (r) r.series_wins++;
          const o = teamRecords.get(series.team2_id); if (o) o.series_losses++;
        } else if (series.team2_wins > series.team1_wins) {
          const r = teamRecords.get(series.team2_id); if (r) r.series_wins++;
          const o = teamRecords.get(series.team1_id); if (o) o.series_losses++;
        }
      });

      // 6. Player match stats — resolve hero names to IDs
      const matchIds = matches.map((m: any) => m.id);
      let playerStats: any[] = [];
      if (matchIds.length > 0) {
        const { data: rawStats } = await supabase
          .from('kkup_player_match_stats')
          .select(`*, person:kkup_persons!person_id(steam_id, display_name)`)
          .in('match_id', matchIds)
          .order('match_id', { ascending: false })
          .order('team_id', { ascending: true });

        const matchWinnerMap = new Map();
        matches.forEach((m: any) => { matchWinnerMap.set(m.id, m.winner_team_id); });

        // Batch-load avatars from KV for all unique steam_ids
        const allSteamIds = new Set<string>();
        (rawStats || []).forEach((s: any) => {
          if (s.person?.steam_id) allSteamIds.add(s.person.steam_id);
        });
        const avatarMap = new Map<string, string>();
        for (const sid of allSteamIds) {
          const cached = await kv.get(`kkup_avatar:${sid}`);
          if (cached?.avatar_url) avatarMap.set(sid, cached.avatar_url);
        }

        playerStats = (rawStats || []).map((s: any) => {
          const team = s.team_id ? teamLookup.get(s.team_id) : null;
          const matchWinner = matchWinnerMap.get(s.match_id);
          const heroId = getHeroIdFromName(s.hero);
          const steamId = s.person?.steam_id || '';
          const avatarUrl = avatarMap.get(steamId) || null;
          return {
            id: s.id,
            match_id: s.match_id,
            team_id: s.team_id,
            player_name: s.person?.display_name || 'Unknown',
            steam_id: steamId,
            hero_id: heroId,
            hero_name: s.hero || 'Unknown',
            kills: s.kills || 0,
            deaths: s.deaths || 0,
            assists: s.assists || 0,
            last_hits: s.last_hits || 0,
            denies: s.denies || 0,
            gpm: s.gpm || 0,
            xpm: s.xpm || 0,
            net_worth: s.net_worth || 0,
            is_winner: s.team_id === matchWinner,
            account_id: parseInt(s.person?.steam_id || '0', 10),
            person_id: s.person_id,
            player: s.person ? {
              steam_id: s.person.steam_id,
              name: s.person.display_name,
              avatar_url: avatarUrl,
              dotabuff_url: s.person.steam_id ? `https://www.dotabuff.com/players/${s.person.steam_id}` : null,
              opendota_url: s.person.steam_id ? `https://www.opendota.com/players/${s.person.steam_id}` : null,
            } : null,
            team: team ? { id: team.id, name: team.name, tag: team.tag, logo_url: team.logo_url } : null,
          };
        });
      }

      // Update total kills per team
      playerStats.forEach((stat: any) => {
        if (stat.team_id) {
          const record = teamRecords.get(stat.team_id);
          if (record) record.total_kills += stat.kills || 0;
        }
      });

      // Build final teams array
      const teams = Array.from(teamLookup.values()).map((team: any) => {
        const record = teamRecords.get(team.id) || {};
        return {
          ...team,
          wins: record.game_wins || 0, losses: record.game_losses || 0,
          series_wins: record.series_wins || 0, series_losses: record.series_losses || 0,
          game_wins: record.game_wins || 0, game_losses: record.game_losses || 0,
          total_kills: record.total_kills || 0,
        };
      }).sort((a: any, b: any) => {
        if (b.series_wins !== a.series_wins) return b.series_wins - a.series_wins;
        return b.game_wins - a.game_wins;
      });

      // 7. Fetch rosters
      const teamIds = teams.map((t: any) => t.id);
      let rosters: any[] = [];
      if (teamIds.length > 0) {
        const { data: rawRosters } = await supabase
          .from('kkup_team_rosters')
          .select(`*, person:kkup_persons!person_id(steam_id, display_name)`)
          .in('team_id', teamIds);
        
        // Detect stand-ins: a person on multiple teams' rosters is a stand-in on teams
        // where they DON'T have the most match stats
        const rosterEntries = rawRosters || [];
        
        // Count match stats per person per team to determine "home" team
        const personTeamStats = new Map<string, Map<string, number>>(); // person_id → { team_id → match_count }
        playerStats.forEach((stat: any) => {
          if (!stat.team_id || !stat.person_id) return;
          if (!personTeamStats.has(stat.person_id)) personTeamStats.set(stat.person_id, new Map());
          const teamMap = personTeamStats.get(stat.person_id)!;
          teamMap.set(stat.team_id, (teamMap.get(stat.team_id) || 0) + 1);
        });

        // For each person on multiple teams, find their "home" team (most matches)
        const personHomeTeam = new Map<string, string>(); // person_id → home team_id
        const multiTeamPersons = new Set<string>();
        const personTeams = new Map<string, string[]>();
        rosterEntries.forEach((r: any) => {
          if (!personTeams.has(r.person_id)) personTeams.set(r.person_id, []);
          personTeams.get(r.person_id)!.push(r.team_id);
        });
        personTeams.forEach((teamList, personId) => {
          if (teamList.length > 1) {
            multiTeamPersons.add(personId);
            // Home team = team with most match stats
            const statsMap = personTeamStats.get(personId);
            if (statsMap) {
              let maxCount = 0;
              let homeTeamId = teamList[0];
              statsMap.forEach((count, tid) => {
                if (count > maxCount) { maxCount = count; homeTeamId = tid; }
              });
              personHomeTeam.set(personId, homeTeamId);
            } else {
              personHomeTeam.set(personId, teamList[0]);
            }
          }
        });

        rosters = rosterEntries.map((r: any) => ({
          ...r,
          is_standin: multiTeamPersons.has(r.person_id) && personHomeTeam.get(r.person_id) !== r.team_id,
        }));
      }

      // 8. Fetch staff — include avatars from KV cache
      const { data: rawStaff } = await supabase
        .from('kkup_tournament_staff')
        .select(`*, person:kkup_persons!person_id(steam_id, display_name)`)
        .eq('tournament_id', kkupId);

      // Collect staff steam_ids for avatar lookup (reuse existing avatarMap if possible)
      const staffSteamIds = (rawStaff || []).map((s: any) => s.person?.steam_id).filter(Boolean);
      const staffAvatarMap = new Map<string, string>();
      for (const sid of staffSteamIds) {
        // Check if already loaded from player stats avatarMap
        if (playerStats.length > 0) {
          const existing = playerStats.find((ps: any) => ps.steam_id === sid);
          if (existing?.player?.avatar_url) {
            staffAvatarMap.set(sid, existing.player.avatar_url);
            continue;
          }
        }
        const cached = await kv.get(`kkup_avatar:${sid}`);
        if (cached?.avatar_url) staffAvatarMap.set(sid, cached.avatar_url);
      }

      const staff = (rawStaff || []).map((s: any) => ({
        person_id: s.person_id,
        role: s.role,
        display_name: s.person?.display_name || 'Unknown',
        steam_id: s.person?.steam_id || '',
        avatar_url: staffAvatarMap.get(s.person?.steam_id) || null,
      }));

      // 8b. Build coaches list from team data
      const coaches: any[] = [];
      for (const team of Array.from(teamLookup.values())) {
        if (team.coach_person_id) {
          const { data: coachPerson } = await supabase
            .from('kkup_persons').select('steam_id, display_name')
            .eq('id', team.coach_person_id).single();
          if (coachPerson) {
            const coachAvatar = staffAvatarMap.get(coachPerson.steam_id) || null;
            coaches.push({
              person_id: team.coach_person_id,
              display_name: coachPerson.display_name,
              steam_id: coachPerson.steam_id,
              avatar_url: coachAvatar,
              team_name: team.name,
              team_id: team.id,
            });
          }
        }
      }

      // 9. Popd kernel person names — already resolved above into tournament object
      // (removed duplicate resolution block)

      // Group stats by match
      const statsByMatch = playerStats.reduce((acc: any, stat: any) => {
        if (!acc[stat.match_id]) acc[stat.match_id] = [];
        acc[stat.match_id].push(stat);
        return acc;
      }, {});

      const responseTime = Date.now() - startTime;
      console.log(`Tournament ${kkupId} loaded in ${responseTime}ms (${teams.length} teams, ${matches.length} matches, ${playerStats.length} stats)`);

      return c.json({
        tournament,
        teams, matches, player_stats: playerStats, stats_by_match: statsByMatch,
        hero_bans: {}, staff, coaches, rosters,
      });
    } catch (error: any) {
      console.error('Get tournament details error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

}