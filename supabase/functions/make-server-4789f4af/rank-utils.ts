/**
 * Server-side Dota 2 Rank utilities — Single source of truth for the server.
 *
 * Mirrors the frontend `/src/lib/rank-utils.ts` for the subset needed by
 * registration, team creation, and role-switching rank checks.
 *
 * Used by: routes-tournament-lifecycle.ts, routes-team-formation.ts
 */

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

/**
 * Resolve a user's Dota rank medal from their DB record.
 * Uses OpenDota badge_rank exclusively.
 *
 * NOTE: users.rank_id is the GUILD/community rank (1–10), NOT a Dota rank.
 * Dota rank comes only from opendota_data.badge_rank.
 *
 * Returns { medal, stars, selfReported } or null if rank is unknown.
 */
export function resolveUserRank(dbUser: any): {
  medal: string;
  stars: number;
  selfReported: boolean;
} | null {
  const badgeRank = dbUser?.opendota_data?.badge_rank;

  // Only source of Dota rank: OpenDota badge_rank
  if (badgeRank?.medal && badgeRank.medal !== 'Unranked') {
    return {
      medal: badgeRank.medal,
      stars: badgeRank.stars || 0,
      selfReported: !!badgeRank.self_reported,
    };
  }

  return null;
}

const MEDAL_ORDER = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'] as const;

export function rankToNumeric(medal: string, stars: number): number {
  const tierIndex = MEDAL_ORDER.indexOf(medal as any);
  if (tierIndex === -1) return 0;
  if (medal === 'Immortal') return 36;
  return tierIndex * 5 + Math.max(1, Math.min(5, stars));
}

function numericToRank(value: number): { medal: string; stars: number } {
  if (value <= 0) return { medal: 'Unranked', stars: 0 };
  if (value >= 36) return { medal: 'Immortal', stars: 0 };
  const clamped = Math.max(1, Math.min(35, Math.round(value)));
  const tierIndex = Math.floor((clamped - 1) / 5);
  const stars = ((clamped - 1) % 5) + 1;
  return { medal: MEDAL_ORDER[tierIndex], stars };
}

// Default max rank: Divine 1 = 31 on the 1–36 numeric scale
export const DEFAULT_MAX_PLAYER_RANK = 31;
export const DEFAULT_MIN_PLAYER_RANK = 1;

// ── Badge Image URLs (mirrors frontend /src/lib/rank-utils.ts) ──
const BADGE_BASE_URL = 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/dota-badge-ranks';

const MEDAL_TIER: Record<string, number> = {
  Herald: 1, Guardian: 2, Crusader: 3, Archon: 4, Legend: 5, Ancient: 6, Divine: 7,
};

/** Get the public Supabase Storage URL for a Dota 2 rank badge image. */
export function getRankBadgeUrl(medal: string | null | undefined, stars?: number): string {
  if (!medal || medal === 'Unranked') return `${BADGE_BASE_URL}/SeasonalRank0-0.png`;
  if (medal === 'Immortal') {
    const tier = Math.max(0, Math.min(4, stars || 0));
    return `${BADGE_BASE_URL}/SeasonalRankTop${tier}.png`;
  }
  const tierNum = MEDAL_TIER[medal];
  if (!tierNum) return `${BADGE_BASE_URL}/SeasonalRank0-0.png`;
  const clampedStars = Math.max(1, Math.min(5, stars || 1));
  return `${BADGE_BASE_URL}/SeasonalRank${tierNum}-${clampedStars}.png`;
}

/**
 * Check if a user's rank is eligible for Kernel Kup player registration.
 *
 * Rules:
 *   {minRank} through {maxRank} = eligible to play
 *   Below {minRank} or above {maxRank} = blocked from playing, can coach
 *   Unknown rank = blocked until they self-report or connect Steam
 *
 * @param dbUser - User record from the database
 * @param selfReportedRank - Optional medal name the user self-reported (e.g. 'Archon')
 * @param maxNumericRank - Maximum numeric rank allowed (1–36 scale). Defaults to DEFAULT_MAX_PLAYER_RANK.
 * @param minNumericRank - Minimum numeric rank allowed (1–36 scale). Defaults to DEFAULT_MIN_PLAYER_RANK.
 */
export function checkKernelKupEligibility(
  dbUser: any,
  selfReportedRank?: string | null,
  maxNumericRank: number = DEFAULT_MAX_PLAYER_RANK,
  minNumericRank: number = DEFAULT_MIN_PLAYER_RANK,
): {
  eligible: boolean;
  rankMedal: string | null;
  rankStars: number;
  selfReported: boolean;
  rankUnknown: boolean;
  reason: string;
} {
  const resolved = resolveUserRank(dbUser);

  // No rank data and no self-report
  if (!resolved && !selfReportedRank) {
    return {
      eligible: false,
      rankMedal: null,
      rankStars: 0,
      selfReported: false,
      rankUnknown: true,
      reason: 'We couldn\'t determine your Dota 2 rank. Please tell us your approximate skill level so we can check eligibility.',
    };
  }

  const effectiveMedal = resolved?.medal || selfReportedRank || null;
  const effectiveStars = resolved
    ? resolved.stars
    : (selfReportedRank === 'Divine' ? 1 : (selfReportedRank === 'Immortal' ? 0 : 0));
  const isSelfReported = !resolved && !!selfReportedRank;

  // Convert to numeric for comparison
  const playerNumeric = effectiveMedal
    ? rankToNumeric(effectiveMedal, effectiveStars || 1)
    : 0;

  // Build display strings for the rank thresholds
  const maxRankDisplay = numericToRank(maxNumericRank);
  const maxRankStr = maxRankDisplay.medal === 'Immortal'
    ? 'Immortal'
    : `${maxRankDisplay.medal} ${maxRankDisplay.stars}`;

  const minRankDisplay = numericToRank(minNumericRank);
  const minRankStr = minRankDisplay.medal === 'Immortal'
    ? 'Immortal'
    : `${minRankDisplay.medal} ${minRankDisplay.stars}`;

  const playerRankStr = `${effectiveMedal}${effectiveStars ? ' ' + effectiveStars : ''}`;

  if (playerNumeric > maxNumericRank) {
    return {
      eligible: false,
      rankMedal: effectiveMedal,
      rankStars: effectiveStars,
      selfReported: isSelfReported,
      rankUnknown: false,
      reason: `This tournament is for ${minRankStr} through ${maxRankStr}. Your rank (${playerRankStr}) is above the eligibility threshold. You can still participate as a Coach!`,
    };
  }

  if (playerNumeric < minNumericRank) {
    return {
      eligible: false,
      rankMedal: effectiveMedal,
      rankStars: effectiveStars,
      selfReported: isSelfReported,
      rankUnknown: false,
      reason: `This tournament is for ${minRankStr} through ${maxRankStr}. Your rank (${playerRankStr}) is below the minimum eligibility threshold.`,
    };
  }

  // Eligible
  return {
    eligible: true,
    rankMedal: effectiveMedal,
    rankStars: effectiveStars,
    selfReported: isSelfReported,
    rankUnknown: false,
    reason: '',
  };
}