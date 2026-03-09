/**
 * Staff Application Routes — Tournament staff signup flow
 *
 * 6 routes:
 *   POST   /kkup/tournaments/:id/apply-staff     — Apply as staff (any authenticated user)
 *   DELETE /kkup/tournaments/:id/apply-staff     — Withdraw staff application
 *   GET    /kkup/tournaments/:id/staff           — List staff applications (public summary, full detail for owner)
 *   PATCH  /kkup/tournaments/:id/staff/:appId    — Approve/deny staff application (owner only)
 *   DELETE /kkup/tournaments/:id/staff/:appId    — Dismiss (hard delete) staff application (officer/owner)
 *   GET    /kkup/requests                        — List all KKup requests (aggregated)
 *
 * Storage: Uses real Postgres table `kkup_staff_applications`
 */
import type { Hono } from "npm:hono";
import { PREFIX, resolvePersonForUser, disbandCaptainTeam } from "./helpers.ts";
import { createNotification, createAdminLog, createUserActivity } from "./routes-notifications.ts";
import { isOfficer } from "./roles.ts";
import { DISCORD_WEBHOOKS } from "./discord-config.ts";
import { buildRegistrationEmbed, buildKkupActivityEmbed, sendWebhookEmbed } from "./discord-embeds.tsx";
import { resolveUserRank, getRankBadgeUrl } from "./rank-utils.ts";

