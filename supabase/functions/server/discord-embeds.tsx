// Discord Embed builders for MVP request messages
// Ensures consistent format between Discord bot commands and web webhook notifications

const SITE_URL = 'https://thecornfield.figma.site';

// ── Helper: send a webhook message (non-critical, fire-and-forget) ──
export async function sendWebhookEmbed(webhookUrl: string, embed: any, content?: string): Promise<string | null> {
  try {
    const response = await fetch(webhookUrl + '?wait=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed], ...(content ? { content } : {}) }),
    });
    if (response.ok) {
      const text = await response.text();
      if (text && text.trim().length > 0) {
        try {
          const msg = JSON.parse(text);
          return msg.id || null;
        } catch { return null; }
      }
    } else {
      console.error(`Webhook POST failed (${response.status}):`, await response.text());
    }
  } catch (err) {
    console.error('sendWebhookEmbed error:', err);
  }
  return null;
}

// ═══════════════════════════════════════════════════════
// KKUP REGISTRATION EMBED (new + re-registration)
// ══════════════════════════════════════════════════════

// Consistent role emoji mapping — matches frontend (tournament-hub-staff-modal.tsx)
const ROLE_EMOJIS: Record<string, { emoji: string; label: string }> = {
  player:                { emoji: '🎮', label: 'Player' },
  coach:                 { emoji: '📋', label: 'Coach' },
  caster:                { emoji: '🎙️', label: 'Caster' },
  producer:              { emoji: '🎬', label: 'Producer' },
  helper:                { emoji: '🤝', label: 'Helper' },
  tournament_director:   { emoji: '👑', label: 'Tournament Director' },
  other:                 { emoji: '🔄', label: 'Staff' },
  staff:                 { emoji: '🛠️', label: 'Staff' },
};

function getRoleDisplay(role: string) {
  return ROLE_EMOJIS[role] || { emoji: '🌽', label: role };
}

export function buildRegistrationEmbed(opts: {
  discordId: string | null;
  discordUsername: string;
  discordAvatar: string | null;
  role: string;
  tournamentName: string;
  tournamentId: string;
  registrationNumber: number;
  isEarlyAccess: boolean;
  isReRegistration: boolean;
  dotaRank: string | null;
  // Rank badge image URL (from getRankBadgeUrl)
  rankBadgeUrl?: string | null;
  // Staff-specific fields (when approved staff joins the roster)
  staffRole?: string | null;
  isStaffApproval?: boolean;
}) {
  const { emoji: roleEmoji, label: roleLabel } = getRoleDisplay(opts.staffRole || opts.role);

  const title = opts.isStaffApproval
    ? `${roleEmoji} Staff Member Approved!`
    : opts.isReRegistration
      ? `🔄 Player Re-Registered!`
      : opts.isEarlyAccess
        ? `⭐ Early Access Registration!`
        : `🌽 New Registration!`;

  const playerMention = opts.discordId ? `<@${opts.discordId}>` : `**${opts.discordUsername}**`;

  const description = opts.isStaffApproval
    ? `${playerMention} has been approved as **${roleLabel}** for **${opts.tournamentName}**! 🎉`
    : opts.isReRegistration
      ? `${playerMention} has re-registered for **${opts.tournamentName}**! Welcome back! 🌾`
      : opts.isEarlyAccess
        ? `${playerMention} used their **TCF+ early access** to register for **${opts.tournamentName}**! ⭐🌽`
        : `${playerMention} has registered for **${opts.tournamentName}**! 🌾`;

  const color = opts.isStaffApproval ? 0xF59E0B : opts.isReRegistration ? 0x8B5CF6 : opts.isEarlyAccess ? 0xF1C60F : 0xA4CA00;

  const fields: any[] = [
    { name: `${roleEmoji} Role`, value: roleLabel, inline: true },
    { name: '🔢 Registration #', value: `${opts.registrationNumber}`, inline: true },
  ];

  if (opts.dotaRank) {
    fields.push({ name: '🏅 Rank', value: opts.dotaRank, inline: true });
  }

  fields.push({
    name: '\u200B',
    value: `🌐 [View Tournament](${SITE_URL}/#tournament-hub/${opts.tournamentId})`,
    inline: false,
  });

  // discord_avatar is already a full URL from Supabase Auth metadata
  const avatarUrl = opts.discordAvatar || undefined;

  const embed = {
    title,
    description,
    color,
    fields,
    // Author line: player name + profile picture
    author: avatarUrl
      ? { name: opts.discordUsername, icon_url: avatarUrl }
      : { name: opts.discordUsername },
    // Thumbnail: rank badge image (visual rank indicator)
    thumbnail: opts.rankBadgeUrl ? { url: opts.rankBadgeUrl } : undefined,
    timestamp: new Date().toISOString(),
  };

  return { embed };
}

