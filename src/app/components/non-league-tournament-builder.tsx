import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Search, AlertCircle, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Footer } from '@/app/components/footer';

interface Team {
  id: string;
  name: string;
  teamId: string; // Optional Dota team ID
  playerIds: string[];
}

interface Match {
  id: string;
  matchId: string; // Optional - can be empty for search
  team1Id: string; // References Team.id in our form
  team2Id: string; // References Team.id in our form
}

interface SearchResult {
  found: any[];
  uncertain: any[];
  missing: any[];
  pending?: any[]; // For matches still being parsed
}

interface ParseRequest {
  requestId: string;
  totalMatches: number;
  parseJobs: any[];
  message: string;
}

interface NonLeagueTournamentBuilderProps {
  user: any;
}

export function NonLeagueTournamentBuilder({ user }: NonLeagueTournamentBuilderProps) {
  // Tournament metadata
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentDate, setTournamentDate] = useState('');
  
  // Form configuration
  const [numTeams, setNumTeams] = useState(4);
  const [numMatches, setNumMatches] = useState(7);
  
  // Dynamic data
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  
  // Search state
  const [searching, setSearching] = useState(false);
  const [parseRequest, setParseRequest] = useState<ParseRequest | null>(null);
  const [checking, setChecking] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [importing, setImporting] = useState(false);

  // Initialize teams when numTeams changes
  const handleNumTeamsChange = (num: number) => {
    setNumTeams(num);
    const newTeams: Team[] = Array.from({ length: num }, (_, i) => ({
      id: `team-${i}`,
      name: teams[i]?.name || '',
      teamId: teams[i]?.teamId || '',
      playerIds: teams[i]?.playerIds || [''],
    }));
    setTeams(newTeams);
  };

  // Initialize matches when numMatches changes
  const handleNumMatchesChange = (num: number) => {
    setNumMatches(num);
    const newMatches: Match[] = Array.from({ length: num }, (_, i) => ({
      id: `match-${i}`,
      matchId: matches[i]?.matchId || '',
      team1Id: matches[i]?.team1Id || '',
      team2Id: matches[i]?.team2Id || '',
    }));
    setMatches(newMatches);
  };

  // Team management
  const updateTeam = (teamId: string, field: keyof Team, value: any) => {
    setTeams(teams.map(t => t.id === teamId ? { ...t, [field]: value } : t));
  };

  const addPlayerToTeam = (teamId: string) => {
    setTeams(teams.map(t => 
      t.id === teamId ? { ...t, playerIds: [...t.playerIds, ''] } : t
    ));
  };

  const removePlayerFromTeam = (teamId: string, playerIndex: number) => {
    setTeams(teams.map(t => 
      t.id === teamId ? { 
        ...t, 
        playerIds: t.playerIds.filter((_, i) => i !== playerIndex) 
      } : t
    ));
  };

  const updatePlayerInTeam = (teamId: string, playerIndex: number, value: string) => {
    setTeams(teams.map(t => 
      t.id === teamId ? {
        ...t,
        playerIds: t.playerIds.map((p, i) => i === playerIndex ? value : p)
      } : t
    ));
  };

  // Match management
  const updateMatch = (matchId: string, field: keyof Match, value: string) => {
    setMatches(matches.map(m => m.id === matchId ? { ...m, [field]: value } : m));
  };

  // Search and build tournament
  const handleSearch = async () => {
    if (!tournamentName.trim()) {
      toast.error('Please enter a tournament name');
      return;
    }
    if (!tournamentDate) {
      toast.error('Please enter a tournament date');
      return;
    }

    // Validate at least some data is provided
    const hasTeamData = teams.some(t => t.name || t.teamId || t.playerIds.some(p => p.trim()));
    const hasMatchData = matches.some(m => m.matchId || m.team1Id || m.team2Id);
    
    if (!hasTeamData && !hasMatchData) {
      toast.error('Please provide at least some team or match data');
      return;
    }

    // Validate matches have teams selected
    const invalidMatches = matches.filter(m => !m.team1Id || !m.team2Id);
    if (invalidMatches.length > 0) {
      toast.error(`Please select teams for all matches (${invalidMatches.length} match${invalidMatches.length > 1 ? 'es' : ''} missing team selections)`);
      return;
    }

    setSearching(true);

    try {
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        setSearching(false);
        return;
      }

      // Phase 1: Request parse jobs
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/request-non-league-parse`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tournamentName,
            tournamentDate,
            teams: teams.map(t => ({
              id: t.id,
              name: t.name,
              teamId: t.teamId,
              playerIds: t.playerIds.filter(p => p.trim()),
            })),
            matches: matches.map(m => ({
              matchId: m.matchId,
              team1Id: m.team1Id,
              team2Id: m.team2Id,
            })),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const parseRequestData = await response.json();
      setParseRequest(parseRequestData);
      
      toast.success(`Parse jobs submitted! ${parseRequestData.totalMatches} matches queued for processing. Check status in 2-3 minutes.`);
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to search for tournament data';
      toast.error(`Search failed: ${errorMessage}`);
    } finally {
      setSearching(false);
    }
  };

  // Phase 2: Check status of parse jobs
  const handleCheckStatus = async () => {
    if (!parseRequest) return;

    setChecking(true);

    try {
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        setChecking(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/check-non-league-status/${parseRequest.requestId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const results = await response.json();
      setSearchResults(results);
      
      const foundCount = results.found?.length || 0;
      const uncertainCount = results.uncertain?.length || 0;
      const missingCount = results.missing?.length || 0;
      const pendingCount = results.pending?.length || 0;
      
      if (pendingCount > 0) {
        toast.warning(`${pendingCount} match${pendingCount > 1 ? 'es' : ''} still processing. Wait a bit longer and check again.`);
      } else if (foundCount > 0) {
        toast.success(`All done! Found ${foundCount} match${foundCount > 1 ? 'es' : ''} with high confidence`);
        setParseRequest(null); // Clear parse request
      } else if (uncertainCount > 0) {
        toast.warning(`Processing complete. Found ${uncertainCount} uncertain match${uncertainCount > 1 ? 'es' : ''} - please review carefully`);
        setParseRequest(null);
      } else {
        toast.error(`No matches found. ${missingCount} match${missingCount > 1 ? 'es' : ''} could not be located.`);
        setParseRequest(null);
      }
    } catch (error) {
      console.error('Check status error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to check parse status';
      toast.error(`Status check failed: ${errorMessage}`);
    } finally {
      setChecking(false);
    }
  };

  // Import tournament
  const handleImport = async () => {
    if (!searchResults) return;

    setImporting(true);

    try {
      const token = localStorage.getItem('supabase_token');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/import-non-league`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tournamentName,
            tournamentDate,
            searchResults,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const { tournamentId } = await response.json();
      toast.success('Tournament imported successfully!');
      window.location.hash = `#kkup/${tournamentId}`;
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to import tournament');
    } finally {
      setImporting(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    // Updated thresholds: 80-100 excellent, 50-79 great, 20-49 partial, 0-19 low
    if (confidence >= 80) {
      return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">EXCELLENT {confidence}%</span>;
    } else if (confidence >= 50) {
      return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">GREAT {confidence}%</span>;
    } else if (confidence >= 20) {
      return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">PARTIAL {confidence}%</span>;
    } else {
      return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">LOW {confidence}%</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf5e9] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white py-8 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => window.location.hash = '#profile'}
            className="flex items-center gap-2 text-white/90 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">Back to Profile</span>
          </button>
          
          <h1 className="text-3xl font-bold mb-2">🔧 Non-League Tournament Builder</h1>
          <p className="text-white/90">
            Build tournament pages for in-house events without League IDs
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {!searchResults ? (
          <>
            {/* Parse Request Status */}
            {parseRequest && (
              <div className="bg-orange-50 border-2 border-[#f97316] rounded-2xl p-6 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#f97316] text-white flex items-center justify-center flex-shrink-0 font-bold text-lg animate-pulse">
                    ⏳
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-[#0f172a] mb-2">⏳ Processing Matches...</h3>
                    <p className="text-sm text-[#0f172a]/70 mb-3">
                      {parseRequest.totalMatches} match{parseRequest.totalMatches > 1 ? 'es' : ''} submitted for parsing. 
                      Old matches may take 2-3 minutes to parse from the Dota API.
                    </p>
                    <div className="space-y-2 mb-4">
                      {parseRequest.parseJobs.map((job: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-[#0f172a]/60">Match {idx + 1}:</span>
                          <span className="font-semibold">{job.team1Name} vs {job.team2Name}</span>
                          {job.status === 'parsing' && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold">PARSING</span>
                          )}
                          {job.status === 'search-required' && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-bold">SEARCH</span>
                          )}
                          {job.status === 'error' && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">ERROR</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleCheckStatus}
                      disabled={checking}
                      className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white font-bold rounded-lg hover:bg-[#ea580c] transition-colors disabled:opacity-50"
                    >
                      {checking ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          🔄 Check Status
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0 font-bold text-lg">
                  💡
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#0f172a] mb-2">How This Works</h3>
                  <ul className="text-sm text-[#0f172a]/70 space-y-1 list-disc list-inside">
                    <li><strong>Step 1:</strong> Fill in tournament name and date</li>
                    <li><strong>Step 2:</strong> Configure number of teams and matches</li>
                    <li><strong>Step 3:</strong> Add team names and player Steam IDs (Steam32 or Steam64)</li>
                    <li><strong>Step 4:</strong> Link matches to teams (add match IDs if you have them)</li>
                    <li><strong>Step 5:</strong> Click "Search" - we'll find matches using player histories and date ranges (±2 days)</li>
                    <li><strong>Step 6:</strong> Review results and import the tournament</li>
                  </ul>
                  <p className="text-xs text-[#0f172a]/60 mt-3">
                    💡 <strong>Tip:</strong> Providing match IDs gives 100% accuracy. Without them, we'll search player histories within ±2 days of the tournament date.
                  </p>
                </div>
              </div>
            </div>

            {/* Tournament Metadata */}
            <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6 mb-6">
              <h2 className="text-xl font-bold text-[#0f172a] mb-4">📋 Tournament Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0f172a]/70 mb-2">
                    Tournament Name *
                  </label>
                  <input
                    type="text"
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    placeholder="e.g., Kernel Kup 3"
                    className="w-full px-4 py-3 bg-[#fdf5e9] border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#0f172a]/70 mb-2">
                    Tournament Date *
                  </label>
                  <input
                    type="date"
                    value={tournamentDate}
                    onChange={(e) => setTournamentDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[#fdf5e9] border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6 mb-6">
              <h2 className="text-xl font-bold text-[#0f172a] mb-4">⚙️ Tournament Structure</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0f172a]/70 mb-2">
                    Number of Teams
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="16"
                    value={numTeams}
                    onChange={(e) => handleNumTeamsChange(parseInt(e.target.value) || 2)}
                    className="w-full px-4 py-3 bg-[#fdf5e9] border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#0f172a]/70 mb-2">
                    Number of Matches
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={numMatches}
                    onChange={(e) => handleNumMatchesChange(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-3 bg-[#fdf5e9] border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#f97316] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Teams Section */}
            <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6 mb-6">
              <h2 className="text-xl font-bold text-[#0f172a] mb-4">👥 Teams & Players</h2>
              
              <div className="space-y-6">
                {teams.map((team, teamIndex) => (
                  <div key={team.id} className="bg-[#fdf5e9] rounded-xl p-4 border-2 border-[#f97316]/20">
                    <h3 className="font-bold text-[#0f172a] mb-3">
                      Team {teamIndex + 1}
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
                          Team Name
                        </label>
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => updateTeam(team.id, 'name', e.target.value)}
                          placeholder="e.g., Staff Infection"
                          className="w-full px-3 py-2 bg-white border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
                          Dota Team ID (optional)
                        </label>
                        <input
                          type="text"
                          value={team.teamId}
                          onChange={(e) => updateTeam(team.id, 'teamId', e.target.value)}
                          placeholder="e.g., 9239539"
                          className="w-full px-3 py-2 bg-white border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-sm"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-semibold text-[#0f172a]/60">
                            Player IDs (Steam64 or Steam32)
                          </label>
                          <button
                            onClick={() => addPlayerToTeam(team.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-[#f97316] text-white text-xs font-semibold rounded-lg hover:bg-[#ea580c] transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            Add Player
                          </button>
                        </div>

                        <div className="space-y-2">
                          {team.playerIds.map((playerId, playerIndex) => (
                            <div key={playerIndex} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={playerId}
                                onChange={(e) => updatePlayerInTeam(team.id, playerIndex, e.target.value)}
                                placeholder="e.g., 76561197993112314"
                                className="flex-1 px-3 py-2 bg-white border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-sm font-mono"
                              />
                              {team.playerIds.length > 1 && (
                                <button
                                  onClick={() => removePlayerFromTeam(team.id, playerIndex)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Matches Section */}
            <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6 mb-6">
              <h2 className="text-xl font-bold text-[#0f172a] mb-4">🎮 Matches</h2>
              
              <div className="space-y-4">
                {matches.map((match, matchIndex) => (
                  <div key={match.id} className="bg-[#fdf5e9] rounded-xl p-4 border-2 border-[#f97316]/20">
                    <h3 className="font-bold text-[#0f172a] mb-3">
                      Match {matchIndex + 1}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
                          Match ID (optional)
                        </label>
                        <input
                          type="text"
                          value={match.matchId}
                          onChange={(e) => updateMatch(match.id, 'matchId', e.target.value)}
                          placeholder="e.g., 7468018330"
                          className="w-full px-3 py-2 bg-white border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-sm font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
                          Team 1
                        </label>
                        <select
                          value={match.team1Id}
                          onChange={(e) => updateMatch(match.id, 'team1Id', e.target.value)}
                          className="w-full px-3 py-2 bg-white border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-sm"
                        >
                          <option value="">Select team...</option>
                          {teams.map((team, idx) => (
                            <option key={team.id} value={team.id}>
                              {team.name || `Team ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#0f172a]/60 mb-1">
                          Team 2
                        </label>
                        <select
                          value={match.team2Id}
                          onChange={(e) => updateMatch(match.id, 'team2Id', e.target.value)}
                          className="w-full px-3 py-2 bg-white border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-sm"
                        >
                          <option value="">Select team...</option>
                          {teams.map((team, idx) => (
                            <option key={team.id} value={team.id}>
                              {team.name || `Team ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Search Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSearch}
                disabled={searching}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searching ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Search & Build Tournament
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          // Results Display
          <div className="space-y-6">
            {/* Found Matches */}
            {searchResults.found.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-green-200 p-6">
                <h2 className="text-xl font-bold text-[#0f172a] mb-4 flex items-center gap-2">
                  ✅ Found Matches ({searchResults.found.length})
                </h2>
                <div className="space-y-3">
                  {searchResults.found.map((result: any, idx: number) => (
                    <div key={idx} className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-mono text-sm font-bold text-[#0f172a]">
                            Match ID: {result.matchId}
                          </p>
                          <p className="text-xs text-[#0f172a]/60 mt-1">
                            {result.radiantName} vs {result.direName}
                          </p>
                        </div>
                        {getConfidenceBadge(result.confidence)}
                      </div>
                      {result.source && (
                        <p className="text-xs text-[#0f172a]/50 mt-2">
                          Source: {result.source}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Uncertain Matches */}
            {searchResults.uncertain.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-yellow-200 p-6">
                <h2 className="text-xl font-bold text-[#0f172a] mb-4 flex items-center gap-2">
                  ⚠️ Uncertain Matches ({searchResults.uncertain.length})
                  <span className="text-sm font-normal text-[#0f172a]/60">- Review carefully</span>
                </h2>
                <div className="space-y-3">
                  {searchResults.uncertain.map((result: any, idx: number) => (
                    <div key={idx} className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-bold text-sm text-[#0f172a] mb-1">
                            Multiple matches found - Top 3 results:
                          </p>
                          {result.matches?.slice(0, 3).map((match: any, mIdx: number) => (
                            <div key={mIdx} className="ml-4 mt-2 p-2 bg-white rounded border border-yellow-300">
                              <p className="font-mono text-xs font-bold">Match ID: {match.matchId}</p>
                              <p className="text-xs text-[#0f172a]/60">{match.radiantName} vs {match.direName}</p>
                              <div className="mt-1">{getConfidenceBadge(match.confidence)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-[#0f172a]/50 mt-2">
                        Search criteria: {result.searchCriteria}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Matches */}
            {searchResults.pending && searchResults.pending.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-blue-200 p-6">
                <h2 className="text-xl font-bold text-[#0f172a] mb-4 flex items-center gap-2">
                  ⏳ Still Processing ({searchResults.pending.length})
                  <span className="text-sm font-normal text-[#0f172a]/60">- Check again in a minute</span>
                </h2>
                <div className="space-y-3">
                  {searchResults.pending.map((result: any, idx: number) => (
                    <div key={idx} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono text-sm font-bold text-[#0f172a]">
                            Match ID: {result.matchId}
                          </p>
                          <p className="text-xs text-[#0f172a]/60 mt-1">
                            {result.team1Name} vs {result.team2Name}
                          </p>
                          <p className="text-xs text-[#0f172a]/50 mt-2">
                            Status: {result.status === 'parsing' ? '🔄 OpenDota is parsing this match' : '⚠️ Processing'}
                          </p>
                        </div>
                        <div className="animate-pulse">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">PENDING</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleCheckStatus}
                    disabled={checking}
                    className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white font-bold rounded-lg hover:bg-[#ea580c] transition-colors disabled:opacity-50"
                  >
                    {checking ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        🔄 Check Again
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Missing Matches */}
            {searchResults.missing.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-red-200 p-6">
                <h2 className="text-xl font-bold text-[#0f172a] mb-4 flex items-center gap-2">
                  ❌ Unable to Find ({searchResults.missing.length})
                </h2>
                <div className="space-y-3">
                  {searchResults.missing.map((result: any, idx: number) => (
                    <div key={idx} className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-bold text-sm text-[#0f172a] mb-1">
                            Match #{idx + 1}
                          </p>
                          <p className="text-xs text-[#0f172a]/60 mb-2">
                            No matches found matching the provided criteria
                          </p>
                          <div className="text-xs text-[#0f172a]/50 space-y-1">
                            {result.searchCriteria && (
                              <p>• Searched with: {result.searchCriteria}</p>
                            )}
                            {result.dateRange && (
                              <p>• Date range: {result.dateRange}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => {
                  setSearchResults(null);
                  toast.info('Starting over - you can modify the form and search again');
                }}
                className="px-6 py-3 bg-white border-2 border-[#0f172a]/20 text-[#0f172a] font-bold rounded-xl hover:border-[#0f172a]/40 transition-all"
              >
                ← Start Over
              </button>

              <button
                onClick={handleImport}
                disabled={importing || searchResults.found.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Accept & Import Tournament
                  </>
                )}
              </button>
            </div>

            {searchResults.found.length === 0 && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                <p className="text-sm text-[#0f172a]/70 text-center">
                  ⚠️ No matches were found with high confidence. Please review the results and consider starting over with different data.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}