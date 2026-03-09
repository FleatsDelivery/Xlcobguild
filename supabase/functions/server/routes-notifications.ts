/**
 * Notification Routes — Unified notification system for The Corn Field
 *
 * KV key patterns:
 *   notification:{user_id}:{sortable_id}        →  Inbox notification (things sent TO user)
 *   user_activity:{user_id}:{sortable_id}       →  User activity entry (things user DID or done TO user)
 *   admin_log:{sortable_id}                     →  Admin activity log entry (officer panel)
 *   notification_config:{slug}                   →  Notification type config
 *
 * Notification statuses: unread | read | actioned | dismissed
 */

import { PREFIX } from './helpers.ts';
import * as kv from './kv_store.tsx';

// ── Types ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  type: string;         // e.g. 'team_invite', 'mvp_reviewed', 'team_approved', 'giveaway_prize'
  title: string;
  body: string;
  status: 'unread' | 'read' | 'actioned' | 'dismissed';
  related_id?: string;  // e.g. team_id, request_id, giveaway_id
  action_url?: string;  // e.g. '#tournament-hub/abc123'
  actor_name?: string;  // who caused this notification
  actor_avatar?: string;
  metadata?: Record<string, any>;
  created_at: string;
  read_at?: string;
  actioned_at?: string;
}

export interface AdminLogEntry {
  id: string;
  type: string;         // e.g. 'user_joined', 'team_created', 'tournament_updated'
  actor_id?: string;
  actor_name?: string;
  actor_avatar?: string;
  action: string;       // human-readable: "created team Corn Dawgs"
  details?: Record<string, any>;
  created_at: string;
}

export interface NotificationTypeConfig {
  slug: string;
  label: string;
  icon: string;        // lucide icon name
  color: string;       // hex color for pill/badge
  description: string;
  enabled: boolean;
}

