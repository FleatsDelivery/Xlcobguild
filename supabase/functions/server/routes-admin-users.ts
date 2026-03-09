/**
 * Admin User Management Routes -- list users + change roles
 * 2 routes: GET /admin/users, PATCH /admin/users/:userId/role
 */
import type { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";
import { isOfficer } from './roles.ts';
import { isValidRoleDynamic } from "./routes-admin-roles.ts";
import { createAdminLog, createUserActivity } from "./routes-notifications.ts";

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
      const { role } = await c.req.json();

      if (!isValidRoleDynamic(role, supabase)) {
        return c.json({ error: 'Invalid role' }, 400);
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ role, updated_at: new Date().toISOString() })
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

      return c.json({ user: updatedUser });
    } catch (error) {
      console.error('Update user role error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

}