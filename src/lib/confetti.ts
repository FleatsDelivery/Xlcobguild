/**
 * Shared confetti utilities for celebration moments.
 *
 * Uses canvas-confetti with shapeFromText for emoji-shaped particles.
 * Each function is a self-contained celebration — just call and forget.
 */
import confetti from 'canvas-confetti';

// ═══════════════════════════════════════════════════════
// ROLE-THEMED CONFETTI — Tournament registration
// ═══════════════════════════════════════════════════════

const ROLE_EMOJI: Record<string, { emojis: string[]; colors: string[] }> = {
  player:  { emojis: ['⚔️', '🗡️'],   colors: ['#3b82f6', '#60a5fa', '#2563eb'] },
  coach:   { emojis: ['🎓', '📋'],   colors: ['#10b981', '#34d399', '#059669'] },
  caster:  { emojis: ['🎙️', '📺'],   colors: ['#8b5cf6', '#a78bfa', '#7c3aed'] },
  staff:   { emojis: ['🎬', '🛠️'],   colors: ['#f59e0b', '#fbbf24', '#d97706'] },
};

export function fireRoleConfetti(role: string) {
  const config = ROLE_EMOJI[role] || ROLE_EMOJI.player;
  const shapes = config.emojis.map(e => confetti.shapeFromText({ text: e, scalar: 2 }));

  const defaults = {
    gravity: 0.85,
    ticks: 250,
    shapes,
    scalar: 2,
    flat: true,
  };

  // Center burst
  confetti({ ...defaults, particleCount: 30, spread: 80, origin: { y: 0.55 } });

  // Side cannons
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 15, angle: 60, spread: 55, origin: { x: 0, y: 0.6 } });
    confetti({ ...defaults, particleCount: 15, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
  }, 150);

  // Accent color burst on top
  setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 100,
      origin: { y: 0.45 },
      colors: config.colors,
      gravity: 0.9,
      ticks: 200,
    });
  }, 300);
}

// ═══════════════════════════════════════════════════════
// MVP CONFETTI — MVP submission celebration
// ═══════════════════════════════════════════════════════

export function fireMvpConfetti() {
  const star = confetti.shapeFromText({ text: '⭐', scalar: 2 });
  const trophy = confetti.shapeFromText({ text: '🏆', scalar: 2 });
  const corn = confetti.shapeFromText({ text: '🌽', scalar: 2 });

  const defaults = {
    gravity: 0.8,
    ticks: 280,
    shapes: [star, trophy, corn],
    scalar: 2,
    flat: true,
  };

  // Big center burst
  confetti({ ...defaults, particleCount: 35, spread: 90, origin: { y: 0.5 } });

  // Side cannons
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 18, angle: 60, spread: 50, origin: { x: 0, y: 0.55 } });
    confetti({ ...defaults, particleCount: 18, angle: 120, spread: 50, origin: { x: 1, y: 0.55 } });
  }, 200);

  // Gold sparkle rain
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 120,
      origin: { y: 0.35 },
      colors: ['#d6a615', '#f1c60f', '#fbbf24', '#f59e0b'],
      gravity: 0.7,
      ticks: 220,
    });
  }, 400);
}

// ═══════════════════════════════════════════════════════
// LOCK-IN CONFETTI — Team lock-in celebration
// ═══════════════════════════════════════════════════════

export function fireLockInConfetti() {
  const lock = confetti.shapeFromText({ text: '🔒', scalar: 2 });
  const shield = confetti.shapeFromText({ text: '🛡️', scalar: 2 });
  const corn = confetti.shapeFromText({ text: '🌽', scalar: 2 });

  const defaults = {
    gravity: 0.85,
    ticks: 260,
    shapes: [lock, shield, corn],
    scalar: 2,
    flat: true,
  };

  // Center burst
  confetti({ ...defaults, particleCount: 30, spread: 85, origin: { y: 0.5 } });

  // Side cannons with harvest gold accents
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 15, angle: 60, spread: 50, origin: { x: 0, y: 0.55 } });
    confetti({ ...defaults, particleCount: 15, angle: 120, spread: 50, origin: { x: 1, y: 0.55 } });
  }, 180);

  // Gold & green celebration rain
  setTimeout(() => {
    confetti({
      particleCount: 45,
      spread: 110,
      origin: { y: 0.4 },
      colors: ['#d6a615', '#f1c60f', '#a4ca00', '#10b981'],
      gravity: 0.75,
      ticks: 200,
    });
  }, 350);
}

// ═══════════════════════════════════════════════════════
// MONEY CONFETTI — Prize award accepted celebration
// ═══════════════════════════════════════════════════════

export function fireMoneyConfetti() {
  const money = confetti.shapeFromText({ text: '💰', scalar: 2 });
  const dollar = confetti.shapeFromText({ text: '💵', scalar: 2 });
  const coin = confetti.shapeFromText({ text: '🪙', scalar: 2 });
  const corn = confetti.shapeFromText({ text: '🌽', scalar: 2 });

  const defaults = {
    gravity: 0.7,
    ticks: 300,
    shapes: [money, dollar, coin, corn],
    scalar: 2,
    flat: true,
  };

  // Big center money explosion
  confetti({ ...defaults, particleCount: 40, spread: 100, origin: { y: 0.5 } });

  // Side cannons — money flying in from both sides
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 20, angle: 60, spread: 55, origin: { x: 0, y: 0.5 } });
    confetti({ ...defaults, particleCount: 20, angle: 120, spread: 55, origin: { x: 1, y: 0.5 } });
  }, 150);

  // Green money rain
  setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 130,
      origin: { y: 0.3 },
      colors: ['#10b981', '#34d399', '#059669', '#d6a615', '#f1c60f'],
      gravity: 0.6,
      ticks: 250,
    });
  }, 300);

  // Second wave — more money from the top
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 25, spread: 70, origin: { y: 0.35, x: 0.3 } });
    confetti({ ...defaults, particleCount: 25, spread: 70, origin: { y: 0.35, x: 0.7 } });
  }, 500);
}