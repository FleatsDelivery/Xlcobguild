/**
 * Tournament CRUD Routes -- teams, matches, players, roster, file upload, public tournament list
 * 13 routes
 */
import type { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";
import { createAdminLog } from "./routes-notifications.ts";

export function registerTournamentCrudRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ── Helper: verify owner role ──
  async function requireOwner(c: any): Promise<{ ok: true; authUser: any; dbUser: any } | { ok: false; response: any }> {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return { ok: false, response: c.json({ error: 'Unauthorized' }, 401) };
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    if (authError || !authUser) return { ok: false, response: c.json({ error: 'Unauthorized' }, 401) };
    const { data: dbUser } = await supabase.from('users').select('role').eq('supabase_id', authUser.id).single();
    if (!dbUser || dbUser.role !== 'owner') return { ok: false, response: c.json({ error: 'Only owners can perform this action' }, 403) };
    return { ok: true, authUser, dbUser };
  }

  // ── Helper: verify any authenticated user ──
  async function requireAuth(c: any): Promise<{ ok: true; authUser: any; dbUser: any } | { ok: false; response: any }> {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return { ok: false, response: c.json({ error: 'Unauthorized' }, 401) };
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    if (authError || !authUser) return { ok: false, response: c.json({ error: 'Unauthorized' }, 401) };
    const { data: dbUser } = await supabase.from('users').select('role').eq('supabase_id', authUser.id).single();
    if (!dbUser) return { ok: false, response: c.json({ error: 'User not found' }, 404) };
    return { ok: true, authUser, dbUser };
  }

  // ════════════════════════════
  // PUBLIC TOURNAMENT LIST
  // ═══════════════════════════

  // Get all tournaments (public endpoint for frontend /tournaments page)
  app.get(`${PREFIX}/tournaments`, async (c) => {
    try {
      // Read from the NEW kkup_tournaments table (Phase 1 schema)
      const { data: rawTournaments, error } = await supabase
        .from('kkup_tournaments').select('*').order('tournament_start_date', { ascending: false });
      if (error) {
        console.error('Failed to fetch tournaments from kkup_tournaments:', error);
        return c.json({ error: 'Failed to fetch tournaments', details: error.message }, 500);
      }

      // For tournaments with a winning_team_id, fetch the team info
      const winTeamIds = (rawTournaments || [])
        .map((t: any) => t.winning_team_id)
        .filter(Boolean);

      let winningTeamMap = new Map();
      if (winTeamIds.length > 0) {
        const { data: winTeams } = await supabase
          .from('kkup_teams').select('id, team_name, team_tag')
          .in('id', winTeamIds);
        (winTeams || []).forEach((team: any) => {
          winningTeamMap.set(team.id, team);
        });
      }

      // Map to the response format the frontend expects
      const tournaments = (rawTournaments || []).map((t: any) => {
        const winTeam = t.winning_team_id ? winningTeamMap.get(t.winning_team_id) : null;
        return {
          id: t.id,
          name: t.name || 'Kernel Kup',
          description: t.description || '',
          start_date: t.tournament_start_date,
          end_date: t.tournament_end_date,
          status: t.status || 'completed',
          max_teams: t.team_count || 8,
          registration_deadline: t.registration_end_date || t.tournament_start_date,
          prize_pool: t.prize_pool ? String(t.prize_pool) : 'TBA',
          prize_pool_donations: t.prize_pool_donations ?? 0,
          format: t.tournament_type === 'heaps_n_hooks' ? '1v1 Mid' : 'Single Elimination',
          rules: '',
          league_id: t.league_id,
          twitch_channel: t.twitch_url_1 || null,
          tournament_start_date: t.tournament_start_date,
          tournament_type: t.tournament_type,
          youtube_url: t.youtube_url,
          twitch_url_1: t.twitch_url_1,
          twitch_url_2: t.twitch_url_2,
          winning_team_name: t.winning_team_name,
          kkup_season: t.kkup_season ?? null,
          created_at: t.created_at,
          updated_at: t.created_at,
          winning_team: winTeam
            ? { id: winTeam.id, name: winTeam.team_name, tag: winTeam.team_tag }
            : (t.winning_team_name ? { name: t.winning_team_name, tag: t.winning_team_name } : null),
        };
      });

      return c.json({ tournaments });
    } catch (error: any) {
      console.error('Get tournaments error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ════════════════════════════
  // TEAM CRUD
  // ════════════════════════════

  // Create team (Owner only)
  app.post(`${PREFIX}/tournament/:kkup_id/team`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const kkupId = c.req.param('kkup_id');
      const body = await c.req.json();

      const { data: team, error: insertError } = await supabase
        .from('kkup_teams')
        .insert({
          tournament_id: kkupId, team_name: body.name,
          team_tag: body.tag || body.name.substring(0, 4).toUpperCase(),
          logo_url: body.logo_url || null, valve_team_id: body.valve_team_id || null,
          wins: 0, losses: 0,
        }).select().single();
      if (insertError) return c.json({ error: 'Failed to create team: ' + insertError.message }, 500);

      try { await createAdminLog({ type: 'kkup_team_created', action: `Created team "${team.team_name}" [${team.team_tag}]`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({ success: true, team });
    } catch (error: any) {
      console.error('Create team error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Update team (Owner only)
  app.put(`${PREFIX}/tournament/:kkup_id/team/:team_id`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const teamId = c.req.param('team_id');
      const body = await c.req.json();
      const updateData: any = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.tag !== undefined) updateData.tag = body.tag;
      if (body.logo_url !== undefined) updateData.logo_url = body.logo_url;
      if (body.valve_team_id !== undefined) updateData.valve_team_id = body.valve_team_id;

      const { data: team, error: updateError } = await supabase
        .from('kkup_teams').update(updateData).eq('id', teamId).select().single();
      if (updateError) return c.json({ error: 'Failed to update team: ' + updateError.message }, 500);

      try { await createAdminLog({ type: 'kkup_team_updated', action: `Updated team "${team.team_name || team.name || teamId}"`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({ success: true, team });
    } catch (error: any) {
      console.error('Update team error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Delete team (Owner only)
  app.delete(`${PREFIX}/tournament/:kkup_id/team/:team_id`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const teamId = c.req.param('team_id');

      // Look up team name before deleting
      const { data: teamInfo } = await supabase.from('kkup_teams').select('team_name').eq('id', teamId).maybeSingle();
      const teamName = teamInfo?.team_name || teamId;

      const { error: deleteError } = await supabase.from('kkup_teams').delete().eq('id', teamId);
      if (deleteError) return c.json({ error: 'Failed to delete team: ' + deleteError.message }, 500);

      try { await createAdminLog({ type: 'kkup_team_deleted', action: `Deleted team "${teamName}"`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({ success: true, message: 'Team deleted successfully' });
    } catch (error: any) {
      console.error('Delete team error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ════════════════════════════
  // MATCH CRUD
  // ════════════════════════════

  // Update match (Owner only)
  app.put(`${PREFIX}/tournament/:kkup_id/match/:match_id`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const matchId = c.req.param('match_id');
      const kkupId = c.req.param('kkup_id');
      const body = await c.req.json();
      const updateData: any = {};
      if (body.team1_id !== undefined) updateData.team1_id = body.team1_id;
      if (body.team2_id !== undefined) updateData.team2_id = body.team2_id;
      if (body.team1_score !== undefined) updateData.team1_score = body.team1_score;
      if (body.team2_score !== undefined) updateData.team2_score = body.team2_score;
      if (body.winner_team_id !== undefined) updateData.winner_team_id = body.winner_team_id;
      if (body.stage !== undefined) updateData.stage = body.stage;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.scheduled_time !== undefined) updateData.scheduled_time = body.scheduled_time;
      if (body.twitch_vod_url !== undefined) updateData.twitch_vod_url = body.twitch_vod_url;
      if (body.youtube_vod_url !== undefined) updateData.youtube_vod_url = body.youtube_vod_url;

      const { data: match, error: updateError } = await supabase
        .from('kkup_matches').update(updateData).eq('id', matchId).select().single();
      if (updateError) return c.json({ error: 'Failed to update match: ' + updateError.message }, 500);

      try {
        const { data: t } = await supabase.from('kkup_tournaments').select('name').eq('id', kkupId).maybeSingle();
        await createAdminLog({ type: 'kkup_match_updated', action: `Updated match in ${t?.name || kkupId}`, actor_name: 'Owner', details: { match_id: matchId, fields: Object.keys(updateData) } });
      } catch (_) {}

      return c.json({ success: true, match });
    } catch (error: any) {
      console.error('Update match error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Create match (Owner only)
  app.post(`${PREFIX}/tournament/:kkup_id/match`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const kkupId = c.req.param('kkup_id');
      const body = await c.req.json();

      const { data: match, error: insertError } = await supabase
        .from('kkup_matches')
        .insert({
          tournament_id: kkupId, team1_id: body.team1_id, team2_id: body.team2_id,
          team1_score: body.team1_score || 0, team2_score: body.team2_score || 0,
          stage: body.stage || 'group_stage', status: body.status || 'scheduled',
          scheduled_time: body.scheduled_time || new Date().toISOString(),
          match_id: body.match_id || null, dotabuff_url: body.dotabuff_url || null,
        }).select().single();
      if (insertError) return c.json({ error: 'Failed to create match: ' + insertError.message }, 500);

      try {
        const { data: t } = await supabase.from('kkup_tournaments').select('name').eq('id', kkupId).maybeSingle();
        await createAdminLog({ type: 'kkup_match_created', action: `Created match in ${t?.name || kkupId} (${body.stage || 'group_stage'})`, actor_name: 'Owner' });
      } catch (_) {}

      return c.json({ success: true, match });
    } catch (error: any) {
      console.error('Create match error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Delete match (Owner only)
  app.delete(`${PREFIX}/tournament/:kkup_id/match/:match_id`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const matchId = c.req.param('match_id');
      const kkupId = c.req.param('kkup_id');
      const { error: deleteError } = await supabase.from('kkup_matches').delete().eq('id', matchId);
      if (deleteError) return c.json({ error: 'Failed to delete match: ' + deleteError.message }, 500);

      try {
        const { data: t } = await supabase.from('kkup_tournaments').select('name').eq('id', kkupId).maybeSingle();
        await createAdminLog({ type: 'kkup_match_deleted', action: `Deleted match from ${t?.name || kkupId}`, actor_name: 'Owner' });
      } catch (_) {}

      return c.json({ success: true, message: 'Match deleted successfully' });
    } catch (error: any) {
      console.error('Delete match error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ════════════════════════════
  // FILE UPLOAD
  // ════════════════════════════

  app.post(`${PREFIX}/upload`, async (c) => {
    try {
      // Allow any authenticated user (players upload team logos, owners upload banners/assets)
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      if (!file) return c.json({ error: 'No file provided' }, 400);

      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) return c.json({ error: 'Invalid file type.' }, 400);
      if (file.size > 5 * 1024 * 1024) return c.json({ error: 'File too large. Maximum size is 5MB.' }, 400);

      // Optional: specify a subfolder and/or custom filename
      const folder = (formData.get('folder') as string) || '';
      const customName = formData.get('filename') as string;

      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const extension = file.name.split('.').pop() || 'png';
      // If custom name provided, ensure it uses the actual file extension
      // e.g. customName="cdgs" + file is .jpg → "cdgs.jpg"
      const generatedName = customName
        ? (customName.includes('.') ? customName : `${customName}.${extension}`)
        : `${timestamp}-${randomStr}.${extension}`;
      const storagePath = folder ? `${folder}/${generatedName}` : generatedName;

      const arrayBuffer = await file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('make-4789f4af-kkup-assets')
        .upload(storagePath, fileData, { contentType: file.type, cacheControl: '3600', upsert: true });
      if (uploadError) return c.json({ error: 'Failed to upload file: ' + uploadError.message }, 500);

      const { data: urlData } = supabase.storage.from('make-4789f4af-kkup-assets').getPublicUrl(storagePath);
      return c.json({ success: true, url: urlData.publicUrl, filename: storagePath });
    } catch (error: any) {
      console.error('File upload error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ════════════════════════════
  // PLAYER PROFILE MANAGEMENT
  // ════════════════��═══════════

  // Get all player profiles for a tournament (public)
  app.get(`${PREFIX}/tournament/:kkup_id/players`, async (c) => {
    try {
      const { data: players, error } = await supabase
        .from('kkup_persons')
        .select(`*, team_assignments:kkup_team_rosters(team_id, team:kkup_teams(id, team_name, team_tag, logo_url))`)
        .order('display_name', { ascending: true });
      if (error) return c.json({ error: 'Failed to fetch players' }, 500);
      return c.json({ players: players || [] });
    } catch (error: any) {
      console.error('Get players error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Create player profile (Owner only)
  app.post(`${PREFIX}/tournament/:kkup_id/player`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const body = await c.req.json();
      const { data: player, error: insertError } = await supabase
        .from('kkup_persons')
        .insert({
          display_name: body.player_name,
          steam_id: body.steam_id || (body.opendota_id ? String(body.opendota_id) : null),
          dotabuff_url: body.dotabuff_url || null,
          opendota_url: body.opendota_id ? `https://www.opendota.com/players/${body.opendota_id}` : null,
        }).select().single();
      if (insertError) return c.json({ error: 'Failed to create player: ' + insertError.message }, 500);

      try { await createAdminLog({ type: 'kkup_player_created', action: `Created player "${player.display_name}"`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({ success: true, player });
    } catch (error: any) {
      console.error('Create player error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Add player to team (Owner only)
  app.post(`${PREFIX}/tournament/:kkup_id/team/:team_id/player`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const teamId = c.req.param('team_id');
      const body = await c.req.json();

      const { data: existing } = await supabase
        .from('kkup_team_rosters').select('*').eq('team_id', teamId)
        .eq('person_id', body.player_profile_id).maybeSingle();
      if (existing) return c.json({ error: 'Player is already on this team' }, 400);

      const { data: assignment, error: insertError } = await supabase
        .from('kkup_team_rosters')
        .insert({ team_id: teamId, person_id: body.player_profile_id })
        .select().single();
      if (insertError) return c.json({ error: 'Failed to add player to team: ' + insertError.message }, 500);

      try {
        const [{ data: player }, { data: team }] = await Promise.all([
          supabase.from('kkup_persons').select('display_name').eq('id', body.player_profile_id).maybeSingle(),
          supabase.from('kkup_teams').select('team_name').eq('id', teamId).maybeSingle(),
        ]);
        await createAdminLog({ type: 'kkup_roster_added', action: `Added ${player?.display_name || 'player'} to ${team?.team_name || 'team'}`, actor_name: 'Owner' });
      } catch (_) {}

      return c.json({ success: true, assignment });
    } catch (error: any) {
      console.error('Add player to team error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Remove player from team (Owner only)
  app.delete(`${PREFIX}/tournament/:kkup_id/team/:team_id/player/:player_id`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const teamId = c.req.param('team_id');
      const playerId = c.req.param('player_id');

      // Look up names before deleting
      const [{ data: player }, { data: team }] = await Promise.all([
        supabase.from('kkup_persons').select('display_name').eq('id', playerId).maybeSingle(),
        supabase.from('kkup_teams').select('team_name').eq('id', teamId).maybeSingle(),
      ]);

      const { error: deleteError } = await supabase
        .from('kkup_team_rosters').delete().eq('team_id', teamId).eq('person_id', playerId);
      if (deleteError) return c.json({ error: 'Failed to remove player from team: ' + deleteError.message }, 500);

      try { await createAdminLog({ type: 'kkup_roster_removed', action: `Removed ${player?.display_name || 'player'} from ${team?.team_name || 'team'}`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({ success: true, message: 'Player removed from team' });
    } catch (error: any) {
      console.error('Remove player from team error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Get team roster with top 3 heroes (public)
  app.get(`${PREFIX}/tournament/:kkup_id/team/:team_id/roster`, async (c) => {
    try {
      const teamId = c.req.param('team_id');

      const { data: roster, error } = await supabase
        .from('kkup_team_rosters').select(`*, player:kkup_persons(*)`).eq('team_id', teamId);
      if (error) return c.json({ error: 'Failed to fetch roster' }, 500);

      const rosterWithHeroes = await Promise.all((roster || []).map(async (entry: any) => {
        const playerId = entry.player.id;
        const { data: playerStats } = await supabase
          .from('kkup_player_match_stats').select('hero_id, hero, is_winner')
          .eq('person_id', playerId).eq('team_id', teamId);

        const heroCount = new Map<number, { name: string; count: number; wins: number }>();
        (playerStats || []).forEach((stat: any) => {
          if (!heroCount.has(stat.hero_id)) heroCount.set(stat.hero_id, { name: stat.hero, count: 0, wins: 0 });
          const hero = heroCount.get(stat.hero_id)!;
          hero.count++;
          if (stat.is_winner) hero.wins++;
        });

        const topHeroes = Array.from(heroCount.values())
          .sort((a, b) => b.count - a.count).slice(0, 3)
          .map(h => ({ name: h.name, count: h.count, wins: h.wins, winRate: h.count > 0 ? ((h.wins / h.count) * 100).toFixed(0) : "0" }));

        return { ...entry, topHeroes };
      }));

      return c.json({ roster: rosterWithHeroes });
    } catch (error: any) {
      console.error('Get roster error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

}