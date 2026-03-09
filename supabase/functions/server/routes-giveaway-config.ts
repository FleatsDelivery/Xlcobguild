/**
 * Giveaway Config Routes — Prize type CRUD via KV store
 *
 * 4 routes:
 *   GET    /giveaway-config/prize-types           — List all prize types (built-in + custom)
 *   POST   /giveaway-config/prize-types           — Create a custom prize type (officer+)
 *   PATCH  /giveaway-config/prize-types/:key      — Update a custom prize type (officer+)
 *   DELETE /giveaway-config/prize-types/:key      — Delete a custom prize type (officer+)
 *
 * Built-in types (cash, dota_plus, discount_code, physical, other) cannot be deleted
 * but CAN be edited (label, icon, color changes).
 *
 * Storage: KV store with prefix "giveaway_prize_type:"
 */
import type { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";
import { isOfficer } from "./roles.ts";
import * as kv from "./kv_store.tsx";
import { createAdminLog } from "./routes-notifications.ts";

// ── Built-in prize type defaults ──
const BUILTIN_PRIZE_TYPES = [
  { key: 'cash',          label: 'Cash',          icon: '💵', color: '#10b981', sort_order: 0, builtin: true },
  { key: 'dota_plus',     label: 'Dota Plus',     icon: '⭐', color: '#d6a615', sort_order: 1, builtin: true },
  { key: 'discount_code', label: 'Discount Code', icon: '🏷️', color: '#3b82f6', sort_order: 2, builtin: true },
  { key: 'physical',      label: 'Physical Item', icon: '📦', color: '#8b5cf6', sort_order: 3, builtin: true },
  { key: 'other',         label: 'Other',         icon: '🎁', color: '#f59e0b', sort_order: 4, builtin: true },
];

const KV_PREFIX = 'giveaway_prize_type:';

export function registerGiveawayConfigRoutes(app: Hono, supabase: any, anonSupabase: any) {

  /** Verify token + require officer-level role */
  async function requireOfficer(c: any): Promise<{ ok: true; dbUser: any } | { ok: false; response: any }> {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return { ok: false, response: c.json({ error: 'No access token provided' }, 401) };
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    if (authError || !authUser) return { ok: false, response: c.json({ error: 'Unauthorized' }, 401) };
    const { data: dbUser } = await supabase.from('users').select('*').eq('supabase_id', authUser.id).single();
    if (!dbUser) return { ok: false, response: c.json({ error: 'User not found' }, 404) };
    if (!isOfficer(dbUser.role)) return { ok: false, response: c.json({ error: 'Forbidden — officers only' }, 403) };
    return { ok: true, dbUser };
  }

  // ═══════════════════════════════════════════════════════
  // LIST ALL PRIZE TYPES
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/giveaway-config/prize-types`, async (c) => {
    try {
      // Fetch custom prize types from KV
      const customTypes = await kv.getByPrefix(KV_PREFIX);

      // Build a map of custom overrides (key -> data)
      const customMap = new Map<string, any>();
      for (const ct of customTypes) {
        // getByPrefix returns { key: "giveaway_prize_type:xyz", ...value }
        const typeKey = ct.key.replace(KV_PREFIX, '');
        customMap.set(typeKey, { ...ct, key: typeKey });
      }

      // Merge: built-in types with any custom overrides, then append purely custom types
      const builtinKeys = new Set(BUILTIN_PRIZE_TYPES.map(b => b.key));
      const merged: any[] = [];

      // First, add built-in types (with custom overrides if any)
      for (const bt of BUILTIN_PRIZE_TYPES) {
        if (customMap.has(bt.key)) {
          // Custom override of a built-in type
          const override = customMap.get(bt.key);
          merged.push({ ...bt, ...override, key: bt.key, builtin: true });
          customMap.delete(bt.key);
        } else {
          merged.push({ ...bt });
        }
      }

      // Then, add purely custom types (not overriding built-ins)
      for (const [typeKey, ct] of customMap) {
        merged.push({
          key: typeKey,
          label: ct.label || typeKey,
          icon: ct.icon || '🎁',
          color: ct.color || '#f59e0b',
          sort_order: ct.sort_order ?? 99,
          builtin: false,
        });
      }

      // Sort by sort_order
      merged.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));

      return c.json({ prize_types: merged });
    } catch (error: any) {
      console.error('List prize types error:', error);
      return c.json({ error: `Failed to list prize types: ${error.message}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // CREATE CUSTOM PRIZE TYPE
  // ═══════════════════════════════════════════════════════

  app.post(`${PREFIX}/giveaway-config/prize-types`, async (c) => {
    try {
      const auth = await requireOfficer(c);
      if (!auth.ok) return auth.response;

      const body = await c.req.json();
      const { key, label, icon, color, sort_order } = body;

      if (!key || !key.trim()) return c.json({ error: 'Key is required (e.g. "steam_gift_card")' }, 400);
      if (!label || !label.trim()) return c.json({ error: 'Label is required' }, 400);

      // Sanitize key: lowercase, underscores
      const sanitizedKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

      // Check if key already exists
      const existing = await kv.get(`${KV_PREFIX}${sanitizedKey}`);
      if (existing) return c.json({ error: `Prize type "${sanitizedKey}" already exists` }, 409);

      const prizeType = {
        label: label.trim(),
        icon: icon || '🎁',
        color: color || '#f59e0b',
        sort_order: sort_order ?? 99,
        builtin: false,
        created_at: new Date().toISOString(),
      };

      await kv.set(`${KV_PREFIX}${sanitizedKey}`, prizeType);

      console.log(`Prize type created: "${sanitizedKey}" by ${auth.dbUser.discord_username}`);

      try { await createAdminLog({ type: 'giveaway_config_created', action: `Created prize type "${prizeType.label}" (${sanitizedKey})`, actor_name: auth.dbUser.discord_username }); } catch (_) {}

      return c.json({ success: true, prize_type: { key: sanitizedKey, ...prizeType } });
    } catch (error: any) {
      console.error('Create prize type error:', error);
      return c.json({ error: `Failed to create prize type: ${error.message}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // UPDATE PRIZE TYPE (built-in or custom)
  // ═══════════════════════════════════════════════════════

  app.patch(`${PREFIX}/giveaway-config/prize-types/:key`, async (c) => {
    try {
      const auth = await requireOfficer(c);
      if (!auth.ok) return auth.response;

      const typeKey = c.req.param('key');
      const body = await c.req.json();

      // Get existing (from KV or built-in defaults)
      const builtinKeys = new Set(BUILTIN_PRIZE_TYPES.map(b => b.key));
      const isBuiltin = builtinKeys.has(typeKey);
      const existingKV = await kv.get(`${KV_PREFIX}${typeKey}`);
      const existingBuiltin = BUILTIN_PRIZE_TYPES.find(b => b.key === typeKey);

      if (!existingKV && !existingBuiltin) {
        return c.json({ error: `Prize type "${typeKey}" not found` }, 404);
      }

      // Merge updates
      const base = existingKV || existingBuiltin || {};
      const updated = {
        label: body.label?.trim() ?? base.label,
        icon: body.icon ?? base.icon,
        color: body.color ?? base.color,
        sort_order: body.sort_order ?? base.sort_order,
        builtin: isBuiltin,
        updated_at: new Date().toISOString(),
      };

      await kv.set(`${KV_PREFIX}${typeKey}`, updated);

      console.log(`Prize type updated: "${typeKey}" by ${auth.dbUser.discord_username}`);

      try { await createAdminLog({ type: 'giveaway_config_updated', action: `Updated prize type "${updated.label}" (${typeKey})`, actor_name: auth.dbUser.discord_username }); } catch (_) {}

      return c.json({ success: true, prize_type: { key: typeKey, ...updated } });
    } catch (error: any) {
      console.error('Update prize type error:', error);
      return c.json({ error: `Failed to update prize type: ${error.message}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // DELETE CUSTOM PRIZE TYPE
  // ═══════════════════════════════════════════════════════

  app.delete(`${PREFIX}/giveaway-config/prize-types/:key`, async (c) => {
    try {
      const auth = await requireOfficer(c);
      if (!auth.ok) return auth.response;

      const typeKey = c.req.param('key');

      // Cannot delete built-in types
      const builtinKeys = new Set(BUILTIN_PRIZE_TYPES.map(b => b.key));
      if (builtinKeys.has(typeKey)) {
        // Check if it's a custom override of a built-in — delete the override to reset to default
        const existingKV = await kv.get(`${KV_PREFIX}${typeKey}`);
        if (existingKV) {
          await kv.del(`${KV_PREFIX}${typeKey}`);
          console.log(`Prize type reset to default: "${typeKey}" by ${auth.dbUser.discord_username}`);

          try { await createAdminLog({ type: 'giveaway_config_updated', action: `Reset built-in prize type "${typeKey}" to default`, actor_name: auth.dbUser.discord_username }); } catch (_) {}

          return c.json({ success: true, message: `Built-in type "${typeKey}" reset to default` });
        }
        return c.json({ error: `Cannot delete built-in prize type "${typeKey}"` }, 400);
      }

      // Delete custom type
      await kv.del(`${KV_PREFIX}${typeKey}`);
      console.log(`Prize type deleted: "${typeKey}" by ${auth.dbUser.discord_username}`);

      try { await createAdminLog({ type: 'giveaway_config_deleted', action: `Deleted prize type "${typeKey}"`, actor_name: auth.dbUser.discord_username }); } catch (_) {}

      return c.json({ success: true, message: `Prize type "${typeKey}" deleted` });
    } catch (error: any) {
      console.error('Delete prize type error:', error);
      return c.json({ error: `Failed to delete prize type: ${error.message}` }, 500);
    }
  });
}