/**
 * Tournament Matches Tab - Phase-Agnostic
 *
 * Displays match history/schedule based on tournament phase.
 * Uses MatchCardWithHeroes for rich hero + player stats visualization.
 */

import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Footer } from '@/app/components/footer';
import { useTournament } from '@/app/contexts/tournament-context';
import { isFinished } from '../tournament-state-config';
import { MatchCardWithHeroes } from '../match-card-with-heroes';
import { EditMatchModal } from '../edit-match-modal';
import { useState, useEffect } from 'react';
import { Swords } from '@/lib/icons';
import { TabNoData } from '../tab-no-data';

// Phases where no matches exist yet — show static empty state, skip fetch
const PRE_MATCH_PHASES = ['upcoming', 'registration_open', 'registration_closed', 'roster_lock'];

const PRE_MATCH_SUBTITLES: Record<string, string> = {
  upcoming:             'The tournament hasn\'t started yet. Match data will be available during the Live, Completed, and Archived phases.',
  registration_open:    'Registration is open but no matches have been played. Match data will be available during the Live, Completed, and Archived phases.',
  registration_closed:  'Registration has closed. Match data will be available during the Live, Completed, and Archived phases.',
  roster_lock:          'Rosters are locked. Match data will be available once the tournament goes Live.',
};

export function TournamentMatchesTab() {
  const { tournament, isOfficer } = useTournament();
  const [matches, setMatches] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMatch, setEditingMatch] = useState<any | null>(null);

  useEffect(() => {
    if (!tournament) return;
    // E1–E4: Skip fetch entirely for pre-match phases
    if (PRE_MATCH_PHASES.includes(tournament.status)) return;
    fetchMatches();
    if (isOfficer) fetchTeams();
  }, [tournament, isOfficer]);

  const fetchMatches = async () => {
    if (!tournament) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('supabase_token') || publicAnonKey;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/matches`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    if (!tournament) return;
    try {
      const token = localStorage.getItem('supabase_token') || publicAnonKey;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/teams`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error('Failed to fetch teams for edit modal:', err);
    }
  };

  if (!tournament) return null;

  // E1–E4: Pre-match phases — no data to show
  if (PRE_MATCH_PHASES.includes(tournament.status)) {
    return (
      <>
        <TabNoData
          icon={Swords}
          title="No Match Data Available"
          subtitle={PRE_MATCH_SUBTITLES[tournament.status] || 'Matches will appear once the tournament begins.'}
          hint={`Current phase: ${tournament.status.replace(/_/g, ' ')}`}
        />
        <Footer />
      </>
    );
  }

  const finished = isFinished(tournament.status);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading matches...</div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-8 text-center">
        <Swords className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">No Matches Yet</h3>
        <p className="text-muted-foreground">
          Matches will appear here once the bracket is generated and the tournament begins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <h2 className="text-2xl font-bold text-foreground">
        {finished ? 'Match History' : 'Matches'} ({matches.length})
      </h2>

      {/* Match Cards */}
      <div className="space-y-4">
        {matches.map((match: any) => {
          const playerStats = [
            ...(match.team1_players || []),
            ...(match.team2_players || []),
          ];

          const enrichedMatch = {
            ...match,
            tournament_name: tournament?.name,
          };

          return (
            <MatchCardWithHeroes
              key={match.id}
              match={enrichedMatch}
              playerStats={playerStats}
              isOwner={isOfficer}
              onEdit={isOfficer ? () => setEditingMatch(match) : undefined}
            />
          );
        })}
      </div>

      {/* Edit Match Modal */}
      {editingMatch && (
        <EditMatchModal
          match={editingMatch}
          tournamentId={tournament.id}
          availableTeams={teams}
          onClose={() => setEditingMatch(null)}
          onSave={() => {
            setEditingMatch(null);
            fetchMatches();
          }}
        />
      )}

      <Footer />
    </div>
  );
}
