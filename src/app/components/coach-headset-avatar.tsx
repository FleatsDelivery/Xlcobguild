/**
 * Coach Headset Avatar — Dota-inspired coach indicator
 *
 * Shows a team's coach avatar with a full headset overlay that wraps around
 * the avatar, mimicking how Dota puts a headset on party members in the
 * coach slot. The headband arcs over the top, ear cups sit on the sides,
 * and a mic boom drops down from the left cup.
 *
 * States:
 *   - Coach assigned: avatar + full headset wrap + name tooltip
 *   - No coach: dashed empty circle + faded headset
 */

import { GraduationCap } from 'lucide-react';

/**
 * Full-size headset SVG that wraps around an avatar.
 * Viewbox is sized so the headset "wears" on a circle —
 * headband over top, ear cups on sides, mic boom on left.
 *
 * Designed to match the Dota 2 coach indicator style.
 */
function HeadsetWrap({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Headband — arc over the top of the head */}
      <path
        d="M18 55 V46 C18 28 32 14 50 14 C68 14 82 28 82 46 V55"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Left ear cup */}
      <rect x="8" y="48" width="14" height="20" rx="5" fill="currentColor" />
      {/* Right ear cup */}
      <rect x="78" y="48" width="14" height="20" rx="5" fill="currentColor" />
      {/* Mic boom — drops down from left ear cup and curves inward */}
      <path
        d="M15 68 C15 78 22 84 30 84"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Mic tip — small circle at the end of the boom */}
      <circle cx="32" cy="84" r="4" fill="currentColor" />
    </svg>
  );
}

interface CoachHeadsetAvatarProps {
  coach?: { display_name: string; avatar_url?: string } | null;
  coachData?: any;
  /** Size of the avatar circle in px */
  size?: number;
}

export function CoachHeadsetAvatar({ coach, coachData, size = 36 }: CoachHeadsetAvatarProps) {
  const hasCoach = !!coach;
  const avatar = coachData?.discord_avatar || coach?.avatar_url;
  const name = coach?.display_name || 'No coach';

  // The headset extends beyond the avatar, so we need padding
  const padScale = 1.35;
  const outerSize = Math.round(size * padScale);
  const offset = Math.round((outerSize - size) / 2);

  if (!hasCoach) {
    // Empty slot — dashed circle with faded headset silhouette
    return (
      <div
        className="relative flex-shrink-0"
        title="No coach assigned"
        style={{ width: outerSize, height: outerSize }}
      >
        {/* Empty avatar circle */}
        <div
          className="absolute rounded-full border-2 border-dashed border-white/20 flex items-center justify-center"
          style={{ width: size, height: size, top: offset, left: offset }}
        >
          <GraduationCap
            className="text-white/15"
            style={{ width: size * 0.45, height: size * 0.45 }}
          />
        </div>
        {/* Headset wrap — faded */}
        <HeadsetWrap className="absolute inset-0 w-full h-full text-white/12" />
      </div>
    );
  }

  // Coach assigned — avatar with headset worn on top
  return (
    <div
      className="relative flex-shrink-0"
      title={`Coach: ${name}`}
      style={{ width: outerSize, height: outerSize }}
    >
      {/* Avatar circle */}
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className="absolute rounded-full object-cover border-2 border-[#10b981]/40"
          style={{ width: size, height: size, top: offset, left: offset }}
          width={size}
          height={size}
        />
      ) : (
        <div
          className="absolute rounded-full bg-[#10b981]/20 flex items-center justify-center border-2 border-[#10b981]/30"
          style={{ width: size, height: size, top: offset, left: offset }}
        >
          <span className="font-bold text-[#10b981]" style={{ fontSize: size * 0.38 }}>
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      {/* Headset wrap — white with drop shadow for visibility */}
      <HeadsetWrap
        className="absolute inset-0 w-full h-full text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
      />
    </div>
  );
}
