/**
 * TcfPlusAvatarRing — Gold glow ring wrapper for TCF+ members' avatars.
 *
 * Wraps any avatar element with:
 *   - A bright gold gradient border
 *   - An animated soft glow pulse
 *   - A tiny crown badge anchored at the bottom-right
 *
 * Usage:
 *   <TcfPlusAvatarRing active={user.tcf_plus_active} size="md">
 *     <img src={avatar} className="w-12 h-12 rounded-full" />
 *   </TcfPlusAvatarRing>
 *
 * When `active` is false/null, renders children without decoration.
 */

import { Crown } from 'lucide-react';
import { useEffect } from 'react';

type RingSize = 'xs' | 'sm' | 'md' | 'lg';

const RING_CONFIG: Record<RingSize, {
  padding: string;
  glowBase: string;
  crownSize: string;
  crownIcon: string;
  crownOffset: string;
}> = {
  xs: {
    padding: '2px',
    glowBase: '0 0 6px 1px rgba(241,198,15,0.4)',
    crownSize: 'w-3.5 h-3.5',
    crownIcon: 'w-2 h-2',
    crownOffset: '-bottom-0.5 -right-0.5',
  },
  sm: {
    padding: '2px',
    glowBase: '0 0 8px 2px rgba(241,198,15,0.4)',
    crownSize: 'w-4 h-4',
    crownIcon: 'w-2.5 h-2.5',
    crownOffset: '-bottom-0.5 -right-0.5',
  },
  md: {
    padding: '3px',
    glowBase: '0 0 10px 3px rgba(241,198,15,0.35)',
    crownSize: 'w-5 h-5',
    crownIcon: 'w-3 h-3',
    crownOffset: '-bottom-0.5 -right-0.5',
  },
  lg: {
    padding: '3px',
    glowBase: '0 0 14px 4px rgba(241,198,15,0.35)',
    crownSize: 'w-6 h-6',
    crownIcon: 'w-3.5 h-3.5',
    crownOffset: '-bottom-1 -right-1',
  },
};

// Inject keyframes once globally
let styleInjected = false;
function injectGlowKeyframes() {
  if (styleInjected || typeof document === 'undefined') return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes tcfPlusGlow {
      0%, 100% { box-shadow: 0 0 8px 2px rgba(241,198,15,0.35); }
      50% { box-shadow: 0 0 16px 5px rgba(241,198,15,0.55); }
    }
    .tcf-plus-ring {
      animation: tcfPlusGlow 3s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

interface TcfPlusAvatarRingProps {
  active?: boolean | null;
  size?: RingSize;
  shape?: 'circle' | 'rounded';
  children: React.ReactNode;
  className?: string;
}

export function TcfPlusAvatarRing({
  active,
  size = 'md',
  shape = 'circle',
  children,
  className = '',
}: TcfPlusAvatarRingProps) {
  useEffect(() => {
    if (active) injectGlowKeyframes();
  }, [active]);

  // Pass-through when not active
  if (!active) {
    return <div className={`relative inline-flex flex-shrink-0 ${className}`}>{children}</div>;
  }

  const cfg = RING_CONFIG[size];
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      {/* Gradient ring + glow */}
      <div
        className={`${shapeClass} tcf-plus-ring`}
        style={{
          padding: cfg.padding,
          background: 'linear-gradient(135deg, #f1c60f, #d6a615, #f1c60f)',
          boxShadow: cfg.glowBase,
        }}
      >
        {children}
      </div>

      {/* Crown badge */}
      <div
        className={`absolute ${cfg.crownOffset} ${cfg.crownSize} rounded-full bg-gradient-to-br from-kernel-gold to-harvest flex items-center justify-center shadow-md z-10 border-2 border-card`}
      >
        <Crown className={`${cfg.crownIcon} text-soil`} />
      </div>
    </div>
  );
}