export interface UserActivity {
  id: string;
  user_id: string;
  type: string;           // activity type slug: 'team_joined', 'giveaway_entered', 'admin_rank_change', etc.
  title: string;          // human-readable: "Joined Team Corn Dawgs"
  description: string;    // longer context: "You accepted a team invite for Kernel Kup #10"
  related_id?: string;    // entity ID (team_id, tournament_id, etc.)
  related_url?: string;   // hash navigation: '#tournament-hub/abc123'
  actor_name?: string;    // for admin actions: "Tate"
  actor_avatar?: string;
  metadata?: Record<string, any>;  // extensible: original notification type, etc.
  frozen?: boolean;       // user-pinned: exempt from auto-pruning
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

// Generate a sortable timestamp-based ID (reverse chronological — newest first in prefix queries)
function generateSortableId(): string {
  // Use inverted timestamp so getByPrefix returns newest first
  const maxTimestamp = 9999999999999;
  const invertedTs = (maxTimestamp - Date.now()).toString().padStart(13, '0');
  const rand = Math.random().toString(36).substring(2, 8);
  return `${invertedTs}_${rand}`;
}

// Build notification KV key
function notificationKey(userId: string, sortableId: string): string {
  return `notification:${userId}:${sortableId}`;
}

// Build admin log KV key
function adminLogKey(sortableId: string): string {
  return `admin_log:${sortableId}`;
}

// Build user activity KV key
function userActivityKey(userId: string, sortableId: string): string {
  return `user_activity:${userId}:${sortableId}`;
}

// ── Public API: Create notifications (called from other route files) ──

/**
 * Create a notification for a user. Call this from any route handler.
 */
export async function createNotification(params: {
  user_id: string;
  type: string;
  title: string;
  body: string;
  related_id?: string;
  action_url?: string;
  actor_name?: string;
  actor_avatar?: string;
  metadata?: Record<string, any>;
}): Promise<Notification> {
  const sortableId = generateSortableId();
  const notification: Notification = {
    id: sortableId,
    user_id: params.user_id,
    type: params.type,
    title: params.title,
    body: params.body,
    status: 'unread',
    related_id: params.related_id,
    action_url: params.action_url,
    actor_name: params.actor_name,
    actor_avatar: params.actor_avatar,
    metadata: params.metadata,
    created_at: new Date().toISOString(),
  };

  const key = notificationKey(params.user_id, sortableId);
  await kv.set(key, notification);
  return notification;
}

/**
 * Create an admin activity log entry. Call from any route handler for significant actions.
 */
export async function createAdminLog(params: {
  type: string;
  action: string;
  actor_id?: string;
  actor_name?: string;
  actor_avatar?: string;
  details?: Record<string, any>;
}): Promise<AdminLogEntry> {
  const sortableId = generateSortableId();
  const entry: AdminLogEntry = {
    id: sortableId,
    type: params.type,
    action: params.action,
    actor_id: params.actor_id,
    actor_name: params.actor_name,
    actor_avatar: params.actor_avatar,
    details: params.details,
    created_at: new Date().toISOString(),
  };

  const key = adminLogKey(sortableId);
  await kv.set(key, entry);
  return entry;
}

/**
 * Create a user activity entry. Call from any route handler for user actions.
 * Auto-prunes old entries: removes non-frozen items older than 90 days,
 * then caps non-frozen items at 500 (oldest first).
 */
export async function createUserActivity(params: {
  user_id: string;
  type: string;
  title: string;
  description: string;
  related_id?: string;
  related_url?: string;
  actor_name?: string;
  actor_avatar?: string;
  metadata?: Record<string, any>;
  frozen?: boolean;
}): Promise<UserActivity> {
  const sortableId = generateSortableId();
  const activity: UserActivity = {
    id: sortableId,
    user_id: params.user_id,
    type: params.type,
    title: params.title,
    description: params.description,
    related_id: params.related_id,
    related_url: params.related_url,
    actor_name: params.actor_name,
    actor_avatar: params.actor_avatar,
    metadata: params.metadata,
    frozen: params.frozen || false,
    created_at: new Date().toISOString(),
  };

  const key = userActivityKey(params.user_id, sortableId);
  await kv.set(key, activity);

  // ── Auto-prune (non-critical, fire-and-forget) ──
  // Rules: delete non-frozen items >90 days old, then cap non-frozen at 500
  try {
    const PRUNE_MAX = 500;
    const PRUNE_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
    const now = Date.now();

    const allActivities: UserActivity[] = await kv.getByPrefix(`user_activity:${params.user_id}:`);

    // Separate frozen vs prunable (getByPrefix returns newest first due to inverted key)
    const prunable: UserActivity[] = [];
    const keysToDelete: string[] = [];

    for (const a of allActivities) {
      if (a.frozen) continue; // frozen items are never pruned
      const age = now - new Date(a.created_at).getTime();
      if (age > PRUNE_AGE_MS) {
        // Too old — mark for deletion
        keysToDelete.push(userActivityKey(params.user_id, a.id));
      } else {
        prunable.push(a);
      }
    }

    // Cap prunable at PRUNE_MAX (already sorted newest-first, so trim from end = oldest)
    if (prunable.length > PRUNE_MAX) {
      const excess = prunable.slice(PRUNE_MAX); // oldest non-frozen items beyond cap
      for (const a of excess) {
        keysToDelete.push(userActivityKey(params.user_id, a.id));
      }
    }

    if (keysToDelete.length > 0) {
      await kv.mdel(keysToDelete);
      console.log(`Pruned ${keysToDelete.length} activity entries for user ${params.user_id}`);
    }
  } catch (pruneErr) {
    // Prune failure should never block the write
    console.error('Non-critical: activity auto-prune failed:', pruneErr);
  }

  return activity;
}

// ── Route Registration ──────────────────────────────────────────────

export function registerNotificationRoutes(
  app: any,
  supabase: any,
  _anonSupabase: any,
) {
  // Shared auth helper
  async function requireAuth(c: any) {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return { ok: false as const, response: c.json({ error: 'No auth token' }, 401) };
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user?.id) return { ok: false as const, response: c.json({ error: 'Unauthorized' }, 401) };
    // Look up db user
    const { data: dbUser } = await supabase.from('users').select('*').eq('supabase_id', user.id).single();
    if (!dbUser) return { ok: false as const, response: c.json({ error: 'User not found in database' }, 404) };
    return { ok: true as const, user, dbUser };
  }


