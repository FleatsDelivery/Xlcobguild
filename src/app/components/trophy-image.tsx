/**
 * TrophyImage — Renders trophy artwork from Supabase Storage
 *
 * Preserves natural aspect ratio — only constrains HEIGHT, width scales
 * automatically. This prevents squishing since trophies are tall/narrow.
 *
 * Sizes (max height):
 *   xs  = 20px  — inline badges, compact lists
 *   sm  = 24px  — player card badges row
 *   md  = 32px  — default, cards and pills
 *   lg  = 40px  — section headers, profile stats
 *   xl  = 56px  — hero displays, modals
 *   2xl = 72px  — profile page hero, award ceremonies
 */

import { getTrophyConfig, type TrophyConfig } from '@/lib/trophy-assets';

type TrophySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const SIZE_PX: Record<TrophySize, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 56,
  '2xl': 72,
};

// ── Main component ─────────────────────────────────────────────────────

interface TrophyImageProps {
  /** Trophy type key from TROPHY_CONFIGS (e.g. 'kernel_kup_champion') */
  type: string;
  /** Display size preset */
  size?: TrophySize;
  /** Show the label text next to the image */
  showLabel?: boolean;
  /** Show a count badge (e.g. "3x") next to the label */
  count?: number;
  /** Additional className on the wrapper */
  className?: string;
  /** Override tooltip text */
  title?: string;
}

export function TrophyImage({
  type,
  size = 'md',
  showLabel = false,
  count,
  className = '',
  title,
}: TrophyImageProps) {
  const config = getTrophyConfig(type);
  if (!config) return null;

  const h = SIZE_PX[size];
  const alt = config.fullLabel;
  const tooltipText = title || (count ? `${count}x ${config.fullLabel}` : config.fullLabel);

  if (showLabel) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <img
          src={config.url}
          alt={alt}
          className="flex-shrink-0 drop-shadow-md object-contain"
          style={{ height: h, width: 'auto' }}
          loading="lazy"
          title={tooltipText}
        />
        <span className="font-bold text-xs" style={{ color: config.color }}>
          {count !== undefined && count > 0 ? `${count}x ` : ''}
          {config.label}
        </span>
      </span>
    );
  }

  return (
    <img
      src={config.url}
      alt={alt}
      className={`flex-shrink-0 drop-shadow-md object-contain ${className}`}
      style={{ height: h, width: 'auto' }}
      title={tooltipText}
      loading="lazy"
    />
  );
}

// ── Inline variant for tight spaces (e.g. replacing emoji in text) ────

interface TrophyInlineProps {
  type: string;
  size?: TrophySize;
  className?: string;
}

/** Minimal inline trophy — just the image, sized to sit inside text. */
export function TrophyInline({ type, size = 'sm', className = '' }: TrophyInlineProps) {
  const config = getTrophyConfig(type);
  if (!config) return null;
  const h = SIZE_PX[size];

  return (
    <img
      src={config.url}
      alt={config.fullLabel}
      className={`inline-block align-middle drop-shadow-md flex-shrink-0 object-contain ${className}`}
      style={{ height: h, width: 'auto' }}
      loading="lazy"
      title={config.fullLabel}
    />
  );
}
