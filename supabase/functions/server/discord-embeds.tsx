// Discord Embed builders for MVP request messages
// Ensures consistent format between Discord bot commands and web webhook notifications

const SITE_URL = 'https://kernelkup.figma.site';

// Build pending MVP request embed (used for both web->Discord and Discord->web)
export function buildPendingMVPEmbed(
  submitterDiscordId: string | null,
  submitterUsername: string,
  targetDiscordId: string | null,
  targetUsername: string,
  action: string,
  matchId: string | null,
  screenshotUrl: string,
) {
  const actionEmoji = action === 'rank_up' ? '⬆️' : action === 'rank_down' ? '⬇️' : '⭐';
  const actionText = action === 'rank_up' ? 'Rank Up' : action === 'rank_down' ? 'Rank Down' : 'Prestige';

  const embed = {
    title: '🌽 New MVP Request Submitted!',
    color: 0xF97316, // Orange
    fields: [
      {
        name: '👤 Requested By',
        value: submitterDiscordId ? `<@${submitterDiscordId}>` : submitterUsername,
        inline: true,
      },
      {
        name: '🎯 Target Player',
        value: targetDiscordId ? `<@${targetDiscordId}>` : targetUsername,
        inline: true,
      },
      {
        name: '⚡ Action',
        value: `${actionEmoji} ${actionText}${matchId ? `\n🎮 Match ID: \`${matchId}\`` : ''}`,
        inline: true,
      },
      {
        name: '📊 Status',
        value: '⏳ Pending officer review',
        inline: true,
      },
      {
        name: '\u200B', // Spacer
        value: `🌐 [View on Web App](${SITE_URL}/#requests)`,
        inline: false,
      },
    ],
    image: {
      url: screenshotUrl,
    },
    timestamp: new Date().toISOString(),
  };

  return { embed };
}

// Build approved/denied MVP request embed
export function buildResolvedMVPEmbed(
  submitterDiscordId: string | null,
  submitterUsername: string,
  targetDiscordId: string | null,
  targetUsername: string,
  action: string,
  matchId: string | null,
  screenshotUrl: string,
  status: 'approved' | 'denied',
  reviewerUsername: string,
) {
  const actionEmoji = action === 'rank_up' ? '⬆️' : action === 'rank_down' ? '⬇️' : '⭐';
  const actionText = action === 'rank_up' ? 'Rank Up' : action === 'rank_down' ? 'Rank Down' : 'Prestige';

  const statusText = status === 'approved' ? `✅ Approved by ${reviewerUsername}` : `❌ Denied by ${reviewerUsername}`;
  const embedColor = status === 'approved' ? 0x10b981 : 0xef4444; // Green for approved, red for denied
  const titleSuffix = status === 'approved' ? ' - APPROVED ✅' : ' - DENIED ❌';

  const embed = {
    title: `🌽 MVP Request${titleSuffix}`,
    color: embedColor,
    fields: [
      {
        name: '👤 Requested By',
        value: submitterDiscordId ? `<@${submitterDiscordId}>` : submitterUsername,
        inline: true,
      },
      {
        name: '🎯 Target Player',
        value: targetDiscordId ? `<@${targetDiscordId}>` : targetUsername,
        inline: true,
      },
      {
        name: '⚡ Action',
        value: `${actionEmoji} ${actionText}${matchId ? `\n🎮 Match ID: \`${matchId}\`` : ''}`,
        inline: true,
      },
      {
        name: '📊 Status',
        value: statusText,
        inline: true,
      },
      {
        name: '\u200B', // Spacer
        value: `🌐 [View on Web App](${SITE_URL}/#requests)`,
        inline: false,
      },
    ],
    image: screenshotUrl ? { url: screenshotUrl } : undefined,
    timestamp: new Date().toISOString(),
  };

  return { embed };
}