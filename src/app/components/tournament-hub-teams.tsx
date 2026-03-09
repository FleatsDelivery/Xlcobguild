/**
 * Tournament Hub — Teams Tab
 *
 * Two-zone layout with sub-tabs:
 *   "All Teams"  — KKup-style brown-header showcase cards (read-only for everyone)
 *   "My Team"    — Team dashboard visible to all team members; captain gets management buttons
 *
 * Phase 2: Invite modals (InvitePlayerModal, InviteCoachModal) replace inline search.
 * Coach display: compact headset-avatar in the brown team header (Dota-inspired).
 * All data and handlers are received as props from the orchestrator.
 */

import {
  Shield, Users, Crown, Plus, ChevronDown, ChevronUp, Send, Loader2, UserPlus,
  CheckCircle, XCircle, Clock, History, AlertTriangle,
  Gamepad2, MailX, GraduationCap, LogOut, Lock, Unlock, Trash2,
} from '@/lib/icons';
import { useState, useMemo } from 'react';
import { Button } from '@/app/components/ui/button';
import { TeamLogo } from '@/app/components/team-logo';
import { getRankDisplay, calculateTeamRank, getMedalColor, type TeamRankResult } from '@/lib/rank-utils';
import { InvitePlayerModal } from '@/app/components/tournament-hub-invite-player-modal';
import { InviteCoachModal } from '@/app/components/tournament-hub-invite-coach-modal';
import { TicketMeterSection } from '@/app/components/tournament-hub-ticket-meter';
import { CoachHeadsetAvatar } from '@/app/components/coach-headset-avatar';
import { RankBadge } from '@/app/components/rank-badge';
import { PlayerCard } from '@/app/components/tournament-hub-player-card';
import { getHeroImageUrl } from '@/lib/dota-heroes';
import { TournamentHubEmptyState } from './tournament-hub-empty-state';

// ════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

/** Build a registration-shaped object from coach data so PlayerCard can render it uniformly */
function buildCoachRegistration(coach: any, coachData: any) {
  return {
    id: `coach-${coachData?.id || 'unknown'}`,
    role: 'coach',
    person: coach,
    linked_user: coachData ? {
      id: coachData.id,
      discord_username: coachData.discord_username || coachData.display_name,
      discord_avatar: coachData.discord_avatar,
      rank_id: coachData.rank_id,
      prestige_level: coachData.prestige_level,
      role: coachData.role,
      steam_id: coachData.steam_id,
      badge_rank: coachData.opendota_data?.badge_rank || coachData.badge_rank,
      opendota_data: coachData.opendota_data,
      tcf_plus_active: coachData.tcf_plus_active,
    } : null,
  };
}

// ════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface TournamentHubTeamsProps {
  tournament: any;
  teams: any[];
  approvedTeams: any[];
  pendingTeams: any[];
  freeAgents: any[];
  availableCoaches: any[];
  user: any;
  isOwner: boolean;
  isMutable: boolean;
  canCreateTeam: boolean;
  teamRosters: Record<string, any[]>;
  teamCoachData: Record<string, any>;
  /** @deprecated Phase 2 removed expand/collapse — kept for interface compat, unused internally */
  expandedTeamId: string | null;
  /** @deprecated Phase 2 removed expand/collapse — kept for interface compat, unused internally */
  setExpandedTeamId: (id: string | null) => void;
  /** @deprecated Phase 2 removed lazy roster loading — kept for interface compat, unused internally */
  fetchTeamRoster: (teamId: string) => void;
  /** @deprecated Phase 2 replaced inline search with modals — kept for interface compat, unused internally */
  inviteSearchQuery: string;
  /** @deprecated Phase 2 replaced inline search with modals — kept for interface compat, unused internally */
  setInviteSearchQuery: (q: string) => void;
  sendingInvite: string | null;
  /** Tracks whether the last invite was successful (true) or failed (false). Null = no invite completed yet. */
  lastInviteSuccess: boolean | null;
  addingSelfToRoster: string | null;
  handleTeamApproval: (teamId: string, teamName: string, approval: 'approved' | 'denied') => void;
  handleSendInvite: (teamId: string, personId: string, personName: string, inviteRole?: 'player' | 'coach') => void;
  handleAddSelfToRoster: (teamId: string) => void;
  handleRemoveFromRoster: (teamId: string, personId: string, personName: string) => void;
  /** @deprecated Phase 2 replaced direct assignment with invite modals — kept for interface compat */
  handleAssignCoach: (teamId: string, teamName: string, personId: string, personName: string) => void;
  handleRemoveCoach: (teamId: string, teamName: string) => void;
  handleDeleteTeam: (teamId: string, teamName: string) => void;
  // Phase 3: Ticket contributions + Team Ready
  handleSetContribution: (teamId: string, personId: string, tickets: number) => void;
  settingContribution: string | null;
  handleTeamReady: (teamId: string, teamName: string) => void;
  readyingTeam: boolean;
  setActiveTab: (tab: 'overview' | 'players' | 'teams' | 'matches' | 'staff' | 'gallery') => void;
  setPlayersSubTab: (tab: 'all' | 'free_agents' | 'coaches') => void;
  /** NEW: If true, render finished tournament view (final standings) */
  isFinished?: boolean;
  /** NEW: Player stats for finished tournaments (used for top heroes) */
  playerStats?: any[];
  /** NEW: Loading state for rosters */
  loadingRosters?: boolean;
  /** NEW: Handler to select team for editing */
  setSelectedTeam?: (team: any) => void;
  /** NEW: Handler to show edit team modal */
  setShowEditTeamModal?: (show: boolean) => void;
  /** If true, this tab is not yet relevant for the current tournament phase */
  isRelevant?: boolean;
}

