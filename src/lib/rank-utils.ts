/**
 * Dota 2 Rank Utilities — Frontend
 *
 * Single source of truth for rank display, medal colors, team rank calculation,
 * and numeric rank conversions on the frontend.
 *
 * IMPORTANT: `users.rank_id` is the GUILD/community rank (1–10), NOT a Dota rank.
 * Dota rank comes exclusively from `opendota_data.badge_rank`.
 */

// ── Constants ──────────────────────────────────────────────────────────

export const RANK_MEDALS: Record<number, string> = {
  1: 'Herald', 2: 'Herald', 3: 'Herald', 4: 'Herald', 5: 'Herald',
  11: 'Guardian', 12: 'Guardian', 13: 'Guardian', 14: 'Guardian', 15: 'Guardian',
  21: 'Crusader', 22: 'Crusader', 23: 'Crusader', 24: 'Crusader', 25: 'Crusader',
  31: 'Archon', 32: 'Archon', 33: 'Archon', 34: 'Archon', 35: 'Archon',
  41: 'Legend', 42: 'Legend', 43: 'Legend', 44: 'Legend', 45: 'Legend',
  51: 'Ancient', 52: 'Ancient', 53: 'Ancient', 54: 'Ancient', 55: 'Ancient',
  61: 'Divine', 62: 'Divine', 63: 'Divine', 64: 'Divine', 65: 'Divine',
  71: 'Immortal', 72: 'Immortal', 73: 'Immortal', 74: 'Immortal', 75: 'Immortal', 80: 'Immortal',
};

const MEDAL_ORDER = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'] as const;

const MEDAL_COLORS: Record<string, string> = {
  Herald: '#8b7355',
  Guardian: '#a0a0a0',
  Crusader: '#3cb371',
  Archon: '#daa520',
  Legend: '#ffd700',
  Ancient: '#ff6347',
  Divine: '#6495ed',
  Immortal: '#ff4500',
  Unranked: '#888888',
};

// Default max rank: Divine 1 = 31 on the 1–36 numeric scale
export const DEFAULT_MAX_PLAYER_RANK = 31;
export const DEFAULT_MIN_PLAYER_RANK = 1;

// ── Types ──────────────────────────────────────────────────────────────

export interface RankEligibility {
  eligible: boolean;
  rankMedal: string | null;
  rankStars: number;
  selfReported: boolean;
  rankUnknown: boolean;
  reason: string;
}

export interface TeamRankResult {
  average: number;
  medal: string;
  stars: number;
  rankedCount: number;
  totalCount: number;
  display: string;
}

// ── Badge Image URLs ──────────────────────────────────────────────────

const BADGE_BASE_URL = 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/dota-badge-ranks';

/** Medal name → Dota 2 SeasonalRank tier number (1–7). */
const MEDAL_TIER: Record<string, number> = {
  Herald: 1, Guardian: 2, Crusader: 3, Archon: 4,
  Legend: 5, Ancient: 6, Divine: 7,
};

/**
 * Get the public Supabase Storage URL for a Dota 2 rank badge image.
 *
 * Naming convention matches Valve's files:
 *   Herald 1–Divine 5  → SeasonalRank{tier}-{stars}.png
 *   Immortal            → SeasonalRankTop0.png  (Top1–4 for leaderboard tiers)
 *   Unranked            → SeasonalRank0-0.png
 */
export function getRankBadgeUrl(
  medal: string | null | undefined,
  stars?: number,
): string {
  if (!medal || medal === 'Unranked') {
    return `${BADGE_BASE_URL}/SeasonalRank0-0.png`;
  }

  if (medal === 'Immortal') {
    // stars 0–4 map to Top0–Top4 (leaderboard tiers); default to Top0
    const tier = Math.max(0, Math.min(4, stars || 0));
    return `${BADGE_BASE_URL}/SeasonalRankTop${tier}.png`;
  }

  const tierNum = MEDAL_TIER[medal];
  if (!tierNum) return `${BADGE_BASE_URL}/SeasonalRank0-0.png`;

  const clampedStars = Math.max(1, Math.min(5, stars || 1));
  return `${BADGE_BASE_URL}/SeasonalRank${tierNum}-${clampedStars}.png`;
}

// ── Core Functions ─────────────────────────────────────────────────────

/**
 * Get a displayable rank from OpenDota badge_rank data.
 *
 * NOTE: `users.rank_id` is the GUILD/community rank (1–10), NOT a Dota rank.
 * Dota rank comes exclusively from `opendota_data.badge_rank`.
 */
export function getRankDisplay(
  badgeRank: { medal?: string; stars?: number } | null | undefined,
): { medal: string; stars: number } | null {
  if (badgeRank && badgeRank.medal && badgeRank.medal !== 'Unranked') {
    return { medal: badgeRank.medal, stars: badgeRank.stars || 0 };
  }
  return null;
}

/** Get the hex color for a medal name. */
export function getMedalColor(medal: string): string {
  return MEDAL_COLORS[medal] || MEDAL_COLORS.Unranked;
}

// ── Numeric Rank Conversions ───────────────────────────────────────────

/** Convert a medal + stars to a 1–36 numeric value. */
export function rankToNumeric(medal: string, stars: number): number {
  const tierIndex = MEDAL_ORDER.indexOf(medal as any);
  if (tierIndex === -1) return 0;
  if (medal === 'Immortal') return 36;
  return tierIndex * 5 + Math.max(1, Math.min(5, stars));
}

