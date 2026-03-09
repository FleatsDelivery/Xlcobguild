/**
 * GiveawayCard — Phase-aware card for the giveaways listing page
 *
 * Visual behavior driven entirely by giveaway-state-config.
 * Uses semantic tokens for dark mode compatibility.
 */

import { useState, useEffect } from 'react';
import { Gift, Users, Trophy, Timer, Lock, Globe } from 'lucide-react';
import {
  getGiveawayPhaseConfig,
  isGiveawayOpen,
  hasWinners,
  type GiveawayListItem,
} from './giveaway-state-config';

// ═══════════════════════════════════════════════════════
// COUNTDOWN HOOK
// ═══════════════════════════════════════════════════════

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!targetDate) return;

    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Ended');
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hrs = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);

      if (days > 0) setTimeLeft(`${days}d ${hrs}h`);
      else if (hrs > 0) setTimeLeft(`${hrs}h ${mins}m`);
      else setTimeLeft(`${mins}m`);
    };

    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

// ═══════════════════════════════════════════════════════
// WINNER AVATARS
// ═══════════════════════════════════════════════════════

function WinnerAvatars({ winners }: { winners: GiveawayListItem['winners'] }) {
  if (!winners || winners.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Trophy className="w-3.5 h-3.5 text-harvest" />
      <div className="flex -space-x-2">
        {winners.slice(0, 5).map((w, i) => (
          <div key={w.id || i} className="relative" style={{ zIndex: 5 - i }}>
            {w.discord_avatar ? (
              <img
                src={w.discord_avatar}
                alt={w.discord_username}
                title={w.discord_username}
                className="w-7 h-7 rounded-full border-2 border-card"
                width={28}
                height={28}
              />
            ) : (
              <div
                title={w.discord_username}
                className="w-7 h-7 rounded-full border-2 border-card bg-harvest/15 flex items-center justify-center"
              >
                <span className="text-harvest text-[10px] font-bold">
                  {w.discord_username?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      {winners.length === 1 && (
        <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
          {winners[0].discord_username}
        </span>
      )}
      {winners.length > 5 && (
        <span className="text-[10px] font-bold text-muted-foreground">+{winners.length - 5}</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN CARD
// ═══════════════════════════════════════════════════════

interface GiveawayCardProps {
  giveaway: GiveawayListItem;
  onClick?: () => void;
}

export function GiveawayCard({ giveaway, onClick }: GiveawayCardProps) {
  const phase = getGiveawayPhaseConfig(giveaway.status);
  const isOpen = isGiveawayOpen(giveaway.status);
  const showWinners = hasWinners(giveaway.status);
  const countdown = useCountdown(isOpen ? giveaway.closes_at : null);
  const isPublic = (giveaway as any).visibility === 'public';

  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-2xl border-2 border-border ${phase.cardBorderHover} overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
      style={phase.cardGlow ? { boxShadow: phase.cardGlow } : undefined}
    >
      {/* ── Banner Image ── */}
      {giveaway.image_url && (
        <div className="w-full h-28 overflow-hidden">
          <img
            src={giveaway.image_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            width={600}
            height={112}
          />
        </div>
      )}

      {/* ── Header ── */}
      <div className="relative px-5 pt-5 pb-4">
        {/* Status pill */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          {isPublic && (
            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-[#3b82f6]/15 text-[#3b82f6] flex items-center gap-1">
              <Globe className="w-3 h-3" /> Public
            </span>
          )}
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${phase.statusPillBg} ${phase.statusPillText} ${phase.pulseStatus ? 'animate-pulse' : ''}`}
          >
            {phase.pingDot && <span className="w-2 h-2 bg-white rounded-full animate-ping" />}
            {phase.icon} {phase.label}
          </span>
        </div>

        {/* Icon + Title */}
        <div className="flex items-start gap-3 pr-24">
          <div className={`w-10 h-10 rounded-xl ${phase.accentBgLight} flex items-center justify-center flex-shrink-0`}>
            <Gift className={`w-5 h-5 ${phase.accentColor}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground truncate leading-tight font-['Inter']">
              {giveaway.title}
            </h3>
            {giveaway.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {giveaway.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-5 pb-5 space-y-3">
        {/* Prize summary pills */}
        {giveaway.prize_summary && giveaway.prize_summary.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {giveaway.prize_summary.map((summary, i) => (
              <span
                key={i}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-harvest/10 text-harvest"
              >
                {summary}
              </span>
            ))}
          </div>
        )}

        {/* Entry count + countdown row */}
        <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg">
            <Users className="w-3.5 h-3.5" />
            {giveaway.entry_count} {giveaway.entry_count === 1 ? 'entry' : 'entries'}
          </span>

          {isOpen && countdown && (
            <span className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg">
              <Timer className="w-3.5 h-3.5" />
              {countdown === 'Ended' ? 'Time up' : `${countdown} left`}
            </span>
          )}

          {giveaway.winner_count > 1 && (
            <span className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg">
              <Trophy className="w-3.5 h-3.5" />
              {giveaway.winner_count} winners
            </span>
          )}
        </div>

        {/* Winners (drawn/completed) */}
        {showWinners && giveaway.winners && giveaway.winners.length > 0 && (
          <div className="pt-2 border-t border-border">
            <WinnerAvatars winners={giveaway.winners} />
          </div>
        )}

        {/* CTA hint */}
        {isOpen && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <Gift className="w-4 h-4 text-[#10b981]" />
            <span className="text-xs font-semibold text-[#10b981]">Click to enter</span>
          </div>
        )}
      </div>
    </div>
  );
}