type TeamsSubTab = 'all_teams' | 'my_team';

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function TournamentHubTeams(props: TournamentHubTeamsProps) {
  const {
    teams, approvedTeams, pendingTeams,
    user, isOwner, canCreateTeam,
    isUserCaptainOf, teamRosters, teamCoachData,
    setShowCreateTeam, setShowExistingTeam,
    isFinished, playerStats, loadingRosters,
    setSelectedTeam, setShowEditTeamModal, setActiveTab,
    isRelevant = true,
  } = props;

  // ── EARLY PHASE: Not relevant yet ──
  if (!isRelevant) {
    return (
      <TournamentHubEmptyState
        icon={Users}
        title="Teams Form During Roster Lock"
        description="Once registration closes and the roster lock phase begins, teams will be created here. Players can join teams, captains can invite teammates, and rosters will be finalized."
      />
    );
  }

  // ── FINISHED TOURNAMENT: Show final standings with hero stats ──
  if (isFinished) {
    return <FinishedTeamsStandings 
      teams={teams}
      playerStats={playerStats || []}
      teamRosters={teamRosters}
      loadingRosters={loadingRosters || false}
      isOwner={isOwner}
      setSelectedTeam={setSelectedTeam || (() => {})}
      setShowEditTeamModal={setShowEditTeamModal || (() => {})}
      setActiveTab={setActiveTab}
    />;
  }

  // ── ACTIVE TOURNAMENT: Show team management workflow ──

  // Find the user's team — captain OR roster member OR coach
  const myTeamAsCaptain = teams.find(t => isUserCaptainOf(t) && t.approval_status !== 'denied' && t.approval_status !== 'withdrawn');

  const myTeamAsMember = !myTeamAsCaptain && user ? (() => {
    // Check rosters for linked_user matching current user
    for (const team of teams) {
      if (team.approval_status === 'denied' || team.approval_status === 'withdrawn') continue;
      const roster = teamRosters[team.id];
      if (roster?.some((r: any) => r.linked_user?.id === user.id)) return team;
      // Check if user is the coach
      const coachData = teamCoachData[team.id];
      if (coachData?.id === user.id) return team;
    }
    return null;
  })() : null;

  const myTeam = myTeamAsCaptain || myTeamAsMember || null;
  const isCaptainOfMyTeam = !!myTeamAsCaptain;
  const hasMyTeam = !!myTeam;
  const [subTab, setSubTab] = useState<TeamsSubTab>('all_teams');

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          Teams
          <span className="text-muted-foreground text-sm sm:text-base font-normal ml-2">
            {approvedTeams.length} team{approvedTeams.length !== 1 ? 's' : ''}
            {pendingTeams.length > 0 && <span className="text-[#f59e0b] ml-1">({pendingTeams.length} pending)</span>}
          </span>
        </h3>
        {canCreateTeam && (
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateTeam(true)} className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold rounded-xl shadow-lg">
              <Plus className="w-4 h-4 mr-2" /> Create New Team
            </Button>
            <Button onClick={() => setShowExistingTeam(true)} className="bg-harvest hover:bg-harvest/90 text-white font-bold rounded-xl shadow-lg">
              <History className="w-4 h-4 mr-2" /> Add Existing
            </Button>
          </div>
        )}
      </div>

      {/* Sub-Tab Switcher */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
        <button
          onClick={() => setSubTab('all_teams')}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            subTab === 'all_teams' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" /> All Teams
        </button>
        {hasMyTeam && (
          <button
            onClick={() => setSubTab('my_team')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              subTab === 'my_team' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Crown className="w-4 h-4 inline mr-1.5 -mt-0.5 text-harvest" /> My Team
          </button>
        )}
      </div>

      {/* Tab Content */}
      {subTab === 'all_teams' ? (
        <AllTeamsView {...props} />
      ) : myTeam ? (
        <MyTeamView {...props} myTeam={myTeam} isCaptain={isCaptainOfMyTeam} />
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ALL TEAMS VIEW — KKup-style brown-header showcase cards
// ═══════════════════════════════════════════════════════

function AllTeamsView({
  tournament, approvedTeams, pendingTeams, isOwner,
  teamRosters, teamCoachData, handleTeamApproval, canCreateTeam,
  setSelectedPlayer, isOfficer, onRankOverride,
}: TournamentHubTeamsProps) {
  const maxSize = tournament.max_team_size || 7;
  const minSize = tournament.min_team_size || 5;

  return (
    <div className="space-y-6">
      {/* Pending Teams — owner approval */}
      {isOwner && pendingTeams.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[#f59e0b] uppercase tracking-wide flex items-center gap-2">
            <Clock className="w-4 h-4" /> Pending Approval ({pendingTeams.length})
          </h4>
          {pendingTeams.map((team: any) => (
            <div key={team.id} className="bg-[#f59e0b]/5 rounded-xl border-2 border-[#f59e0b]/20 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <TeamLogo logoUrl={team.logo_url} teamName={team.team_name} size="sm" />
                  <div>
                    <p className="font-bold text-foreground">{team.team_name} <span className="text-muted-foreground text-sm">[{team.team_tag}]</span></p>
                    <p className="text-xs text-muted-foreground">Captain: {team.captain?.display_name || 'Unknown'}{team.coach ? ` · Coach: ${team.coach.display_name}` : ''}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleTeamApproval(team.id, team.team_name, 'approved')} className="bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] h-9 rounded-lg font-bold text-sm">
                    <CheckCircle className="w-4 h-4 mr-1" /> Approve
                  </Button>
                  <Button onClick={() => handleTeamApproval(team.id, team.team_name, 'denied')} className="bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] h-9 rounded-lg font-bold text-sm">
                    <XCircle className="w-4 h-4 mr-1" /> Deny
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approved Teams */}
      {approvedTeams.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {approvedTeams.map((team: any) => (
            <TeamShowcaseCard key={team.id} team={team} tournament={tournament} maxSize={maxSize} minSize={minSize} roster={teamRosters[team.id]} coachData={teamCoachData[team.id]} onSelectPlayer={setSelectedPlayer} isOfficer={isOfficer} onRankOverride={onRankOverride} />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-semibold">No teams yet</p>
          <p className="text-muted-foreground/60 text-sm mt-1">
            {canCreateTeam ? 'Be the first — create a team!' : 'Teams will appear once players start forming them.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TEAM SHOWCASE CARD — KKup brown-header style, read-only
// ══════════════════════════════════════════════════════

function TeamShowcaseCard({ team, tournament, maxSize, minSize, roster, coachData, onSelectPlayer, isOfficer, onRankOverride }: { team: any; tournament: any; maxSize: number; minSize: number; roster: any[] | undefined; coachData: any; onSelectPlayer?: (reg: any) => void; isOfficer?: boolean; onRankOverride?: (userId: string, displayName: string, currentMedal?: string | null, currentStars?: number) => void }) {
  const rosterCount = roster?.length ?? team.roster_count ?? 0;
  const teamRank: TeamRankResult | null = roster ? calculateTeamRank(roster, coachData) : null;
  const isReady = team.approval_status === 'ready';
  const isRosterLockPhase = tournament.status === 'roster_lock' || tournament.status === 'live' || tournament.status === 'completed';
  const isLocked = isReady || isRosterLockPhase;

  return (
    <div className={`bg-card rounded-xl border-2 overflow-hidden transition-all ${isLocked ? 'border-harvest/50 shadow-lg shadow-harvest/10' : 'border-border'}`}>
      {/* Brown Header */}
      <div className="bg-gradient-to-r from-soil to-[#1e293b] p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <TeamLogo logoUrl={team.logo_url} teamName={team.team_name} size="lg" />
            <CoachHeadsetAvatar coach={team.coach} coachData={coachData} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-lg sm:text-xl font-bold text-white truncate">{team.team_name}</h4>
                {team.team_tag && <span className="text-white/50 text-sm font-mono">[{team.team_tag}]</span>}
                <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
                  isLocked
                    ? 'bg-harvest/20 text-harvest'
                    : 'bg-white/10 text-white/40'
                }`}>
                  {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  {isLocked ? 'Locked' : 'Unlocked'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-white/60 mt-1 flex-wrap">
                <span className="flex items-center gap-1"><Gamepad2 className="w-3.5 h-3.5 text-white/40" /><span className="text-white/80">{rosterCount}/{minSize}</span></span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <RankBadge medal={teamRank?.medal || 'Unranked'} stars={teamRank?.stars || 0} size="lg" />
            <div className="text-center">
              <p className="text-[10px] sm:text-xs text-white/50 font-semibold mb-0.5">Team Rank</p>
              <p className="text-sm font-black" style={{ color: getMedalColor(teamRank?.medal || 'Unranked') }}>
                {teamRank?.display || 'Unranked'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Roster + Coach Grid */}
      <div className="p-4 sm:p-5">
        {!roster ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-6 h-6 text-muted-foreground animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {roster.map((r: any) => (
              <PlayerCard
                key={r.id}
                registration={r}
                captainId={team.captain?.id}
                onSelect={onSelectPlayer}
                isOfficer={isOfficer}
                onRankOverride={onRankOverride}
              />
            ))}
            {coachData && (
              <PlayerCard
                key={`coach-${team.id}`}
                registration={buildCoachRegistration(team.coach, coachData)}
                isCoach
                onSelect={onSelectPlayer}
                isOfficer={isOfficer}
                onRankOverride={onRankOverride}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MY TEAM VIEW — Captain's management dashboard
// ═══════════════════════════════════════════════════════

function MyTeamView({
  tournament, user, isMutable,
  freeAgents, availableCoaches,
  teamRosters, teamCoachData,
  sendingInvite, lastInviteSuccess, addingSelfToRoster,
  handleSendInvite, handleAddSelfToRoster,
  handleRemoveFromRoster, handleRemoveCoach,
  handleDeleteTeam,
  handleSetContribution, settingContribution,
  handleTeamReady, readyingTeam,
  setActiveTab, setPlayersSubTab,
  teamInvites, cancellingInvite, handleCancelInvite,
  myTeam, isCaptain,
  isOfficer, onRankOverride,
}: TournamentHubTeamsProps & { myTeam: any; isCaptain: boolean }) {
  const maxSize = tournament.max_team_size || 7;
  const minSize = tournament.min_team_size || 5;
  const roster = teamRosters[myTeam.id];
  const rosterCount = roster?.length ?? myTeam.roster_count ?? 0;
  const fillPct = Math.min((rosterCount / minSize) * 100, 100);
  const fillColor = rosterCount >= minSize ? '#10b981' : rosterCount >= (minSize * 0.6) ? '#f59e0b' : '#3b82f6';
  const invites = teamInvites[myTeam.id] || [];

  // When team is 'ready' (locked in), disable all roster mutations even if tournament is mutable
  const isTeamReady = myTeam.approval_status === 'ready';
  const isRosterLockPhase = tournament.status === 'roster_lock' || tournament.status === 'live' || tournament.status === 'completed';
  const isLocked = isTeamReady || isRosterLockPhase;
  const teamMutable = isMutable && !isTeamReady;

  // Modal state
  const [showInvitePlayer, setShowInvitePlayer] = useState(false);
  const [showInviteCoach, setShowInviteCoach] = useState(false);

  const teamRank: TeamRankResult | null = roster ? calculateTeamRank(roster, teamCoachData[myTeam.id]) : null;

  const unrankedCount = roster
    ? roster.filter((r: any) => !getRankDisplay(r.linked_user?.opendota_data?.badge_rank || r.linked_user?.badge_rank)).length
    : 0;

  // Pending invite person IDs — used to filter out already-invited players
  const pendingInvitePersonIds = useMemo(() => {
    const ids = new Set<string>();
    for (const inv of invites) {
      if (inv.person?.id) ids.add(inv.person.id);
    }
    return ids;
  }, [invites]);

  const canInvitePlayers = teamMutable && rosterCount < maxSize;
  const canInviteCoach = teamMutable && !myTeam.coach;
  const hasCoach = !!myTeam.coach;

  return (
    <div className="space-y-6">
      <div className={`bg-card rounded-xl border-2 overflow-hidden transition-all ${isLocked ? 'border-harvest/50 shadow-lg shadow-harvest/10' : 'border-border'}`}>
        {/* ─── Brown Header (matches All Teams card) ─── */}
        <div className="bg-gradient-to-r from-soil to-[#1e293b] p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <TeamLogo logoUrl={myTeam.logo_url} teamName={myTeam.team_name} size="lg" />
              <CoachHeadsetAvatar coach={myTeam.coach} coachData={teamCoachData[myTeam.id]} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-lg sm:text-xl font-bold text-white truncate">{myTeam.team_name}</h4>
                  {myTeam.team_tag && <span className="text-white/50 text-sm font-mono">[{myTeam.team_tag}]</span>}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
                    isLocked
                      ? 'bg-harvest/20 text-harvest'
                      : 'bg-white/10 text-white/40'
                  }`}>
                    {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    {isLocked ? 'Locked' : 'Unlocked'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-white/60 mt-1 flex-wrap">
                  <span className="flex items-center gap-1"><Gamepad2 className="w-3.5 h-3.5 text-white/40" /><span className="text-white/80">{rosterCount}/{minSize}</span></span>
                  <div className="flex-1 max-w-[140px] h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${fillPct}%`, backgroundColor: fillColor }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <RankBadge medal={teamRank?.medal || 'Unranked'} stars={teamRank?.stars || 0} size="lg" />
              <div className="text-center">
                <p className="text-[10px] sm:text-xs text-white/50 font-semibold mb-0.5">Team Rank</p>
                <p className="text-sm font-black" style={{ color: getMedalColor(teamRank?.medal || 'Unranked') }}>
                  {teamRank?.display || 'Unranked'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Action Buttons Bar (captain only) ─── */}
        {isCaptain && (
        <div className="flex items-center gap-2 p-3 sm:p-4 border-b border-border bg-muted/30 overflow-x-auto">
          {/* Invite Player */}
          <Button
            onClick={() => canInvitePlayers ? setShowInvitePlayer(true) : null}
            disabled={!canInvitePlayers}
            className={`rounded-lg h-9 px-4 text-sm font-bold flex-shrink-0 ${
              canInvitePlayers
                ? 'bg-[#3b82f6] hover:bg-[#2563eb] text-white shadow-sm'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            {rosterCount >= maxSize ? 'Roster Full' : 'Invite Player'}
          </Button>

          {/* Invite Coach / Remove Coach */}
          {hasCoach ? (
            <Button
              onClick={() => teamMutable ? handleRemoveCoach(myTeam.id, myTeam.team_name) : null}
              disabled={!teamMutable}
              className={`rounded-lg h-9 px-4 text-sm font-bold flex-shrink-0 ${
                teamMutable
                  ? 'bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/20'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Remove Coach
            </Button>
          ) : (
            <Button
              onClick={() => canInviteCoach ? setShowInviteCoach(true) : null}
              disabled={!canInviteCoach}
              className={`rounded-lg h-9 px-4 text-sm font-bold flex-shrink-0 ${
                canInviteCoach
                  ? 'bg-[#10b981] hover:bg-[#059669] text-white shadow-sm'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <GraduationCap className="w-4 h-4 mr-1.5" /> Invite Coach
            </Button>
          )}

          {/* Withdraw Team */}
          <Button
            onClick={() => teamMutable ? handleDeleteTeam(myTeam.id, myTeam.team_name) : null}
            disabled={!teamMutable}
            className={`rounded-lg h-9 px-4 text-sm font-bold flex-shrink-0 ml-auto ${
              teamMutable
                ? 'bg-[#ef4444]/5 hover:bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/20'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            <LogOut className="w-4 h-4 mr-1.5" /> Withdraw
          </Button>
        </div>
        )}

        {/* ─── Body ─── */}
        <div className="p-4 sm:p-5 space-y-5">
          {/* Unranked warning */}
          {unrankedCount > 0 && (
            <div className="bg-[#f59e0b]/5 border border-[#f59e0b]/20 rounded-xl p-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#f59e0b] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[#f59e0b]">{unrankedCount} player{unrankedCount > 1 ? 's' : ''} with unknown rank</p>
                <p className="text-xs text-muted-foreground mt-0.5">Players should update their rank via their profile or connect OpenDota.</p>
              </div>
            </div>
          )}

          {/* Roster Grid */}
          <div className="space-y-2">
            <h5 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Roster ({rosterCount}/{minSize})</h5>
            {!roster ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="w-6 h-6 text-muted-foreground animate-spin" /></div>
            ) : roster.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {roster.map((r: any) => (
                  <PlayerCard
                    key={r.id}
                    registration={r}
                    user={user}
                    captainId={myTeam.captain?.id}
                    onRemove={isCaptain && teamMutable && r.person?.id !== myTeam.captain?.id ? () => handleRemoveFromRoster(myTeam.id, r.person.id, r.person.display_name) : undefined}
                    isOfficer={isOfficer}
                    onRankOverride={onRankOverride}
                  />
                ))}
                {hasCoach && teamCoachData[myTeam.id] && (
                  <PlayerCard
                    key={`coach-${myTeam.id}`}
                    registration={buildCoachRegistration(myTeam.coach, teamCoachData[myTeam.id])}
                    user={user}
                    isCoach
                    isOfficer={isOfficer}
                    onRankOverride={onRankOverride}
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic py-4">No roster members yet. Invite players to build your team.</p>
            )}
          </div>

          {/* Pending Invites (captain only) */}
          {isCaptain && invites.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border">
              <h5 className="text-xs font-bold text-[#f59e0b] uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Pending Invites ({invites.length})
              </h5>
              <div className="space-y-1.5">
                {invites.map((inv: any) => {
                  const invName = inv.person?.display_name || 'Unknown';
                  const invAvatar = inv.person?.avatar_url;
                  const isCancelling = cancellingInvite === inv.id;
                  return (
                    <div key={inv.id} className="flex items-center justify-between bg-[#f59e0b]/5 rounded-xl p-2.5 border border-[#f59e0b]/15">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {invAvatar ? (
                          <img src={invAvatar} alt={invName} className="w-7 h-7 rounded-full border border-border flex-shrink-0" width={28} height={28} />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#f59e0b]/15 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-[#f59e0b]">{invName.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{invName}</p>
                          <p className="text-[10px] text-[#f59e0b] font-semibold">Awaiting response</p>
                        </div>
                      </div>
                      <button onClick={() => handleCancelInvite(myTeam.id, inv.id, invName)} disabled={isCancelling} className="text-muted-foreground hover:text-[#ef4444] transition-colors p-1.5 rounded-lg hover:bg-[#ef4444]/10" title="Cancel invite (silent)">
                        {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailX className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ticket Contributions — Phase 3 */}
          <TicketMeterSection
            myTeam={myTeam}
            tournament={tournament}
            roster={roster}
            coachData={teamCoachData[myTeam.id]}
            isMutable={teamMutable}
            handleSetContribution={handleSetContribution}
            settingContribution={settingContribution}
            handleTeamReady={handleTeamReady}
          />
        </div>
      </div>

      {/* ─── Invite Modals ─── */}
      {showInvitePlayer && (
        <InvitePlayerModal
            teamId={myTeam.id}
            teamName={myTeam.team_name}
            freeAgents={freeAgents}
            pendingInvitePersonIds={pendingInvitePersonIds}
            sendingInvite={sendingInvite}
            lastInviteSuccess={lastInviteSuccess}
            onInvite={handleSendInvite}
            onClose={() => setShowInvitePlayer(false)}
          />
        )}
      {showInviteCoach && (
        <InviteCoachModal
            teamId={myTeam.id}
            teamName={myTeam.team_name}
            availableCoaches={availableCoaches}
            sendingInvite={sendingInvite}
            lastInviteSuccess={lastInviteSuccess}
            onInvite={handleSendInvite}
            onClose={() => setShowInviteCoach(false)}
          />
        )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FINISHED TOURNAMENT: Show final standings with hero stats
// ═══════════════════════════════════════════════════════

function FinishedTeamsStandings({
  teams, playerStats, teamRosters, loadingRosters,
  isOwner, setSelectedTeam, setShowEditTeamModal, setActiveTab,
}: TournamentHubTeamsProps & { playerStats: any[]; loadingRosters: boolean }) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);

  // ─── Helper: Get top heroes for a team ───
  const getTopHeroesForTeam = (teamId: string) => {
    const teamStats = playerStats.filter(stat => stat.team_id === teamId);
    const heroCounts: Record<string, number> = {};
    teamStats.forEach(stat => {
      if (stat.hero_id) {
        heroCounts[stat.hero_id] = (heroCounts[stat.hero_id] || 0) + 1;
      }
    });
    const sortedHeroes = Object.entries(heroCounts).sort((a, b) => b[1] - a[1]);
    return sortedHeroes.map(([heroId, count]) => ({ heroId, count }));
  };

  // ─── Helper: Get hero name from ID ───
  const getHeroName = (heroId: string) => {
    const hero = playerStats.find(stat => stat.hero_id === heroId);
    return hero ? hero.hero_name : 'Unknown Hero';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          Final Standings
          <span className="text-muted-foreground text-sm sm:text-base font-normal ml-2">
            {teams.length} team{teams.length !== 1 ? 's' : ''}
          </span>
        </h3>
        {isOwner && (
          <div className="flex gap-2">
            <Button onClick={() => setShowEditTeamModal(true)} className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold rounded-xl shadow-lg">
              <Plus className="w-4 h-4 mr-2" /> Edit Teams
            </Button>
          </div>
        )}
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team: any) => (
          <div key={team.id} className={`bg-card rounded-xl border-2 overflow-hidden transition-all ${team.approval_status === 'ready' ? 'border-harvest/50 shadow-lg shadow-harvest/10' : 'border-border'}`}>
            {/* Brown Header */}
            <div className="bg-gradient-to-r from-soil to-[#1e293b] p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <TeamLogo logoUrl={team.logo_url} teamName={team.team_name} size="lg" />
                  <CoachHeadsetAvatar coach={team.coach} coachData={teamCoachData[team.id]} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-lg sm:text-xl font-bold text-white truncate">{team.team_name}</h4>
                      {team.team_tag && <span className="text-white/50 text-sm font-mono">[{team.team_tag}]</span>}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 ${
                        team.approval_status === 'ready'
                          ? 'bg-harvest/20 text-harvest'
                          : 'bg-white/10 text-white/40'
                      }`}>
                        {team.approval_status === 'ready' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {team.approval_status === 'ready' ? 'Locked' : 'Unlocked'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white/60 mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><Gamepad2 className="w-3.5 h-3.5 text-white/40" /><span className="text-white/80">{team.roster_count}/{team.min_team_size}</span></span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <RankBadge medal={team.rank_medal || 'Unranked'} stars={team.rank_stars || 0} size="lg" />
                  <div className="text-center">
                    <p className="text-[10px] sm:text-xs text-white/50 font-semibold mb-0.5">Team Rank</p>
                    <p className="text-sm font-black" style={{ color: getMedalColor(team.rank_medal || 'Unranked') }}>
                      {team.rank_display || 'Unranked'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 space-y-5">
              {/* Top Heroes */}
              <div className="space-y-2">
                <h5 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Top Heroes</h5>
                {loadingRosters ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="w-6 h-6 text-muted-foreground animate-spin" /></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {getTopHeroesForTeam(team.id).map(({ heroId, count }) => (
                      <div key={heroId} className="bg-[#f59e0b]/5 border border-[#f59e0b]/20 rounded-xl p-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={getHeroImageUrl(heroId)} alt={getHeroName(heroId)} className="w-7 h-7 rounded-full border border-border flex-shrink-0" width={28} height={28} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{getHeroName(heroId)}</p>
                            <p className="text-[10px] text-[#f59e0b] font-semibold">Played {count} time{count > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <button onClick={() => {
                          setSelectedTeamId(team.id);
                          setSelectedHeroId(heroId);
                          setActiveTab('players');
                          setPlayersSubTab('all');
                        }} className="text-muted-foreground hover:text-[#ef4444] transition-colors p-1.5 rounded-lg hover:bg-[#ef4444]/10" title="View hero stats">
                          <Gamepad2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}