/**
 * Guild Wars — Guild Routes
 * CRUD for guilds, join/leave, Discord role sync.
 *
 * 7 routes:
 *   GET    /guilds              — list all guilds (with member counts)
 *   GET    /guilds/:id          — single guild detail
 *   POST   /guilds              — create a guild (any authenticated user)
 *   PATCH  /guilds/:id          — update guild (creator or officer)
 *   DELETE /guilds/:id          — delete guild (creator or officer, not defaults)
 *   POST   /guilds/:id/join     — join a guild (handles rank reset on switch)
 *   POST   /guilds/:id/leave    — leave guild → Unaffiliated
 */
import type { Hono } from "npm:hono";
import { PREFIX, requireAuth } from "./helpers.ts";
import { isOfficer } from "./roles.ts";
import { DISCORD_SERVER_ID } from "./discord-config.ts";
import { createNotification, createAdminLog, createUserActivity } from "./routes-notifications.ts";

// ── Discord API Helpers ─────────────────────────────────────────────

const DISCORD_API = 'https://discord.com/api/v10';

/** Create a Discord role in the TCF server. Returns the role ID or null. */
async function createDiscordRole(name: string, color: string): Promise<string | null> {
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!botToken) { console.error('DISCORD_BOT_TOKEN not set — skipping role creation'); return null; }

  // Convert hex color to decimal integer
  const colorInt = parseInt(color.replace('#', ''), 16);

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${DISCORD_SERVER_ID}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bot ${botToken}` },
      body: JSON.stringify({ name, color: colorInt, permissions: '0', mentionable: true }),
    });
    if (!res.ok) { console.error('Discord role create failed:', res.status, await res.text()); return null; }
    const role = await res.json();
    console.log(`Created Discord role "${name}" → ${role.id}`);
    return role.id;
  } catch (err) { console.error('Discord role create error:', err); return null; }
}

/** Update a Discord role's name/color. */
async function updateDiscordRole(roleId: string, updates: { name?: string; color?: string }): Promise<void> {
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!botToken || !roleId) return;

  const body: any = {};
  if (updates.name) body.name = updates.name;
  if (updates.color) body.color = parseInt(updates.color.replace('#', ''), 16);

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${DISCORD_SERVER_ID}/roles/${roleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bot ${botToken}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error('Discord role update failed:', res.status, await res.text());
  } catch (err) { console.error('Discord role update error:', err); }
}

/** Delete a Discord role. */
async function deleteDiscordRole(roleId: string): Promise<void> {
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!botToken || !roleId) return;

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${DISCORD_SERVER_ID}/roles/${roleId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bot ${botToken}` },
    });
    if (!res.ok) console.error('Discord role delete failed:', res.status, await res.text());
  } catch (err) { console.error('Discord role delete error:', err); }
}

/** Add a Discord role to a user. */
async function addDiscordRoleToUser(discordUserId: string, roleId: string): Promise<void> {
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!botToken || !roleId || !discordUserId) return;

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${DISCORD_SERVER_ID}/members/${discordUserId}/roles/${roleId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bot ${botToken}` },
    });
    if (!res.ok) console.error(`Discord add role ${roleId} to user ${discordUserId} failed:`, res.status, await res.text());
  } catch (err) { console.error('Discord add role error:', err); }
}

/** Remove a Discord role from a user. */
async function removeDiscordRoleFromUser(discordUserId: string, roleId: string): Promise<void> {
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!botToken || !roleId || !discordUserId) return;

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${DISCORD_SERVER_ID}/members/${discordUserId}/roles/${roleId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bot ${botToken}` },
    });
    if (!res.ok) console.error(`Discord remove role ${roleId} from user ${discordUserId} failed:`, res.status, await res.text());
  } catch (err) { console.error('Discord remove role error:', err); }
}

// ── Route Registration ──────────────────────────────────────────────

