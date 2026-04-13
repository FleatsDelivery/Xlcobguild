/**
 * Admin User Management Routes -- list users + change roles
 * 2 routes: GET /admin/users, PATCH /admin/users/:userId/role
 */
import type { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";
import { isOfficer } from './roles.ts';
import { isValidRoleDynamic } from "./routes-admin-roles.ts";
import { createAdminLog, createUserActivity } from "./routes-notifications.ts";
import { syncDiscordUserRoles, syncAllDiscordRoles } from "./discord-api.ts";

export function registerAdminUsersRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // Get all users (Officers + Owner)
  app.get(`${PREFIX}/admin/users`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('role').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);
      if (!isOfficer(dbUser.role)) return c.json({ error: 'Only officers can access this endpoint' }, 403);

      const { data: users, error: usersError } = await supabase
        .from('users')
        .select(`
          *,
          ranks (
            id, name, display_order
          )
        `)
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return c.json({ error: 'Failed to fetch users' }, 500);
      }

      return c.json({ users });
    } catch (error) {
      console.error('Get users error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Update user role (Owner only)
  app.patch(`${PREFIX}/admin/users/:userId/role`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('role').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);
      if (dbUser.role !== 'owner') return c.json({ error: 'Only owners can update user roles' }, 403);

      const userId = c.req.param('userId');
      const { role, rank_id, prestige_level } = await c.req.json();

      const updatePayload: any = { updated_at: new Date().toISOString() };
      
      if (role !== undefined) {
        if (!isValidRoleDynamic(role, supabase)) {
          return c.json({ error: 'Invalid role' }, 400);
        }
        updatePayload.role = role;
      }
      
      if (rank_id !== undefined) updatePayload.rank_id = rank_id;
      if (prestige_level !== undefined) updatePayload.prestige_level = prestige_level;

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', userId).select().single();

      if (updateError) {
        console.error('Error updating user role:', updateError);
        return c.json({ error: 'Failed to update user role' }, 500);
      }

      // Fetch the actor's full info for logging
      const { data: actorUser } = await supabase
        .from('users').select('id, discord_username').eq('supabase_id', authUser.id).single();
      const actorName = actorUser?.discord_username || 'owner';
      const targetName = updatedUser.discord_username || userId;
      const oldRole = updatedUser.role; // this is already the new role after update, so we need to track it before

      // Admin log + dual-log to target user (non-critical)
      try {
        await createAdminLog({
          type: 'role_change',
          action: `Changed ${targetName}'s role to "${role}"`,
          actor_id: actorUser?.id,
          actor_name: actorName,
          details: { target_user_id: userId, new_role: role, target_name: targetName },
        });
        await createUserActivity({
          user_id: userId,
          type: 'admin_role_change',
          title: 'Role Changed',
          description: `Your role was changed to "${role}" by ${actorName}.`,
          actor_name: actorName,
        });
      } catch (logErr) { console.error('Non-critical: role change logging failed:', logErr); }

      // Sync Discord roles (background/best-effort)
      // @ts-ignore: EdgeRuntime is available in Supabase
      if (updatePayload.role || updatePayload.rank_id !== undefined || updatePayload.prestige_level !== undefined) {
        EdgeRuntime.waitUntil(syncDiscordUserRoles(supabase, userId));
      }

      return c.json({ user: updatedUser });
    } catch (error) {
      console.error('Update user role error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Reset Home Announcement Message for all users (Owner only)
  app.post(`${PREFIX}/admin/users/reset-home-message`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('role, discord_username').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);
      if (dbUser.role !== 'owner') return c.json({ error: 'Only owners can reset global announcements' }, 403);

      const { error: updateError } = await supabase
        .from('users')
        .update({ seen_home_message: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // dummy neq

      // Alternative to update all rows is to omit filters, but some clients require at least one filter
      // Actually simply `.not('id', 'is', null)` is safer:
      const { error: trueUpdateError } = await supabase
        .from('users')
        .update({ seen_home_message: false })
        .not('id', 'is', null);

      if (trueUpdateError) {
        console.error('Error resetting home messages:', trueUpdateError);
        return c.json({ error: 'Failed to reset global announcements' }, 500);
      }

      // Log the admin action
      try {
        await createAdminLog({
          type: 'announcement_reset',
          action: 'Reset seen_home_message to false for all users',
          actor_name: dbUser.discord_username || 'owner',
        });
      } catch (logErr) { console.error('Non-critical: announcement reset logging failed:', logErr); }

      return c.json({ success: true, message: 'Global announcement has been reset for all users.' });
    } catch (error) {
      console.error('Reset home announcements error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Sync All Discord Roles (Owner only - Heavy operation)
  app.post(`${PREFIX}/admin/sync-all-discord-roles`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('role').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);
      if (dbUser.role !== 'owner') return c.json({ error: 'Only owners can trigger a global sync' }, 403);

      // Trigger the heavy sync in the background
      // @ts-ignore: EdgeRuntime is available in Supabase
      EdgeRuntime.waitUntil(syncAllDiscordRoles(supabase));

      return c.json({ 
        message: 'Server-wide Discord role synchronization started in the background. Check logs for progress.',
        status: 'processing'
      });
    } catch (error) {
      console.error('Sync all discord roles error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Public/Service-Role endpoint for individual user sync (used by Bot)
  app.post(`${PREFIX}/sync-discord-user`, async (c) => {
    try {
      const { discord_id } = await c.req.json();
      if (!discord_id) return c.json({ error: 'Missing discord_id' }, 400);

      // Find user by discord_id
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('discord_id', discord_id)
        .maybeSingle();

      if (userError || !user) {
        console.error(`sync-discord-user: User not found for ${discord_id}`, userError);
        return c.json({ error: 'User not found on kernelkup.com. Please link your account first!' }, 404);
      }

      // Trigger sync in background
      // @ts-ignore: EdgeRuntime is available
      EdgeRuntime.waitUntil(syncDiscordUserRoles(supabase, user.id));

      return c.json({ success: true, message: 'Synchronization started.' });
    } catch (error) {
      console.error('Individual sync error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

}