export function registerStaffApplicationRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ── Auth helpers ──
  async function requireAuth(c: any): Promise<{ ok: true; authUser: any; dbUser: any } | { ok: false; response: any }> {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return { ok: false, response: c.json({ error: 'No access token provided' }, 401) };
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    if (authError || !authUser) return { ok: false, response: c.json({ error: 'Unauthorized — invalid or expired token' }, 401) };
    const { data: dbUser } = await supabase.from('users').select('*').eq('supabase_id', authUser.id).single();
    if (!dbUser) return { ok: false, response: c.json({ error: 'User not found in database' }, 404) };
    return { ok: true, authUser, dbUser };
  }

  // ═══════════════════════════════════════════════════════
  // 1. APPLY AS STAFF
  // ═══════════════════════════════════════════════════════

  app.post(`${PREFIX}/kkup/tournaments/:id/apply-staff`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');
      const body = await c.req.json();

      const { data: tournament, error: fetchError } = await supabase
        .from('kkup_tournaments').select('id, name, status, casters_needed, staff_needed')
        .eq('id', tournamentId).single();
      if (fetchError || !tournament) return c.json({ error: 'Tournament not found' }, 404);

      if (!['upcoming', 'registration_open', 'registration_closed'].includes(tournament.status)) {
        return c.json({ error: `Tournament "${tournament.name}" is not accepting staff applications (status: ${tournament.status}).` }, 400);
      }

      // Check for existing application
      const { data: existing } = await supabase
        .from('kkup_staff_applications')
        .select('id, status')
        .eq('tournament_id', tournamentId)
        .eq('user_id', auth.dbUser.id)
        .maybeSingle();

      if (existing && existing.status !== 'withdrawn') {
        return c.json({ error: 'You have already applied for staff. Check your application status or withdraw first.' }, 409);
      }

      const validRoles = ['caster', 'producer', 'helper', 'tournament_director', 'other'];
      const rolePreference = validRoles.includes(body.role_preference) ? body.role_preference : 'other';
      const plansToPlay = rolePreference === 'tournament_director' ? (body.plans_to_play === true) : false;

      // ── Role exclusivity check ──
      // Staff roles (caster, producer, helper) are exclusive — can't also be a player/coach.
      // Tournament Director who plans to play is exempt.
      if (!(rolePreference === 'tournament_director' && plansToPlay)) {
        const { data: existingReg } = await supabase
          .from('kkup_registrations')
          .select('id, status, role')
          .eq('tournament_id', tournamentId)
          .eq('user_id', auth.dbUser.id)
          .neq('status', 'withdrawn')
          .maybeSingle();

        if (existingReg && existingReg.role === 'player') {
          return c.json({
            error: 'You\'re currently registered as a player. You must withdraw from the player role before applying as staff.',
            role_conflict: true,
            current_role: 'player',
          }, 409);
        }
        if (existingReg && existingReg.role === 'coach') {
          return c.json({
            error: 'You\'re currently registered as a coach. You must remove yourself from coaching before applying as staff.',
            role_conflict: true,
            current_role: 'coach',
          }, 409);
        }
      }

      // Resolve person_id from kkup_persons via user link (create if needed)
      const personResult = await resolvePersonForUser(supabase, auth.dbUser);
      if ('error' in personResult) {
        return c.json({ error: `Failed to resolve person identity: ${personResult.error}` }, 500);
      }
      const personId = personResult.person.id;

      // Upsert (handles re-applying after withdrawal)
      if (existing) {
        const { error: updateError } = await supabase
          .from('kkup_staff_applications')
          .update({
            role_preference: rolePreference,
            plans_to_play: plansToPlay,
            note: (body.message || '').trim().slice(0, 500),
            status: 'pending',
            reviewed_by: null,
            reviewed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('kkup_staff_applications')
          .insert({
            tournament_id: tournamentId,
            person_id: personId,
            user_id: auth.dbUser.id,
            role_preference: rolePreference,
            plans_to_play: plansToPlay,
            note: (body.message || '').trim().slice(0, 500),
            status: 'pending',
          });
        if (insertError) throw insertError;
      }

      console.log(`Staff application: ${auth.dbUser.discord_username} applied as ${rolePreference}${plansToPlay ? ' (plans to play)' : ''} for "${tournament.name}"`);

      // Log activity
      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'staff_applied',
          title: `Applied as ${rolePreference === 'tournament_director' ? 'Tournament Director' : rolePreference}`,
          description: `You applied as ${rolePreference === 'tournament_director' ? 'Tournament Director' : rolePreference}${plansToPlay ? ' (plans to play)' : ''} for "${tournament.name}".`,
          related_id: tournamentId,
          related_url: `#tournament-hub/${tournamentId}`,
        });
      } catch (actErr) { console.error('Non-critical: activity log for staff application failed:', actErr); }

      const roleLabel = rolePreference === 'tournament_director' ? 'Tournament Director' : rolePreference;
      return c.json({
        success: true,
        message: `You've applied as ${roleLabel}${plansToPlay ? ' (playing)' : ''} for "${tournament.name}". An officer will review your application.`,
      });
    } catch (error: any) {
      console.error('Staff application error:', error);
      return c.json({ error: 'Internal server error during staff application: ' + error.message }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // 2. WITHDRAW STAFF APPLICATION
  // ═══════════════════════════════════════════════════════

  app.delete(`${PREFIX}/kkup/tournaments/:id/apply-staff`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');

      const { data: existing, error: fetchErr } = await supabase
        .from('kkup_staff_applications')
        .select('id, status, role_preference, plans_to_play')
        .eq('tournament_id', tournamentId)
        .eq('user_id', auth.dbUser.id)
        .maybeSingle();

      if (fetchErr || !existing) return c.json({ error: 'No staff application found' }, 404);

      const wasApprovedTdWithPlay = existing.status === 'approved'
        && existing.role_preference === 'tournament_director'
        && existing.plans_to_play === true;

      const { error: updateErr } = await supabase
        .from('kkup_staff_applications')
        .delete()
        .eq('id', existing.id);
      if (updateErr) throw updateErr;

      // Clean up any legacy staff registration (from old flow that created registration on apply)
      try {
        const { data: staffReg } = await supabase
          .from('kkup_registrations')
          .select('id, role')
          .eq('tournament_id', tournamentId)
          .eq('user_id', auth.dbUser.id)
          .eq('role', 'staff')
          .neq('status', 'withdrawn')
          .maybeSingle();
        if (staffReg) {
          await supabase
            .from('kkup_registrations')
            .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
            .eq('id', staffReg.id);
          console.log(`Cleaned up legacy staff registration for ${auth.dbUser.discord_username} in tournament ${tournamentId}`);
        }
      } catch (regErr) {
        console.error('Non-critical: failed to clean up legacy staff registration:', regErr);
      }

      // Clean up auto-created player registration for approved TD with plans_to_play
      // When a TD who planned to play gets approved, a player registration is auto-created.
      // Stepping down should also remove that registration so they get a clean slate.
      // CRITICAL: If the TD is also a team captain, disband the team first.
      if (wasApprovedTdWithPlay) {
        try {
          const { data: playerReg } = await supabase
            .from('kkup_registrations')
            .select('id, role, status')
            .eq('tournament_id', tournamentId)
            .eq('user_id', auth.dbUser.id)
            .eq('role', 'player')
            .neq('status', 'withdrawn')
            .maybeSingle();
          if (playerReg) {
            const personResult = await resolvePersonForUser(supabase, auth.dbUser);
            if (!('error' in personResult)) {
              const { person } = personResult;

              // Check if this person is captain of a team — if so, disband it
              const { data: captainedTeam } = await supabase
                .from('kkup_teams')
                .select('id, team_name, team_tag, logo_url, coach_person_id, approval_status')
                .eq('tournament_id', tournamentId)
                .eq('captain_person_id', person.id)
                .neq('approval_status', 'withdrawn')
                .maybeSingle();

              if (captainedTeam) {
                // Get tournament name for notifications
                const { data: tournament } = await supabase
                  .from('kkup_tournaments')
                  .select('name')
                  .eq('id', tournamentId)
                  .single();

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
                console.log(`Team "${captainedTeam.team_name}" disbanded — TD captain ${person.display_name} stepped down from tournament ${tournamentId}`);

                // Discord webhook: team disbanded due to staff role change (non-critical)
                try {
                  const { embed } = buildKkupActivityEmbed({
                    type: 'team_withdrawn',
                    tournamentName: tournament?.name || 'Unknown Tournament',
                    tournamentId,
                    playerName: person.display_name,
                    playerAvatar: auth.dbUser.discord_avatar,
                    teamName: captainedTeam.team_name,
                    teamLogoUrl: captainedTeam.logo_url,
                    actorName: auth.dbUser.discord_username,
                    extraDetail: `Captain became staff — team disbanded. ${disbandResult.displacedPersonIds.length} player(s) returned to free agency.`,
                  });
                  await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
                } catch (whErr) { console.error('Non-critical: team disband webhook (staff approval) failed:', whErr); }
              } else {
                // Not a captain — just clean up roster membership and invites
                const { data: tournTeams } = await supabase
                  .from('kkup_teams')
                  .select('id')
                  .eq('tournament_id', tournamentId)
                  .neq('approval_status', 'withdrawn');
                const teamIds = (tournTeams || []).map((t: any) => t.id);
                if (teamIds.length > 0) {
                  await supabase.from('kkup_team_rosters').delete().eq('person_id', person.id).in('team_id', teamIds);
                  await supabase.from('kkup_team_invites')
                    .update({ status: 'expired', updated_at: new Date().toISOString() })
                    .eq('person_id', person.id).eq('status', 'pending').in('team_id', teamIds);
                }
              }
            }
            await supabase
              .from('kkup_registrations')
              .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
              .eq('id', playerReg.id);
            console.log(`Cleaned up auto-created player registration for ${auth.dbUser.discord_username} (TD step-down) in tournament ${tournamentId}`);
          }
        } catch (regErr) {
          console.error('Non-critical: failed to clean up player registration on TD step-down:', regErr);
        }
      }

      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'staff_app_withdrawn',
          title: 'Withdrew Staff Application',
          description: `You withdrew your staff application for tournament ${tournamentId}.`,
          related_id: tournamentId,
          related_url: `#tournament-hub/${tournamentId}`,
        });
      } catch (actErr) { console.error('Non-critical: activity log for staff withdrawal failed:', actErr); }

      return c.json({ success: true, message: 'Staff application withdrawn.' });
    } catch (error: any) {
      console.error('Staff withdrawal error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // 3. LIST STAFF APPLICATIONS
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/kkup/tournaments/:id/staff`, async (c) => {
    try {
      const tournamentId = c.req.param('id');

      let isOwnerOrOfficer = false;
      let currentUserId: string | null = null;
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (accessToken) {
        const { data: { user: authUser } } = await anonSupabase.auth.getUser(accessToken);
        if (authUser) {
          const { data: dbUser } = await supabase.from('users').select('id, role').eq('supabase_id', authUser.id).single();
          if (dbUser) {
            isOwnerOrOfficer = isOfficer(dbUser.role);
            currentUserId = dbUser.id;
          }
        }
      }

      const { data: allApps, error: fetchErr } = await supabase
        .from('kkup_staff_applications')
        .select('*')
        .eq('tournament_id', tournamentId)
        .neq('status', 'withdrawn')
        .order('created_at', { ascending: true });

      if (fetchErr) throw fetchErr;
      const applications = allApps || [];

      // Enrich with user data (avatar, username)
      const userIds = applications.map((a: any) => a.user_id).filter(Boolean);
      const userMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, discord_username, discord_avatar, tcf_plus_active')
          .in('id', userIds);
        (users || []).forEach((u: any) => userMap.set(u.id, u));
      }

      const enrichedApps = applications.map((app: any) => {
        const u = userMap.get(app.user_id);
        return {
          ...app,
          discord_username: u?.discord_username || 'Unknown',
          discord_avatar: u?.discord_avatar || null,
          tcf_plus_active: u?.tcf_plus_active || false,
          // Compat: keep applied_at for frontend
          applied_at: app.created_at,
          message: app.note,
        };
      });

      const myApplication = currentUserId
        ? enrichedApps.find((a: any) => a.user_id === currentUserId) || null
        : null;

      const visibleApps = enrichedApps;

      const summary = {
        total: visibleApps.length,
        pending: visibleApps.filter((a: any) => a.status === 'pending').length,
        approved: visibleApps.filter((a: any) => a.status === 'approved').length,
        denied: visibleApps.filter((a: any) => a.status === 'denied').length,
        casters: visibleApps.filter((a: any) => a.status === 'approved' && a.role_preference === 'caster').length,
        producers: visibleApps.filter((a: any) => a.status === 'approved' && a.role_preference === 'producer').length,
        helpers: visibleApps.filter((a: any) => a.status === 'approved' && a.role_preference === 'helper').length,
        tournament_directors: visibleApps.filter((a: any) => a.status === 'approved' && a.role_preference === 'tournament_director').length,
      };

      return c.json({
        applications: isOwnerOrOfficer ? visibleApps : visibleApps.filter((a: any) => a.status === 'approved'),
        my_application: myApplication,
        summary,
      });
    } catch (error: any) {
      console.error('List staff applications error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // 4. REVIEW STAFF APPLICATION (Officers + Owner)
  // ═══════════════════════════════════════════════════════

  app.patch(`${PREFIX}/kkup/tournaments/:id/staff/:appId`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;
      if (!isOfficer(auth.dbUser.role)) {
        return c.json({ error: 'Only officers and the owner can review staff applications' }, 403);
      }

      const tournamentId = c.req.param('id');
      const appId = c.req.param('appId');
      const { status: newStatus } = await c.req.json();

      if (!['approved', 'denied'].includes(newStatus)) {
        return c.json({ error: 'Status must be "approved" or "denied"' }, 400);
      }

      // appId might be the user_id (legacy frontend) or the actual app id
      // Try both lookups
      let app: any = null;
      const { data: byId } = await supabase
        .from('kkup_staff_applications')
        .select('*')
        .eq('id', appId)
        .eq('tournament_id', tournamentId)
        .maybeSingle();
      if (byId) {
        app = byId;
      } else {
        // Fallback: treat appId as user_id
        const { data: byUserId } = await supabase
          .from('kkup_staff_applications')
          .select('*')
          .eq('user_id', appId)
          .eq('tournament_id', tournamentId)
          .maybeSingle();
        app = byUserId;
      }

      if (!app) return c.json({ error: 'Staff application not found' }, 404);

      // Fetch tournament name for logging and webhooks
      const { data: tournament } = await supabase
        .from('kkup_tournaments').select('name').eq('id', tournamentId).single();
      const tournamentName = tournament?.name || 'Unknown Tournament';

      const { error: updateErr } = await supabase
        .from('kkup_staff_applications')
        .update({
          status: newStatus,
          reviewed_by: auth.dbUser.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', app.id);
      if (updateErr) throw updateErr;

      // Get applicant's username for logging
      const { data: applicantUser } = await supabase
        .from('users')
        .select('discord_username, discord_id, discord_avatar, opendota_data')
        .eq('id', app.user_id)
        .maybeSingle();
      const applicantName = applicantUser?.discord_username || 'Unknown';

      // Notify the applicant and log admin action (non-critical)
      try {
        await createNotification({
          user_id: app.user_id,
          type: 'staff_app_result',
          title: `Staff Application ${newStatus === 'approved' ? 'Approved' : 'Denied'}`,
          body: newStatus === 'approved'
            ? `Your staff application as ${app.role_preference} has been approved!`
            : `Your staff application has been denied.`,
          related_id: `${tournamentId}_${app.user_id}`,
          action_url: `#tournament-hub/${tournamentId}`,
          actor_name: auth.dbUser.discord_username,
        });
        await createAdminLog({
          type: `staff_${newStatus}`,
          action: `${newStatus === 'approved' ? 'Approved' : 'Denied'} staff application from ${applicantName}`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: { tournament_id: tournamentId, applicant: applicantName, role: app.role_preference },
        });
        await createUserActivity({
          user_id: app.user_id,
          type: newStatus === 'approved' ? 'admin_staff_approved' : 'admin_staff_denied',
          title: `Staff Application ${newStatus === 'approved' ? 'Approved' : 'Denied'}`,
          description: newStatus === 'approved'
            ? `Your staff application as ${app.role_preference === 'tournament_director' ? 'Tournament Director' : app.role_preference} was approved by ${auth.dbUser.discord_username}.`
            : `Your staff application was denied by ${auth.dbUser.discord_username}.`,
          related_id: tournamentId,
          related_url: `#tournament-hub/${tournamentId}`,
          actor_name: auth.dbUser.discord_username,
        });
      } catch (_) { /* non-critical */ }

      // ── Create/update registration on approval ──
      // Staff registration is only created when APPROVED, not on application.
      // TD with plans_to_play gets role='player', all others get role='staff'.
      if (newStatus === 'approved') {
        try {
          const targetRole = (app.role_preference === 'tournament_director' && app.plans_to_play) ? 'player' : 'staff';
          const targetStatus = targetRole === 'player' ? 'free_agent' : 'staff';

          const { data: existingReg } = await supabase
            .from('kkup_registrations')
            .select('id, status, role')
            .eq('tournament_id', tournamentId)
            .eq('user_id', app.user_id)
            .neq('status', 'withdrawn')
            .maybeSingle();

          if (existingReg) {
            // Upgrade existing registration if needed
            if (existingReg.role !== targetRole) {
              const { error: upgradeErr } = await supabase
                .from('kkup_registrations')
                .update({ role: targetRole, status: targetStatus })
                .eq('id', existingReg.id);
              if (upgradeErr) throw upgradeErr;
              console.log(`Upgraded ${applicantName} registration from ${existingReg.role} → ${targetRole}/${targetStatus} for tournament ${tournamentId}`);
            }
          } else {
            // No registration exists — create one
            await supabase.from('kkup_registrations').insert({
              tournament_id: tournamentId,
              person_id: app.person_id,
              user_id: app.user_id,
              role: targetRole,
              status: targetStatus,
            });
            console.log(`Auto-registered ${applicantName} as ${targetRole} (staff approved) for tournament ${tournamentId}`);
          }
        } catch (regErr) {
          console.error('Non-critical: failed to create registration on staff approval:', regErr);
        }

        // Discord webhook: staff approval notification (non-critical)
        try {
          const { count: regCount } = await supabase
            .from('kkup_registrations').select('id', { count: 'exact', head: true })
            .eq('tournament_id', tournamentId).neq('status', 'withdrawn');
          const rank = applicantUser ? resolveUserRank(applicantUser) : null;
          const dotaRank = rank ? `${rank.medal}${rank.stars ? ` [${rank.stars}]` : ''}` : null;
          const rankBadgeUrl = rank ? getRankBadgeUrl(rank.medal, rank.stars) : null;
          const { embed } = buildRegistrationEmbed({
            discordId: applicantUser?.discord_id || null,
            discordUsername: applicantName,
            discordAvatar: applicantUser?.discord_avatar || null,
            role: 'staff',
            tournamentName,
            tournamentId,
            registrationNumber: regCount || 1,
            isEarlyAccess: false,
            isReRegistration: false,
            dotaRank, rankBadgeUrl,
            staffRole: app.role_preference,
            isStaffApproval: true,
          });
          await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
        } catch (whErr) { console.error('Non-critical: staff approval webhook failed:', whErr); }
      }

      // ── Clean up registration on denial ──
      if (newStatus === 'denied') {
        try {
          const { data: existingReg } = await supabase
            .from('kkup_registrations')
            .select('id, role')
            .eq('tournament_id', tournamentId)
            .eq('user_id', app.user_id)
            .eq('role', 'staff')
            .neq('status', 'withdrawn')
            .maybeSingle();

          if (existingReg) {
            await supabase
              .from('kkup_registrations')
              .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
              .eq('id', existingReg.id);
            console.log(`Withdrew staff registration for denied applicant ${applicantName} in tournament ${tournamentId}`);
          }
        } catch (regErr) {
          console.error('Non-critical: failed to clean up registration on staff denial:', regErr);
        }
      }

      console.log(`Staff application ${newStatus}: ${applicantName} for tournament ${tournamentId}`);
      return c.json({
        success: true,
        message: `Staff application ${newStatus} for ${applicantName}.`,
      });
    } catch (error: any) {
      console.error('Staff review error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // 4b. DISMISS (DELETE) STAFF APPLICATION (officer/owner — hard delete)
  // ═══════════════════════════════════════════════════════

  app.delete(`${PREFIX}/kkup/tournaments/:id/staff/:appId`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;
      if (!isOfficer(auth.dbUser.role)) {
        return c.json({ error: 'Only officers and the owner can dismiss staff applications' }, 403);
      }

      const tournamentId = c.req.param('id');
      const appId = c.req.param('appId');

      // Try by id, then by user_id
      let app: any = null;
      const { data: byId } = await supabase
        .from('kkup_staff_applications')
        .select('*')
        .eq('id', appId)
        .eq('tournament_id', tournamentId)
        .maybeSingle();
      if (byId) {
        app = byId;
      } else {
        const { data: byUserId } = await supabase
          .from('kkup_staff_applications')
          .select('*')
          .eq('user_id', appId)
          .eq('tournament_id', tournamentId)
          .maybeSingle();
        app = byUserId;
      }

      if (!app) return c.json({ error: 'Staff application not found' }, 404);

      const { data: applicantUser } = await supabase
        .from('users')
        .select('discord_username, steam_id')
        .eq('id', app.user_id)
        .maybeSingle();
      const applicantName = applicantUser?.discord_username || 'Unknown';

      const wasApproved = app.status === 'approved';
      const wasApprovedTdWithPlay = wasApproved
        && app.role_preference === 'tournament_director'
        && app.plans_to_play === true;

      const { error: delErr } = await supabase
        .from('kkup_staff_applications')
        .delete()
        .eq('id', app.id);
      if (delErr) throw delErr;

      // ── Clean up associated registration ──
      // When an approved staff member is removed, their auto-created registration should also be cleaned up.
      if (wasApproved) {
        try {
          // For non-TD staff: role='staff'. For TD with plans_to_play: role='player'.
          const targetRole = wasApprovedTdWithPlay ? 'player' : 'staff';
          const { data: staffReg } = await supabase
            .from('kkup_registrations')
            .select('id, role, status')
            .eq('tournament_id', tournamentId)
            .eq('user_id', app.user_id)
            .eq('role', targetRole)
            .neq('status', 'withdrawn')
            .maybeSingle();

          if (staffReg) {
            // If the player was on a team, clean up team roster too
            if (wasApprovedTdWithPlay && applicantUser?.steam_id) {
              const { data: person } = await supabase
                .from('kkup_persons')
                .select('id')
                .eq('steam_id', applicantUser.steam_id)
                .maybeSingle();
              if (person) {
                const { data: tournTeams } = await supabase
                  .from('kkup_teams')
                  .select('id')
                  .eq('tournament_id', tournamentId)
                  .neq('approval_status', 'withdrawn');
                const teamIds = (tournTeams || []).map((t: any) => t.id);
                if (teamIds.length > 0) {
                  await supabase.from('kkup_team_rosters').delete().eq('person_id', person.id).in('team_id', teamIds);
                  await supabase.from('kkup_team_invites')
                    .update({ status: 'expired', updated_at: new Date().toISOString() })
                    .eq('person_id', person.id).eq('status', 'pending').in('team_id', teamIds);
                }
              }
            }

            await supabase
              .from('kkup_registrations')
              .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
              .eq('id', staffReg.id);
            console.log(`Cleaned up ${targetRole} registration for ${applicantName} (staff dismissed) in tournament ${tournamentId}`);
          }
        } catch (regErr) {
          console.error('Non-critical: failed to clean up registration on staff dismiss:', regErr);
        }
      }

      console.log(`Staff application dismissed: ${applicantName} for tournament ${tournamentId} by ${auth.dbUser.discord_username}`);

      try {
        await createAdminLog({
          type: 'staff_dismissed',
          action: `Removed ${applicantName} from staff`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: { tournament_id: tournamentId, applicant: applicantName, role: app.role_preference },
        });
        await createUserActivity({
          user_id: app.user_id,
          type: 'staff_app_dismissed',
          title: wasApproved ? 'Removed from Staff' : 'Staff Application Dismissed',
          description: wasApproved
            ? `You were removed from staff by ${auth.dbUser.discord_username || 'an officer'}.`
            : `Your staff application was dismissed by ${auth.dbUser.discord_username || 'an officer'}.`,
          related_id: tournamentId,
          related_url: `#tournament-hub/${tournamentId}`,
          actor_name: auth.dbUser.discord_username,
        });
        // Notify the removed user
        await createNotification({
          user_id: app.user_id,
          type: wasApproved ? 'staff_removed' : 'staff_app_dismissed',
          title: wasApproved ? 'Removed from Staff' : 'Staff Application Dismissed',
          body: wasApproved
            ? `You were removed from staff for this tournament by ${auth.dbUser.discord_username || 'an officer'}.`
            : `Your staff application was dismissed by ${auth.dbUser.discord_username || 'an officer'}.`,
          related_id: tournamentId,
          action_url: `#tournament-hub/${tournamentId}`,
          actor_name: auth.dbUser.discord_username,
        });
      } catch (_) { /* non-critical */ }

      return c.json({
        success: true,
        message: `Staff application from ${applicantName} dismissed.`,
      });
    } catch (error: any) {
      console.error('Staff dismiss error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // 5. LIST ALL KKUP REQUESTS (aggregated — for admin requests page)
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/kkup/requests`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const isOwnerRole = auth.dbUser.role === 'owner';
      const isOfficerRole = isOfficer(auth.dbUser.role);

      const { data: tournaments } = await supabase
        .from('kkup_tournaments').select('id, name, status').order('created_at', { ascending: false });

      const allRequests: any[] = [];
      const myRequests: any[] = [];

      for (const t of (tournaments || [])) {
        if (isOfficerRole) {
          const { data: pendingTeams } = await supabase
            .from('kkup_teams')
            .select('id, team_name, team_tag, logo_url, approval_status, created_at, captain:kkup_persons!captain_person_id(id, display_name, avatar_url)')
            .eq('tournament_id', t.id).eq('approval_status', 'pending_approval');
          for (const team of (pendingTeams || [])) {
            allRequests.push({
              id: `team_${team.id}`, raw_id: team.id, request_type: 'kkup_team_approval',
              tournament_id: t.id, tournament_name: t.name, status: 'pending',
              created_at: team.created_at, data: team,
            });
          }
        }

        // Staff applications from real table (exclude withdrawn)
        const { data: staffApps } = await supabase
          .from('kkup_staff_applications')
          .select('*')
          .eq('tournament_id', t.id)
          .neq('status', 'withdrawn');

        // Enrich with user data
        const staffUserIds = (staffApps || []).map((a: any) => a.user_id).filter(Boolean);
        const staffUserMap = new Map<string, any>();
        if (staffUserIds.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id, discord_username, discord_avatar, tcf_plus_active')
            .in('id', staffUserIds);
          (users || []).forEach((u: any) => staffUserMap.set(u.id, u));
        }

        for (const sApp of (staffApps || [])) {
          const u = staffUserMap.get(sApp.user_id);
          const enriched = {
            ...sApp,
            discord_username: u?.discord_username || 'Unknown',
            discord_avatar: u?.discord_avatar || null,
            tcf_plus_active: u?.tcf_plus_active || false,
            applied_at: sApp.created_at,
            message: sApp.note,
          };

          if (isOfficerRole) {
            allRequests.push({
              id: `staff_${sApp.id}`, raw_id: sApp.id, request_type: 'kkup_staff_application',
              tournament_id: t.id, tournament_name: t.name, status: sApp.status,
              created_at: sApp.created_at, data: enriched,
            });
          }
          if (sApp.user_id === auth.dbUser.id) {
            myRequests.push({
              id: `mystaff_${sApp.id}`, request_type: 'kkup_my_staff',
              tournament_id: t.id, tournament_name: t.name, status: sApp.status,
              created_at: sApp.created_at, data: enriched,
            });
          }
        }
      }

      allRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      myRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return c.json({
        requests: allRequests, my_requests: myRequests,
        summary: { total: allRequests.length, pending: allRequests.filter(r => r.status === 'pending').length, my_total: myRequests.length },
      });
    } catch (error: any) {
      console.error('List KKup requests error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });
}