/** Convert a numeric value (1–36) back to a medal + stars. */
export function numericToRank(value: number): { medal: string; stars: number } {
  if (value <= 0) return { medal: 'Unranked', stars: 0 };
  if (value >= 36) return { medal: 'Immortal', stars: 0 };
  const clamped = Math.max(1, Math.min(35, Math.round(value)));
  const tierIndex = Math.floor((clamped - 1) / 5);
  const stars = ((clamped - 1) % 5) + 1;
  return { medal: MEDAL_ORDER[tierIndex], stars };
}

// ── Player Rank Helpers ────────────────────────────────────────────────

/**
 * Get a single numeric rank value from a user-like object or badge_rank data.
 * Handles both flat badge_rank and nested opendota_data.badge_rank structures.
 *
 * NOTE: users.rank_id is the GUILD rank (1–10), NOT Dota rank — ignored here.
 * Returns null if rank is unknown.
 */
export function getPlayerNumericRank(
  badgeRankOrUser: { medal?: string; stars?: number } | { opendota_data?: any; badge_rank?: any } | null | undefined,
): number | null {
  let badgeRank: { medal?: string; stars?: number } | null = null;

  if (badgeRankOrUser && 'opendota_data' in badgeRankOrUser) {
    badgeRank = badgeRankOrUser.opendota_data?.badge_rank || badgeRankOrUser.badge_rank || null;
  } else {
    badgeRank = badgeRankOrUser as any;
  }

  const display = getRankDisplay(badgeRank);
  if (!display) return null;
  return rankToNumeric(display.medal, display.stars);
}

// ── Eligibility Check ──────────────────────────────────────────────────

/**
 * Check if a user's rank is eligible for Kernel Kup player registration (frontend).
 *
 * NOTE: users.rank_id is the GUILD rank (1–10), NOT Dota rank — do NOT use it here.
 */
export function getKernelKupEligibility(
  user: any,
  maxNumericRank: number = DEFAULT_MAX_PLAYER_RANK,
  minNumericRank: number = DEFAULT_MIN_PLAYER_RANK,
): RankEligibility {
  const badgeRank = user?.opendota_data?.badge_rank;

  let rankMedal: string | null = null;
  let rankStars = 0;
  let selfReported = false;

  if (badgeRank?.medal && badgeRank.medal !== 'Unranked') {
    rankMedal = badgeRank.medal;
    rankStars = badgeRank.stars || 0;
    selfReported = !!badgeRank.self_reported;
  }

  if (!rankMedal) {
    return {
      eligible: false,
      rankMedal: null,
      rankStars: 0,
      selfReported: false,
      rankUnknown: true,
      reason: 'We couldn\'t determine your Dota 2 rank. Please tell us your approximate skill level so we can check eligibility.',
    };
  }

  const playerNumeric = rankToNumeric(rankMedal, rankStars || 1);

  const maxRankDisplay = numericToRank(maxNumericRank);
  const maxRankStr = maxRankDisplay.medal === 'Immortal'
    ? 'Immortal'
    : `${maxRankDisplay.medal} ${maxRankDisplay.stars}`;

  const minRankDisplay = numericToRank(minNumericRank);
  const minRankStr = minRankDisplay.medal === 'Immortal'
    ? 'Immortal'
    : `${minRankDisplay.medal} ${minRankDisplay.stars}`;

  const playerRankStr = `${rankMedal}${rankStars ? ' ' + rankStars : ''}`;

  if (playerNumeric > maxNumericRank) {
    return {
      eligible: false,
      rankMedal,
      rankStars,
      selfReported,
      rankUnknown: false,
      reason: `This tournament is for ${minRankStr} through ${maxRankStr}. Your rank (${playerRankStr}) is above the eligibility threshold. You can still participate as a Coach!`,
    };
  }

  if (playerNumeric < minNumericRank) {
    return {
      eligible: false,
      rankMedal,
      rankStars,
      selfReported,
      rankUnknown: false,
      reason: `This tournament is for ${minRankStr} through ${maxRankStr}. Your rank (${playerRankStr}) is below the minimum eligibility threshold.`,
    };
  }

  return {
    eligible: true,
    rankMedal,
    rankStars,
    selfReported,
    rankUnknown: false,
    reason: '',
  };
}

// ── Team Rank Calculation ──────────────────────────────────────────────

/**
 * Calculate a team's average rank from roster members + coach.
 *
 * @param rosterMembers - array of roster entries, each with `.linked_user` containing opendota_data
 * @param coach - optional coach user object with rank info
 */
export function calculateTeamRank(
  rosterMembers: any[],
  coach?: any,
): TeamRankResult | null {
  const numericRanks: number[] = [];
  let totalCount = 0;

  for (const member of rosterMembers) {
    totalCount++;
    const lu = member.linked_user;
    if (!lu) continue;
    const numeric = getPlayerNumericRank(lu);
    if (numeric !== null) numericRanks.push(numeric);
  }

  if (coach) {
    totalCount++;
    const numeric = getPlayerNumericRank(coach);
    if (numeric !== null) numericRanks.push(numeric);
  }

  if (numericRanks.length === 0) return null;

  const average = numericRanks.reduce((sum, v) => sum + v, 0) / numericRanks.length;
  const { medal, stars } = numericToRank(average);

  return {
    average,
    medal,
    stars,
    rankedCount: numericRanks.length,
    totalCount,
    display: medal === 'Immortal' ? 'Immortal' : `${medal} ${stars}`,
  };
}