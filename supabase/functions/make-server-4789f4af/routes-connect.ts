/**
 * Stripe Connect Routes — Money OUT Pipeline
 *
 * Handles:
 *   POST /connect/onboard            — Create Express account + return onboarding URL
 *   GET  /connect/status             — Check current user's Connect status
 *   POST /connect/dashboard          — Generate Express Dashboard login link
 *   POST /connect/award              — Owner: create a prize award
 *   POST /connect/award-batch        — Owner: batch create prize awards (multi-recipient)
 *   PUT  /connect/award/:id/accept   — Recipient: accept a prize
 *   PUT  /connect/award/:id/decline  — Recipient: decline a prize
 *   POST /connect/award/:id/disburse — Owner: execute Stripe transfer + update aggregates
 *   PUT  /connect/award/:id/revoke   — Owner: revoke a pending/accepted award
 *   GET  /connect/awards/tournament/:id — Officer: list awards for a tournament
 *   GET  /connect/awards/mine        — Any user: list their own awards
 *   GET  /connect/awards/all         — Owner: list ALL awards (admin overview)
 *
 * The flow:
 *   Owner awards prize → Recipient notified → Recipient accepts (must have Connect) → Owner disburses
 *
 * Stripe is authoritative for money movement.
 * Supabase is authoritative for meaning.
 */

import { PREFIX, requireAuth, requireOwner } from './helpers.ts';
import { createNotification, createUserActivity, createAdminLog } from './routes-notifications.ts';
import { isOfficer } from './roles.ts';
import Stripe from 'npm:stripe@17';

// ══════════════════════════════════════════════════════
// STRIPE CONFIG
// ══════════════════════════════════════════════════════

function getStripe(): Stripe {
  const key = Deno.env.get('STRIPE_LIVE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_LIVE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' });
}

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

/** Format cents → "$12.50" */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Resolve kkup_teams → kkup_master_teams link for a team row */
async function resolveMasterTeamId(supabase: any, teamId: string): Promise<string | null> {
  const { data } = await supabase
    .from('kkup_teams')
    .select('master_team_id')
    .eq('id', teamId)
    .single();
  return data?.master_team_id || null;
}

// ══════════════════════════════════════════════════════
// ROUTE REGISTRATION
// ══════════════════════════════════════════════════════

