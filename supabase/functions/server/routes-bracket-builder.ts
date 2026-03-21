/**
 * Bracket Builder Routes
 * Officer-only routes for building tournament bracket structure
 * (phases, match groups, match assignments) using kkup_matches columns.
 *
 * The bracket "structure" is stored two places:
 *   1. kkup_tournaments.bracket_config JSONB — phase + group metadata (name, type, team counts, etc.)
 *   2. kkup_matches columns — phase, match_group, match_group_type, matchup_type,
 *      is_final_node_group, phase_order, match_group_order, game_number
 *
 * Routes:
 *   GET  /kkup/tournaments/:id/bracket-builder          — full structure + matches
 *   PUT  /kkup/tournaments/:id/bracket-builder/config   — save bracket_config (phases + groups)
 *   PUT  /kkup/tournaments/:id/bracket-builder/assign   — assign match IDs to a group
 *   PUT  /kkup/tournaments/:id/bracket-builder/unassign — remove match IDs from their group
 */

import { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";
import { isOfficer } from "./roles.ts";

async function requireOfficer(c: any, supabase: any, anonSupabase: any) {
  const token = c.req.header('Authorization')?.split(' ')[1];
  if (!token) return { ok: false, response: c.json({ error: 'No access token' }, 401) };
  const { data: { user: authUser }, error } = await anonSupabase.auth.getUser(token);
  if (error || !authUser) return { ok: false, response: c.json({ error: 'Unauthorized' }, 401) };
  const { data: dbUser } = await supabase.from('users').select('*').eq('supabase_id', authUser.id).single();
  if (!dbUser || !isOfficer(dbUser)) return { ok: false, response: c.json({ error: 'Officer access required' }, 403) };
  return { ok: true, dbUser };
}

export function registerBracketBuilderRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ═══════════════════════════════════════════════════════
  // GET — Full bracket structure + all matches
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/kkup/tournaments/:id/bracket-builder`, async (c) => {
    try {
      const tournamentId = c.req.param('id');

      const { data: tournament, error: tErr } = await supabase
        .from('kkup_tournaments')
        .select('id, name, bracket_config')
        .eq('id', tournamentId)
        .single();

      if (tErr || !tournament) {
        return c.json({ error: `Tournament not found: ${tErr?.message}` }, 404);
      }

      const { data: matches, error: mErr } = await supabase
        .from('kkup_matches')
        .select(`
          id, external_match_id, series_id, match_status,
          team1_id, team2_id, winner_team_id,
          team1_score, team2_score,
          phase, match_group, match_group_type, matchup_type,
          is_final_node_group, phase_order, match_group_order, game_number,
          scheduled_time,
          team1:kkup_teams!team1_id(id, team_name, team_tag),
          team2:kkup_teams!team2_id(id, team_name, team_tag)
        `)
        .eq('tournament_id', tournamentId)
        .order('phase_order', { ascending: true, nullsFirst: false })
        .order('match_group_order', { ascending: true, nullsFirst: false })
        .order('game_number', { ascending: true });

      if (mErr) {
        return c.json({ error: `Failed to fetch matches: ${mErr.message}` }, 500);
      }

      const bracketConfig = tournament.bracket_config || { phases: [] };
      const allMatches = matches || [];

      // Organize matches by phase → match_group
      const assigned: Record<string, Record<string, any[]>> = {};
      const unassigned: any[] = [];

      for (const match of allMatches) {
        if (match.phase && match.match_group) {
          if (!assigned[match.phase]) assigned[match.phase] = {};
          if (!assigned[match.phase][match.match_group]) assigned[match.phase][match.match_group] = [];
          assigned[match.phase][match.match_group].push(match);
        } else {
          unassigned.push(match);
        }
      }

      return c.json({ bracketConfig, assigned, unassigned, matches: allMatches });

    } catch (err: any) {
      console.error('Bracket builder GET error:', err);
      return c.json({ error: `Internal error: ${err.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // PUT /config — Save bracket_config (phase/group metadata)
  // ═══════════════════════════════════════════════════════

  app.put(`${PREFIX}/kkup/tournaments/:id/bracket-builder/config`, async (c) => {
    try {
      const auth = await requireOfficer(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');
      const body = await c.req.json();
      const { bracket_config } = body;

      if (!bracket_config) return c.json({ error: 'bracket_config is required' }, 400);

      const { error: updateErr } = await supabase
        .from('kkup_tournaments')
        .update({ bracket_config })
        .eq('id', tournamentId);

      if (updateErr) {
        return c.json({ error: `Failed to update bracket config: ${updateErr.message}` }, 500);
      }

      return c.json({ success: true });

    } catch (err: any) {
      console.error('Bracket builder config PUT error:', err);
      return c.json({ error: `Internal error: ${err.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // PUT /assign — Assign matches to a phase/group
  // ═══════════════════════════════════════════════════════

  app.put(`${PREFIX}/kkup/tournaments/:id/bracket-builder/assign`, async (c) => {
    try {
      const auth = await requireOfficer(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');
      const body = await c.req.json();
      const {
        match_ids,
        phase,
        match_group,
        match_group_type,
        matchup_type,
        is_final_node_group,
        phase_order,
        match_group_order,
      } = body;

      if (!match_ids?.length) return c.json({ error: 'match_ids array is required' }, 400);
      if (!phase || !match_group) return c.json({ error: 'phase and match_group are required' }, 400);

      // Update all matches, assigning game_number by their order in the array
      const errors: string[] = [];
      for (let i = 0; i < match_ids.length; i++) {
        const { error } = await supabase
          .from('kkup_matches')
          .update({
            phase,
            match_group,
            match_group_type: match_group_type || null,
            matchup_type: matchup_type || null,
            is_final_node_group: is_final_node_group || false,
            phase_order: phase_order ?? 1,
            match_group_order: match_group_order ?? 1,
            game_number: i + 1,
          })
          .eq('id', match_ids[i])
          .eq('tournament_id', tournamentId);

        if (error) {
          console.error(`Failed to assign match ${match_ids[i]}:`, error);
          errors.push(`Match ${match_ids[i]}: ${error.message}`);
        }
      }

      if (errors.length === match_ids.length) {
        return c.json({ error: `All assignments failed: ${errors.join('; ')}` }, 500);
      }

      return c.json({
        success: true,
        updated: match_ids.length - errors.length,
        errors: errors.length ? errors : undefined,
      });

    } catch (err: any) {
      console.error('Bracket builder assign error:', err);
      return c.json({ error: `Internal error: ${err.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // PUT /unassign — Remove matches from their group
  // ═══════════════════════════════════════════════════════

  app.put(`${PREFIX}/kkup/tournaments/:id/bracket-builder/unassign`, async (c) => {
    try {
      const auth = await requireOfficer(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');
      const { match_ids } = await c.req.json();

      if (!match_ids?.length) return c.json({ error: 'match_ids array is required' }, 400);

      const { error } = await supabase
        .from('kkup_matches')
        .update({
          phase: null,
          match_group: null,
          match_group_type: null,
          matchup_type: null,
          is_final_node_group: false,
          phase_order: null,
          match_group_order: null,
          game_number: 1,
        })
        .in('id', match_ids)
        .eq('tournament_id', tournamentId);

      if (error) {
        return c.json({ error: `Failed to unassign matches: ${error.message}` }, 500);
      }

      return c.json({ success: true });

    } catch (err: any) {
      console.error('Bracket builder unassign error:', err);
      return c.json({ error: `Internal error: ${err.message}` }, 500);
    }
  });
}
