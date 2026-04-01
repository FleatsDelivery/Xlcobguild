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
    title: '🌾 The Corn Field - Self Service Role Kiosk',
    description:
      '## 🌽 Select Your Roles\n' +
      '*Customize your experience by selecting your roles below.*\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    fields: [
      {
        value:
          `**${SELF_ASSIGN_ROLES[0].emoji} ${SELF_ASSIGN_ROLES[0].name}** - this is the main Dota 2 role here in The Corn Field\n` +
          `**${SELF_ASSIGN_ROLES[1].emoji} ${SELF_ASSIGN_ROLES[1].name}** - for all your Turbo gaming needs\n` +
          `**${SELF_ASSIGN_ROLES[2].emoji} ${SELF_ASSIGN_ROLES[2].name}** - if you want to join the weekend battle cup squad`,
        inline: true,
      },
      {
        name: '\u200b', // Zero-width space
        value:
          `**${SELF_ASSIGN_ROLES[3].emoji} ${SELF_ASSIGN_ROLES[3].name}** - join the community Valheim server!\n` +
          `**${SELF_ASSIGN_ROLES[4].emoji} ${SELF_ASSIGN_ROLES[4].name}** - this role allows you to create polls\n` +
          `**${SELF_ASSIGN_ROLES[5].emoji} ${SELF_ASSIGN_ROLES[5].name}** - this is for the folks who would like to work on custom games, discord bot functionality, and other fun projects`,
        inline: true,
      }
    ],
    image: { url: 'https://kernelkup.com/role_kiosk.png' },
    color: 0xA4CA00, // Husk-bright
    footer: { text: 'Use the dropdown menu to change your roles' },
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
