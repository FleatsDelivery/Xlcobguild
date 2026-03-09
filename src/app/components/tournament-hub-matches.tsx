/**
 * Tournament Hub — Matches Tab (Unified)
 *
 * Shows match history for completed tournaments,
 * placeholder/schedule for active tournaments.
 */

import { Swords, Calendar, Clock } from '@/lib/icons';
import { MatchCardWithHeroes } from '@/app/components/match-card-with-heroes';
import type { Match, PlayerStat, RosterEntry } from './kkup-detail-types';
import { TournamentHubEmptyState } from './tournament-hub-empty-state';

export interface TournamentHubMatchesProps {
  tournament: any;
  matches: Match[];
  playerStats: PlayerStat[];
  teamRosters: Record<string, RosterEntry[]>;
  isFinished: boolean;
  isOwner: boolean;
  setSelectedMatch?: (match: Match) => void;
  setShowEditMatchModal?: (show: boolean) => void;
  isRelevant?: boolean;
}

export function TournamentHubMatches({
  tournament,
  matches,
  playerStats,
  teamRosters,
  isFinished,
  isOwner,
  setSelectedMatch,
  setShowEditMatchModal,
  isRelevant = true,
}: TournamentHubMatchesProps) {
  // ── EARLY PHASE: Not relevant yet ──
  if (!isRelevant) {
    return (
      <TournamentHubEmptyState
        icon={Swords}
        title="Matches Start During Tournament"
        description="Match results and statistics will appear here once the tournament begins. Come back when the games start!"
      />
    );
  }
  
  // ── Empty state for pre-live tournaments ──
  if (!isFinished && (!matches || matches.length === 0)) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
        <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
        <h3 className="text-xl font-bold text-foreground mb-2">Matches Coming Soon</h3>
        <p className="text-muted-foreground">
          {tournament?.status === 'upcoming' && 'Matches will be scheduled once rosters are locked.'}
          {tournament?.status === 'registration_open' && 'Matches will be scheduled once registration closes.'}
          {tournament?.status === 'registration_closed' && 'Matches will be scheduled soon.'}
          {tournament?.status === 'roster_lock' && 'Match schedule will be published shortly.'}
          {!tournament?.status && 'Match schedule will be available soon.'}
        </p>
      </div>
    );
  }

  // ── Live/finished tournaments: show match history ──
  if (matches.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
        <Swords className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-muted-foreground">No match data available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header for finished tournaments */}
      {isFinished && (
        <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <Swords className="w-6 h-6 text-harvest" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Match History</h2>
              <p className="text-sm text-muted-foreground">
                {matches.length} {matches.length === 1 ? 'match' : 'matches'} played
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Match cards */}
      {matches.map((match) => {
        const matchStats = playerStats.filter((s) => s.match_id === match.id);
        return (
          <MatchCardWithHeroes
            key={match.id}
            match={match}
            playerStats={matchStats}
            team1Roster={teamRosters[match.team1_id] || []}
            team2Roster={teamRosters[match.team2_id] || []}
            isOwner={isOwner}
            onEdit={
              setSelectedMatch && setShowEditMatchModal
                ? () => {
                    setSelectedMatch(match);
                    setShowEditMatchModal(true);
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}