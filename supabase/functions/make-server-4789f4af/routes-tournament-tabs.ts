/**
 * Tournament Tab Data Routes
 * GET endpoints for fetching tab-specific data (teams, players, bracket, matches)
 */
import type { Hono } from "npm:hono";
import { PREFIX, enrichPersonsWithUserData } from "./helpers.ts";
import { fetchOpenDotaMatches, type OpenDotaMatch } from "./opendota-helpers.ts";

export function registerTournamentTabRoutes(app: Hono, supabase: any, _anonSupabase: any) {

  // ════════════════════════════════════════════════════════
  // TEAMS TAB DATA
  // ════════════════════════════════════════════════════════

  // GET /kkup/tournaments/:id/teams - Get all teams for a tournament
  app.get(`${PREFIX}/kkup/tournaments/:id/teams`, async (c) => {
    try {
      const tournamentId = c.req.param('id');
      
      // Fetch teams for this tournament
      const { data: teams, error } = await supabase
        .from('kkup_teams')
        .select(`
          id,
          tournament_id,
          team_name,
          team_tag,
          captain_person_id,
          coach_person_id,
          approval_status,
          master_team_id,
          valve_team_id,
          logo_url,
          placement,
          seeding
        `)
        .eq('tournament_id', tournamentId)
        .order('team_name', { ascending: true });

      if (error) {
        console.error(`Failed to fetch teams for tournament ${tournamentId}:`, error);
        return c.json({ error: 'Failed to fetch teams', details: error.message }, 500);
      }

      // For each team, count roster members and fetch placement if tournament is completed
      const teamIds = (teams || []).map((t: any) => t.id);
      const coachPersonIds = [...new Set(
        (teams || []).map((t: any) => t.coach_person_id).filter(Boolean)
      )];
      
      // Placement comes directly from kkup_teams.placement column — no separate table
      const [rosterDataResult, matchesResult, coachPersonsResult] = await Promise.all([
        // Get full roster data
        teamIds.length > 0 
          ? supabase
              .from('kkup_team_rosters')
              .select(`
                team_id,
                person_id,
                person:kkup_persons!person_id(
                  id,
                  steam_id,
                  display_name,
                  avatar_url
                )
              `)
              .in('team_id', teamIds)
          : Promise.resolve({ data: [] }),
        
        // Get match W/L records
        teamIds.length > 0
          ? supabase
              .from('kkup_matches')
              .select('id, radiant_team_id, dire_team_id, winning_team_id')
              .eq('tournament_id', tournamentId)
              .or(`radiant_team_id.in.(${teamIds.join(',')}),dire_team_id.in.(${teamIds.join(',')})`)
          : Promise.resolve({ data: [] }),

        // Get coach person records
        coachPersonIds.length > 0
          ? supabase
              .from('kkup_persons')
              .select('id, steam_id, display_name, avatar_url')
              .in('id', coachPersonIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Batch-fetch users for badge_rank + tcf_plus_active enrichment
      const allRosterRows = rosterDataResult.data || [];
      const coachPersons: any[] = coachPersonsResult.data || [];
      const allSteamIds = [
        ...allRosterRows.map((r: any) => r.person?.steam_id),
        ...coachPersons.map((p: any) => p.steam_id),
      ].filter(Boolean);

      let userMap: Record<string, any> = {};
      if (allSteamIds.length > 0) {
        const { data: linkedUsers } = await supabase
          .from('users')
          .select('steam_id, tcf_plus_active, discord_avatar, opendota_data')
          .in('steam_id', allSteamIds);
        for (const u of (linkedUsers || [])) userMap[u.steam_id] = u;
      }

      const coachPersonMap = new Map<string, any>();
      for (const cp of coachPersons) coachPersonMap.set(cp.id, cp);

      // Build rosters map with enriched player data
      const rostersMap = new Map<string, any[]>();
      allRosterRows.forEach((r: any) => {
        if (!rostersMap.has(r.team_id)) rostersMap.set(r.team_id, []);
        const lu = r.person?.steam_id ? (userMap[r.person.steam_id] || null) : null;
        rostersMap.get(r.team_id)!.push({
          person_id: r.person_id,
          player_name: r.person?.display_name || 'Unknown',
          steam_id: r.person?.steam_id || null,
          avatar_url: lu?.discord_avatar || r.person?.avatar_url || null,
          is_captain: false,
          tcf_plus_active: lu?.tcf_plus_active || false,
          badge_rank: lu?.opendota_data?.badge_rank || null,
        });
      });

      // Set captain flags
      (teams || []).forEach((team: any) => {
        const roster = rostersMap.get(team.id);
        if (roster) roster.forEach(p => { p.is_captain = p.person_id === team.captain_person_id; });
      });

      // Calculate W/L records
      const teamRecords = new Map<string, { wins: number; losses: number }>();
      teamIds.forEach(id => teamRecords.set(id, { wins: 0, losses: 0 }));

      (matchesResult.data || []).forEach((match: any) => {
        const winnerId = match.winning_team_id;
        const radiantId = match.radiant_team_id;
        const direId = match.dire_team_id;
        if (winnerId) {
          const w = teamRecords.get(winnerId); if (w) w.wins += 1;
          if (radiantId && radiantId !== winnerId) { const r = teamRecords.get(radiantId); if (r) r.losses += 1; }
          if (direId && direId !== winnerId) { const r = teamRecords.get(direId); if (r) r.losses += 1; }
        }
      });

      // Build response — roster + coach both enriched with badge_rank + tcf_plus_active
      const teamsWithData = (teams || []).map((team: any) => {
        const record = teamRecords.get(team.id) || { wins: 0, losses: 0 };
        const roster = rostersMap.get(team.id) || [];

        let coach: any = null;
        if (team.coach_person_id) {
          const cp = coachPersonMap.get(team.coach_person_id);
          if (cp) {
            const lu = cp.steam_id ? (userMap[cp.steam_id] || null) : null;
            coach = {
              person_id: cp.id,
              player_name: cp.display_name || 'Unknown',
              steam_id: cp.steam_id || null,
              avatar_url: lu?.discord_avatar || cp.avatar_url || null,
              tcf_plus_active: lu?.tcf_plus_active || false,
              badge_rank: lu?.opendota_data?.badge_rank || null,
            };
          }
        }

        return {
          id: team.id,
          team_name: team.team_name,
          team_tag: team.team_tag,
          captain_person_id: team.captain_person_id,
          approval_status: team.approval_status,
          roster_count: roster.length,
          placement: team.placement ?? null,
          wins: record.wins,
          losses: record.losses,
          logo_url: team.logo_url,
          valve_team_id: team.valve_team_id,
          roster,
          coach,
        };
      });

      return c.json({ teams: teamsWithData });
    } catch (error: any) {
      console.error('Get tournament teams error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // GET /kkup/tournaments/:id/stats/teams - Aggregated team stats for completed/archived tournaments
  app.get(`${PREFIX}/kkup/tournaments/:id/stats/teams`, async (c) => {
    try {
      const tournamentId = c.req.param('id');

      // 1. Fetch all teams for this tournament (include coach_person_id)
      const { data: teams, error: teamsError } = await supabase
        .from('kkup_teams')
        .select('id, team_name, team_tag, captain_person_id, coach_person_id, approval_status, logo_url, valve_team_id, placement, seeding')
        .eq('tournament_id', tournamentId);

      if (teamsError) throw new Error(`Teams fetch: ${teamsError.message}`);
      if (!teams || teams.length === 0) return c.json({ teams: [] });

      const teamIds = teams.map((t: any) => t.id);

      // 2. Fetch matches, rosters, and coach persons in parallel
      // Placement comes directly from kkup_teams.placement column — no separate table
      const coachPersonIds = [...new Set(
        (teams || []).map((t: any) => t.coach_person_id).filter(Boolean)
      )];

      const [matchesResult, rosterResult, coachPersonsResult] = await Promise.all([
        supabase
          .from('kkup_matches')
          .select('id, radiant_team_id, dire_team_id, winning_team_id')
          .eq('tournament_id', tournamentId),

        teamIds.length > 0
          ? supabase
              .from('kkup_team_rosters')
              .select(`
                team_id,
                person_id,
                person:kkup_persons!person_id(id, steam_id, display_name, avatar_url)
              `)
              .in('team_id', teamIds)
          : Promise.resolve({ data: [] }),

        // Coach person details
        coachPersonIds.length > 0
          ? supabase
              .from('kkup_persons')
              .select('id, steam_id, display_name, avatar_url')
              .in('id', coachPersonIds)
          : Promise.resolve({ data: [] }),
      ]);

      const matches = matchesResult.data || [];
      const matchIds = matches.map((m: any) => m.id);

      // 3. Fetch player stats (needs matchIds from above)
      const { data: statsRows } = matchIds.length > 0
        ? await supabase
            .from('kkup_player_match_stats')
            .select('person_id, team_id, match_id, kills, deaths, assists, gpm, xpm, hero, is_winner, net_worth, hero_damage, tower_damage')
            .in('match_id', matchIds)
        : { data: [] };

      // 4. Placement is read directly from team.placement (column on kkup_teams)

      // 5. Collect steam_ids for TCF+/rank enrichment (roster players + coaches)
      const personMap = new Map<string, any>();
      (rosterResult.data || []).forEach((r: any) => {
        if (r.person) personMap.set(r.person_id, r.person);
      });
      // Build coach person map
      const coachPersonMap = new Map<string, any>();
      (coachPersonsResult.data || []).forEach((p: any) => coachPersonMap.set(p.id, p));

      const rosterSteamIds = Array.from(personMap.values()).map((p: any) => p.steam_id).filter(Boolean);
      const coachSteamIds = Array.from(coachPersonMap.values()).map((p: any) => p.steam_id).filter(Boolean);
      const steamIds = [...new Set([...rosterSteamIds, ...coachSteamIds])];

      let userMap: Record<string, any> = {};
      if (steamIds.length > 0) {
        const { data: linkedUsers } = await supabase
          .from('users')
          .select('steam_id, tcf_plus_active, discord_avatar, opendota_data')
          .in('steam_id', steamIds);
        for (const u of (linkedUsers || [])) userMap[u.steam_id] = u;
      }

      // 6. Build enriched rosters map
      const rostersMap = new Map<string, any[]>();
      (rosterResult.data || []).forEach((r: any) => {
        if (!rostersMap.has(r.team_id)) rostersMap.set(r.team_id, []);
        const person = r.person || {};
        const linkedUser = person.steam_id ? (userMap[person.steam_id] || null) : null;
        rostersMap.get(r.team_id)!.push({
          person_id: r.person_id,
          player_name: person.display_name || 'Unknown',
          avatar_url: linkedUser?.discord_avatar || person.avatar_url || null,
          steam_id: person.steam_id || null,
          tcf_plus_active: linkedUser?.tcf_plus_active || false,
          badge_rank: linkedUser?.opendota_data?.badge_rank || null,
          is_captain: false,
        });
      });
      teams.forEach((team: any) => {
        (rostersMap.get(team.id) || []).forEach((p: any) => {
          p.is_captain = p.person_id === team.captain_person_id;
        });
      });

      // Build coach lookup: team_id → enriched coach object
      const coachByTeam = new Map<string, any>();
      (teams || []).forEach((team: any) => {
        if (!team.coach_person_id) return;
        const person = coachPersonMap.get(team.coach_person_id);
        if (!person) return;
        const linkedUser = person.steam_id ? (userMap[person.steam_id] || null) : null;
        coachByTeam.set(team.id, {
          person_id: person.id,
          player_name: person.display_name || 'Unknown',
          avatar_url: linkedUser?.discord_avatar || person.avatar_url || null,
          steam_id: person.steam_id || null,
          tcf_plus_active: linkedUser?.tcf_plus_active || false,
          badge_rank: linkedUser?.opendota_data?.badge_rank || null,
          is_captain: false,
          is_coach: true,
        });
      });

      // 7. Aggregate W/L per team from match records
      const teamMatchSet = new Map<string, Set<string>>();
      const teamWins = new Map<string, number>();
      teamIds.forEach(id => { teamMatchSet.set(id, new Set()); teamWins.set(id, 0); });
      matches.forEach((match: any) => {
        [match.radiant_team_id, match.dire_team_id].forEach((tid: string) => {
          if (tid && teamMatchSet.has(tid)) teamMatchSet.get(tid)!.add(match.id);
        });
        if (match.winning_team_id && teamWins.has(match.winning_team_id)) {
          teamWins.set(match.winning_team_id, (teamWins.get(match.winning_team_id) || 0) + 1);
        }
      });

      // 8. Aggregate player-game stats per team + per-player hero counts
      const teamAgg = new Map<string, any>();
      teamIds.forEach(id => teamAgg.set(id, {
        appearances: 0,
        total_kills: 0, total_deaths: 0, total_assists: 0,
        total_gpm: 0, total_xpm: 0,
        hero_counts: {} as Record<string, number>,
      }));
      // Per-player hero tracking for fav_hero on roster cards
      const playerHeroCounts = new Map<string, Record<string, number>>();
      (statsRows || []).forEach((stat: any) => {
        const tid = stat.team_id;
        if (!tid || !teamAgg.has(tid)) return;
        const agg = teamAgg.get(tid)!;
        agg.appearances++;
        agg.total_kills   += stat.kills   || 0;
        agg.total_deaths  += stat.deaths  || 0;
        agg.total_assists += stat.assists || 0;
        agg.total_gpm     += stat.gpm     || 0;
        agg.total_xpm     += stat.xpm     || 0;
        if (stat.hero) agg.hero_counts[stat.hero] = (agg.hero_counts[stat.hero] || 0) + 1;
        // Track per-player heroes for fav_hero
        if (stat.hero && stat.person_id) {
          if (!playerHeroCounts.has(stat.person_id)) playerHeroCounts.set(stat.person_id, {});
          const ph = playerHeroCounts.get(stat.person_id)!;
          ph[stat.hero] = (ph[stat.hero] || 0) + 1;
        }
      });

      // Helper: get most played hero for a player
      const getFavHero = (personId: string): string | null => {
        const counts = playerHeroCounts.get(personId);
        if (!counts) return null;
        const entries = Object.entries(counts);
        if (entries.length === 0) return null;
        return entries.sort(([, a], [, b]) => b - a)[0][0];
      };

      // 9. Build final response
      const enrichedTeams = teams.map((team: any) => {
        const agg = teamAgg.get(team.id)!;
        const n = agg.appearances || 1;
        const totalMatches = teamMatchSet.get(team.id)?.size || 0;
        const wins = teamWins.get(team.id) || 0;
        const losses = totalMatches - wins;
        const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
        const avgKills   = agg.total_kills   / n;
        const avgDeaths  = agg.total_deaths  / n;
        const avgAssists = agg.total_assists / n;
        const avgGpm     = Math.round(agg.total_gpm / n);
        const avgXpm     = Math.round(agg.total_xpm / n);
        const kda        = avgDeaths > 0 ? (avgKills + avgAssists) / avgDeaths : avgKills + avgAssists;
        const topHeroes  = Object.entries(agg.hero_counts as Record<string, number>)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([name, count]) => ({ name, count }));

        return {
          id: team.id,
          team_name: team.team_name,
          team_tag: team.team_tag,
          captain_person_id: team.captain_person_id,
          approval_status: team.approval_status,
          logo_url: team.logo_url,
          valve_team_id: team.valve_team_id,
          placement: team.placement ?? null,
          wins,
          losses,
          total_matches: totalMatches,
          win_rate: winRate,
          kda: parseFloat(kda.toFixed(2)),
          avg_kills: parseFloat(avgKills.toFixed(1)),
          avg_deaths: parseFloat(avgDeaths.toFixed(1)),
          avg_assists: parseFloat(avgAssists.toFixed(1)),
          avg_gpm: avgGpm,
          avg_xpm: avgXpm,
          top_heroes: topHeroes,
          roster: (rostersMap.get(team.id) || []).map((p: any) => ({
            ...p,
            fav_hero: getFavHero(p.person_id),
          })),
          roster_count: (rostersMap.get(team.id) || []).length,
          coach: coachByTeam.get(team.id) || null,
        };
      });

      return c.json({ teams: enrichedTeams });
    } catch (error: any) {
      console.error('Get tournament team stats error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // GET /kkup/tournaments/:id/teams/:teamId/roster - Get roster for a specific team
  app.get(`${PREFIX}/kkup/tournaments/:id/teams/:teamId/roster`, async (c) => {
    try {
      const tournamentId = c.req.param('id');
      const teamId = c.req.param('teamId');

      // Fetch roster with person details
      const { data: roster, error } = await supabase
        .from('kkup_team_rosters')
        .select(`
          team_id,
          person_id,
          person:kkup_persons!person_id(
            id,
            steam_id,
            display_name,
            avatar_url
          )
        `)
        .eq('team_id', teamId);

      if (error) {
        console.error(`Failed to fetch roster for team ${teamId}:`, error);
        return c.json({ error: 'Failed to fetch roster', details: error.message }, 500);
      }

      // Get captain info from team
      const { data: team } = await supabase
        .from('kkup_teams')
        .select('captain_person_id')
        .eq('id', teamId)
        .single();

      const captainId = team?.captain_person_id;

      // Format response with captain flag
      const formattedRoster = (roster || []).map((r: any) => ({
        person_id: r.person_id,
        team_id: r.team_id,
        player_name: r.person?.display_name || 'Unknown',
        steam_id: r.person?.steam_id,
        avatar_url: r.person?.avatar_url,
        is_captain: r.person_id === captainId,
      }));

      return c.json({ roster: formattedRoster });
    } catch (error: any) {
      console.error('Get team roster error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ════════════════════════════════════════════════════════
  // PLAYERS TAB DATA
  // ════════════════════════════════════════════════════════

  // GET /kkup/tournaments/:id/registrations - Get player + coach list for pre-live tournaments.
  // Path A (KK10+): uses kkup_registrations rows.
  // Path B (KK1-KK9 fallback): builds from kkup_team_rosters when no registrations exist.
  app.get(`${PREFIX}/kkup/tournaments/:id/registrations`, async (c) => {
    try {
      const tournamentId = c.req.param('id');

      // ── Step 1: Always fetch teams (needed for both paths) ──────────────────
      const { data: tournamentTeams } = await supabase
        .from('kkup_teams')
        .select('id, team_name, team_tag, coach_person_id')
        .eq('tournament_id', tournamentId);

      const teams = tournamentTeams || [];
      const teamIds = teams.map((t: any) => t.id);

      // Coach → team map (shared by both paths)
      const coachToTeam = new Map<string, any>();
      teams.forEach((team: any) => {
        if (team.coach_person_id) {
          coachToTeam.set(team.coach_person_id, { team_name: team.team_name, team_tag: team.team_tag });
        }
      });

      // ── Step 2: Try registrations first ─────────────────────────────────────
      // NOTE: 'rank' is a reserved SQL keyword — omit from select to avoid
      // the "WITHIN GROUP is required for ordered-set aggregate rank" Postgres error.
      const { data: registrations, error: regError } = await supabase
        .from('kkup_registrations')
        .select(`
          id,
          tournament_id,
          person_id,
          role,
          status,
          person:kkup_persons!person_id(
            id,
            steam_id,
            display_name,
            avatar_url
          )
        `)
        .eq('tournament_id', tournamentId)
        .not('status', 'eq', 'withdrawn')
        .order('person_id', { ascending: true });

      if (regError) {
        console.error(`Failed to fetch registrations for tournament ${tournamentId}:`, regError);
        return c.json({ error: 'Failed to fetch registrations', details: regError.message }, 500);
      }

      const hasRegistrations = (registrations || []).length > 0;

      // ── Path A: Registration-based (KK10+) ──────────────────────────────────
      if (hasRegistrations) {
        const allRegistrations = registrations!;

        const playerPersonIds = allRegistrations
          .filter((r: any) => r.role === 'player')
          .map((r: any) => r.person_id);

        const { data: rosterRows } = teamIds.length > 0 && playerPersonIds.length > 0
          ? await supabase
              .from('kkup_team_rosters')
              .select('person_id, team_id')
              .in('team_id', teamIds)
              .in('person_id', playerPersonIds)
          : { data: [] };

        const personToTeam = new Map<string, any>();
        (rosterRows || []).forEach((r: any) => {
          if (!personToTeam.has(r.person_id)) {
            const team = teams.find((t: any) => t.id === r.team_id);
            if (team) personToTeam.set(r.person_id, { team_name: team.team_name, team_tag: team.team_tag });
          }
        });

        const steamIds = allRegistrations.map((r: any) => r.person?.steam_id).filter(Boolean);
        let userMap: Record<string, any> = {};
        if (steamIds.length > 0) {
          const { data: linkedUsers } = await supabase
            .from('users')
            .select('id, steam_id, tcf_plus_active, discord_avatar, opendota_data')
            .in('steam_id', steamIds);
          for (const u of (linkedUsers || [])) userMap[u.steam_id] = u;
        }

        const players = allRegistrations.map((reg: any) => {
          const isCoach = reg.role === 'coach';
          const team = isCoach ? coachToTeam.get(reg.person_id) : personToTeam.get(reg.person_id);
          const lu = reg.person?.steam_id ? (userMap[reg.person.steam_id] || null) : null;

          // Derive Dotabuff/OpenDota URLs from steam_id
          let dotabuffUrl: string | null = null;
          let opendotaUrl: string | null = null;
          if (reg.person?.steam_id) {
            try {
              const raw = BigInt(reg.person.steam_id);
              const steamBase = BigInt('76561197960265728');
              const accountId = raw >= steamBase ? (raw - steamBase).toString() : raw.toString();
              dotabuffUrl = `https://www.dotabuff.com/players/${accountId}`;
              opendotaUrl = `https://www.opendota.com/players/${accountId}`;
            } catch (_) { /* invalid steam_id */ }
          }

          return {
            id: reg.id,
            person_id: reg.person_id,
            user_id: lu?.id || null,
            registration_type: reg.role,
            player_name: reg.person?.display_name || 'Unknown',
            avatar_url: lu?.discord_avatar || reg.person?.avatar_url,
            steam_id: reg.person?.steam_id || null,
            dotabuff_url: dotabuffUrl,
            opendota_url: opendotaUrl,
            team_tag: team?.team_tag || null,
            team_name: team?.team_name || null,
            created_at: null,
            tcf_plus_active: lu?.tcf_plus_active || false,
            badge_rank: lu?.opendota_data?.badge_rank || null,
            status: reg.status,
          };
        });

        return c.json({ registrations: players, source: 'registrations' });
      }

      // ── Path B: Roster-based fallback (KK1-KK9, no registration rows) ───────
      if (teamIds.length === 0) return c.json({ registrations: [], source: 'roster_fallback' });

      const { data: rosterRows } = await supabase
        .from('kkup_team_rosters')
        .select(`
          person_id,
          team_id,
          person:kkup_persons!person_id(
            id,
            steam_id,
            display_name,
            avatar_url
          )
        `)
        .in('team_id', teamIds);

      const allRosterPersons = rosterRows || [];

      // Fetch coach person records separately (for display names / avatars)
      const coachPersonIds = [...coachToTeam.keys()];
      let coachPersons: any[] = [];
      if (coachPersonIds.length > 0) {
        const { data: cp } = await supabase
          .from('kkup_persons')
          .select('id, steam_id, display_name, avatar_url')
          .in('id', coachPersonIds);
        coachPersons = cp || [];
      }

      // Enrich all persons with users table
      const allSteamIds = [
        ...allRosterPersons.map((r: any) => r.person?.steam_id),
        ...coachPersons.map((p: any) => p.steam_id),
      ].filter(Boolean);

      let userMap: Record<string, any> = {};
      if (allSteamIds.length > 0) {
        const { data: linkedUsers } = await supabase
          .from('users')
          .select('id, steam_id, tcf_plus_active, discord_avatar, opendota_data')
          .in('steam_id', allSteamIds);
        for (const u of (linkedUsers || [])) userMap[u.steam_id] = u;
      }

      function deriveProfileUrls(steamId: string | null | undefined): { dotabuff_url: string | null; opendota_url: string | null } {
        if (!steamId) return { dotabuff_url: null, opendota_url: null };
        try {
          const raw = BigInt(steamId);
          const steamBase = BigInt('76561197960265728');
          const accountId = raw >= steamBase ? (raw - steamBase).toString() : raw.toString();
          return {
            dotabuff_url: `https://www.dotabuff.com/players/${accountId}`,
            opendota_url: `https://www.opendota.com/players/${accountId}`,
          };
        } catch (_) { return { dotabuff_url: null, opendota_url: null }; }
      }

      const playerEntries = allRosterPersons.map((r: any) => {
        const team = teams.find((t: any) => t.id === r.team_id);
        const lu = r.person?.steam_id ? (userMap[r.person.steam_id] || null) : null;
        const urls = deriveProfileUrls(r.person?.steam_id);
        return {
          id: `roster-${r.team_id}-${r.person_id}`,
          person_id: r.person_id,
          user_id: lu?.id || null,
          registration_type: 'player',
          player_name: r.person?.display_name || 'Unknown',
          avatar_url: lu?.discord_avatar || r.person?.avatar_url,
          steam_id: r.person?.steam_id || null,
          ...urls,
          team_tag: team?.team_tag || null,
          team_name: team?.team_name || null,
          created_at: null,
          tcf_plus_active: lu?.tcf_plus_active || false,
          badge_rank: lu?.opendota_data?.badge_rank || null,
          status: 'registered',
        };
      });

      const coachEntries = coachPersons.map((p: any) => {
        const team = coachToTeam.get(p.id);
        const lu = p.steam_id ? (userMap[p.steam_id] || null) : null;
        const urls = deriveProfileUrls(p.steam_id);
        return {
          id: `coach-${p.id}`,
          person_id: p.id,
          user_id: lu?.id || null,
          registration_type: 'coach',
          player_name: p.display_name || 'Unknown',
          avatar_url: lu?.discord_avatar || p.avatar_url,
          steam_id: p.steam_id || null,
          ...urls,
          team_tag: team?.team_tag || null,
          team_name: team?.team_name || null,
          created_at: null,
          tcf_plus_active: lu?.tcf_plus_active || false,
          badge_rank: lu?.opendota_data?.badge_rank || null,
          status: 'registered',
        };
      });

      return c.json({
        registrations: [...coachEntries, ...playerEntries],
        source: 'roster_fallback',
      });
    } catch (error: any) {
      console.error('Get tournament registrations error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // GET /kkup/tournaments/:id/stats/players - Get aggregated player stats for completed tournaments
  app.get(`${PREFIX}/kkup/tournaments/:id/stats/players`, async (c) => {
    try {
      const tournamentId = c.req.param('id');

      // Join person + team directly from stats rows — eliminates the fragile
      // roster-filter approach that had a JS type-mismatch bug (number vs string).
      const { data: matchStats, error: statsError } = await supabase
        .from('kkup_player_match_stats')
        .select(`
          person_id,
          team_id,
          match_id,
          kills,
          deaths,
          assists,
          last_hits,
          denies,
          gpm,
          xpm,
          net_worth,
          hero,
          level,
          is_winner,
          hero_damage,
          tower_damage,
          hero_healing,
          item_0,
          item_1,
          item_2,
          item_3,
          item_4,
          item_5,
          item_neutral,
          person:kkup_persons!person_id(
            id,
            steam_id,
            display_name,
            avatar_url
          ),
          team:kkup_teams!team_id(
            team_name,
            team_tag
          ),
          match:kkup_matches!match_id(tournament_id, match_date)
        `)
        .eq('match.tournament_id', tournamentId);

      if (statsError) {
        console.error(`Failed to fetch player stats for tournament ${tournamentId}:`, statsError);
        return c.json({ players: [] });
      }

      // Filter out rows where the match join didn't resolve (non-matching tournament)
      const validStats = (matchStats || []).filter((s: any) => s.match?.tournament_id != null);

      // Aggregate stats by person_id
      const playerStatsMap = new Map<string, any>();

      validStats.forEach((stat: any) => {
        const pid = stat.person_id;
        if (!playerStatsMap.has(pid)) {
          playerStatsMap.set(pid, {
            person_id: pid,
            // Capture person/team from the first stat row we see for this player
            person: stat.person || null,
            team: stat.team || null,
            total_matches: 0,
            wins: 0,
            total_kills: 0,
            total_deaths: 0,
            total_assists: 0,
            total_gpm: 0,
            total_xpm: 0,
            total_last_hits: 0,
            total_denies: 0,
            total_net_worth: 0,
            total_hero_damage: 0,
            total_tower_damage: 0,
            total_hero_healing: 0,
            total_level: 0,
            hero_counts: {} as Record<string, number>,
            last_match_time: null as string | null,
            last_items: null as any,
          });
        }

        const playerAgg = playerStatsMap.get(pid);
        playerAgg.total_matches++;
        if (stat.is_winner === true) playerAgg.wins++;
        playerAgg.total_kills += stat.kills || 0;
        playerAgg.total_deaths += stat.deaths || 0;
        playerAgg.total_assists += stat.assists || 0;
        playerAgg.total_gpm += stat.gpm || 0;
        playerAgg.total_xpm += stat.xpm || 0;
        playerAgg.total_last_hits += stat.last_hits || 0;
        playerAgg.total_denies += stat.denies || 0;
        playerAgg.total_net_worth += stat.net_worth || 0;
        playerAgg.total_hero_damage += stat.hero_damage || 0;
        playerAgg.total_tower_damage += stat.tower_damage || 0;
        playerAgg.total_hero_healing += stat.hero_healing || 0;
        playerAgg.total_level += stat.level || 0;

        if (stat.hero) {
          playerAgg.hero_counts[stat.hero] = (playerAgg.hero_counts[stat.hero] || 0) + 1;
        }

        // Track items from the most recent match (by match_date)
        const matchTime = stat.match?.match_date || null;
        if (!playerAgg.last_match_time || (matchTime && matchTime > playerAgg.last_match_time)) {
          playerAgg.last_match_time = matchTime;
          playerAgg.last_items = {
            item_0: stat.item_0 || 0,
            item_1: stat.item_1 || 0,
            item_2: stat.item_2 || 0,
            item_3: stat.item_3 || 0,
            item_4: stat.item_4 || 0,
            item_5: stat.item_5 || 0,
            item_neutral: stat.item_neutral || 0,
          };
        }
      });

      if (playerStatsMap.size === 0) {
        return c.json({ players: [] });
      }

      // Enrich with TCF+ status, Discord avatar, and rank via users table (steam_id link)
      const steamIds = Array.from(playerStatsMap.values())
        .map((agg: any) => agg.person?.steam_id)
        .filter(Boolean);

      let userMap: Record<string, any> = {};
      if (steamIds.length > 0) {
        const { data: linkedUsers } = await supabase
          .from('users')
          .select('steam_id, tcf_plus_active, discord_avatar, opendota_data')
          .in('steam_id', steamIds);

        for (const u of (linkedUsers || [])) {
          userMap[u.steam_id] = u;
        }
      }

      // Build final player list
      const players = Array.from(playerStatsMap.values()).map((agg: any) => {
        const person = agg.person || {};
        const team = agg.team || {};
        const linkedUser = person.steam_id ? (userMap[person.steam_id] || null) : null;
        const n = agg.total_matches;

        // Derive Dotabuff/OpenDota profile URLs from steam_id.
        // DB may store the 32-bit account ID (small) OR the 64-bit SteamID64.
        // Detect which format and handle both correctly.
        let dotabuffUrl: string | null = null;
        let opendotaUrl: string | null = null;
        if (person.steam_id) {
          try {
            const raw = BigInt(person.steam_id);
            const steamBase = BigInt('76561197960265728');
            const accountId = raw >= steamBase
              ? (raw - steamBase).toString()  // SteamID64 → 32-bit account ID
              : raw.toString();               // already a 32-bit account ID
            dotabuffUrl = `https://www.dotabuff.com/players/${accountId}`;
            opendotaUrl = `https://www.opendota.com/players/${accountId}`;
          } catch (_) { /* invalid steam_id — skip */ }
        }

        const avgGpm = n > 0 ? Math.round(agg.total_gpm / n) : 0;
        const avgXpm = n > 0 ? Math.round(agg.total_xpm / n) : 0;
        const avgLastHits = n > 0 ? Math.round(agg.total_last_hits / n) : 0;
        const avgDenies = n > 0 ? Math.round(agg.total_denies / n) : 0;
        const avgNetWorth = n > 0 ? Math.round(agg.total_net_worth / n) : 0;
        const avgHeroDamage = n > 0 ? Math.round(agg.total_hero_damage / n) : 0;
        const avgTowerDamage = n > 0 ? Math.round(agg.total_tower_damage / n) : 0;
        const avgHeroHealing = n > 0 ? Math.round(agg.total_hero_healing / n) : 0;
        const avgLevel = n > 0 ? Math.round(agg.total_level / n) : 0;
        const winRate = n > 0 ? Math.round((agg.wins / n) * 100) : 0;
        const kda = agg.total_deaths > 0
          ? (agg.total_kills + agg.total_assists) / agg.total_deaths
          : agg.total_kills + agg.total_assists;

        const mostPlayedHeroes = Object.entries(agg.hero_counts as Record<string, number>)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([name, count]) => ({ name, count }));

        const badgeRank = linkedUser?.opendota_data?.badge_rank || null;

        return {
          id: agg.person_id,
          person_id: agg.person_id,
          player_name: person.display_name || 'Unknown',
          avatar_url: linkedUser?.discord_avatar || person.avatar_url || null,
          steam_id: person.steam_id || null,
          dotabuff_url: dotabuffUrl,
          opendota_url: opendotaUrl,
          team_tag: team.team_tag || null,
          team_name: team.team_name || null,
          total_matches: n,
          wins: agg.wins,
          losses: n - agg.wins,
          win_rate: winRate,
          kills: agg.total_kills,
          deaths: agg.total_deaths,
          assists: agg.total_assists,
          kda: kda,
          gpm: avgGpm,
          xpm: avgXpm,
          avg_last_hits: avgLastHits,
          avg_denies: avgDenies,
          avg_net_worth: avgNetWorth,
          avg_hero_damage: avgHeroDamage,
          avg_tower_damage: avgTowerDamage,
          avg_hero_healing: avgHeroHealing,
          avg_level: avgLevel,
          most_played_heroes: mostPlayedHeroes,
          badge_rank: badgeRank,
          tcf_plus_active: linkedUser?.tcf_plus_active || false,
          ...(agg.last_items || {}),
        };
      });

      return c.json({ players });
    } catch (error: any) {
      console.error('Get tournament player stats error:', error);
      return c.json({ players: [] });
    }
  });

  // ════════════════════════════════════════════════════════
  // BRACKET TAB DATA
  // ════════════════════════════════════════════════════════

  // GET /kkup/tournaments/:id/bracket - Get bracket structure with matches
  app.get(`${PREFIX}/kkup/tournaments/:id/bracket`, async (c) => {
    try {
      const tournamentId = c.req.param('id');

      // Fetch all matches for this tournament
      const { data: matches, error: matchesError } = await supabase
        .from('kkup_matches')
        .select(`
          id,
          tournament_id,
          radiant_team_id,
          dire_team_id,
          winning_team_id,
          radiant_team_score,
          dire_team_score,
          match_date,
          match_time,
          game_mode,
          series_id,
          team1:kkup_teams!radiant_team_id(id, team_name, team_tag, logo_url, valve_team_id),
          team2:kkup_teams!dire_team_id(id, team_name, team_tag, logo_url, valve_team_id)
        `)
        .eq('tournament_id', tournamentId)
        .order('match_date', { ascending: true });

      if (matchesError) {
        console.error(`Failed to fetch bracket for tournament ${tournamentId}:`, matchesError);
        return c.json({ error: 'Failed to fetch bracket', details: matchesError.message }, 500);
      }

      if (!matches || matches.length === 0) {
        return c.json({ bracket: null });
      }

      // ══════════════════════════════════════════════════════════
      // GROUP MATCHES INTO SERIES
      // ══════════════════════════════════════════════════════════
      const seriesMap = new Map<string, any>();

      matches.forEach((match: any) => {
        // Use series_id if exists, otherwise treat each match as its own series
        const sid = match.series_id || `single_${match.id}`;
        
        if (!seriesMap.has(sid)) {
          seriesMap.set(sid, {
            series_id: sid,
            team1_id: match.radiant_team_id,
            team2_id: match.dire_team_id,
            team1: match.team1 ? {
              id: match.team1.id,
              name: match.team1.team_name,
              tag: match.team1.team_tag,
              logo_url: match.team1.logo_url,
              valve_team_id: match.team1.valve_team_id,
            } : null,
            team2: match.team2 ? {
              id: match.team2.id,
              name: match.team2.team_name,
              tag: match.team2.team_tag,
              logo_url: match.team2.logo_url,
              valve_team_id: match.team2.valve_team_id,
            } : null,
            games: [],
            team1_wins: 0,
            team2_wins: 0,
            scheduled_time: match.match_date || match.match_time,
          });
        }

        const series = seriesMap.get(sid);
        series.games.push({
          id: match.id,
          team1_score: match.radiant_team_score || 0,
          team2_score: match.dire_team_score || 0,
          winner_team_id: match.winning_team_id,
        });

        // Count series wins
        if (match.winning_team_id === series.team1_id) {
          series.team1_wins++;
        } else if (match.winning_team_id === series.team2_id) {
          series.team2_wins++;
        }
      });

      // Determine series winner and add scores
      const seriesList = Array.from(seriesMap.values()).map((s: any) => ({
        id: s.series_id,
        team1_id: s.team1_id,
        team2_id: s.team2_id,
        team1: s.team1,
        team2: s.team2,
        team1_score: s.team1_wins,
        team2_score: s.team2_wins,
        winner_team_id: s.team1_wins > s.team2_wins ? s.team1_id 
                       : s.team2_wins > s.team1_wins ? s.team2_id 
                       : null,
        scheduled_time: s.scheduled_time,
        games: s.games,
      }));

      // ══════════════════════════════════════════════════════════
      // DISTRIBUTE SERIES INTO BRACKET ROUNDS (Smart Detection)
      // ══════════════════════════════════════════════════════════
      const seriesCount = seriesList.length;
      let roundSizes: number[] = [];
      let roundNames: string[] = [];
      
      if (seriesCount === 1) {
        // Single series = Grand Finals only
        roundSizes = [1];
        roundNames = ['Grand Finals'];
      } else if (seriesCount === 2) {
        // 2 series - probably semifinals + finals
        roundSizes = [1, 1];
        roundNames = ['Semifinals', 'Grand Finals'];
      } else if (seriesCount === 3) {
        // 4-team single elim: Semifinals (2) + Grand Finals (1)
        roundSizes = [2, 1];
        roundNames = ['Semifinals', 'Grand Finals'];
      } else if (seriesCount === 7) {
        // 8-team single elim: QF (4) + SF (2) + GF (1)
        roundSizes = [4, 2, 1];
        roundNames = ['Quarterfinals', 'Semifinals', 'Grand Finals'];
      } else if (seriesCount === 15) {
        // 16-team single elim: R1 (8) + QF (4) + SF (2) + GF (1)
        roundSizes = [8, 4, 2, 1];
        roundNames = ['Round of 16', 'Quarterfinals', 'Semifinals', 'Grand Finals'];
      } else {
        // Unknown format - best guess: last one is always finals
        roundSizes = [seriesCount - 1, 1];
        roundNames = [`Round 1 (${seriesCount - 1} series)`, 'Grand Finals'];
      }

      // Distribute series into rounds
      const rounds: any[] = [];
      let seriesIdx = 0;
      
      roundSizes.forEach((size, roundNum) => {
        const roundSeries: any[] = [];
        
        for (let i = 0; i < size && seriesIdx < seriesList.length; i++, seriesIdx++) {
          roundSeries.push(seriesList[seriesIdx]);
        }
        
        rounds.push({
          round: roundNum + 1,
          name: roundNames[roundNum] || `Round ${roundNum + 1}`,
          matches: roundSeries,
        });
      });

      return c.json({ 
        bracket: {
          rounds,
          total_rounds: rounds.length,
        }
      });
    } catch (error: any) {
      console.error('Get tournament bracket error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ════════════════════════════════════════════════════════
  // MATCHES TAB DATA
  // ════════════════════════════════════════════════════════

  // GET /kkup/tournaments/:id/matches - Get all matches for a tournament
  app.get(`${PREFIX}/kkup/tournaments/:id/matches`, async (c) => {
    try {
      const tournamentId = c.req.param('id');

      // Fetch all matches with team info — newest first
      const { data: matches, error } = await supabase
        .from('kkup_matches')
        .select(`
          id,
          tournament_id,
          radiant_team_id,
          dire_team_id,
          winning_team_id,
          radiant_team_score,
          dire_team_score,
          match_date,
          match_time,
          game_mode,
          series_id,
          phase,
          match_group,
          external_match_id,
          team1:kkup_teams!radiant_team_id(id, team_name, team_tag, logo_url, valve_team_id),
          team2:kkup_teams!dire_team_id(id, team_name, team_tag, logo_url, valve_team_id)
        `)
        .eq('tournament_id', tournamentId)
        .order('match_date', { ascending: false });

      if (error) {
        console.error(`Failed to fetch matches for tournament ${tournamentId}:`, error);
        return c.json({ error: 'Failed to fetch matches', details: error.message }, 500);
      }

      if (!matches || matches.length === 0) {
        return c.json({ matches: [] });
      }

      // Fetch player stats for all matches
      const matchIds = matches.map((m: any) => m.id);
      const { data: playerStats } = await supabase
        .from('kkup_player_match_stats')
        .select(`
          id,
          match_id,
          person_id,
          team_id,
          hero,
          kills,
          deaths,
          assists,
          gpm,
          xpm,
          last_hits,
          denies,
          net_worth,
          is_winner,
          person:kkup_persons!person_id(
            steam_id,
            display_name,
            avatar_url
          )
        `)
        .in('match_id', matchIds);

      // Helper: steam64 → 32-bit account_id for Dotabuff/OpenDota links
      // DB may store the 32-bit account ID (small) OR the 64-bit SteamID64.
      // Detect which format and handle both. Keep as string to avoid Number precision loss.
      const steamToAccountId = (steamId: string | null): string | null => {
        if (!steamId) return null;
        try {
          const raw = BigInt(steamId);
          const steamBase = BigInt('76561197960265728');
          return raw >= steamBase
            ? (raw - steamBase).toString()  // SteamID64 → 32-bit account ID
            : raw.toString();               // already a 32-bit account ID
        } catch { return null; }
      };

      // Group stats by match
      const statsByMatch = new Map<string, any[]>();
      (playerStats || []).forEach((stat: any) => {
        if (!statsByMatch.has(stat.match_id)) {
          statsByMatch.set(stat.match_id, []);
        }
        const accountId = steamToAccountId(stat.person?.steam_id);
        statsByMatch.get(stat.match_id)!.push({
          person_id: stat.person_id,
          team_id: stat.team_id,
          player_name: stat.person?.display_name || 'Unknown',
          avatar_url: stat.person?.avatar_url || null,
          steam_id: stat.person?.steam_id || null,
          account_id: accountId,
          dotabuff_url: accountId ? `https://www.dotabuff.com/players/${accountId}` : null,
          opendota_url: accountId ? `https://www.opendota.com/players/${accountId}` : null,
          hero: stat.hero,
          kills: stat.kills || 0,
          deaths: stat.deaths || 0,
          assists: stat.assists || 0,
          kda: stat.deaths > 0 
            ? parseFloat(((stat.kills + stat.assists) / stat.deaths).toFixed(2))
            : parseFloat((stat.kills + stat.assists).toFixed(2)),
          gpm: stat.gpm || 0,
          xpm: stat.xpm || 0,
          last_hits: stat.last_hits || 0,
          net_worth: stat.net_worth || 0,
          is_winner: stat.is_winner || false,
        });
      });

      // Format matches with player stats — newest first
      const enrichedMatches = (matches || []).map((match: any, idx: number) => {
        const stats = statsByMatch.get(match.id) || [];
        
        // Split stats by team (radiant = team1, dire = team2)
        const team1Stats = stats.filter((s: any) => s.team_id === match.radiant_team_id);
        const team2Stats = stats.filter((s: any) => s.team_id === match.dire_team_id);

        const valveMatchId = match.external_match_id || null;

        return {
          id: match.id,
          match_number: idx + 1,
          stage: match.game_mode || 'captains_mode',
          series_id: match.series_id,
          match_id: valveMatchId,
          dotabuff_url: valveMatchId ? `https://www.dotabuff.com/matches/${valveMatchId}` : null,
          team1: match.team1 ? {
            id: match.team1.id,
            name: match.team1.team_name,
            tag: match.team1.team_tag,
            logo_url: match.team1.logo_url,
            valve_team_id: match.team1.valve_team_id,
          } : null,
          team2: match.team2 ? {
            id: match.team2.id,
            name: match.team2.team_name,
            tag: match.team2.team_tag,
            logo_url: match.team2.logo_url,
            valve_team_id: match.team2.valve_team_id,
          } : null,
          team1_id: match.radiant_team_id,
          team2_id: match.dire_team_id,
          winner_team_id: match.winning_team_id,
          team1_score: match.radiant_team_score || 0,
          team2_score: match.dire_team_score || 0,
          scheduled_time: match.match_date || match.match_time,
          team1_players: team1Stats,
          team2_players: team2Stats,
        };
      });

      return c.json({ matches: enrichedMatches });
    } catch (error: any) {
      console.error('Get tournament matches error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ════════════════════════════════════════════════════════
  // STAFF TAB DATA
  // ════════════════════════════════════════════════════════

  // ════════════════════════════════════════════════════════
  // BRACKET MANAGEMENT (Officer Only)
  // ════════════════════════════════════════════════════════

  // PUT /kkup/tournaments/:id/bracket/series/:seriesId - Update bracket classification for a series
  app.put(`${PREFIX}/kkup/tournaments/:id/bracket/series/:seriesId`, async (c) => {
    try {
      const tournamentId = c.req.param('id');
      const seriesId = c.req.param('seriesId');
      
      // Auth check (officer only)
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (!user?.id) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      // Verify officer permission
      const { data: dbUser } = await supabase
        .from('users')
        .select('role')
        .eq('supabase_id', user.id)
        .single();

      if (!dbUser || !['owner', 'officer'].includes(dbUser.role)) {
        return c.json({ error: 'Forbidden - Officer access required' }, 403);
      }

      const { bracket_round, bracket_position } = await c.req.json();

      if (!bracket_round || typeof bracket_position !== 'number') {
        return c.json({ error: 'bracket_round and bracket_position are required' }, 400);
      }

      // Update all matches in this series with the new bracket classification
      const { error: updateError } = await supabase
        .from('kkup_matches')
        .update({
          bracket_round,
          bracket_position,
        })
        .eq('tournament_id', tournamentId)
        .eq('series_id', seriesId);

      if (updateError) {
        console.error(`Failed to update bracket for series ${seriesId}:`, updateError);
        return c.json({ error: 'Failed to update bracket', details: updateError.message }, 500);
      }

      return c.json({ success: true, message: 'Bracket classification updated' });
    } catch (error: any) {
      console.error('Update bracket classification error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ══════════════════════════════════════════════════════
  // GALLERY TAB DATA
  // ════════════════════════════════════════════════════════

  // GET /kkup/tournaments/:id/gallery - Get all gallery images for a tournament
  app.get(`${PREFIX}/kkup/tournaments/:id/gallery`, async (c) => {
    try {
      const tournamentId = c.req.param('id');
      
      // Fetch tournament to get name for folder path
      const { data: tournament, error: tournamentError } = await supabase
        .from('kkup_tournaments')
        .select('name')
        .eq('id', tournamentId)
        .single();

      if (tournamentError || !tournament) {
        console.error(`Failed to fetch tournament ${tournamentId}:`, tournamentError);
        return c.json({ error: 'Tournament not found' }, 404);
      }

      // Generate folder path from tournament name
      const folderPath = tournament.name.toLowerCase().replace(/\s+/g, '-');

      // Fetch all files from the tournament folder
      const { data: files, error: storageError } = await supabase.storage
        .from('make-4789f4af-kkup-assets')
        .list(folderPath);

      if (storageError) {
        console.error(`Failed to list gallery images for ${folderPath}:`, storageError);
        return c.json({ error: 'Failed to fetch gallery images', details: storageError.message }, 500);
      }

      if (!files || files.length === 0) {
        return c.json({ gallery_images: [] });
      }

      // Filter to only include image files (keep UI assets - they're part of the gallery!)
      const galleryFiles = files.filter((file: any) => {
        // Exclude folders
        if (!file.name || file.name.includes('/')) return false;
        
        // Only include image files
        const ext = file.name.split('.').pop()?.toLowerCase();
        return ext && ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
      });

      // Generate public URLs for gallery images
      const baseUrl = 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets';
      const galleryImages = galleryFiles.map((file: any) => ({
        name: file.name,
        url: `${baseUrl}/${folderPath}/${file.name}`,
        created_at: file.created_at || null
      }));

      return c.json({ gallery_images: galleryImages });
    } catch (err) {
      console.error('Unexpected error fetching gallery images:', err);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════

  /**
   * Compute per-team average Dota rank from their roster badge_ranks.
   * Returns a map of team_id → { medal, stars } | null.
   */
  async function computeTeamAvgRanks(
    supabase: any,
    teams: any[]
  ): Promise<Record<string, { medal: string; stars: number } | null>> {
    const result: Record<string, { medal: string; stars: number } | null> = {};
    if (!teams || teams.length === 0) return result;

    const teamIds = teams.map((t: any) => t.id);

    try {
      const { data: rosters } = await supabase
        .from('kkup_team_rosters')
        .select('team_id, person_id, kkup_persons!inner(badge_rank)')
        .in('team_id', teamIds);

      if (!rosters) return result;

      // Group badge_ranks by team
      const byTeam: Record<string, any[]> = {};
      for (const row of rosters) {
        const br = row.kkup_persons?.badge_rank;
        if (!br) continue;
        if (!byTeam[row.team_id]) byTeam[row.team_id] = [];
        byTeam[row.team_id].push(br);
      }

      const MEDAL_ORDER = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'];

      function toNumeric(medal: string, stars: number): number {
        const idx = MEDAL_ORDER.indexOf(medal);
        if (idx === -1) return 0;
        if (medal === 'Immortal') return 36;
        return idx * 5 + Math.max(1, Math.min(5, stars));
      }

      function toRank(value: number): { medal: string; stars: number } {
        if (value <= 0) return { medal: 'Unranked', stars: 0 };
        if (value >= 36) return { medal: 'Immortal', stars: 0 };
        const clamped = Math.max(1, Math.min(35, Math.round(value)));
        const tierIndex = Math.floor((clamped - 1) / 5);
        const stars = ((clamped - 1) % 5) + 1;
        return { medal: MEDAL_ORDER[tierIndex], stars };
      }

      for (const teamId of teamIds) {
        const badges = byTeam[teamId];
        if (!badges || badges.length === 0) { result[teamId] = null; continue; }

        const numerics: number[] = [];
        for (const br of badges) {
          const medal: string | undefined = br?.medal;
          const stars: number = br?.stars ?? 0;
          if (medal) {
            const n = toNumeric(medal, stars);
            if (n > 0) numerics.push(n);
          }
        }

        if (numerics.length === 0) { result[teamId] = null; continue; }
        const avg = numerics.reduce((s, v) => s + v, 0) / numerics.length;
        result[teamId] = toRank(avg);
      }
    } catch (e) {
      console.warn('computeTeamAvgRanks failed (non-critical):', e);
    }

    return result;
  }

  /**
   * Compute per-team ticket coverage from kkup_team_rosters.tickets_contributed,
   * kkup_teams.coach_tickets_contributed, and TCF+ status from users.
   * Returns a map of team_id → { wallet: number, tcf_plus: number, total: number }.
   */
  async function computeTeamTicketCounts(
    supabase: any,
    teams: any[]
  ): Promise<Record<string, { wallet: number; tcf_plus: number; total: number }>> {
    const result: Record<string, { wallet: number; tcf_plus: number; total: number }> = {};
    if (!teams || teams.length === 0) return result;

    const teamIds = teams.map((t: any) => t.id);

    try {
      const { data: rosters } = await supabase
        .from('kkup_team_rosters')
        .select('team_id, tickets_contributed, person:kkup_persons!person_id(steam_id)')
        .in('team_id', teamIds);

      const { data: teamsWithCoach } = await supabase
        .from('kkup_teams')
        .select('id, coach_tickets_contributed, coach:kkup_persons!coach_person_id(steam_id)')
        .in('id', teamIds);

      const allSteamIds: string[] = [];
      for (const r of (rosters || [])) { if (r.person?.steam_id) allSteamIds.push(r.person.steam_id); }
      for (const t of (teamsWithCoach || [])) { if (t.coach?.steam_id) allSteamIds.push(t.coach.steam_id); }

      const tcfPlusBysteam: Record<string, boolean> = {};
      if (allSteamIds.length > 0) {
        const { data: users } = await supabase
          .from('users').select('steam_id, tcf_plus_active').in('steam_id', allSteamIds);
        for (const u of (users || [])) tcfPlusBysteam[u.steam_id] = !!u.tcf_plus_active;
      }

      const coachByTeam: Record<string, any> = {};
      for (const t of (teamsWithCoach || [])) coachByTeam[t.id] = t;

      const rosterByTeam: Record<string, any[]> = {};
      for (const r of (rosters || [])) {
        if (!rosterByTeam[r.team_id]) rosterByTeam[r.team_id] = [];
        rosterByTeam[r.team_id].push(r);
      }

      for (const teamId of teamIds) {
        const rosterRows = rosterByTeam[teamId] || [];
        const teamData = coachByTeam[teamId];
        let walletTotal = 0;
        let tcfPlusCount = 0;

        for (const r of rosterRows) {
          const steamId = r.person?.steam_id;
          if (steamId && tcfPlusBysteam[steamId]) { tcfPlusCount++; }
          else { walletTotal += r.tickets_contributed || 0; }
        }
        if (teamData) {
          const coachSteamId = teamData.coach?.steam_id;
          if (coachSteamId && tcfPlusBysteam[coachSteamId]) { tcfPlusCount++; }
          else { walletTotal += teamData.coach_tickets_contributed || 0; }
        }

        result[teamId] = { wallet: walletTotal, tcf_plus: tcfPlusCount, total: walletTotal + tcfPlusCount };
      }
    } catch (e) {
      console.warn('computeTeamTicketCounts failed (non-critical):', e);
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════
  // OVERVIEW TAB DATA (COMPLETED TOURNAMENTS)
  // ════════════════════════════════════════════════════════

  // GET /kkup/tournaments/:id/overview - Get overview stats for completed tournament
  app.get(`${PREFIX}/kkup/tournaments/:id/overview`, async (c) => {
    try {
      const tournamentId = c.req.param('id');
      
      // Fetch tournament metadata
      const { data: tournament, error: tournamentError } = await supabase
        .from('kkup_tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError || !tournament) {
        console.error(`Failed to fetch tournament ${tournamentId}:`, tournamentError);
        return c.json({ error: 'Tournament not found' }, 404);
      }

      // Fetch prizes and awards (needed for all overview responses)
      const { data: prizes } = await supabase
        .from('kkup_prizes')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('sort_order', { ascending: true });

      const { data: awards } = await supabase
        .from('prize_awards')
        .select(`
          id, prize_id, amount_cents, recipient_user_id, team_id,
          recipient:users!recipient_user_id(id, discord_username, discord_avatar),
          team:kkup_teams!team_id(id, team_name, team_tag, logo_url)
        `)
        .eq('tournament_id', tournamentId);

      // Fetch all teams (no placement column needed!)
      const { data: teams, error: teamsError } = await supabase
        .from('kkup_teams')
        .select(`
          id,
          team_name,
          team_tag,
          logo_url,
          master_team_id,
          valve_team_id,
          approval_status
        `)
        .eq('tournament_id', tournamentId);

      if (teamsError) {
        console.error(`Failed to fetch teams for tournament ${tournamentId}:`, teamsError);
        return c.json({ error: 'Failed to fetch teams' }, 500);
      }

      // Create a map of valve_team_id -> team.id for Steam API matching
      const valveTeamIdMap = new Map<number, string>();
      (teams || []).forEach((team: any) => {
        if (team.valve_team_id) {
          valveTeamIdMap.set(team.valve_team_id, team.id);
        }
      });

      // ══════════════════════════════════════════════════════════
      // DATA SOURCE PRIORITY BY TOURNAMENT PHASE
      // 
      // Upcoming/Reg_Open/Reg_Closed/Roster_Lock:
      //   1. Internal (database) - Pre-configured data
      //   2. Steam API - For enrichment only
      //   3. OpenDota API - Rarely used in these phases
      // 
      // Live:
      //   1. Steam API - Real-time match data (PRIMARY)
      //   2. OpenDota API - Fallback if Steam fails
      //   3. Internal (database) - Last resort cached data
      // 
      // Completed:
      //   1. Internal (database) - CSV uploads are source of truth
      //   2. Steam API - Enrichment only (never override)
      //   3. OpenDota API - Rarely needed
      // 
      // Archived:
      //   1. Internal (database) - Manually verified, locked truth
      //   2. Steam API - Only for extreme fallback (should never fire)
      // ══════════════════════════════════════════════════════════

      let matches: any[] = [];
      let dataSource = 'none';

      const status = tournament.status;
      const isLive = status === 'live';
      const isCompleted = status === 'completed';
      const isArchived = status === 'archived';
      const isPreTournament = ['upcoming', 'reg_open', 'reg_closed', 'roster_lock'].includes(status);

      // ══════════════════════════════════════════════════════════
      // ARCHIVED: Database ONLY (manually verified, no fallback needed)
      // ══════════════════════════════════════════════════════════
      if (isArchived) {
        console.log(`📦 [ARCHIVED] Using database only (manually verified CSV data)...`);
        const { data: dbMatches, error: matchesError } = await supabase
          .from('kkup_matches')
          .select('*')
          .eq('tournament_id', tournamentId);

        if (!matchesError && dbMatches && dbMatches.length > 0) {
          matches = dbMatches;
          dataSource = 'database';
          console.log(`✅ Fetched ${matches.length} matches from database (archived)`);
        } else {
          console.log(`⚠️ No archived data found for tournament ${tournamentId}`);
        }
      }

      // ══════════════════════════════════════════════════════════
      // COMPLETED: Database PRIMARY, Steam/OpenDota for enrichment only
      // ═════════════════════════════════════════════════════��════
      else if (isCompleted) {
        console.log(`📁 [COMPLETED] Using CSV data from database...`);
        const { data: dbMatches, error: matchesError} = await supabase
          .from('kkup_matches')
          .select('*')
          .eq('tournament_id', tournamentId);

        if (!matchesError && dbMatches && dbMatches.length > 0) {
          matches = dbMatches;
          dataSource = 'database';
          console.log(`✅ Fetched ${matches.length} matches from database (CSV source of truth)`);
        } else {
          console.log(`⚠️ No CSV data found for completed tournament ${tournamentId}`);
        }
      }

      // ═���════════��═══════════════════════════════════════════════
      // LIVE: Steam API PRIMARY → OpenDota fallback → Database last resort
      // ══════════════════════════════════════════════════════════
      else if (isLive) {
        console.log(`🔴 [LIVE] Attempting Steam API → OpenDota → Database fallback chain...`);
        
        // LAYER 1: Steam API (PRIMARY for live data)
        if (tournament.league_id) {
          try {
            const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
            const STEAM_API_BASE = 'https://api.steampowered.com';
            const DOTA2_APP_ID = 570;

            console.log(`🎮 [Steam] Fetching matches for league ${tournament.league_id}...`);
            
            const historyRes = await fetch(
              `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchHistory/v1/?key=${STEAM_API_KEY}&league_id=${tournament.league_id}&matches_requested=100`
            );
            const historyData = await historyRes.json();
            const steamMatches = historyData.result?.matches || [];

            if (steamMatches.length > 0) {
              console.log(`🎯 [Steam] Found ${steamMatches.length} matches, fetching details...`);
              
              const matchDetailPromises = steamMatches.slice(0, 20).map(async (match: any) => {
                try {
                  const detailRes = await fetch(
                    `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match.match_id}`
                  );
                  const detailData = await detailRes.json();
                  return detailData.result || null;
                } catch (err) {
                  console.error(`[Steam] Failed to fetch match ${match.match_id}:`, err);
                  return null;
                }
              });

              const matchDetails = (await Promise.all(matchDetailPromises)).filter(Boolean);
              
              if (matchDetails.length > 0) {
                matches = matchDetails;
                dataSource = 'steam_api';
                console.log(`✅ [Steam] Successfully fetched ${matches.length} matches`);
              }
            }
          } catch (err) {
            console.error('[Steam] API failed:', err);
          }
        }

        // LAYER 2: OpenDota API (fallback if Steam failed)
        if (matches.length === 0) {
          console.log(`🟠 [OpenDota] Steam failed, trying OpenDota fallback...`);
          
          // Check if we have match_ids stored in database to query OpenDota
          const { data: dbMatches } = await supabase
            .from('kkup_matches')
            .select('external_match_id')
            .eq('tournament_id', tournamentId);

          const matchIds = (dbMatches || [])
            .map((m: any) => m.external_match_id)
            .filter(Boolean);

          if (matchIds.length > 0) {
            console.log(`🔍 [OpenDota] Found ${matchIds.length} match IDs, fetching from OpenDota...`);
            const openDotaMatches = await fetchOpenDotaMatches(matchIds, 5);
            
            if (openDotaMatches.length > 0) {
              matches = openDotaMatches;
              dataSource = 'opendota_api';
              console.log(`✅ [OpenDota] Successfully fetched ${matches.length} matches`);
            }
          } else {
            console.log(`⚠️ [OpenDota] No match IDs available to query`);
          }
        }

        // LAYER 3: Database (last resort for live)
        if (matches.length === 0) {
          console.log(`📁 [Database] Both APIs failed, using cached database data...`);
          const { data: dbMatches, error: matchesError } = await supabase
            .from('kkup_matches')
            .select('*')
            .eq('tournament_id', tournamentId);

          if (!matchesError && dbMatches && dbMatches.length > 0) {
            matches = dbMatches;
            dataSource = 'database';
            console.log(`✅ [Database] Fetched ${matches.length} cached matches`);
          }
        }
      }

      // ══════════════════════════════════════════════════════════
      // PRE-TOURNAMENT: Database PRIMARY (no matches yet typically)
      // ══════════════════════════════════════════════════════════
      else if (isPreTournament) {
        console.log(`📅 [PRE-TOURNAMENT] Checking database for pre-configured data...`);
        const { data: dbMatches, error: matchesError } = await supabase
          .from('kkup_matches')
          .select('*')
          .eq('tournament_id', tournamentId);

        if (!matchesError && dbMatches && dbMatches.length > 0) {
          matches = dbMatches;
          dataSource = 'database';
          console.log(`✅ Fetched ${matches.length} pre-configured matches`);
        } else {
          console.log(`ℹ️ No matches configured yet (expected for pre-tournament phase)`);
        }
      }

      // ══════════════════════════════════════════════════════════
      // FALLBACK: Unknown status, try database
      // ════════════════════════════════════════���═════════════════
      else {
        console.log(`⚠️ [UNKNOWN STATUS: ${status}] Defaulting to database...`);
        const { data: dbMatches, error: matchesError } = await supabase
          .from('kkup_matches')
          .select('*')
          .eq('tournament_id', tournamentId);

        if (!matchesError && dbMatches && dbMatches.length > 0) {
          matches = dbMatches;
          dataSource = 'database';
          console.log(`✅ Fetched ${matches.length} matches from database`);
        }
      }

      // OPTION 3: Empty state if no data found
      if (matches.length === 0) {
        console.log(`⚠️ No match data found for tournament ${tournamentId}`);

        // Compute ticket counts per team (non-critical)
        const teamTicketMap = await computeTeamTicketCounts(supabase, teams || []);

        // Count rostered players for pre-tournament player stat display
        let preTournamentPlayerCount = 0;
        const rosterCountByTeam = new Map<string, number>();
        const teamIdsForCount = (teams || []).map((t: any) => t.id);
        if (teamIdsForCount.length > 0) {
          const { data: rosterRows } = await supabase
            .from('kkup_team_rosters')
            .select('person_id, team_id')
            .in('team_id', teamIdsForCount);
          preTournamentPlayerCount = (rosterRows || []).length;
          (rosterRows || []).forEach((r: any) => {
            rosterCountByTeam.set(r.team_id, (rosterCountByTeam.get(r.team_id) || 0) + 1);
          });
        }

        // Count all active registrants (not just rostered)
        let totalRegistrantCount = 0;
        try {
          const { count: regCount } = await supabase
            .from('kkup_registrations')
            .select('id', { count: 'exact', head: true })
            .eq('tournament_id', tournamentId)
            .neq('status', 'withdrawn');
          totalRegistrantCount = regCount || 0;
        } catch (_) { /* non-critical */ }

        // Compute ticket readiness: all teams must have total >= 5
        const allTeamsReady = (teams || []).length > 0 && (teams || []).every((team: any) => {
          const cov = teamTicketMap[team.id];
          return cov && cov.total >= 5;
        });

         // prizes/awards fetched at top
 
         return c.json({
          tournament: {
            id: tournament.id,
            name: tournament.name,
            description: tournament.description,
            start_date: tournament.start_date,
            end_date: tournament.end_date,
            registration_end_date: tournament.registration_end_date,
            registration_start_date: tournament.registration_start_date,
            tournament_start_date: tournament.tournament_start_date,
            max_teams: tournament.max_teams,
            status: tournament.status,
            prize_pool: tournament.prize_pool,
            prize_pool_donations: tournament.prize_pool_donations,
            total_teams: teams?.length || 0,
            total_players: preTournamentPlayerCount,
            total_registrants: totalRegistrantCount,
            total_matches: 0,
            youtube_vod_url: tournament.youtube_url || null,
            all_teams_ticket_ready: allTeamsReady,
          },
          champion: null,
          top_teams: (teams || []).map((team: any, idx: number) => ({
            ...team,
            wins: 0,
            losses: 0,
            placement: idx + 1,
            avg_rank: null,
            roster_count: rosterCountByTeam.get(team.id) || 0,
            ticket_coverage: teamTicketMap[team.id] || { wallet: 0, tcf_plus: 0, total: 0 }
          })),
          most_picked_heroes: [],
          top_players: [],
          data_source: 'none',
          empty_state: true,
          prizes: prizes || [],
          awards: awards || [],
        });
      }

      // ══════════════════════════════════════════════════════════
      // CALCULATE STATS FROM MATCHES
      // ═════════════════════════════���═══════════════════════════

      // Track hero picks, player stats, and team wins
      const heroPicks: Record<number, number> = {};
      const playerStats: Record<number, { kills: number; deaths: number; assists: number; matches: number; name: string; avatar: string | null }> = {};
      const teamWins: Record<string, number> = {};
      const teamLosses: Record<string, number> = {};

      // Initialize win/loss counters for all teams
      (teams || []).forEach((team: any) => {
        teamWins[team.id] = 0;
        teamLosses[team.id] = 0;
      });

      // ══════════════════════════════════════════════════════════
      // HERO PICKS: Use kkup_player_match_stats as source of truth
      // ══════════════════════════════════════════════════════════
      if (dataSource === 'database') {
        console.log(`📊 Fetching hero picks from kkup_player_match_stats...`);
        try {
          // Get all match IDs for this tournament
          const matchIds = matches.map((m: any) => m.id).filter(Boolean);
          
          if (matchIds.length > 0) {
            const { data: playerMatchStats, error: statsError } = await supabase
              .from('kkup_player_match_stats')
              .select('hero_id, person_id, kills, deaths, assists')
              .in('match_id', matchIds);

            if (statsError) {
              console.warn(`⚠️ Failed to fetch stats from player_match_stats (will be empty):`, statsError);
            } else if (playerMatchStats && playerMatchStats.length > 0) {
              // Count hero picks
              playerMatchStats.forEach((stat: any) => {
                if (stat.hero_id && stat.hero_id > 0) {
                  heroPicks[stat.hero_id] = (heroPicks[stat.hero_id] || 0) + 1;
                }
                
                // Aggregate player stats
                const personId = stat.person_id;
                if (personId) {
                  if (!playerStats[personId]) {
                    playerStats[personId] = { 
                      kills: 0, 
                      deaths: 0, 
                      assists: 0, 
                      matches: 0, 
                      name: 'Unknown', 
                      avatar: null 
                    };
                  }
                  playerStats[personId].kills += stat.kills || 0;
                  playerStats[personId].deaths += stat.deaths || 0;
                  playerStats[personId].assists += stat.assists || 0;
                  playerStats[personId].matches += 1;
                }
              });
              console.log(`✅ Counted ${Object.keys(heroPicks).length} unique heroes from ${playerMatchStats.length} player_match_stats rows`);
              console.log(`✅ Aggregated stats for ${Object.keys(playerStats).length} players from player_match_stats`);
            } else {
              console.warn(`⚠️ No hero data found in player_match_stats for ${matchIds.length} matches`);
            }
          } else {
            console.warn(`⚠️ No match IDs found to query player_match_stats`);
          }
        } catch (err) {
          console.error(`❌ Error fetching data from player_match_stats:`, err);
          // Continue without hero data - don't block the endpoint
        }
      }

      // Process matches for team wins/losses
      if (dataSource === 'database' || dataSource === 'steam_api') {
        for (const match of matches) {
          // Determine winner from winning_team_id (CSV source) or radiant_win (Steam API)
          let radiantWin: boolean;
          
          if (dataSource === 'database') {
            // CSV source: use winning_team_id
            radiantWin = match.winning_team_id === match.radiant_team_id;
          } else {
            // Steam API: use radiant_win/radiant_victory flag
            radiantWin = match.radiant_win || match.radiant_victory || false;
          }

          const direWin = !radiantWin;
          let radiantDbTeamId = match.radiant_team_id;
          let direDbTeamId = match.dire_team_id;

          // Track team wins/losses (count each match ONCE, not twice)
          if (radiantWin && radiantDbTeamId) {
            teamWins[radiantDbTeamId] = (teamWins[radiantDbTeamId] || 0) + 1;
            if (direDbTeamId) teamLosses[direDbTeamId] = (teamLosses[direDbTeamId] || 0) + 1;
          } else if (direWin && direDbTeamId) {
            teamWins[direDbTeamId] = (teamWins[direDbTeamId] || 0) + 1;
            if (radiantDbTeamId) teamLosses[radiantDbTeamId] = (teamLosses[radiantDbTeamId] || 0) + 1;
          }

          // Count hero picks from Steam API (live tournaments)
          if (dataSource === 'steam_api') {
            const players = match.players || [];
            const radiantHeroes = players.filter((p: any) => p.player_slot < 128).map((p: any) => p.hero_id);
            const direHeroes = players.filter((p: any) => p.player_slot >= 128).map((p: any) => p.hero_id);
            
            [...radiantHeroes, ...direHeroes].forEach((heroId: number) => {
              if (heroId) {
                heroPicks[heroId] = (heroPicks[heroId] || 0) + 1;
              }
            });
          }

          // Calculate player stats
          if (dataSource === 'steam_api') {
            // Steam API format
            const players = match.players || [];
            for (const player of players) {
              const accountId = player.account_id;
              // Skip anonymous players (account_id = 4294967295)
              if (!accountId || accountId === 4294967295) continue;

              if (!playerStats[accountId]) {
                playerStats[accountId] = {
                  kills: 0,
                  deaths: 0,
                  assists: 0,
                  matches: 0,
                  name: player.personaname || player.persona || 'Unknown',
                  avatar: null // Steam API doesn't provide avatars in match details
                };
              }

              playerStats[accountId].kills += player.kills || 0;
              playerStats[accountId].deaths += player.deaths || 0;
              playerStats[accountId].assists += player.assists || 0;
              playerStats[accountId].matches += 1;
            }
          } else {
            // Database format (person_ids)
            const radiantPersonIds = match.radiant_person_ids || [];
            const direPersonIds = match.dire_person_ids || [];

            radiantPersonIds.forEach((personId: number, idx: number) => {
              if (!personId) return;
              if (!playerStats[personId]) {
                playerStats[personId] = { kills: 0, deaths: 0, assists: 0, matches: 0, name: 'Unknown', avatar: null };
              }
              playerStats[personId].kills += match.radiant_kills?.[idx] || 0;
              playerStats[personId].deaths += match.radiant_deaths?.[idx] || 0;
              playerStats[personId].assists += match.radiant_assists?.[idx] || 0;
              playerStats[personId].matches += 1;
            });

            direPersonIds.forEach((personId: number, idx: number) => {
              if (!personId) return;
              if (!playerStats[personId]) {
                playerStats[personId] = { kills: 0, deaths: 0, assists: 0, matches: 0, name: 'Unknown', avatar: null };
              }
              playerStats[personId].kills += match.dire_kills?.[idx] || 0;
              playerStats[personId].deaths += match.dire_deaths?.[idx] || 0;
              playerStats[personId].assists += match.dire_assists?.[idx] || 0;
              playerStats[personId].matches += 1;
            });
          }
        }
      }

      // DEBUG: Log what we calculated
      console.log(`📊 After processing ${matches.length} matches:`);
      console.log(`  - Hero picks count: ${Object.keys(heroPicks).length}`);
      console.log(`  - Player stats count: ${Object.keys(playerStats).length}`);
      console.log(`  - Team wins:`, teamWins);
      if (Object.keys(heroPicks).length > 0) {
        console.log(`  - Sample hero picks:`, Object.entries(heroPicks).slice(0, 3));
      }
      if (Object.keys(playerStats).length > 0) {
        console.log(`  - Sample player stats:`, Object.entries(playerStats).slice(0, 2).map(([id, stats]) => ({ id, stats })));
      }

      // Sort teams by wins
      const teamsWithPlacements = (teams || []).map((team: any) => ({
        ...team,
        wins: teamWins[team.id] || 0,
      })).sort((a, b) => b.wins - a.wins);

      teamsWithPlacements.forEach((team, idx) => {
        team.placement = idx + 1;
      });

      // Get top 5 most picked heroes
      const mostPickedHeroes = Object.entries(heroPicks)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([heroId, pickCount]) => ({
          hero_id: parseInt(heroId),
          pick_count: pickCount
        }));

      // Total unique heroes picked
      const totalHeroesPicked = Object.keys(heroPicks).length;

      // ══════════════════════════════════════════════════════════
      // ENRICH PLAYER DATA: Fetch ALL person details BEFORE sorting
      // ══════════════════════════════════════════════════════════
      if (dataSource === 'database' && Object.keys(playerStats).length > 0) {
        try {
          const allPlayerIds = Object.keys(playerStats); // Already UUIDs, don't parse!
          
          console.log(`🔍 Fetching person details for ${allPlayerIds.length} players...`);
          const { data: persons, error: personsError } = await supabase
            .from('kkup_persons')
            .select('id, display_name, avatar_url, steam_id')
            .in('id', allPlayerIds);

          if (personsError) {
            console.warn(`⚠️ Failed to fetch person details (non-critical):`, personsError.message);
          } else if (persons && persons.length > 0) {
            console.log(`✅ Enriching ${persons.length} players with person data...`);

            // Enrich the playerStats map with real names/Steam avatars
            persons.forEach((person: any) => {
              const stats = playerStats[person.id];
              if (stats) {
                stats.name = person.display_name || 'Unknown';
                stats.avatar = person.avatar_url || null;
                stats.steam_id = person.steam_id || null;
              }
            });

            // Enrich with TCF+ status and Discord avatar via users table
            const steamIds = persons.map((p: any) => p.steam_id).filter(Boolean);
            const userMap = await enrichPersonsWithUserData(supabase, steamIds);

            // Attach TCF+ and prefer Discord avatar (higher quality) over Steam avatar
            persons.forEach((person: any) => {
              const stats = playerStats[person.id];
              if (stats && person.steam_id) {
                const userData = userMap[person.steam_id];
                if (userData) {
                  stats.tcf_plus_active = userData.tcf_plus_active;
                  stats.avatar = userData.discord_avatar || stats.avatar || null;
                }
              }
            });
          } else {
            console.warn(`⚠️ No person data found for ${allPlayerIds.length} player IDs`);
          }
        } catch (enrichErr) {
          // Non-critical: person enrichment failed, but we can still show stats with default names
          console.warn(`⚠️ Person enrichment failed (non-critical):`, enrichErr);
        }
      }

      // Calculate KDA and sort players
      const playerKDAs = Object.entries(playerStats).map(([playerId, stats]) => {
        const kda = stats.deaths === 0 
          ? stats.kills + stats.assists 
          : (stats.kills + stats.assists) / stats.deaths;
        return {
          person_id: playerId, // Keep as UUID string
          kda: parseFloat(kda.toFixed(2)),
          kills: stats.kills,
          deaths: stats.deaths,
          assists: stats.assists,
          matches_played: stats.matches,
          steam_name: stats.name,
          steam_avatar: stats.avatar,
          tcf_plus_active: stats.tcf_plus_active || false,
        };
      }).sort((a, b) => b.kda - a.kda);

      const topPlayers = playerKDAs.slice(0, 10);

      // ══════════════════════════════════════════════════════════
      // COUNT TOTAL PARTICIPANTS (Players + Coaches + Staff)
      // ══════════════════════════════════════════════════════════
      let totalParticipants = 0;
      
      if (teams && teams.length > 0) {
        const teamIds = teams.map((t: any) => t.id);
        
        // Count rostered players
        const { data: rosterCounts } = await supabase
          .from('kkup_team_rosters')
          .select('team_id')
          .in('team_id', teamIds);
        
        const totalPlayers = (rosterCounts || []).length;
        
        // Fetch all teams to get coach_person_id
        const { data: teamsWithCoaches } = await supabase
          .from('kkup_teams')
          .select('coach_person_id')
          .in('id', teamIds);
        
        // Count unique coaches (from kkup_teams.coach_person_id)
        const uniqueCoaches = new Set(
          (teamsWithCoaches || [])
            .map((t: any) => t.coach_person_id)
            .filter(Boolean)
        );
        const totalCoaches = uniqueCoaches.size;
        
        // Count staff (from kkup_tournament_staff)
        const { data: staffCounts } = await supabase
          .from('kkup_tournament_staff')
          .select('person_id')
          .eq('tournament_id', tournamentId);
        
        const uniqueStaff = new Set((staffCounts || []).map((s: any) => s.person_id));
        const totalStaff = uniqueStaff.size;
        
        totalParticipants = totalPlayers + totalCoaches + totalStaff;
        console.log(`📊 Total participants: ${totalParticipants} (${totalPlayers} players + ${totalCoaches} coaches + ${totalStaff} staff)`);
      }

      return c.json({
        tournament: {
          id: tournament.id,
          name: tournament.name,
          description: tournament.description,
          start_date: tournament.start_date,
          end_date: tournament.end_date,
          status: tournament.status,
          prize_pool: tournament.prize_pool,
          prize_pool_donations: tournament.prize_pool_donations,
          total_teams: teams?.length || 0,
          total_players: totalParticipants, // Now includes players + coaches + staff
          total_matches: matches.length,
          total_heroes_picked: totalHeroesPicked,
          youtube_vod_url: tournament.youtube_url || null
        },
        champion: teamsWithPlacements[0] || null,
        top_teams: await (async () => {
          const avgRankMap = await computeTeamAvgRanks(supabase, teams || []);
          return teamsWithPlacements.map((team: any) => ({
            ...team,
            losses: teamLosses[team.id] || 0,
            avg_rank: avgRankMap[team.id] || null
          }));
        })(),
        most_picked_heroes: mostPickedHeroes,
        top_players: topPlayers,
        data_source: dataSource,
        empty_state: false,
        prizes: prizes || [],
        awards: awards || [],
      });
    } catch (err) {
      console.error('Unexpected error fetching overview data:', err);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ════════════════════════════════════════════════════════
  // STAFF TAB DATA
  // ════════════════════════════════════════════════════════

  // GET /kkup/tournaments/:id/staff-roster - Get all approved staff for a tournament, grouped by stream
  app.get(`${PREFIX}/kkup/tournaments/:id/staff-roster`, async (c) => {
    try {
      const tournamentId = c.req.param('id');

      console.log(`📋 Fetching staff for tournament ${tournamentId}...`);

      // Fetch all staff for this tournament with person data
      const { data: staff, error } = await supabase
        .from('kkup_tournament_staff')
        .select(`
          id,
          tournament_id,
          person_id,
          person_name,
          role,
          stream_assignment,
          kkup_persons!inner (
            id,
            steam_id,
            display_name,
            avatar_url
          )
        `)
        .eq('tournament_id', tournamentId)
        .order('stream_assignment', { ascending: true });

      if (error) {
        console.error(`Failed to fetch staff for tournament ${tournamentId}:`, error);
        return c.json({ error: 'Failed to fetch staff', details: error.message }, 500);
      }

      if (!staff || staff.length === 0) {
        console.log(`⚠️ No staff found for tournament ${tournamentId}`);
        return c.json({ streams: [] });
      }

      console.log(`✅ Found ${staff.length} staff members`);

      // Enrich staff with user data (TCF+ status, Discord avatar, Twitch) via enrichPersonsWithUserData
      const steamIds = staff
        .map((s: any) => s.kkup_persons?.steam_id)
        .filter(Boolean);

      const userDataMap = await enrichPersonsWithUserData(supabase, steamIds);

      // Group staff by stream_assignment
      const streamMap: Record<string, any[]> = {};

      staff.forEach((member: any) => {
        const stream = member.stream_assignment || 'Unassigned';
        if (!streamMap[stream]) {
          streamMap[stream] = [];
        }

        const steamId = member.kkup_persons?.steam_id;
        const userData = steamId ? userDataMap[steamId] : null;

        streamMap[stream].push({
          id: member.id,
          person_id: member.person_id,
          name: member.kkup_persons?.display_name || member.person_name || 'Unknown',
          // Prefer Discord avatar from users table (higher quality), fall back to Steam avatar
          avatar: userData?.discord_avatar || member.kkup_persons?.avatar_url || null,
          role: member.role,
          tcf_plus: userData?.tcf_plus_active || false,
          twitch_username: userData?.twitch_username || null,
          twitch_avatar: userData?.twitch_avatar || null,
        });
      });

      // Convert to array of stream objects
      const streams = Object.entries(streamMap).map(([streamName, members]) => ({
        name: streamName,
        staff: members
      }));

      // Sort streams: "Stream A", "Stream B", etc. first, then "Unassigned"
      streams.sort((a, b) => {
        if (a.name === 'Unassigned') return 1;
        if (b.name === 'Unassigned') return -1;
        return a.name.localeCompare(b.name);
      });

      console.log(`📺 Returning ${streams.length} stream groups`);
      console.log(`📺 Sample stream data:`, JSON.stringify(streams.slice(0, 1), null, 2));

      return c.json({ streams });
    } catch (err) {
      console.error('Unexpected error fetching staff data:', err);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

}