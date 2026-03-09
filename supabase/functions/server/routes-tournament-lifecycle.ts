/**
 * Tournament Lifecycle Routes — Phase 2+3: Live Tournament Creation & Registration
 *
 * 8 routes:
 *   POST   /kkup/tournaments/create           — Create a new tournament (owner only)
 *   PATCH  /kkup/tournaments/:id/config       — Update tournament config (owner only)
 *   PATCH  /kkup/tournaments/:id/status       — Change tournament status (owner only)
 *   DELETE /kkup/tournaments/:id              — Delete a tournament and all related data (owner only)
 *   POST   /kkup/tournaments/:id/register     — Register for tournament with chosen role
 *   PATCH  /kkup/tournaments/:id/register/role — Change role after registration
 *   DELETE /kkup/tournaments/:id/register     — Player withdraws registration
 *   GET    /kkup/tournaments/:id/registrations — List registrations (free agents + on-team)
 *
 * Tables used: kkup_tournaments, kkup_persons, kkup_registrations, users,
 *              kkup_teams, kkup_team_rosters, kkup_team_invites, kkup_coach_assignments,
 *              kkup_matches, kkup_player_match_stats
 *
 * Auth:
 *   - Owner-only routes use requireOwner() (same pattern as routes-tournament-crud.ts)
 *   - Registration routes use requireAuth() — any authenticated user
 */
import { PREFIX, requireAuth as sharedRequireAuth, requireOwner as sharedRequireOwner, resolvePersonForUser as sharedResolvePersonForUser, clearCoachAssignment, disbandCaptainTeam } from "./helpers.ts";
import { createAdminLog, createNotification, createUserActivity } from "./routes-notifications.ts";
import { checkKernelKupEligibility, resolveUserRank, getRankBadgeUrl } from "./rank-utils.ts";
import { getMaxPlayerRank, getMinPlayerRank } from "./routes-config.ts";
import { DISCORD_WEBHOOKS } from "./discord-config.ts";
import { buildRegistrationEmbed, buildKkupAnnouncementEmbed, buildChampionsEmbed, buildPopdKernelEmbed, buildKkupActivityEmbed, sendWebhookEmbed } from "./discord-embeds.tsx";
import * as kv from "./kv_store.tsx";

// ── Valid status values and allowed transitions ──
const VALID_STATUSES = ['upcoming', 'registration_open', 'registration_closed', 'roster_lock', 'live', 'completed', 'archived'] as const;
type TournamentStatus = typeof VALID_STATUSES[number];

const STATUS_TRANSITIONS: Record<string, string[]> = {
  upcoming:              ['registration_open', 'archived'],                  // Can open registration or archive (cancel)
  registration_open:     ['registration_closed', 'upcoming', 'archived'],    // Can close registration / go back / cancel
  registration_closed:   ['roster_lock', 'registration_open', 'archived'],   // Can lock rosters / re-open registration / cancel
  roster_lock:           ['live', 'registration_closed', 'archived'],        // Can go live / unlock rosters / cancel
  live:                  ['completed', 'roster_lock', 'archived'],           // Can finish / go back to roster lock / cancel
  completed:             ['live', 'archived'],                               // Can revert to live (fix mistake) or archive
  archived:              ['upcoming'],                                        // Can re-open (un-archive) — server safety valve
};

/**
 * Safely clone an object to strip any non-serializable properties (e.g. Supabase client metadata).
 * Prevents "JSON.stringify cannot serialize cyclic structures" errors in Deno edge functions.
 */
function safeClone<T>(obj: T): T {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    // If stringify fails, manually extract own enumerable properties
    if (obj && typeof obj === 'object') {
      const clean: any = Array.isArray(obj) ? [] : {};
      for (const [key, value] of Object.entries(obj as any)) {
        try {
          clean[key] = typeof value === 'object' && value !== null ? JSON.parse(JSON.stringify(value)) : value;
        } catch {
          clean[key] = String(value);
        }
      }
      return clean as T;
    }
    return obj;
  }
}

