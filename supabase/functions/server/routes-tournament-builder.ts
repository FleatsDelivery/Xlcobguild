/**
 * Tournament Builder Routes -- fetch + import tournament from Steam/OpenDota APIs
 * 2 routes (each ~500 lines of orchestration logic)
 */
import type { Hono } from "npm:hono";
import * as steamResearch from "./steam-api-research.tsx";
import { PREFIX, getSteamLogoUrl, getHeroName } from "./helpers.ts";
import { createAdminLog } from "./routes-notifications.ts";

export function registerTournamentBuilderRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ── Helper: require owner ──
  async function requireOwner(c: any) {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return null;
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    if (authError || !authUser) return null;
    const { data: dbUser } = await supabase.from('users').select('role').eq('supabase_id', authUser.id).single();
    if (!dbUser || dbUser.role !== 'owner') return null;
    return authUser;
  }

  /**
   * POST /kkup/fetch-tournament-builder
   * 5-stage fetch: league → series → matches → teams → players
   * Body: { league_id, series_id?, match_id?, team_id?, player_id? }
   */
  app.post(`${PREFIX}/kkup/fetch-tournament-builder`, async (c) => {
    try {
      const authUser = await requireOwner(c);
      if (!authUser) return c.json({ error: 'Owner access required' }, 403);

      const body = await c.req.json();
      const { league_id, series_id, match_id, team_id, player_id } = body;
      if (!league_id) return c.json({ error: 'league_id is required' }, 400);

      const results: any = {
        timestamp: new Date().toISOString(),
        inputs: { league_id, series_id, match_id, team_id, player_id },
        league: { status: 'pending', data: null, error: null },
        series: { status: 'pending', data: null, error: null },
        teams: { status: 'pending', data: null, error: null },
        matches: { status: 'pending', data: null, error: null },
        players: { status: 'pending', data: null, error: null },
        comparison: { status: 'pending', data: null, error: null },
        summary: { totalTeams: 0, totalMatches: 0, totalPlayers: 0, dataQuality: 'unknown' },
        recommendations: []
      };

      // Stage 1: League (OpenDota)
      try {
        const res = await fetch(`https://api.opendota.com/api/leagues/${league_id}`);
        const data = await res.json();
        if (res.ok && !data.error) { results.league = { status: 'success', data, error: null }; }
        else { results.league = { status: 'error', data: null, error: data.error || 'League not found' }; }
      } catch (e) { results.league = { status: 'error', data: null, error: String(e) }; }

      // Stage 2: Series (OpenDota, optional)
      if (series_id) {
        try {
          const res = await fetch(`https://api.opendota.com/api/series/${series_id}`);
          const data = await res.json();
          if (res.ok && !data.error) { results.series = { status: 'success', data, error: null }; }
          else { results.series = { status: 'error', data: null, error: data.error || 'Series not found' }; }
        } catch (e) { results.series = { status: 'error', data: null, error: String(e) }; }
      } else {
        results.series = { status: 'skipped', data: null, error: 'No series_id provided' };
      }

      // Stage 3: Matches (Steam API)
      try {
        const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
        const url = `https://api.steampowered.com/IDOTA2Match_570/GetMatchHistory/v1/?key=${STEAM_API_KEY}&league_id=${league_id}&matches_requested=100`;
        const res = await fetch(url);
        const data = await res.json();
        if (data?.result?.matches && Array.isArray(data.result.matches)) {
          results.matches = { status: 'success', data: data.result.matches, error: null };
          results.summary.totalMatches = data.result.matches.length;
        } else {
          results.matches = { status: 'error', data: null, error: 'No matches found' };
        }
      } catch (e) { results.matches = { status: 'error', data: null, error: String(e) }; }

      // Stage 4: Teams (extract from matches, enrich via Steam → OpenDota)
      try {
        if (results.matches.data && Array.isArray(results.matches.data)) {
          const uniqueTeamIds = new Set<number>();
          results.matches.data.forEach((m: any) => {
            if (m.radiant_team_id) uniqueTeamIds.add(m.radiant_team_id);
            if (m.dire_team_id) uniqueTeamIds.add(m.dire_team_id);
          });

          const teamDetails: any[] = [];
          const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';

          for (const tid of Array.from(uniqueTeamIds)) {
            let info: any = { team_id: tid, team_name: `Team ${tid}`, tag: `T${String(tid).slice(-4)}`, logo_url: null, wins: 0, losses: 0 };
            try {
              const steamRes = await fetch(`https://api.steampowered.com/IDOTA2Match_570/GetTeamInfoByTeamID/v1/?key=${STEAM_API_KEY}&start_at_team_id=${tid}&teams_requested=1`);
              const steamData = await steamRes.json();
              if (steamData?.result?.teams?.[0]) {
                const t = steamData.result.teams[0];
                info.team_name = t.name || info.team_name;
                info.tag = t.tag || info.tag;
                if (t.logo || t.url_logo) info.logo_url = getSteamLogoUrl(t.logo || t.url_logo);
              } else {
                const odRes = await fetch(`https://api.opendota.com/api/teams/${tid}`);
                if (odRes.ok) { const od = await odRes.json(); if (od?.name) { info.team_name = od.name; info.tag = od.tag || info.tag; info.logo_url = od.logo_url || null; } }
              }
            } catch (_) { /* fallback info already set */ }
            teamDetails.push(info);
            await new Promise(r => setTimeout(r, 100));
          }

          // Calc W/L from matches
          const wlMap = new Map<number, { wins: number; losses: number }>();
          teamDetails.forEach(t => wlMap.set(t.team_id, { wins: 0, losses: 0 }));
          results.matches.data.forEach((m: any) => {
            if (m.radiant_team_id && m.dire_team_id) {
              const rStats = wlMap.get(m.radiant_team_id);
              const dStats = wlMap.get(m.dire_team_id);
              if (m.radiant_win) { if (rStats) rStats.wins++; if (dStats) dStats.losses++; }
              else { if (dStats) dStats.wins++; if (rStats) rStats.losses++; }
            }
          });
          teamDetails.forEach(t => { const s = wlMap.get(t.team_id); if (s) { t.wins = s.wins; t.losses = s.losses; } });

          results.teams = { status: 'success', data: teamDetails, error: null };
          results.summary.totalTeams = teamDetails.length;
        } else {
          results.teams = { status: 'error', data: null, error: 'No match data to extract teams from' };
        }
      } catch (e) { results.teams = { status: 'error', data: null, error: String(e) }; }

      // Stage 5: Players (extract from matches, enrich via OpenDota → Steam)
      try {
        if (results.matches.data && Array.isArray(results.matches.data)) {
          const uniquePlayers = new Set<number>();
          results.matches.data.forEach((m: any) => {
            if (m.players && Array.isArray(m.players)) m.players.forEach((p: any) => { if (p.account_id) uniquePlayers.add(p.account_id); });
          });

          const playerDetails: any[] = [];
          for (const accountId of Array.from(uniquePlayers)) {
            const steam32 = accountId;
            const steam64 = (BigInt(steam32) + BigInt('76561197960265728')).toString();
            let info: any = { account_id: steam32, steam_id: steam64, name: `Player ${steam32}`, avatar_url: null, dotabuff_url: `https://www.dotabuff.com/players/${steam32}`, opendota_url: `https://www.opendota.com/players/${steam32}` };
            try {
              const odRes = await fetch(`https://api.opendota.com/api/players/${steam32}`);
              if (odRes.ok) {
                const od = await odRes.json();
                if (od?.profile) { info.name = od.profile.personaname || od.profile.name || info.name; info.avatar_url = od.profile.avatarfull || null; }
              } else {
                const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
                const sRes = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steam64}`);
                if (sRes.ok) { const sd = await sRes.json(); const sp = sd?.response?.players?.[0]; if (sp) { info.name = sp.personaname || info.name; info.avatar_url = sp.avatarfull || null; } }
              }
            } catch (_) { /* fallback info already set */ }
            playerDetails.push(info);
            await new Promise(r => setTimeout(r, 100));
          }

          results.players = { status: 'success', data: playerDetails, error: null };
          results.summary.totalPlayers = uniquePlayers.size;
        } else {
          results.players = { status: 'error', data: null, error: 'No match data to extract players from' };
        }
      } catch (e) { results.players = { status: 'error', data: null, error: String(e) }; }

      // Stage 6: Comparison (optional, if match_id provided)
      if (match_id) {
        try {
          const compData = await steamResearch.compareSteamVsOpenDota(match_id);
          results.comparison = { status: 'success', data: compData, error: null };
        } catch (e) { results.comparison = { status: 'error', data: null, error: String(e) }; }
      } else {
        results.comparison = { status: 'skipped', data: null, error: 'No match_id provided' };
      }

      // Recommendations
      const successCount = [results.league, results.teams, results.matches, results.players]
        .filter(s => s.status === 'success').length;
      if (successCount === 4) {
        results.summary.dataQuality = 'excellent';
        results.recommendations.push('✅ All data fetched successfully! Ready to create tournament.');
      } else if (successCount >= 2) {
        results.summary.dataQuality = 'partial';
        results.recommendations.push('⚠️ Some data missing, but tournament can still be created');
      } else {
        results.summary.dataQuality = 'poor';
        results.recommendations.push('❌ Most data failed to fetch - check league_id and try again');
      }

      return c.json({ success: true, results });
    } catch (error) {
      console.error('Tournament Builder error:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  /**
   * POST /kkup/import-tournament-builder
   * Takes fetch results and creates tournament + teams + matches + player stats
   * Body: { tournament_name, league_data, teams_data, matches_data, metadata? }
   */
  app.post(`${PREFIX}/kkup/import-tournament-builder`, async (c) => {
    try {
      const authUser = await requireOwner(c);
      if (!authUser) return c.json({ error: 'Owner access required' }, 403);

      const body = await c.req.json();
      const { tournament_name, league_data, teams_data, matches_data, metadata = {} } = body;
      if (!tournament_name || !league_data) return c.json({ error: 'tournament_name and league_data are required' }, 400);

      const leagueId = league_data.leagueid || league_data.league_id;
      const tournamentStartDate = league_data.start_date ? new Date(league_data.start_date * 1000).toISOString() : new Date().toISOString();
      const tournamentEndDate = league_data.end_date ? new Date(league_data.end_date * 1000).toISOString() : new Date().toISOString();

      // Step 1: Create or update tournament
      const { data: existingTournament } = await supabase.from('kkup_tournaments').select('*').eq('league_id', leagueId).maybeSingle();
      let kkupId: string;

      if (existingTournament) {
        kkupId = existingTournament.id;
        await supabase.from('kkup_tournaments').update({ name: tournament_name, import_status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', kkupId);
        console.log(`⚠️ Updating existing tournament: ${kkupId}`);
      } else {
        const { data: newTournament, error: tournamentError } = await supabase
          .from('kkup_tournaments')
          .insert({
            name: tournament_name, league_id: leagueId, series_id: metadata.series_id || 0,
            verified_match_id: metadata.verified_match_id || 0,
            tournament_start_date: tournamentStartDate, tournament_end_date: tournamentEndDate,
            prize_pool: metadata.prize_pool || 'TBD', status: metadata.status || 'completed',
            description: metadata.description || league_data.name || tournament_name,
            twitch_channel: metadata.twitch_channel || '', youtube_playlist_url: metadata.youtube_playlist_url || '',
            cover_photo_url: league_data.banner || null, import_status: 'in_progress', created_at: new Date().toISOString()
          }).select().single();
        if (tournamentError) return c.json({ error: 'Failed to create tournament', details: tournamentError.message }, 500);
        kkupId = newTournament.id;
        console.log(`✅ Tournament created: ${kkupId}`);
      }

      // Step 2: Create teams
      const teamIdMap = new Map();
      let teamsCreated = 0;
      if (teams_data && Array.isArray(teams_data)) {
        for (const team of teams_data) {
          try {
            const { data: dbTeam, error: teamError } = await supabase
              .from('kkup_teams')
              .insert({
                tournament_id: kkupId, valve_team_id: team.team_id,
                team_name: team.team_name || team.name || `Team ${team.team_id}`,
                team_tag: team.tag || (team.team_name || '').substring(0, 5).toUpperCase() || 'TEAM',
                logo_url: team.logo_url || null, wins: team.wins || 0, losses: team.losses || 0,
                created_at: new Date().toISOString()
              }).select().single();
            if (!teamError && dbTeam) { teamIdMap.set(team.team_id, dbTeam.id); teamsCreated++; }
          } catch (e) { console.error(`Error creating team ${team.team_id}:`, e); }
        }
      }

      // Step 3: Create player profiles & roster links
      const playerProfileMap = new Map();
      let playersCreated = 0;
      let rosterLinksCreated = 0;
      const playersByTeam = new Map<number, Set<number>>();

      if (matches_data && Array.isArray(matches_data)) {
        for (const match of matches_data) {
          if (match.players && Array.isArray(match.players)) {
            for (const player of match.players) {
              if (!player.account_id) continue;
              const teamId = player.player_slot < 128 ? match.radiant_team_id : match.dire_team_id;
              if (!playersByTeam.has(teamId)) playersByTeam.set(teamId, new Set());
              playersByTeam.get(teamId)?.add(player.account_id);
            }
          }
        }
      }

      // Collect all unique account_ids
      const allAccountIds = new Set<number>();
      for (const ids of playersByTeam.values()) ids.forEach(id => allAccountIds.add(id));

      for (const accountId of allAccountIds) {
        try {
          const steam32 = accountId;
          const steam64 = (BigInt(steam32) + BigInt('76561197960265728')).toString();
          let playerName = `Player ${steam32}`;
          let avatarUrl = null;

          try {
            const res = await fetch(`https://api.opendota.com/api/players/${steam32}`);
            if (res.ok) { const d = await res.json(); if (d?.profile) { playerName = d.profile.personaname || playerName; avatarUrl = d.profile.avatarfull || null; } }
          } catch (_) { /* use defaults */ }

          const { data: existing } = await supabase.from('kkup_persons').select('id').eq('steam_id', steam64).maybeSingle();
          if (existing) {
            playerProfileMap.set(accountId, existing.id);
          } else {
            const { data: newProfile, error: profileError } = await supabase
              .from('kkup_persons')
              .insert({ steam_id: steam64, display_name: playerName, avatar_url: avatarUrl, created_at: new Date().toISOString() })
              .select().single();
            if (!profileError && newProfile) { playerProfileMap.set(accountId, newProfile.id); playersCreated++; }
          }
          await new Promise(r => setTimeout(r, 50));
        } catch (e) { console.error(`Error creating player profile for ${accountId}:`, e); }
      }

      // Roster links
      for (const [teamId, playerIds] of playersByTeam.entries()) {
        const dbTeamId = teamIdMap.get(teamId);
        if (!dbTeamId) continue;
        for (const accountId of playerIds) {
          const profileId = playerProfileMap.get(accountId);
          if (!profileId) continue;
          const { data: existing } = await supabase.from('kkup_team_rosters').select('id').eq('team_id', dbTeamId).eq('person_id', profileId).maybeSingle();
          if (!existing) {
            const { error } = await supabase.from('kkup_team_rosters').insert({ team_id: dbTeamId, person_id: profileId, created_at: new Date().toISOString() });
            if (!error) rosterLinksCreated++;
          }
        }
      }

      // Step 4: Create matches with full OpenDota data
      let matchesCreated = 0;
      let playerStatsCreated = 0;
      const apiKey = Deno.env.get('OPENDOTA_API_KEY');

      if (matches_data && Array.isArray(matches_data)) {
        for (let i = 0; i < matches_data.length; i++) {
          const match = matches_data[i];
          try {
            const detailRes = await fetch(`https://api.opendota.com/api/matches/${match.match_id}?api_key=${apiKey}`);
            if (!detailRes.ok) continue;
            const detail = await detailRes.json();
            if (!detail || detail.error) continue;

            const dbTeam1Id = teamIdMap.get(match.radiant_team_id || detail.radiant_team_id);
            const dbTeam2Id = teamIdMap.get(match.dire_team_id || detail.dire_team_id);
            if (!dbTeam1Id || !dbTeam2Id) continue;

            const winnerTeamId = detail.radiant_win ? dbTeam1Id : dbTeam2Id;

            const { data: existingMatch } = await supabase.from('kkup_matches').select('id').eq('match_id', match.match_id).maybeSingle();
            let dbMatch: any;

            if (existingMatch) {
              dbMatch = existingMatch;
            } else {
              const { data: newMatch, error: matchError } = await supabase
                .from('kkup_matches')
                .insert({
                  tournament_id: kkupId, match_id: match.match_id,
                  series_id: match.series_id || detail.series_id || null,
                  team1_id: dbTeam1Id, team2_id: dbTeam2Id, winner_team_id: winnerTeamId,
                  team1_score: detail.radiant_score || 0, team2_score: detail.dire_score || 0,
                  stage: 'playoffs', status: 'completed',
                  scheduled_time: detail.start_time ? new Date(detail.start_time * 1000).toISOString() : new Date().toISOString(),
                  dotabuff_url: `https://www.dotabuff.com/matches/${match.match_id}`,
                  duration: detail.duration || 0, best_of: match.best_of || 1,
                  created_at: new Date().toISOString()
                }).select().single();
              if (matchError) continue;
              dbMatch = newMatch;
              matchesCreated++;
            }

            // Player stats
            if (dbMatch && detail.players && Array.isArray(detail.players)) {
              for (const player of detail.players) {
                try {
                  const isRadiant = player.player_slot < 128;
                  const playerTeamId = isRadiant ? dbTeam1Id : dbTeam2Id;
                  const isWinner = detail.radiant_win === isRadiant;
                  const profileId = playerProfileMap.get(player.account_id);
                  if (!profileId) continue;

                  await supabase.from('kkup_player_match_stats').insert({
                    match_id: dbMatch.id, team_id: playerTeamId, person_id: profileId,
                    steam_id: player.account_id || null,
                    player_name: player.personaname || `Player ${player.account_id || 'Unknown'}`,
                    hero_id: player.hero_id || 0, hero_name: getHeroName(player.hero_id || 0),
                    kills: player.kills || 0, deaths: player.deaths || 0, assists: player.assists || 0,
                    last_hits: player.last_hits || 0, denies: player.denies || 0,
                    gpm: player.gold_per_min || 0, xpm: player.xp_per_min || 0,
                    hero_damage: player.hero_damage || 0, tower_damage: player.tower_damage || 0,
                    hero_healing: player.hero_healing || 0, level: player.level || 0,
                    net_worth: player.net_worth || player.total_gold || 0,
                    item_0: player.item_0 || null, item_1: player.item_1 || null,
                    item_2: player.item_2 || null, item_3: player.item_3 || null,
                    item_4: player.item_4 || null, item_5: player.item_5 || null,
                    observer_uses: player.observer_uses || player.purchase_observer || 0,
                    sentry_uses: player.sentry_uses || player.purchase_sentry || 0,
                    is_winner: isWinner
                  });
                  playerStatsCreated++;
                } catch (_) { /* non-critical */ }
              }
            }

            await new Promise(r => setTimeout(r, 250));
          } catch (e) { console.error(`Error processing match ${match.match_id}:`, e); }
        }
      }

      // Step 5: Mark complete
      await supabase.from('kkup_tournaments').update({ import_status: 'completed', imported_at: new Date().toISOString() }).eq('id', kkupId);

      console.log(`💾 Import complete: ${teamsCreated} teams, ${matchesCreated} matches, ${playerStatsCreated} stats, ${playersCreated} profiles, ${rosterLinksCreated} roster links`);

      try { await createAdminLog({ type: 'tournament_imported', action: `Imported "${tournament_name}" via Tournament Builder (${teamsCreated} teams, ${matchesCreated} matches, ${playerStatsCreated} stats)`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({
        success: true, tournament_id: kkupId,
        stats: { teams_created: teamsCreated, matches_created: matchesCreated, player_stats_created: playerStatsCreated, players_created: playersCreated, roster_links_created: rosterLinksCreated }
      });
    } catch (error) {
      console.error('Tournament import error:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

}