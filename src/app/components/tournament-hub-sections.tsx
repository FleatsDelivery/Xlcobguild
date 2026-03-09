/**
 * Tournament Hub — Composable Overview Sections
 *
 * Standalone section components used by the overview tab's section renderer.
 * These are driven by the phase config's `overviewSections` ordering.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Trophy, Clock, Sparkles, TrendingUp, Flame,
} from 'lucide-react';
import { getCountdownTarget, type PhaseConfig } from './tournament-state-config';
import { getRankDisplay } from '@/lib/rank-utils';
import { timeAgo } from '@/lib/date-utils';
import { RankBadge } from '@/app/components/rank-badge';
import { ChooseYourPath } from './choose-your-path';

// ═══════════════════════════════════════════════════════
// COUNTDOWN SECTION
// ═══════════════════════════════════════════════════════

interface CountdownSectionProps {
  tournament: any;
  phase: PhaseConfig;
}

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number; hours: number; minutes: number; seconds: number; total: number;
  } | null>(null);

  useEffect(() => {
    if (!targetDate) { setTimeLeft(null); return; }
    const target = new Date(targetDate).getTime();
    if (isNaN(target)) { setTimeLeft(null); return; }

    const tick = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        total: diff,
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

export function CountdownSection({ tournament, phase }: CountdownSectionProps) {
  const target = getCountdownTarget(tournament.status);
  const targetDate = target ? tournament[target.dateField] : null;
  const timeLeft = useCountdown(targetDate);

  // Don't render if no target or no date set
  if (!target || !targetDate || !timeLeft) return null;
  // Don't render if countdown has expired
  if (timeLeft.total <= 0) return null;

  const digitBoxes = [
    { value: timeLeft.days, label: 'Days' },
    { value: timeLeft.hours, label: 'Hours' },
    { value: timeLeft.minutes, label: 'Min' },
    { value: timeLeft.seconds, label: 'Sec' },
  ];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2 p-6"
      style={{
        borderColor: `${phase.accentHex}30`,
        background: `linear-gradient(135deg, ${phase.accentHex}08, ${phase.accentHex}03)`,
      }}
    >
      {/* Subtle animated gradient overlay */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 20% 50%, ${phase.accentHex}15, transparent 60%)`,
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5" style={{ color: phase.accentHex }} />
          <span className="text-sm font-bold uppercase tracking-wider" style={{ color: phase.accentHex }}>
            {target.label}
          </span>
        </div>

        <div className="flex gap-3 sm:gap-4">
          {digitBoxes.map(({ value, label }) => (
            <div key={label} className="flex-1 max-w-[100px]">
              <div
                key={`${label}-${value}`}
                className="bg-card rounded-xl border-2 border-border shadow-sm text-center py-3 sm:py-4 animate-digit-flip"
              >
                <span className="text-2xl sm:text-4xl font-black text-foreground tabular-nums">
                  {String(value).padStart(2, '0')}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-muted-foreground text-center mt-1.5 uppercase tracking-wider">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Target date subtitle */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          {new Date(targetDate).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
          })}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// WINNER BANNER
// ═══════════════════════════════════════════════════════

interface WinnerBannerProps {
  tournament: any;
  phase: PhaseConfig;
}

export function WinnerBanner({ tournament, phase }: WinnerBannerProps) {
  const winnerName = tournament.winning_team?.name || tournament.winning_team_name || tournament.winning_team?.tag;
  if (!winnerName) return null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2 border-[#fbbf24]/30 animate-slide-in-up"
      style={{ background: 'linear-gradient(135deg, #fbbf2410, #f59e0b08, #8b5cf610)' }}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#fbbf24]/5 to-transparent animate-shimmer pointer-events-none" />

      <div className="relative z-10 p-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] shadow-lg">
          <Trophy className="w-8 h-8 text-white" />
        </div>
        <div className="text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-[#f59e0b] mb-1 flex items-center justify-center sm:justify-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Champion
          </p>
          <h3 className="text-2xl sm:text-3xl font-black text-foreground">
            {winnerName}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tournament.name} Winner
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SECTION ENTRANCE ANIMATION WRAPPER
// ═══════════════════════════════════════════════════════

interface AnimatedSectionProps {
  children: React.ReactNode;
  index: number;
}

/**
 * Wraps each overview section with a staggered fade-in/slide-up entrance.
 */
export function AnimatedSection({ children, index }: AnimatedSectionProps) {
  return (
    <div
      className="animate-fade-in-up-section"
      style={{
        animationDelay: `${index * 0.08}s`,
      }}
    >
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// URGENCY BAR — "Spots Filling Up" indicator
// ═══════════════════════════════════════════════════════

interface UrgencyBarProps {
  totalActive: number;
  maxPlayers: number;
  phase: PhaseConfig;
}

export function UrgencyBar({ totalActive, maxPlayers, phase }: UrgencyBarProps) {
  if (!maxPlayers || maxPlayers <= 0) return null;

  const pct = Math.min((totalActive / maxPlayers) * 100, 100);
  const spotsLeft = Math.max(maxPlayers - totalActive, 0);

  // Color shifts as capacity fills: green → amber → red
  const urgencyColor = pct >= 85 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#10b981';
  const urgencyBg = pct >= 85 ? 'rgba(239,68,68,0.08)' : pct >= 60 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)';
  const urgencyBorder = pct >= 85 ? 'rgba(239,68,68,0.25)' : pct >= 60 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)';
  const urgencyLabel = pct >= 85 ? 'Almost Full!' : pct >= 60 ? 'Filling Up Fast' : 'Spots Available';
  const urgencyIcon = pct >= 85 ? '🔥' : pct >= 60 ? '⚡' : '✅';

  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2 px-5 py-4"
      style={{ background: urgencyBg, borderColor: urgencyBorder }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{urgencyIcon}</span>
          <span className="text-sm font-bold uppercase tracking-wider" style={{ color: urgencyColor }}>
            {urgencyLabel}
          </span>
        </div>
        <span className="text-sm font-black tabular-nums" style={{ color: urgencyColor }}>
          {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 rounded-full bg-foreground/5 overflow-hidden">
        <div
          className="h-full rounded-full animate-progress-fill"
          style={{ 
            backgroundColor: urgencyColor,
            ['--progress-width' as any]: `${pct}%`
          }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground">
          {totalActive} registered
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {maxPlayers} max
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// REGISTRATION HERO CTA — Choose Your Path (only when not registered)
// ═══════════════════════════════════════════════════════

interface RegistrationHeroCtaProps {
  user: any;
  myRegistration: any;
  canRegister: boolean;
  isMutable: boolean;
  registering: boolean;
  withdrawing: boolean;
  onRegisterWithRole: (role: string) => void;
  onWithdraw: () => void;
  onOpenStaffModal: () => void;
  phase: PhaseConfig;
  tournamentName: string;
  tournamentType: string;
  isRankIneligible: boolean;
  isEarlyAccess?: boolean;
}

export function RegistrationHeroCta({
  user, myRegistration, canRegister,
  registering, onRegisterWithRole,
  onOpenStaffModal,
  tournamentName, tournamentType, isRankIneligible, isEarlyAccess,
}: RegistrationHeroCtaProps) {
  if (!user) return null;

  // Only show Choose Your Path when not registered and can register
  if (!myRegistration && canRegister) {
    return (
      <ChooseYourPath
        tournamentName={tournamentName}
        tournamentType={tournamentType}
        isRankIneligible={isRankIneligible}
        registering={registering}
        onRegisterWithRole={onRegisterWithRole}
        onOpenStaffModal={onOpenStaffModal}
        isEarlyAccess={isEarlyAccess}
      />
    );
  }

  // Registered state is now handled by the `your_status` section
  return null;
}

// ═══════════════════════════════════════════════════════
// RECENT SIGNUPS FEED — Social proof entrant list
// ═══════════════════════════════════════════════════════

interface RecentSignupsFeedProps {
  freeAgents: any[];
  onTeamPlayers: any[];
  phase: PhaseConfig;
}

function SignupRow({ reg, index }: { reg: any; index: number }) {
  const person = reg.person;
  const linkedUser = reg.linked_user;
  const displayName = person?.display_name || linkedUser?.discord_username || 'Unknown';
  const avatar = linkedUser?.discord_avatar || person?.avatar_url;
  const rank = getRankDisplay(linkedUser?.opendota_data?.badge_rank || linkedUser?.badge_rank);
  const registeredAt = reg.registered_at;
  const isOnTeam = reg.status === 'on_team';

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors animate-slide-in-left"
      style={{
        animationDelay: `${index * 0.06}s`,
      }}
    >
      {/* Pulse dot */}
      <div className="relative flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-[#10b981]" />
        {index < 3 && (
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#10b981] animate-ping opacity-40" />
        )}
      </div>

      {/* Avatar */}
      {avatar ? (
        <img
          src={avatar}
          alt={displayName}
          className="w-8 h-8 rounded-full border-2 border-border flex-shrink-0"
          width={32}
          height={32}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[#3b82f6]/15 border-2 border-border flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-[#3b82f6]">
            {displayName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-foreground truncate">{displayName}</span>
          {rank && (
            <RankBadge medal={rank.medal} stars={rank.stars} size="xs" />
          )}
          {isOnTeam && reg.team?.team_name && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] text-[10px] font-semibold leading-none truncate max-w-[80px]">
              {reg.team.team_name}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          signed up {timeAgo(registeredAt)}
        </p>
      </div>
    </div>
  );
}

export function RecentSignupsFeed({ freeAgents, onTeamPlayers, phase }: RecentSignupsFeedProps) {
  const recentSignups = useMemo(() => {
    const all = [...freeAgents, ...onTeamPlayers];
    return all
      .filter(r => r.registered_at)
      .sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime())
      .slice(0, 8);
  }, [freeAgents, onTeamPlayers]);

  if (recentSignups.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: phase.accentHex }} />
          Recent Signups
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ backgroundColor: `${phase.accentHex}15`, color: phase.accentHex }}
          >
            {freeAgents.length + onTeamPlayers.length} total
          </span>
        </h3>
      </div>
      <div className="bg-card rounded-2xl border-2 border-border p-2 space-y-0.5">
        {recentSignups.map((reg, i) => (
          <SignupRow key={reg.id} reg={reg} index={i} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ACTIVITY PULSE — Recent event ticker
// ═══════════════════════════════════════════════════════

interface ActivityEvent {
  id: string;
  type: 'register' | 'team_created' | 'staff_applied' | 'team_joined';
  icon: string;
  color: string;
  text: string;
  timestamp: string;
}

interface ActivityPulseProps {
  freeAgents: any[];
  onTeamPlayers: any[];
  approvedTeams: any[];
  pendingTeams: any[];
  staffApps: any[];
  phase: PhaseConfig;
}

export function ActivityPulse({
  freeAgents, onTeamPlayers, approvedTeams, pendingTeams, staffApps, phase,
}: ActivityPulseProps) {
  const events = useMemo(() => {
    const items: ActivityEvent[] = [];

    // Registration events
    [...freeAgents, ...onTeamPlayers].forEach(reg => {
      if (!reg.registered_at) return;
      const name = reg.person?.display_name || reg.linked_user?.discord_username || 'Someone';
      items.push({
        id: `reg-${reg.id}`,
        type: 'register',
        icon: '🟢',
        color: '#10b981',
        text: `${name} registered`,
        timestamp: reg.registered_at,
      });
    });

    // Team join events (on_team players)
    onTeamPlayers.forEach(reg => {
      if (!reg.team?.team_name || !reg.registered_at) return;
      const name = reg.person?.display_name || reg.linked_user?.discord_username || 'Someone';
      items.push({
        id: `join-${reg.id}`,
        type: 'team_joined',
        icon: '🟣',
        color: '#8b5cf6',
        text: `${name} joined ${reg.team.team_name}`,
        timestamp: reg.registered_at,
      });
    });

    // Team creation events
    [...approvedTeams, ...pendingTeams].forEach(team => {
      if (!team.created_at) return;
      items.push({
        id: `team-${team.id}`,
        type: 'team_created',
        icon: '🛡️',
        color: '#8b5cf6',
        text: `Team ${team.team_name} created`,
        timestamp: team.created_at,
      });
    });

    // Staff application events
    staffApps.forEach(app => {
      if (!app.applied_at) return;
      items.push({
        id: `staff-${app.id}`,
        type: 'staff_applied',
        icon: '📋',
        color: '#f59e0b',
        text: `${app.discord_username} applied as ${app.role_preference === 'either' ? 'staff' : app.role_preference}`,
        timestamp: app.applied_at,
      });
    });

    // Sort by most recent, take top 12
    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12);
  }, [freeAgents, onTeamPlayers, approvedTeams, pendingTeams, staffApps]);

  if (events.length < 3) return null; // Don't show if barely any activity

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
        <Flame className="w-4 h-4 text-harvest" />
        Activity Feed
      </h3>
      <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
        <div className="divide-y divide-border">
          {events.map((event, i) => (
            <div
              key={event.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors animate-fade-in-activity"
              style={{
                animationDelay: `${i * 0.04}s`,
              }}
            >
              <span className="text-sm flex-shrink-0">{event.icon}</span>
              <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                {event.text}
              </span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">
                {timeAgo(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
