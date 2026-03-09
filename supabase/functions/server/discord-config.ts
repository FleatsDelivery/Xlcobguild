/**
 * Discord Configuration — The Corn Field 2 (Test Server)
 *
 * Non-sensitive IDs only. Tokens/secrets live in Supabase env vars:
 *   DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, DISCORD_PUBLIC_KEY
 *
 * Server ID: 1475609583086075904
 *
 * Maps to the app's role system (roles.ts), rank system (rank-utils.ts),
 * and guild wars progression (profile-page-guild-wars.tsx).
 */

// ── Server ──────────────────────────────────────────────────────────

export const DISCORD_SERVER_ID = '1475609583086075904';

// ── Text Channels ───────────────────────────────────────────────────

export const DISCORD_CHANNELS = {
  ANNOUNCEMENTS:  '1476088289181306980',
  NEW_KERNELS:    '1476088198806638632',
  GAMER_TV:       '1476088331593846814',
  KKUP_UPDATES:   '1476311202714882280',
  BOT_TESTING:    '1476082806601027674',
  BUG_REPORTS:    '1478538152116355324',
  OFFICER_CHAT:   '1476974523676102746',
} as const;

// ── Voice / Stage Channels ──────────────────────────────────────────

export const DISCORD_STAGE_CHANNELS = {
  KKUPTV1: '1476081417426436206',
  KKUPTV2: '1476081449625976893',
} as const;

export const DISCORD_TEAM_VOICE_CHANNELS = [
  '1476081513283063809', // Team 1
  '1476081536129437738', // Team 2
  '1476081560338825380', // Team 3
  '1476081577657368697', // Team 4
  '1476081597420929044', // Team 5
  '1476081622351610001', // Team 6
  '1476081650684133559', // Team 7
  '1476081670615597140', // Team 8
] as const;

// ── Rank Roles (rank_id 1–11 → Discord role IDs) ───────────────────
// Maps to users.rank_id and the RANK_NAMES array in profile-page-guild-wars.tsx
//
//   rank_id  1 = Earwig
//   rank_id  2 = Ugandan Kob
//   rank_id  3 = Private Maize
//   rank_id  4 = Specialist Ingredient
//   rank_id  5 = Corporal Corn Bread
//   rank_id  6 = Sergeant Husk
//   rank_id  7 = Sergeant Major Fields
//   rank_id  8 = Captain Cornhole
//   rank_id  9 = Major Cob
//   rank_id 10 = Corn Star
//   rank_id 11 = Pop'd Kernel (prestige 5 only)

export const DISCORD_RANK_ROLES: Record<number, string> = {
  1:  '1478541178344575027', // Earwig
  2:  '1478542767117303900', // Ugandan Kob
  3:  '1478542801196027996', // Private Maize
  4:  '1478542832141865112', // Specialist Ingredient
  5:  '1478542880707711128', // Corporal Corn Bread
  6:  '1478542915860037672', // Sergeant Husk
  7:  '1478542985162395709', // Sergeant Major Fields
  8:  '1478543049285046398', // Captain Cornhole
  9:  '1478543083187601582', // Major Cob
  10: '1478543121007640697', // Corn Star
  11: '1478543145158443108', // Pop'd Kernel
};

// ── Prestige Roles (prestige_level 1–5 → Discord role IDs) ──────────

export const DISCORD_PRESTIGE_ROLES: Record<number, string> = {
  1: '1478543493805904056',
  2: '1478543517503717610',
  3: '1478543546058408076',
  4: '1478543582850711684',
  5: '1478543605483175967',
};

// ── Guild Roles — DEPRECATED ────────────────────────────────────────
// Guild affiliation Discord role IDs now live on guild_wars_guilds.discord_role_id
// in the database. These legacy mappings are kept as a reference only.
// The 4 default guild discord_role_ids are seeded in the guild_wars_guilds table.
// User-created guilds get a Discord role auto-created via the Discord API.

export const DISCORD_GUILD_ROLES: Record<string, string> = {
  member: '1478543774383739022', // XLCOB
  eafd:   '1478543805459337257', // EAFD
  fthog:  '1478543838069919836', // FTHOG
};

// ── Officer / Admin Roles ───────────────────────────────────────────

export const DISCORD_ADMIN_ROLES: Record<string, string> = {
  owner:         '1478543981272105054', // Colonel Kernel
  admin:         '1478543919926083664', // Cob Officer
  queen_of_hog:  '1479520366270611488', // Queen Of Hog
};

// ── Special Roles ───────────────────────────────────────────────────

export const DISCORD_SPECIAL_ROLES = {
  COACH:     '1478544313393877183',
  CASTER:    '1478544336756146448',
  PLAYER:    '1478544355743633519',
  TCF_PLUS:  '1478545357280641199',
  DEV_TEAM:  '1478544064323522560',
} as const;

// ── Award Roles ─────────────────────────────────────────────────────