export function registerConnectRoutes(
  app: any,
  supabase: any,
  anonSupabase: any,
) {

  // ────────────────────────────────────────────────────
  // POST /connect/onboard — Create Stripe Express account + return onboarding URL
  // ────────────────────────────────────────────────────
  app.post(`${PREFIX}/connect/onboard`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      const stripe = getStripe();
      const body = await c.req.json().catch(() => ({}));
      const returnUrl = body.return_url || 'https://make.figma.com';
      const refreshUrl = body.refresh_url || returnUrl;

      // Check if user already has a Connect account
      let accountId = dbUser.stripe_connect_account_id;

      if (accountId) {
        // Account exists — check if onboarding is complete
        const account = await stripe.accounts.retrieve(accountId);

        if (account.details_submitted && account.charges_enabled) {
          // Already fully onboarded
          await supabase.from('users').update({
            stripe_connect_status: 'active',
          }).eq('id', dbUser.id);

          return c.json({
            status: 'active',
            message: 'Your Stripe account is already connected and active.',
          });
        }

        // Onboarding incomplete — generate new link
        const link = await stripe.accountLinks.create({
          account: accountId,
          type: 'account_onboarding',
          return_url: returnUrl,
          refresh_url: refreshUrl,
        });

        return c.json({
          status: 'pending',
          onboarding_url: link.url,
          message: 'Continue your Stripe onboarding.',
        });
      }

      // No account yet — create Express account
      const account = await stripe.accounts.create({
        type: 'express',
        email: dbUser.email || undefined,
        metadata: {
          tcf_user_id: dbUser.id,
          discord_username: dbUser.discord_username || '',
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      // Save to DB immediately
      await supabase.from('users').update({
        stripe_connect_account_id: account.id,
        stripe_connect_status: 'pending',
      }).eq('id', dbUser.id);

      // Generate onboarding link
      const link = await stripe.accountLinks.create({
        account: account.id,
        type: 'account_onboarding',
        return_url: returnUrl,
        refresh_url: refreshUrl,
      });

      // Activity log
      try {
        await createUserActivity({
          user_id: dbUser.id,
          type: 'stripe_connect_started',
          title: 'Stripe Connect Started',
          description: 'You started connecting your Stripe account for prize payouts.',
          related_url: '#profile',
        });
      } catch (err) {
        console.error('Non-critical: activity log for Connect onboard failed:', err);
      }

      return c.json({
        status: 'pending',
        onboarding_url: link.url,
        message: 'Complete your Stripe onboarding to receive prize payouts.',
      });
    } catch (err: any) {
      console.error('Connect onboard error:', err);
      return c.json({ error: `Failed to start Stripe Connect onboarding: ${err.message}` }, 500);
    }
  });


  // ────────────────────────────────────────────────────
  // GET /connect/status — Check current user's Connect status
  // ────────────────────────────────────────────────────
  app.get(`${PREFIX}/connect/status`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      if (!dbUser.stripe_connect_account_id) {
        return c.json({ status: 'not_connected', account_id: null });
      }

      // Refresh status from Stripe (source of truth)
      const stripe = getStripe();
      try {
        const account = await stripe.accounts.retrieve(dbUser.stripe_connect_account_id);

        let status: string;
        if (account.details_submitted && account.charges_enabled) {
          status = 'active';
        } else if (account.details_submitted) {
          status = 'pending_verification';
        } else {
          status = 'pending';
        }

        // Sync status to DB if changed
        if (status !== dbUser.stripe_connect_status) {
          await supabase.from('users').update({
            stripe_connect_status: status,
          }).eq('id', dbUser.id);

          // If just became active, log it
          if (status === 'active' && dbUser.stripe_connect_status !== 'active') {
            try {
              await createUserActivity({
                user_id: dbUser.id,
                type: 'stripe_connected',
                title: 'Stripe Account Connected',
                description: 'Your Stripe account is now active. You can receive prize payouts!',
                related_url: '#profile',
              });
            } catch (err) {
              console.error('Non-critical: activity log for Connect active failed:', err);
            }
          }
        }

        return c.json({
          status,
          account_id: dbUser.stripe_connect_account_id,
          details_submitted: account.details_submitted,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
        });
      } catch (stripeErr: any) {
        // If Stripe can't find the account, it was probably deleted
        if (stripeErr.code === 'account_invalid') {
          await supabase.from('users').update({
            stripe_connect_account_id: null,
            stripe_connect_status: null,
          }).eq('id', dbUser.id);
          return c.json({ status: 'not_connected', account_id: null });
        }
        throw stripeErr;
      }
    } catch (err: any) {
      console.error('Connect status error:', err);
      return c.json({ error: `Failed to check Connect status: ${err.message}` }, 500);
    }
  });


  // ────────────────────────────────────────────────────
  // POST /connect/dashboard — Generate Express Dashboard login link
  // ────────────────────────────────────────────────────
  app.post(`${PREFIX}/connect/dashboard`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      if (!dbUser.stripe_connect_account_id) {
        return c.json({ error: 'No Stripe Connect account found. Complete onboarding first.' }, 400);
      }

      const stripe = getStripe();
      const loginLink = await stripe.accounts.createLoginLink(dbUser.stripe_connect_account_id);

      return c.json({ url: loginLink.url });
    } catch (err: any) {
      console.error('Connect dashboard error:', err);
      return c.json({ error: `Failed to generate dashboard link: ${err.message}` }, 500);
    }
  });


  // ────────────────────────────────────────────────────
  // POST /connect/award — Owner: create a prize award for a user
  // ────────────────────────────────────────────────────
  app.post(`${PREFIX}/connect/award`, async (c: any) => {
    try {
      const auth = await requireOwner(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser: ownerUser } = auth;

      const body = await c.req.json();
      const {
        recipient_user_id,
        amount_cents,
        reason,
        tournament_id,
        team_id,
        place,
        role: awardRole,
      } = body;

      // Validation
      if (!recipient_user_id) return c.json({ error: 'recipient_user_id is required' }, 400);
      if (!amount_cents || amount_cents <= 0) return c.json({ error: 'amount_cents must be positive' }, 400);

      // Look up the recipient user
      const { data: recipientUser, error: recipientError } = await supabase
        .from('users')
        .select('id, discord_username, discord_avatar, steam_id')
        .eq('id', recipient_user_id)
        .single();

      if (recipientError || !recipientUser) {
        return c.json({ error: `Recipient user not found: ${recipient_user_id}` }, 404);
      }

      // Resolve person_id for the recipient
      let personId: string | null = null;
      if (recipientUser.steam_id) {
        const { data: person } = await supabase
          .from('kkup_persons')
          .select('id')
          .eq('steam_id', recipientUser.steam_id)
          .maybeSingle();
        personId = person?.id || null;
      }

      // Resolve master_team_id if team_id is provided
      let masterTeamId: string | null = null;
      if (team_id) {
        masterTeamId = await resolveMasterTeamId(supabase, team_id);
      }

      // Insert the award
      const { data: award, error: insertError } = await supabase
        .from('prize_awards')
        .insert({
          recipient_user_id,
          awarded_by_user_id: ownerUser.id,
          amount_cents,
          reason: reason || null,
          tournament_id: tournament_id || null,
          team_id: team_id || null,
          master_team_id: masterTeamId,
          person_id: personId,
          place: place || null,
          role: awardRole || 'player',
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        return c.json({ error: `Failed to create prize award: ${insertError.message}` }, 500);
      }

      // Resolve tournament name for notifications
      let tournamentName = '';
      if (tournament_id) {
        const { data: t } = await supabase
          .from('kkup_tournaments')
          .select('name')
          .eq('id', tournament_id)
          .single();
        tournamentName = t?.name || '';
      }

      const amountStr = formatCents(amount_cents);
      const placeStr = place ? `${place}${getOrdinalSuffix(place)} place` : '';
      const reasonStr = reason || (placeStr ? `${placeStr}${tournamentName ? ` in ${tournamentName}` : ''}` : 'prize winnings');

      // Notify the recipient
      try {
        await createNotification({
          user_id: recipient_user_id,
          type: 'prize_awarded',
          title: `Prize Awarded: ${amountStr}`,
          body: `You've been awarded ${amountStr} for ${reasonStr}. Accept it to receive your payout!`,
          related_id: award.id,
          action_url: '#inbox',
          actor_name: ownerUser.discord_username || 'The Corn Field',
          actor_avatar: ownerUser.discord_avatar || undefined,
          metadata: {
            award_id: award.id,
            amount_cents,
            tournament_id,
            tournament_name: tournamentName,
          },
        });
      } catch (err) {
        console.error('Non-critical: notification for prize award failed:', err);
      }

      // Admin log
      try {
        await createAdminLog({
          type: 'prize_awarded',
          action: `Awarded ${amountStr} to ${recipientUser.discord_username || recipient_user_id} for ${reasonStr}`,
          actor_id: ownerUser.id,
          actor_name: ownerUser.discord_username,
          actor_avatar: ownerUser.discord_avatar,
          details: { award_id: award.id, amount_cents, tournament_id, recipient_user_id },
        });
      } catch (err) {
        console.error('Non-critical: admin log for prize award failed:', err);
      }

      // User activity for recipient
      try {
        await createUserActivity({
          user_id: recipient_user_id,
          type: 'prize_awarded',
          title: `Prize Awarded: ${amountStr}`,
          description: `You were awarded ${amountStr} for ${reasonStr}. Check your inbox to accept!`,
          related_id: award.id,
          related_url: '#inbox',
          actor_name: ownerUser.discord_username || 'The Corn Field',
          actor_avatar: ownerUser.discord_avatar || undefined,
        });
      } catch (err) {
        console.error('Non-critical: activity log for prize award failed:', err);
      }

      return c.json({ award, message: `Awarded ${amountStr} to ${recipientUser.discord_username || recipient_user_id}` });
    } catch (err: any) {
      console.error('Award create error:', err);
      return c.json({ error: `Failed to create prize award: ${err.message}` }, 500);
    }
  });


  // ────────────────────────────────────────────────────
  // POST /connect/award-batch — Owner: create prize awards for multiple recipients
  //
  // Body: {
  //   tournament_id: string,
  //   role: 'champion' | 'popd_kernel' | 'match_of_the_night' | 'staff' | 'rampage_bonus' | 'custom',
  //   team_id?: string,        // for champion awards — the winning team
  //   recipients: [{ user_id: string, person_id?: string, amount_cents: number }],
  //   reason?: string,
  //   place?: number,
  // }
  //
  // Creates one prize_awards row per recipient.
  // Side-effects: updates kkup_tournaments columns for champion/popd_kernel.
  // ────────────────────────────────────────────────────
  app.post(`${PREFIX}/connect/award-batch`, async (c: any) => {
    try {
      const auth = await requireOwner(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser: ownerUser } = auth;

      const body = await c.req.json();
      const {
        tournament_id,
        role: awardRole,
        team_id,
        recipients,
        reason,
        place,
      } = body;

      // ── Validation ──
      if (!tournament_id) return c.json({ error: 'tournament_id is required' }, 400);
      if (!awardRole) return c.json({ error: 'role is required' }, 400);
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return c.json({ error: 'recipients array is required and must not be empty' }, 400);
      }

      // Validate recipients: each must have at least a user_id OR person_id, and non-negative amount
      for (const r of recipients) {
        if (!r.user_id && !r.person_id) {
          return c.json({ error: 'Each recipient must have a user_id or person_id (or both)' }, 400);
        }
        if (r.amount_cents === undefined || r.amount_cents === null || r.amount_cents < 0) {
          return c.json({ error: 'Each recipient must have a non-negative amount_cents' }, 400);
        }
      }

      // Fetch tournament
      const { data: tournament, error: tErr } = await supabase
        .from('kkup_tournaments')
        .select('id, name, tournament_start_date')
        .eq('id', tournament_id)
        .single();
      if (tErr || !tournament) return c.json({ error: `Tournament not found: ${tournament_id}` }, 404);

      // Resolve master_team_id if team_id provided
      let masterTeamId: string | null = null;
      let teamName: string | null = null;
      if (team_id) {
        masterTeamId = await resolveMasterTeamId(supabase, team_id);
        const { data: teamRow } = await supabase
          .from('kkup_teams')
          .select('team_name')
          .eq('id', team_id)
          .single();
        teamName = teamRow?.team_name || null;
      }

      // ── Create prize_awards rows ──
      const createdAwards: any[] = [];
      const errors: string[] = [];

      for (const r of recipients) {
        // Resolve person_id if not provided — look up by user's steam_id
        let personId = r.person_id || null;
        if (!personId && r.user_id) {
          const { data: usr } = await supabase
            .from('users')
            .select('steam_id')
            .eq('id', r.user_id)
            .single();
          if (usr?.steam_id) {
            const { data: person } = await supabase
              .from('kkup_persons')
              .select('id')
              .eq('steam_id', usr.steam_id)
              .maybeSingle();
            personId = person?.id || null;
          }
        }

        const isHonorary = r.amount_cents === 0;
        const hasAccount = !!r.user_id;

        // Determine status:
        // - $0 → 'honorary' (bragging rights, tracked for history)
        // - has account + $$ → 'pending' (can accept/decline/get paid)
        // - no account + $$ → 'unclaimed' (recorded, claimable if they ever create an account)
        const awardStatus = isHonorary ? 'honorary' : hasAccount ? 'pending' : 'unclaimed';

        const { data: award, error: insertErr } = await supabase
          .from('prize_awards')
          .insert({
            recipient_user_id: r.user_id || null,
            awarded_by_user_id: ownerUser.id,
            amount_cents: r.amount_cents,
            reason: reason || null,
            tournament_id,
            team_id: team_id || null,
            master_team_id: masterTeamId,
            person_id: personId,
            place: place || null,
            role: awardRole,
            status: awardStatus,
          })
          .select()
          .single();

        if (insertErr) {
          const recipientLabel = r.user_id || r.person_id || 'unknown';
          errors.push(`Failed to create award for ${recipientLabel}: ${insertErr.message}`);
          continue;
        }

        createdAwards.push(award);

        // ── Notifications (non-critical, only for users with accounts) ──
        if (hasAccount) {
          // Look up recipient for notifications
          const { data: recipientUser } = await supabase
            .from('users')
            .select('id, discord_username, discord_avatar')
            .eq('id', r.user_id)
            .single();

          if (!isHonorary) {
            const amountStr = formatCents(r.amount_cents);
            const roleLabel = ROLE_LABELS[awardRole] || awardRole;
            const reasonStr = reason || `${roleLabel} — ${tournament.name}`;

            try {
              await createNotification({
                user_id: r.user_id,
                type: 'prize_awarded',
                title: `Prize Awarded: ${amountStr}`,
                body: `You've been awarded ${amountStr} for ${reasonStr}. Accept it to receive your payout!`,
                related_id: award.id,
                action_url: '#inbox',
                actor_name: ownerUser.discord_username || 'The Corn Field',
                actor_avatar: ownerUser.discord_avatar || undefined,
                metadata: { award_id: award.id, amount_cents: r.amount_cents, tournament_id, tournament_name: tournament.name },
              });
            } catch (err) { console.error('Non-critical: notification for batch award failed:', err); }

            try {
              await createUserActivity({
                user_id: r.user_id,
                type: 'prize_awarded',
                title: `Prize Awarded: ${amountStr}`,
                description: `You were awarded ${amountStr} for ${reasonStr}. Check your inbox to accept!`,
                related_id: award.id,
                related_url: '#inbox',
                actor_name: ownerUser.discord_username || 'The Corn Field',
                actor_avatar: ownerUser.discord_avatar || undefined,
              });
            } catch (err) { console.error('Non-critical: activity log for batch award failed:', err); }
          } else {
            // Honorary award — still log activity if they have an account
            const roleLabel = ROLE_LABELS[awardRole] || awardRole;
            try {
              await createUserActivity({
                user_id: r.user_id,
                type: 'prize_awarded',
                title: `${roleLabel} — ${tournament.name}`,
                description: `You received the ${roleLabel} award for ${tournament.name}. No monetary prize attached.`,
                related_id: award.id,
                related_url: `#tournament-hub/${tournament_id}`,
                actor_name: ownerUser.discord_username || 'The Corn Field',
                actor_avatar: ownerUser.discord_avatar || undefined,
              });
            } catch (err) { console.error('Non-critical: honorary activity log failed:', err); }
          }
        }
        // Note: recipients without accounts get the prize_awards row created
        // but no notifications/activity. They'll see it if they ever sign up.
      }

      // ── Side-effects: update kkup_tournaments columns ──
      if (awardRole === 'champion' && team_id) {
        try {
          await supabase
            .from('kkup_tournaments')
            .update({
              winning_team_id: team_id,
              winning_team_name: teamName,
            })
            .eq('id', tournament_id);
          console.log(`Updated kkup_tournaments.winning_team_id for ${tournament.name} → ${teamName}`);
        } catch (err) {
          console.error('Non-critical: failed to update kkup_tournaments winning team:', err);
        }
      }

      if (awardRole === 'popd_kernel') {
        try {
          const personIds = createdAwards.map(a => a.person_id).filter(Boolean);
          await supabase
            .from('kkup_tournaments')
            .update({
              popd_kernel_1_person_id: personIds[0] || null,
              popd_kernel_2_person_id: personIds[1] || null,
            })
            .eq('id', tournament_id);
          console.log(`Updated kkup_tournaments popd_kernel person IDs for ${tournament.name}`);
        } catch (err) {
          console.error('Non-critical: failed to update kkup_tournaments popd_kernel:', err);
        }
      }

      // ── Admin log ──
      const totalCents = createdAwards.reduce((s: number, a: any) => s + a.amount_cents, 0);
      const roleLabel = ROLE_LABELS[awardRole] || awardRole;
      const summaryMsg = totalCents > 0
        ? `Awarded ${formatCents(totalCents)} (${createdAwards.length} recipient${createdAwards.length > 1 ? 's' : ''}) for ${roleLabel} — ${tournament.name}`
        : `Awarded ${roleLabel} (honorary) to ${createdAwards.length} recipient${createdAwards.length > 1 ? 's' : ''} — ${tournament.name}`;

      try {
        await createAdminLog({
          type: 'prize_awarded',
          action: summaryMsg,
          actor_id: ownerUser.id,
          actor_name: ownerUser.discord_username,
          actor_avatar: ownerUser.discord_avatar,
          details: {
            tournament_id,
            role: awardRole,
            team_id,
            recipient_count: createdAwards.length,
            total_cents: totalCents,
            award_ids: createdAwards.map((a: any) => a.id),
          },
        });
      } catch (err) { console.error('Non-critical: admin log for batch award failed:', err); }

      return c.json({
        success: true,
        awards: createdAwards,
        errors: errors.length > 0 ? errors : undefined,
        message: summaryMsg,
      });
    } catch (err: any) {
      console.error('Award batch error:', err);
      return c.json({ error: `Failed to create batch awards: ${err.message}` }, 500);
    }
  });


  // ────────────────────────────────────────────────────
  // PUT /connect/award/:id/accept — Recipient: accept a prize
  // ────────────────────────────────────────────────────
  app.put(`${PREFIX}/connect/award/:id/accept`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      const awardId = c.req.param('id');

      // Fetch the award
      const { data: award, error } = await supabase
        .from('prize_awards')
        .select('*')
        .eq('id', awardId)
        .single();

      if (error || !award) return c.json({ error: 'Prize award not found' }, 404);
      if (award.recipient_user_id !== dbUser.id) return c.json({ error: 'This award is not yours' }, 403);
      if (award.status !== 'pending') return c.json({ error: `Award is already ${award.status}` }, 400);

      // Update status
      const { error: updateError } = await supabase
        .from('prize_awards')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', awardId);

      if (updateError) return c.json({ error: `Failed to accept award: ${updateError.message}` }, 500);

      const amountStr = formatCents(award.amount_cents);

      // Admin log
      try {
        await createAdminLog({
          type: 'prize_accepted',
          action: `${dbUser.discord_username || dbUser.id} accepted ${amountStr} prize award`,
          actor_id: dbUser.id,
          actor_name: dbUser.discord_username,
        });
      } catch (err) {
        console.error('Non-critical: admin log for prize accept failed:', err);
      }

      // User activity
      try {
        await createUserActivity({
          user_id: dbUser.id,
          type: 'prize_accepted',
          title: `Accepted ${amountStr} Prize`,
          description: `You accepted your ${amountStr} prize award. It will be disbursed to your Stripe account.`,
          related_id: awardId,
          related_url: '#profile',
        });
      } catch (err) {
        console.error('Non-critical: activity log for prize accept failed:', err);
      }

      // Check if they have Stripe Connect — include in response so frontend can prompt
      const hasConnect = !!dbUser.stripe_connect_account_id && dbUser.stripe_connect_status === 'active';

      return c.json({
        success: true,
        message: `Accepted ${amountStr} prize.${hasConnect ? '' : ' Connect your Stripe account to receive the payout.'}`,
        has_connect: hasConnect,
      });
    } catch (err: any) {
      console.error('Award accept error:', err);
      return c.json({ error: `Failed to accept prize award: ${err.message}` }, 500);
    }
  });


  // ────────────────────────────────────────────────────
  // PUT /connect/award/:id/decline — Recipient: decline a prize
  // ────────────────────────────────────────────────────
  app.put(`${PREFIX}/connect/award/:id/decline`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      const awardId = c.req.param('id');
      const body = await c.req.json().catch(() => ({}));

      const { data: award, error } = await supabase
        .from('prize_awards')
        .select('*')
        .eq('id', awardId)
        .single();

      if (error || !award) return c.json({ error: 'Prize award not found' }, 404);
      if (award.recipient_user_id !== dbUser.id) return c.json({ error: 'This award is not yours' }, 403);
      if (award.status !== 'pending') return c.json({ error: `Award is already ${award.status}` }, 400);

      const { error: updateError } = await supabase
        .from('prize_awards')
        .update({
          status: 'declined',
          denial_reason: body.reason || 'Declined by recipient',
          updated_at: new Date().toISOString(),
        })
        .eq('id', awardId);

      if (updateError) return c.json({ error: `Failed to decline award: ${updateError.message}` }, 500);

      const amountStr = formatCents(award.amount_cents);

      // Admin log
      try {
        await createAdminLog({
          type: 'prize_declined',
          action: `${dbUser.discord_username || dbUser.id} declined ${amountStr} prize award`,
          actor_id: dbUser.id,
          actor_name: dbUser.discord_username,
          details: { reason: body.reason },
        });
      } catch (err) {
        console.error('Non-critical: admin log for prize decline failed:', err);
      }

      // User activity
      try {
        await createUserActivity({
          user_id: dbUser.id,
          type: 'prize_declined',
          title: `Declined ${amountStr} Prize`,
          description: `You declined the ${amountStr} prize award.${body.reason ? ` Reason: ${body.reason}` : ''}`,
          related_id: awardId,
        });
      } catch (err) {
        console.error('Non-critical: activity log for prize decline failed:', err);
      }

      return c.json({ success: true, message: `Declined ${amountStr} prize.` });
    } catch (err: any) {
      console.error('Award decline error:', err);
      return c.json({ error: `Failed to decline prize award: ${err.message}` }, 500);
    }
  });


  // ────────────────────────────────────────────────────
  // POST /connect/award/:id/disburse — Owner: execute Stripe transfer
  // ────────────────────────────────────────────────────
  app.post(`${PREFIX}/connect/award/:id/disburse`, async (c: any) => {
    try {
      const auth = await requireOwner(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser: ownerUser } = auth;

      const awardId = c.req.param('id');

      // Fetch the award
      const { data: award, error } = await supabase
        .from('prize_awards')
        .select('*')
        .eq('id', awardId)
        .single();

      if (error || !award) return c.json({ error: 'Prize award not found' }, 404);
      if (award.status !== 'accepted') {
        return c.json({ error: `Award must be in "accepted" status to disburse. Current: "${award.status}"` }, 400);
      }

      // Look up recipient's Stripe Connect account
      const { data: recipientUser, error: recipientErr } = await supabase
        .from('users')
        .select('id, discord_username, discord_avatar, stripe_connect_account_id, stripe_connect_status, steam_id')
        .eq('id', award.recipient_user_id)
        .single();

      if (recipientErr || !recipientUser) {
        return c.json({ error: `Recipient user not found: ${award.recipient_user_id}` }, 404);
      }

      if (!recipientUser.stripe_connect_account_id || recipientUser.stripe_connect_status !== 'active') {
        return c.json({
          error: `Recipient ${recipientUser.discord_username || recipientUser.id} does not have an active Stripe Connect account.`,
          connect_status: recipientUser.stripe_connect_status,
        }, 400);
      }

      // Execute the Stripe transfer
      const stripe = getStripe();
      let transfer: Stripe.Transfer;
      try {
        transfer = await stripe.transfers.create({
          amount: award.amount_cents,
          currency: 'usd',
          destination: recipientUser.stripe_connect_account_id,
          description: `TCF Prize: ${award.reason || 'Prize winnings'}`,
          metadata: {
            tcf_award_id: award.id,
            tcf_recipient_user_id: award.recipient_user_id,
            tcf_tournament_id: award.tournament_id || '',
          },
        });
      } catch (stripeErr: any) {
        console.error('Stripe transfer failed:', stripeErr);
        return c.json({
          error: `Stripe transfer failed: ${stripeErr.message}`,
          stripe_code: stripeErr.code,
        }, 500);
      }

      // Update the award record
      const { error: updateError } = await supabase
        .from('prize_awards')
        .update({
          status: 'paid',
          stripe_transfer_id: transfer.id,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', awardId);

      if (updateError) {
        // Transfer succeeded but DB update failed — critical issue, log it loudly
        console.error(`CRITICAL: Stripe transfer ${transfer.id} succeeded but DB update failed:`, updateError);
        return c.json({
          error: `Transfer succeeded (${transfer.id}) but database update failed. Manual reconciliation needed.`,
          transfer_id: transfer.id,
        }, 500);
      }

      // ── Update stored aggregates ──

      const amountDollars = award.amount_cents / 100;
      const amountStr = formatCents(award.amount_cents);

      // 1. Update kkup_persons.prize_money_won
      if (award.person_id) {
        try {
          const { data: person } = await supabase
            .from('kkup_persons')
            .select('prize_money_won')
            .eq('id', award.person_id)
            .single();

          if (person) {
            const newTotal = parseFloat(person.prize_money_won || '0') + amountDollars;
            await supabase
              .from('kkup_persons')
              .update({ prize_money_won: newTotal })
              .eq('id', award.person_id);
          }
        } catch (err) {
          console.error('Non-critical: failed to update kkup_persons.prize_money_won:', err);
        }
      }

      // 2. Update kkup_teams.prize_money_won (per-tournament team)
      if (award.team_id) {
        try {
          const { data: team } = await supabase
            .from('kkup_teams')
            .select('prize_money_won')
            .eq('id', award.team_id)
            .single();

          if (team) {
            const newTotal = parseFloat(team.prize_money_won || '0') + amountDollars;
            await supabase
              .from('kkup_teams')
              .update({ prize_money_won: newTotal })
              .eq('id', award.team_id);
          }
        } catch (err) {
          console.error('Non-critical: failed to update kkup_teams.prize_money_won:', err);
        }
      }

      // 3. Update kkup_master_teams.total_prize_money_won (lifetime team)
      if (award.master_team_id) {
        try {
          const { data: masterTeam } = await supabase
            .from('kkup_master_teams')
            .select('total_prize_money_won')
            .eq('id', award.master_team_id)
            .single();

          if (masterTeam) {
            const newTotal = parseFloat(masterTeam.total_prize_money_won || '0') + amountDollars;
            await supabase
              .from('kkup_master_teams')
              .update({ total_prize_money_won: newTotal })
              .eq('id', award.master_team_id);
          }
        } catch (err) {
          console.error('Non-critical: failed to update kkup_master_teams.total_prize_money_won:', err);
        }
      }

      // ── Notifications & Logs ──

      // Notify recipient
      try {
        await createNotification({
          user_id: award.recipient_user_id,
          type: 'prize_paid',
          title: `Prize Paid: ${amountStr}`,
          body: `${amountStr} has been sent to your Stripe account!`,
          related_id: awardId,
          action_url: '#profile',
          actor_name: 'The Corn Field',
        });
      } catch (err) {
        console.error('Non-critical: notification for prize paid failed:', err);
      }

      // User activity for recipient
      try {
        await createUserActivity({
          user_id: award.recipient_user_id,
          type: 'prize_paid',
          title: `Prize Paid: ${amountStr}`,
          description: `${amountStr} was transferred to your Stripe account. Transfer ID: ${transfer.id}`,
          related_id: awardId,
          related_url: '#profile',
          actor_name: 'The Corn Field',
        });
      } catch (err) {
        console.error('Non-critical: activity log for prize paid failed:', err);
      }

      // Admin log
      try {
        await createAdminLog({
          type: 'prize_disbursed',
          action: `Disbursed ${amountStr} to ${recipientUser.discord_username || recipientUser.id} (transfer: ${transfer.id})`,
          actor_id: ownerUser.id,
          actor_name: ownerUser.discord_username,
          actor_avatar: ownerUser.discord_avatar,
          details: {
            award_id: awardId,
            transfer_id: transfer.id,
            amount_cents: award.amount_cents,
            recipient: recipientUser.discord_username,
          },
        });
      } catch (err) {
        console.error('Non-critical: admin log for prize disburse failed:', err);
      }

      return c.json({
        success: true,
        transfer_id: transfer.id,
        message: `Successfully disbursed ${amountStr} to ${recipientUser.discord_username || recipientUser.id}`,
      });
    } catch (err: any) {
      console.error('Award disburse error:', err);
      return c.json({ error: `Failed to disburse prize: ${err.message}` }, 500);
    }
  });


  // ────────────────────────────────────────────────────
  // PUT /connect/award/:id/revoke — Owner: revoke a pending/accepted award
  // ────────────────────────────────────────────────────
  app.put(`${PREFIX}/connect/award/:id/revoke`, async (c: any) => {
    try {
      const auth = await requireOwner(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser: ownerUser } = auth;

      const awardId = c.req.param('id');
      const body = await c.req.json().catch(() => ({}));

      const { data: award, error } = await supabase
        .from('prize_awards')
        .select('*')
        .eq('id', awardId)
        .single();

      if (error || !award) return c.json({ error: 'Prize award not found' }, 404);
      if (award.status === 'paid') {
        return c.json({ error: 'Cannot revoke a prize that has already been paid. Use Stripe Dashboard for refunds.' }, 400);
      }
      if (award.status === 'revoked') {
        return c.json({ error: 'Award is already revoked' }, 400);
      }

      const { error: updateError } = await supabase
        .from('prize_awards')
        .update({
          status: 'revoked',
          denial_reason: body.reason || 'Revoked by owner',
          revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', awardId);

      if (updateError) return c.json({ error: `Failed to revoke award: ${updateError.message}` }, 500);

      const amountStr = formatCents(award.amount_cents);

      // Notify recipient
      try {
        await createNotification({
          user_id: award.recipient_user_id,
          type: 'prize_revoked',
          title: `Prize Revoked: ${amountStr}`,
          body: `Your ${amountStr} prize award has been revoked.${body.reason ? ` Reason: ${body.reason}` : ''}`,
          related_id: awardId,
          actor_name: ownerUser.discord_username || 'The Corn Field',
        });
      } catch (err) {
        console.error('Non-critical: notification for prize revoke failed:', err);
      }

      // Dual log
      try {
        await createAdminLog({
          type: 'prize_revoked',
          action: `Revoked ${amountStr} prize for user ${award.recipient_user_id}${body.reason ? ` — ${body.reason}` : ''}`,
          actor_id: ownerUser.id,
          actor_name: ownerUser.discord_username,
        });

        await createUserActivity({
          user_id: award.recipient_user_id,
          type: 'prize_revoked',
          title: `Prize Revoked: ${amountStr}`,
          description: `Your ${amountStr} prize award was revoked.${body.reason ? ` Reason: ${body.reason}` : ''}`,
          related_id: awardId,
          actor_name: ownerUser.discord_username || 'The Corn Field',
        });
      } catch (err) {
        console.error('Non-critical: logs for prize revoke failed:', err);
      }

      return c.json({ success: true, message: `Revoked ${amountStr} prize.` });
    } catch (err: any) {
      console.error('Award revoke error:', err);
      return c.json({ error: `Failed to revoke prize award: ${err.message}` }, 500);
    }
  });


  // ────────────────────────────���───────────────────────
  // GET /connect/awards/mine — Any user: list their own awards
  // ────────────────────────────────────────────────────
  app.get(`${PREFIX}/connect/awards/mine`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      const { data: awards, error } = await supabase
        .from('prize_awards')
        .select('*')
        .eq('recipient_user_id', dbUser.id)
        .order('created_at', { ascending: false });

      if (error) return c.json({ error: `Failed to fetch your awards: ${error.message}` }, 500);

      return c.json({ awards: awards || [] });
    } catch (err: any) {
      console.error('My awards fetch error:', err);
      return c.json({ error: `Failed to fetch your awards: ${err.message}` }, 500);
    }
  });


  // ────────────────────────────────────────────────────
  // GET /connect/awards/tournament/:id — Officer: list awards for a tournament
  // ────────────────────────────────────────────────────
  app.get(`${PREFIX}/connect/awards/tournament/:id`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      if (!isOfficer(dbUser.role)) {
        return c.json({ error: 'Only officers can view tournament awards' }, 403);
      }

      const tournamentId = c.req.param('id');

      const { data: awards, error } = await supabase
        .from('prize_awards')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: false });

      if (error) return c.json({ error: `Failed to fetch tournament awards: ${error.message}` }, 500);

      // Enrich with recipient info
      const recipientIds = [...new Set((awards || []).map((a: any) => a.recipient_user_id))];
      let recipientMap: Record<string, any> = {};
      if (recipientIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, discord_username, discord_avatar, stripe_connect_status')
          .in('id', recipientIds);
        for (const u of (users || [])) {
          recipientMap[u.id] = u;
        }
      }

      const enriched = (awards || []).map((a: any) => ({
        ...a,
        recipient: recipientMap[a.recipient_user_id] || null,
      }));

      return c.json({ awards: enriched });
    } catch (err: any) {
      console.error('Tournament awards fetch error:', err);
      return c.json({ error: `Failed to fetch tournament awards: ${err.message}` }, 500);
    }
  });


  // ────────────────────────────────────────────────────
  // GET /connect/awards/all — Owner: list ALL awards (admin overview)
  // ────────────────────────────────────────────────────
  app.get(`${PREFIX}/connect/awards/all`, async (c: any) => {
    try {
      const auth = await requireOwner(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const status = c.req.query('status'); // optional filter
      const limit = parseInt(c.req.query('limit') || '100', 10);

      let query = supabase
        .from('prize_awards')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: awards, error } = await query;

      if (error) return c.json({ error: `Failed to fetch all awards: ${error.message}` }, 500);

      // Enrich with recipient + tournament info
      const recipientIds = [...new Set((awards || []).map((a: any) => a.recipient_user_id))];
      const tournamentIds = [...new Set((awards || []).filter((a: any) => a.tournament_id).map((a: any) => a.tournament_id))];

      let recipientMap: Record<string, any> = {};
      if (recipientIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, discord_username, discord_avatar, stripe_connect_status')
          .in('id', recipientIds);
        for (const u of (users || [])) {
          recipientMap[u.id] = u;
        }
      }

      let tournamentMap: Record<string, any> = {};
      if (tournamentIds.length > 0) {
        const { data: tournaments } = await supabase
          .from('kkup_tournaments')
          .select('id, name')
          .in('id', tournamentIds);
        for (const t of (tournaments || [])) {
          tournamentMap[t.id] = t;
        }
      }

      const enriched = (awards || []).map((a: any) => ({
        ...a,
        recipient: recipientMap[a.recipient_user_id] || null,
        tournament: tournamentMap[a.tournament_id] || null,
      }));

      return c.json({ awards: enriched });
    } catch (err: any) {
      console.error('All awards fetch error:', err);
      return c.json({ error: `Failed to fetch all awards: ${err.message}` }, 500);
    }
  });

}


// ══════════════════════════════════════════════════════
// UTILITY
// ══════════════════════════════════════════════════════

/** Get ordinal suffix for a number: 1st, 2nd, 3rd, 4th... */
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ── Role Labels ──
const ROLE_LABELS: Record<string, string> = {
  champion: 'Champion',
  popd_kernel: 'POPD Kernel',
  match_of_the_night: 'Match of the Night',
  staff: 'Staff',
  rampage_bonus: 'Rampage Bonus',
  custom: 'Custom',
};