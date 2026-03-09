/**
 * RankBadge — Dota 2 rank badge image component
 *
 * Displays the official Dota 2 seasonal rank badge from Supabase storage.
 * Accepts either a medal+stars pair or a getRankDisplay() result.
 *
 * Sizes:
 *   xs  = 16px  — inline with text (roster lists, compact cards)
 *   sm  = 20px  — small cards, pills
 *   md  = 28px  — default, player cards
 *   lg  = 36px  — team rank headers, profile sections
 *   xl  = 48px  — hero displays, modals
 *   2xl = 64px  — profile page hero
 */

import { getRankBadgeUrl, getMedalColor } from '@/lib/rank-utils';

type BadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const SIZE_PX: Record<BadgeSize, number> = {
  xs: 16,
  sm: 20,
  md: 28,
  lg: 36,
  xl: 48,
  '2xl': 64,
};

interface RankBadgeProps {
  /** Medal name: Herald, Guardian, Crusader, Archon, Legend, Ancient, Divine, Immortal */
  medal: string | null | undefined;
  /** Star count (1–5 for Herald–Divine, 0–4 for Immortal tiers) */
  stars?: number;
  /** Display size preset */
  size?: BadgeSize;
  /** Show the medal name as text next to the badge */
  showLabel?: boolean;
  /** Show stars in the label (e.g., "Archon 3") */
  showStars?: boolean;
  /** Additional className on the wrapper */
  className?: string;
}

export function RankBadge({
  medal,
  stars = 0,
  size = 'md',
  showLabel = false,
  showStars = false,
  className = '',
}: RankBadgeProps) {
  const px = SIZE_PX[size];
  const url = getRankBadgeUrl(medal, stars);
  const isUnranked = !medal || medal === 'Unranked';
  const alt = isUnranked
    ? 'Unranked'
    : medal === 'Immortal'
      ? 'Immortal'
      : `${medal} ${stars}`;

  if (showLabel) {
    const color = getMedalColor(medal || 'Unranked');
    const labelText = isUnranked
      ? 'Unranked'
      : medal === 'Immortal'
        ? 'Immortal'
        : showStars && stars > 0
          ? `${medal} ${stars}`
          : medal;

    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <img
          src={url}
          alt={alt}
          width={px}
          height={px}
          className="flex-shrink-0"
          style={{ width: px, height: px }}
          loading="lazy"
        />
        <span className="font-bold text-xs" style={{ color }}>
          {labelText}
        </span>
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      width={px}
      height={px}
      className={`flex-shrink-0 ${className}`}
      style={{ width: px, height: px }}
      title={alt}
      loading="lazy"
    />
  );
}
