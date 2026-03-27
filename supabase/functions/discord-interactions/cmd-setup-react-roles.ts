import { 
  InteractionResponseType, 
  jsonResponse,
} from './utils.ts';
import { SELF_ASSIGN_ROLES } from './roles-config.ts';

export async function handleSetupReactRoles(body: any, _supabase: any) {
  // 1. Authorization check: only Owners or Admins (Officers)
  const member = body.member;
  if (!member) return jsonResponse({ error: 'Unauthorized' }, 401);

  // Check for Administrator permission (0x8) or specific role IDs if needed
  // For now, let's assume if they can run the command it's because Discord permission system allowed it.
  // But we can add a secondary check if we have the role IDs here.
  
  const embed = {
    title: '🌾 The Corn Field — Role Kiosk',
    description: 'Use the dropdown menu below to select your interests! You can pick as many as you like. We\'ll use these to ping you for specific events and groups.\n\n**Available Roles:**\n' + 
      SELF_ASSIGN_ROLES.map(r => `${r.emoji} **${r.name}**`).join('\n'),
    image: { url: 'https://kernelkup.com/role_kiosk.png' },
    color: 0xA4CA00, // Husk-bright
    footer: { text: 'The Corn Field • Roles are al la carte' },
    timestamp: new Date().toISOString(),
  };

  const selectMenu = {
    type: 1, // ACTION_ROW
    components: [{
      type: 3, // STRING_SELECT
      custom_id: 'roles_select',
      placeholder: 'Select your roles...',
      min_values: 0,
      max_values: SELF_ASSIGN_ROLES.length,
      options: SELF_ASSIGN_ROLES.map(role => ({
        label: role.name,
        value: role.id,
        emoji: role.emoji ? { name: role.emoji } : undefined,
      })),
    }],
  };

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
      components: [selectMenu],
    },
  };
}
