import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Save, ArrowRight, Check, X, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getHeroName, getHeroImageUrl, HERO_ID_TO_NAME } from '@/lib/dota-heroes';
import { getItemName, getItemImageUrl, DOTA_ITEMS } from '@/lib/dota-items';
import { Footer } from '@/app/components/footer';

// ============================================================================
// TYPES
// ============================================================================

interface Player {
  id: string;
  steamId: string;
  accountId?: number;
  name?: string; // Fetched from API
  avatar?: string; // Fetched from API
}

interface Team {
  id: string;
  valveTeamId: string;
  name?: string; // Fetched from API
  tag?: string; // Fetched from API
  logo?: string; // Fetched from API
  roster: Player[];
}

interface PlayerMatchStats {
  playerId: string;
  heroId: number | null;
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  gpm: number;
  xpm: number;
  level: number;
  netWorth: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  gold: number;
  item0: number | null;
  item1: number | null;
  item2: number | null;
  item3: number | null;
  item4: number | null;
  item5: number | null;
  observerUses: number;
  sentryUses: number;
}

interface Match {
  id: string;
  matchNumber: number;
  team1Id: string;
  team2Id: string;
  team1Players: PlayerMatchStats[];
  team2Players: PlayerMatchStats[];
  winner: 'team1' | 'team2' | '';
  duration: number; // seconds
  matchDate?: string;
  playoffRound?: string;
  matchId?: string;
}

