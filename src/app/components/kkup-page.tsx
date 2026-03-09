import { useState, useEffect } from 'react';
import { Trophy, Sparkles, Loader2, AlertCircle, Plus, Swords, Crown, Users } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Footer } from '@/app/components/footer';
import { TournamentCreateModal } from '@/app/components/tournament-create-modal';
import { TournamentCard } from '@/app/components/tournament-card';
import { toast } from 'sonner';

interface Tournament {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'registration_open' | 'registration_closed' | 'roster_lock' | 'live' | 'completed' | 'archived';
  max_teams: number;
  registration_deadline: string;
  prize_pool: string;
  format: string;
  rules: string;
  league_id?: number;
  twitch_channel?: string;
  created_at: string;
  updated_at: string;
  league_large_icon_url?: string;
  winning_team?: { tag: string; name?: string };
  winning_team_name?: string;
  tournament_type?: string;
  kkup_season?: number | null;
}

interface HofPlayer {
  id: string;
  name: string;
  avatar_url: string | null;
  stats: {
    championships: number;
    totalTournaments: number;
    totalMatches: number;
    totalWins: number;
    totalLosses: number;
    winrate: string;
    totalKills: number;
    totalDeaths: number;
    totalAssists: number;
    avgKDA: string | number;
  } | null;
}

interface KKUPPageProps {
  user?: any;
  onHallOfFameNavigate?: () => void;
}

// Season display config
const SEASON_CONFIG: Record<number, { label: string; icon: string; gradient: string; border: string; accentBg: string; accentText: string }> = {
  4: { label: 'Season 4', icon: '🚀', gradient: 'from-harvest/15 to-harvest/5', border: 'border-harvest/30', accentBg: 'bg-harvest/10', accentText: 'text-harvest' },
  3: { label: 'Season 3', icon: '🌽', gradient: 'from-[#10b981]/10 to-[#10b981]/5', border: 'border-[#10b981]/25', accentBg: 'bg-[#10b981]/10', accentText: 'text-[#10b981]' },
  2: { label: 'Season 2', icon: '⚡', gradient: 'from-[#3b82f6]/10 to-[#3b82f6]/5', border: 'border-[#3b82f6]/25', accentBg: 'bg-[#3b82f6]/10', accentText: 'text-[#3b82f6]' },
  1: { label: 'Season 1', icon: '🌱', gradient: 'from-[#8b5cf6]/10 to-[#8b5cf6]/5', border: 'border-[#8b5cf6]/25', accentBg: 'bg-[#8b5cf6]/10', accentText: 'text-[#8b5cf6]' },
};

const DEFAULT_SEASON_CONFIG = { label: 'Unassigned', icon: '📦', gradient: 'from-muted to-muted/50', border: 'border-border', accentBg: 'bg-muted', accentText: 'text-muted-foreground' };

// ═══════════════════════════════════════════════════════
// SKELETON COMPONENTS
// ═══════════════════════════════════════════════════════

