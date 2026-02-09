import { Trophy, Award, Medal } from 'lucide-react';

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

const getTrophyConfig = (type: string) => {
  switch (type) {
    case 'kernel_kup_champion':
      return {
        icon: Trophy,
        color: '#FFD700', // Gold
        label: '🏆 Champion',
        gradient: 'from-yellow-400 to-yellow-600',
      };
    case 'popd_kernel_mvp':
      return {
        icon: Award,
        color: '#f97316', // Orange (Fleats brand)
        label: '🍿 Pop\'d Kernel MVP',
        gradient: 'from-orange-400 to-orange-600',
      };
    case 'runner_up':
      return {
        icon: Medal,
        color: '#C0C0C0', // Silver
        label: '🥈 Runner-Up',
        gradient: 'from-gray-300 to-gray-500',
      };
    case 'mvp':
      return {
        icon: Award,
        color: '#CD7F32', // Bronze
        label: '⭐ MVP',
        gradient: 'from-amber-600 to-amber-800',
      };
    default:
      return {
        icon: Trophy,
        color: '#9ca3af',
        label: '🏅 Achievement',
        gradient: 'from-gray-400 to-gray-600',
      };
  }
};

export function TrophyBadges({ achievements, size = 'md', maxDisplay = 5 }: TrophyBadgesProps) {
  if (!achievements || achievements.length === 0) {
    return null;
  }

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const displayAchievements = achievements.slice(0, maxDisplay);
  const remaining = achievements.length - maxDisplay;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {displayAchievements.map((achievement) => {
        const config = getTrophyConfig(achievement.achievement_type);
        const Icon = config.icon;

        return (
          <div
            key={achievement.id}
            className="group relative"
          >
            {/* Trophy Icon with Gradient Background */}
            <div
              className={`
                ${sizeClasses[size]}
                rounded-full
                bg-gradient-to-br ${config.gradient}
                flex items-center justify-center
                shadow-md
                transition-all duration-200
                group-hover:scale-110 group-hover:shadow-lg
                cursor-pointer
              `}
            >
              <Icon className="w-3/5 h-3/5 text-white" strokeWidth={2.5} />
            </div>

            {/* Hover Tooltip */}
            <div
              className="
                absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                bg-[#0f172a] text-white text-xs font-medium
                px-3 py-2 rounded-lg
                whitespace-nowrap
                opacity-0 pointer-events-none
                group-hover:opacity-100 group-hover:pointer-events-auto
                transition-opacity duration-200
                z-50
                shadow-xl
              "
            >
              <div className="font-bold">{config.label}</div>
              <div className="text-white/80 text-[10px] mt-0.5">
                {achievement.kernel_kup.name} ({achievement.kernel_kup.year})
              </div>
              {/* Tooltip Arrow */}
              <div
                className="
                  absolute top-full left-1/2 -translate-x-1/2
                  border-4 border-transparent border-t-[#0f172a]
                "
              />
            </div>
          </div>
        );
      })}

      {/* "+X more" badge if there are more achievements */}
      {remaining > 0 && (
        <div
          className={`
            ${sizeClasses[size]}
            rounded-full
            bg-[#f97316]/10
            border-2 border-[#f97316]
            flex items-center justify-center
            text-[10px] font-bold text-[#f97316]
          `}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