export const DISCORD_AWARD_ROLES = {
  KERNEL_KUP_CHAMPS:       '1478544142006227055',
  POPD_KERNEL_AWARD_WINNER: '1478544192115445832',
} as const;

// ── Discord Webhooks ────────────────────────────────────────────────
// Channel-specific webhook URLs for automated notifications.
// Each posts to a dedicated channel in the Discord server.
//
// SECURITY NOTE: These contain tokens but are server-side only (edge functions).
// Never import this file from frontend code.

export const DISCORD_WEBHOOKS = {
  /** #gamer-tv — MVP submissions, rank changes, general gaming announcements */
  MVP_SUBMISSION:
    'https://discordapp.com/api/webhooks/1479525072321646623/MvI7xzlmEvWGkEyFwNmAiO2UvX1_trhoHzwOzPmkq6GiMLnKhlpVI3UBuYuAalcqvKf0',

  /** #announcements — Tournament announcements (new drops + phase changes) */
  KKUP_ANNOUNCEMENT:
    'https://discordapp.com/api/webhooks/1479525799018365242/gOkumeAjGOS4tvuCARCCWaJbtMMX5S8EUvc3t0nIlP7yOrCiKApx1rrONY8S-aU6DnWS',

  /** #new-kernels — New member/recipe posts */
  NEW_RECIPE:
    'https://discordapp.com/api/webhooks/1479526445020745859/9IwHy4PhnvMjfBZ9HOpPPITopyZCxPgFjIXSRR3hNt6t2tFmW3H59aN6sICyljx79naq',

  /** #giveaways — Giveaway announcements and winner reveals */
  GIVEAWAY_ANNOUNCEMENT:
    'https://discordapp.com/api/webhooks/1479526709094125589/J2bXYpupUsskOzutdG8d0iC0FqjOXUVCup2US_S7E0-FeZ8Ayzp8ea3H2y1R_GeI-hmD',

  /** #kkup-updates — Bracket updates, match results */
  BRACKET_UPDATE:
    'https://discordapp.com/api/webhooks/1479526927751577640/nfahM6rBlDrRaDdx9GODyYm6gK4cCCKIgmK6F8ZNAnRy1OyP-k81XFx6JF30WbvBup1D',

  /** #announcements — Kernel Kup champions announcement */
  KKUP_CHAMPIONS_ANNOUNCEMENT:
    'https://discordapp.com/api/webhooks/1479528167747223698/IishxNroQRXkSW6JexOQHT44KfcANDi7fqJHnz-XYq-JBakW0G4MzdRfPfPOiCWn9fHL',

  /** #announcements — Pop'd Kernel award ceremony */
  POPD_KERNEL_ANNOUNCEMENT:
    'https://discordapp.com/api/webhooks/1479528270817919107/rsSJCxcP_A338HDIfFYLkz9BZVzhhCNomSdxjoup3ptjOOL2LiiMj7lY1E6io_9mrPp8',

  /** KKUP TV1 stream update channel */
  KKUP_TV1:
    'https://discordapp.com/api/webhooks/1479528484731883551/8knH17E4i6XoF_2V7GYOXlOklDkxnHn8VRg26yy1xaMP02Hw1VKbp8Su42AVBbGg-bof',

  /** KKUP TV2 stream update channel */
  KKUP_TV2:
    'https://discordapp.com/api/webhooks/1479528613635424398/0WHl-nUXQkooYG_TzWzQNUhgozoT0JOfhf99L_Hq3_fclPb_1z1-MFhyk3WTfhucmaUG',

  /** KKUP TV3 stream update channel */
  KKUP_TV3:
    'https://discordapp.com/api/webhooks/1479528697462526116/RLv7RHRaS7yT6FUxJxZH64Mp5GKcJmzjd6ovIHlH8zT10iiGAVVwAHSx8RJ8bW_HTLpF',

  /** KKUP TV4 stream update channel */
  KKUP_TV4:
    'https://discordapp.com/api/webhooks/1479528759647539270/k26sBwh9ATUpQeu9p1cZBmTc8EZPYzgG4YgmNSH5Q1YT1z7hhk8RdvzCHi63OEtVSOo3',

  /** #kkup-updates — All Kernel Kup activity: registrations, withdrawals, teams, invites, roster changes */
  KKUP_REGISTRATIONS:
    'https://discordapp.com/api/webhooks/1479628501421134064/vewrPYyknmcuMDr8__DI6Vq7rAsMDrAy5EYMySzQ5qI4LacxKO-U2ftRwQZyGvEaMv_Z',
} as const;

/** Twitch channel URLs for each KKUP TV stream */
export const KKUP_TV_CHANNELS = {
  TV1: 'https://www.twitch.tv/kernelkup_tv1',
  TV2: 'https://www.twitch.tv/kernelkup_tv2',
  TV3: 'https://www.twitch.tv/kernelkup_tv3',
  TV4: 'https://www.twitch.tv/kernelkup_tv4',
} as const;

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Get the Discord role ID for a user's current guild rank.
 * Returns null if rank_id is invalid.
 */
