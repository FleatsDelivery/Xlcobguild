import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface Tournament {
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
  banner_url?: string;
  league_id?: number;
  twitch_channel?: string;
  bracket_url?: string;
  created_at: string;
  updated_at: string;
  registration_count?: number;
  team_count?: number;
  early_access_enabled?: boolean;
  early_access_start?: string;
  tournament_start_date?: string;
  tournament_end_date?: string;
  winning_team_id?: string;
  winner?: {
    team_name: string;
    team_tag: string;
    logo_url: string | null;
  };
  player_previews?: Array<{
    avatar: string | null;
    name: string;
    tcf_plus_active: boolean;
  }>;
  teams_count?: number;
  twitch_url_1?: string;
  twitch_url_2?: string;
}

export interface Registration {
  id: string;
  user_id: string;
  person_id?: string;
  tournament_id: string;
  status: 'registered' | 'withdrawn' | 'on_team' | 'free_agent';
  rank_tier?: number;
  rank_stars?: number;
  registered_at: string;
  is_early_access?: boolean;
  team_id?: string;
  team?: any;
}

export interface StaffMember {
  person_id: string;
  role: string;
  display_name: string;
  steam_id: string;
  avatar_url: string | null;
}

interface TournamentContextValue {
  tournament: Tournament | null;
  myRegistration: Registration | null;
  staff: StaffMember[];
  isOfficer: boolean;
  isOwner: boolean;
  user: any;
  accessToken: string;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════

const TournamentContext = createContext<TournamentContextValue | null>(null);

// ═══════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════

interface TournamentProviderProps {
  tournamentId: string;
  user: any;
  accessToken: string;
  children: ReactNode;
}

export function TournamentProvider({ 
  tournamentId, 
  user, 
  accessToken, 
  children 
}: TournamentProviderProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [myRegistration, setMyRegistration] = useState<Registration | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch tournament data
      const tournamentResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournamentId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken || publicAnonKey}`
          }
        }
      );

      if (!tournamentResponse.ok) {
        throw new Error(`Failed to fetch tournament: ${tournamentResponse.status}`);
      }

      const tournamentData = await tournamentResponse.json();
      setTournament(tournamentData.tournament);

      // Only fetch registration for active tournaments (not completed/archived)
      const tournamentStatus = tournamentData.tournament?.status;
      const isActiveTournament = tournamentStatus && !['completed', 'archived'].includes(tournamentStatus);

      if (user?.id && isActiveTournament) {
        const registrationResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournamentId}/my-registration`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken || publicAnonKey}`
            }
          }
        );

        if (registrationResponse.ok) {
          const registrationData = await registrationResponse.json();
          setMyRegistration(registrationData.registration || null);
        } else {
          // User not registered - that's fine
          setMyRegistration(null);
        }
      } else {
        setMyRegistration(null);
      }

      // Fetch staff members
      try {
        const staffResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournamentId}/staff`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken || publicAnonKey}`
            }
          }
        );

        if (staffResponse.ok) {
          const staffData = await staffResponse.json();
          setStaff(staffData.staff || []);
        } else {
          setStaff([]);
        }
      } catch (staffErr) {
        // Non-fatal: staff fetch failed (e.g. CORS/network hiccup), page still loads
        console.warn('⚠️ Staff fetch failed (non-fatal):', staffErr);
        setStaff([]);
      }
    } catch (err) {
      console.error('❌ Tournament context fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tournament data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🌽 Tournament Context: Fetching data for tournament', tournamentId);
    fetchData();
  }, [tournamentId, user?.id]);

  const isOfficer = user?.role === 'officer' || user?.role === 'owner';
  const isOwner = user?.role === 'owner';

  const value: TournamentContextValue = {
    tournament,
    myRegistration,
    staff,
    isOfficer,
    isOwner,
    user,
    accessToken,
    loading,
    error,
    refetch: fetchData,
  };

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within TournamentProvider');
  }
  return context;
}