// ═══════════════════════════════════════════════════════
// KKUP ACTIVITY EMBED (all-purpose Kernel Kup updates)
// ═══════════════════════════════════════════════════════

type KkupActivityType =
  | 'player_withdrawal'
  | 'team_created'
  | 'team_withdrawn'
  | 'invite_accepted'
  | 'coach_accepted'
  | 'player_added'
  | 'player_removed'
  | 'role_changed';

const KKUP_ACTIVITY_CONFIG: Record<KkupActivityType, { emoji: string; title: string; color: number }> = {
  player_withdrawal:  { emoji: '👋', title: 'Player Withdrew',        color: 0xEF4444 },
  team_created:       { emoji: '🛡️', title: 'New Team Created',       color: 0xA4CA00 },
  team_withdrawn:     { emoji: '💨', title: 'Team Withdrawn',         color: 0xEF4444 },
  invite_accepted:    { emoji: '🤝', title: 'Player Joined Team',     color: 0x10B981 },
  coach_accepted:     { emoji: '📋', title: 'Coach Joined Team',      color: 0x10B981 },
  player_added:       { emoji: '➕', title: 'Player Added to Roster', color: 0x3B82F6 },
  player_removed:     { emoji: '➖', title: 'Player Removed from Roster', color: 0xF59E0B },
  role_changed:       { emoji: '🔄', title: 'Role Changed',           color: 0x8B5CF6 },
};

export function buildKkupActivityEmbed(opts: {
  type: KkupActivityType;
  tournamentName: string;
  tournamentId: string;
  playerName: string;
  playerDiscordId?: string | null;
  playerAvatar?: string | null;
  teamName?: string | null;
  teamLogoUrl?: string | null;
  roleName?: string | null;
  extraDetail?: string | null;
  actorName?: string | null;
}) {
  const config = KKUP_ACTIVITY_CONFIG[opts.type];

  const title = `${config.emoji} ${config.title}`;
  const playerMention = opts.playerDiscordId ? `<@${opts.playerDiscordId}>` : `**${opts.playerName}**`;

  // Build a concise description based on the event type
  let description: string;
  switch (opts.type) {
    case 'player_withdrawal':
      description = `${playerMention} withdrew from **${opts.tournamentName}**.`;
      break;
    case 'team_created':
      description = `${playerMention} created team **${opts.teamName || 'Unknown'}** for **${opts.tournamentName}**.`;
      break;
    case 'team_withdrawn':
      description = `Team **${opts.teamName || 'Unknown'}** was withdrawn from **${opts.tournamentName}**.`;
      if (opts.actorName) description += ` (by ${opts.actorName})`;
      break;
    case 'invite_accepted':
      description = `${playerMention} joined **${opts.teamName || 'a team'}** in **${opts.tournamentName}**! 🌽`;
      break;
    case 'coach_accepted':
      description = `${playerMention} is now coaching **${opts.teamName || 'a team'}** in **${opts.tournamentName}**! 📋`;
      break;
    case 'player_added':
      description = `${playerMention} was added to **${opts.teamName || 'a team'}** roster in **${opts.tournamentName}**.`;
      if (opts.actorName) description += ` (by ${opts.actorName})`;
      break;
    case 'player_removed':
      description = `${playerMention} was removed from **${opts.teamName || 'a team'}** roster in **${opts.tournamentName}**.`;
      if (opts.actorName) description += ` (by ${opts.actorName})`;
      break;
    case 'role_changed':
      description = `${playerMention} changed role to **${opts.roleName || 'unknown'}** in **${opts.tournamentName}**.`;
      break;
    default:
      description = `Activity update for **${opts.tournamentName}**.`;
  }

  const fields: any[] = [];

  if (opts.extraDetail) {
    fields.push({ name: '📝 Details', value: opts.extraDetail, inline: false });
  }

  fields.push({
    name: '\u200B',
    value: `🌐 [View Tournament](${SITE_URL}/#tournament-hub/${opts.tournamentId})`,
    inline: false,
  });

  // discord_avatar is already a full URL from Supabase Auth metadata
  const avatarUrl = opts.playerAvatar || undefined;

  // Team-related events show team logo as thumbnail; otherwise show player avatar
  const isTeamEvent = ['team_created', 'team_withdrawn', 'invite_accepted', 'coach_accepted', 'player_added', 'player_removed'].includes(opts.type);
  const thumbnailUrl = isTeamEvent && opts.teamLogoUrl ? opts.teamLogoUrl : undefined;

  const embed = {
    title,
    description,
    color: config.color,
    fields,
    // Author line: player name + profile picture (always visible)
    author: avatarUrl
      ? { name: opts.playerName, icon_url: avatarUrl }
      : { name: opts.playerName },
    // Thumbnail: team logo for team events, nothing for player-only events
    thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined,
    timestamp: new Date().toISOString(),
  };

  return { embed };
}