  // ═══════════════════════════════════════════════════════
  // 1. GET MY NOTIFICATIONS (paginated)
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/notifications`, async (c: any) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const userId = auth.dbUser.id;
      const status = c.req.query('status'); // optional: 'unread', 'read', 'actioned'
      const pending = c.req.query('pending'); // optional: 'true' → only unread + read
      const type = c.req.query('type');     // optional: filter by notification type
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      // Fetch all notifications for this user
      const all = await kv.getByPrefix(`notification:${userId}:`);

      // Sort newest first by created_at
      all.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Filter
      let filtered = all;
      if (pending === 'true') {
        // Only items the user needs to see in their inbox (not dismissed or actioned)
        filtered = filtered.filter((n: any) => n.status === 'unread' || n.status === 'read');
      } else if (status) {
        filtered = filtered.filter((n: any) => n.status === status);
      }
      if (type) {
        filtered = filtered.filter((n: any) => n.type === type);
      }

      const total = filtered.length;
      const page = filtered.slice(offset, offset + limit);
      const unreadCount = all.filter((n: any) => n.status === 'unread').length;

      // Count by type for pill badges
      const typeCounts: Record<string, number> = {};
      const unreadTypeCounts: Record<string, number> = {};
      for (const n of all) {
        typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
        if (n.status === 'unread') {
          unreadTypeCounts[n.type] = (unreadTypeCounts[n.type] || 0) + 1;
        }
      }

      return c.json({
        notifications: page,
        total,
        unread_count: unreadCount,
        type_counts: typeCounts,
        unread_type_counts: unreadTypeCounts,
        has_more: offset + limit < total,
      });
    } catch (error: any) {
      console.error('Fetch notifications error:', error);
      return c.json({ error: `Failed to fetch notifications: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 2. MARK NOTIFICATION(S) READ
  // ═══════════════════════════════════════════════════════

  app.patch(`${PREFIX}/notifications/read`, async (c: any) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const userId = auth.dbUser.id;
      const { ids, all: markAll } = await c.req.json();

      if (markAll) {
        // Mark all unread as read
        const allNotifications = await kv.getByPrefix(`notification:${userId}:`);
        const unread = allNotifications.filter((n: any) => n.status === 'unread');
        const keys: string[] = [];
        const values: any[] = [];
        for (const n of unread) {
          keys.push(notificationKey(userId, n.id));
          values.push({ ...n, status: 'read', read_at: new Date().toISOString() });
        }
        if (keys.length > 0) await kv.mset(keys, values);
        return c.json({ success: true, count: keys.length });
      }

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return c.json({ error: 'Provide ids array or all: true' }, 400);
      }

      // Mark specific IDs as read
      const keys = ids.map((id: string) => notificationKey(userId, id));
      const values = await kv.mget(keys);
      const updateKeys: string[] = [];
      const updateValues: any[] = [];
      for (let i = 0; i < keys.length; i++) {
        if (values[i] && values[i].status === 'unread') {
          updateKeys.push(keys[i]);
          updateValues.push({ ...values[i], status: 'read', read_at: new Date().toISOString() });
        }
      }
      if (updateKeys.length > 0) await kv.mset(updateKeys, updateValues);

