/**
 * TrophyBadges — Row of trophy images for player achievements
 *
 * Renders actual trophy artwork from Supabase Storage.
 * Each badge shows the trophy at natural proportions with hover tooltip.
 */

import { getTrophyConfig, type TrophyConfig } from '@/lib/trophy-assets';

interface Achievement {
  id: string;
  achievement_type: string;
  kernel_kup: {
    id: string;
    name: string;
    year: number;
  };
  awarded_at: string;
}

interface TrophyBadgesProps {
  achievements: Achievement[];
  size?: 'sm' | 'md' | 'lg';
  maxDisplay?: number;
}

const SIZE_PX: Record<string, number> = {
  sm: 20,
  md: 28,
  lg: 36,
};

export function TrophyBadges({ achievements, size = 'md', maxDisplay = 5 }: TrophyBadgesProps) {
  if (!achievements || achievements.length === 0) {
    return null;
  }

  const h = SIZE_PX[size];
  const displayAchievements = achievements.slice(0, maxDisplay);
  const remaining = achievements.length - maxDisplay;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {displayAchievements.map((achievement) => {
        const config = getTrophyConfig(achievement.achievement_type);
        const fallbackConfig: TrophyConfig = {
          url: '',
          label: 'Achievement',
          fullLabel: 'Achievement',
          color: '#9ca3af',
        };
        const c = config || fallbackConfig;

        return (
          <div
            key={achievement.id}
            className="group relative flex items-center justify-center"
          >
            {c.url ? (
              <img
                src={c.url}
                alt={c.fullLabel}
                className="drop-shadow-md object-contain transition-transform duration-200 group-hover:scale-110 cursor-pointer"
                style={{ height: h, width: 'auto' }}
                loading="lazy"
              />
            ) : (
              <span className="text-xs font-bold" style={{ color: c.color }}>?</span>
            )}

            {/* Hover Tooltip */}
            <div
              className="
                absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                bg-soil text-silk text-xs font-medium
                px-3 py-2 rounded-lg
                whitespace-nowrap
                opacity-0 pointer-events-none
                group-hover:opacity-100 group-hover:pointer-events-auto
                transition-opacity duration-200
                z-50
                shadow-xl
              "
            >
              <div className="font-bold">{c.fullLabel}</div>
              <div className="text-silk/70 text-[10px] mt-0.5">
                {achievement.kernel_kup.name} ({achievement.kernel_kup.year})
              </div>
              <div
                className="
                  absolute top-full left-1/2 -translate-x-1/2
                  border-4 border-transparent border-t-soil
                "
              />
            </div>
          </div>
        );
      })}

      {remaining > 0 && (
        <div
          className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border-2 border-border text-[10px] font-bold text-muted-foreground"
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
