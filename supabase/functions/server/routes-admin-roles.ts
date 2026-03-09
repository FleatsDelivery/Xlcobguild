/**
 * Guild Role Management Routes — backed by the `roles` table.
 *
 * The `roles` table is the single source of truth for every role in the system.
 * Built-in roles have `is_builtin = true` and cannot be deleted via the API.
 * Custom roles have `is_builtin = false` and are fully CRUD-able by the owner.
 *
 * 5 routes:
 *   GET    /roles                  — list ALL roles (public, any authenticated user)
 *   POST   /roles                  — create a new custom role (owner only)
 *   PUT    /roles/:value           — update any role's display properties (owner only)
 *   GET    /roles/:value/users     — count users with this role (owner only)
 *   DELETE /roles/:value           — delete a custom role + reassign users to guest (owner only)
 */
import type { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";
import { createAdminLog, createUserActivity, createNotification } from "./routes-notifications.ts";

/** Shape returned by the API (camelCase for frontend) */
export interface RoleRow {
  value: string;
  displayName: string;
  badgeTag: string;
  hex: string;
  tier: "owner" | "officer" | "member" | "guest";
  isBuiltin: boolean;
  sortOrder: number;
}

/** Convert a DB row (snake_case) to the API shape (camelCase) */
function toApiRole(row: any): RoleRow {
  return {
    value: row.value,
    displayName: row.display_name,
    badgeTag: row.badge_tag,
    hex: row.hex,
    tier: row.tier,
    isBuiltin: row.is_builtin,
    sortOrder: row.sort_order,
  };
}

/** Check if a role value exists in the `roles` table */
export async function isValidRoleDynamic(role: string, supabase: any): Promise<boolean> {
  const { data, error } = await supabase
    .from("roles")
    .select("value")
    .eq("value", role)
    .maybeSingle();
  if (error) {
    console.error("isValidRoleDynamic error:", error);
    return false;
  }
  return !!data;
}

export function registerAdminRolesRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ── GET /roles — All roles (any authenticated user) ───────────────
  app.get(`${PREFIX}/roles`, async (c) => {
    try {
      const accessToken = c.req.header("Authorization")?.split(" ")[1];
      if (!accessToken) return c.json({ error: "No access token" }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: "Unauthorized" }, 401);

      const { data: rows, error: dbError } = await supabase
        .from("roles")
        .select("*")
        .order("sort_order", { ascending: true });

      if (dbError) {
        console.error("Error fetching roles from DB:", dbError);
        return c.json({ error: "Failed to fetch roles" }, 500);
      }

      const roles = (rows || []).map(toApiRole);
      return c.json({ roles });
    } catch (error) {
      console.error("Get roles error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ── POST /roles — Create a custom role (owner only) ───────────────
  app.post(`${PREFIX}/roles`, async (c) => {
    try {
      const accessToken = c.req.header("Authorization")?.split(" ")[1];
      if (!accessToken) return c.json({ error: "No access token" }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: "Unauthorized" }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from("users").select("role").eq("supabase_id", authUser.id).single();
      if (userError || !dbUser) return c.json({ error: "User not found" }, 404);
      if (dbUser.role !== "owner") return c.json({ error: "Only the owner can create roles" }, 403);

      const body = await c.req.json();
      const { value, displayName, badgeTag, hex, tier } = body;

      // Validate required fields
      if (!value || !displayName || !badgeTag || !hex) {
        return c.json({ error: "Missing required fields: value, displayName, badgeTag, hex" }, 400);
      }

      // Sanitize value: lowercase, alphanumeric + underscores only
      const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      if (sanitized.length < 2 || sanitized.length > 30) {
        return c.json({ error: "Role value must be 2-30 characters (a-z, 0-9, _)" }, 400);
      }

      // Check collision — just try to select by PK
      const { data: existing } = await supabase
        .from("roles").select("value").eq("value", sanitized).maybeSingle();
      if (existing) {
        return c.json({ error: `Role "${sanitized}" already exists` }, 409);
      }

      // Determine sort_order: max existing + 10
      const { data: maxRow } = await supabase
        .from("roles")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSort = (maxRow?.sort_order ?? 60) + 10;

      const safeTier = ["member", "officer"].includes(tier) ? tier : "member";

      const { data: inserted, error: insertError } = await supabase
        .from("roles")
        .insert({
          value: sanitized,
          display_name: displayName.trim(),
          badge_tag: badgeTag.trim().toUpperCase().slice(0, 5),
          hex: hex.startsWith("#") ? hex : `#${hex}`,
          tier: safeTier,
          is_builtin: false,
          sort_order: nextSort,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting role:", insertError);
        return c.json({ error: `Failed to create role: ${insertError.message}` }, 500);
      }

      const role = toApiRole(inserted);
      console.log(`Created role: ${role.value} (${role.displayName})`);

      // Admin log (non-critical)
      try {
        await createAdminLog({
          type: 'role_created',
          action: `Created guild role "${role.displayName}" (${role.value}, tier: ${role.tier})`,
          actor_name: 'Owner',
          details: { role_value: role.value, display_name: role.displayName, tier: role.tier },
        });
      } catch (logErr) {
        console.error('Non-critical: admin log for role creation failed:', logErr);
      }

      return c.json({ role }, 201);
    } catch (error) {
      console.error("Create role error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ── PUT /roles/:value — Update any role's display properties (owner only) ────────
  app.put(`${PREFIX}/roles/:value`, async (c) => {
    try {
      const accessToken = c.req.header("Authorization")?.split(" ")[1];
      if (!accessToken) return c.json({ error: "No access token" }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: "Unauthorized" }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from("users").select("role").eq("supabase_id", authUser.id).single();
      if (userError || !dbUser) return c.json({ error: "User not found" }, 404);
      if (dbUser.role !== "owner") return c.json({ error: "Only the owner can update roles" }, 403);

      const roleValue = c.req.param("value");

      // Check it exists
      const { data: target } = await supabase
        .from("roles").select("value, is_builtin, tier").eq("value", roleValue).maybeSingle();

      if (!target) {
        return c.json({ error: `Role "${roleValue}" not found` }, 404);
      }

      const body = await c.req.json();
      const { displayName, badgeTag, hex, tier } = body;

      // Validate required fields
      if (!displayName || !badgeTag || !hex) {
        return c.json({ error: "Missing required fields: displayName, badgeTag, hex" }, 400);
      }

      // Built-in roles: only allow display property changes, keep original tier
      // Custom roles: allow tier changes too
      const updatePayload: Record<string, any> = {
        display_name: displayName.trim(),
        badge_tag: badgeTag.trim().toUpperCase().slice(0, 5),
        hex: hex.startsWith("#") ? hex : `#${hex}`,
      };

      if (!target.is_builtin) {
        updatePayload.tier = ["member", "officer"].includes(tier) ? tier : "member";
      }

      const { data: updated, error: updateError } = await supabase
        .from("roles")
        .update(updatePayload)
        .eq("value", roleValue)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating role:", updateError);
        return c.json({ error: `Failed to update role: ${updateError.message}` }, 500);
      }

      const role = toApiRole(updated);
      console.log(`Updated role: ${role.value} (${role.displayName})`);

      // Admin log (non-critical)
      try {
        await createAdminLog({
          type: 'role_updated',
          action: `Updated guild role "${role.displayName}" (${role.value})`,
          actor_name: 'Owner',
          details: { role_value: role.value, display_name: role.displayName },
        });
      } catch (logErr) {
        console.error('Non-critical: admin log for role update failed:', logErr);
      }

      return c.json({ role });
    } catch (error) {
      console.error("Update role error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ── GET /roles/:value/users — Count users with this role (owner only) ────────
  app.get(`${PREFIX}/roles/:value/users`, async (c) => {
    try {
      const accessToken = c.req.header("Authorization")?.split(" ")[1];
      if (!accessToken) return c.json({ error: "No access token" }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: "Unauthorized" }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from("users").select("role").eq("supabase_id", authUser.id).single();
      if (userError || !dbUser) return c.json({ error: "User not found" }, 404);
      if (dbUser.role !== "owner") return c.json({ error: "Only the owner can count users with roles" }, 403);

      const roleValue = c.req.param("value");

      // Check it exists and is not built-in
      const { data: target } = await supabase
        .from("roles").select("value, is_builtin").eq("value", roleValue).maybeSingle();

      if (!target) {
        return c.json({ error: `Role "${roleValue}" not found` }, 404);
      }
      if (target.is_builtin) {
        return c.json({ error: `Cannot count users with built-in role "${roleValue}"` }, 403);
      }

      const { data: userCount, error: countError } = await supabase
        .from("users")
        .select("role", { count: "exact" })
        .eq("role", roleValue);

      if (countError) {
        console.error("Error counting users with role:", countError);
        return c.json({ error: `Failed to count users with role: ${countError.message}` }, 500);
      }

      const count = userCount?.length || 0;
      console.log(`Counted users with role: ${roleValue} (${count})`);
      return c.json({ count });
    } catch (error) {
      console.error("Count users with role error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ── DELETE /roles/:value — Delete a custom role + reassign users to guest (owner only) ──────
  app.delete(`${PREFIX}/roles/:value`, async (c) => {
    try {
      const accessToken = c.req.header("Authorization")?.split(" ")[1];
      if (!accessToken) return c.json({ error: "No access token" }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: "Unauthorized" }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from("users").select("role").eq("supabase_id", authUser.id).single();
      if (userError || !dbUser) return c.json({ error: "User not found" }, 404);
      if (dbUser.role !== "owner") return c.json({ error: "Only the owner can delete roles" }, 403);

      const roleValue = c.req.param("value");

      // Check it exists and is not built-in
      const { data: target } = await supabase
        .from("roles").select("value, is_builtin").eq("value", roleValue).maybeSingle();

      if (!target) {
        return c.json({ error: `Role "${roleValue}" not found` }, 404);
      }
      if (target.is_builtin) {
        return c.json({ error: `Cannot delete built-in role "${roleValue}"` }, 403);
      }

      // Reassign users with this role to "guest"
      const { data: affectedUsers } = await supabase
        .from("users")
        .select("id, discord_username")
        .eq("role", roleValue);
      const affectedCount = affectedUsers?.length || 0;

      const { error: reassignError } = await supabase
        .from("users")
        .update({ role: "guest" })
        .eq("role", roleValue);

      if (reassignError) {
        console.error("Error reassigning users to guest:", reassignError);
        return c.json({ error: `Failed to reassign users to guest: ${reassignError.message}` }, 500);
      }

      const { error: deleteError } = await supabase
        .from("roles").delete().eq("value", roleValue);

      if (deleteError) {
        console.error("Error deleting role:", deleteError);
        return c.json({ error: `Failed to delete role: ${deleteError.message}` }, 500);
      }

      console.log(`Deleted role: ${roleValue} (${affectedCount} users reassigned to guest)`);

      // Admin log + notify affected users (non-critical)
      try {
        await createAdminLog({
          type: 'role_deleted',
          action: `Deleted guild role "${roleValue}" — ${affectedCount} user(s) reassigned to Guest`,
          actor_name: 'Owner',
          details: { role_value: roleValue, affected_users: affectedCount },
        });

        // Notify each affected user
        if (affectedUsers && affectedUsers.length > 0) {
          for (const user of affectedUsers) {
            try {
              await createUserActivity({
                user_id: user.id,
                type: 'admin_role_removed',
                title: 'Guild Role Removed',
                description: `Your guild role "${roleValue}" was deleted by the owner. You have been moved to Guest.`,
                actor_name: 'Owner',
              });
              await createNotification({
                user_id: user.id,
                type: 'role_removed',
                title: 'Guild Role Removed',
                body: `Your guild "${roleValue}" was deleted. You've been moved to Guest — you can join a new guild anytime.`,
                actor_name: 'Owner',
              });
            } catch (_) { /* non-critical per-user */ }
          }
        }
      } catch (logErr) {
        console.error('Non-critical: admin log for role deletion failed:', logErr);
      }

      return c.json({ deleted: roleValue });
    } catch (error) {
      console.error("Delete role error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });
}