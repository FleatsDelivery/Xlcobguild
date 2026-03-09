/**
 * KKup Detail — Player Stats Tab (Players & Coaches)
 */

import { Target, Clipboard } from 'lucide-react';
import { AggregatedPlayerStats } from '@/app/components/aggregated-player-stats';
import type { PlayerStat } from './kkup-detail-types';

export interface KKupDetailPlayerStatsProps {
  playerStats: PlayerStat[];
  coachMembers: any[];
}

export function KKupDetailPlayerStats({ playerStats, coachMembers }: KKupDetailPlayerStatsProps) {
  return (
    <div className="space-y-6">
      {/* Coaches */}
      {coachMembers.length > 0 && (
        <div className="bg-card rounded-2xl border-2 border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
              <Clipboard className="w-5 h-5 text-[#3b82f6]" />
            </div>
            <h3 className="text-xl font-black text-foreground">Coaches</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coachMembers.map((coach: any) => (
              <div key={coach.person_id} className="flex items-center gap-3 bg-[#3b82f6]/5 rounded-xl p-4 border border-[#3b82f6]/20">
                {coach.avatar_url ? (
                  <img src={coach.avatar_url} alt={coach.display_name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-harvest to-orange-400 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                    {coach.display_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">{coach.display_name}</p>
                  <p className="text-sm text-[#3b82f6] font-semibold">Coach — {coach.team_name}</p>
                  {coach.steam_id && /^\d+$/.test(coach.steam_id) && (
                    <a href={`https://www.opendota.com/players/${coach.steam_id}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-harvest transition-colors">
                      OpenDota Profile
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player Stats */}
      {playerStats.length === 0 ? (
        <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
          <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">No player stats available yet</p>
        </div>
      ) : (
        <AggregatedPlayerStats stats={playerStats} />
      )}
    </div>
  );
}
