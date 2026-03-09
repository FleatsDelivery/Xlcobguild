import { MvpSubmissionForm } from '@/app/components/mvp-submission-form';
import { Footer } from '@/app/components/footer';
import { OnboardingChecklist } from '@/app/components/onboarding-checklist';
import { ExternalLink, Popcorn, ArrowUp, ArrowDown, Sparkles, Eye, ThumbsUp, ThumbsDown, Heart, Users, MessageSquare, Star, Crown, Calendar, Trophy, UserPlus, Swords, Clock } from 'lucide-react';
import { getPhaseConfig, isRegistrationOpen, isLive } from '@/app/components/tournament-state-config';
import { slugifyTournamentName } from '@/lib/slugify';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { SuccessModal } from '@/app/components/success-modal';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { TcfPlusBadge } from '@/app/components/tcf-plus-badge';
import { PopEmoji } from '@/app/components/pop-emoji';

// ═══════════════════════════════════════════════════════
// LAZY DISCORD WIDGET — only loads iframe when scrolled into view
// ═══════════════════════════════════════════════════��═══

function LazyDiscordWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // start loading 200px before it's in view
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-border">
      <h3 className="text-lg font-bold text-foreground mb-4">💬 Join Us on Discord</h3>
      <div className="w-full">
        {visible ? (
          <iframe
            src="https://discordapp.com/widget?id=1106456864989925388&theme=dark"
            width="100%"
            height="500"
            allowTransparency={true}
            frameBorder="0"
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            className="rounded-2xl w-full"
          />
        ) : (
          <div className="h-[500px] bg-muted rounded-2xl animate-pulse" />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const RANK_EMOJIS = [
  '🐛', '🦌', '🌽', '🥄', '🍞', '🌾', '🌻', '🎯', '⭐', '🌟', '💥',
];

const RANK_NAMES = [
  'Earwig', 'Ugandan Kob', 'Private Maize', 'Specialist Ingredient',
  'Corporal Corn Bread', 'Sergeant Husk', 'Sergeant Major Fields',
  'Captain Cornhole', 'Major Cob', 'Corn Star', "Pop'd Kernel",
];

const CUSTOM_GAMES = [
  {
    title: "Axe's Dunk Contest",
    workshopId: '3592388680',
    cover: 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/custom-game-modes/cover-photos/axes_dunk_contest.png',
  },
  {
    title: "Heaps n' Reaps",
    workshopId: '3585929337',
    cover: 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/custom-game-modes/cover-photos/heaps_n_reaps.png',
  },
  {
    title: 'Hide & Heap',
    workshopId: '3580844386',
    cover: 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/custom-game-modes/cover-photos/hide_n_heap.png',
  },
];

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

const formatNum = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

// ═══════════════════════════════════════════════════════
// SKELETON COMPONENTS
// ═══════════════════════════════════════════════════════

function WelcomeHeroSkeleton() {
  return (
    <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-border">
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 mb-4 sm:mb-6">
        <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-2 w-full">
          <div className="h-6 sm:h-8 w-3/4 bg-muted rounded animate-pulse mx-auto sm:mx-0" />
          <div className="flex flex-col sm:flex-row gap-3 items-center sm:items-start">
            <div className="space-y-1">
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              <div className="h-5 w-28 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              <div className="h-5 w-28 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      {/* Progress bar skeleton */}
      <div className="mb-4 sm:mb-6">
        <div className="flex justify-between mb-1.5">
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          <div className="h-3 w-16 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-2.5 sm:h-3 bg-muted rounded-full animate-pulse" />
      </div>
      {/* Rank emojis skeleton */}
      <div className="space-y-4">
        <div>
          <div className="h-3 w-28 bg-muted rounded animate-pulse mb-3" />
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted animate-pulse" />
            ))}
          </div>
        </div>
        <div>
          <div className="h-3 w-24 bg-muted rounded animate-pulse mb-3" />
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentActionsSkeleton() {
  return (
    <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-border">
      <div className="h-5 w-44 bg-muted rounded animate-pulse mb-4" />
      <div className="flex gap-3 sm:gap-4 overflow-hidden">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex-shrink-0 flex items-center gap-2 sm:gap-3 bg-muted/50 rounded-2xl p-3 border-2 border-border">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted animate-pulse" />
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted animate-pulse" />
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomGamesSkeleton() {
  return (
    <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-border">
      <div className="h-5 w-56 bg-muted rounded animate-pulse mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border-2 border-border overflow-hidden">
            <div className="aspect-[16/9] bg-muted animate-pulse" />
            <div className="p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <div key={s} className="w-3.5 h-3.5 rounded bg-muted animate-pulse" />
                  ))}
                </div>
                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-3 w-10 bg-muted rounded animate-pulse" />
                <div className="h-3 w-10 bg-muted rounded animate-pulse" />
                <div className="h-3 w-10 bg-muted rounded animate-pulse" />
                <div className="h-3 w-10 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// HOME LIVE TOURNAMENT BANNER
// ═══════════════════════════════════════════════════════

function HomeLiveTournamentBanner({ tournament }: { tournament: any }) {
  const phase = getPhaseConfig(tournament.status);
  const slug = tournament.name ? slugifyTournamentName(tournament.name) : '';
  const bannerUrl = slug.length >= 3
    ? `https://${projectId}.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/${slug}/league_banner.png`
    : null;
  const previews: { avatar: string | null; name: string; tcf_plus_active?: boolean }[] = tournament.player_previews || [];
  const regCount: number = tournament.registration_count || 0;
  const regOpen = isRegistrationOpen(tournament.status);
  const live = isLive(tournament.status);
  const maxTeams: number = tournament.max_teams || 0;
  const maxAvatars = typeof window !== 'undefined' && window.innerWidth >= 640 ? 15 : 8;

  const handleClick = () => {
    window.location.hash = `#tournament-hub/${tournament.id}`;
  };

  return (
    <div
      onClick={handleClick}
      className={`relative bg-card rounded-2xl sm:rounded-3xl border-2 border-border ${phase.cardBorderHover} overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl`}
      style={phase.cardGlow ? { boxShadow: phase.cardGlow } : undefined}
    >
      {/* ── Banner Image ── */}
      <div className="relative overflow-hidden" style={{ minHeight: '200px' }}>
        {bannerUrl ? (
          <>
            <img
              src={bannerUrl}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${phase.bannerZoom ? 'group-hover:scale-105' : ''}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${phase.headerGradient}`} />
        )}

        {/* Status pill */}
        <span
          className={`absolute top-4 right-4 px-4 py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 ${phase.statusPillBg} ${phase.statusPillText} ${phase.pulseStatus ? 'animate-pulse' : ''}`}
          style={phase.cardGlow ? { boxShadow: `0 0 16px ${phase.accentHex}66` } : undefined}
        >
          {phase.pingDot && <span className="w-2 h-2 bg-white rounded-full animate-ping" />}
          {phase.icon} {phase.label}
        </span>

        {/* Tournament name at bottom of banner */}
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 z-10">
          <div className="flex items-end gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Crown className="w-7 h-7 sm:w-8 sm:h-8 text-kernel-gold" />
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl sm:text-3xl font-black text-white truncate leading-tight">{tournament.name}</h3>
              <p className="text-white/60 text-sm sm:text-base mt-1">
                {tournament.tournament_type === 'kernel_kup' ? '🌽 5v5 Captains Mode' : '🪝 1v1 Duel'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card Body ── */}
      <div className="p-5 sm:p-8 space-y-5">
        {/* Description */}
        {tournament.description && (
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed line-clamp-2">{tournament.description}</p>
        )}

        {/* ── Registrants Strip ── */}
        <div className="bg-muted/50 rounded-xl sm:rounded-2xl p-4 sm:p-5">
          {regCount > 0 ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: phase.accentHex }} />
                  <span className="text-sm sm:text-base font-bold text-foreground">
                    Recent Registrants
                  </span>
                  <span
                    className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${phase.accentHex}15`, color: phase.accentHex }}
                  >
                    {regCount}
                  </span>
                </div>
                {regOpen && (
                  <span className="text-[10px] sm:text-xs font-semibold text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-full">
                    Sign ups open
                  </span>
                )}
                {live && (
                  <span className="text-[10px] sm:text-xs font-semibold text-[#ef4444] bg-[#ef4444]/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#ef4444] rounded-full animate-pulse" />
                    Playing now
                  </span>
                )}
              </div>
              {/* Avatar strip with TCF+ rings and hover effects */}
              <div className="flex items-center">
                <div className="flex -space-x-2.5">
                  {previews.slice(0, maxAvatars).map((p, i) => (
                    <div key={i} className="relative group/avatar" style={{ zIndex: maxAvatars + 1 - i }}>
                      <TcfPlusAvatarRing active={p.tcf_plus_active} size="xs">
                        {p.avatar ? (
                          <img
                            src={p.avatar}
                            alt={p.name}
                            title={p.name}
                            className="w-9 h-9 rounded-full border-[2.5px] border-card shadow-sm transition-transform duration-200 group-hover/avatar:scale-110 group-hover/avatar:-translate-y-1"
                          />
                        ) : (
                          <div
                            title={p.name}
                            className="w-9 h-9 rounded-full border-[2.5px] border-card bg-harvest/15 flex items-center justify-center shadow-sm transition-transform duration-200 group-hover/avatar:scale-110 group-hover/avatar:-translate-y-1"
                          >
                            <span className="text-harvest text-xs font-bold">{p.name?.[0]?.toUpperCase() || '?'}</span>
                          </div>
                        )}
                      </TcfPlusAvatarRing>
                    </div>
                  ))}
                </div>
                {regCount > maxAvatars && (
                  <div className="ml-1 w-9 h-9 rounded-full border-[2.5px] border-card bg-muted flex items-center justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground">+{regCount - maxAvatars}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 py-1">
              <div className="flex -space-x-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-9 h-9 rounded-full border-[2.5px] border-card bg-muted" />
                ))}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-muted-foreground">No registrations yet</p>
                {regOpen && <p className="text-[10px] sm:text-xs text-[#10b981] font-medium">Be the first to sign up!</p>}
              </div>
            </div>
          )}
        </div>

        {/* ── Meta Row ── */}
        <div className="flex items-center flex-wrap gap-3 text-xs sm:text-sm text-muted-foreground">
          {tournament.tournament_start_date && (
            <span className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg">
              <Calendar className="w-4 h-4" />
              {(() => {
                const d = new Date(tournament.tournament_start_date);
                const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
                const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                if (!hasTime) return datePart;
                return `${datePart}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`;
              })()}
            </span>
          )}
          {(Number(tournament.prize_pool) > 0 || (tournament.prize_pool_donations ?? 0) > 0) && (
            <span className="flex items-center gap-1.5 bg-harvest/10 text-harvest px-3 py-1.5 rounded-lg font-semibold">
              <Trophy className="w-4 h-4" />
              ${(() => {
                const base = Number(tournament.prize_pool) || 0;
                const donations = tournament.prize_pool_donations ?? 0;
                return (base + donations).toFixed(2);
              })()}
            </span>
          )}
          {maxTeams > 0 && (
            <span className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg">
              <Users className="w-4 h-4" />
              {maxTeams} teams max
            </span>
          )}
        </div>

        {/* CTA — state-driven */}
        <div className="flex items-center justify-center gap-2 pt-1">
          {regOpen && (
            <>
              <UserPlus className="w-5 h-5 text-[#10b981]" />
              <span className="text-sm font-bold text-[#10b981]">Click to view & register</span>
            </>
          )}
          {live && (
            <>
              <Swords className="w-5 h-5 text-[#ef4444]" />
              <span className="text-sm font-bold text-[#ef4444]">Click to watch live</span>
            </>
          )}
          {tournament.status === 'registration_closed' && (
            <>
              <Clock className="w-5 h-5 text-[#f59e0b]" />
              <span className="text-sm font-bold text-[#f59e0b]">Starting soon — view details</span>
            </>
          )}
          {tournament.status === 'upcoming' && (
            <>
              <Calendar className="w-5 h-5 text-harvest" />
              <span className="text-sm font-bold text-harvest">View tournament details</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function HomePage({ user, onboarding, onRefresh, onBadgeRefresh }: { user: any; onboarding?: { mvp_request_count: number; reward_claimed: boolean } | null; onRefresh?: () => Promise<void>; onBadgeRefresh?: () => void }) {
  const [rankActions, setRankActions] = useState<any[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);
  const [workshopStats, setWorkshopStats] = useState<Record<string, any>>({});
  const [loadingWorkshopStats, setLoadingWorkshopStats] = useState(true);
  const [liveTournaments, setLiveTournaments] = useState<any[]>([]);
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    helpText?: string;
  } | null>(null);

  // Double-fetch guard
  const fetchedRef = useRef(false);

  // Get display name based on role
  const getDisplayRank = () => user?.ranks?.name || 'Earwig';

  // Calculate rank progression
  const currentRankId = user?.rank_id || 1;
  const prestigeLevel = user?.prestige_level || 0;
  const maxRanks = prestigeLevel === 5 ? 11 : 10;
  const displayRanks = prestigeLevel === 5 ? 11 : 10;

  const getNextRankName = () => {
    if (currentRankId >= maxRanks) {
      if (prestigeLevel < 5) return 'Ready for Prestige!';
      return 'Max Rank Achieved!';
    }
    return RANK_NAMES[currentRankId];
  };

  // ── Parallel data fetch on mount ──
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchAllData();
  }, []);

  const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;

  const fetchAllData = async () => {
    // Get session once, share across both calls
    const { data: { session } } = await supabase.auth.getSession();

    const [actionsRes, workshopRes, liveRes] = await Promise.allSettled([
      // Rank actions (needs auth)
      user?.id && session
        ? fetch(`${baseUrl}/rank-actions/${user.id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
        : Promise.resolve(null),
      // Workshop stats (public)
      fetch(`${baseUrl}/workshop-stats`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      }),
      // Live tournaments (public)
      fetch(`${baseUrl}/kkup/tournaments`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      }),
    ]);

    // Process rank actions
    if (actionsRes.status === 'fulfilled' && actionsRes.value && actionsRes.value.ok) {
      try {
        const data = await actionsRes.value.json();
        setRankActions(data.actions || []);
      } catch (err) {
        console.error('Error parsing rank actions:', err);
      }
    }
    setLoadingActions(false);

    // Process workshop stats
    if (workshopRes.status === 'fulfilled' && workshopRes.value.ok) {
      try {
        const data = await workshopRes.value.json();
        setWorkshopStats(data.stats || {});
      } catch (err) {
        console.error('Error parsing workshop stats:', err);
      }
    }
    setLoadingWorkshopStats(false);

    // Process live tournaments
    if (liveRes.status === 'fulfilled' && liveRes.value.ok) {
      try {
        const data = await liveRes.value.json();
        const active = (data.tournaments || []).filter((t: any) =>
          ['upcoming', 'registration_open', 'registration_closed', 'roster_lock', 'live', 'registration', 'active'].includes(t.status)
        );
        setLiveTournaments(active);
      } catch (err) {
        console.error('Error parsing live tournaments:', err);
      }
    }
  };

  // Dedicated re-fetch for rank actions (called after MVP submit etc.)
  const refetchRankActions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !user?.id) return;
      const response = await fetch(`${baseUrl}/rank-actions/${user.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRankActions(data.actions || []);
      }
    } catch (error) {
      console.error('Error refetching rank actions:', error);
    }
  };

  const handleRefreshWithActions = async () => {
    if (onRefresh) await onRefresh();
    await refetchRankActions();
  };

  // Onboarding state
  const twitchSkipped = (() => { try { return localStorage.getItem('tcf_twitch_skipped') === 'true'; } catch { return false; } })();
  const onboardingStepsComplete = {
    discord: true,
    steam: !!user?.steam_id,
    twitch: !!user?.twitch_id || twitchSkipped,
    guild: user?.role !== 'guest',
  };
  const allOnboardingDone = Object.values(onboardingStepsComplete).every(Boolean);
  const rewardClaimed = onboarding?.reward_claimed ?? false;
  const showOnboarding = !allOnboardingDone || !rewardClaimed;
  const mvpFormLocked = !onboardingStepsComplete.guild;

  return (
    <div className="p-3 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

        {/* ── Onboarding / Welcome Hero ── */}
        {showOnboarding ? (
          <OnboardingChecklist
            user={user}
            onboarding={onboarding ?? null}
            onRefresh={onRefresh}
            variant="full"
          />
        ) : loadingActions ? (
          <WelcomeHeroSkeleton />
        ) : (
          <div className="bg-gradient-to-br from-harvest/20 to-amber/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-harvest/20 shadow-xl">
            {/* User Info Header */}
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 mb-4 sm:mb-6">
              <TcfPlusAvatarRing active={user?.tcf_plus_active} size="lg">
              {user?.discord_avatar ? (
                <img
                  src={user.discord_avatar}
                  alt={user.discord_username}
                  className="w-16 h-16 sm:w-24 sm:h-24 rounded-full border-4 border-card shadow-lg"
                  width={96}
                  height={96}
                />
              ) : (
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-harvest flex items-center justify-center border-4 border-card shadow-lg">
                  <span className="text-white font-bold text-xl sm:text-3xl">
                    {user?.discord_username?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              </TcfPlusAvatarRing>
              <div className="flex-1 text-center sm:text-left min-w-0">
                <h2 className="text-lg sm:text-3xl font-bold text-foreground mb-1 sm:mb-2 truncate">
                  Welcome back, {user?.discord_username || 'Player'}! 🌽
                </h2>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-1.5 sm:gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">Membership</p>
                    <p className="text-sm sm:text-lg font-bold flex items-center gap-1.5 sm:gap-2 justify-center sm:justify-start">
                      {user?.tcf_plus_active ? (
                        <TcfPlusBadge size="sm" />
                      ) : (
                        <span className="text-muted-foreground">Free</span>
                      )}
                    </p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">Current Rank</p>
                    <p className="text-sm sm:text-lg font-bold text-foreground flex items-center gap-1.5 sm:gap-2 justify-center sm:justify-start">
                      {currentRankId === 11 ? (
                        <Popcorn className="w-5 h-5 sm:w-7 sm:h-7 text-harvest" />
                      ) : (
                        <span className="text-lg sm:text-2xl">{RANK_EMOJIS[currentRankId - 1]}</span>
                      )}
                      <span className="truncate max-w-[120px] sm:max-w-none">{getDisplayRank()}</span>
                    </p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">Next Rank</p>
                    <p className="text-sm sm:text-lg font-bold text-harvest flex items-center gap-1.5 sm:gap-2 justify-center sm:justify-start">
                      {currentRankId >= maxRanks ? (
                        <span className="text-lg sm:text-2xl">
                          {prestigeLevel < 5 ? '⬆️' : '👑'}
                        </span>
                      ) : currentRankId === 10 && prestigeLevel === 5 ? (
                        <Popcorn className="w-5 h-5 sm:w-7 sm:h-7 text-harvest" />
                      ) : (
                        <span className="text-lg sm:text-2xl">{RANK_EMOJIS[currentRankId]}</span>
                      )}
                      <span className="truncate max-w-[120px] sm:max-w-none">{getNextRankName()}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Rank Progress Bar */}
            <div className="mb-4 sm:mb-6">
              <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                <span className="text-xs sm:text-sm font-semibold text-foreground">
                  Rank {currentRankId} / {displayRanks}
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {Math.round((currentRankId / displayRanks) * 100)}% Complete
                </span>
              </div>
              <div className="h-2.5 sm:h-3 bg-card/60 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-harvest to-amber transition-all duration-500 rounded-full"
                  style={{ width: `${(currentRankId / displayRanks) * 100}%` }}
                />
              </div>
            </div>

            {/* Visual Rank Progression */}
            <div className="space-y-4 sm:space-y-5">
              {/* Rank Emojis Row */}
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3 font-semibold">Rank Progression:</p>
                <div className="pt-10 -mt-10">
                  <div className="flex items-center justify-between gap-1 sm:gap-2 py-2">
                    {RANK_EMOJIS.slice(0, displayRanks).map((emoji, index) => {
                      const rankNum = index + 1;
                      const isCompleted = currentRankId > rankNum;
                      const isCurrent = currentRankId === rankNum;
                      const isPopdKernel = rankNum === 11;
                      const isUnlocked = isCompleted || isCurrent;

                      return (
                        <div
                          key={rankNum}
                          className="group relative flex-1 min-w-0 flex items-center justify-center"
                        >
                          {isUnlocked ? (
                            <PopEmoji
                              emoji={isPopdKernel ? '💥' : emoji}
                              unlocked
                              sizeClass={isPopdKernel ? '' : 'text-lg sm:text-3xl'}
                            >
                              {isPopdKernel ? (
                                <Popcorn
                                  className={`w-5 h-5 sm:w-8 sm:h-8 text-harvest drop-shadow-lg ${
                                    isCurrent ? 'animate-pulse' : ''
                                  }`}
                                />
                              ) : (
                                <span className={`text-lg sm:text-3xl leading-none drop-shadow-lg ${
                                  isCurrent ? 'animate-pulse' : ''
                                }`}>
                                  {emoji}
                                </span>
                              )}
                            </PopEmoji>
                          ) : isPopdKernel ? (
                            <Popcorn
                              className="w-5 h-5 sm:w-8 sm:h-8 transition-all duration-200 cursor-default opacity-30 text-muted-foreground group-hover:opacity-60 group-hover:text-harvest/60 group-hover:scale-110"
                            />
                          ) : (
                            <div
                              className="text-lg sm:text-3xl leading-none transition-all duration-200 cursor-default opacity-30 grayscale group-hover:opacity-60 group-hover:grayscale-0 group-hover:scale-110"
                            >
                              {emoji}
                            </div>
                          )}

                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                            <div className="bg-soil text-silk text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                              <span className="font-semibold">{RANK_NAMES[index]}</span>
                              {isCurrent && <span className="text-kernel-gold"> (Current)</span>}
                              {isCompleted && <span className="text-[#22c55e]"> ✓</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Prestige Level Stars */}
              <div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3 font-semibold">Prestige Level:</p>
                <div className="flex items-center justify-center gap-2 sm:gap-4 py-2">
                  {[1, 2, 3, 4, 5].map((level) => {
                    const isAchieved = prestigeLevel >= level;
                    const isCurrent = prestigeLevel === level;
                    const emoji = level === 5 ? '💥' : '🌟';

                    return (
                      <div
                        key={level}
                        className="group relative transition-all duration-300"
                      >
                        {isAchieved ? (
                          <PopEmoji
                            emoji={emoji}
                            unlocked
                            sizeClass="text-2xl sm:text-4xl"
                          >
                            <span className={`text-2xl sm:text-4xl leading-none drop-shadow-lg ${
                              isCurrent ? 'animate-pulse' : ''
                            }`}>
                              {emoji}
                            </span>
                          </PopEmoji>
                        ) : (
                          <div
                            className="text-2xl sm:text-4xl leading-none transition-all duration-300 opacity-20 grayscale group-hover:opacity-40 group-hover:grayscale-0 cursor-default"
                          >
                            {emoji}
                          </div>
                        )}

                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 left-1/2 -translate-x-1/2 pointer-events-none">
                          <div className="bg-soil text-silk text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                            <span className="font-semibold">Prestige {level}</span>
                            {isCurrent && <span className="text-kernel-gold"> (Current)</span>}
                            {isAchieved && !isCurrent && <span className="text-[#22c55e]"> ✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Live Tournament Banner ── */}
        {liveTournaments.length > 0 && (
          <HomeLiveTournamentBanner tournament={liveTournaments[0]} />
        )}

        {/* MVP Submission Form */}
        <MvpSubmissionForm user={user} onRefresh={handleRefreshWithActions} onBadgeRefresh={onBadgeRefresh} locked={mvpFormLocked} />

        {/* ── Recent Actions ── */}
        {loadingActions ? (
          <RecentActionsSkeleton />
        ) : (
          <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">⚔️ Your Recent Actions</h3>

            {rankActions.length === 0 ? (
              <div className="text-center py-8 bg-muted rounded-2xl">
                <div className="text-4xl mb-3">🌽</div>
                <p className="text-sm text-foreground font-medium">No rank actions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Your rank changes will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex gap-3 sm:gap-4 pb-2">
                  {rankActions.slice(0, 10).map((action, index) => {
                    const actionIcon = action.action === 'rank_up' ? (
                      <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#10b981]" />
                    ) : action.action === 'rank_down' ? (
                      <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#ef4444]" />
                    ) : (
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#fbbf24]" />
                    );

                    return (
                      <div
                        key={action.id || index}
                        className="flex-shrink-0 flex items-center gap-2 sm:gap-3 bg-muted rounded-2xl p-3 border-2 border-border"
                      >
                        {/* Performer Profile Pic */}
                        {action.performer?.discord_avatar ? (
                          <img
                            src={action.performer.discord_avatar}
                            alt={action.performer.discord_username}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-card shadow-sm"
                            width={48}
                            height={48}
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-harvest flex items-center justify-center border-2 border-card shadow-sm">
                            <span className="text-white font-bold text-sm">
                              {action.performer?.discord_username?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}

                        {/* Action Icon */}
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-sm ${
                          action.action === 'rank_up' ? 'bg-[#10b981]/10 border-2 border-[#10b981]/20' :
                          action.action === 'rank_down' ? 'bg-[#ef4444]/10 border-2 border-[#ef4444]/20' :
                          'bg-[#fbbf24]/10 border-2 border-[#fbbf24]/20'
                        }`}>
                          {actionIcon}
                        </div>

                        {/* Recipient Profile Pic */}
                        {action.recipient?.discord_avatar ? (
                          <img
                            src={action.recipient.discord_avatar}
                            alt={action.recipient.discord_username}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-card shadow-sm"
                            width={48}
                            height={48}
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-harvest flex items-center justify-center border-2 border-card shadow-sm">
                            <span className="text-white font-bold text-sm">
                              {action.recipient?.discord_username?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Custom Games Section ── */}
        {loadingWorkshopStats ? (
          <CustomGamesSkeleton />
        ) : (
          <div className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">🎮 Custom Games Made by Mavi</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(() => {
                const hasStats = Object.keys(workshopStats).length > 0;
                const sortedGames = hasStats
                  ? [...CUSTOM_GAMES].sort((a, b) => {
                      const sa = workshopStats[a.workshopId];
                      const sb = workshopStats[b.workshopId];
                      if (!sa && !sb) return 0;
                      if (!sa) return 1;
                      if (!sb) return -1;
                      if (sb.score !== sa.score) return sb.score - sa.score;
                      if (sb.votes_up !== sa.votes_up) return sb.votes_up - sa.votes_up;
                      if (sb.subscriptions !== sa.subscriptions) return sb.subscriptions - sa.subscriptions;
                      if (sb.views !== sa.views) return sb.views - sa.views;
                      if (sb.lifetime_subscriptions !== sa.lifetime_subscriptions) return sb.lifetime_subscriptions - sa.lifetime_subscriptions;
                      return sb.num_comments_public - sa.num_comments_public;
                    })
                  : CUSTOM_GAMES;

                return sortedGames.map((game, index) => {
                  const stats = workshopStats[game.workshopId];
                  const starRating = stats ? Math.round(stats.score * 5 * 10) / 10 : 0;

                  return (
                    <a
                      key={game.workshopId}
                      href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${game.workshopId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group rounded-2xl overflow-hidden border-2 transition-all hover:shadow-lg hover:-translate-y-1 bg-card ${
                        hasStats && index === 0
                          ? 'border-harvest/40 shadow-md'
                          : 'border-border hover:border-harvest/40'
                      }`}
                    >
                      {/* Cover Image */}
                      <div className="relative aspect-[16/9] overflow-hidden">
                        <img
                          src={game.cover}
                          alt={game.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          width={400}
                          height={225}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        {/* Rank badge */}
                        {hasStats && (
                          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1">
                            <span className="text-sm">{RANK_MEDALS[index] || `#${index + 1}`}</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
                          <p className="text-white font-bold text-sm drop-shadow-lg">{game.title}</p>
                          <ExternalLink className="w-4 h-4 text-white/70 group-hover:text-white flex-shrink-0 transition-colors" />
                        </div>
                      </div>

                      {/* Stats */}
                      {stats ? (
                        <div className="p-2.5 space-y-2">
                          {/* Star Rating Row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-0.5" title={`Rating: ${starRating}/5`}>
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3.5 h-3.5 ${
                                    s <= Math.round(starRating)
                                      ? 'text-harvest fill-harvest'
                                      : 'text-muted-foreground/30'
                                  }`}
                                />
                              ))}
                              <span className="text-xs font-bold text-muted-foreground ml-1">{starRating.toFixed(1)}</span>
                            </div>
                            <div className="flex items-center gap-1" title={`${stats.votes_up} up / ${stats.votes_down} down`}>
                              <ThumbsUp className="w-3 h-3 text-[#22c55e]" />
                              <span className="text-xs font-semibold text-[#22c55e]">{formatNum(stats.votes_up)}</span>
                              <ThumbsDown className="w-3 h-3 text-[#ef4444] ml-1" />
                              <span className="text-xs font-semibold text-[#ef4444]">{formatNum(stats.votes_down)}</span>
                            </div>
                          </div>
                          {/* Stats Row */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1" title="Current Subscribers">
                              <Users className="w-3.5 h-3.5 text-harvest" />
                              <span className="text-xs font-semibold text-muted-foreground">{formatNum(stats.subscriptions)}</span>
                            </div>
                            <div className="flex items-center gap-1" title="Views">
                              <Eye className="w-3.5 h-3.5 text-[#3b82f6]" />
                              <span className="text-xs font-semibold text-muted-foreground">{formatNum(stats.views)}</span>
                            </div>
                            <div className="flex items-center gap-1" title="Favorites">
                              <Heart className="w-3.5 h-3.5 text-[#ec4899]" />
                              <span className="text-xs font-semibold text-muted-foreground">{formatNum(stats.favorited)}</span>
                            </div>
                            <div className="flex items-center gap-1" title="Comments">
                              <MessageSquare className="w-3.5 h-3.5 text-[#8b5cf6]" />
                              <span className="text-xs font-semibold text-muted-foreground">{formatNum(stats.num_comments_public)}</span>
                            </div>
                          </div>
                          {/* Lifetime stats */}
                          <div className="flex items-center justify-between pt-1 border-t border-border">
                            <span className="text-[10px] text-muted-foreground">Lifetime subs: {formatNum(stats.lifetime_subscriptions)}</span>
                            <span className="text-[10px] text-muted-foreground">Lifetime favs: {formatNum(stats.lifetime_favorited)}</span>
                          </div>
                        </div>
                      ) : null}
                    </a>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ── Discord Server Widget ── */}
        <LazyDiscordWidget />

      </div>

      <Footer />

      {/* Modals */}
      {result && (
        <SuccessModal
          type={result.type}
          title={result.title}
          message={result.message}
          helpText={result.helpText}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}