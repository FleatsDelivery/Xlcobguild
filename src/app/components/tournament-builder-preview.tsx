import { TeamLogo } from '@/app/components/team-logo';
import { Trophy, Users, Swords } from 'lucide-react';

interface Team {
  team_id: number;
  team_name: string;
  tag: string;
  logo_url: string | null;
  wins: number;
  losses: number;
}

interface Match {
  match_id: number;
  radiant_team_id: number;
  dire_team_id: number;
  radiant_name?: string;
  dire_name?: string;
  radiant_win: boolean;
  start_time: number;
}

interface TournamentBuilderPreviewProps {
  tournamentName: string;
  teams: Team[];
  matches: Match[];
  leagueData: any;
}

export function TournamentBuilderPreview({ 
  tournamentName, 
  teams, 
  matches,
  leagueData 
}: TournamentBuilderPreviewProps) {
  // Create a map of team_id to team data
  const teamMap = new Map(teams.map(t => [t.team_id, t]));

  // Enrich matches with team names
  const enrichedMatches = matches.map(match => {
    const radiantTeam = teamMap.get(match.radiant_team_id);
    const direTeam = teamMap.get(match.dire_team_id);
    
    return {
      ...match,
      radiant_name: radiantTeam?.team_name || `Team ${match.radiant_team_id}`,
      dire_name: direTeam?.team_name || `Team ${match.dire_team_id}`,
      radiant_team: radiantTeam,
      dire_team: direTeam
    };
  }).slice(0, 5); // Show first 5 matches

  return (
    <div className="bg-white rounded-2xl border-2 border-[#10b981]/20 p-6 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b-2 border-[#0f172a]/10">
        <Trophy className="w-6 h-6 text-[#10b981]" />
        <div>
          <h3 className="text-xl font-bold text-[#0f172a]">Tournament Preview</h3>
          <p className="text-sm text-[#0f172a]/60">This is how your tournament will look after import</p>
        </div>
      </div>

      {/* Tournament Header */}
      <div className="bg-gradient-to-br from-[#10b981] to-[#059669] rounded-xl p-6">
        <h2 className="text-3xl font-black text-white mb-2">{tournamentName}</h2>
        {leagueData?.name && (
          <p className="text-white/90 text-sm">{leagueData.name}</p>
        )}
        <div className="flex gap-4 mt-4">
          <div className="bg-white/20 rounded-lg px-4 py-2">
            <p className="text-white/80 text-xs">Teams</p>
            <p className="text-white font-bold text-lg">{teams.length}</p>
          </div>
          <div className="bg-white/20 rounded-lg px-4 py-2">
            <p className="text-white/80 text-xs">Matches</p>
            <p className="text-white font-bold text-lg">{matches.length}</p>
          </div>
        </div>
      </div>

      {/* Teams Preview */}
      {teams.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-[#f97316]" />
            <h4 className="font-bold text-[#0f172a]">Teams ({teams.length})</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {teams.slice(0, 6).map((team) => (
              <div
                key={team.team_id}
                className="flex items-center gap-3 p-3 bg-[#fdf5e9] rounded-lg border-2 border-[#0f172a]/10"
              >
                <TeamLogo logoUrl={team.logo_url} teamName={team.team_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#0f172a] truncate">{team.team_name}</p>
                  <p className="text-xs text-[#0f172a]/60">{team.tag}</p>
                </div>
              </div>
            ))}
          </div>
          {teams.length > 6 && (
            <p className="text-sm text-[#0f172a]/60 mt-2 text-center">
              + {teams.length - 6} more teams
            </p>
          )}
        </div>
      )}

      {/* Matches Preview */}
      {enrichedMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Swords className="w-5 h-5 text-[#f97316]" />
            <h4 className="font-bold text-[#0f172a]">Recent Matches</h4>
          </div>
          <div className="space-y-3">
            {enrichedMatches.map((match) => (
              <div
                key={match.match_id}
                className="bg-[#fdf5e9] rounded-lg border-2 border-[#0f172a]/10 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    {match.radiant_team?.logo_url && (
                      <TeamLogo 
                        logoUrl={match.radiant_team.logo_url} 
                        teamName={match.radiant_name} 
                        size="xs" 
                      />
                    )}
                    <span className={`font-bold text-sm ${match.radiant_win ? 'text-[#10b981]' : 'text-[#0f172a]/60'}`}>
                      {match.radiant_name}
                    </span>
                  </div>
                  <span className="text-[#0f172a]/40 text-xs mx-2">VS</span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className={`font-bold text-sm ${!match.radiant_win ? 'text-[#10b981]' : 'text-[#0f172a]/60'}`}>
                      {match.dire_name}
                    </span>
                    {match.dire_team?.logo_url && (
                      <TeamLogo 
                        logoUrl={match.dire_team.logo_url} 
                        teamName={match.dire_name} 
                        size="xs" 
                      />
                    )}
                  </div>
                </div>
                <div className="text-xs text-[#0f172a]/40 text-center">
                  Match ID: {match.match_id} • {match.radiant_win ? match.radiant_name : match.dire_name} won
                </div>
              </div>
            ))}
          </div>
          {matches.length > 5 && (
            <p className="text-sm text-[#0f172a]/60 mt-2 text-center">
              + {matches.length - 5} more matches
            </p>
          )}
        </div>
      )}

      <div className="bg-[#10b981]/10 border-2 border-[#10b981]/20 rounded-lg p-4">
        <p className="text-sm text-[#0f172a] font-semibold">✅ Ready to Import</p>
        <p className="text-xs text-[#0f172a]/60 mt-1">
          All data has been enriched with real team names, logos, and match details. Click "Import Tournament" to save to database.
        </p>
      </div>
    </div>
  );
}
