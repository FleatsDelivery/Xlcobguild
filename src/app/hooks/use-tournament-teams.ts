import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export interface Team {
  id: string;
  tournament_id: string;
  team_name: string;
  team_tag: string;
  captain_id: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  logo_url?: string;
  captain?: any;
  roster?: any[];
  avg_rank?: number;
}

interface UseTournamentTeamsReturn {
  teams: Team[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTournamentTeams(
  tournamentId: string,
  accessToken: string
): UseTournamentTeamsReturn {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchTeams = async () => {
    // Smart caching: don't refetch if we fetched < 30s ago
    const now = Date.now();
    if (now - lastFetch < 30000 && teams.length > 0) {
      console.log('🌽 useTeams: Using cached data (< 30s old)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournamentId}/teams`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken || publicAnonKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch teams: ${response.status}`);
      }

      const data = await response.json();
      setTeams(data.teams || []);
      setLastFetch(now);
      console.log('🌽 useTeams: Fetched', data.teams?.length || 0, 'teams');
    } catch (err) {
      console.error('❌ useTeams error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [tournamentId]);

  return { teams, loading, error, refetch: fetchTeams };
}
