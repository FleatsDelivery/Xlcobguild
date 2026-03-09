/**
 * DrawWinnerModal — Suspenseful animated winner reveal ceremony
 *
 * Three stages:
 *   1. Shuffling — names flash rapidly like a slot machine
 *   2. Reveal — winner(s) appear one by one with staggered gold animations
 *   3. Celebration — confetti particles + "Congratulations!" banner
 *
 * Locks body scroll while open.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Sparkles, X, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface DrawWinner {
  rank: number;
  user_id: string;
  discord_username: string;
  discord_avatar: string | null;
  entry_id: string;
}

interface DrawWinnerModalProps {
  entrantNames: string[];
  onConfirmDraw: () => Promise<DrawWinner[]>;
  onClose: () => void;
}

type Stage = 'confirm' | 'shuffling' | 'revealing' | 'celebration';

// ═══════════════════════════════════════════════════════
// CONFETTI PARTICLE
// ═══════════════════════════════════════════════════════

const CONFETTI_COLORS = ['#d6a615', '#f1c60f', '#a4ca00', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b'];

function ConfettiParticle({ index }: { index: number }) {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const left = Math.random() * 100;
  const delay = Math.random() * 0.8;
  const duration = 2 + Math.random() * 1.5;
  const size = 6 + Math.random() * 6;
  const rotation = Math.random() * 360;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${left}%`,
        top: -10,
        width: size,
        height: size * 0.6,
        backgroundColor: color,
        borderRadius: 2,
      }}
      initial={{ y: 0, opacity: 1, rotate: rotation }}
      animate={{
        y: [0, 500],
        opacity: [1, 1, 0],
        rotate: rotation + 720,
        x: [0, (Math.random() - 0.5) * 120],
      }}
      transition={{
        duration,
        delay,
        ease: 'easeIn',
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════
// SHUFFLER — rapid name cycling effect
// ═══════════════════════════════════════════════════════

function NameShuffler({ names }: { names: string[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (names.length === 0) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % names.length);
    }, 80);
    return () => clearInterval(interval);
  }, [names.length]);

  if (names.length === 0) return null;

  return (
    <div className="text-center">
      <motion.div
        key={current}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.06 }}
        className="text-2xl font-black text-foreground/30 font-['Inter']"
      >
        {names[current]}
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// WINNER REVEAL CARD
// ═══════════════════════════════════════════════════════

function WinnerRevealCard({ winner, index, total }: { winner: DrawWinner; index: number; total: number }) {
  const isGrandWinner = index === 0;
  const label = total === 1 ? 'Winner' : index === 0 ? 'Grand Winner' : `Runner-Up #${index}`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 40 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.6,
        delay: index * 1.2,
        type: 'spring',
        stiffness: 200,
        damping: 15,
      }}
      className={`flex flex-col items-center gap-3 ${isGrandWinner ? 'mb-4' : ''}`}
    >
      {/* Label */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 1.2, duration: 0.3 }}
        className={`text-xs font-bold uppercase tracking-wider ${
          isGrandWinner ? 'text-harvest' : 'text-muted-foreground'
        }`}
      >
        {label}
      </motion.p>

      {/* Avatar + Name */}
      <motion.div
        className={`flex items-center gap-3 px-5 py-3 rounded-2xl border-2 ${
          isGrandWinner
            ? 'bg-harvest/10 border-harvest/40'
            : 'bg-card border-border'
        }`}
        style={isGrandWinner ? { boxShadow: '0 0 30px rgba(214, 166, 21, 0.25)' } : undefined}
      >
        {winner.discord_avatar ? (
          <img
            src={winner.discord_avatar}
            alt={winner.discord_username}
            className={`rounded-full border-2 ${
              isGrandWinner ? 'w-14 h-14 border-harvest' : 'w-10 h-10 border-border'
            }`}
            width={isGrandWinner ? 56 : 40}
            height={isGrandWinner ? 56 : 40}
          />
        ) : (
          <div className={`rounded-full flex items-center justify-center bg-harvest/15 border-2 ${
            isGrandWinner ? 'w-14 h-14 border-harvest' : 'w-10 h-10 border-border'
          }`}>
            <span className={`font-bold text-harvest ${isGrandWinner ? 'text-xl' : 'text-sm'}`}>
              {winner.discord_username?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        )}
        <div>
          <p className={`font-black font-['Inter'] ${
            isGrandWinner ? 'text-xl text-foreground' : 'text-base text-foreground'
          }`}>
            {winner.discord_username}
          </p>
          {isGrandWinner && (
            <p className="text-xs font-semibold text-harvest flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" /> Winner!
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN MODAL
// ═══════════════════════════════════════════════════════

export function DrawWinnerModal({ entrantNames, onConfirmDraw, onClose }: DrawWinnerModalProps) {
  const [stage, setStage] = useState<Stage>('confirm');
  const [winners, setWinners] = useState<DrawWinner[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleStartDraw = useCallback(async () => {
    setStage('shuffling');
    setError(null);

    // Shuffle for dramatic effect, then call the real API
    const shuffleTimer = setTimeout(async () => {
      try {
        const result = await onConfirmDraw();
        setWinners(result);
        setStage('revealing');

        // After all reveals, show celebration
        const totalRevealTime = result.length * 1200 + 800;
        setTimeout(() => setStage('celebration'), totalRevealTime);
      } catch (err: any) {
        console.error('Draw failed:', err);
        setError(err.message || 'Failed to draw winners');
        setStage('confirm');
      }
    }, 2500); // 2.5s of shuffling suspense

    return () => clearTimeout(shuffleTimer);
  }, [onConfirmDraw]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={stage === 'confirm' || stage === 'celebration' ? onClose : undefined}
      />

      {/* Modal */}
      <motion.div
        className="relative bg-card rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confetti layer */}
        {stage === 'celebration' && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
            {Array.from({ length: 40 }).map((_, i) => (
              <ConfettiParticle key={i} index={i} />
            ))}
          </div>
        )}

        {/* Close button (only on confirm + celebration) */}
        {(stage === 'confirm' || stage === 'celebration') && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-all hover:scale-110 z-20"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
        )}

        <div className="p-8 flex flex-col items-center text-center relative z-10">
          {/* ── CONFIRM STAGE ── */}
          {stage === 'confirm' && (
            <>
              <motion.div
                className="w-16 h-16 rounded-2xl bg-harvest/15 flex items-center justify-center mb-4"
                animate={{ rotate: [0, -5, 5, -5, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
              >
                <span className="text-3xl">🎰</span>
              </motion.div>
              <h2 className="text-xl font-black text-foreground font-['Inter'] mb-2">Draw Winners?</h2>
              <p className="text-sm text-muted-foreground mb-1">
                This will randomly select winner(s) from
              </p>
              <p className="text-lg font-bold text-harvest mb-6">
                {entrantNames.length} {entrantNames.length === 1 ? 'entry' : 'entries'}
              </p>

              {error && (
                <div className="text-sm text-error bg-error/10 rounded-lg px-4 py-2.5 mb-4 w-full">
                  {error}
                </div>
              )}

              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleStartDraw}
                  className="flex-1 bg-harvest hover:bg-harvest/90 text-white gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Draw Now
                </Button>
              </div>
            </>
          )}

          {/* ── SHUFFLING STAGE ── */}
          {stage === 'shuffling' && (
            <>
              <motion.div
                className="w-20 h-20 rounded-2xl bg-harvest/15 flex items-center justify-center mb-6"
                animate={{ scale: [1, 1.1, 1], rotate: [0, 3, -3, 0] }}
                transition={{ duration: 0.4, repeat: Infinity }}
              >
                <span className="text-4xl">🎰</span>
              </motion.div>

              <h2 className="text-lg font-bold text-muted-foreground mb-4 font-['Inter']">Selecting winner...</h2>

              <div className="h-12 flex items-center justify-center overflow-hidden">
                <NameShuffler names={entrantNames} />
              </div>

              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Shuffling entries...</span>
              </div>
            </>
          )}

          {/* ── REVEALING STAGE ── */}
          {stage === 'revealing' && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-16 h-16 rounded-2xl bg-harvest/15 flex items-center justify-center mb-6"
              >
                <Trophy className="w-8 h-8 text-harvest" />
              </motion.div>

              <div className="space-y-3 w-full">
                {winners.map((winner, i) => (
                  <WinnerRevealCard key={winner.entry_id} winner={winner} index={i} total={winners.length} />
                ))}
              </div>
            </>
          )}

          {/* ── CELEBRATION STAGE ── */}
          {stage === 'celebration' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-20 h-20 rounded-2xl bg-harvest/15 flex items-center justify-center mb-4"
              >
                <span className="text-4xl">🏆</span>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-black text-harvest font-['Inter'] mb-2"
              >
                Congratulations!
              </motion.h2>

              <div className="space-y-3 w-full mb-6">
                {winners.map((winner, i) => (
                  <div key={winner.entry_id} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${
                    i === 0 ? 'bg-harvest/10 border-2 border-harvest/30' : 'bg-muted/50'
                  }`}>
                    {winner.discord_avatar ? (
                      <img
                        src={winner.discord_avatar}
                        alt={winner.discord_username}
                        className={`rounded-full border-2 ${i === 0 ? 'w-10 h-10 border-harvest' : 'w-8 h-8 border-border'}`}
                        width={i === 0 ? 40 : 32}
                        height={i === 0 ? 40 : 32}
                      />
                    ) : (
                      <div className={`rounded-full bg-harvest/15 flex items-center justify-center border-2 ${
                        i === 0 ? 'w-10 h-10 border-harvest' : 'w-8 h-8 border-border'
                      }`}>
                        <span className="text-harvest text-xs font-bold">
                          {winner.discord_username?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{winner.discord_username}</p>
                      <p className="text-[10px] font-semibold text-muted-foreground">
                        {winners.length === 1 ? 'Winner' : i === 0 ? 'Grand Winner' : `Runner-Up #${i}`}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-harvest">#{i + 1}</span>
                  </div>
                ))}
              </div>

              <Button onClick={onClose} className="w-full bg-harvest hover:bg-harvest/90 text-white gap-2">
                <Trophy className="w-4 h-4" />
                Done
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
