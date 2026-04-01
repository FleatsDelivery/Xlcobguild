/**
 * Discord API Utilities — Guild Wars Role Sync
 * Shared functions for managing Discord roles via the Bot API.
 */
import { 
  DISCORD_SERVER_ID, 
  DISCORD_RANK_ROLES, 
  DISCORD_PRESTIGE_ROLES, 
  DISCORD_ADMIN_ROLES,
  DISCORD_SPECIAL_ROLES,
  getOldRankRoleIds, 
  getOldPrestigeRoleIds 
} from "./discord-config.ts";

const DISCORD_API = 'https://discord.com/api/v10';

/** Create a Discord role in the TCF server. Returns the role ID or null. */
export async function createDiscordRole(name: string, color: string): Promise<string | null> {
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
export async function updateDiscordRole(roleId: string, updates: { name?: string; color?: string }): Promise<void> {
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
export async function deleteDiscordRole(roleId: string): Promise<void> {
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

console.log('--- DISCORD API UTILS INITIALIZED (V2 - ATOMIC UPDATES) ---');

/** Fetch a Discord member's details. */
export async function getDiscordMember(discordUserId: string): Promise<any | null> {
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!botToken || !discordUserId) return null;

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${DISCORD_SERVER_ID}/members/${discordUserId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bot ${botToken}` },
    });
    if (!res.ok) {
      if (res.status !== 404) console.error(`Discord get member ${discordUserId} failed:`, res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (err) { console.error('Discord get member error:', err); return null; }
}

/** Update a Discord member's roles atomically. */
export async function updateDiscordMemberRoles(discordUserId: string, roles: string[]): Promise<void> {
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!botToken || !discordUserId) return;

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${Deno.env.get('DISCORD_SERVER_ID')}/members/${discordUserId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bot ${botToken}` },
      body: JSON.stringify({ roles }),
    });
    if (!res.ok) console.error(`Discord patch member roles ${discordUserId} failed:`, res.status, await res.text());
  } catch (err) { console.error('Discord patch member error:', err); }
}

