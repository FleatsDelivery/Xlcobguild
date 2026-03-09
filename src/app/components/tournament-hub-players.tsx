/**
 * Tournament Hub — Players Tab
 *
 * Renders the player registry with sub-tabs (all, free agents, coaches).
 * Receives all data and handlers as props from the orchestrator.
 */

import { Users, Crown, GraduationCap } from 'lucide-react';
import { PlayerCard } from './tournament-hub-player-card';

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
}

export function TournamentHubPlayers({
  allPlayers, freeAgents, coaches,
  playersSubTab, setPlayersSubTab,
  user, myTeam, isMutable,
  sendingInvite, handleSendInvite, setSelectedPlayer,
  isOfficer,
  onRankOverride,
}: TournamentHubPlayersProps) {
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