function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded-xl ${className}`} />;
}

function LiveTournamentSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {[1, 2].map(i => (
        <div key={i} className="bg-card rounded-2xl border-2 border-border p-5 space-y-4">
          <div className="flex items-center gap-3">
            <SkeletonPulse className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonPulse className="h-5 w-3/4" />
              <SkeletonPulse className="h-3 w-1/2" />
            </div>
          </div>
          <div className="flex gap-2">
            <SkeletonPulse className="h-6 w-20 rounded-full" />
            <SkeletonPulse className="h-6 w-16 rounded-full" />
          </div>
          <SkeletonPulse className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-5">
      {[1, 2].map(s => (
        <div key={s} className="bg-card rounded-2xl border-2 border-border overflow-hidden">
          {/* Skeleton season header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border flex items-center gap-3">
            <SkeletonPulse className="w-8 h-8 rounded-lg" />
            <SkeletonPulse className="h-5 w-24" />
            <div className="flex-1" />
            <SkeletonPulse className="h-6 w-28 rounded-full" />
          </div>
          {/* Skeleton tournament cards */}
          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                  <SkeletonPulse className="h-4 w-3/4" />
                  <SkeletonPulse className="h-32 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Top3Skeleton() {
  return (
    <div className="bg-card rounded-2xl border-2 border-border p-8">
      <SkeletonPulse className="h-7 w-48 mx-auto mb-2" />
      <SkeletonPulse className="h-4 w-72 mx-auto mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        {[0, 1, 2].map(i => (
          <div key={i} className={`rounded-2xl border-2 border-border p-6 text-center space-y-3 ${i === 1 ? 'order-1 md:order-2' : i === 0 ? 'order-2 md:order-1' : 'order-3'}`}>
            <SkeletonPulse className={`${i === 1 ? 'w-24 h-24' : 'w-20 h-20'} rounded-full mx-auto`} />
            <SkeletonPulse className="h-5 w-32 mx-auto" />
            <SkeletonPulse className="h-3 w-24 mx-auto" />
            <SkeletonPulse className="h-3 w-20 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function KKUPPage({ user, onHallOfFameNavigate }: KKUPPageProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [liveTournaments, setLiveTournaments] = useState<any[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);

  // Top 3 Hall of Fame
  const [top3Players, setTop3Players] = useState<HofPlayer[]>([]);
  const [loadingTop3, setLoadingTop3] = useState(true);

  // Fire all three fetches in parallel on mount
  useEffect(() => {
    fetchLiveTournaments();
    fetchTournaments();
    fetchTop3Players();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournaments`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch tournaments');

      const data = await response.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      setError('Failed to load tournament data');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch Phase 2 live tournaments from kkup_tournaments
  const fetchLiveTournaments = async () => {
    setLoadingLive(true);
    try {
      const token = localStorage.getItem('supabase_token') || publicAnonKey;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        // Only show non-archived, non-completed Phase 2 tournaments
        const active = (data.tournaments || []).filter((t: any) =>
          ['upcoming', 'registration_open', 'registration_closed', 'roster_lock', 'live', 'registration', 'active'].includes(t.status)
        );
        setLiveTournaments(active);
      }
    } catch (err) {
      console.log('Live tournaments fetch failed:', err);
    } finally {
      setLoadingLive(false);
    }
  };

  // Fetch top 3 Hall of Fame players
  const fetchTop3Players = async () => {
    setLoadingTop3(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/hall-of-fame/players`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (response.ok) {
        const data = await response.json();
        const players: HofPlayer[] = data.players || [];
        // Sort by championships → tournaments → winrate, take top 3
        const sorted = [...players]
          .filter(p => p.stats)
          .sort((a, b) => {
            if (!a.stats || !b.stats) return 0;
            if (b.stats.championships !== a.stats.championships) return b.stats.championships - a.stats.championships;
            if (b.stats.totalTournaments !== a.stats.totalTournaments) return b.stats.totalTournaments - a.stats.totalTournaments;
            return parseFloat(b.stats.winrate) - parseFloat(a.stats.winrate);
          })
          .slice(0, 3);
        setTop3Players(sorted);
      }
    } catch (err) {
      console.error('Top 3 fetch failed:', err);
    } finally {
      setLoadingTop3(false);
    }
  };

  // Past tournaments grouped by season, sorted within each group by name/number desc
  const getKKupNumber = (t: any): number => {
    const match = t.name.match(/Kernel Kup (\d+)|KKup (\d+)|KKUP (\d+)/i);
    return match ? parseInt(match[1] || match[2] || match[3]) : 0;
  };

  const pastTournaments = tournaments
    .filter(t => t.status === 'completed' || t.status === 'archived')
    .sort((a, b) => getKKupNumber(b) - getKKupNumber(a));

  // Group by season (descending season number)
  const tournamentsBySeason = pastTournaments.reduce<Record<number, Tournament[]>>((acc, t) => {
    const season = t.kkup_season ?? 0; // 0 = unassigned
    if (!acc[season]) acc[season] = [];
    acc[season].push(t);
    return acc;
  }, {});

  const seasonNumbers = Object.keys(tournamentsBySeason)
    .map(Number)
    .sort((a, b) => b - a); // Descending: Season 4, 3, 2, 1, 0(unassigned)

  if (error && !loadingLive) {
    return (
      <div className="px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-card rounded-2xl border-2 border-[#ef4444]/20 p-6 flex items-center gap-4">
            <AlertCircle className="w-8 h-8 text-error" />
            <div>
              <h3 className="text-lg font-bold text-foreground">Error Loading Tournaments</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 py-4">
      <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
        {/* Hero Section with Stickers */}
        <div className="relative rounded-3xl p-8 sm:p-12 shadow-2xl overflow-hidden">
          {/* Background image */}
          <img
            src={`https://${projectId}.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/branding/hero_image.PNG`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/50" />
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight drop-shadow-lg">
                  🌽 Kernel Kup
                </h1>
                <p className="text-xl sm:text-2xl text-white/90 font-semibold mb-6 drop-shadow-md">
                  The Corniest Dota 2 Tournament in North America
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-start">
                  <Button
                    onClick={() => onHallOfFameNavigate?.()}
                    className="bg-white text-harvest hover:bg-white/90 font-bold text-lg px-8 py-6 rounded-xl shadow-lg transition-all hover:scale-105"
                  >
                    🏛️ Hall of Fame
                  </Button>
                  {liveTournaments.length > 0 && (
                    <Button
                      onClick={() => window.location.hash = `#tournament-hub/${liveTournaments[0].id}`}
                      className="bg-[#fbbf24] text-soil hover:bg-[#fbbf24]/90 font-bold text-lg px-8 py-6 rounded-xl shadow-lg transition-all hover:scale-105"
                    >
                      View Current Tournament
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl">
                  <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-white/90" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Live Tournaments (Phase 2 — kkup_tournaments) ── */}
        {loadingLive ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Swords className="w-6 h-6 text-harvest" />
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Live Tournaments</h2>
            </div>
            <LiveTournamentSkeleton />
          </div>
        ) : (liveTournaments.length > 0 || user?.role === 'owner') ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Swords className="w-6 h-6 text-harvest" />
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Live Tournaments</h2>
              </div>
              {user?.role === 'owner' && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-harvest hover:bg-amber text-white font-bold rounded-xl shadow-lg transition-all hover:scale-105"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Tournament
                </Button>
              )}
            </div>

            {liveTournaments.length === 0 ? (
              <div className="bg-card rounded-2xl border-2 border-dashed border-border p-8 text-center">
                <Swords className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No active tournaments right now.</p>
                {user?.role === 'owner' && (
                  <p className="text-muted-foreground/60 text-xs mt-1">Use the button above to create one.</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {liveTournaments.map((t: any) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    variant="live"
                    onClick={() => window.location.hash = `#tournament-hub/${t.id}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* ── Tournament History (grouped by season) ── */}
        {loadingHistory ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-harvest" />
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Tournament History</h2>
            </div>
            <HistorySkeleton />
          </div>
        ) : pastTournaments.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-harvest" />
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Tournament History</h2>
            </div>

            {seasonNumbers.map(season => {
              const config = SEASON_CONFIG[season] || DEFAULT_SEASON_CONFIG;
              const seasonTournaments = tournamentsBySeason[season];

              return (
                <div key={season} className={`bg-card rounded-2xl border-2 ${config.border} overflow-hidden`}>
                  {/* Season header — integrated into the card */}
                  <div className={`bg-gradient-to-r ${config.gradient} px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 border-b ${config.border}`}>
                    <span className="text-xl sm:text-2xl">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-black text-foreground tracking-wide">
                        {config.label}
                      </h3>
                    </div>
                    <span className={`${config.accentBg} ${config.accentText} text-xs font-bold px-2.5 py-1 rounded-full`}>
                      {seasonTournaments.length} {seasonTournaments.length === 1 ? 'tournament' : 'tournaments'}
                    </span>
                  </div>

                  {/* Tournament cards grid — inside the season card */}
                  <div className="p-3 sm:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                      {seasonTournaments.map((tournament: any) => (
                        <TournamentCard
                          key={tournament.id}
                          tournament={tournament}
                          variant="past"
                          onClick={() => window.location.hash = `#tournament-hub/${tournament.id}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* ── Top 3 Gamers (Hall of Fame Preview) ── */}
        {loadingTop3 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Crown className="w-6 h-6 text-harvest" />
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Top 3 Gamers</h2>
            </div>
            <Top3Skeleton />
          </div>
        ) : top3Players.length >= 3 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-harvest" />
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Top 3 Gamers</h2>
              </div>
              <Button
                onClick={() => onHallOfFameNavigate?.()}
                className="bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-xl text-sm"
              >
                <Trophy className="w-4 h-4 mr-1.5" />
                View Full Hall of Fame
              </Button>
            </div>

            <div className="bg-card rounded-2xl border-2 border-border p-8">
              <h3 className="text-2xl font-black text-foreground mb-2 text-center">All-Time Legends</h3>
              <p className="text-sm text-muted-foreground text-center mb-8">Ranked by Championships, then Tournaments Played, then Win Rate</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                {/* 2nd Place */}
                <div className="order-2 md:order-1">
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl border-2 border-gray-300 p-6 text-center relative">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gray-400 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl font-black border-2 border-white shadow-lg">
                      2
                    </div>
                    {top3Players[1].avatar_url ? (
                      <img
                        src={top3Players[1].avatar_url}
                        alt={top3Players[1].name}
                        className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-gray-300"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-gray-300 flex items-center justify-center border-4 border-gray-400">
                        <Users className="w-10 h-10 text-gray-500" />
                      </div>
                    )}
                    <p className="text-xl font-black text-foreground mb-1">{top3Players[1].name}</p>
                    {top3Players[1].stats && (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p><Trophy className="w-4 h-4 inline mr-1" />{top3Players[1].stats.championships} Championships</p>
                        <p>{top3Players[1].stats.totalTournaments} Tournaments</p>
                        <p>{top3Players[1].stats.winrate}% Winrate</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 1st Place */}
                <div className="order-1 md:order-2">
                  <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-2xl border-2 border-yellow-400 p-6 text-center relative transform md:scale-110">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-br from-yellow-400 to-yellow-500 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black border-4 border-white shadow-xl">
                      1
                    </div>
                    <Crown className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                    {top3Players[0].avatar_url ? (
                      <img
                        src={top3Players[0].avatar_url}
                        alt={top3Players[0].name}
                        className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-yellow-400"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-yellow-300 flex items-center justify-center border-4 border-yellow-400">
                        <Users className="w-12 h-12 text-yellow-600" />
                      </div>
                    )}
                    <p className="text-2xl font-black text-foreground mb-2">{top3Players[0].name}</p>
                    {top3Players[0].stats && (
                      <div className="space-y-1 text-sm text-muted-foreground font-bold">
                        <p><Trophy className="w-4 h-4 inline mr-1" />{top3Players[0].stats.championships} Championships</p>
                        <p>{top3Players[0].stats.totalTournaments} Tournaments</p>
                        <p>{top3Players[0].stats.winrate}% Winrate</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3rd Place */}
                <div className="order-3">
                  <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl border-2 border-orange-300 p-6 text-center relative">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-400 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl font-black border-2 border-white shadow-lg">
                      3
                    </div>
                    {top3Players[2].avatar_url ? (
                      <img
                        src={top3Players[2].avatar_url}
                        alt={top3Players[2].name}
                        className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-orange-300"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-orange-300 flex items-center justify-center border-4 border-orange-400">
                        <Users className="w-10 h-10 text-orange-500" />
                      </div>
                    )}
                    <p className="text-xl font-black text-foreground mb-1">{top3Players[2].name}</p>
                    {top3Players[2].stats && (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p><Trophy className="w-4 h-4 inline mr-1" />{top3Players[2].stats.championships} Championships</p>
                        <p>{top3Players[2].stats.totalTournaments} Tournaments</p>
                        <p>{top3Players[2].stats.winrate}% Winrate</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

      </div>
      <Footer />

      {/* Create Tournament Modal */}
      {showCreateModal && (
        <TournamentCreateModal
          accessToken={localStorage.getItem('supabase_token') || ''}
          onClose={() => setShowCreateModal(false)}
          onCreated={(tournament) => {
            setShowCreateModal(false);
            toast.success(`Tournament "${tournament.name}" created!`);
            fetchLiveTournaments();
          }}
        />
      )}
    </div>
  );
}