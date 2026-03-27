/**
 * Tournament Overview Tab - Completed Phase (6B)
 * 
 * Shows tournament summary stats for completed tournaments:
 * - Champion spotlight
 * - Final standings podium (Top 4)
 * - Most popular heroes
 * - Top players by KDA (POPD Kernel criteria!)
 * - Tournament metadata (dates, format, participant counts)
 */

import { useState, useEffect } from 'react';
import { Trophy, Calendar, Users, Gamepad2, Target, TrendingUp, Youtube, Lock, Swords, Clock, Ticket } from 'lucide-react';
import { TeamLogo } from '../team-logo';
import { getHeroImageUrl, getHeroName } from '@/lib/dota-heroes';
import { formatDateShort } from '@/lib/date-utils';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { Footer } from '@/app/components/footer';
import { useTournament } from '@/app/contexts/tournament-context';
import { RankModal } from '@/app/components/tournament-hub-rank-modal';
import { RANK_MEDALS } from '@/lib/rank-utils';
import { toast } from 'sonner';
import { RegOpenOverview } from './tournament-overview-reg-open';

interface TournamentOverviewTabProps {
  tournamentId: string;
}

interface OverviewData {
  tournament: {
    id: string;
    name: string;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
    total_teams: number;
    total_players: number;
    total_matches: number;
    total_heroes_picked: number;
    youtube_vod_url: string | null;
    prize_pool?: string | number | null;
    prize_pool_donations?: number | null;
    all_teams_ticket_ready?: boolean;
  };
  champion: {
    id: string;
    team_name: string;
    team_tag: string;
    placement: number;
    wins: number;
    losses: number;
    logo_url: string | null;
  } | null;
  top_teams: Array<{
    id: string;
    team_name: string;
    team_tag: string;
    placement: number;
    wins: number;
    losses: number;
    logo_url: string | null;
    avg_rank?: { medal: string; stars: number } | null;
    ticket_coverage?: { wallet: number; tcf_plus: number; total: number } | null;
  }>;
  most_picked_heroes: Array<{
    hero_id: number;
    pick_count: number;
  }>;
  top_players: Array<{
    person_id: string;
    steam_name: string;
    steam_avatar: string | null;
    kda: number;
    kills: number;
    deaths: number;
    assists: number;
    matches_played: number;
    tcf_plus_active: boolean;
  }>;
  data_source?: string;
  empty_state?: boolean;
}