export function registerGuildRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ── GET /guilds — List all guilds with member counts ──────────────
  app.get(`${PREFIX}/guilds`, async (c) => {
    try {
      // Fetch all guilds
      const { data: guilds, error } = await supabase
        .from('guild_wars_guilds')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) return c.json({ error: `Failed to fetch guilds: ${error.message}` }, 500);

      // Get member counts per guild from users table
      const { data: counts } = await supabase
        .from('users')
        .select('guild_id')
        .not('guild_id', 'is', null);

      const countMap: Record<string, number> = {};
      for (const u of (counts || [])) {
        countMap[u.guild_id] = (countMap[u.guild_id] || 0) + 1;
      }

      const guildsWithCounts = (guilds || []).map((g: any) => ({
        ...g,
        member_count: countMap[g.id] || 0,
      }));

      return c.json({ guilds: guildsWithCounts });
    } catch (error: any) {
      console.error('List guilds error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ── GET /guilds/:id — Single guild detail ─────────────────────────
  app.get(`${PREFIX}/guilds/:id`, async (c) => {
    try {
      const guildId = c.req.param('id');
      const { data: guild, error } = await supabase
        .from('guild_wars_guilds')
        .select('*')
        .eq('id', guildId)
        .single();

      if (error || !guild) return c.json({ error: 'Guild not found' }, 404);

      // Get members
      const { data: members } = await supabase
        .from('users')
        .select('id, discord_username, discord_avatar, rank_id, prestige_level, role')
        .eq('guild_id', guildId)
        .order('rank_id', { ascending: false });

      // Get active season MVP count for this guild
      const { data: activeSeason } = await supabase
        .from('guild_wars_seasons')
        .select('id')
        .eq('status', 'active')
        .single();

      let mvpCount = 0;
      if (activeSeason) {
        const { count } = await supabase
          .from('rank_up_requests')
          .select('id', { count: 'exact', head: true })
          .eq('guild_id', guildId)
          .eq('season_id', activeSeason.id)
          .eq('status', 'approved');
        mvpCount = count || 0;
      }

      return c.json({
        guild: { ...guild, member_count: (members || []).length, mvp_count: mvpCount },
        members: members || [],
      });
    } catch (error: any) {
      console.error('Get guild detail error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ── POST /guilds — Create a new guild ─────────────────────────────
  app.post(`${PREFIX}/guilds`, async (c) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      const { name, tag, color, logo_url, description, from_master_team_id } = await c.req.json();

      // Validation
      if (!name || name.trim().length < 2) return c.json({ error: 'Guild name must be at least 2 characters' }, 400);
      if (!name || name.trim().length > 30) return c.json({ error: 'Guild name cannot exceed 30 characters' }, 400);
      if (!color) return c.json({ error: 'Guild color is required' }, 400);
      if (!logo_url) return c.json({ error: 'Guild logo is required' }, 400);
      if (tag && tag.trim().length > 5) return c.json({ error: 'Guild tag cannot exceed 5 characters' }, 400);

      // Check for duplicate name
      const { data: existing } = await supabase
        .from('guild_wars_guilds')
        .select('id')
        .ilike('name', name.trim())
        .maybeSingle();
      if (existing) return c.json({ error: 'A guild with this name already exists' }, 409);

      // Check if user already created a guild (one guild per creator)
      const { data: ownedGuild } = await supabase
        .from('guild_wars_guilds')
        .select('id, name')
        .eq('created_by', dbUser.id)
        .maybeSingle();
      if (ownedGuild) return c.json({ error: `You already own a guild: "${ownedGuild.name}". Each user can create one guild.` }, 409);

      // Create Discord role
      const discordRoleId = await createDiscordRole(name.trim(), color);

      // Insert guild
      const { data: guild, error: insertError } = await supabase
        .from('guild_wars_guilds')
        .insert({
          name: name.trim(),
          tag: tag?.trim().toUpperCase() || null,
          color,
          logo_url,
          description: description?.trim() || null,
          created_by: dbUser.id,
          from_master_team_id: from_master_team_id || null,
          is_default: false,
          is_open: true,
          discord_role_id: discordRoleId,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Guild creation failed:', insertError);
        // Clean up Discord role if guild insert failed
        if (discordRoleId) deleteDiscordRole(discordRoleId);
        return c.json({ error: `Failed to create guild: ${insertError.message}` }, 500);
      }

      // Auto-join the creator to their guild
      await supabase
        .from('users')
        .update({ guild_id: guild.id, updated_at: new Date().toISOString() })
        .eq('id', dbUser.id);

      // Set role to member if guest
      if (dbUser.role === 'guest') {
        await supabase
          .from('users')
          .update({ role: 'member' })
          .eq('id', dbUser.id);
      }

      // Create membership record
      await supabase
        .from('guild_wars_memberships')
        .insert({ user_id: dbUser.id, guild_id: guild.id });

      // Assign Discord role to creator
      if (discordRoleId && dbUser.discord_id) {
        addDiscordRoleToUser(dbUser.discord_id, discordRoleId);
      }

      // Remove old guild Discord role if they had one
      if (dbUser.guild_id && dbUser.guild_id !== guild.id) {
        const { data: oldGuild } = await supabase
          .from('guild_wars_guilds')
          .select('discord_role_id')
          .eq('id', dbUser.guild_id)
          .maybeSingle();
        if (oldGuild?.discord_role_id && dbUser.discord_id) {
          removeDiscordRoleFromUser(dbUser.discord_id, oldGuild.discord_role_id);
        }

        // Close old membership
        await supabase
          .from('guild_wars_memberships')
          .update({ left_at: new Date().toISOString(), rank_on_leave: dbUser.rank_id, prestige_on_leave: dbUser.prestige_level })
          .eq('user_id', dbUser.id)
          .is('left_at', null);
      }

      // Log
      try {
        await createUserActivity({
          user_id: dbUser.id,
          type: 'guild_created',
          title: `Created Guild: ${guild.name}`,
          description: `You created the guild "${guild.name}" and were auto-joined.`,
          related_id: guild.id,
        });
        await createAdminLog({
          type: 'guild_created',
          action: `${dbUser.discord_username} created guild "${guild.name}"`,
          actor_id: dbUser.id,
          actor_name: dbUser.discord_username,
          details: { guild_id: guild.id, guild_name: guild.name },
        });
      } catch (_) { /* non-critical */ }

      console.log(`Guild created: "${guild.name}" by ${dbUser.discord_username} (discord role: ${discordRoleId})`);
      return c.json({ guild });
    } catch (error: any) {
      console.error('Create guild error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ── PATCH /guilds/:id — Update guild ──────────────────────────────
  app.patch(`${PREFIX}/guilds/:id`, async (c) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      const guildId = c.req.param('id');
      const { data: guild, error: fetchError } = await supabase
        .from('guild_wars_guilds')
        .select('*')
        .eq('id', guildId)
        .single();

      if (fetchError || !guild) return c.json({ error: 'Guild not found' }, 404);

      // Only creator or officers can edit
      if (guild.created_by !== dbUser.id && !isOfficer(dbUser.role)) {
        return c.json({ error: 'Only the guild creator or officers can update this guild' }, 403);
      }

      const body = await c.req.json();
      const updates: any = { updated_at: new Date().toISOString() };

      if (body.name !== undefined) updates.name = body.name.trim();
      if (body.tag !== undefined) updates.tag = body.tag?.trim().toUpperCase() || null;
      if (body.color !== undefined) updates.color = body.color;
      if (body.logo_url !== undefined) updates.logo_url = body.logo_url;
      if (body.description !== undefined) updates.description = body.description?.trim() || null;
      if (body.is_open !== undefined) updates.is_open = body.is_open;

      const { data: updatedGuild, error: updateError } = await supabase
        .from('guild_wars_guilds')
        .update(updates)
        .eq('id', guildId)
        .select()
        .single();

      if (updateError) return c.json({ error: `Failed to update guild: ${updateError.message}` }, 500);

      // Sync Discord role if name or color changed
      if (guild.discord_role_id && (body.name || body.color)) {
        updateDiscordRole(guild.discord_role_id, {
          name: body.name?.trim(),
          color: body.color,
        });
      }

      return c.json({ guild: updatedGuild });
    } catch (error: any) {
      console.error('Update guild error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ── DELETE /guilds/:id — Delete guild ─────────────────────────────
  app.delete(`${PREFIX}/guilds/:id`, async (c) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      const guildId = c.req.param('id');
      const { data: guild, error: fetchError } = await supabase
        .from('guild_wars_guilds')
        .select('*')
        .eq('id', guildId)
        .single();

      if (fetchError || !guild) return c.json({ error: 'Guild not found' }, 404);
      if (guild.is_default) return c.json({ error: 'Default guilds cannot be deleted' }, 403);
      if (guild.created_by !== dbUser.id && !isOfficer(dbUser.role)) {
        return c.json({ error: 'Only the guild creator or officers can delete this guild' }, 403);
      }

      // Move all members to Unaffiliated
      const { data: unaffiliated } = await supabase
        .from('guild_wars_guilds')
        .select('id')
        .eq('name', 'Unaffiliated')
        .single();

      if (unaffiliated) {
        // Close all active memberships
        await supabase
          .from('guild_wars_memberships')
          .update({ left_at: new Date().toISOString() })
          .eq('guild_id', guildId)
          .is('left_at', null);

        // Move users to Unaffiliated
        const { data: affectedUsers } = await supabase
          .from('users')
          .select('id, discord_id')
          .eq('guild_id', guildId);

        await supabase
          .from('users')
          .update({ guild_id: unaffiliated.id })
          .eq('guild_id', guildId);

        // Create Unaffiliated membership records
        for (const user of (affectedUsers || [])) {
          await supabase.from('guild_wars_memberships').insert({ user_id: user.id, guild_id: unaffiliated.id });
          // Remove Discord role from displaced users
          if (guild.discord_role_id && user.discord_id) {
            removeDiscordRoleFromUser(user.discord_id, guild.discord_role_id);
          }
        }
      }

      // Delete the Discord role
      if (guild.discord_role_id) {
        deleteDiscordRole(guild.discord_role_id);
      }

      // Delete the guild
      const { error: deleteError } = await supabase
        .from('guild_wars_guilds')
        .delete()
        .eq('id', guildId);

      if (deleteError) return c.json({ error: `Failed to delete guild: ${deleteError.message}` }, 500);

      // Log
      try {
        await createAdminLog({
          type: 'guild_deleted',
          action: `${dbUser.discord_username} deleted guild "${guild.name}"`,
          actor_id: dbUser.id,
          actor_name: dbUser.discord_username,
          details: { guild_id: guildId, guild_name: guild.name },
        });
      } catch (_) { /* non-critical */ }

      console.log(`Guild deleted: "${guild.name}" by ${dbUser.discord_username}`);
      return c.json({ success: true });
    } catch (error: any) {
      console.error('Delete guild error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ── POST /guilds/:id/join — Join a guild ──────────────────────────
  // Handles: Discord role swap, membership records, rank reset on switch
  app.post(`${PREFIX}/guilds/:id/join`, async (c) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      const guildId = c.req.param('id');

      // Can't join the guild you're already in
      if (dbUser.guild_id === guildId) {
        return c.json({ error: 'You are already in this guild' }, 400);
      }

      // Fetch target guild
      const { data: guild, error: guildError } = await supabase
        .from('guild_wars_guilds')
        .select('*')
        .eq('id', guildId)
        .single();

      if (guildError || !guild) return c.json({ error: 'Guild not found' }, 404);
      if (!guild.is_open) return c.json({ error: 'This guild is not accepting new members' }, 403);

      // Determine if this is a guild SWITCH (has existing non-Unaffiliated guild)
      let isSwitch = false;
      let oldGuild: any = null;
      const { data: unaffiliated } = await supabase
        .from('guild_wars_guilds')
        .select('id')
        .eq('name', 'Unaffiliated')
        .single();

      if (dbUser.guild_id && dbUser.guild_id !== unaffiliated?.id) {
        isSwitch = true;
        const { data: og } = await supabase
          .from('guild_wars_guilds')
          .select('id, name, discord_role_id')
          .eq('id', dbUser.guild_id)
          .maybeSingle();
        oldGuild = og;
      }

      // ── Guild switch: rank + prestige reset ──
      const updateData: any = {
        guild_id: guildId,
        updated_at: new Date().toISOString(),
      };

      if (isSwitch) {
        updateData.rank_id = 1; // Reset to Earwig
        updateData.prestige_level = 0; // Reset prestige
      }

      // If guest, also set role to member (onboard them)
      if (dbUser.role === 'guest') {
        updateData.role = 'member';
      }

      // Update user
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', dbUser.id)
        .select(`*, ranks ( id, name, display_order )`)
        .single();

      if (updateError) return c.json({ error: `Failed to join guild: ${updateError.message}` }, 500);

      // Close old membership record
      if (dbUser.guild_id) {
        await supabase
          .from('guild_wars_memberships')
          .update({ left_at: new Date().toISOString(), rank_on_leave: dbUser.rank_id, prestige_on_leave: dbUser.prestige_level })
          .eq('user_id', dbUser.id)
          .is('left_at', null);
      }

      // Create new membership record
      await supabase
        .from('guild_wars_memberships')
        .insert({ user_id: dbUser.id, guild_id: guildId });

      // Discord role swap
      if (dbUser.discord_id) {
        // Remove old guild's Discord role
        if (oldGuild?.discord_role_id) {
          removeDiscordRoleFromUser(dbUser.discord_id, oldGuild.discord_role_id);
        } else if (dbUser.guild_id && dbUser.guild_id !== unaffiliated?.id) {
          // Old guild might have been fetched even if not "oldGuild" — try removing from the previous guild
          const { data: prevGuild } = await supabase
            .from('guild_wars_guilds')
            .select('discord_role_id')
            .eq('id', dbUser.guild_id)
            .maybeSingle();
          if (prevGuild?.discord_role_id) {
            removeDiscordRoleFromUser(dbUser.discord_id, prevGuild.discord_role_id);
          }
        }

        // Add new guild's Discord role
        if (guild.discord_role_id) {
          addDiscordRoleToUser(dbUser.discord_id, guild.discord_role_id);
        }
      }

      // Log
      try {
        const description = isSwitch
          ? `You switched from ${oldGuild?.name || 'your old guild'} to ${guild.name}. Your rank was reset to Earwig and prestige to 0.`
          : `You joined the ${guild.name} guild!`;

        await createUserActivity({
          user_id: dbUser.id,
          type: isSwitch ? 'guild_switched' : 'guild_joined',
          title: isSwitch ? `Switched to ${guild.name}` : `Joined ${guild.name}`,
          description,
          related_id: guild.id,
        });

        if (isSwitch) {
          await createAdminLog({
            type: 'guild_switched',
            action: `${dbUser.discord_username} switched from ${oldGuild?.name || '?'} to ${guild.name} (rank/prestige reset)`,
            actor_id: dbUser.id,
            actor_name: dbUser.discord_username,
            details: { old_guild: oldGuild?.name, new_guild: guild.name, old_rank: dbUser.rank_id, old_prestige: dbUser.prestige_level },
          });
        }
      } catch (_) { /* non-critical */ }

      console.log(`User ${dbUser.discord_username} joined guild "${guild.name}"${isSwitch ? ' (switch — rank/prestige reset)' : ''}`);
      return c.json({ user: updatedUser, guild, was_switch: isSwitch });
    } catch (error: any) {
      console.error('Join guild error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ── POST /guilds/:id/leave — Leave guild → Unaffiliated ───────────
  app.post(`${PREFIX}/guilds/:id/leave`, async (c) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      const guildId = c.req.param('id');

      if (dbUser.guild_id !== guildId) {
        return c.json({ error: 'You are not in this guild' }, 400);
      }

      // Get Unaffiliated guild
      const { data: unaffiliated } = await supabase
        .from('guild_wars_guilds')
        .select('id')
        .eq('name', 'Unaffiliated')
        .single();

      if (!unaffiliated) return c.json({ error: 'Unaffiliated guild not found — contact admin' }, 500);

      // Can't leave Unaffiliated
      if (guildId === unaffiliated.id) {
        return c.json({ error: 'You cannot leave the Unaffiliated guild (you must join another guild instead)' }, 400);
      }

      // Get current guild info for logging
      const { data: currentGuild } = await supabase
        .from('guild_wars_guilds')
        .select('name, discord_role_id')
        .eq('id', guildId)
        .maybeSingle();

      // Move to Unaffiliated (no rank/prestige reset for leaving to Unaffiliated)
      await supabase
        .from('users')
        .update({ guild_id: unaffiliated.id, updated_at: new Date().toISOString() })
        .eq('id', dbUser.id);

      // Close old membership, create Unaffiliated membership
      await supabase
        .from('guild_wars_memberships')
        .update({ left_at: new Date().toISOString(), rank_on_leave: dbUser.rank_id, prestige_on_leave: dbUser.prestige_level })
        .eq('user_id', dbUser.id)
        .is('left_at', null);

      await supabase
        .from('guild_wars_memberships')
        .insert({ user_id: dbUser.id, guild_id: unaffiliated.id });

      // Remove Discord role
      if (dbUser.discord_id && currentGuild?.discord_role_id) {
        removeDiscordRoleFromUser(dbUser.discord_id, currentGuild.discord_role_id);
      }

      // Log
      try {
        await createUserActivity({
          user_id: dbUser.id,
          type: 'guild_left',
          title: `Left ${currentGuild?.name || 'guild'}`,
          description: `You left ${currentGuild?.name || 'your guild'} and are now Unaffiliated.`,
        });
      } catch (_) { /* non-critical */ }

      console.log(`User ${dbUser.discord_username} left guild "${currentGuild?.name}" → Unaffiliated`);
      return c.json({ success: true });
    } catch (error: any) {
      console.error('Leave guild error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

}
