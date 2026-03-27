/**
 * Master Teams Routes — Canonical team identity registry
 *
 * 8 routes:
 *   GET    /kkup/persons/by-steam/:steam_id — Resolve steam_id to kkup_persons (officer)
 *   GET    /master-teams                  — List all master teams (public)
 *   GET    /master-teams/mine             — My teams (by authenticated user's person_id)
 *   GET    /master-teams/:id              — Single team with tournament history
 *   POST   /master-teams                  — Create new master team (authenticated)
 *   PATCH  /master-teams/:id              — Edit team identity (captain or officer)
 *   POST   /master-teams/:id/transfer     — Transfer captaincy (captain or officer)
 *   DELETE /master-teams/:id              — Delete team (only if zero tournament appearances)
 *
 * Table: kkup_master_teams (canonical identity)
 * Linked: kkup_teams.master_team_id (per-tournament snapshots)
 */
import type { Hono } from "npm:hono";
import { PREFIX } from './helpers.ts';
import { createAdminLog, createUserActivity } from './routes-notifications.ts';
import { isOfficer } from './roles.ts';

export function registerMasterTeamsRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ═══════════════════════════════════════════════════════
  // AUTH HELPER
  // ═══════════════════════════════════════════════════════

  async function requireAuth(c: any): Promise<{ ok: true; authUser: any; dbUser: any } | { ok: false; response: any }> {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return { ok: false, response: c.json({ error: 'No access token provided' }, 401) };
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    if (authError || !authUser) return { ok: false, response: c.json({ error: 'Unauthorized — invalid or expired token' }, 401) };
    const { data: dbUser } = await supabase.from('users').select('*').eq('supabase_id', authUser.id).single();
    if (!dbUser) return { ok: false, response: c.json({ error: 'User not found in database' }, 404) };
    return { ok: true, authUser, dbUser };
  }

  /** Resolve a users row → kkup_persons row via steam_id */
  async function resolvePersonForUser(dbUser: any): Promise<{ person: any } | { error: string }> {
    if (dbUser.steam_id) {
      const { data: person } = await supabase
        .from('kkup_persons').select('*').eq('steam_id', dbUser.steam_id).maybeSingle();
      if (person) return { person };
    }
    return { error: 'No linked Steam identity found. Link your Steam account first.' };
  }

  // ═══════════════════════════════════════════════════════
  // GET /kkup/persons/by-steam/:steam_id — Resolve steam_id to kkup_persons record
  // Used by officer transfer captaincy flow
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/kkup/persons/by-steam/:steam_id`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      if (!isOfficer(auth.dbUser.role)) {
        return c.json({ error: 'Officers only' }, 403);
      }

      const steamId = c.req.param('steam_id');
      if (!steamId) return c.json({ error: 'steam_id is required' }, 400);

      const { data: person, error } = await supabase
        .from('kkup_persons')
        .select('id, display_name, steam_id, avatar_url')
        .eq('steam_id', steamId)
        .maybeSingle();

      if (error) return c.json({ error: `Lookup failed: ${error.message}` }, 500);
      if (!person) return c.json({ error: `No Kernel Kup person found with Steam ID ${steamId}` }, 404);

      return c.json({ person });
    } catch (err) {
      console.error('Error looking up person by steam_id:', err);
      return c.json({ error: `Unexpected error: ${err}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // GET /master-teams — List all (public, with tournament count)
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/master-teams`, async (c) => {
    try {
      const { data: masterTeams, error } = await supabase
        .from('kkup_master_teams')
        .select('*')
        .order('current_name', { ascending: true });

      if (error) return c.json({ error: `Failed to fetch master teams: ${error.message}` }, 500);

      // Count tournament appearances per master team
      const { data: teamLinks } = await supabase
        .from('kkup_teams')
        .select('master_team_id, tournament_id');

      const countsMap = new Map<string, number>();
      (teamLinks || []).forEach((t: any) => {
        if (t.master_team_id) {
          countsMap.set(t.master_team_id, (countsMap.get(t.master_team_id) || 0) + 1);
        }
      });

      const enriched = (masterTeams || []).map((mt: any) => ({
        ...mt,
        tournament_count: countsMap.get(mt.id) || 0,
      }));

      return c.json({ master_teams: enriched });
    } catch (err) {
      console.error('Error listing master teams:', err);
      return c.json({ error: `Unexpected error listing master teams: ${err}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // GET /master-teams/mine — My teams (authenticated)
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/master-teams/mine`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const personResult = await resolvePersonForUser(auth.dbUser);
      if ('error' in personResult) return c.json({ error: personResult.error }, 400);

      const personId = personResult.person.id;

      // Teams where user is captain
      const { data: myTeams, error } = await supabase
        .from('kkup_master_teams')
        .select('*')
        .eq('current_captain_person_id', personId)
        .order('current_name', { ascending: true });

      if (error) return c.json({ error: `Failed to fetch your teams: ${error.message}` }, 500);

      // Enrich with tournament counts
      const masterIds = (myTeams || []).map((t: any) => t.id);
      let countsMap = new Map<string, number>();

      if (masterIds.length > 0) {
        const { data: teamLinks } = await supabase
          .from('kkup_teams')
          .select('master_team_id, tournament_id')
          .in('master_team_id', masterIds);

        (teamLinks || []).forEach((t: any) => {
          if (t.master_team_id) {
            countsMap.set(t.master_team_id, (countsMap.get(t.master_team_id) || 0) + 1);
          }
        });
      }

      const enriched = (myTeams || []).map((mt: any) => ({
        ...mt,
        tournament_count: countsMap.get(mt.id) || 0,
      }));

      return c.json({ master_teams: enriched, person_id: personId });
    } catch (err) {
      console.error('Error fetching my teams:', err);
      return c.json({ error: `Unexpected error fetching your teams: ${err}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // GET /master-teams/:id — Single team with full history
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/master-teams/:id`, async (c) => {
    try {
      const id = c.req.param('id');
      if (!id) return c.json({ error: 'Master team ID is required' }, 400);

      // Don't match the /mine route
      if (id === 'mine') return;

      const { data: masterTeam, error } = await supabase
        .from('kkup_master_teams')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !masterTeam) return c.json({ error: `Master team not found: ${id}` }, 404);

      // Get all tournament appearances
      const { data: tournamentTeams } = await supabase
        .from('kkup_teams')
        .select('id, tournament_id, team_name, team_tag, logo_url, valve_team_id, approval_status, captain_person_id, coach_person_id, created_at')
        .eq('master_team_id', id)
        .order('created_at', { ascending: false });

      // Get tournament details for those appearances
      const tournamentIds = [...new Set((tournamentTeams || []).map((t: any) => t.tournament_id).filter(Boolean))];
      let tournaments: any[] = [];
      if (tournamentIds.length > 0) {
        const { data } = await supabase
          .from('kkup_tournaments')
          .select('id, name, status, tournament_type, winning_team_id, start_date, end_date')
          .in('id', tournamentIds);
        tournaments = data || [];
      }

      const tournamentMap = new Map(tournaments.map((t: any) => [t.id, t]));

      // Enrich tournament appearances
      const appearances = (tournamentTeams || []).map((tt: any) => {
        const tournament = tournamentMap.get(tt.tournament_id);
        return {
          ...tt,
          tournament_name: tournament?.name || 'Unknown',
          tournament_status: tournament?.status || 'unknown',
          tournament_type: tournament?.tournament_type || 'kernel_kup',
          is_champion: tournament?.winning_team_id === tt.id,
          start_date: tournament?.start_date,
          end_date: tournament?.end_date,
        };
      });

      // Get captain person info
      let captain = null;
      if (masterTeam.current_captain_person_id) {
        const { data: captainPerson } = await supabase
          .from('kkup_persons')
          .select('id, display_name, steam_id, avatar_url')
          .eq('id', masterTeam.current_captain_person_id)
          .single();
        captain = captainPerson;
      }

      return c.json({
        master_team: masterTeam,
        captain,
        appearances,
        tournament_count: appearances.length,
        championships: appearances.filter((a: any) => a.is_champion).length,
      });
    } catch (err) {
      console.error('Error fetching master team detail:', err);
      return c.json({ error: `Unexpected error fetching master team: ${err}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // POST /master-teams — Create new master team
  // ═══════════════════════════════════════════════════════

  app.post(`${PREFIX}/master-teams`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const personResult = await resolvePersonForUser(auth.dbUser);
      if ('error' in personResult) return c.json({ error: personResult.error }, 400);

      const body = await c.req.json();
      const { name, tag, description, logo_url, valve_team_id } = body;

      if (!name || !name.trim()) return c.json({ error: 'Team name is required' }, 400);
      if (!tag || !tag.trim()) return c.json({ error: 'Team tag is required' }, 400);

      const personId = personResult.person.id;

      // ── Team limit: Free = 1, TCF+ = 20 ──
      const isTcfPlus = !!auth.dbUser.tcf_plus_active;
      const TEAM_LIMIT = isTcfPlus ? 20 : 1;
      const { data: existingTeams, error: countErr } = await supabase
        .from('kkup_master_teams')
        .select('id')
        .eq('current_captain_person_id', personId);

      if (countErr) return c.json({ error: `Failed to check team count: ${countErr.message}` }, 500);

      if ((existingTeams || []).length >= TEAM_LIMIT) {
        return c.json({
          error: isTcfPlus
            ? `You've reached the TCF+ limit of ${TEAM_LIMIT} teams.`
            : `Free accounts can only create ${TEAM_LIMIT} team. Upgrade to TCF+ for up to 20 teams.`,
          code: 'TEAM_LIMIT_REACHED',
          limit: TEAM_LIMIT,
          is_tcf_plus: isTcfPlus,
        }, 403);
      }

      // Check for duplicate (case-insensitive) — the DB constraint will catch this too,
      // but we give a friendlier error message
      const { data: existing } = await supabase
        .from('kkup_master_teams')
        .select('id, current_name, current_tag')
        .ilike('current_name', name.trim())
        .ilike('current_tag', tag.trim())
        .maybeSingle();

      if (existing) {
        return c.json({
          error: `A team with name "${existing.current_name}" and tag "${existing.current_tag}" already exists.`,
        }, 409);
      }

      const { data: newTeam, error } = await supabase
        .from('kkup_master_teams')
        .insert({
          current_name: name.trim(),
          current_tag: tag.trim(),
          description: description?.trim() || null,
          current_logo_url: logo_url || null,
          valve_team_id: valve_team_id || null,
          current_captain_person_id: personId,
          created_by_person_id: personId,
          status: 'active',
          name_history: [],
          captain_history: [],
        })
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation
        if (error.code === '23505') {
          return c.json({ error: `A team with that name and tag already exists (case-insensitive).` }, 409);
        }
        return c.json({ error: `Failed to create master team: ${error.message}` }, 500);
      }

      // Log activity
      try {
        await createUserActivity({
          user_id: auth.dbUser.supabase_id,
          type: 'master_team_created',
          title: `Created team "${name.trim()}"`,
          description: `Registered new team identity: ${name.trim()} [${tag.trim()}]`,
          actor_name: auth.dbUser.discord_username || auth.dbUser.email,
        });
      } catch (actErr) {
        console.error('Non-critical: activity log for master team creation failed:', actErr);
      }

      return c.json({ master_team: newTeam }, 201);
    } catch (err) {
      console.error('Error creating master team:', err);
      return c.json({ error: `Unexpected error creating master team: ${err}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // PATCH /master-teams/:id — Edit team identity
  // Allowed: captain of the team, or officers/owner
  // ═══════════════════════════════════════════════════════

  app.patch(`${PREFIX}/master-teams/:id`, async (c) => {
    try {
      const id = c.req.param('id');
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      // Fetch current master team
      const { data: masterTeam, error: fetchErr } = await supabase
        .from('kkup_master_teams')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !masterTeam) return c.json({ error: `Master team not found: ${id}` }, 404);

      // Permission check: captain or officer
      const personResult = await resolvePersonForUser(auth.dbUser);
      const personId = 'error' in personResult ? null : personResult.person.id;
      const isCaptain = personId && masterTeam.current_captain_person_id === personId;
      const isOfficerUser = isOfficer(auth.dbUser.role);

      if (!isCaptain && !isOfficerUser) {
        return c.json({ error: 'Only the team captain or officers can edit team identity' }, 403);
      }

      const body = await c.req.json();
      const updates: Record<string, any> = {};
      const changes: string[] = [];

      // Name change — log to history
      if (body.name !== undefined && body.name.trim() && body.name.trim() !== masterTeam.current_name) {
        // Check duplicate
        const { data: dupe } = await supabase
          .from('kkup_master_teams')
          .select('id')
          .ilike('current_name', body.name.trim())
          .ilike('current_tag', body.tag?.trim() || masterTeam.current_tag)
          .neq('id', id)
          .maybeSingle();

        if (dupe) return c.json({ error: 'A team with that name and tag already exists.' }, 409);

        const nameHistory = [...(masterTeam.name_history || []), {
          from_name: masterTeam.current_name,
          from_tag: masterTeam.current_tag,
          to_name: body.name.trim(),
          to_tag: body.tag?.trim() || masterTeam.current_tag,
          changed_at: new Date().toISOString(),
          changed_by: auth.dbUser.discord_username || auth.dbUser.email,
        }];

        updates.current_name = body.name.trim();
        updates.name_history = nameHistory;
        changes.push(`name: "${masterTeam.current_name}" → "${body.name.trim()}"`);
      }

      // Tag change
      if (body.tag !== undefined && body.tag.trim() && body.tag.trim() !== masterTeam.current_tag) {
        if (!updates.name_history) {
          // Tag-only change, still log it
          const nameHistory = [...(masterTeam.name_history || []), {
            from_name: masterTeam.current_name,
            from_tag: masterTeam.current_tag,
            to_name: updates.current_name || masterTeam.current_name,
            to_tag: body.tag.trim(),
            changed_at: new Date().toISOString(),
            changed_by: auth.dbUser.discord_username || auth.dbUser.email,
          }];
          updates.name_history = nameHistory;
        }
        updates.current_tag = body.tag.trim();
        changes.push(`tag: "${masterTeam.current_tag}" → "${body.tag.trim()}"`);
      }

      // Logo
      if (body.logo_url !== undefined) {
        updates.current_logo_url = body.logo_url || null;
        if (body.logo_url !== masterTeam.current_logo_url) changes.push('logo updated');
      }

      // Description
      if (body.description !== undefined) {
        updates.description = body.description?.trim() || null;
        if (body.description?.trim() !== masterTeam.description) changes.push('description updated');
      }

      // Valve team ID
      if (body.valve_team_id !== undefined) {
        updates.valve_team_id = body.valve_team_id || null;
        changes.push('valve_team_id updated');
      }

      if (Object.keys(updates).length === 0) {
        return c.json({ message: 'No changes to apply' });
      }

      updates.updated_at = new Date().toISOString();

      const { data: updated, error: updateErr } = await supabase
        .from('kkup_master_teams')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateErr) return c.json({ error: `Failed to update master team: ${updateErr.message}` }, 500);

      // Log activity
      const changeStr = changes.join(', ');
      try {
        await createUserActivity({
          user_id: auth.dbUser.supabase_id,
          type: 'master_team_edited',
          title: `Edited team "${updated.current_name}"`,
          description: `Changes: ${changeStr}`,
          actor_name: auth.dbUser.discord_username || auth.dbUser.email,
        });
      } catch (actErr) {
        console.error('Non-critical: activity log for master team edit failed:', actErr);
      }

      // If officer edited someone else's team, also log to admin log
      if (isOfficerUser && !isCaptain) {
        try {
          await createAdminLog({
            type: 'master_team_edited',
            action: `Edited master team "${updated.current_name}" [${updated.current_tag}]: ${changeStr}`,
            actor_id: auth.dbUser.supabase_id,
            actor_name: auth.dbUser.discord_username || auth.dbUser.email,
          });
        } catch (logErr) {
          console.error('Non-critical: admin log for master team edit failed:', logErr);
        }
      }

      return c.json({ master_team: updated });
    } catch (err) {
      console.error('Error editing master team:', err);
      return c.json({ error: `Unexpected error editing master team: ${err}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // POST /master-teams/:id/transfer — Transfer captaincy
  // Allowed: current captain or officers/owner
  // ═══════════════════════════════════════════════════════

  app.post(`${PREFIX}/master-teams/:id/transfer`, async (c) => {
    try {
      const id = c.req.param('id');
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const { data: masterTeam, error: fetchErr } = await supabase
        .from('kkup_master_teams')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !masterTeam) return c.json({ error: `Master team not found: ${id}` }, 404);

      // Permission: captain or officer
      const personResult = await resolvePersonForUser(auth.dbUser);
      const personId = 'error' in personResult ? null : personResult.person.id;
      const isCaptain = personId && masterTeam.current_captain_person_id === personId;
      const isOfficerUser = isOfficer(auth.dbUser.role);

      if (!isCaptain && !isOfficerUser) {
        return c.json({ error: 'Only the team captain or officers can transfer captaincy' }, 403);
      }

      const body = await c.req.json();
      const { new_captain_person_id } = body;

      if (!new_captain_person_id) return c.json({ error: 'new_captain_person_id is required' }, 400);

      // Verify new captain exists
      const { data: newCaptain } = await supabase
        .from('kkup_persons')
        .select('id, display_name')
        .eq('id', new_captain_person_id)
        .single();

      if (!newCaptain) return c.json({ error: 'New captain person not found' }, 404);

      // Get old captain name for history
      let oldCaptainName = 'Unknown';
      if (masterTeam.current_captain_person_id) {
        const { data: oldCaptain } = await supabase
          .from('kkup_persons')
          .select('display_name')
          .eq('id', masterTeam.current_captain_person_id)
          .single();
        if (oldCaptain) oldCaptainName = oldCaptain.display_name;
      }

      // Update captain history
      const captainHistory = [...(masterTeam.captain_history || []), {
        from_person_id: masterTeam.current_captain_person_id,
        from_name: oldCaptainName,
        to_person_id: new_captain_person_id,
        to_name: newCaptain.display_name,
        transferred_at: new Date().toISOString(),
        transferred_by: auth.dbUser.discord_username || auth.dbUser.email,
      }];

      const { data: updated, error: updateErr } = await supabase
        .from('kkup_master_teams')
        .update({
          current_captain_person_id: new_captain_person_id,
          captain_history: captainHistory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) return c.json({ error: `Failed to transfer captaincy: ${updateErr.message}` }, 500);

      // Log: activity on actor
      try {
        await createUserActivity({
          user_id: auth.dbUser.supabase_id,
          type: 'master_team_captain_transferred',
          title: `Transferred captaincy of "${masterTeam.current_name}"`,
          description: `Captain transferred from ${oldCaptainName} to ${newCaptain.display_name}`,
          actor_name: auth.dbUser.discord_username || auth.dbUser.email,
        });
      } catch (actErr) {
        console.error('Non-critical: activity log for captain transfer failed:', actErr);
      }

      // Notify the new captain (find their supabase user)
      try {
        // Resolve person → user via steam_id
        const { data: newCaptainPerson } = await supabase
          .from('kkup_persons')
          .select('steam_id')
          .eq('id', new_captain_person_id)
          .single();

        if (newCaptainPerson?.steam_id) {
          const { data: newCaptainUser } = await supabase
            .from('users')
            .select('supabase_id')
            .eq('steam_id', newCaptainPerson.steam_id)
            .maybeSingle();

          if (newCaptainUser) {
            const { createNotification } = await import('./routes-notifications.ts');
            await createNotification({
              user_id: newCaptainUser.supabase_id,
              type: 'master_team_captain_received',
              title: `You are now captain of "${masterTeam.current_name}"`,
              body: `${auth.dbUser.discord_username || 'Someone'} transferred captaincy of ${masterTeam.current_name} [${masterTeam.current_tag}] to you.`,
              actor_name: auth.dbUser.discord_username || auth.dbUser.email,
            });
          }
        }
      } catch (notifErr) {
        console.error('Non-critical: notification for captain transfer failed:', notifErr);
      }

      // Admin log if officer did it
      if (isOfficerUser && !isCaptain) {
        try {
          await createAdminLog({
            type: 'master_team_captain_transferred',
            action: `Transferred captaincy of "${masterTeam.current_name}" from ${oldCaptainName} to ${newCaptain.display_name}`,
            actor_id: auth.dbUser.supabase_id,
            actor_name: auth.dbUser.discord_username || auth.dbUser.email,
          });
        } catch (logErr) {
          console.error('Non-critical: admin log for captain transfer failed:', logErr);
        }
      }

      return c.json({ master_team: updated, new_captain: newCaptain });
    } catch (err) {
      console.error('Error transferring captaincy:', err);
      return c.json({ error: `Unexpected error transferring captaincy: ${err}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // DELETE /master-teams/:id — Delete team
  // Only allowed if ZERO tournament appearances
  // Captain or officer can delete
  // ═══════════════════════════════════════════════════════

  app.delete(`${PREFIX}/master-teams/:id`, async (c) => {
    try {
      const id = c.req.param('id');
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const { data: masterTeam, error: fetchErr } = await supabase
        .from('kkup_master_teams')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !masterTeam) return c.json({ error: `Master team not found: ${id}` }, 404);

      // Permission: captain or officer
      const personResult = await resolvePersonForUser(auth.dbUser);
      const personId = 'error' in personResult ? null : personResult.person.id;
      const isCaptain = personId && masterTeam.current_captain_person_id === personId;
      const isOfficerUser = isOfficer(auth.dbUser.role);

      if (!isCaptain && !isOfficerUser) {
        return c.json({ error: 'Only the team captain or officers can delete a team' }, 403);
      }

      // Check for tournament appearances — block deletion if any exist
      const { data: appearances, error: appErr } = await supabase
        .from('kkup_teams')
        .select('id')
        .eq('master_team_id', id)
        .limit(1);

      if (appErr) return c.json({ error: `Failed to check tournament history: ${appErr.message}` }, 500);

      if (appearances && appearances.length > 0) {
        return c.json({
          error: `Cannot delete "${masterTeam.current_name}" — it has tournament history. Teams with history are preserved for the record books. You can edit the team identity instead.`,
        }, 409);
      }

      // Safe to delete — no tournament appearances
      const { error: deleteErr } = await supabase
        .from('kkup_master_teams')
        .delete()
        .eq('id', id);

      if (deleteErr) return c.json({ error: `Failed to delete master team: ${deleteErr.message}` }, 500);

      // Log activity
      try {
        await createUserActivity({
          user_id: auth.dbUser.supabase_id,
          type: 'master_team_deleted',
          title: `Deleted team "${masterTeam.current_name}"`,
          description: `Removed team identity: ${masterTeam.current_name} [${masterTeam.current_tag}]`,
          actor_name: auth.dbUser.discord_username || auth.dbUser.email,
        });
      } catch (actErr) {
        console.error('Non-critical: activity log for master team deletion failed:', actErr);
      }

      return c.json({ success: true, message: `Team "${masterTeam.current_name}" deleted.` });
    } catch (err) {
      console.error('Error deleting master team:', err);
      return c.json({ error: `Unexpected error deleting master team: ${err}` }, 500);
    }
  });
}