export function TournamentOverviewTab({ tournamentId }: TournamentOverviewTabProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOverview() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournamentId}/overview`,
          {
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch overview data');
        }

        const result = await response.json();
        setData(result);
      } catch (err: any) {
        console.error('Error fetching tournament overview:', err);
        setError(err.message || 'Failed to load overview');
      } finally {
        setLoading(false);
      }
    }

    fetchOverview();
  }, [tournamentId]);

  // Only show full-page loading if we don't have any data yet.
  // This prevents the page from blanking out during background refreshes (e.g. timer zero refetch).
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12 sm:py-16">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-harvest border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading overview...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-error/10 border-2 border-error/20 rounded-xl p-4 sm:p-6">
        <p className="text-error font-semibold">{error || 'Failed to load overview'}</p>
      </div>
    );
  }

  const { tournament, champion, top_teams, most_picked_heroes, top_players } = data;

  // ══════════════════════════════════════════════════════════
  // REG OPEN PHASE: Show live registration hub (B2)
  // ══════════════════════════════════════════════════════════
  if (tournament.status === 'registration_open' || tournament.status === 'registration') {
    return <RegOpenOverview data={data} />;
  }

  // ══════════════════════════════════════════════════════════
  // REG CLOSED PHASE: Show team assembly hub (B3)
  // ══════════════════════════════════════════════════════════
  if (tournament.status === 'registration_closed') {
    return <RegClosedOverview data={data} />;
  }

  // ══════════════════════════════════════════════════════════
  // ROSTER LOCK PHASE: Show anticipation/lineup view (B4)
  // ══════════════════════════════════════════════════════════
  if (tournament.status === 'roster_lock') {
    return <RosterLockOverview data={data} />;
  }

  // Sort top_teams by placement using the same logic as the teams tab:
  // champion is always #1, then stored placement ascending, then W/L fallback
  const sortedTeams = [...top_teams].sort((a, b) => {
    if (champion) {
      if (a.id === champion.id) return -1;
      if (b.id === champion.id) return 1;
    }
    if (a.placement != null && b.placement != null) return a.placement - b.placement;
    if (a.placement != null) return -1;
    if (b.placement != null) return 1;
    return b.wins - a.wins;
  });

  // Assign effective placement (champion always 1, rest use stored or position)
  const teamsWithPlacement = sortedTeams.map((team, idx) => ({
    ...team,
    effectivePlacement: champion && team.id === champion.id ? 1 : (team.placement ?? idx + 1),
  }));

  // Use backend-calculated total heroes picked count
  const totalHeroesPicked = tournament.total_heroes_picked;
  const maxDotaHeroes = 125; // Current hero pool (updated as of 2024)

  // Extract YouTube video ID from URL (supports multiple formats)
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    
    // Match patterns: youtube.com/watch?v=VIDEO_ID, youtu.be/VIDEO_ID, youtube.com/embed/VIDEO_ID
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]+)/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]+)/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  };

  const youtubeVideoId = tournament.youtube_vod_url ? getYouTubeVideoId(tournament.youtube_vod_url) : null;

  // ══════════════════════════════════════════════════════════
  // EMPTY STATE: No match data found (show fallback UI)
  // ══════════════════════════════════════════════════════════
  if (data.empty_state) {
    return (
      <div className="space-y-6">
        {/* Stats Grid (still shows teams) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-card border-2 border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-harvest" />
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Teams</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">{tournament.total_teams}</p>
          </div>

          <div className="bg-card border-2 border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-husk" />
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Participants</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">-</p>
          </div>

          <div className="bg-card border-2 border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gamepad2 className="w-4 h-4 text-harvest" />
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Matches</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">0</p>
          </div>

          <div className="bg-card border-2 border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-husk" />
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Duration</p>
            </div>
            <p className="text-sm sm:text-base font-bold text-foreground">
              {tournament.start_date && tournament.end_date ? (
                <>
                  {formatDateShort(tournament.start_date)} - {formatDateShort(tournament.end_date)}
                </>
              ) : (
                'N/A'
              )}
            </p>
          </div>
        </div>

        {/* Empty State Card with Corn */}
        <div className="bg-gradient-to-br from-[#f59e0b]/20 to-transparent border-2 border-[#f59e0b]/30 rounded-2xl p-8 sm:p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="text-6xl sm:text-7xl">🌽</div>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground">
              No Match Data Available
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Match data hasn't been imported yet for this tournament. Once matches are played and 
              imported via Steam API or CSV upload, you'll see tournament stats, hero picks, and 
              player leaderboards here.
            </p>
            <div className="pt-2">
              <p className="text-xs text-muted-foreground/80">
                Data Source: {data.data_source === 'none' ? 'None available' : data.data_source}
              </p>
            </div>
          </div>
        </div>

        {/* Show tournament description if available */}
        {tournament.description && (
          <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 sm:mb-4">About This Tournament</h3>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {tournament.description}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // NORMAL STATE: Match data found! Show full overview
  // ══════════════════════════════════════════════════════════

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ══════════════════════════════════════════════════════════ */}
      {/* CHAMPION HERO SECTION */}
      {/* ══════════════════════════════════════════════════════════ */}
      {champion && (
        <div className="bg-gradient-to-br from-kernel-gold/20 via-harvest/10 to-transparent border-2 border-kernel-gold/30 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="shrink-0">
              <TeamLogo
                teamTag={champion.team_tag}
                tournamentName={tournament.name}
                size="xl"
                className="w-20 h-20 sm:w-24 sm:h-24"
              />
            </div>
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-kernel-gold" />
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {tournament.name} Champions
                </h2>
              </div>
              <p className="text-3xl sm:text-4xl font-bold text-kernel-gold">
                {champion.team_name}
              </p>
              <p className="text-base sm:text-lg text-muted-foreground">
                <span className="font-bold text-foreground">{champion.team_tag}</span> claimed victory
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TOURNAMENT STATS GRID */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Prize Pool */}
        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-harvest" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Prize Pool</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-harvest drop-shadow-sm">
            ${(parseFloat(tournament.prize_pool?.toString().replace(/[^0-9.]/g, '') || '0') + (tournament.prize_pool_donations || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
            {(tournament.prize_pool_donations || 0) > 0 ? `+ $${(tournament.prize_pool_donations || 0).toLocaleString()} Donations` : 'Base Pool'}
          </p>
        </div>

        {/* Matches */}
        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gamepad2 className="w-4 h-4 text-husk" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Matches</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{tournament.total_matches}</p>
        </div>

        {/* Participants (Players + Coaches + Staff) */}
        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-harvest" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Participants</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{tournament.total_players}</p>
        </div>

        {/* Heroes Picked */}
        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-husk" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Heroes Picked</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">
            {totalHeroesPicked}/{maxDotaHeroes}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* ═════════════════════════════════════════════════════════ */}
        {/* FINAL STANDINGS PODIUM */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Trophy className="w-5 h-5 text-harvest" />
            <h3 className="text-lg sm:text-xl font-bold text-foreground">Final Standings</h3>
          </div>

          {/* Scrollable container with max-height */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {teamsWithPlacement.map((team) => {
              const p = team.effectivePlacement;
              const medal = p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : null;
              const bgColors: Record<number, string> = {
                1: 'bg-gradient-to-r from-kernel-gold/20 to-transparent',
                2: 'bg-gradient-to-r from-muted to-transparent',
                3: 'bg-gradient-to-r from-[#cd7f32]/20 to-transparent',
              };
              const bg = bgColors[p] ?? 'bg-muted/50';
              const ordinalStr = p === 1 ? '1st' : p === 2 ? '2nd' : p === 3 ? '3rd' : `${p}th`;

              return (
                <div
                  key={team.id}
                  className={`flex items-center gap-3 sm:gap-4 ${bg} border-2 border-border rounded-xl p-3 sm:p-4`}
                >
                  {/* Medal or rank number */}
                  <div className="text-2xl sm:text-3xl min-w-[2rem] text-center">
                    {medal ?? `#${p}`}
                  </div>
                  <TeamLogo
                    teamTag={team.team_tag}
                    tournamentName={tournament.name}
                    size="md"
                    className="w-10 h-10 sm:w-12 sm:h-12"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm sm:text-base text-foreground truncate">
                      {team.team_name}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {team.team_tag} • {team.wins}-{team.losses}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs sm:text-sm font-semibold text-muted-foreground">
                      {ordinalStr} Place
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* MOST POPULAR HEROES */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Gamepad2 className="w-5 h-5 text-husk" />
            <h3 className="text-lg sm:text-xl font-bold text-foreground">Most Popular Heroes</h3>
          </div>

          {most_picked_heroes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hero data available</p>
          ) : (
            <div className="space-y-3">
              {most_picked_heroes.map((hero, idx) => (
                <div
                  key={hero.hero_id}
                  className="flex items-center gap-3 sm:gap-4 bg-muted/50 border-2 border-border rounded-xl p-3"
                >
                  <div className="text-lg sm:text-xl font-bold text-muted-foreground w-6">
                    #{idx + 1}
                  </div>
                  <img
                    src={getHeroImageUrl(hero.hero_id)}
                    alt={getHeroName(hero.hero_id)}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover border-2 border-border bg-muted"
                    onError={(e) => {
                      // Fallback: Use a placeholder or log the error
                      console.warn(`Failed to load hero image for ID ${hero.hero_id}:`, getHeroImageUrl(hero.hero_id));
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23e8e0d0" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" font-size="40" text-anchor="middle" dy=".3em"%3E?%3C/text%3E%3C/svg%3E';
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-bold text-sm sm:text-base text-foreground">{getHeroName(hero.hero_id)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {hero.pick_count} {hero.pick_count === 1 ? 'pick' : 'picks'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TOP PLAYERS BY KDA */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4 sm:mb-6">
          <TrendingUp className="w-5 h-5 text-harvest" />
          <h3 className="text-lg sm:text-xl font-bold text-foreground">Top Players by KDA</h3>
          <span className="text-xs sm:text-sm text-muted-foreground ml-auto">(POPD Kernel Criteria)</span>
        </div>

        {top_players.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No player data available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left pb-3 px-2 text-xs sm:text-sm font-bold text-muted-foreground">Rank</th>
                  <th className="text-left pb-3 px-2 text-xs sm:text-sm font-bold text-muted-foreground">Player</th>
                  <th className="text-center pb-3 px-2 text-xs sm:text-sm font-bold text-muted-foreground">KDA</th>
                  <th className="text-center pb-3 px-2 text-xs sm:text-sm font-bold text-muted-foreground hidden sm:table-cell">K/D/A</th>
                  <th className="text-center pb-3 px-2 text-xs sm:text-sm font-bold text-muted-foreground hidden sm:table-cell">Matches</th>
                </tr>
              </thead>
              <tbody>
                {top_players.slice(0, 5).map((player, idx) => {
                  const rankColors = ['text-kernel-gold', 'text-muted-foreground', 'text-[#cd7f32]'];
                  const rankColor = idx < 3 ? rankColors[idx] : 'text-muted-foreground';

                  return (
                    <tr key={player.person_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className={`py-3 px-2 font-bold text-base sm:text-lg ${rankColor}`}>
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <TcfPlusAvatarRing active={player.tcf_plus_active} size="xs">
                            {player.steam_avatar ? (
                              <img
                                src={player.steam_avatar}
                                alt={player.steam_name}
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-border"
                              />
                            ) : (
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted border-2 border-border" />
                            )}
                          </TcfPlusAvatarRing>
                          <span className="font-bold text-sm sm:text-base text-foreground truncate max-w-[120px] sm:max-w-none">
                            {player.steam_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="font-bold text-base sm:text-lg text-harvest">
                          {player.kda.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">
                        {player.kills} / {player.deaths} / {player.assists}
                      </td>
                      <td className="py-3 px-2 text-center text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">
                        {player.matches_played}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* YOUTUBE VOD EMBED */}
      {/* ══════════════════════════════════════════════════════════ */}
      {youtubeVideoId && (
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Youtube className="w-5 h-5 text-[#ff0000]" />
            <h3 className="text-lg sm:text-xl font-bold text-foreground">Watch the VOD</h3>
          </div>
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-xl border-2 border-border"
              src={`https://www.youtube.com/embed/${youtubeVideoId}`}
              title="Tournament VOD"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TOURNAMENT DESCRIPTION */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tournament.description && (
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3 sm:mb-4">About This Tournament</h3>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {tournament.description}
          </p>
        </div>
      )}

      <Footer />
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// REG CLOSED OVERVIEW (B3) — Team Assembly Hub
// Shows teams forming, free agents available, ticket status
// ══════════════════════════════════════════════════════════

function RegClosedOverview({ data }: { data: OverviewData }) {
  const { tournament, top_teams } = data;

  const approvedTeams = top_teams.filter(t => (t as any).approval_status === 'approved' || (t as any).approval_status == null);
  const pendingTeams  = top_teams.filter(t => (t as any).approval_status === 'pending');
  const totalTickets  = approvedTeams.reduce((sum, t) => sum + (t.ticket_coverage?.total ?? 0), 0);
  const maxTickets    = approvedTeams.length * 5;
  const allReady      = tournament.all_teams_ticket_ready;
  const deadline      = (tournament as any).registration_deadline;

  const daysLeft = (() => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();

  const MAX_TICKETS = 5;

  return (
    <div className="space-y-6 sm:space-y-8">

      {/* ── HERO BANNER ── */}
      <div className="bg-gradient-to-br from-[#3b82f6]/15 via-[#3b82f6]/8 to-transparent border-2 border-[#3b82f6]/30 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#3b82f6]/15 border-2 border-[#3b82f6]/30 flex items-center justify-center flex-shrink-0">
            <Users className="w-8 h-8 sm:w-10 sm:h-10 text-[#3b82f6]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-1">
              Team Assembly In Progress
            </h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-[#3b82f6]/80">Registration Closed</span>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Registration is closed. Captains are finalizing their rosters — free agents can still be picked up until roster lock.
            </p>
          </div>

          {/* Deadline chip */}
          {daysLeft !== null && (
            <div className="flex-shrink-0 text-center bg-soil/80 border-2 border-[#3b82f6]/30 rounded-2xl px-5 py-4 self-start sm:self-auto">
              <div className="text-3xl sm:text-4xl font-bold text-[#3b82f6] leading-none">
                {daysLeft === 0 ? 'Today' : daysLeft}
              </div>
              {daysLeft !== 0 && (
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  {daysLeft === 1 ? 'day left' : 'days left'}
                </div>
              )}
              <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wide mt-0.5">Roster Lock</div>
            </div>
          )}
        </div>
      </div>

      {/* ── STAT STRIP ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-harvest" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Teams</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{tournament.total_teams}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Forming</p>
        </div>

        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#3b82f6]" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Players</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{tournament.total_players}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Registered</p>
        </div>

        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Ticket className={`w-4 h-4 ${allReady ? 'text-[#10b981]' : 'text-[#f59e0b]'}`} />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Tickets</p>
          </div>
          <p className={`text-2xl sm:text-3xl font-bold ${allReady ? 'text-[#10b981]' : 'text-foreground'}`}>
            {totalTickets}{maxTickets > 0 ? `/${maxTickets}` : ''}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
            {allReady ? 'All Ready' : 'Filled'}
          </p>
        </div>

        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-[#f59e0b]" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Pending</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{pendingTeams.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Awaiting Approval</p>
        </div>
      </div>

      {/* ── TEAM TICKET STATUS GRID ── */}
      {approvedTeams.length > 0 && (
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-5">
            <Ticket className="w-5 h-5 text-harvest" />
            <h3 className="text-lg sm:text-xl font-bold text-foreground">
              Team Ticket Status — {approvedTeams.length} {approvedTeams.length === 1 ? 'Team' : 'Teams'}
            </h3>
            {allReady && (
              <span className="ml-auto text-xs font-bold bg-[#10b981]/10 text-[#10b981] px-2 py-0.5 rounded-full flex-shrink-0">
                All Ready
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...approvedTeams].sort((a, b) => {
              const aFull = (a.ticket_coverage?.total ?? 0) >= MAX_TICKETS;
              const bFull = (b.ticket_coverage?.total ?? 0) >= MAX_TICKETS;
              if (aFull !== bFull) return aFull ? -1 : 1;
              return (b.ticket_coverage?.total ?? 0) - (a.ticket_coverage?.total ?? 0);
            }).map((team) => {
              const coverage = team.ticket_coverage;
              const total = coverage?.total ?? 0;
              const walletCount = coverage?.wallet ?? 0;
              const tcfCount = coverage?.tcf_plus ?? 0;
              const isReady = total >= MAX_TICKETS;

              return (
                <div
                  key={team.id}
                  className={`bg-muted rounded-xl border-2 p-3 sm:p-4 flex items-center gap-3 transition-all ${
                    isReady ? 'border-[#10b981]/40' : 'border-border'
                  }`}
                >
                  <TeamLogo
                    teamTag={team.team_tag}
                    tournamentName={tournament.name}
                    size="md"
                    className="w-10 h-10 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{team.team_name}</p>
                    <p className="text-[11px] text-muted-foreground font-semibold">[{team.team_tag}]</p>
                  </div>

                  {/* Ticket pips + count */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide leading-none">Tickets</span>
                    <div className="flex items-center gap-[3px]">
                      {Array.from({ length: MAX_TICKETS }).map((_, i) => {
                        const isTcf = i < tcfCount;
                        const isWallet = !isTcf && i < total;
                        return (
                          <div
                            key={i}
                            className={`w-3 h-3 rounded-sm border ${
                              isTcf
                                ? 'bg-harvest border-harvest/60'
                                : isWallet
                                ? 'bg-[#3b82f6] border-[#3b82f6]/60'
                                : 'bg-border/50 border-border'
                            }`}
                          />
                        );
                      })}
                    </div>
                    <span className={`text-[9px] font-bold leading-none ${isReady ? 'text-[#10b981]' : 'text-muted-foreground'}`}>
                      {total}/{MAX_TICKETS}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-harvest border border-harvest/60" />
              <span className="text-xs text-muted-foreground">TCF+ Auto-Ticket</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-[#3b82f6] border border-[#3b82f6]/60" />
              <span className="text-xs text-muted-foreground">Wallet Ticket</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-border/50 border border-border" />
              <span className="text-xs text-muted-foreground">Empty Slot</span>
            </div>
          </div>
        </div>
      )}

      {/* ── PENDING TEAMS ── */}
      {pendingTeams.length > 0 && (
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[#f59e0b]" />
            <h3 className="text-lg sm:text-xl font-bold text-foreground">Awaiting Approval ({pendingTeams.length})</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingTeams.map((team) => (
              <div key={team.id} className="bg-muted rounded-xl border-2 border-[#f59e0b]/30 p-3 flex items-center gap-3">
                <TeamLogo teamTag={team.team_tag} tournamentName={tournament.name} size="sm" className="w-9 h-9 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{team.team_name}</p>
                  <p className="text-[11px] text-[#f59e0b] font-semibold">Pending Approval</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ABOUT ── */}
      {tournament.description && (
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3">About This Tournament</h3>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {tournament.description}
          </p>
        </div>
      )}

      <Footer />
    </div>
  );
}


// ══════════════════════════════════════════════════════════
// ROSTER LOCK OVERVIEW (B4)
// ══════════════════════════════════════════════════════════

function RosterLockOverview({ data }: { data: OverviewData }) {
  const { tournament, top_teams } = data;

  // Countdown to tournament start
  const startDate = tournament.start_date;
  const daysUntil = (() => {
    if (!startDate) return null;
    const diff = new Date(startDate).getTime() - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();

  const formattedStart = startDate
    ? new Date(startDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="space-y-6 sm:space-y-8">

      {/* ── HERO BANNER ── */}
      <div className="bg-gradient-to-br from-harvest/20 via-harvest/10 to-transparent border-2 border-harvest/30 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Lock icon */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-harvest/20 border-2 border-harvest/40 flex items-center justify-center flex-shrink-0">
            <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-harvest" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-1">
              The Battle Lines Are Drawn
            </h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-harvest/80">Rosters Locked</span>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Teams are set. Players are locked in. Seeding has been completed and the bracket is created.
            </p>
          </div>

          {/* Countdown chip */}
          {daysUntil !== null && (
            <div className="flex-shrink-0 text-center bg-soil/80 border-2 border-harvest/30 rounded-2xl px-5 py-4 self-start sm:self-auto">
              <div className="text-3xl sm:text-4xl font-bold text-harvest leading-none">
                {daysUntil === 0 ? 'Today' : daysUntil}
              </div>
              {daysUntil !== 0 && (
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  {daysUntil === 1 ? 'day left' : 'days left'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Start date sub-line */}
        {formattedStart && (
          <div className="mt-5 pt-5 border-t border-harvest/20 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-harvest/60 flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              Tournament begins <span className="font-semibold text-foreground">{formattedStart}</span>
            </span>
          </div>
        )}
      </div>

      {/* ── STATS STRIP ── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Swords className="w-4 h-4 text-harvest" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Teams</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{tournament.total_teams}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Competing</p>
        </div>

        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#3b82f6]" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Players</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{tournament.total_players}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Registered</p>
        </div>

        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className={`w-4 h-4 ${tournament.all_teams_ticket_ready ? 'text-[#10b981]' : 'text-[#f59e0b]'}`} />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Status</p>
          </div>
          <p className={`text-base sm:text-lg font-bold leading-tight ${tournament.all_teams_ticket_ready ? 'text-[#10b981]' : 'text-[#f59e0b]'}`}>
            {tournament.all_teams_ticket_ready ? 'Ready' : 'Not Ready'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
            {tournament.all_teams_ticket_ready ? 'To Roll' : 'Tickets Needed'}
          </p>
        </div>
      </div>

      {/* ── TEAM LINEUP GRID ── */}
      {top_teams.length > 0 && (
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-5">
            <Trophy className="w-5 h-5 text-harvest" />
            <h3 className="text-lg sm:text-xl font-bold text-foreground">
              The Lineup — {top_teams.length} {top_teams.length === 1 ? 'Team' : 'Teams'}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {top_teams.map((team) => {
              const coverage = team.ticket_coverage;
              const total = coverage?.total ?? 0;
              const walletCount = coverage?.wallet ?? 0;
              const tcfCount = coverage?.tcf_plus ?? 0;
              const MAX_TICKETS = 5;

              return (
                <div
                  key={team.id}
                  className="bg-muted rounded-xl border-2 border-border p-3 sm:p-4 flex items-center gap-3 hover:border-harvest/40 transition-all"
                >
                  <TeamLogo
                    teamTag={team.team_tag}
                    tournamentName={tournament.name}
                    size="md"
                    className="w-11 h-11 sm:w-12 sm:h-12 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{team.team_name}</p>
                    <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">{team.team_tag}</p>
                  </div>

                  {/* Ticket coverage — right side */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide leading-none">Tickets</span>
                    {/* 5-pip row */}
                    <div className="flex items-center gap-[3px]">
                      {Array.from({ length: MAX_TICKETS }).map((_, i) => {
                        const isTcf = i < tcfCount;
                        const isWallet = !isTcf && i < total;
                        return (
                          <div
                            key={i}
                            className={`w-3 h-3 rounded-sm border ${
                              isTcf
                                ? 'bg-harvest border-harvest/60'
                                : isWallet
                                ? 'bg-[#3b82f6] border-[#3b82f6]/60'
                                : 'bg-border border-border'
                            }`}
                          />
                        );
                      })}
                    </div>
                    <span className={`text-[9px] font-bold leading-none ${total >= MAX_TICKETS ? 'text-[#10b981]' : 'text-muted-foreground'}`}>
                      {total}/{MAX_TICKETS}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ABOUT THIS TOURNAMENT ── */}
      {tournament.description && (
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3">About This Tournament</h3>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {tournament.description}
          </p>
        </div>
      )}

      <Footer />
    </div>
  );
}