      return c.json({ success: true, count: updateKeys.length });
    } catch (error: any) {
      console.error('Mark read error:', error);
      return c.json({ error: `Failed to mark notifications read: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 3. DISMISS NOTIFICATION
  // ═══════════════════════════════════════════════════════

  app.patch(`${PREFIX}/notifications/:id/dismiss`, async (c: any) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const userId = auth.dbUser.id;
      const notifId = c.req.param('id');
      const key = notificationKey(userId, notifId);
      const existing = await kv.get(key);
      if (!existing) return c.json({ error: 'Notification not found' }, 404);

      await kv.set(key, { ...existing, status: 'dismissed' });

      // Create activity entry for the dismissed notification (non-critical)
      try {
        await createUserActivity({
          user_id: userId,
          type: 'notification_dismissed',
          title: `Dismissed: ${existing.title}`,
          description: existing.body || `Dismissed a ${existing.type} notification`,
          related_id: existing.related_id,
          related_url: existing.action_url,
          metadata: { original_type: existing.type, original_notification_id: notifId },
        });
      } catch (actErr) {
        console.error('Non-critical: failed to create activity for dismiss:', actErr);
      }

      return c.json({ success: true });
    } catch (error: any) {
      console.error('Dismiss notification error:', error);
      return c.json({ error: `Failed to dismiss notification: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 3b. MARK NOTIFICATION AS ACTIONED
  // Lightweight status flip — no duplicate activity created.
  // Used when the caller already handled the action (e.g. invite accept/decline)
  // and just needs the notification removed from the inbox.
  // ═══════════════════════════════════════════════════════

  app.patch(`${PREFIX}/notifications/:id/action`, async (c: any) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const userId = auth.dbUser.id;
      const notifId = c.req.param('id');
      const key = notificationKey(userId, notifId);
      const existing = await kv.get(key);

      if (!existing) {
        // Already gone or never existed — that's fine, the goal is "not in inbox"
        return c.json({ success: true, already_gone: true });
      }

      if (existing.status === 'actioned' || existing.status === 'dismissed') {
        return c.json({ success: true, already_actioned: true });
      }

      await kv.set(key, { ...existing, status: 'actioned', actioned_at: new Date().toISOString() });

      return c.json({ success: true });
    } catch (error: any) {
      console.error('Mark notification actioned error:', error);
      return c.json({ error: `Failed to mark notification actioned: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 4. UNREAD COUNT (lightweight poll endpoint)
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/notifications/unread-count`, async (c: any) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const userId = auth.dbUser.id;
      const all = await kv.getByPrefix(`notification:${userId}:`);
      const unreadCount = all.filter((n: any) => n.status === 'unread').length;

      return c.json({ unread_count: unreadCount });
    } catch (error: any) {
      console.error('Unread count error:', error);
      return c.json({ error: `Failed to fetch unread count: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 4b. GET MY ACTIVITY (personal audit trail, paginated)
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/user-activity`, async (c: any) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const userId = auth.dbUser.id;
      const type = c.req.query('type');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      let all = await kv.getByPrefix(`user_activity:${userId}:`);

      // Sort newest first by created_at
      all.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (type) {
        all = all.filter((a: any) => a.type === type);
      }

      const total = all.length;
      const page = all.slice(offset, offset + limit);

      // Count by type for filter pills
      const typeCounts: Record<string, number> = {};
      for (const a of all) {
        typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
      }

      return c.json({
        activities: page,
        total,
        type_counts: typeCounts,
        has_more: offset + limit < total,
      });
    } catch (error: any) {
      console.error('Fetch user activity error:', error);
      return c.json({ error: `Failed to fetch user activity: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 4c. TOGGLE FREEZE ON ACTIVITY ENTRY
  // ═══════════════════════════════════════════════════════

  app.patch(`${PREFIX}/user-activity/:id/freeze`, async (c: any) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const userId = auth.dbUser.id;
      const activityId = c.req.param('id');
      const key = userActivityKey(userId, activityId);
      const existing = await kv.get(key);

      if (!existing) return c.json({ error: 'Activity entry not found' }, 404);
      if (existing.user_id !== userId) return c.json({ error: 'Not your activity entry' }, 403);

      const newFrozen = !existing.frozen;
      await kv.set(key, { ...existing, frozen: newFrozen });

      return c.json({ success: true, frozen: newFrozen });
    } catch (error: any) {
      console.error('Toggle freeze error:', error);
      return c.json({ error: `Failed to toggle freeze: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 5. ADMIN ACTIVITY LOG (officers only)
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/admin/activity-log`, async (c: any) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      // Officers and owners only
      const role = auth.dbUser.role;
      if (role !== 'owner' && role !== 'officer') {
        return c.json({ error: 'Only officers can view the admin activity log' }, 403);
      }

      const limit = parseInt(c.req.query('limit') || '100');
      const offset = parseInt(c.req.query('offset') || '0');
      const type = c.req.query('type');

      let all = await kv.getByPrefix('admin_log:');

      // Sort newest first by created_at
      all.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Compute type counts from full dataset (before filtering/pagination)
      const typeCounts: Record<string, number> = {};
      for (const e of all) {
        if (e.type) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
      }

      if (type) {
        all = all.filter((e: any) => e.type === type);
      }

      const total = all.length;
      const page = all.slice(offset, offset + limit);

      return c.json({
        entries: page,
        total,
        type_counts: typeCounts,
        has_more: offset + limit < total,
      });
    } catch (error: any) {
      console.error('Admin activity log error:', error);
      return c.json({ error: `Failed to fetch activity log: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 6. NOTIFICATION TYPE CONFIGS (CRUD — officers only for write, public for read)
  // ═══════════════════════════════════════════════════════

  // GET all notification type configs
  app.get(`${PREFIX}/notification-configs`, async (c: any) => {
    try {
      const configs = await kv.getByPrefix('notification_config:');
      return c.json({ configs });
    } catch (error: any) {
      console.error('Fetch notification configs error:', error);
      return c.json({ error: `Failed to fetch notification configs: ${error.message}` }, 500);
    }
  });

  // PUT a notification type config (upsert — officers only)
  app.put(`${PREFIX}/notification-configs/:slug`, async (c: any) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;
      if (auth.dbUser.role !== 'owner' && auth.dbUser.role !== 'officer') {
        return c.json({ error: 'Only officers can manage notification configs' }, 403);
      }

      const slug = c.req.param('slug');
      const body = await c.req.json();

      const config: NotificationTypeConfig = {
        slug,
        label: body.label || slug,
        icon: body.icon || 'Bell',
        color: body.color || '#6b7280',
        description: body.description || '',
        enabled: body.enabled !== false,
      };

      await kv.set(`notification_config:${slug}`, config);
      return c.json({ success: true, config });
    } catch (error: any) {
      console.error('Update notification config error:', error);
      return c.json({ error: `Failed to update notification config: ${error.message}` }, 500);
    }
  });

  // DELETE a notification type config (officers only)
  app.delete(`${PREFIX}/notification-configs/:slug`, async (c: any) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;
      if (auth.dbUser.role !== 'owner' && auth.dbUser.role !== 'officer') {
        return c.json({ error: 'Only officers can manage notification configs' }, 403);
      }

      const slug = c.req.param('slug');
      await kv.del(`notification_config:${slug}`);
      return c.json({ success: true });
    } catch (error: any) {
      console.error('Delete notification config error:', error);
      return c.json({ error: `Failed to delete notification config: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 7. SEED DEFAULT NOTIFICATION CONFIGS (one-time setup)
  // ═══════════════════════════════════════════════════════

  app.post(`${PREFIX}/notification-configs/seed-defaults`, async (c: any) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;
      if (auth.dbUser.role !== 'owner') {
        return c.json({ error: 'Only the owner can seed defaults' }, 403);
      }

      const defaults: NotificationTypeConfig[] = [
        { slug: 'team_invite', label: 'Team Invite', icon: 'UserPlus', color: '#8b5cf6', description: 'Invitations to join a team', enabled: true },
        { slug: 'team_approved', label: 'Team Approved', icon: 'CheckCircle', color: '#10b981', description: 'Your team was approved', enabled: true },
        { slug: 'team_denied', label: 'Team Denied', icon: 'XCircle', color: '#ef4444', description: 'Your team was denied', enabled: true },
        { slug: 'mvp_reviewed', label: 'MVP Reviewed', icon: 'Star', color: '#f59e0b', description: 'Your MVP request was reviewed', enabled: true },
        { slug: 'giveaway_prize', label: 'Giveaway Prize', icon: 'Gift', color: '#d6a615', description: 'You won a giveaway prize', enabled: true },
        { slug: 'tournament_update', label: 'Tournament Update', icon: 'Trophy', color: '#3b82f6', description: 'Tournament status changed', enabled: true },
        { slug: 'staff_app_result', label: 'Staff App Result', icon: 'Shield', color: '#6366f1', description: 'Your staff application was reviewed', enabled: true },
        { slug: 'system', label: 'System', icon: 'Bell', color: '#6b7280', description: 'System notifications', enabled: true },
      ];

      const keys = defaults.map(d => `notification_config:${d.slug}`);
      const values = defaults;
      await kv.mset(keys, values);

      return c.json({ success: true, count: defaults.length });
    } catch (error: any) {
      console.error('Seed defaults error:', error);
      return c.json({ error: `Failed to seed defaults: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 8. OFFICER PENDING COUNT (lightweight badge endpoint)
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/officer/pending-count`, async (c: any) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const role = auth.dbUser.role;
      if (role !== 'owner' && role !== 'officer') {
        return c.json({ pending_count: 0 });
      }

      let count = 0;

      // 1. Pending team approvals (across all tournaments)
      try {
        const { count: teamCount } = await supabase
          .from('kkup_teams')
          .select('*', { count: 'exact', head: true })
          .eq('approval_status', 'pending_approval');
        count += teamCount || 0;
      } catch (_) { /* non-critical */ }

      // 2. Pending MVP requests
      try {
        const { count: mvpCount } = await supabase
          .from('rank_up_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        count += mvpCount || 0;
      } catch (_) { /* non-critical */ }

      // 3. Pending staff applications (KV-based — scan all tournaments)
      try {
        const { data: tournaments } = await supabase
          .from('kkup_tournaments')
          .select('id')
          .in('status', ['upcoming', 'registration_open', 'registration_closed']);
        for (const t of (tournaments || [])) {
          const apps = await kv.getByPrefix(`staff_app:${t.id}:`);
          for (const item of (apps || [])) {
            try {
              // Robust parsing: handle objects (new) and legacy JSON strings
              let app: any;
              if (typeof item === 'string') {
                app = JSON.parse(item);
              } else if (item?.value && typeof item.value === 'string') {
                app = JSON.parse(item.value);
              } else if (item?.value && typeof item.value === 'object') {
                app = item.value;
              } else {
                app = item;
              }
              if (app?.status === 'pending') count++;
            } catch { /* skip bad entries */ }
          }
        }
      } catch (_) { /* non-critical */ }

      return c.json({ pending_count: count });
    } catch (error: any) {
      console.error('Officer pending count error:', error);
      return c.json({ pending_count: 0 });
    }
  });
}