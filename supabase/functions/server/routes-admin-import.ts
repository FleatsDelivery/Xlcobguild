/**
 * Admin Import Routes -- 5-ID verification import pipeline, test/preview, import-from-test
 * 3 routes (each ~300+ lines of Steam API orchestration)
 */
import type { Hono } from "npm:hono";
import { PREFIX, getHeroName, getSteamLogoUrl, steam32ToSteam64 } from "./helpers.ts";
import { createAdminLog } from "./routes-notifications.ts";

const STEAM_API_BASE = 'https://api.steampowered.com';
const DOTA2_APP_ID = 570;

export function registerAdminImportRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ── Shared auth check (owner via users table) ──
  async function requireAdmin(c: any) {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return null;
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    if (authError || !authUser) return null;
    const { data: dbUser } = await supabase.from('users').select('role').eq('supabase_id', authUser.id).single();
    const allowedRoles = ['owner', 'queen_of_hog'];
    if (!dbUser || !allowedRoles.includes(dbUser.role)) return null;
    return authUser;
  }

  /**
   * POST /admin/import-tournament
   * Full pipeline: 5-ID verification → fetch all matches → create tournament + teams + matches + player stats
   */
  app.post(`${PREFIX}/admin/import-tournament`, async (c) => {
    try {
      const authUser = await requireAdmin(c);
      if (!authUser) return c.json({ error: 'Admin access required' }, 403);

      const { league_id, series_id, match_id, team_id, player_id } = await c.req.json();
      const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';

      // ── Step 1: Verify 5 IDs ──
      const errors: string[] = [];

      const leagueResponse = await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetLeagueListing/v1/?key=${STEAM_API_KEY}`);
      const leagueData = await leagueResponse.json();
      const leagueInfo = leagueData.result?.leagues?.find((l: any) => l.leagueid === league_id);
      if (!leagueInfo) errors.push(`League ID ${league_id} not found in Steam API`);
      const tournamentName = leagueInfo?.name || `Tournament ${league_id}`;

      const matchDetailResponse = await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match_id}`);
      const matchDetailData = await matchDetailResponse.json();
      if (!matchDetailData.result || matchDetailData.result.error) errors.push(`Match ID ${match_id} not found`);
      else if (matchDetailData.result.leagueid !== league_id) errors.push(`Match ID ${match_id} does not belong to League ID ${league_id}`);

      const radiantTeamId = matchDetailData.result?.radiant_team_id;
      const direTeamId = matchDetailData.result?.dire_team_id;
      if (radiantTeamId !== team_id && direTeamId !== team_id) errors.push(`Team ID ${team_id} not found in Match ID ${match_id}`);

      if (!matchDetailData.result?.players?.some((p: any) => p.account_id === player_id)) errors.push(`Player ID ${player_id} not found in Match ID ${match_id}`);

      if (matchDetailData.result?.series_id && matchDetailData.result.series_id !== series_id) errors.push(`Series ID ${series_id} does not match match data`);

      if (errors.length > 0) {
        return c.json({ error: 'Verification failed', details: errors, field_errors: {
          league_id: errors.find(e => e.includes('League')), match_id: errors.find(e => e.includes('Match')),
          team_id: errors.find(e => e.includes('Team')), player_id: errors.find(e => e.includes('Player')),
          series_id: errors.find(e => e.includes('Series'))
        }}, 400);
      }

      // ── Step 2: Fetch all matches ──
      const historyRes = await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchHistory/v1/?key=${STEAM_API_KEY}&league_id=${league_id}&matches_requested=100`);
      const allMatches = (await historyRes.json()).result?.matches || [];

      let earliestMatchTime = Infinity, latestMatchTime = 0;
      for (const m of allMatches) {
        if (m.start_time) { if (m.start_time < earliestMatchTime) earliestMatchTime = m.start_time; if (m.start_time > latestMatchTime) latestMatchTime = m.start_time; }
      }
      const tournamentStartDate = earliestMatchTime !== Infinity ? new Date(earliestMatchTime * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const tournamentEndDate = latestMatchTime > 0 ? new Date(latestMatchTime * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      // ── Step 3: Create tournament ──
      const { data: tournament, error: tournamentError } = await supabase.from('kkup_tournaments').insert({
        name: tournamentName, league_id, series_id, verified_match_id: match_id, verified_team_id: team_id, verified_player_id: player_id,
        tournament_start_date: tournamentStartDate, tournament_end_date: tournamentEndDate,
        import_status: 'in_progress', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).select().single();
      if (tournamentError || !tournament) return c.json({ error: 'Failed to create tournament', details: tournamentError }, 500);
      const kkupId = tournament.id;

      // ── Step 4: Process teams & matches ──
      const teamMap = new Map();
      let teamsCreated = 0, matchesCreated = 0;

      for (const match of allMatches) {
        try {
          const detailRes = await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match.match_id}`);
          const result = (await detailRes.json()).result;
          if (!result || result.error) continue;

          // Process radiant team
          let radiantDbTeam = teamMap.get(result.radiant_team_id) || null;
          if (result.radiant_team_id && !radiantDbTeam) {
            const teamInfoRes = await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetTeamInfoByTeamID/v1/?key=${STEAM_API_KEY}&start_at_team_id=${result.radiant_team_id}&teams_requested=1`);
            const td = (await teamInfoRes.json()).result?.teams?.[0];
            const { data: nt } = await supabase.from('kkup_teams').insert({
              tournament_id: kkupId, team_name: td?.name || result.radiant_name || 'Radiant Team', team_tag: td?.tag || 'RAD',
              valve_team_id: result.radiant_team_id, logo_url: td?.logo_url || td?.logo, imported_at: new Date().toISOString()
            }).select().single();
            if (nt) { teamMap.set(result.radiant_team_id, nt); radiantDbTeam = nt; teamsCreated++; }
          }

          // Process dire team
          let direDbTeam = teamMap.get(result.dire_team_id) || null;
          if (result.dire_team_id && !direDbTeam) {
            const teamInfoRes = await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetTeamInfoByTeamID/v1/?key=${STEAM_API_KEY}&start_at_team_id=${result.dire_team_id}&teams_requested=1`);
            const td = (await teamInfoRes.json()).result?.teams?.[0];
            const { data: nt } = await supabase.from('kkup_teams').insert({
              tournament_id: kkupId, team_name: td?.name || result.dire_name || 'Dire Team', team_tag: td?.tag || 'DIR',
              valve_team_id: result.dire_team_id, logo_url: td?.logo_url || td?.logo, imported_at: new Date().toISOString()
            }).select().single();
            if (nt) { teamMap.set(result.dire_team_id, nt); direDbTeam = nt; teamsCreated++; }
          }

          // Create match
          const { data: dbMatch } = await supabase.from('kkup_matches').insert({
            tournament_id: kkupId, match_id: match.match_id, series_id: result.series_id || null, series_type: result.series_type || null,
            team1_id: radiantDbTeam?.id, team2_id: direDbTeam?.id, radiant_team_id: result.radiant_team_id, dire_team_id: result.dire_team_id,
            winner_team_id: result.radiant_win ? radiantDbTeam?.id : direDbTeam?.id,
            team1_score: result.radiant_win ? 1 : 0, team2_score: result.radiant_win ? 0 : 1,
            radiant_win: result.radiant_win, duration: result.duration, status: 'completed', stage: 'playoffs',
            dotabuff_url: `https://www.dotabuff.com/matches/${match.match_id}`,
            scheduled_time: new Date(match.start_time * 1000).toISOString(), opendota_fetched: false
          }).select().single();

          if (dbMatch) {
            matchesCreated++;
            if (result.players && Array.isArray(result.players)) {
              for (const player of result.players) {
                if (!player.account_id) continue;
                const { data: existing } = await supabase.from('kkup_persons').select('*').eq('steam_id', String(player.account_id)).maybeSingle();
                let profile = existing;
                if (!profile) {
                  const { data: np } = await supabase.from('kkup_persons').insert({
                    display_name: player.personaname || `Player ${player.account_id}`, steam_id: String(player.account_id),
                  }).select().single();
                  profile = np;
                }
                if (!profile) continue;
                const isRadiant = player.player_slot < 128;
                await supabase.from('kkup_player_match_stats').insert({
                  match_id: dbMatch.id, person_id: profile.id, team_id: isRadiant ? radiantDbTeam?.id : direDbTeam?.id,
                  hero: getHeroName(player.hero_id || 0),
                  kills: player.kills || 0, deaths: player.deaths || 0, assists: player.assists || 0,
                  last_hits: player.last_hits || 0, denies: player.denies || 0,
                  gpm: player.gold_per_min || 0, xpm: player.xp_per_min || 0,
                  net_worth: player.total_gold || 0,
                });
              }
            }
          }
        } catch (e) { console.error(`Error processing match ${match.match_id}:`, e); }
      }

      // ── Step 5: Complete ──
      await supabase.from('kkup_tournaments').update({ import_status: 'completed', imported_at: new Date().toISOString() }).eq('id', kkupId);

      try { await createAdminLog({ type: 'tournament_imported', action: `Imported tournament "${tournamentName}" via 5-ID pipeline (${teamsCreated} teams, ${matchesCreated} matches)`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({ success: true, message: 'Tournament imported successfully', tournament_id: kkupId,
        stats: { teams_created: teamsCreated, matches_created: matchesCreated, next_step: 'Run OpenDota enrichment to fetch detailed player stats' } });
    } catch (error: any) {
      console.error('Tournament import error:', error);
      return c.json({ error: 'Internal server error', details: error?.message || String(error) }, 500);
    }
  });

  /**
   * POST /admin/test-tournament-import
   * Test/preview mode: fetches data but doesn't save anything
   */
  app.post(`${PREFIX}/admin/test-tournament-import`, async (c) => {
    try {
      const authUser = await requireAdmin(c);
      if (!authUser) return c.json({ error: 'Admin access required' }, 403);

      const { league_id, series_id, match_id, team_id, player_id } = await c.req.json();
      const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';

      // Verify IDs
      const errors: string[] = [];
      const leagueRes = await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetLeagueListing/v1/?key=${STEAM_API_KEY}`);
      const leagueInfo = (await leagueRes.json()).result?.leagues?.find((l: any) => l.leagueid === league_id);
      if (!leagueInfo) errors.push(`League ID ${league_id} not found`);
      const tournamentName = leagueInfo?.name || `Tournament ${league_id}`;

      const matchRes = await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match_id}`);
      const matchData = (await matchRes.json()).result;
      if (!matchData || matchData.error) errors.push(`Match ID ${match_id} not found`);
      else if (matchData.leagueid !== league_id) errors.push(`Match does not belong to league`);
      if (matchData?.radiant_team_id !== team_id && matchData?.dire_team_id !== team_id) errors.push(`Team ID ${team_id} not found in match`);
      if (!matchData?.players?.some((p: any) => p.account_id === player_id)) errors.push(`Player ID ${player_id} not found in match`);
      if (matchData?.series_id && matchData.series_id !== series_id) errors.push(`Series ID mismatch`);

      if (errors.length > 0) {
        return c.json({ verified: false, errors, field_errors: {
          league_id: errors.find(e => e.includes('League')), match_id: errors.find(e => e.includes('Match')),
          team_id: errors.find(e => e.includes('Team')), player_id: errors.find(e => e.includes('Player')),
          series_id: errors.find(e => e.includes('Series'))
        }}, 400);
      }

      // Fetch all matches
      const historyRes = await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchHistory/v1/?key=${STEAM_API_KEY}&league_id=${league_id}&matches_requested=100`);
      const allMatches = (await historyRes.json()).result?.matches || [];

      let earliestMatchTime = Infinity, latestMatchTime = 0;
      for (const m of allMatches) { if (m.start_time) { if (m.start_time < earliestMatchTime) earliestMatchTime = m.start_time; if (m.start_time > latestMatchTime) latestMatchTime = m.start_time; } }

      const teamsMap = new Map();
      const playersMap = new Map();
      const teamWL = new Map();

      // Process all matches for teams/players/W-L
      for (const match of allMatches) {
        try {
          const result = (await (await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match.match_id}`)).json()).result;
          if (!result || result.error) continue;

          for (const valveTeamId of [result.radiant_team_id, result.dire_team_id]) {
            if (valveTeamId && !teamsMap.has(valveTeamId)) {
              const td = (await (await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetTeamInfoByTeamID/v1/?key=${STEAM_API_KEY}&start_at_team_id=${valveTeamId}&teams_requested=1`)).json()).result?.teams?.[0];
              const isRadiant = valveTeamId === result.radiant_team_id;
              teamsMap.set(valveTeamId, {
                team_id: valveTeamId, team_name: td?.name || (isRadiant ? result.radiant_name : result.dire_name) || 'Team',
                tag: td?.tag || 'TEAM', logo_url: getSteamLogoUrl(td?.logo_url || td?.logo), wins: 0, losses: 0
              });
              teamWL.set(valveTeamId, { wins: 0, losses: 0 });
            }
          }

          if (result.radiant_win) {
            const r = teamWL.get(result.radiant_team_id); if (r) r.wins++;
            const d = teamWL.get(result.dire_team_id); if (d) d.losses++;
          } else {
            const d = teamWL.get(result.dire_team_id); if (d) d.wins++;
            const r = teamWL.get(result.radiant_team_id); if (r) r.losses++;
          }

          if (result.players) {
            for (const p of result.players) {
              if (p.account_id && !playersMap.has(p.account_id)) {
                playersMap.set(p.account_id, { account_id: p.account_id, steam_id: steam32ToSteam64(p.account_id),
                  name: p.personaname || `Player ${p.account_id}`, dotabuff_url: `https://www.dotabuff.com/players/${p.account_id}`, opendota_url: `https://www.opendota.com/players/${p.account_id}` });
              }
            }
          }
        } catch (_) { /* skip */ }
      }

      // Update W/L
      for (const [tid, team] of teamsMap.entries()) { const r = teamWL.get(tid); if (r) { team.wins = r.wins; team.losses = r.losses; } }

      // Enrich first 8 matches for preview
      const enrichedMatches: any[] = [];
      for (const match of allMatches.slice(0, 8)) {
        try {
          const result = (await (await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match.match_id}`)).json()).result;
          if (!result || result.error) continue;
          const rt = teamsMap.get(result.radiant_team_id);
          const dt = teamsMap.get(result.dire_team_id);
          const winner = result.radiant_win ? rt : dt;
          enrichedMatches.push({
            match_id: match.match_id, series_id: result.series_id || null, match_date: new Date(result.start_time * 1000).toISOString(),
            duration_seconds: result.duration, duration_formatted: `${Math.floor(result.duration / 60)}:${String(result.duration % 60).padStart(2, '0')}`,
            radiant_team: { team_id: result.radiant_team_id, name: rt?.team_name || 'Radiant', tag: rt?.tag, logo_url: rt?.logo_url },
            dire_team: { team_id: result.dire_team_id, name: dt?.team_name || 'Dire', tag: dt?.tag, logo_url: dt?.logo_url },
            winner: { team_id: winner?.team_id, name: winner?.team_name || 'Unknown', tag: winner?.tag },
            radiant_win: result.radiant_win, radiant_score: result.radiant_score || 0, dire_score: result.dire_score || 0,
            radiant_players: (result.players || []).filter((p: any) => p.player_slot < 128).map((p: any) => ({ account_id: p.account_id, name: playersMap.get(p.account_id)?.name || `Player ${p.account_id}`, hero_id: p.hero_id })),
            dire_players: (result.players || []).filter((p: any) => p.player_slot >= 128).map((p: any) => ({ account_id: p.account_id, name: playersMap.get(p.account_id)?.name || `Player ${p.account_id}`, hero_id: p.hero_id })),
          });
        } catch (_) { /* skip */ }
      }

      return c.json({
        verified: true, message: `Found tournament data for "${tournamentName}"`,
        data: { verified: true, tournament: {
          name: tournamentName, league_id, series_id, verified_match_id: match_id, verified_team_id: team_id, verified_player_id: player_id,
          tournament_start_date: earliestMatchTime !== Infinity ? new Date(earliestMatchTime * 1000).toISOString().split('T')[0] : null,
          tournament_end_date: latestMatchTime > 0 ? new Date(latestMatchTime * 1000).toISOString().split('T')[0] : null
        }, teams: Array.from(teamsMap.values()), matches: enrichedMatches, players: Array.from(playersMap.values()) },
        league: { leagueid: league_id, name: tournamentName, tier: leagueInfo?.tier || 'unknown' },
        stats: { total_matches: allMatches.length, total_teams: teamsMap.size, total_players: playersMap.size, matches_preview: enrichedMatches.length }
      });
    } catch (error: any) {
      console.error('Test error:', error);
      return c.json({ error: 'Internal server error', details: error?.message || String(error) }, 500);
    }
  });

  /**
   * POST /admin/import-tournament-from-test
   * Import pre-verified data from the test endpoint
   */
  app.post(`${PREFIX}/admin/import-tournament-from-test`, async (c) => {
    try {
      const authUser = await requireAdmin(c);
      if (!authUser) return c.json({ error: 'Admin access required' }, 403);

      const { tournament, teams, league_id } = await c.req.json();
      if (!tournament || !teams) return c.json({ error: 'Invalid data format' }, 400);

      // Create tournament
      const { data: dbTournament, error: tournamentError } = await supabase.from('kkup_tournaments').insert({
        name: tournament.name, league_id: tournament.league_id, series_id: tournament.series_id,
        verified_match_id: tournament.verified_match_id, verified_team_id: tournament.verified_team_id, verified_player_id: tournament.verified_player_id,
        tournament_start_date: tournament.tournament_start_date, tournament_end_date: tournament.tournament_end_date,
        import_status: 'in_progress', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).select().single();
      if (tournamentError || !dbTournament) return c.json({ error: 'Failed to create tournament', details: tournamentError }, 500);
      const kkupId = dbTournament.id;

      // Create teams
      const teamMap = new Map();
      for (const team of teams) {
        const { data: dbTeam } = await supabase.from('kkup_teams').insert({
          tournament_id: kkupId, team_name: team.name, team_tag: team.tag, valve_team_id: team.valve_team_id,
          logo_url: team.logo_url, imported_at: new Date().toISOString()
        }).select().single();
        if (dbTeam) teamMap.set(team.valve_team_id, dbTeam);
      }

      // Fetch and create matches
      const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
      const historyRes = await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchHistory/v1/?key=${STEAM_API_KEY}&league_id=${league_id}&matches_requested=100`);
      const allMatches = (await historyRes.json()).result?.matches || [];
      let matchesCreated = 0;

      for (const match of allMatches) {
        try {
          const result = (await (await fetch(`${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match.match_id}`)).json()).result;
          if (!result || result.error) continue;

          const radiantDbTeam = teamMap.get(result.radiant_team_id);
          const direDbTeam = teamMap.get(result.dire_team_id);

          const { data: dbMatch } = await supabase.from('kkup_matches').insert({
            tournament_id: kkupId, valve_match_id: match.match_id, match_date: new Date(result.start_time * 1000).toISOString(),
            duration_seconds: result.duration || 0, scheduled_time: new Date(result.start_time * 1000).toISOString(),
            radiant_team_id: radiantDbTeam?.id, dire_team_id: direDbTeam?.id,
            team1_id: radiantDbTeam?.id, team2_id: direDbTeam?.id,
            winner_team_id: result.radiant_win ? radiantDbTeam?.id : direDbTeam?.id,
            radiant_win: result.radiant_win || false, radiant_score: result.radiant_score || 0, dire_score: result.dire_score || 0,
            team1_score: result.radiant_score || 0, team2_score: result.dire_score || 0,
            stage: 'tournament', status: 'completed', imported_at: new Date().toISOString()
          }).select().single();

          if (dbMatch) {
            matchesCreated++;
            if (result.players) {
              for (const player of result.players) {
                if (!player.account_id) continue;
                const { data: existing } = await supabase.from('kkup_persons').select('*').eq('steam_id', String(player.account_id)).maybeSingle();
                let profile = existing;
                if (!profile) {
                  const { data: np } = await supabase.from('kkup_persons').insert({
                    steam_id: String(player.account_id), display_name: player.personaname || `Player ${player.account_id}`,
                    dotabuff_url: `https://www.dotabuff.com/players/${player.account_id}`, opendota_url: `https://www.opendota.com/players/${player.account_id}`,
                  }).select().single();
                  profile = np;
                }
                if (!profile) continue;
                const isRadiant = player.player_slot < 128;
                await supabase.from('kkup_player_match_stats').insert({
                  match_id: dbMatch.id, person_id: profile.id, team_id: isRadiant ? radiantDbTeam?.id : direDbTeam?.id,
                  hero: getHeroName(player.hero_id || 0),
                  kills: player.kills || 0, deaths: player.deaths || 0, assists: player.assists || 0,
                  last_hits: player.last_hits || 0, denies: player.denies || 0,
                  gpm: player.gold_per_min || 0, xpm: player.xp_per_min || 0,
                  net_worth: player.total_gold || 0,
                });
              }
            }
          }
        } catch (e) { console.error('Error processing match:', e); }
      }

      // Calculate W/L and update teams
      const { data: allTournamentMatches } = await supabase.from('kkup_matches').select('*').eq('tournament_id', kkupId);
      const teamRecords = new Map<string, { wins: number; losses: number }>();
      for (const [_, dbTeam] of teamMap.entries()) teamRecords.set(dbTeam.id, { wins: 0, losses: 0 });
      for (const m of (allTournamentMatches || [])) {
        if (m.radiant_team_id && m.dire_team_id) {
          if (m.radiant_win) { const r = teamRecords.get(m.radiant_team_id); if (r) r.wins++; const d = teamRecords.get(m.dire_team_id); if (d) d.losses++; }
          else { const d = teamRecords.get(m.dire_team_id); if (d) d.wins++; const r = teamRecords.get(m.radiant_team_id); if (r) r.losses++; }
        }
      }
      for (const [teamId, record] of teamRecords.entries()) await supabase.from('kkup_teams').update({ wins: record.wins, losses: record.losses }).eq('id', teamId);

      await supabase.from('kkup_tournaments').update({ import_status: 'completed', imported_at: new Date().toISOString() }).eq('id', kkupId);

      try { await createAdminLog({ type: 'tournament_imported', action: `Imported tournament "${tournament.name || 'Unknown'}" from test data (${teamMap.size} teams, ${matchesCreated} matches)`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({ success: true, message: 'Tournament imported successfully', tournament_id: kkupId,
        stats: { teams_created: teamMap.size, matches_created: matchesCreated } });
    } catch (error: any) {
      console.error('Import error:', error);
      return c.json({ error: 'Internal server error', details: error?.message || String(error) }, 500);
    }
  });

}