/** Add a Discord role to a user (legacy — prefer atomic updates). */
export async function addDiscordRoleToUser(discordUserId: string, roleId: string): Promise<void> {
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

/** Remove a Discord role from a user (legacy — prefer atomic updates). */
export async function removeDiscordRoleFromUser(discordUserId: string, roleId: string): Promise<void> {
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

/**
 * Synchronize all Guild Wars related roles for a user.
 * Best-effort: failures are logged but don't block the execution.
 */
export async function syncDiscordUserRoles(
  supabase: any,
  userId: string
): Promise<void> {
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!botToken) return;

  try {
    // 1. Fetch user plus their guild's discord_role_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('discord_id, rank_id, prestige_level, guild_id, role, tcf_plus_active, guild_wars_guilds!users_guild_id_fkey(discord_role_id)')
      .eq('id', userId)
      .single();

    if (userError || !user?.discord_id) {
      console.log(`syncDiscordUserRoles: skipping for user ${userId} (no discord_id or user not found)`);
      return;
    }

    const discordUserId = user.discord_id;
    const guildRoleId = user.guild_wars_guilds?.discord_role_id;
    const currentRankId = user.rank_id || 1;
    const currentPrestigeLevel = user.prestige_level || 0;

    // 2. Fetch ALL rank and prestige role mappings + tournament status
    const [
      { data: rankRoles }, 
      { data: prestigeRanks },
      { data: registrations },
      { data: staffAssignments }
    ] = await Promise.all([
      supabase.from('ranks').select('id, discord_role_id'),
      supabase.from('prestige_ranks').select('level, discord_role_id'),
      supabase.from('kkup_registrations')
        .select('role, tournament_id, kkup_tournaments!inner(status)')
        .eq('user_id', userId)
        .in('kkup_tournaments.status', ['upcoming', 'registration_open', 'registration_closed', 'roster_lock', 'live']),
      supabase.from('kkup_tournament_staff')
        .select('role, tournament_id, kkup_tournaments!inner(status)')
        .eq('person_id', userId) // Note: this might need steam_id or person_id lookup if user_id isn't match
        .in('kkup_tournaments.status', ['upcoming', 'registration_open', 'registration_closed', 'roster_lock', 'live'])
    ]);

    // Fallback for staff if person_id is different (lookup person_id from steam_id)
    let finalStaff = staffAssignments;
    if (!staffAssignments || staffAssignments.length === 0) {
      const { data: userData } = await supabase.from('users').select('steam_id').eq('id', userId).single();
      if (userData?.steam_id) {
        const { data: person } = await supabase.from('kkup_persons').select('id').eq('steam_id', userData.steam_id).single();
        if (person?.id) {
          const { data: staff } = await supabase.from('kkup_tournament_staff')
            .select('role, tournament_id, kkup_tournaments!inner(status)')
            .eq('person_id', person.id)
            .in('kkup_tournaments.status', ['upcoming', 'registration_open', 'registration_closed', 'roster_lock', 'live']);
          if (staff) finalStaff = staff;
        }
      }
    }

    if (!rankRoles || !prestigeRanks) {
      console.error('syncDiscordUserRoles: Failed to fetch role mappings from database');
      return;
    }

    // 3. Identification: Target Roles
    const ALL_MANAGED_ROLES = new Set<string>();
    rankRoles.forEach((r: any) => { if (r.discord_role_id) ALL_MANAGED_ROLES.add(r.discord_role_id); });
    prestigeRanks.forEach((p: any) => { if (p.discord_role_id) ALL_MANAGED_ROLES.add(p.discord_role_id); });
    
    // Add Special/Admin Roles to managed set
    Object.values(DISCORD_ADMIN_ROLES).forEach(id => ALL_MANAGED_ROLES.add(id));
    Object.values(DISCORD_SPECIAL_ROLES).forEach(id => ALL_MANAGED_ROLES.add(id));
    // Note: Guild roles are NOT managed via a set here because they are user-specific and dynamic,
    // but we add/remove them by checking the guild_id. 
    // Actually, we should PROBABLY include the 3 default guild roles in the managed set if we want to be clean.
    ALL_MANAGED_ROLES.add('1478543774383739022'); // XLCOB
    ALL_MANAGED_ROLES.add('1478543805459337257'); // EAFD
    ALL_MANAGED_ROLES.add('1478543838069919836'); // FTHOG

    const targetRankRole = rankRoles.find((r: any) => r.id === currentRankId)?.discord_role_id;
    const targetPrestigeRole = prestigeRanks.find((p: any) => p.level === currentPrestigeLevel)?.discord_role_id;
    const targetAdminRole = DISCORD_ADMIN_ROLES[user.role];
    const targetTcfPlusRole = user.tcf_plus_active ? DISCORD_SPECIAL_ROLES.TCF_PLUS : null;

    // Tournament role targets
    let targetPlayerRole = (registrations || []).some((r: any) => r.role === 'player' || r.role === 'undecided') ? DISCORD_SPECIAL_ROLES.PLAYER : null;
    let targetCoachRole = (registrations || []).some((r: any) => r.role === 'coach') ? DISCORD_SPECIAL_ROLES.COACH : null;
    let targetCasterRole = (finalStaff || []).some((r: any) => r.role?.toLowerCase().includes('caster')) ? DISCORD_SPECIAL_ROLES.CASTER : null;

    // 4. Fetch current member roles from Discord
    const member = await getDiscordMember(discordUserId);
    if (!member) {
      console.log(`syncDiscordUserRoles: User ${discordUserId} not found in Discord server`);
      return;
    }

    const existingRoles: string[] = member.roles || [];
    
    // 5. Calculate new role set (Keep roles NOT managed by us, then add our target roles)
    const otherRoles = existingRoles.filter(roleId => !ALL_MANAGED_ROLES.has(roleId));
    
    const newRoles = new Set(otherRoles);
    if (targetRankRole) newRoles.add(targetRankRole);
    if (targetPrestigeRole) newRoles.add(targetPrestigeRole);
    if (guildRoleId) newRoles.add(guildRoleId);
    if (targetAdminRole) newRoles.add(targetAdminRole);
    if (targetTcfPlusRole) newRoles.add(targetTcfPlusRole);
    if (targetPlayerRole) newRoles.add(targetPlayerRole);
    if (targetCoachRole) newRoles.add(targetCoachRole);
    if (targetCasterRole) newRoles.add(targetCasterRole);

    // 6. Apply atomic update if different
    const sortedExisting = [...existingRoles].sort().join(',');
    const sortedNew = Array.from(newRoles).sort().join(',');

    if (sortedExisting !== sortedNew) {
      console.log(`Syncing Discord roles for user ${discordUserId}: updating set to ${newRoles.size} roles (atomic update)`);
      await updateDiscordMemberRoles(discordUserId, Array.from(newRoles));
    } else {
      console.log(`Syncing Discord roles for user ${discordUserId}: Already in sync`);
    }

  } catch (err) {
    console.error(`syncDiscordUserRoles unexpected error for user ${userId}:`, err);
  }
}

/**
 * Reconcile ALL users who have a Discord ID with the current database state.
 * Uses built-in delays to avoid hitting global Discord rate limits.
 */
export async function syncAllDiscordRoles(supabase: any): Promise<{ success: number; failed: number }> {
  console.log('--- STARTING SERVER-WIDE DISCORD SYNC ---');
  
  // Fetch all users with discord_id
  const { data: users, error } = await supabase
    .from('users')
    .select('id')
    .not('discord_id', 'is', null);

  if (error || !users) {
    console.error('syncAllDiscordRoles: Failed to fetch users:', error);
    return { success: 0, failed: 0 };
  }

  console.log(`Found ${users.length} users to sync.`);
  let successCount = 0;
  let failCount = 0;

  for (const user of users) {
    try {
      await syncDiscordUserRoles(supabase, user.id);
      successCount++;
    } catch (err) {
      console.error(`Failed to sync user ${user.id}:`, err);
      failCount++;
    }
    // Rate limit buffer: Discord permits roughly 10-50 member updates per 10s.
    // We'll be conservative and wait 500ms between users.
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`--- SYNC COMPLETE: ${successCount} successful, ${failCount} failed ---`);
  return { success: successCount, failed: failCount };
}