// ═══════════════════════════════════════════════════════
// KKUP ANNOUNCEMENT EMBEDS (tournament drop + phase changes)
// ═══════════════════════════════════════════════════════

const PHASE_DISPLAY: Record<string, { emoji: string; label: string; color: number; description: string }> = {
  upcoming:              { emoji: '📅', label: 'Announced',           color: 0x262d01, description: 'A brand new tournament has been announced! 🌽 TCF+ members can register early!' },
  registration_open:     { emoji: '📝', label: 'Registration Open',   color: 0xA4CA00, description: 'Registration is OPEN! 🌾 Get in there and sign up, kernels!' },
  registration_closed:   { emoji: '🔒', label: 'Registration Closed', color: 0xD6A615, description: 'Registration is closed — rosters are being finalized! 🛡️' },
  roster_lock:           { emoji: '🔐', label: 'Rosters Locked',      color: 0xF97316, description: 'Rosters are LOCKED! 🔥 No more changes — it\'s game time soon!' },
  live:                  { emoji: '🔴', label: 'LIVE',                color: 0xEF4444, description: 'THE TOURNAMENT IS LIVE! 🎮🔥 Games are happening RIGHT NOW!' },
  completed:             { emoji: '🏆', label: 'Completed',           color: 0xF1C60F, description: 'The tournament has concluded! 🏆 GG to all teams!' },
  archived:              { emoji: '📦', label: 'Archived',            color: 0x6B6545, description: 'This tournament has been archived. Thanks for the memories! 🌾' },
};

export function buildKkupAnnouncementEmbed(opts: {
  tournamentName: string;
  tournamentId: string;
  tournamentType: string;
  newStatus: string;
  previousStatus?: string | null;
  registrationCount?: number;
  teamCount?: number;
  prizePool?: string | null;
  startDate?: string | null;
}) {
  const phase = PHASE_DISPLAY[opts.newStatus] || { emoji: '🌽', label: opts.newStatus, color: 0xD6A615, description: 'Tournament update!' };
  const isNewDrop = !opts.previousStatus;
  const typeLabel = opts.tournamentType === 'kernel_kup' ? 'Kernel Kup' : opts.tournamentType === 'heaps_n_hooks' ? 'Heaps & Hooks' : opts.tournamentType;

  const title = isNewDrop
    ? `🌽🎉 NEW TOURNAMENT DROPPED! 🎉🌽`
    : `${phase.emoji} ${opts.tournamentName} — ${phase.label}!`;

  const description = isNewDrop
    ? `**${opts.tournamentName}** has been announced! 🔥\nGet ready, kernels — a new ${typeLabel} is on the horizon!`
    : phase.description;

  const fields: any[] = [];

  if (isNewDrop) {
    fields.push({ name: '🏆 Tournament', value: opts.tournamentName, inline: true });
    fields.push({ name: ' Type', value: typeLabel, inline: true });
  }

  if (opts.previousStatus) {
    const prev = PHASE_DISPLAY[opts.previousStatus];
    fields.push({
      name: '📊 Phase Change',
      value: `${prev?.emoji || '❓'} ${prev?.label || opts.previousStatus} → ${phase.emoji} ${phase.label}`,
      inline: false,
    });
  }

  if (opts.prizePool) {
    fields.push({ name: '💰 Prize Pool', value: opts.prizePool, inline: true });
  }

  if (opts.startDate) {
    const d = new Date(opts.startDate);
    const formatted = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    fields.push({ name: '📅 Start Date', value: formatted, inline: true });
  }

  if (opts.registrationCount != null && opts.registrationCount > 0) {
    fields.push({ name: '🧑‍🌾 Registrations', value: `${opts.registrationCount} kernels signed up`, inline: true });
  }

  if (opts.teamCount != null && opts.teamCount > 0) {
    fields.push({ name: '🛡️ Teams', value: `${opts.teamCount} teams formed`, inline: true });
  }

  fields.push({
    name: '\u200B',
    value: `🌐 [View Tournament](${SITE_URL}/#tournament-hub/${opts.tournamentId})`,
    inline: false,
  });

  const embed = {
    title,
    description,
    color: phase.color,
    fields,
    timestamp: new Date().toISOString(),
  };

  return { embed };
}

// ═══════════════════════════════════════════════════════
// KKUP CHAMPIONS ANNOUNCEMENT EMBED
// ═══════════════════════════════════════════════════════

