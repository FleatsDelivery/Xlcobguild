/**
 * Team Formation Routes -- Phase 3: Team Creation, Approval, Invites, Roster, Tickets
 *
 * 15 routes:
 *   POST   /kkup/tournaments/:tid/teams                           -- Create team (registered player or owner)
 *   GET    /kkup/tournaments/:tid/teams                           -- List tournament teams (public)
 *   PATCH  /kkup/tournaments/:tid/teams/:team_id/approval         -- Approve/deny team (officers + owner)
 *   DELETE /kkup/tournaments/:tid/teams/:team_id                  -- Delete/disband team (captain, officer, or owner)
 *   PATCH  /kkup/tournaments/:tid/teams/:team_id                  -- Update team details (captain or owner)
 *   POST   /kkup/tournaments/:tid/teams/:team_id/invites          -- Send invite (captain or owner)
 *   GET    /kkup/tournaments/:tid/teams/:team_id/invites          -- List team invites (captain or owner)
 *   DELETE /kkup/tournaments/:tid/teams/:team_id/invites/:iid     -- Cancel invite silently (captain or owner)
 *   GET    /kkup/tournaments/:tid/my-invites                      -- Player's pending invites
 *   PATCH  /kkup/tournaments/:tid/invites/:invite_id              -- Respond to invite (invited player)
 *   GET    /kkup/tournaments/:tid/teams/:team_id/roster           -- Team roster (public)
 *   POST   /kkup/tournaments/:tid/teams/:team_id/roster           -- Direct add to roster (captain or owner)
 *   DELETE /kkup/tournaments/:tid/teams/:team_id/roster/:person_id -- Remove from roster (captain or owner)
 *   GET    /kkup/tournaments/:tid/my-past-teams                   -- Teams user captained in other tournaments
 *   PATCH  /kkup/tournaments/:tid/teams/:team_id/roster/:pid/contribution -- Set ticket contribution (captain)
 *   POST   /kkup/tournaments/:tid/teams/:team_id/ready           -- Team Ready (captain — atomic ticket deduction)
 *
 * Tables: kkup_teams, kkup_team_rosters, kkup_team_invites, kkup_coach_assignments, kkup_registrations, kkup_persons, users
 *
 * Captain model:
 *   Captain = team creator/organizer (permanent). They can ALSO be on the roster
 *   as a player, set as coach_person_id, or neither. Captain != playing role.
 */
import { PREFIX, requireAuth as sharedRequireAuth, resolvePersonForUser as sharedResolvePersonForUser, setCoachAssignment, clearCoachAssignment } from './helpers.ts';
import { createNotification, createAdminLog, createUserActivity } from './routes-notifications.ts';
import { isOfficer } from './roles.ts';
import { checkKernelKupEligibility } from './rank-utils.ts';
import { getMaxPlayerRank, getMinPlayerRank } from './routes-config.ts';
import { DISCORD_WEBHOOKS } from './discord-config.ts';
import { buildKkupActivityEmbed, sendWebhookEmbed } from './discord-embeds.tsx';
import * as kv from './kv_store.tsx';

/** Statuses that allow roster/invite mutations */
const MUTABLE_STATUSES = ['upcoming', 'registration_open', 'registration_closed'];

