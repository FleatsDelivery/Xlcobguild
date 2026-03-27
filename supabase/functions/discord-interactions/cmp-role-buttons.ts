import { 
  InteractionResponseType, 
  jsonResponse,
} from './utils.ts';
import { SELF_ASSIGN_ROLES } from './roles-config.ts';

/**
 * Handle button interaction: Toggle role for the user
 * Interaction Type: MESSAGE_COMPONENT (3)
 * Custom ID: role_toggle_<role_id>
 */
export async function handleRoleButton(body: any, _supabase: any) {
  const customId = body.data?.custom_id || '';
  const roleId = customId.replace('role_toggle_', '');
  
  const roleConfig = SELF_ASSIGN_ROLES.find(r => r.id === roleId);
  const roleName = roleConfig?.name || 'Unknown Role';

  const member = body.member;
  if (!member) return jsonResponse({ error: 'Unauthorized' }, 401);

  const userId = member.user.id;
  const existingRoles: string[] = member.roles || [];
  const hasRole = existingRoles.includes(roleId);

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
    const url = `${DISCORD_API}/guilds/${guildId}/members/${userId}/roles/${roleId}`;
    const method = hasRole ? 'DELETE' : 'PUT';

    const res = await fetch(url, {
      method,
      headers: { 'Authorization': `Bot ${botToken}` }
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Toggle role failed: ${res.status}`, err);
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `❌ Failed to update role: ${err}`, flags: 64 }
      });
    }

    const action = hasRole ? 'Removed' : 'Added';
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { 
        content: `✅ **${action}** the **${roleName}** role!`,
        flags: 64 // Ephemeral
      }
    });

  } catch (err) {
    console.error('Toggle role error:', err);
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: '❌ Internal error toggling role.', flags: 64 }
    });
  }
}
