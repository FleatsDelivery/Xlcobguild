/**
 * Auth Routes — Discord OAuth callback + current user info + onboarding
 * 4 routes:
 *   POST /auth/discord-callback  — create or update user after Discord OAuth
 *   GET  /auth/me                — current user (with guild + onboarding metadata)
 *   POST /auth/join-guild        — DEPRECATED (use POST /guilds/:id/join)
 *   POST /auth/claim-onboarding-reward — free rank-up for completing setup
 */
import type { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";
import * as kv from "./kv_store.tsx";
import { createUserActivity } from "./routes-notifications.ts";

export function registerAuthRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ── POST /auth/discord-callback ───────────────────────────────────
  app.post(`${PREFIX}/auth/discord-callback`, async (c) => {
    try {
      const body = await c.req.json();
      const { user } = body;

      if (!user) {
        console.error('No user object provided in callback');
        return c.json({ error: "User object required" }, 400);
      }

      // Extract the actual Discord user ID from identities array
      const discordIdentity = user.identities?.find((i: any) => i.provider === 'discord');
      const discordUserId = discordIdentity?.id || discordIdentity?.provider_id;

      if (!discordUserId) {
        console.error('No Discord identity found for user:', user.id);
        return c.json({ error: 'Discord identity not found. Please sign in with Discord.' }, 400);
      }

      const supabaseUserId = user.id; // UUID from auth.users
      const discord_username = user.user_metadata?.custom_claims?.global_name 
        || user.user_metadata?.full_name 
        || user.user_metadata?.name 
        || user.email?.split('@')[0] 
        || 'Unknown';
      const discord_avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
      const discord_email = user.email || null;

      console.log('Discord callback - Discord ID:', discordUserId, 'Supabase ID:', supabaseUserId, 'Username:', discord_username, 'Email:', discord_email);

      // Check if user exists by discord_id (the actual Discord user ID)
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('discord_id', discordUserId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching user:', fetchError);
        return c.json({ error: 'Failed to fetch user' }, 500);
      }

      if (existingUser) {
        // Check if this user should be owner
        let updateData: any = {
          supabase_id: supabaseUserId, // Update in case it changed
          discord_username,
          discord_avatar,
          email: discord_email,
          updated_at: new Date().toISOString(),
        };

        // If email matches owner email and user is not already owner, upgrade them
        if (discord_email === 'tmull_23@hotmail.com' && existingUser.role !== 'owner') {
          updateData.role = 'owner';
          console.log('EXISTING USER UPGRADED TO OWNER');
        }

        // Detect Twitch identity from linkIdentity OAuth flow
        const twitchIdentity = user.identities?.find((i: any) => i.provider === 'twitch');
        if (twitchIdentity) {
          const twitchData = twitchIdentity.identity_data || {};
          updateData.twitch_username = twitchData.preferred_username || twitchData.name || twitchData.full_name || null;
          updateData.twitch_avatar = twitchData.avatar_url || twitchData.picture || null;
          updateData.twitch_id = twitchIdentity.id || twitchData.provider_id || twitchData.sub || null;
          console.log('Twitch identity found:', updateData.twitch_username, 'ID:', updateData.twitch_id);
        } else if (existingUser.twitch_id) {
          // Twitch identity was removed (unlinkIdentity) — clear Twitch fields
          updateData.twitch_username = null;
          updateData.twitch_avatar = null;
          updateData.twitch_id = null;
          console.log('Twitch identity removed (unlinked)');
        }

        // Update existing user info
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('discord_id', discordUserId)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating user:', updateError);
          return c.json({ error: 'Failed to update user' }, 500);
        }

        console.log('Updated existing user');
        return c.json({ user: updatedUser });
      }

      // Determine role based on email - check if this is the owner
      let role = 'guest';
      if (discord_email === 'tmull_23@hotmail.com') {
        role = 'owner';
        console.log('OWNER ACCOUNT DETECTED - Setting role to owner');
      }

      // Look up Unaffiliated guild for new users
      const { data: unaffiliatedGuild } = await supabase
        .from('guild_wars_guilds')
        .select('id')
        .eq('name', 'Unaffiliated')
        .single();

      // Create new user with guest role (or owner if matched) and rank 1 (Earwig)
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          supabase_id: supabaseUserId,  // UUID from auth.users for JWT verification
          discord_id: discordUserId,     // Actual Discord user ID string
          discord_username,
          discord_avatar,
          email: discord_email,
          rank_id: 1, // Earwig
          prestige_level: 0,
          role: role,
          guild_id: unaffiliatedGuild?.id || null,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return c.json({ error: 'Failed to create user' }, 500);
      }

      console.log('Created new user with role:', role);

      // Log first-time registration (non-critical)
      try {
        await createUserActivity({
          user_id: newUser.id,
          type: 'account_created',
          title: 'Joined The Corn Field',
          description: `Welcome! You created your account as ${discord_username}.`,
        });
      } catch (_) { /* non-critical */ }

      return c.json({ user: newUser });
    } catch (error) {
      console.error('Discord callback error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ── GET /auth/me — Current user with guild + onboarding metadata ──────────
  app.get(`${PREFIX}/auth/me`, async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      
      if (!authHeader) {
        return c.json({ error: 'No access token provided' }, 401);
      }

      const accessToken = authHeader.replace('Bearer ', '');

      // Use anon client to verify the token
      const { data, error } = await anonSupabase.auth.getUser(accessToken);
      
      if (error) {
        console.error('Token verification failed:', error.message);
        return c.json({ error: 'Unauthorized - Invalid token: ' + error.message }, 401);
      }
      
      if (!data.user) {
        return c.json({ error: 'Unauthorized - No user found' }, 401);
      }
      
      // Get user from database - query by supabase_id (UUID from auth.users)
      // Include guild info via guild_id FK
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select(`
          *,
          ranks (
            id,
            name,
            display_order
          ),
          guild:guild_wars_guilds!users_guild_id_fkey (
            id,
            name,
            tag,
            color,
            logo_url,
            is_default,
            discord_role_id
          )
        `)
        .eq('supabase_id', data.user.id)
        .single();

      if (dbError) {
        console.error('Database query error:', dbError.message, dbError.code);
        return c.json({ error: 'User not found in database: ' + dbError.message }, 404);
      }

      if (!dbUser) {
        return c.json({ error: 'User not found in database' }, 404);
      }

      // Auto-refresh OpenDota data if needed (non-blocking background sync)
      if (dbUser.steam_id) {
        const lastSynced = dbUser.opendota_last_synced ? new Date(dbUser.opendota_last_synced) : null;
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        if (!lastSynced || lastSynced < twoHoursAgo) {
          // Trigger background sync (non-blocking - don't await)
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/make-server-4789f4af/users/me/opendota/sync`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }).catch(err => {
            console.error('Background OpenDota sync failed:', err);
          });
        }
      }

      // ── Onboarding metadata (lightweight, parallel queries) ──
      const [mvpCountResult, rewardClaimed] = await Promise.all([
        // Count of MVP requests this user has submitted
        supabase
          .from('rank_up_requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', dbUser.id),
        // Check if onboarding reward was already claimed (KV)
        kv.get(`onboarding_reward:${dbUser.id}`),
      ]);

      const onboarding = {
        mvp_request_count: mvpCountResult.count ?? 0,
        reward_claimed: rewardClaimed === 'true',
      };
      
      return c.json({ user: dbUser, onboarding });
    } catch (error) {
      console.error('Unexpected error in /auth/me:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // ── POST /auth/join-guild — DEPRECATED ──────────────────────────────
  // Guild joining now uses POST /guilds/:id/join (routes-guilds.ts).
  // This endpoint is kept for backward compatibility but returns 410 Gone.
  app.post(`${PREFIX}/auth/join-guild`, async (c) => {
    return c.json({
      error: 'This endpoint is deprecated. Use POST /guilds/:id/join instead.',
      migration: 'Guild affiliation is now managed via guild_wars_guilds table, not users.role.',
    }, 410);
  });

  // ── POST /auth/claim-onboarding-reward — Free rank-up ─────────────
  app.post(`${PREFIX}/auth/claim-onboarding-reward`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('id, role, rank_id, prestige_level, steam_id').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);

      // Check if already claimed
      const alreadyClaimed = await kv.get(`onboarding_reward:${dbUser.id}`);
      if (alreadyClaimed === 'true') {
        return c.json({ error: 'Onboarding reward already claimed' }, 400);
      }

      // Verify all required steps are complete
      const isDiscord = true; // always true if they're authenticated
      const isSteam = !!dbUser.steam_id;
      const isGuild = dbUser.role !== 'guest';

      if (!isDiscord || !isSteam || !isGuild) {
        return c.json({ error: 'Not all onboarding steps are complete (need: Steam linked and Guild joined)' }, 400);
      }

      // Grant free rank-up (cap at max rank for prestige level)
      const maxRank = dbUser.prestige_level === 5 ? 11 : 10;
      const newRankId = Math.min(dbUser.rank_id + 1, maxRank);

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ rank_id: newRankId, updated_at: new Date().toISOString() })
        .eq('id', dbUser.id)
        .select(`*, ranks ( id, name, display_order )`)
        .single();

      if (updateError) {
        console.error('Error granting onboarding rank-up:', updateError);
        return c.json({ error: 'Failed to grant rank-up' }, 500);
      }

      // Mark as claimed
      await kv.set(`onboarding_reward:${dbUser.id}`, 'true');

      // Log onboarding reward (non-critical)
      try {
        const { data: rankData } = await supabase.from('ranks').select('name').eq('id', newRankId).single();
        const rankName = rankData?.name || `Rank ${newRankId}`;
        await createUserActivity({
          user_id: dbUser.id,
          type: 'onboarding_reward',
          title: 'Onboarding Rank-Up Claimed',
          description: `You completed onboarding and received a free rank-up to ${rankName}!`,
        });
      } catch (_) { /* non-critical */ }

      console.log(`Onboarding reward claimed: user ${dbUser.id} ranked up to ${newRankId}`);
      return c.json({ user: updatedUser, ranked_up: true, new_rank_id: newRankId });
    } catch (error) {
      console.error('Claim onboarding reward error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

}