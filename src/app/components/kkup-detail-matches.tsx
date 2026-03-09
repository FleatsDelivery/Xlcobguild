/**
 * KKup Detail — Matches Tab
 */

import { Swords } from 'lucide-react';
import { MatchCardWithHeroes } from '@/app/components/match-card-with-heroes';
import type { Match, PlayerStat, RosterEntry } from './kkup-detail-types';

export interface KKupDetailMatchesProps {
  matches: Match[];
  playerStats: PlayerStat[];
  teamRosters: Record<string, RosterEntry[]>;
  isOwner: boolean;
  setSelectedMatch: (match: Match) => void;
  setShowEditMatchModal: (show: boolean) => void;
}

export function KKupDetailMatches({
  matches, playerStats, teamRosters, isOwner,
  setSelectedMatch, setShowEditMatchModal,
}: KKupDetailMatchesProps) {
  return (
    <div className="space-y-6">
      {matches.length === 0 ? (
        <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
          <Swords className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">No match data available yet</p>
        </div>
      ) : (
        matches.map((match) => {
          const matchStats = playerStats.filter((s) => s.match_id === match.id);
          return (
            <MatchCardWithHeroes
              key={match.id}
              match={match}
              playerStats={matchStats}
              team1Roster={teamRosters[match.team1_id] || []}
              team2Roster={teamRosters[match.team2_id] || []}
              isOwner={isOwner}
              onEdit={() => { setSelectedMatch(match); setShowEditMatchModal(true); }}
            />
          );
        })
      )}
    </div>
  );
}
