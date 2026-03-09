// Party Finder (createparty) shared utilities — modes and embed builder

// Role IDs for party finder modes (Discord server 1475609583086075904)
export const PARTY_MODES: Record<string, { role_id: string; name: string }> = {
  dos:   { role_id: '1479584707896414279', name: 'DERBA-DOS' },
  turba: { role_id: '1479584771821801733', name: 'turba-durbs' },
  bcup:  { role_id: '1479584833587118181', name: 'bcup-bummers' },
};

// Build party finder lobby embed and button components
export function buildPartyEmbed(lobby: any): { embeds: any[]; components: any[] } {
  const playerCount = lobby.players.filter((p: any) => p !== null).length;
  const hasCoach = lobby.coach !== null;
  const isFull = playerCount === 5 && hasCoach;
  const isExpired = Date.now() > lobby.expires_at;
  const isCancelled = lobby.status === 'cancelled';
  const isClosed = lobby.status === 'closed' || isCancelled || isExpired;

  const mode = PARTY_MODES[lobby.mode] || PARTY_MODES.dos;

  // Compact tombstone for expired/cancelled/closed lobbies
  if (isClosed) {
    const statusText = isCancelled ? 'cancelled ❌' : isFull ? 'played 🎉' : 'ended ⏰';
    return {
      embeds: [{
        description: `🌽 ~~It's time for some Dota...~~ **Party ${statusText}** — <@${lobby.creator_id}> • ${mode.name}`,
        color: isFull ? 0x22C55E : 0x4B5563,
      }],
      components: [],
    };
  }

  const title = "🌽 It's time for some Dota...";

  let description = '';
  if (isFull) {
    description = `<@${lobby.creator_id}>'s party is **FULL**! 🎉\n\n🎮 **GL HF!**`;
  } else {
    description = `<@${lobby.creator_id}> is lookin to play some <@&${mode.role_id}> who's in?`;
  }

  const playerLines = lobby.players.map((p: any, i: number) => {
    if (p) return `\`${i + 1}.\` ✅ <@${p.discord_id}>`;
    return `\`${i + 1}.\` 🔲 *Empty*`;
  });

  const coachLine = hasCoach
    ? `✅ <@${lobby.coach.discord_id}>`
    : '🔲 *Empty*';

  const fields: any[] = [
    {
      name: `—— Players (${playerCount}/5) ——`,
      value: playerLines.join('\n'),
      inline: false,
    },
    {
      name: `—— Coach (${hasCoach ? '1' : '0'}/1) ——`,
      value: coachLine,
      inline: false,
    },
  ];

  // Add timer field at the bottom for active (non-full) lobbies
  if (!isClosed && !isFull) {
    fields.push({
      name: '\u200b',
      value: `⏰ Lobby closes <t:${Math.floor(lobby.expires_at / 1000)}:R>`,
      inline: false,
    });
  }

  const components: any[] = [];
  if (!isClosed) {
    const buttons: any[] = [];
    if (playerCount < 5) {
      buttons.push({
        type: 2,
        style: 3, // Green (Success)
        label: "I'll Play",
        custom_id: `party_play:${lobby.id}`,
        emoji: { name: '🎮' },
      });
    }
    if (!hasCoach) {
      buttons.push({
        type: 2,
        style: 1, // Blue (Primary)
        label: "I'll Coach",
        custom_id: `party_coach:${lobby.id}`,
        emoji: { name: '📋' },
      });
    }
    buttons.push({
      type: 2,
      style: 4, // Red (Danger)
      label: 'Leave',
      custom_id: `party_leave:${lobby.id}`,
      emoji: { name: '🚪' },
    });
    // Only show Cancel when lobby isn't full (don't cancel a ready party!)
    if (!isFull) {
      buttons.push({
        type: 2,
        style: 2, // Grey (Secondary)
        label: 'Cancel',
        custom_id: `party_cancel:${lobby.id}`,
        emoji: { name: '✖️' },
      });
    }
    components.push({ type: 1, components: buttons });
  }

  return {
    embeds: [{
      title,
      description,
      fields,
      color: isFull ? 0x22C55E : 0xDC2626,
      footer: {
        text: `The Corn Field • ${mode.name}`,
      },
    }],
    components,
  };
}