interface ManualTournamentBuilderProps {
  user: any;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ManualTournamentBuilder({ user }: ManualTournamentBuilderProps) {
  const [step, setStep] = useState(1);
  
  // Step 1: Tournament Info
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentStartDate, setTournamentStartDate] = useState('');
  const [tournamentEndDate, setTournamentEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [prizePool, setPrizePool] = useState('');
  
  // Step 2: Teams Setup
  const [numTeams, setNumTeams] = useState<number | ''>('');
  const [teams, setTeams] = useState<Team[]>([]);
  
  // Step 4: Matches Setup
  const [numMatches, setNumMatches] = useState<number | ''>('');
  const [matches, setMatches] = useState<Match[]>([]);
  
  // Step 5: Match Details
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  
  const [saving, setSaving] = useState(false);

  // ============================================================================
  // STEP 1: Tournament Info
  // ============================================================================
  
  const handleStep1Next = () => {
    if (!tournamentName.trim()) {
      toast.error('Please enter a tournament name');
      return;
    }
    setStep(2);
  };

  // ============================================================================
  // STEP 2: Teams Setup
  // ============================================================================
  
  const handleStep2Init = () => {
    if (!numTeams || numTeams < 2) {
      toast.error('Please enter at least 2 teams');
      return;
    }
    
    const newTeams: Team[] = Array.from({ length: numTeams }, (_, i) => ({
      id: `team-${i + 1}`,
      valveTeamId: '',
      roster: [],
    }));
    setTeams(newTeams);
  };

  const updateTeamValveId = async (teamId: string, valveTeamId: string) => {
    setTeams(teams.map(t => {
      if (t.id === teamId) {
        return { ...t, valveTeamId, name: undefined, tag: undefined, logo: undefined };
      }
      return t;
    }));
  };

  const fetchTeamData = async (teamId: string, valveTeamId: string) => {
    if (!valveTeamId.trim()) return;
    
    try {
      const token = localStorage.getItem('supabase_token');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/dota/team/${valveTeamId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error('Team not found');

      const data = await response.json();
      
      setTeams(teams.map(t => {
        if (t.id === teamId) {
          return {
            ...t,
            name: data.name || 'Unknown Team',
            tag: data.tag,
            logo: data.logo_url,
          };
        }
        return t;
      }));

      toast.success(`Team loaded: ${data.name}`);
    } catch (error) {
      console.error('Failed to fetch team:', error);
      toast.error('Failed to fetch team data');
    }
  };

  const handleStep2Next = () => {
    const emptyTeams = teams.filter(t => !t.valveTeamId.trim());
    if (emptyTeams.length > 0) {
      toast.error('Please fill in all team Valve IDs');
      return;
    }
    setStep(3);
  };

  // ============================================================================
  // STEP 3: Team Rosters
  // ============================================================================
  
  const addPlayerToRoster = (teamId: string) => {
    setTeams(teams.map(t => {
      if (t.id === teamId) {
        return {
          ...t,
          roster: [...t.roster, { id: `player-${Date.now()}-${t.roster.length}`, steamId: '' }]
        };
      }
      return t;
    }));
  };

  const updatePlayerSteamId = (teamId: string, playerId: string, steamId: string) => {
    setTeams(teams.map(t => {
      if (t.id === teamId) {
        return {
          ...t,
          roster: t.roster.map(p => p.id === playerId ? { ...p, steamId, name: undefined, avatar: undefined, accountId: undefined } : p)
        };
      }
      return t;
    }));
  };

  const fetchPlayerData = async (teamId: string, playerId: string, steamId: string) => {
    if (!steamId.trim()) return;
    
    try {
      const token = localStorage.getItem('supabase_token');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/dota/player/${steamId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error('Player not found');

      const data = await response.json();
      
      setTeams(teams.map(t => {
        if (t.id === teamId) {
          return {
            ...t,
            roster: t.roster.map(p => {
              if (p.id === playerId) {
                return {
                  ...p,
                  accountId: data.accountId,
                  name: data.name || 'Unknown Player',
                  avatar: data.avatar,
                };
              }
              return p;
            })
          };
        }
        return t;
      }));

      toast.success(`Player loaded: ${data.name}`);
    } catch (error) {
      console.error('Failed to fetch player:', error);
      toast.error('Failed to fetch player data');
    }
  };

  const removeRosterPlayer = (teamId: string, playerId: string) => {
    setTeams(teams.map(t => {
      if (t.id === teamId) {
        return {
          ...t,
          roster: t.roster.filter(p => p.id !== playerId)
        };
      }
      return t;
    }));
  };

  const handleStep3Next = () => {
    const teamsWithoutPlayers = teams.filter(t => t.roster.length === 0);
    if (teamsWithoutPlayers.length > 0) {
      toast.error('All teams must have at least 1 player');
      return;
    }
    
    const teamsWithEmptyPlayers = teams.filter(t => t.roster.some(p => !p.steamId.trim()));
    if (teamsWithEmptyPlayers.length > 0) {
      toast.error('All players must have Steam IDs');
      return;
    }

    const teamsWithUnloadedPlayers = teams.filter(t => t.roster.some(p => !p.name));
    if (teamsWithUnloadedPlayers.length > 0) {
      toast.error('Please load all player data by clicking "Fetch Player"');
      return;
    }
    
    setStep(4);
  };

  // ============================================================================
  // STEP 4: Matches Setup
  // ============================================================================
  
  const handleStep4Init = () => {
    if (!numMatches || numMatches < 1) {
      toast.error('Please enter at least 1 match');
      return;
    }
    
    const newMatches: Match[] = Array.from({ length: numMatches }, (_, i) => ({
      id: `match-${i + 1}`,
      matchNumber: i + 1,
      team1Id: '',
      team2Id: '',
      team1Players: [],
      team2Players: [],
      winner: '',
      duration: 0,
    }));
    setMatches(newMatches);
  };

  const updateMatchTeams = (matchId: string, team1Id: string, team2Id: string) => {
    setMatches(matches.map(m => m.id === matchId ? { ...m, team1Id, team2Id } : m));
  };

  const handleStep4Next = () => {
    const matchesWithoutTeams = matches.filter(m => !m.team1Id || !m.team2Id);
    if (matchesWithoutTeams.length > 0) {
      toast.error('All matches must have 2 teams assigned');
      return;
    }
    
    const matchesWithSameTeam = matches.filter(m => m.team1Id === m.team2Id);
    if (matchesWithSameTeam.length > 0) {
      toast.error('A team cannot play against itself');
      return;
    }
    
    setCurrentMatchIndex(0);
    setStep(5);
  };

  // ============================================================================
  // STEP 5: Match Details
  // ============================================================================
  
  const currentMatch = matches[currentMatchIndex];
  const team1 = teams.find(t => t.id === currentMatch?.team1Id);
  const team2 = teams.find(t => t.id === currentMatch?.team2Id);

  const createEmptyPlayerStats = (playerId: string): PlayerMatchStats => ({
    playerId,
    heroId: null,
    kills: 0,
    deaths: 0,
    assists: 0,
    lastHits: 0,
    denies: 0,
    gpm: 0,
    xpm: 0,
    level: 1,
    netWorth: 0,
    heroDamage: 0,
    towerDamage: 0,
    heroHealing: 0,
    gold: 0,
    item0: null,
    item1: null,
    item2: null,
    item3: null,
    item4: null,
    item5: null,
    observerUses: 0,
    sentryUses: 0,
  });

  const addPlayerToMatch = (side: 'team1' | 'team2', playerId: string) => {
    const match = matches[currentMatchIndex];
    const playersField = side === 'team1' ? 'team1Players' : 'team2Players';
    
    if (match[playersField].length >= 5) {
      toast.error('Maximum 5 players per team in a match');
      return;
    }
    
    if (match[playersField].some(p => p.playerId === playerId)) {
      toast.error('This player is already in the match');
      return;
    }
    
    const newPlayers = [...match[playersField], createEmptyPlayerStats(playerId)];
    setMatches(matches.map((m, idx) => 
      idx === currentMatchIndex ? { ...m, [playersField]: newPlayers } : m
    ));
  };

  const removePlayerFromMatch = (side: 'team1' | 'team2', playerId: string) => {
    const match = matches[currentMatchIndex];
    const playersField = side === 'team1' ? 'team1Players' : 'team2Players';
    const newPlayers = match[playersField].filter(p => p.playerId !== playerId);
    setMatches(matches.map((m, idx) => 
      idx === currentMatchIndex ? { ...m, [playersField]: newPlayers } : m
    ));
  };

  const updateMatchPlayerStat = (side: 'team1' | 'team2', playerId: string, field: keyof PlayerMatchStats, value: any) => {
    const match = matches[currentMatchIndex];
    const playersField = side === 'team1' ? 'team1Players' : 'team2Players';
    const newPlayers = match[playersField].map(p => 
      p.playerId === playerId ? { ...p, [field]: value } : p
    );
    setMatches(matches.map((m, idx) => 
      idx === currentMatchIndex ? { ...m, [playersField]: newPlayers } : m
    ));
  };

  const updateMatchMetadata = (field: keyof Match, value: any) => {
    setMatches(matches.map((m, idx) => 
      idx === currentMatchIndex ? { ...m, [field]: value } : m
    ));
  };

  const handleMatchNext = () => {
    const match = matches[currentMatchIndex];
    
    if (match.team1Players.length !== 5) {
      toast.error(`${team1?.name} must have exactly 5 players`);
      return;
    }
    
    if (match.team2Players.length !== 5) {
      toast.error(`${team2?.name} must have exactly 5 players`);
      return;
    }
    
    const allPlayers = [...match.team1Players, ...match.team2Players];
    const playersWithoutHeroes = allPlayers.filter(p => !p.heroId);
    if (playersWithoutHeroes.length > 0) {
      toast.error('All players must have a hero selected');
      return;
    }
    
    if (!match.winner) {
      toast.error('Please select a winner');
      return;
    }
    
    if (currentMatchIndex < matches.length - 1) {
      setCurrentMatchIndex(currentMatchIndex + 1);
    } else {
      setStep(6);
    }
  };

  const handleMatchBack = () => {
    if (currentMatchIndex > 0) {
      setCurrentMatchIndex(currentMatchIndex - 1);
    } else {
      setStep(4);
    }
  };

  // ============================================================================
  // STEP 6: Review & Save
  // ============================================================================
  
  const handleSave = async () => {
    setSaving(true);

    try {
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        setSaving(false);
        return;
      }

      const payload = {
        tournamentName,
        tournamentStartDate,
        tournamentEndDate,
        description,
        youtubeUrl,
        prizePool,
        teams: teams.map(t => ({
          name: t.name,
          teamId: t.valveTeamId,
          tag: t.tag,
          logo: t.logo,
          roster: t.roster.map(p => ({
            name: p.name,
            steamId: p.steamId,
            accountId: p.accountId,
          })),
        })),
        matches: matches.map(m => {
          const team1 = teams.find(t => t.id === m.team1Id);
          const team2 = teams.find(t => t.id === m.team2Id);
          
          return {
            matchNumber: m.matchNumber,
            team1Name: team1?.name,
            team2Name: team2?.name,
            team1Id: team1?.valveTeamId,
            team2Id: team2?.valveTeamId,
            winner: m.winner === 'team1' ? 'radiant' : 'dire',
            duration: m.duration,
            matchDate: m.matchDate,
            playoffRound: m.playoffRound,
            matchId: m.matchId,
            team1Players: m.team1Players.map(p => {
              const player = team1?.roster.find(rp => rp.id === p.playerId);
              return {
                name: player?.name,
                steamId: player?.steamId,
                accountId: player?.accountId,
                ...p,
              };
            }),
            team2Players: m.team2Players.map(p => {
              const player = team2?.roster.find(rp => rp.id === p.playerId);
              return {
                name: player?.name,
                steamId: player?.steamId,
                accountId: player?.accountId,
                ...p,
              };
            }),
          };
        }),
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/create-manual-tournament-v2`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const { tournamentId } = await response.json();
      toast.success('Tournament created successfully!');
      
      window.location.hash = `#kkup/${tournamentId}`;
    } catch (error) {
      console.error('Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create tournament';
      toast.error(`Save failed: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#fdf5e9] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#16a34a] to-[#15803d] text-white py-8 px-4 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => window.location.hash = '#profile'}
            className="flex items-center gap-2 text-white/90 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">Back to Profile</span>
          </button>
          
          <h1 className="text-3xl font-bold mb-2">📝 Manual Tournament Builder</h1>
          <p className="text-white/90">
            Full control - manually input all tournament data
          </p>
          
          {/* Progress Indicator */}
          <div className="flex items-center gap-2 mt-6">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  step > s ? 'bg-white text-[#16a34a]' : step === s ? 'bg-white text-[#15803d]' : 'bg-white/30 text-white/70'
                }`}>
                  {step > s ? <Check className="w-5 h-5" /> : s}
                </div>
                {s < 6 && <div className={`w-8 h-1 ${step > s ? 'bg-white' : 'bg-white/30'}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* STEP 1: Tournament Info */}
        {step === 1 && (
          <Step1TournamentInfo
            tournamentName={tournamentName}
            setTournamentName={setTournamentName}
            tournamentStartDate={tournamentStartDate}
            setTournamentStartDate={setTournamentStartDate}
            tournamentEndDate={tournamentEndDate}
            setTournamentEndDate={setTournamentEndDate}
            description={description}
            setDescription={setDescription}
            youtubeUrl={youtubeUrl}
            setYoutubeUrl={setYoutubeUrl}
            prizePool={prizePool}
            setPrizePool={setPrizePool}
            onNext={handleStep1Next}
          />
        )}

        {/* STEP 2: Teams Setup */}
        {step === 2 && (
          <Step2TeamsSetup
            numTeams={numTeams}
            setNumTeams={setNumTeams}
            teams={teams}
            onInit={handleStep2Init}
            onUpdateTeamValveId={updateTeamValveId}
            onFetchTeamData={fetchTeamData}
            onBack={() => setStep(1)}
            onNext={handleStep2Next}
          />
        )}

        {/* STEP 3: Team Rosters */}
        {step === 3 && (
          <Step3TeamRosters
            teams={teams}
            onAddPlayer={addPlayerToRoster}
            onUpdatePlayerSteamId={updatePlayerSteamId}
            onFetchPlayerData={fetchPlayerData}
            onRemovePlayer={removeRosterPlayer}
            onBack={() => setStep(2)}
            onNext={handleStep3Next}
          />
        )}

        {/* STEP 4: Matches Setup */}
        {step === 4 && (
          <Step4MatchesSetup
            numMatches={numMatches}
            setNumMatches={setNumMatches}
            matches={matches}
            teams={teams}
            onInit={handleStep4Init}
            onUpdateMatchTeams={updateMatchTeams}
            onBack={() => setStep(3)}
            onNext={handleStep4Next}
          />
        )}

        {/* STEP 5: Match Details */}
        {step === 5 && currentMatch && team1 && team2 && (
          <Step5MatchDetails
            match={currentMatch}
            matchIndex={currentMatchIndex}
            totalMatches={matches.length}
            team1={team1}
            team2={team2}
            onAddPlayer={addPlayerToMatch}
            onRemovePlayer={removePlayerFromMatch}
            onUpdatePlayerStat={updateMatchPlayerStat}
            onUpdateMetadata={updateMatchMetadata}
            onBack={handleMatchBack}
            onNext={handleMatchNext}
          />
        )}

        {/* STEP 6: Review & Save */}
        {step === 6 && (
          <Step6Review
            tournamentName={tournamentName}
            tournamentStartDate={tournamentStartDate}
            tournamentEndDate={tournamentEndDate}
            description={description}
            youtubeUrl={youtubeUrl}
            prizePool={prizePool}
            teams={teams}
            matches={matches}
            saving={saving}
            onBack={() => {
              setStep(5);
              setCurrentMatchIndex(matches.length - 1);
            }}
            onSave={handleSave}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

function Step1TournamentInfo({
  tournamentName,
  setTournamentName,
  tournamentStartDate,
  setTournamentStartDate,
  tournamentEndDate,
  setTournamentEndDate,
  description,
  setDescription,
  youtubeUrl,
  setYoutubeUrl,
  prizePool,
  setPrizePool,
  onNext,
}: any) {
  return (
    <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6">
      <h2 className="text-2xl font-bold text-[#0f172a] mb-6">Step 1: Tournament Information</h2>
      
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-semibold text-[#0f172a]/70 mb-2">
            Tournament Name *
          </label>
          <input
            type="text"
            value={tournamentName}
            onChange={(e) => setTournamentName(e.target.value)}
            placeholder="e.g., Kernel Kup 3"
            className="w-full px-4 py-3 bg-[#fdf5e9] border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#16a34a] transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#0f172a]/70 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={tournamentStartDate}
              onChange={(e) => setTournamentStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-[#fdf5e9] border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#16a34a] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0f172a]/70 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={tournamentEndDate}
              onChange={(e) => setTournamentEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-[#fdf5e9] border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#16a34a] transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-[#0f172a]/70 mb-2">
              YouTube URL
            </label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/..."
              className="w-full px-4 py-3 bg-[#fdf5e9] border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#16a34a] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0f172a]/70 mb-2">
              Prize Pool
            </label>
            <input
              type="text"
              value={prizePool}
              onChange={(e) => setPrizePool(e.target.value)}
              placeholder="e.g., $10,000"
              className="w-full px-4 py-3 bg-[#fdf5e9] border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#16a34a] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#0f172a]/70 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the tournament..."
            rows={4}
            className="w-full px-4 py-3 bg-[#fdf5e9] border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#16a34a] transition-colors resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white font-bold rounded-xl hover:shadow-lg transition-all"
        >
          Next: Teams Setup
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function Step2TeamsSetup({
  numTeams,
  setNumTeams,
  teams,
  onInit,
  onUpdateTeamValveId,
  onFetchTeamData,
  onBack,
  onNext,
}: any) {
  const initialized = teams.length > 0;

  return (
    <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6">
      <h2 className="text-2xl font-bold text-[#0f172a] mb-6">Step 2: Teams Setup</h2>
      
      {!initialized ? (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-[#0f172a]/70 mb-2">
              How many teams participated?
            </label>
            <input
              type="number"
              min="2"
              value={numTeams}
              onChange={(e) => setNumTeams(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="e.g., 8"
              className="w-full px-4 py-3 bg-[#fdf5e9] border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#16a34a] transition-colors"
            />
          </div>

          <button
            onClick={onInit}
            className="w-full px-6 py-3 bg-[#16a34a] text-white font-bold rounded-xl hover:bg-[#15803d] transition-colors"
          >
            Initialize Teams
          </button>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {teams.map((team: Team, idx: number) => (
            <div key={team.id} className="p-4 bg-[#fdf5e9] rounded-xl border-2 border-[#0f172a]/10">
              <h3 className="font-bold text-[#0f172a] mb-3">Team {idx + 1}</h3>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
                    Valve Team ID *
                  </label>
                  <input
                    type="text"
                    value={team.valveTeamId}
                    onChange={(e) => onUpdateTeamValveId(team.id, e.target.value)}
                    placeholder="e.g., 2163"
                    className="w-full px-3 py-2 bg-white border border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#16a34a] text-sm font-mono"
                  />
                </div>
                <button
                  onClick={() => onFetchTeamData(team.id, team.valveTeamId)}
                  disabled={!team.valveTeamId.trim()}
                  className="mt-5 px-4 py-2 bg-[#16a34a] text-white text-sm font-bold rounded-lg hover:bg-[#15803d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Fetch Team
                </button>
              </div>
              {team.name && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-green-200 flex items-center gap-3">
                  {team.logo && <img src={team.logo} alt={team.name} className="w-10 h-10 rounded" />}
                  <div>
                    <p className="font-bold text-sm text-[#0f172a]">{team.name}</p>
                    {team.tag && <p className="text-xs text-[#0f172a]/60">{team.tag}</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-white border-2 border-[#0f172a]/20 text-[#0f172a] font-bold rounded-xl hover:border-[#0f172a]/40 transition-all"
        >
          Back
        </button>
        {initialized && (
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white font-bold rounded-xl hover:shadow-lg transition-all"
          >
            Next: Team Rosters
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function Step3TeamRosters({
  teams,
  onAddPlayer,
  onUpdatePlayerSteamId,
  onFetchPlayerData,
  onRemovePlayer,
  onBack,
  onNext,
}: any) {
  return (
    <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6">
      <h2 className="text-2xl font-bold text-[#0f172a] mb-2">Step 3: Team Rosters</h2>
      <p className="text-sm text-[#0f172a]/60 mb-6">
        Add all players who played on each team during this tournament
      </p>
      
      <div className="space-y-6 mb-6">
        {teams.map((team: Team) => (
          <div key={team.id} className="p-4 bg-[#fdf5e9] rounded-xl border-2 border-[#0f172a]/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#0f172a]">{team.name || `Team ${team.id}`}</h3>
              <button
                onClick={() => onAddPlayer(team.id)}
                className="flex items-center gap-2 px-3 py-2 bg-[#16a34a] text-white text-sm font-bold rounded-lg hover:bg-[#15803d] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Player
              </button>
            </div>

            {team.roster.length === 0 ? (
              <p className="text-sm text-[#0f172a]/40 text-center py-4">No players yet</p>
            ) : (
              <div className="space-y-2">
                {team.roster.map((player: Player, idx: number) => (
                  <div key={player.id} className="flex items-center gap-2 bg-white p-3 rounded-lg border border-[#0f172a]/10">
                    <span className="text-xs font-bold text-[#0f172a]/40 w-6">{idx + 1}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={player.steamId}
                        onChange={(e) => onUpdatePlayerSteamId(team.id, player.id, e.target.value)}
                        placeholder="Steam ID / Steam32"
                        className="flex-1 px-3 py-2 bg-[#fdf5e9] border border-[#0f172a]/10 rounded text-sm font-mono focus:outline-none focus:border-[#16a34a]"
                      />
                      <button
                        onClick={() => onFetchPlayerData(team.id, player.id, player.steamId)}
                        disabled={!player.steamId.trim()}
                        className="px-3 py-2 bg-[#16a34a] text-white text-xs font-bold rounded hover:bg-[#15803d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        Fetch Player
                      </button>
                    </div>
                    <button
                      onClick={() => onRemovePlayer(team.id, player.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {team.roster.filter((p: Player) => p.name).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#0f172a]/10">
                    <p className="text-xs font-semibold text-[#0f172a]/60 mb-2">Loaded Players:</p>
                    <div className="flex flex-wrap gap-2">
                      {team.roster.filter((p: Player) => p.name).map((player: Player) => (
                        <div key={player.id} className="flex items-center gap-2 px-2 py-1 bg-green-50 border border-green-200 rounded text-xs">
                          {player.avatar && <img src={player.avatar} alt={player.name} className="w-5 h-5 rounded-full" />}
                          <span className="font-semibold text-green-700">{player.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-white border-2 border-[#0f172a]/20 text-[#0f172a] font-bold rounded-xl hover:border-[#0f172a]/40 transition-all"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white font-bold rounded-xl hover:shadow-lg transition-all"
        >
          Next: Matches Setup
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function Step4MatchesSetup({
  numMatches,
  setNumMatches,
  matches,
  teams,
  onInit,
  onUpdateMatchTeams,
  onBack,
  onNext,
}: any) {
  const initialized = matches.length > 0;

  return (
    <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6">
      <h2 className="text-2xl font-bold text-[#0f172a] mb-6">Step 4: Matches Setup</h2>
      
      {!initialized ? (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-[#0f172a]/70 mb-2">
              How many matches were played?
            </label>
            <input
              type="number"
              min="1"
              value={numMatches}
              onChange={(e) => setNumMatches(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="e.g., 15"
              className="w-full px-4 py-3 bg-[#fdf5e9] border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#16a34a] transition-colors"
            />
          </div>

          <button
            onClick={onInit}
            className="w-full px-6 py-3 bg-[#16a34a] text-white font-bold rounded-xl hover:bg-[#15803d] transition-colors"
          >
            Initialize Matches
          </button>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {matches.map((match: Match, idx: number) => (
            <div key={match.id} className="p-4 bg-[#fdf5e9] rounded-xl border-2 border-[#0f172a]/10">
              <h3 className="font-bold text-[#0f172a] mb-3">Match {idx + 1}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
                    Radiant (Team 1) *
                  </label>
                  <select
                    value={match.team1Id}
                    onChange={(e) => onUpdateMatchTeams(match.id, e.target.value, match.team2Id)}
                    className="w-full px-3 py-2 bg-white border border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#16a34a] text-sm"
                  >
                    <option value="">Select team...</option>
                    {teams.map((team: Team) => (
                      <option key={team.id} value={team.id}>{team.name || team.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
                    Dire (Team 2) *
                  </label>
                  <select
                    value={match.team2Id}
                    onChange={(e) => onUpdateMatchTeams(match.id, match.team1Id, e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#16a34a] text-sm"
                  >
                    <option value="">Select team...</option>
                    {teams.map((team: Team) => (
                      <option key={team.id} value={team.id}>{team.name || team.id}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-white border-2 border-[#0f172a]/20 text-[#0f172a] font-bold rounded-xl hover:border-[#0f172a]/40 transition-all"
        >
          Back
        </button>
        {initialized && (
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white font-bold rounded-xl hover:shadow-lg transition-all"
          >
            Next: Match Details
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function Step5MatchDetails({
  match,
  matchIndex,
  totalMatches,
  team1,
  team2,
  onAddPlayer,
  onRemovePlayer,
  onUpdatePlayerStat,
  onUpdateMetadata,
  onBack,
  onNext,
}: any) {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Match Header */}
      <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-[#0f172a]">
            Match {matchIndex + 1} of {totalMatches}
          </h2>
          <span className="text-sm text-[#0f172a]/60 font-semibold">
            {team1.name} vs {team2.name}
          </span>
        </div>

        {/* Match Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
              Winner *
            </label>
            <select
              value={match.winner}
              onChange={(e) => onUpdateMetadata('winner', e.target.value)}
              className="w-full px-3 py-2 bg-[#fdf5e9] border border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#16a34a] text-sm"
            >
              <option value="">Select winner...</option>
              <option value="team1">{team1.name} (Radiant)</option>
              <option value="team2">{team2.name} (Dire)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
              Duration (seconds)
            </label>
            <input
              type="number"
              value={match.duration || ''}
              onChange={(e) => onUpdateMetadata('duration', parseInt(e.target.value || '0'))}
              placeholder="e.g., 2700"
              className="w-full px-3 py-2 bg-[#fdf5e9] border border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#16a34a] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
              Match Date
            </label>
            <input
              type="date"
              value={match.matchDate || ''}
              onChange={(e) => onUpdateMetadata('matchDate', e.target.value)}
              className="w-full px-3 py-2 bg-[#fdf5e9] border border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#16a34a] text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
              Playoff Round
            </label>
            <input
              type="text"
              value={match.playoffRound || ''}
              onChange={(e) => onUpdateMetadata('playoffRound', e.target.value)}
              placeholder="e.g., Grand Finals"
              className="w-full px-3 py-2 bg-[#fdf5e9] border border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#16a34a] text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
              Match ID (OpenDota/Valve)
            </label>
            <input
              type="text"
              value={match.matchId || ''}
              onChange={(e) => onUpdateMetadata('matchId', e.target.value)}
              placeholder="e.g., 7234567890"
              className="w-full px-3 py-2 bg-[#fdf5e9] border border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#16a34a] text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {/* Team 1 Players (Radiant) */}
      <MatchTeamPlayers
        team={team1}
        teamLabel="Radiant"
        teamColor="green"
        players={match.team1Players}
        roster={team1.roster}
        expandedPlayer={expandedPlayer}
        setExpandedPlayer={setExpandedPlayer}
        onAddPlayer={(playerId: string) => onAddPlayer('team1', playerId)}
        onRemovePlayer={(playerId: string) => onRemovePlayer('team1', playerId)}
        onUpdateStat={(playerId: string, field: string, value: any) => onUpdatePlayerStat('team1', playerId, field, value)}
      />

      {/* Team 2 Players (Dire) */}
      <MatchTeamPlayers
        team={team2}
        teamLabel="Dire"
        teamColor="red"
        players={match.team2Players}
        roster={team2.roster}
        expandedPlayer={expandedPlayer}
        setExpandedPlayer={setExpandedPlayer}
        onAddPlayer={(playerId: string) => onAddPlayer('team2', playerId)}
        onRemovePlayer={(playerId: string) => onRemovePlayer('team2', playerId)}
        onUpdateStat={(playerId: string, field: string, value: any) => onUpdatePlayerStat('team2', playerId, field, value)}
      />

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-white border-2 border-[#0f172a]/20 text-[#0f172a] font-bold rounded-xl hover:border-[#0f172a]/40 transition-all"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white font-bold rounded-xl hover:shadow-lg transition-all"
        >
          {matchIndex < totalMatches - 1 ? 'Next Match' : 'Review & Save'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function MatchTeamPlayers({
  team,
  teamLabel,
  teamColor,
  players,
  roster,
  expandedPlayer,
  setExpandedPlayer,
  onAddPlayer,
  onRemovePlayer,
  onUpdateStat,
}: any) {
  const availablePlayers = roster.filter(
    (p: Player) => !players.some((mp: PlayerMatchStats) => mp.playerId === p.id)
  );

  return (
    <div className={`bg-white rounded-2xl border-2 ${teamColor === 'green' ? 'border-green-200' : 'border-red-200'} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-xl font-bold ${teamColor === 'green' ? 'text-green-700' : 'text-red-700'}`}>
          {team.name} - {teamLabel} ({players.length}/5)
        </h3>

        {players.length < 5 && availablePlayers.length > 0 && (
          <select
            onChange={(e) => {
              if (e.target.value) {
                onAddPlayer(e.target.value);
                e.target.value = '';
              }
            }}
            className={`px-3 py-2 text-sm font-bold rounded-lg ${
              teamColor === 'green' 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-red-500 hover:bg-red-600'
            } text-white focus:outline-none`}
          >
            <option value="">+ Add Player</option>
            {availablePlayers.map((p: Player) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {players.length === 0 ? (
        <p className="text-center text-[#0f172a]/40 py-8">No players selected</p>
      ) : (
        <div className="space-y-3">
          {players.map((playerStats: PlayerMatchStats) => {
            const rosterPlayer = roster.find((p: Player) => p.id === playerStats.playerId);
            const isExpanded = expandedPlayer === playerStats.playerId;

            return (
              <PlayerStatsForm
                key={playerStats.playerId}
                player={rosterPlayer}
                stats={playerStats}
                isExpanded={isExpanded}
                onToggleExpand={() => setExpandedPlayer(isExpanded ? null : playerStats.playerId)}
                onRemove={() => onRemovePlayer(playerStats.playerId)}
                onUpdateStat={(field: string, value: any) => onUpdateStat(playerStats.playerId, field, value)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlayerStatsForm({
  player,
  stats,
  isExpanded,
  onToggleExpand,
  onRemove,
  onUpdateStat,
}: any) {
  return (
    <div className="bg-[#fdf5e9] rounded-lg p-4 border border-[#0f172a]/10">
      {/* Player Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {player.avatar && <img src={player.avatar} alt={player.name} className="w-6 h-6 rounded-full" />}
          <span className="font-bold text-[#0f172a]">{player.name || 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleExpand}
            className="text-xs text-[#16a34a] hover:underline font-semibold"
          >
            {isExpanded ? 'Hide Stats' : 'Show All Stats'}
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-red-500 hover:bg-red-50 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hero Picker */}
      <HeroPicker
        heroId={stats.heroId}
        onChange={(heroId: number) => onUpdateStat('heroId', heroId)}
      />

      {/* Basic Stats: K/D/A */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <StatInput label="Kills" value={stats.kills} onChange={(v: number) => onUpdateStat('kills', v)} />
        <StatInput label="Deaths" value={stats.deaths} onChange={(v: number) => onUpdateStat('deaths', v)} />
        <StatInput label="Assists" value={stats.assists} onChange={(v: number) => onUpdateStat('assists', v)} />
      </div>

      {/* Expanded Stats */}
      {isExpanded && (
        <div className="pt-3 border-t border-[#0f172a]/10 mt-3 space-y-3">
          {/* CS & Economy */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatInput label="Last Hits" value={stats.lastHits} onChange={(v: number) => onUpdateStat('lastHits', v)} />
            <StatInput label="Denies" value={stats.denies} onChange={(v: number) => onUpdateStat('denies', v)} />
            <StatInput label="GPM" value={stats.gpm} onChange={(v: number) => onUpdateStat('gpm', v)} />
            <StatInput label="XPM" value={stats.xpm} onChange={(v: number) => onUpdateStat('xpm', v)} />
          </div>

          {/* Level, Net Worth, Gold */}
          <div className="grid grid-cols-3 gap-2">
            <StatInput label="Level" value={stats.level} onChange={(v: number) => onUpdateStat('level', v)} />
            <StatInput label="Net Worth" value={stats.netWorth} onChange={(v: number) => onUpdateStat('netWorth', v)} />
            <StatInput label="Gold" value={stats.gold} onChange={(v: number) => onUpdateStat('gold', v)} />
          </div>

          {/* Damage & Healing */}
          <div className="grid grid-cols-3 gap-2">
            <StatInput label="Hero Damage" value={stats.heroDamage} onChange={(v: number) => onUpdateStat('heroDamage', v)} />
            <StatInput label="Tower Damage" value={stats.towerDamage} onChange={(v: number) => onUpdateStat('towerDamage', v)} />
            <StatInput label="Hero Healing" value={stats.heroHealing} onChange={(v: number) => onUpdateStat('heroHealing', v)} />
          </div>

          {/* Wards */}
          <div className="grid grid-cols-2 gap-2">
            <StatInput label="Observer Wards" value={stats.observerUses} onChange={(v: number) => onUpdateStat('observerUses', v)} />
            <StatInput label="Sentry Wards" value={stats.sentryUses} onChange={(v: number) => onUpdateStat('sentryUses', v)} />
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-[#0f172a]/60 mb-2">Items</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <ItemPicker
                  key={idx}
                  itemId={(stats as any)[`item${idx}`]}
                  onChange={(itemId: number | null) => onUpdateStat(`item${idx}`, itemId)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-full px-2 py-1.5 bg-white border border-[#0f172a]/10 rounded text-sm focus:outline-none focus:border-[#16a34a]"
      />
    </div>
  );
}

function HeroPicker({ heroId, onChange }: { heroId: number | null; onChange: (heroId: number) => void }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const heroes = Object.entries(HERO_ID_TO_NAME).map(([id, name]) => ({
    id: parseInt(id),
    name,
  }));

  const filteredHeroes = search
    ? heroes.filter(h => h.name.toLowerCase().includes(search.toLowerCase()))
    : heroes;

  const selectedHero = heroId ? heroes.find(h => h.id === heroId) : null;

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">Hero *</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-[#0f172a]/10 rounded-lg cursor-pointer hover:border-[#16a34a] transition-colors"
      >
        {selectedHero ? (
          <>
            <img src={getHeroImageUrl(selectedHero.id)} alt={selectedHero.name} className="w-8 h-8 rounded" />
            <span className="text-sm font-semibold text-[#0f172a]">{selectedHero.name}</span>
          </>
        ) : (
          <span className="text-sm text-[#0f172a]/40">Select a hero...</span>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border-2 border-[#0f172a]/20 rounded-lg shadow-xl max-h-80 flex flex-col">
          <div className="p-2 border-b border-[#0f172a]/10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0f172a]/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search heroes..."
                className="w-full pl-8 pr-3 py-2 bg-[#fdf5e9] border border-[#0f172a]/10 rounded text-sm focus:outline-none focus:border-[#16a34a]"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto">
            {filteredHeroes.map(hero => (
              <div
                key={hero.id}
                onClick={() => {
                  onChange(hero.id);
                  setIsOpen(false);
                  setSearch('');
                }}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[#fdf5e9] cursor-pointer transition-colors"
              >
                <img src={getHeroImageUrl(hero.id)} alt={hero.name} className="w-6 h-6 rounded" />
                <span className="text-sm text-[#0f172a]">{hero.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            setSearch('');
          }}
        />
      )}
    </div>
  );
}

function ItemPicker({ itemId, onChange }: { itemId: number | null; onChange: (itemId: number | null) => void }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredItems = search
    ? DOTA_ITEMS.filter(item => item.displayName.toLowerCase().includes(search.toLowerCase()))
    : DOTA_ITEMS;

  const selectedItem = itemId ? DOTA_ITEMS.find(i => i.id === itemId) : null;

  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 bg-white border border-[#0f172a]/10 rounded-lg cursor-pointer hover:border-[#16a34a] transition-colors flex items-center justify-center overflow-hidden"
      >
        {selectedItem ? (
          <img src={getItemImageUrl(selectedItem.id)} alt={selectedItem.displayName} className="w-full h-full object-contain" />
        ) : (
          <span className="text-xs text-[#0f172a]/30">+</span>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white border-2 border-[#0f172a]/20 rounded-lg shadow-xl max-h-80 flex flex-col">
          <div className="p-2 border-b border-[#0f172a]/10">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#0f172a]/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full pl-7 pr-2 py-1.5 bg-[#fdf5e9] border border-[#0f172a]/10 rounded text-xs focus:outline-none focus:border-[#16a34a]"
                autoFocus
              />
            </div>
            {itemId && (
              <button
                onClick={() => {
                  onChange(null);
                  setIsOpen(false);
                  setSearch('');
                }}
                className="w-full mt-1 px-2 py-1 bg-red-50 text-red-600 text-xs font-semibold rounded hover:bg-red-100 transition-colors"
              >
                Clear Item
              </button>
            )}
          </div>
          <div className="overflow-y-auto">
            {filteredItems.map(item => (
              <div
                key={item.id}
                onClick={() => {
                  onChange(item.id);
                  setIsOpen(false);
                  setSearch('');
                }}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#fdf5e9] cursor-pointer transition-colors"
              >
                <img src={getItemImageUrl(item.id)} alt={item.displayName} className="w-8 h-8" />
                <span className="text-xs text-[#0f172a]">{item.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            setSearch('');
          }}
        />
      )}
    </div>
  );
}

function Step6Review({
  tournamentName,
  tournamentStartDate,
  tournamentEndDate,
  description,
  youtubeUrl,
  prizePool,
  teams,
  matches,
  saving,
  onBack,
  onSave,
}: any) {
  return (
    <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6">
      <h2 className="text-2xl font-bold text-[#0f172a] mb-6">Review & Save</h2>

      {/* Tournament Summary */}
      <div className="mb-6 p-4 bg-[#fdf5e9] rounded-xl">
        <h3 className="font-bold text-[#0f172a] mb-2">Tournament</h3>
        <p className="text-sm text-[#0f172a]/70"><strong>Name:</strong> {tournamentName}</p>
        {tournamentStartDate && <p className="text-sm text-[#0f172a]/70"><strong>Start Date:</strong> {tournamentStartDate}</p>}
        {tournamentEndDate && <p className="text-sm text-[#0f172a]/70"><strong>End Date:</strong> {tournamentEndDate}</p>}
        {youtubeUrl && <p className="text-sm text-[#0f172a]/70"><strong>YouTube:</strong> {youtubeUrl}</p>}
        {prizePool && <p className="text-sm text-[#0f172a]/70"><strong>Prize Pool:</strong> {prizePool}</p>}
        {description && <p className="text-sm text-[#0f172a]/70"><strong>Description:</strong> {description}</p>}
      </div>

      {/* Teams Summary */}
      <div className="mb-6 p-4 bg-[#fdf5e9] rounded-xl">
        <h3 className="font-bold text-[#0f172a] mb-2">Teams ({teams.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {teams.map((team: Team) => (
            <div key={team.id} className="text-sm">
              <span className="font-semibold">{team.name}</span> - {team.roster.length} players
            </div>
          ))}
        </div>
      </div>

      {/* Matches Summary */}
      <div className="mb-6 p-4 bg-[#fdf5e9] rounded-xl">
        <h3 className="font-bold text-[#0f172a] mb-2">Matches ({matches.length})</h3>
        <div className="space-y-1">
          {matches.map((match: Match, idx: number) => {
            const team1 = teams.find((t: Team) => t.id === match.team1Id);
            const team2 = teams.find((t: Team) => t.id === match.team2Id);
            return (
              <div key={match.id} className="text-sm flex items-center justify-between">
                <span>
                  <strong>Match {idx + 1}:</strong> {team1?.name} vs {team2?.name}
                </span>
                <span className="text-[#0f172a]/60">
                  {match.winner === 'team1' ? team1?.name : team2?.name} wins
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-white border-2 border-[#0f172a]/20 text-[#0f172a] font-bold rounded-xl hover:border-[#0f172a]/40 transition-all"
          disabled={saving}
        >
          Back
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Tournament...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Create Tournament
            </>
          )}
        </button>
      </div>
    </div>
  );
}
