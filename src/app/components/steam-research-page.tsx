import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Loader2, Microscope, Database, GitCompare } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export function SteamResearchPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [activeTest, setActiveTest] = useState<string>('');

  const runTest = async (testType: 'all' | 'league' | 'compare' | 'match-compare') => {
    setLoading(true);
    setActiveTest(testType);
    setResults(null);

    try {
      let url = '';
      
      if (testType === 'all') {
        url = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/steam-research/test-all`;
      } else if (testType === 'league') {
        url = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/steam-research/league/16273`;
      } else if (testType === 'compare') {
        url = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/steam-research/compare/16273`;
      } else if (testType === 'match-compare') {
        url = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/steam-research/compare-match/7616356796`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      const data = await response.json();
      setResults(data);
      console.log(`📊 ${testType.toUpperCase()} Results:`, data);
    } catch (error) {
      console.error('Research error:', error);
      setResults({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Microscope className="w-8 h-8 text-[#f97316]" />
          <div>
            <h1 className="text-2xl font-bold text-[#0f172a]">🔬 Steam API Research Lab</h1>
            <p className="text-sm text-[#0f172a]/60">Testing Kernel Kup 5 Data Extraction</p>
          </div>
        </div>

        <div className="bg-[#fdf5e9] rounded-lg p-4 border-2 border-[#f97316]/20 mb-4">
          <p className="text-sm font-semibold text-[#0f172a] mb-2">🌽 Test Data (Kernel Kup 5):</p>
          <ul className="text-xs text-[#0f172a]/70 space-y-1">
            <li>• <strong>League ID:</strong> 16273</li>
            <li>• <strong>Series ID:</strong> 2520166 (C.DAWGS vs FOOP)</li>
            <li>• <strong>Match ID:</strong> 7616356796 (C.DAWGS victory)</li>
            <li>• <strong>Team ID:</strong> 9359693 (FOOP)</li>
            <li>• <strong>Player ID:</strong> 108977424 (Sneetch)</li>
          </ul>
        </div>

        <div className="bg-gradient-to-r from-[#f97316] to-[#ea580c] rounded-lg p-4 text-white">
          <p className="text-sm font-semibold mb-2">✨ Ready to Build a Tournament?</p>
          <p className="text-xs opacity-90 mb-3">
            The Tournament Builder combines all 4 tests into one master button to create complete tournaments automatically!
          </p>
          <button
            onClick={() => window.location.hash = '#tournament-builder'}
            className="bg-white text-[#f97316] px-4 py-2 rounded-lg font-bold text-sm hover:bg-white/90 transition-colors"
          >
            🏗️ Open Tournament Builder
          </button>
        </div>
      </div>

      {/* Test Buttons */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Button
          onClick={() => runTest('all')}
          disabled={loading}
          className="h-auto flex-col items-start p-4 bg-[#f97316] hover:bg-[#ea580c]"
        >
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-5 h-5" />
            <span className="font-bold">Test All Endpoints</span>
          </div>
          <span className="text-xs opacity-90 text-left">
            Test GetMatchDetails, GetLeagueListing, GetMatchHistory, GetTeamInfo, etc.
          </span>
        </Button>

        <Button
          onClick={() => runTest('league')}
          disabled={loading}
          variant="outline"
          className="h-auto flex-col items-start p-4 border-2 border-[#f97316] text-[#0f172a] hover:bg-[#f97316]/10"
        >
          <div className="flex items-center gap-2 mb-2">
            <Microscope className="w-5 h-5 text-[#f97316]" />
            <span className="font-bold">Get League Data</span>
          </div>
          <span className="text-xs opacity-70 text-left">
            Pull comprehensive data for League 16273
          </span>
        </Button>

        <Button
          onClick={() => runTest('compare')}
          disabled={loading}
          variant="outline"
          className="h-auto flex-col items-start p-4 border-2 border-[#10b981] text-[#0f172a] hover:bg-[#10b981]/10"
        >
          <div className="flex items-center gap-2 mb-2">
            <GitCompare className="w-5 h-5 text-[#10b981]" />
            <span className="font-bold">League Comparison</span>
          </div>
          <span className="text-xs opacity-70 text-left">
            Compare Steam vs OpenDota league data
          </span>
        </Button>

        <Button
          onClick={() => runTest('match-compare')}
          disabled={loading}
          className="h-auto flex-col items-start p-4 bg-[#10b981] hover:bg-[#059669] text-white"
        >
          <div className="flex items-center gap-2 mb-2">
            <GitCompare className="w-5 h-5" />
            <span className="font-bold">🎯 Match Comparison</span>
          </div>
          <span className="text-xs opacity-90 text-left">
            Compare Steam vs OpenDota for Match 7616356796 (THE KEY TEST!)
          </span>
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl shadow-md p-12 border-2 border-[#0f172a]/10 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#f97316] mx-auto mb-4" />
          <p className="text-lg font-semibold text-[#0f172a]">
            Running {activeTest === 'all' ? 'All Tests' : activeTest === 'league' ? 'League Analysis' : 'API Comparison'}...
          </p>
          <p className="text-sm text-[#0f172a]/60">This may take a few seconds</p>
        </div>
      )}

      {/* Results Display */}
      {!loading && results && (
        <div className="bg-white rounded-xl shadow-md border-2 border-[#0f172a]/10 overflow-hidden">
          <div className="bg-[#0f172a] p-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              📊 Test Results
              {results.timestamp && (
                <span className="text-xs font-normal opacity-70 ml-auto">
                  {new Date(results.timestamp).toLocaleString()}
                </span>
              )}
            </h2>
          </div>

          <div className="p-4 max-h-[600px] overflow-auto">
            <pre className="text-xs bg-[#0f172a] text-[#10b981] p-4 rounded-lg overflow-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>

          {/* Quick Analysis */}
          {activeTest === 'all' && results.results && (
            <div className="p-4 border-t-2 border-[#0f172a]/10 bg-[#fdf5e9]">
              <p className="font-bold text-[#0f172a] mb-2">Quick Summary:</p>
              <div className="space-y-1">
                {results.results.map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={r.success ? 'text-[#10b981]' : 'text-[#ef4444]'}>
                      {r.success ? '✅' : '❌'}
                    </span>
                    <span className="font-semibold">{r.endpoint}:</span>
                    <span className="text-[#0f172a]/60">
                      {r.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Match Comparison Quick Analysis */}
          {activeTest === 'match-compare' && results.comparison && (
            <div className="p-4 border-t-2 border-[#0f172a]/10 bg-[#fdf5e9]">
              <p className="font-bold text-[#0f172a] mb-3">🎯 Quick Analysis:</p>
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-lg p-3 border-2 border-[#0f172a]/10">
                  <p className="font-semibold text-sm text-[#0f172a] mb-2">
                    {results.steam.success ? '✅' : '❌'} Steam API
                  </p>
                  <div className="text-xs space-y-1">
                    {Object.entries(results.comparison.dataAvailability.steam || {}).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className={value ? 'text-[#10b981]' : 'text-[#ef4444]'}>
                          {value ? '✓' : '✗'}
                        </span>
                        <span className="text-[#0f172a]/70">{key}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3 border-2 border-[#0f172a]/10">
                  <p className="font-semibold text-sm text-[#0f172a] mb-2">
                    {results.opendota.success ? '✅' : '❌'} OpenDota API
                  </p>
                  <div className="text-xs space-y-1">
                    {Object.entries(results.comparison.dataAvailability.opendota || {}).map(([key, value]: [string, any]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className={value ? 'text-[#10b981]' : 'text-[#ef4444]'}>
                          {value ? '✓' : '✗'}
                        </span>
                        <span className="text-[#0f172a]/70">{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-[#10b981]/10 rounded-lg p-3 border-2 border-[#10b981]/30">
                <p className="font-semibold text-sm text-[#0f172a] mb-2">💡 Recommendations:</p>
                <ul className="text-xs text-[#0f172a]/70 space-y-1">
                  {results.comparison.recommendations?.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      {!loading && !results && (
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10">
          <h3 className="font-bold text-[#0f172a] mb-3">📋 What We're Testing:</h3>
          <ul className="space-y-2 text-sm text-[#0f172a]/70">
            <li><strong>1. Test All Endpoints:</strong> Runs every Steam API endpoint we know about to see what data is available</li>
            <li><strong>2. Get League Data:</strong> Tries to pull all matches, teams, and players from the league</li>
            <li><strong>3. League Comparison:</strong> Compares what each API can give us for the same league</li>
            <li><strong>4. Match Comparison (🎯 KEY TEST):</strong> Compares Steam vs OpenDota for Match 7616356796 to see which API gives better data for your tournament flow</li>
          </ul>

          <div className="mt-4 p-4 bg-[#fdf5e9] rounded-lg border-2 border-[#f97316]/20">
            <p className="text-sm font-semibold text-[#0f172a]">💡 Goal:</p>
            <p className="text-xs text-[#0f172a]/70 mt-1">
              Figure out if we can verify and auto-populate Kernel Kup tournaments using just League ID + Match ID + Team ID + Player ID, 
              or if we need a different approach. Check your browser console for detailed logs!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}