export function registerTeamFormationRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ===============================================
  // AUTH & PERSON HELPERS -- delegates to shared helpers.ts
  // ===============================================

  const requireAuth = (c: any) => sharedRequireAuth(c, supabase, anonSupabase);
  const resolvePersonForUser = (dbUser: any) => sharedResolvePersonForUser(supabase, dbUser);

  /** Check if caller is the team's captain or the site owner */
  async function isOwnerOrCaptain(dbUser: any, teamId: string): Promise<{ authorized: boolean; team: any; person: any | null }> {
    // Fetch team
    const { data: team } = await supabase
      .from('kkup_teams').select('*').eq('id', teamId).single();
    if (!team) return { authorized: false, team: null, person: null };

    // Owner always authorized
    if (dbUser.role === 'owner') {
      const personResult = await resolvePersonForUser(dbUser);
      const person = 'error' in personResult ? null : personResult.person;
      return { authorized: true, team, person };
    }

    // Check if caller is the captain
    const personResult = await resolvePersonForUser(dbUser);
    if ('error' in personResult) return { authorized: false, team, person: null };
    const { person } = personResult;

    if (team.captain_person_id === person.id) {
      return { authorized: true, team, person };
    }

    return { authorized: false, team, person };
  }

  /** Verify tournament is in a mutable state for roster operations */
  async function getTournamentIfMutable(tournamentId: string): Promise<{ ok: true; tournament: any } | { ok: false; error: string; tournament?: any }> {
    const { data: tournament, error } = await supabase
      .from('kkup_tournaments').select('*').eq('id', tournamentId).single();
    if (error || !tournament) return { ok: false, error: 'Tournament not found' };
    if (!MUTABLE_STATUSES.includes(tournament.status)) {
      return { ok: false, error: `Tournament "${tournament.name}" is ${tournament.status}. Roster changes are locked.`, tournament };
    }
    return { ok: true, tournament };
  }


  // ===============================================
  // 1. CREATE TEAM (Registered player or owner)
  // ===============================================

  app.post(`${PREFIX}/kkup/tournaments/:tid/teams`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('tid');
      const body = await c.req.json();

      // Tournament must exist and be in registration (or upcoming for owner prep)
      const tCheck = await getTournamentIfMutable(tournamentId);
      if (!tCheck.ok) return c.json({ error: tCheck.error }, 400);
      const tournament = tCheck.tournament;

      // Validate required fields
      if (!body.team_name?.trim()) {
        return c.json({ error: 'team_name is required' }, 400);
      }

      const isOwner = auth.dbUser.role === 'owner';
      let captainPersonId: string;

      if (isOwner && body.captain_person_id) {
        // Owner can designate any registered person as captain
        captainPersonId = body.captain_person_id;
      } else {
        // Caller becomes captain -- resolve their kkup_persons record (no registration required)
        // This allows Divine/Immortal players to create teams + coach without registering as a player
        const personResult = await resolvePersonForUser(auth.dbUser);
        if ('error' in personResult) return c.json({ error: personResult.error }, 500);
        captainPersonId = personResult.person.id;
      }

      // Check max_teams limit (exclude denied + withdrawn teams)
      if (tournament.max_teams) {
        const { count: teamCount } = await supabase
          .from('kkup_teams')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', tournamentId)
          .not('approval_status', 'in', '("denied","withdrawn")');

        if ((teamCount || 0) >= tournament.max_teams) {
          return c.json({ error: `Tournament is full -- maximum ${tournament.max_teams} teams reached.` }, 400);
        }
      }

      // Check captain isn't already captain of another active team in this tournament
      // (withdrawn teams are treated as removed — captain is free to re-register)
      const { data: existingCaptainTeam } = await supabase
        .from('kkup_teams')
        .select('id, team_name')
        .eq('tournament_id', tournamentId)
        .eq('captain_person_id', captainPersonId)
        .not('approval_status', 'in', '("denied","withdrawn")')
        .maybeSingle();

      if (existingCaptainTeam) {
        return c.json({
          error: `This person is already captain of "${existingCaptainTeam.team_name}" in this tournament.`,
        }, 409);
      }

      // Determine creator role (playing_captain or coaching_captain)
      const creatorRole = body.creator_role || 'playing_captain';

      // If coaching_captain, set coach to the captain person. captain_only = organizer only (no coach, no roster)
      const coachPersonId = creatorRole === 'coaching_captain' ? captainPersonId : null;

      // Rank gating for playing_captain in Kernel Kup (uses shared rank-utils.ts)
      // Per-tournament min_rank/max_rank override global defaults when set
      if (creatorRole === 'playing_captain' && tournament.tournament_type === 'kernel_kup') {
        const maxRank = tournament.max_rank ?? await getMaxPlayerRank();
        const minRank = tournament.min_rank ?? await getMinPlayerRank();
        const eligibility = checkKernelKupEligibility(auth.dbUser, null, maxRank, minRank);
        if (!eligibility.eligible && !eligibility.rankUnknown) {
          return c.json({
            error: eligibility.reason || 'Your rank is above the player eligibility limit.',
            rank_ineligible: true,
          }, 403);
        }
      }

      // -- Master Team linking --
      // If master_team_id provided (Add Existing Team flow), link to it.
      // Otherwise, auto-create a new master team for the captain.
      let masterTeamId: string | null = null;
      const teamName = body.team_name.trim();
      const teamTag = body.team_tag?.trim() || teamName.substring(0, 4).toUpperCase();

      if (body.master_team_id) {
        // Verify the master team exists and caller is captain (or officer)
        const { data: mt } = await supabase
          .from('kkup_master_teams')
          .select('id, current_captain_person_id')
          .eq('id', body.master_team_id)
          .single();

        if (!mt) return c.json({ error: 'Master team not found' }, 404);

        const isOfficerUser = auth.dbUser.role === 'owner' || ['officer', 'admin'].includes(auth.dbUser.role);
        if (mt.current_captain_person_id !== captainPersonId && !isOfficerUser) {
          return c.json({ error: 'You must be the captain of this team to register it' }, 403);
        }
        masterTeamId = mt.id;
      } else {
        // Auto-create master team (best-effort, non-blocking for tournament team creation)
        try {
          // Check if a master team already exists for this captain with same name (case-insensitive)
          const { data: existingMt } = await supabase
            .from('kkup_master_teams')
            .select('id')
            .eq('current_captain_person_id', captainPersonId)
            .ilike('current_name', teamName)
            .maybeSingle();

          if (existingMt) {
            masterTeamId = existingMt.id;
          } else {
            // Check free plan limit (3 teams max)
            const { data: existingTeams } = await supabase
              .from('kkup_master_teams')
              .select('id')
              .eq('current_captain_person_id', captainPersonId);

            const FREE_TEAM_LIMIT = 3;
            if ((existingTeams || []).length < FREE_TEAM_LIMIT) {
              const { data: newMt } = await supabase
                .from('kkup_master_teams')
                .insert({
                  current_name: teamName,
                  current_tag: teamTag,
                  current_logo_url: body.logo_url || null,
                  valve_team_id: body.valve_team_id || null,
                  current_captain_person_id: captainPersonId,
                  created_by_person_id: captainPersonId,
                  status: 'active',
                  name_history: [],
                  captain_history: [],
                })
                .select('id')
                .maybeSingle();
              if (newMt) masterTeamId = newMt.id;
            }
            // If at limit, just skip master team creation -- tournament team still gets created
          }
        } catch (mtErr) {
          console.error('Non-critical: auto-create master team failed:', mtErr);
        }
      }

      // Create the tournament team (coach_person_id set via dual-write helper below)
      // Pre-approved master teams (Add Existing flow) skip the approval queue
      const isExistingTeam = !!masterTeamId && !!body.master_team_id;
      const { data: team, error: insertError } = await supabase
        .from('kkup_teams')
        .insert({
          tournament_id: tournamentId,
          team_name: teamName,
          team_tag: teamTag,
          captain_person_id: captainPersonId,
          coach_person_id: coachPersonId, // legacy column — also written by setCoachAssignment below
          valve_team_id: body.valve_team_id || null,
          logo_url: body.logo_url || null,
          approval_status: isExistingTeam ? 'approved' : 'pending_approval',
          master_team_id: masterTeamId,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Create team error:', insertError);
        return c.json({ error: `Failed to create team: ${insertError.message}` }, 500);
      }

      // Dual-write coach assignment to kkup_coach_assignments (non-critical — legacy column is already set above)
      if (coachPersonId) {
        try {
          await setCoachAssignment(supabase, team.id, coachPersonId, tournamentId);
        } catch (coachErr) {
          console.error('Non-critical: coach assignment dual-write on team create failed:', coachErr);
        }
      }

      // Auto-add captain to roster if they chose playing_captain
      const roleLabel = creatorRole === 'coaching_captain' ? 'coaching captain' : creatorRole === 'captain_only' ? 'team organizer' : 'playing captain';
      if (creatorRole === 'playing_captain') {
        try {
          // Add to roster
          await supabase.from('kkup_team_rosters').insert({ team_id: team.id, person_id: captainPersonId });

          // If they have a registration, update it to 'on_team'
          await supabase
            .from('kkup_registrations')
            .update({ status: 'on_team' })
            .eq('tournament_id', tournamentId)
            .eq('person_id', captainPersonId)
            .in('status', ['registered', 'free_agent']);

          // Auto-decline any pending invites for this person in this tournament
          const { data: otherTeams } = await supabase
            .from('kkup_teams').select('id').eq('tournament_id', tournamentId);
          const allTeamIds = (otherTeams || []).map((t: any) => t.id);
          if (allTeamIds.length > 0) {
            await supabase
              .from('kkup_team_invites')
              .update({ status: 'declined', updated_at: new Date().toISOString() })
              .eq('person_id', captainPersonId)
              .eq('status', 'pending')
              .in('team_id', allTeamIds);
          }

          console.log(`Auto-added captain ${captainPersonId} to roster of "${team.team_name}" (playing captain)`);
        } catch (rosterErr) {
          console.error('Non-critical: auto-add captain to roster failed:', rosterErr);
        }
      }

      const statusMsg = isExistingTeam ? 'approved (existing team)' : 'pending approval';
      console.log(`Team created: "${team.team_name}" (${team.id}) in tournament ${tournament.name}, status: ${statusMsg}, role: ${roleLabel}`);

      // Log activity for team creation
      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'team_created',
          title: `Created Team ${team.team_name}`,
          description: `You created team "${team.team_name}" for ${tournament.name} as ${roleLabel}. Status: ${statusMsg}.`,
          related_id: team.id,
          related_url: `#tournament-hub/${tournamentId}`,
        });
      } catch (actErr) { console.error('Non-critical: activity log for team creation failed:', actErr); }

      // Discord webhook: team created
      // Existing teams are pre-approved → green "Team Approved!" immediately
      // New teams are pending review → amber "Team Submitted" (approval webhook fires later)
      try {
        const { embed } = buildKkupActivityEmbed({
          type: 'team_created',
          tournamentName: tournament.name,
          tournamentId,
          playerName: auth.dbUser.discord_username || 'Unknown',
          playerDiscordId: auth.dbUser.discord_id,
          playerAvatar: auth.dbUser.discord_avatar,
          teamName: team.team_name,
          teamLogoUrl: team.logo_url,
          extraDetail: `Role: ${roleLabel}${team.team_tag ? ` | Tag: [${team.team_tag}]` : ''}`,
        });
        if (isExistingTeam) {
          embed.title = '✅ Team Approved!';
          embed.color = 0x10B981;
        } else {
          embed.title = '📋 New Team Submitted';
          embed.color = 0xF59E0B; // amber — awaiting officer review
        }
        await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
      } catch (whErr) { console.error('Non-critical: team creation webhook failed:', whErr); }

      return c.json({
        success: true,
        team,
        creator_role: creatorRole,
        message: `Team "${team.team_name}" created! You're the ${roleLabel}. Status: ${statusMsg}.`,
      });
    } catch (error: any) {
      console.error('Create team error:', error);
      return c.json({ error: 'Internal server error creating team: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 2. LIST TOURNAMENT TEAMS (Public)
  // ===============================================

  app.get(`${PREFIX}/kkup/tournaments/:tid/teams`, async (c) => {
    try {
      const tournamentId = c.req.param('tid');

      // Optional filter
      const approvalFilter = c.req.query('approval_status'); // 'pending_approval', 'approved', 'denied'

      let query = supabase
        .from('kkup_teams')
        .select(`
          id, tournament_id, team_name, team_tag, valve_team_id, logo_url, captain_person_id, coach_person_id, approval_status, coach_tickets_contributed, created_at,
          captain:kkup_persons!captain_person_id(id, steam_id, display_name, avatar_url),
          coach:kkup_persons!coach_person_id(id, steam_id, display_name, avatar_url)
        `)
        .eq('tournament_id', tournamentId)
        .neq('approval_status', 'withdrawn')  // Hide soft-deleted teams from active listings
        .order('created_at', { ascending: true });

      if (approvalFilter) {
        query = query.eq('approval_status', approvalFilter);
      }

      const { data: teams, error } = await query;
      if (error) {
        console.error('List teams error:', error);
        return c.json({ error: `Failed to fetch teams: ${error.message}` }, 500);
      }

      // Enrich with roster count + historical flag for each team
      const enrichedTeams = await Promise.all(
        (teams || []).map(async (team: any) => {
          const { count: rosterCount } = await supabase
            .from('kkup_team_rosters')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id);

          // Check if this team_name + team_tag exists in OTHER tournaments
          // If so, it's historical and cannot be hard-deleted
          const { count: otherCount } = await supabase
            .from('kkup_teams')
            .select('*', { count: 'exact', head: true })
            .eq('team_name', team.team_name)
            .eq('team_tag', team.team_tag)
            .neq('id', team.id);

          return {
            ...team,
            roster_count: rosterCount || 0,
            is_historical: (otherCount || 0) > 0,
          };
        })
      );

      return c.json({ teams: enrichedTeams });
    } catch (error: any) {
      console.error('List teams error:', error);
      return c.json({ error: 'Internal server error listing teams: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 3. APPROVE / DENY TEAM (Officers + Owner)
  // ===============================================

  app.patch(`${PREFIX}/kkup/tournaments/:tid/teams/:team_id/approval`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;
      if (!isOfficer(auth.dbUser.role)) {
        return c.json({ error: 'Only officers and the owner can approve or deny teams' }, 403);
      }

      const teamId = c.req.param('team_id');
      const { approval_status } = await c.req.json();

      if (!approval_status || !['approved', 'denied'].includes(approval_status)) {
        return c.json({ error: 'approval_status must be "approved" or "denied"' }, 400);
      }

      const { data: team, error: fetchError } = await supabase
        .from('kkup_teams').select('id, team_name, team_tag, logo_url, captain_person_id, approval_status').eq('id', teamId).single();
      if (fetchError || !team) return c.json({ error: 'Team not found' }, 404);

      if (team.approval_status === approval_status) {
        return c.json({ error: `Team is already "${approval_status}"` }, 400);
      }

      const { data: updated, error: updateError } = await supabase
        .from('kkup_teams')
        .update({ approval_status })
        .eq('id', teamId)
        .select()
        .single();

      if (updateError) {
        console.error('Approve/deny team error:', updateError);
        return c.json({ error: `Failed to update approval: ${updateError.message}` }, 500);
      }

      // If denied, remove all roster entries, clear coach, and revert registrations to 'free_agent'
      if (approval_status === 'denied') {
        // Clear coach assignment (dual-write)
        try { await clearCoachAssignment(supabase, teamId); }
        catch (coachErr) { console.error('Non-critical: coach assignment clear on team denial failed:', coachErr); }

        // Get current roster to revert their registrations
        const { data: rosterEntries } = await supabase
          .from('kkup_team_rosters').select('person_id').eq('team_id', teamId);

        if (rosterEntries && rosterEntries.length > 0) {
          const personIds = rosterEntries.map((r: any) => r.person_id);

          // Delete roster entries
          await supabase.from('kkup_team_rosters').delete().eq('team_id', teamId);

          // Revert registrations to 'free_agent' (back to free agent pool)
          const tournamentId = c.req.param('tid');
          await supabase
            .from('kkup_registrations')
            .update({ status: 'free_agent' })
            .eq('tournament_id', tournamentId)
            .in('person_id', personIds)
            .eq('status', 'on_team');
        }

        // Cancel all pending invites
        await supabase
          .from('kkup_team_invites')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('team_id', teamId)
          .eq('status', 'pending');
      }

      console.log(`Team ${approval_status}: "${team.team_name}" (${teamId})`);

      // Notify the team captain and log admin action (non-critical)
      try {
        // Look up captain's user account
        const { data: teamFull } = await supabase
          .from('kkup_teams').select('captain_person_id').eq('id', teamId).single();
        if (teamFull?.captain_person_id) {
          const { data: captainPerson } = await supabase
            .from('kkup_persons').select('steam_id').eq('id', teamFull.captain_person_id).single();
          if (captainPerson?.steam_id) {
            const { data: captainUser } = await supabase
              .from('users').select('id').eq('steam_id', captainPerson.steam_id).maybeSingle();
            if (captainUser?.id) {
              const tournamentId = c.req.param('tid');
              await createNotification({
                user_id: captainUser.id,
                type: approval_status === 'approved' ? 'team_approved' : 'team_denied',
                title: `Team ${approval_status === 'approved' ? 'Approved' : 'Denied'}: ${team.team_name}`,
                body: approval_status === 'approved'
                  ? `Your team "${team.team_name}" has been approved! You're in.`
                  : `Your team "${team.team_name}" has been denied. Contact an officer for details.`,
                related_id: teamId,
                action_url: `#tournament-hub/${tournamentId}`,
                actor_name: auth.dbUser.discord_username,
              });
            }
          }
        }
        await createAdminLog({
          type: `team_${approval_status}`,
          action: `${approval_status === 'approved' ? 'Approved' : 'Denied'} team "${team.team_name}"`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: { team_id: teamId, team_name: team.team_name },
        });
        // Dual-log: captain sees it in their Activity tab too
        if (teamFull?.captain_person_id) {
          const { data: captainPersonForActivity } = await supabase
            .from('kkup_persons').select('steam_id').eq('id', teamFull.captain_person_id).single();
          if (captainPersonForActivity?.steam_id) {
            const { data: captainUserForActivity } = await supabase
              .from('users').select('id').eq('steam_id', captainPersonForActivity.steam_id).maybeSingle();
            if (captainUserForActivity?.id) {
              const tournamentId2 = c.req.param('tid');
              await createUserActivity({
                user_id: captainUserForActivity.id,
                type: approval_status === 'approved' ? 'admin_team_approved' : 'admin_team_denied',
                title: `Team ${approval_status === 'approved' ? 'Approved' : 'Denied'}: ${team.team_name}`,
                description: approval_status === 'approved'
                  ? `Your team "${team.team_name}" was approved by ${auth.dbUser.discord_username}.`
                  : `Your team "${team.team_name}" was denied by ${auth.dbUser.discord_username}. Contact an officer for details.`,
                related_id: teamId,
                related_url: `#tournament-hub/${tournamentId2}`,
                actor_name: auth.dbUser.discord_username,
              });
            }
          }
        }
      } catch (_) { /* non-critical */ }

      // Discord webhook: team approved/denied (non-critical)
      try {
        const whTournamentId = c.req.param('tid');
        const { data: tInfo } = await supabase
          .from('kkup_tournaments').select('name').eq('id', whTournamentId).maybeSingle();
        if (approval_status === 'approved') {
          const { embed } = buildKkupActivityEmbed({
            type: 'team_created',
            tournamentName: tInfo?.name || whTournamentId,
            tournamentId: whTournamentId,
            playerName: auth.dbUser.discord_username || 'Officer',
            playerAvatar: auth.dbUser.discord_avatar,
            teamName: team.team_name,
            teamLogoUrl: team.logo_url,
            extraDetail: `✅ Team approved by ${auth.dbUser.discord_username}${team.team_tag ? ` | Tag: [${team.team_tag}]` : ''}`,
          });
          embed.title = '✅ Team Approved!';
          embed.color = 0x10B981;
          await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
        } else {
          const { embed } = buildKkupActivityEmbed({
            type: 'team_withdrawn',
            tournamentName: tInfo?.name || whTournamentId,
            tournamentId: whTournamentId,
            playerName: auth.dbUser.discord_username || 'Officer',
            playerAvatar: auth.dbUser.discord_avatar,
            teamName: team.team_name,
            teamLogoUrl: team.logo_url,
            actorName: auth.dbUser.discord_username,
            extraDetail: `❌ Team denied by ${auth.dbUser.discord_username}`,
          });
          embed.title = '❌ Team Denied';
          embed.color = 0xEF4444;
          await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
        }
      } catch (whErr) { console.error('Non-critical: team approval/denial webhook failed:', whErr); }

      return c.json({
        success: true,
        team: updated,
        message: `Team "${team.team_name}" has been ${approval_status}.`,
      });
    } catch (error: any) {
      console.error('Approve/deny team error:', error);
      return c.json({ error: 'Internal server error during team approval: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 3b. DELETE TEAM (Captain, officer, or owner -- disbands team, returns players to free agent pool)
  // ===============================================

  app.delete(`${PREFIX}/kkup/tournaments/:tid/teams/:team_id`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('tid');
      const teamId = c.req.param('team_id');

      // Withdraw = hard-delete this tournament's kkup_teams row.
      // The master team (kkup_master_teams) and entries in other tournaments are unaffected.

      // Only captain, officer, or owner can withdraw
      const { authorized, team } = await isOwnerOrCaptain(auth.dbUser, teamId);
      if (!authorized && !isOfficer(auth.dbUser.role)) {
        return c.json({ error: 'Only the team captain, officers, or owner can withdraw a team' }, 403);
      }

      if (!team) return c.json({ error: 'Team not found' }, 404);

      // Verify team belongs to this tournament
      if (String(team.tournament_id) !== String(tournamentId)) {
        return c.json({ error: 'Team does not belong to this tournament' }, 400);
      }

      const teamName = team.team_name;

      // 1. Get roster members before cleaning up
      const { data: rosterEntries } = await supabase
        .from('kkup_team_rosters').select('person_id').eq('team_id', teamId);
      const rosterPersonIds = (rosterEntries || []).map((r: any) => r.person_id);

      // 2. Delete roster entries for this team
      await supabase.from('kkup_team_rosters').delete().eq('team_id', teamId);

      // 3. Cancel pending invites + clean up their inbox notifications
      //    We must fetch invites BEFORE deleting them so we can find the related notifications.
      const { data: pendingInvites } = await supabase
        .from('kkup_team_invites')
        .select('id, person_id')
        .eq('team_id', teamId);

      // Delete all invite rows
      await supabase.from('kkup_team_invites').delete().eq('team_id', teamId);

      // Clean up inbox notifications for each invited person (non-critical)
      if (pendingInvites && pendingInvites.length > 0) {
        try {
          const inviteIds = new Set(pendingInvites.map((inv: any) => inv.id));
          const personIds = [...new Set(pendingInvites.map((inv: any) => inv.person_id))];

          // Resolve person_id → user_id via steam_id
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

            // For each unique user_id, scan their notifications and delete invite-related ones
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
              console.log(`Withdraw cleanup: deleted ${keysToDelete.length} invite notification(s) from inbox`);
            }
          }
        } catch (notifErr) {
          console.error('Non-critical: invite notification cleanup during withdraw failed:', notifErr);
        }
      }

      // 4. Revert roster members' registrations to 'free_agent' (free agent pool)
      if (rosterPersonIds.length > 0) {
        await supabase
          .from('kkup_registrations')
          .update({ status: 'free_agent' })
          .eq('tournament_id', tournamentId)
          .in('person_id', rosterPersonIds);
      }

      // 5. Also revert captain's registration if they had status 'on_team'
      if (team.captain_person_id) {
        await supabase
          .from('kkup_registrations')
          .update({ status: 'free_agent' })
          .eq('tournament_id', tournamentId)
          .eq('person_id', team.captain_person_id)
          .eq('status', 'on_team');
      }

      // 6. Clear coach assignment (dual-write: kkup_coach_assignments + legacy column)
      //    Also revert coach's registration to 'free_agent' so they return to the pool.
      if (team.coach_person_id) {
        try { await clearCoachAssignment(supabase, teamId); }
        catch (coachErr) { console.error('Non-critical: coach assignment clear on team withdraw failed:', coachErr); }

        // Revert coach registration status
        try {
          await supabase
            .from('kkup_registrations')
            .update({ status: 'free_agent' })
            .eq('tournament_id', tournamentId)
            .eq('person_id', team.coach_person_id)
            .eq('status', 'on_team');
        } catch (coachRegErr) {
          console.error('Non-critical: coach registration revert on team withdraw failed:', coachRegErr);
        }
      }

      // 7. Delete this tournament's kkup_teams row
      // Each kkup_teams row is per-tournament — deleting it only removes the team from THIS
      // tournament. The master team identity (kkup_master_teams) and entries in other
      // tournaments are completely unaffected. No soft-delete needed — a withdrawn team
      // that only registered has no match history or stats to preserve.
      const { error: deleteError } = await supabase
        .from('kkup_teams').delete().eq('id', teamId);
      if (deleteError) {
        console.error('Withdraw (delete) team error:', deleteError);
        return c.json({ error: `Failed to withdraw team: ${deleteError.message}` }, 500);
      }
      console.log(`Team WITHDRAWN (deleted): "${teamName}" (${teamId}) from tournament ${tournamentId} by ${auth.dbUser.discord_username}`);

      // Fetch tournament name for logging & webhooks
      const { data: tournamentInfo } = await supabase
        .from('kkup_tournaments').select('name').eq('id', tournamentId).maybeSingle();
      const tourneyName = tournamentInfo?.name || tournamentId;

      // Log admin action (non-critical)
      try {
        await createAdminLog({
          type: 'team_withdrawn',
          action: `Withdrew team "${teamName}" from ${tourneyName}`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: { team_id: teamId, team_name: teamName, tournament_id: tournamentId, tournament_name: tourneyName, roster_count: rosterPersonIds.length },
        });
      } catch (logErr) { console.error('Non-critical: admin log for team withdraw failed:', logErr); }

      // Log activity for the team captain (non-critical)
      try {
        if (team.captain_person_id) {
          const { data: captainPerson } = await supabase
            .from('kkup_persons').select('steam_id, display_name').eq('id', team.captain_person_id).maybeSingle();
          if (captainPerson?.steam_id) {
            const { data: captainUser } = await supabase
              .from('users').select('id').eq('steam_id', captainPerson.steam_id).maybeSingle();
            if (captainUser?.id) {
              await createUserActivity({
                user_id: captainUser.id,
                type: 'team_dismissed',
                title: `Team "${teamName}" Withdrawn`,
                description: `Your team "${teamName}" was withdrawn from this tournament by ${auth.dbUser.discord_username || 'an officer'}.`,
                related_id: tournamentId,
                related_url: `#tournament-hub/${tournamentId}`,
                actor_name: auth.dbUser.discord_username,
              });
            }
          }
        }
      } catch (actErr) { console.error('Non-critical: activity log for team withdraw failed:', actErr); }

      // Discord webhook: team withdrawn
      try {
        const { embed } = buildKkupActivityEmbed({
          type: 'team_withdrawn',
          tournamentName: tourneyName || tournamentId,
          tournamentId,
          playerName: auth.dbUser.discord_username || 'Unknown',
          playerDiscordId: auth.dbUser.discord_id,
          playerAvatar: auth.dbUser.discord_avatar,
          teamName: teamName,
          teamLogoUrl: team.logo_url,
          actorName: auth.dbUser.discord_username,
          extraDetail: `${rosterPersonIds.length} player(s) returned to free agent pool`,
        });
        await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
      } catch (whErr) { console.error('Non-critical: team withdrawal webhook failed:', whErr); }

      return c.json({
        success: true,
        message: `Team "${teamName}" has been withdrawn from this tournament. ${rosterPersonIds.length} player(s) returned to the free agent pool.${pendingInvites && pendingInvites.length > 0 ? ` ${pendingInvites.length} pending invite(s) cancelled.` : ''}`,
      });
    } catch (error: any) {
      console.error('Withdraw team error:', error);
      return c.json({ error: 'Internal server error during team withdrawal: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 4. UPDATE TEAM DETAILS (Captain or owner)
  // ===============================================

  app.patch(`${PREFIX}/kkup/tournaments/:tid/teams/:team_id`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const teamId = c.req.param('team_id');
      const { authorized, team } = await isOwnerOrCaptain(auth.dbUser, teamId);
      if (!authorized) return c.json({ error: 'Only the team captain or owner can update team details' }, 403);
      if (!team) return c.json({ error: 'Team not found' }, 404);

      const body = await c.req.json();
      const updateData: any = {};

      // Allowed fields for captain/owner to update
      if (body.team_name !== undefined) updateData.team_name = body.team_name.trim();
      if (body.team_tag !== undefined) updateData.team_tag = body.team_tag.trim();
      if (body.valve_team_id !== undefined) updateData.valve_team_id = body.valve_team_id || null;
      if (body.logo_url !== undefined) updateData.logo_url = body.logo_url || null;

      // Coach assignment -- must be a registered person (or null to unset)
      // Handled via dual-write helper AFTER the main update (see below)
      let coachChange: 'set' | 'clear' | null = null;
      let newCoachPersonId: string | null = null;
      if (body.coach_person_id !== undefined) {
        if (body.coach_person_id === null) {
          updateData.coach_person_id = null; // legacy column in the main UPDATE
          coachChange = 'clear';
        } else {
          // Verify person exists
          const { data: coachPerson } = await supabase
            .from('kkup_persons').select('id, display_name').eq('id', body.coach_person_id).single();
          if (!coachPerson) return c.json({ error: 'Coach person not found' }, 404);
          updateData.coach_person_id = body.coach_person_id; // legacy column in the main UPDATE
          coachChange = 'set';
          newCoachPersonId = body.coach_person_id;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
      }

      const { data: updated, error: updateError } = await supabase
        .from('kkup_teams').update(updateData).eq('id', teamId).select().single();
      if (updateError) {
        console.error('Update team error:', updateError);
        return c.json({ error: `Failed to update team: ${updateError.message}` }, 500);
      }

      // Dual-write coach assignment to kkup_coach_assignments (non-critical)
      if (coachChange === 'set' && newCoachPersonId) {
        try { await setCoachAssignment(supabase, teamId, newCoachPersonId, team.tournament_id); }
        catch (coachErr) { console.error('Non-critical: coach assignment dual-write on team update failed:', coachErr); }
      } else if (coachChange === 'clear') {
        try { await clearCoachAssignment(supabase, teamId); }
        catch (coachErr) { console.error('Non-critical: coach assignment clear on team update failed:', coachErr); }
      }

      console.log(`Team updated: "${updated.team_name}" (${teamId})`);

      // Log activity for the person who made the update (non-critical)
      try {
        const changedFields = Object.keys(updateData).join(', ');
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'team_created',
          title: `Updated ${updated.team_name}`,
          description: `You updated team "${updated.team_name}" (changed: ${changedFields}).`,
          related_id: teamId,
          related_url: `#tournament-hub/${c.req.param('tid')}`,
        });
      } catch (actErr) { console.error('Non-critical: activity log for team update failed:', actErr); }

      return c.json({ success: true, team: updated });
    } catch (error: any) {
      console.error('Update team error:', error);
      return c.json({ error: 'Internal server error updating team: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 5. SEND INVITE (Captain or owner)
  // ===============================================

  app.post(`${PREFIX}/kkup/tournaments/:tid/teams/:team_id/invites`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('tid');
      const teamId = c.req.param('team_id');

      // Tournament must be mutable
      const tCheck = await getTournamentIfMutable(tournamentId);
      if (!tCheck.ok) return c.json({ error: tCheck.error }, 400);
      const tournament = tCheck.tournament;

      // Must be captain or owner
      const { authorized, team, person: callerPerson } = await isOwnerOrCaptain(auth.dbUser, teamId);
      if (!authorized) return c.json({ error: 'Only the team captain or owner can send invites' }, 403);
      if (!team) return c.json({ error: 'Team not found' }, 404);

      // Team must be approved
      if (team.approval_status !== 'approved') {
        return c.json({ error: `Team "${team.team_name}" is ${team.approval_status}. Only approved teams can send invites.` }, 400);
      }

      const body = await c.req.json();
      const { person_id, invite_role } = body;
      if (!person_id) return c.json({ error: 'person_id is required' }, 400);

      const isCoachInvite = invite_role === 'coach';

      // Verify the person exists
      const { data: invitee } = await supabase
        .from('kkup_persons').select('id, display_name, steam_id').eq('id', person_id).single();
      if (!invitee) return c.json({ error: 'Person not found' }, 404);

      // Verify invitee is registered for this tournament
      const { data: reg } = await supabase
        .from('kkup_registrations')
        .select('id, status, role')
        .eq('tournament_id', tournamentId)
        .eq('person_id', person_id)
        .maybeSingle();

      if (!reg || reg.status === 'withdrawn') {
        return c.json({ error: `${invitee.display_name} is not registered for this tournament.` }, 400);
      }

      if (isCoachInvite) {
        // Coach invite: invitee must be registered as coach
        if (reg.role !== 'coach') {
          return c.json({ error: `${invitee.display_name} is not registered as a coach.` }, 400);
        }
        // Team must not already have a coach
        if (team.coach_person_id) {
          return c.json({ error: `This team already has a coach assigned.` }, 400);
        }
      } else {
        // Player invite: must be a free agent
        if (reg.status === 'on_team') {
          return c.json({ error: `${invitee.display_name} is already on a team.` }, 400);
        }
        // Check roster size limit
        if (tournament.max_team_size) {
          const { count: rosterCount } = await supabase
            .from('kkup_team_rosters')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', teamId);

          if ((rosterCount || 0) >= tournament.max_team_size) {
            return c.json({ error: `Team roster is full (${tournament.max_team_size} players max).` }, 400);
          }
        }
      }

      // Check for existing invite for this team+person
      const { data: existingInvite } = await supabase
        .from('kkup_team_invites')
        .select('id, status')
        .eq('team_id', teamId)
        .eq('person_id', person_id)
        .maybeSingle();

      if (existingInvite) {
        if (existingInvite.status === 'pending') {
          return c.json({ error: `${invitee.display_name} already has a pending invite for this team.` }, 409);
        }
        // Old invite exists with terminal status (declined, cancelled, expired) —
        // delete it so we can create a fresh one (unique constraint on team_id+person_id)
        await supabase.from('kkup_team_invites').delete().eq('id', existingInvite.id);
      }

      // Create the invite
      const invitedByPersonId = callerPerson?.id || team.captain_person_id;
      const { data: invite, error: insertError } = await supabase
        .from('kkup_team_invites')
        .insert({
          team_id: teamId,
          person_id: person_id,
          invited_by_person_id: invitedByPersonId,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Create invite error:', insertError);
        return c.json({ error: `Failed to send invite: ${insertError.message}` }, 500);
      }

      console.log(`Invite sent: ${invitee.display_name} -> team "${team.team_name}"`);

      // Log activity for the captain/sender
      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: isCoachInvite ? 'coach_invite_sent' : 'team_invite_sent',
          title: `Invited ${invitee.display_name} to ${team.team_name}${isCoachInvite ? ' as Coach' : ''}`,
          description: `You sent a ${isCoachInvite ? 'coaching' : 'team'} invite to ${invitee.display_name} for "${team.team_name}" in ${tournament.name}.`,
          related_id: invite.id,
          related_url: `#tournament-hub/${tournamentId}`,
        });
      } catch (actErr) { console.error('Non-critical: activity log for invite sent failed:', actErr); }

      // Create notification for the invited player/coach (if they have a linked user account)
      try {
        let targetUserId: string | null = null;

        if (invitee.steam_id) {
          const { data: linkedUser } = await supabase
            .from('users')
            .select('id')
            .eq('steam_id', invitee.steam_id)
            .maybeSingle();
          targetUserId = linkedUser?.id || null;
        }

        if (targetUserId) {
          await createNotification({
            user_id: targetUserId,
            type: isCoachInvite ? 'coach_invite' : 'team_invite',
            title: isCoachInvite ? `Coaching Invite: ${team.team_name}` : `Team Invite: ${team.team_name}`,
            body: isCoachInvite
              ? `You've been invited to coach "${team.team_name}" for ${tournament.name}.`
              : `You've been invited to join "${team.team_name}" for ${tournament.name}.`,
            related_id: invite.id,
            action_url: `#tournament-hub/${tournamentId}`,
            actor_name: auth.dbUser.discord_username,
            actor_avatar: auth.dbUser.discord_avatar,
            metadata: { tournament_id: tournamentId, invite_id: invite.id, team_name: team.team_name },
          });
        }
      } catch (notifErr) {
        // Notification creation is non-critical -- log and continue
        console.warn('Failed to create invite notification (non-critical):', notifErr);
      }

      return c.json({
        success: true,
        invite,
        message: `Invite sent to ${invitee.display_name} for team "${team.team_name}".`,
      });
    } catch (error: any) {
      console.error('Send invite error:', error);
      return c.json({ error: 'Internal server error sending invite: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 6. LIST TEAM INVITES (Captain or owner)
  // ===============================================

  app.get(`${PREFIX}/kkup/tournaments/:tid/teams/:team_id/invites`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const teamId = c.req.param('team_id');
      const { authorized } = await isOwnerOrCaptain(auth.dbUser, teamId);
      if (!authorized) return c.json({ error: 'Only the team captain or owner can view team invites' }, 403);

      const statusFilter = c.req.query('status'); // 'pending', 'accepted', 'declined', 'expired'

      let query = supabase
        .from('kkup_team_invites')
        .select(`
          id, team_id, status, created_at, updated_at,
          person:kkup_persons!person_id(id, steam_id, display_name, avatar_url)
        `)
        .eq('team_id', teamId);
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data: invites, error } = await query;
      if (error) {
        console.error('List team invites error:', error);
        return c.json({ error: `Failed to fetch team invites: ${error.message}` }, 500);
      }

      return c.json({ invites: invites || [] });
    } catch (error: any) {
      console.error('List team invites error:', error);
      return c.json({ error: 'Internal server error listing invites: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 6b. CANCEL INVITE (Captain or owner -- silently cancels, no notification to invitee)
  // ===============================================

  app.delete(`${PREFIX}/kkup/tournaments/:tid/teams/:team_id/invites/:invite_id`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const teamId = c.req.param('team_id');
      const inviteId = c.req.param('invite_id');

      // Only captain or owner can cancel invites
      const { authorized } = await isOwnerOrCaptain(auth.dbUser, teamId);
      if (!authorized && !isOfficer(auth.dbUser.role)) {
        return c.json({ error: 'Only the team captain, officers, or owner can cancel invites' }, 403);
      }

      // Verify the invite belongs to this team and is still pending
      const { data: invite, error: fetchErr } = await supabase
        .from('kkup_team_invites')
        .select('id, team_id, person_id, status')
        .eq('id', inviteId)
        .eq('team_id', teamId)
        .maybeSingle();

      if (fetchErr || !invite) {
        return c.json({ error: 'Invite not found or does not belong to this team' }, 404);
      }

      if (invite.status !== 'pending') {
        return c.json({ error: `Cannot cancel invite -- status is already "${invite.status}"` }, 400);
      }

      // Hard-delete the invite (silent -- no notification to the invitee)
      const { error: delErr } = await supabase
        .from('kkup_team_invites')
        .delete()
        .eq('id', inviteId);

      if (delErr) {
        console.error('Cancel invite error:', delErr);
        return c.json({ error: `Failed to cancel invite: ${delErr.message}` }, 500);
      }

      console.log(`Invite ${inviteId} cancelled by ${auth.dbUser.discord_username} for team ${teamId}`);

      // Clean up the invitee's inbox notification for this invite (non-critical)
      try {
        const { data: invPerson } = await supabase
          .from('kkup_persons').select('steam_id').eq('id', invite.person_id).maybeSingle();
        if (invPerson?.steam_id) {
          const { data: invUser } = await supabase
            .from('users').select('id').eq('steam_id', invPerson.steam_id).maybeSingle();
          if (invUser?.id) {
            const allNotifs = await kv.getByPrefix(`notification:${invUser.id}:`);
            const keysToDelete = allNotifs
              .filter((n: any) =>
                (n.type === 'team_invite' || n.type === 'coach_invite') &&
                n.related_id === inviteId
              )
              .map((n: any) => n.key);
            if (keysToDelete.length > 0) {
              await kv.mdel(keysToDelete);
              console.log(`Cancel invite cleanup: deleted ${keysToDelete.length} notification(s) for invite ${inviteId}`);
            }
          }
        }
      } catch (notifErr) {
        console.error('Non-critical: notification cleanup for cancelled invite failed:', notifErr);
      }

      // Log activity for the captain (non-critical)
      try {
        const { data: invitedPerson } = await supabase
          .from('kkup_persons').select('display_name').eq('id', invite.person_id).maybeSingle();
        const { data: team } = await supabase
          .from('kkup_teams').select('team_name').eq('id', teamId).maybeSingle();
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'team_invite_cancelled',
          title: `Cancelled Invite`,
          description: `You cancelled the invite to ${invitedPerson?.display_name || 'a player'} for team ${team?.team_name || teamId}.`,
          related_id: teamId,
        });
      } catch (_) { /* non-critical */ }

      return c.json({ message: 'Invite cancelled successfully' });
    } catch (error: any) {
      console.error('Cancel invite error:', error);
      return c.json({ error: 'Internal server error cancelling invite: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 7. MY INVITES (Authenticated player)
  // ===============================================

  app.get(`${PREFIX}/kkup/tournaments/:tid/my-invites`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('tid');

      // Resolve person
      const personResult = await resolvePersonForUser(auth.dbUser);
      if ('error' in personResult) return c.json({ error: personResult.error }, 500);
      const { person } = personResult;

      // Get all teams in this tournament to filter invites
      const { data: tournamentTeams } = await supabase
        .from('kkup_teams').select('id').eq('tournament_id', tournamentId);
      const teamIds = (tournamentTeams || []).map((t: any) => t.id);

      if (teamIds.length === 0) {
        return c.json({ invites: [] });
      }

      const { data: invites, error } = await supabase
        .from('kkup_team_invites')
        .select(`
          id, team_id, status, created_at, updated_at,
          team:kkup_teams!team_id(id, team_name, team_tag, captain_person_id),
          invited_by:kkup_persons!invited_by_person_id(id, display_name)
        `)
        .eq('person_id', person.id)
        .eq('status', 'pending')
        .in('team_id', teamIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('My invites error:', error);
        return c.json({ error: `Failed to fetch your invites: ${error.message}` }, 500);
      }

      return c.json({ invites: invites || [], person_id: person.id });
    } catch (error: any) {
      console.error('My invites error:', error);
      return c.json({ error: 'Internal server error fetching invites: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 8. RESPOND TO INVITE (The invited player)
  // ===============================================

  app.patch(`${PREFIX}/kkup/tournaments/:tid/invites/:invite_id`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('tid');
      const inviteId = c.req.param('invite_id');
      const { status: responseStatus } = await c.req.json();

      if (!responseStatus || !['accepted', 'declined'].includes(responseStatus)) {
        return c.json({ error: 'status must be "accepted" or "declined"' }, 400);
      }

      // Resolve caller's person
      const personResult = await resolvePersonForUser(auth.dbUser);
      if ('error' in personResult) return c.json({ error: personResult.error }, 500);
      const { person } = personResult;

      // Fetch the invite
      const { data: invite, error: fetchError } = await supabase
        .from('kkup_team_invites')
        .select('id, team_id, person_id, status')
        .eq('id', inviteId)
        .single();

      if (fetchError || !invite) return c.json({ error: 'Invite not found' }, 404);

      // Only the invited person can respond
      if (invite.person_id !== person.id) {
        return c.json({ error: 'You can only respond to your own invites' }, 403);
      }

      if (invite.status !== 'pending') {
        return c.json({ error: `Invite has already been ${invite.status}` }, 400);
      }

      // Tournament must still be mutable
      const tCheck = await getTournamentIfMutable(tournamentId);
      if (!tCheck.ok) return c.json({ error: tCheck.error }, 400);
      const tournament = tCheck.tournament;

      // Update invite status
      const { data: updatedInvite, error: updateError } = await supabase
        .from('kkup_team_invites')
        .update({ status: responseStatus, updated_at: new Date().toISOString() })
        .eq('id', inviteId)
        .select()
        .single();

      if (updateError) {
        console.error('Update invite error:', updateError);
        return c.json({ error: `Failed to update invite: ${updateError.message}` }, 500);
      }

      // If accepted -> add to roster (player) or assign as coach
      if (responseStatus === 'accepted') {
        // Look up the invitee's registration role to determine player vs coach
        const { data: inviteeReg } = await supabase
          .from('kkup_registrations')
          .select('role')
          .eq('tournament_id', tournamentId)
          .eq('person_id', person.id)
          .maybeSingle();

        const isCoachAccept = inviteeReg?.role === 'coach';

        // Fetch team info
        const { data: teamInfo } = await supabase
          .from('kkup_teams').select('team_name, coach_person_id, captain_person_id, logo_url').eq('id', invite.team_id).single();

        if (isCoachAccept) {
          // ── Coach accept: assign as team coach ──
          if (teamInfo?.coach_person_id) {
            await supabase.from('kkup_team_invites')
              .update({ status: 'pending', updated_at: new Date().toISOString() })
              .eq('id', inviteId);
            return c.json({ error: 'This team already has a coach. Invite reverted to pending.' }, 400);
          }

          // Assign coach via dual-write
          try {
            await setCoachAssignment(supabase, invite.team_id, person.id, tournamentId);
          } catch (coachErr) {
            console.error('Coach assignment on invite accept failed:', coachErr);
            return c.json({ error: `Failed to assign coach: ${(coachErr as any).message}` }, 500);
          }

          // Decline other pending coach invites for this person in this tournament
          const { data: otherTeams } = await supabase
            .from('kkup_teams').select('id').eq('tournament_id', tournamentId);
          const allTeamIds = (otherTeams || []).map((t: any) => t.id);
          if (allTeamIds.length > 0) {
            await supabase
              .from('kkup_team_invites')
              .update({ status: 'declined', updated_at: new Date().toISOString() })
              .eq('person_id', person.id)
              .eq('status', 'pending')
              .in('team_id', allTeamIds)
              .neq('id', inviteId);
          }

          console.log(`Coach invite accepted: ${person.display_name} coaching "${teamInfo?.team_name}"`);

          try {
            await createUserActivity({
              user_id: auth.dbUser.id,
              type: 'coach_invite_accepted',
              title: `Coaching ${teamInfo?.team_name || 'a team'}`,
              description: `You accepted a coaching invite for "${teamInfo?.team_name || 'a team'}" in ${tournament.name}.`,
              related_id: invite.team_id,
              related_url: `#tournament-hub/${tournamentId}`,
            });
          } catch (actErr) { console.error('Non-critical: activity log for coach invite accepted failed:', actErr); }

          // Discord webhook: coach joined team
          try {
            const { embed } = buildKkupActivityEmbed({
              type: 'coach_accepted',
              tournamentName: tournament.name,
              tournamentId,
              playerName: person.display_name,
              playerDiscordId: auth.dbUser.discord_id,
              playerAvatar: auth.dbUser.discord_avatar,
              teamName: teamInfo?.team_name,
              teamLogoUrl: teamInfo?.logo_url,
            });
            await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
          } catch (whErr) { console.error('Non-critical: coach invite accepted webhook failed:', whErr); }

          // Notify captain
          try {
            if (teamInfo?.captain_person_id) {
              const { data: captainPerson } = await supabase
                .from('kkup_persons').select('steam_id').eq('id', teamInfo.captain_person_id).single();
              if (captainPerson?.steam_id) {
                const { data: captainUser } = await supabase
                  .from('users').select('id').eq('steam_id', captainPerson.steam_id).maybeSingle();
                if (captainUser?.id && captainUser.id !== auth.dbUser.id) {
                  await createNotification({
                    user_id: captainUser.id,
                    type: 'coach_invite_accepted',
                    title: `${person.display_name} is coaching ${teamInfo.team_name}`,
                    body: `${person.display_name} accepted your coaching invite for "${teamInfo.team_name}" in ${tournament.name}.`,
                    related_id: invite.team_id,
                    action_url: `#tournament-hub/${tournamentId}`,
                    actor_name: auth.dbUser.discord_username,
                  });
                }
              }
            }
          } catch (_) { /* non-critical */ }

          return c.json({
            success: true,
            invite: updatedInvite,
            message: `You're now coaching ${teamInfo?.team_name || 'the team'}!`,
          });

        } else {
          // ── Player accept: add to roster ──
          // Rank eligibility check for Kernel Kup
          // Per-tournament min_rank/max_rank override global defaults when set
          if (tournament.tournament_type === 'kernel_kup') {
            if (!inviteeReg || inviteeReg.role === 'player') {
              const maxRank = tournament.max_rank ?? await getMaxPlayerRank();
              const minRank = tournament.min_rank ?? await getMinPlayerRank();
              const eligibility = checkKernelKupEligibility(auth.dbUser, null, maxRank, minRank);
              if (!eligibility.eligible && !eligibility.rankUnknown) {
                await supabase.from('kkup_team_invites')
                  .update({ status: 'pending', updated_at: new Date().toISOString() })
                  .eq('id', inviteId);
                return c.json({
                  error: eligibility.reason || 'Your rank is above the Kernel Kup player eligibility threshold. You can participate as a Coach instead.',
                  rank_ineligible: true,
                }, 403);
              }
            }
          }

          // Check roster size limit
          if (tournament.max_team_size) {
            const { count: rosterCount } = await supabase
              .from('kkup_team_rosters')
              .select('*', { count: 'exact', head: true })
              .eq('team_id', invite.team_id);

            if ((rosterCount || 0) >= tournament.max_team_size) {
              await supabase.from('kkup_team_invites')
                .update({ status: 'pending', updated_at: new Date().toISOString() })
                .eq('id', inviteId);
              return c.json({ error: 'Team roster is now full. Invite reverted to pending.' }, 400);
            }
          }

          // Add to kkup_team_rosters
          const { error: rosterError } = await supabase
            .from('kkup_team_rosters')
            .insert({ team_id: invite.team_id, person_id: person.id })
            .select()
            .single();

          if (rosterError) {
            if (rosterError.code === '23505') {
              console.warn(`Roster UNIQUE violation on invite accept: ${person.display_name} already on team ${invite.team_id}`);
              return c.json({ error: `You're already on this team's roster. The invite was accepted but no roster change was needed.` }, 409);
            }
            console.error('Roster insert on invite accept error:', rosterError);
            return c.json({ error: `Invite accepted but failed to add to roster: ${rosterError.message}` }, 500);
          }

          // Update registration status to 'on_team'
          await supabase
            .from('kkup_registrations')
            .update({ status: 'on_team' })
            .eq('tournament_id', tournamentId)
            .eq('person_id', person.id);

          // Decline all other pending invites for this person in this tournament
          const { data: otherTeams } = await supabase
            .from('kkup_teams').select('id').eq('tournament_id', tournamentId);
          const allTeamIds = (otherTeams || []).map((t: any) => t.id);

          if (allTeamIds.length > 0) {
            await supabase
              .from('kkup_team_invites')
              .update({ status: 'declined', updated_at: new Date().toISOString() })
              .eq('person_id', person.id)
              .eq('status', 'pending')
              .in('team_id', allTeamIds)
              .neq('id', inviteId);
          }

          console.log(`Invite accepted: ${person.display_name} joined "${teamInfo?.team_name}"`);

          try {
            await createUserActivity({
              user_id: auth.dbUser.id,
              type: 'team_invite_accepted',
              title: `Joined ${teamInfo?.team_name || 'a team'}`,
              description: `You accepted an invite and joined "${teamInfo?.team_name || 'a team'}" for ${tournament.name}.`,
              related_id: invite.team_id,
              related_url: `#tournament-hub/${tournamentId}`,
            });
          } catch (actErr) { console.error('Non-critical: activity log for invite accepted failed:', actErr); }

          // Discord webhook: player joined team
          try {
            const { embed } = buildKkupActivityEmbed({
              type: 'invite_accepted',
              tournamentName: tournament.name,
              tournamentId,
              playerName: person.display_name,
              playerDiscordId: auth.dbUser.discord_id,
              playerAvatar: auth.dbUser.discord_avatar,
              teamName: teamInfo?.team_name,
              teamLogoUrl: teamInfo?.logo_url,
            });
            await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
          } catch (whErr) { console.error('Non-critical: invite accepted webhook failed:', whErr); }

          // Notify the captain
          try {
            if (teamInfo?.captain_person_id) {
              const { data: captainPerson } = await supabase
                .from('kkup_persons').select('steam_id').eq('id', teamInfo.captain_person_id).single();
              if (captainPerson?.steam_id) {
                const { data: captainUser } = await supabase
                  .from('users').select('id').eq('steam_id', captainPerson.steam_id).maybeSingle();
                if (captainUser?.id && captainUser.id !== auth.dbUser.id) {
                  await createNotification({
                    user_id: captainUser.id,
                    type: 'team_invite',
                    title: `${person.display_name} joined ${teamInfo?.team_name || 'your team'}`,
                    body: `${person.display_name} accepted your invite and joined "${teamInfo?.team_name}" for ${tournament.name}.`,
                    related_id: invite.team_id,
                    action_url: `#tournament-hub/${tournamentId}`,
                    actor_name: auth.dbUser.discord_username,
                  });
                }
              }
            }
          } catch (_) { /* non-critical */ }

          return c.json({
            success: true,
            invite: updatedInvite,
            message: `You've joined ${teamInfo?.team_name || 'the team'}! Other pending invites have been auto-declined.`,
          });
        }
      }

      // Declined
      console.log(`Invite declined: ${person.display_name} declined invite ${inviteId}`);

      // Log activity for the player who declined
      try {
        const { data: declinedTeam } = await supabase
          .from('kkup_teams').select('team_name').eq('id', invite.team_id).single();
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'team_invite_declined',
          title: `Declined invite to ${declinedTeam?.team_name || 'a team'}`,
          description: `You declined a team invite for "${declinedTeam?.team_name || 'a team'}" in ${tournament.name}.`,
          related_id: invite.team_id,
          related_url: `#tournament-hub/${tournamentId}`,
        });
      } catch (actErr) { console.error('Non-critical: activity log for invite declined failed:', actErr); }

      // Notify the captain that their invite was declined (non-critical)
      try {
        const { data: declinedTeamInfo } = await supabase
          .from('kkup_teams').select('captain_person_id, team_name').eq('id', invite.team_id).single();
        if (declinedTeamInfo?.captain_person_id) {
          const { data: captainPerson } = await supabase
            .from('kkup_persons').select('steam_id').eq('id', declinedTeamInfo.captain_person_id).single();
          if (captainPerson?.steam_id) {
            const { data: captainUser } = await supabase
              .from('users').select('id').eq('steam_id', captainPerson.steam_id).maybeSingle();
            if (captainUser?.id && captainUser.id !== auth.dbUser.id) {
              await createNotification({
                user_id: captainUser.id,
                type: 'team_invite',
                title: `${person.display_name} declined invite`,
                body: `${person.display_name} declined your invite to join "${declinedTeamInfo.team_name}" for ${tournament.name}.`,
                related_id: invite.team_id,
                action_url: `#tournament-hub/${tournamentId}`,
                actor_name: auth.dbUser.discord_username,
              });
            }
          }
        }
      } catch (_) { /* non-critical */ }

      return c.json({
        success: true,
        invite: updatedInvite,
        message: 'Invite declined.',
      });
    } catch (error: any) {
      console.error('Respond to invite error:', error);
      return c.json({ error: 'Internal server error responding to invite: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 9. TEAM ROSTER (Public)
  // ===============================================

  app.get(`${PREFIX}/kkup/tournaments/:tid/teams/:team_id/roster`, async (c) => {
    try {
      const teamId = c.req.param('team_id');

      // Fetch team with captain + coach info
      const { data: team, error: teamError } = await supabase
        .from('kkup_teams')
        .select(`
          id, team_name, team_tag, valve_team_id, approval_status, captain_person_id, coach_person_id, coach_tickets_contributed,
          captain:kkup_persons!captain_person_id(id, steam_id, display_name, avatar_url),
          coach:kkup_persons!coach_person_id(id, steam_id, display_name, avatar_url)
        `)
        .eq('id', teamId)
        .single();

      if (teamError || !team) return c.json({ error: 'Team not found' }, 404);

      // Fetch roster entries with person data
      const { data: roster, error: rosterError } = await supabase
        .from('kkup_team_rosters')
        .select(`
          id, team_id, person_id, tickets_contributed,
          person:kkup_persons!person_id(id, steam_id, display_name, avatar_url)
        `)
        .eq('team_id', teamId);

      if (rosterError) {
        console.error('Fetch roster error:', rosterError);
        return c.json({ error: `Failed to fetch roster: ${rosterError.message}` }, 500);
      }

      // Enrich roster + coach with linked user rank data
      const enrichedRoster = roster || [];
      const allSteamIds = [
        ...enrichedRoster.map((r: any) => r.person?.steam_id),
        team.coach?.steam_id,
      ].filter(Boolean);

      let userMap: Record<string, any> = {};
      if (allSteamIds.length > 0) {
        const { data: linkedUsers } = await supabase
          .from('users')
          .select('id, steam_id, rank_id, opendota_data, discord_username, discord_avatar, tcf_plus_active, kkup_tickets')
          .in('steam_id', allSteamIds);
        for (const u of (linkedUsers || [])) {
          userMap[u.steam_id] = u;
        }
      }

      const rosterWithRanks = enrichedRoster.map((r: any) => ({
        ...r,
        linked_user: r.person?.steam_id ? (userMap[r.person.steam_id] || null) : null,
      }));

      const coachLinkedUser = team.coach?.steam_id ? (userMap[team.coach.steam_id] || null) : null;

      return c.json({
        team: { ...team, coach_linked_user: coachLinkedUser },
        roster: rosterWithRanks,
        roster_count: rosterWithRanks.length,
      });
    } catch (error: any) {
      console.error('Get roster error:', error);
      return c.json({ error: 'Internal server error fetching roster: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 10. DIRECT ADD TO ROSTER (Captain or owner -- skip invite)
  // ===============================================

  app.post(`${PREFIX}/kkup/tournaments/:tid/teams/:team_id/roster`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('tid');
      const teamId = c.req.param('team_id');

      // Tournament must be mutable
      const tCheck = await getTournamentIfMutable(tournamentId);
      if (!tCheck.ok) return c.json({ error: tCheck.error }, 400);
      const tournament = tCheck.tournament;

      // Must be captain or owner
      const { authorized, team, person: callerPerson } = await isOwnerOrCaptain(auth.dbUser, teamId);
      if (!authorized) return c.json({ error: 'Only the team captain or owner can add players directly' }, 403);
      if (!team) return c.json({ error: 'Team not found' }, 404);

      // Team must be approved
      if (team.approval_status !== 'approved') {
        return c.json({ error: `Team "${team.team_name}" is ${team.approval_status}. Only approved teams can modify roster.` }, 400);
      }

      const body = await c.req.json();
      // If no person_id provided, default to the caller (captain adding themselves)
      const personId = body.person_id || callerPerson?.id;
      if (!personId) return c.json({ error: 'person_id is required (or you must have a linked person profile)' }, 400);

      // Verify person exists
      const { data: targetPerson } = await supabase
        .from('kkup_persons').select('id, display_name').eq('id', personId).single();
      if (!targetPerson) return c.json({ error: 'Person not found' }, 404);

      // Check if person is registered for this tournament (unless it's the captain/owner adding themselves pre-registration)
      const { data: reg } = await supabase
        .from('kkup_registrations')
        .select('id, status, role')
        .eq('tournament_id', tournamentId)
        .eq('person_id', personId)
        .maybeSingle();

      // If adding someone other than the captain, they must be registered
      const isSelf = personId === callerPerson?.id;
      const isOwner = auth.dbUser.role === 'owner';
      if (!isOwner && !isSelf && (!reg || reg.status === 'withdrawn')) {
        return c.json({ error: `${targetPerson.display_name} is not registered for this tournament.` }, 400);
      }
      if (reg?.status === 'on_team') {
        return c.json({ error: `${targetPerson.display_name} is already on a team.` }, 400);
      }

      // ── Rank eligibility check for Kernel Kup (player role only) ──
      if (tournament.tournament_type === 'kernel_kup' && (!reg || reg.role === 'player')) {
        // Resolve the target person's linked user for rank data
        const { data: targetPersonFull } = await supabase
          .from('kkup_persons').select('steam_id').eq('id', personId).single();
        if (targetPersonFull?.steam_id) {
          const { data: targetUser } = await supabase
            .from('users').select('*, opendota_data, rank_id').eq('steam_id', targetPersonFull.steam_id).maybeSingle();
          if (targetUser) {
            const maxRank = tournament.max_rank ?? await getMaxPlayerRank();
            const minRank = tournament.min_rank ?? await getMinPlayerRank();
            const eligibility = checkKernelKupEligibility(targetUser, null, maxRank, minRank);
            if (!eligibility.eligible && !eligibility.rankUnknown) {
              return c.json({
                error: eligibility.reason || `${targetPerson.display_name}'s rank is above the Kernel Kup player eligibility threshold. They can participate as a Coach instead.`,
                rank_ineligible: true,
              }, 403);
            }
          }
        }
      }

      // Check roster size limit
      if (tournament.max_team_size) {
        const { count: rosterCount } = await supabase
          .from('kkup_team_rosters')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', teamId);

        if ((rosterCount || 0) >= tournament.max_team_size) {
          return c.json({ error: `Team roster is full (${tournament.max_team_size} players max).` }, 400);
        }
      }

      // Add to roster
      const { data: rosterEntry, error: insertError } = await supabase
        .from('kkup_team_rosters')
        .insert({ team_id: teamId, person_id: personId })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') { // UNIQUE violation
          return c.json({ error: `${targetPerson.display_name} is already on this team's roster.` }, 409);
        }
        console.error('Roster add error:', insertError);
        return c.json({ error: `Failed to add to roster: ${insertError.message}` }, 500);
      }

      // Update registration status if they have one
      if (reg) {
        await supabase
          .from('kkup_registrations')
          .update({ status: 'on_team' })
          .eq('id', reg.id);
      }

      // If they were a free agent, auto-decline any other pending invites in this tournament
      const { data: otherTeams } = await supabase
        .from('kkup_teams').select('id').eq('tournament_id', tournamentId);
      const allTeamIds = (otherTeams || []).map((t: any) => t.id);
      if (allTeamIds.length > 0) {
        await supabase
          .from('kkup_team_invites')
          .update({ status: 'declined', updated_at: new Date().toISOString() })
          .eq('person_id', personId)
          .eq('status', 'pending')
          .in('team_id', allTeamIds);
      }

      console.log(`Direct roster add: ${targetPerson.display_name} -> "${team.team_name}"`);

      // Log activity + notification for the added player (if they have a linked user account)
      try {
        const { data: addedPersonFull } = await supabase
          .from('kkup_persons').select('steam_id').eq('id', personId).single();
        if (addedPersonFull?.steam_id) {
          const { data: linkedUser } = await supabase
            .from('users').select('id').eq('steam_id', addedPersonFull.steam_id).maybeSingle();
          if (linkedUser?.id) {
            await createUserActivity({
              user_id: linkedUser.id,
              type: 'team_joined',
              title: `Added to ${team.team_name}`,
              description: `You were added to "${team.team_name}" roster for ${tournament.name} by ${auth.dbUser.discord_username || 'captain'}.`,
              related_id: teamId,
              related_url: `#tournament-hub/${tournamentId}`,
              actor_name: auth.dbUser.discord_username,
              actor_avatar: auth.dbUser.discord_avatar,
            });
            // Notify the player (unless they added themselves)
            if (linkedUser.id !== auth.dbUser.id) {
              await createNotification({
                user_id: linkedUser.id,
                type: 'team_invite',
                title: `Added to ${team.team_name}`,
                body: `You were added to "${team.team_name}" roster for ${tournament.name} by ${auth.dbUser.discord_username || 'the captain'}.`,
                related_id: teamId,
                action_url: `#tournament-hub/${tournamentId}`,
                actor_name: auth.dbUser.discord_username,
              });
            }
          }
        }
      } catch (actErr) { console.error('Non-critical: activity log for direct roster add failed:', actErr); }

      // Discord webhook: player added to roster
      try {
        const { embed } = buildKkupActivityEmbed({
          type: 'player_added',
          tournamentName: tournament.name,
          tournamentId,
          playerName: targetPerson.display_name,
          playerAvatar: auth.dbUser.discord_avatar,
          teamName: team.team_name,
          teamLogoUrl: team.logo_url,
          actorName: auth.dbUser.discord_username,
        });
        await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
      } catch (whErr) { console.error('Non-critical: roster add webhook failed:', whErr); }

      return c.json({
        success: true,
        roster_entry: rosterEntry,
        message: `${targetPerson.display_name} added to "${team.team_name}" roster.`,
      });
    } catch (error: any) {
      console.error('Direct roster add error:', error);
      return c.json({ error: 'Internal server error adding to roster: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 11. REMOVE FROM ROSTER (Captain or owner)
  // ===============================================

  app.delete(`${PREFIX}/kkup/tournaments/:tid/teams/:team_id/roster/:person_id`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('tid');
      const teamId = c.req.param('team_id');
      const personId = c.req.param('person_id');

      // Tournament must be mutable
      const tCheck = await getTournamentIfMutable(tournamentId);
      if (!tCheck.ok) return c.json({ error: tCheck.error }, 400);

      // Must be captain or owner
      const { authorized, team } = await isOwnerOrCaptain(auth.dbUser, teamId);
      if (!authorized) return c.json({ error: 'Only the team captain or owner can remove players' }, 403);
      if (!team) return c.json({ error: 'Team not found' }, 404);

      // Verify person is on this team's roster
      const { data: rosterEntry } = await supabase
        .from('kkup_team_rosters')
        .select('id, person_id')
        .eq('team_id', teamId)
        .eq('person_id', personId)
        .maybeSingle();

      if (!rosterEntry) {
        return c.json({ error: 'Person is not on this team roster' }, 404);
      }

      // Remove from roster
      const { error: deleteError } = await supabase
        .from('kkup_team_rosters')
        .delete()
        .eq('team_id', teamId)
        .eq('person_id', personId);

      if (deleteError) {
        console.error('Roster remove error:', deleteError);
        return c.json({ error: `Failed to remove from roster: ${deleteError.message}` }, 500);
      }

      // Revert registration status back to 'free_agent' (free agent pool)
      await supabase
        .from('kkup_registrations')
        .update({ status: 'free_agent' })
        .eq('tournament_id', tournamentId)
        .eq('person_id', personId)
        .eq('status', 'on_team');

      // If person was the coach, clear coach assignment (dual-write)
      if (team.coach_person_id === personId) {
        try { await clearCoachAssignment(supabase, teamId); }
        catch (coachErr) { console.error('Non-critical: coach assignment clear on roster remove failed:', coachErr); }
      }

      // Get person name for logging
      const { data: removedPerson } = await supabase
        .from('kkup_persons').select('display_name, steam_id').eq('id', personId).single();

      console.log(`Roster remove: ${removedPerson?.display_name || personId} from "${team.team_name}"`);

      // Log activity + notification for the removed player (if they have a linked user account)
      try {
        if (removedPerson?.steam_id) {
          const { data: linkedUser } = await supabase
            .from('users').select('id').eq('steam_id', removedPerson.steam_id).maybeSingle();
          if (linkedUser?.id) {
            await createUserActivity({
              user_id: linkedUser.id,
              type: 'team_left',
              title: `Removed from ${team.team_name}`,
              description: `You were removed from "${team.team_name}" roster by ${auth.dbUser.discord_username || 'captain'}.`,
              related_id: teamId,
              related_url: `#tournament-hub/${tournamentId}`,
              actor_name: auth.dbUser.discord_username,
              actor_avatar: auth.dbUser.discord_avatar,
            });
            // Notify the removed player (unless they removed themselves)
            if (linkedUser.id !== auth.dbUser.id) {
              await createNotification({
                user_id: linkedUser.id,
                type: 'team_invite',
                title: `Removed from ${team.team_name}`,
                body: `You were removed from "${team.team_name}" roster by ${auth.dbUser.discord_username || 'the captain'}. You're back in the free agent pool.`,
                related_id: teamId,
                action_url: `#tournament-hub/${tournamentId}`,
                actor_name: auth.dbUser.discord_username,
              });
            }
          }
        }
      } catch (actErr) { console.error('Non-critical: activity log for roster remove failed:', actErr); }

      // Discord webhook: player removed from roster
      try {
        const { data: tInfo } = await supabase
          .from('kkup_tournaments').select('name').eq('id', tournamentId).maybeSingle();
        const { embed } = buildKkupActivityEmbed({
          type: 'player_removed',
          tournamentName: tInfo?.name || tournamentId,
          tournamentId,
          playerName: removedPerson?.display_name || 'Unknown Player',
          playerAvatar: auth.dbUser.discord_avatar,
          teamName: team.team_name,
          teamLogoUrl: team.logo_url,
          actorName: auth.dbUser.discord_username,
        });
        await sendWebhookEmbed(DISCORD_WEBHOOKS.KKUP_REGISTRATIONS, embed);
      } catch (whErr) { console.error('Non-critical: roster remove webhook failed:', whErr); }

      return c.json({
        success: true,
        message: `${removedPerson?.display_name || 'Player'} removed from "${team.team_name}" and returned to the free agent pool.`,
      });
    } catch (error: any) {
      console.error('Roster remove error:', error);
      return c.json({ error: 'Internal server error removing from roster: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 12. MY PAST TEAMS (Authenticated -- teams user captained in other tournaments)
  // ===============================================

  app.get(`${PREFIX}/kkup/tournaments/:tid/my-past-teams`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const currentTournamentId = c.req.param('tid');

      // Resolve the caller's kkup_persons record
      const personResult = await resolvePersonForUser(auth.dbUser);
      if ('error' in personResult) return c.json({ error: personResult.error }, 500);
      const { person } = personResult;

      // Find all teams where this person was captain (excluding current tournament)
      const { data: pastTeams, error: teamsError } = await supabase
        .from('kkup_teams')
        .select(`
          id, tournament_id, team_name, team_tag, valve_team_id, logo_url, captain_person_id, approval_status, created_at,
          tournament:kkup_tournaments!tournament_id(id, name, status)
        `)
        .eq('captain_person_id', person.id)
        .neq('tournament_id', currentTournamentId)
        .neq('approval_status', 'denied')
        .order('created_at', { ascending: false });

      if (teamsError) {
        console.error('Fetch past teams error:', teamsError);
        return c.json({ error: `Failed to fetch past teams: ${teamsError.message}` }, 500);
      }

      // Also find teams where this person was on the roster (but not captain)
      const { data: rosterTeams, error: rosterError } = await supabase
        .from('kkup_team_rosters')
        .select(`
          team_id,
          team:kkup_teams!team_id(
            id, tournament_id, team_name, team_tag, valve_team_id, logo_url, captain_person_id, approval_status, created_at,
            tournament:kkup_tournaments!tournament_id(id, name, status)
          )
        `)
        .eq('person_id', person.id);

      // Merge roster teams (where not captain) -- deduplicate by team id
      const captainTeamIds = new Set((pastTeams || []).map((t: any) => t.id));
      const additionalTeams = (rosterTeams || [])
        .map((r: any) => r.team)
        .filter((t: any) => t && !captainTeamIds.has(t.id) && t.tournament_id !== currentTournamentId && t.approval_status !== 'denied');

      const allTeams = [...(pastTeams || []), ...additionalTeams];

      // For each team, fetch the roster with person details + linked user info
      const teamsWithRosters = await Promise.all(
        allTeams.map(async (team: any) => {
          const { data: roster } = await supabase
            .from('kkup_team_rosters')
            .select(`
              id, person_id, joined_at,
              person:kkup_persons!person_id(id, steam_id, display_name, avatar_url)
            `)
            .eq('team_id', team.id)
            .order('joined_at', { ascending: true });

          // Enrich roster with linked user data (discord avatar, username, rank)
          const enrichedRoster = await Promise.all(
            (roster || []).map(async (entry: any) => {
              if (!entry.person?.steam_id) return entry;
              const { data: linkedUser } = await supabase
                .from('users')
                .select('id, discord_username, discord_avatar, steam_id, tcf_plus_active')
                .eq('steam_id', entry.person.steam_id)
                .maybeSingle();
              return { ...entry, linked_user: linkedUser || null };
            })
          );

          return {
            ...team,
            wasCaptain: team.captain_person_id === person.id,
            roster: enrichedRoster,
            roster_count: enrichedRoster.length,
          };
        })
      );

      // -- Aggregate duplicate teams by team_name + team_tag --
      // The same org (e.g. "Corn Dawgs [CDGS]") may appear in multiple past tournaments.
      // Merge them into one entry with the most recent metadata and a combined roster of unique players.
      const aggregated: Record<string, any> = {};
      for (const team of teamsWithRosters) {
        const key = `${(team.team_name || '').toLowerCase().trim()}|${(team.team_tag || '').toLowerCase().trim()}`;
        if (!aggregated[key]) {
          // First occurrence -- use its metadata as the base
          aggregated[key] = {
            ...team,
            // Track which tournaments this team appeared in
            tournaments_appeared: [team.tournament],
          };
        } else {
          const existing = aggregated[key];
          // Keep the most recent team's metadata (logo, valve_team_id, etc.)
          if (new Date(team.created_at) > new Date(existing.created_at)) {
            existing.team_name = team.team_name;
            existing.team_tag = team.team_tag;
            existing.logo_url = team.logo_url || existing.logo_url;
            existing.valve_team_id = team.valve_team_id || existing.valve_team_id;
            existing.created_at = team.created_at;
          }
          // Merge wasCaptain (true if captain in ANY tournament)
          if (team.wasCaptain) existing.wasCaptain = true;
          // Track tournaments
          existing.tournaments_appeared.push(team.tournament);
          // Merge rosters -- deduplicate by person_id, keep unique players
          const existingPersonIds = new Set(existing.roster.map((r: any) => r.person_id));
          for (const entry of team.roster) {
            if (!existingPersonIds.has(entry.person_id)) {
              existing.roster.push(entry);
              existingPersonIds.add(entry.person_id);
            }
          }
          existing.roster_count = existing.roster.length;
        }
      }
      const deduplicatedTeams = Object.values(aggregated);

      console.log(`Past teams for ${auth.dbUser.discord_username}: ${teamsWithRosters.length} raw, ${deduplicatedTeams.length} after dedup`);
      return c.json({ teams: deduplicatedTeams, person_id: person.id });
    } catch (error: any) {
      console.error('Fetch past teams error:', error);
      return c.json({ error: 'Internal server error fetching past teams: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 14. SET TICKET CONTRIBUTION (Captain or owner — toggles per-player contribution)
  // ===============================================

  app.patch(`${PREFIX}/kkup/tournaments/:tid/teams/:team_id/roster/:person_id/contribution`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('tid');
      const teamId = c.req.param('team_id');
      const personId = c.req.param('person_id');

      // Tournament must be mutable
      const tCheck = await getTournamentIfMutable(tournamentId);
      if (!tCheck.ok) return c.json({ error: tCheck.error }, 400);

      // Must be captain or owner
      const { authorized, team } = await isOwnerOrCaptain(auth.dbUser, teamId);
      if (!authorized) return c.json({ error: 'Only the team captain or owner can set ticket contributions' }, 403);
      if (!team) return c.json({ error: 'Team not found' }, 404);

      // Team must be approved (not already ready, denied, etc.)
      if (team.approval_status !== 'approved') {
        return c.json({ error: `Team is "${team.approval_status}". Contributions can only be set on approved teams.` }, 400);
      }

      const body = await c.req.json();
      const tickets = Math.max(0, Math.floor(Number(body.tickets) || 0));
      const tournament = tCheck.tournament;

      // Check if the person is the coach (stored on kkup_teams, not kkup_team_rosters)
      const isCoach = team.coach_person_id === personId;

      if (isCoach) {
        // Coach contribution is stored on kkup_teams.coach_tickets_contributed
        const { data: updated, error: updateError } = await supabase
          .from('kkup_teams')
          .update({ coach_tickets_contributed: tickets })
          .eq('id', teamId)
          .select()
          .single();

        if (updateError) {
          console.error('Set coach contribution error:', updateError);
          return c.json({ error: `Failed to update coach contribution: ${updateError.message}` }, 500);
        }

        console.log(`Coach ticket contribution set: person ${personId} on team ${teamId} → ${tickets}`);
        return c.json({
          success: true,
          coach_contribution: tickets,
          message: tickets > 0 ? `Coach contributing ${tickets} ticket${tickets !== 1 ? 's' : ''}.` : 'Coach contribution removed.',
        });
      }

      // Verify person is on this team's roster (player path)
      const { data: rosterEntry, error: rosterError } = await supabase
        .from('kkup_team_rosters')
        .select('id, person_id, tickets_contributed')
        .eq('team_id', teamId)
        .eq('person_id', personId)
        .maybeSingle();

      if (rosterError || !rosterEntry) {
        return c.json({ error: 'Player is not on this team roster' }, 404);
      }

      // tickets_contributed = wallet-only intent. No wallet validation here —
      // wallets are only checked and deducted at lock-in (POST /ready).
      // This just records what the captain intends each player to contribute.

      // Update the contribution
      const { data: updated, error: updateError } = await supabase
        .from('kkup_team_rosters')
        .update({ tickets_contributed: tickets })
        .eq('id', rosterEntry.id)
        .select()
        .single();

      if (updateError) {
        console.error('Set contribution error:', updateError);
        return c.json({ error: `Failed to update contribution: ${updateError.message}` }, 500);
      }

      console.log(`Ticket contribution set: person ${personId} on team ${teamId} → ${tickets}`);
      return c.json({
        success: true,
        roster_entry: updated,
        message: tickets > 0 ? `Contributing ${tickets} ticket${tickets !== 1 ? 's' : ''}.` : 'Contribution removed.',
      });
    } catch (error: any) {
      console.error('Set contribution error:', error);
      return c.json({ error: 'Internal server error setting contribution: ' + error.message }, 500);
    }
  });


  // ===============================================
  // 15. TEAM READY — Captain finalizes team (atomic ticket deduction)
  //     NO officer approval needed — captain decision only
  // ===============================================

  app.post(`${PREFIX}/kkup/tournaments/:tid/teams/:team_id/ready`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('tid');
      const teamId = c.req.param('team_id');

      // Tournament must be mutable
      const tCheck = await getTournamentIfMutable(tournamentId);
      if (!tCheck.ok) return c.json({ error: tCheck.error }, 400);
      const tournament = tCheck.tournament;

      // Must be captain (NOT just officer — readying up is a captain-only action)
      const { authorized, team, person: callerPerson } = await isOwnerOrCaptain(auth.dbUser, teamId);
      if (!authorized) return c.json({ error: 'Only the team captain or owner can ready up a team' }, 403);
      if (!team) return c.json({ error: 'Team not found' }, 404);

      // Team must be approved (not already ready)
      if (team.approval_status === 'ready') {
        return c.json({ error: 'Team is already ready!' }, 400);
      }
      if (team.approval_status !== 'approved') {
        return c.json({ error: `Team is "${team.approval_status}". Only approved teams can ready up.` }, 400);
      }

      // Fetch roster with contributions
      const { data: roster, error: rosterError } = await supabase
        .from('kkup_team_rosters')
        .select('id, person_id, tickets_contributed, person:kkup_persons!person_id(id, steam_id, display_name)')
        .eq('team_id', teamId);

      if (rosterError || !roster) {
        return c.json({ error: 'Failed to fetch roster' }, 500);
      }

      // New model: total = wallet contributions + TCF+ auto-tickets
      const minRoster = tournament.min_team_size || 5;

      // Hard check: must have at least minRoster players on the roster (coach doesn't count)
      if (roster.length < minRoster) {
        return c.json({
          error: `Need at least ${minRoster} players on the roster to lock in. Currently have ${roster.length}.`,
          players_needed: minRoster,
          players_have: roster.length,
        }, 400);
      }

      // Wallet contributions from roster players + coach
      const rosterWalletContributed = roster.reduce((sum: number, r: any) => sum + (r.tickets_contributed || 0), 0);
      const coachWalletContributed = team.coach_tickets_contributed || 0;
      const walletContributed = rosterWalletContributed + coachWalletContributed;

      // Resolve all roster members + coach to user accounts to count TCF+ and validate wallets
      const coachSteamId = team.coach_person_id
        ? await (async () => {
            const { data: coachPerson } = await supabase.from('kkup_persons').select('steam_id').eq('id', team.coach_person_id).single();
            return coachPerson?.steam_id || null;
          })()
        : null;

      const allSteamIds = [
        ...roster.map((r: any) => r.person?.steam_id),
        coachSteamId,
      ].filter(Boolean);

      const { data: allLinkedUsers } = await supabase
        .from('users')
        .select('id, steam_id, kkup_tickets, tcf_plus_active')
        .in('steam_id', allSteamIds);

      const userBySteam: Record<string, any> = {};
      for (const u of (allLinkedUsers || [])) {
        userBySteam[u.steam_id] = u;
      }

      const tcfPlusFreeCount = (allLinkedUsers || []).filter((u: any) => !!u.tcf_plus_active).length;
      const isFullyCoveredByTcfPlus = tcfPlusFreeCount >= minRoster;

      if (isFullyCoveredByTcfPlus) {
        // TCF+ Full Coverage — no wallet tickets needed or allowed
        if (walletContributed > 0) {
          return c.json({
            error: `Your team is fully covered by TCF+ memberships (${tcfPlusFreeCount} TCF+ ≥ ${minRoster} required). Remove all wallet ticket contributions before locking in.`,
            fully_covered: true,
            tcf_plus_count: tcfPlusFreeCount,
            wallet_excess: walletContributed,
          }, 400);
        }
        // Good to go — no deductions needed
      } else {
        // Standard path: TCF+ covers some, wallet covers the rest
        const walletTicketsNeeded = minRoster - tcfPlusFreeCount;
        const totalContributed = walletContributed + tcfPlusFreeCount;

        if (totalContributed < minRoster) {
          return c.json({
            error: `Need ${minRoster} total tickets to lock in. Currently have ${totalContributed} (${tcfPlusFreeCount} free from TCF+ + ${walletContributed} from wallets).`,
            tickets_needed: minRoster,
            tickets_have: totalContributed,
          }, 400);
        }

        if (walletContributed > walletTicketsNeeded) {
          return c.json({
            error: `Team has ${walletContributed} wallet tickets but only ${walletTicketsNeeded} needed (${tcfPlusFreeCount} covered by TCF+). Remove ${walletContributed - walletTicketsNeeded} excess wallet ticket(s).`,
            tickets_needed: minRoster,
            tickets_have: totalContributed,
          }, 400);
        }
      }

      // Pre-validate: ensure every wallet contributor has enough tickets
      // tickets_contributed is now pure wallet cost — deduct directly
      const deductionPlan: { userId: string; currentTickets: number; deductAmount: number; playerName: string }[] = [];

      // Roster player wallet contributors
      const playerContributors = roster.filter((r: any) => (r.tickets_contributed || 0) > 0);
      for (const r of playerContributors) {
        const steamId = r.person?.steam_id;
        const user = steamId ? userBySteam[steamId] : null;
        const playerName = r.person?.display_name || 'Unknown';
        const walletTickets = r.tickets_contributed || 0;

        if (!user) {
          return c.json({ error: `Player "${playerName}" has no linked account. Cannot verify tickets.` }, 400);
        }

        if ((user.kkup_tickets || 0) < walletTickets) {
          return c.json({
            error: `Player "${playerName}" doesn't have enough tickets (needs ${walletTickets} from wallet, has ${user.kkup_tickets || 0}).`,
            insufficient_player: playerName,
          }, 400);
        }
        deductionPlan.push({ userId: user.id, currentTickets: user.kkup_tickets, deductAmount: walletTickets, playerName });
      }

      // Coach wallet contribution
      if (coachWalletContributed > 0 && coachSteamId) {
        const coachUser = userBySteam[coachSteamId];
        const coachName = 'Coach';
        if (!coachUser) {
          return c.json({ error: `Coach has no linked account. Cannot verify tickets.` }, 400);
        }
        if ((coachUser.kkup_tickets || 0) < coachWalletContributed) {
          return c.json({
            error: `Coach doesn't have enough tickets (needs ${coachWalletContributed} from wallet, has ${coachUser.kkup_tickets || 0}).`,
            insufficient_player: coachName,
          }, 400);
        }
        deductionPlan.push({ userId: coachUser.id, currentTickets: coachUser.kkup_tickets, deductAmount: coachWalletContributed, playerName: coachName });
      }

      const totalPaidTickets = walletContributed;
      const totalFreeTickets = tcfPlusFreeCount;

      // === ATOMIC SECTION: Deduct tickets + set team ready ===
      for (const { userId, currentTickets, deductAmount, playerName } of deductionPlan) {
        const { error: deductError } = await supabase
          .from('users')
          .update({ kkup_tickets: Math.max(0, currentTickets - deductAmount) })
          .eq('id', userId)
          .eq('kkup_tickets', currentTickets); // Optimistic concurrency — ensures no double-deduction

        if (deductError) {
          console.error(`Ticket deduction failed for ${playerName} (${userId}):`, deductError);
          return c.json({ error: `Ticket deduction failed for "${playerName}". Please try again.` }, 500);
        }
      }

      // Set team status to 'ready'
      const { data: readyTeam, error: readyError } = await supabase
        .from('kkup_teams')
        .update({ approval_status: 'ready' })
        .eq('id', teamId)
        .select()
        .single();

      if (readyError) {
        console.error('Set team ready error:', readyError);
        // Attempt to refund tickets on failure (best-effort)
        for (const { userId, currentTickets } of deductionPlan) {
          try {
            await supabase.from('users').update({ kkup_tickets: currentTickets }).eq('id', userId);
          } catch (refundErr) {
            console.error('CRITICAL: Ticket refund failed during ready rollback:', refundErr);
          }
        }
        return c.json({ error: `Failed to set team ready: ${readyError.message}` }, 500);
      }

      console.log(`Team READY: "${team.team_name}" (${teamId}) — ${totalPaidTickets} tickets deducted from wallets, ${totalFreeTickets} free via TCF+`);

      // Activity logging (non-critical)
      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'team_ready',
          title: `Team ${team.team_name} is Ready!`,
          description: `You locked in "${team.team_name}" for ${tournament.name}. ${totalPaidTickets} ticket${totalPaidTickets !== 1 ? 's' : ''} consumed from wallets, ${totalFreeTickets} free via TCF+.`,
          related_id: teamId,
          related_url: `#tournament-hub/${tournamentId}`,
        });
      } catch (actErr) { console.error('Non-critical: activity log for team ready failed:', actErr); }

      try {
        await createAdminLog({
          type: 'team_ready',
          action: `Team "${team.team_name}" readied up for ${tournament.name}`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: {
            team_id: teamId,
            team_name: team.team_name,
            tickets_deducted: totalPaidTickets,
            tcf_plus_free: totalFreeTickets,
          },
        });
      } catch (actErr) { console.error('Non-critical: admin log for team ready failed:', actErr); }

      return c.json({
        success: true,
        team: readyTeam,
        tickets_deducted: totalPaidTickets,
        tcf_plus_free: totalFreeTickets,
        message: `Team "${team.team_name}" is locked in! ${totalPaidTickets} ticket${totalPaidTickets !== 1 ? 's' : ''} consumed${totalFreeTickets > 0 ? `, ${totalFreeTickets} free via TCF+` : ''}.`,
      });
    } catch (error: any) {
      console.error('Team ready error:', error);
      return c.json({ error: 'Internal server error during team ready: ' + error.message }, 500);
    }
  });

}
