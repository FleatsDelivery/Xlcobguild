import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export interface Player {
  id: string;
  user_id: string;
  tournament_id: string;
  status: 'registered' | 'withdrawn';
  rank_tier?: number;
  rank_stars?: number;
  registered_at: string;
  is_early_access?: boolean;
  team_id?: string;
  user?: {
    id: string;
    discord_username: string;
    discord_avatar?: string;
    steam_persona_name?: string;
    steam_avatar?: string;
  };
  team?: any;
}

interface UseTournamentPlayersReturn {
  players: Player[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTournamentPlayers(
  tournamentId: string,
  accessToken: string
): UseTournamentPlayersReturn {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchPlayers = async () => {
    // Smart caching: don't refetch if we fetched < 30s ago
    const now = Date.now();
    if (now - lastFetch < 30000 && players.length > 0) {
      console.log('🌽 usePlayers: Using cached data (< 30s old)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournamentId}/registrations`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken || publicAnonKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch players: ${response.status}`);
      }

      const data = await response.json();
      setPlayers(data.registrations || []);
      setLastFetch(now);
      console.log('🌽 usePlayers: Fetched', data.registrations?.length || 0, 'players');
    } catch (err) {
      console.error('❌ usePlayers error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [tournamentId]);

  return { players, loading, error, refetch: fetchPlayers };
}
