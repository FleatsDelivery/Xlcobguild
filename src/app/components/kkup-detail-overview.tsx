/**
 * KKup Detail — Overview Tab
 *
 * Renders final standings, Pop'd Kernel winners, top players,
 * hero stats, KKup movie embed, and empty state.
 */

import { Crown, Trophy, Users, Star, Youtube } from 'lucide-react';
import { TeamLogo } from '@/app/components/team-logo';
import { TournamentTopPlayers } from '@/app/components/tournament-top-players';
import { TournamentHeroStats } from '@/app/components/tournament-hero-stats';
import { TrophyImage } from '@/app/components/trophy-image';

import type { Tournament, Team, PlayerStat } from './kkup-detail-types';

export interface KKupDetailOverviewProps {
  tournament: Tournament;
  teams: Team[];
  playerStats: PlayerStat[];
  heroBans: Record<number, number>;
  getKKupNumber: (t: Tournament | null) => string | null;
  setActiveTab: (tab: string) => void;
}

export function KKupDetailOverview({
  tournament, teams, playerStats, heroBans, getKKupNumber, setActiveTab,
}: KKupDetailOverviewProps) {
  return (
    <div className="space-y-6">
      {teams.length > 0 && (
        <div className="bg-card rounded-2xl border-2 border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <Crown className="w-6 h-6 text-harvest" />
            <h2 className="text-2xl font-bold text-foreground">Final Standings</h2>
          </div>
          <div className="space-y-3">
            {teams.map((team, index) => (
              <button
                key={team.id}
                onClick={() => setActiveTab("teams")}
                className={`w-full flex flex-col sm:flex-row items-center justify-between rounded-xl border-2 transition-all cursor-pointer gap-3 sm:gap-0 ${
                  index === 0
                    ? "bg-gradient-to-r from-harvest/10 to-amber/10 border-harvest shadow-[0_0_30px_rgba(214,166,21,0.3)] hover:shadow-[0_0_40px_rgba(214,166,21,0.5)] p-4 sm:p-6"
                    : "bg-background border-border hover:border-harvest/50 hover:bg-harvest/5 p-3 sm:p-4"
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                  {index === 0 && <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-harvest animate-pulse" />}
                  <span className={`font-black ${index === 0 ? "text-2xl sm:text-3xl text-harvest" : "text-xl sm:text-2xl text-muted-foreground"}`}>
                    #{index + 1}
                  </span>
                  <TeamLogo logoUrl={team.logo_url} teamName={team.name} size={index === 0 ? "lg" : "md"} />
                  <div className="text-left flex-1 min-w-0">
                    <p className={`font-bold truncate ${index === 0 ? "text-xl sm:text-2xl text-foreground" : "text-base sm:text-lg text-foreground"}`}>
                      {team.name}
                    </p>
                    {index === 0 && <p className="text-xs sm:text-sm font-bold text-harvest mt-1">🏆 Kernel Kup Champions</p>}
                    {team.tag && <p className={`text-muted-foreground truncate ${index === 0 ? "text-sm sm:text-base" : "text-xs sm:text-sm"}`}>{team.tag}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-6">
                  <div className="text-center">
                    <p className={`text-muted-foreground font-semibold mb-1 ${index === 0 ? "text-xs sm:text-sm" : "text-[10px] sm:text-xs"}`}>Matches</p>
                    <p className={`font-bold text-foreground ${index === 0 ? "text-lg sm:text-xl" : "text-base sm:text-lg"}`}>
                      {team.game_wins !== undefined ? `${team.game_wins}-${team.game_losses}` : `${team.wins}-${team.losses}`}
                    </p>
                  </div>
                  <div className={`text-center border-x-2 border-border ${index === 0 ? "px-3 sm:px-6" : "px-2 sm:px-4"}`}>
                    <p className={`text-muted-foreground font-semibold mb-1 ${index === 0 ? "text-xs sm:text-sm" : "text-[10px] sm:text-xs"}`}>Series</p>
                    <p className={`font-bold text-harvest ${index === 0 ? "text-lg sm:text-xl" : "text-base sm:text-lg"}`}>
                      {team.series_wins !== undefined ? `${team.series_wins}-${team.series_losses}` : `-`}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className={`text-muted-foreground font-semibold mb-1 ${index === 0 ? "text-xs sm:text-sm" : "text-[10px] sm:text-xs"}`}>Score</p>
                    <p className={`font-bold text-foreground ${index === 0 ? "text-lg sm:text-xl" : "text-base sm:text-lg"}`}>
                      {team.total_kills !== undefined ? team.total_kills : `-`}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pop'd Kernel Winners */}
      {(tournament?.popd_kernel_1_name || tournament?.popd_kernel_2_name) && (
        <div className="bg-card rounded-2xl border-2 border-harvest/30 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-harvest/10 flex items-center justify-center">
              <TrophyImage type="popd_kernel_mvp" size="lg" />
            </div>
            <h3 className="text-xl font-black text-foreground">Pop'd Kernel Winners</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[tournament?.popd_kernel_1_name, tournament?.popd_kernel_2_name].filter(Boolean).map((name, i) => (
              <div key={i} className="flex items-center gap-3 bg-harvest/5 rounded-xl p-4 border border-harvest/20">
                <div className="w-12 h-12 rounded-full bg-harvest/20 flex items-center justify-center flex-shrink-0">
                  <TrophyImage type="popd_kernel_mvp" size="lg" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{name}</p>
                  <p className="text-sm text-harvest font-semibold">Pop'd Kernel #{i + 1}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Players */}
      {playerStats.length > 0 && (
        <TournamentTopPlayers
          playerStats={playerStats}
          onPlayerClick={() => {
            setActiveTab('players');
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
          }}
        />
      )}

      {/* Popular Heroes */}
      {playerStats.length > 0 && (
        <TournamentHeroStats playerStats={playerStats} heroBans={heroBans} />
      )}

      {/* Kernel Kup Movie */}
      {(() => {
        const kkupMovieFallback: Record<string, string> = {
          '2': '909f42A5Dyg', '3': 'aLZYOv48xXI', '4': 'xBGhqw_aYFM',
          '5': 'sVkCKgnzLME', '7': 'oOpod0s_nTw', '9': '6PSUxXCszu0',
        };
        const extractVideoId = (url: string): string | null => {
          const patterns = [
            /youtube\.com\/embed\/([^?&/]+)/, /youtube\.com\/watch\?v=([^&]+)/,
            /youtu\.be\/([^?&/]+)/, /youtube\.com\/v\/([^?&/]+)/,
          ];
          for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
          }
          return null;
        };
        const kkNum = getKKupNumber(tournament);
        let videoId: string | null = null;
        if (tournament.youtube_url) videoId = extractVideoId(tournament.youtube_url);
        if (!videoId && tournament.youtube_playlist_url) videoId = extractVideoId(tournament.youtube_playlist_url);
        if (!videoId && kkNum) videoId = kkupMovieFallback[kkNum] || null;
        if (!videoId) return null;
        return (
          <div className="bg-card rounded-2xl border-2 border-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <Youtube className="w-6 h-6 text-[#ff0000]" />
              <h2 className="text-2xl font-bold text-foreground">Kernel Kup {kkNum} Movie</h2>
            </div>
            <div className="relative w-full overflow-hidden rounded-xl" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title={`Kernel Kup ${kkNum} Movie`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        );
      })()}

      {teams.length === 0 && (
        <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-xl font-bold text-foreground mb-2">No Data Yet</h3>
          <p className="text-muted-foreground">Tournament data will appear here once matches are played</p>
        </div>
      )}
    </div>
  );
}