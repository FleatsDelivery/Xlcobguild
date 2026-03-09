/**
 * Tournament Hub — Players Tab (Unified)
 *
 * Active tournaments: Shows player registry with sub-tabs (all, free agents, coaches)
 * Finished tournaments: Shows aggregated player statistics leaderboard
 * Receives all data and handlers as props from the orchestrator.
 */

import { Users, Crown, GraduationCap, Target, Clipboard } from '@/lib/icons';
import { PlayerCard } from './tournament-hub-player-card';
import { AggregatedPlayerStats } from '@/app/components/aggregated-player-stats';

export interface TournamentHubPlayersProps {
  allPlayers: any[];
  freeAgents: any[];
  coaches: any[];
  playersSubTab: 'all' | 'free_agents' | 'coaches';
  setPlayersSubTab: (tab: 'all' | 'free_agents' | 'coaches') => void;
  user: any;
  myTeam: any;
  isMutable: boolean;
  sendingInvite: string | null;
  handleSendInvite: (teamId: string, personId: string, personName: string, inviteRole?: 'player' | 'coach') => void;
  setSelectedPlayer: (reg: any) => void;
  /** Officer mode — shows rank override button on unranked player badges */
  isOfficer?: boolean;
  /** Called when officer clicks the rank override pencil on an unranked player */
  onRankOverride?: (userId: string, displayName: string, currentMedal?: string | null, currentStars?: number) => void;
  /** NEW: If true, show finished tournament stats leaderboard */
  isFinished?: boolean;
  /** NEW: Player stats for finished tournaments */
  playerStats?: any[];
  /** NEW: Coach members for finished tournaments */
  coachMembers?: any[];
  /** If true, this tab is not yet relevant for the current tournament phase */
  isRelevant?: boolean;
}

export function TournamentHubPlayers({
  allPlayers, freeAgents, coaches,
  playersSubTab, setPlayersSubTab,
  user, myTeam, isMutable,
  sendingInvite, handleSendInvite, setSelectedPlayer,
  isOfficer,
  onRankOverride,
  isFinished,
  playerStats,
  coachMembers,
  isRelevant = true,
}: TournamentHubPlayersProps) {
  
  // ── EARLY PHASE: Not relevant yet ──
  if (!isRelevant) {
    return (
      <div className="bg-card rounded-2xl border-2 border-dashed border-border p-12 text-center space-y-3">
        <Users className="w-16 h-16 text-muted-foreground/20 mx-auto" />
        <h3 className="text-xl font-bold text-foreground">Player Registry Opens Soon</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Once registration begins, all signed-up players will appear here. Check back when the tournament opens for signups!
        </p>
      </div>
    );
  }
  
  // ── FINISHED TOURNAMENT: Show stats leaderboard ──
  if (isFinished) {
    return (
      <div className="space-y-6">
        {/* Coaches */}
        {coachMembers && coachMembers.length > 0 && (
          <div className="bg-card rounded-2xl border-2 border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
                <Clipboard className="w-5 h-5 text-[#3b82f6]" />
              </div>
              <h3 className="text-xl font-black text-foreground">Coaches</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {coachMembers.map((coach: any) => (
                <div key={coach.person_id} className="flex items-center gap-3 bg-[#3b82f6]/5 rounded-xl p-4 border border-[#3b82f6]/20">
                  {coach.avatar_url ? (
                    <img src={coach.avatar_url} alt={coach.display_name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-harvest to-orange-400 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                      {coach.display_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{coach.display_name}</p>
                    <p className="text-sm text-[#3b82f6] font-semibold">Coach — {coach.team_name}</p>
                    {coach.steam_id && /^\d+$/.test(coach.steam_id) && (
                      <a href={`https://www.opendota.com/players/${coach.steam_id}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-harvest transition-colors">
                        OpenDota Profile
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Player Stats */}
        {!playerStats || playerStats.length === 0 ? (
          <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
            <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No player stats available yet</p>
          </div>
        ) : (
          <AggregatedPlayerStats stats={playerStats} />
        )}
      </div>
    );
  }

  // ── ACTIVE TOURNAMENT: Show player registry ──
  
  const subTabs: { key: typeof playersSubTab; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All Players', count: allPlayers.length, color: 'text-foreground' },
    { key: 'free_agents', label: 'Free Agents', count: freeAgents.length, color: 'text-[#3b82f6]' },
    { key: 'coaches', label: 'Coaches', count: coaches.length, color: 'text-[#10b981]' },
  ];

  const isCoachesTab = playersSubTab === 'coaches';
  const displayItems = playersSubTab === 'free_agents' ? freeAgents
    : isCoachesTab ? coaches
    : allPlayers;

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 bg-card rounded-xl border-2 border-border p-1.5">
        {subTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setPlayersSubTab(tab.key)}
            className={`flex-1 px-4 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              playersSubTab === tab.key
                ? tab.key === 'free_agents' ? 'bg-[#3b82f6] text-white'
                  : tab.key === 'coaches' ? 'bg-[#10b981] text-white'
                  : 'bg-foreground text-card'
                : 'bg-transparent text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.key === 'coaches' && <GraduationCap className="w-4 h-4" />}
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              playersSubTab === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Captain Invite Mode Notice */}
      {myTeam && myTeam.approval_status === 'approved' && playersSubTab === 'free_agents' && freeAgents.length > 0 && (
        <div className="bg-[#3b82f6]/5 rounded-xl p-4 border border-[#3b82f6]/20 flex items-center gap-3">
          <Crown className="w-5 h-5 text-[#3b82f6] flex-shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-bold text-[#3b82f6]">Captain Mode:</span> You can invite free agents to <strong>{myTeam.team_name}</strong> by clicking the invite button on their card.
          </p>
        </div>
      )}

      {/* Cards */}
      {displayItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayItems.map((reg: any) => (
            <PlayerCard
              key={reg.id}
              registration={reg}
              user={user}
              sendingInvite={sendingInvite}
              showInviteButton={!isCoachesTab && !!(myTeam && myTeam.approval_status === 'approved' && isMutable && reg.status !== 'on_team')}
              inviteTeamId={myTeam?.id}
              onInvite={handleSendInvite}
              onSelect={setSelectedPlayer}
              isCoach={isCoachesTab}
              isOfficer={isOfficer}
              onRankOverride={onRankOverride}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border-2 border-dashed border-border p-12 text-center">
          {isCoachesTab ? (
            <GraduationCap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          ) : (
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          )}
          <p className="text-muted-foreground font-semibold">
            {playersSubTab === 'free_agents' ? 'No free agents right now' :
             isCoachesTab ? 'No coaches registered yet' :
             'No players registered yet'}
          </p>
          <p className="text-muted-foreground/70 text-sm mt-1">
            {playersSubTab === 'free_agents' ? 'All registered players are on teams, or nobody has registered yet.' :
             isCoachesTab ? 'Coaches can register during the registration phase.' :
             'Registration may not have opened yet.'}
          </p>
        </div>
      )}

      {/* Hint */}
      {displayItems.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Click any {isCoachesTab ? 'coach' : 'player'} to view their profile
        </p>
      )}
    </div>
  );
}