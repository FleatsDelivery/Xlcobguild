import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { TournamentBuilderPreview } from '@/app/components/tournament-builder-preview';
import { Footer } from '@/app/components/footer';

interface TournamentBuilderPageProps {
  user: any;
}

export function TournamentBuilderPage({ user }: TournamentBuilderPageProps) {
  const [formData, setFormData] = useState({
    league_id: '16273', // Default to KKup 5 for reference
    series_id: '2520166',
    match_id: '7616356796',
    team_id: '9359693',
    player_id: '108977424'
  });

  const [isFetching, setIsFetching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['league', 'summary']));
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Tournament metadata for import
  const [tournamentName, setTournamentName] = useState('');
  const [metadata, setMetadata] = useState({
    youtube_playlist_url: '',
    twitch_channel: '',
    prize_pool: '',
    description: ''
  });

  const handleSeedKK1 = async () => {
    if (!confirm('Seed Kernel Kup 1 historical data? This will create the tournament with all teams, players, and match stats.')) {
      return;
    }

    setIsSeeding(true);
    
    try {
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/seed-kernel-kup-1`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const { tournamentId } = await response.json();
      toast.success('Kernel Kup 1 seeded successfully!');
      
      // Redirect to the tournament page
      window.location.hash = `#kkup/${tournamentId}`;
    } catch (error) {
      console.error('Seed error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to seed Kernel Kup 1';
      toast.error(`Seed failed: ${errorMessage}`);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSyncNamesAndLogos = async () => {
    if (!confirm('Update all player names & avatars from Steam, and team logos from kkupassets bucket? This will overwrite existing data.')) {
      return;
    }

    setIsSyncing(true);
    
    try {
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/sync-names-logos`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      toast.success(`✅ Synced ${data.playersUpdated} players and ${data.teamsUpdated} teams!`);
    } catch (error) {
      console.error('Sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync names & logos';
      toast.error(`Sync failed: ${errorMessage}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Check if user is owner
  if (user?.role !== 'owner') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg border-2 border-[#f97316] p-8 text-center">
          <AlertCircle className="mx-auto h-16 w-16 text-[#f97316] mb-4" />
          <h2 className="text-2xl font-bold text-[#0f172a] mb-2">Owner Access Required</h2>
          <p className="text-gray-600">Only the owner can access the Tournament Builder.</p>
        </div>
      </div>
    );
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleFetchData = async () => {
    if (!formData.league_id) {
      toast.error('League ID is required');
      return;
    }

    setIsFetching(true);
    setResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      console.log('🏗️ ============================================');
      console.log('🏗️ TOURNAMENT BUILDER: Fetching Data');
      console.log('🏗️ ============================================');
      console.log('🏗️ Inputs:', {
        league_id: formData.league_id,
        series_id: formData.series_id || 'not provided',
        match_id: formData.match_id || 'not provided',
        team_id: formData.team_id || 'not provided',
        player_id: formData.player_id || 'not provided'
      });

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/fetch-tournament-builder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            league_id: parseInt(formData.league_id),
            series_id: formData.series_id ? parseInt(formData.series_id) : undefined,
            match_id: formData.match_id ? parseInt(formData.match_id) : undefined,
            team_id: formData.team_id ? parseInt(formData.team_id) : undefined,
            player_id: formData.player_id ? parseInt(formData.player_id) : undefined
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tournament data');
      }

      console.log('✅ FETCH SUCCESS');
      console.log('✅ Data Quality:', data.results.summary.dataQuality);
      console.log('✅ Teams:', data.results.summary.totalTeams);
      console.log('✅ Matches:', data.results.summary.totalMatches);
      console.log('✅ Players:', data.results.summary.totalPlayers);
      console.log('🏗️ ============================================');
      setResults(data.results);
      
      // Auto-fill tournament name if league data exists
      if (data.results?.league?.data?.name) {
        setTournamentName(data.results.league.data.name);
      }

      toast.success('Tournament data fetched successfully!');
      
      // Expand summary section
      setExpandedSections(new Set(['league', 'summary', 'recommendations']));
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch tournament data');
    } finally {
      setIsFetching(false);
    }
  };

  const handleImportTournament = async () => {
    if (!tournamentName.trim()) {
      toast.error('Tournament name is required');
      return;
    }

    if (!results?.league?.data) {
      toast.error('No tournament data to import');
      return;
    }

    setIsImporting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      console.log('🏗️ Importing tournament...');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/import-tournament-builder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            tournament_name: tournamentName,
            league_data: results.league.data,
            teams_data: results.teams.data || [],
            matches_data: results.matches.data || [],
            metadata: {
              ...metadata,
              verified_match_id: formData.match_id ? parseInt(formData.match_id) : 0,
              series_id: formData.series_id ? parseInt(formData.series_id) : 0
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import tournament');
      }

      console.log('✅ Tournament imported:', data);
      toast.success(`Tournament created successfully! ${data.stats.teams_created} teams, ${data.stats.matches_created} matches, ${data.stats.players_created} players`);
      
      // Navigate to the tournament page
      setTimeout(() => {
        window.location.hash = `#kkup/${data.tournament_id}`;
      }, 1500);

    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to import tournament');
    } finally {
      setIsImporting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-[#10b981]" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-[#ef4444]" />;
      case 'fetching':
      case 'processing':
        return <Loader2 className="w-5 h-5 text-[#f97316] animate-spin" />;
      default:
        return <div className="w-5 h-5 rounded-full bg-gray-300" />;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          onClick={() => window.location.hash = '#profile'}
          variant="ghost"
          className="mb-4 text-[#0f172a] hover:text-[#f97316]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-[#f97316] to-[#ea580c] rounded-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#0f172a]">🏗️ Tournament Builder</h1>
              <p className="text-sm text-[#0f172a]/60">Import tournaments using League ID with automated data fetching</p>
            </div>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10 mb-6">
        <div className="bg-[#fdf5e9] rounded-lg p-4 border-2 border-[#f97316]/20 mb-4">
          <p className="text-sm font-semibold text-[#0f172a] mb-2">🌽 Default Test Data (Kernel Kup 5):</p>
          <p className="text-xs text-[#0f172a]/70">You can edit these values to fetch data for any tournament. League ID is required, others are optional for verification.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-2">
              League ID <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              value={formData.league_id}
              onChange={(e) => setFormData({ ...formData, league_id: e.target.value })}
              className="w-full px-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:border-[#f97316] focus:outline-none"
              placeholder="e.g., 16273"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-2">
              Series ID <span className="text-[#0f172a]/40">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.series_id}
              onChange={(e) => setFormData({ ...formData, series_id: e.target.value })}
              className="w-full px-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:border-[#f97316] focus:outline-none"
              placeholder="e.g., 2520166"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-2">
              Match ID <span className="text-[#0f172a]/40">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.match_id}
              onChange={(e) => setFormData({ ...formData, match_id: e.target.value })}
              className="w-full px-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:border-[#f97316] focus:outline-none"
              placeholder="e.g., 7616356796"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-2">
              Team ID <span className="text-[#0f172a]/40">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.team_id}
              onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
              className="w-full px-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:border-[#f97316] focus:outline-none"
              placeholder="e.g., 9359693"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-2">
              Player ID <span className="text-[#0f172a]/40">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.player_id}
              onChange={(e) => setFormData({ ...formData, player_id: e.target.value })}
              className="w-full px-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:border-[#f97316] focus:outline-none"
              placeholder="e.g., 108977424"
            />
          </div>
        </div>

        <Button
          onClick={handleFetchData}
          disabled={isFetching || !formData.league_id}
          className="w-full h-auto flex-col items-center p-4 bg-[#f97316] hover:bg-[#ea580c] text-white font-bold"
        >
          {isFetching ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <span>Fetching Tournament Data...</span>
              <span className="text-xs opacity-90 mt-1">This may take a few seconds</span>
            </>
          ) : (
            <>
              <Database className="w-6 h-6 mb-2" />
              <span>🔍 Fetch Complete Tournament Data</span>
              <span className="text-xs opacity-90 mt-1">Combines all Steam Lab tests into one master fetch</span>
            </>
          )}
        </Button>
      </div>

      {/* Results Display */}
      {results && (
        <div className="space-y-4">
          {/* Summary Section */}
          <div className="bg-white rounded-xl shadow-md border-2 border-[#0f172a]/10 overflow-hidden">
            <button
              onClick={() => toggleSection('summary')}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-[#10b981]/10 to-[#059669]/10 hover:from-[#10b981]/20 hover:to-[#059669]/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <TrophyIcon className="w-6 h-6 text-[#10b981]" />
                <h2 className="text-lg font-bold text-[#0f172a]">📊 Quick Summary</h2>
              </div>
              {expandedSections.has('summary') ? (
                <ChevronDown className="w-5 h-5 text-[#0f172a]" />
              ) : (
                <ChevronRight className="w-5 h-5 text-[#0f172a]" />
              )}
            </button>

            {expandedSections.has('summary') && (
              <div className="p-4 border-t-2 border-[#0f172a]/10">
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-[#fdf5e9] rounded-lg p-4 border-2 border-[#f97316]/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-5 h-5 text-[#f97316]" />
                      <span className="text-sm font-semibold text-[#0f172a]">Teams</span>
                    </div>
                    <p className="text-2xl font-bold text-[#0f172a]">{results.summary.totalTeams}</p>
                  </div>

                  <div className="bg-[#fdf5e9] rounded-lg p-4 border-2 border-[#f97316]/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Gamepad2 className="w-5 h-5 text-[#f97316]" />
                      <span className="text-sm font-semibold text-[#0f172a]">Matches</span>
                    </div>
                    <p className="text-2xl font-bold text-[#0f172a]">{results.summary.totalMatches}</p>
                  </div>

                  <div className="bg-[#fdf5e9] rounded-lg p-4 border-2 border-[#f97316]/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-5 h-5 text-[#f97316]" />
                      <span className="text-sm font-semibold text-[#0f172a]">Players</span>
                    </div>
                    <p className="text-2xl font-bold text-[#0f172a]">{results.summary.totalPlayers}</p>
                  </div>
                </div>

                <div className={`rounded-lg p-3 border-2 ${
                  results.summary.dataQuality === 'excellent' 
                    ? 'bg-[#10b981]/10 border-[#10b981]/30' 
                    : results.summary.dataQuality === 'partial'
                    ? 'bg-[#fbbf24]/10 border-[#fbbf24]/30'
                    : 'bg-[#ef4444]/10 border-[#ef4444]/30'
                }`}>
                  <p className="text-sm font-semibold text-[#0f172a]">
                    Data Quality: <span className="capitalize">{results.summary.dataQuality}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Recommendations Section */}
          {results.recommendations && results.recommendations.length > 0 && (
            <div className="bg-white rounded-xl shadow-md border-2 border-[#0f172a]/10 overflow-hidden">
              <button
                onClick={() => toggleSection('recommendations')}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-[#10b981]/10 to-[#059669]/10 hover:from-[#10b981]/20 hover:to-[#059669]/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-[#10b981]" />
                  <h2 className="text-lg font-bold text-[#0f172a]">💡 Recommendations</h2>
                </div>
                {expandedSections.has('recommendations') ? (
                  <ChevronDown className="w-5 h-5 text-[#0f172a]" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-[#0f172a]" />
                )}
              </button>

              {expandedSections.has('recommendations') && (
                <div className="p-4 border-t-2 border-[#0f172a]/10">
                  <ul className="space-y-2">
                    {results.recommendations.map((rec: string, i: number) => (
                      <li key={i} className="text-sm text-[#0f172a]/70">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Data Sections */}
          {['league', 'teams', 'matches', 'players'].map((section) => {
            const sectionData = results[section];
            if (!sectionData) return null;

            const sectionConfig = {
              league: { icon: Database, title: '📊 League Data', color: 'blue' },
              teams: { icon: Users, title: '🏆 Teams Data', color: 'purple' },
              matches: { icon: Gamepad2, title: '🎮 Matches Data', color: 'green' },
              players: { icon: Users, title: '👥 Players Data', color: 'orange' }
            };

            const config = sectionConfig[section as keyof typeof sectionConfig];
            const Icon = config.icon;

            return (
              <div key={section} className="bg-white rounded-xl shadow-md border-2 border-[#0f172a]/10 overflow-hidden">
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-6 h-6 text-[#f97316]" />
                    <h2 className="text-lg font-bold text-[#0f172a]">{config.title}</h2>
                    {getStatusIcon(sectionData.status)}
                  </div>
                  {expandedSections.has(section) ? (
                    <ChevronDown className="w-5 h-5 text-[#0f172a]" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-[#0f172a]" />
                  )}
                </button>

                {expandedSections.has(section) && (
                  <div className="p-4 border-t-2 border-[#0f172a]/10">
                    {sectionData.error ? (
                      <div className="bg-[#ef4444]/10 rounded-lg p-3 border-2 border-[#ef4444]/30">
                        <p className="text-sm text-[#ef4444] font-semibold">Error: {sectionData.error}</p>
                      </div>
                    ) : sectionData.data ? (
                      <div className="max-h-[400px] overflow-auto">
                        <pre className="text-xs bg-[#0f172a] text-[#10b981] p-4 rounded-lg overflow-auto">
                          {JSON.stringify(sectionData.data, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-sm text-[#0f172a]/60">No data available</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Tournament Preview */}
          {results && results.teams?.data && results.matches?.data && results.league?.data && (
            <TournamentBuilderPreview
              tournamentName={tournamentName || results.league.data.name || 'Untitled Tournament'}
              teams={results.teams.data}
              matches={results.matches.data}
              leagueData={results.league.data}
            />
          )}

          {/* Import Section */}
          {results.summary.dataQuality !== 'poor' && (
            <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#10b981]/30">
              <h2 className="text-xl font-bold text-[#0f172a] mb-4 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-[#10b981]" />
                Ready to Import Tournament
              </h2>

              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0f172a] mb-2">
                    Tournament Name <span className="text-[#ef4444]">*</span>
                  </label>
                  <input
                    type="text"
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:border-[#f97316] focus:outline-none"
                    placeholder="e.g., Kernel Kup 5"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0f172a] mb-2">
                      YouTube Playlist URL
                    </label>
                    <input
                      type="text"
                      value={metadata.youtube_playlist_url}
                      onChange={(e) => setMetadata({ ...metadata, youtube_playlist_url: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:border-[#f97316] focus:outline-none"
                      placeholder="https://youtube.com/playlist?list=..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0f172a] mb-2">
                      Twitch Channel
                    </label>
                    <input
                      type="text"
                      value={metadata.twitch_channel}
                      onChange={(e) => setMetadata({ ...metadata, twitch_channel: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:border-[#f97316] focus:outline-none"
                      placeholder="twitch.tv/..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0f172a] mb-2">
                      Prize Pool
                    </label>
                    <input
                      type="text"
                      value={metadata.prize_pool}
                      onChange={(e) => setMetadata({ ...metadata, prize_pool: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:border-[#f97316] focus:outline-none"
                      placeholder="e.g., $500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#0f172a] mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={metadata.description}
                      onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:border-[#f97316] focus:outline-none"
                      placeholder="Tournament description..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={() => setResults(null)}
                  variant="outline"
                  className="flex-1 border-2 border-[#0f172a]/10 hover:bg-gray-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Decline & Start Over
                </Button>

                <Button
                  onClick={handleImportTournament}
                  disabled={isImporting || !tournamentName.trim()}
                  className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white font-bold"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Tournament...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Accept & Create Tournament
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Footer />
    </div>
  );
}