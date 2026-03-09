/**
 * Tournament Hub — Coaches Tab
 *
 * Three sections:
 *   1. Available Coaches — registered as coach, not yet assigned to a team
 *   2. Active Coaches — currently coaching a team
 *   3. Teams Without a Coach — approved teams that don't have a coach
 *
 * Receives all data via props from the orchestrator.
 */

import { Shield, Users, Crown, AlertCircle, Loader2, GraduationCap } from '@/lib/icons';
import { TeamLogo } from '@/app/components/team-logo';
import { getRankDisplay, getMedalColor, calculateTeamRank, type TeamRankResult } from '@/lib/rank-utils';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { TcfPlusBadge } from '@/app/components/tcf-plus-badge';

interface TournamentHubCoachesProps {
  tournament: any;
  teams: any[];
  teamRosters: Record<string, any[]>;
  teamCoachData: Record<string, any>;
  registrations?: any;
  user: any;
  isOwner: boolean;
  isMutable: boolean;
  handleAssignCoach: (teamId: string, teamName: string, personId: string, personName: string) => void;
  handleRemoveCoach: (teamId: string, teamName: string) => void;
}

export function TournamentHubCoaches({
  tournament, teams, teamRosters, teamCoachData, registrations,
  user, isOwner, isMutable,
  handleAssignCoach, handleRemoveCoach,
}: TournamentHubCoachesProps) {
  const approvedTeams = teams.filter(t => t.approval_status === 'approved');
  const teamsWithCoach = approvedTeams.filter(t => t.coach);
  const teamsWithoutCoach = approvedTeams.filter(t => !t.coach);

  // Coaches from registration data (role=coach)
  const coaches = registrations?.coaches || [];
  // A coach is "active" if they're coaching a team, "available" if not
  const activeCoachPersonIds = new Set(
    teamsWithCoach.map(t => t.coach?.id || t.coach_person_id).filter(Boolean)
  );
  const availableCoaches = coaches.filter((c: any) => !activeCoachPersonIds.has(c.person_id));

  const rostersLoading = approvedTeams.some(t => !teamRosters[t.id]);

  const totalCoachCount = coaches.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#7c3aed] to-[#6366f1] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-2xl font-black">Coaches</h3>
            <p className="text-white/80 text-sm mt-1">
              {totalCoachCount} coach{totalCoachCount !== 1 ? 'es' : ''} registered
            </p>
          </div>
          <div className="flex gap-3 text-center">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className="text-2xl font-black">{availableCoaches.length}</p>
              <p className="text-xs text-white/80">Available</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className="text-2xl font-black">{teamsWithCoach.length}</p>
              <p className="text-xs text-white/80">Active</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className="text-2xl font-black">{teamsWithoutCoach.length}</p>
              <p className="text-xs text-white/80">Teams Need Coach</p>
            </div>
          </div>
        </div>
        {rostersLoading && (
          <span className="flex items-center gap-1.5 text-xs text-white/60 mt-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading team rank data...
          </span>
        )}
      </div>

      {/* ── Section 1: Available Coaches ── */}
      {availableCoaches.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[#10b981] uppercase tracking-wide flex items-center gap-2">
            <GraduationCap className="w-4 h-4" /> Available Coaches ({availableCoaches.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableCoaches.map((reg: any) => {
              const person = reg.person;
              const linkedUser = reg.linked_user;
              const name = person?.display_name || linkedUser?.discord_username || 'Unknown';
              const avatar = linkedUser?.discord_avatar || person?.avatar_url;
              const coachRank = getRankDisplay(
                linkedUser?.opendota_data?.badge_rank || linkedUser?.badge_rank,
              );

              return (
                <div
                  key={reg.id}
                  className="bg-card rounded-xl border-2 border-[#10b981]/20 p-4 flex items-center gap-3 hover:border-[#10b981]/40 transition-all"
                >
                  <TcfPlusAvatarRing active={linkedUser?.tcf_plus_active} size="xs">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={name}
                      className="w-12 h-12 rounded-full border-2 border-[#10b981]/20 flex-shrink-0"
                      width={48} height={48}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#10b981]/10 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-6 h-6 text-[#10b981]" />
                    </div>
                  )}
                  </TcfPlusAvatarRing>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-foreground text-sm truncate">{name}</p>
                      {linkedUser?.tcf_plus_active && <TcfPlusBadge size="xs" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[#10b981] font-bold">Available</span>
                      {coachRank && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${getMedalColor(coachRank.medal)}15`,
                            color: getMedalColor(coachRank.medal),
                          }}
                        >
                          {coachRank.medal} {coachRank.stars > 0 ? coachRank.stars : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="w-3 h-3 rounded-full bg-[#10b981] flex-shrink-0" title="Available" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section 2: Active Coaches ── */}
      {teamsWithCoach.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[#7c3aed] uppercase tracking-wide flex items-center gap-2">
            <Shield className="w-4 h-4" /> Active Coaches ({teamsWithCoach.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamsWithCoach.map(team => {
              const coach = team.coach;
              const coachLu = teamCoachData[team.id];
              const coachRank = getRankDisplay(coachLu?.opendota_data?.badge_rank || coachLu?.badge_rank);
              const roster = teamRosters[team.id];
              const teamRank: TeamRankResult | null = roster
                ? calculateTeamRank(roster, coachLu)
                : null;

              return (
                <div
                  key={team.id}
                  className="bg-card rounded-2xl border-2 border-[#6366f1]/20 overflow-hidden hover:border-[#6366f1]/40 transition-all"
                >
                  {/* Coach header */}
                  <div className="bg-gradient-to-br from-[#6366f1]/10 to-[#6366f1]/5 p-5">
                    <div className="flex items-center gap-4">
                      <TcfPlusAvatarRing active={coachLu?.tcf_plus_active} size="sm">
                      {coach.avatar_url ? (
                        <img
                          src={coach.avatar_url}
                          alt={coach.display_name}
                          className="w-14 h-14 rounded-full border-3 border-[#6366f1]/30 shadow-md"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-[#6366f1]/20 flex items-center justify-center">
                          <Shield className="w-7 h-7 text-[#6366f1]" />
                        </div>
                      )}
                      </TcfPlusAvatarRing>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-lg font-bold text-foreground truncate">{coach.display_name}</p>
                          {coachLu?.tcf_plus_active && <TcfPlusBadge size="xs" />}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-[#6366f1] font-bold uppercase tracking-wider">Coach</span>
                          {coachRank && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: `${getMedalColor(coachRank.medal)}15`,
                                color: getMedalColor(coachRank.medal),
                              }}
                            >
                              {coachRank.medal} {coachRank.stars > 0 ? coachRank.stars : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Team info */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <TeamLogo logoUrl={team.logo_url} teamName={team.team_name} size="sm" />
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{team.team_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Crown className="w-3 h-3 text-harvest" />
                          {team.captain?.display_name || 'Unknown'}
                          <span className="text-border mx-1">·</span>
                          <Users className="w-3 h-3" />
                          {team.roster_count || 0}/{tournament.max_team_size || 7}
                        </p>
                      </div>
                    </div>

                    {/* Team Rank badge */}
                    {teamRank && (
                      <div
                        className="flex items-center gap-2 rounded-lg px-3 py-2 border text-xs"
                        style={{
                          backgroundColor: `${getMedalColor(teamRank.medal)}08`,
                          borderColor: `${getMedalColor(teamRank.medal)}25`,
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px]"
                          style={{
                            backgroundColor: `${getMedalColor(teamRank.medal)}20`,
                            color: getMedalColor(teamRank.medal),
                          }}
                        >
                          {teamRank.average.toFixed(0)}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">
                            Team Rank: <span style={{ color: getMedalColor(teamRank.medal) }}>{teamRank.display}</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        availableCoaches.length === 0 && (
          <div className="bg-card rounded-2xl border-2 border-dashed border-border p-12 text-center">
            <GraduationCap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-semibold">No coaches yet</p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              Players can register as a coach via Choose Your Path on the Overview tab.
            </p>
          </div>
        )
      )}

      {/* ── Section 3: Teams Without a Coach ── */}
      {teamsWithoutCoach.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[#f59e0b] uppercase tracking-wide flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Teams Looking for Coaches ({teamsWithoutCoach.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {teamsWithoutCoach.map(team => (
              <div key={team.id} className="bg-card rounded-xl border-2 border-dashed border-[#f59e0b]/30 p-4 flex items-center gap-3">
                <TeamLogo logoUrl={team.logo_url} teamName={team.team_name} size="sm" />
                <div className="min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">{team.team_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {team.roster_count || 0}/{tournament.max_team_size || 7} players · No coach
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}