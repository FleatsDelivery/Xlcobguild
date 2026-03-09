/**
 * KKup Detail — Teams Tab
 *
 * Renders team cards with headers, top heroes, and roster sections.
 */

import { Users, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { TeamLogo } from '@/app/components/team-logo';
import { getHeroImageUrl } from '@/lib/dota-heroes';

import type { Team, PlayerStat, RosterEntry } from './kkup-detail-types';

export interface KKupDetailTeamsProps {
  teams: Team[];
  playerStats: PlayerStat[];
  teamRosters: Record<string, RosterEntry[]>;
  loadingRosters: boolean;
  isOwner: boolean;
  setSelectedTeam: (team: Team) => void;
  setShowEditTeamModal: (show: boolean) => void;
  setActiveTab: (tab: string) => void;
}

export function KKupDetailTeams({
  teams, playerStats, teamRosters, loadingRosters, isOwner,
  setSelectedTeam, setShowEditTeamModal, setActiveTab,
}: KKupDetailTeamsProps) {
  if (teams.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground mb-4">No team data available yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {teams.map((team) => {
        // Calculate top 3 heroes for this team
        const teamStats = playerStats.filter((stat) => stat.team?.id === team.id);
        const heroCount = new Map<string, { name: string; count: number; wins: number }>();
        teamStats.forEach((stat) => {
          const heroKey = stat.hero_name;
          if (!heroCount.has(heroKey)) heroCount.set(heroKey, { name: stat.hero_name, count: 0, wins: 0 });
          const hero = heroCount.get(heroKey)!;
          hero.count++;
          if (stat.is_winner) hero.wins++;
        });
        const topHeroes = Array.from(heroCount.values()).sort((a, b) => b.count - a.count).slice(0, 3);

        return (
          <div key={team.id} className="bg-card rounded-xl border-2 border-border overflow-hidden">
            <div className="bg-gradient-to-r from-soil to-[#1e293b] p-3 sm:p-4">
              {/* Team header: stacks on mobile, row on desktop */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <TeamLogo logoUrl={team.logo_url} teamName={team.name} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white truncate">{team.name}</h3>
                    {team.tag && <p className="text-white/70 text-sm">{team.tag}</p>}
                  </div>
                  {isOwner && (
                    <Button
                      size="sm"
                      className="bg-white/10 hover:bg-white/20 text-white border-2 border-white/20 flex-shrink-0 sm:hidden"
                      onClick={() => { setSelectedTeam(team); setShowEditTeamModal(true); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-white/70 font-semibold mb-0.5 sm:mb-1">Matches</p>
                    <p className="text-base sm:text-lg font-bold text-white">
                      {team.game_wins !== undefined ? `${team.game_wins}-${team.game_losses}` : `${team.wins}-${team.losses}`}
                    </p>
                  </div>
                  <div className="text-center px-3 sm:px-4 border-x-2 border-white/20">
                    <p className="text-[10px] sm:text-xs text-white/70 font-semibold mb-0.5 sm:mb-1">Series</p>
                    <p className="text-base sm:text-lg font-bold text-harvest">
                      {team.series_wins !== undefined ? `${team.series_wins}-${team.series_losses}` : `-`}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-white/70 font-semibold mb-0.5 sm:mb-1">Score</p>
                    <p className="text-base sm:text-lg font-bold text-white">
                      {team.total_kills !== undefined ? team.total_kills : `-`}
                    </p>
                  </div>
                  {isOwner && (
                    <Button
                      size="sm"
                      className="bg-white/10 hover:bg-white/20 text-white border-2 border-white/20 hidden sm:flex"
                      onClick={() => { setSelectedTeam(team); setShowEditTeamModal(true); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Top 3 Heroes */}
            {topHeroes.length > 0 && (
              <div className="p-4 border-b-2 border-border">
                <h4 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wide">Top Heroes</h4>
                <div className="grid grid-cols-3 gap-3">
                  {topHeroes.map((hero, index) => {
                    const heroStatsForTeam = playerStats.filter((stat) => stat.team?.id === team.id && stat.hero_name === hero.name);
                    const heroId = heroStatsForTeam[0]?.hero_id;
                    const heroImageUrl = heroId ? getHeroImageUrl(heroId) : null;
                    const winRate = hero.count > 0 ? ((hero.wins / hero.count) * 100).toFixed(0) : "0";
                    return (
                      <div key={hero.name} className="relative bg-gradient-to-br from-soil to-[#1e293b] rounded-lg overflow-hidden border-2 border-harvest/20 group hover:border-harvest transition-all">
                        {heroImageUrl && (
                          <img src={heroImageUrl} alt={hero.name} className="w-full aspect-video object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                            onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-white font-bold text-xs truncate">{hero.name}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-harvest font-bold text-xs">{hero.count} picks</p>
                            <p className="text-white/80 text-xs">{winRate}% WR</p>
                          </div>
                        </div>
                        {index === 0 && <div className="absolute top-2 right-2 bg-harvest text-white text-xs font-black px-2 py-1 rounded">#1</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Roster */}
            {loadingRosters ? (
              <div className="pt-4 border-t-2 border-border flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-harvest animate-spin" />
              </div>
            ) : teamRosters[team.id] && teamRosters[team.id].length > 0 ? (
              <div className="p-4">
                <h4 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wide">
                  Roster ({teamRosters[team.id].filter(r => !r.is_standin).length} Players
                  {teamRosters[team.id].some(r => r.is_standin) &&
                    ` + ${teamRosters[team.id].filter(r => r.is_standin).length} Stand-in${teamRosters[team.id].filter(r => r.is_standin).length > 1 ? 's' : ''}`
                  })
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {teamRosters[team.id].map((rosterEntry) => (
                    <button
                      key={rosterEntry.id}
                      onClick={() => { setActiveTab('players'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100); }}
                      className={`flex flex-col items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                        rosterEntry.is_standin
                          ? 'bg-amber-50/50 border-amber-200/50 hover:border-amber-400 hover:bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700/30 dark:hover:bg-amber-900/20'
                          : 'bg-background border-border hover:border-harvest hover:bg-harvest/5'
                      }`}
                    >
                      {rosterEntry.player.avatar_url ? (
                        <img src={rosterEntry.player.avatar_url} alt={rosterEntry.player.player_name} className="w-12 h-12 rounded-full border-2 border-harvest/20" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-harvest/20 flex items-center justify-center">
                          <Users className="w-6 h-6 text-harvest" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 w-full text-center">
                        <p className="font-bold text-foreground text-sm truncate">
                          {(rosterEntry.player as any).name || rosterEntry.player.player_name}
                        </p>
                        {rosterEntry.is_standin && (
                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded mt-0.5">
                            Stand-in
                          </span>
                        )}
                        <div className="flex gap-2 mt-1 justify-center">
                          {rosterEntry.player.opendota_url && (
                            <a href={rosterEntry.player.opendota_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-harvest hover:underline" onClick={(e) => e.stopPropagation()}>
                              OpenDota
                            </a>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t-2 border-border text-center py-6">
                <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No roster data available</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}