export function getDiscordRankRoleId(rankId: number): string | null {
  return DISCORD_RANK_ROLES[rankId] || null;
}

/**
 * Get the Discord role ID for a user's prestige level.
 * Returns null if prestige is 0 or invalid.
 */
export function getDiscordPrestigeRoleId(prestigeLevel: number): string | null {
  return DISCORD_PRESTIGE_ROLES[prestigeLevel] || null;
}

/**
 * Get the Discord role ID for a user's permission role (officer/admin).
 * Returns null for member/guest roles (those don't have Discord permission roles).
 * Guild affiliation Discord roles are stored on guild_wars_guilds.discord_role_id.
 */
export function getDiscordPermissionRoleId(appRole: string): string | null {
  return DISCORD_ADMIN_ROLES[appRole] || null;
}

/**
 * Get ALL Discord role IDs that should be removed when changing a rank.
 * Returns every rank role ID except the one for the new rank.
 */
export function getOldRankRoleIds(newRankId: number): string[] {
  return Object.entries(DISCORD_RANK_ROLES)
    .filter(([id]) => Number(id) !== newRankId)
    .map(([, roleId]) => roleId);
}

/**
 * Get ALL Discord prestige role IDs except the current one.
 */
export function getOldPrestigeRoleIds(newPrestige: number): string[] {
  return Object.entries(DISCORD_PRESTIGE_ROLES)
    .filter(([level]) => Number(level) !== newPrestige)
    .map(([, roleId]) => roleId);
}

/**
 * Get ALL Discord admin/officer role IDs except the current one.
 * Used when switching a user's permission role.
 */
export function getOldAdminRoleIds(newAppRole: string): string[] {
  return Object.entries(DISCORD_ADMIN_ROLES)
    .filter(([role]) => role !== newAppRole)
    .map(([, roleId]) => roleId);
}

// ── Voice Channel Management ────────────────────────────────────────

/**
 * Rename a Discord channel via the Bot API.
 * PATCH /channels/{id} — requires "Manage Channels" permission on the bot.
 * Discord rate-limits channel name changes to ~2 per 10 min per channel,
 * so only call this during bracket lifecycle events (generation, elimination).
 */
export async function renameDiscordChannel(channelId: string, newName: string): Promise<boolean> {
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!botToken) {
    console.error('renameDiscordChannel: DISCORD_BOT_TOKEN not set');
    return false;
  }

  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${botToken}`,
      },
      body: JSON.stringify({ name: newName }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`renameDiscordChannel failed for ${channelId} → "${newName}" (${res.status}): ${errText}`);
      return false;
    }

    console.log(`Renamed Discord channel ${channelId} → "${newName}"`);
    return true;
  } catch (err) {
    console.error(`renameDiscordChannel error for ${channelId}:`, err);
    return false;
  }
}

/** Ordinal suffix helper: 1→"1st", 2→"2nd", 3→"3rd", 4→"4th", etc. */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Rename all 8 team voice channels based on bracket seeding.
 * Channels are mapped 1:1 by seed: seed 1 → channel[0], seed 2 → channel[1], etc.
 *
 * @param seededTeams - Array sorted by seed (index 0 = seed 1). Each has { teamTag }.
 *                      Length can be 6-8 (fewer than 8 means remaining channels reset).
 * @param mode - 'seeded' for initial bracket, or a map of eliminated seed numbers for updates.
 */
export async function renameTeamVoiceChannels(
  seededTeams: { seed: number; teamTag: string }[],
  eliminatedSeeds: Set<number> = new Set(),
): Promise<{ renamed: number; failed: number }> {
  let renamed = 0;
  let failed = 0;

  for (let i = 0; i < DISCORD_TEAM_VOICE_CHANNELS.length; i++) {
    const channelId = DISCORD_TEAM_VOICE_CHANNELS[i];
    const seed = i + 1;
    const team = seededTeams.find(t => t.seed === seed);

    let newName: string;
    if (!team) {
      // No team at this seed slot (< 8 teams) — reset to default
      newName = `Team ${seed}`;
    } else if (eliminatedSeeds.has(seed)) {
      newName = `${ordinal(seed)} Seed: Eliminated`;
    } else {
      newName = `${ordinal(seed)} Seed: ${team.teamTag.toUpperCase()}`;
    }

    // Small delay between requests to respect rate limits
    if (i > 0) await new Promise(r => setTimeout(r, 500));

    const ok = await renameDiscordChannel(channelId, newName);
    if (ok) renamed++;
    else failed++;
  }

  return { renamed, failed };
}

/**
 * Reset all team voice channels back to defaults ("Team 1", "Team 2", etc.)
 */
export async function resetTeamVoiceChannels(): Promise<void> {
  for (let i = 0; i < DISCORD_TEAM_VOICE_CHANNELS.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 500));
    await renameDiscordChannel(DISCORD_TEAM_VOICE_CHANNELS[i], `Team ${i + 1}`);
  }
}