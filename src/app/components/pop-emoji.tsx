/**
 * PopEmoji — Interactive emoji fidget toy.
 *
 * When pressed, the emoji shrinks. On release it pops back with a spring
 * animation and fires a burst of that emoji using canvas-confetti.
 *
 * Only interactive when `unlocked` is true — locked emojis are inert.
 */
import { useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';

interface PopEmojiProps {
  emoji: string;
  unlocked: boolean;
  /** Extra classes for the outer wrapper */
  className?: string;
  /** Size classes for the emoji text (e.g. "text-lg sm:text-3xl") */
  sizeClass?: string;
  /** Optional: use a React node instead of a text emoji (for Popcorn icon etc.) */
  children?: React.ReactNode;
}

export function PopEmoji({ emoji, unlocked, className = '', sizeClass = 'text-lg sm:text-3xl', children }: PopEmojiProps) {
  const [pressed, setPressed] = useState(false);
  const [popping, setPopping] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popTimeout = useRef<ReturnType<typeof setTimeout>>();

  const fireEmojiBurst = useCallback(() => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;

    const shape = confetti.shapeFromText({ text: emoji, scalar: 2 });

    // Main burst from the emoji position
    confetti({
      particleCount: 12,
      spread: 70,
      origin: { x, y },
      shapes: [shape],
      scalar: 2,
      flat: true,
      gravity: 1.1,
      ticks: 160,
      startVelocity: 18,
    });

    // Small secondary burst slightly delayed
    setTimeout(() => {
      confetti({
        particleCount: 6,
        spread: 50,
        origin: { x, y: y - 0.02 },
        shapes: [shape],
        scalar: 1.5,
        flat: true,
        gravity: 1.2,
        ticks: 120,
        startVelocity: 12,
      });
    }, 80);
  }, [emoji]);

  const handlePress = useCallback(() => {
    if (!unlocked) return;
    setPressed(true);
    setPopping(false);
    if (popTimeout.current) clearTimeout(popTimeout.current);
  }, [unlocked]);

  const handleRelease = useCallback(() => {
    if (!unlocked || !pressed) return;
    setPressed(false);
    setPopping(true);
    fireEmojiBurst();

    // Reset the pop animation class after it finishes
    popTimeout.current = setTimeout(() => setPopping(false), 400);
  }, [unlocked, pressed, fireEmojiBurst]);

  return (
    <div
      ref={ref}
      className={className}
      onMouseDown={handlePress}
      onMouseUp={handleRelease}
      onMouseLeave={() => {
        if (pressed) handleRelease();
      }}
      onTouchStart={handlePress}
      onTouchEnd={handleRelease}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: unlocked ? 'pointer' : 'default',
      }}
    >
      <div
        className={`${sizeClass} leading-none transition-transform ${
          pressed
            ? 'scale-50 duration-100'
            : popping
              ? 'scale-[1.35] duration-300'
              : 'scale-100 duration-200'
        }`}
        style={
          popping
            ? { transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
            : undefined
        }
      >
        {children || emoji}
      </div>
    </div>
  );
}