export function buildChampionsEmbed(opts: {
  tournamentName: string;
  tournamentId: string;
  winningTeamName: string;
  winningTeamTag?: string | null;
  rosterNames?: string[];
}) {
  const title = `🏆🌽 KERNEL KUP CHAMPIONS! 🌽🏆`;
  const description = `**${opts.winningTeamName}** ${opts.winningTeamTag ? `[${opts.winningTeamTag}]` : ''} has won **${opts.tournamentName}**! 🎉🔥\n\nCongratulations to the champions — you've conquered the field! 🌾👑`;

  const fields: any[] = [];

  if (opts.rosterNames && opts.rosterNames.length > 0) {
    fields.push({
      name: '🧑‍🌾 Champions Roster',
      value: opts.rosterNames.map(n => `🌽 ${n}`).join('\n'),
      inline: false,
    });
  }

  fields.push({
    name: '\u200B',
    value: `🌐 [View Tournament](${SITE_URL}/#tournament-hub/${opts.tournamentId})`,
    inline: false,
  });

  const embed = {
    title,
    description,
    color: 0xF1C60F, // kernel-gold
    fields,
    timestamp: new Date().toISOString(),
  };

  return { embed };
}

// ═══════════════════════════════════════════════════════
// POP'D KERNEL ANNOUNCEMENT EMBED
// ═══════════════════════════════════════════════════════

export function buildPopdKernelEmbed(opts: {
  tournamentName: string;
  tournamentId: string;
  winners: { name: string; discordId?: string | null }[];
}) {
  const title = `🍿✨ POP'D KERNEL AWARD! ✨🍿`;
  const winnerLines = opts.winners.map((w, i) => {
    const medal = i === 0 ? '' : '🥈';
    const mention = w.discordId ? `<@${w.discordId}>` : w.name;
    return `${medal} ${mention}`;
  });
  const description = `The Pop'd Kernel award for **${opts.tournamentName}** goes to:\n\n${winnerLines.join('\n')}\n\n🌽 These kernels POP'D OFF! Outstanding performance recognized by the officers! 🔥`;

  const fields: any[] = [{
    name: '\u200B',
    value: `🌐 [View Tournament](${SITE_URL}/#tournament-hub/${opts.tournamentId})`,
    inline: false,
  }];

  const embed = {
    title,
    description,
    color: 0xD6A615, // harvest gold
    fields,
    timestamp: new Date().toISOString(),
  };

  return { embed };
}

// ═══════════════════════════════════════════════════════
// NEW RECIPE EMBED
// ═══════════════════════════════════════════════════════

export function buildNewRecipeEmbed(opts: {
  recipeTitle: string;
  recipeId: string;
  isCorn: boolean;
  authorUsername: string;
  authorDiscordId: string | null;
  authorAvatar: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  ingredientCount?: number;
}) {
  const cornEmoji = opts.isCorn ? '🌽' : '🍳';
  const typeLabel = opts.isCorn ? 'Corn Recipe' : 'Recipe';

  const title = `${cornEmoji} New ${typeLabel} Alert! 🧑‍🍳`;
  const description = `**${opts.recipeTitle}**\nFreshly uploaded by ${opts.authorDiscordId ? `<@${opts.authorDiscordId}>` : opts.authorUsername}!`;

  const fields: any[] = [];

  if (opts.prepTime || opts.cookTime) {
    const times: string[] = [];
    if (opts.prepTime) times.push(`🔪 Prep: ${opts.prepTime}min`);
    if (opts.cookTime) times.push(`🔥 Cook: ${opts.cookTime}min`);
    fields.push({ name: '⏱️ Time', value: times.join(' | '), inline: true });
  }

  if (opts.servings) {
    fields.push({ name: '🍽️ Servings', value: `${opts.servings}`, inline: true });
  }

  if (opts.ingredientCount && opts.ingredientCount > 0) {
    fields.push({ name: '🥘 Ingredients', value: `${opts.ingredientCount} items`, inline: true });
  }

  // discord_avatar is already a full URL from Supabase Auth metadata
  const avatarUrl = opts.authorAvatar || undefined;

  const embed = {
    title,
    description,
    color: opts.isCorn ? 0xF1C60F : 0xA4CA00, // kernel-gold for corn, husk-bright for non-corn
    fields,
    // Author line: recipe author name + profile picture
    author: avatarUrl
      ? { name: opts.authorUsername, icon_url: avatarUrl }
      : { name: opts.authorUsername },
    timestamp: new Date().toISOString(),
  };

  return { embed };
}

// ═══════════════════════════════════════════════════════
// MVP REQUEST EMBEDS
// ═══════════════════════════════════════════════════════

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