import { 
  InteractionResponseType, 
  jsonResponse,
} from './utils.ts';
import { SELF_ASSIGN_ROLES } from './roles-config.ts';

/**
 * Handle String Select interaction: Update roles for the user atomically
 * Interaction Type: MESSAGE_COMPONENT (3)
 * Custom ID: roles_select
 */
export async function handleRoleSelect(body: any, _supabase: any) {
  const selectedRoleIds: string[] = body.data?.values || [];
  
  const member = body.member;
  if (!member) return jsonResponse({ error: 'Unauthorized' }, 401);

  const userId = member.user.id;
  const currentRoles: string[] = member.roles || [];

  const DISCORD_API = 'https://discord.com/api/v10';
  const guildId = body.guild_id;
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');

  if (!botToken || !guildId || !userId) {
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: '❌ Configuration error (Bot Token/Guild ID missing).', flags: 64 }
    });
  }

  try {
    // 1. Identify all roles in our "Self-Assign" list
    const selfAssignRoleIds = new Set(SELF_ASSIGN_ROLES.map(r => r.id));

    // 2. Filter out any self-assign roles the user CURRENTLY has
    // (This keeps their ranks, prestige, staff roles, etc. untouched)
    const otherRoles = currentRoles.filter(roleId => !selfAssignRoleIds.has(roleId));

    // 3. Add the NEW selection of self-assign roles
    const newRolesTotal = [...otherRoles, ...selectedRoleIds];

    // 4. Update the member atomically via PATCH
    const url = `${DISCORD_API}/guilds/${guildId}/members/${userId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bot ${botToken}` 
      },
      body: JSON.stringify({ roles: newRolesTotal })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Update roles failed: ${res.status}`, err);
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `❌ Failed to update roles: ${err}`, flags: 64 }
      });
    }

    // 5. Silent response (Kiosk mode)
    // We return InteractionResponseType.DEFERRED_UPDATE_MESSAGE (6) 
    // which acknowledges the interaction without sending any new message or thinking state.
    return jsonResponse({
      type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
    });

  } catch (err) {
    console.error('Update roles error:', err);
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: '❌ Internal error updating roles.', flags: 64 }
    });
  }
}
