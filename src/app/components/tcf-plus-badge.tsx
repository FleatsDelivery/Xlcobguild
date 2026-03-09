import { Crown } from '@/lib/icons';

/**
 * TCF+ membership badge — reusable across leaderboard, player modals, profiles, etc.
 * 
 * Sizes:
 * - 'xs'  — inline with text (leaderboard rows, mobile)
 * - 'sm'  — slightly larger (desktop leaderboard, cards)
 * - 'md'  — modal headers, profile sections
 */

type BadgeSize = 'xs' | 'sm' | 'md';

const SIZE_CONFIG: Record<BadgeSize, { pill: string; icon: string; text: string }> = {
  xs: {
    pill: 'px-1.5 py-0.5 gap-0.5 rounded-full',
    icon: 'w-2.5 h-2.5',
    text: 'text-[8px] font-bold',
  },
  sm: {
    pill: 'px-2 py-0.5 gap-1 rounded-full',
    icon: 'w-3 h-3',
    text: 'text-[10px] font-bold',
  },
  md: {
    pill: 'px-2.5 py-1 gap-1 rounded-full',
    icon: 'w-3.5 h-3.5',
    text: 'text-xs font-bold',
  },
};

interface TcfPlusBadgeProps {
  size?: BadgeSize;
  className?: string;
}

export function TcfPlusBadge({ size = 'sm', className = '' }: TcfPlusBadgeProps) {
  const cfg = SIZE_CONFIG[size];

  return (
    <span
      className={`inline-flex items-center ${cfg.pill} bg-gradient-to-r from-harvest to-kernel-gold text-soil flex-shrink-0 ${className}`}
      title="TCF+ Member"
    >
      <Crown className={cfg.icon} />
      <span className={cfg.text}>TCF+</span>
    </span>
  );
}