export function registerTournamentLifecycleRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ═══════════════════════════════════════════════════════
  // AUTH & PERSON HELPERS — delegates to shared helpers.ts
  // ═══════════════════════════════════════════════════════

  const requireOwner = (c: any) => sharedRequireOwner(c, supabase, anonSupabase);
  const requireAuth = (c: any) => sharedRequireAuth(c, supabase, anonSupabase);
  const resolvePersonForUser = (dbUser: any) => sharedResolvePersonForUser(supabase, dbUser);


  // ══════════════════════════════════════════════════════
  // 0. LIST TOURNAMENTS (Public)
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/kkup/tournaments`, async (c) => {
    try {
      const statusFilter = c.req.query('status'); // optional: 'upcoming', 'registration_open', 'registration_closed', 'roster_lock', 'live', 'completed', 'archived'

      let query = supabase
        .from('kkup_tournaments')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data: tournaments, error } = await query;
      if (error) {
        console.error('List kkup_tournaments error:', error);
        return c.json({ error: `Failed to fetch tournaments: ${error.message}` }, 500);
      }

      // ── Enrich each tournament with registration counts + player preview avatars ──
      const enrichedTournaments = await Promise.all(
        (tournaments || []).map(async (t: any) => {
          try {
            // Get active registrations (non-withdrawn)
            const { data: regs, error: regError } = await supabase
              .from('kkup_registrations')
              .select('id, user_id, status, registered_at, person:kkup_persons!person_id(display_name, avatar_url)')
              .eq('tournament_id', t.id)
              .neq('status', 'withdrawn')
              .order('registered_at', { ascending: false })
              .limit(50);

            if (regError) {
              console.error(`Reg enrichment error for ${t.id}:`, regError);
              return { ...t, registration_count: 0, player_previews: [], teams_count: 0 };
            }

            // Get active staff applications (non-withdrawn)
            const { data: staffApps, error: staffError } = await supabase
              .from('kkup_staff_applications')
              .select('id, user_id, status, created_at, person:kkup_persons!person_id(display_name, avatar_url)')
              .eq('tournament_id', t.id)
              .neq('status', 'withdrawn')
              .order('created_at', { ascending: false })
              .limit(20);

            if (staffError) {
              console.error(`Staff enrichment error for ${t.id}:`, staffError);
            }

            const allRegs = regs || [];
            const allStaff = staffApps || [];
            const totalRegistrants = allRegs.length + allStaff.length;
            const onTeamCount = allRegs.filter((r: any) => r.status === 'on_team').length;

            // Count unique teams
            let teamsCount = 0;
            if (onTeamCount > 0) {
              const { count } = await supabase
                .from('kkup_teams')
                .select('id', { count: 'exact', head: true })
                .eq('tournament_id', t.id);
              teamsCount = count || 0;
            }

            // Collect user IDs from both registrations and staff apps for Discord avatars
            const regUserIds = allRegs.map((r: any) => r.user_id).filter(Boolean);
            const staffUserIds = allStaff.map((s: any) => s.user_id).filter(Boolean);
            const allUserIds = [...new Set([...regUserIds, ...staffUserIds])];
            const userAvatarMap = new Map<string, { discord_avatar: string | null; discord_username: string; tcf_plus_active: boolean }>();
            if (allUserIds.length > 0) {
              const { data: users } = await supabase
                .from('users')
                .select('id, discord_avatar, discord_username, tcf_plus_active')
                .in('id', allUserIds.slice(0, 40)); // Limit DB query
              (users || []).forEach((u: any) => userAvatarMap.set(u.id, u));
            }

            // Merge registrations + staff apps, sort by most recent, deduplicate
            const mergedEntries = [
              ...allRegs.map((r: any) => ({
                user_id: r.user_id,
                person: r.person,
                timestamp: r.registered_at,
              })),
              ...allStaff.map((s: any) => ({
                user_id: s.user_id,
                person: s.person,
                timestamp: s.created_at,
              })),
            ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            // Deduplicate by user_id (a staff member might also be a player registrant)
            const seen = new Set<string>();
            const deduped = mergedEntries.filter((entry) => {
              if (!entry.user_id || seen.has(entry.user_id)) return false;
              seen.add(entry.user_id);
              return true;
            });

            // Build preview list (15 most recent) — prefer Discord avatar, fall back to kkup_persons
            const playerPreviews = deduped.slice(0, 15).map((entry) => {
              const linkedUser = userAvatarMap.get(entry.user_id);
              return {
                avatar: linkedUser?.discord_avatar || entry.person?.avatar_url || null,
                name: linkedUser?.discord_username || entry.person?.display_name || 'Player',
                tcf_plus_active: linkedUser?.tcf_plus_active || false,
              };
            });

            return {
              ...t,
              registration_count: deduped.length,
              teams_count: teamsCount,
              player_previews: playerPreviews,
            };
          } catch (enrichErr: any) {
            console.error(`Enrichment error for tournament ${t.id}:`, enrichErr);
            return { ...t, registration_count: 0, player_previews: [], teams_count: 0 };
          }
        })
      );

      return c.json({ tournaments: enrichedTournaments });
    } catch (error: any) {
      console.error('List kkup_tournaments error:', error);
      return c.json({ error: 'Internal server error listing tournaments: ' + error.message }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // NEXT UPCOMING TOURNAMENT (public — used by donation flow)
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/kkup/tournaments/next-upcoming`, async (c) => {
    try {
      // Find the nearest future tournament that isn't completed/archived.
      // Order by tournament_start_date ascending and take the first one.
      const { data: tournaments, error } = await supabase
        .from('kkup_tournaments')
        .select('id, name, tournament_start_date, status, prize_pool, prize_pool_donations, kkup_season, tournament_type')
        .not('status', 'in', '("completed","archived")')
        .order('tournament_start_date', { ascending: true })
        .limit(1);

      if (error) {
        console.error('Next upcoming tournament query error:', error);
        return c.json({ error: `Failed to fetch next tournament: ${error.message}` }, 500);
      }

      if (!tournaments || tournaments.length === 0) {
        return c.json({ tournament: null });
      }

      const t = tournaments[0];
      return c.json({
        tournament: {
          id: t.id,
          name: t.name,
          start_date: t.tournament_start_date,
          status: t.status,
          prize_pool: t.prize_pool ? Number(t.prize_pool) : 0,
          prize_pool_donations: t.prize_pool_donations ?? 0,
          kkup_season: t.kkup_season,
          tournament_type: t.tournament_type,
        },
      });
    } catch (error: any) {
      console.error('Next upcoming tournament error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 1. CREATE TOURNAMENT (Owner only)
  // ══════════════════════════════════════════════════════

  app.post(`${PREFIX}/kkup/tournaments/create`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const body = await c.req.json();

      // Validate required fields
      if (!body.name?.trim()) {
        return c.json({ error: 'Tournament name is required' }, 400);
      }
      if (!body.tournament_type || !['kernel_kup', 'heaps_n_hooks'].includes(body.tournament_type)) {
        return c.json({ error: 'tournament_type must be "kernel_kup" or "heaps_n_hooks"' }, 400);
      }

      const insertData: any = {
        name: body.name.trim(),
        tournament_type: body.tournament_type,
        status: 'upcoming',
        description: body.description?.trim() || null,

        // Dota 2 League integration
        league_id: body.league_id ?? null,

        // Season
        kkup_season: body.kkup_season ?? null,

        // Dates (all optional at creation — can be set later via config update)
        registration_start_date: body.registration_start_date || null,
        registration_end_date: body.registration_end_date || null,
        tournament_start_date: body.tournament_start_date || null,
        tournament_end_date: body.tournament_end_date || null,

        // Phase 2 config fields
        max_teams: body.max_teams ?? null,
        min_teams: body.min_teams ?? null,
        max_team_size: body.max_team_size ?? 7,
        min_team_size: body.min_team_size ?? 5,
        casters_needed: body.casters_needed ?? null,
        staff_needed: body.staff_needed ?? null,

        // Rank eligibility (per-tournament override — null = use global default)
        min_rank: body.min_rank ?? null,
        max_rank: body.max_rank ?? null,

        // Media / links
        prize_pool: body.prize_pool ?? null,
        youtube_url: body.youtube_url || null,
        twitch_url_1: body.twitch_url_1 || null,
        twitch_url_2: body.twitch_url_2 || null,
      };

      const { data: tournament, error: insertError } = await supabase
        .from('kkup_tournaments')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('Create tournament error:', insertError);
        return c.json({ error: `Failed to create tournament: ${insertError.message}` }, 500);
      }

      console.log(`Tournament created: "${tournament.name}" (${tournament.id}) by owner ${auth.dbUser.discord_username}`);

      // Log admin action (non-critical)
      try {
        await createAdminLog({
          type: 'tournament_created',
          action: `Created tournament "${tournament.name}" (${tournament.tournament_type})`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: { tournament_id: tournament.id, name: tournament.name, type: tournament.tournament_type },
        });
      } catch (_) { /* non-critical */ }

      // Discord webhook: new tournament announcement (non-critical)
      try {
        const { embed } = buildKkupAnnouncementEmbed({
          tournamentName: tournament.name, tournamentId: tournament.id,
          tournamentType: tournament.tournament_type, newStatus: 'upcoming',
          prizePool: tournament.prize_pool, startDate: tournament.tournament_start_date,
        });
        await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_ANNOUNCEMENT, embed);
      } catch (whErr) { console.error('Non-critical: tournament creation announcement webhook failed:', whErr); }

      return c.json({
        success: true,
        tournament,
        message: `Tournament "${tournament.name}" created successfully with status "upcoming".`,
      });
    } catch (error: any) {
      console.error('Create tournament error:', error);
      return c.json({ error: 'Internal server error during tournament creation: ' + error.message }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 2. UPDATE TOURNAMENT CONFIG (Owner only)
  // ═══════════════════════════════════════════════════════

  app.patch(`${PREFIX}/kkup/tournaments/:id/config`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');
      const body = await c.req.json();

      // Verify tournament exists
      const { data: existing, error: fetchError } = await supabase
        .from('kkup_tournaments')
        .select('id, name, status')
        .eq('id', tournamentId)
        .single();

      if (fetchError || !existing) {
        return c.json({ error: 'Tournament not found' }, 404);
      }

      // Build update object — only include fields that were actually sent
      const updateData: any = {};
      const allowedFields = [
        'name', 'description', 'tournament_type',
        'registration_start_date', 'registration_end_date',
        'tournament_start_date', 'tournament_end_date',
        'max_teams', 'min_teams', 'max_team_size', 'min_team_size',
        'casters_needed', 'staff_needed',
        'prize_pool', 'youtube_url', 'twitch_url_1', 'twitch_url_2',
        'league_id', 'kkup_season',
        'min_rank', 'max_rank',
        // Winner assignment fields (officer admin tools)
        'winning_team_id', 'popd_kernel_1_person_id', 'popd_kernel_2_person_id',
      ];

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      // Validate tournament_type if being changed
      if (updateData.tournament_type && !['kernel_kup', 'heaps_n_hooks'].includes(updateData.tournament_type)) {
        return c.json({ error: 'tournament_type must be "kernel_kup" or "heaps_n_hooks"' }, 400);
      }

      // Validate team size constraints
      if (updateData.min_team_size !== undefined && updateData.max_team_size !== undefined) {
        if (updateData.min_team_size > updateData.max_team_size) {
          return c.json({ error: 'min_team_size cannot be greater than max_team_size' }, 400);
        }
      }

      if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
      }

      const { data: updated, error: updateError } = await supabase
        .from('kkup_tournaments')
        .update(updateData)
        .eq('id', tournamentId)
        .select()
        .single();

      if (updateError) {
        console.error('Update tournament config error:', updateError);
        return c.json({ error: `Failed to update tournament: ${updateError.message}` }, 500);
      }

      console.log(`Tournament config updated: "${updated.name}" (${updated.id}) by owner ${auth.dbUser.discord_username}`);

      // Log admin action (non-critical)
      try {
        const changedFields = Object.keys(updateData).join(', ');
        await createAdminLog({
          type: 'tournament_config_updated',
          action: `Updated config for "${updated.name}" (fields: ${changedFields})`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: { tournament_id: tournamentId, changed_fields: Object.keys(updateData) },
        });
      } catch (_) { /* non-critical */ }

      // Discord webhook: champions announcement when winning_team_id is set (non-critical)
      if (updateData.winning_team_id) {
        try {
          const { data: winTeam } = await supabase
            .from('kkup_teams').select('id, team_name, team_tag').eq('id', updateData.winning_team_id).single();
          if (winTeam) {
            // Get roster member names
            const { data: roster } = await supabase
              .from('kkup_team_rosters').select('person_id, kkup_persons!person_id(display_name)')
              .eq('team_id', winTeam.id);
            const rosterNames = (roster || []).map((r: any) => r.kkup_persons?.display_name || 'Unknown').filter(Boolean);
            const { embed } = buildChampionsEmbed({
              tournamentName: updated.name, tournamentId, winningTeamName: winTeam.team_name,
              winningTeamTag: winTeam.team_tag, rosterNames,
            });
            await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_CHAMPIONS_ANNOUNCEMENT, embed);
          }
        } catch (whErr) { console.error('Non-critical: champions announcement webhook failed:', whErr); }
      }

      // Discord webhook: Pop'd Kernel announcement when popd_kernel fields are set (non-critical)
      if (updateData.popd_kernel_1_person_id || updateData.popd_kernel_2_person_id) {
        try {
          const personIds = [updateData.popd_kernel_1_person_id, updateData.popd_kernel_2_person_id].filter(Boolean);
          const { data: persons } = await supabase
            .from('kkup_persons').select('id, display_name, steam_id').in('id', personIds);
          // Try to resolve discord IDs via steam_id → users
          const steamIds = (persons || []).map((p: any) => p.steam_id).filter(Boolean);
          let userBySteam = new Map<string, any>();
          if (steamIds.length > 0) {
            const { data: users } = await supabase.from('users').select('discord_id, steam_id').in('steam_id', steamIds);
            (users || []).forEach((u: any) => { if (u.steam_id) userBySteam.set(u.steam_id, u); });
          }
          const winners = personIds.map((pid: string) => {
            const person = (persons || []).find((p: any) => p.id === pid);
            const user = person?.steam_id ? userBySteam.get(person.steam_id) : null;
            return { name: person?.display_name || 'Unknown', discordId: user?.discord_id || null };
          });
          if (winners.length > 0) {
            const { embed } = buildPopdKernelEmbed({ tournamentName: updated.name, tournamentId, winners });
            await sendWebhookEmbed(DISCORD_WEBHOOKS.POPD_KERNEL_ANNOUNCEMENT, embed);
          }
        } catch (whErr) { console.error('Non-critical: Pop\'d Kernel announcement webhook failed:', whErr); }
      }

      return c.json({ success: true, tournament: updated });
    } catch (error: any) {
      console.error('Update tournament config error:', error);
      return c.json({ error: 'Internal server error during tournament config update: ' + error.message }, 500);
    }
  });


  // ══════════════════════════════════════════════════════
  // 3. CHANGE TOURNAMENT STATUS (Owner only)
  // ═══════════════════════════════════════════════════════

  app.patch(`${PREFIX}/kkup/tournaments/:id/status`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');
      const { status: newStatus } = await c.req.json();

      if (!newStatus || !VALID_STATUSES.includes(newStatus as TournamentStatus)) {
        return c.json({
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        }, 400);
      }

      // Fetch current tournament
      const { data: tournament, error: fetchError } = await supabase
        .from('kkup_tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (fetchError || !tournament) {
        return c.json({ error: 'Tournament not found' }, 404);
      }

      // Validate status transition
      const currentStatus = tournament.status as string;
      const allowed = STATUS_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(newStatus)) {
        return c.json({
          error: `Invalid status transition: "${currentStatus}" → "${newStatus}". Allowed transitions from "${currentStatus}": ${(allowed || []).join(', ') || 'none'}`,
        }, 400);
      }

      // ── Pre-transition validations ──

      // Opening registration: warn if dates aren't set (but don't block — owner knows best)
      const warnings: string[] = [];

      if (newStatus === 'registration_open') {
        if (!tournament.registration_start_date && !tournament.registration_end_date) {
          warnings.push('Registration dates are not set. Players can register but there is no auto-close date.');
        }
      }

      // Going active: check team readiness
      if (newStatus === 'live') {
        const { data: teams } = await supabase
          .from('kkup_teams')
          .select('id, team_name, approval_status')
          .eq('tournament_id', tournamentId)
          .eq('approval_status', 'approved');

        const approvedTeamCount = teams?.length || 0;
        if (approvedTeamCount < 2) {
          warnings.push(`Only ${approvedTeamCount} approved team(s). You need at least 2 teams to run a tournament.`);
        }

        // Check roster sizes against min_team_size
        if (tournament.min_team_size && teams && teams.length > 0) {
          for (const team of teams) {
            const { count } = await supabase
              .from('kkup_team_rosters')
              .select('*', { count: 'exact', head: true })
              .eq('team_id', team.id);

            if ((count || 0) < tournament.min_team_size) {
              warnings.push(`Team "${team.team_name}" has ${count || 0} players (minimum: ${tournament.min_team_size}).`);
            }
          }
        }

        // Count registrations to populate player_count
        const { count: regCount } = await supabase
          .from('kkup_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', tournamentId)
          .neq('status', 'withdrawn');

        // Update denormalized counts when going live
        await supabase
          .from('kkup_tournaments')
          .update({
            team_count: approvedTeamCount,
            player_count: regCount || 0,
          })
          .eq('id', tournamentId);
      }

      // Perform the status update
      const { data: updated, error: updateError } = await supabase
        .from('kkup_tournaments')
        .update({ status: newStatus })
        .eq('id', tournamentId)
        .select()
        .single();

      if (updateError) {
        console.error('Update tournament status error:', updateError);
        return c.json({ error: `Failed to update status: ${updateError.message}` }, 500);
      }

      console.log(`Tournament status changed: "${updated.name}" ${currentStatus} → ${newStatus} by owner ${auth.dbUser.discord_username}`);

      // Log admin action (non-critical)
      try {
        await createAdminLog({
          type: 'tournament_status_changed',
          action: `Changed "${updated.name}" status: ${currentStatus} → ${newStatus}`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: { tournament_id: tournamentId, from: currentStatus, to: newStatus },
        });
      } catch (_) { /* non-critical */ }

      // Discord webhook: phase change announcement (non-critical)
      try {
        // Grab registration + team counts for the embed
        const { count: announcementRegCount } = await supabase
          .from('kkup_registrations').select('id', { count: 'exact', head: true })
          .eq('tournament_id', tournamentId).neq('status', 'withdrawn');
        const { count: announcementTeamCount } = await supabase
          .from('kkup_teams').select('id', { count: 'exact', head: true })
          .eq('tournament_id', tournamentId).eq('approval_status', 'approved');
        const { embed } = buildKkupAnnouncementEmbed({
          tournamentName: updated.name, tournamentId, tournamentType: updated.tournament_type,
          newStatus, previousStatus: currentStatus,
          registrationCount: announcementRegCount || 0, teamCount: announcementTeamCount || 0,
          prizePool: updated.prize_pool, startDate: updated.tournament_start_date,
        });
        await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_ANNOUNCEMENT, embed);
      } catch (whErr) { console.error('Non-critical: phase change announcement webhook failed:', whErr); }

      return c.json({
        success: true,
        tournament: updated,
        transition: { from: currentStatus, to: newStatus },
        warnings: warnings.length > 0 ? warnings : undefined,
        message: `Tournament "${updated.name}" status changed from "${currentStatus}" to "${newStatus}".`,
      });
    } catch (error: any) {
      console.error('Tournament status change error:', error);
      return c.json({ error: 'Internal server error during status change: ' + error.message }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 4. DELETE TOURNAMENT (Owner only)
  // ═══════════════════════════════════════════════════════

  app.delete(`${PREFIX}/kkup/tournaments/:id`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');

      // Verify tournament exists
      const { data: tournament, error: fetchError } = await supabase
        .from('kkup_tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (fetchError || !tournament) {
        return c.json({ error: 'Tournament not found' }, 404);
      }

      console.log(`Deleting tournament "${tournament.name}" (${tournamentId}) — cascading related data...`);

      // 1. Get all team IDs for this tournament (needed for roster/invite/coach cleanup)
      const { data: teams } = await supabase
        .from('kkup_teams')
        .select('id')
        .eq('tournament_id', tournamentId);
      const teamIds = (teams || []).map((t: any) => t.id);

      // 2. Clean up KV inbox notifications for pending invites (non-critical)
      if (teamIds.length > 0) {
        try {
          const { data: pendingInvites } = await supabase
            .from('kkup_team_invites')
            .select('id, person_id')
            .in('team_id', teamIds);

          if (pendingInvites && pendingInvites.length > 0) {
            const inviteIds = new Set(pendingInvites.map((i: any) => i.id));
            const personIds = [...new Set(pendingInvites.map((i: any) => i.person_id).filter(Boolean))];

            if (personIds.length > 0) {
              const { data: persons } = await supabase
                .from('kkup_persons').select('id, steam_id').in('id', personIds);

              if (persons && persons.length > 0) {
                const steamIds = persons.map((p: any) => p.steam_id).filter(Boolean);
                const { data: users } = await supabase
                  .from('users').select('id, steam_id').in('steam_id', steamIds);

                const steamToUserId = new Map((users || []).map((u: any) => [u.steam_id, u.id]));
                const personToUserId = new Map(
                  (persons || []).map((p: any) => [p.id, steamToUserId.get(p.steam_id)])
                );

                const uniqueUserIds = [...new Set([...personToUserId.values()].filter(Boolean))] as string[];
                const keysToDelete: string[] = [];

                for (const userId of uniqueUserIds) {
                  const allNotifs = await kv.getByPrefix(`notification:${userId}:`);
                  for (const notif of allNotifs) {
                    if (
                      (notif.type === 'team_invite' || notif.type === 'coach_invite') &&
                      notif.related_id &&
                      inviteIds.has(notif.related_id)
                    ) {
                      keysToDelete.push(notif.key);
                    }
                  }
                }

                if (keysToDelete.length > 0) {
                  await kv.mdel(keysToDelete);
                  console.log(`Tournament delete cleanup: deleted ${keysToDelete.length} invite notification(s) from KV`);
                }
              }
            }
          }
        } catch (notifErr) {
          console.error('Non-critical: invite notification cleanup during tournament delete failed:', notifErr);
        }
      }

      // 3. Delete coach assignments (linked via team_id)
      if (teamIds.length > 0) {
        const { error: coachErr } = await supabase
          .from('kkup_coach_assignments')
          .delete()
          .in('team_id', teamIds);
        if (coachErr) console.error('Delete coach assignments error (continuing):', coachErr.message);
      }

      // 4. Delete team invites (linked via team_id)
      if (teamIds.length > 0) {
        const { error: inviteErr } = await supabase
          .from('kkup_team_invites')
          .delete()
          .in('team_id', teamIds);
        if (inviteErr) console.error('Delete invites error (continuing):', inviteErr.message);
      }

      // 5. Delete team rosters (linked via team_id)
      if (teamIds.length > 0) {
        const { error: rosterErr } = await supabase
          .from('kkup_team_rosters')
          .delete()
          .in('team_id', teamIds);
        if (rosterErr) console.error('Delete rosters error (continuing):', rosterErr.message);
      }

      // 6. Delete matches and their player stats
      const { data: tournamentMatches } = await supabase
        .from('kkup_matches')
        .select('id')
        .eq('tournament_id', tournamentId);
      const matchIdsToDelete = (tournamentMatches || []).map((m: any) => m.id);

      if (matchIdsToDelete.length > 0) {
        const { error: statsErr } = await supabase
          .from('kkup_player_match_stats')
          .delete()
          .in('match_id', matchIdsToDelete);
        if (statsErr) console.error('Delete player stats error (continuing):', statsErr.message);
      }

      const { error: matchErr } = await supabase
        .from('kkup_matches')
        .delete()
        .eq('tournament_id', tournamentId);
      if (matchErr) console.error('Delete matches error (continuing):', matchErr.message);

      // 7. Delete registrations
      const { error: regErr } = await supabase
        .from('kkup_registrations')
        .delete()
        .eq('tournament_id', tournamentId);
      if (regErr) console.error('Delete registrations error (continuing):', regErr.message);

      // 8. Delete teams
      const { error: teamErr } = await supabase
        .from('kkup_teams')
        .delete()
        .eq('tournament_id', tournamentId);
      if (teamErr) console.error('Delete teams error (continuing):', teamErr.message);

      // 9. Finally delete the tournament itself
      const { error: tournamentErr } = await supabase
        .from('kkup_tournaments')
        .delete()
        .eq('id', tournamentId);

      if (tournamentErr) {
        console.error('Delete tournament error:', tournamentErr);
        return c.json({ error: `Failed to delete tournament: ${tournamentErr.message}` }, 500);
      }

      console.log(`Tournament deleted: "${tournament.name}" (${tournament.id}) by owner ${auth.dbUser.discord_username}`);

      // Log admin action (non-critical)
      try {
        await createAdminLog({
          type: 'tournament_deleted',
          action: `Deleted tournament "${tournament.name}" and all related data (${teamIds.length} teams, ${matchIdsToDelete.length} matches)`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: { tournament_id: tournamentId, name: tournament.name, teams_deleted: teamIds.length, matches_deleted: matchIdsToDelete.length },
        });
      } catch (_) { /* non-critical */ }

      return c.json({
        success: true,
        tournament,
        message: `Tournament "${tournament.name}" and all related data have been deleted.`,
      });
    } catch (error: any) {
      console.error('Delete tournament error:', error);
      return c.json({ error: 'Internal server error during tournament deletion: ' + error.message }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 5. REGISTER FOR TOURNAMENT (Any authenticated user)
  // ═══════════════════════════════════════════════════════

  app.post(`${PREFIX}/kkup/tournaments/:id/register`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');

      // Verify tournament exists and is accepting registrations
      const { data: tournament, error: fetchError } = await supabase
        .from('kkup_tournaments')
        .select('id, name, status, max_teams, max_team_size, tournament_type')
        .eq('id', tournamentId)
        .single();

      if (fetchError || !tournament) {
        return c.json({ error: 'Tournament not found' }, 404);
      }

      // ── TCF+ Early Access: allow registration during 'upcoming' for active TCF+ members ──
      if (tournament.status !== 'registration_open') {
        if (tournament.status === 'upcoming') {
          if (!auth.dbUser.tcf_plus_active) {
            return c.json({
              error: `Early registration for "${tournament.name}" is exclusive to TCF+ members. Public registration opens when the tournament moves to Registration Open.`,
              tcf_plus_required: true,
            }, 403);
          }
          // TCF+ member — fall through to normal registration logic below
        } else {
          return c.json({
            error: `Tournament "${tournament.name}" is not accepting registrations. Current status: "${tournament.status}".`,
          }, 400);
        }
      }

      // Parse body: optional role + optional self-reported rank
      let chosenRole: string = 'player';
      let selfReportedRank: string | null = null;
      try {
        const body = await c.req.json();
        selfReportedRank = body?.self_reported_rank || null;
        if (body?.role && ['player', 'coach', 'staff'].includes(body.role)) {
          chosenRole = body.role;
        }
      } catch { /* no body is fine — defaults to 'player' */ }

      // ── Rank eligibility check (Kernel Kup: configurable min/max rank for players only) ──
      // Only check rank for the player role — coaches have no rank limit
      // Per-tournament min_rank/max_rank override global defaults when set
      if (tournament.tournament_type === 'kernel_kup' && chosenRole === 'player') {
        const maxRank = tournament.max_rank ?? await getMaxPlayerRank();
        const minRank = tournament.min_rank ?? await getMinPlayerRank();
        const eligibility = checkKernelKupEligibility(auth.dbUser, selfReportedRank, maxRank, minRank);

        if (eligibility.rankUnknown) {
          return c.json({
            error: eligibility.reason,
            rank_unknown: true,
          }, 422);
        }

        if (!eligibility.eligible) {
          return c.json({
            error: eligibility.reason,
            rank_ineligible: true,
            rank_medal: eligibility.rankMedal,
            rank_stars: eligibility.rankStars,
            self_reported: eligibility.selfReported,
          }, 403);
        }

        // Store self-reported rank if used (for officer review)
        if (eligibility.selfReported && selfReportedRank) {
          console.log(`Warning: Player using self-reported rank: ${auth.dbUser.discord_username} claims ${selfReportedRank}`);
          const updatedOpendotaData = {
            ...(auth.dbUser.opendota_data || {}),
            badge_rank: {
              ...(auth.dbUser.opendota_data?.badge_rank || {}),
              medal: selfReportedRank,
              self_reported: true,
              self_reported_at: new Date().toISOString(),
            },
          };
          await supabase
            .from('users')
            .update({ opendota_data: updatedOpendotaData })
            .eq('id', auth.dbUser.id);
        }
      }

      // Resolve user → kkup_persons (create if needed)
      const personResult = await resolvePersonForUser(auth.dbUser);
      if ('error' in personResult) {
        return c.json({ error: personResult.error }, 500);
      }

      const { person, created: personCreated } = personResult;

      // Check if already registered
      const { data: existingReg } = await supabase
        .from('kkup_registrations')
        .select('id, status')
        .eq('tournament_id', tournamentId)
        .eq('person_id', person.id)
        .maybeSingle();

      if (existingReg) {
        if (existingReg.status === 'withdrawn') {
          // Re-register: update existing row back to free_agent with chosen role
          const { data: reReg, error: reRegError } = await supabase
            .from('kkup_registrations')
            .update({ status: 'free_agent', role: chosenRole, withdrawn_at: null, registered_at: new Date().toISOString() })
            .eq('id', existingReg.id)
            .select()
            .single();

          if (reRegError) {
            console.error('Re-registration error:', reRegError);
            return c.json({ error: `Failed to re-register: ${reRegError.message}` }, 500);
          }

          const roleLabel = { player: 'Player', coach: 'Coach', staff: 'Staff' }[chosenRole] || chosenRole;
          console.log(`Player re-registered: ${person.display_name} (${person.id}) as ${chosenRole} for tournament "${tournament.name}"`);

          // Log activity for re-registration
          try {
            await createUserActivity({
              user_id: auth.dbUser.id,
              type: 'tournament_registered',
              title: `Re-registered for ${tournament.name}`,
              description: `You re-registered for "${tournament.name}" as a ${roleLabel}.`,
              related_id: tournamentId,
              related_url: `#tournament-hub/${tournamentId}`,
            });
          } catch (actErr) { console.error('Non-critical: activity log for re-registration failed:', actErr); }

          // Discord webhook: registration notification (non-critical)
          try {
            const { count: regCount } = await supabase
              .from('kkup_registrations').select('id', { count: 'exact', head: true })
              .eq('tournament_id', tournamentId).neq('status', 'withdrawn');
            const rank = resolveUserRank(auth.dbUser);
            const dotaRank = rank ? `${rank.medal}${rank.stars ? ` [${rank.stars}]` : ''}` : null;
            const rankBadgeUrl = rank ? getRankBadgeUrl(rank.medal, rank.stars) : null;
            const { embed } = buildRegistrationEmbed({
              discordId: auth.dbUser.discord_id, discordUsername: auth.dbUser.discord_username || person.display_name,
              discordAvatar: auth.dbUser.discord_avatar, role: chosenRole,
              tournamentName: tournament.name, tournamentId, registrationNumber: regCount || 1,
              isEarlyAccess: false, isReRegistration: true, dotaRank, rankBadgeUrl,
            });
            await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
          } catch (whErr) { console.error('Non-critical: registration webhook failed:', whErr); }

          return c.json({
            success: true,
            registration: safeClone(reReg),
            person: safeClone(person),
            personCreated: false,
            message: `Welcome back! You've re-registered for "${tournament.name}" as a ${roleLabel}.`,
          });
        }

        // Already registered and active
        return c.json({
          error: `You are already registered for "${tournament.name}" (status: ${existingReg.status}).`,
        }, 409);
      }

      // Insert new registration with chosen role
      const { data: registration, error: regError } = await supabase
        .from('kkup_registrations')
        .insert({
          tournament_id: tournamentId,
          person_id: person.id,
          user_id: auth.dbUser.id,
          status: 'free_agent',
          role: chosenRole,
        })
        .select()
        .single();

      if (regError) {
        console.error('Registration insert error:', regError);
        return c.json({ error: `Failed to register: ${regError.message}` }, 500);
      }

      const freshRoleLabel = { player: 'Player', coach: 'Coach', staff: 'Staff' }[chosenRole] || chosenRole;
      const isEarlyAccess = tournament.status === 'upcoming';
      console.log(`Registered: ${person.display_name} (${person.id}) as ${chosenRole} for tournament "${tournament.name}" ${isEarlyAccess ? '(TCF+ early access)' : ''} ${personCreated ? '(new kkup_persons record created)' : ''}`);

      // Log activity for fresh registration
      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'tournament_registered',
          title: `Registered for ${tournament.name}${isEarlyAccess ? ' (Early Access)' : ''}`,
          description: isEarlyAccess
            ? `You used your TCF+ early access to register for "${tournament.name}" as a ${freshRoleLabel} before public registration!`
            : `You registered for "${tournament.name}" as a ${freshRoleLabel}.`,
          related_id: tournamentId,
          related_url: `#tournament-hub/${tournamentId}`,
        });
      } catch (actErr) { console.error('Non-critical: activity log for registration failed:', actErr); }

      // Discord webhook: registration notification (non-critical)
      try {
        const { count: regCount } = await supabase
          .from('kkup_registrations').select('id', { count: 'exact', head: true })
          .eq('tournament_id', tournamentId).neq('status', 'withdrawn');
        const rank = resolveUserRank(auth.dbUser);
        const dotaRank = rank ? `${rank.medal}${rank.stars ? ` [${rank.stars}]` : ''}` : null;
        const rankBadgeUrl = rank ? getRankBadgeUrl(rank.medal, rank.stars) : null;
        const { embed } = buildRegistrationEmbed({
          discordId: auth.dbUser.discord_id, discordUsername: auth.dbUser.discord_username || person.display_name,
          discordAvatar: auth.dbUser.discord_avatar, role: chosenRole,
          tournamentName: tournament.name, tournamentId, registrationNumber: regCount || 1,
          isEarlyAccess, isReRegistration: false, dotaRank, rankBadgeUrl,
        });
        await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
      } catch (whErr) { console.error('Non-critical: registration webhook failed:', whErr); }

      return c.json({
        success: true,
        registration: safeClone(registration),
        person: safeClone(person),
        personCreated,
        role: chosenRole,
        message: `You've registered for "${tournament.name}" as a ${freshRoleLabel}!`,
      });
    } catch (error: any) {
      console.error('Tournament registration error:', error);
      return c.json({ error: 'Internal server error during registration: ' + error.message }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 6. WITHDRAW REGISTRATION (The registrant themselves)
  // ═══════════════════════════════════════════════════════

  app.delete(`${PREFIX}/kkup/tournaments/:id/register`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');

      // Resolve the user's person identity
      const personResult = await resolvePersonForUser(auth.dbUser);
      if ('error' in personResult) {
        return c.json({ error: personResult.error }, 500);
      }
      const { person } = personResult;

      // Find their registration
      const { data: registration, error: fetchError } = await supabase
        .from('kkup_registrations')
        .select('id, status, role, tournament_id')
        .eq('tournament_id', tournamentId)
        .eq('person_id', person.id)
        .maybeSingle();

      if (fetchError || !registration) {
        return c.json({ error: 'No registration found for this tournament' }, 404);
      }

      if (registration.status === 'withdrawn') {
        return c.json({ error: 'Registration is already withdrawn' }, 400);
      }

      // If on_team, check tournament status — can't withdraw after rosters lock (active/completed)
      const { data: tournament } = await supabase
        .from('kkup_tournaments')
        .select('id, name, status')
        .eq('id', tournamentId)
        .single();

      if (tournament && ['roster_lock', 'live', 'completed'].includes(tournament.status)) {
        return c.json({
          error: `Cannot withdraw — tournament "${tournament.name}" is ${tournament.status}. Rosters are locked.`,
        }, 400);
      }

      // ── Team cleanup — ALWAYS check, regardless of registration status ──
      // A captain might still be 'free_agent' if team wasn't approved yet,
      // but we still need to disband the team and clean up rosters.
      {
        // Check if this person is captain (owner) of a team in this tournament
        const { data: captainedTeam } = await supabase
          .from('kkup_teams')
          .select('id, team_name, team_tag, logo_url, coach_person_id, approval_status')
          .eq('tournament_id', tournamentId)
          .eq('captain_person_id', person.id)
          .neq('approval_status', 'withdrawn')
          .maybeSingle();

        if (captainedTeam) {
          // ── CAPTAIN WITHDRAWAL — disband the entire team ──
          // Uses shared helper: resets teammates to free_agent, deletes rosters,
          // clears coach, expires invites, hard-deletes team, notifies everyone.
          const disbandResult = await disbandCaptainTeam(supabase, {
            team: captainedTeam,
            tournamentId,
            tournamentName: tournament?.name || 'the tournament',
            captainPerson: person,
            authDbUserId: auth.dbUser.id,
            createNotification,
            createUserActivity,
            createAdminLog,
          });

          // Discord webhook: team disbanded due to captain withdrawal (non-critical)
          try {
            const { embed } = buildKkupActivityEmbed({
              type: 'team_withdrawn',
              tournamentName: tournament?.name || 'Unknown Tournament',
              tournamentId,
              playerName: person.display_name,
              playerDiscordId: auth.dbUser.discord_id,
              playerAvatar: auth.dbUser.discord_avatar,
              teamName: captainedTeam.team_name,
              teamLogoUrl: captainedTeam.logo_url,
              actorName: person.display_name,
              extraDetail: `Captain withdrew — team disbanded. ${disbandResult.displacedPersonIds.length} player(s) returned to free agency.`,
            });
            await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
          } catch (whErr) { console.error('Non-critical: team disband webhook (captain withdrawal) failed:', whErr); }

        } else if (registration.status === 'on_team') {
          // ── NON-CAPTAIN PLAYER WITHDRAWAL — just leave the team ──
          // The team stays intact, this player is simply removed from the roster.
          const { data: tournamentTeams } = await supabase
            .from('kkup_teams')
            .select('id')
            .eq('tournament_id', tournamentId);

          const teamIds = (tournamentTeams || []).map((t: any) => t.id);

          if (teamIds.length > 0) {
            // Remove from rosters
            const { error: rosterError } = await supabase
              .from('kkup_team_rosters')
              .delete()
              .eq('person_id', person.id)
              .in('team_id', teamIds);

            if (rosterError) {
              console.error('Roster removal during withdrawal error:', rosterError);
              // Continue with withdrawal — roster cleanup is best-effort
            }

            // Decline any pending invites for this person in this tournament
            await supabase
              .from('kkup_team_invites')
              .update({ status: 'declined', updated_at: new Date().toISOString() })
              .eq('person_id', person.id)
              .eq('status', 'pending')
              .in('team_id', teamIds);
          }
        }
      }

      // ── Coach cleanup ──
      // If this person is coaching any team in this tournament (beyond their own disbanded team),
      // clear the coaching assignment. Already-withdrawn teams are filtered out.
      try {
        const { data: coachedTeams } = await supabase
          .from('kkup_teams')
          .select('id, team_name')
          .eq('tournament_id', tournamentId)
          .eq('coach_person_id', person.id)
          .neq('approval_status', 'withdrawn');

        for (const cTeam of (coachedTeams || [])) {
          await clearCoachAssignment(supabase, cTeam.id);
          console.log(`Removed coach ${person.display_name} from team "${cTeam.team_name}" (player withdrew)`);
        }
      } catch (coachErr) {
        console.error('Non-critical: coach removal during withdrawal failed:', coachErr);
      }

      // ── Staff application withdrawal ──
      // If this user has a staff/caster application for this tournament, withdraw it
      // Uses the real kkup_staff_applications table (migrated from KV)
      try {
        await supabase
          .from('kkup_staff_applications')
          .update({ status: 'withdrawn', reviewed_at: new Date().toISOString() })
          .eq('tournament_id', tournamentId)
          .eq('user_id', auth.dbUser.id)
          .neq('status', 'withdrawn');
        console.log(`Staff application auto-withdrawn for ${auth.dbUser.discord_username} (player withdrew from tournament)`);
      } catch (staffErr) {
        console.error('Non-critical: staff app withdrawal during tournament withdrawal failed:', staffErr);
      }

      // Update registration status
      const { data: updated, error: updateError } = await supabase
        .from('kkup_registrations')
        .update({
          status: 'withdrawn',
          withdrawn_at: new Date().toISOString(),
        })
        .eq('id', registration.id)
        .select()
        .single();

      if (updateError) {
        console.error('Withdrawal update error:', updateError);
        return c.json({ error: `Failed to withdraw: ${updateError.message}` }, 500);
      }

      console.log(`Player withdrew: ${person.display_name} (${person.id}) from tournament ${tournamentId}`);

      // Log activity for withdrawal
      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'tournament_unregistered',
          title: `Withdrew from ${tournament?.name || 'tournament'}`,
          description: `You withdrew your registration from "${tournament?.name || 'a tournament'}".`,
          related_id: tournamentId,
          related_url: `#tournament-hub/${tournamentId}`,
        });
      } catch (actErr) { console.error('Non-critical: activity log for withdrawal failed:', actErr); }

      // Discord webhook: player withdrawal
      try {
        const { embed } = buildKkupActivityEmbed({
          type: 'player_withdrawal',
          tournamentName: tournament?.name || 'Unknown Tournament',
          tournamentId,
          playerName: person.display_name,
          playerDiscordId: auth.dbUser.discord_id,
          playerAvatar: auth.dbUser.discord_avatar,
        });
        await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
      } catch (whErr) { console.error('Non-critical: withdrawal webhook failed:', whErr); }

      return c.json({
        success: true,
        registration: updated,
        message: `You've withdrawn from the tournament. You can re-register anytime while registration is open.`,
      });
    } catch (error: any) {
      console.error('Tournament withdrawal error:', error);
      return c.json({ error: 'Internal server error during withdrawal: ' + error.message }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 6b. CHOOSE YOUR PATH — Set registration role (Any authenticated user)
  // ═══════════════════════════════════════════════════════

  const VALID_ROLES = ['player', 'coach', 'staff'] as const;
  type RegistrationRole = typeof VALID_ROLES[number];

  app.patch(`${PREFIX}/kkup/tournaments/:id/register/role`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');
      const { role } = await c.req.json() as { role: RegistrationRole };

      if (!role || !VALID_ROLES.includes(role)) {
        return c.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, 400);
      }

      // Resolve person
      const personResult = await resolvePersonForUser(auth.dbUser);
      if ('error' in personResult) {
        return c.json({ error: personResult.error }, 500);
      }
      const { person } = personResult;

      // Find their registration
      const { data: registration, error: fetchError } = await supabase
        .from('kkup_registrations')
        .select('id, status, role, tournament_id')
        .eq('tournament_id', tournamentId)
        .eq('person_id', person.id)
        .maybeSingle();

      if (fetchError || !registration) {
        return c.json({ error: 'No registration found. Please register first.' }, 404);
      }

      if (registration.status === 'withdrawn') {
        return c.json({ error: 'Cannot set role — registration is withdrawn.' }, 400);
      }

      // Verify tournament is still accepting changes
      const { data: tournament } = await supabase
        .from('kkup_tournaments')
        .select('id, name, status, tournament_type')
        .eq('id', tournamentId)
        .single();

      if (!tournament) {
        return c.json({ error: 'Tournament not found' }, 404);
      }

      // Allow role changes during registration_open and registration_closed (pre-roster-lock)
      if (['roster_lock', 'live', 'completed', 'archived'].includes(tournament.status)) {
        return c.json({ error: `Cannot change role — tournament is ${tournament.status}.` }, 400);
      }

      // ── Role exclusivity checks ──

      // If switching TO a staff role (not TD), must not be on a team
      if (role === 'staff' && registration.status === 'on_team') {
        return c.json({
          error: 'You are currently on a team. Staff roles (except Tournament Director) are exclusive — you must leave your team first.',
          role_conflict: true,
        }, 400);
      }

      // If switching TO coach role, must not be on a team roster (coaches aren't rostered players)
      if (role === 'coach' && registration.status === 'on_team') {
        return c.json({
          error: 'You are currently on a team roster. Coaches cannot be rostered players — leave your team first.',
          role_conflict: true,
        }, 400);
      }

      const previousRole = registration.role;

      // ── Cleanup: switching AWAY from staff → withdraw any active staff applications ──
      if (previousRole === 'staff' && role !== 'staff') {
        try {
          await supabase
            .from('kkup_staff_applications')
            .update({ status: 'withdrawn', reviewed_at: new Date().toISOString() })
            .eq('tournament_id', tournamentId)
            .eq('user_id', auth.dbUser.id)
            .neq('status', 'withdrawn');
          console.log(`Staff application auto-withdrawn for ${auth.dbUser.discord_username} (switched role from staff to ${role})`);
        } catch (staffErr) {
          console.error('Non-critical: staff app withdrawal during role switch failed:', staffErr);
        }
      }

      // ── Cleanup: switching AWAY from coach → clear any coaching assignments in this tournament ──
      if (previousRole === 'coach' && role !== 'coach') {
        try {
          const { data: coachedTeams } = await supabase
            .from('kkup_teams')
            .select('id, team_name')
            .eq('tournament_id', tournamentId)
            .eq('coach_person_id', person.id)
            .neq('approval_status', 'withdrawn');

          for (const cTeam of (coachedTeams || [])) {
            await clearCoachAssignment(supabase, cTeam.id);
            console.log(`Cleared coach assignment for ${person.display_name} on team "${cTeam.team_name}" (switched role from coach to ${role})`);
          }
        } catch (coachErr) {
          console.error('Non-critical: coach assignment cleanup during role switch failed:', coachErr);
        }
      }

      // ── Defensive: switching TO player — warn if person has orphaned roster entries ──
      if (role === 'player' && previousRole !== 'player') {
        try {
          const { data: tournamentTeams } = await supabase
            .from('kkup_teams').select('id').eq('tournament_id', tournamentId);
          const tIds = (tournamentTeams || []).map((t: any) => t.id);
          if (tIds.length > 0) {
            const { data: orphanedRoster } = await supabase
              .from('kkup_team_rosters')
              .select('team_id')
              .eq('person_id', person.id)
              .in('team_id', tIds);
            if (orphanedRoster && orphanedRoster.length > 0) {
              console.warn(`Warning: ${person.display_name} switching to player but has ${orphanedRoster.length} orphaned roster entry(ies) in tournament ${tournamentId}`);
            }
          }
        } catch (checkErr) {
          console.error('Non-critical: orphaned roster check failed:', checkErr);
        }
      }

      // ── Rank eligibility check for player role in Kernel Kup ──
      // Per-tournament min_rank/max_rank override global defaults when set
      if (role === 'player' && tournament.tournament_type === 'kernel_kup') {
        const maxRank = tournament.max_rank ?? await getMaxPlayerRank();
        const minRank = tournament.min_rank ?? await getMinPlayerRank();
        const eligibility = checkKernelKupEligibility(auth.dbUser, null, maxRank, minRank);
        if (!eligibility.eligible && !eligibility.rankUnknown) {
          return c.json({
            error: eligibility.reason || `Your rank is above the Kernel Kup eligibility threshold. You can participate as a Coach or Staff instead.`,
            rank_ineligible: true,
          }, 403);
        }
      }

      // Perform the role update
      const { data: updated, error: updateError } = await supabase
        .from('kkup_registrations')
        .update({ role })
        .eq('id', registration.id)
        .select()
        .single();

      if (updateError) {
        console.error('Role update error:', updateError);
        return c.json({ error: `Failed to update role: ${updateError.message}` }, 500);
      }

      const roleLabels: Record<string, string> = {
        player: 'Player',
        coach: 'Coach',
        staff: 'Staff',
      };

      console.log(`Role set: ${person.display_name} → ${role} for tournament "${tournament.name}" (was: ${previousRole})`);

      // Log activity
      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'tournament_role_chosen',
          title: `Chose ${roleLabels[role]} path`,
          description: `You chose to participate as a ${roleLabels[role]} in "${tournament.name}".`,
          related_id: tournamentId,
          related_url: `#tournament-hub/${tournamentId}`,
        });
      } catch (actErr) { console.error('Non-critical: activity log for role choice failed:', actErr); }

      // Discord webhook: role change (only if actually changed)
      if (previousRole && previousRole !== role) {
        try {
          const { embed } = buildKkupActivityEmbed({
            type: 'role_changed',
            tournamentName: tournament.name,
            tournamentId,
            playerName: person.display_name,
            playerDiscordId: auth.dbUser.discord_id,
            playerAvatar: auth.dbUser.discord_avatar,
            roleName: roleLabels[role],
            extraDetail: `${roleLabels[previousRole] || previousRole} → ${roleLabels[role]}`,
          });
          await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
        } catch (whErr) { console.error('Non-critical: role change webhook failed:', whErr); }
      }

      return c.json({
        success: true,
        registration: safeClone(updated),
        message: `You're now registered as a ${roleLabels[role]}!`,
        role,
        previous_role: previousRole,
      });
    } catch (error: any) {
      console.error('Role update error:', error);
      return c.json({ error: 'Internal server error during role update: ' + error.message }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 7. LIST REGISTRATIONS (Public — includes free agents + on-team)
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/kkup/tournaments/:id/registrations`, async (c) => {
    try {
      const tournamentId = c.req.param('id');

      // Verify tournament exists
      const { data: tournament, error: fetchError } = await supabase
        .from('kkup_tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (fetchError || !tournament) {
        return c.json({ error: 'Tournament not found' }, 404);
      }

      // Optional filter by status
      const statusFilter = c.req.query('status'); // 'registered', 'on_team', 'withdrawn', or omit for all active

      let query = supabase
        .from('kkup_registrations')
        .select(`
          id, tournament_id, person_id, user_id, status, role, registered_at, withdrawn_at,
          person:kkup_persons!person_id(id, steam_id, display_name, avatar_url)
        `)
        .eq('tournament_id', tournamentId)
        .order('registered_at', { ascending: true });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      } else {
        // Default: exclude withdrawn
        query = query.neq('status', 'withdrawn');
      }

      const { data: registrations, error: regError } = await query;

      if (regError) {
        console.error('Fetch registrations error:', regError);
        return c.json({ error: `Failed to fetch registrations: ${regError.message}` }, 500);
      }

      // ── Enrich registrations with user data (avatar, rank, role) ──
      const userIds = (registrations || []).map((r: any) => r.user_id).filter(Boolean);
      const userMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, discord_id, discord_username, discord_avatar, rank_id, prestige_level, role, steam_id, created_at, opendota_data, tcf_plus_active, twitch_username, twitch_avatar, ranks:ranks!rank_id(id, name, display_order)')
          .in('id', userIds);
        (users || []).forEach((u: any) => userMap.set(u.id, u));
      }

      // ── Detect first-timers: persons NOT in any previous tournament ──
      const personIds = (registrations || []).map((r: any) => r.person_id).filter(Boolean);
      const firstTimerSet = new Set<string>();
      if (personIds.length > 0) {
        // Check kkup_registrations in OTHER tournaments
        const { data: priorRegs } = await supabase
          .from('kkup_registrations')
          .select('person_id')
          .in('person_id', personIds)
          .neq('tournament_id', tournamentId)
          .neq('status', 'withdrawn');
        // Also check historical team rosters (Phase 1 players who were imported)
        const { data: priorRosters } = await supabase
          .from('kkup_team_rosters')
          .select('person_id, team:kkup_teams!team_id(tournament_id)')
          .in('person_id', personIds);
        
        const hasHistory = new Set<string>();
        (priorRegs || []).forEach((r: any) => hasHistory.add(r.person_id));
        (priorRosters || []).forEach((r: any) => {
          if (r.team?.tournament_id && r.team.tournament_id !== tournamentId) {
            hasHistory.add(r.person_id);
          }
        });
        personIds.forEach((pid: string) => {
          if (!hasHistory.has(pid)) firstTimerSet.add(pid);
        });
      }

      // Enrich each registration
      const enrichRegistration = (reg: any) => {
        const linkedUser = userMap.get(reg.user_id);
        return {
          ...reg,
          is_first_timer: firstTimerSet.has(reg.person_id),
          linked_user: linkedUser ? {
            id: linkedUser.id,
            discord_id: linkedUser.discord_id || null,
            discord_username: linkedUser.discord_username,
            discord_avatar: linkedUser.discord_avatar,
            rank_id: linkedUser.rank_id,
            prestige_level: linkedUser.prestige_level || 0,
            role: linkedUser.role,
            steam_id: linkedUser.steam_id || null,
            created_at: linkedUser.created_at,
            badge_rank: linkedUser.opendota_data?.badge_rank || null,
            opendota_data: linkedUser.opendota_data || null,
            ranks: linkedUser.ranks || null,
            tcf_plus_active: linkedUser.tcf_plus_active || false,
            twitch_username: linkedUser.twitch_username || null,
            twitch_avatar: linkedUser.twitch_avatar || null,
          } : null,
        };
      };

      const enrichedRegistrations = (registrations || []).map(enrichRegistration);

      // Separate into free agents (players only) and on-team players
      const freeAgents = enrichedRegistrations.filter((r: any) =>
        (r.status === 'free_agent' || r.status === 'registered') && r.role === 'player'
      );
      const onTeam = enrichedRegistrations.filter((r: any) => r.status === 'on_team');

      // Separate coaches from registrations
      const coaches = enrichedRegistrations.filter((r: any) => r.role === 'coach');

      // For on-team players, look up which team they're on
      const onTeamWithTeamInfo = await Promise.all(
        onTeam.map(async (reg: any) => {
          const { data: rosterEntry } = await supabase
            .from('kkup_team_rosters')
            .select('team_id, team:kkup_teams!team_id(id, team_name, team_tag, logo_url)')
            .eq('person_id', reg.person_id)
            .maybeSingle();

          return {
            ...reg,
            team: rosterEntry?.team || null,
          };
        })
      );

      // Count summary
      const totalActive = (registrations || []).length;
      const freeAgentCount = freeAgents.length;
      const onTeamCount = onTeam.length;
      const coachCount = coaches.length;

      return c.json({
        tournament,
        summary: {
          total_active: totalActive,
          free_agents: freeAgentCount,
          on_team: onTeamCount,
          coaches: coachCount,
        },
        registrations: safeClone(enrichedRegistrations),
        free_agents: safeClone(freeAgents),
        on_team: safeClone(onTeamWithTeamInfo),
        coaches: safeClone(coaches),
      });
    } catch (error: any) {
      console.error('List registrations error:', error);
      return c.json({ error: 'Internal server error listing registrations: ' + error.message }, 500);
    }
  });

}