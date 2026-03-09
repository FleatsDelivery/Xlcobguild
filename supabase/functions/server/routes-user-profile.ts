/**
 * User Profile Routes -- OpenDota connect/sync, account details, rank actions, rank self-report
 * 6 routes + 1 helper function (fetchOpenDotaData)
 */
import type { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";
import { createUserActivity, createAdminLog, createNotification } from "./routes-notifications.ts";
import { isOfficer } from "./roles.ts";
import * as kv from "./kv_store.tsx";

// Helper function to fetch and parse OpenDota data
async function fetchOpenDotaData(opendotaId: string) {
  try {
    const [profileRes, heroesRes, wlRes] = await Promise.all([
      fetch(`https://api.opendota.com/api/players/${opendotaId}`),
      fetch(`https://api.opendota.com/api/players/${opendotaId}/heroes`),
      fetch(`https://api.opendota.com/api/players/${opendotaId}/wl`)
    ]);

    if (!profileRes.ok || !heroesRes.ok || !wlRes.ok) {
      console.error('Failed to fetch OpenDota data');
      return null;
    }

    const profile = await profileRes.json();
    const heroes = await heroesRes.json();
    const _wl = await wlRes.json();

    const top3Heroes = heroes
      .sort((a: any, b: any) => b.games - a.games)
      .slice(0, 3)
      .map((hero: any) => ({
        hero_id: hero.hero_id,
        games: hero.games,
        win: hero.win,
        with_games: hero.with_games,
        with_win: hero.with_win
      }));

    const rankTier = profile.rank_tier || 0;
    const leaderboardRank = profile.leaderboard_rank || null;

    let medal = 'Unranked';
    let stars = 0;
    if (rankTier > 0) {
      const majorRank = Math.floor(rankTier / 10);
      stars = rankTier % 10;
      const medals = ['', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'];
      medal = medals[majorRank] || 'Unknown';
    }

    return {
      badge_rank: { medal, stars, rank_tier: rankTier, leaderboard_rank: leaderboardRank },
      top_3_heroes: top3Heroes,
      primary_role: null,
      profile: {
        personaname: profile.profile?.personaname || 'Unknown',
        avatarfull: profile.profile?.avatarfull || null
      }
    };
  } catch (error) {
    console.error('Error fetching OpenDota data:', error);
    return null;
  }
}

export function registerUserProfileRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ── Public user profile by ID (read-only, no auth required) ──
  // Returns fresh user data for the UserProfileModal regardless of where it's opened
  app.get(`${PREFIX}/users/:user_id/profile`, async (c) => {
    try {
      const userId = c.req.param('user_id');
      const { data: user, error } = await supabase
        .from('users')
        .select('id, discord_id, discord_username, discord_avatar, rank_id, prestige_level, role, steam_id, created_at, opendota_data, tcf_plus_active, twitch_username, twitch_avatar, guild_id, ranks:ranks!rank_id(id, name, display_order), guild:guild_wars_guilds!users_guild_id_fkey(id, name, tag, color, logo_url)')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return c.json({ error: `User not found: ${error?.message || 'no data'}` }, 404);
      }

      return c.json(user);
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
      return c.json({ error: `Failed to fetch user profile: ${err.message}` }, 500);
    }
  });

  // Connect OpenDota account
  app.post(`${PREFIX}/users/me/opendota`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { opendota_id } = await c.req.json();
      if (!opendota_id) return c.json({ error: 'OpenDota ID is required' }, 400);
      if (!/^\d+$/.test(opendota_id)) return c.json({ error: 'Invalid OpenDota ID format. Please enter a numeric Steam32 ID.' }, 400);

      const testResponse = await fetch(`https://api.opendota.com/api/players/${opendota_id}`);
      if (!testResponse.ok) return c.json({ error: 'Failed to verify OpenDota account.' }, 400);

      const playerData = await testResponse.json();
      if (!playerData || playerData.profile === null) return c.json({ error: 'OpenDota account not found.' }, 400);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('id').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);

      const { error: updateError } = await supabase
        .from('users').update({ steam_id: opendota_id, updated_at: new Date().toISOString() }).eq('id', dbUser.id);
      if (updateError) {
        console.error('Error connecting OpenDota account:', updateError);
        return c.json({ error: 'Failed to connect OpenDota account' }, 500);
      }

      // Log activity (non-critical)
      try {
        await createUserActivity({
          user_id: dbUser.id,
          type: 'steam_linked',
          title: 'Steam/OpenDota Account Connected',
          description: `You connected your Steam account (ID: ${opendota_id}).`,
        });
      } catch (_) {}

      return c.json({ success: true });
    } catch (error) {
      console.error('Connect OpenDota error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Sync OpenDota data for current user
  app.post(`${PREFIX}/users/me/opendota/sync`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('id, steam_id, opendota_data').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);
      if (!dbUser.steam_id) return c.json({ error: 'No OpenDota account connected' }, 400);

      const openDotaData = await fetchOpenDotaData(dbUser.steam_id);
      if (!openDotaData) return c.json({ error: 'Failed to fetch OpenDota data' }, 500);

      // Preserve self-reported rank if OpenDota returns unranked but user previously self-reported
      const existingBadge = dbUser.opendota_data?.badge_rank;
      const newBadge = openDotaData.badge_rank;
      if (
        newBadge?.medal === 'Unranked' &&
        existingBadge?.self_reported &&
        existingBadge?.medal &&
        existingBadge.medal !== 'Unranked'
      ) {
        // Keep the self-reported rank since OpenDota still can't find a real one
        openDotaData.badge_rank = {
          ...existingBadge,
          // Update the raw rank_tier to reflect OpenDota still says 0
          rank_tier: newBadge.rank_tier,
          leaderboard_rank: newBadge.leaderboard_rank,
        };
      }

      const { error: updateError } = await supabase
        .from('users').update({ opendota_data: openDotaData, opendota_last_synced: new Date().toISOString() })
        .eq('id', dbUser.id);
      if (updateError) {
        console.error('Error updating OpenDota data:', updateError);
        return c.json({ error: 'Failed to update OpenDota data' }, 500);
      }

      // Include rank_unknown flag so frontend knows to prompt for self-report
      const rankUnknown = openDotaData.badge_rank?.medal === 'Unranked' ||
        (!openDotaData.badge_rank?.medal);

      return c.json({ success: true, data: openDotaData, rank_unknown: rankUnknown });
    } catch (error) {
      console.error('Sync OpenDota error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Manual refresh all OpenDota accounts (Owner only)
  app.post(`${PREFIX}/admin/opendota/refresh-all`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('role').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser || dbUser.role !== 'owner') return c.json({ error: 'Unauthorized - Owner only' }, 403);

      const { data: users, error: usersError } = await supabase
        .from('users').select('id, steam_id, opendota_data').not('steam_id', 'is', null);
      if (usersError) return c.json({ error: 'Failed to fetch users' }, 500);

      let successCount = 0;
      let failCount = 0;

      for (const user of users || []) {
        try {
          const opendotaData = await fetchOpenDotaData(user.steam_id);
          if (opendotaData) {
            // Preserve self-reported rank if OpenDota still returns unranked
            const existingBadge = user.opendota_data?.badge_rank;
            const newBadge = opendotaData.badge_rank;
            if (
              newBadge?.medal === 'Unranked' &&
              existingBadge?.self_reported &&
              existingBadge?.medal &&
              existingBadge.medal !== 'Unranked'
            ) {
              opendotaData.badge_rank = {
                ...existingBadge,
                rank_tier: newBadge.rank_tier,
                leaderboard_rank: newBadge.leaderboard_rank,
              };
            }
            await supabase.from('users').update({
              opendota_data: opendotaData,
              opendota_last_synced: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }).eq('id', user.id);
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`Error refreshing user ${user.id}:`, err);
        }
      }

      // Log admin action
      try { await createAdminLog({ type: 'opendota_refresh_all', action: `Bulk refreshed OpenDota data: ${successCount} succeeded, ${failCount} failed out of ${(users || []).length} users`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({ success: true, refreshed: successCount, failed: failCount, total: (users || []).length });
    } catch (error) {
      console.error('Manual refresh error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Update user account details (Twitch, Chess.com, etc.)
  app.patch(`${PREFIX}/users/me/account`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('id').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);

      const body = await c.req.json();
      const allowedFields = ['twitch_username', 'twitch_avatar', 'twitch_id'];
      const updateData: any = {};
      for (const field of allowedFields) {
        if (field in body) updateData[field] = body[field];
      }
      if (Object.keys(updateData).length === 0) return c.json({ error: 'No valid fields to update' }, 400);

      const { error: updateError } = await supabase.from('users').update(updateData).eq('id', dbUser.id);
      if (updateError) {
        console.error('Error updating user account:', updateError);
        return c.json({ error: 'Failed to update account' }, 500);
      }

      // Log activity (non-critical)
      try {
        const fields = Object.keys(updateData).join(', ');
        await createUserActivity({
          user_id: dbUser.id,
          type: 'profile_updated',
          title: 'Account Details Updated',
          description: `You updated your account details (${fields}).`,
        });
      } catch (_) {}

      return c.json({ success: true });
    } catch (error) {
      console.error('Update account error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Get recent rank actions for a user
  app.get(`${PREFIX}/rank-actions/:userId`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const userId = c.req.param('userId');
      const allActions = await kv.getByPrefix(`rank_action:`);

      if (!allActions || allActions.length === 0) return c.json({ actions: [] });

      const userActions = allActions.filter((action: any) =>
        action && action.timestamp &&
        (action.performed_by_user_id === userId || action.target_user_id === userId)
      );

      if (userActions.length === 0) return c.json({ actions: [] });

      const sortedActions = userActions
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20);

      const actionsWithUserInfo = await Promise.all(
        sortedActions.map(async (action: any) => {
          const { data: performer } = await supabase
            .from('users').select('id, discord_username, discord_avatar')
            .eq('id', action.performed_by_user_id).maybeSingle();
          const { data: recipient } = await supabase
            .from('users').select('id, discord_username, discord_avatar')
            .eq('id', action.target_user_id).maybeSingle();
          return { ...action, performer: performer || null, recipient: recipient || null };
        })
      );

      return c.json({ actions: actionsWithUserInfo });
    } catch (error) {
      console.error('Get rank actions error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ── Self-report Dota 2 rank ──
  // Called when OpenDota can't determine rank (private profile, unranked, etc.)
  // Stores the self-reported medal into opendota_data.badge_rank
  app.post(`${PREFIX}/users/me/rank/self-report`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { medal } = await c.req.json();
      const validMedals = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'];
      if (!medal || !validMedals.includes(medal)) {
        return c.json({ error: `Invalid medal. Must be one of: ${validMedals.join(', ')}` }, 400);
      }

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('id, opendota_data, discord_username').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);

      // Merge self-reported rank into existing opendota_data, preserving heroes/profile
      const updatedOpendotaData = {
        ...(dbUser.opendota_data || {}),
        badge_rank: {
          ...(dbUser.opendota_data?.badge_rank || {}),
          medal,
          stars: medal === 'Immortal' ? 0 : 1,
          self_reported: true,
          self_reported_at: new Date().toISOString(),
        },
      };

      const { error: updateError } = await supabase
        .from('users')
        .update({ opendota_data: updatedOpendotaData, updated_at: new Date().toISOString() })
        .eq('id', dbUser.id);
      if (updateError) {
        console.error('Error saving self-reported rank:', updateError);
        return c.json({ error: 'Failed to save self-reported rank' }, 500);
      }

      // Log activity (non-critical)
      try {
        await createUserActivity({
          user_id: dbUser.id,
          type: 'rank_self_reported',
          title: 'Dota 2 Rank Self-Reported',
          description: `You self-reported your Dota 2 rank as ${medal}.`,
        });
      } catch (_) {}

      // Admin log so officers can spot-check self-reports (non-critical)
      try {
        await createAdminLog({
          type: 'rank_self_reported',
          action: `${dbUser.discord_username || 'Unknown user'} self-reported Dota 2 rank as ${medal}`,
          actor_name: dbUser.discord_username || 'Unknown',
        });
      } catch (_) {}

      console.log(`User ${dbUser.discord_username || dbUser.id} self-reported rank: ${medal}`);
      return c.json({ success: true, medal });
    } catch (error) {
      console.error('Self-report rank error:', error);
      return c.json({ error: 'Internal server error during rank self-report' }, 500);
    }
  });

  // ── Officer rank override ──
  // Allows officers/owner to set a player's Dota 2 rank when it's unknown or incorrect.
  // Stores the officer-set medal+stars into opendota_data.badge_rank with officer_override flag.
  app.post(`${PREFIX}/users/:id/rank/officer-override`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided for officer rank override' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized during officer rank override' }, 401);

      // Verify the caller is an officer
      const { data: callerUser, error: callerError } = await supabase
        .from('users').select('id, role, discord_username').eq('supabase_id', authUser.id).single();
      if (callerError || !callerUser) return c.json({ error: 'Caller user not found during officer rank override' }, 404);
      if (!isOfficer(callerUser.role) && callerUser.role !== 'owner') {
        return c.json({ error: 'Forbidden: only officers can override player ranks' }, 403);
      }

      // Parse the target user ID and rank data
      const targetUserId = c.req.param('id');
      const { medal, stars } = await c.req.json();
      const validMedals = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'];
      if (!medal || !validMedals.includes(medal)) {
        return c.json({ error: `Invalid medal for officer rank override. Must be one of: ${validMedals.join(', ')}` }, 400);
      }
      const validStars = medal === 'Immortal' ? 0 : Math.max(1, Math.min(5, Number(stars) || 1));

      // Fetch the target user
      const { data: targetUser, error: targetError } = await supabase
        .from('users').select('id, opendota_data, discord_username').eq('id', targetUserId).single();
      if (targetError || !targetUser) return c.json({ error: `Target user ${targetUserId} not found for officer rank override` }, 404);

      const displayRank = medal === 'Immortal' ? 'Immortal' : `${medal} ${validStars}`;

      // Merge officer-set rank into existing opendota_data, preserving heroes/profile
      const updatedOpendotaData = {
        ...(targetUser.opendota_data || {}),
        badge_rank: {
          ...(targetUser.opendota_data?.badge_rank || {}),
          medal,
          stars: validStars,
          self_reported: false,
          officer_override: true,
          officer_override_by: callerUser.discord_username || callerUser.id,
          officer_override_at: new Date().toISOString(),
        },
      };

      const { error: updateError } = await supabase
        .from('users')
        .update({ opendota_data: updatedOpendotaData, updated_at: new Date().toISOString() })
        .eq('id', targetUser.id);
      if (updateError) {
        console.error('Error saving officer rank override:', updateError);
        return c.json({ error: `Failed to save officer rank override for ${targetUser.discord_username}: ${updateError.message}` }, 500);
      }

      // User activity on the target (non-critical)
      try {
        await createUserActivity({
          user_id: targetUser.id,
          type: 'rank_officer_override',
          title: 'Rank Updated by Officer',
          description: `An officer set your Dota 2 rank to ${displayRank}.`,
          actor_name: callerUser.discord_username || 'Officer',
        });
      } catch (actErr) {
        console.error('Non-critical: activity log for officer rank override failed:', actErr);
      }

      // Notification to the target user (non-critical)
      try {
        await createNotification({
          user_id: targetUser.id,
          type: 'rank_changed',
          title: 'Rank Updated',
          body: `An officer updated your Dota 2 rank to ${displayRank}.`,
          actor_name: callerUser.discord_username || 'Officer',
        });
      } catch (notifErr) {
        console.error('Non-critical: notification for officer rank override failed:', notifErr);
      }

      // Admin log (non-critical)
      try {
        await createAdminLog({
          type: 'rank_officer_override',
          action: `Set ${targetUser.discord_username || 'Unknown'}'s Dota 2 rank to ${displayRank}`,
          actor_id: callerUser.id,
          actor_name: callerUser.discord_username || 'Officer',
        });
      } catch (adminErr) {
        console.error('Non-critical: admin log for officer rank override failed:', adminErr);
      }

      console.log(`Officer ${callerUser.discord_username} set ${targetUser.discord_username}'s rank to ${displayRank}`);
      return c.json({ success: true, medal, stars: validStars, display: displayRank });
    } catch (error) {
      console.error('Officer rank override error:', error);
      return c.json({ error: 'Internal server error during officer rank override' }, 500);
    }
  });

}